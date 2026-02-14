#!/usr/bin/env python3
"""生成 LINE Rich Menu 圖片 (2500x1686, 3x2 六宮格)，用幾何圖形當 icon"""
from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 2500, 1686
COLS, ROWS = 3, 2
CW, CH = W // COLS, H // ROWS
GAP = 16
R = 28
WHITE = (255, 255, 255)
DIM = (255, 255, 255, 180)

cells = [
    "我要報修",   # 扳手
    "查詢進度",   # 清單
    "聯絡客服",   # 電話
    "管理後台",   # 人像
    "服務介紹",   # 齒輪
    "收費標準",   # 錢幣
]

# 字體
for fp in ["/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/STHeiti Medium.ttc"]:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 64)
            break
        except:
            continue
if not font:
    font = ImageFont.load_default()

img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
draw = ImageDraw.Draw(img)

# 漸層背景
for y in range(H):
    t = y / H
    draw.line([(0, y), (W, y)], fill=(int(18+t*8), int(30+t*12), int(60+t*25), 255))


def draw_wrench(d, cx, cy, s):
    """扳手 icon"""
    d.line([(cx-s, cy-s), (cx+s, cy+s)], fill=WHITE, width=8)
    d.ellipse([(cx+s-14, cy+s-14), (cx+s+14, cy+s+14)], outline=WHITE, width=4)
    d.rectangle([(cx-s-8, cy-s-18), (cx-s+8, cy-s+2)], fill=WHITE)

def draw_clipboard(d, cx, cy, s):
    """清單 icon"""
    d.rounded_rectangle([(cx-s+5, cy-s), (cx+s-5, cy+s)], radius=8, outline=WHITE, width=4)
    d.rectangle([(cx-12, cy-s-8), (cx+12, cy-s+4)], fill=WHITE)
    for i in range(3):
        yy = cy - s + 22 + i * 20
        d.line([(cx-s+18, yy), (cx+s-18, yy)], fill=DIM, width=3)

def draw_phone(d, cx, cy, s):
    """電話 icon"""
    d.rounded_rectangle([(cx-s+8, cy-s+5), (cx+s-8, cy+s-5)], radius=12, outline=WHITE, width=5)
    d.arc([(cx-20, cy-s+10), (cx+20, cy-s+30)], 200, 340, fill=WHITE, width=4)
    d.ellipse([(cx-6, cy+s-22), (cx+6, cy+s-10)], fill=WHITE)

def draw_person(d, cx, cy, s):
    """人像 icon"""
    d.ellipse([(cx-16, cy-s), (cx+16, cy-s+32)], fill=WHITE)
    d.arc([(cx-s+10, cy-5), (cx+s-10, cy+s)], 200, 340, fill=WHITE, width=6)

def draw_gear(d, cx, cy, s):
    """齒輪 icon"""
    d.ellipse([(cx-s+10, cy-s+10), (cx+s-10, cy+s-10)], outline=WHITE, width=5)
    d.ellipse([(cx-12, cy-12), (cx+12, cy+12)], fill=WHITE)
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        x1 = cx + int((s-5) * math.cos(rad))
        y1 = cy + int((s-5) * math.sin(rad))
        d.ellipse([(x1-6, y1-6), (x1+6, y1+6)], fill=WHITE)

def draw_dollar(d, cx, cy, s):
    """錢幣 icon"""
    d.ellipse([(cx-s, cy-s), (cx+s, cy+s)], outline=WHITE, width=5)
    # $ sign
    d.line([(cx, cy-s+8), (cx, cy+s-8)], fill=WHITE, width=4)
    d.arc([(cx-18, cy-20), (cx+18, cy)], 180, 0, fill=WHITE, width=5)
    d.arc([(cx-18, cy), (cx+18, cy+20)], 0, 180, fill=WHITE, width=5)

icon_funcs = [draw_wrench, draw_clipboard, draw_phone, draw_person, draw_gear, draw_dollar]

for idx, label in enumerate(cells):
    col = idx % COLS
    row = idx // COLS
    x0 = col * CW + GAP
    y0 = row * CH + GAP
    x1 = (col + 1) * CW - GAP
    y1 = (row + 1) * CH - GAP
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2

    # 玻璃卡
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ov = ImageDraw.Draw(overlay)
    ov.rounded_rectangle([(x0, y0), (x1, y1)], radius=R, fill=(255, 255, 255, 25))
    ov.rounded_rectangle([(x0, y0), (x1, y1)], radius=R, outline=(255, 255, 255, 45), width=2)
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    # icon (在上方，加大)
    iy = cy - 60
    icon_funcs[idx](draw, cx, iy, 60)

    # 文字 (在下方)
    bbox = draw.textbbox((0, 0), label, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw // 2, cy + 45), label, fill=WHITE, font=font)

out = img.convert('RGB')
path = os.path.join(os.path.dirname(__file__), '..', 'storage', 'rich_menu.png')
out.save(path, 'PNG')
print(f"✅ 已儲存: {path} ({out.size})")
