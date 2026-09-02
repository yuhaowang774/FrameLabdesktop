# FrameLab 一键更新发布脚本：
#   1) 读取 package.json 版本号
#   2) minisign 签名构建（npm run tauri:build，私钥在 %USERPROFILE%\.tauri\framelab.key）
#   3) 更新 release\FrameLab.exe（本地免安装运行副本）
#   4) 生成 latest.json 更新清单（updater 端点指向 GitHub Releases latest 资产）
#   5) 创建（或复用）GitHub Release v{version} 并上传 安装包/.sig/latest.json
# 用法：powershell -ExecutionPolicy Bypass -File scripts\publish-update.ps1
# 注意：执行前请先提交并推送代码；tag 会打在远端 main 最新提交上。
param(
  [string]$Notes = 'Bug 修复与体验优化',
  [string]$Owner = 'yuhaowang774',
  [string]$Repo = 'FrameLabdesktop'
)

$ErrorActionPreference = 'Stop'
$env:GCM_INTERACTIVE = 'never'   # 凭据缺失时不弹交互 UI，直接报错

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# ===== 1) 版本号 =====
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$tag = "v$version"
Write-Host "== FrameLab $tag 更新发布 =="

# ===== 2) 签名密钥 + 构建 =====
$keyPath = Join-Path $env:USERPROFILE '.tauri\framelab.key'
if (-not (Test-Path $keyPath)) {
  throw "未找到签名私钥：$keyPath（先运行 npx tauri signer generate -w <路径> --ci）"
}
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content $keyPath -Raw)
# 签名密码存放于 %USERPROFILE%\.tauri\framelab.pass（不入仓库）；
# 注意 Win32 不允许空环境变量（PS 赋空串等于删除），空密码密钥在 Windows 上会触发交互提示，故使用带密码密钥
$passPath = Join-Path $env:USERPROFILE '.tauri\framelab.pass'
if (-not (Test-Path $passPath)) { throw "未找到签名密码文件：$passPath" }
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content $passPath -Raw).Trim()

npm run tauri:build
if ($LASTEXITCODE -ne 0) { throw '构建失败' }

# ===== 3) 产物定位 + 本地 exe 副本 =====
$nsisDir = Join-Path $root 'src-tauri\target\release\bundle\nsis'
$assetName = "FrameLab_${version}_x64-setup.exe"
$setup = Join-Path $nsisDir $assetName
$sig = "$setup.sig"
if (-not (Test-Path $setup)) { throw "未找到安装包：$setup" }
if (-not (Test-Path $sig)) { throw "未找到签名文件：$sig（TAURI_SIGNING_PRIVATE_KEY 是否生效？）" }

Stop-Process -Name FrameLab -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $root 'src-tauri\target\release\framelab.exe') (Join-Path $root 'release\FrameLab.exe') -Force
Write-Host '已更新 release\FrameLab.exe'

# ===== 4) latest.json（无 BOM UTF-8）=====
$sigContent = (Get-Content $sig -Raw).Trim()
$latest = [ordered]@{
  version  = $version
  notes    = $Notes
  pub_date = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd\THH:mm:ss\Z')
  platforms = [ordered]@{
    'windows-x86_64' = [ordered]@{
      signature = $sigContent
      url       = "https://github.com/$Owner/$Repo/releases/download/$tag/$assetName"
    }
  }
}
$latestPath = Join-Path $nsisDir 'latest.json'
[System.IO.File]::WriteAllText($latestPath, ($latest | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "已生成 latest.json（$version）"

# ===== 5) GitHub 凭据（复用 git 凭据管理器已存 token；管道方式在无 TTY 环境也可用）=====
$credOut = "protocol=https`nhost=github.com`n`n" | git credential fill 2>$null
if ($LASTEXITCODE -ne 0 -or -not $credOut) { throw 'git credential fill 失败，请先手动 git push 一次以写入凭据' }
$token = ([regex]::Match(($credOut -join "`n"), 'password=(.+)')).Groups[1].Value.Trim()
if (-not $token) { throw '未能从 git 凭据管理器获取 GitHub token，请先手动 git push 一次以写入凭据' }

$headers = @{
  Authorization          = "Bearer $token"
  Accept                 = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent'           = 'framelab-release-script'
}
$api = "https://api.github.com/repos/$Owner/$Repo"
$uploadBase = "https://uploads.github.com/repos/$Owner/$Repo/releases"

# ===== 6) 创建或复用 Release =====
$rel = $null
try {
  $rel = Invoke-RestMethod -Headers $headers -Method Get -Uri "$api/releases/tags/$tag" -TimeoutSec 60
} catch { }
if (-not $rel) {
  $body = @{
    tag_name         = $tag
    target_commitish = 'main'
    name             = "FrameLab $tag"
    body             = $Notes
    draft            = $false
    prerelease       = $false
  } | ConvertTo-Json
  $rel = Invoke-RestMethod -Headers $headers -Method Post -Uri "$api/releases" -Body $body -ContentType 'application/json' -TimeoutSec 60
  Write-Host "已创建 Release $tag"
} else {
  Write-Host "Release $tag 已存在，复用"
}

# ===== 7) 上传资产（同名已存在则跳过）=====
$existing = @()
if ($rel.assets) { $existing = @($rel.assets | ForEach-Object { $_.name }) }
foreach ($f in @($setup, $sig, $latestPath)) {
  $name = Split-Path $f -Leaf
  if ($existing -contains $name) { Write-Host "已存在，跳过：$name"; continue }
  $up = "$uploadBase/$($rel.id)/assets?name=$name"
  Invoke-RestMethod -Headers $headers -Method Post -Uri $up -InFile $f -ContentType 'application/octet-stream' -TimeoutSec 900 | Out-Null
  Write-Host "已上传：$name"
}

Write-Host "== 发布完成：https://github.com/$Owner/$Repo/releases/tag/$tag =="
