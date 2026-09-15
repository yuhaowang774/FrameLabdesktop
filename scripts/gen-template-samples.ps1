# 模板库样张照片生成工具（一次性资产的再生成入口）
# 用途：把「桌面\模版照片」中的原始照片按「模板 ↔ 照片」匹配表压缩为
#       src/assets/template-samples/<模板id>.jpg（模板库卡片在「无用户照片」时展示的样张）。
# 说明：匹配原则 = 版式气质贴合（高调白框配浅调照片 / 暗调款配夜景 / 胶片款配胶片感人像 /
#       旅行刊头配旅途照片 / 胶片票根配车站 …），并兼顾画幅方向（9:16、1:1、竖排等）。
# 序号 = 源目录按文件名排序后的下标（与联络表 / 匹配评审一致，换照片只需改 $MAP 序号）。
param(
  [string]$SrcDir = 'C:\Users\Administrator\Desktop\模版照片',
  [string]$OutDir = 'd:\A\FrameLab\src\assets\template-samples',
  [int]$MaxEdge = 1000,
  [int]$Quality = 80
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$MAP = [ordered]@{
  'm_duo_card'          = 38  # 米白几何建筑立面（极简白框）
  'm_float_round'       = 16  # 日落湖面小船（暖调悬浮）
  'm_matte_serif'       = 2   # 白底花枝（高调衬线字标）
  'm_center_params'     = 35  # 雪松林（干净居中）
  'm_strip_plate'       = 49  # 伦敦泰晤士河（旅行白条铭牌）
  'm_tech_silver'       = 24  # 桥梁金属结构（工程测绘感）
  'm_film_noir'         = 60  # 电影感人物（暗调胶片）
  'm_float_badge'       = 10  # 湖边人物（轻量悬浮）
  'm_ccd_stamp'         = 37  # 街边店铺（复古 CCD 日期戳）
  'm_magazine_edit'     = 28  # 旧金山天际线（杂志编辑）
  'm_card_white'        = 33  # 城市建筑行人（白卡联名）
  'm_card_black'        = 6   # 夜晚街景（黑卡夜色）
  'm_black_duo'         = 12  # 月亮（纯黑参数卡）
  'm_black_strip'       = 11  # 东京塔夜景（黑幅铭牌）
  'm_obsidian_matte'    = 59  # 戏剧化人物（曜石装裱）
  'm_graphite_frame'    = 13  # 城市街道（石墨灰）
  'm_cinema_wide'       = 62  # 胶片条中建筑（1:1 电影黑场）
  'm_kodak_years'       = 42  # 咖啡馆内景（柯达暖调）
  'm_polaroid'          = 57  # 手拿拍立得（宝丽来）
  'm_darkroom_contact'  = 7   # 人物剪影（暗房印相）
  'm_square_white'      = 29  # 金色夕阳云（1:1 方幅）
  'm_story_portrait'    = 18  # 冰面人物（9:16 竖版）
  'm_card_round'        = 30  # 室内沙发（圆角卡片）
  'm_pure_white'        = 53  # 雪地近白（纯白装裱）
  'm_pure_black'        = 39  # 日环食（纯黑装裱）
  'm_cream_round'       = 58  # 水边芦苇（奶白圆角）
  'm_poster_big'        = 51  # 金色麦浪（大字海报）
  'm_watermark_tile'    = 5   # 玫瑰特写（平铺水印）
  'm_watermark_corner'  = 34  # 荒野山脚（角标署名）
  'm_zh_elegant'        = 20  # 金色岩纹（中文雅集）
  'm_masthead_dark'     = 23  # 暖光街道夜景（暗调刊头）
  'm_cover_masthead'    = 14  # 森林日出（杂志封面刊头）
  'm_cover_exhibit'     = 45  # 城市高楼（杂志封面上白底）
  'm_gps_coord'         = 40  # 公路与孤树（GPS 旅行）
  'm_edge_vertical'     = 19  # 山峰蓝调（边缘竖排参数）
  'm_finder_cross'      = 63  # 上海天际线（取景器十字）
  'm_credit_block'      = 31  # 热气球日出（海报字幕）
  'm_vertical_leica'    = 36  # 木质结构窄竖（竖排装裱）
  'm_masthead_top'      = 8   # 山湖雪顶（顶部题注）
  'm_colorwalk_yellow'  = 1   # 沙漠红岩（明黄色卡）
  'm_colorwalk_sage'    = 4   # 森林（抹茶色卡）
  'm_morandi_blue'      = 43  # 山雾（雾霾蓝）
  'm_morandi_pink'      = 25  # 粉色建筑与月亮（豆沙粉）
  'm_magazine_sunset'   = 15  # 沙丘暖橙（SUNSET 刊头）
  'm_magazine_field'    = 41  # 田野纹理（原野刊头）
  'm_album_caption_l'   = 48  # 城市俯瞰人物背影（画册署名）
  'm_poster_master'     = 17  # 浅色山景（大师水印海报）
  'm_ticket_horizontal' = 50  # 火车车厢（旅行票根横版）
  'm_ticket_vertical'   = 26  # 湖边城市（旅行票根竖版）
  'm_cal_paper'         = 21  # 白色现代建筑（白纸手账月历）
  'm_cal_dark'          = 32  # 剪影与紫粉天空（暗夜桌历）
  'm_sport_dark'        = 44  # 森林公路（运动暗调遥测）
  'm_sport_paper'       = 52  # 黄墙行人（白底数据表）
  'm_device_dark'       = 3   # 舷窗云海（深空灰样机）
  'm_device_light'      = 46  # 室内彩色光影（银色样机）
}

$files = @(Get-ChildItem -LiteralPath $SrcDir -File | Where-Object { $_.Extension -match '\.(jpe?g|png)$' } | Sort-Object Name)
Write-Output ("源照片目录: {0}（{1} 张）" -f $SrcDir, $files.Count)
if ($files.Count -lt 64) { Write-Output ("警告：源照片数不足 64，序号映射可能错位") }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int]$Quality)

$totalKB = 0
$missing = 0
foreach ($k in $MAP.Keys) {
  $idx = [int]$MAP[$k]
  if ($idx -ge $files.Count) { Write-Output ("跳过（序号越界）: {0} ← #{1}" -f $k, $idx); $missing++; continue }
  $srcPath = $files[$idx].FullName
  $img = [System.Drawing.Image]::FromFile($srcPath)
  $scale = [math]::Min(1.0, ($MaxEdge / [math]::Max($img.Width, $img.Height)))
  $w = [int][math]::Round($img.Width * $scale)
  $h = [int][math]::Round($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $dst = Join-Path $OutDir ($k + '.jpg')
  $bmp.Save($dst, $enc, $ep)
  $g.Dispose()
  $bmp.Dispose()
  $img.Dispose()
  $kb = [int]((Get-Item -LiteralPath $dst).Length / 1KB)
  $totalKB += $kb
  Write-Output ("{0,-22} <- #{1,2} {2,-30} {3}x{4} {5}KB" -f $k, $idx, $files[$idx].BaseName, $w, $h, $kb)
}
Write-Output ("完成：{0} 张（跳过 {1}）/ 共 {2} KB" -f $MAP.Count, $missing, $totalKB)
