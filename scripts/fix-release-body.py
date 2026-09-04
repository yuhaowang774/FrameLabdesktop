# -*- coding: utf-8 -*-
"""修复 GitHub Release body 乱码：将中文 Notes 以 UTF-8 重新 PATCH 回已发布的 Release"""
import subprocess
import json
import urllib.request
import urllib.error

OWNER = 'yuhaowang774'
REPO = 'FrameLabdesktop'

FIXES = {
    'v0.1.20': '修复绿色版无法更新到新版本、残留 FrameLab.exe.new 的问题',
    'v0.1.19': '空白区域拖动 + 导出圆圈勾选；修复缩放上下限偏移',
    'v0.1.18': '应用图标改为圆角白底设计（A+Z 徽标圆角版），窗口/任务栏/安装包图标统一圆角效果',
    'v0.1.17': '应用图标背景改为纯白（A+Z 徽标白底版），窗口/任务栏/安装包图标统一为白底效果',
    'v0.1.16': '应用图标更换为全新 A+Z 几何徽标（窗口、任务栏、安装包图标同步更新）；补写 0.1.15 更新记录并增加发版校验',
    'v0.1.15': '右栏「背景/边框/INFO信息」三栏新增显示开关并联动折叠面板；模板库缩略图改当前照片合成、Logo 随背景自适应；修复 CCD 日期拖拽越界等问题',
}


def get_token():
    p = subprocess.run(
        ['git', 'credential', 'fill'],
        input='protocol=https\nhost=github.com\n\n',
        capture_output=True,
        text=True,
        check=True,
    )
    for line in p.stdout.splitlines():
        if line.startswith('password='):
            return line[len('password='):].strip()
    raise RuntimeError('未从 git 凭据获取到 token')


def api(url, token, method='GET', body=None):
    req = urllib.request.Request(url, method=method)
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Accept', 'application/vnd.github.v3+json')
    req.add_header('User-Agent', 'framelab-fix-encoding')
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
        req.add_header('Content-Type', 'application/json; charset=utf-8')
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as r:
            raw = r.read()
            return json.loads(raw.decode('utf-8')) if raw else None
    except urllib.error.HTTPError as e:
        print('HTTP ERROR', e.code, e.read().decode('utf-8', 'ignore'))
        raise


def main():
    token = get_token()
    for tag, notes in FIXES.items():
        rel = api(f'https://api.github.com/repos/{OWNER}/{REPO}/releases/tags/{tag}', token)
        rid = rel['id']
        old = rel.get('body', '')
        print(f'{tag}: id={rid} old={old!r}')
        updated = api(
            f'https://api.github.com/repos/{OWNER}/{REPO}/releases/{rid}',
            token,
            method='PATCH',
            body={'body': notes},
        )
        print(f'{tag}: -> {updated.get("body")!r}')


if __name__ == '__main__':
    main()