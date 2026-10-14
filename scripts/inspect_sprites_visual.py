from PIL import Image

for idx in [11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 54, 55, 60, 61]:
    # Find the file
    import glob
    files = glob.glob(f"scripts/entry_{idx:02d}_*.png")
    if files:
        img = Image.open(files[0])
        # Scale up 4x for easier inspection
        scaled = img.resize((img.width * 4, img.height * 4), Image.NEAREST)
        scaled.save(f"scripts/inspect_{idx:02d}.png")
        print(f"Processed entry {idx}: {files[0]} -> size {img.size}")
