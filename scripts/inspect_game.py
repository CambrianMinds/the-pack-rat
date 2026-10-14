import sys

with open('game.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'completeLevel(nextLvl)' in line:
        for j in range(max(0, i - 40), min(len(lines), i + 35)):
            sys.stdout.buffer.write(f"{j+1}: {lines[j]}".encode('utf-8'))
