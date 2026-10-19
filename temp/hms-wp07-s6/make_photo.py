"""Writes a synthetic stand-in for a registration photo: an abstract pattern, not a face (§18.10)."""
import struct, sys, zlib

W, H = 96, 120
bg = (0xD9, 0xE2, 0xEC)
band = (0x9F, 0xB3, 0xC8)
dot = (0x52, 0x60, 0x6D)
rows = []
for y in range(H):
    row = bytearray([0])
    for x in range(W):
        c = bg
        if (x + y) // 12 % 2 == 0:
            c = band
        dx, dy = x - W // 2, y - H // 2
        if dx * dx + dy * dy < 22 * 22:
            c = dot
        row += bytes(c)
    rows.append(bytes(row))
raw = b"".join(rows)

def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
open(sys.argv[1], "wb").write(png)
print(len(png))
