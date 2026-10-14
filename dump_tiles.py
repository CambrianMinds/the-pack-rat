import json
from PIL import Image

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

pal = data['palette']
for tid, t in data['tiles'].items():
    w, h = t['w'], t['h']
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    for idx, c in enumerate(t['pixels']):
        if c != 0:
            rgb = pal[c]
            px[idx % w, idx // w] = (rgb[0], rgb[1], rgb[2], 255)
    img.resize((w*8, h*8), Image.NEAREST).save(f"tile_{tid}.png")
print("Saved all tiles as tile_<tid>.png")
