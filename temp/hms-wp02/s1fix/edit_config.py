from pathlib import Path
p = Path("tools/hmstools/cell/config.py")
s = p.read_bytes().decode("utf-8")
def rep(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)

rep('''- an image or tool has no well-formed digest, or a chart or manifest file no SHA-256;
''', '''- an image or tool has no well-formed digest, or a chart or manifest file no SHA-256;
- an image or tool has no release date, or a chart or manifest no publication date, as YYYY-MM-DD no later than
  'resolved_on' (the §4.1 re-check reads them);
- a manifest is pinned neither by commit nor by release, or a file of it is not fetched at that commit or from
  that release;
''')
rep('''- a cross-reference is dangling (a chart's image, the registry image, an image's profile or component).
"""''', '''- a cross-reference is dangling (a chart's image, the registry image, an image's profile or component).

The lint reads cell.yaml only. What a chart archive or manifest contains is checked by `tools/hms cell charts
verify` (charts.py), against the copies in HMS_CELL_HOME.
"""''')
rep('''import hashlib
import os
import re
from dataclasses''', '''import hashlib
import os
import re
from datetime import date
from dataclasses''')
rep('''NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")''', '''NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")''')
rep('''IMAGE_FIELDS = ("name", "upstream", "digest", "index_digest", "local", "licence", "role", "component", "profiles",
                "ships")
TOOL_FIELDS = ("name", "upstream", "digest", "index_digest", "licence", "purpose")
CHART_FIELDS = ("name", "repository", "version", "app_version", "url", "sha256", "published", "profiles", "images")''',
'''IMAGE_FIELDS = ("name", "upstream", "digest", "index_digest", "local", "licence", "role", "component", "profiles",
                "ships", "released")
TOOL_FIELDS = ("name", "upstream", "digest", "index_digest", "licence", "released", "purpose")
CHART_FIELDS = ("name", "repository", "version", "app_version", "url", "sha256", "published", "profiles", "images")
MANIFEST_FIELDS = ("name", "version", "source", "published", "profiles", "images", "files")''')

rep('''def _licence_errors(''', '''def _date_error(what: str, value: Any, resolved_on: Any) -> Optional[str]:
    """A release or publication date: a quoted YYYY-MM-DD that is a real date, no later than 'resolved_on'."""
    text = value if isinstance(value, str) else None
    if text is None or not DATE.match(text):
        return f"{what}: want a quoted date YYYY-MM-DD, got {value!r}"
    try:
        when = date.fromisoformat(text)
    except ValueError:
        return f"{what}: {text!r} is not a date"
    try:
        resolved = date.fromisoformat(str(resolved_on))
    except ValueError:
        return f"{what}: resolved_on {resolved_on!r} is not a date YYYY-MM-DD"
    if when > resolved:
        return f"{what}: {text} is after resolved_on ({resolved})"
    return None


def _licence_errors(''')

# dates for images and tools: after the names loop
rep('''    for tool in cfg.tools:
        _check_reference("tool", tool, result.errors)
''', '''    for tool in cfg.tools:
        _check_reference("tool", tool, result.errors)
    resolved_on = data["resolved_on"]
    for kind, entries in (("image", data["images"] or []), ("tool", data["tools"] or [])):
        for entry in entries:
            if isinstance(entry, dict) and entry.get("released") not in (None, ""):
                problem = _date_error(f"{kind} {entry.get('name')}: released", entry["released"], resolved_on)
                if problem:
                    result.errors.append(problem)
''')
rep('''        if not SHA256.match(str(chart.get("sha256") or "")):
            result.errors.append(f"{where}: no SHA-256 of its .tgz (want 64 hex), got {chart.get('sha256')!r}")
''', '''        if not SHA256.match(str(chart.get("sha256") or "")):
            result.errors.append(f"{where}: no SHA-256 of its .tgz (want 64 hex), got {chart.get('sha256')!r}")
        if chart.get("published") not in (None, ""):
            problem = _date_error(f"{where}: published", chart["published"], resolved_on)
            if problem:
                result.errors.append(problem)
        if not str(chart.get("url") or "").startswith("https://"):
            result.errors.append(f"{where}: url {chart.get('url')!r} is not an https URL")
''')
rep('''        if not re.match(r"^[0-9a-f]{40}$", str(manifest.get("commit") or "")):
            result.errors.append(f"{where}: no commit (want the 40-hex commit of its tag)")
        files = manifest.get("files") or []
        if not files:
            result.errors.append(f"{where}: no files")
        for entry in files:
            counts["manifest_files"] += 1
            url, sha = str((entry or {}).get("url") or ""), str((entry or {}).get("sha256") or "")
            if not SHA256.match(sha):
                result.errors.append(f"{where}: file {url or '?'} has no SHA-256 (want 64 hex)")
            if manifest.get("commit") and str(manifest["commit"]) not in url:
                result.errors.append(f"{where}: file {url!r} is not fetched at the pinned commit")
''', '''        missing = [key for key in MANIFEST_FIELDS if manifest.get(key) in (None, "", [])]
        if missing:
            result.errors.append(f"{where}: missing {', '.join(missing)}")
        if manifest.get("published") not in (None, ""):
            problem = _date_error(f"{where}: published", manifest["published"], resolved_on)
            if problem:
                result.errors.append(problem)
        commit, release = manifest.get("commit"), manifest.get("release")
        if (commit is None) == (release is None):
            result.errors.append(f"{where}: pin it by exactly one of 'commit' (the 40-hex commit of its tag) or "
                                 "'release' (the release whose assets it uses)")
        elif commit is not None and not re.match(r"^[0-9a-f]{40}$", str(commit)):
            result.errors.append(f"{where}: commit {commit!r} is not the 40-hex commit of its tag")
        files = manifest.get("files") or []
        for entry in files:
            counts["manifest_files"] += 1
            url, sha = str((entry or {}).get("url") or ""), str((entry or {}).get("sha256") or "")
            if not SHA256.match(sha):
                result.errors.append(f"{where}: file {url or '?'} has no SHA-256 (want 64 hex)")
            if not url.startswith("https://"):
                result.errors.append(f"{where}: file {url!r} is not an https URL")
            if commit is not None and str(commit) not in url:
                result.errors.append(f"{where}: file {url!r} is not fetched at the pinned commit")
            if release is not None and f"/releases/download/{release}/" not in url:
                result.errors.append(f"{where}: file {url!r} is not an asset of release {release}")
''')
p.write_bytes(s.encode("utf-8"))
print("ok")
