import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

lvl = data['levels'][2]
tiles = lvl['tiles']

print("Level 3 tile grid (X=44..63, Y=51..63):")
for y in range(51, 64):
    row = [tiles[y*64 + x] for x in range(44, 64)]
    print(f"Y={y:2d}: " + " ".join(f"{t:2d}" for t in row))
