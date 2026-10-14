with open('original-source/PACKRAT.EXE', 'rb') as f:
    exe = f.read()

# Let's search for references to 0xB62E (the tile pointer table)
# In 16-bit real mode, the offset 0xB62E is bytes 2E B6 in little-endian
pos = 0
found = []
while True:
    pos = exe.find(b'\x2E\xB6', pos)
    if pos == -1:
        break
    found.append(pos)
    pos += 2

print(f"Found {len(found)} occurrences of 0xB62E in exe: {[hex(p) for p in found]}")

# Let's inspect code around each occurrence
for p in found:
    print(f"\n--- Code around 0x{p:05X} ---")
    chunk = exe[max(0, p-16) : min(len(exe), p+32)]
    print(chunk.hex(' '))
