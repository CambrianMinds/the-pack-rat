with open('game.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for func in ['isTileHazard', 'isTileWallSolid', 'isTileMovable', 'isTileBauble', 'getDestAt']:
    m = re.search(r'function\s+' + func + r'[^\{]*\{[^\}]*\}', text)
    if m:
        print(m.group(0))
        print('-'*40)
