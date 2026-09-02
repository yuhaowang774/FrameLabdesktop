// FrameLab Rust 后端（仅桌面端）：
// - 本地图片目录扫描（图库浏览磁盘文件夹）
// - 原生对话框：选图/选目录/另存/打开 JSON 模板
// - AppData JSON 读写（布局、模板、快照、导出偏好）
// - 导出图片字节落盘
// - 原生菜单栏与应用快捷键（事件 framelab://menu 分发给前端）
// 安全模型：WebView 禁止直接 fs，全部经下列 Command IPC 完成。
use base64::Engine as _;
use std::fs;
use std::io::Read;
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

#[derive(Serialize, Clone)]
pub struct ImageEntry {
    pub path: String,
    pub name: String,
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
            out.push(ImageEntry {
                path: p.to_string_lossy().to_string(),
                name,
            });
        }
    }
    for d in subdirs {
        scan_dir(&d, depth - 1, out);
    }
}

/// 扫描目录内图片；recursive=true 时递归子目录（深度受限）
#[tauri::command]
fn list_dir_images(dir: String, recursive: Option<bool>) -> Result<Vec<ImageEntry>, String> {
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
fn read_file_base64(path: String) -> Result<String, String> {
    let meta = fs::metadata(&path).map_err(|e| format!("读取文件信息失败: {e}"))?;
    if meta.len() > READ_MAX_BYTES {
        return Err("文件过大（超过 256MB）".into());
    }
    let mut file = fs::File::open(&path).map_err(|e| format!("打开文件失败: {e}"))?;
    let mut buf = Vec::with_capacity(meta.len() as usize);
    file.read_to_end(&mut buf).map_err(|e| format!("读取文件失败: {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(buf))
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

/// 写入纯文本文件（模板另存等）
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    fs::write(&path, content).map_err(|e| format!("写入文件失败: {e}"))
}

// ===== AppData JSON 存储（布局/模板/快照/导出偏好） =====

fn data_file(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位 AppData 目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建 AppData 目录失败: {e}"))?;
    // 文件名白名单化，避免路径穿越
    let safe: String = filename
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    Ok(dir.join(format!("{safe}.json")))
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
    fs::write(p, content).map_err(|e| format!("写入失败: {e}"))
}

#[tauri::command]
fn clear_app_json(app: AppHandle, filename: String) -> Result<(), String> {
    let p = data_file(&app, &filename)?;
    if p.exists() {
        fs::remove_file(p).map_err(|e| format!("删除失败: {e}"))?;
    }
    Ok(())
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

/// 打开本地 JSON 模板文件并读取文本内容
#[tauri::command]
async fn open_text_file(app: AppHandle) -> Result<Option<String>, String> {
    match app
        .dialog()
        .file()
        .add_filter("JSON 模板", &["json"])
        .blocking_pick_file()
    {
        Some(fp) => {
            let p = fp.into_path().map_err(|e| format!("路径解析失败: {e}"))?;
            fs::read_to_string(p).map(Some).map_err(|e| format!("读取失败: {e}"))
        }
        None => Ok(None),
    }
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
    let help_menu = SubmenuBuilder::new(app, "帮助").item(&show_help).build()?;

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

/// 打开 Windows「图形设置」页（用户可为应用手动指定高性能 GPU）
#[tauri::command]
fn open_graphics_settings() -> Result<(), String> {
    #[cfg(windows)]
    {
        hidden_command("cmd")
            .args(["/C", "start", "", "ms-settings:graphics"])
            .spawn()
            .map_err(|e| format!("打开系统设置失败: {e}"))?;
        Ok(())
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
        hidden_command("explorer")
            .raw_arg(format!("\"/select,{}\"", full))
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

/// 系统显示适配器信息（独显/核显为名称启发式判定）
#[derive(serde::Serialize)]
struct GpuInfo {
    name: String,
    discrete: bool,
}

/// 列出系统全部显示适配器（Win32_VideoController，PowerShell CIM），附独显/核显启发式判定。
#[tauri::command]
async fn list_gpus() -> Result<Vec<GpuInfo>, String> {
    #[cfg(windows)]
    {
        let out = hidden_command("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }",
            ])
            .output()
            .map_err(|e| format!("查询显卡失败: {e}"))?;
        if !out.status.success() {
            return Err("查询显卡失败".into());
        }
        let text = String::from_utf8_lossy(&out.stdout);
        let mut gpus: Vec<GpuInfo> = Vec::new();
        for line in text.lines() {
            let name = line.trim();
            if name.is_empty() {
                continue;
            }
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
            gpus.push(GpuInfo {
                name: name.to_string(),
                discrete,
            });
        }
        Ok(gpus)
    }
    #[cfg(not(windows))]
    {
        Err("仅支持 Windows".into())
    }
}

/// 检测是否存在独立显卡（dxdiag 输出解析 Card name 行，出现第二块非 Intel 虚拟显卡即视为有独显）。
/// 返回 (是否有独显, 独显名称列表)。
#[tauri::command]
async fn detect_discrete_gpu() -> Result<(bool, Vec<String>), String> {
    #[cfg(windows)]
    {
        // dxdiag 输出 UTF-16；WMI 查询更稳，但需引依赖；此处用 PowerShell CIM（系统自带）
        let out = hidden_command("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }",
            ])
            .output()
            .map_err(|e| format!("查询显卡失败: {e}"))?;
        if !out.status.success() {
            return Err("查询显卡失败".into());
        }
        let text = String::from_utf8_lossy(&out.stdout);
        let mut dgpus: Vec<String> = Vec::new();
        for line in text.lines() {
            let name = line.trim();
            if name.is_empty() {
                continue;
            }
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
            if !integrated && (lower.contains("nvidia") || lower.contains("geforce") || lower.contains("radeon") || lower.contains("amd")) {
                dgpus.push(name.to_string());
            }
        }
        Ok((!dgpus.is_empty(), dgpus))
    }
    #[cfg(not(windows))]
    {
        Ok((false, Vec::new()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .on_menu_event(|app, event| {
            // 菜单项 → 前端事件分发（前端在 platform/desktop.ts 中消费）
            let id = event.id().as_ref().to_string();
            let _ = app.emit("framelab://menu", id);
        })
        .setup(|app| {
            build_menu(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_dir_images,
            read_file_base64,
            write_file_base64,
            path_exists,
            write_text_file,
            read_app_json,
            write_app_json,
            clear_app_json,
            pick_folder,
            pick_image_files,
            open_text_file,
            save_file_dialog,
            set_gpu_preference_mode,
            open_graphics_settings,
            detect_discrete_gpu,
            list_gpus,
            reveal_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running FrameLab");
}
