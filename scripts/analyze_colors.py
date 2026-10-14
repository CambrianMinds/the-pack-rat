from PIL import Image

def analyze_img(path):
    img = Image.open(path)
    w, h = img.size
    px = img.load()
    colors = {}
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] > 0: # not transparent
                rgb = (c[0], c[1], c[2])
                colors[rgb] = colors.get(rgb, 0) + 1
    sorted_colors = sorted(colors.items(), key=lambda kv: kv[1], reverse=True)
    return w, h, sorted_colors

for idx in [11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 54, 55, 60, 61]:
    import glob
    files = glob.glob(f"scripts/entry_{idx:02d}_*.png")
    if files:
        w, h, cols = analyze_img(files[0])
        print(f"=== Entry {idx} ({w}x{h}) ===")
        for rgb, count in cols[:6]:
            print(f"  RGB {rgb}: {count} px")
