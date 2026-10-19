"""Sign-off records in real git commits signed with real keys: GPG, and SSH where ssh-keygen can sign.

Each test builds a throwaway repository holding a sandbox copy of the safety files, signs commits with
keys generated for the test class in a temporary GnuPG home (and temporary SSH key files), and runs the
whole check, so git's own signature verification decides %G?. HistoryShapeTest builds, with real git, the
bypasses found when the R-01 fix was verified: forged commit messages, merges that git's default history
simplification hides, a record changed behind git status, a schema change, grafts and symbolic links.
MergeConflictTest builds the merges of probe-merge.sh (a line on which the agent anchored its own key, merged
into the human's line) and the ways such a conflict is settled or stays open, a routine signed merge and a
graft included. GpgSignedRecordTest also shows that a signed rejection withdraws an acceptance until a later
record supersedes it, however the rejection is removed. Nothing touches the user's keyring or git
configuration: GNUPGHOME, GIT_CONFIG_GLOBAL and GIT_CONFIG_NOSYSTEM point at temporary files while a test
runs, and the temporary GnuPG homes set ignore-time-conflict, because the WSL clock can step back after the
keys are made. The test classes skip, saying why, on a host without git, gpg or ssh-keygen.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest import mock

import yaml

from hmstools.common import CheckResult
from hmstools.safety import signoffs as so
from hmstools.safety.check import SafetyPaths, run_check
from hmstools.safety.tests.harness import REAL_SAFETY, REPO, Sandbox, hazard

NAME_A = "SYN-TEST-SIGNER-A"
NAME_B = "SYN-TEST-SIGNER-B"
SIGNERS_REL = "docs/safety/signoffs/allowed-signers.yaml"
AI_TRAILER = "\n\nCo-Authored-By: Claude <noreply@anthropic.com>"


def _run(argv: list[str], env: dict[str, str] | None = None, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env, cwd=cwd, check=False)


def _require(argv: list[str], env: dict[str, str] | None = None, cwd: Path | None = None) -> str:
    completed = _run(argv, env, cwd)
    if completed.returncode != 0:
        raise AssertionError(f"{' '.join(argv)} failed ({completed.returncode}): {completed.stderr.strip()}")
    return completed.stdout


def _gnupg_home(path: Path) -> str:
    """GNUPGHOME as gpg reads it. Git for Windows' gpg is an MSYS program whose agent starts only from a /c/… path."""
    if os.name != "nt":
        return str(path)
    drive, rest = os.path.splitdrive(str(path.resolve()))
    return "/" + drive.rstrip(":").lower() + rest.replace("\\", "/")


def _gpg_fingerprints(env: dict[str, str], uid: str) -> list[str]:
    out = _require(["gpg", "--batch", "--with-colons", "--fingerprint", "--fingerprint", uid], env)
    return [line.split(":")[9] for line in out.splitlines() if line.startswith("fpr:")]


class SignedRepoCase(unittest.TestCase):
    """One GnuPG home per class (keys A and B, both valid there) and a fresh repository per test."""

    tmp: tempfile.TemporaryDirectory[str]
    home: Path
    untrusted_home: Path
    key_a: str
    subkey_a: str
    key_b: str

    @classmethod
    def setUpClass(cls) -> None:
        for tool in ("git", "gpg"):
            if shutil.which(tool) is None:
                raise unittest.SkipTest(f"{tool} is not on PATH on this host")
        cls.tmp = tempfile.TemporaryDirectory(prefix="hms-signed-")
        base = Path(cls.tmp.name)
        cls.home = base / "gnupg"
        cls.untrusted_home = base / "gnupg-untrusted"
        for home in (cls.home, cls.untrusted_home):
            home.mkdir(mode=0o700)
            # The WSL clock can step back a few seconds after the keys are made; gpg then refuses to sign with a
            # key "created in the future" and git fails to write the commit. The option makes that a warning in
            # these throwaway homes only; it changes nothing that the gate reads (git's %G?, %GF and %GP).
            (home / "gpg.conf").write_text("ignore-time-conflict\n", encoding="utf-8", newline="\n")
        env = {**os.environ, "GNUPGHOME": _gnupg_home(cls.home)}
        quiet = ["gpg", "--batch", "--pinentry-mode", "loopback", "--passphrase", ""]
        try:
            for name in (NAME_A, NAME_B):
                _require([*quiet, "--quick-gen-key", f"{name} <{name.lower()}@example.invalid>", "ed25519", "sign", "never"], env)
            cls.key_a = _gpg_fingerprints(env, NAME_A)[0]
            _require([*quiet, "--quick-add-key", cls.key_a, "ed25519", "sign", "never"], env)
            cls.key_a, cls.subkey_a = _gpg_fingerprints(env, NAME_A)[:2]
            cls.key_b = _gpg_fingerprints(env, NAME_B)[0]
            # The same public key A in a keyring that does not vouch for it: git reports %G? = U there.
            public = _require(["gpg", "--batch", "--armor", "--export", cls.key_a], env)
            _require_input(["gpg", "--batch", "--import"], public, {**os.environ, "GNUPGHOME": _gnupg_home(cls.untrusted_home)})
        except AssertionError as exc:
            cls._kill_agents()
            cls.tmp.cleanup()
            raise unittest.SkipTest(f"gpg cannot make test keys in a temporary home on this host: {exc}") from exc

    @classmethod
    def _kill_agents(cls) -> None:
        if shutil.which("gpgconf"):
            for home in (cls.home, cls.untrusted_home):
                _run(["gpgconf", "--kill", "all"], {**os.environ, "GNUPGHOME": _gnupg_home(home)})

    @classmethod
    def tearDownClass(cls) -> None:
        cls._kill_agents()
        cls.tmp.cleanup()

    def setUp(self) -> None:
        self.box = Sandbox()
        self.addCleanup(self.box.close)
        self.root = self.box.root
        shutil.copy2(REAL_SAFETY / "signoffs" / "allowed-signers.schema.json", self.box.safety / "signoffs")
        self.git_config = Path(self.box.root.parent, f"{self.box.root.name}.gitconfig")
        self.addCleanup(lambda: self.git_config.unlink(missing_ok=True))
        self.write_git_config()
        patcher = mock.patch.dict(os.environ, {
            "GNUPGHOME": _gnupg_home(self.home), "GIT_CONFIG_GLOBAL": str(self.git_config), "GIT_CONFIG_NOSYSTEM": "1",
        })
        patcher.start()
        self.addCleanup(patcher.stop)
        self.git("init", "-q")
        self.commit("chore: the safety files, as the agent commits them")

    def write_git_config(self, allowed_signers_file: Path | None = None) -> None:
        lines = ["[user]", "\tname = SYN Test Committer", "\temail = committer@example.invalid", "[commit]", "\tgpgsign = false"]
        if allowed_signers_file is not None:
            lines += ['[gpg "ssh"]', f"\tallowedSignersFile = {allowed_signers_file.as_posix()}"]
        self.git_config.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # ------------------------------------------------------------------ repository helpers

    def git(self, *args: str) -> str:
        return _require(["git", "-C", str(self.root), *args])

    def commit(self, message: str, gpg_key: str | None = None, ssh_key: Path | None = None) -> None:
        self.git("add", "-A")
        if gpg_key is not None:
            self.git("-c", "gpg.format=openpgp", "-c", f"user.signingkey={gpg_key}!", "commit", "-q", "-S", "-m", message)
        elif ssh_key is not None:
            self.git("-c", "gpg.format=ssh", "-c", f"user.signingkey={ssh_key.as_posix()}", "commit", "-q", "-S", "-m", message)
        else:
            self.git("commit", "-q", "-m", message)

    def commit_verbatim(self, message: str, *paths: str, gpg_key: str | None = None) -> None:
        """Commit ``paths`` (every change if none) with ``message`` exactly as written, control characters included."""
        message_file = Path(self.box.root.parent, f"{self.box.root.name}.msg")
        self.addCleanup(lambda: message_file.unlink(missing_ok=True))
        message_file.write_bytes(message.encode("utf-8"))
        only = ["--", *paths] if paths else []
        self.git("add", "-A", *only)
        sign = ["-c", "gpg.format=openpgp", "-c", f"user.signingkey={gpg_key}!", "commit", "-S"] if gpg_key else ["commit"]
        self.git(*sign, "-q", "--cleanup=verbatim", "-F", str(message_file), *only)

    def head(self) -> str:
        return self.git("rev-parse", "HEAD").strip()

    def graft(self, commit: str, *parents: str) -> None:
        """Give ``commit`` other parents in this clone only (.git/info/grafts), and check that git honours it."""
        info = self.root / ".git" / "info"
        info.mkdir(exist_ok=True)
        (info / "grafts").write_text(f"{commit} {' '.join(parents)}\n", encoding="utf-8", newline="\n")
        self.assertEqual(self.git("rev-list", "--parents", "-1", commit).split()[1:], list(parents))

    def branch(self) -> str:
        return self.git("rev-parse", "--abbrev-ref", "HEAD").strip()

    def merge_keeping_tree_of(self, other: str, tree_of: str) -> None:
        """Make HEAD an unsigned merge of HEAD and ``other`` with the tree of ``tree_of``, as ``git commit-tree`` lets anyone."""
        merge = self.git("commit-tree", "-p", "HEAD", "-p", other, "-m", "Merge (synthetic)", f"{tree_of}^{{tree}}").strip()
        self.git("reset", "-q", "--hard", merge)

    @staticmethod
    def signers_text(*entries: dict[str, Any]) -> str:
        return "# Synthetic test list (provenance: synthetic).\n" + yaml.safe_dump({"schema_version": 1, "signers": list(entries)}, sort_keys=False)

    def list_signers(self, *entries: dict[str, Any], gpg_key: str | None = None, ssh_key: Path | None = None) -> None:
        (self.root / SIGNERS_REL).write_text(self.signers_text(*entries), encoding="utf-8", newline="\n")
        self.commit("docs(safety): change the allowed signers", gpg_key, ssh_key)

    @staticmethod
    def entry(name: str, fingerprint: str, roles: tuple[str, ...] = ("cso",), key_type: str = "gpg") -> dict[str, Any]:
        return {"name": name, "roles": list(roles), "key_type": key_type, "fingerprint": fingerprint, "added": "2099-01-01"}

    def accept_hazard_0001(self, name: str = NAME_A, role: str = "cso", commit: bool = True, message: str = "docs(safety): accept HAZ-0001",
                           gpg_key: str | None = None, ssh_key: Path | None = None) -> None:
        """Fill HAZ-0001 residual_risk.accepted_by and write its record, as a human would, in one commit."""
        self.box.mutate(lambda d: hazard(d, "HAZ-0001")["residual_risk"].update(accepted_by=name))
        with open(self.box.safety / "hazard-log.yaml", encoding="utf-8") as handle:
            version = so.subject_version(hazard(yaml.safe_load(handle), "HAZ-0001"), "accepted")
        record = {
            "id": "SO-2099-0001", "subject": "HAZ-0001", "subject_version": version, "field": "residual_risk.accepted_by",
            "role": role, "name": name, "date": "2099-01-01", "statement": "Synthetic test statement; authorises nothing outside the tests.",
            "decision": "accepted", "authentication": {"method": "signed-git-commit"},
        }
        text = "# Synthetic test record (provenance: synthetic).\n" + yaml.safe_dump(record, sort_keys=False)
        (self.box.safety / "signoffs" / "SO-2099-0001.yaml").write_text(text, encoding="utf-8", newline="\n")
        if commit:
            self.commit(message, gpg_key, ssh_key)

    def check(self, root: Path | None = None) -> CheckResult:
        paths = SafetyPaths.for_root(root or self.root)
        paths.build_prompt = REPO / "BUILD-PROMPT.md"
        return run_check(paths)

    def assertPasses(self, result: CheckResult) -> None:
        self.assertTrue(result.ok, "\n".join(result.errors))

    def assertFailsWith(self, result: CheckResult, *fragments: str) -> None:
        self.assertFalse(result.ok, "expected the check to fail")
        joined = "\n".join(result.errors)
        for fragment in fragments:
            self.assertIn(fragment, joined)


def _require_input(argv: list[str], data: str, env: dict[str, str]) -> None:
    completed = subprocess.run(argv, input=data, capture_output=True, text=True, encoding="utf-8", env=env, check=False)
    if completed.returncode != 0:
        raise AssertionError(f"{' '.join(argv)} failed ({completed.returncode}): {completed.stderr.strip()}")


class GpgSignedRecordTest(SignedRepoCase):
    def test_a_listed_key_signing_a_matching_record_passes(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))  # the trust anchor, in an unsigned commit
        self.accept_hazard_0001(gpg_key=self.key_a)
        result = self.check()
        self.assertPasses(result)
        self.assertEqual((result.counts["signoff_records"], result.counts["allowed_signers"]), (1, 1))
        self.assertTrue(any("is a trust anchor" in w and self.key_a in w for w in result.warnings), result.warnings)

    def test_a_signature_by_a_subkey_matches_the_listed_primary_key(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.subkey_a)
        self.assertPasses(self.check())

    def test_a_key_the_agent_generated_is_not_enough(self) -> None:
        # The review's R-01 plant: the record in a commit with a good signature (G) by a key that is not listed.
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_b)
        self.assertFailsWith(
            self.check(),
            f"is signed by key {self.key_b}, which {SIGNERS_REL} does not list",
            "HAZ-0001 residual_risk.accepted_by is filled",
        )

    def test_the_shipped_empty_list_authorises_nothing(self) -> None:
        shutil.copy2(REAL_SAFETY / "signoffs" / so.ALLOWED_SIGNERS_FILE, self.root / SIGNERS_REL)
        self.commit("docs(safety): the allowed-signers list as shipped")
        self.accept_hazard_0001(gpg_key=self.key_b)
        result = self.check()
        self.assertFailsWith(result, "no signer is trusted", "no sign-off record can authorise anything")

    def test_the_shipped_empty_list_says_so_without_records(self) -> None:
        shutil.copy2(REAL_SAFETY / "signoffs" / so.ALLOWED_SIGNERS_FILE, self.root / SIGNERS_REL)
        self.commit("docs(safety): the allowed-signers list as shipped")
        result = self.check()
        self.assertPasses(result)
        self.assertTrue(any("lists no trusted signer" in w for w in result.warnings), result.warnings)

    def test_a_good_signature_of_unknown_validity_fails(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_a)
        os.environ["GNUPGHOME"] = _gnupg_home(self.untrusted_home)
        self.assertFailsWith(self.check(), "no good signature (git %G? = U")

    def test_the_listed_role_must_cover_the_record_role(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a, roles=("nurse-panel",)))
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.assertFailsWith(self.check(), "who is listed for nurse-panel, not for the record's role 'cso'")

    def test_a_listed_signer_cannot_sign_in_another_persons_name(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(name=NAME_B, gpg_key=self.key_a)
        self.assertFailsWith(self.check(), "a person signs only records in their own name")

    def test_an_unsigned_record_commit_fails(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001()
        self.assertFailsWith(self.check(), "no good signature (git %G? = N")

    def test_an_uncommitted_record_fails(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(commit=False)
        self.assertFailsWith(self.check(), "sign-off record is untracked or has uncommitted changes")

    def test_a_record_commit_with_an_ai_trailer_fails(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_a, message="docs(safety): accept HAZ-0001" + AI_TRAILER)
        self.assertFailsWith(self.check(), "carries an AI co-author trailer")

    def test_an_unsigned_change_to_the_list_fails(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.list_signers(self.entry(NAME_A, self.key_a), self.entry(NAME_B, self.key_b))  # the agent adds its own key
        self.accept_hazard_0001(name=NAME_B, gpg_key=self.key_b)
        self.assertFailsWith(self.check(), "changed the list without a good signature (git %G? = N)", "no signer is trusted")

    def test_a_change_signed_by_a_listed_key_is_trusted(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.list_signers(self.entry(NAME_A, self.key_a), self.entry(NAME_B, self.key_b), gpg_key=self.key_a)
        self.accept_hazard_0001(name=NAME_B, gpg_key=self.key_b)
        self.assertPasses(self.check())

    def test_a_key_cannot_add_itself(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.list_signers(self.entry(NAME_A, self.key_a), self.entry(NAME_B, self.key_b), gpg_key=self.key_b)
        self.accept_hazard_0001(name=NAME_B, gpg_key=self.key_b)
        self.assertFailsWith(self.check(), f"in a commit signed by key {self.key_b}, which the version before it does not list")

    def write_record(self, record_id: str, decision: str, gpg_key: str | None = None, **fields: Any) -> None:
        """A further record for HAZ-0001's acceptance field at its current version, committed (signed if a key is given)."""
        with open(self.box.safety / "hazard-log.yaml", encoding="utf-8") as handle:
            version = so.subject_version(hazard(yaml.safe_load(handle), "HAZ-0001"), "accepted")
        record = {
            "id": record_id, "subject": "HAZ-0001", "subject_version": version, "field": "residual_risk.accepted_by",
            "role": "cso", "name": NAME_A, "date": "2099-02-01", "statement": "Synthetic test statement; authorises nothing outside the tests.",
            "decision": decision, **fields, "authentication": {"method": "signed-git-commit"},
        }
        text = "# Synthetic test record (provenance: synthetic).\n" + yaml.safe_dump(record, sort_keys=False)
        (self.box.safety / "signoffs" / f"{record_id}.yaml").write_text(text, encoding="utf-8", newline="\n")
        self.commit(f"docs(safety): {decision} HAZ-0001", gpg_key)

    def test_a_signed_rejection_withdraws_the_acceptance_until_a_record_supersedes_it(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.assertPasses(self.check())
        self.write_record("SO-2099-0002", "rejected", gpg_key=self.key_a, supersedes="SO-2099-0001")
        self.assertFailsWith(self.check(), "SO-2099-0001 (superseded by SO-2099-0002) are withdrawn")
        self.write_record("SO-2099-0003", "accepted", gpg_key=self.key_a, supersedes="SO-2099-0002")
        self.assertPasses(self.check())

    REJECTION_REL = "docs/safety/signoffs/SO-2099-0002.yaml"

    def reject_the_acceptance(self) -> Path:
        """The CSO's signed acceptance of HAZ-0001, then their signed rejection of it; returns the rejection's path."""
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.write_record("SO-2099-0002", "rejected", gpg_key=self.key_a)
        self.assertFailsWith(self.check(), "withdrawn by SO-2099-0002 (rejected)")
        return self.root / self.REJECTION_REL

    def test_a_committed_rejection_missing_from_the_working_tree_fails(self) -> None:
        # Record rules D1, D3: the rejection deleted in the working tree, plainly or behind a flag that hides it from
        # git status, once brought the acceptance it withdrew back.
        rejection = self.reject_the_acceptance()
        text = rejection.read_text(encoding="utf-8")
        for flag in (None, "assume-unchanged", "skip-worktree"):
            with self.subTest(flag=flag):
                if flag:
                    self.git("update-index", f"--{flag}", self.REJECTION_REL)
                rejection.unlink()
                try:
                    if flag:
                        self.assertEqual(self.git("status", "--porcelain"), "")
                    self.assertFailsWith(self.check(), f"{self.REJECTION_REL}: sign-off record is committed at HEAD but is not in the working tree")
                finally:
                    rejection.write_text(text, encoding="utf-8", newline="\n")
                    if flag:
                        self.git("update-index", f"--no-{flag}", self.REJECTION_REL)

    def test_a_rejection_removed_in_a_commit_still_withdraws(self) -> None:
        # Record rules D2, D4: a commit nobody signed removed or renamed the rejection, and the acceptance it withdrew
        # authorised again. A record is never removed: each signed version of it still withdraws.
        rejection = self.reject_the_acceptance()
        rejected, main = self.head(), self.branch()
        acceptance = self.git("rev-parse", "HEAD~1").strip()

        def removed_unsigned() -> None:
            self.git("rm", "-q", self.REJECTION_REL)
            self.commit("chore: tidy the sign-off records")

        def renamed_unsigned() -> None:
            rejection.rename(rejection.with_suffix(".txt"))
            self.commit("chore: rename a sign-off record")

        def edited_then_removed() -> None:  # the unsigned edit does not authenticate; the signed version still counts
            rejection.write_text(rejection.read_text(encoding="utf-8").replace("decision: rejected", "decision: accepted"),
                                 encoding="utf-8", newline="\n")
            self.commit("chore: edit a sign-off record")
            removed_unsigned()

        def dropped_by_a_merge() -> None:  # a line from before the rejection merges it in and drops it
            self.git("checkout", "-q", "-b", "other", acceptance)
            (self.root / "notes.txt").write_text("Synthetic unrelated work.\n", encoding="utf-8", newline="\n")
            self.commit("chore: synthetic unrelated work")
            self.merge_keeping_tree_of(main, "HEAD")

        for remove in (removed_unsigned, renamed_unsigned, edited_then_removed, dropped_by_a_merge):
            with self.subTest(remove.__name__):
                self.git("checkout", "-q", "-f", main)
                self.git("reset", "-q", "--hard", rejected)
                if self.git("branch", "--list", "other").strip():
                    self.git("branch", "-q", "-D", "other")
                remove()
                self.assertFalse(rejection.exists())
                result = self.check()
                self.assertFailsWith(result, "SO-2099-0001 (withdrawn by SO-2099-0002 (rejected) at the same subject version) are withdrawn")
                self.assertTrue(any(f"{self.REJECTION_REL}: a sign-off record that HEAD's history holds is not at HEAD" in w
                                    for w in result.warnings), result.warnings)

    def test_a_removed_acceptance_authorises_nothing(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.git("rm", "-q", "docs/safety/signoffs/SO-2099-0001.yaml")
        self.commit("chore: tidy the sign-off records")
        self.assertFailsWith(self.check(), "HAZ-0001 residual_risk.accepted_by is filled", "no sign-off record")

    def test_a_rejection_the_list_does_not_back_withdraws_nothing_and_fails(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.write_record("SO-2099-0002", "rejected", gpg_key=self.key_b)
        result = self.check()
        self.assertFailsWith(result, f"is signed by key {self.key_b}, which {SIGNERS_REL} does not list")
        self.assertFalse(any("withdrawn" in e for e in result.errors), result.errors)

    def test_a_shallow_clone_cannot_show_the_list_is_trusted(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_a)
        clone = Path(tempfile.mkdtemp(prefix="hms-shallow-"))
        self.addCleanup(shutil.rmtree, clone, True)
        _require(["git", "clone", "-q", "--depth", "1", self.root.resolve().as_uri(), str(clone / "r")])
        self.assertFailsWith(self.check(clone / "r"), "this is a shallow clone")


class HistoryShapeTest(SignedRepoCase):
    """The bypasses found when the R-01 fix was verified, built with real git: forged messages, merges that
    git's default history simplification hides, a record changed behind git status, and a schema change."""

    RECORD_REL = "docs/safety/signoffs/SO-2099-0001.yaml"

    def test_a_commit_message_cannot_pose_as_a_signed_change_of_the_list(self) -> None:
        # inject2.sh: an unsigned change of the list whose message forges a separator-delimited entry: a scratch
        # commit holding the agent's version (its own key under the human's name), "signed" by the anchor's key.
        self.list_signers(self.entry(NAME_A, self.key_a))  # the human's anchor
        anchor, main = self.head(), self.branch()
        self.git("checkout", "-q", "-b", "scratch")
        self.list_signers(self.entry(NAME_A, self.key_b))
        scratch = self.head()
        self.git("checkout", "-q", main)
        self.git("checkout", scratch, "--", SIGNERS_REL)
        self.git("branch", "-q", "-D", "scratch")
        self.commit_verbatim(f"docs: tidy\x1e{scratch}\x1f{anchor}\x1fG\x1f{self.key_a}\x1f\x1fdocs: tidy")
        self.accept_hazard_0001(gpg_key=self.key_b)
        result = self.check()
        self.assertFailsWith(result, "changed the list without a good signature (git %G? = N)", "no signer is trusted")
        self.assertEqual(result.counts["allowed_signers"], 0)

    def test_a_record_commit_message_cannot_pose_as_a_signed_commit(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(commit=False)
        self.commit_verbatim(f"docs(safety): accept HAZ-0001\x1e{'0' * 40}\x1fG\x1f{self.key_a}\x1f\x1fdocs(safety): accept HAZ-0001")
        self.assertFailsWith(self.check(), "no good signature (git %G? = N")

    def test_a_merge_cannot_bring_in_a_key_anchored_on_another_line(self) -> None:
        # merge_attack.sh: the agent anchors its own key on a branch from before the human's anchor and merges
        # it unsigned, keeping its own list; git's default simplification would follow that branch only.
        self.list_signers()  # the empty list, as the agent commits it
        root, main = self.head(), self.branch()
        self.list_signers(self.entry(NAME_A, self.key_a))  # the human's anchor
        self.git("checkout", "-q", "-b", "side", root)
        self.list_signers(self.entry(NAME_B, self.key_b))
        self.git("checkout", "-q", main)
        self.merge_keeping_tree_of("side", "side")
        self.accept_hazard_0001(name=NAME_B, gpg_key=self.key_b)
        result = self.check()
        self.assertFailsWith(result, "merged lines of history that trust different versions of the list without a good signature")
        self.assertEqual(result.counts["allowed_signers"], 0)
        self.assertEqual(sum("is a trust anchor" in w for w in result.warnings), 2, result.warnings)

    def test_a_merge_cannot_restore_a_removed_key(self) -> None:
        # revoke.sh: A withdraws B in a signed commit; an unsigned merge with the tree from before brings B back.
        self.list_signers(self.entry(NAME_A, self.key_a), self.entry(NAME_B, self.key_b))
        both = self.head()
        self.list_signers(self.entry(NAME_A, self.key_a), gpg_key=self.key_a)
        self.merge_keeping_tree_of(both, both)
        self.accept_hazard_0001(name=NAME_B, gpg_key=self.key_b)
        result = self.check()
        self.assertFailsWith(result, "changed the list without a good signature (git %G? = N)")
        self.assertEqual(result.counts["allowed_signers"], 0)

    def test_a_branch_from_before_a_signed_change_merges_without_a_signature(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        anchor, main = self.head(), self.branch()
        self.git("checkout", "-q", "-b", "feature", anchor)
        (self.root / "notes.txt").write_text("Synthetic work on a branch.\n", encoding="utf-8", newline="\n")
        self.commit("chore: synthetic work on a branch")
        self.git("checkout", "-q", main)
        self.list_signers(self.entry(NAME_A, self.key_a), self.entry(NAME_B, self.key_b), gpg_key=self.key_a)
        self.git("checkout", "-q", "feature")
        self.git("merge", "-q", "--no-ff", "--no-edit", main)  # the newer list comes into the branch, unsigned
        self.accept_hazard_0001(name=NAME_B, gpg_key=self.key_b)
        self.assertPasses(self.check())
        self.git("checkout", "-q", main)
        self.git("merge", "-q", "--no-ff", "--no-edit", "feature")  # and the branch comes back, unsigned
        self.assertPasses(self.check())

    def test_a_merge_of_diverging_signed_versions_needs_a_key_both_sides_list(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        anchor, main = self.head(), self.branch()
        self.list_signers(self.entry(NAME_A, self.key_a), self.entry(NAME_B, self.key_b), gpg_key=self.key_a)
        left = self.head()
        self.git("checkout", "-q", "-b", "side", anchor)
        self.list_signers(self.entry(NAME_A, self.key_a, roles=("cso", "nurse-panel")), gpg_key=self.key_a)
        self.git("checkout", "-q", main)
        self.merge_keeping_tree_of("side", left)
        self.accept_hazard_0001(name=NAME_B, gpg_key=self.key_b)
        self.assertFailsWith(self.check(), "merged lines of history that trust different versions of the list without a good signature")
        settled = {**self.entry(NAME_B, self.key_b), "notes": "Synthetic: listed again after the merge."}
        self.list_signers(self.entry(NAME_A, self.key_a), settled, gpg_key=self.key_a)  # A is listed on both sides
        self.assertPasses(self.check())

    def test_a_record_changed_behind_git_status_fails(self) -> None:
        # assume.sh: the signed record is retargeted in the working tree and hidden from git status.
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.assertPasses(self.check())
        record = self.root / self.RECORD_REL
        signed = record.read_text(encoding="utf-8")
        for flag in ("assume-unchanged", "skip-worktree"):
            with self.subTest(flag=flag):
                record.write_text(signed.replace("HAZ-0001", "HAZ-0002"), encoding="utf-8", newline="\n")
                self.git("update-index", f"--{flag}", self.RECORD_REL)
                self.assertEqual(self.git("status", "--porcelain"), "")
                self.assertFailsWith(self.check(), "differs from the committed one although git status shows no change")
                self.git("update-index", f"--no-{flag}", self.RECORD_REL)
                record.write_text(signed, encoding="utf-8", newline="\n")

    def test_a_schema_change_cannot_untrust_a_committed_anchor(self) -> None:
        # A schema that rejects the human's anchor once made it read as an empty list, so that the agent's next
        # unsigned version counted as a new anchor. Each version is now read with the schema committed with it.
        self.list_signers(self.entry(NAME_A, self.key_a))  # the human's anchor
        schema_path = self.box.safety / "signoffs" / so.ALLOWED_SIGNERS_SCHEMA_FILE
        strict = json.loads(schema_path.read_text(encoding="utf-8"))
        strict["$defs"]["signer"]["properties"]["name"]["const"] = NAME_B
        schema_path.write_text(json.dumps(strict, indent=2) + "\n", encoding="utf-8", newline="\n")
        (self.root / SIGNERS_REL).write_text(self.signers_text(self.entry(NAME_B, self.key_b)), encoding="utf-8", newline="\n")
        self.commit_verbatim("docs(safety): list a signer", SIGNERS_REL)  # the stricter schema stays uncommitted
        self.accept_hazard_0001(name=NAME_B, commit=False)
        self.commit_verbatim("docs(safety): accept HAZ-0001", "docs/safety/hazard-log.yaml", self.RECORD_REL, gpg_key=self.key_b)
        self.assertFailsWith(self.check(), "changed the list without a good signature (git %G? = N)")
        self.commit("chore: the stricter schema, committed later")
        self.assertFailsWith(self.check(), "changed the list without a good signature (git %G? = N)")

    def test_a_record_brought_in_by_an_unsigned_merge_counts(self) -> None:
        self.list_signers(self.entry(NAME_A, self.key_a))
        main = self.branch()
        self.git("checkout", "-q", "-b", "acceptance")
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.git("checkout", "-q", main)
        (self.root / "notes.txt").write_text("Synthetic unrelated work.\n", encoding="utf-8", newline="\n")
        self.commit("chore: synthetic unrelated work")
        self.git("merge", "-q", "--no-ff", "--no-edit", "acceptance")
        self.assertPasses(self.check())

    def test_grafts_do_not_hide_an_unsigned_commit_of_a_record(self) -> None:
        # Record rules G1: a graft re-parented a signed edit past the unsigned commit that added the record.
        self.list_signers(self.entry(NAME_A, self.key_a))
        base = self.head()
        self.accept_hazard_0001()  # unsigned
        record = self.root / self.RECORD_REL
        record.write_text(record.read_text(encoding="utf-8") + "notes: Synthetic edit.\n", encoding="utf-8", newline="\n")
        self.commit("docs(safety): edit the record", gpg_key=self.key_a)
        self.assertFailsWith(self.check(), "no good signature (git %G? = N")
        self.graft(self.head(), base)
        self.assertFailsWith(self.check(), "no good signature (git %G? = N")

    def test_a_verifier_program_set_in_the_repository_trusts_no_one(self) -> None:
        # A gpg.program in .git/config is in no commit and could report a good signature by any key it names (the
        # real gpg here, so the test needs no stand-in verifier); only the host's global or system setting counts.
        self.list_signers(self.entry(NAME_A, self.key_a))
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.assertPasses(self.check())
        self.git("config", "--local", "gpg.program", "gpg")
        result = self.check()
        self.assertFailsWith(result, "gpg.program is set in the local git configuration, not the host's", "no signer is trusted")
        self.assertEqual(result.counts["allowed_signers"], 0)

    def link_or_skip(self, link: Path, target: str, directory: bool = False) -> None:
        try:
            link.symlink_to(target, target_is_directory=directory)
        except OSError as exc:
            self.skipTest(f"this host cannot make a symbolic link: {exc}")

    def committed_link_or_skip(self, rel: str) -> None:
        if not self.git("ls-tree", "HEAD", "--", rel).startswith("120000 "):
            self.skipTest("git on this host does not commit symbolic links (core.symlinks)")

    def test_a_symbolic_link_cannot_redirect_the_list(self) -> None:
        # D2 (X13): after the human's anchor, an unsigned commit replaced the list by a link to the agent's own list,
        # and the gate walked the history of the link's target, where that list was a new trust anchor.
        self.list_signers(self.entry(NAME_A, self.key_a))  # the human's anchor
        evil = self.root / "evil"
        evil.mkdir()
        (evil / "allowed-signers.yaml").write_text(self.signers_text(self.entry(NAME_A, self.key_b)), encoding="utf-8", newline="\n")
        path = self.root / SIGNERS_REL
        path.unlink()
        self.link_or_skip(path, "../../../evil/allowed-signers.yaml")
        self.commit("chore: tidy the signers file")  # unsigned, no trailer
        self.committed_link_or_skip(SIGNERS_REL)
        self.accept_hazard_0001(gpg_key=self.key_b)
        result = self.check()
        self.assertFailsWith(result, f"{SIGNERS_REL}: {SIGNERS_REL} is a symbolic link in the working tree")
        self.assertEqual(result.counts["allowed_signers"], 0)
        self.assertFalse(any("evil/" in w for w in result.warnings), result.warnings)
        # A plain file in its place (a host that checks links out as files): the committed link is a change of the
        # list's own path, which no listed key signed.
        path.unlink()
        path.write_text((evil / "allowed-signers.yaml").read_text(encoding="utf-8"), encoding="utf-8", newline="\n")
        self.git("update-index", "--assume-unchanged", SIGNERS_REL)
        self.assertFailsWith(self.check(), "changed the list without a good signature (git %G? = N)")

    def test_a_symbolic_link_cannot_redirect_the_signoffs_directory(self) -> None:
        # D2 (X14): the signoffs directory became a link to a directory holding the agent's own list.
        self.list_signers(self.entry(NAME_A, self.key_a))  # the human's anchor
        self.git("mv", "docs/safety/signoffs", "docs/safety/signoffs-old")
        alternative = self.box.safety / "signoffs-alt"
        alternative.mkdir()
        for name in ("signoff.schema.json", so.ALLOWED_SIGNERS_SCHEMA_FILE):
            shutil.copy2(self.box.safety / "signoffs-old" / name, alternative)
        (alternative / so.ALLOWED_SIGNERS_FILE).write_text(self.signers_text(self.entry(NAME_A, self.key_b)), encoding="utf-8", newline="\n")
        self.link_or_skip(self.box.safety / "signoffs", "signoffs-alt", directory=True)
        self.commit("chore: reorganise the signoffs directory")  # unsigned
        self.committed_link_or_skip("docs/safety/signoffs")
        self.accept_hazard_0001(gpg_key=self.key_b)  # written through the link
        result = self.check()
        self.assertFailsWith(result, "docs/safety/signoffs is a symbolic link in the working tree", "HAZ-0001 residual_risk.accepted_by is filled")
        self.assertEqual(result.counts["allowed_signers"], 0)

    def test_a_merge_that_keeps_an_unsigned_version_of_a_record_fails(self) -> None:
        # The record's history follows the content it has at HEAD, through merges.
        self.list_signers(self.entry(NAME_A, self.key_a))
        base, main = self.head(), self.branch()
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.git("checkout", "-q", "-b", "side", base)
        self.accept_hazard_0001(commit=False)
        record = self.root / self.RECORD_REL
        record.write_text(record.read_text(encoding="utf-8").replace("Synthetic test statement", "Synthetic unsigned statement"),
                          encoding="utf-8", newline="\n")
        self.commit("docs(safety): another version of the record, unsigned")
        self.git("checkout", "-q", main)
        self.merge_keeping_tree_of("side", "side")
        self.assertFailsWith(self.check(), "no good signature (git %G? = N")


class MergeConflictTest(SignedRepoCase):
    """probe-merge.sh with real git and real signatures. The human anchors key A on the main line; the agent
    anchors its own key B, listed under the human's name and without a trailer, on a line that starts before
    the human's anchor; then the lines are merged. Every variant fails closed, and the conflict is settled,
    without rewriting history, once every side has approved the signers of one version."""

    def setUp(self) -> None:
        super().setUp()
        self.list_signers()  # the empty list, as the agent commits it
        root, self.main = self.head(), self.branch()
        self.list_signers(self.entry(NAME_A, self.key_a))  # the human's anchor
        self.human = self.head()
        self.git("checkout", "-q", "-b", "side", root)
        self.list_signers(self.entry(NAME_A, self.key_b))  # the agent's anchor on its own line
        self.agent = self.head()
        self.git("checkout", "-q", self.main)

    def merge(self, *others: str, entries: tuple[dict[str, Any], ...] | None = None, gpg_key: str | None = None,
              message: str = "Merge (synthetic)") -> str:
        """Make HEAD a merge of HEAD and ``others`` (an octopus for two or more) with HEAD's tree and the list
        set to ``entries`` if given, as ``git commit-tree`` lets anyone, signed with ``gpg_key`` if given."""
        if entries is not None:
            (self.root / SIGNERS_REL).write_text(self.signers_text(*entries), encoding="utf-8", newline="\n")
            self.git("add", SIGNERS_REL)
        tree = self.git("write-tree").strip()
        parents = [arg for parent in ("HEAD", *others) for arg in ("-p", parent)]
        sign = ["-c", "gpg.format=openpgp", "commit-tree", f"--gpg-sign={gpg_key}!"] if gpg_key else ["commit-tree"]
        merge = self.git(*sign, *parents, "-m", message, tree).strip()
        self.git("reset", "-q", "--hard", merge)
        return merge

    def approve(self, gpg_key: str, note: str = "approved") -> None:
        """A comment-only edit of the list, signed: the approval of its signers by the key's side."""
        path = self.root / SIGNERS_REL
        path.write_text(f"# {note}\n" + path.read_text(encoding="utf-8"), encoding="utf-8", newline="\n")
        self.commit(f"docs(safety): {note}", gpg_key)

    def both(self) -> tuple[dict[str, Any], ...]:
        return self.entry(NAME_A, self.key_b), self.entry(NAME_A, self.key_a)

    def assertLocked(self, result: CheckResult, missing: str) -> None:
        """No signer is trusted, and the error names ``missing`` among the sides whose approval the committed version lacks."""
        self.assertFailsWith(result, "no signer is trusted, because merge")
        lacking = [e.partition("The committed version still needs the approval of: ")[2] for e in result.errors]
        self.assertTrue(any(missing in item for item in lacking), result.errors)
        self.assertEqual(result.counts["allowed_signers"], 0)

    def test_probe_1_an_unsigned_merge_keeping_both_keys_fails(self) -> None:
        self.merge("side", entries=self.both())
        self.accept_hazard_0001(gpg_key=self.key_b)
        result = self.check()
        self.assertLocked(result, f"the version of commit {self.human[:12]}, which lists {self.key_a}")
        self.assertFailsWith(result, "merged lines of history that trust different versions of the list without a good signature (git %G? = N)")

    def test_probe_2_an_unsigned_merge_keeping_the_side_fails(self) -> None:
        self.merge("side", entries=(self.entry(NAME_A, self.key_b),))
        self.accept_hazard_0001(gpg_key=self.key_b)
        self.assertLocked(self.check(), f"the version of commit {self.human[:12]}, which lists {self.key_a}")

    def test_probe_3_a_merge_keeping_main_signed_by_a_fails_until_the_other_side_approves(self) -> None:
        self.merge("side", gpg_key=self.key_a)
        self.accept_hazard_0001(gpg_key=self.key_b)
        result = self.check()
        self.assertLocked(result, f"the version of commit {self.agent[:12]}, which lists {self.key_b}")
        self.assertFailsWith(result, f"in a commit signed by key {self.key_a}, which not every side lists")
        self.approve(self.key_b, "the other side approves the merged list")  # the recovery, without rewriting history
        result = self.check()
        self.assertFailsWith(result, f"is signed by key {self.key_b}, which {SIGNERS_REL} does not list")  # B is not trusted
        self.assertEqual(result.counts["allowed_signers"], 1)
        self.assertTrue(any("settled the conflict that merge" in w for w in result.warnings), result.warnings)

    def test_probe_4_a_union_merge_signed_by_a_fails_until_the_other_side_approves(self) -> None:
        self.merge("side", entries=self.both(), gpg_key=self.key_a)
        self.accept_hazard_0001(gpg_key=self.key_b)
        self.assertLocked(self.check(), f"the version of commit {self.agent[:12]}, which lists {self.key_b}")
        # A human who signed a list that holds B approved B, as a signed change on one line would; once B's side
        # approves the same signers, B is trusted. The reviewer reads what a merge of the list brings in.
        self.approve(self.key_b)
        self.assertPasses(self.check())

    def test_probe_5_an_agent_anchor_with_no_human_anchor_is_reported(self) -> None:
        self.git("checkout", "-q", "side")  # the agent's line, on which the list held no key before its anchor
        self.accept_hazard_0001(gpg_key=self.key_b)
        result = self.check()
        self.assertPasses(result)  # KA-011: only out-of-band verification of the reported anchor catches this
        self.assertTrue(any(f"commit {self.agent[:12]} is a trust anchor" in w for w in result.warnings), result.warnings)

    def test_a_settled_merge_lets_records_by_the_settled_signers_count(self) -> None:
        self.merge("side", gpg_key=self.key_a)
        self.assertLocked(self.check(), f"the version of commit {self.agent[:12]}")
        self.approve(self.key_b)
        self.accept_hazard_0001(gpg_key=self.key_a)
        self.assertPasses(self.check())

    def test_the_agent_alone_cannot_settle_the_merge(self) -> None:
        self.merge("side", entries=self.both(), gpg_key=self.key_b)
        self.approve(self.key_b, "approved again")
        self.accept_hazard_0001(gpg_key=self.key_b)
        self.assertLocked(self.check(), f"the version of commit {self.human[:12]}, which lists {self.key_a}")

    def test_a_revert_of_the_merge_does_not_settle_it(self) -> None:
        self.merge("side", entries=self.both())
        self.git("-c", "gpg.format=openpgp", "revert", "--no-edit", "-m", "1", f"--gpg-sign={self.key_a}!", "HEAD")
        self.assertEqual(yaml.safe_load((self.root / SIGNERS_REL).read_text(encoding="utf-8"))["signers"], [self.entry(NAME_A, self.key_a)])
        result = self.check()
        self.assertLocked(result, f"the version of commit {self.agent[:12]}, which lists {self.key_b}")
        self.assertFailsWith(result, "a revert of the merge is a change like any other")

    def test_a_criss_cross_merge_combines_the_approvals_of_both_lines(self) -> None:
        one = self.merge("side", entries=self.both(), gpg_key=self.key_a)  # the main line, approved by A
        self.git("checkout", "-q", "side")
        two = self.merge(self.human, entries=self.both(), gpg_key=self.key_b)  # the side, approved by B
        self.git("checkout", "-q", self.main)
        self.assertEqual(self.head(), one)
        self.merge(two)  # unsigned: the approvals of both lines stand
        result = self.check()
        self.assertPasses(result)
        self.assertEqual(result.counts["allowed_signers"], 2)

    def test_a_routine_signed_merge_does_not_approve_the_list(self) -> None:
        # D1 (F01): the agent merges its line keeping its own list; the human then signs a routine merge of other work
        # that leaves the list alone. That merge writes no version of the list, so it approves nothing.
        self.merge("side", entries=(self.entry(NAME_A, self.key_b),))
        self.assertLocked(self.check(), f"the version of commit {self.human[:12]}")
        self.git("checkout", "-q", "-b", "feature")
        (self.root / "notes.txt").write_text("Synthetic unrelated work.\n", encoding="utf-8", newline="\n")
        self.commit("chore: synthetic unrelated work")
        self.git("checkout", "-q", self.main)
        self.git("-c", "gpg.format=openpgp", "merge", "-q", "--no-ff", "--no-edit", f"--gpg-sign={self.key_a}!", "feature")
        self.assertEqual(self.git("log", "-1", "--format=%G?").strip(), "G")
        self.accept_hazard_0001(gpg_key=self.key_b)
        self.assertLocked(self.check(), f"the version of commit {self.human[:12]}, which lists {self.key_a}")

    def test_a_line_that_settled_the_conflict_does_not_discard_a_later_signed_change(self) -> None:
        # D6 (X18): the human signs the merged list; the agent settles it on a line forked there; the human then signs
        # a change back to their own key. Merging the agent's line back, unsigned, keeping its list, does not bring the
        # agent's key back without the human's signature.
        self.merge("side", entries=self.both(), gpg_key=self.key_a)
        self.git("checkout", "-q", "-b", "y")
        self.approve(self.key_b, "the agent settles the merged list on its own line")
        self.git("checkout", "-q", self.main)
        self.list_signers(self.entry(NAME_A, self.key_a), gpg_key=self.key_a)  # the human changes their mind, signed
        self.git("checkout", "y", "--", SIGNERS_REL)
        self.merge("y")  # unsigned, keeping y's list
        self.accept_hazard_0001(gpg_key=self.key_b)
        self.assertLocked(self.check(), f"the version of commit {self.human[:12]}, which lists {self.key_a}")

    def test_a_criss_cross_merge_with_an_ai_trailer_settles_on_the_approvals_given(self) -> None:
        # D4 (X02b): each line approved the merged list with its own key; their merge carries an AI trailer, so it
        # approves nothing, but the approvals already given cover every side.
        self.merge("side", entries=self.both(), gpg_key=self.key_a)
        self.git("checkout", "-q", "side")
        two = self.merge(self.human, entries=self.both(), gpg_key=self.key_b)
        self.git("checkout", "-q", self.main)
        merge = self.merge(two, message="Merge (synthetic)" + AI_TRAILER)
        result = self.check()
        self.assertPasses(result)
        self.assertEqual(result.counts["allowed_signers"], 2)
        self.assertTrue(any(f"merge {merge[:12]} settled the conflict" in w for w in result.warnings), result.warnings)

    def test_grafts_do_not_hide_the_humans_anchor(self) -> None:
        # D3 (F04): a graft gave the agent's merge the agent's line as its only parent, at the same branch tip.
        merge = self.merge("side", entries=(self.entry(NAME_A, self.key_b),))
        self.accept_hazard_0001(gpg_key=self.key_b)
        self.assertLocked(self.check(), f"the version of commit {self.human[:12]}, which lists {self.key_a}")
        self.graft(merge, self.agent)
        self.assertLocked(self.check(), f"the version of commit {self.human[:12]}, which lists {self.key_a}")

    def test_an_octopus_merge_needs_the_approval_of_every_side(self) -> None:
        self.git("checkout", "-q", "-b", "third", f"{self.agent}^")
        self.list_signers(self.entry(NAME_B, self.key_b, roles=("nurse-panel",)))  # a third line, anchored on its own
        third = self.head()
        self.git("checkout", "-q", self.main)
        self.merge("side", "third", gpg_key=self.key_a)
        self.assertLocked(self.check(), f"the version of commit {third[:12]}, which lists {self.key_b}")
        self.approve(self.key_b)  # B is listed on both other sides, so one signature approves for both
        result = self.check()
        self.assertPasses(result)
        self.assertEqual(result.counts["allowed_signers"], 1)


class SshSignedRecordTest(SignedRepoCase):
    ssh_dir: Path
    ssh_s: Path
    ssh_t: Path
    fpr_s: str
    fpr_t: str

    @classmethod
    def setUpClass(cls) -> None:
        if shutil.which("ssh-keygen") is None:
            raise unittest.SkipTest("ssh-keygen is not on PATH on this host")
        super().setUpClass()
        cls.ssh_dir = Path(cls.tmp.name) / "ssh"
        cls.ssh_dir.mkdir()
        cls.ssh_s, cls.ssh_t = cls.ssh_dir / "s", cls.ssh_dir / "t"
        try:
            for key in (cls.ssh_s, cls.ssh_t):
                _require(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", key.name, "-f", str(key)])
            cls.fpr_s, cls.fpr_t = (_require(["ssh-keygen", "-l", "-f", f"{k}.pub"]).split()[1] for k in (cls.ssh_s, cls.ssh_t))
            probe = cls.ssh_dir / "probe"
            probe.write_text("probe\n", encoding="utf-8")
            _require(["ssh-keygen", "-Y", "sign", "-n", "git", "-f", str(cls.ssh_s), str(probe)])
        except AssertionError as exc:
            cls.tearDownClass()
            raise unittest.SkipTest(f"ssh-keygen cannot sign with a temporary key on this host: {exc}") from exc

    def host_trusts(self, *keys: Path) -> None:
        """Write the host's gpg.ssh.allowedSignersFile, the file git verifies SSH signatures with."""
        allowed = self.ssh_dir / f"allowed-{self.box.root.name}"
        allowed.write_text("".join(f"signer@example.invalid {Path(f'{k}.pub').read_text(encoding='utf-8').strip()}\n" for k in keys), encoding="utf-8")
        self.write_git_config(allowed)

    def test_a_listed_ssh_key_signing_a_matching_record_passes(self) -> None:
        self.host_trusts(self.ssh_s)
        self.list_signers(self.entry(NAME_A, self.fpr_s, key_type="ssh"))
        self.accept_hazard_0001(ssh_key=self.ssh_s)
        self.assertPasses(self.check())

    def test_an_ssh_key_this_host_does_not_trust_fails(self) -> None:
        self.host_trusts(self.ssh_t)
        self.list_signers(self.entry(NAME_A, self.fpr_s, key_type="ssh"))
        self.accept_hazard_0001(ssh_key=self.ssh_s)
        self.assertFailsWith(self.check(), "no good signature (git %G? = U")

    def test_an_ssh_key_the_list_does_not_hold_fails(self) -> None:
        self.host_trusts(self.ssh_s, self.ssh_t)
        self.list_signers(self.entry(NAME_A, self.fpr_s, key_type="ssh"))
        self.accept_hazard_0001(ssh_key=self.ssh_t)
        self.assertFailsWith(self.check(), f"is signed by key {self.fpr_t}, which {SIGNERS_REL} does not list")

    def test_an_ssh_signed_change_to_the_list_is_trusted(self) -> None:
        self.host_trusts(self.ssh_s, self.ssh_t)
        self.list_signers(self.entry(NAME_A, self.fpr_s, key_type="ssh"))
        self.list_signers(self.entry(NAME_A, self.fpr_s, key_type="ssh"), self.entry(NAME_B, self.fpr_t, key_type="ssh"), ssh_key=self.ssh_s)
        self.accept_hazard_0001(name=NAME_B, ssh_key=self.ssh_t)
        self.assertPasses(self.check())


if __name__ == "__main__":
    unittest.main()
