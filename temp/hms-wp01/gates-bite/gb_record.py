"""Results and record rendering for gates-bite.sh. Run with: python3 -I gb_record.py <command> ...

  row     append one result row (JSON line) and print a one-line summary
  meta    set one key of the meta JSON file
  render  write the Markdown record from the rows and the meta file
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
GENERIC_FAIL = re.compile(
    r"(^ERROR\b|\bFAIL(ED|URE)?\b|\berror\b|What went wrong|Execution failed|AssertionError|✖)", re.I
)
GENERIC_PASS = re.compile(r"(: PASS\b|\bPASS\b|BUILD SUCCESSFUL|^OK\b|PARTIAL)")
MAX_LINE = 320
OUTPUT_MARK = "# ---- output ----"

GATES = [
    ("repo-check", "Repository rules", "repo-check"),
    ("python-unit-tests", "Python unit tests of the programme tools", "python-unit-tests"),
    ("safety-check", "Hazard log and the sign-off gate", "safety-check"),
    ("signoff-anchor", "The sign-off gate with a listed key (scratch trust anchor)", "safety-check"),
    ("backlog-check", "Backlog", "backlog-check"),
    ("ci-runner", "The CI runner's check contract", "any check step (here backlog-check)"),
    ("secret-scan", "Secret scan", "secret-scan"),
    ("frontend", "Frontend", "frontend-fast"),
    ("backend", "Backend", "backend-fast"),
]


def clean_lines(text: str) -> list[str]:
    return [ANSI.sub("", line).rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]


def shorten(line: str) -> str:
    line = " ".join(line.split())
    return line if len(line) <= MAX_LINE else line[: MAX_LINE - 1] + "…"


def last_json(lines: list[str]) -> dict | None:
    for line in reversed(lines):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            try:
                data = json.loads(line)
            except ValueError:
                continue
            if isinstance(data, dict) and "ok" in data:
                return data
    return None


def cmd_row(args: argparse.Namespace) -> None:
    text = Path(args.log).read_text(encoding="utf-8", errors="replace") if Path(args.log).is_file() else ""
    lines = clean_lines(text)
    if args.strip:  # show repository-relative paths
        lines = [line.replace(args.strip, "") for line in lines]
    # gates-bite.sh writes a header (gate, plant, command) before the output: read only the output.
    if OUTPUT_MARK in lines:
        lines = lines[lines.index(OUTPUT_MARK) + 1:]
    json_line = last_json(lines)
    # The CheckResult JSON line repeats every error: name the violation from the human-readable lines only.
    text_lines = [l for l in lines if not (l.strip().startswith("{") and l.strip().endswith("}"))]
    pass_codes = {int(c) for c in args.pass_codes.split(",")}
    note = args.note or ""
    if args.not_applicable:
        result, exit_code = "NOT-APPLICABLE", None
        note = args.not_applicable
    elif args.not_planted:
        result, exit_code = "NOT-PLANTED", None
    else:
        exit_code = int(args.exit)
        result = "PASS" if exit_code in pass_codes else "FAIL"
        if exit_code == 124:
            note = (note + "; " if note else "") + "timed out"
        data = json_line if args.json_check else None
        if result == "PASS" and data is not None and data.get("ok") is not True:
            result = "FAIL"
            note = (note + "; " if note else "") + "exit code 0 but the JSON says ok=false"
    naming, matched = "", False
    if result == "FAIL" or result == "NOT-PLANTED":
        # Several --regex options are tried in order: the first that matches a line names the violation.
        for pattern in args.regex or []:
            regex = re.compile(pattern)
            naming = next((l for l in text_lines if regex.search(l)), "")
            if naming:
                matched = True
                break
        if not naming:
            naming = next((l for l in text_lines if l.strip() and GENERIC_FAIL.search(l)), "")
    elif result == "PASS":
        regex = re.compile(args.pass_regex) if args.pass_regex else GENERIC_PASS
        hits = [l for l in text_lines if regex.search(l)]
        naming = hits[-1] if hits else ""
        matched = bool(hits)
    also = []
    if args.also and result in ("PASS", "FAIL"):
        regex = re.compile(args.also)
        for line in text_lines:
            if regex.search(line) and shorten(line) not in also and shorten(line) != shorten(naming):
                also.append(shorten(line))
            if len(also) >= 4:
                break
    row = {
        "n": args.n,
        "gate": args.gate,
        "kind": args.kind,
        "plant": args.plant,
        "same_plant": args.same_plant,
        "command": args.command,
        "exit": exit_code,
        "result": result,
        "expect": args.expect,
        "naming": shorten(naming),
        "naming_matched": matched,
        "also": also,
        "note": note,
        "label": args.label,
        "duration_s": round(float(args.duration), 1),
        "log": args.log,
    }
    with open(args.results, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    flag = " (naming pattern not found)" if result in ("FAIL", "NOT-PLANTED") and not matched else ""
    print(f"{args.gate}: {result} (exit {exit_code}, {row['duration_s']} s){flag}: {row['naming'][:200]}")


def cmd_meta(args: argparse.Namespace) -> None:
    path = Path(args.meta)
    data = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    data[args.key] = args.value
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def cell(text: str) -> str:
    return text.replace("\\", "\\\\").replace("|", "\\|").replace("\n", " ")


def code(text: str) -> str:
    if not text:
        return ""
    text = text.replace("|", "\\|")
    fence = "``" if "`" in text else "`"
    pad = " " if fence == "``" else ""
    return f"{fence}{pad}{text}{pad}{fence}"


def result_cell(row: dict) -> str:
    if row["result"] == "NOT-APPLICABLE":
        return "**not applicable at this commit** (not run)<br>" + cell(row["note"])
    word = row["result"]
    exit_text = "no exit code" if row["exit"] is None else f"exit {row['exit']}"
    parts = [f"**{word}** ({exit_text}, {row['duration_s']:.0f} s)"]
    if row["naming"]:
        parts.append(code(row["naming"]))
    for extra in row.get("also") or []:
        parts.append(code(extra))
    if row["result"] in ("FAIL", "NOT-PLANTED") and not row["naming_matched"]:
        parts.append("(the expected naming line was not found; first failure line shown)")
    if row["note"]:
        parts.append(cell(row["note"]))
    return "<br>".join(parts)


def cmd_render(args: argparse.Namespace) -> None:
    meta = json.loads(Path(args.meta).read_text(encoding="utf-8"))
    rows = [json.loads(l) for l in Path(args.results).read_text(encoding="utf-8").splitlines() if l.strip()]
    plants = [r for r in rows if r["kind"] == "plant"]
    plant_ids = sorted({r["n"] for r in plants})
    # One verdict per plant: FAIL if every command of the plant failed, PASS if every one passed.
    verdicts = {}
    for n in plant_ids:
        results = {r["result"] for r in plants if r["n"] == n}
        verdicts[n] = results.pop() if len(results) == 1 else "MIXED"
    fail_n = sum(1 for v in verdicts.values() if v == "FAIL")
    pass_n = sum(1 for v in verdicts.values() if v == "PASS")
    na_n = sum(1 for v in verdicts.values() if v == "NOT-APPLICABLE")
    other_n = len(verdicts) - fail_n - pass_n - na_n
    clean = [r for r in rows if r["kind"] == "clean"]
    final = [r for r in rows if r["kind"] == "final"]
    unexpected = []
    for n in plant_ids:
        first = next(r for r in plants if r["n"] == n)
        expect = first["expect"]
        if expect in ("FAIL", "PASS") and verdicts[n] not in (expect, "NOT-APPLICABLE"):
            unexpected.append(f"plant {n} ({first['gate']}): {verdicts[n]}, expected {expect}")
    for r in clean + final:
        if r["result"] != "PASS":
            unexpected.append(f"clean run of {r['gate']} ({r['command']}): {r['result']}")
    unmatched = [r for r in plants if r["result"] == "FAIL" and not r["naming_matched"]]

    out = []
    w = out.append
    w(f"# Gates bite on planted violations at `{meta['short_sha']}` ({meta['date']})")
    w("")
    w(
        "**What this shows.** Each fast-tier gate of `tools/ci/run` fails when a violation is planted, and passes "
        "again once the violation is removed. A gate that never fails proves nothing (BUILD-PROMPT §3.5, §19.1). "
        "The plants are those of `docs/program/evidence/ci/2026-10-18-gates-bite.md` and of the WP-0.1 review "
        "(`docs/program/reviews/WP-0.1.md` section 2), plus, where the commit has the allowed-signers list of the "
        "R-01 fix, plants that reach each rule of that fix behind a scratch trust anchor; one at a time, each "
        "followed by a reset of the clone."
    )
    w("")
    w(
        f"**Where it ran.** WSL build host, no cell. Clone `{meta['clone']}`, detached at "
        f"`{meta['sha']}` ({cell(meta['subject'])}). Host: `{meta['uname']}`; {meta['os']}; {meta['cpus']} CPUs, "
        f"{meta['ram']} RAM. `java -version`: `{meta['java']}`. `node -v`: `{meta['node']}`; pnpm {meta['pnpm']} "
        f"through Corepack; {meta['gitleaks']}; Python {meta['python']} (project venv); git {meta['git']}; "
        f"{meta['gpg']}."
    )
    w("")
    w(
        f"**How it ran.** `{meta['script']}` (sha256 `{meta['script_sha256']}`), run as `{meta['invocation']}`. "
        f"It checked out `{meta['short_sha']}` detached, ran `sh tools/bootstrap` ({meta['bootstrap']}), loaded the "
        "project toolchain with `eval \"$(sh tools/bootstrap env)\"` and set `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`, "
        "as `tools/ci/run` does. For each plant it applied the violation (a scratch file, an edit, or a scratch "
        "commit or branch), ran only the gate concerned with the command `tools/ci/run` uses for that step (shown "
        "verbatim; run from the repository root, `cd frontend` where shown), and recorded the exit code and the "
        "output line that names the violation. Then it ran `git reset --hard "
        f"{meta['short_sha']}`, `git clean -fdx --exclude=.tools --exclude=node_modules` (the bootstrap caches stay), "
        "deleted any scratch branch, and checked that `git status --short` was empty, `HEAD` was back at "
        f"`{meta['short_sha']}` and the branch list was unchanged before the next plant. A run of `tools/ci/run` "
        "with `--only` is PARTIAL by design: exit 3 means the selected step passed, exit 1 that it failed. "
        f"Started {meta['started']}, finished {meta['finished']}, {meta['duration']} in total. {meta.get('wait_note', '')}"
    )
    w("")
    summary = (
        f"**Result.** {len(plant_ids)} plants: {fail_n} FAIL, {pass_n} PASS"
        + (f", {na_n} not applicable at this commit" if na_n else "")
        + (f", {other_n} other" if other_n else "")
        + ". "
    )
    passes = [n for n in plant_ids if verdicts[n] == "PASS"]
    if passes:
        described = []
        for n in passes:
            first = next(r for r in plants if r["n"] == n)
            tag = {"REPORT-R01": "the R-01 plant, reported as it is", "PASS": "expected"}.get(first["expect"], "unexpected")
            if first.get("label"):
                tag += f": {first['label']}"
            described.append(f"plant {n} ({first['gate']}, {tag})")
        summary += "PASS: " + "; ".join(described) + ". "
    summary += (
        f"Clean runs after the plants: {sum(1 for r in clean if r['result'] == 'PASS')} of {len(clean)} PASS. "
    )
    if final:
        summary += f"Full fast tier on the clean tree: {final[-1]['result']} ({code(final[-1]['naming'])}). "
    summary += f"After the run: {meta.get('after', '?')}."
    w(summary)
    if unexpected:
        w("")
        w("**Different from what was expected:** " + "; ".join(cell(u) for u in unexpected) + ".")
    if unmatched:
        w("")
        w(
            "**Naming line not found** (the gate failed, but no output line matched the plant's pattern; the first "
            "failure line is shown instead): " + ", ".join(f"plant {r['n']} ({r['gate']})" for r in unmatched) + "."
        )
    for gate, title, step in GATES:
        gate_rows = [r for r in plants if r["gate"] == gate]
        if not gate_rows:
            continue
        w("")
        w(f"## {title} (`tools/ci/run` step `{step}`)")
        w("")
        if meta.get(f"intro_{gate}"):
            w(meta[f"intro_{gate}"])
            w("")
        w("| # | Planted violation | Command | Result |")
        w("|---|---|---|---|")
        for r in gate_rows:
            plant = "(same plant)" if r["same_plant"] else cell(r["plant"])
            w(f"| {r['n'] if not r['same_plant'] else ''} | {plant} | {code(r['command'])} | {result_cell(r)} |")
    if clean:
        w("")
        w("## Clean runs after the plants (no violation)")
        w("")
        w("| Gate | Command | Result |")
        w("|---|---|---|")
        for r in clean:
            w(f"| {r['gate']} | {code(r['command'])} | {result_cell(r)} |")
    if final:
        w("")
        w("## The fast tier on the clean tree")
        w("")
        w("| Command | Result |")
        w("|---|---|")
        for r in final:
            w(f"| {code(r['command'])} | {result_cell(r)} |")
        if meta.get("final_steps"):
            w("")
            w(meta["final_steps"])
    if meta.get("notes"):
        w("")
        w("## Notes")
        w("")
        for line in meta["notes"].split("\n"):
            if line.strip():
                w(f"- {line.strip()}")
    w("")
    Path(args.out).write_text("\n".join(out), encoding="utf-8")
    print(
        f"record written: {args.out} ({len(plant_ids)} plants: {fail_n} FAIL, {pass_n} PASS, "
        f"{na_n} not applicable, {other_n} other)"
    )
    for u in unexpected:
        print(f"UNEXPECTED: {u}")


def cmd_final_steps(args: argparse.Namespace) -> None:
    """Summarise a tools/ci/run run.json as one Markdown line and store it in the meta file."""
    run = json.loads(Path(args.run_json).read_text(encoding="utf-8"))
    steps = ", ".join(f"{s['name']} {s['result']}" for s in run.get("steps", []))
    totals = run.get("totals", {})
    tests = ", ".join(f"{k} {totals[k]}" for k in ("tests", "failures", "errors", "skipped") if k in totals)
    line = (
        f"Steps: {steps}. Totals: {totals.get('passed')} passed, {totals.get('failed')} failed, "
        f"{totals.get('not_built')} not built; {tests}; {run.get('duration_s')} s; git dirty: "
        f"{run.get('git', {}).get('dirty')}. No evidence record was written (`--no-evidence`); the step logs went to "
        "the git-ignored `build/ci-logs/` and were removed by the final clean."
    )
    args.key, args.value = "final_steps", line
    cmd_meta(args)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    row = sub.add_parser("row")
    row.add_argument("--results", required=True)
    row.add_argument("--n", type=int, default=0)
    row.add_argument("--gate", required=True)
    row.add_argument("--kind", choices=["plant", "clean", "final"], default="plant")
    row.add_argument("--plant", default="")
    row.add_argument("--same-plant", action="store_true")
    row.add_argument("--command", required=True)
    row.add_argument("--log", required=True)
    row.add_argument("--exit", default="0")
    row.add_argument("--not-planted", action="store_true")
    row.add_argument("--not-applicable", default="", help="the reason the plant does not apply at this commit")
    row.add_argument("--pass-codes", default="0")
    row.add_argument("--json-check", action="store_true")
    row.add_argument("--regex", action="append", default=[])
    row.add_argument("--pass-regex", default="")
    row.add_argument("--also", default="")
    row.add_argument("--expect", default="FAIL")
    row.add_argument("--note", default="")
    row.add_argument("--label", default="", help="a short label for an expected PASS, shown in the summary")
    row.add_argument("--duration", default="0")
    row.add_argument("--strip", default="", help="a path prefix to remove from the output lines (the clone root)")
    meta = sub.add_parser("meta")
    meta.add_argument("--meta", required=True)
    meta.add_argument("key")
    meta.add_argument("value")
    render = sub.add_parser("render")
    render.add_argument("--results", required=True)
    render.add_argument("--meta", required=True)
    render.add_argument("--out", required=True)
    final = sub.add_parser("final-steps")
    final.add_argument("--meta", required=True)
    final.add_argument("run_json")
    args = parser.parse_args()
    {"row": cmd_row, "meta": cmd_meta, "render": cmd_render, "final-steps": cmd_final_steps}[args.cmd](args)


if __name__ == "__main__":
    main()
