# 生成「白底 + 圆角」A+Z 应用图标集
import os
from PIL import Image, ImageDraw

SRC = r"c:\Users\Administrator\.trae-cn\attachments\6a9a21a234c6e6c11897414c/a12509b0-5c97-4b25-940d-5cc5e194f8aa_9a4556fb-f855-468e-a567-087af78c3c8a_a3d183fa24d20b5fb9faa534f5bb9649.jpg"
ICONS = r"d:\A\FrameLab\src-tauri\icons"
ROOT_ICON = r"d:\A\FrameLab\app-icon.png"

base = Image.open(SRC).convert("RGBA")

# 强制纯白背景
d = base.load()
for y in range(base.height):
    for x in range(base.width):
        r, g, b, a = d[x, y]
        if a < 10 or (r > 235 and g > 235 and b > 235):
            d[x, y] = (255, 255, 255, 255)
print("背景纯白")

def rounded(size, radius_ratio=0.22):
    """白底圆角方形，圆角外透明"""
    im = base.resize((size, size), Image.LANCZOS).convert("RGBA")
    radius = int(size * radius_ratio)
    mask = Image.new("L", (size, size), 0)
    dr = ImageDraw.Draw(mask)
    dr.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

def save_png(size, path):
    rounded(size).save(path, "PNG")
    print("PNG", size, path)

save_png(32, os.path.join(ICONS, "32x32.png"))
save_png(64, os.path.join(ICONS, "64x64.png"))
save_png(128, os.path.join(ICONS, "128x128.png"))
save_png(256, os.path.join(ICONS, "128x128@2x.png"))
save_png(512, os.path.join(ICONS, "icon.png"))
rounded(512).save(ROOT_ICON, "PNG")
print("PNG 512 app-icon.png（圆角）")

# ICO 用圆角方形（Windows 自带对 ICO 的处理，保持圆角视觉）
img256 = rounded(256)
img256.save(
    os.path.join(ICONS, "icon.ico"),
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("ICO 多尺寸（圆角）")
print("DONE")