import struct
import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, '..')) if os.path.basename(script_dir) == 'scripts' else script_dir

def find_source(name):
    candidates = [
        os.path.join(root_dir, 'original-source', name),
        os.path.join(root_dir, name),
        name
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    raise FileNotFoundError(f"Cannot find {name}")

with open(find_source('PACKRAT.EXE'), 'rb') as f:
    exe = f.read()

with open(find_source('PACKRAT.001'), 'rb') as f:
    dat = f.read()

ds_base = 141024

# 1. Palette
pal_raw = exe[ds_base+0x42 : ds_base+0x42+768]
palette = []
for i in range(256):
    r = int(pal_raw[i*3] * 255 / 63)
    g = int(pal_raw[i*3+1] * 255 / 63)
    b = int(pal_raw[i*3+2] * 255 / 63)
    palette.append([r, g, b])

# 2. Decompress all 16 levels
class Decoder:
    def __init__(self, stream, order=10):
        self.stream = stream
        self.pos = 0
        self.buf_byte = 0
        self.bits_left = 0
        self.code = 0
        self.range = 1
        self.mask = (1 << order) - 1
        self.table = bytearray([2] * (1 << order))
        self.context = 0

    def read_byte(self):
        if self.pos < len(self.stream):
            b = self.stream[self.pos]
            self.pos += 1
            return b
        return 0

    def decode(self, num_bytes):
        out = bytearray(num_bytes)
        for i in range(num_bytes):
            val_byte = 0
            for bit_pos in range(7, -1, -1):
                val = self.table[self.context]
                n0 = (val >> 1) + 1
                p0 = 1 if (val & 1) else (n0 - 1)

                while self.range < 0x80:
                    if self.bits_left == 0:
                        self.buf_byte = self.read_byte()
                        self.bits_left = 8
                    self.bits_left -= 1
                    bit = (self.buf_byte >> self.bits_left) & 1
                    self.code = ((self.code << 1) + bit) & 0xFFFF
                    self.range = (self.range << 1) & 0xFFFF

                split = (p0 * self.range + (n0 >> 1)) // n0
                test_val = (((self.code << 1) + 1) * n0 - 1) // (self.range << 1)

                if test_val < p0:
                    di = 0
                    self.range = split
                else:
                    di = 1
                    self.code = (self.code - split) & 0xFFFF
                    self.range = (self.range - split) & 0xFFFF

                val_byte |= (di << bit_pos)

                old_val = self.table[self.context]
                if (old_val & 1) == di:
                    new_val = old_val + 2 if old_val < 0x3E else old_val
                else:
                    new_val = (di + 4) if ((old_val & 0xFE) == 2) else (((old_val & 0xFD) >> 1) - di + 1)
                self.table[self.context] = new_val & 0xFF
                self.context = ((self.context << 1) + di) & self.mask

            out[i] = val_byte
        return out

levels = []
pos = 0
lvl = 0
while pos < len(dat):
    size = struct.unpack_from('<H', dat, pos)[0]
    stream = dat[pos+2:pos+2+size]
    decomp = Decoder(stream).decode(0x3004)
    hdr = list(decomp[:4])
    dest_bytes = decomp[4:4+8192]
    tiles = decomp[4+8192:4+12288]
    dest_map = [dest_bytes[i*2] | (dest_bytes[i*2+1] << 8) for i in range(4096)]
    levels.append({
        'id': lvl,
        'bg': hdr[0],
        'startX': hdr[1],
        'startY': hdr[2],
        'tiles': list(tiles),
        'destMap': dest_map
    })
    pos += 2 + size
    lvl += 1

# 3. Sounds
sound_table_off = ds_base + 0x4C5A
sounds = []
for i in range(13):
    off, seg = struct.unpack_from('<HH', exe, sound_table_off + i * 4)
    file_pos = ds_base + off
    notes = []
    p = file_pos
    while p + 4 <= len(exe):
        dur, freq = struct.unpack_from('<HH', exe, p)
        if dur == 0 and freq == 0:
            break
        notes.append({'dur': dur, 'freq': freq})
        p += 4
        if len(notes) > 50:
            break
    sounds.append(notes)

# 4. Tiles (Authentic entries 1..61 in PACKRAT.EXE master table)
tile_table_file = ds_base + 0xB62E
tiles = {}
for tile_id in range(1, 62):
    off, seg = struct.unpack_from('<HH', exe, tile_table_file + tile_id * 4)
    if seg == 0x21CE:
        fpos = ds_base + off
        w, h = struct.unpack_from('<HH', exe, fpos)
        if 0 < w <= 64 and 0 < h <= 64:
            px = list(exe[fpos+4 : fpos+4+w*h])
            tiles[tile_id] = {'w': w, 'h': h, 'pixels': px}

# 5. Enemy rat sprites
enemy_frames = []
for off in [0xA380, 0xA564, 0xA748, 0xA92C]:
    fpos = ds_base + off
    w, h = struct.unpack_from('<HH', exe, fpos)
    px = list(exe[fpos+4 : fpos+4+w*h])
    enemy_frames.append({'w': w, 'h': h, 'pixels': px})

# 6. Rat animation frames (Entries 44..53 and 36..43)
rat_frames = []
for off in [
    0x4C8E, 0x4EFE, 0x516E, 0x53FE, 0x568E, 0x58FE, 0x5B6E, 0x5DFE,
    0x608E, 0x631E, 0x65AE, 0x681E, 0x6A8E, 0x6D1E, 0x6FAE,
    0x721E, 0x748E, 0x771E
]:
    fpos = ds_base + off
    w, h = struct.unpack_from('<HH', exe, fpos)
    px = list(exe[fpos+4 : fpos+4+w*h])
    rat_frames.append({'w': w, 'h': h, 'pixels': px})

# 7. Authentic electric spark frames (Entries 60 & 61 at DS:0xB356 & DS:0xB45A)
spark_frames = []
for off in [0xB356, 0xB45A]:
    fpos = ds_base + off
    w, h = struct.unpack_from('<HH', exe, fpos)
    px = list(exe[fpos+4 : fpos+4+w*h])
    spark_frames.append({'w': w, 'h': h, 'pixels': px})

output_data = {
    'palette': palette,
    'levels': levels,
    'sounds': sounds,
    'tiles': tiles,
    'enemyFrames': enemy_frames,
    'ratFrames': rat_frames,
    'sparkFrames': spark_frames
}

out_assets = os.path.join(root_dir, 'assets.js')
with open(out_assets, 'w', encoding='utf-8') as f:
    f.write('// The Pack Rat (1992 by Steve Blanding) - Extracted Authentic Game Assets\n')
    f.write('window.PACKRAT_ASSETS = ' + json.dumps(output_data) + ';\n')

print('Success! Wrote assets.js, size:', os.path.getsize(out_assets), 'bytes')
