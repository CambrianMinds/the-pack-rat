import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

lvl = data['levels'][0]
tiles = lvl['tiles']

print("Level 1 tile grid (X=0..13, Y=35..48):")
for y in range(35, 49):
    row = [tiles[y*64 + x] for x in range(0, 14)]
    print(f"Y={y:2d}: " + " ".join(f"{t:2d}" for t in row))
