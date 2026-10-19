# Document renderer satellite (`hms_docrender`)

HTML with CSS paged media in, PDF/A-2b out, and nothing ever fetched from a network. Correct Sorani and Arabic shaping is a design goal until the human script review is signed (KA-080): the golden images prove the output did not change, not that it is right. The satellite of `platform-docs` (docs/specs/modules/platform-docs.md §1, §7.5, §9, §10; ADR-038 accepted-provisional; ADR-003). It uses WeasyPrint 70.0 with Pango and HarfBuzz. The module (`backend/modules/platform-docs`) writes the HTML and calls the satellite's command line through `DocumentRendererPort` (§7.5). Production wiring has no satellite until the cell exists, so a production document print is refused with `print.refused.rendererUnavailable` (KA-083).

Everything here is synthetic and NOT FOR CLINICAL USE until approved content replaces it (§19.4).

| Path | What it is |
|---|---|
| `hms_docrender/` | The package: `contract` (request and result, schema validation without WeasyPrint), `fonts` (the one font directory, the SHA-256 check against `fonts.json` and the satellite's pins, the R7/R8 character check), `fetcher` (offline resource fetcher), `checks` (the checks inside a render: the parsed document, every laid-out and drawn text run, the font sources, the PDF), `env` (the hermetic environment), `render` (library entry point and socket guard), `identity` (renderer identity), `__main__` (command line) |
| `hms_docrender/golden/` | The PDF golden-image harness (§10) and its self-test fixtures `selftest-fixtures/` |
| `contract/` | `render-request.schema.json` and `render-result.schema.json` (JSON Schema 2020-12), contract version 1 |
| `requirements.in`, `requirements.txt` | The top-level pins and the full hash-pinned closure (Windows cp312 win_amd64 and manylinux x86_64 wheels) |
| `runtime/msys2-ucrt64.lock.json` | The 21 MSYS2 UCRT64 packages of the Windows runtime: file, URL, SHA-256, version, licence, and each extracted DLL's SHA-256 |
| `bootstrap.py` | Builds a runtime (standard library only) |
| `Dockerfile` | The container (written, not built) |
| `LICENCES.md` | Every component's licence and policy status |
| `tests/` | Unit tests (`unittest`) |

## Contract (version 1)

`python -I -m hms_docrender render --out out.pdf [--request req.json]` reads one JSON request from standard input (or `--request FILE`), writes the PDF to `--out` and one JSON result line to standard output. No network listener exists.

- **Request** (`contract/render-request.schema.json`, all fields required, nothing else allowed): `contractVersion` 1, `html` (the whole document, UTF-8), `pdfVariant` `"pdf/a-2b"` (the only value), `title` (R7: no control, format other than ZWNJ, ZWJ and ZWSP, surrogate or unassigned code point; NFC; it goes into the XMP packet, which must stay well-formed), `templateId`, `templateVersion`, `templateContentHash` (SHA-256 hex), `provenance` (`synthetic` or `approved`), `language` (`en`, `ckb`, `ar`, `ku-Arab`), `createdAt` (ISO 8601 to the second with `Z` or an offset).
- **Result** (`contract/render-result.schema.json`): `status` `rendered` with `out`, `bytes`, `sha256`, `pageCount`, `rendererIdentity`, `identityHash`; or `refused` / `failed` with `code` and `detail`; or `invalid` with `errors`.
- **Exit codes:** 0 rendered, 1 failed (`render-error`, `runtime-error`), 2 usage error, 3 invalid request, 4 refused (`resource-refused`, `network-attempt`, `font-integrity`, `unrenderable-text`). The PDF appears at `--out` only on success (written beside it, then renamed); a file already at `--out` is removed first, so a refusal or failure never leaves an older PDF there. Every outcome, an unexpected exception included, ends with one JSON line.
- **Refusal details** are fixed reason codes and counts (for example `layout: r7-uncovered=1, r8-eastern-digit=3`, `scheme-not-allowed:https`, `attachment-link=1`, `weasyprint: image-load-failed=1`), never the document's text, a URL or a WeasyPrint message (they quote the document; SI-20). R7 codes: `r7-control`, `r7-format`, `r7-surrogate`, `r7-not-nfc`, `r7-mark-without-base`, `r7-uncovered`, `r7-unknown-glyph`, `r7-font-outside-chain`, `r7-bidi-markup`; R8: `r8-eastern-digit` (the module maps it to `print.refused.easternDigits`). A caller must still not log `detail` with patient context.
- **In the PDF:** title, `/Lang`, creation and modification dates come from the request, never from the HTML or the clock; the keywords carry `hms-template-id`, `hms-template-version`, `hms-template-sha256` and `hms-provenance`. Same request on the same renderer identity, same bytes (`UnitTest:pdf-deterministic`).
- **Library form:** `hms_docrender.render.render(RenderRequest) -> RenderResult(pdf, sha256, page_count, renderer_identity, identity_hash)`, raising `RenderRefused` or `RenderFailed`.
- **Why PDF/A-2b only:** the PDF's text layer is not reliable for Sorani (glyphs that `ccmp` decomposes have gaps in their ToUnicode maps, so extracted text is garbled), so the "U" (Unicode) levels are not claimed.

## Offline only (§3.7, §7.5, HAZ-0047)

- The fetcher resolves exactly `hms-font:<name>` for the four print-font names (`noto-sans-arabic-regular`, `noto-sans-arabic-bold`, `noto-sans-regular`, `noto-sans-bold`), from the bytes already verified against `fonts.json`, and `data:` URLs of the inline image types `image/png`, `image/jpeg` and `image/svg+xml` whose body starts like that type (PNG signature, JPEG SOI, XML or `<svg`). Every other `data:` type (a stylesheet, a font, text, PDF) and any body with a font signature (sfnt, `OTTO`, `ttcf`, `true`, `wOFF`, `wOF2`) is refused. Everything else (`http:`, `https:`, `file:`, `ftp:`, relative and protocol-relative references, any other scheme, any `hms-font:` value that is not exactly a name: no paths, `..`, percent-encoding, query or fragment) is refused by raising a fatal error, which fails the render.
- An `@font-face` source that is not `hms-font:` (`data:`, `local()`, anything else) is refused before anything is fetched: WeasyPrint's font loader ignores media types, so a `data:` font would bypass the pins (`checks.pinned_font_configuration`).
- No attachment: a `rel` naming `attachment` is refused, and a written PDF that holds `/Filespec`, `/EmbeddedFile` or `/FileAttachment` fails (WeasyPrint would embed the file stamped with the clock time, which breaks determinism and PDF/A-2b).
- During a render a socket guard makes Python-level socket creation (`socket.socket`, `_socket.socket`, `socketpair`, `fromfd`), `connect`, `connect_ex`, `bind`, `listen`, `sendto`, `sendmsg`, `getaddrinfo`, `getnameinfo`, `gethostbyname*`, `gethostbyaddr`, `create_connection` and `create_server` raise and records the attempt, so even an attempt some library swallowed fails the render (`UnitTest:renderer-opens-no-socket`). It covers Python code only (a native library could open a socket itself); the real control is the container's network: run it with `--network none` (Dockerfile header; §7.5 "no egress").
- WeasyPrint's `.notdef` warning (a missing glyph) refuses as `unrenderable-text`; its error-level messages and the warnings that mean a stylesheet, image or font failed to load fail the render.

## Hermetic fonts and text (§7.5, §9, R7)

- The one font directory is the module's `backend/modules/platform-docs/src/main/resources/hms/platform/docs/fonts/` (override: `HMS_DOCRENDER_FONT_DIR` or `--font-dir`; the container sets it to its copy; a child render started with `env.subprocess_env` keeps the override). Before each render every font file is hashed and compared with `fonts.json` (a list of `{"file", "sha256", ...}` objects, or `{"fonts": [...]}`) and with the satellite's own copy of the four pins (`fonts.PINNED_FONT_SHA256`, a test keeps it equal to the module's `fonts.json`), so another font directory with a matching `fonts.json` is refused too; a mismatch, a missing file or a missing entry refuses. The module's adapter should also compare the font SHA-256s in `rendererIdentity` with its own `fonts.json`.
- fontconfig runs from the runtime's own `fontconfig/fonts.conf`, which has no `<dir>` and no `<include>`: no system font is visible, so no system font can stand in for a missing glyph.
- R7 and R8 for all text (§3.2), checked three times, because WeasyPrint draws text the HTML never spells out (its own parser keeps `<xmp>` and `<plaintext>` content as text; `attr()`, counters and list markers in any counter style, `<input value>`, SVG `<text>` in images):
  1. before WeasyPrint is loaded, on the HTML's text nodes and CSS `content` strings;
  2. after layout, on every text box of every page (absolutely positioned boxes, list markers and page-margin boxes included), with the shaped glyphs;
  3. while the PDF is written, on every line WeasyPrint draws (HTML and SVG text).
  Each run of text must be in Unicode NFC, must not start with a combining mark (a mark split from its base by markup), and the runs joined must be NFC too; no control character, unpaired surrogate, or format character other than ZWNJ, ZWJ and ZWSP; no Arabic-Indic (U+0660–0669) or Extended Arabic-Indic (U+06F0–06F9) digit (R8); every character in the four fonts' character maps; no missing glyph (Pango's unknown-glyph flag or glyph 0); and every glyph from a font named in its element's own `font-family` chain (R7 "a glyph in its element's font chain"; a generic family such as `serif` names no print font, so an element must name its print fonts). The parsed document must hold no `<bdo>` and no `bidi-override`, `isolate-override` or `unicode-bidi: plaintext` (as the module's `HtmlLint`). The refusal names reason codes and counts, never the text.
- Linux and macOS: a process started with `LD_PRELOAD`, `LD_LIBRARY_PATH` or another `LD_*` / `DYLD_*` variable is refused (the loader read them before anything could remove them); start renders with a clean environment (`env.subprocess_env`, as the golden harness does).

## Runtime per host

A runtime is a virtual environment made by `bootstrap.py`; `runtime.json` in it records the versions of everything that draws (part of the renderer identity, §10). `bootstrap.py` is idempotent: a second run re-verifies every installed file against its RECORD hash and every DLL against the lock, refuses any site-packages file no RECORD lists (a planted `.pth`, `sitecustomize.py` or shadow module; only its own `.pth` and byte code are allowed), and repairs only what is missing or wrong. A runtime bootstrapped before FriBidi joined the identity must be bootstrapped again (the renderer refuses until `runtime.json` records it). Downloads: PyPI and repo.msys2.org only, every file verified by SHA-256.

- **Windows host:** a project-local runtime. Python packages from PyPI; Pango, HarfBuzz, fontconfig, FreeType, GLib and their imports from the pinned MSYS2 UCRT64 packages, extracted (only the listed `ucrt64/bin` DLLs) into `<runtime>/pango/bin`; loaded through `WEASYPRINT_DLL_DIRECTORIES` with `PATH` reduced to the Windows system directories. No system change. After WeasyPrint's import every loaded DLL of the lock is checked to come from `pango/bin` with its pinned SHA-256. One exception, pinned too: CPython's own `DLLs\libffi-8.dll` (loaded for `ctypes`) serves GLib's `libffi-8.dll` import, so the renderer loads `ctypes` first to make that binding the same every time, and runtime.json pins that file's SHA-256 (`base_interpreter_dlls`).
- **Linux build host (Ubuntu 24.04 in WSL):** the distribution's Pango libraries, which is a system change for the host owner (DN-067): `sudo apt-get update && sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fontconfig`; then `bootstrap.py` installs the manylinux wheels project-locally. `bootstrap.py` never installs system packages; without them it stops with that command. Golden images are kept per renderer identity, so the Linux runtime gets its own approved set.
- **Container:** `Dockerfile`, Debian stable (trixie) slim with CPython 3.12 from the official Python image, Pango and HarfBuzz from Debian packages, non-root, fonts copied from the module directory, no network. Written, not built (WP-0.2 builds it).

Licences: Pillow (MIT-CMU) and FreeType (FTL) are not on the §4.3 allowlist, nor are cffi (MIT-0) and several Windows-runtime libraries, so **shipping waits for DN-066**; on the build host the runtime is build-only. Details: `LICENCES.md`.

## Commands

Bootstrap (on this Windows host use `--target build/docrender-runtime`; the default `<repo>/.tools/docrender` needs a writable `.tools/`):

```sh
.tools/venv/Scripts/python.exe -I backend/satellites/document-renderer/bootstrap.py --target build/docrender-runtime   # Windows
.tools/venv/bin/python -I backend/satellites/document-renderer/bootstrap.py --target build/docrender-runtime           # Linux
```

Render, identity, runtime check (`R` is the runtime's interpreter: `build/docrender-runtime/Scripts/python.exe` on Windows, `build/docrender-runtime/bin/python` on Linux):

```sh
$R -I -m hms_docrender render --out out.pdf < request.json
$R -I -m hms_docrender identity
$R -I -m hms_docrender doctor
```

Tests:

```sh
$R -I -m unittest discover -s backend/satellites/document-renderer/tests -t backend/satellites/document-renderer
```

Tests that need the print fonts skip, naming the missing file, until the font directory is complete. Every other test needs the runtime and fails without it.

## Golden images (§10; the nightly `golden-image-print` step)

```sh
$R -I -m hms_docrender.golden check --fixtures DIR --goldens DIR --candidates DIR [--pdf-out DIR] [--report FILE] [--decode-dpi N]
$R -I -m hms_docrender.golden approve --candidates DIR --goldens DIR --approver NAME [--identity-hash H] [--replace-existing] [--accept-identity-change]
```

- `check` renders every `*.html` in `--fixtures` with the command line (a fresh hermetic process per fixture), rasterises each page with pypdfium2 at 150 dpi in 8-bit grey, and compares it pixel for pixel with `<goldens>/<identity-hash>/<fixture>-p<n>.png`. It decodes every barcode on every page with zxing-cpp from the symbol's raw bytes (plain text mode, never the human-readable form) and compares the multiset with the fixture's declared payloads; a payload that is not printable ASCII, a DataMatrix that is not a square plain ECC 200 symbol (`]d1`) or a Code 128 that is not plain (`]C0`) fails (§6.1). A missing set for the identity ("no approved golden images for <identity>"), a golden that does not match its manifest hash, a file in the set the manifest does not pin, a stale golden, any pixel difference, a page-count difference, a render failure or a barcode mismatch fails (exit 1). Then it writes candidates, difference images (differing pixels in red over the golden) and `manifest.json` to `<candidates>/<identity-hash>/`. It never writes into the goldens directory (`--candidates`, `--pdf-out` and `--report` inside it are refused). Exit 0 only when everything matches; 3 when the runtime is missing ("renderer runtime missing", DN-067).
- **Identity change:** when the identity has no approved set but another identity has one (a WeasyPrint, Pango, HarfBuzz, FreeType or font upgrade, the most likely cause of joined forms turning into isolated ones), `check` also compares every page with the most recently approved set, reports the counts (`previousSet` in the summary, `previous_set` in the candidate manifest) and writes `<fixture>-p<n>.previous-diff.png`.
- `approve` is for a human or the integrator only. It copies a candidate set into `<goldens>/<identity-hash>/` with a manifest: each file's SHA-256, each fixture's template id, version and hash, the identity, `approved_by`, and `human_script_review: requested`. It refuses render or barcode failures, a candidate manifest whose file names are not `<fixture>-p<n>.png` inside the set (numbered 1 to the page count), and replacing an existing different set without `--replace-existing`. It refuses a new identity while another has an approved set unless `--accept-identity-change` is given (after a human compared the `*.previous-diff.png` images) and the check compared the candidates with the current last approved set; the change is recorded in the manifest (`identity_change`). A set approved by an agent is regression evidence only; a Sorani and Arabic reader signs the first set and every change to an identity-text golden (KA-080).
- veraPDF (`PdfaCheck:veraPDF-2b`) is the `pdfa-verify` satellite's job: run it on the PDFs written by `--pdf-out`.

**Fixture metadata convention** (`<meta name=... content=...>` in the fixture's head):

- `hms.barcode.payloads`: every barcode the document carries, as space-separated `<symbology>:<payload>` tokens. Symbology is one of `datamatrix`, `code128`, `qrcode`, `pdf417` or `aztec`. The payload runs to the next space; §6.1 payloads are printable ASCII without spaces. Example: `<meta name="hms.barcode.payloads" content="datamatrix:HMS1|M:SYN-000123-7|E:SYN-E-000045|B:SYN-J-000001 code128:SYN-S-000077">`. Empty content means no barcode. A fixture without the element must contain no barcode.
- `hms.template.id`, `hms.template.version`, `hms.template.hash`, `hms.template.provenance`, `dcterms.created`, `<title>`, `<html lang>`: the request's fields. Missing ones get fixed defaults, listed as `defaulted` in the manifest; they change only the PDF's metadata, never its pages.

**Renderer identity:** `hms-docrender-identity/1;hms_docrender=…;weasyprint=…;pydyf=…;fonttools=…;pillow=…;tinycss2=…;cssselect2=…;tinyhtml5=…;pyphen=…;pango=…;harfbuzz=…;freetype=…;fontconfig=…;fribidi=…;pypdfium2=…;pdfium=…;zxing-cpp=…;fontconfig-xml=<sha256>;source=<sha256>;font:<file>=<sha256>…`. `source` is a SHA-256 over every `hms_docrender` Python file and `requirements.txt` (line endings normalised), so any change to the satellite is an identity change and goes through the comparison above. The native versions are read from the libraries loaded in the process and must equal runtime.json. The identity hash (first 16 hex digits of its SHA-256) names the golden set. The operating system is not part of it (KA-086).

## Known limits

- The approximate date of birth uses `~` (§3.2 R5), which the Latin font covers; `≈` (U+2248) is in none of the four print fonts and is refused (`test_the_approximate_marker_is_in_the_print_fonts_and_the_old_one_is_not`). The self-test fixtures print `~1990` with the approximate caption in each row's language.
- WeasyPrint 70 does not implement the CSS `unicode-bidi` property (it ignores `isolate` with a warning); a Latin run inside an RTL line is laid out with its own `direction`, and the self-test banner prints `~1990` in the right order, but bidi isolation is not what keeps it so.
- Text extracted from the PDFs is not reliable for Sorani (see PDF/A-2b above). Use the golden images to check the output, not text extraction.
- Golden images are pinned to one renderer identity: a new WeasyPrint, Pango, HarfBuzz, FreeType, fontconfig, pypdfium2 or font file needs a newly approved set.
