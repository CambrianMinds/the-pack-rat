from PIL import Image, ImageDraw, ImageFont
import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])
pal = data['palette']

# 6 columns, 6 rows (0..35)
TILE_W, TILE_H = 16, 16
CELL_W, CELL_H = 80, 80
cols, rows = 6, 6
sheet = Image.new('RGB', (cols * CELL_W, rows * CELL_H), (20, 24, 32))
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 12)

for tid in range(36):
    r = tid // cols
    c = tid % cols
    x0 = c * CELL_W
    y0 = r * CELL_H
    
    # draw border
    draw.rectangle([x0, y0, x0 + CELL_W - 1, y0 + CELL_H - 1], outline=(50, 60, 80))
    draw.text((x0 + 4, y0 + 4), f"ID: {tid}", font=font, fill=(255, 255, 255))
    
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
        # upscale 2x
        timg_scaled = timg.resize((w * 2, h * 2), Image.NEAREST)
        sheet.paste(timg_scaled, (x0 + 24, y0 + 24), timg_scaled)

sheet.save('all_tiles_sheet.png')
print("Saved all_tiles_sheet.png")
