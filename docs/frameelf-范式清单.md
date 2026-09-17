# FrameElf 语料范式清单与落地排期（自动生成）

> 生成时间：2026-09-16；语料：`D:/FRAMEELF/templates_decoded`
> 工具：`scripts/scan-frameelf-paradigms.mjs`（只读扫描，仅统计结构与比例）
>
> **合规说明**：本清单只记录版式骨架与几何比例，不含竞品素材、字体文件、示例文案与预览图；
> 落地时一律用 FrameLab 自有引擎参数、自有命名与文案、自绘素材重写（见 AGENTS.md 合规边界）。

## 一、语料概览

- 模板总数：**102** 套，分布在 **22** 个分类
- 设计重复度：**97** 个骨架簇 → 语料基本是「一模板一设计」，不存在可批量合并的大簇
- 现有内置模板：**42** 套（`useTemplates.ts` 的 BUILTIN，另有 5 套 rc_ 晋升款）
- 落地档位定义：**A** 现有内置字段可直接重写 / **B** 用既有扩展能力或自由元素手工拼装 / **C** 依赖素材（需自绘或降级）/ **D** 需架构改造（暂缓）

| 分类 | 套数 |
|---|---|
| 01_相机边框 | 11 |
| 09_白边边框 | 11 |
| 02_手机边框 | 10 |
| 16_无边水印 | 7 |
| 18_个人水印 | 7 |
| 24_旅行票根 | 6 |
| 03_大疆 | 5 |
| 06_ColorWalk | 5 |
| 07_多彩边框 | 5 |
| 15_简约边框 | 4 |
| 22_色卡边框 | 4 |
| 05_胶片边框 | 3 |
| 08_经典水印 | 3 |
| 13_日历边框 | 3 |
| 14_杂志边框 | 3 |
| 17_大师水印 | 3 |
| 20_节日边框 | 3 |
| 21_特效边框 | 3 |
| 12_运动边框 | 2 |
| 19_拍立得 | 2 |
| 04_富士 | 1 |
| 23_模糊背景 | 1 |

## 二、落地档位统计

| 档位 | 套数 | 说明 |
|---|---|---|
| A 可直接重写 | **15** | 纯文字/线条排版，bgMode / padding / borderRatio / infoLayout / overlayAlign 等现有字段即可 |
| B 需拼装/近似 | **68** | 色卡、Logo、5~8 行文字块、浮动水印等，需用既有扩展能力或自由元素手工排 |
| C 依赖素材 | **19** | 相机壳/胶片框/背景图等素材，需自绘，或降级为无素材版本后按 A/B 做 |
| D 暂缓 | **0** | 拼图（多照片架构，独立立项） |

**能力需求频次**（C/D 组除外）

| 需要的能力 | 涉及套数 |
|---|---|
| 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 33 |
| 浮层水印（float 九宫格对齐现成） | 30 |
| 相机壳/胶片框素材 | 15 |
| 5 行文字块（自由元素拼装） | 13 |
| 色卡条（palette/paletteHex 现成） | 11 |
| 8 行文字块（自由元素拼装） | 9 |
| 6 行文字块（自由元素拼装） | 7 |
| 纯文字/线条排版，现有字段直接可写 | 7 |
| 品牌 Logo（自绘 modelMarks/brand-logos 现成：custom） | 7 |
| 7 行文字块（自由元素拼装） | 6 |
| 品牌 Logo（自绘 modelMarks/brand-logos 现成：avatar） | 5 |
| 10 行文字块（自由元素拼装） | 5 |
| 背景图素材 | 4 |
| 多边形色卡（现成 Rect/Polygon 近似） | 4 |
| 农历/干支文本（自由元素暂无占位符，需小扩展或改用月历布局） | 3 |
| 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo/custom） | 3 |
| 品牌 Logo（自绘 modelMarks/brand-logos 现成：lenLogo） | 1 |
| 9 行文字块（自由元素拼装） | 1 |
| 品牌 Logo（自绘 modelMarks/brand-logos 现成：custom/makeLogo） | 1 |
| 12 行文字块（自由元素拼装） | 1 |
| 26 行文字块（自由元素拼装） | 1 |
| 14 行文字块（自由元素拼装） | 1 |
| 日历格（可复用 calendar 布局） | 1 |
| 品牌 Logo（自绘 modelMarks/brand-logos 现成：avatar/custom） | 1 |

## 三、逐套明细与落地判定

| 档位 | 分类 | id | 画布 | 照片占比 | 信息区 | 文字骨架 | 装饰层 | 需要的能力 | 建议分组 |
|---|---|---|---|---|---|---|---|---|---|
| A | 02_手机边框 | y9JRNkro4NbMKmYwV | 1624×2287 | 79.4% | 底部横带中(8~16%) | 3行[器材/参数/日期]center特大(>3.2%) | 无装饰层 | 纯文字/线条排版，现有字段直接可写 | 设备样机 |
| A | 05_胶片边框 | Bkn8NQd7pxALO91xE | 1920×1920 | 100% | 浮动:bottom-right | 1行[日期]right特大(>3.2%) | 无装饰层 | 浮层水印（float 九宫格对齐现成） | 胶片复古 |
| A | 06_ColorWalk | 617xEadpKPRbLqoky | 2094×2571 | 68.5% | 底部横带厚(16~26%) | 3行[其他/器材/参数]center大字(2~3.2%)大写 | 无装饰层 | 纯文字/线条排版，现有字段直接可写 | 多彩色卡 |
| A | 06_ColorWalk | 9lyYp0rY0xDAXLxzq | 1947×1920 | 65.7% | 右缘竖带特厚(>26%) | 1行[其他]left大字(2~3.2%) | 无装饰层 | 纯文字/线条排版，现有字段直接可写 | 多彩色卡 |
| A | 06_ColorWalk | zBQXRvbVVJPb1pwWG | 1920×2604 | 55.3% | 顶部横带特厚(>26%) | 2行[其他/其他]center大字(2~3.2%) | 无装饰层 | 纯文字/线条排版，现有字段直接可写 | 多彩色卡 |
| A | 09_白边边框 | mWkqO2dBqwbMolX54 | 1672×1764 | 65.9% | 浮动:? | 4行[器材/器材/其他/参数]left特大(>3.2%)大写 | 无装饰层 | 纯文字/线条排版，现有字段直接可写 | 经典 |
| A | 09_白边边框 | xO5oPGr8zg7dDj1VL | 2005×1672 | 82.5% | 底部横带中(8~16%) | 2行[器材/日期]left大字(2~3.2%) | 无装饰层 | 纯文字/线条排版，现有字段直接可写 | 经典 |
| A | 09_白边边框 | ZnkOe5d9gxRrgo1EV | 2147×2198 | 58.6% | 浮动:? | 4行[参数/参数/参数/参数]center大字(2~3.2%) | 线条×3 | 纯文字/线条排版，现有字段直接可写 | 经典 |
| A | 14_杂志边框 | ZnkOe5d9g02rgo1EV | 1440×1920 | 100% | 浮动:top | 2行[其他/其他]center特大(>3.2%)大写 | 无装饰层 | 浮层水印（float 九宫格对齐现成） | 杂志编辑 |
| A | 16_无边水印 | gJal7NA46XbZ0O9k4 | 2048×1365 | 100% | 浮动:bottom | 4行[参数/参数/参数/参数]left中字(1.2~2%) | 无装饰层 | 浮层水印（float 九宫格对齐现成） | 水印署名 |
| A | 16_无边水印 | gJal7NA4lKAZ0O9k4 | 1920×1280 | 100% | 浮动:bottom | 1行[署名]left大字(2~3.2%) | 无装饰层 | 浮层水印（float 九宫格对齐现成） | 水印署名 |
| A | 17_大师水印 | 7jwapKbGYEYAz28NB | 2252.8×3003.7333333333336 | 41.3% | 浮动:bottom | 无文字 | 无装饰层 | 浮层水印（float 九宫格对齐现成） | 大师水印 |
| A | 18_个人水印 | y9JRNkroX7bMKmYwV | 1365×1707 | 100% | 浮动:bottom | 1行[署名]left中字(1.2~2%) | 无装饰层 | 浮层水印（float 九宫格对齐现成） | 水印署名 |
| A | 18_个人水印 | Z6D2nqbQgyAEYo1yL | 1080×1766 | 100% | 浮动:bottom | 4行[固定文案/固定文案/其他/固定文案]left特大(>3.2%) | 无装饰层 | 浮层水印（float 九宫格对齐现成） | 水印署名 |
| A | 24_旅行票根 | jnmXE6bWPQxdw0veN | 2047×1260 | 100.1% | 右缘竖带窄(≤8%) | 4行[其他/日期/其他/其他]left特大(>3.2%) | 无装饰层 | 浮层水印（float 九宫格对齐现成） | 纸品印刷 |
| B | 01_相机边框 | GMLJlPAXW48djBN96 | 2172×1662 | 77.4% | 底部横带中(8~16%) | 8行[日期/位置/器材/镜头/参数/参数/参数/参数]left中字(1.2~2%) | Logo×1(makeLogo) + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；8 行文字块（自由元素拼装） | 联名卡 |
| B | 01_相机边框 | p3149KrK5ldOPzyW7 | 2048×1691 | 80.2% | 底部横带厚(16~26%) | 6行[器材/镜头/参数/参数/参数/参数]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；6 行文字块（自由元素拼装） | 联名卡 |
| B | 01_相机边框 | wO9EVpdjWpAWNKo7J | 2172×1722 | 74.9% | 底部横带厚(16~26%) | 5行[器材/参数/参数/参数/参数]left大字(2~3.2%)大写 | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；5 行文字块（自由元素拼装） | 联名卡 |
| B | 02_手机边框 | 4y1XR6dm17dPjLlDq | 2048×2218 | 81.2% | 底部横带中(8~16%) | 7行[器材/日期/参数/参数/参数/参数/位置]center中字(1.2~2%) | Logo×1(avatar) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：avatar）；7 行文字块（自由元素拼装） | 设备样机 |
| B | 02_手机边框 | 4y1XR6dmLBbPjLlDq | 2122×2760 | 62.9% | 底部横带特厚(>26%) | 9行[其他/器材/镜头/参数/参数/署名/参数/参数/其他]center特大(>3.2%)大写 | Logo×1(makeLogo) + 线条×4 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；9 行文字块（自由元素拼装） | 设备样机 |
| B | 02_手机边框 | jnmXE6bWl3dw0veNL | 2091×2468 | 71.4% | 底部横带厚(16~26%) | 5行[器材/镜头/日期/位置/参数]center大字(2~3.2%)大写 | Logo×2(custom/makeLogo) + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：custom/makeLogo）；5 行文字块（自由元素拼装） | 设备样机 |
| B | 02_手机边框 | m1nq7RAeyaAxk4VNo | 2157×1787 | 72.5% | 浮动:? | 5行[器材/参数/参数/参数/参数]left大字(2~3.2%) | Logo×1(makeLogo) + 线条×4 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；5 行文字块（自由元素拼装） | 设备样机 |
| B | 02_手机边框 | o4LBGadn1Jb7J9y16 | 2035×2209 | 82% | 底部横带中(8~16%) | 6行[器材/参数/参数/参数/参数/日期]left大字(2~3.2%) | 线条×3 | 6 行文字块（自由元素拼装） | 设备样机 |
| B | 02_手机边框 | p3149KrKMJdOPzyW7 | 1245×1620 | 86.7% | 右缘竖带中(8~16%) | 10行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；10 行文字块（自由元素拼装） | 设备样机 |
| B | 02_手机边框 | p3149KrKMPdOPzyW7 | 1920×2119 | 90.6% | 底部横带中(8~16%) | 7行[器材/日期/参数/参数/参数/参数/位置]left大字(2~3.2%) | Logo×1(makeLogo) + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；7 行文字块（自由元素拼装） | 设备样机 |
| B | 02_手机边框 | WK1jaGdRPzr724XE6 | 1080×1600 | 90% | 底部横带中(8~16%) | 12行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/日期/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；12 行文字块（自由元素拼装） | 设备样机 |
| B | 02_手机边框 | zBQXRvbVV9yb1pwWG | 2075×1932 | 69% | 底部横带厚(16~26%) | 1行[参数]left中字(1.2~2%) | Logo×2(makeLogo/custom) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo/custom） | 设备样机 |
| B | 03_大疆 | lMwJavAyG0WbO0o5D | 1920×1682 | 85.6% | 浮动:bottom | 无文字 | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 联名卡 |
| B | 03_大疆 | nLz0avdPRV2r1j7lZ | 1920×1685 | 85.5% | 浮动:bottom | 无文字 | Logo×2(makeLogo/custom) + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo/custom） | 联名卡 |
| B | 03_大疆 | QoaJORd5DkvbPYxBz | 1920×1440 | 100% | 浮动:bottom | 无文字 | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；浮层水印（float 九宫格对齐现成） | 联名卡 |
| B | 03_大疆 | qzxEM3raq88rl5BX6 | 1920×1666 | 86.4% | 底部横带中(8~16%) | 4行[参数/参数/参数/参数]center大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 联名卡 |
| B | 03_大疆 | YoPm64ANmM9dW2vjq | 1920×1440 | 100% | 浮动:bottom | 无文字 | Logo×2(makeLogo/custom) + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo/custom）；浮层水印（float 九宫格对齐现成） | 联名卡 |
| B | 04_富士 | apqVeldMmDVdyo2Ez | 2181×2151 | 59.3% | 底部横带特厚(>26%) | 26行[其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/其他/参数/其他]center大字(2~3.2%) | 无装饰层 | 26 行文字块（自由元素拼装） | 胶片复古 |
| B | 06_ColorWalk | 2YJ7q1AO4RgraG0en | 2072.3849999999998×2763.18 | 51.5% | 浮动:? | 3行[署名/其他/其他]center大字(2~3.2%) | Logo×1(avatar) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：avatar） | 多彩色卡 |
| B | 06_ColorWalk | y9JRNkrojElAMKmYw | 1920×2604 | 55.3% | 顶部横带特厚(>26%) | 5行[其他/参数/参数/参数/参数]center大字(2~3.2%) | 无装饰层 | 5 行文字块（自由元素拼装） | 多彩色卡 |
| B | 07_多彩边框 | 3JRELWdLOzwbYMn9v | 2241×2424 | 51.5% | 浮动:? | 7行[其他/其他/日期/日期/其他/其他/其他]center特大(>3.2%) | 色卡条×1 + 色块×5 + 线条×1 | 色卡条（palette/paletteHex 现成）；7 行文字块（自由元素拼装） | 多彩色卡 |
| B | 07_多彩边框 | mWkqO2dBparMolX54 | 2138×2003 | 65.3% | 浮动:? | 6行[器材/器材/署名/镜头/参数/日期]left特大(>3.2%)大写 | 色卡条×1 + 色块×5 | 色卡条（palette/paletteHex 现成）；6 行文字块（自由元素拼装） | 多彩色卡 |
| B | 07_多彩边框 | qzxEM3raEXrl5BX60 | 1360×1486 | 91.5% | 底部横带中(8~16%) | 无文字 | 色卡条×1 + 色块×6 | 色卡条（palette/paletteHex 现成） | 多彩色卡 |
| B | 07_多彩边框 | WK1jaGdRzOd724XE6 | 2198×2085 | 61% | 浮动:? | 4行[器材/器材/参数/其他]left特大(>3.2%)大写 | 色卡条×1 + 色块×5 | 色卡条（palette/paletteHex 现成） | 多彩色卡 |
| B | 07_多彩边框 | xO5oPGr8z0VdDj1VL | 1626×2168 | 69.7% | 浮动:? | 5行[器材/参数/参数/参数/参数]left中字(1.2~2%) | 色卡条×2 | 色卡条（palette/paletteHex 现成）；5 行文字块（自由元素拼装） | 多彩色卡 |
| B | 08_经典水印 | 5DEga7A3ROdKQYOXj | 2048×1462 | 84% | 底部横带中(8~16%) | 4行[参数/参数/参数/参数]left中字(1.2~2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 水印署名 |
| B | 08_经典水印 | o4LBGadn5Mb7J9y16 | 2048×1622 | 84.2% | 底部横带中(8~16%) | 5行[器材/参数/参数/参数/参数]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；5 行文字块（自由元素拼装） | 水印署名 |
| B | 08_经典水印 | ZnkOe5d9g2rgo1EVa | 1167×1197 | 90.2% | 底部横带中(8~16%) | 2行[其他/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 水印署名 |
| B | 09_白边边框 | apqVeldMmOdyo2EzX | 1557×1281 | 78% | 底部横带中(8~16%) | 2行[其他/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 经典 |
| B | 09_白边边框 | Bkn8NQd7wxdLO91xE | 1182×1794 | 82.5% | 底部横带窄(≤8%) | 10行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；10 行文字块（自由元素拼装） | 经典 |
| B | 09_白边边框 | jnmXE6bWKDbw0veNL | 1183×1813 | 81.5% | 底部横带窄(≤8%) | 14行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/固定文案/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；14 行文字块（自由元素拼装） | 经典 |
| B | 09_白边边框 | NKGQ5zAwkGAo4WyYg | 1569×1454 | 68.2% | 底部横带厚(16~26%) | 2行[其他/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 经典 |
| B | 09_白边边框 | p3149KrKOerOPzyW7 | 2148×1650 | 78.9% | 底部横带中(8~16%) | 8行[参数/其他/参数/其他/参数/其他/参数/其他]center大字(2~3.2%) | 无装饰层 | 8 行文字块（自由元素拼装） | 经典 |
| B | 09_白边边框 | xO5oPGr866dDj1VLp | 1755×1151 | 73.1% | 底部横带中(8~16%) | 10行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；10 行文字块（自由元素拼装） | 经典 |
| B | 09_白边边框 | Y9oE6Orx24d3LVWRw | 1857×1447 | 69.4% | 底部横带厚(16~26%) | 8行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；8 行文字块（自由元素拼装） | 经典 |
| B | 09_白边边框 | zBQXRvbV1nr1pwWGa | 1638×1448 | 64.3% | 底部横带厚(16~26%) | 8行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) + 线条×3 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；8 行文字块（自由元素拼装） | 经典 |
| B | 12_运动边框 | jnmXE6bWwWbw0veNL | 2184×1955 | 65.3% | 底部横带特厚(>26%) | 3行[器材/参数/位置]left大字(2~3.2%)大写 | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 运动边框 |
| B | 12_运动边框 | p3149KrK7erOPzyW7 | 2097×2359 | 82.3% | 底部横带中(8~16%) | 4行[器材/参数/固定文案/其他]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 运动边框 |
| B | 13_日历边框 | Bkn8NQd7YarLO91xE | 2132×2252 | 58.2% | 右缘竖带特厚(>26%) | 4行[日期/日期/农历/农历]center特大(>3.2%) | 无装饰层 | 农历/干支文本（自由元素暂无占位符，需小扩展或改用月历布局） | 日历边框 |
| B | 13_日历边框 | lMwJavAykjbO0o5DG | 2117×2823 | 41.1% | 底部横带特厚(>26%) | 1行[日期]center特大(>3.2%) | 日历格 | 日历格（可复用 calendar 布局） | 日历边框 |
| B | 13_日历边框 | MnNQEwA2l1b71oJkq | 2128×1839 | 73.6% | 浮动:top-right | 4行[日期/日期/农历/镜头]center特大(>3.2%) | 无装饰层 | 农历/干支文本（自由元素暂无占位符，需小扩展或改用月历布局） | 日历边框 |
| B | 14_杂志边框 | xVlBRprZ1DKA9a7W5 | 1677.5100000000002×2236.6800000000003 | 65.5% | 浮动:bottom | 6行[其他/其他/其他/其他/其他/日期]center特大(>3.2%)大写 | 线条×2 | 6 行文字块（自由元素拼装）；浮层水印（float 九宫格对齐现成） | 杂志编辑 |
| B | 14_杂志边框 | zBQXRvbVV0vb1pwWG | 1677.5100000000002×2236.6800000000003 | 65.5% | 浮动:bottom | 6行[其他/其他/其他/其他/其他/日期]center特大(>3.2%)大写 | 线条×2 | 6 行文字块（自由元素拼装）；浮层水印（float 九宫格对齐现成） | 杂志编辑 |
| B | 15_简约边框 | jnmXE6bW0Kdw0veNL | 1149×1689 | 90.2% | 浮动:bottom | 2行[其他/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；浮层水印（float 九宫格对齐现成） | 极简轻量 |
| B | 15_简约边框 | m1nq7RAeYBAxk4VNo | 1680×1140 | 91.4% | 浮动:center | 10行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left大字(2~3.2%) | 无装饰层 | 10 行文字块（自由元素拼装）；浮层水印（float 九宫格对齐现成） | 极简轻量 |
| B | 15_简约边框 | O3Kwy7AlK0dREPoYj | 1541×1046 | 91.4% | 浮动:top-left | 8行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left大字(2~3.2%) | 无装饰层 | 8 行文字块（自由元素拼装）；浮层水印（float 九宫格对齐现成） | 极简轻量 |
| B | 15_简约边框 | y9JRNkroxlbMKmYwV | 1678×1140 | 91.3% | 浮动:bottom | 8行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left大字(2~3.2%) | 无装饰层 | 8 行文字块（自由元素拼装）；浮层水印（float 九宫格对齐现成） | 极简轻量 |
| B | 16_无边水印 | 3JRELWdLORbYMn9vj | 2048×1365 | 100% | 浮动:bottom | 5行[器材/参数/参数/参数/参数]left中字(1.2~2%) | 无装饰层 | 5 行文字块（自由元素拼装）；浮层水印（float 九宫格对齐现成） | 水印署名 |
| B | 16_无边水印 | 4y1XR6dmp6bPjLlDq | 1620×1080 | 100% | 浮动:top-left | 8行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left大字(2~3.2%) | 无装饰层 | 8 行文字块（自由元素拼装）；浮层水印（float 九宫格对齐现成） | 水印署名 |
| B | 16_无边水印 | gJal7NA46jMbZ0O9k | 1440×1920 | 100% | 浮动:top | 5行[其他/其他/其他/其他/其他]center特大(>3.2%) | 线条×2 | 5 行文字块（自由元素拼装）；浮层水印（float 九宫格对齐现成） | 水印署名 |
| B | 16_无边水印 | mWkqO2dBMGXbMolX5 | 2048×1358 | 100% | 浮动:bottom-left | 3行[器材/镜头/固定文案]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；浮层水印（float 九宫格对齐现成） | 水印署名 |
| B | 16_无边水印 | Qo6zORAJ2MAjBDvGg | 1620×1080 | 100% | 浮动:center | 2行[其他/固定文案]left中字(1.2~2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；浮层水印（float 九宫格对齐现成） | 水印署名 |
| B | 17_大师水印 | 3JRELWdLqMAYMn9vj | 1535×1676 | 59.4% | 浮动:? | 7行[其他/其他/其他/参数/参数/参数/参数]center中字(1.2~2%) | Logo×1(makeLogo) + 线条×3 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；7 行文字块（自由元素拼装） | 大师水印 |
| B | 17_大师水印 | aMnPV9bzlaA5j26kJ | 1574×2048 | 86.7% | 右缘竖带中(8~16%) | 5行[器材/参数/其他/其他/其他]center大字(2~3.2%) | 无装饰层 | 5 行文字块（自由元素拼装） | 大师水印 |
| B | 18_个人水印 | lB8RY9AEmVAQjvw3O | 1689×1149 | 90.2% | 浮动:bottom | 2行[其他/固定文案]left大字(2~3.2%) | Logo×1(avatar) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：avatar）；浮层水印（float 九宫格对齐现成） | 水印署名 |
| B | 18_个人水印 | m1nq7RAeY4EAxk4VN | 2158×2010 | 64.4% | 浮动:? | 7行[署名/其他/其他/其他/其他/其他/其他]center大字(2~3.2%) | Logo×2(avatar/custom) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：avatar/custom）；7 行文字块（自由元素拼装） | 水印署名 |
| B | 18_个人水印 | MnNQEwA2jeA71oJkq | 720×1080 | 100% | 浮动:bottom | 2行[其他/固定文案]left特大(>3.2%) | Logo×1(avatar) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：avatar）；浮层水印（float 九宫格对齐现成） | 水印署名 |
| B | 18_个人水印 | ylv892dg38dNYxwM0 | 1159×1809 | 83.4% | 底部横带中(8~16%) | 10行[其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案/其他/固定文案]left特大(>3.2%) | Logo×1(avatar) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：avatar）；10 行文字块（自由元素拼装） | 水印署名 |
| B | 18_个人水印 | zBQXRvbVqPr1pwWGa | 1887×1588 | 89.2% | 底部横带中(8~16%) | 6行[参数/参数/参数/参数/固定文案/署名]center大字(2~3.2%) | 无装饰层 | 6 行文字块（自由元素拼装） | 水印署名 |
| B | 20_节日边框 | 617xEadpJlRrLqoky | 2048×1589 | 85.9% | 底部横带中(8~16%) | 7行[器材/日期/参数/参数/参数/参数/位置]left大字(2~3.2%) | Logo×1(makeLogo) + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo）；7 行文字块（自由元素拼装） | 创意排版 |
| B | 20_节日边框 | O3Kwy7Alk20dREPoY | 2031×2448 | 59.3% | 浮动:? | 3行[器材/参数/署名]center中字(1.2~2%)大写 | Logo×1(custom) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：custom） | 创意排版 |
| B | 20_节日边框 | OPnEp6d0D30dJVlKx | 2048×1679 | 81.3% | 底部横带厚(16~26%) | 无文字 | Logo×1(custom) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：custom） | 创意排版 |
| B | 21_特效边框 | 617xEadpzQrLqoky8 | 1701×2479 | 69.9% | 底部横带厚(16~26%) | 2行[器材/参数]center特大(>3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 创意排版 |
| B | 21_特效边框 | Bkn8NQd7XaALO91xE | 1365×1504 | 90.8% | 底部横带中(8~16%) | 4行[器材/日期/参数/位置]left大字(2~3.2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 创意排版 |
| B | 23_模糊背景 | 5DEga7A30MrKQYOXj | 2209×1670 | 75.8% | 底部横带中(8~16%) | 4行[参数/参数/参数/参数]left中字(1.2~2%) | Logo×1(makeLogo) | 品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 暗调影廊 |
| B | 24_旅行票根 | eY4Gmwdqp2Lb9k567 | 3141.98×3141.98 | 24.9% | 右缘竖带特厚(>26%) | 4行[其他/日期/其他/其他]left特大(>3.2%) | Logo×1(custom) + 色块×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：custom） | 纸品印刷 |
| B | 24_旅行票根 | gJal7NA46x3bZ0O9k | 3202.5×4270 | 18% | 顶部横带特厚(>26%) | 3行[其他/其他/日期]center特大(>3.2%) | Logo×1(custom) + 色块×1 + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：custom） | 纸品印刷 |
| B | 24_旅行票根 | Y9oE6Orx2lnd3LVWR | 3178.06×4237.413333333333 | 18.2% | 顶部横带特厚(>26%) | 3行[其他/其他/日期]center特大(>3.2%) | Logo×1(custom) + 色块×1 + 线条×1 | 品牌 Logo（自绘 modelMarks/brand-logos 现成：custom） | 纸品印刷 |
| C | 01_相机边框 | 0LqyYMrDBvNdZ6lDo | 1708×2277.3333333333335 | 53.7% | 浮动:? | 6行[器材/署名/参数/参数/参数/参数]left大字(2~3.2%) | 相机壳/胶片框×1 + 色卡条×1 + 色块×3 | 相机壳/胶片框素材；色卡条（palette/paletteHex 现成）；6 行文字块（自由元素拼装） | 联名卡 |
| C | 01_相机边框 | 2gwVGabkeY4ADRe6Y | 2124×3194 | 38% | 底部横带特厚(>26%) | 3行[器材/镜头/署名]center大字(2~3.2%)大写 | Logo×1(makeLogo) + 相机壳/胶片框×1 | 相机壳/胶片框素材；品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 联名卡 |
| C | 01_相机边框 | 3JRELWdLGPmbYMn9v | 2033×1806 | 76.1% | 底部横带厚(16~26%) | 8行[参数/其他/参数/其他/参数/其他/参数/其他]center大字(2~3.2%) | Logo×1(lenLogo) + 相机壳/胶片框×1 + 线条×1 | 相机壳/胶片框素材；品牌 Logo（自绘 modelMarks/brand-logos 现成：lenLogo）；8 行文字块（自由元素拼装） | 联名卡 |
| C | 01_相机边框 | 3JRELWdLGq9bYMn9v | 1458×1920 | 100% | 浮动:bottom | 无文字 | 相机壳/胶片框×1 | 相机壳/胶片框素材；浮层水印（float 九宫格对齐现成） | 联名卡 |
| C | 01_相机边框 | gJal7NA4DlPAZ0O9k | 1434×1920 | 100% | 浮动:bottom | 无文字 | 相机壳/胶片框×1 | 相机壳/胶片框素材；浮层水印（float 九宫格对齐现成） | 联名卡 |
| C | 01_相机边框 | GMLJlPAXWJXdjBN96 | 2215×2993 | 53.1% | 浮动:? | 4行[器材/参数/其他/署名]center大字(2~3.2%)大写 | 相机壳/胶片框×1 + 色卡条×1 + 色块×3 | 相机壳/胶片框素材；色卡条（palette/paletteHex 现成） | 联名卡 |
| C | 01_相机边框 | mWkqO2dBMKxbMolX5 | 1365×1920 | 100% | 浮动:bottom | 无文字 | 相机壳/胶片框×1 | 相机壳/胶片框素材；浮层水印（float 九宫格对齐现成） | 联名卡 |
| C | 01_相机边框 | Qo6zORAJPYMbjBDvG | 1950×2600 | 42.5% | 左缘竖带特厚(>26%) | 8行[器材/农历/日期/农历/参数/参数/参数/参数]center特大(>3.2%) | 相机壳/胶片框×1 | 相机壳/胶片框素材；农历/干支文本（自由元素暂无占位符，需小扩展或改用月历布局）；8 行文字块（自由元素拼装） | 联名卡 |
| C | 05_胶片边框 | 2gwVGabk6KrDRe6Y8 | 2150×2150 | 59.6% | 底部横带特厚(>26%) | 无文字 | 相机壳/胶片框×1 | 相机壳/胶片框素材 | 胶片复古 |
| C | 05_胶片边框 | MnNQEwA20ob71oJkq | 2026×2628 | 59.8% | 浮动:? | 3行[器材/其他/署名]center大字(2~3.2%) | 相机壳/胶片框×1 | 相机壳/胶片框素材 | 胶片复古 |
| C | 19_拍立得 | apqVeldMmpqdyo2Ez | 1612×1920 | 100% | 浮动:bottom | 1行[署名]center中字(1.2~2%) | 相机壳/胶片框×1 | 相机壳/胶片框素材；浮层水印（float 九宫格对齐现成） | 胶片复古 |
| C | 19_拍立得 | qzxEM3raqG8rl5BX6 | 1728×2304 | 67.5% | 浮动:top | 4行[日期/日期/器材/位置]left特大(>3.2%) | 相机壳/胶片框×1 | 相机壳/胶片框素材；浮层水印（float 九宫格对齐现成） | 胶片复古 |
| C | 21_特效边框 | zBQXRvbVVYDb1pwWG | 2112×2112 | 62% | 底部横带特厚(>26%) | 无文字 | Logo×1(makeLogo) + 相机壳/胶片框×1 | 相机壳/胶片框素材；品牌 Logo（自绘 modelMarks/brand-logos 现成：makeLogo） | 创意排版 |
| C | 22_色卡边框 | LDao1yr1z2bYVWQP5 | 1261×810 | 79.5% | 右缘竖带中(8~16%) | 5行[固定文案/固定文案/固定文案/固定文案/固定文案]left中字(1.2~2%) | 色卡×5 + 多边形×5 + 背景图 | 背景图素材；色卡条（palette/paletteHex 现成）；多边形色卡（现成 Rect/Polygon 近似）；5 行文字块（自由元素拼装） | 多彩色卡 |
| C | 22_色卡边框 | nLz0avdPXBd1j7lZK | 772×1234 | 81.6% | 底部横带中(8~16%) | 5行[固定文案/固定文案/固定文案/固定文案/固定文案]left大字(2~3.2%) | 色卡×5 + 多边形×5 + 背景图 | 背景图素材；色卡条（palette/paletteHex 现成）；多边形色卡（现成 Rect/Polygon 近似）；5 行文字块（自由元素拼装） | 多彩色卡 |
| C | 22_色卡边框 | wO9EVpdjnydWNKo7J | 1213×720 | 89% | 右缘竖带中(8~16%) | 5行[固定文案/固定文案/固定文案/固定文案/固定文案]left中字(1.2~2%) | 色卡×5 + 多边形×5 + 背景图 | 背景图素材；色卡条（palette/paletteHex 现成）；多边形色卡（现成 Rect/Polygon 近似）；5 行文字块（自由元素拼装） | 多彩色卡 |
| C | 22_色卡边框 | YoPm64AN1ZdW2vjq3 | 1080×883 | 81.7% | 底部横带厚(16~26%) | 5行[固定文案/固定文案/固定文案/固定文案/固定文案]left中字(1.2~2%) | 色卡×5 + 多边形×5 + 背景图 | 背景图素材；色卡条（palette/paletteHex 现成）；多边形色卡（现成 Rect/Polygon 近似）；5 行文字块（自由元素拼装） | 多彩色卡 |
| C | 24_旅行票根 | y9JRNkroxzGbMKmYw | 1728×2304 | 37.6% | 浮动:bottom | 3行[其他/日期/其他]left特大(>3.2%) | Logo×1(custom) + 相机壳/胶片框×1 | 相机壳/胶片框素材；品牌 Logo（自绘 modelMarks/brand-logos 现成：custom）；浮层水印（float 九宫格对齐现成） | 纸品印刷 |
| C | 24_旅行票根 | Y9oE6Orx2nPd3LVWR | 2169.6×2169.6 | 31.8% | 浮动:right | 4行[其他/日期/其他/其他]left大字(2~3.2%) | Logo×1(custom) + 相机壳/胶片框×1 | 相机壳/胶片框素材；品牌 Logo（自绘 modelMarks/brand-logos 现成：custom）；浮层水印（float 九宫格对齐现成） | 纸品印刷 |

## 四、建议批次

**第 1 批（A 档，现有能力直接落地）**：

| # | 分类 | id | 画布 | 信息区 | 文字骨架 | 建议分组 |
|---|---|---|---|---|---|---|
| 1 | 02_手机边框 | y9JRNkro4NbMKmYwV | 1624×2287 | 底部横带中(8~16%) | 3行[器材/参数/日期]center特大(>3.2%) | 设备样机 |
| 2 | 05_胶片边框 | Bkn8NQd7pxALO91xE | 1920×1920 | 浮动:bottom-right | 1行[日期]right特大(>3.2%) | 胶片复古 |
| 3 | 06_ColorWalk | 617xEadpKPRbLqoky | 2094×2571 | 底部横带厚(16~26%) | 3行[其他/器材/参数]center大字(2~3.2%)大写 | 多彩色卡 |
| 4 | 06_ColorWalk | 9lyYp0rY0xDAXLxzq | 1947×1920 | 右缘竖带特厚(>26%) | 1行[其他]left大字(2~3.2%) | 多彩色卡 |
| 5 | 06_ColorWalk | zBQXRvbVVJPb1pwWG | 1920×2604 | 顶部横带特厚(>26%) | 2行[其他/其他]center大字(2~3.2%) | 多彩色卡 |
| 6 | 09_白边边框 | mWkqO2dBqwbMolX54 | 1672×1764 | 浮动:? | 4行[器材/器材/其他/参数]left特大(>3.2%)大写 | 经典 |
| 7 | 09_白边边框 | xO5oPGr8zg7dDj1VL | 2005×1672 | 底部横带中(8~16%) | 2行[器材/日期]left大字(2~3.2%) | 经典 |
| 8 | 09_白边边框 | ZnkOe5d9gxRrgo1EV | 2147×2198 | 浮动:? | 4行[参数/参数/参数/参数]center大字(2~3.2%) | 经典 |
| 9 | 14_杂志边框 | ZnkOe5d9g02rgo1EV | 1440×1920 | 浮动:top | 2行[其他/其他]center特大(>3.2%)大写 | 杂志编辑 |
| 10 | 16_无边水印 | gJal7NA46XbZ0O9k4 | 2048×1365 | 浮动:bottom | 4行[参数/参数/参数/参数]left中字(1.2~2%) | 水印署名 |
| 11 | 16_无边水印 | gJal7NA4lKAZ0O9k4 | 1920×1280 | 浮动:bottom | 1行[署名]left大字(2~3.2%) | 水印署名 |
| 12 | 17_大师水印 | 7jwapKbGYEYAz28NB | 2252.8×3003.7333333333336 | 浮动:bottom | 无文字 | 大师水印 |
| 13 | 18_个人水印 | y9JRNkroX7bMKmYwV | 1365×1707 | 浮动:bottom | 1行[署名]left中字(1.2~2%) | 水印署名 |
| 14 | 18_个人水印 | Z6D2nqbQgyAEYo1yL | 1080×1766 | 浮动:bottom | 4行[固定文案/固定文案/其他/固定文案]left特大(>3.2%) | 水印署名 |
| 15 | 24_旅行票根 | jnmXE6bWPQxdw0veN | 2047×1260 | 右缘竖带窄(≤8%) | 4行[其他/日期/其他/其他]left特大(>3.2%) | 纸品印刷 |

> A 档共 15 套，可按分类分批推进；B 档 68 套需先定「自由元素拼装」的统一范式；C 档 19 套待素材方案（自绘相机壳 or 降级）。

## 五、样张照片匹配方案（用你的照片取代竞品样张）

- **照片池**：`C:\Users\Administrator\Desktop\模版照片`（79 张，与 `src/assets/gallery/` 同源）。
- **占用情况**：`$MAP` 有 79 条历史映射，当前 47 套内置模板占用 47 张，约 32 张未被占用——新模板优先选未占用的照片。
- **匹配规则**（沿用既有原则）：画幅方向优先（方幅→1:1 照片 / 竖幅→竖构图 / 横幅→横构图），其次版式气质（高调白框配浅调、暗调款配夜景、胶片款配胶片感人像、色卡款配色彩浓烈、纸质模板配静物特写）。
- **落库**：在 `scripts/gen-template-samples.ps1` 的 `$MAP` 追加 `<模板id> = '<照片文件名特征串>'`，跑一次脚本生成 `src/assets/template-samples/<id>.jpg`（长边 1000 / q80）。
- **守护**：`src/core/templateSamples.test.ts` 要求「每个内置模板都有样张」，缺图即测试失败——所以新模板必须与样张同批提交。
- **先看效果**：`npm run gallery` 打开 `template-gallery.html`，同一模板可换多张照片对比后再回填 `$MAP`。

## 六、下一步

1. 从第 1 批里确认**具体哪几套**要落地（逐套给自有命名/desc/参数）；
2. 在 `src/composables/useTemplates.ts` 的 `BUILTIN` 里追加（自有 id/参数，不复制竞品几何数值）；
3. 每套配一张用户照片作样张（`scripts/gen-template-samples.ps1` 的 `$MAP`）→ 生成 `src/assets/template-samples/<id>.jpg`；
4. 跑测试 + 画廊核验 + 桌面端逐组目视。
