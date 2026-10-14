import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

lvl = data['levels'][9]
tiles = lvl['tiles']

print("Level 10: Decoy Trap (X=48..63, Y=18..31):")
print("    " + "".join(f"{x%10}" for x in range(48, 64)))
for y in range(18, 32):
    chars = []
    for x in range(48, 64):
        t = tiles[y*64 + x]
        if t == 0: chars.append(' ')      # air
        elif t == 1: chars.append('#')    # solid brick
        elif t == 18: chars.append('T')   # ARMED MOUSETRAP!
        elif t == 51: chars.append('D')   # DECOY MOUSE HOLE!
        elif t == 37: chars.append('.')   # FAKE BRICK FLOOR!
        elif t == 34: chars.append('C')   # Cookie
        elif t == 15: chars.append('E')   # Exit hole
        else: chars.append('?')
    print(f"Y={y:2d}: " + "".join(chars))
