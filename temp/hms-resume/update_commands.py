"""Updates COMMANDS.md for the bootstrap frontend step and COREPACK_HOME."""
import sys
from pathlib import Path

p = Path(sys.argv[1]) / "docs/program/COMMANDS.md"
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:90]
    s = s.replace(old, new)


rep("| `sh tools/bootstrap` | Fetches the project-local toolchain into `.tools/` (git-ignored): JDK 25, the Gradle distribution, gitleaks and the venv. Every download is checked against its vendor's SHA-256; anything already present and verified is reused | Windows (reused everything, 1.5 s); WSL (fetched everything, 7.5 min) |",
    "| `sh tools/bootstrap` | Fetches the project-local toolchain into `.tools/` (git-ignored): JDK 25, the Gradle distribution, gitleaks, the venv, and the frontend packages (`frontend/node_modules`, installed from the lockfile, with Corepack's cache in `.tools/corepack` and the pnpm store in `.tools/pnpm-store`). Every download is checked against its vendor's SHA-256 or the lockfile's sha512; anything already present and verified is reused | Windows (reused everything, 1.5 s, before the frontend step existed); WSL (fetched everything, 7.5 min) |")
rep("| `sh tools/bootstrap jdk` (or `gradle`, `gitleaks`, `venv`) | One step only | Windows (`all`, the default, covers each) |",
    "| `sh tools/bootstrap jdk` (or `gradle`, `gitleaks`, `venv`, `frontend`) | One step only. `frontend` runs `corepack pnpm install --frozen-lockfile` in `frontend/` | Windows (each step on its own; `frontend` reinstalled `node_modules` in 20 s) |")
rep("| `eval \"$(sh tools/bootstrap env)\"` | Sets `JAVA_HOME`, `GRADLE_USER_HOME` and `PATH` for the project-local toolchain in the current shell. Needed before any Gradle command | Windows, WSL |",
    "| `eval \"$(sh tools/bootstrap env)\"` | Sets `JAVA_HOME`, `GRADLE_USER_HOME`, `COREPACK_HOME` and `PATH` for the project-local toolchain in the current shell. Needed before any Gradle or pnpm command | Windows |")
rep("**Frontend** (pnpm through Corepack; **run from `frontend/`**: Corepack picks the pnpm version from the `package.json` in the current directory, and from the repository root `corepack pnpm --dir frontend ...` starts the wrong pnpm and stops with `ERR_PNPM_BAD_PM_VERSION`):",
    "**Frontend** (pnpm through Corepack, after `eval \"$(sh tools/bootstrap env)\"` so that Corepack uses the project-local cache; **run from `frontend/`**: Corepack picks the pnpm version from the `package.json` in the current directory, and from the repository root `corepack pnpm --dir frontend ...` starts the wrong pnpm and stops with `ERR_PNPM_BAD_PM_VERSION`):")
rep("| `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm install --frozen-lockfile` | Installs exactly the lockfile | Windows |",
    "| `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm install --frozen-lockfile` | Installs exactly the lockfile (what `sh tools/bootstrap frontend` runs) | Windows |")
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
