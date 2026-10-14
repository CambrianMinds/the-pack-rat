import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

lvl = data['levels'][3]
tiles = lvl['tiles']

print("Level 4: Secret Water Channel (X=0..24, Y=54..63):")
print("    " + "".join(f"{x%10}" for x in range(0, 25)))
for y in range(54, 64):
    chars = []
    for x in range(0, 25):
        t = tiles[y*64 + x]
        if t == 0: chars.append(' ')      # air
        elif t == 1: chars.append('#')    # solid brick
        elif t == 2: chars.append('~')    # lethal water
        elif t == 38: chars.append('W')   # SAFE ILLUSION WATER
        elif t == 15: chars.append('E')   # Exit hole
        elif t == 33: chars.append('G')   # Gold Coin
        else: chars.append('?')
    print(f"Y={y:2d}: " + "".join(chars))
