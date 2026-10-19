"""Adds the bootstrap 'frontend' step, a project-local pnpm store and Corepack home, with tests."""
import sys
from pathlib import Path

root = Path(sys.argv[1])


def rep(rel, old, new):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, (rel, old[:90])
    p.write_text(s.replace(old, new), encoding="utf-8", newline="\n")


# --- pnpm store inside the repository -----------------------------------------------------------
rep("frontend/pnpm-workspace.yaml", "# pnpm is pinned by \"packageManager\"; upgrades go through the version rule and ADR-002, not the notifier.\nupdateNotifier: false\n",
    "# pnpm is pinned by \"packageManager\"; upgrades go through the version rule and ADR-002, not the notifier.\nupdateNotifier: false\n"
    "# The package store is project-local, like the Gradle home: .tools/ is git-ignored, and installing never\n"
    "# writes outside the repository. 'sh tools/bootstrap frontend' fills it.\n"
    "storeDir: ../.tools/pnpm-store\n")

# --- bootstrap steps ------------------------------------------------------------------------------
S = "tools/hmstools/bootstrap/steps.py"
rep(S, '"""The bootstrap steps: JDK 25, the Gradle distribution, gitleaks, the project venv and the shell environment."""',
    '"""The bootstrap steps: JDK 25, the Gradle distribution, gitleaks, the project venv, the frontend packages\nand the shell environment."""')
rep(S, 'VENV = Path(".tools/venv")\n',
    'VENV = Path(".tools/venv")\n\n# Corepack keeps the pnpm it downloads here (COREPACK_HOME), inside .tools/ like the Gradle home.\nCOREPACK_HOME = "corepack"\n')
rep(S, "# =========================================================================== env\n",
    '''# =========================================================================== frontend


def ensure_frontend(root: Path) -> Path:
    """frontend/node_modules exactly as frontend/pnpm-lock.yaml pins it.

    Runs 'corepack pnpm install --frozen-lockfile' in frontend/. Corepack fetches the pnpm version that
    frontend/package.json pins and checks it against the packageManager hash; pnpm checks every package
    against the sha512 integrity in the lockfile and fails if the lockfile does not match package.json.
    Corepack's cache (COREPACK_HOME) and the pnpm store (storeDir in frontend/pnpm-workspace.yaml) are
    under .tools/, so nothing is written outside the repository. 'corepack enable' is never run.
    """
    frontend = root / "frontend"
    if not (frontend / "package.json").is_file():
        log("frontend: no frontend/package.json; nothing to install")
        return frontend
    corepack = shutil.which("corepack")
    if not corepack:
        raise BootstrapError("corepack is not on PATH; it ships with Node.js 24 LTS (see tools/doctor)")
    env = apply_toolchain_env(root, private_env(root))
    env["COREPACK_ENABLE_DOWNLOAD_PROMPT"] = "0"
    log("frontend: corepack pnpm install --frozen-lockfile (in frontend/)")
    try:
        proc = subprocess.run(
            [corepack, "pnpm", "install", "--frozen-lockfile"],
            cwd=frontend,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=1800,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise BootstrapError(f"corepack pnpm install could not run: {exc}") from exc
    output = proc.stdout.decode("utf-8", errors="replace").strip().splitlines()
    if proc.returncode != 0:
        tail = " | ".join(output[-8:])
        raise BootstrapError(f"corepack pnpm install --frozen-lockfile failed (exit {proc.returncode}): {tail}")
    if output:
        log(f"frontend: {output[-1]}")
    return frontend / "node_modules"


# =========================================================================== env
''')
rep(S, '''    env = {"GRADLE_USER_HOME": str(tools_dir(root) / "gradle-home")}
    jdk = find_project_jdk(root)''', '''    env = {
        "GRADLE_USER_HOME": str(tools_dir(root) / "gradle-home"),
        "COREPACK_HOME": str(tools_dir(root) / COREPACK_HOME),
    }
    jdk = find_project_jdk(root)''')
rep(S, '''    lines.append(f"export GRADLE_USER_HOME={shell_quote(convert(tools_dir(root) / 'gradle-home'))}")''',
    '''    lines.append(f"export GRADLE_USER_HOME={shell_quote(convert(tools_dir(root) / 'gradle-home'))}")
    lines.append(f"export COREPACK_HOME={shell_quote(convert(tools_dir(root) / COREPACK_HOME))}")''')
rep(S, '''    """JAVA_HOME, GRADLE_USER_HOME and the PATH entries to prepend, as native absolute paths."""''',
    '''    """JAVA_HOME, GRADLE_USER_HOME, COREPACK_HOME and the PATH entries to prepend, as native absolute paths."""''')

M = "tools/hmstools/bootstrap/__main__.py"
rep(M, '"""tools/bootstrap [all|jdk|gradle|gitleaks|venv|env|requirements-lock] [options]."""',
    '"""tools/bootstrap [all|jdk|gradle|gitleaks|venv|frontend|env|requirements-lock] [options]."""')
rep(M, "    ensure_gitleaks,\n    ensure_gradle,\n", "    ensure_frontend,\n    ensure_gitleaks,\n    ensure_gradle,\n")
rep(M, """  venv       .tools/venv from tools/requirements.txt with pip --require-hashes; a venv that already
             matches the pins is reused.
  all        jdk, gradle, gitleaks and venv (the default).
  env        print shell exports (JAVA_HOME, GRADLE_USER_HOME, PATH with .tools/bin) for
             eval "$(sh tools/bootstrap env)".""",
"""  venv       .tools/venv from tools/requirements.txt with pip --require-hashes; a venv that already
             matches the pins is reused.
  frontend   frontend/node_modules from frontend/pnpm-lock.yaml: 'corepack pnpm install
             --frozen-lockfile' with the pnpm that frontend/package.json pins (Corepack checks its
             hash; pnpm checks every package's sha512). Corepack's cache is .tools/corepack and the
             pnpm store .tools/pnpm-store. Needs Node.js 24 with Corepack.
  all        jdk, gradle, gitleaks, venv and frontend (the default).
  env        print shell exports (JAVA_HOME, GRADLE_USER_HOME, COREPACK_HOME, PATH with .tools/bin)
             for eval "$(sh tools/bootstrap env)".""")
rep(M, '        choices=["all", "jdk", "gradle", "gitleaks", "venv", "env", "requirements-lock"],',
    '        choices=["all", "jdk", "gradle", "gitleaks", "venv", "frontend", "env", "requirements-lock"],')
rep(M, '        steps = ["jdk", "gradle", "gitleaks", "venv"] if args.step == "all" else [args.step]',
    '        steps = ["jdk", "gradle", "gitleaks", "venv", "frontend"] if args.step == "all" else [args.step]')
rep(M, """                elif step == "venv":
                    ensure_venv(root)""", """                elif step == "venv":
                    ensure_venv(root)
                elif step == "frontend":
                    ensure_frontend(root)""")

# --- doctor: check the pnpm the build uses ------------------------------------------------------
C = "tools/hmstools/doctor/checks.py"
rep(C, '''    env["COREPACK_ENABLE_NETWORK"] = "0"  # the doctor never downloads; a missing pnpm is reported instead''',
    '''    env["COREPACK_ENABLE_NETWORK"] = "0"  # the doctor never downloads; a missing pnpm is reported instead
    env["COREPACK_HOME"] = str(host.root / ".tools" / "corepack")  # the project-local cache the build uses''')
F = "tools/hmstools/doctor/fixes.py"
rep(F, '''    "pnpm": [
        "cd frontend && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm --version",
        "# fetches the pnpm version pinned in frontend/package.json into the Corepack cache;"
        " run pnpm as 'corepack pnpm ...' and never 'corepack enable'",
    ],''', '''    "pnpm": [
        "sh tools/bootstrap frontend   # the pnpm pinned in frontend/package.json into .tools/corepack,"
        " and the locked packages into frontend/node_modules",
        "# run pnpm as 'corepack pnpm ...' from frontend/, after eval \\"$(sh tools/bootstrap env)\\"; never 'corepack enable'",
    ],''')

# --- tests --------------------------------------------------------------------------------------
T = "tools/hmstools/bootstrap/tests/test_bootstrap.py"
t = (root / T).read_text(encoding="utf-8")
t = t.rstrip("\n") + '''


class Frontend(TempRoot):
    def test_toolchain_env_and_env_script_set_a_project_local_corepack_home(self) -> None:
        expected = self.root / ".tools" / "corepack"
        self.assertEqual(steps.toolchain_env(self.root)["COREPACK_HOME"], str(expected))
        script = steps.env_script(self.root, msys=False)
        self.assertIn(f"export COREPACK_HOME='{expected}'", script)

    def test_nothing_to_install_without_frontend_package_json(self) -> None:
        self.assertEqual(steps.ensure_frontend(self.root), self.root / "frontend")

    def _with_package_json(self) -> None:
        (self.root / "frontend").mkdir()
        (self.root / "frontend" / "package.json").write_text("{}\\n", encoding="utf-8")

    def test_missing_corepack_fails_with_a_clear_message(self) -> None:
        self._with_package_json()
        original = steps.shutil.which
        steps.shutil.which = lambda name, *a, **k: None
        try:
            with self.assertRaisesRegex(core.BootstrapError, "corepack is not on PATH"):
                steps.ensure_frontend(self.root)
        finally:
            steps.shutil.which = original

    def _fake_run(self, returncode: int, output: bytes):
        calls = []

        def run(argv, **kwargs):
            calls.append((argv, kwargs))
            return steps.subprocess.CompletedProcess(argv, returncode, stdout=output)

        return calls, run

    def test_frozen_install_in_frontend_with_project_local_caches(self) -> None:
        self._with_package_json()
        calls, fake = self._fake_run(0, b"Lockfile is up to date\\nDone in 1s\\n")
        original_which, original_run = steps.shutil.which, steps.subprocess.run
        steps.shutil.which = lambda name, *a, **k: "/usr/bin/corepack"
        steps.subprocess.run = fake
        try:
            result = steps.ensure_frontend(self.root)
        finally:
            steps.shutil.which, steps.subprocess.run = original_which, original_run
        self.assertEqual(result, self.root / "frontend" / "node_modules")
        argv, kwargs = calls[0]
        self.assertEqual(argv, ["/usr/bin/corepack", "pnpm", "install", "--frozen-lockfile"])
        self.assertEqual(kwargs["cwd"], self.root / "frontend")
        self.assertEqual(kwargs["env"]["COREPACK_HOME"], str(self.root / ".tools" / "corepack"))
        self.assertEqual(kwargs["env"]["COREPACK_ENABLE_DOWNLOAD_PROMPT"], "0")

    def test_failed_install_raises_with_the_output_tail(self) -> None:
        self._with_package_json()
        calls, fake = self._fake_run(1, b"ERR_PNPM_OUTDATED_LOCKFILE Cannot install with frozen-lockfile\\n")
        original_which, original_run = steps.shutil.which, steps.subprocess.run
        steps.shutil.which = lambda name, *a, **k: "/usr/bin/corepack"
        steps.subprocess.run = fake
        try:
            with self.assertRaisesRegex(core.BootstrapError, "exit 1.*ERR_PNPM_OUTDATED_LOCKFILE"):
                steps.ensure_frontend(self.root)
        finally:
            steps.shutil.which, steps.subprocess.run = original_which, original_run
'''
(root / T).write_text(t, encoding="utf-8", newline="\n")
print("ok")
