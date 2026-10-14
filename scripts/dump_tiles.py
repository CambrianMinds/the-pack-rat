import json
import os
from PIL import Image

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, '..')) if os.path.basename(script_dir) == 'scripts' else script_dir
assets_path = os.path.join(root_dir, 'assets.js')
tiles_dir = os.path.join(root_dir, 'tiles')
os.makedirs(tiles_dir, exist_ok=True)

with open(assets_path, 'r', encoding='utf-8') as f:
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
    out_file = os.path.join(tiles_dir, f"tile_{tid}.png")
    img.resize((w*8, h*8), Image.NEAREST).save(out_file)
print(f"Saved all tiles as {tiles_dir}/tile_<tid>.png")
