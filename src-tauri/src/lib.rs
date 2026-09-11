// FrameLab Rust 后端（仅桌面端）：
// - 本地图片目录扫描（图库浏览磁盘文件夹）
// - 原生对话框：选图/选目录/另存/打开 JSON 模板
// - AppData JSON 读写（布局、模板、快照、导出偏好）
// - 导出图片字节落盘
// - 原生菜单栏与应用快捷键（事件 framelab://menu 分发给前端）
// 安全模型：WebView 禁止直接 fs，全部经下列 Command IPC 完成。
use base64::Engine as _;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri_plugin_dialog::DialogExt;

/// WebView 可解码的图片扩展名（heic 等系统编码格式不在此列）
const IMAGE_EXTS: [&str; 8] = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif", "jfif"];
/// 目录扫描最大深度（递归模式）
const SCAN_MAX_DEPTH: usize = 3;
/// 单次扫描图片数量上限（防超大目录拖垮 UI）
const SCAN_MAX_ENTRIES: usize = 2000;
/// 单文件读取上限（256MB，防误读超大文件撑爆内存）
const READ_MAX_BYTES: u64 = 256 * 1024 * 1024;
/// 绿色版更新包大小上限（200MB）：防异常/恶意响应撑爆内存（release 为 panic=abort，
/// 分配失败即进程崩溃；审查报告 T4）
const GREEN_UPDATE_MAX_BYTES: u64 = 200 * 1024 * 1024;
/// 项目 GitHub 仓库地址（帮助菜单 → GitHub 项目主页）
const GITHUB_REPO_URL: &str = "https://github.com/yuhaowang774/FrameLabdesktop";
/// 意见反馈：GitHub 新建 Issue（帮助菜单 → 意见反馈；邮箱直接显示在菜单中）
const GITHUB_ISSUES_URL: &str = "https://github.com/yuhaowang774/FrameLabdesktop/issues/new";

#[derive(Serialize, Clone)]
pub struct ImageEntry {
    pub path: String,
    pub name: String,
    /// 修改时间（Unix 秒）：启动还原时校验目录缓存指纹用（宽高/EXIF/缩略图是否可复用）
    pub mtime: u64,
    /// 文件大小（字节）：同上，与 mtime 共同构成「文件未变」指纹
    pub len: u64,
}

/// Unix 秒时间戳（metadata.modified() 失败时返回 0，指纹不匹配仅导致缓存未命中，无害）
fn epoch_secs(t: std::io::Result<std::time::SystemTime>) -> u64 {
    t.ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn is_image(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn scan_dir(dir: &Path, depth: usize, out: &mut Vec<ImageEntry>) {
    if depth == 0 || out.len() >= SCAN_MAX_ENTRIES {
        return;
    }
    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };
    let mut subdirs: Vec<PathBuf> = Vec::new();
    for entry in read_dir.flatten() {
        if out.len() >= SCAN_MAX_ENTRIES {
            break;
        }
        let p = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue; // 跳过隐藏文件/目录
        }
        if p.is_dir() {
            subdirs.push(p);
        } else if is_image(&p) {
            let (mtime, len) = match entry.metadata() {
                Ok(m) => (epoch_secs(m.modified()), m.len()),
                Err(_) => (0, 0),
            };
            out.push(ImageEntry {
                path: p.to_string_lossy().to_string(),
                name,
                mtime,
                len,
            });
        }
    }
    for d in subdirs {
        scan_dir(&d, depth - 1, out);
    }
}

/// 扫描目录内图片；recursive=true 时递归子目录（深度受限）
#[tauri::command]
async fn list_dir_images(dir: String, recursive: Option<bool>) -> Result<Vec<ImageEntry>, String> {
    // 审查报告 T5：目录扫描（最多 2000 条 stat + 递归）移出主线程，避免大目录冻结窗口
    tauri::async_runtime::spawn_blocking(move || list_dir_images_sync(dir, recursive))
        .await
        .map_err(|e| format!("扫描任务失败: {e}"))?
}
fn list_dir_images_sync(dir: String, recursive: Option<bool>) -> Result<Vec<ImageEntry>, String> {
    let path = Path::new(&dir);
    if !path.is_dir() {
        return Err(format!("不是有效目录: {dir}"));
    }
    let mut out = Vec::new();
    let depth = if recursive.unwrap_or(false) { SCAN_MAX_DEPTH } else { 1 };
    scan_dir(path, depth, &mut out);
    out.sort_by(|a, b| a.path.to_lowercase().cmp(&b.path.to_lowercase()));
    out.truncate(SCAN_MAX_ENTRIES);
    Ok(out)
}

/// 读取本地文件全部内容并返回 base64（EXIF 解析 / 自定义背景转 dataURL 用）
#[tauri::command]
async fn read_file_base64(path: String) -> Result<String, String> {
    // 审查报告 T5：大文件读盘移出主线程
    tauri::async_runtime::spawn_blocking(move || read_file_base64_sync(path))
        .await
        .map_err(|e| format!("读取任务失败: {e}"))?
}
fn read_file_base64_sync(path: String) -> Result<String, String> {
    // 审查报告 T7：单一句柄 + take 限读——先 metadata 再按路径打开存在 TOCTOU
    //（两步之间文件可被替换为大文件/命名管道，read_to_end 无上限 → 内存爆掉）
    let file = fs::File::open(&path).map_err(|e| format!("打开文件失败: {e}"))?;
    let meta = file.metadata().map_err(|e| format!("读取文件信息失败: {e}"))?;
    if meta.len() > READ_MAX_BYTES {
        return Err("文件过大（超过 256MB）".into());
    }
    let mut buf = Vec::with_capacity(meta.len() as usize);
    let mut limited = file.take(READ_MAX_BYTES + 1);
    limited.read_to_end(&mut buf).map_err(|e| format!("读取文件失败: {e}"))?;
    if buf.len() as u64 > READ_MAX_BYTES {
        return Err("文件过大（超过 256MB）".into());
    }
    Ok(base64::engine::general_purpose::STANDARD.encode(buf))
}

/// 读取本地文件原始字节（二进制 IPC 通道，直接返回 ArrayBuffer）。
/// 与 read_file_base64 相比：不走 base64 编码与 JSON 字符串序列化，
/// 80MB 照片的 IPC 瞬时内存从 ~1GB 级多副本降到单份 80MB（大图加载/导出主路径）。
#[tauri::command]
async fn read_file_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    // 审查报告 T5：80MB 级读盘移出主线程（大图加载/导出主路径）
    tauri::async_runtime::spawn_blocking(move || read_file_bytes_sync(path))
        .await
        .map_err(|e| format!("读取任务失败: {e}"))?
}
fn read_file_bytes_sync(path: String) -> Result<tauri::ipc::Response, String> {
    // 审查报告 T7：单一句柄 + take 限读（同上防 TOCTOU）
    let file = fs::File::open(&path).map_err(|e| format!("打开文件失败: {e}"))?;
    let meta = file.metadata().map_err(|e| format!("读取文件信息失败: {e}"))?;
    if meta.len() > READ_MAX_BYTES {
        return Err("文件过大（超过 256MB）".into());
    }
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    let mut limited = file.take(READ_MAX_BYTES + 1);
    limited.read_to_end(&mut bytes).map_err(|e| format!("读取文件失败: {e}"))?;
    if bytes.len() as u64 > READ_MAX_BYTES {
        return Err("文件过大（超过 256MB）".into());
    }
    Ok(tauri::ipc::Response::new(bytes))
}

/// 读取图片元数据（宽/高/文件大小），导入提速关键路径：只解析头部不解码像素。
/// JPEG 走 jpeg-decoder read_info（仅解析 SOF 等头部，大图毫秒级）；
/// PNG 手工解析 IHDR（宽高为大端 u32，偏移 16/20）；其它格式返回 Err，前端回退 Image 解码。
/// 二进制布局：w u32 LE + h u32 LE + size u64 LE。
#[tauri::command]
async fn read_image_meta(path: String) -> Result<tauri::ipc::Response, String> {
    // 审查报告 T5：头部解析（批量导入每张一次）移出主线程
    tauri::async_runtime::spawn_blocking(move || read_image_meta_sync(path))
        .await
        .map_err(|e| format!("读取任务失败: {e}"))?
}
fn read_image_meta_sync(path: String) -> Result<tauri::ipc::Response, String> {
    use std::io::{BufReader, Read};
    let meta = fs::metadata(&path).map_err(|e| format!("读取文件信息失败: {e}"))?;
    let size = meta.len();
    let ext_ok = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_ascii_lowercase().as_str(), "jpg" | "jpeg" | "jfif" | "png"))
        .unwrap_or(false);
    if !ext_ok {
        return Err("非 JPEG/PNG 格式，走前端解码".into());
    }
    let mut f = fs::File::open(&path).map_err(|e| format!("打开文件失败: {e}"))?;
    let mut head = [0u8; 24];
    let mut n = 0usize;
    while n < head.len() {
        let r = f.read(&mut head[n..]).map_err(|e| format!("读取文件失败: {e}"))?;
        if r == 0 {
            break;
        }
        n += r;
    }
    let is_png = n >= 24 && head.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]);
    let (w, h) = if is_png {
        // 审查报告 T14：确认偏移 12..16 为 IHDR chunk（PNG 规范的首个 chunk），
        // 否则畸形文件可声明任意尺寸污染图库布局与目录 meta 缓存
        if &head[12..16] != b"IHDR" {
            return Err("PNG 头部异常（缺少 IHDR）".into());
        }
        (
            u32::from_be_bytes([head[16], head[17], head[18], head[19]]),
            u32::from_be_bytes([head[20], head[21], head[22], head[23]]),
        )
    } else {
        // 头部预读已移动文件指针（n 字节），JPEG 解码前必须回卷到起点，
        // 否则 SOI 标记被跳过 → "first two bytes are not an SOI marker"，
        // 前端 readImageMeta 吞错回退全量解码，快速路径整体失效。
        f.seek(SeekFrom::Start(0)).map_err(|e| format!("重定位文件失败: {e}"))?;
        let mut decoder = jpeg_decoder::Decoder::new(BufReader::new(f));
        decoder
            .read_info()
            .map_err(|e| format!("读取 JPEG 元数据失败: {e}"))?;
        let info = decoder.info().ok_or_else(|| "无法读取 JPEG 元数据".to_string())?;
        (info.width as u32, info.height as u32)
    };
    if w == 0 || h == 0 {
        return Err("图片尺寸无效".into());
    }
    // 审查报告 T14：尺寸上界（畸形文件可声明超大尺寸进入排版计算与目录缓存）
    if w > 100_000 || h > 100_000 {
        return Err("图片尺寸异常".into());
    }
    let mut out = Vec::with_capacity(24);
    out.extend_from_slice(&w.to_le_bytes());
    out.extend_from_slice(&h.to_le_bytes());
    out.extend_from_slice(&size.to_le_bytes());
    out.extend_from_slice(&epoch_secs(meta.modified()).to_le_bytes());
    Ok(tauri::ipc::Response::new(out))
}

// ===== 缩略图磁盘缓存（启动还原零解码的关键） =====
// 首次生成的缩略图（长边 ≤320 JPEG）按「路径哈希 + mtime + 大小」指纹落盘 AppData/thumbs/；
// 下次启动直接读小文件回 objectURL，完全跳过原图解码。原图改动（mtime/大小变化）指纹失配
// 自动失效重生成；目录可整体删除（纯缓存，无权威数据）。

/// FNV-1a 64 位（跨构建稳定，不作安全用途）：路径 → 缩略图文件名前缀
fn fnv1a64(s: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in s.as_bytes() {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

/// 缩略图缓存目录（AppData/thumbs；开发版 dev-thumbs 与正式版隔离）
fn thumbs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位 AppData 目录: {e}"))?
        .join(if cfg!(debug_assertions) { "dev-thumbs" } else { "thumbs" });
    fs::create_dir_all(&dir).map_err(|e| format!("创建缩略图缓存目录失败: {e}"))?;
    Ok(dir)
}

/// 按当前文件指纹推导缩略图文件路径（文件不存在时返回 None）
fn thumb_file_for(app: &AppHandle, path: &str) -> Result<Option<PathBuf>, String> {
    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return Ok(None),
    };
    let dir = thumbs_dir(app)?;
    let name = format!("{:016x}-{}-{}.jpg", fnv1a64(path), epoch_secs(meta.modified()), meta.len());
    Ok(Some(dir.join(name)))
}

/// 读取持久化缩略图（指纹命中返回 JPEG 字节；未命中/文件已变返回空字节——
/// 注意 tauri::ipc::Response 不能包 Option 返回，特型解析不支持，空即「未命中」）
#[tauri::command]
fn thumb_get(app: AppHandle, path: String) -> Result<tauri::ipc::Response, String> {
    let miss = || Ok(tauri::ipc::Response::new(Vec::new()));
    let Some(f) = thumb_file_for(&app, &path)? else {
        return miss();
    };
    if !f.exists() {
        return miss();
    }
    let bytes = fs::read(f).map_err(|e| format!("读取缩略图失败: {e}"))?;
    Ok(tauri::ipc::Response::new(bytes))
}

/// 持久化缩略图（data_base64 = 缩略图 JPEG 的 base64）；同时清理同路径旧指纹文件
#[tauri::command]
fn thumb_put(app: AppHandle, path: String, data_base64: String) -> Result<(), String> {
    let Some(f) = thumb_file_for(&app, &path)? else {
        return Err("源文件不存在，无法持久化缩略图".into());
    };
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|e| format!("缩略图数据解码失败: {e}"))?;
    if bytes.is_empty() {
        return Err("缩略图数据为空".into());
    }
    // 审查报告 T15：大小上限 + JPEG 头尾校验（IPC 对任意调用方开放，防写入大文件填盘）
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("缩略图数据超过 2MB 上限".into());
    }
    if !(bytes.starts_with(&[0xFF, 0xD8]) && bytes.ends_with(&[0xFF, 0xD9])) {
        return Err("缩略图数据不是有效 JPEG".into());
    }
    // 清理同一路径的旧指纹文件（改名/改动后残留），目录内前缀匹配
    let prefix = format!("{:016x}-", fnv1a64(&path));
    if let Some(parent) = f.parent() {
        if let Ok(rd) = fs::read_dir(parent) {
            let current = f.file_name().map(|n| n.to_string_lossy().to_string());
            for e in rd.flatten() {
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with(&prefix) && Some(name.clone()) != current {
                    let _ = fs::remove_file(e.path());
                }
            }
        }
    }
    // 审查报告 T15：临时文件 + rename 原子替换（并发读取不会读到半截 JPEG）
    let tmp = f.with_extension("jpg.tmp");
    fs::write(&tmp, &bytes).map_err(|e| format!("写入缩略图失败: {e}"))?;
    fs::rename(&tmp, &f).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("写入缩略图失败: {e}")
    })
}

/// 只读文件前 len 字节（EXIF 头部解析用）：EXIF 存于 JPEG APP1 段（规格上限 64KB/段），
/// 只读头部 2MB 即可完成解析，替代大图全量读盘（导入/启动还原提速的关键路径）。
#[tauri::command]
async fn read_file_head(path: String, len: u32) -> Result<tauri::ipc::Response, String> {
    // 审查报告 T5：批量导入/启动还原的高频路径，移出主线程
    tauri::async_runtime::spawn_blocking(move || read_file_head_sync(path, len))
        .await
        .map_err(|e| format!("读取任务失败: {e}"))?
}
fn read_file_head_sync(path: String, len: u32) -> Result<tauri::ipc::Response, String> {
    let mut f = fs::File::open(&path).map_err(|e| format!("打开文件失败: {e}"))?;
    let len = (len as usize).min(8 * 1024 * 1024);
    let mut buf = vec![0u8; len];
    let mut read = 0usize;
    while read < len {
        let r = f.read(&mut buf[read..]).map_err(|e| format!("读取文件失败: {e}"))?;
        if r == 0 {
            break;
        }
        read += r;
    }
    buf.truncate(read);
    Ok(tauri::ipc::Response::new(buf))
}

/// 读取 JPEG 并在解码阶段直接缩放（DCT 1/2·1/4·1/8），返回 RGBA 位图。
/// 二进制格式：前 8 字节 = 缩放后宽/高（u32 LE），其余为 RGBA 像素。
///
/// 内存关键路径（实测归因）：WebView 渲染进程里 createImageBitmap(blob, resize)
/// 对 96MP JPEG 的解码+缩放会产生 ~3.9GB 瞬时分配（全尺寸位图 + 多级缩放中间缓冲），
/// 导致渲染进程 OOM 崩溃/多秒冻结、整机提交内存冲上 5GB。改为 Rust 侧 DCT 缩放解码后，
/// 跨 IPC 的只有缩放后的 RGBA（96MP@1/4 ≈ 24MB），渲染进程全程不物化全尺寸位图。
/// 非 JPEG（PNG/WebP/CMYK 等）返回 Err，由前端回退到 createImageBitmap 路径。
#[tauri::command]
async fn read_preview_bytes(path: String, long_max: u32) -> Result<tauri::ipc::Response, String> {
    // 审查报告 T5：96MP 解码可达秒级——必须移出主线程（此前会冻结窗口不重绘）
    tauri::async_runtime::spawn_blocking(move || read_preview_bytes_sync(path, long_max))
        .await
        .map_err(|e| format!("解码任务失败: {e}"))?
}
fn read_preview_bytes_sync(path: String, long_max: u32) -> Result<tauri::ipc::Response, String> {
    use std::io::BufReader;
    // 扩展名预检：jpeg-decoder 只支持 JPEG，其余格式直接走前端回退
    let ext_ok = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_ascii_lowercase().as_str(), "jpg" | "jpeg" | "jfif"))
        .unwrap_or(false);
    if !ext_ok {
        return Err("非 JPEG 格式，走前端解码".into());
    }
    let file = fs::File::open(&path).map_err(|e| format!("打开文件失败: {e}"))?;
    let mut decoder = jpeg_decoder::Decoder::new(BufReader::new(file));
    decoder
        .read_info()
        .map_err(|e| format!("读取 JPEG 元数据失败: {e}"))?;
    let info = decoder.info().ok_or_else(|| "无法读取 JPEG 元数据".to_string())?;
    let (w0, h0) = (info.width as u32, info.height as u32);
    if w0 == 0 || h0 == 0 {
        return Err("JPEG 尺寸无效".into());
    }
    // 审查报告 T9：long_max 由调用方给定，必须 clamp——≥65536 时 `as u16` 会静默截断
    //（如 100000 → 34464）导致缩放档位选错；0 会退化成 1×1。
    let long_max = long_max.clamp(1, u16::MAX as u32);
    // 等比目标尺寸：长边压到 long_max 内（不放大）
    let long = w0.max(h0);
    let (tw, th) = if long > long_max {
        let f = long_max as f64 / long as f64;
        (
            ((w0 as f64 * f).round() as u32).max(1),
            ((h0 as f64 * f).round() as u32).max(1),
        )
    } else {
        (w0, h0)
    };
    // DCT 缩放解码：按需选 1/1、1/2、1/4、1/8（内部取「能覆盖目标尺寸的最小缩放档」）
    decoder
        .scale(tw as u16, th as u16)
        .map_err(|e| format!("JPEG 缩放配置失败: {e}"))?;
    let pixels = decoder
        .decode()
        .map_err(|e| format!("JPEG 解码失败: {e}"))?;
    // 缩放后的实际尺寸（档位取整，如 12000×8000@1/4 → 3000×2000）
    let out_info = decoder.info().ok_or_else(|| "无法读取解码信息".to_string())?;
    let rgba: Vec<u8> = match out_info.pixel_format {
        jpeg_decoder::PixelFormat::RGB24 => {
            let n = pixels.len() / 3;
            let mut out = Vec::with_capacity(n * 4);
            for px in pixels.chunks_exact(3) {
                out.extend_from_slice(&[px[0], px[1], px[2], 255]);
            }
            out
        }
        jpeg_decoder::PixelFormat::L8 => {
            let mut out = Vec::with_capacity(pixels.len() * 4);
            for v in &pixels {
                out.extend_from_slice(&[*v, *v, *v, 255]);
            }
            out
        }
        // CMYK / 16bit 灰度等罕见格式：交给前端 Chromium 解码
        _ => return Err("JPEG 像素格式不支持缩放解码，走前端解码".into()),
    };
    let mut out = Vec::with_capacity(8 + rgba.len());
    out.extend_from_slice(&(out_info.width as u32).to_le_bytes());
    out.extend_from_slice(&(out_info.height as u32).to_le_bytes());
    out.extend_from_slice(&rgba);
    Ok(tauri::ipc::Response::new(out))
}

/// 判断路径是否已存在（导出重名检测用）
#[tauri::command]
async fn path_exists(path: String) -> Result<bool, String> {
    Ok(std::fs::metadata(&path).is_ok())
}

/// 把合成结果（base64）写入指定路径，自动创建父目录
#[tauri::command]
fn write_file_base64(path: String, base64_data: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("base64 解码失败: {e}"))?;
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    fs::write(&path, bytes).map_err(|e| format!("写入文件失败: {e}"))
}

// ===== AppData JSON 存储（布局/模板/快照/导出偏好） =====

fn data_file(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位 AppData 目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建 AppData 目录失败: {e}"))?;
    // 开发版数据文件独立存放（dev- 前缀），与正式版完全互不干扰
    let owned = if cfg!(debug_assertions) { format!("dev-{filename}") } else { filename.to_string() };
    // 文件名白名单化，避免路径穿越
    let safe: String = owned
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    Ok(dir.join(format!("{safe}.json")))
}

// ===== 启动自愈（白屏恢复）=====
// 前端启动看门狗（public/boot-watchdog.js）在 8 秒后仍未挂载成功时，
// 会把捕获的错误经 write_boot_log 落盘，并展示恢复界面（清缓存重启 / 禁用 GPU 重启）。
// 两个修复动作均以「标记文件 + 重启」实现：标记在下次启动的 setup 阶段（WebView2
// 初始化之前）处理 —— 此时旧进程已退出、缓存文件未被锁定，删除必然成功。

/// 启动错误日志：写入 AppData/logs/boot-<时间戳>.log，保留最近 10 个
#[tauri::command]
fn write_boot_log(app: AppHandle, content: String) -> Result<(), String> {
    // 审查报告 T16：截断超长内容（命令对渲染进程开放，防被循环写入超大文本）
    let content: String = if content.len() > 64 * 1024 {
        // 按字符边界截断，避免切断 UTF-8 序列
        let mut end = 64 * 1024;
        while end > 0 && !content.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}…（已截断）", &content[..end])
    } else {
        content
    };
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位 AppData 目录: {e}"))?
        .join("logs");
    fs::create_dir_all(&dir).map_err(|e| format!("创建日志目录失败: {e}"))?;
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let ver = app.package_info().version.to_string();
    // 毫秒时间戳：同秒多次写入（连环错误触发）不再互相覆盖
    fs::write(dir.join(format!("boot-{ms}.log")), format!("version={ver}\n{content}"))
        .map_err(|e| format!("写入启动日志失败: {e}"))?;
    // 裁剪：仅保留最近 10 个启动日志
    if let Ok(entries) = fs::read_dir(&dir) {
        let mut logs: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with("boot-"))
            .map(|e| e.path())
            .collect();
        if logs.len() > 10 {
            logs.sort();
            for p in logs[..logs.len() - 10].to_vec() {
                let _ = fs::remove_file(p);
            }
        }
    }
    Ok(())
}

/// 清理 WebView2 缓存目录（保留 Local Storage / IndexedDB 等用户数据）。
/// 同时覆盖正式版默认目录（EBWebView）与开发版目录（webview-data-dev/EBWebView）。
fn clean_webview_caches(local_dir: &Path) {
    let roots = [
        local_dir.join("EBWebView"),
        local_dir.join("webview-data-dev").join("EBWebView"),
    ];
    for root in roots {
        if !root.is_dir() {
            continue;
        }
        // 缓存类子目录：删除安全，不触碰 Local Storage / IndexedDB / Session Storage
        let subs = [
            "Default/Cache",
            "Default/Code Cache",
            "Default/Service Worker",
            "Default/GPUCache",
            "GPUCache",
            "GrShaderCache",
            "ShaderCache",
            "GraphiteDawnCache",
        ];
        for sub in subs {
            let _ = fs::remove_dir_all(root.join(sub));
        }
    }
}

/// 排队「清除 WebView2 缓存」并重启：写标记 → 重启 → 下次启动 setup 中清理
#[tauri::command]
fn queue_webview_cache_clean(app: AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("无法定位数据目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {e}"))?;
    fs::write(dir.join("clean-webview-cache.flag"), "1")
        .map_err(|e| format!("写入清理标记失败: {e}"))?;
    app.restart()
}

/// 排队「本次启动禁用 GPU 加速」并重启：写标记 → 重启 → 下次启动以 --disable-gpu 构建窗口。
/// 用于 GPU 驱动 / 显卡缓存异常导致的白屏自救；flag 一次性消费，之后可到首选项调显卡。
#[tauri::command]
fn queue_disable_gpu(app: AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("无法定位数据目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {e}"))?;
    fs::write(dir.join("disable-gpu.flag"), "1").map_err(|e| format!("写入标记失败: {e}"))?;
    app.restart()
}

#[tauri::command]
fn read_app_json(app: AppHandle, filename: String) -> Result<Option<String>, String> {
    let p = data_file(&app, &filename)?;
    if !p.exists() {
        return Ok(None);
    }
    fs::read_to_string(p).map(Some).map_err(|e| format!("读取失败: {e}"))
}

#[tauri::command]
fn write_app_json(app: AppHandle, filename: String, content: String) -> Result<(), String> {
    let p = data_file(&app, &filename)?;
    // 内容上限：防 IPC 被滥用写入超大数据（目录 JSON 正常量级 KB~MB）
    if content.len() > 64 * 1024 * 1024 {
        return Err("内容超过 64MB 上限".into());
    }
    // 原子写：先写同目录临时文件再 rename 替换——进程被杀 / 断电不会留下半截 JSON
    // （半截文件会被前端宽容解析当空目录，进而把「空目录」写回导致图库丢失）
    let tmp = p.with_file_name(format!("{filename}.tmp"));
    fs::write(&tmp, &content).map_err(|e| format!("写入失败: {e}"))?;
    fs::rename(&tmp, &p).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("写入失败: {e}")
    })
}

// ===== 原生对话框（blocking 系列必须运行在非主线程 → 命令声明为 async） =====

fn path_string(fp: tauri_plugin_dialog::FilePath) -> Result<String, String> {
    let p = fp.into_path().map_err(|e| format!("路径解析失败: {e}"))?;
    Ok(p.to_string_lossy().to_string())
}

/// 选择文件夹（导出目录 / 图库文件夹）
#[tauri::command]
async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    match app.dialog().file().blocking_pick_folder() {
        Some(fp) => Ok(Some(path_string(fp)?)),
        None => Ok(None),
    }
}

/// 选择多张本地图片
#[tauri::command]
async fn pick_image_files(app: AppHandle) -> Result<Vec<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("图片", &["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif"])
        .blocking_pick_files()
        .unwrap_or_default();
    picked
        .into_iter()
        .map(path_string)
        .collect::<Result<Vec<_>, _>>()
}


/// 另存文件对话框（按默认文件名后缀自动匹配过滤器）
#[tauri::command]
async fn save_file_dialog(app: AppHandle, default_name: String) -> Result<Option<String>, String> {
    let lower = default_name.to_lowercase();
    let exts: &[&str] = if lower.ends_with(".json") {
        &["json"]
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        &["jpg", "jpeg"]
    } else {
        &["png"]
    };
    match app
        .dialog()
        .file()
        .add_filter("文件", exts)
        .set_file_name(&default_name)
        .blocking_save_file()
    {
        Some(fp) => Ok(Some(path_string(fp)?)),
        None => Ok(None),
    }
}

// ===== 原生菜单栏 + 应用快捷键 =====

fn build_menu(app: &AppHandle) -> tauri::Result<()> {
    // 文件
    let import_images =
        MenuItem::with_id(app, "import_images", "导入照片…", true, Some("CmdOrCtrl+Shift+O"))?;
    let goto_export =
        MenuItem::with_id(app, "goto_export", "转到导出模块", true, Some("CmdOrCtrl+E"))?;
    let preferences =
        MenuItem::with_id(app, "preferences", "首选项…", true, Some("CmdOrCtrl+,"))?;
    let quit = PredefinedMenuItem::quit(app, Some("退出"))?;
    let file_menu = SubmenuBuilder::new(app, "文件")
        .item(&import_images)
        .item(&goto_export)
        .separator()
        .item(&preferences)
        .separator()
        .item(&quit)
        .build()?;

    // 编辑（撤销/重做由菜单加速键接管，前端 keydown 在桌面端跳过，避免双触发）
    let undo = MenuItem::with_id(app, "undo", "撤销", true, Some("CmdOrCtrl+Z"))?;
    let redo = MenuItem::with_id(app, "redo", "重做", true, Some("CmdOrCtrl+Shift+Z"))?;
    let edit_menu = SubmenuBuilder::new(app, "编辑").item(&undo).item(&redo).build()?;

    // 视图（模块切换对标 LrC）
    let m_lib = MenuItem::with_id(app, "module_library", "图库", true, Some("CmdOrCtrl+Alt+1"))?;
    let m_dev = MenuItem::with_id(app, "module_develop", "编辑", true, Some("CmdOrCtrl+Alt+2"))?;
    let m_exp = MenuItem::with_id(app, "module_export", "导出", true, Some("CmdOrCtrl+Alt+3"))?;
    let prev = MenuItem::with_id(app, "prev_photo", "上一张照片", true, Some("CmdOrCtrl+Left"))?;
    let next = MenuItem::with_id(app, "next_photo", "下一张照片", true, Some("CmdOrCtrl+Right"))?;
    let filmstrip =
        MenuItem::with_id(app, "toggle_filmstrip", "显示/隐藏胶片条", true, Some("CmdOrCtrl+F"))?;
    let view_menu = SubmenuBuilder::new(app, "视图")
        .item(&m_lib)
        .item(&m_dev)
        .item(&m_exp)
        .separator()
        .item(&prev)
        .item(&next)
        .separator()
        .item(&filmstrip)
        .build()?;

    // 帮助
    let show_help = MenuItem::with_id(app, "show_help", "使用帮助", true, None::<&str>)?;
    let open_github =
        MenuItem::with_id(app, "open_github", "GitHub 项目主页", true, None::<&str>)?;
    let open_feedback = MenuItem::with_id(app, "open_feedback", "意见反馈…", true, None::<&str>)?;
    // 反馈邮箱：enabled=false 的纯展示菜单项，直接显示邮箱地址，点击无动作
    let mail_feedback = MenuItem::with_id(
        app,
        "mail_feedback",
        "反馈邮箱：1726168641@qq.com",
        false,
        None::<&str>,
    )?;
    let help_menu = SubmenuBuilder::new(app, "帮助")
        .item(&show_help)
        .separator()
        .item(&mail_feedback)
        .item(&open_feedback)
        .item(&open_github)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&file_menu, &edit_menu, &view_menu, &help_menu])
        .build()?;
    app.set_menu(menu)?;
    Ok(())
}

// ===== GPU 首选项（独显加速） =====

/// 枚举本机全部已安装的 WebView2 Evergreen/Fixed Runtime 的 msedgewebview2.exe。
/// 关键：FrameLab 的 GPU 渲染实际发生在 msedgewebview2.exe 子进程内，
/// Windows GPU 首选项按进程映像路径匹配，必须同时覆盖宿主与运行时才生效。
fn webview2_runtime_exes() -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    let mut roots: Vec<PathBuf> = vec![PathBuf::from(r"C:\Program Files (x86)\Microsoft\EdgeWebView\Application")];
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        roots.push(PathBuf::from(&local).join(r"Microsoft\EdgeWebView\Application"));
        // Fixed Version 运行时的常见自定义安装根
        roots.push(PathBuf::from(&local).join(r"Microsoft\EdgeWebView\FixedVersion"));
    }
    for root in &roots {
        let Ok(rd) = fs::read_dir(root) else { continue };
        for entry in rd.flatten() {
            let p = entry.path().join("msedgewebview2.exe");
            if p.is_file() {
                out.push(p);
            }
        }
    }
    out
}

/// 创建隐藏窗口的子进程命令（GUI 应用下 powershell/reg/cmd 等控制台程序
/// 默认会弹出终端窗口，必须加 CREATE_NO_WINDOW）。
#[cfg(windows)]
fn hidden_command(prog: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut c = std::process::Command::new(prog);
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

/// 设置 GPU 首选项（Windows 图形设置 GpuPreference）：
/// mode = "dgpu"（高性能/独显）| "igpu"（节能/核显）| "auto"（由 Windows 决定，删除注册表值）。
/// 对宿主 exe 与全部 WebView2 运行时 exe 生效，重启应用后生效。
#[tauri::command]
fn set_gpu_preference_mode(mode: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        let key = r"HKCU\Software\Microsoft\DirectX\UserGpuPreferences";
        let pref: &str = match mode.as_str() {
            "dgpu" => "GpuPreference=2;",
            "igpu" => "GpuPreference=1;",
            "auto" => "",
            other => return Err(format!("未知 GPU 模式: {other}")),
        };
        // 目标清单：宿主 exe + 全部 WebView2 运行时 exe
        let mut targets: Vec<String> = Vec::new();
        match std::env::current_exe() {
            Ok(exe) => targets.push(exe.to_string_lossy().to_string()),
            Err(e) => return Err(format!("获取应用路径失败: {e}")),
        }
        for p in webview2_runtime_exes() {
            targets.push(p.to_string_lossy().to_string());
        }

        for t in &targets {
            if pref.is_empty() {
                // auto：值不存在时 reg delete 返回非零，视为已移除（幂等，失败忽略）
                let _ = hidden_command("reg")
                    .args(["delete", key, "/v", t, "/f"])
                    .output();
            } else {
                let output = hidden_command("reg")
                    .args(["add", key, "/v", t, "/t", "REG_SZ", "/d", pref, "/f"])
                    .output()
                    .map_err(|e| format!("执行 reg 失败: {e}"))?;
                if !output.status.success() {
                    return Err(format!(
                        "写入 GPU 首选项失败({t}): {}",
                        String::from_utf8_lossy(&output.stderr)
                    ));
                }
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = mode;
        Err("仅支持 Windows".into())
    }
}

/// 用 ShellExecuteW 打开 URL / 系统设置页（走 shell 关联，无 cmd 子进程）。
/// 说明：此前用 `cmd /c start <url>` 打开链接，0.1.26 起 Windows Defender 机器学习
/// 将其判为 Trojan:Win32/Sabsik.FL.A!ml（dropper 常用 cmd start 拉起 payload/URL，
/// 未签名 NSIS 包整体特征叠加后触发），改用 Win32 API 后消除该特征。
#[cfg(windows)]
fn shell_open(target: &str) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: *mut std::ffi::c_void,
            verb: *const u16,
            file: *const u16,
            params: *const u16,
            dir: *const u16,
            show: i32,
        ) -> usize;
    }

    let wide = |s: &str| -> Vec<u16> {
        std::ffi::OsStr::new(s).encode_wide().chain(Some(0)).collect()
    };
    let verb = wide("open");
    let file = wide(target);
    // SW_SHOWNORMAL = 1；返回值 > 32 表示成功
    let ret = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1,
        )
    };
    if ret > 32 {
        Ok(())
    } else {
        Err(format!("ShellExecuteW 返回 {ret}"))
    }
}

/// 打开 Windows「图形设置」页（用户可为应用手动指定高性能 GPU）
#[tauri::command]
fn open_graphics_settings() -> Result<(), String> {
    #[cfg(windows)]
    {
        shell_open("ms-settings:graphics").map_err(|e| format!("打开系统设置失败: {e}"))
    }
    #[cfg(not(windows))]
    {
        Err("仅支持 Windows".into())
    }
}

/// 在资源管理器中定位文件（explorer /select）。仅 Windows；失败返回错误串。
#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let p = std::path::PathBuf::from(path.replace('/', "\\"));
        if !p.exists() {
            return Err(format!("路径不存在: {}", p.display()));
        }
        // canonicalize 会带 \\?\ 前缀，explorer 不识别，需剥掉
        let full = match std::fs::canonicalize(&p) {
            Ok(c) => {
                let s = c.to_string_lossy().into_owned();
                s.strip_prefix("\\\\?\\").map(|x| x.to_string()).unwrap_or(s)
            }
            Err(_) => p.to_string_lossy().into_owned(),
        };
        // 审查报告 T18：raw_arg 不做转义，显式拒绝含引号的路径
        //（当前依赖「Windows 文件名不含引号」兜底，此处固化为代码保证）
        if full.contains('"') {
            return Err("路径包含非法字符".into());
        }
        // 注意：/select, 与带引号路径必须是两个独立 raw_arg；
        // 整段包在一个引号里 explorer 解析不了，会退化打开默认文件夹（文档）
        hidden_command("explorer")
            .raw_arg("/select,")
            .raw_arg(format!("\"{}\"", full))
            .spawn()
            .map_err(|e| format!("打开资源管理器失败: {e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("仅支持 Windows".into())
    }
}

/// 重启应用：以相同可执行文件拉起新进程并退出当前进程（首选项「重启应用」按钮）。
/// 顺序为先拉起新进程再退出：单实例互斥随本进程退出即释放，而新进程初始化到
/// 检查互斥（插件 setup）需要数十毫秒，晚于本进程退出，不会被误导向旧实例。
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

// ===================== 绿色版自更新（裸 exe 自替换） =====================
//
// 绿色单文件版不走 tauri-plugin-updater（那是 NSIS 安装包流程：未签名 setup.exe
// 会被 SmartScreen 拦截导致静默安装失败，且即使装成功，装的也是"安装版"，
// 用户运行的绿色 exe 不会变化）。
//
// 流程：green_update_check 拉 green-latest.json（GitHub Release latest 资产）
//   → green_update_download 下载裸 exe 到同目录 FrameLab.exe.new（分块进度经
//   green-dl-progress 事件上报）并用 minisign 验签（复用 tauri.conf.json 公钥）
//   → green_update_apply 写隐藏批处理：等本进程退出后 move 覆盖自身、启动新版、
//   自删；随后本进程直接退出。
// 安全性：API 下载写入的文件无 Mark-of-the-Web 标记，不触发 SmartScreen；
// 签名校验失败一律拒绝替换。

const GREEN_MANIFEST_URL: &str =
    "https://github.com/yuhaowang774/FrameLabdesktop/releases/latest/download/green-latest.json";

/// 清单地址支持环境变量覆盖（仅用于本地联调自更新链路；验签仍然强制，不影响安全性）
fn green_manifest_url() -> String {
    std::env::var("GREEN_MANIFEST_URL").unwrap_or_else(|_| GREEN_MANIFEST_URL.to_string())
}

/// 已检查到的新版本信息（暂存于应用状态，供 download/apply 使用）
#[derive(Clone, serde::Serialize)]
struct GreenPending {
    url: String,
    signature: String,
    version: String,
    notes: String,
    date: String,
}

#[derive(Default)]
struct GreenPendingState(std::sync::Mutex<Option<GreenPending>>);

/// 当前 exe 是否为绿色版。判定（按优先级）：
/// 1. exe 同目录存在 NSIS 卸载程序 uninstall.exe → 安装版
///    （覆盖管理员权限安装到 Program Files / 自定义安装路径等非默认目录的场景）
/// 2. exe 在默认 perUser 安装目录 %LOCALAPPDATA%\FrameLab 内 → 安装版
///    （canonicalize 消除大小写 / 8.3 短路径差异，目录不存在时退回直接比较）
/// 3. 其余 → 绿色版
#[tauri::command]
fn is_portable() -> Result<bool, String> {
    // 审查报告 T13：绿色版自 0.1.25 起已停止发布（green-latest.json 404 + 引导下载安装版）。
    // 原「同目录 uninstall.exe / 位于 %LOCALAPPDATA%\FrameLab」启发式判定容易误判，且已无
    // 绿色版用户——统一按安装版处理（走官方 updater 链路）。
    Ok(false)
}

/// 与前端 compareVersions 一致的分段数值比较
fn cmp_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let pa: Vec<u64> = a.split(['.', '-']).map(|s| s.parse().unwrap_or(0)).collect();
    let pb: Vec<u64> = b.split(['.', '-']).map(|s| s.parse().unwrap_or(0)).collect();
    for i in 0..pa.len().max(pb.len()) {
        let va = pa.get(i).copied().unwrap_or(0);
        let vb = pb.get(i).copied().unwrap_or(0);
        if va != vb {
            return va.cmp(&vb);
        }
    }
    std::cmp::Ordering::Equal
}

/// 共享 HTTP 客户端（审查报告 T10）：显式 30s 超时 + UA——此前 reqwest::get 用默认配置，
/// 网络异常时请求可长时间悬挂；响应也没有大小上限。
fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent(format!("FrameLab/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))
}

async fn http_get_text(url: &str) -> Result<String, String> {
    const MAX_BYTES: u64 = 1024 * 1024;
    let client = http_client()?;
    let mut last_err = String::from("请求失败");
    // 网络抖动立即重试一次；404 等状态错误保持原语义（上层据此识别"停更"）
    for _ in 0..2 {
        match client.get(url).send().await {
            Ok(resp) => match resp.error_for_status() {
                Ok(resp) => {
                    let bytes = resp.bytes().await.map_err(|e| format!("读取响应失败: {e}"))?;
                    if bytes.len() as u64 > MAX_BYTES {
                        return Err("响应内容超过 1MB 上限".into());
                    }
                    return String::from_utf8(bytes.to_vec()).map_err(|e| format!("响应编码异常: {e}"));
                }
                Err(e) => last_err = format!("下载失败: {e}"),
            },
            Err(e) => last_err = format!("网络请求失败: {e}"),
        }
    }
    Err(last_err)
}

/// minisign 验签：公钥取自 tauri.conf.json plugins.updater.pubkey。
/// tauri 的公钥与签名都是「外层 base64(minisign 文件全文)」的双层封装，需先解码一次；
/// minisign-verify 0.2 的 Signature 仅支持从文件构造：解码后的 minisign 全文落临时 .sig 再验。
fn verify_green_signature(
    app: &tauri::AppHandle,
    signature_outer_b64: &str,
    data: &[u8],
) -> Result<(), String> {
    use base64::Engine;
    let updater = app
        .config()
        .plugins
        .0
        .get("updater")
        .ok_or("tauri.conf.json 未配置 updater 插件")?;
    let pubkey_outer = updater
        .get("pubkey")
        .and_then(|v| v.as_str())
        .ok_or("tauri.conf.json 未配置 updater 公钥")?;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(pubkey_outer.trim())
        .map_err(|e| format!("公钥解码失败: {e}"))?;
    let pubkey_text = String::from_utf8(decoded).map_err(|e| format!("公钥编码异常: {e}"))?;
    let key_line = pubkey_text
        .lines()
        .find(|l| !l.starts_with("untrusted") && !l.trim().is_empty())
        .ok_or("公钥格式异常")?;
    let pk = minisign_verify::PublicKey::from_base64(key_line.trim())
        .map_err(|e| format!("公钥解析失败: {e}"))?;
    let decoded_sig = base64::engine::general_purpose::STANDARD
        .decode(signature_outer_b64.trim())
        .map_err(|e| format!("签名解码失败: {e}"))?;
    let sig_text = String::from_utf8(decoded_sig).map_err(|e| format!("签名编码异常: {e}"))?;
    // 审查报告 T8：随机文件名 + create_new——固定文件名（%TEMP%\framelab-green.sig）可被
    // 其它进程抢先创建 / 符号链接覆盖任意用户文件；create_new 保证独占创建
    let sig_tmp = std::env::temp_dir().join(format!(
        "framelab-{}-{}.sig",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() % 1_000_000_000)
            .unwrap_or(0)
    ));
    {
        use std::io::Write as _;
        let mut f = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&sig_tmp)
            .map_err(|e| format!("写入签名临时文件失败: {e}"))?;
        f.write_all(sig_text.as_bytes())
            .map_err(|e| format!("写入签名临时文件失败: {e}"))?;
    }
    let result = minisign_verify::Signature::from_file(&sig_tmp)
        .map_err(|e| format!("签名解析失败: {e}"))
        .and_then(|sig| {
            pk.verify(data, &sig, false)
                .map_err(|e| format!("签名校验失败，更新包可能被篡改: {e}"))
        });
    let _ = std::fs::remove_file(&sig_tmp);
    result
}

/// 检查绿色版更新：拉取 green-latest.json 并与当前版本比较。
/// 有更新返回 Some(info) 并暂存下载参数；无更新 / 同版本 / 降级返回 None。
#[tauri::command]
async fn green_update_check(app: tauri::AppHandle) -> Result<Option<GreenPending>, String> {
    let text = match http_get_text(&green_manifest_url()).await {
        Ok(t) => t,
        // 便携版已停更（green-latest.json 404）：明确引导下载安装版，而不是报晦涩的 404
        Err(e) if e.contains("404") => {
            return Err("便携版不再发布更新：请下载安装版以获得全自动更新（点击「下载安装版」打开 GitHub Releases）".into())
        }
        Err(e) => return Err(e),
    };
    let manifest: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("更新清单解析失败: {e}"))?;
    let get_str = |k: &str| {
        manifest
            .get(k)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| format!("更新清单缺少字段: {k}"))
    };
    let pending = GreenPending {
        version: get_str("version")?,
        notes: get_str("notes").unwrap_or_default(),
        date: get_str("pub_date").unwrap_or_default(),
        url: get_str("url")?,
        signature: get_str("signature")?,
    };
    let current = app
        .config()
        .version
        .clone()
        .unwrap_or_else(|| "0.0.0".to_string());
    if cmp_versions(&pending.version, &current) != std::cmp::Ordering::Greater {
        return Ok(None); // 无更新 / 同版本 / 降级
    }
    app.state::<GreenPendingState>()
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .replace(pending.clone());
    Ok(Some(pending))
}

/// 下载新版裸 exe 到 exe 同目录 FrameLab.exe.new 并验签。
/// 进度经 `green-dl-progress` 事件（0-100）上报前端。
#[tauri::command]
async fn green_update_download(app: tauri::AppHandle) -> Result<(), String> {
    let pending = {
        let state = app.state::<GreenPendingState>();
        let guard = state.0.lock().map_err(|e| e.to_string())?;
        guard.clone().ok_or("请先检查更新")?
    };
    let exe = std::env::current_exe().map_err(|e| format!("获取应用路径失败: {e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "无法定位应用目录".to_string())?
        .to_path_buf();
    let tmp = dir.join("FrameLab.exe.new");

    // 审查报告 T10：共享客户端（超时 + UA）
    let resp = http_client()?
        .get(&pending.url)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {e}"))?
        .error_for_status()
        .map_err(|e| format!("下载失败: {e}"))?;
    // 审查报告 T4：content-length 完全由服务端（或中间人）控制，既不能直接作为
    // 预分配容量，也不能作为唯一的体积约束——超限即刻中止，避免内存失控。
    let total = resp.content_length().unwrap_or(0);
    if total > GREEN_UPDATE_MAX_BYTES {
        return Err("更新包超过 200MB 上限，已中止".into());
    }
    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut buf: Vec<u8> = Vec::with_capacity(total.min(GREEN_UPDATE_MAX_BYTES) as usize);
    let mut received: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载中断: {e}"))?;
        received += chunk.len() as u64;
        if received > GREEN_UPDATE_MAX_BYTES {
            return Err("更新包超过 200MB 上限，已中止下载".into());
        }
        buf.extend_from_slice(&chunk);
        if total > 0 {
            let percent = (received * 100 / total).min(100) as u8;
            let _ = app.emit("green-dl-progress", percent);
        }
    }
    // 验签（先签后写：数据在内存中校验通过才落盘）
    verify_green_signature(&app, &pending.signature, &buf)?;
    std::fs::write(&tmp, &buf).map_err(|e| format!("写入更新文件失败（目录可能只读）: {e}"))?;
    let _ = app.emit("green-dl-progress", 100u8);
    Ok(())
}

/// 应用更新：写隐藏看门狗批处理（等本进程完全退出 → 替换 exe → 启动新版），
/// 启动批处理后立即退出本进程。前端调用后应用会直接关闭。
///
/// 批处理设计要点（0.1.25 重构，修复 0.1.23 在 exe 被占用时替换失败）：
/// 1. **替换推迟到进程退出后**：0.1.23 曾试图 rename 运行中的 exe（step1 把自身改名为
///    .old），但真实环境下 WebView 清理 / Defender 扫描会锁住 exe 超过重试窗口（实测
///    仅 ~4s 即耗尽 5 次重试）→ 替换失败 + FrameLab.exe.new 残留 + 版本不变。
///    本版改为：看门狗先按 PID 轮询等待本进程完全退出（文件锁随之释放），再 move。
/// 2. **纯 ASCII + %~dp0**：批处理不含任何非 ASCII 字符，%~dp0 由 cmd 运行时展开
///    （Unicode 安全），中文路径 / 任意系统代码页下解析一致。
/// 3. **move 重试兜底**：进程退出后仍可能被防病毒瞬间扫描 .new，重试 10 次（约 20s）。
/// 4. 等待超时（60s）taskkill 兜底；bat 残留由新版启动时清理（setup 内）。
#[tauri::command]
fn green_update_apply() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| format!("获取应用路径失败: {e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "无法定位应用目录".to_string())?
        .to_path_buf();
    let tmp = dir.join("FrameLab.exe.new");
    if !tmp.is_file() {
        return Err("未找到已下载的新版本，请重新检查更新".to_string());
    }
    let bat = dir.join("framelab-update.bat");
    let pid = std::process::id();
    let script = format!(
        "@echo off\r\n\
setlocal\r\n\
set \"UPDF=%~dp0FrameLab.exe.new\"\r\n\
set \"EXEF=%~dp0FrameLab.exe\"\r\n\
set \"OLDPID={pid}\"\r\n\
\r\n\
rem step1: wait until this process has fully exited (releases the exe file lock)\r\n\
set /a N=0\r\n\
:WAIT\r\n\
tasklist /fi \"pid eq %OLDPID%\" 2>nul | find /i \"FrameLab\" >nul 2>&1\r\n\
if errorlevel 1 goto REPLACE\r\n\
set /a N+=1\r\n\
if %N% lss 30 (ping 127.0.0.1 -n 2 >nul & goto WAIT)\r\n\
taskkill /f /pid %OLDPID% >nul 2>&1\r\n\
ping 127.0.0.1 -n 2 >nul\r\n\
\r\n\
:REPLACE\r\n\
rem step2: old process gone -> replace exe (retry up to 30x ~28s for antivirus scan window)\r\n\
set /a N=0\r\n\
:TRY\r\n\
move /y \"%UPDF%\" \"%EXEF%\" >nul 2>&1\r\n\
if not errorlevel 1 goto START\r\n\
set /a N+=1\r\n\
if %N% lss 30 (ping 127.0.0.1 -n 2 >nul & goto TRY)\r\n\
goto DONE\r\n\
\r\n\
:START\r\n\
start \"\" \"%EXEF%\"\r\n\
\r\n\
:DONE\r\n\
del \"%~f0\" >nul 2>&1\r\n\
exit /b\r\n",
        pid = pid,
    );
    std::fs::write(&bat, script).map_err(|e| format!("写入更新脚本失败: {e}"))?;
    hidden_command("cmd")
        .current_dir(&dir)
        .args(["/c", "framelab-update.bat"])
        .spawn()
        .map_err(|e| format!("启动更新脚本失败: {e}"))?;
    std::process::exit(0);
}

/// 打开外部 URL（默认浏览器）。便携版停更引导 / 通用外链场景使用。
/// 审查报告 T2：只允许 https 链接——此前任意字符串都会交给 ShellExecute 关联执行
///（`file:///x.exe`、`\\共享\x.bat`、危险协议等），等同于代码执行原语。
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    let u = url.trim();
    if !u.starts_with("https://") {
        return Err("仅允许打开 https 链接".into());
    }
    #[cfg(windows)]
    {
        shell_open(u).map_err(|e| format!("打开链接失败: {e}"))
    }
    #[cfg(not(windows))]
    {
        let _ = u;
        Err("当前平台不支持".into())
    }
}

/// 系统显示适配器信息（独显/核显为名称启发式判定）
#[derive(serde::Serialize)]
struct GpuInfo {
    name: String,
    discrete: bool,
}

/// 查询显示适配器名称列表（list_gpus 与 detect_discrete_gpu 共用；审查报告 T6：
/// 此前两处重复实现且 `.output()` 无超时——企业安全软件 / 系统异常时 PowerShell 卡住
/// 会永久占住运行时工作线程。适配器名输出量小，不触发管道背压）
#[cfg(windows)]
fn query_gpu_names() -> Result<Vec<String>, String> {
    use std::process::Stdio;
    let mut child = hidden_command("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("查询显卡失败: {e}"))?;
    let start = std::time::Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                let out = child.wait_with_output().map_err(|e| format!("查询显卡失败: {e}"))?;
                if !out.status.success() {
                    return Err("查询显卡失败".into());
                }
                return Ok(String::from_utf8_lossy(&out.stdout)
                    .lines()
                    .map(|l| l.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect());
            }
            Ok(None) => {
                if start.elapsed() > std::time::Duration::from_secs(8) {
                    let _ = child.kill();
                    return Err("查询显卡超时（系统响应缓慢）".into());
                }
                std::thread::sleep(std::time::Duration::from_millis(80));
            }
            Err(e) => return Err(format!("查询显卡失败: {e}")),
        }
    }
}

/// 列出系统全部显示适配器（Win32_VideoController，PowerShell CIM），附独显/核显启发式判定。
#[tauri::command]
async fn list_gpus() -> Result<Vec<GpuInfo>, String> {
    // 审查报告 T5/T6：查询移出主线程 + 超时保护
    tauri::async_runtime::spawn_blocking(list_gpus_sync)
        .await
        .map_err(|e| format!("查询任务失败: {e}"))?
}
#[cfg(windows)]
fn list_gpus_sync() -> Result<Vec<GpuInfo>, String> {
    let mut gpus: Vec<GpuInfo> = Vec::new();
    for name in query_gpu_names()? {
        let lower = name.to_lowercase();
        // 虚拟/软件适配器（远程桌面会话、系统基础渲染驱动等）不是真实显卡：直接排除
        let virtual_adapter = lower.contains("basic render")
            || lower.contains("basic display")
            || lower.contains("remote")
            || lower.contains("paravirtual")
            || lower.contains("hyper-v")
            || lower.contains("virtual");
        if virtual_adapter {
            continue;
        }
        // 类型启发式：
        // - Intel（UHD/Iris 等）→ 核显
        // - NVIDIA（GeForce/Quadro）→ 独显
        // - AMD Radeon：RX/Pro/HD 型号 → 独显；无型号的 Radeon(TM) Graphics → APU 核显
        // - 其它未知 → 核显（保守）
        let discrete = lower.contains("nvidia")
            || lower.contains("geforce")
            || lower.contains("quadro")
            || (lower.contains("radeon")
                && (lower.contains("rx") || lower.contains("pro") || lower.contains(" hd ")));
        gpus.push(GpuInfo { name, discrete });
    }
    Ok(gpus)
}
#[cfg(not(windows))]
fn list_gpus_sync() -> Result<Vec<GpuInfo>, String> {
    Err("仅支持 Windows".into())
}

/// 检测是否存在独立显卡（名称启发式）。返回 (是否有独显, 独显名称列表)。
#[tauri::command]
async fn detect_discrete_gpu() -> Result<(bool, Vec<String>), String> {
    // 审查报告 T5/T6：查询移出主线程 + 超时保护（与 list_gpus 共用同一查询实现）
    tauri::async_runtime::spawn_blocking(detect_discrete_gpu_sync)
        .await
        .map_err(|e| format!("查询任务失败: {e}"))?
}
#[cfg(windows)]
fn detect_discrete_gpu_sync() -> Result<(bool, Vec<String>), String> {
    let mut dgpus: Vec<String> = Vec::new();
    for name in query_gpu_names()? {
        let lower = name.to_lowercase();
        // 集显/虚拟显卡特征词；NVIDIA/AMD（含 Radeon 独显）视为独显
        let integrated = lower.contains("intel")
            || lower.contains("uhd")
            || lower.contains("iris")
            || lower.contains("basic display")
            || lower.contains("microsoft")
            || lower.contains("paravirtual")
            || lower.contains("virtual")
            || lower.contains("remote");
        if !integrated
            && (lower.contains("nvidia")
                || lower.contains("geforce")
                || lower.contains("radeon")
                || lower.contains("amd"))
        {
            dgpus.push(name);
        }
    }
    Ok((!dgpus.is_empty(), dgpus))
}
#[cfg(not(windows))]
fn detect_discrete_gpu_sync() -> Result<(bool, Vec<String>), String> {
    Ok((false, Vec::new()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // debug 构建不需要 mut（单实例仅注册于正式版）
    #[cfg_attr(debug_assertions, allow(unused_mut))]
    let mut builder = tauri::Builder::default();
    // 单实例仅限正式版自身：重复启动正式版时聚焦已有窗口。
    // 开发版不注册此插件，开发版与正式版数据目录完全隔离，可并行运行互不干扰。
    #[cfg(not(debug_assertions))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }));
    }
    builder
        .plugin(tauri_plugin_dialog::init())
        // 自动更新：前端经 @tauri-apps/plugin-updater 检查/下载/安装，
        // 签名公钥与更新源见 tauri.conf.json plugins.updater
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_menu_event(|app, event| {
            let id = event.id().as_ref().to_string();
            // 帮助 → GitHub 项目主页：后端直接用 ShellExecuteW 打开（不创建 cmd 子进程，规避 Defender 误报）
            if id == "open_github" {
                #[cfg(windows)]
                {
                    if let Err(e) = shell_open(GITHUB_REPO_URL) {
                        let _ = app.emit("framelab://menu-error", e);
                    }
                }
                return;
            }
            // 帮助 → 意见反馈：打开 GitHub 新建 Issue 页面
            if id == "open_feedback" {
                #[cfg(windows)]
                {
                    if let Err(e) = shell_open(GITHUB_ISSUES_URL) {
                        let _ = app.emit("framelab://menu-error", e);
                    }
                }
                return;
            }
            // 菜单项 → 前端事件分发（前端在 platform/desktop.ts 中消费）
            let _ = app.emit("framelab://menu", id);
        })
        .setup(|app| {
            build_menu(app.handle())?;
            // 绿色版自更新的下载参数暂存
            app.manage(GreenPendingState::default());
            // 启动时清理绿色版更新残留：.new = 下载后未完成应用；.old = 旧版（0.1.23 改名法）
            // 或本次替换前旧 exe 的改名残留；framelab-update.bat = 看门狗脚本残留。
            if let Ok(exe) = std::env::current_exe() {
                let _ = std::fs::remove_file(exe.with_file_name("FrameLab.exe.new"));
                let _ = std::fs::remove_file(exe.with_file_name("FrameLab.exe.old"));
                let _ = std::fs::remove_file(exe.with_file_name("framelab-update.bat"));
            }
            // ===== 启动自愈：处理前端看门狗排队的修复标记（须在 WebView2 初始化前）=====
            let local_dir = app
                .path()
                .app_local_data_dir()
                .map_err(|e| format!("无法定位数据目录: {e}"))?;
            let mut disable_gpu = false;
            let gpu_flag = local_dir.join("disable-gpu.flag");
            if gpu_flag.exists() {
                // 一次性消费：本次以 --disable-gpu 启动（用户进系统后可在首选项调显卡）
                disable_gpu = true;
                let _ = fs::remove_file(&gpu_flag);
            }
            let cache_flag = local_dir.join("clean-webview-cache.flag");
            if cache_flag.exists() {
                // 旧进程已退出、缓存文件未被锁定，此刻清理必然成功
                clean_webview_caches(&local_dir);
                let _ = fs::remove_file(&cache_flag);
            }

            // 窗口改为 Rust 侧创建：开发版需要指定独立 WebView2 数据目录
            // （此前开发/正式版共用 EBWebView 目录，并行启动会因目录被占用而白屏）。
            let mut browser_args = String::from(if disable_gpu {
                // 安全模式：完全禁用 GPU 合成（白屏自救，进系统后可在首选项调显卡）
                "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-gpu"
            } else {
                "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --ignore-gpu-blocklist --enable-gpu-rasterization"
            });
            // 开发构建：显式附加参数会覆盖 WebView2 的 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
            // 环境变量（API 优先），此处合并回来，保证 scripts/cdp-shot.mjs 文档中的调试流程
            // （环境变量指定 --remote-debugging-port）可用；正式构建（release）不生效。
            if cfg!(debug_assertions) {
                if let Ok(extra) = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") {
                    let extra = extra.trim();
                    if !extra.is_empty() {
                        browser_args.push(' ');
                        browser_args.push_str(extra);
                    }
                }
            }
            let mut win = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                // 窗口标题：名字后跟当前版本号（随发版自动更新）
                .title(format!("FrameLab v{}", app.package_info().version))
                .inner_size(1360.0, 860.0)
                .min_inner_size(1024.0, 660.0)
                .additional_browser_args(&browser_args)
                // 拖放保持 Tauri 原生处理：前端经 onDragDropEvent 拿到拖入文件的真实磁盘路径，
                // 走 addLocalEntries 导入（进 catalog 持久化，重启可还原）；网页端 HTML5 拖放不受影响。
                .drag_and_drop(true);
            if cfg!(debug_assertions) {
                let dir = app
                    .path()
                    .app_local_data_dir()
                    .map_err(|e| format!("无法定位数据目录: {e}"))?
                    .join("webview-data-dev");
                win = win.data_directory(dir);
            }
            win.build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_dir_images,
            read_file_base64,
            read_file_bytes,
            read_image_meta,
            read_file_head,
            thumb_get,
            thumb_put,
            read_preview_bytes,
            write_file_base64,
            path_exists,
            read_app_json,
            write_app_json,
            pick_folder,
            pick_image_files,
            save_file_dialog,
            set_gpu_preference_mode,
            open_graphics_settings,
            detect_discrete_gpu,
            list_gpus,
            reveal_path,
            restart_app,
            open_external,
            write_boot_log,
            queue_webview_cache_clean,
            queue_disable_gpu,
            is_portable,
            green_update_check,
            green_update_download,
            green_update_apply
        ])
        .run(tauri::generate_context!())
        .expect("error while running FrameLab");
}
