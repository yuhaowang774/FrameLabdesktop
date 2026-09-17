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
  [int]$Quality = 80,
  # 只生成指定模板 id 的样张（新增模板时用，避免把历史映射全部重刷一遍）
  [string[]]$Only = @()
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
  # ===== 第四批：FrameElf 范式重写 第 1 批 6 套（2026-09-16）=====
  # 优先选「尚未被现有模板占用」的照片，按画幅方向匹配（铺满款配深一点的照片便于压白字）
  'm_wm_signature_edge' = 'francesco-ungaro-EKakGSDJGCs'   # 沙丘暖橙（横幅，铺满压白字）
  'm_wm_date_corner'    = 'kristians-greckis-zqVOhpb6yK4'  # 金色夕阳云（方形，配方形画幅）
  'm_border_left_two'   = 'magdalena-kula-manchee-qGoGz1ui56Y' # 热气球日出（横幅，白框展陈）
  'm_border_params_four' = 'greg-rosenke-uWGfchsnYD4'      # 金色岩纹（竖幅，四行参数）
  'm_palette_note_band' = 'alissa-schilling-_tDqbE5U7nw'   # 沙漠红岩（竖幅，色彩浓烈出色卡）
  'm_ticket_city_strip' = 'semina-psichogiopoulou-hl0iLy1hFo0' # 城市俯瞰人物背影（横幅票根）
  # ===== 第五批：色卡范式族 5 套（2026-09-16）=====
  'm_palette_min_edge'  = 'mattia-revelant-Yh3alvVRvRA'    # 荒野山脚（干净自然，窄白边极简）
  'm_palette_ink_band'  = 'royce-fonseca-JrY8Xq-PgzA'      # 森林公路（暗调，配墨底）
  'm_palette_square_card' = 'jones-lee-f8FgfDNLg2A'        # 粉色建筑与月亮（色彩有趣，方卡）
  'm_palette_blur_band' = 'zhen-yao-gxVQDthMksc'           # 胶片条中建筑（配模糊延展带）
  'm_palette_wide_date' = 'kellen-riggin-hmW3e2hLGP0'      # 金门大桥晨雾（宽幅 3:2）
  # ===== 第六批：多行文字块范式族 5 套（2026-09-16）=====
  'm_spec_five_lines'   = 'zixi-lu-28_vmGQw36A'            # 上海天际线（横，规格卡）
  'm_plate_pairs_five'  = 'bradley-andrews-ndQW-y6Rtbs'    # 玫瑰特写（横，铭牌对照）
  'm_datacard_four_pairs' = 'steve-gribble-X57NtYldau8'    # 金色麦浪（宽幅，大数值卡）
  'm_panorama_seven_lines' = 'roman-akash-W6eYAf2eoJ8'     # 看展人群与名画（横，全幅参数条）
  'm_float_params_right' = 'rafael-garcin-RVc7KCmFRdc'     # 日环食（竖幅暗调，白字浮层）
  # ===== 第七批：多行文字块族 20 套（2026-09-16）=====
  # 前 16 张为尚未被占用的照片；后 4 张与既有模板共用（同片不同版式，便于对比构图差异）
  'm_wb_float_five_left'    = 'clement-proust-XxK9RR09DIU'  # 山湖雪顶（浮层左缘五行）
  'm_wb_float_top_eight'    = 'gabriela-PtCILZw-e4Y'        # 冰面人物（左上八行）
  'm_wb_float_six_center'   = 'rafael-peier-8yfCTr6ia18'    # 公路与孤树（居中六行）
  'm_wb_float_ten_pairs'    = 'garvit-nama-_GXbkkSFcnE'     # 山峰蓝调（五行标签对照）
  'm_wb_float_top_six'      = 'douglas-schneiders-iO9uHKMFiVU' # 城市街道（顶部刊头六行）
  'm_wb_float_big_four'     = 'rosalie-gdy-MAm8CTlyeI8'     # 山雾（大字四行）
  'm_wb_float_right_five'   = 'julie-gaia-guzal-0IT4vwi1hZo' # 湖边城市（右缘五行）
  'm_wb_band_six_left'      = 'takashi-sakamoto-hXfCmfmUPt0' # 黄墙行人（白边六行）
  'm_wb_band_numeric_eight' = 'anton-shakirov-K1RmYc5pRks'  # 舷窗云海（居中八行数值）
  'm_wb_band_date_three'    = 'safiullah-oba-wzhqy-B1zxM'   # 室内彩色光影（日期三行）
  'm_wb_band_seven_left'    = 'alin-gavriliuc-PZ5HifLJcjo'  # 暗调铁路山谷（七行记录）
  'm_wb_band_pairs_six'     = 'tsuyoshi-kozu-ukSDSF2oRA8'   # 城市高楼（六组字段）
  'm_wb_credit_logo_five'   = 'b-s-Q2Z6BnGn0ys'             # 白墙粉玫瑰（品牌行五行）
  'm_wb_credit_logo_six'    = 'marcus-ganahl-Z2-lnDiixBM'   # 蛛网与树枝（品牌行六行）
  'm_wb_credit_logo_right'  = 'noppadon-manadee-4CFbtKdHch8' # 金色草穗（右对齐品牌行）
  'm_wb_master_seven_center' = 'tanya-prodaan-qB1dSYDISeA'  # 雪地近白（居中七行）
  'm_wb_master_five_serif'  = 'mattia-revelant-Yh3alvVRvRA' # 荒野山脚（衬线五行，与窄白边款同片）
  'm_wb_top_five_center'    = 'francesco-ungaro-EKakGSDJGCs' # 沙丘暖橙（顶部五行，与署名款同片）
  'm_wb_top_big_two'        = 'zixi-lu-28_vmGQw36A'         # 上海天际线（顶部大字，与规格卡同片）
  'm_wb_blur_five_left'     = 'greg-rosenke-uWGfchsnYD4'    # 金色岩纹（模糊底五行，与参数四行同片）
  # ===== 第八批：相机机身壳 8 套（2026-09-17，照片均为复用——图库照片已全部被占用，同片看版式差异）
  'm_cam_shell_dark'        = 'douglas-schneiders-iO9uHKMFiVU' # 城市街道（黑银机身壳全幅）
  'm_cam_shell_silver'      = 'gabriela-PtCILZw-e4Y'         # 冰面人物（银黑机身壳全幅）
  'm_cam_shell_square'      = 'anton-shakirov-K1RmYc5pRks'   # 舷窗云海（方画幅机身壳）
  'm_cam_shell_brand3'      = 'b-s-Q2Z6BnGn0ys'              # 白墙粉玫瑰（机身壳 + 品牌三行）
  'm_cam_shell_param8'      = 'tsuyoshi-kozu-ukSDSF2oRA8'    # 城市高楼（机身壳 + 参数八行）
  'm_cam_shell_mark4'       = 'julie-gaia-guzal-0IT4vwi1hZo' # 湖边城市（机身壳 + 左上四行）
  'm_cam_shell_sign6'       = 'clement-proust-XxK9RR09DIU'   # 山湖雪顶（机身壳 + 左缘六行）
  'm_cam_shell_port8'       = 'rosalie-gdy-MAm8CTlyeI8'      # 山雾（机身壳 + 带下八行）
  # ===== 第九批：胶片壳 / 拍立得 / 特效 / 票根 7 套（2026-09-17，照片同样复用）
  'm_film_dark_caps'        = 'rosalie-gdy-MAm8CTlyeI8'      # 山雾（黑片基胶片壳）
  'm_film_warm_three'       = 'clement-proust-XxK9RR09DIU'   # 山湖雪顶（暖褐片基）
  'm_pola_sign_one'         = 'julie-gaia-guzal-0IT4vwi1hZo' # 湖边城市（拍立得署名一行）
  'm_pola_four_lines'       = 'mattia-revelant-Yh3alvVRvRA'  # 荒野山脚（拍立得带下四行）
  'm_effect_strip_logo'     = 'douglas-schneiders-iO9uHKMFiVU' # 城市街道（特效厚带品牌）
  'm_ticket_guide'          = 'tsuyoshi-kozu-ukSDSF2oRA8'    # 城市高楼（票根竖长卡）
  'm_ticket_stub'           = 'noppadon-manadee-4CFbtKdHch8' # 金色草穗（票根存根）
  # ===== 第十批：手机壳 / 社交尺寸 8 套（2026-09-17，照片复用）=====
  'm_ph_three_center'       = 'rosalie-gdy-MAm8CTlyeI8'
  'm_ph_five_left'          = 'clement-proust-XxK9RR09DIU'
  'm_ph_six_left'           = 'tsuyoshi-kozu-ukSDSF2oRA8'
  'm_ph_seven_center'       = 'julie-gaia-guzal-0IT4vwi1hZo'
  'm_ph_nine_caps'          = 'douglas-schneiders-iO9uHKMFiVU'
  'm_ph_pairs_six'          = 'marcus-ganahl-Z2-lnDiixBM'
  'm_ph_night_five'         = 'alin-gavriliuc-PZ5HifLJcjo'
  'm_social_story_two'      = 'anton-shakirov-K1RmYc5pRks'
}

$files = @(Get-ChildItem -LiteralPath $SrcDir -File | Where-Object { $_.Extension -match '\.(jpe?g|png|webp)$' } | Sort-Object Name)
Write-Output ("源照片目录: {0}（{1} 张）" -f $SrcDir, $files.Count)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int]$Quality)

$totalKB = 0
$missing = 0
$keys = @($MAP.Keys)
if ($Only.Count -gt 0) {
  # 兼容两种传参：-Only a,b（整体字符串）与 -Only a b（数组）
  $want = @($Only -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $keys = @($keys | Where-Object { $want -contains $_ })
  if ($keys.Count -eq 0) { Write-Output ('未匹配到任何模板 id: ' + ($want -join ', ')); exit 1 }
}
foreach ($k in $keys) {
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
Write-Output ("完成：{0} 张（缺失 {1}）/ 共 {2} KB" -f $keys.Count, $missing, $totalKB)
