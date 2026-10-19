"""The four CI tiers of BUILD-PROMPT.md §19.1 as step lists.

- fast:    the fast-tier steps (built in WP-0.1).
- merge:   the fast steps, then the merge-tier contents of §19.1.
- nightly: the fast steps, then the nightly contents of §19.1.
- release: the fast and merge steps, then the release contents of §19.1.

A step that a later work package builds is a NotBuiltStep naming that work package. It counts as a
failure, so merge, nightly and release fail until everything in them exists (fail closed).

WP-0.5 wiring (docs/specs/modules/state-machines-and-invariants.md §7): the fast step state-machines-check; the
backend-fast record's sequence and SI counts; the nightly steps property-1e6, si-domain-layer and
scenario-suites. property-channels stays NOT-BUILT until the channel adapters exist.
"""

from __future__ import annotations

import json
import os
import shutil
import time
from pathlib import Path
from typing import Any, Callable

from ..bootstrap.steps import venv_python
from .counts import gitleaks_findings, gitleaks_summary, junit_counts, unittest_counts
from .runner import FAIL, PASS, CommandStep, Context, FunctionStep, NotBuiltStep, Outcome, Step, run_process, combine

TIERS = ("fast", "merge", "nightly", "release")
FRESH_TOLERANCE_S = 5.0  # filesystem timestamp granularity

# The tests/invariants and tests/scenarios Gradle projects build under tests/<name>/build, outside backend/
# (docs/specs/modules/state-machines-and-invariants.md §7).
BACKEND_JUNIT = [("backend", "**/build/test-results/**/*.xml"), ("tests", "**/build/test-results/**/*.xml")]
FRONTEND_JUNIT = [("frontend/reports/junit", "*.xml")]
# Each sequence run writes <project build dir>/pbt-counts/<test task>/<name>.json (spec §3.3; hms.test-conventions),
# and each SI test tests/invariants/build/si-status/SI-nn.json (spec §4).
PBT_COUNTS = [("backend", "**/build/pbt-counts/**/*.json"), ("tests", "**/build/pbt-counts/**/*.json")]
SI_STATUS = [("tests/invariants/build/si-status", "SI-*.json")]
PASS_MATRIX_DIR = "tests/scenarios/build/reports/scenarios"  # written by :tests:scenarios:scenarioSuites (spec §5)
PASS_MATRIX = f"{PASS_MATRIX_DIR}/pass-matrix.json"
NIGHTLY_SEQUENCES = 1_000_000  # §19.1: 10^6 sequences per property in the nightly tier
SPEC_LAYER_NOTE = (
    "These are specification-layer models and SI properties: the generated machine models driven by the real predicate "
    "implementations over generated facts. No application-command layer or channel adapter of BUILD-PROMPT §18.3 exists "
    "yet, so this is not the 10^6 application-command-layer run of §19.1 (spec §7; KA-062)."
)


# --------------------------------------------------------------------------- JUnit helpers


def junit_paths(root: Path, patterns: list[tuple[str, str]]) -> list[Path]:
    found: set[Path] = set()
    for base, pattern in patterns:
        directory = root / base
        if directory.is_dir():
            found.update(p for p in directory.glob(pattern) if p.is_file() and "node_modules" not in p.parts)
    return sorted(found)


def clear_junit(patterns: list[tuple[str, str]]) -> Callable[[Context], None]:
    """Delete stale reports (JUnit XML, counts files) before the step, so the counts come from this run only."""

    def prepare(ctx: Context) -> None:
        for path in junit_paths(ctx.root, patterns):
            try:
                path.unlink()
            except OSError:
                pass  # files that cannot be deleted are ignored by the freshness filter below
        ctx.env["HMS_CI_STEP_STARTED"] = str(time.time())

    return prepare


def evaluate_junit(patterns: list[tuple[str, str]], what: str) -> Callable[[Context, int, str, str], Outcome]:
    def evaluate(ctx: Context, code: int, stdout: str, stderr: str) -> Outcome:
        started = float(ctx.env.get("HMS_CI_STEP_STARTED", "0"))
        files = junit_paths(ctx.root, patterns)
        fresh = [p for p in files if p.stat().st_mtime >= started - FRESH_TOLERANCE_S]
        counts = junit_counts(fresh)
        counts["stale_files_ignored"] = len(files) - len(fresh)
        if code != 0:
            return Outcome(FAIL, code, counts, message=f"{what} exited with code {code}")
        if not fresh:
            where = ", ".join(f"{b}/{p}" for b, p in patterns)
            return Outcome(FAIL, code, counts, message=f"no JUnit XML written by this run under {where}; cannot show that tests ran")
        if counts["tests"] == 0:
            return Outcome(FAIL, code, counts, message="the JUnit XML of this run holds no test cases")
        if counts["failures"] or counts["errors"] or counts["unparseable_files"]:
            return Outcome(FAIL, code, counts, message="exit code 0 but the JUnit XML reports failures, errors or unreadable files")
        return Outcome(PASS, code, counts)

    return evaluate


def evaluate_unittest(ctx: Context, code: int, stdout: str, stderr: str) -> Outcome:
    counts = unittest_counts(stderr + "\n" + stdout)
    if counts is None:
        return Outcome(FAIL, code, message="no unittest summary ('Ran N tests') in the output")
    ok = counts.pop("ok", 0)
    if code != 0 or not ok:
        return Outcome(FAIL, code, counts, message=f"unittest reported failures={counts['failures']} errors={counts['errors']}")
    if counts["tests"] == 0:
        return Outcome(FAIL, code, counts, message="no tests ran")
    return Outcome(PASS, code, counts)


def missing_file_guard(path: str, wp_hint: str, inner: Callable[[Context, int, str, str], Outcome]):
    def evaluate(ctx: Context, code: int, stdout: str, stderr: str) -> Outcome:
        if not (ctx.root / path).exists():
            return Outcome(FAIL, code, message=f"{path} does not exist ({wp_hint})")
        return inner(ctx, code, stdout, stderr)

    return evaluate


# --------------------------------------------------------------------------- sequence counts, SI status, scenarios


def _started(ctx: Context) -> float:
    return float(ctx.env.get("HMS_CI_STEP_STARTED", "0"))


def _fresh_json(ctx: Context, patterns: list[tuple[str, str]]) -> tuple[list[tuple[str, Any]], int, list[str]]:
    """The JSON files this run wrote: [(repository path, data)], how many stale files were ignored, unreadable paths."""
    started = _started(ctx)
    fresh, stale, unreadable = [], 0, []
    for path in junit_paths(ctx.root, patterns):
        rel = path.relative_to(ctx.root).as_posix()
        if path.stat().st_mtime < started - FRESH_TOLERANCE_S:
            stale += 1
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError):
            unreadable.append(rel)
            continue
        if not isinstance(data, dict):
            unreadable.append(rel)
            continue
        fresh.append((rel, data))
    return fresh, stale, unreadable


def _count(value: Any) -> int | None:
    return value if type(value) is int and value >= 0 else None


def pbt_runs(ctx: Context) -> tuple[list[dict[str, Any]], int, list[str]]:
    """One entry per sequence run of this step (spec §3.3 counts files), the stale files ignored, unreadable files."""
    fresh, stale, unreadable = _fresh_json(ctx, PBT_COUNTS)
    runs = []
    for rel, data in fresh:
        runs.append({
            "name": data.get("name"), "machine": data.get("machine"), "file": rel, "budget": data.get("budget"),
            "sequences": data.get("sequences"), "steps": data.get("steps"), "result": data.get("result"),
            "transitions_covered": data.get("transitions_covered"), "transitions_total": data.get("transitions_total"),
        })
    return runs, stale, unreadable


def si_statuses(ctx: Context) -> tuple[dict[str, int], list[str]]:
    """The SI counts of this step's tests/invariants run (spec §4 reporting rule 4) and unreadable files."""
    fresh, _stale, unreadable = _fresh_json(ctx, SI_STATUS)
    counts = {"si_status_files": len(fresh), "si_spec_layer_holds": 0, "si_spec_layer_failed": 0, "si_domain_not_built": 0}
    for _rel, data in fresh:
        counts["si_spec_layer_holds"] += data.get("spec_layer") == "HOLDS"
        counts["si_spec_layer_failed"] += data.get("spec_layer") == "FAILED"
        counts["si_domain_not_built"] += data.get("domain_layer") == "NOT-BUILT"
    return counts, unreadable


def _sequence_totals(runs: list[dict[str, Any]], unreadable: list[str], stale: int) -> dict[str, Any]:
    return {
        "pbt_runs": len(runs),
        "pbt_sequences": sum(_count(r["sequences"]) or 0 for r in runs),
        "pbt_steps": sum(_count(r["steps"]) or 0 for r in runs),
        "pbt_counts_unreadable": len(unreadable),
        "pbt_counts_stale_ignored": stale,
    }


def with_backend_counts(inner: Callable[[Context, int, str, str], Outcome]) -> Callable[[Context, int, str, str], Outcome]:
    """backend-fast passes as before (JUnit); its record adds the sequence and SI counts (spec §7)."""

    def evaluate(ctx: Context, code: int, stdout: str, stderr: str) -> Outcome:
        outcome = inner(ctx, code, stdout, stderr)
        runs, stale, unreadable = pbt_runs(ctx)
        si, si_unreadable = si_statuses(ctx)
        outcome.counts.update(_sequence_totals(runs, unreadable, stale))
        outcome.counts.update(si)
        outcome.counts["si_status_unreadable"] = len(si_unreadable)
        return outcome

    return evaluate


def evaluate_property_1e6(ctx: Context, code: int, stdout: str, stderr: str) -> Outcome:
    """property-1e6 (spec §7): every property passes, at 10^6 sequences each, and the record holds each run's count."""
    junit = evaluate_junit(BACKEND_JUNIT, "propertyTest at 10^6 sequences")(ctx, code, stdout, stderr)
    runs, stale, unreadable = pbt_runs(ctx)
    counts: dict[str, Any] = {**junit.counts, **_sequence_totals(runs, unreadable, stale), "pbt_sequences_per_test": runs}
    problems = [junit.message] if junit.result != PASS else []
    if not runs:
        problems.append("no sequence counts file (build/pbt-counts) written by this run; cannot show that any sequence ran")
    if unreadable:
        problems.append(f"{len(unreadable)} counts file(s) cannot be read: {', '.join(unreadable[:5])}")
    failed = [r for r in runs if r["result"] != "pass"]
    if failed:
        problems.append(f"{len(failed)} run(s) did not pass: {', '.join(str(r['name']) for r in failed[:10])}")
    short = [r for r in runs if (_count(r["sequences"]) or 0) < NIGHTLY_SEQUENCES]
    if short:
        problems.append(
            f"{len(short)} run(s) below {NIGHTLY_SEQUENCES:,} sequences: "
            + ", ".join(f"{r['name']} ({r['sequences']})" for r in short[:10])
        )
    total = counts["pbt_sequences"]
    summary = f"{len(runs)} sequence run(s), {total:,} sequences in total, the count of each in pbt_sequences_per_test. {SPEC_LAYER_NOTE}"
    if problems:
        return Outcome(FAIL, code, counts, message="; ".join(problems) + ". " + summary)
    return Outcome(PASS, code, counts, message=summary)


def evaluate_scenario_suites(ctx: Context, code: int, stdout: str, stderr: str) -> Outcome:
    """scenario-suites (spec §5, §7): every catalogued suite is bound and passes, read from the pass matrix."""
    path = ctx.root / PASS_MATRIX
    if not path.is_file() or path.stat().st_mtime < _started(ctx) - FRESH_TOLERANCE_S:
        return Outcome(FAIL, code, message=f"no pass matrix written by this run at {PASS_MATRIX} (exit code {code}); cannot show the suites ran")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as exc:
        return Outcome(FAIL, code, message=f"{PASS_MATRIX} cannot be read: {exc}")
    suites = data.get("suites") if isinstance(data, dict) else None
    if not isinstance(suites, list) or not all(isinstance(s, dict) for s in suites):
        return Outcome(FAIL, code, message=f"{PASS_MATRIX} has no list of suites")
    raw = data.get("counts") if isinstance(data.get("counts"), dict) else {}
    counts: dict[str, Any] = {k: v for k, v in raw.items() if _count(v) is not None}
    counts["suites_listed"] = len(suites)
    by_result: dict[str, list[str]] = {}
    for suite in suites:
        by_result.setdefault(str(suite.get("result")), []).append(str(suite.get("id")))
    problems = []
    if code != 0:
        problems.append(f"scenarioSuites exited with code {code}")
    if not suites:
        problems.append("the matrix lists no suite")
    for result, label in (("NOT-BUILT", "NOT-BUILT (no domain binding yet; KA-064)"), ("FAIL", "failing")):
        if by_result.get(result):
            problems.append(f"{len(by_result[result])} suite(s) {label}: {', '.join(by_result[result])}")
    other = sorted(set(by_result) - {"PASS", "FAIL", "NOT-BUILT"})
    if other:
        problems.append(f"suites with an unknown result: {', '.join(other)}")
    if data.get("result") != "PASS" and not problems:
        problems.append(f"the matrix says {data.get('result')!r}")
    mock = [str(s.get("id")) for s in suites if s.get("mock_kb") and s.get("result") == "PASS"]
    note = f" Mock-KB run, not clinical evidence: {', '.join(mock)} (§18.5 #1)." if mock else ""
    if problems:
        return Outcome(FAIL, code, counts, message="; ".join(problems) + "." + note)
    return Outcome(PASS, code, counts, message=f"{len(suites)} suite(s) bound and passing.{note}")


# --------------------------------------------------------------------------- secret scan


def gitleaks_exe(root: Path) -> Path:
    return root / ".tools" / "bin" / ("gitleaks.exe" if os.name == "nt" else "gitleaks")


def mirror_working_tree(root: Path, target: Path) -> int:
    """Hard-link (or copy) every tracked and untracked, not ignored, file into target."""
    import subprocess

    out = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        capture_output=True,
        check=True,
    ).stdout.decode("utf-8", "surrogateescape")
    count = 0
    for rel in sorted({p for p in out.split("\0") if p}):
        source = root / rel
        if not source.is_file() or source.is_symlink():
            continue
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(source, dest)
        except OSError:
            shutil.copy2(source, dest)
        count += 1
    return count


# The project history: every branch, tag and remote-tracking branch. Not 'git log --all', which would
# also read refs that tools outside the project create (for example editor checkpoint snapshots).
HISTORY_LOG_OPTS = "--full-history --branches --tags --remotes"


def secret_scan(ctx: Context) -> Outcome:
    # HMS_CI_GITLEAKS lets the self-test scan a scratch repository with the project's gitleaks binary.
    exe = Path(ctx.env["HMS_CI_GITLEAKS"]) if ctx.env.get("HMS_CI_GITLEAKS") else gitleaks_exe(ctx.root)
    config = ctx.root / ".gitleaks.toml"
    if not exe.is_file():
        return Outcome(FAIL, None, message=f".tools/bin/{exe.name} is missing; run: sh tools/bootstrap gitleaks")
    if not config.is_file():
        return Outcome(FAIL, None, message=".gitleaks.toml is missing")
    common = ["--config", str(config), "--redact", "--no-banner", "--no-color", "--report-format", "json", "--exit-code", "1"]
    history = ctx.run_dir / "gitleaks-history.json"
    tree_report = ctx.run_dir / "gitleaks-working-tree.json"
    code1, out1, err1, timeout1 = run_process(
        [str(exe), "git", *common, f"--log-opts={HISTORY_LOG_OPTS}", "--report-path", str(history), str(ctx.root)],
        ctx.root, ctx.env, ctx.run_dir / f"{ctx.index:02d}-gitleaks-git", 600,
    )
    mirror = ctx.run_dir / "secret-scan-tree"
    if mirror.exists():
        shutil.rmtree(mirror)
    files = mirror_working_tree(ctx.root, mirror)
    try:
        code2, out2, err2, timeout2 = run_process(
            [str(exe), "dir", *common, "--report-path", str(tree_report), "."],
            mirror, ctx.env, ctx.run_dir / f"{ctx.index:02d}-gitleaks-dir", 600,
        )
    finally:
        shutil.rmtree(mirror, ignore_errors=True)
    output = (
        "## gitleaks git (history)\n" + combine(out1, err1) + "\n## gitleaks dir (working tree incl. untracked)\n"
        + combine(out2, err2)
    )
    found1, found2 = gitleaks_findings(history), gitleaks_findings(tree_report)
    counts = {
        "history_findings": -1 if found1 is None else found1,
        "working_tree_findings": -1 if found2 is None else found2,
        "working_tree_files": files,
    }
    findings = gitleaks_summary(history) + gitleaks_summary(tree_report)
    if timeout1 or timeout2:
        return Outcome(FAIL, code2, counts, message="gitleaks timed out", output=output)
    if found1 is None or found2 is None:
        return Outcome(FAIL, code1 or code2, counts, message="gitleaks wrote no readable report", output=output)
    if code1 == 0 and code2 == 0 and not found1 and not found2:
        return Outcome(PASS, 0, counts, output=output)
    message = f"{found1 + found2} finding(s), secrets redacted: " + "; ".join(findings[:10])
    if code1 not in (0, 1) or code2 not in (0, 1):
        message = f"gitleaks error (exit codes {code1}, {code2}); " + message
    return Outcome(FAIL, code1 or code2, counts, message=message, output=output + "\n" + "\n".join(findings))


# --------------------------------------------------------------------------- tiers


def corepack_argv() -> list[str]:
    return [shutil.which("corepack") or "corepack"]


def fast_steps(root: Path) -> list[Step]:
    python = str(venv_python(root))
    shown_python = Path(python).relative_to(root).as_posix() if Path(python).is_relative_to(root) else python
    unittest_args = ["-I", "-m", "unittest", "discover", "-s", "tools", "-t", "tools", "-p", "test_*.py"]
    gradle = ["sh", "backend/gradlew", "-p", "backend", "fastTier", "-Phms.pbt.sequences=1000",
              "--no-build-cache", "--console=plain"]
    return [
        CommandStep("doctor-fast", ["sh", "tools/doctor", "--tier", "fast", "--json"], check_json=True, timeout=300),
        CommandStep("repo-check", ["sh", "tools/hms", "repo", "check", "--json"], check_json=True, timeout=300),
        CommandStep(
            "python-unit-tests", [python, *unittest_args], evaluate=evaluate_unittest, timeout=900,
            display_argv=[shown_python, *unittest_args],
        ),
        CommandStep("safety-check", ["sh", "tools/hms", "safety", "check", "--json"], check_json=True, timeout=300),
        CommandStep(
            "state-machines-check", ["sh", "tools/hms", "statemachines", "check", "--json"], check_json=True, timeout=300,
        ),
        CommandStep("backlog-check", ["sh", "tools/hms", "backlog", "check", "--json"], check_json=True, timeout=300),
        CommandStep(
            "backend-fast", gradle, timeout=1800, prepare=clear_junit(BACKEND_JUNIT + PBT_COUNTS + SI_STATUS),
            evaluate=missing_file_guard(
                "backend/gradlew", "the backend skeleton", with_backend_counts(evaluate_junit(BACKEND_JUNIT, "backend fastTier"))
            ),
        ),
        # Run from frontend/: at the repository root Corepack would pick its default pnpm, not the
        # version pinned in frontend/package.json (ERR_PNPM_BAD_PM_VERSION).
        CommandStep(
            "frontend-fast", [*corepack_argv(), "pnpm", "run", "fast"], cwd="frontend", timeout=1200,
            env={"COREPACK_ENABLE_DOWNLOAD_PROMPT": "0"}, prepare=clear_junit(FRONTEND_JUNIT),
            evaluate=missing_file_guard(
                "frontend/package.json", "the frontend skeleton", evaluate_junit(FRONTEND_JUNIT, "frontend fast")
            ),
            display_argv=["corepack", "pnpm", "run", "fast"],
        ),
        FunctionStep(
            "secret-scan", secret_scan,
            f".tools/bin/gitleaks git --config .gitleaks.toml --redact --log-opts='{HISTORY_LOG_OPTS}' . && "
            ".tools/bin/gitleaks dir --config .gitleaks.toml --redact <tracked and untracked, not ignored, files>",
        ),
    ]


MERGE_NOT_BUILT = [
    ("integration-tests", "Integration tests with Testcontainers (PostgreSQL, Kafka, Keycloak, OpenFGA)", "WP-0.3 (needs the container engine and dev stack of WP-0.2)"),
    ("contract-openapi", "OpenAPI 3.1 contract tests for module BFFs and public APIs", "WP-0.4"),
    ("contract-asyncapi", "AsyncAPI and CloudEvents contract tests for published events", "WP-0.3"),
    ("contract-hl7v2", "HL7 v2 conformance-profile tests per interface", "WP-1.1b"),
    ("contract-fhir", "FHIR validator against pinned profiles", "WP-1.12"),
    ("migration-n-1", "Migration upgrade-and-rollback test against N-1 (§6.8 #9)", "WP-0.3"),
    ("e2e-smoke", "End-to-end smoke in en, ckb and ar (Playwright)", "WP-0.7"),
    ("axe", "axe accessibility checks", "WP-0.7"),
    ("rtl-visual-diffs", "RTL visual diffs", "WP-0.7"),
    ("licence-scan-ort", "ORT licence scan from its official container image", "WP-0.9 (needs a container engine, WP-0.2)"),
    ("vulnerability-scan", "Dependency vulnerability scan (Trivy, OSV-Scanner)", "WP-0.9"),
    ("container-scan", "Container image scan", "WP-0.9 (images from WP-0.2)"),
    ("sbom", "CycloneDX SBOM generation and the licence check on it", "WP-0.9"),
    ("coverage-gates", "Coverage gates: domain and application >= 85% line and branch (§22.1)", "WP-0.3"),
    ("mutation-tests", "Mutation tests (PIT) on touched Tier 2 code", "WP-1.5 (first Tier 2 sidecar)"),
]

# Spec §7: property-channels "waits on each channel adapter's work package" (BUILD-PROMPT §18.3 lists the channels).
CHANNEL_ADAPTERS = (
    "each channel adapter's work package (UI command layer, API, mobile sync, HL7 inbound, migration loader, plugin effects)"
)

# §19.1 order. property-1e6, si-domain-layer and scenario-suites are built (nightly_built); the rest are not.
NIGHTLY_NOT_BUILT = [
    ("cell-check", "The named cell is up and reachable", "WP-0.2"),
    ("property-channels", ">= 10^4 sequences through each real channel adapter", CHANNEL_ADAPTERS),
    ("e2e-full", "Full end-to-end suites", "WP-0.7"),
    ("golden-image-print", "Golden-image print tests", "WP-0.8"),
    ("scaled-day-dev-cell", "Scaled functional day (about 30 beds) on the dev cell, p95 against the host baseline", "WP-0.6"),
    ("day-300-bed", "The 300-bed day on the reference cell", "WP-0.6 [HUMAN: reference hardware]"),
    ("day-1000-bed", "The 1,000-bed day on the central profile", "WP-0.6 [HUMAN: hardware]"),
    ("chaos", "Chaos: node kill, WAN cut, power-cut emulation, broker loss, database failover, clock skew", "WP-0.2"),
    ("restore-test", "Restore test", "WP-1.13"),
    ("parser-fuzzing", "Parser fuzzing (Jazzer)", "WP-1.1b"),
]

RELEASE_NOT_BUILT = [
    ("cell-check", "The named cell is up and reachable", "WP-0.2"),
    ("signed-images", "Signed container images (local registry, offline cosign keys, no transparency log)", "WP-0.9 (registry and signing from WP-0.2)"),
    ("helm-charts", "Helm charts", "WP-0.2"),
    ("tier2-sidecars", "Tier 2 sidecar builds", "WP-1.5"),
    ("desktop-shell", "Desktop shell build (Tauri 2)", "WP-0.7"),
    ("mobile-builds", "Mobile builds (React Native)", "WP-0.7 [HUMAN: iOS needs macOS]"),
    ("sbom-vex", "CycloneDX SBOM and VEX", "WP-0.9"),
    ("slsa-provenance", "SLSA provenance", "WP-0.9"),
    ("cosign-signatures", "cosign signatures", "WP-0.9"),
    ("release-evidence-pack", "The Release Evidence Pack (§10.1)", "WP-0.9"),
    ("release-notes", "Trilingual release notes", "WP-0.9"),
    ("offline-media", "Offline media image", "WP-1.13"),
]


def not_built(rows: list[tuple[str, str, str]]) -> list[Step]:
    return [NotBuiltStep(name, what, wp) for name, what, wp in rows]


def nightly_built() -> list[Step]:
    """The nightly steps WP-0.5 built (spec §7). Each fails closed on what does not exist yet."""
    property_1e6 = ["sh", "backend/gradlew", "-p", "backend", "propertyTest", f"-Phms.pbt.sequences={NIGHTLY_SEQUENCES}",
                    "--no-build-cache", "--console=plain"]
    scenarios = ["sh", "backend/gradlew", "-p", "backend", ":tests:scenarios:scenarioSuites", "--console=plain"]
    return [
        CommandStep(
            "property-1e6", property_1e6, timeout=6 * 3600, prepare=clear_junit(BACKEND_JUNIT + PBT_COUNTS),
            evaluate=missing_file_guard("backend/gradlew", "the backend skeleton", evaluate_property_1e6),
        ),
        CommandStep(
            "si-domain-layer", ["sh", "tools/hms", "statemachines", "si-status", "--require-domain", "--json"], check_json=True,
            timeout=300,
        ),
        CommandStep(
            "scenario-suites", scenarios, timeout=3600, prepare=clear_junit([(PASS_MATRIX_DIR, "pass-matrix.*")]),
            evaluate=missing_file_guard("backend/gradlew", "the backend skeleton", evaluate_scenario_suites),
        ),
    ]


def nightly_steps() -> list[Step]:
    """The nightly contents of §19.1 after the fast steps, in §19.1 order."""
    rows = {name: (name, what, wp) for name, what, wp in NIGHTLY_NOT_BUILT}
    built = {s.name: s for s in nightly_built()}
    order = ["cell-check", "property-1e6", "si-domain-layer", "property-channels", "scenario-suites"]
    order += [name for name in rows if name not in order]
    return [built[name] if name in built else not_built([rows[name]])[0] for name in order]


def tier_steps(tier: str, root: Path) -> list[Step]:
    if tier == "fast":
        return fast_steps(root)
    if tier == "merge":
        return fast_steps(root) + not_built(MERGE_NOT_BUILT)
    if tier == "nightly":
        return fast_steps(root) + nightly_steps()
    if tier == "release":
        merge = [s for s in not_built(MERGE_NOT_BUILT)]
        return fast_steps(root) + merge + not_built(RELEASE_NOT_BUILT)
    raise ValueError(f"unknown tier {tier!r}")
