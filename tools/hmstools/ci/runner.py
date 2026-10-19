"""The CI runner: runs a tier's steps in order, keeps going after a failure, and writes the evidence record.

Results per step: PASS, FAIL or NOT-BUILT. NOT-BUILT counts as a failure, so a tier with any step not
built yet fails (fail closed, §19.1 "no shortcuts"). A run limited with --only is PARTIAL, never PASS.
"""

from __future__ import annotations

import json
import os
import platform
import re
import shlex
import signal
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

from ..bootstrap.steps import is_pinned_jdk, parse_java_version
from .counts import TEST_KEYS, check_counts, last_json_line

SCHEMA_VERSION = 1
LOG_TAIL_LINES = 60

PASS, FAIL, NOT_BUILT = "PASS", "FAIL", "NOT-BUILT"


def now() -> datetime:
    return datetime.now().astimezone()


def iso(moment: datetime) -> str:
    return moment.isoformat(timespec="seconds")


@dataclass
class Context:
    """What a step can see while it runs."""

    root: Path
    run_dir: Path  # build/ci-logs/<run_id>/
    env: dict[str, str]
    index: int = 0


@dataclass
class Outcome:
    result: str
    exit_code: Optional[int]
    counts: dict[str, Any] = field(default_factory=dict)
    message: str = ""
    output: str = ""  # combined stdout and stderr (written to the step log)


class Step:
    name: str = "step"
    cwd: str = "."

    def command(self) -> str:
        return ""

    def run(self, ctx: Context) -> Outcome:  # pragma: no cover - interface
        raise NotImplementedError


def display(argv: list[str], root: Path) -> str:
    """The command as a person would type it from the repository root."""
    shown = []
    for arg in argv:
        text = str(arg)
        if Path(text).is_absolute():
            try:
                text = Path(text).resolve().relative_to(root.resolve()).as_posix()
            except (ValueError, OSError):
                pass
        shown.append(text)
    return " ".join(shlex.quote(a) for a in shown)


def kill_tree(proc: subprocess.Popen) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True, check=False)
    else:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            proc.kill()


def run_process(
    argv: list[str], cwd: Path, env: dict[str, str], log_base: Path, timeout: float
) -> tuple[Optional[int], str, str, bool]:
    """Run argv with stdout and stderr in files (never pipes, so a detached daemon cannot block us).

    Returns (exit code or None, stdout, stderr, timed_out)."""
    out_path = log_base.with_suffix(".stdout.part")
    err_path = log_base.with_suffix(".stderr.part")
    timed_out = False
    with open(out_path, "wb") as out, open(err_path, "wb") as err:
        try:
            proc = subprocess.Popen(
                argv,
                cwd=str(cwd),
                env=env,
                stdout=out,
                stderr=err,
                stdin=subprocess.DEVNULL,
                start_new_session=(os.name != "nt"),
            )
        except OSError as exc:
            return None, "", f"cannot start {argv[0]}: {exc}\n", False
        try:
            code: Optional[int] = proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            kill_tree(proc)
            code = proc.wait()
        except KeyboardInterrupt:
            kill_tree(proc)
            proc.wait()
            raise
    # Normalise CRLF (Windows text-mode output) so parsers and logs see LF only.
    stdout = out_path.read_bytes().decode("utf-8", errors="replace").replace("\r\n", "\n")
    stderr = err_path.read_bytes().decode("utf-8", errors="replace").replace("\r\n", "\n")
    out_path.unlink()
    err_path.unlink()
    return code, stdout, stderr, timed_out


def combine(stdout: str, stderr: str) -> str:
    parts = []
    if stdout:
        parts.append(stdout if stdout.endswith("\n") else stdout + "\n")
    if stderr:
        parts.append("--- stderr ---\n" + (stderr if stderr.endswith("\n") else stderr + "\n"))
    return "".join(parts)


class CommandStep(Step):
    """Run a command. ``prepare`` runs first (for example deleting stale test reports); ``evaluate``
    turns the exit code and output into counts and a result."""

    def __init__(
        self,
        name: str,
        argv: list[str],
        *,
        cwd: str = ".",
        timeout: float = 900.0,
        env: Optional[dict[str, str]] = None,
        prepare: Optional[Callable[[Context], None]] = None,
        evaluate: Optional[Callable[[Context, int, str, str], Outcome]] = None,
        check_json: bool = False,
        display_argv: Optional[list[str]] = None,
    ):
        self.name, self.argv, self.cwd, self.timeout = name, argv, cwd, timeout
        self.extra_env = env or {}
        self.prepare, self.evaluate, self.check_json = prepare, evaluate, check_json
        self.display_argv = display_argv
        self._root: Optional[Path] = None

    def command(self) -> str:
        argv = self.display_argv or self.argv
        return display(argv, self._root) if self._root else " ".join(shlex.quote(str(a)) for a in argv)

    def run(self, ctx: Context) -> Outcome:
        self._root = ctx.root
        if self.prepare:
            self.prepare(ctx)
        env = {**ctx.env, **self.extra_env}
        log_base = ctx.run_dir / f"{ctx.index:02d}-{self.name}"
        code, stdout, stderr, timed_out = run_process(
            [str(a) for a in self.argv], ctx.root / self.cwd, env, log_base, self.timeout
        )
        output = combine(stdout, stderr)
        if code is None:
            return Outcome(FAIL, None, message=stderr.strip(), output=output)
        if timed_out:
            return Outcome(FAIL, code, message=f"timed out after {self.timeout:.0f} s; process tree killed", output=output)
        if self.evaluate:
            outcome = self.evaluate(ctx, code, stdout, stderr)
            outcome.output = output
            return outcome
        if self.check_json:
            return evaluate_check(code, stdout, output)
        return Outcome(PASS if code == 0 else FAIL, code, output=output)


def evaluate_check(code: int, stdout: str, output: str) -> Outcome:
    """A 'check' command must follow the CheckResult contract: exit 0/1/2 and a JSON last line."""
    data = last_json_line(stdout)
    if data is None:
        return Outcome(
            FAIL, code, message="no CheckResult JSON object on the last stdout line (common.py contract)", output=output
        )
    counts = check_counts(data)
    if code == 0 and data.get("ok") is True:
        return Outcome(PASS, code, counts, output=output)
    if code == 0 and data.get("ok") is not True:
        return Outcome(FAIL, code, counts, message="exit code 0 but the JSON says ok=false", output=output)
    message = "; ".join(str(e) for e in (data.get("errors") or [])[:5])
    if code == 2:
        message = "usage or environment error: " + message
    return Outcome(FAIL, code, counts, message=message, output=output)


class NotBuiltStep(Step):
    """A step of the tier that a later work package builds. It always fails (fail closed)."""

    def __init__(self, name: str, what: str, work_package: str):
        self.name, self.what, self.work_package = name, what, work_package

    def command(self) -> str:
        return f"(not built: {self.what})"

    def run(self, ctx: Context) -> Outcome:
        return Outcome(
            NOT_BUILT,
            None,
            message=f"{self.what}: not built yet; {self.work_package} builds it. Counted as a failure (fail closed).",
        )


class FunctionStep(Step):
    """A step implemented in Python (for example the secret scan, which runs gitleaks twice)."""

    def __init__(self, name: str, function: Callable[[Context], Outcome], command: str, cwd: str = "."):
        self.name, self.function, self._command, self.cwd = name, function, command, cwd

    def command(self) -> str:
        return self._command

    def run(self, ctx: Context) -> Outcome:
        return self.function(ctx)


# --------------------------------------------------------------------------- evidence helpers


def git_info(root: Path, ignore_untracked_under: Optional[str] = None) -> dict[str, Any]:
    """The commit, branch and dirty state of root's working tree.

    By default every change counts, untracked files included; the CI runner's records use that rule. With
    ignore_untracked_under (a repository-relative prefix such as "docs/program/evidence/"), untracked files
    under that prefix do not make the tree dirty and are counted in "untracked_evidence_outputs_ignored";
    untracked files elsewhere and any change to a tracked file still count. The cell's records use that rule.
    """

    def git(*args: str, strip: bool = True) -> Optional[str]:
        try:
            proc = subprocess.run(["git", "-C", str(root), *args], capture_output=True, check=False)
        except OSError:
            return None
        if proc.returncode != 0:
            return None
        text = proc.stdout.decode("utf-8", "replace")
        return text.strip() if strip else text

    sha = git("rev-parse", "HEAD")
    short = git("rev-parse", "--short", "HEAD")
    branch = git("rev-parse", "--abbrev-ref", "HEAD") or git("symbolic-ref", "--short", "HEAD")
    # Not stripped: each porcelain line starts with two status columns, and the first is a space for a change
    # that is not staged (" M path"); stripping the output would cut the first character of that path.
    status = git("status", "--porcelain=v1", "--untracked-files=all", strip=False) or ""
    lines = [line for line in status.splitlines() if len(line) > 3]
    ignored = [line[3:] for line in lines
               if ignore_untracked_under and line.startswith("?? ") and line[3:].startswith(ignore_untracked_under)]
    files = [line[3:] for line in lines if line[3:] not in ignored]
    info: dict[str, Any] = {
        "sha": sha,
        "short_sha": short or "nocommit",
        "branch": branch,
        "dirty": bool(files),
        "dirty_files": files[:500],
        "dirty_files_total": len(files),
    }
    if ignore_untracked_under:
        info["untracked_evidence_outputs_ignored"] = len(ignored)
    return info


def output_of(argv: list[str], env: dict[str, str]) -> Optional[str]:
    """A command's stdout and stderr, stripped, if it exits 0 and prints something; None otherwise."""
    try:
        proc = subprocess.run(argv, capture_output=True, env=env, check=False, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    text = (proc.stdout + proc.stderr).decode("utf-8", "replace").strip()
    return text if proc.returncode == 0 and text else None


def first_line_of(argv: list[str], env: dict[str, str]) -> Optional[str]:
    text = output_of(argv, env)
    return text.splitlines()[0] if text else None


OutputOf = Callable[[list[str], dict[str, str]], Optional[str]]


def java_info(env: dict[str, str], output: OutputOf = output_of) -> dict[str, Any]:
    """What the JDK in JAVA_HOME says about itself, for the record's host block.

    ``java`` is the version line of ``java -version``. It names the version only, which another vendor's
    build of the same release shares, so ``java_runtime`` keeps the "Runtime Environment" line (vendor
    version and build) and ``java_identity`` the parsed fields of bootstrap.steps.JavaIdentity, with
    ``pinned`` true only for exactly the release ADR-002 pins. All three are None without JAVA_HOME or
    when java does not run.
    """
    info: dict[str, Any] = {"java": None, "java_runtime": None, "java_identity": None}
    java_home = env.get("JAVA_HOME")
    if not java_home:
        return info
    exe = Path(java_home) / "bin" / ("java.exe" if os.name == "nt" else "java")
    text = output([str(exe), "-XX:-UsePerfData", "-version"], env)
    if not text:
        return info
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    info["java"] = next((line for line in lines if 'version "' in line), lines[0])
    info["java_runtime"] = next((line for line in lines if "Runtime Environment" in line), None)
    identity = parse_java_version(text)
    if identity is not None:
        info["java_identity"] = {
            "version": identity.version,
            "runtime_version": identity.runtime_version,
            "vendor_version": identity.vendor_version,
            "pinned": is_pinned_jdk(identity),
        }
    return info


def host_info(env: dict[str, str]) -> dict[str, Any]:
    from ..doctor.host import total_ram_gib

    os_version = f"{platform.release()} ({platform.version()})"
    if platform.system() == "Linux":
        try:
            with open("/etc/os-release", encoding="utf-8") as handle:
                match = re.search(r'^PRETTY_NAME="?([^"\n]+)"?', handle.read(), re.M)
            if match:
                os_version = f"{match.group(1)}, kernel {platform.release()}"
            with open("/proc/version", encoding="utf-8") as handle:
                if "microsoft" in handle.read().lower():
                    os_version += " (WSL2)"
        except OSError:
            pass
    from shutil import which

    node_exe = which("node", path=env.get("PATH"))
    ram = total_ram_gib()
    return {
        "os": platform.system(),
        "os_version": os_version,
        "arch": platform.machine(),
        "cpu_count": os.cpu_count(),
        "ram_gb": None if ram is None else round(ram, 1),
        "python": platform.python_version(),
        **java_info(env),
        "node": first_line_of([node_exe, "--version"], env) if node_exe else None,
    }


def tail(text: str, lines: int = LOG_TAIL_LINES) -> str:
    return "\n".join(text.splitlines()[-lines:])


# --------------------------------------------------------------------------- runner


@dataclass
class RunConfig:
    root: Path
    tier: str
    steps: list[Step]
    env: dict[str, str]
    cell: str = "none"
    only: Optional[list[str]] = None
    write_evidence: bool = True
    evidence_dir: Optional[Path] = None
    logs_dir: Optional[Path] = None
    echo: Callable[[str], None] = lambda line: print(line, flush=True)
    host: Optional[dict[str, Any]] = None  # tests pass a fixed host block


@dataclass
class RunReport:
    record: dict[str, Any]
    evidence_path: Optional[Path]
    exit_code: int


def run_tier(config: RunConfig) -> RunReport:
    started = now()
    git = git_info(config.root)
    run_id = f"{started.strftime('%Y%m%dT%H%M%S')}-{config.tier}-{git['short_sha']}-{uuid.uuid4().hex[:6]}"
    logs_dir = config.logs_dir or config.root / "build" / "ci-logs"
    run_dir = logs_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    selected = [s for s in config.steps if not config.only or s.name in config.only]
    partial = bool(config.only)
    config.echo(
        f"tools/ci/run {config.tier}: {len(selected)} step(s){' (PARTIAL: --only)' if partial else ''}; "
        f"logs in {run_dir.relative_to(config.root).as_posix() if run_dir.is_relative_to(config.root) else run_dir}"
    )
    results = []
    interrupted = False
    for index, step in enumerate(selected, start=1):
        step_started = now()
        clock = time.monotonic()
        config.echo(f"[{index}/{len(selected)}] {step.name} ...")
        ctx = Context(root=config.root, run_dir=run_dir, env=dict(config.env), index=index)
        try:
            outcome = step.run(ctx)
        except KeyboardInterrupt:
            outcome = Outcome(FAIL, None, message="interrupted by the user")
            interrupted = True
        except Exception as exc:  # noqa: BLE001 - a broken step must fail, not crash the run
            outcome = Outcome(FAIL, None, message=f"step crashed: {type(exc).__name__}: {exc}")
        duration = round(time.monotonic() - clock, 2)
        log_path = run_dir / f"{index:02d}-{step.name}.log"
        header = f"# {step.name}\n# command: {step.command()}\n# cwd: {step.cwd}\n# result: {outcome.result}"
        header += f" (exit code {outcome.exit_code})\n" + (f"# {outcome.message}\n" if outcome.message else "")
        with open(log_path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(header + "\n" + outcome.output)
        entry: dict[str, Any] = {
            "name": step.name,
            "command": step.command(),
            "cwd": step.cwd,
            "started_at": iso(step_started),
            "duration_s": duration,
            "exit_code": outcome.exit_code,
            "result": outcome.result,
            "counts": outcome.counts,
            "log": log_path.relative_to(config.root).as_posix() if log_path.is_relative_to(config.root) else str(log_path),
        }
        if isinstance(step, NotBuiltStep):
            entry["work_package"] = step.work_package
        if outcome.message:
            entry["message"] = outcome.message
        if outcome.result != PASS:
            entry["log_tail"] = tail(outcome.output) if outcome.output else outcome.message
        results.append(entry)
        summary = ", ".join(f"{k}={v}" for k, v in outcome.counts.items() if k in TEST_KEYS or k.endswith("findings"))
        config.echo(
            f"[{index}/{len(selected)}] {step.name}: {outcome.result} ({duration:.1f} s)"
            + (f" {summary}" if summary else "")
            + (f" - {outcome.message}" if outcome.message and outcome.result != PASS else "")
        )
        if interrupted:
            break
    finished = now()
    failed = [r for r in results if r["result"] == FAIL]
    not_built = [r for r in results if r["result"] == NOT_BUILT]
    totals: dict[str, Any] = {
        "steps": len(results),
        "passed": sum(1 for r in results if r["result"] == PASS),
        "failed": len(failed),
        "not_built": len(not_built),
    }
    for key in TEST_KEYS:
        totals[key] = sum(int(r["counts"].get(key, 0) or 0) for r in results)
    ok = not failed and not not_built and not interrupted and len(results) == len(selected)
    if partial:
        result = "PARTIAL"
        exit_code = 3 if ok else 1
    else:
        result = PASS if ok else FAIL
        exit_code = 0 if ok else 1
    record = {
        "schema_version": SCHEMA_VERSION,
        "tool": "tools/ci/run",
        "run_id": run_id,
        "tier": config.tier,
        "started_at": iso(started),
        "finished_at": iso(finished),
        "duration_s": round((finished - started).total_seconds(), 2),
        "git": git,
        "host": config.host if config.host is not None else host_info(config.env),
        "cell": config.cell,
        "partial": partial,
        "only": list(config.only or []),
        "steps": results,
        "totals": totals,
        "result": result,
        "logs": run_dir.relative_to(config.root).as_posix() if run_dir.is_relative_to(config.root) else str(run_dir),
    }
    evidence_path = None
    if config.write_evidence:
        evidence_dir = config.evidence_dir or config.root / "docs" / "program" / "evidence" / "ci"
        name = f"{started.strftime('%Y-%m-%d')}-{config.tier}-{git['short_sha']}"
        name += "-dirty" if git["dirty"] else ""
        name += "-partial" if partial else ""
        evidence_path = evidence_dir / f"{name}.json"
        evidence_path.parent.mkdir(parents=True, exist_ok=True)
        with open(evidence_path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(record, indent=2, ensure_ascii=False) + "\n")
    with open(run_dir / "run.json", "w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(record, indent=2, ensure_ascii=False) + "\n")
    tests = ", ".join(f"{k}={totals[k]}" for k in TEST_KEYS)
    config.echo(
        f"tools/ci/run {config.tier}: {result} ({totals['passed']} passed, {totals['failed']} failed, "
        f"{totals['not_built']} not built; {tests}; {record['duration_s']:.0f} s)"
    )
    if evidence_path:
        shown = evidence_path.relative_to(config.root).as_posix() if evidence_path.is_relative_to(config.root) else evidence_path
        config.echo(f"evidence: {shown}")
    if interrupted:
        raise KeyboardInterrupt
    return RunReport(record=record, evidence_path=evidence_path, exit_code=exit_code)


def python_exe() -> str:
    return sys.executable
