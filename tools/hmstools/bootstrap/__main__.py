"""tools/bootstrap [all|jdk|gradle|gitleaks|venv|frontend|env|requirements-lock] [options]."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .core import BootstrapError, log
from .steps import (
    GITLEAKS_DEFAULT_VERSION,
    ensure_frontend,
    ensure_gitleaks,
    ensure_gradle,
    ensure_jdk,
    ensure_venv,
    env_script,
    lock_requirements,
)

DESCRIPTION = """\
Fetch the project-local toolchain into .tools/ (git-ignored). Idempotent: anything already present
and verified is reused. Every download is checked against a SHA-256 checksum from the vendor before
it is used. Nothing is written outside the repository, no system software is installed and
'corepack enable' is never run.

steps:
  jdk        a JDK 25 for this OS and CPU into .tools/jdk-*: Eclipse Temurin through the
             api.adoptium.net assets API (which returns the checksum); fallback Amazon Corretto 25
             from corretto.aws with its published latest_sha256. An existing .tools/jdk-* that
             reports version 25 is reused.
  gradle     the distribution named in backend/gradle/wrapper/gradle-wrapper.properties
             (distributionUrl, distributionSha256Sum; the built-in default is Gradle 9.8.1 while the
             file does not exist) placed into .tools/gradle-home/wrapper/dists/<name>/<base36(md5(url))>/,
             where the Gradle wrapper looks for it.
  gitleaks   gitleaks 8.x for this OS and CPU from the official GitHub release, verified against
             that release's checksums file, into .tools/bin/.
  venv       .tools/venv from tools/requirements.txt with pip --require-hashes; a venv that already
             matches the pins is reused.
  frontend   frontend/node_modules from frontend/pnpm-lock.yaml: 'corepack pnpm install
             --frozen-lockfile' with the pnpm that frontend/package.json pins (Corepack checks its
             hash; pnpm checks every package's sha512). Corepack's cache is .tools/corepack and the
             pnpm store .tools/pnpm-store. Needs Node.js 24 with Corepack.
  all        jdk, gradle, gitleaks, venv and frontend (the default).
  env        print shell exports (JAVA_HOME, GRADLE_USER_HOME, COREPACK_HOME, PATH with .tools/bin)
             for eval "$(sh tools/bootstrap env)".
  requirements-lock
             regenerate tools/requirements.txt (with hashes) from tools/requirements.in using the
             PyPI JSON API.
"""

MIRROR_HELP = (
    "fetch the Gradle distribution from this mirror instead of services.gradle.org (a directory URL or "
    "the full .zip URL). The file is still verified against the official checksum, from "
    "gradle-wrapper.properties or the official .sha256 file, so a mirror cannot change what is installed. "
    "Use it because services.gradle.org downloads are very slow from this network (20-30 KB/s)."
)


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(
        prog="tools/bootstrap",
        description=DESCRIPTION,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "step",
        nargs="?",
        default="all",
        choices=["all", "jdk", "gradle", "gitleaks", "venv", "frontend", "env", "requirements-lock"],
    )
    parser.add_argument("--gradle-mirror", metavar="URL", help=MIRROR_HELP)
    parser.add_argument(
        "--gitleaks-version",
        default=GITLEAKS_DEFAULT_VERSION,
        metavar="VERSION",
        help=f"gitleaks 8.x.y to install, or 'latest' for the newest stable 8.x (default {GITLEAKS_DEFAULT_VERSION})",
    )
    parser.add_argument("--root", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)

    root = (args.root or Path(__file__).resolve().parents[3]).resolve()
    if not (root / "BUILD-PROMPT.md").is_file():
        print(f"tools/bootstrap: {root} is not the repository root", file=sys.stderr)
        return 2
    try:
        if args.step == "env":
            sys.stdout.write(env_script(root))
            return 0
        if args.step == "requirements-lock":
            lock_requirements(root)
            return 0
        failures = []
        steps = ["jdk", "gradle", "gitleaks", "venv", "frontend"] if args.step == "all" else [args.step]
        for step in steps:
            try:
                if step == "jdk":
                    ensure_jdk(root)
                elif step == "gradle":
                    ensure_gradle(root, args.gradle_mirror)
                elif step == "gitleaks":
                    ensure_gitleaks(root, args.gitleaks_version)
                elif step == "venv":
                    ensure_venv(root)
                elif step == "frontend":
                    ensure_frontend(root)
            except BootstrapError as exc:
                log(f"{step}: FAILED: {exc}")
                failures.append(step)
        if failures:
            log(f"failed steps: {', '.join(failures)}")
            return 1
        log("done; load the environment with: eval \"$(sh tools/bootstrap env)\"")
        return 0
    except BootstrapError as exc:
        log(f"FAILED: {exc}")
        return 1
    except KeyboardInterrupt:
        log("interrupted; partial downloads are kept as .part files and resumed next time")
        return 1


if __name__ == "__main__":
    sys.exit(main())
