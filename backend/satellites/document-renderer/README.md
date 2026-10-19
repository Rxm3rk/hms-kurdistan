# Document renderer satellite (`hms_docrender`)

HTML with CSS paged media in, PDF/A-2b out, with correct Sorani and Arabic shaping, and nothing ever fetched from a network. The satellite of `platform-docs` (docs/specs/modules/platform-docs.md §1, §7.5, §9, §10; ADR-038 accepted-provisional; ADR-003). It uses WeasyPrint 70.0 with Pango and HarfBuzz. The module (`backend/modules/platform-docs`) writes the HTML and calls the satellite's command line through `DocumentRendererPort` (§7.5). Production wiring has no satellite until the cell exists, so a production document print is refused with `print.refused.rendererUnavailable` (KA-083).

Everything here is synthetic and NOT FOR CLINICAL USE until approved content replaces it (§19.4).

| Path | What it is |
|---|---|
| `hms_docrender/` | The package: `contract` (request and result, schema validation without WeasyPrint), `fonts` (the one font directory, the SHA-256 check against `fonts.json`, the character-map check), `fetcher` (offline resource fetcher), `env` (the hermetic environment), `render` (library entry point and socket guard), `identity` (renderer identity), `__main__` (command line) |
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

- **Request** (`contract/render-request.schema.json`, all fields required, nothing else allowed): `contractVersion` 1, `html` (the whole document, UTF-8), `pdfVariant` `"pdf/a-2b"` (the only value), `title`, `templateId`, `templateVersion`, `templateContentHash` (SHA-256 hex), `provenance` (`synthetic` or `approved`), `language` (`en`, `ckb`, `ar`, `ku-Arab`), `createdAt` (ISO 8601 to the second with `Z` or an offset).
- **Result** (`contract/render-result.schema.json`): `status` `rendered` with `out`, `bytes`, `sha256`, `pageCount`, `rendererIdentity`, `identityHash`; or `refused` / `failed` with `code` and `detail`; or `invalid` with `errors`.
- **Exit codes:** 0 rendered, 1 failed (`render-error`, `runtime-error`), 2 usage error, 3 invalid request, 4 refused (`resource-refused`, `network-attempt`, `font-integrity`, `unrenderable-text`). The PDF appears at `--out` only on success (written beside it, then renamed).
- **In the PDF:** title, `/Lang`, creation and modification dates come from the request, never from the HTML or the clock; the keywords carry `hms-template-id`, `hms-template-version`, `hms-template-sha256` and `hms-provenance`. Same request on the same renderer identity, same bytes (`UnitTest:pdf-deterministic`).
- **Library form:** `hms_docrender.render.render(RenderRequest) -> RenderResult(pdf, sha256, page_count, renderer_identity, identity_hash)`, raising `RenderRefused` or `RenderFailed`.
- **Why PDF/A-2b only:** the PDF's text layer is not reliable for Sorani (glyphs that `ccmp` decomposes have gaps in their ToUnicode maps, so extracted text is garbled), so the "U" (Unicode) levels are not claimed.

## Offline only (§3.7, §7.5, HAZ-0047)

- The fetcher resolves exactly `hms-font:<name>` for the four print-font names (`noto-sans-arabic-regular`, `noto-sans-arabic-bold`, `noto-sans-regular`, `noto-sans-bold`), from the bytes already verified against `fonts.json`, and `data:` URLs. Everything else (`http:`, `https:`, `file:`, `ftp:`, relative and protocol-relative references, any other scheme, any `hms-font:` value that is not exactly a name: no paths, `..`, percent-encoding, query or fragment) is refused by raising a fatal error, which fails the render.
- During a render a socket guard makes every Python-level `connect`, `connect_ex`, `bind`, `listen`, `sendto`, `getaddrinfo`, `gethostbyname*`, `create_connection` and `create_server` raise and records the attempt, so even an attempt some library swallowed fails the render (`UnitTest:renderer-opens-no-socket`).
- WeasyPrint error-level messages (a stylesheet, image or font that failed) fail the render.
- The container runs with no network at all (Dockerfile header).

## Hermetic fonts and text (§7.5, §9, R7)

- The one font directory is the module's `backend/modules/platform-docs/src/main/resources/hms/platform/docs/fonts/` (override: `HMS_DOCRENDER_FONT_DIR` or `--font-dir`; the container sets it to its copy). Before each render every font file is hashed and compared with `fonts.json` (a list of `{"file", "sha256", ...}` objects, or `{"fonts": [...]}`); a mismatch, a missing file or a missing entry refuses.
- fontconfig runs from the runtime's own `fontconfig/fonts.conf`, which has no `<dir>` and no `<include>`: no system font is visible, so no system font can stand in for a missing glyph.
- Every character of the document's text (body text nodes and CSS `content` strings) must be in the union of the four fonts' character maps, in Unicode NFC, and not a control character, an unpaired surrogate or a format character other than ZWNJ, ZWJ and ZWSP (no bidi embeddings, overrides, isolates or marks). The refusal names categories and counts, never the text.

## Runtime per host

A runtime is a virtual environment made by `bootstrap.py`; `runtime.json` in it records the versions of everything that draws (part of the renderer identity, §10). `bootstrap.py` is idempotent: a second run re-verifies every installed file against its RECORD hash and every DLL against the lock, and repairs only what is missing or wrong. Downloads: PyPI and repo.msys2.org only, every file verified by SHA-256.

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
$R -I -m hms_docrender.golden approve --candidates DIR --goldens DIR --approver NAME [--identity-hash H] [--replace-existing]
```

- `check` renders every `*.html` in `--fixtures` with the command line (a fresh hermetic process per fixture), rasterises each page with pypdfium2 at 150 dpi in 8-bit grey, and compares it pixel for pixel with `<goldens>/<identity-hash>/<fixture>-p<n>.png`. It decodes every barcode on every page with zxing-cpp and compares the multiset with the fixture's declared payloads. A missing set for the identity ("no approved golden images for <identity>"), a golden that does not match its manifest hash, a stale golden, any pixel difference, a page-count difference, a render failure or a barcode mismatch fails (exit 1). Then it writes candidates, difference images (differing pixels in red over the golden) and `manifest.json` to `<candidates>/<identity-hash>/`. It never writes into the goldens directory. Exit 0 only when everything matches; 3 when the runtime is missing ("renderer runtime missing", DN-067).
- `approve` is for a human or the integrator only. It copies a candidate set into `<goldens>/<identity-hash>/` with a manifest: each file's SHA-256, each fixture's template id, version and hash, the identity, `approved_by`, and `human_script_review: requested`. It refuses render or barcode failures and refuses to replace an existing different set without `--replace-existing`. A set approved by an agent is regression evidence only; a Sorani and Arabic reader signs the first set and every change to an identity-text golden (KA-080).
- veraPDF (`PdfaCheck:veraPDF-2b`) is the `pdfa-verify` satellite's job: run it on the PDFs written by `--pdf-out`.

**Fixture metadata convention** (`<meta name=... content=...>` in the fixture's head):

- `hms.barcode.payloads`: every barcode the document carries, as space-separated `<symbology>:<payload>` tokens. Symbology is one of `datamatrix`, `code128`, `qrcode`, `pdf417` or `aztec`. The payload runs to the next space; §6.1 payloads are printable ASCII without spaces. Example: `<meta name="hms.barcode.payloads" content="datamatrix:HMS1|M:SYN-000123-7|E:SYN-E-000045|B:SYN-J-000001 code128:SYN-S-000077">`. Empty content means no barcode. A fixture without the element must contain no barcode.
- `hms.template.id`, `hms.template.version`, `hms.template.hash`, `hms.template.provenance`, `dcterms.created`, `<title>`, `<html lang>`: the request's fields. Missing ones get fixed defaults, listed as `defaulted` in the manifest; they change only the PDF's metadata, never its pages.

**Renderer identity:** `hms-docrender-identity/1;hms_docrender=…;weasyprint=…;pydyf=…;fonttools=…;pillow=…;pango=…;harfbuzz=…;freetype=…;fontconfig=…;pypdfium2=…;pdfium=…;font:<file>=<sha256>…`. The native versions are read from the libraries loaded in the process and must equal runtime.json. The identity hash (first 16 hex digits of its SHA-256) names the golden set. The operating system is not part of it (KA-086).

## Known limits

- The approximate-date-of-birth marker `≈` (U+2248) of §3.2 R5 is in none of the four print fonts, so the character check refuses any text that contains it (`test_the_approximate_marker_is_not_in_the_print_fonts`). The self-test fixtures write "approx." instead. A content or font decision is needed.
- Text extracted from the PDFs is not reliable for Sorani (see PDF/A-2b above). Use the golden images to check the output, not text extraction.
- Golden images are pinned to one renderer identity: a new WeasyPrint, Pango, HarfBuzz, FreeType, fontconfig, pypdfium2 or font file needs a newly approved set.
