import json
import os
from PIL import Image, ImageDraw, ImageFont

# Load authentic game assets
with open('assets.js', 'r', encoding='utf-8') as f:
    raw = f.read()
raw = raw[raw.index('{'):raw.rindex('}') + 1]
assets = json.loads(raw)

pal = assets['palette']
tile_defs = assets['tiles']
rat_frames = assets['ratFrames']

# Helper: Render authentic tile image
def get_tile_img(tid):
    tid_str = str(tid % 36)
    if tid_str not in tile_defs or tid % 36 == 0:
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

# Helper: Render rat frame
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

artifact_dir = r"C:\Users\Justi\.gemini\antigravity-ide\brain\3f2c67b4-8685-4591-8c09-ce3f4590b7bf"
os.makedirs(artifact_dir, exist_ok=True)

SCALE = 4
TILE_SZ = 16

# Fonts
font_title = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 20)
font_subtitle = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 13)
font_badge_bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 14)
font_badge_sub = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)

def render_secret_scene(lvl_idx, min_tx, max_tx, min_ty, max_ty, annotations, rat_pos=None, title="", subtitle=""):
    lvl = assets['levels'][lvl_idx]
    tiles = lvl['tiles']
    
    bg_idx = lvl['bg']
    bg_rgb = tuple(pal[bg_idx]) if bg_idx < len(pal) else (0, 0, 0)
    
    tw = max_tx - min_tx + 1
    th = max_ty - min_ty + 1
    
    native_w = tw * TILE_SZ
    native_h = th * TILE_SZ
    native = Image.new('RGBA', (native_w, native_h), (bg_rgb[0], bg_rgb[1], bg_rgb[2], 255))
    
    # 1. Render all tiles in viewport
    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            tid = tiles[ty * 64 + tx]
            if tid == 0:
                continue
            timg = get_tile_img(tid)
            if timg:
                sx = (tx - min_tx) * TILE_SZ
                sy = (ty - min_ty) * TILE_SZ
                native.paste(timg, (sx, sy), timg)
                
    # 2. Render Pack Rat if provided
    if rat_pos:
        rx, ry, rframe, rflip = rat_pos
        rimg = get_rat_img(rframe, rflip)
        sx = int((rx - min_tx) * TILE_SZ)
        sy = int((ry - min_ty) * TILE_SZ)
        native.paste(rimg, (sx, sy), rimg)
        
    # 3. Nearest-neighbor upscale to crisp scale
    scaled_w = native_w * SCALE
    scaled_h = native_h * SCALE
    scaled = native.resize((scaled_w, scaled_h), Image.NEAREST)
    
    # 4. Canvas with Header
    HEADER_H = 54
    canvas = Image.new('RGBA', (scaled_w, scaled_h + HEADER_H), (10, 12, 18, 255))
    canvas.paste(scaled, (0, HEADER_H))
    
    # Overlay layer for translucent highlights and callouts
    overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    
    # Header bar
    odraw.rectangle([(0, 0), (scaled_w, HEADER_H)], fill=(16, 20, 30, 255))
    odraw.line([(0, HEADER_H - 1), (scaled_w, HEADER_H - 1)], fill=(0, 229, 255, 200), width=2)
    odraw.text((16, 8), title, font=font_title, fill=(255, 208, 40, 255))
    odraw.text((18, 32), subtitle, font=font_subtitle, fill=(140, 160, 190, 255))
    
    # Render Annotations
    for ann in annotations:
        box = ann.get('box') # (x1, y1, x2, y2) in tile units
        tag = ann.get('tag', '')
        desc = ann.get('desc', '')
        color = ann.get('color', (0, 229, 255, 255))
        fill_tint = ann.get('fill_tint', (color[0], color[1], color[2], 50))
        badge_pos = ann.get('badge_pos') # (px, py)
        pointer_from = ann.get('pointer_from')
        pointer_to = ann.get('pointer_to')
        
        if box:
            bx1 = int((box[0] - min_tx) * TILE_SZ * SCALE)
            by1 = int((box[1] - min_ty) * TILE_SZ * SCALE) + HEADER_H
            bx2 = int((box[2] + 1 - min_tx) * TILE_SZ * SCALE)
            by2 = int((box[3] + 1 - min_ty) * TILE_SZ * SCALE) + HEADER_H
            
            # Highlight tint inside target region
            odraw.rectangle([(bx1, by1), (bx2, by2)], fill=fill_tint, outline=color, width=3)
            
        if badge_pos and tag:
            # Measure text size
            tag_box = odraw.textbbox((0, 0), tag, font=font_badge_bold)
            desc_box = odraw.textbbox((0, 0), desc, font=font_badge_sub) if desc else (0, 0, 0, 0)
            
            w_text = max(tag_box[2] - tag_box[0], desc_box[2] - desc_box[0])
            h_text = (tag_box[3] - tag_box[1]) + (desc_box[3] - desc_box[1] + 4 if desc else 0)
            
            pad_x = 12
            pad_y = 8
            bg_w = w_text + pad_x * 2
            bg_h = h_text + pad_y * 2
            
            px, py = badge_pos
            # Draw badge background pill with shadow
            odraw.rounded_rectangle([(px + 3, py + 3), (px + bg_w + 3, py + bg_h + 3)], radius=6, fill=(0, 0, 0, 160))
            odraw.rounded_rectangle([(px, py), (px + bg_w, py + bg_h)], radius=6, fill=(16, 22, 34, 240), outline=color, width=2)
            
            odraw.text((px + pad_x, py + pad_y), tag, font=font_badge_bold, fill=color)
            if desc:
                odraw.text((px + pad_x, py + pad_y + (tag_box[3] - tag_box[1]) + 4), desc, font=font_badge_sub, fill=(230, 235, 245, 255))
                
        if pointer_from and pointer_to:
            odraw.line([pointer_from, pointer_to], fill=color, width=2)
            # Draw small dot at target
            odraw.ellipse([(pointer_to[0] - 3, pointer_to[1] - 3), (pointer_to[0] + 3, pointer_to[1] + 3)], fill=color)
            
    final = Image.alpha_composite(canvas, overlay)
    return final

# =========================================================================
# PHOTO 1: LEVEL 1 — The Secret Cheese Vault & Illusionary Water / Bricks
# =========================================================================
img1 = render_secret_scene(
    lvl_idx=0,
    min_tx=0, max_tx=13, min_ty=35, max_ty=48,
    annotations=[
        {
            'box': (6, 37, 8, 37),
            'tag': 'ILLUSIONARY WATER (Tile 38)',
            'desc': 'Harmless water pool: safe to stand/swim across without drowning',
            'color': (0, 229, 255, 255),
            'fill_tint': (0, 229, 255, 60),
            'badge_pos': (30, 80),
            'pointer_from': (250, 115),
            'pointer_to': (int((7 - 0) * 16 * SCALE), int((37 - 35 + 0.5) * 16 * SCALE) + 54)
        },
        {
            'box': (8, 38, 8, 43),
            'tag': 'ILLUSIONARY BRICK WALL (Tile 37)',
            'desc': 'Walk straight through this solid-looking vertical brick column!',
            'color': (57, 255, 20, 255),
            'fill_tint': (57, 255, 20, 50),
            'badge_pos': (20, 240),
            'pointer_from': (350, 260),
            'pointer_to': (int((8.5 - 0) * 16 * SCALE), int((40 - 35) * 16 * SCALE) + 54)
        },
        {
            'box': (2, 46, 10, 46),
            'tag': 'SECRET CHEESE VAULT (9x CHEESE)',
            'desc': 'Worth 250 pts each = +2,250 points! Escape hole below at (2, 47)',
            'color': (255, 208, 40, 255),
            'fill_tint': (255, 208, 40, 50),
            'badge_pos': (60, 680),
            'pointer_from': (360, 720),
            'pointer_to': (int((6 - 0) * 16 * SCALE), int((46 - 35 + 0.5) * 16 * SCALE) + 54)
        }
    ],
    rat_pos=(8.1, 40.2, 7, False),
    title="LEVEL 1: SECRET CHEESE VAULT & ILLUSIONARY WALL",
    subtitle="MAP COORDS: X=0..13, Y=35..48 | TILE 37 (FAKE BRICK) & TILE 38 (SAFE WATER)"
)
img1.save(os.path.join(artifact_dir, "level1_cheese_vault.png"))
img1.save("level1_cheese_vault.png")
print("Rendered Photo 1: Level 1")

# =========================================================================
# PHOTO 2: LEVEL 3 — Secret Passage to Bonus Level 12 (118 Fake Bricks)
# =========================================================================
img2 = render_secret_scene(
    lvl_idx=2,
    min_tx=44, max_tx=63, min_ty=51, max_ty=63,
    annotations=[
        {
            'box': (46, 61, 46, 61),
            'tag': 'NORMAL EXIT -> LEVEL 4',
            'desc': 'Standard level exit mouse hole with P.Rat sign',
            'color': (57, 255, 20, 255),
            'fill_tint': (57, 255, 20, 50),
            'badge_pos': (20, 480),
            'pointer_from': (180, 530),
            'pointer_to': (int((46.5 - 44) * 16 * SCALE), int((61.5 - 51) * 16 * SCALE) + 54)
        },
        {
            'box': (51, 53, 63, 62),
            'tag': 'SECRET PASSAGEWAY (118 FAKE BRICKS)',
            'desc': 'Walk straight into the brick wall at X=51 to enter hidden corridors',
            'color': (0, 229, 255, 255),
            'fill_tint': (0, 229, 255, 40),
            'badge_pos': (380, 80),
            'pointer_from': (650, 130),
            'pointer_to': (int((53 - 44) * 16 * SCALE), int((54 - 51) * 16 * SCALE) + 54)
        },
        {
            'box': (62, 61, 62, 61),
            'tag': 'SECRET MOUSE HOLE -> LEVEL 12!',
            'desc': 'Hidden at (62, 61) inside the fortress: warps to Secret Bonus Level 12',
            'color': (255, 42, 122, 255),
            'fill_tint': (255, 42, 122, 60),
            'badge_pos': (580, 580),
            'pointer_from': (750, 630),
            'pointer_to': (int((62.5 - 44) * 16 * SCALE), int((61.5 - 51) * 16 * SCALE) + 54)
        }
    ],
    rat_pos=(52.5, 54.0, 7, False),
    title="LEVEL 3: HIDDEN BRICK FORTRESS TO BONUS LEVEL 12",
    subtitle="MAP COORDS: X=44..63, Y=51..63 | TILE 37 (118 ILLUSIONARY BRICKS) HIDING HOLE (62, 61)"
)
img2.save(os.path.join(artifact_dir, "level3_secret_fortress.png"))
img2.save("level3_secret_fortress.png")
print("Rendered Photo 2: Level 3")

# =========================================================================
# PHOTO 3: LEVEL 4 — Safe Illusionary Water Channel to Bonus Level 13
# =========================================================================
img3 = render_secret_scene(
    lvl_idx=3,
    min_tx=0, max_tx=24, min_ty=55, max_ty=63,
    annotations=[
        {
            'box': (7, 62, 17, 62),
            'tag': 'ILLUSIONARY WATER (Tile 38 - SAFE)',
            'desc': 'Looks like deep water, but safe to walk across! Pack Rat wades freely',
            'color': (57, 255, 20, 255),
            'fill_tint': (57, 255, 20, 50),
            'badge_pos': (300, 320),
            'pointer_from': (550, 370),
            'pointer_to': (int((12 - 0) * 16 * SCALE), int((62.5 - 55) * 16 * SCALE) + 54)
        },
        {
            'box': (18, 62, 24, 62),
            'tag': 'LETHAL DEEP WATER (Tile 2 - DROWNS)',
            'desc': 'Real deep water pool: touching this causes instant drowning death',
            'color': (255, 42, 122, 255),
            'fill_tint': (255, 42, 122, 60),
            'badge_pos': (780, 200),
            'pointer_from': (950, 255),
            'pointer_to': (int((21 - 0) * 16 * SCALE), int((62.5 - 55) * 16 * SCALE) + 54)
        },
        {
            'box': (0, 59, 0, 59),
            'tag': 'SECRET MOUSE HOLE -> LEVEL 13!',
            'desc': 'Exit at (0, 59) leads directly into Secret Bonus Level 13',
            'color': (255, 208, 40, 255),
            'fill_tint': (255, 208, 40, 60),
            'badge_pos': (20, 80),
            'pointer_from': (160, 135),
            'pointer_to': (int((0.5 - 0) * 16 * SCALE), int((59.5 - 55) * 16 * SCALE) + 54)
        }
    ],
    rat_pos=(10.5, 61.2, 7, True),
    title="LEVEL 4: ILLUSIONARY WATER CHANNEL TO BONUS LEVEL 13",
    subtitle="MAP COORDS: X=0..24, Y=55..63 | TILE 38 (SAFE WATER) VS TILE 2 (LETHAL WATER)"
)
img3.save(os.path.join(artifact_dir, "level4_mousetrap_gauntlet.png"))
img3.save("level4_mousetrap_gauntlet.png")
print("Rendered Photo 3: Level 4")

# =========================================================================
# PHOTO 4: LEVEL 10 — False Floor Trap & Decoy Mouse Hole
# =========================================================================
img4 = render_secret_scene(
    lvl_idx=9,
    min_tx=48, max_tx=63, min_ty=18, max_ty=30,
    annotations=[
        {
            'box': (61, 23, 61, 23),
            'tag': 'DECOY MOUSE HOLE (Tile 51 - FAKE EXIT)',
            'desc': 'A lure exit that does not warp the player; leads into trap floor',
            'color': (255, 42, 122, 255),
            'fill_tint': (255, 42, 122, 60),
            'badge_pos': (300, 80),
            'pointer_from': (580, 130),
            'pointer_to': (int((61.5 - 48) * 16 * SCALE), int((23.5 - 18) * 16 * SCALE) + 54)
        },
        {
            'box': (58, 25, 62, 25),
            'tag': 'FALSE BRICK FLOOR (Tile 37 - HOLLOW)',
            'desc': 'Stepping onto these 5 bricks drops you through into the lower pit!',
            'color': (0, 229, 255, 255),
            'fill_tint': (0, 229, 255, 50),
            'badge_pos': (280, 480),
            'pointer_from': (540, 480),
            'pointer_to': (int((60 - 48) * 16 * SCALE), int((25.5 - 18) * 16 * SCALE) + 54)
        }
    ],
    rat_pos=(54.0, 23.5, 9, False),
    title="LEVEL 10: DECOY HOLE & HOLLOW FLOOR TRAP",
    subtitle="MAP COORDS: X=48..63, Y=18..30 | TILE 51 (FAKE HOLE) & TILE 37 (FALSE FLOOR)"
)
img4.save(os.path.join(artifact_dir, "level10_decoy_trap.png"))
img4.save("level10_decoy_trap.png")
print("Rendered Photo 4: Level 10")
