import json

with open('assets.js') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])
pal = data['palette']
tiles = data['tiles']

for tid in range(36):
    t = tiles.get(str(tid))
    if t:
        w, h = t['w'], t['h']
        non_zero = [c for c in t['pixels'] if c != 0]
        distinct_colors = set(non_zero)
        # Sample color names/rgb
        rgbs = [pal[c] for c in distinct_colors][:3]
        print(f"Tile {tid:2d} ({w:2d}x{h:2d}): {len(non_zero):4d} non-zero px, sample RGBs: {rgbs}")
