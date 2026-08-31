# 手机品牌白底水印设计（Phone Card Watermark）

> 日期：2026-08-31
> 状态：设计已获用户批准（路线 B：复刻各厂白底水印，12 家品牌）
> 范围：INFO 层新增 card 布局 + PHONE_BRANDS 表 + EXIF 手机品牌识别 + UI

---

## 一、背景

用户需要为手机照片添加各厂商风格的拍照水印。调研结论（2026-08 网络调研）：

- 小米引领"白底水印"：左侧机型字样 + 右侧参数（焦距/光圈/快门/ISO）+ 徕卡红标块，黑白双色可选
- 华为 XMAGE 红标 / vivo 蔡司蓝标 / OPPO·一加哈苏标 / 荣耀·三星·iQOO 等无联名纯机型+参数
- 共性构成：品牌 Logo + 影像联名标 + 机型 + 拍摄参数 + 时间
- iPhone 无原生水印，本工具可补足（Shot on iPhone 式）

**决策**：复刻"白底卡"排版（路线 B），12 家手机品牌全覆盖；联名标统一**色块+文字自绘**（延续零版权策略）；无联名的品牌仅机型+参数。

## 二、品牌配置表（PHONE_BRANDS，12 家）

| id | logoText | 名称 | accent（近似品牌色） | 标块（badge） |
|---|---|---|---|---|
| huawei | HUAWEI | 华为 | `#C7000B` | XMAGE（白字） |
| xiaomi | XIAOMI | 小米 | `#FF6900` | LEICA（白字，标块底色=徕卡红 `#E20612`） |
| iphone | iPhone | 苹果 | `#1D1D1F` | 无 |
| samsung | SAMSUNG | 三星 | `#1428A0` | 无 |
| oppo | OPPO | OPPO | `#006B54` | HASSELBLAD（橙字 `#F7941D`，黑底） |
| oneplus | OnePlus | 一加 | `#EB0028` | HASSELBLAD（同上） |
| vivo | vivo | vivo | `#415FFF` | ZEISS（白字，蓝底 `#0064C8`） |
| iqoo | iQOO | iQOO | `#FF5000` | 无 |
| honor | HONOR | 荣耀 | `#00A0E9` | 无 |
| redmi | Redmi | 红米 | `#FF6900` | 无 |
| realme | realme | 真我 | `#E8B800` | 无 |
| meizu | MEIZU | 魅族 | `#000000` | 无 |

说明：标块底色缺省 = accent；badge 字段 `{ text: string | null, bg?: string, fg?: string }`。

## 三、排版（card 模式，对标小米标准徕卡水印）

- 位置：画在**边框底部留白条**内（与现有 INFO 层同区域，画布尺寸不变，不破坏现有布局与导出公式）
- 结构：通栏白底（或黑底）圆角矩形卡，卡高自适应内容，内边距按 unitScale 缩放：

```
┌──────────────────────────────────────────────┐
│ XIAOMI 14 Ultra              24mm f/1.6      │
│ 2026.08.31 · 12:00          1/120s ISO100  ▐LEICA▌ │
└──────────────────────────────────────────────┘
```

- 左列：机型（粗体，主题反色）+ 日期时间（小字，可关）
- 右列：EXIF 参数两行（焦距/光圈/快门/ISO），右对齐
- 右端：标块（有联名的品牌显示，色块高度=卡内高）
- 卡底色：`white`（默认）/ `black` 两档，文字/参数颜色随主题反转（白卡深字 / 黑卡浅字）
- 预览（FooterInfo）与导出（exporter）共用同一布局计算与绘制参数

## 四、架构落地

### 4.1 数据
- `core/constants.ts`：新增 `PHONE_BRANDS: PhoneBrand[]`（表见二）；`PhoneBrand { id, name, logoText, accent, badge }`
- `core/types.ts`：`infoLayout` 类型扩为 `'classic' | 'duo' | 'inline' | 'card'`；新增 `infoCardTheme: 'white' | 'black'`、`cardShowDate: boolean`（默认 true）

### 4.2 布局与绘制
- `core/infoLayout.ts`：新增 `computeCardLayout(...)`——返回卡片矩形、左右两列文本位置、标块矩形（复用现有字号/间距度量约定）
- `core/infoRenderer.ts`：card 分支绘制（圆角矩形 + 文本 + 色块），主题色由 `infoCardTheme` 决定
- `core/exporter.ts` 的 `drawFooter`：`infoLayout === 'card'` 时走 card 绘制；机型文本取 `cameraModel`，参数取 `exifText`，时间取 `dateText`

### 4.3 EXIF 手机品牌识别（useExif）
- `EXIF.Make` 归一化映射：`Apple→iphone`、`HUAWEI/Honor→huawei/honor`、`Xiaomi→xiaomi`、`Redmi/Redmi→redmi`、`samsung/SM-→samsung`、`OPPO→oppo`、`OnePlus→oneplus`、`vivo/iQOO→vivo/iqoo`、`realme→realme`、`Meizu→meizu`
- 机型 = `EXIF.Model` 原文（如 "Xiaomi 14 Ultra"、"iPhone 15 Pro"、"HUAWEI Mate 60 Pro"）
- 无 Make 的照片回退手动选择

### 4.4 UI（InfoLayerPanel）
- INFO 布局选择器新增「白底卡」选项
- 品牌下拉新增「手机」分区（12 家，logoText 文字渲染）
- card 模式专属控件：卡片底色（白/黑）、显示日期开关
- `useLogoStore`：手机品牌 Logo 用文字标记渲染（`renderTextLogo` 机制复用，logoText 取 PHONE_BRANDS.logoText）

## 五、测试

- `infoLayout` card 计算单测：左右列定位/标块矩形/自适应卡高
- `useExif` Make 映射单测：各厂商 Make 字符串 → 品牌 id；未知 Make → null
- 手动验收：导入 iPhone/小米/华为实拍图 → 识别品牌与机型 → 白底卡预览与导出一致（导出后色差/位置核对）

## 六、双端同步

完成后按约定覆盖 frame 的 src/（frame 无 Tauri 改动），两侧构建 + vitest 验证。

## 七、明确不做

- 官方 Logo 图形复刻（版权）；厂商限定相框/节日水印/胶片样式；画布增高式水印（仅画在留白条内）
