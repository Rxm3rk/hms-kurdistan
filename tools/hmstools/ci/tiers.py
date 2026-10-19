"""The four CI tiers of BUILD-PROMPT.md §19.1 as step lists.

- fast:    the fast-tier steps (built in WP-0.1; cell-lint added in WP-0.2).
- merge:   the fast steps, then the merge-tier contents of §19.1.
- nightly: the fast steps, then the nightly contents of §19.1.
- release: the fast and merge steps, then the release contents of §19.1.

A step that a later work package builds is a NotBuiltStep naming that work package. It counts as a
failure, so merge, nightly and release fail until everything in them exists (fail closed).
"""

from __future__ import annotations

import os
import shutil
import time
from pathlib import Path
from typing import Callable

from ..bootstrap.steps import venv_python
from .counts import gitleaks_findings, gitleaks_summary, junit_counts, unittest_counts
from .runner import FAIL, PASS, CommandStep, Context, FunctionStep, NotBuiltStep, Outcome, Step, run_process, combine

TIERS = ("fast", "merge", "nightly", "release")
FRESH_TOLERANCE_S = 5.0  # filesystem timestamp granularity

BACKEND_JUNIT = [("backend", "**/build/test-results/**/*.xml")]
FRONTEND_JUNIT = [("frontend/reports/junit", "*.xml")]


# --------------------------------------------------------------------------- JUnit helpers


def junit_paths(root: Path, patterns: list[tuple[str, str]]) -> list[Path]:
    found: set[Path] = set()
    for base, pattern in patterns:
        directory = root / base
        if directory.is_dir():
            found.update(p for p in directory.glob(pattern) if p.is_file() and "node_modules" not in p.parts)
    return sorted(found)


def clear_junit(patterns: list[tuple[str, str]]) -> Callable[[Context], None]:
    """Delete stale JUnit XML before the step, so the counts come from this run only."""

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
        CommandStep("backlog-check", ["sh", "tools/hms", "backlog", "check", "--json"], check_json=True, timeout=300),
        # The cell's pins (deploy/site-cell/cell.yaml): digests, checksums, licences, local paths, budgets (WP-0.2).
        CommandStep("cell-lint", ["sh", "tools/hms", "cell", "lint", "--json"], check_json=True, timeout=300),
        CommandStep(
            "backend-fast", gradle, timeout=1800, prepare=clear_junit(BACKEND_JUNIT),
            evaluate=missing_file_guard(
                "backend/gradlew", "the backend skeleton", evaluate_junit(BACKEND_JUNIT, "backend fastTier")
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

NIGHTLY_NOT_BUILT = [
    ("cell-check", "The named cell is up and reachable", "WP-0.2"),
    ("property-1e6", "10^6 randomised property-based command sequences across all invariants (C2)", "WP-0.5"),
    ("property-channels", ">= 10^4 sequences through each real channel adapter", "WP-0.5"),
    ("scenario-suites", "Clinical scenario suites (§18.5)", "WP-0.5"),
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


def tier_steps(tier: str, root: Path) -> list[Step]:
    if tier == "fast":
        return fast_steps(root)
    if tier == "merge":
        return fast_steps(root) + not_built(MERGE_NOT_BUILT)
    if tier == "nightly":
        return fast_steps(root) + not_built(NIGHTLY_NOT_BUILT)
    if tier == "release":
        merge = [s for s in not_built(MERGE_NOT_BUILT)]
        return fast_steps(root) + merge + not_built(RELEASE_NOT_BUILT)
    raise ValueError(f"unknown tier {tier!r}")
