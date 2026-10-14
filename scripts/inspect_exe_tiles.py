import struct

with open('original-source/PACKRAT.EXE', 'rb') as f:
    exe = f.read()

ds_base = 141024

# Let's inspect the tile pointer table at ds_base + 0xB62E
tile_table_file = ds_base + 0xB62E
print(f"Inspecting table at ds_base + 0xB62E (file pos {tile_table_file}):")
for i in range(60):
    off, seg = struct.unpack_from('<HH', exe, tile_table_file + i * 4)
    if seg == 0x21CE:
        fpos = ds_base + off
        if fpos + 4 <= len(exe):
            w, h = struct.unpack_from('<HH', exe, fpos)
            print(f"Entry {i:2d}: off=0x{off:04X}, size={w}x{h}")
        else:
            print(f"Entry {i:2d}: off=0x{off:04X} (out of bounds)")
    else:
        print(f"Entry {i:2d}: seg=0x{seg:04X}, off=0x{off:04X} (not 0x21CE)")
