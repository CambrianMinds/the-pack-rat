import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

for i in range(len(data['levels'])):
    lvl = data['levels'][i]
    tiles = lvl['tiles']
    dest = lvl.get('destMap', [])
    # find where tile == 15 (mouse hole with sign) or 11..14 (mouse hole with eyes)
    holes_15 = [(x, y, dest[y*64+x] if dest else None) for y in range(64) for x in range(64) if tiles[y*64+x] == 15]
    holes_eyes = [(x, y, dest[y*64+x] if dest else None) for y in range(64) for x in range(64) if 11 <= tiles[y*64+x] <= 14]
    fake_tiles = [(x, y, tiles[y*64+x]) for y in range(64) for x in range(64) if tiles[y*64+x] >= 36]
    print(f"Level {i+1} (idx {i}):")
    print(f"  Start: ({lvl['startX']}, {lvl['startY']})")
    print(f"  Holes (Tile 15): {holes_15}")
    if holes_eyes:
        print(f"  Eye holes (11..14): {holes_eyes[:5]}")
    print(f"  Fake tiles (>=36): count={len(fake_tiles)}, types={set(t[2] for t in fake_tiles)}")
