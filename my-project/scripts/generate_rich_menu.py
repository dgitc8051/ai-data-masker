#!/usr/bin/env python3
"""Generate LINE Rich Menu image matching homepage card-based design."""
from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 2500, 1686
COLS, ROWS = 3, 2
CELL_W, CELL_H = W // COLS, H // ROWS
PAD = 20  # padding between cells

# Cell definitions: abbreviation, label, description, color
cells = [
    ("我", "用戶報修", "線上填寫維修需求", "#ef4444"),
    ("查", "維修進度", "查詢工單處理狀態", "#3b82f6"),
    ("聯", "聯絡我們", "電話·地址·營業時間", "#10b981"),
    ("管", "內部登入", "員工管理系統入口", "#8b5cf6"),
    ("服", "服務項目", "專業維修服務一覽", "#f59e0b"),
    ("收", "費用參考", "檢測費·維修行情", "#6366f1"),
]

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# Create the image
img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Background: dark gradient
bg = Image.new('RGB', (W, H))
bg_draw = ImageDraw.Draw(bg)
for y in range(H):
    frac = y / H
    r = int(26 * (1 - frac) + 15 * frac)
    g = int(26 * (1 - frac) + 33 * frac)
    b = int(46 * (1 - frac) + 62 * frac)
    bg_draw.line([(0, y), (W, y)], fill=(r, g, b))

# Convert to RGBA
bg = bg.convert('RGBA')

# Find fonts
font_paths = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]
font_path = None
for fp in font_paths:
    if os.path.exists(fp):
        font_path = fp
        break

# Font sizes
abbr_font = ImageFont.truetype(font_path, 120) if font_path else ImageFont.load_default()
label_font = ImageFont.truetype(font_path, 72) if font_path else ImageFont.load_default()
desc_font = ImageFont.truetype(font_path, 42) if font_path else ImageFont.load_default()

# Draw cells
for i, (abbr, label, desc, color_hex) in enumerate(cells):
    col = i % COLS
    row = i // COLS
    
    # Cell position with padding
    x = col * CELL_W + PAD
    y = row * CELL_H + PAD
    cw = CELL_W - PAD * 2
    ch = CELL_H - PAD * 2
    cx = x + cw // 2
    
    # Card background (rounded rectangle with semi-transparent white)
    card_img = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card_img)
    
    # Rounded rectangle for card
    radius = 40
    card_draw.rounded_rectangle(
        [0, 0, cw, ch],
        radius=radius,
        fill=(255, 255, 255, 18),
        outline=(255, 255, 255, 30),
        width=2
    )
    
    # Icon circle (colored background with abbreviation text)
    color_rgb = hex_to_rgb(color_hex)
    circle_r = 90  # radius
    circle_cx = cw // 2
    circle_cy = int(ch * 0.32)
    
    # Draw colored circle
    card_draw.ellipse(
        [circle_cx - circle_r, circle_cy - circle_r,
         circle_cx + circle_r, circle_cy + circle_r],
        fill=(*color_rgb, 230),
    )
    
    # Abbreviation text centered in circle
    bbox = card_draw.textbbox((0, 0), abbr, font=abbr_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    card_draw.text(
        (circle_cx - tw // 2, circle_cy - th // 2 - 8),
        abbr, font=abbr_font, fill=(255, 255, 255, 255)
    )
    
    # Label text (white, bold)
    bbox = card_draw.textbbox((0, 0), label, font=label_font)
    tw = bbox[2] - bbox[0]
    label_y = int(ch * 0.58)
    card_draw.text(
        (circle_cx - tw // 2, label_y),
        label, font=label_font, fill=(255, 255, 255, 255)
    )
    
    # Description text (light gray)
    bbox = card_draw.textbbox((0, 0), desc, font=desc_font)
    tw = bbox[2] - bbox[0]
    desc_y = label_y + 85
    card_draw.text(
        (circle_cx - tw // 2, desc_y),
        desc, font=desc_font, fill=(255, 255, 255, 110)
    )
    
    # Paste card onto background
    bg.paste(card_img, (x, y), card_img)

# Convert and save
result = bg.convert('RGB')
output = '/Users/yan/Sites/Demo/my-project/storage/rich_menu.png'
result.save(output, 'PNG', quality=95)
print(f"✅ Rich menu saved to {output}")
print(f"   Size: {W}x{H}, {os.path.getsize(output)} bytes")
