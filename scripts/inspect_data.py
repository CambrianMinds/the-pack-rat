import json

with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
data = json.loads(raw[raw.index('{'):raw.rindex('}')+1])

print("Keys in lvl 0:", list(data['levels'][0].keys()))
for i, lvl in enumerate(data['levels']):
    used = set(lvl['tiles'])
    illusions = sorted([t for t in used if t >= 36])
    print(f"Level idx {i} (Level {i+1}): start=({lvl['startX']}, {lvl['startY']}), illusions={illusions}")
