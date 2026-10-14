import json
import os
import math
from PIL import Image, ImageDraw, ImageFont

with open('assets.js', 'r', encoding='utf-8') as f:
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

# PHOTO 4 UPDATE: Level 10 Decoy Trap + Picture-in-Picture Inset of True Exit (14, 44)
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
    
    # Inset: Picture-in-picture of the TRUE PORTAL at (14, 44)
    # Render (11..17, 42..47)
    in_w = (17 - 11 + 1) * 16
    in_h = (47 - 42 + 1) * 16
    native_in = Image.new('RGBA', (in_w, in_h), (bg_rgb[0], bg_rgb[1], bg_rgb[2], 255))
    for ty in range(42, 48):
        for tx in range(11, 18):
            tid = tiles[ty * 64 + tx]
            if tid == 0: continue
            timg = get_tile_img(tid)
            if timg:
                native_in.paste(timg, ((tx - 11) * 16, (ty - 42) * 16), timg)
    scaled_in = native_in.resize((in_w * 3, in_h * 3), Image.NEAREST)
    
    # Paste Inset Box at (20, 160)
    in_x, in_y = 20, 160
    # Inset background frame
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
    final.save("level10_decoy_trap.png")
    print("Rendered Photo 4 with True Portal inset!")

render_photo_4()
