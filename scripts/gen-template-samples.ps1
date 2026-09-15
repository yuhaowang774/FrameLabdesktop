# 模板库样张照片生成工具（一次性资产的再生成入口）
# 用途：把「模版照片」目录中的原始照片按「模板 ↔ 照片」匹配表压缩为
#       src/assets/template-samples/<模板id>.jpg（模板库卡片展示的样张）。
# 匹配方式（2026-09-15 改）：按**文件名特征串**匹配，不再依赖「按文件名排序的下标」——
#       相册后续新增照片不会打乱既有映射（当天新增 15 张时下标整体位移的教训）。
# 匹配原则 = 版式气质贴合（高调白框配浅调 / 暗调款配夜景 / 胶片款配胶片感人像 /
#       旅行刊头配旅途照片 / 纸质模板配静物特写 …），并兼顾画幅方向（9:16、1:1、竖排等）。
# 换照片：把 $MAP 里对应模板的特征串改成新文件名片段，再跑一次本脚本即可。
param(
  [string]$SrcDir = 'C:\Users\Administrator\Desktop\模版照片',
  [string]$OutDir = 'd:\A\FrameLab\src\assets\template-samples',
  [int]$MaxEdge = 1000,
  [int]$Quality = 80
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$MAP = [ordered]@{
  # ===== 第一批：55 套（2026-09-15 白天）=====
  'm_duo_card'          = 'pawel-czerwinski-95zwYctGEaA'   # 米白几何建筑立面
  'm_float_round'       = 'ft-shafi-5dM711y9UDA'           # 日落湖面小船
  'm_matte_serif'       = 'andrey-k-BOe54W1l_uk'           # 白底花枝
  'm_center_params'     = 'nicolas-hans-bggoZNpXK28'       # 雪松林
  'm_strip_plate'       = 'shane-rounce-YTDATZz_q1M'       # 伦敦泰晤士河
  'm_tech_silver'       = 'jonas-degener-9Rmcr2oTdDE'      # 桥梁金属结构
  'm_film_noir'         = 'valentin-lacoste-ppGD0Yb-lDg'   # 电影感人物
  'm_float_badge'       = 'dawid-tkocz-ttMdFEwlayw'        # 湖边人物
  'm_ccd_stamp'         = 'nikita-pishchugin-ZFmPjN4i6rk'  # 街边店铺
  'm_magazine_edit'     = 'kellen-riggin-xvHbjk-IaVc'      # 旧金山天际线
  'm_card_white'        = 'matthew-jackson-vOsuKgGWhAU'    # 城市建筑行人
  'm_card_black'        = 'brayden-law-tivSfDwDoq4'        # 夜晚街景
  'm_black_duo'         = 'dmytro-koplyk-gl74MOGTC3I'      # 月亮
  'm_black_strip'       = 'diego-padilla-ExuxwWB6hfY'      # 东京塔夜景
  'm_obsidian_matte'    = 'valentin-lacoste-BYxJ8C4WIT0'   # 戏剧化人物
  'm_graphite_frame'    = 'douglas-schneiders-iO9uHKMFiVU' # 城市街道
  'm_cinema_wide'       = 'zhen-yao-gxVQDthMksc'           # 胶片条中建筑
  'm_kodak_years'       = 'richard-stachmann-IDi7dRG18TU'  # 咖啡馆内景
  'm_polaroid'          = 'vadim-sadovski-OxHm0L9_6ng'     # 手拿拍立得
  'm_darkroom_contact'  = 'brooke-balentine-bmSpNZIjmHs'   # 人物剪影
  'm_square_white'      = 'kristians-greckis-zqVOhpb6yK4'  # 金色夕阳云（方形）
  'm_story_portrait'    = 'gabriela-PtCILZw-e4Y'           # 冰面人物
  'm_card_round'        = 'lea-gindorf--r-zMd1UNHo'        # 室内沙发
  'm_pure_white'        = 'tanya-prodaan-qB1dSYDISeA'      # 雪地近白
  'm_pure_black'        = 'rafael-garcin-RVc7KCmFRdc'      # 日环食
  'm_cream_round'       = 'valentin-kiselev-P_rLRx-yoE8'   # 水边芦苇
  'm_poster_big'        = 'steve-gribble-X57NtYldau8'      # 金色麦浪
  'm_watermark_tile'    = 'bradley-andrews-ndQW-y6Rtbs'    # 玫瑰特写
  'm_watermark_corner'  = 'mattia-revelant-Yh3alvVRvRA'    # 荒野山脚
  'm_zh_elegant'        = 'greg-rosenke-uWGfchsnYD4'       # 金色岩纹
  'm_masthead_dark'     = 'jonas-degener-72CrKMqbwkM'      # 暖光街道夜景
  'm_cover_masthead'    = 'emanuel-haas-bnvoLo9MIr8'       # 森林日出
  'm_cover_exhibit'     = 'ruben-mavarez-R6so8oYtj_8'      # 城市高楼
  'm_gps_coord'         = 'rafael-peier-8yfCTr6ia18'       # 公路与孤树
  'm_edge_vertical'     = 'garvit-nama-_GXbkkSFcnE'        # 山峰蓝调
  'm_finder_cross'      = 'zixi-lu-28_vmGQw36A'            # 上海天际线
  'm_credit_block'      = 'magdalena-kula-manchee-qGoGz1ui56Y' # 热气球日出
  'm_vertical_leica'    = 'nikhil-thomas-H94bwLm2JOI'      # 木质结构窄竖
  'm_masthead_top'      = 'clement-proust-XxK9RR09DIU'     # 山湖雪顶
  'm_colorwalk_yellow'  = 'alissa-schilling-_tDqbE5U7nw'   # 沙漠红岩
  'm_colorwalk_sage'    = 'anton-sobotyak-2haxO2De5Ps'     # 森林
  'm_morandi_blue'      = 'rosalie-gdy-MAm8CTlyeI8'        # 山雾
  'm_morandi_pink'      = 'jones-lee-f8FgfDNLg2A'          # 粉色建筑与月亮
  'm_magazine_sunset'   = 'francesco-ungaro-EKakGSDJGCs'   # 沙丘暖橙
  'm_magazine_field'    = 'rafael-peier-SRxADzg9EWg'       # 田野纹理
  'm_album_caption_l'   = 'semina-psichogiopoulou-hl0iLy1hFo0' # 城市俯瞰人物背影
  'm_poster_master'     = 'fynn-zentner-ZWwoQRR-zWQ'       # 浅色山景
  'm_ticket_horizontal' = 'spenser-sembrat-9H6ZPRr7j6Q'    # 火车车厢
  'm_ticket_vertical'   = 'julie-gaia-guzal-0IT4vwi1hZo'   # 湖边城市
  'm_cal_paper'         = 'hao-wu-22cr2PAg74Q'             # 白色现代建筑
  'm_cal_dark'          = 'marsumilae-Q6TS7tRFsvY'         # 剪影与紫粉天空
  'm_sport_dark'        = 'royce-fonseca-JrY8Xq-PgzA'      # 森林公路
  'm_sport_paper'       = 'takashi-sakamoto-hXfCmfmUPt0'   # 黄墙行人
  'm_device_dark'       = 'anton-shakirov-K1RmYc5pRks'     # 舷窗云海
  'm_device_light'      = 'safiullah-oba-wzhqy-B1zxM'      # 室内彩色光影
  # ===== 第二批：特殊印刷范式 9 套 =====
  'm_film_edge'         = 'alin-gavriliuc-PZ5HifLJcjo'     # 暗调铁路山谷
  'm_slide_mount'       = 'sander-traa-9fVWHoCV3YM'        # 机舱与机翼
  'm_museum_label'      = 'jadon-johnson-F2NWhZJ5nww'      # 天空云
  'm_archive_card'      = 'karel-mistrik-KWMv9IMX6XQ'      # 起重机工业
  'm_postcard_back'     = 'dawid-tkocz-Rba26h4iAYA'        # 暖色建筑与行人
  'm_journal_page'      = 'tobias-reich-jMryPcxZOGc'       # 红砖拱门
  'm_album_sleeve'      = 'tolga-ahmetler-z7hQa7Xea1s'     # 暗调金属建筑
  'm_contents_page'     = 'tsuyoshi-kozu-ukSDSF2oRA8'      # 城市高楼
  'm_gallery_bar'       = 'willian-justen-de-vasconcellos-poZaPb6Q_XA' # 米色砖立面
  # ===== 第三批：新增 15 张照片对应 15 套（2026-09-15 晚）=====
  'm_widescreen_sub'    = 'artur-adilkhanian-w4NNeG6ZoqQ'  # 日落海面与剪影（宽幅）
  'm_ink_inscription'   = 'b-s-Q2Z6BnGn0ys'                # 白墙粉玫瑰
  'm_herbarium_label'   = 'daniella-pienaar-ZXanOy4GLjA'   # 金色麦穗特写
  'm_print_certificate' = 'dawid-tkocz-CaYZFIHZR_E'        # 欧洲宫殿圆顶
  'm_gilt_frame'        = 'fang-guo-44M-NUfg8ho'           # 美术馆内看画的剪影
  'm_concrete_plaque'   = 'filippo-molinari-A0Mo8OsmZYQ'   # 采石场岩壁
  'm_press_caption'     = 'hameen-reynolds-VkXQOdEWZcI'    # 欧洲街景与骑行者
  'm_park_sign'         = 'hanna-lazar-PXtVtC4LK68'        # 山坡独行与雪山
  'm_film_still'        = 'jahanzeb-ahsan-WDzLTe6ON2k'     # 夜晚街头
  'm_long_exposure'     = 'kellen-riggin-hmW3e2hLGP0'      # 金门大桥晨雾
  'm_city_postcard'     = 'kellen-riggin-w8FzMDJggt0'      # 金门大桥日落
  'm_poem_card'         = 'luise-and-nic-cwmYAVM4mHY'      # 湖畔黄昏人像
  'm_paper_label'       = 'marcus-ganahl-Z2-lnDiixBM'      # 蛛网与树枝
  'm_autumn_bookmark'   = 'noppadon-manadee-4CFbtKdHch8'   # 金色草穗
  'm_exhibit_guide'     = 'roman-akash-W6eYAf2eoJ8'        # 看展人群与名画
}

$files = @(Get-ChildItem -LiteralPath $SrcDir -File | Where-Object { $_.Extension -match '\.(jpe?g|png|webp)$' } | Sort-Object Name)
Write-Output ("源照片目录: {0}（{1} 张）" -f $SrcDir, $files.Count)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int]$Quality)

$totalKB = 0
$missing = 0
foreach ($k in $MAP.Keys) {
  $needle = $MAP[$k]
  $hit = @($files | Where-Object { $_.BaseName -like "*$needle*" })
  if ($hit.Count -eq 0) { Write-Output ("MISS: {0} <- {1}" -f $k, $needle); $missing++; continue }
  if ($hit.Count -gt 1) { Write-Output ("WARN 多命中，取第一个: {0} <- {1} ({2} 个)" -f $k, $needle, $hit.Count) }
  $srcPath = $hit[0].FullName
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
  Write-Output ("{0,-22} <- {1,-34} {2}x{3} {4}KB" -f $k, $hit[0].BaseName, $w, $h, $kb)
}
Write-Output ("完成：{0} 张（缺失 {1}）/ 共 {2} KB" -f $MAP.Count, $missing, $totalKB)
