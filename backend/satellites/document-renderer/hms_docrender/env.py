"""The hermetic environment of a render (docs/specs/modules/platform-docs.md §7.5; ADR-038).

The runtime directory is the virtual environment ``bootstrap.py`` made (``sys.prefix``, or ``HMS_DOCRENDER_RUNTIME``)
and holds ``runtime.json``. Before WeasyPrint is first imported, ``prepare`` sets, for this process only:

- ``FONTCONFIG_FILE`` / ``FONTCONFIG_PATH``: the runtime's own fontconfig file, which has no ``<dir>`` entry, so no
  system font is visible and no system font can stand in for a missing glyph (every glyph comes from the
  ``@font-face`` print fonts);
- ``TMP`` / ``TEMP`` / ``TMPDIR`` and ``tempfile.tempdir``: a directory in the runtime (WeasyPrint writes the
  ``@font-face`` files there for fontconfig);
- on Windows, ``WEASYPRINT_DLL_DIRECTORIES``: the runtime's ``pango/bin`` (MSYS2 UCRT64 DLLs pinned in
  ``runtime/msys2-ucrt64.lock.json``), and ``PATH`` reduced to the Windows system directories, so no other GTK or
  Pango build on the machine can be loaded; after the import every loaded DLL of the lock is checked to come from
  ``pango/bin`` with its pinned SHA-256;
- removes variables that redirect fontconfig, Pango, HarfBuzz, GLib or the dynamic loader.

``subprocess_env`` builds the whole environment for a child render process from nothing but these values and the
Windows system variables (SYSTEMDRIVE, SYSTEMROOT, WINDIR, PROGRAMDATA).
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

RUNTIME_ENV = "HMS_DOCRENDER_RUNTIME"
TMP_ENV = "HMS_DOCRENDER_TMP"
RUNTIME_JSON = "runtime.json"
RUNTIME_SCHEMA = "hms-docrender-runtime/1"
IS_WINDOWS = os.name == "nt"

# The fontconfig file: no <dir>, so fontconfig sees no system font. Keep identical to bootstrap.py FONTCONFIG_XML
# (a unit test compares them).
FONTCONFIG_XML = """<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<!-- HMS document renderer: hermetic fontconfig (docs/specs/modules/platform-docs.md §7.5).
     No <dir> and no <include> on purpose: no system or user font is visible, so every glyph in a PDF
     comes from a document @font-face rule that loads a pinned print font through hms-font:. -->
<fontconfig>
  <cachedir prefix="relative">cache</cachedir>
</fontconfig>
"""

# Variables that could point fontconfig, Pango, HarfBuzz, GLib or the loader somewhere else.
_SCRUB_PREFIXES = ("FONTCONFIG_", "FC_", "PANGO", "HB_", "GIO_", "G_", "GDK_", "WEASYPRINT_", "LD_", "DYLD_", "XDG_")
_WINDOWS_PASS = ("SYSTEMDRIVE", "SYSTEMROOT", "WINDIR", "PROGRAMDATA")


class RuntimeMissing(Exception):
    """No renderer runtime here (bootstrap.py has not run, or HMS_DOCRENDER_RUNTIME points nowhere)."""


class EnvironmentRefused(Exception):
    """The process cannot be made hermetic (for example WeasyPrint was imported before ``prepare``)."""


@dataclass
class Runtime:
    dir: Path
    info: dict[str, Any] = field(default_factory=dict)

    @property
    def fontconfig_dir(self) -> Path:
        return self.dir / "fontconfig"

    @property
    def fontconfig_file(self) -> Path:
        return self.fontconfig_dir / "fonts.conf"

    @property
    def pango_bin(self) -> Path:
        return self.dir / "pango" / "bin"

    @property
    def tmp_dir(self) -> Path:
        override = os.environ.get(TMP_ENV)
        return Path(override) if override else self.dir / "tmp"

    def msys2_dlls(self) -> dict[str, str]:
        """DLL file name (lower case) -> SHA-256, from runtime.json (Windows runtimes only)."""
        return {name.lower(): digest for name, digest in (self.info.get("msys2") or {}).get("dlls", {}).items()}


def load_runtime(directory: Path | str | None = None) -> Runtime:
    if directory is None:
        directory = os.environ.get(RUNTIME_ENV) or sys.prefix
    root = Path(directory).resolve()
    path = root / RUNTIME_JSON
    if not path.is_file():
        raise RuntimeMissing(
            f"renderer runtime missing: {path} does not exist; run backend/satellites/document-renderer/bootstrap.py "
            "and use the runtime's own python"
        )
    info = json.loads(path.read_text(encoding="utf-8"))
    if info.get("schema") != RUNTIME_SCHEMA:
        raise RuntimeMissing(f"{path}: not a {RUNTIME_SCHEMA} file; run bootstrap.py again")
    if IS_WINDOWS and not (root / "pango" / "bin").is_dir():
        raise RuntimeMissing(f"renderer runtime incomplete: {root / 'pango' / 'bin'} is missing; run bootstrap.py again")
    return Runtime(root, info)


_prepared: Runtime | None = None


def system_path() -> str:
    if IS_WINDOWS:
        root = os.environ.get("SYSTEMROOT") or os.environ.get("WINDIR") or r"C:\Windows"
        return f"{root}\\System32;{root}"
    return "/usr/bin:/bin"


def hermetic_values(runtime: Runtime) -> dict[str, str]:
    values = {
        "FONTCONFIG_FILE": str(runtime.fontconfig_file),
        "FONTCONFIG_PATH": str(runtime.fontconfig_dir),
        "TMP": str(runtime.tmp_dir),
        "TEMP": str(runtime.tmp_dir),
        "TMPDIR": str(runtime.tmp_dir),
        "PATH": system_path(),
    }
    if IS_WINDOWS:
        values["WEASYPRINT_DLL_DIRECTORIES"] = str(runtime.pango_bin)
    return values


def ensure_fontconfig(runtime: Runtime) -> None:
    path = runtime.fontconfig_file
    if path.is_file() and path.read_text(encoding="utf-8") == FONTCONFIG_XML:
        return
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(FONTCONFIG_XML, encoding="utf-8", newline="\n")
    except OSError as exc:
        raise EnvironmentRefused(f"cannot write the hermetic fontconfig file {path}: {exc}") from None


def prepare(runtime: Runtime) -> None:
    """Make this process hermetic for WeasyPrint. Idempotent for one runtime; must run before WeasyPrint's import."""
    global _prepared
    if _prepared is not None:
        if _prepared.dir != runtime.dir:
            raise EnvironmentRefused(f"this process is already prepared for the runtime {_prepared.dir}")
        return
    if "weasyprint" in sys.modules:
        raise EnvironmentRefused("weasyprint was imported before the hermetic environment was prepared")
    if IS_WINDOWS:
        # CPython's own DLLs\libffi-8.dll (ctypes) satisfies GLib's import of libffi-8.dll when it is loaded
        # first, which it usually is. Load it now so the binding is always the same, and verify it below.
        import ctypes  # noqa: F401, PLC0415
    ensure_fontconfig(runtime)
    runtime.tmp_dir.mkdir(parents=True, exist_ok=True)
    for name in list(os.environ):
        if name.upper().startswith(_SCRUB_PREFIXES):
            del os.environ[name]
    os.environ.update(hermetic_values(runtime))
    tempfile.tempdir = str(runtime.tmp_dir)
    _prepared = runtime


def subprocess_env(runtime: Runtime) -> dict[str, str]:
    """The complete environment of a child render process: the hermetic values and nothing else of ours."""
    env = {name: value for name, value in os.environ.items() if name.upper() in _WINDOWS_PASS} if IS_WINDOWS else {}
    if not IS_WINDOWS:
        env["LANG"] = "C.UTF-8"
    env.update(hermetic_values(runtime))
    if RUNTIME_ENV in os.environ:
        env[RUNTIME_ENV] = os.environ[RUNTIME_ENV]
    if TMP_ENV in os.environ:
        env[TMP_ENV] = os.environ[TMP_ENV]
    return env


def import_weasyprint(runtime: Runtime) -> Any:
    """Prepare, import WeasyPrint, and on Windows prove that the pinned DLLs (and only they) were loaded."""
    prepare(runtime)
    import warnings

    with warnings.catch_warnings():
        # Expected by design: the hermetic fontconfig has no fonts until a document's @font-face adds them.
        warnings.filterwarnings("ignore", message="No fonts configured in FontConfig")
        import weasyprint  # noqa: PLC0415 - must follow prepare()

    if IS_WINDOWS:
        verify_loaded_dlls(runtime)
    return weasyprint


_verified_dlls = False


def verify_loaded_dlls(runtime: Runtime) -> None:
    """Every loaded DLL named in the MSYS2 lock comes from the runtime's pango/bin and has its pinned SHA-256."""
    global _verified_dlls
    if _verified_dlls:
        return
    pinned = runtime.msys2_dlls()
    if not pinned:
        raise EnvironmentRefused("runtime.json lists no MSYS2 DLLs; run bootstrap.py again")
    bin_dir = os.path.normcase(str(runtime.pango_bin.resolve()))
    loaded = {}
    for module in loaded_modules():
        name = os.path.basename(module).lower()
        if name in pinned:
            loaded.setdefault(name, []).append(module)
    roots = ("libpango-1.0-0.dll", "libpangoft2-1.0-0.dll", "libharfbuzz-0.dll", "libfontconfig-1.dll", "libgobject-2.0-0.dll")
    for root in roots:
        if root not in loaded:
            raise EnvironmentRefused(f"{root} is not loaded after importing weasyprint")
    base_pinned = {k.lower(): v for k, v in (runtime.info.get("base_interpreter_dlls") or {}).items()}
    base_dir = os.path.normcase(str((Path(sys.base_prefix) / "DLLs").resolve()))
    for name, paths in sorted(loaded.items()):
        for path in paths:
            directory = os.path.normcase(os.path.dirname(os.path.abspath(path)))
            if directory == bin_dir:
                digest = hashlib.sha256((runtime.pango_bin / name).read_bytes()).hexdigest()
                expected = pinned[name]
            elif directory == base_dir and name in BASE_INTERPRETER_DLLS:
                digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
                expected = base_pinned.get(name)
            else:
                raise EnvironmentRefused(f"{name} was loaded from {path}, not from the runtime's pango/bin")
            if digest != expected:
                raise EnvironmentRefused(f"{name} ({path}): SHA-256 {digest} does not match runtime.json; run bootstrap.py again")
    _verified_dlls = True


# DLLs that CPython itself ships and loads before WeasyPrint (ctypes): the copy in the base interpreter's DLLs
# directory serves the MSYS2 libraries too. Pinned by SHA-256 in runtime.json ("base_interpreter_dlls").
BASE_INTERPRETER_DLLS = frozenset({"libffi-8.dll"})


def loaded_modules() -> list[str]:
    """Full paths of every module loaded in this process (Windows)."""
    import ctypes
    import ctypes.wintypes as wt

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    psapi_enum = kernel32.K32EnumProcessModules
    psapi_enum.argtypes = [wt.HANDLE, ctypes.POINTER(wt.HMODULE), wt.DWORD, ctypes.POINTER(wt.DWORD)]
    psapi_enum.restype = wt.BOOL
    get_name = kernel32.K32GetModuleFileNameExW
    get_name.argtypes = [wt.HANDLE, wt.HMODULE, wt.LPWSTR, wt.DWORD]
    get_name.restype = wt.DWORD
    kernel32.GetCurrentProcess.restype = wt.HANDLE
    process = kernel32.GetCurrentProcess()
    count = 1024
    while True:
        handles = (wt.HMODULE * count)()
        needed = wt.DWORD()
        if not psapi_enum(process, handles, ctypes.sizeof(handles), ctypes.byref(needed)):
            raise EnvironmentRefused(f"cannot list the loaded modules (error {ctypes.get_last_error()})")
        if needed.value <= ctypes.sizeof(handles):
            break
        count = needed.value // ctypes.sizeof(wt.HMODULE) + 16
    paths = []
    for handle in handles[: needed.value // ctypes.sizeof(wt.HMODULE)]:
        buffer = ctypes.create_unicode_buffer(32768)
        if get_name(process, handle, buffer, len(buffer)):
            paths.append(buffer.value)
    return paths
