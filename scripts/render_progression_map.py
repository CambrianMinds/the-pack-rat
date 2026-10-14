import os
import math
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1560
HEIGHT = 920
img = Image.new('RGBA', (WIDTH, HEIGHT), (12, 16, 24, 255))
draw = ImageDraw.Draw(img)

font_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 24)
font_subtitle = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13)
font_node_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 14)
font_node_sub = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 11)
font_edge = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 10)
font_legend = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)

# Header
HEADER_H = 76
draw.rectangle([(0, 0), (WIDTH, HEADER_H)], fill=(18, 24, 36, 255))
draw.line([(0, HEADER_H - 1), (WIDTH, HEADER_H - 1)], fill=(0, 229, 255, 180), width=2)
draw.text((28, 12), "THE PACK RAT (1992) — MASTER LEVEL PROGRESSION CHEAT SHEET", font=font_title, fill=(255, 208, 40, 255))
draw.text((30, 44), "1-Indexed World Map: 10 Campaign Stages, 5 Secret Stages & Level 16 Finale", font=font_subtitle, fill=(150, 175, 205, 255))

legends = [
    ("Main Campaign Stages", (18, 28, 44, 255), (0, 229, 255, 255)),
    ("Secret Bonus Stages", (48, 18, 34, 255), (255, 42, 122, 255)),
    ("Finale Chamber (L16)", (48, 38, 14, 255), (255, 208, 40, 255))
]
lx = 960
for l_text, fill_c, stroke_c in legends:
    draw.rounded_rectangle([(lx, 26), (lx + 16, 42)], radius=3, fill=fill_c, outline=stroke_c, width=2)
    draw.text((lx + 22, 26), l_text, font=font_legend, fill=(220, 230, 245, 255))
    lx += 185

NODE_W = 195
NODE_H = 50

nodes = {
    'L1':  {'title': 'LEVEL 1',  'sub': 'Start (3, 62) | Vault',     'x': 60,   'y': 110, 'type': 'main'},
    'L2':  {'title': 'LEVEL 2',  'sub': 'Start (40, 62) | High Climb', 'x': 60,   'y': 220, 'type': 'main'},
    'L3':  {'title': 'LEVEL 3',  'sub': 'Start (1, 3) | Fortress',    'x': 60,   'y': 340, 'type': 'main'},
    'L4':  {'title': 'LEVEL 4',  'sub': 'Branch Hub (4 Exits)',        'x': 60,   'y': 520, 'type': 'main'},
    
    'L5':  {'title': 'LEVEL 5',  'sub': 'Ice Block Puzzles',          'x': 430,  'y': 340, 'type': 'main'},
    'L6':  {'title': 'LEVEL 6',  'sub': 'Multi-Tier Hub',             'x': 430,  'y': 520, 'type': 'main'},
    'L7':  {'title': 'LEVEL 7',  'sub': 'Gold Coin Chamber',          'x': 430,  'y': 700, 'type': 'main'},
    
    'L8':  {'title': 'LEVEL 8',  'sub': 'Ceiling Puzzles',            'x': 800,  'y': 340, 'type': 'main'},
    'L9':  {'title': 'LEVEL 9',  'sub': 'Hub Stage (4 Exits)',        'x': 800,  'y': 520, 'type': 'main'},
    'L10': {'title': 'LEVEL 10', 'sub': 'Decoy Trap Chamber',         'x': 800,  'y': 680, 'type': 'main'},
    'L16': {'title': 'LEVEL 16 (FINALE)', 'sub': 'Steve Blanding Victory', 'x': 800,  'y': 800, 'type': 'finale'},
    
    'S12': {'title': 'SECRET LEVEL 12', 'sub': 'From L3 Maze -> Loops to L4',  'x': 1200, 'y': 220, 'type': 'secret'},
    'S13': {'title': 'SECRET LEVEL 13', 'sub': 'From L4 Water -> Loops to L5', 'x': 1200, 'y': 350, 'type': 'secret'},
    'S11': {'title': 'SECRET LEVEL 11', 'sub': 'From L6 Secret -> Loops to L9', 'x': 1200, 'y': 480, 'type': 'secret'},
    'S14': {'title': 'SECRET LEVEL 14', 'sub': 'From L8 Secret -> Loops to L7', 'x': 1200, 'y': 610, 'type': 'secret'},
    'S15': {'title': 'SECRET LEVEL 15', 'sub': 'From L9 Secret -> Loops to L10','x': 1200, 'y': 740, 'type': 'secret'},
}

for nid, n in nodes.items():
    n['cx'] = n['x'] + NODE_W // 2
    n['cy'] = n['y'] + NODE_H // 2

# 1. Draw Nodes FIRST
for nid, n in nodes.items():
    nx, ny = n['x'], n['y']
    ntype = n['type']
    
    if ntype == 'main':
        bg = (18, 28, 44, 255)
        border = (0, 229, 255, 255)
        t_col = (0, 229, 255, 255)
    elif ntype == 'secret':
        bg = (48, 18, 34, 255)
        border = (255, 42, 122, 255)
        t_col = (255, 42, 122, 255)
    else:
        bg = (48, 38, 14, 255)
        border = (255, 208, 40, 255)
        t_col = (255, 208, 40, 255)
        
    draw.rounded_rectangle([(nx + 2, ny + 2), (nx + NODE_W + 2, ny + NODE_H + 2)], radius=6, fill=(0, 0, 0, 160))
    draw.rounded_rectangle([(nx, ny), (nx + NODE_W, ny + NODE_H)], radius=6, fill=bg, outline=border, width=2)
    
    draw.text((nx + 12, ny + 7), n['title'], font=font_node_title, fill=t_col)
    draw.text((nx + 12, ny + 27), n['sub'], font=font_node_sub, fill=(200, 215, 235, 255))

# 2. Draw Edges with offsets
edges = [
    # Spine L1 -> L2 -> L3 -> L4
    ('L1', 'L2', 'Hole (58, 14)', (0, 229, 255), lambda s, d: ((s['cx'], s['y'] + NODE_H), (d['cx'], d['y']))),
    ('L2', 'L3', 'Hole (0, 7)', (0, 229, 255), lambda s, d: ((s['cx'], s['y'] + NODE_H), (d['cx'], d['y']))),
    ('L3', 'L4', 'Normal Exit (46, 61)', (0, 229, 255), lambda s, d: ((s['cx'], s['y'] + NODE_H), (d['cx'], d['y']))),
    
    # L4 Exits
    ('L4', 'L5', 'Upper Exit (62, 11)', (0, 229, 255), lambda s, d: ((s['x'] + NODE_W, s['y'] + 10), (d['x'], d['cy']))),
    ('L4', 'L6', 'Mid Exit (62, 17)', (0, 229, 255), lambda s, d: ((s['x'] + NODE_W, s['cy']), (d['x'], d['cy']))),
    ('L4', 'L7', 'Bottom Exit (61, 60)', (0, 229, 255), lambda s, d: ((s['x'] + NODE_W, s['y'] + NODE_H - 10), (d['x'], d['cy']))),
    
    # L5 & L6 Branches
    ('L5', 'L8', 'Exit (42, 53)', (0, 229, 255), lambda s, d: ((s['x'] + NODE_W, s['cy']), (d['x'], d['cy']))),
    ('L6', 'L9', 'Upper Exit (62, 33)', (0, 229, 255), lambda s, d: ((s['x'] + NODE_W, s['cy'] - 12), (d['x'], d['cy'] - 12))),
    ('L6', 'L10', 'Mid Exit (30, 47)', (0, 229, 255), lambda s, d: ((s['x'] + NODE_W, s['y'] + NODE_H - 10), (d['x'], d['cy']))),
    
    # L7 Shortcut
    ('L7', 'L6', 'Shortcut (59, 55)', (140, 160, 200), lambda s, d: ((s['cx'] - 20, s['y']), (d['cx'] - 20, d['y'] + NODE_H))),
    
    # L8 & L9
    ('L8', 'L7', 'Exit A (29, 1)', (140, 160, 200), lambda s, d: ((s['x'], s['y'] + NODE_H), (d['x'] + NODE_W, d['cy'] - 10))),
    ('L8', 'L6', 'Exit B (32, 1)', (140, 160, 200), lambda s, d: ((s['x'], s['cy'] + 10), (d['x'] + NODE_W, d['cy'] - 15))),
    ('L9', 'L10', 'Exits (2, 0) & (62, 1)', (0, 229, 255), lambda s, d: ((s['cx'], s['y'] + NODE_H), (d['cx'], d['y']))),
    ('L9', 'L6', 'Shortcut (32, 0)', (140, 160, 200), lambda s, d: ((s['x'], s['cy'] + 12), (d['x'] + NODE_W, d['cy'] + 12))),
    
    # Finale
    ('L10', 'L16', 'TRUE PORTAL (14, 44)', (255, 208, 40), lambda s, d: ((s['cx'], s['y'] + NODE_H), (d['cx'], d['y']))),
    
    # Secrets to Col 3
    ('L3', 'S12', 'Secret Maze (62, 61)', (255, 42, 122), lambda s, d: ((s['x'] + NODE_W, s['y'] + 10), (d['x'], d['cy']))),
    ('L4', 'S13', 'Safe Water (0, 59)', (255, 42, 122), lambda s, d: ((s['x'] + NODE_W, s['y'] + 35), (d['x'], d['cy']))),
    ('L6', 'S11', 'Secret Exit (62, 60)', (255, 42, 122), lambda s, d: ((s['x'] + NODE_W, s['cy'] + 18), (d['x'], d['cy']))),
    ('L8', 'S14', 'Secret Exit (12, 53)', (255, 42, 122), lambda s, d: ((s['x'] + NODE_W, s['cy']), (d['x'], d['cy']))),
    ('L9', 'S15', 'Secret Exit (50, 61)', (255, 42, 122), lambda s, d: ((s['x'] + NODE_W, s['cy']), (d['x'], d['cy']))),
]

def draw_clean_arrow(p1, p2, label, color):
    draw.line([p1, p2], fill=color, width=2)
    angle = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    arrow_len = 8
    a1 = (p2[0] - arrow_len * math.cos(angle - math.pi / 6), p2[1] - arrow_len * math.sin(angle - math.pi / 6))
    a2 = (p2[0] - arrow_len * math.cos(angle + math.pi / 6), p2[1] - arrow_len * math.sin(angle + math.pi / 6))
    draw.polygon([p2, a1, a2], fill=color)
    
    if label:
        mx = (p1[0] + p2[0]) // 2
        my = (p1[1] + p2[1]) // 2
        bbox = draw.textbbox((0, 0), label, font=font_edge)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.rounded_rectangle([(mx - tw//2 - 4, my - th//2 - 3), (mx + tw//2 + 4, my + th//2 + 3)], radius=3, fill=(12, 16, 24, 250), outline=color, width=1)
        draw.text((mx - tw//2, my - th//2), label, font=font_edge, fill=(225, 235, 250, 255))

for src_id, dst_id, label, color, fn in edges:
    p1, p2 = fn(nodes[src_id], nodes[dst_id])
    draw_clean_arrow(p1, p2, label, color)

note_y = 860
draw.rounded_rectangle([(40, note_y), (WIDTH - 40, note_y + 36)], radius=6, fill=(16, 22, 32, 240), outline=(0, 229, 255, 90), width=1)
draw.text((54, note_y + 9), 
          "NOTE: In Level 10, decoy mouse holes at (25, 1), (61, 15), and (62, 61) loop back to Level 1. Only true portal (14, 44) advances to Level 16 Finale!", 
          font=font_subtitle, fill=(255, 208, 40, 255))

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, '..')) if os.path.basename(script_dir) == 'scripts' else script_dir

out_path = os.path.join(r"C:\Users\Justi\.gemini\antigravity-ide\brain\3f2c67b4-8685-4591-8c09-ce3f4590b7bf", "progression_map.png")
img.save(out_path)
img.save(os.path.join(root_dir, "progression_map.png"))
print("Saved perfect progression_map.png!")
