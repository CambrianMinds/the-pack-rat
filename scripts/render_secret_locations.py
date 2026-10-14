import json
import os
import math
from PIL import Image, ImageDraw, ImageFont

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, '..')) if os.path.basename(script_dir) == 'scripts' else script_dir
assets_path = os.path.join(root_dir, 'assets.js')

with open(assets_path, 'r', encoding='utf-8') as f:
    raw = f.read()
raw = raw[raw.index('{'):raw.rindex('}') + 1]
assets = json.loads(raw)

pal = assets['palette']
tile_defs = assets['tiles']

SCALE = 4
TILE_SZ = 16

font_h1 = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 20)
font_h2 = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)
font_badge_bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 13)
font_badge_text = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 11)
font_step = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 11)

artifact_dir = r"C:\Users\Justi\.gemini\antigravity-ide\brain\3f2c67b4-8685-4591-8c09-ce3f4590b7bf"
os.makedirs(artifact_dir, exist_ok=True)

def get_tile_img(tid):
    tid_mod = tid % 36
    tid_str = str(tid_mod)
    if tid_str not in tile_defs or tid_mod == 0:
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

def draw_header(draw, width, title, subtitle):
    HEADER_H = 54
    draw.rectangle([(0, 0), (width, HEADER_H)], fill=(16, 20, 30, 255))
    draw.line([(0, HEADER_H - 1), (width, HEADER_H - 1)], fill=(0, 229, 255, 180), width=2)
    draw.text((16, 8), title, font=font_h1, fill=(255, 208, 40, 255))
    draw.text((18, 32), subtitle, font=font_h2, fill=(150, 175, 205, 255))
    return HEADER_H

def draw_pill_badge(draw, x, y, title, subtitle, color=(0, 229, 255, 255), step_num=None):
    t_bbox = draw.textbbox((0, 0), title, font=font_badge_bold)
    s_bbox = draw.textbbox((0, 0), subtitle, font=font_badge_text) if subtitle else (0, 0, 0, 0)
    
    w_content = max(t_bbox[2] - t_bbox[0], s_bbox[2] - s_bbox[0])
    h_content = (t_bbox[3] - t_bbox[1]) + (s_bbox[3] - s_bbox[1] + 3 if subtitle else 0)
    
    pad_left = 34 if step_num else 12
    pad_right = 12
    pad_y = 6
    
    bw = w_content + pad_left + pad_right
    bh = h_content + pad_y * 2
    
    draw.rounded_rectangle([(x + 2, y + 2), (x + bw + 2, y + bh + 2)], radius=6, fill=(0, 0, 0, 180))
    draw.rounded_rectangle([(x, y), (x + bw, y + bh)], radius=6, fill=(18, 24, 36, 245), outline=color, width=2)
    
    if step_num:
        cx, cy = x + 16, y + bh // 2
        draw.ellipse([(cx - 10, cy - 10), (cx + 10, cy + 10)], fill=color)
        draw.text((cx - 4, cy - 7), str(step_num), font=font_step, fill=(12, 16, 24, 255))
        
    draw.text((x + pad_left, y + pad_y), title, font=font_badge_bold, fill=color)
    if subtitle:
        draw.text((x + pad_left, y + pad_y + (t_bbox[3] - t_bbox[1]) + 3), subtitle, font=font_badge_text, fill=(220, 230, 240, 255))
        
    return (x, y, bw, bh)

def draw_route(draw, points, color=(255, 208, 40, 255), width=3):
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        draw.line([p1, p2], fill=color, width=width)
        
    if len(points) >= 2:
        p_last = points[-1]
        p_prev = points[-2]
        angle = math.atan2(p_last[1] - p_prev[1], p_last[0] - p_prev[0])
        arrow_len = 10
        a1 = (p_last[0] - arrow_len * math.cos(angle - math.pi / 6), p_last[1] - arrow_len * math.sin(angle - math.pi / 6))
        a2 = (p_last[0] - arrow_len * math.cos(angle + math.pi / 6), p_last[1] - arrow_len * math.sin(angle + math.pi / 6))
        draw.polygon([p_last, a1, a2], fill=color)

# =========================================================================
# PHOTO 1: LEVEL 1 — THE SECRET CHEESE VAULT & ILLUSIONARY WATER / CHUTE
# =========================================================================
def render_photo_1():
    min_tx, max_tx = 0, 14
    min_ty, max_ty = 34, 48
    tw, th = max_tx - min_tx + 1, max_ty - min_ty + 1
    
    scaled_w = tw * TILE_SZ * SCALE
    scaled_h = th * TILE_SZ * SCALE
    HEADER_H = 54
    
    canvas = Image.new('RGBA', (scaled_w, scaled_h + HEADER_H), (10, 14, 22, 255))
    draw_header(ImageDraw.Draw(canvas), scaled_w, 
                "LEVEL 1: SECRET CHEESE VAULT & ILLUSIONARY DROP CHUTE", 
                "COORDS: X=0..14, Y=34..48 | TILE 38 (SAFE WATER) & TILE 37 (HOLLOW BRICKS)")
    
    lvl = assets['levels'][0]
    tiles = lvl['tiles']
    bg_rgb = tuple(pal[lvl['bg']])
    native = Image.new('RGBA', (tw * TILE_SZ, th * TILE_SZ), (bg_rgb[0], bg_rgb[1], bg_rgb[2], 255))
    
    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            tid = tiles[ty * 64 + tx]
            if tid == 0: continue
            timg = get_tile_img(tid)
            if timg:
                native.paste(timg, ((tx - min_tx) * TILE_SZ, (ty - min_ty) * TILE_SZ), timg)
                
    scaled_game = native.resize((scaled_w, scaled_h), Image.NEAREST)
    canvas.paste(scaled_game, (0, HEADER_H))
    
    overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    
    # Safe water highlight
    wx1 = (6 - min_tx) * 64
    wy1 = (37 - min_ty) * 64 + HEADER_H
    wx2 = (8 + 1 - min_tx) * 64
    wy2 = (37 + 1 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(wx1, wy1), (wx2, wy2)], fill=(0, 229, 255, 70), outline=(0, 229, 255, 255), width=3)
    
    # Hollow chute highlight
    cx1 = (8 - min_tx) * 64
    cy1 = (38 - min_ty) * 64 + HEADER_H
    cx2 = (8 + 1 - min_tx) * 64
    cy2 = (43 + 1 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(cx1, cy1), (cx2, cy2)], fill=(57, 255, 20, 80), outline=(57, 255, 20, 255), width=3)
    for y_hatch in range(cy1 + 16, cy2, 32):
        odraw.line([(cx1 + 8, y_hatch), (cx2 - 8, y_hatch)], fill=(57, 255, 20, 180), width=2)
        
    # Cheese Vault highlight
    zx1 = (2 - min_tx) * 64
    zy1 = (46 - min_ty) * 64 + HEADER_H
    zx2 = (10 + 1 - min_tx) * 64
    zy2 = (46 + 1 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(zx1, zy1), (zx2, zy2)], fill=(255, 208, 40, 50), outline=(255, 208, 40, 255), width=2)
    
    # Floor escape highlight
    ex1 = (2 - min_tx) * 64
    ey1 = (47 - min_ty) * 64 + HEADER_H
    ex2 = (3 - min_tx) * 64
    ey2 = (48 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(ex1, ey1), (ex2, ey2)], fill=(57, 255, 20, 80), outline=(57, 255, 20, 255), width=2)
    
    # Path
    route_pts = [
        ((7 - min_tx) * 64 + 32, (36 - min_ty) * 64 + 32 + HEADER_H),
        ((8 - min_tx) * 64 + 32, (37 - min_ty) * 64 + 32 + HEADER_H),
        ((8 - min_tx) * 64 + 32, (45 - min_ty) * 64 + 32 + HEADER_H),
        ((6 - min_tx) * 64 + 32, (46 - min_ty) * 64 + 16 + HEADER_H),
        ((2 - min_tx) * 64 + 32, (46 - min_ty) * 64 + 16 + HEADER_H),
        ((2 - min_tx) * 64 + 32, (48 - min_ty) * 64 + 16 + HEADER_H)
    ]
    draw_route(odraw, route_pts, color=(255, 220, 50, 255), width=4)
    
    # Badges
    draw_pill_badge(odraw, 20, 70, 
                    "1. SAFE ILLUSION WATER (Tile 38)", 
                    "Wade across blue water at (6..8, 37) without drowning!", 
                    color=(0, 229, 255, 255), step_num=1)
                    
    draw_pill_badge(odraw, 595, 260, 
                    "2. HOLLOW DROP CHUTE (Tile 37)", 
                    "Step onto (8, 37) to fall through 6 fake bricks!", 
                    color=(57, 255, 20, 255), step_num=2)
                    
    draw_pill_badge(odraw, 20, 730, 
                    "3. SECRET CHEESE VAULT (+2,250 PTS)", 
                    "Collect all 9 cheeses worth 250 points each!", 
                    color=(255, 208, 40, 255), step_num=3)
                    
    draw_pill_badge(odraw, 20, 890, 
                    "4. HOLLOW FLOOR ESCAPE (Tile 37)", 
                    "Drop through fake floor at (2, 47) to exit cleanly", 
                    color=(57, 255, 20, 255), step_num=4)
                    
    final = Image.alpha_composite(canvas, overlay)
    final.save(os.path.join(artifact_dir, "level1_cheese_vault.png"))
    final.save(os.path.join(root_dir, "level1_cheese_vault.png"))
    print("Rendered Photo 1: Level 1")

# =========================================================================
# PHOTO 2: LEVEL 3 — THE 118-TILE FORTRESS & INVISIBLE MAZE TO LEVEL 12
# =========================================================================
def render_photo_2():
    min_tx, max_tx = 44, 63
    min_ty, max_ty = 48, 63
    tw, th = max_tx - min_tx + 1, max_ty - min_ty + 1
    
    scaled_w = tw * TILE_SZ * SCALE
    scaled_h = th * TILE_SZ * SCALE
    HEADER_H = 54
    
    canvas = Image.new('RGBA', (scaled_w, scaled_h + HEADER_H), (10, 14, 22, 255))
    draw_header(ImageDraw.Draw(canvas), scaled_w, 
                "LEVEL 3: THE 118-TILE BRICK FORTRESS & SECRET MAZE TO LEVEL 12", 
                "COORDS: X=44..63, Y=48..63 | BLUEPRINT SHOWS THE EXACT WALKABLE PATH THROUGH SOLID BRICK")
    
    lvl = assets['levels'][2]
    tiles = lvl['tiles']
    bg_rgb = tuple(pal[lvl['bg']])
    native = Image.new('RGBA', (tw * TILE_SZ, th * TILE_SZ), (bg_rgb[0], bg_rgb[1], bg_rgb[2], 255))
    
    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            tid = tiles[ty * 64 + tx]
            if tid == 0: continue
            timg = get_tile_img(tid)
            if timg:
                native.paste(timg, ((tx - min_tx) * TILE_SZ, (ty - min_ty) * TILE_SZ), timg)
                
    scaled_game = native.resize((scaled_w, scaled_h), Image.NEAREST)
    canvas.paste(scaled_game, (0, HEADER_H))
    
    overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    
    # 118 fake bricks blueprint highlight
    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            tid = tiles[ty * 64 + tx]
            if tid == 37:
                bx1 = (tx - min_tx) * 64
                by1 = (ty - min_ty) * 64 + HEADER_H
                bx2 = bx1 + 64
                by2 = by1 + 64
                odraw.rectangle([(bx1, by1), (bx2, by2)], fill=(0, 229, 255, 65), outline=(0, 229, 255, 120), width=1)
                
    # Normal Exit
    nx1 = (46 - min_tx) * 64
    ny1 = (61 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(nx1, ny1), (nx1 + 64, ny1 + 64)], fill=(57, 255, 20, 50), outline=(57, 255, 20, 255), width=3)
    
    # Secret Exit
    sx1 = (62 - min_tx) * 64
    sy1 = (61 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(sx1, sy1), (sx1 + 64, ny1 + 64)], fill=(255, 42, 122, 70), outline=(255, 42, 122, 255), width=3)
    
    # Route
    maze_route = [
        ((46 - min_tx) * 64 + 32, (52 - min_ty) * 64 + HEADER_H - 20),
        ((56 - min_tx) * 64 + 32, (51 - min_ty) * 64 + 32 + HEADER_H),
        ((63 - min_tx) * 64 + 32, (51 - min_ty) * 64 + 32 + HEADER_H),
        ((63 - min_tx) * 64 + 32, (54 - min_ty) * 64 + 32 + HEADER_H),
        ((55 - min_tx) * 64 + 32, (54 - min_ty) * 64 + 32 + HEADER_H),
        ((55 - min_tx) * 64 + 32, (56 - min_ty) * 64 + 32 + HEADER_H),
        ((53 - min_tx) * 64 + 32, (56 - min_ty) * 64 + 32 + HEADER_H),
        ((53 - min_tx) * 64 + 32, (59 - min_ty) * 64 + 32 + HEADER_H),
        ((51 - min_tx) * 64 + 32, (59 - min_ty) * 64 + 32 + HEADER_H),
        ((51 - min_tx) * 64 + 32, (61 - min_ty) * 64 + 32 + HEADER_H),
        ((62 - min_tx) * 64 + 32, (61 - min_ty) * 64 + 32 + HEADER_H)
    ]
    draw_route(odraw, maze_route, color=(255, 220, 50, 255), width=4)
    
    draw_pill_badge(odraw, 20, 70, 
                    "NORMAL EXIT -> LEVEL 4", 
                    "Standard mouse hole at (46, 61)", 
                    color=(57, 255, 20, 255))
                    
    draw_pill_badge(odraw, 520, 70, 
                    "STEP 1: JUMP ACROSS ROOF TO X=63", 
                    "Grab bonus cheese at (56, 51) and enter top-right chute", 
                    color=(255, 208, 40, 255), step_num=1)
                    
    draw_pill_badge(odraw, 20, 680, 
                    "STEP 2: NAVIGATE BLUEPRINT CORRIDORS", 
                    "Cyan overlay reveals the 118 walkable bricks inside the wall!", 
                    color=(0, 229, 255, 255), step_num=2)
                    
    draw_pill_badge(odraw, 820, 780, 
                    "STEP 3: SECRET EXIT -> LEVEL 12!", 
                    "Hidden mouse hole at (62, 61) inside the fortress!", 
                    color=(255, 42, 122, 255), step_num=3)
                    
    final = Image.alpha_composite(canvas, overlay)
    final.save(os.path.join(artifact_dir, "level3_secret_fortress.png"))
    final.save(os.path.join(root_dir, "level3_secret_fortress.png"))
    print("Rendered Photo 2: Level 3")

# =========================================================================
# PHOTO 3: LEVEL 4 — ILLUSIONARY WATER CHANNEL TO BONUS LEVEL 13
# =========================================================================
def render_photo_3():
    min_tx, max_tx = 0, 24
    min_ty, max_ty = 54, 63
    tw, th = max_tx - min_tx + 1, max_ty - min_ty + 1
    
    scaled_w = tw * TILE_SZ * SCALE
    scaled_h = th * TILE_SZ * SCALE
    HEADER_H = 54
    
    canvas = Image.new('RGBA', (scaled_w, scaled_h + HEADER_H), (10, 14, 22, 255))
    draw_header(ImageDraw.Draw(canvas), scaled_w, 
                "LEVEL 4: SAFE ILLUSIONARY WATER CHANNEL TO BONUS LEVEL 13", 
                "COORDS: X=0..24, Y=54..63 | SAFE WATER (TILE 38) VS LETHAL WATER (TILE 2)")
    
    lvl = assets['levels'][3]
    tiles = lvl['tiles']
    bg_rgb = tuple(pal[lvl['bg']])
    native = Image.new('RGBA', (tw * TILE_SZ, th * TILE_SZ), (bg_rgb[0], bg_rgb[1], bg_rgb[2], 255))
    
    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            tid = tiles[ty * 64 + tx]
            if tid == 0: continue
            timg = get_tile_img(tid)
            if timg:
                native.paste(timg, ((tx - min_tx) * TILE_SZ, (ty - min_ty) * TILE_SZ), timg)
                
    scaled_game = native.resize((scaled_w, scaled_h), Image.NEAREST)
    canvas.paste(scaled_game, (0, HEADER_H))
    
    overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    
    # Lethal water
    lx1 = (18 - min_tx) * 64
    ly1 = (62 - min_ty) * 64 + HEADER_H
    lx2 = (24 + 1 - min_tx) * 64
    ly2 = (62 + 1 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(lx1, ly1), (lx2, ly2)], fill=(255, 42, 122, 60), outline=(255, 42, 122, 255), width=3)
    
    # Safe water
    sx1 = (7 - min_tx) * 64
    sy1 = (62 - min_ty) * 64 + HEADER_H
    sx2 = (17 + 1 - min_tx) * 64
    sy2 = (62 + 1 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(sx1, sy1), (sx2, sy2)], fill=(57, 255, 20, 60), outline=(57, 255, 20, 255), width=3)
    
    # Secret exit
    ex1 = (0 - min_tx) * 64
    ey1 = (59 - min_ty) * 64 + HEADER_H
    ex2 = (1 - min_tx) * 64
    ey2 = (60 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(ex1, ey1), (ex2, ey2)], fill=(255, 208, 40, 70), outline=(255, 208, 40, 255), width=3)
    
    # Route
    route_pts = [
        ((20 - min_tx) * 64 + 32, (60 - min_ty) * 64 + 32 + HEADER_H),
        ((16 - min_tx) * 64 + 32, (61 - min_ty) * 64 + 32 + HEADER_H),
        ((12 - min_tx) * 64 + 32, (61 - min_ty) * 64 + 32 + HEADER_H),
        ((7 - min_tx) * 64 + 32,  (61 - min_ty) * 64 + 32 + HEADER_H),
        ((4 - min_tx) * 64 + 32,  (60 - min_ty) * 64 + 32 + HEADER_H),
        ((0 - min_tx) * 64 + 32,  (59 - min_ty) * 64 + 32 + HEADER_H)
    ]
    draw_route(odraw, route_pts, color=(255, 220, 50, 255), width=4)
    
    draw_pill_badge(odraw, 1140, 100, 
                    "DANGER: LETHAL WATER (Tile 2)", 
                    "Touching this pool instantly drowns the Pack Rat!", 
                    color=(255, 42, 122, 255))
                    
    draw_pill_badge(odraw, 460, 240, 
                    "SAFE ILLUSION WATER (Tile 38)", 
                    "Completely safe! Wade freely underneath the hanging brick pillar.", 
                    color=(57, 255, 20, 255))
                    
    draw_pill_badge(odraw, 20, 80, 
                    "SECRET EXIT -> LEVEL 13!", 
                    "Wade across to reach (0, 59) and warp to Bonus Stage 13!", 
                    color=(255, 208, 40, 255))
                    
    final = Image.alpha_composite(canvas, overlay)
    final.save(os.path.join(artifact_dir, "level4_mousetrap_gauntlet.png"))
    final.save(os.path.join(root_dir, "level4_mousetrap_gauntlet.png"))
    print("Rendered Photo 3: Level 4")

# =========================================================================
# PHOTO 4: LEVEL 10 — DECOY MOUSE HOLE & PITFALL TRAP (WITH TRUE PORTAL INSET)
# =========================================================================
def render_photo_4():
    min_tx, max_tx = 48, 63
    min_ty, max_ty = 18, 31
    tw, th = max_tx - min_tx + 1, max_ty - min_ty + 1
    
    scaled_w = tw * TILE_SZ * SCALE
    scaled_h = th * TILE_SZ * SCALE
    HEADER_H = 54
    
    canvas = Image.new('RGBA', (scaled_w, scaled_h + HEADER_H), (10, 14, 22, 255))
    draw_header(ImageDraw.Draw(canvas), scaled_w, 
                "LEVEL 10: DECOY MOUSE HOLE & PITFALL TRAP (VS TRUE FINALE AT 14, 44)", 
                "COORDS: X=48..63, Y=18..31 | TILE 51 (FAKE EXIT) & TILE 37 (FALSE FLOOR PITFALL)")
    
    lvl = assets['levels'][9]
    tiles = lvl['tiles']
    bg_rgb = tuple(pal[lvl['bg']])
    native = Image.new('RGBA', (tw * TILE_SZ, th * TILE_SZ), (bg_rgb[0], bg_rgb[1], bg_rgb[2], 255))
    
    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            tid = tiles[ty * 64 + tx]
            if tid == 0: continue
            timg = get_tile_img(tid)
            if timg:
                native.paste(timg, ((tx - min_tx) * TILE_SZ, (ty - min_ty) * TILE_SZ), timg)
                
    scaled_game = native.resize((scaled_w, scaled_h), Image.NEAREST)
    canvas.paste(scaled_game, (0, HEADER_H))
    
    overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    
    # 1. Armed Mousetrap at (56, 24)
    mx1 = (56 - min_tx) * 64
    my1 = (24 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(mx1, my1), (mx1 + 64, my1 + 64)], fill=(255, 80, 0, 60), outline=(255, 80, 0, 255), width=3)
    
    # 2. Decoy Mouse Hole at (61, 23)
    dx1 = (61 - min_tx) * 64
    dy1 = (23 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(dx1, dy1), (dx1 + 64, dy1 + 64)], fill=(255, 42, 122, 60), outline=(255, 42, 122, 255), width=3)
    
    # 3. Pitfall False Floor at (58..62, 25)
    fx1 = (58 - min_tx) * 64
    fy1 = (25 - min_ty) * 64 + HEADER_H
    fx2 = (62 + 1 - min_tx) * 64
    fy2 = (25 + 1 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(fx1, fy1), (fx2, fy2)], fill=(0, 229, 255, 70), outline=(0, 229, 255, 255), width=3)
    
    # 4. Pitfall Abyss (58..62, 26..31)
    px1 = fx1
    py1 = fy2
    px2 = fx2
    py2 = (31 + 1 - min_ty) * 64 + HEADER_H
    odraw.rectangle([(px1, py1), (px2, py2)], fill=(255, 42, 122, 40), outline=(255, 42, 122, 180), width=2)
    
    # Picture-in-picture Inset of the TRUE PORTAL at (14, 44)
    in_w = (18 - 11 + 1) * 16
    in_h = (47 - 42 + 1) * 16
    native_in = Image.new('RGBA', (in_w, in_h), (bg_rgb[0], bg_rgb[1], bg_rgb[2], 255))
    for ty in range(42, 48):
        for tx in range(11, 19):
            tid = tiles[ty * 64 + tx]
            if tid == 0: continue
            timg = get_tile_img(tid)
            if timg:
                native_in.paste(timg, ((tx - 11) * 16, (ty - 42) * 16), timg)
    scaled_in = native_in.resize((in_w * 3, in_h * 3), Image.NEAREST)
    
    in_x, in_y = 20, 160
    odraw.rounded_rectangle([(in_x - 6, in_y - 28), (in_x + scaled_in.width + 6, in_y + scaled_in.height + 6)], 
                           radius=6, fill=(14, 20, 30, 245), outline=(255, 208, 40, 255), width=2)
    odraw.text((in_x + 6, in_y - 22), "TRUE PORTAL TO FINALE AT (14, 44)", font=font_badge_bold, fill=(255, 208, 40, 255))
    canvas.paste(scaled_in, (in_x, in_y))
    
    # Badges
    draw_pill_badge(odraw, 20, 70, 
                    "ARMED MOUSETRAP (Tile 18)", 
                    "Snaps on contact! Guarding the walkway at (56, 24)", 
                    color=(255, 80, 0, 255))
                    
    draw_pill_badge(odraw, 520, 70, 
                    "DECOY MOUSE HOLE (Tile 51 - FAKE)", 
                    "Lure exit with P.Rat sign; does not warp the player!", 
                    color=(255, 42, 122, 255))
                    
    draw_pill_badge(odraw, 20, 520, 
                    "PITFALL FALSE FLOOR (Tile 37)", 
                    "5 fake bricks collapse when stepped on, dropping you into the abyss!", 
                    color=(0, 229, 255, 255))
                    
    draw_pill_badge(odraw, 20, 720, 
                    "TRUE EXIT LOCATION: (14, 44)", 
                    "Enter the electrified room shown in top-left inset to warp to Level 16 Finale!", 
                    color=(255, 208, 40, 255))
                    
    final = Image.alpha_composite(canvas, overlay)
    final.save(os.path.join(artifact_dir, "level10_decoy_trap.png"))
    final.save(os.path.join(root_dir, "level10_decoy_trap.png"))
    print("Rendered Photo 4: Level 10")

render_photo_1()
render_photo_2()
render_photo_3()
render_photo_4()
print("All 4 secret location photos rendered successfully!")
