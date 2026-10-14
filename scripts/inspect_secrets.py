import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

def inspect_area(lvl_idx, cx, cy, radius=5):
    lvl = data['levels'][lvl_idx]
    tiles = lvl['tiles']
    print(f"=== Level {lvl_idx+1} around ({cx}, {cy}) ===")
    for y in range(max(0, cy - radius), min(64, cy + radius + 1)):
        row = [tiles[y*64 + x] for x in range(max(0, cx - radius), min(64, cx + radius + 1))]
        print(f"Y={y:2d}: " + " ".join(f"{t:2d}" for t in row))

inspect_area(5, 62, 60, radius=4) # Level 6 exit to Level 11
inspect_area(7, 12, 53, radius=4) # Level 8 exit to Level 14
inspect_area(8, 50, 61, radius=4) # Level 9 exit to Level 15
inspect_area(9, 14, 44, radius=4) # Level 10 True exit to Level 16
