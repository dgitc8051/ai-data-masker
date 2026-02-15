#!/usr/bin/env python3
"""Generate LINE Rich Menu image with large icons and text."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 2500, 1686
COLS, ROWS = 3, 2
CELL_W, CELL_H = W // COLS, H // ROWS

# Create image with gradient-like dark background
img = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(img)

# Draw gradient background
for y in range(H):
    r = int(30 + (15 - 30) * y / H)
    g = int(58 + (36 - 58) * y / H)
    b = int(95 + (57 - 95) * y / H)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Cell definitions
cells = [
    ("🔧", "我要報修"),
    ("📋", "查詢進度"),
    ("📞", "聯絡客服"),
    ("🔐", "管理後台"),
    ("🛠️", "服務介紹"),
    ("💰", "收費標準"),
]

# Try to find a good font
font_paths = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]

text_font = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            text_font = ImageFont.truetype(fp, 90)
            break
        except:
            continue

if text_font is None:
    text_font = ImageFont.load_default()

# Emoji/icon font - try Apple Color Emoji
emoji_font = None
emoji_paths = [
    "/System/Library/Fonts/Apple Color Emoji.ttc",
]
for fp in emoji_paths:
    if os.path.exists(fp):
        try:
            emoji_font = ImageFont.truetype(fp, 240)
            break
        except:
            continue

# Draw cells
for i, (icon, text) in enumerate(cells):
    col = i % COLS
    row = i // COLS
    x = col * CELL_W
    y = row * CELL_H
    cx = x + CELL_W // 2
    cy = y + CELL_H // 2

    # Subtle cell background
    for dy in range(CELL_H - 4):
        alpha = int(12 + 4 * dy / CELL_H)
        draw.line([(x + 2, y + 2 + dy), (x + CELL_W - 2, y + 2 + dy)],
                  fill=(30 + alpha, 58 + alpha, 95 + alpha))

    # Draw icon text (emoji) - centered, large
    if emoji_font:
        bbox = draw.textbbox((0, 0), icon, font=emoji_font)
        iw = bbox[2] - bbox[0]
        ih = bbox[3] - bbox[1]
        draw.text((cx - iw // 2, y + CELL_H * 0.18), icon, font=emoji_font, fill=(255, 255, 255))
    else:
        # Fallback: draw a circle with text abbreviation
        r = min(CELL_W, CELL_H) * 0.22
        draw.ellipse([cx - r, y + CELL_H * 0.15, cx + r, y + CELL_H * 0.15 + 2 * r],
                     fill=(79, 70, 229), outline=(255, 255, 255, 100), width=3)
        abbr_font = ImageFont.truetype(font_paths[0], 100) if os.path.exists(font_paths[0]) else text_font
        abbr = text[0]
        bbox = draw.textbbox((0, 0), abbr, font=abbr_font)
        aw = bbox[2] - bbox[0]
        ah = bbox[3] - bbox[1]
        draw.text((cx - aw // 2, y + CELL_H * 0.15 + r - ah // 2), abbr,
                  font=abbr_font, fill=(255, 255, 255))

    # Draw text label
    large_text_font = ImageFont.truetype(font_paths[0], 90) if os.path.exists(font_paths[0]) else text_font
    bbox = draw.textbbox((0, 0), text, font=large_text_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw // 2, y + CELL_H * 0.72), text,
              font=large_text_font, fill=(255, 255, 255))

# Grid lines
line_color = (255, 255, 255, 40)
# Need RGBA for alpha
overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
overlay_draw = ImageDraw.Draw(overlay)
for c in range(1, COLS):
    overlay_draw.line([(c * CELL_W, 0), (c * CELL_W, H)], fill=(255, 255, 255, 40), width=2)
overlay_draw.line([(0, CELL_H), (W, CELL_H)], fill=(255, 255, 255, 40), width=2)

# Composite
img = img.convert('RGBA')
img = Image.alpha_composite(img, overlay)
img = img.convert('RGB')

output = '/Users/yan/Sites/Demo/my-project/storage/rich_menu.png'
img.save(output, 'PNG')
print(f"✅ Saved to {output}")
print(f"   Size: {os.path.getsize(output)} bytes")
