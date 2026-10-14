from PIL import Image, ImageDraw, ImageFont
import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])
pal = data['palette']

# 8 columns, 8 rows (0..63)
TILE_W, TILE_H = 16, 16
CELL_W, CELL_H = 80, 80
cols, rows = 8, 8
sheet = Image.new('RGB', (cols * CELL_W, rows * CELL_H), (20, 24, 32))
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 12)

for tid in range(64):
    r = tid // cols
    c = tid % cols
    x0 = c * CELL_W
    y0 = r * CELL_H
    
    # draw border
    draw.rectangle([x0, y0, x0 + CELL_W - 1, y0 + CELL_H - 1], outline=(50, 60, 80))
    label = f"ID: {tid}"
    if tid in [2,3,4,5,6,7,8,9]: label += " Water"
    elif tid in [11,12,13,14]: label += " Lair"
    elif tid == 15: label += " Exit"
    elif tid in [18,19]: label += " Wire"
    elif tid in [20,21,22]: label += " Trap"
    elif tid in [56,57,58,59]: label += " Enemy"
    elif tid in [60,61]: label += " Spark"
    draw.text((x0 + 4, y0 + 4), label, font=font, fill=(255, 255, 255))
    
    tid_str = str(tid)
    if tid_str in data['tiles'] and tid != 0:
        t = data['tiles'][tid_str]
        w, h = t['w'], t['h']
        timg = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        px = timg.load()
        for idx, col in enumerate(t['pixels']):
            if col != 0:
                rgb = pal[col]
                px[idx % w, idx // w] = (rgb[0], rgb[1], rgb[2], 255)
        # upscale 2x or fit in cell
        scale = 2 if (w <= 32 and h <= 32) else 1
        timg_scaled = timg.resize((w * scale, h * scale), Image.NEAREST)
        sheet.paste(timg_scaled, (x0 + (CELL_W - w * scale) // 2, y0 + 22), timg_scaled)

sheet.save('all_tiles_sheet.png')
print("Saved all_tiles_sheet.png (8x8 grid with all 61 authentic tiles)")
