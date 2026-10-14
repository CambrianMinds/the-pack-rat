import json
from PIL import Image, ImageDraw, ImageFont

# Load authentic extracted game assets
with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
raw = raw[raw.index('{'):raw.rindex('}') + 1]
assets = json.loads(raw)

pal = assets['palette']
lvl0 = assets['levels'][0]
tiles_map = lvl0['tiles']
tile_defs = assets['tiles']
rat_frames = assets['ratFrames']

def get_tile_img(tid):
    tid_str = str(tid)
    if tid_str not in tile_defs:
        return None
    t = tile_defs[tid_str]
    w, h = t['w'], t['h']
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    for idx, c_idx in enumerate(t['pixels']):
        if c_idx != 0:
            rgb = pal[c_idx]
            px[idx % w, idx // w] = (rgb[0], rgb[1], rgb[2], 255)
    return img

def get_rat_img(frame_idx, flip=False):
    rf = rat_frames[frame_idx]
    w, h = rf['w'], rf['h']
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    for idx, c_idx in enumerate(rf['pixels']):
        if c_idx != 0:
            rgb = pal[c_idx]
            px[idx % w, idx // w] = (rgb[0], rgb[1], rgb[2], 255)
    if flip:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img

VW = 400
VH = 210
TILE_SZ = 16

# Viewport centered on Level 0 stepped platforms & mousetraps
CAM_X = 10 * TILE_SZ
CAM_Y = 32 * TILE_SZ

bg_idx = lvl0['bg']
bg_rgb = tuple(pal[bg_idx]) if bg_idx < len(pal) else (0, 0, 0)

screen = Image.new('RGBA', (VW, VH), (bg_rgb[0], bg_rgb[1], bg_rgb[2], 255))

# Draw tiles
for ty in range(32, 47):
    for tx in range(10, 36):
        tid = tiles_map[ty * 64 + tx] % 36
        if tid == 0:
            continue
        timg = get_tile_img(tid)
        if timg:
            sx = tx * TILE_SZ - CAM_X
            sy = ty * TILE_SZ - CAM_Y
            screen.paste(timg, (sx, sy), timg)

# Draw Pack Rat character:
# Frame 16 is right-facing jump, Frame 9 is idle, Frame 7 is run
# Place Pack Rat jumping towards the platform
rat_jump = get_rat_img(16)
rat_x = int(14.8 * TILE_SZ - CAM_X)
rat_y = int(35.5 * TILE_SZ - CAM_Y)
screen.paste(rat_jump, (rat_x, rat_y), rat_jump)

# Top Bar (DOS Arcade Marquee / HUD)
# Height 24px
hud = Image.new('RGBA', (VW, 24), (12, 16, 26, 245))
draw = ImageDraw.Draw(hud)

# Marquee line
draw.rectangle([(0, 0), (VW - 1, 23)], outline=(0, 229, 255, 120), width=1)
draw.line([(0, 23), (VW, 23)], fill=(0, 229, 255, 200), width=1)

# Left: Retro Title
draw.text((8, 5), "THE PACK RAT (1992)", fill=(255, 208, 40, 255))
# Middle: Level
draw.text((160, 5), "LEVEL: 00", fill=(57, 255, 20, 255))
# Right: Score & Lives
draw.text((250, 5), "SCORE: 002450", fill=(255, 255, 255, 255))
draw.text((350, 5), "LIVES: 3", fill=(0, 229, 255, 255))

screen.paste(hud, (0, 0), hud)

# Bottom Status Footer (Web Edition URL / Credits)
footer = Image.new('RGBA', (VW, 16), (10, 14, 22, 240))
fdraw = ImageDraw.Draw(footer)
fdraw.line([(0, 0), (VW, 0)], fill=(40, 50, 70, 255), width=1)
fdraw.text((8, 2), "AUTHENTIC MS-DOS WEB PRESERVATION", fill=(140, 155, 180, 255))
fdraw.text((245, 2), "PLAY FREE IN YOUR BROWSER", fill=(57, 255, 20, 255))
screen.paste(footer, (0, VH - 16), footer)

# Scale up 3x to exact 1200x630 using NEAREST neighbor for crisp retro pixel art
final_card = screen.resize((1200, 630), Image.NEAREST)
final_card.save('preview.png', 'PNG')
print("Successfully generated preview.png:", final_card.size)
