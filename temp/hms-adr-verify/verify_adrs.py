"""Verify docs/adr against BUILD-PROMPT.md §4.2/§4.3 and template B.1 (read-only; writes nothing).

Run: <repo>/.tools/venv/Scripts/python.exe -I verify_adrs.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # never write __pycache__ into the repository
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(r"C:\Users\Surface\.t3\projects\hospitalmanagementsystem")
ADR_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "adr"
BUILD_PROMPT = ROOT / "BUILD-PROMPT.md"
HEADINGS = [
    "## Context",
    "## Decision",
    "## Consequences (including safety and licence impact)",
    "## Fitness test that guards it",
    "## Reopen if",
]
PROVISIONAL = {1, 9}
NEW = range(20, 29)
STOP_AND_ASK = "Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4)."
NO_TRIGGER = 'No reopen trigger is set (BUILD-PROMPT §4.2 shows "—").'
STALE_HOST = re.compile(
    r"no Rust|no Docker|no WSL|no container|interim Windows|interim build host|not runnable|"
    r"KA-001 and DN-001|has no Rust toolchain",
    re.I,
)

errors: list[str] = []
notes: list[str] = []


def err(message: str) -> None:
    errors.append(message)


def section(text: str, heading: str) -> str:
    """Body of a '## ' section, up to the next '## ' heading."""
    lines = text.split("\n")
    try:
        start = lines.index(heading) + 1
    except ValueError:
        return ""
    end = next((i for i in range(start, len(lines)) if lines[i].startswith("## ")), len(lines))
    return "\n".join(lines[start:end])


# --------------------------------------------------------------------------- 1. files and numbering
files: dict[int, list[Path]] = {}
for path in sorted(ADR_DIR.glob("ADR-*.md")):
    match = re.fullmatch(r"ADR-(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md", path.name)
    if not match:
        err(f"name: {path.name} does not match ADR-nnn-<slug>.md")
        continue
    files.setdefault(int(match.group(1)), []).append(path)
numbers = sorted(files)
if numbers != list(range(1, 29)):
    err(f"numbering: expected 001..028 contiguous, found {[f'{n:03d}' for n in numbers]}")
for number, paths in files.items():
    if len(paths) != 1:
        err(f"numbering: ADR-{number:03d} has {len(paths)} files")

# --------------------------------------------------------------------------- 2. bytes
md_files = sorted(ADR_DIR.glob("*.md"))
for path in md_files:
    data = path.read_bytes()
    if b"\r" in data:
        err(f"bytes: {path.name} contains CR (CRLF or lone CR)")
    if data.startswith(b"\xef\xbb\xbf"):
        err(f"bytes: {path.name} starts with a UTF-8 BOM")
    try:
        data.decode("utf-8")
    except UnicodeDecodeError as exc:
        err(f"bytes: {path.name} is not UTF-8 ({exc})")
    if not data.endswith(b"\n") or data.endswith(b"\n\n"):
        err(f"bytes: {path.name} does not end with exactly one newline")

# --------------------------------------------------------------------------- 3. header and headings
meta: dict[int, dict[str, str]] = {}
texts: dict[int, str] = {}
for number in numbers:
    path = files[number][0]
    text = path.read_text(encoding="utf-8")
    texts[number] = text
    lines = text.split("\n")
    title = re.fullmatch(rf"# ADR-{number:03d}: (.+)", lines[0])
    status = re.fullmatch(r"Status: (.+)", lines[1])
    date = re.fullmatch(r"Date: (\d{4}-\d{2}-\d{2})   Source: (.+)", lines[2])
    if not title:
        err(f"header: {path.name} line 1 is not '# ADR-{number:03d}: <title>'")
    if not status:
        err(f"header: {path.name} line 2 is not 'Status: ...'")
    if not date:
        err(f"header: {path.name} line 3 is not 'Date: yyyy-mm-dd   Source: ...'")
    elif date.group(1) != "2026-10-18":
        err(f"header: {path.name} date {date.group(1)} is not 2026-10-18")
    elif "BUILD-PROMPT" not in date.group(2) or "§4.2" not in date.group(2):
        err(f"header: {path.name} Source line does not cite BUILD-PROMPT §4.2")
    headings = [line for line in lines if line.startswith("## ")]
    b1_in_order = [h for h in headings if h in HEADINGS]
    if b1_in_order != HEADINGS:
        err(f"headings: {path.name} has B.1 headings {b1_in_order}, expected {HEADINGS} in order, once each")
    extra = [h for h in headings if h not in HEADINGS]
    if extra:
        notes.append(f"headings: {path.name} has extra section(s) {extra} besides the five B.1 headings")
    expected = "accepted-provisional" if number in PROVISIONAL else "accepted"
    if status and status.group(1) != expected:
        err(f"status: {path.name} is {status.group(1)!r}, expected {expected!r}")
    if text.count("**State on 2026-10-18:**") != 1:
        err(f"state: {path.name} needs exactly one '**State on 2026-10-18:**' line")
    meta[number] = {
        "file": path.name,
        "title": title.group(1) if title else "",
        "status": status.group(1) if status else "",
    }
    for match in STALE_HOST.finditer(text):
        line_no = text.count("\n", 0, match.start()) + 1
        err(f"host: {path.name}:{line_no}: stale host wording {match.group(0)!r}")

# --------------------------------------------------------------------------- 4. §4.2 rows vs the ADRs
bp_lines = BUILD_PROMPT.read_text(encoding="utf-8").split("\n")
start = bp_lines.index("### 4.2 ADR baseline")
end = bp_lines.index("### 4.3 Licence and dependency policy")
rows: dict[int, tuple[str, str, str]] = {}
for line in bp_lines[start:end]:
    match = re.fullmatch(r"\| (\d{3}) \| (.+) \| (.+) \| (.+) \|", line)
    if match:
        rows[int(match.group(1))] = (match.group(2).strip(), match.group(3).strip(), match.group(4).strip())
if sorted(rows) != list(range(1, 29)):
    err(f"§4.2: parsed rows {sorted(rows)}, expected 1..28")

for number in numbers:
    decision, guard, reopen = rows[number]
    text = texts[number]
    name = meta[number]["file"]
    decision_body = section(text, "## Decision")
    fitness_body = section(text, "## Fitness test that guards it")
    reopen_body = section(text, "## Reopen if")
    if decision not in decision_body:

        def norm(value: str) -> str:
            return re.sub(r"\s+", " ", value.replace("**", "")).strip().rstrip(".")

        if norm(decision) in norm(decision_body):
            notes.append(f"§4.2 decision: {name}: matches §4.2 once bold markers and a final full stop are ignored")
        else:
            err(f"§4.2 decision: {name}: the §4.2 decision text is not in ## Decision")
    if guard == "—":
        if 'none is named ("—")' not in fitness_body:
            err(f"§4.2 guard: {name}: expected 'none is named (\"—\")'")
    elif f"**Guard (BUILD-PROMPT §4.2):** {guard}" not in fitness_body:
        err(f"§4.2 guard: {name}: guard {guard!r} not stated verbatim")
    if reopen == "—":
        if NO_TRIGGER not in reopen_body:
            err(f"§4.2 reopen: {name}: expected the no-trigger sentence")
    else:
        first = next((l for l in reopen_body.split("\n") if l.strip()), "")
        if first.rstrip(".") != reopen.rstrip("."):
            err(f"§4.2 reopen: {name}: first line {first!r} != §4.2 {reopen!r}")
    if number in NEW and STOP_AND_ASK not in reopen_body:
        err(f"reopen: {name}: missing the stop-and-ask sentence")

# --------------------------------------------------------------------------- 5. §4.3 in full inside ADR-022
start = bp_lines.index("### 4.3 Licence and dependency policy")
end = next(i for i in range(start + 1, len(bp_lines)) if bp_lines[i].startswith("---"))
adr22 = texts.get(22, "")
bullets = [line.strip()[2:] for line in bp_lines[start + 1:end] if line.strip().startswith("- ")]
missing = [bullet for bullet in bullets if bullet not in adr22]
for bullet in missing:
    err(f"§4.3: ADR-022 lacks the bullet verbatim: {bullet[:90]}…")
notes.append(f"§4.3: {len(bullets)} bullets and sub-bullets checked verbatim in ADR-022, {len(missing)} missing")
for artefact in [
    "tools/licence/policy.yaml",
    "tools/licence/register.yaml",
    "tools/licence/ort/license-classifications.yml",
    "tools/licence/ort/evaluator.rules.kts",
    "tools/licence/ort/curations.yml",
    ".ort.yml",
    "sh tools/hms licence check",
]:
    if artefact not in adr22:
        err(f"ADR-022: does not name {artefact}")
    path_part = artefact.replace("sh tools/hms licence check", "tools/hmstools/licence/__main__.py")
    if not (ROOT / path_part).exists():
        err(f"ADR-022: named artefact {path_part} does not exist")

# --------------------------------------------------------------------------- 6. README index
readme_path = ADR_DIR / "README.md"
readme = readme_path.read_text(encoding="utf-8")
index_rows = re.findall(
    r"^\| \[ADR-(\d{3})\]\(([^)]+)\) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \|$", readme, re.M
)
if len(index_rows) != 28:
    err(f"README: {len(index_rows)} index rows, expected 28")
seen = []
for num_text, link, title, status, guard, where in index_rows:
    number = int(num_text)
    seen.append(number)
    if number not in meta:
        err(f"README: row ADR-{num_text} has no file")
        continue
    if link != meta[number]["file"] or not (ADR_DIR / link).is_file():
        err(f"README: ADR-{num_text} link {link!r} != file {meta[number]['file']!r}")
    if title != meta[number]["title"]:
        err(f"README: ADR-{num_text} title {title!r} != file title {meta[number]['title']!r}")
    if status != meta[number]["status"]:
        err(f"README: ADR-{num_text} status {status!r} != file status {meta[number]['status']!r}")
    if guard != rows[number][1]:
        err(f"README: ADR-{num_text} guard {guard!r} != §4.2 {rows[number][1]!r}")
    if not where.strip():
        err(f"README: ADR-{num_text} has an empty 'where' cell")
if seen != list(range(1, 29)):
    err(f"README: rows out of order or missing: {seen}")
for phrase in ["ADR-029", "stop-and-ask item 2", "accepted-provisional", "WP-0.6", "B.1"]:
    if phrase not in readme:
        err(f"README: does not mention {phrase!r}")

# --------------------------------------------------------------------------- 7. the repository's own ADR rule
sys.path.insert(0, str(ROOT / "tools"))
try:
    from hmstools.repo import rules  # type: ignore[import-not-found]
except Exception as exc:  # pragma: no cover - environment
    err(f"repo rule: cannot import tools/hmstools/repo/rules.py ({exc})")
else:
    for number in numbers:
        for problem in rules.adr_problems(number, texts[number]):
            err(f"repo rule: {meta[number]['file']}: {problem}")
    notes.append("repo rule: tools/hmstools/repo/rules.py adr_problems() applied to all 28 files")

# --------------------------------------------------------------------------- report
print(f"ADR files: {len(numbers)} ({', '.join(f'{n:03d}' for n in numbers[:3])} … {numbers[-1]:03d})")
print(f"markdown files checked for bytes: {len(md_files)} ({', '.join(p.name for p in md_files if not p.name.startswith('ADR-'))} + ADRs)")
print(f"statuses: " + ", ".join(f"{n:03d}={meta[n]['status']}" for n in numbers if meta[n]['status'] != 'accepted') + "; others accepted")
print(f"§4.2 rows parsed: {len(rows)}; README index rows: {len(index_rows)}")
for note in notes:
    print(note)
if errors:
    print(f"FAIL: {len(errors)} problem(s)")
    for message in errors:
        print("  - " + message)
    sys.exit(1)
print("PASS: all checks passed")
