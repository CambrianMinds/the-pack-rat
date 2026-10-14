import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

lvl = data['levels'][9]
tiles = lvl['tiles']

print("Level 10: True Exit (X=8..24, Y=40..49):")
print("    " + "".join(f"{x%10}" for x in range(8, 25)))
for y in range(40, 50):
    chars = []
    for x in range(8, 25):
        t = tiles[y*64 + x]
        if t == 0: chars.append(' ')      # air
        elif t == 1: chars.append('#')    # solid brick
        elif t == 15: chars.append('E')   # TRUE EXIT!
        elif t == 35: chars.append('$')   # Cheese
        elif t == 24: chars.append('B')   # Bulb
        elif 25 <= t <= 30: chars.append('~') # wire
        else: chars.append('?')
    print(f"Y={y:2d}: " + "".join(chars))
