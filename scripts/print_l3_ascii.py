import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

lvl = data['levels'][2]
tiles = lvl['tiles']

print("Level 3: Full Fortress (X=44..63, Y=48..63):")
print("    " + "".join(f"{x%10}" for x in range(44, 64)))
for y in range(48, 64):
    chars = []
    for x in range(44, 64):
        t = tiles[y*64 + x]
        if t == 0: chars.append(' ')      # air
        elif t == 1: chars.append('#')    # solid brick
        elif t == 37: chars.append('.')   # FAKE BRICK (WALKABLE!)
        elif t == 15: chars.append('E')   # Exit hole
        elif t == 35: chars.append('$')   # Cheese
        else: chars.append('?')
    print(f"Y={y:2d}: " + "".join(chars))
