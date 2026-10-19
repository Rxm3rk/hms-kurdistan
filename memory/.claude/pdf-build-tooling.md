---
name: pdf-build-tooling
description: "Where the PDF builder and the BUILD-PROMPT assembly/check tools live (in %TEMP%, outside the repo) and how to rerun them"
metadata:
  node_type: memory
  type: reference
  originSessionId: 8cdad8bc-affa-4f2f-8180-72c1832ed26b
  modified: 2026-10-18T11:24:35.015Z
---

All helper tooling is in `C:\Users\Surface\AppData\Local\Temp\` (a temp folder; it may be cleaned up). Nothing is in the repo.

**PDF builder** (`hms-pdfbuild\`)
- `build_pdf.py`: Markdown → HTML (marked + mermaid in-page) → PDF printed by Playwright driving the installed Chrome; cover, contents, bookmarks, "Page X of Y" footer, landscape pages for flowcharts. Run with `python -I`.
- `build_kurdistan.sh` regenerates BLUEPRINT-KURDISTAN.pdf; update the version/date in its `--meta` and `--footer` arguments when the edition changes.
- Vendored JS: `hms-vendor-marked\marked.umd.js` (15.0.12), `hms-vendor-mermaid\mermaid.min.js` (11.x).
- Checking: the Read tool can't render PDFs here (no pdftoppm). Render pages to PNG with the `hms-pdfcheck-venv` (pymupdf) and `hms-pdfbuild\render_pages.py <pdf> <outdir> <dpi> <pages...>`.

**BUILD-PROMPT assembly** (`hms-buildprompt\` and `hms-buildprompt-tools\`)
- `hms-buildprompt\part-*.md` are the source parts; `digest-01…08-*.md` the research digests; `review-accuracy.md` and `review-executability.md` the two independent reviews (all findings applied).
- `assemble.py <parts-dir> <out>` assembles the prompt (sorts §9 subsections) and checks section refs, feature IDs and SI numbers. Its "unresolved § refs" list is expected: they are K/BP/R source refs.
- `lint_md.py <md> <repo-root>` checks tables, headings, fences, links and placeholders.
- `gen_appendix_a.py` generated A.1–A.18 only. `part-11-appendixA.md` now has hand edits (A.19, A.20, AI-PAT-01 and CLN-CDS-03 notes), so don't regenerate it blindly.
- After assembling, copy `BUILD-PROMPT.assembled.md` to the repo root as `BUILD-PROMPT.md`.

If the folders are gone, recreate the same approach outside the repo; see [[project-phase]].
