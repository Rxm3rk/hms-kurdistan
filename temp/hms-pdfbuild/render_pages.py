"""Render selected PDF pages to PNG for visual checking: render_pages.py <pdf> <outdir> <dpi> <page> [<page> ...]"""

import pathlib
import sys

import pymupdf

pdf, outdir, dpi = sys.argv[1], pathlib.Path(sys.argv[2]), int(sys.argv[3])
outdir.mkdir(parents=True, exist_ok=True)
doc = pymupdf.open(pdf)
for n in (int(x) for x in sys.argv[4:]):
    pix = doc[n - 1].get_pixmap(dpi=dpi)
    out = outdir / f"page-{n:03d}.png"
    pix.save(out)
    print(out)
