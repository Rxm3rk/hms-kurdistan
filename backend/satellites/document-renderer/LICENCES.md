# Licences of the document renderer's runtime

Every component the renderer satellite runs with, its licence as the package declares it, and its status under the licence policy (BUILD-PROMPT.md §4.3; `tools/licence/policy.yaml`). Checked on 19 October 2026 against the wheel metadata and licence files of the pinned wheels (`requirements.txt`), the MSYS2 repository database entries of the pinned packages (`runtime/msys2-ucrt64.lock.json`), and the font directory's `fonts.json`.

**Scope today: build-only.** On the build host the runtime renders the PDF golden images and the module's test documents; nothing here is shipped (DN-066, default in use). `tools/licence/policy.yaml` checks build-only components for use restrictions only: none below has a use restriction, a denylisted licence or a named exclusion. **Shipping the satellite to a site waits for DN-066**, because several components carry licences the shipped allowlist does not name: Pillow (MIT-CMU), FreeType (FTL, inside the Pillow and pypdfium2 wheels and the Windows runtime), cffi (MIT-0), and in the Windows runtime libpng, bzip2, fontconfig, zlib and the GCC runtime libraries. In the planned container (`Dockerfile`), Pango, HarfBuzz, FreeType and fontconfig are Debian packages (the policy's `os-packages` conditional rule); the Python wheels stay wheels.

Policy status values: **allowlisted** (on `allowed` in policy.yaml); **not named** (permissive, but not on the shipped allowlist; acceptable build-only, needs DN-066 to ship); **conditional** (allowed only under a condition of `conditional` in policy.yaml).

## Python wheels (requirements.txt)

| Package | Version | Licence as declared | Policy status | Scope | Notes |
|---|---|---|---|---|---|
| weasyprint | 70.0 | BSD-3-Clause (classifier "BSD License"; LICENSE: BSD 3-Clause) | allowlisted | build-only | The renderer (ADR-038) |
| pydyf | 0.13.0 | BSD-3-Clause (classifier; LICENSE: BSD 3-Clause) | allowlisted | build-only | PDF writer used by WeasyPrint |
| cffi | 2.1.1 | MIT-0 (License-Expression) | not named (MIT-0 is on the build-only list only) | build-only | Calls Pango, HarfBuzz and fontconfig |
| pycparser | 3.11 | BSD-3-Clause | allowlisted | build-only | Via cffi |
| tinyhtml5 | 2.1.0 | MIT (classifier) | allowlisted | build-only | HTML parser |
| tinycss2 | 1.5.1 | BSD-3-Clause (classifier; LICENSE: BSD 3-Clause) | allowlisted | build-only | CSS parser |
| cssselect2 | 0.10.1 | BSD-3-Clause (classifier; LICENSE: BSD 3-Clause) | allowlisted | build-only | CSS selectors |
| webencodings | 0.6.1 | BSD-3-Clause (classifier; LICENSE: BSD 3-Clause) | allowlisted | build-only | |
| pyphen | 0.18.1 | GPL-2.0-or-later OR LGPL-2.1-or-later OR MPL-1.1 (classifiers; COPYING.GPL, COPYING.LGPL, COPYING.MPL) | allowlisted under its LGPL-2.1-or-later option | build-only | Hyphenation; its bundled dictionaries carry their own (LGPL/MPL/GPL-family) licences; record the chosen option as an ORT curation before shipping |
| pillow | 13.0.0 | MIT-CMU (License-Expression); the Windows wheel bundles brotli 1.2.0 (MIT), FreeType 2.14.3 (FTL OR GPL-2.0-or-later), HarfBuzz 14.5.0 (MIT), lcms2 2.19.1 (MIT), libavif 1.4.2 (BSD-2-Clause), libjpeg-turbo 3.2.0 (IJG AND BSD-3-Clause AND Zlib), libpng 1.6.58 (libpng-2.0), libwebp 1.6.0 (BSD-3-Clause), OpenJPEG 2.5.4 (BSD-2-Clause), libtiff 4.7.2 (libtiff), xz 5.8.4 (0BSD), zlib-ng 2.3.3 (Zlib) | not named (MIT-CMU; FTL and others inside) | build-only | Required by WeasyPrint; also writes the golden PNGs |
| fonttools | 4.67.0 | MIT (License; LICENSE and LICENSE.external) | allowlisted | build-only | WeasyPrint's font subsetting; the satellite's character-map check |
| brotli | 1.2.0 | MIT | allowlisted | build-only | Via fonttools[woff] |
| zopfli | 0.4.3 | Apache-2.0 | allowlisted | build-only | Via fonttools[woff] |
| pypdfium2 | 5.14.0 | "BSD-3-Clause, Apache-2.0, dependency licenses": the bindings Apache-2.0 OR BSD-3-Clause; the bundled PDFium build 8076 BSD-3-Clause, with abseil (Apache-2.0), AGG 2.3 (BSD-3-Clause-like), fast_float (MIT OR Apache-2.0 OR BSL-1.0), FreeType (FTL), ICU (Unicode/ICU), lcms2 (MIT), libjpeg-turbo (IJG AND BSD-3-Clause AND Zlib), OpenJPEG (BSD-2-Clause), libpng (libpng-2.0), LLVM libc (Apache-2.0 WITH LLVM-exception), simdutf (Apache-2.0 OR MIT), zlib (Zlib); documentation CC-BY-4.0 | not named (FTL, ICU and others inside) | build-only (golden step only) | The golden rasteriser (§10); never part of a render |
| zxing-cpp | 3.1.1 | Apache-2.0 (License-Expression; LICENSE: Apache License 2.0, read from the wheel) | allowlisted | build-only (golden step only) | The independent barcode decoder (§6.2); latest stable on PyPI with cp312 wheels on 19 October 2026 (cp312-abi3 win_amd64 and manylinux_2_28 x86_64); no Python dependencies |
| zstandard | 0.25.0 | BSD-3-Clause (License-Expression; bundles zstd, BSD-3-Clause OR GPL-2.0) | allowlisted | build-only (bootstrap.py on Windows only) | Decompresses the MSYS2 packages |

The target's own `pip` comes from CPython's `ensurepip` (bundled with Python 3.12.10, MIT), not from a download.

## Windows runtime (MSYS2 UCRT64, runtime/msys2-ucrt64.lock.json)

Licences as the MSYS2 repository database declares them (`%LICENSE%`). Only the DLLs listed in the lock are extracted.

| Package | Version | Licence as declared | Policy status | Scope | DLLs |
|---|---|---|---|---|---|
| pango | 1.58.2-1 | LGPL-2.1 (spdx:LGPL-2.1) | allowlisted | build-only | libpango-1.0-0, libpangoft2-1.0-0 |
| harfbuzz | 14.6.0-1 | MIT | allowlisted | build-only | libharfbuzz-0, libharfbuzz-subset-0, libharfbuzz-vector-0 |
| fontconfig | 2.18.3-1 | custom (the fontconfig licence, MIT-style / HPND-sell-variant) | not named | build-only | libfontconfig-1 |
| freetype | 2.15.0-1 | GPL-2.0-or-later OR FTL | not named (FTL option; the GPL option is copyleft) | build-only | libfreetype-6 |
| fribidi | 1.0.17-1 | LGPL-2.1-or-later | allowlisted | build-only | libfribidi-0 |
| glib2 | 2.90.1-1 | LGPL-2.1-or-later | allowlisted | build-only | libglib-2.0-0, libgobject-2.0-0, libgio-2.0-0, libgmodule-2.0-0 |
| graphite2 | 1.3.15-1 | LGPL-2.1-or-later | allowlisted | build-only | libgraphite2 |
| libthai | 0.1.30-1 | LGPL-2.1-or-later | allowlisted | build-only | libthai-0 |
| libdatrie | 0.2.14-1 | LGPL | allowlisted (LGPL family) | build-only | libdatrie-1 |
| gettext-runtime | 1.0-1 | GPL-3.0-or-later AND LGPL-2.1-or-later (the package; libintl is LGPL-2.1-or-later) | allowlisted for libintl | build-only | libintl-8 |
| libiconv | 1.19-1 | LGPL-2.1-or-later (documentation GPL-3.0-or-later) | allowlisted | build-only | libiconv-2 |
| pcre2 | 10.49-1 | BSD-3-Clause | allowlisted | build-only | libpcre2-8-0 |
| libffi | 3.8.0-1 | MIT | allowlisted | build-only | libffi-8 (extracted; at run time CPython's own `DLLs\libffi-8.dll`, MIT, is loaded first and serves GLib; its SHA-256 is pinned in runtime.json) |
| expat | 2.9.0-1 | MIT | allowlisted | build-only | libexpat-1 |
| brotli | 1.2.0-1 | MIT | allowlisted | build-only | libbrotlicommon, libbrotlidec |
| bzip2 | 1.0.8-4 | custom (the bzip2 licence, BSD-style) | not named | build-only | libbz2-1 |
| libpng | 1.6.59-1 | custom (libpng-2.0) | not named | build-only | libpng16-16 |
| zlib | 1.3.2-2 | Zlib | not named (build-only list only) | build-only | zlib1 |
| libwinpthread | 14.0.0.r495.g63ebe6cdb-1 | MIT AND BSD-3-Clause | allowlisted | build-only | libwinpthread-1 |
| libgcc | 16.2.0-6 | GPL-3.0-or-later WITH GCC-exception-3.1 AND GFDL-1.3-or-later (the package; the DLL is under the GCC Runtime Library Exception) | not named | build-only | libgcc_s_seh-1 |
| libstdc++ | 16.2.0-6 | GPL-3.0-or-later WITH GCC-exception-3.1 AND GFDL-1.3-or-later (as libgcc) | not named | build-only | libstdc++-6 |

## Linux runtimes

- **Build host (Ubuntu 24.04 in WSL, DN-067):** Pango, HarfBuzz, fontconfig and FreeType from the distribution's packages, installed by the host owner; not redistributed. The wheels are the manylinux ones pinned in `requirements.txt` (the Linux Pillow wheel bundles its libraries under `pillow.libs/`, licences as for the Windows wheel).
- **Container (`Dockerfile`, written, not built):** Debian packages `libpango-1.0-0`, `libpangoft2-1.0-0`, `libharfbuzz0b`, `libharfbuzz-subset0`, `libfontconfig1`, `libfreetype6` and their dependencies: unmodified operating-system packages inside a base image, policy status **conditional** (`os-packages`), to be listed in the image's SBOM when it is built (WP-0.9). The base image's CPython 3.12 (PSF-2.0) is likewise part of the base image.

## Fonts

The four print fonts (Noto Sans and Noto Sans Arabic, regular and bold) are OFL-1.1 (allowlisted, fonts), pinned in the module's `fonts.json` with `OFL.txt` beside them (docs/specs/modules/platform-docs.md §9). Subsets of them are embedded in every PDF, as OFL-1.1 permits.
