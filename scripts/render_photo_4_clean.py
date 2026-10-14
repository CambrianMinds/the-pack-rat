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

font_h1 = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 20)
font_h2 = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)
font_panel_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 14)
font_badge_bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 12)
font_badge_text = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 11)

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

def render_viewport(lvl, min_tx, max_tx, min_ty, max_ty):
    tiles = lvl['tiles']
    bg_rgb = tuple(pal[lvl['bg']])
    vw = (max_tx - min_tx + 1) * 16
    vh = (max_ty - min_ty + 1) * 16
    img = Image.new('RGBA', (vw, vh), (bg_rgb[0], bg_rgb[1], bg_rgb[2], 255))
    
    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            tid = tiles[ty * 64 + tx]
            if tid == 0: continue
            timg = get_tile_img(tid)
            if timg:
                # Authentic DOS offset: Tile 18/19 mousetraps are 32x8, placed with +8 Y offset so they sit flush on the floor!
                y_offset = 8 if (tid % 36 == 18 or tid % 36 == 19) else 0
                img.paste(timg, ((tx - min_tx) * 16, (ty - min_ty) * 16 + y_offset), timg)
    return img

def draw_pill(draw, x, y, title, subtitle, color=(0, 229, 255, 255)):
    tb = draw.textbbox((0, 0), title, font=font_badge_bold)
    sb = draw.textbbox((0, 0), subtitle, font=font_badge_text) if subtitle else (0, 0, 0, 0)
    w = max(tb[2] - tb[0], sb[2] - sb[0]) + 20
    h = (tb[3] - tb[1]) + (sb[3] - sb[1] + 4 if subtitle else 0) + 12
    draw.rounded_rectangle([(x, y), (x + w, y + h)], radius=5, fill=(16, 22, 34, 240), outline=color, width=2)
    draw.text((x + 10, y + 5), title, font=font_badge_bold, fill=color)
    if subtitle:
        draw.text((x + 10, y + 21), subtitle, font=font_badge_text, fill=(220, 230, 245, 255))
    return w, h

def render_clean_photo_4():
    lvl = assets['levels'][9] # Level 10
    
    TOTAL_W = 1000
    TOTAL_H = 500
    HEADER_H = 56
    
    canvas = Image.new('RGBA', (TOTAL_W, TOTAL_H), (12, 16, 26, 255))
    draw = ImageDraw.Draw(canvas)
    
    # Header Banner
    draw.rectangle([(0, 0), (TOTAL_W, HEADER_H)], fill=(16, 22, 36, 255))
    draw.line([(0, HEADER_H - 1), (TOTAL_W, HEADER_H - 1)], fill=(0, 229, 255, 200), width=2)
    draw.text((16, 8), "LEVEL 10: DECOY PITFALL TRAP vs. TRUE GRAND FINALE PORTAL", font=font_h1, fill=(255, 208, 40, 255))
    draw.text((18, 33), "HINT: Beware the fake mouse hole lure; the genuine portal to Level 16 is hidden at (14, 44)", font=font_h2, fill=(155, 185, 215, 255))
    
    # Left Panel: Decoy Pitfall Trap (tx: 52..63, ty: 21..28)
    p1_img = render_viewport(lvl, 52, 63, 21, 28) # 12x8 tiles = 192x128
    P_W = 460
    P_H = 340
    p1_scaled = p1_img.resize((P_W, P_H), Image.NEAREST)
    
    P1_X = 24
    P1_Y = HEADER_H + 40
    canvas.paste(p1_scaled, (P1_X, P1_Y))
    
    # Left Panel Frame & Title
    draw.rectangle([(P1_X - 2, P1_Y - 2), (P1_X + P_W + 2, P1_Y + P_H + 2)], outline=(255, 42, 122, 220), width=2)
    draw.rectangle([(P1_X, P1_Y - 30), (P1_X + P_W, P1_Y - 2)], fill=(32, 16, 24, 255))
    draw.text((P1_X + 10, P1_Y - 24), "PANEL A: THE DECOY TRAP & PITFALL (Coords: 54..63, 21..27)", font=font_panel_title, fill=(255, 70, 140, 255))
    
    # Right Panel: True Exit Portal (tx: 10..18, ty: 40..47)
    p2_img = render_viewport(lvl, 10, 18, 40, 47) # 9x8 tiles = 144x128
    p2_scaled = p2_img.resize((P_W, P_H), Image.NEAREST)
    
    P2_X = 516
    P2_Y = HEADER_H + 40
    canvas.paste(p2_scaled, (P2_X, P2_Y))
    
    # Right Panel Frame & Title
    draw.rectangle([(P2_X - 2, P2_Y - 2), (P2_X + P_W + 2, P2_Y + P_H + 2)], outline=(255, 208, 40, 220), width=2)
    draw.rectangle([(P2_X, P2_Y - 30), (P2_X + P_W, P2_Y - 2)], fill=(36, 30, 14, 255))
    draw.text((P2_X + 10, P2_Y - 24), "PANEL B: THE TRUE FINALE PORTAL (Coords: 10..18, 41..47)", font=font_panel_title, fill=(255, 208, 40, 255))
    
    # Annotations on Left Panel (Overlay)
    overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    
    # Scale helper for panel 1:
    # 12 tiles across P_W (460px) -> ~38.33 px per tile
    # 8 tiles down P_H (340px) -> 42.5 px per tile
    def p1_box(tx, ty, tw=1, th=1):
        x1 = P1_X + int((tx - 52) * (P_W / 12))
        y1 = P1_Y + int((ty - 21) * (P_H / 8))
        x2 = P1_X + int((tx + tw - 52) * (P_W / 12))
        y2 = P1_Y + int((ty + th - 21) * (P_H / 8))
        return x1, y1, x2, y2

    # 1. Armed mousetrap at (56, 24) sitting flush on ground (Y=24.5..25)
    mx1, my1, mx2, my2 = p1_box(56, 24, 2, 1)
    odraw.rectangle([(mx1, my1 + int((my2-my1)*0.45)), (mx2, my2)], outline=(255, 80, 0, 255), fill=(255, 80, 0, 50), width=2)
    draw_pill(odraw, P1_X + 12, P1_Y + 12, "ARMED MOUSETRAP", "Snaps shut if stepped on", color=(255, 90, 20, 255))
    odraw.line([(P1_X + 120, P1_Y + 52), (mx1 + 20, my1 + int((my2-my1)*0.5))], fill=(255, 90, 20, 255), width=2)

    # 2. Decoy Exit Mousehole at (61, 23)
    dx1, dy1, dx2, dy2 = p1_box(61, 23, 2, 2)
    odraw.rectangle([(dx1, dy1), (dx2, dy2)], outline=(255, 42, 122, 255), fill=(255, 42, 122, 50), width=3)
    draw_pill(odraw, P1_X + 220, P1_Y + 12, "DECOY EXIT (FAKE)", "Warp Dest = Level 1 Reset!", color=(255, 42, 122, 255))
    odraw.line([(P1_X + 310, P1_Y + 52), (dx1 + 15, dy1 + 20)], fill=(255, 42, 122, 255), width=2)

    # 3. Collapsible Pitfall Floor at (58..62, 25)
    fx1, fy1, fx2, fy2 = p1_box(58, 25, 5, 1)
    odraw.rectangle([(fx1, fy1), (fx2, fy2)], outline=(0, 229, 255, 255), fill=(0, 229, 255, 60), width=3)
    
    # Drop arrows into abyss
    for ax in range(fx1 + 20, fx2, 35):
        odraw.line([(ax, fy2 + 6), (ax, fy2 + 35)], fill=(0, 229, 255, 255), width=2)
        odraw.polygon([(ax, fy2 + 42), (ax - 4, fy2 + 34), (ax + 4, fy2 + 34)], fill=(0, 229, 255, 255))
    
    draw_pill(odraw, P1_X + 15, P1_Y + P_H - 65, "COLLAPSIBLE PITFALL (Tile 37)", "5 fake bricks collapse into pit!", color=(0, 229, 255, 255))

    # Scale helper for panel 2:
    # 9 tiles across P_W (460px) -> ~51.1 px per tile
    # 8 tiles down P_H (340px) -> 42.5 px per tile
    def p2_box(tx, ty, tw=1, th=1):
        x1 = P2_X + int((tx - 10) * (P_W / 9))
        y1 = P2_Y + int((ty - 40) * (P_H / 8))
        x2 = P2_X + int((tx + tw - 10) * (P_W / 9))
        y2 = P2_Y + int((ty + th - 40) * (P_H / 8))
        return x1, y1, x2, y2

    # 1. True Portal at (14, 44)
    tx1, ty1, tx2, ty2 = p2_box(14, 44, 2, 2)
    odraw.rectangle([(tx1, ty1), (tx2, ty2)], outline=(255, 208, 40, 255), fill=(255, 208, 40, 60), width=3)
    draw_pill(odraw, P2_X + 16, P2_Y + 12, "TRUE FINALE PORTAL (Tile 15)", "WARPS TO LEVEL 16 GRAND FINALE!", color=(255, 208, 40, 255))
    odraw.line([(P2_X + 180, P2_Y + 52), (tx1 + 20, ty1 + 15)], fill=(255, 208, 40, 255), width=2)

    # 2. Electric Wire Hazard indicator
    wx1, wy1, wx2, wy2 = p2_box(10, 44, 4, 1)
    odraw.rectangle([(wx1, wy1), (wx2, wy2)], outline=(0, 229, 255, 180), width=1)
    draw_pill(odraw, P2_X + 16, P2_Y + P_H - 65, "ELECTRIC HAZARD", "Time jump over crawling spark", color=(0, 229, 255, 255))

    final = Image.alpha_composite(canvas, overlay)
    
    # Save both to root and artifact directory
    final.save(os.path.join(artifact_dir, "level10_decoy_trap.png"))
    final.save(os.path.join(root_dir, "level10_decoy_trap.png"))
    print("Successfully generated clean two-panel level10_decoy_trap.png!")

render_clean_photo_4()
