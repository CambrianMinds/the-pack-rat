import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

lvl = data['levels'][9]
tiles = lvl['tiles']

print("Level 10 tile grid (X=48..63, Y=18..30):")
for y in range(18, 31):
    row = [tiles[y*64 + x] for x in range(48, 64)]
    print(f"Y={y:2d}: " + " ".join(f"{t:2d}" for t in row))
