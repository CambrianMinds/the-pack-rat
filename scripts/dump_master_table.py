import struct
from PIL import Image

with open('original-source/PACKRAT.EXE', 'rb') as f:
    exe = f.read()

ds_base = 141024
pal_raw = exe[ds_base+0x42 : ds_base+0x42+768]
palette = []
for i in range(256):
    palette.append((int(pal_raw[i*3] * 255 / 63),
                    int(pal_raw[i*3+1] * 255 / 63),
                    int(pal_raw[i*3+2] * 255 / 63)))

tile_table_file = ds_base + 0xB62E
for i in range(62):
    off, seg = struct.unpack_from('<HH', exe, tile_table_file + i * 4)
    if seg == 0x21CE:
        fpos = ds_base + off
        w, h = struct.unpack_from('<HH', exe, fpos)
        px_bytes = exe[fpos+4 : fpos+4+w*h]
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        px = img.load()
        non_zero = 0
        for idx, b in enumerate(px_bytes):
            if b != 0:
                rgb = palette[b]
                px[idx % w, idx // w] = (rgb[0], rgb[1], rgb[2], 255)
                non_zero += 1
        img.save(f"scripts/entry_{i:02d}_{w}x{h}.png")
        print(f"Saved entry_{i:02d}_{w}x{h}.png (non-zero: {non_zero})")
