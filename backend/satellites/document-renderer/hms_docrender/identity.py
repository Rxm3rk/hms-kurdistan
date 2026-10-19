"""The renderer identity (docs/specs/modules/platform-docs.md §10, "Renderer identity").

PDF golden images depend on the code that draws them, so every approved set is keyed by the identity of the
renderer that made it:

- the Python packages that parse, style, lay out and write: WeasyPrint, pydyf, fontTools, Pillow, tinycss2,
  cssselect2, tinyhtml5 and Pyphen (hyphenation);
- the Pango, HarfBuzz, FreeType, fontconfig and FriBidi (Pango's bidi) versions of the libraries actually loaded in
  this process;
- the pypdfium2 and PDFium versions of the rasteriser and the zxing-cpp version of the barcode decoder (it decides
  the barcode verdict, not the pixels);
- the SHA-256 of the hermetic fontconfig file (``env.FONTCONFIG_XML``), and a SHA-256 over this satellite's
  source (every ``hms_docrender`` Python file) and ``requirements.txt``, so a change nobody remembered to version
  still changes the identity;
- this satellite's version and the SHA-256 of each print font.

The operating system is not part of it; a host whose libraries draw differently fails the golden check and shows
it (KA-086). A new identity has no approved set: the golden check then compares its pages with the most recent
approved set and approval needs an explicit flag (``golden.harness``).

The native versions are read from the loaded libraries, and checked against what bootstrap.py recorded in
``runtime.json``: a runtime whose libraries changed since its bootstrap (a distribution upgrade on Linux, a
replaced DLL on Windows) is refused until it is bootstrapped again.
"""

from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass
from importlib import metadata
from pathlib import Path
from typing import Any

from . import __version__
from .env import FONTCONFIG_XML, EnvironmentRefused, Runtime, import_weasyprint
from .fonts import FontSet

PACKAGE_DIR = Path(__file__).resolve().parent
REQUIREMENTS_TXT = PACKAGE_DIR.parent / "requirements.txt"

IDENTITY_SCHEME = "hms-docrender-identity/1"

_LIBRARY_NAMES = {
    "harfbuzz": ("libharfbuzz-0.dll", "libharfbuzz.so.0", "libharfbuzz.0.dylib"),
    "fontconfig": ("libfontconfig-1.dll", "libfontconfig.so.1", "libfontconfig.1.dylib"),
    "freetype": ("libfreetype-6.dll", "libfreetype.so.6", "libfreetype.6.dylib"),
    "fribidi": ("libfribidi-0.dll", "libfribidi.so.0", "libfribidi.0.dylib"),
}
# Python packages that change what is drawn (and zxing-cpp, which decides the barcode verdict).
PYTHON_PACKAGES = ("weasyprint", "pydyf", "fonttools", "pillow", "tinycss2", "cssselect2", "tinyhtml5", "pyphen",
                   "pypdfium2", "zxing-cpp")


@dataclass(frozen=True)
class Identity:
    components: tuple[tuple[str, str], ...]

    @property
    def text(self) -> str:
        return IDENTITY_SCHEME + ";" + ";".join(f"{key}={value}" for key, value in self.components)

    @property
    def hash(self) -> str:
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()[:16]

    def as_json(self) -> dict[str, Any]:
        return {"identity": self.text, "identityHash": self.hash, "components": dict(self.components)}


def _dlopen(names: tuple[str, ...], cdef: str) -> Any:
    from cffi import FFI

    ffi = FFI()
    ffi.cdef(cdef)
    flags = 0x00001000 if os.name == "nt" else ffi.RTLD_NOW  # LOAD_LIBRARY_SEARCH_DEFAULT_DIRS, as WeasyPrint
    for name in names:
        try:
            return ffi, ffi.dlopen(name, flags)
        except OSError:
            continue
    raise EnvironmentRefused(f"cannot open any of {names}")


def native_versions(runtime: Runtime) -> dict[str, str]:
    """Versions of Pango, HarfBuzz, FreeType and fontconfig as loaded by WeasyPrint in this process."""
    import_weasyprint(runtime)
    from weasyprint.text.ffi import pango

    number = pango.pango_version()
    versions = {"pango": f"{number // 10000}.{number // 100 % 100}.{number % 100}"}

    ffi, harfbuzz = _dlopen(_LIBRARY_NAMES["harfbuzz"], "const char *hb_version_string(void);")
    versions["harfbuzz"] = ffi.string(harfbuzz.hb_version_string()).decode("ascii")

    _, fontconfig = _dlopen(_LIBRARY_NAMES["fontconfig"], "int FcGetVersion(void);")
    number = fontconfig.FcGetVersion()
    versions["fontconfig"] = f"{number // 10000}.{number // 100 % 100}.{number % 100}"

    ffi, freetype = _dlopen(
        _LIBRARY_NAMES["freetype"],
        "typedef void *FT_Library; int FT_Init_FreeType(FT_Library *library);"
        "void FT_Library_Version(FT_Library library, int *major, int *minor, int *patch);"
        "int FT_Done_FreeType(FT_Library library);",
    )
    library = ffi.new("FT_Library *")
    if freetype.FT_Init_FreeType(library) != 0:
        raise EnvironmentRefused("FreeType did not initialise")
    try:
        parts = [ffi.new("int *") for _ in range(3)]
        freetype.FT_Library_Version(library[0], *parts)
        versions["freetype"] = ".".join(str(part[0]) for part in parts)
    finally:
        freetype.FT_Done_FreeType(library[0])

    ffi, fribidi = _dlopen(_LIBRARY_NAMES["fribidi"], "extern const char *fribidi_version_info;")
    match = re.search(r"\d+\.\d+(?:\.\d+)?", ffi.string(fribidi.fribidi_version_info).decode("ascii", "replace"))
    if match is None:
        raise EnvironmentRefused("FriBidi reports no version")
    versions["fribidi"] = match.group(0)
    return versions


def python_versions() -> dict[str, str]:
    import pypdfium2.version as pdfium_version

    versions = {name: metadata.version(name) for name in PYTHON_PACKAGES}
    versions["pdfium"] = str(pdfium_version.PDFIUM_INFO.build)
    return versions


def _lf(data: bytes) -> bytes:
    return data.replace(b"\r\n", b"\n")  # the same identity whatever line endings a checkout used


def source_sha256() -> str:
    """SHA-256 over every ``hms_docrender`` Python file (path and content, in path order) and requirements.txt."""
    digest = hashlib.sha256()
    files = sorted(PACKAGE_DIR.rglob("*.py"), key=lambda path: path.relative_to(PACKAGE_DIR).as_posix())
    for path in [*files, REQUIREMENTS_TXT]:
        name = path.relative_to(PACKAGE_DIR.parent).as_posix()
        content = _lf(path.read_bytes())
        digest.update(f"{name}\0{len(content)}\0".encode("utf-8"))
        digest.update(content)
    return digest.hexdigest()


_cache: dict[tuple[str, tuple[tuple[str, str], ...]], Identity] = {}


def compute(runtime: Runtime, fonts: FontSet) -> Identity:
    """The identity of this process's renderer with these fonts; refuses if runtime.json disagrees."""
    key = (str(runtime.dir), tuple(sorted(fonts.sha256s().items())))
    if key in _cache:
        return _cache[key]
    native = native_versions(runtime)
    recorded = runtime.info.get("native") or {}
    for name, version in native.items():
        if recorded.get(name) != version:
            raise EnvironmentRefused(
                f"{name} {version} is loaded but runtime.json records {recorded.get(name)!r}; run bootstrap.py again"
            )
    python = python_versions()
    components: list[tuple[str, str]] = [("hms_docrender", __version__)]
    components += [(name, python[name]) for name in ("weasyprint", "pydyf", "fonttools", "pillow", "tinycss2",
                                                     "cssselect2", "tinyhtml5", "pyphen")]
    components += [(name, native[name]) for name in ("pango", "harfbuzz", "freetype", "fontconfig", "fribidi")]
    components += [("pypdfium2", python["pypdfium2"]), ("pdfium", python["pdfium"]), ("zxing-cpp", python["zxing-cpp"])]
    components += [("fontconfig-xml", hashlib.sha256(FONTCONFIG_XML.encode("utf-8")).hexdigest()),
                   ("source", source_sha256())]
    components += [(f"font:{file}", digest) for file, digest in sorted(fonts.sha256s().items())]
    identity = Identity(tuple(components))
    _cache[key] = identity
    return identity
