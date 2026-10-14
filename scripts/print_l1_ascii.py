import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

lvl = data['levels'][0]
tiles = lvl['tiles']

print("Level 1: Cheese Vault (X=0..13, Y=34..48):")
print("    " + "".join(f"{x%10}" for x in range(0, 14)))
for y in range(34, 49):
    chars = []
    for x in range(0, 14):
        t = tiles[y*64 + x]
        if t == 0: chars.append(' ')      # air
        elif t == 1: chars.append('#')    # solid brick
        elif t == 10: chars.append('S')   # stone block
        elif t == 2: chars.append('~')    # lethal water
        elif t == 38: chars.append('W')   # SAFE ILLUSION WATER
        elif t == 37: chars.append('.')   # FAKE BRICK
        elif t == 35: chars.append('$')   # Cheese
        else: chars.append('?')
    print(f"Y={y:2d}: " + "".join(chars))
