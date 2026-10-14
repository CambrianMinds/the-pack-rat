import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

lvl = data['levels'][3]
tiles = lvl['tiles']

print("Level 4 tile grid (X=0..24, Y=55..63):")
for y in range(55, 64):
    row = [tiles[y*64 + x] for x in range(0, 25)]
    print(f"Y={y:2d}: " + " ".join(f"{t:2d}" for t in row))
