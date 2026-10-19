import sys
from pathlib import Path
p = Path(sys.argv[1]); b = p.read_bytes()
b = b.replace(b"wp05\x0c", b"wp05\f").replace(b"wp05\x0d", b"wp05\r")
p.write_bytes(b)
