"""The git authenticator for sign-off records, with git replaced by a scripted history (no real commits or keys).

Real signatures (GPG and SSH, in temporary repositories), and the same history rules against real git
with real merges, are tested in test_signed_commits.py.
"""

from __future__ import annotations

import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Any

import yaml

from hmstools.safety import signoffs as so
from hmstools.safety.check import SafetyPaths, _signers_reader
from hmstools.safety.tests.harness import REAL_SAFETY, REPO

SIGNERS_REL = "docs/safety/signoffs/allowed-signers.yaml"
SCHEMA_REL = "docs/safety/signoffs/allowed-signers.schema.json"
RECORD_REL = "docs/safety/signoffs/SO-2099-0001.yaml"
RECORD_TEXT = "id: SO-2099-0001\n"
SCHEMA_TEXT = (REAL_SAFETY / "signoffs" / so.ALLOWED_SIGNERS_SCHEMA_FILE).read_text(encoding="utf-8")


def synthetic_fingerprint(label: str) -> str:
    """A GPG v4 fingerprint (40 upper-case hex digits) that no real key has, derived from a label at import
    time, so that no hex literal in this file reads as a secret to the secret scan."""
    return hashlib.sha1(f"hms synthetic test key {label}".encode("utf-8")).hexdigest().upper()


KEY_A = synthetic_fingerprint("A")
SUBKEY_A = synthetic_fingerprint("A, signing subkey")
KEY_B = synthetic_fingerprint("B")
KEY_X = synthetic_fingerprint("X")
KEY_C = synthetic_fingerprint("C")
SSH_A = "SHA256:" + "a" * 43
AI_BODY = "chore: change\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n"


def entry(name: str, fingerprint: str, roles: tuple[str, ...] = ("cso",), key_type: str = "gpg") -> dict[str, Any]:
    return {"name": name, "roles": list(roles), "key_type": key_type, "fingerprint": fingerprint, "added": "2099-01-01"}


A = entry("SYN-TEST-SIGNER-A", KEY_A)
B = entry("SYN-TEST-SIGNER-B", KEY_B)
X = entry("SYN-TEST-SIGNER-X", KEY_X)
C = entry("SYN-TEST-SIGNER-C", KEY_C)
XA = entry("SYN-TEST-SIGNER-A", KEY_X)  # the agent's key listed under the human's name, as probe-merge.sh lists it


def signers_text(*entries: dict[str, Any], comment: str = "synthetic") -> str:
    return f"# {comment}\n" + yaml.safe_dump({"schema_version": 1, "signers": list(entries)}, sort_keys=False)


def signer(item: dict[str, Any]) -> so.AllowedSigner:
    return so.signers_from({"signers": [item]})[0]


class FakeGit:
    """A scripted git: the history of allowed-signers.yaml, the commits of one record, and the working tree.

    It answers the calls GitAuthenticator makes. Its list history plays ``git rev-list --full-history
    --parents --topo-order --reverse``: every commit it holds (oldest first) changes the list or is a
    merge, with its parents as git rewrites them. test_signed_commits.py checks the same rules against
    real git, whose history simplification this fake does not model.
    """

    def __init__(self, worktree: Path) -> None:
        self.worktree = worktree  # the working-tree allowed-signers.yaml
        self.blobs: dict[str, str] = {}
        self.commits: list[dict[str, Any]] = []  # the list's history, oldest first
        self.info: dict[str, tuple[str, str, str, str]] = {}  # every commit: %G?, %GF, %GP, %B
        self.record_commits: list[str] = []  # newest first, as rev-list prints them
        self.record_text = RECORD_TEXT  # the record as committed at HEAD
        self.shallow = False
        self.not_a_repo = False
        self.status: dict[str, str] = {}
        self.listing: str | None = None  # replaces the rev-list output of the list's history

    def _new_id(self) -> str:
        """A commit id whose first 12 digits (as messages print it) differ from every other commit's."""
        return hashlib.sha1(f"synthetic commit {len(self.info) + 1}".encode("utf-8")).hexdigest()

    def _store(self, text: str | None) -> str | None:
        if text is None:
            return None
        blob = hashlib.sha1(text.encode("utf-8")).hexdigest()
        self.blobs[blob] = text
        return blob

    def change(self, text: str | None, sig: str = "N", fpr: str = "", primary: str = "", body: str = "chore: change\n",
               parents: list[str] | None = None, schema: str | None = SCHEMA_TEXT) -> str:
        """Commit a version of the list (None deletes it), with the schema committed beside it; the working tree follows."""
        sha = self._new_id()
        if parents is None:
            parents = [self.commits[-1]["sha"]] if self.commits else []
        self.commits.append({"sha": sha, "parents": parents, "blob": self._store(text), "schema": self._store(schema)})
        self.info[sha] = (sig, fpr, primary, body)
        if text is None:
            self.worktree.unlink(missing_ok=True)
        else:
            self.worktree.write_text(text, encoding="utf-8", newline="\n")
        return sha

    def record_commit(self, sig: str = "G", fpr: str = KEY_A, primary: str = "", body: str = "docs(safety): add sign-off record\n") -> str:
        sha = self._new_id()
        self.record_commits.insert(0, sha)
        self.info[sha] = (sig, fpr, primary, body)
        return sha

    def _at(self, rev: str, rel: str) -> str | None:
        if rel == RECORD_REL:
            return self._store(self.record_text) if rev == "HEAD" and self.record_commits else None
        if rev == "HEAD":
            commit = self.commits[-1] if self.commits else None
        else:
            commit = next((c for c in self.commits if c["sha"] == rev), None)
        if commit is None:
            return None
        return {SIGNERS_REL: commit["blob"], SCHEMA_REL: commit["schema"]}.get(rel)

    def __call__(self, *args: str, input: str | None = None) -> subprocess.CompletedProcess[str]:  # noqa: A002 - as subprocess
        def done(code: int, out: str = "", err: str = "") -> subprocess.CompletedProcess[str]:
            return subprocess.CompletedProcess(args, code, out, err)

        if self.not_a_repo:
            return done(128, err="fatal: not a git repository")
        if args[:2] == ("rev-parse", "--is-shallow-repository"):
            return done(0, "true\n" if self.shallow else "false\n")
        if args[0] == "rev-parse":
            rev, _, rel = args[-1].partition(":")
            blob = self._at(rev, rel)
            return done(0, blob + "\n") if blob else done(128)
        if args[:2] == ("cat-file", "blob"):
            text = self.blobs.get(args[2])
            return done(0, text) if text is not None else done(128, err="fatal: not a blob")
        if args[0] == "cat-file" and args[1].startswith("--batch-check"):
            lines = []
            for line in (input or "").splitlines():
                rev, _, rel = line.partition(":")
                blob = self._at(rev, rel)
                lines.append(f"{blob} blob" if blob else f"{line} missing")
            return done(0, "".join(f"{line}\n" for line in lines))
        if args[0] == "rev-list" and args[-1] == SIGNERS_REL:
            if self.listing is not None:
                return done(0, self.listing)
            return done(0, "".join(" ".join([c["sha"], *c["parents"]]) + "\n" for c in self.commits))
        if args[0] == "rev-list" and args[-1] == RECORD_REL:
            return done(0, "".join(f"{sha}\n" for sha in self.record_commits))
        if args[:2] == ("log", "-1"):
            sig, fpr, primary, body = self.info[args[-2]]
            return done(0, f"{sig}\x00{fpr}\x00{primary}\x00{body}\n")
        if args[0] == "status":
            return done(0, self.status.get(args[-1], ""))
        raise AssertionError(f"unexpected git call {args}")


class GitCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.signers_path = self.root / SIGNERS_REL
        self.record_path = self.root / RECORD_REL
        self.record_path.parent.mkdir(parents=True)
        self.record_path.write_text(RECORD_TEXT, encoding="utf-8", newline="\n")
        self.git = FakeGit(self.signers_path)
        self.read = _signers_reader(SafetyPaths.for_root(REPO))

    def authenticator(self, trust: so.SignerTrust | None = None) -> so.GitAuthenticator:
        return so.GitAuthenticator(self.root, self.signers_path, self.read, self.git, trust=trust)

    def record(self, **fields: Any) -> so.SignoffRecord:
        data = {"id": "SO-2099-0001", "name": "SYN-TEST-SIGNER-A", "role": "cso", "authentication": {"method": "signed-git-commit"}}
        data.update(fields)
        return so.SignoffRecord(self.record_path, data)


class RecordAuthenticationTest(GitCase):
    """One record against a given trusted list (the list's history is TrustChainTest's)."""

    def check(self, *signers: dict[str, Any], record: so.SignoffRecord | None = None) -> list[str]:
        trust = so.SignerTrust(signers=[signer(s) for s in signers])
        return self.authenticator(trust)(record or self.record())

    def test_good_signature_by_a_listed_key_passes(self) -> None:
        self.git.record_commit("G", KEY_A)
        self.assertEqual(self.check(A), [])

    def test_good_signature_by_a_subkey_of_a_listed_primary_key_passes(self) -> None:
        self.git.record_commit("G", SUBKEY_A, KEY_A)
        self.assertEqual(self.check(A), [])

    def test_ssh_signature_by_a_listed_key_passes(self) -> None:
        self.git.record_commit("G", SSH_A)
        self.assertEqual(self.check(entry("SYN-TEST-SIGNER-A", SSH_A, key_type="ssh")), [])

    def test_good_signature_of_unknown_validity_fails(self) -> None:
        self.git.record_commit("U", KEY_A)
        errors = self.check(A)
        self.assertTrue(errors and "no good signature (git %G? = U" in errors[0], errors)

    def test_unsigned_commit_fails(self) -> None:
        self.git.record_commit("N", "")
        errors = self.check(A)
        self.assertTrue(errors and "no good signature (git %G? = N" in errors[0], errors)

    def test_bad_signature_fails(self) -> None:
        self.git.record_commit("B", KEY_A)
        self.assertTrue(self.check(A))

    def test_key_the_agent_generated_fails(self) -> None:
        # The review's R-01 plant: a good signature by a key that allowed-signers.yaml does not list.
        self.git.record_commit("G", KEY_B)
        errors = self.check(A)
        self.assertTrue(errors and f"is signed by key {KEY_B}, which {SIGNERS_REL} does not list" in errors[0], errors)

    def test_no_listed_signer_means_no_record_counts(self) -> None:
        self.git.record_commit("G", KEY_A)
        errors = self.check()
        self.assertTrue(errors and "no signer is trusted" in errors[0] and "no sign-off record can authorise anything" in errors[0], errors)

    def test_a_gpg_entry_does_not_match_an_ssh_signature_of_the_same_text(self) -> None:
        self.assertFalse(so.AllowedSigner("A", ("cso",), "gpg", SSH_A, "2099-01-01").signed(SSH_A))
        self.assertTrue(signer(entry("A", SSH_A, key_type="ssh")).signed(SSH_A))
        self.assertTrue(signer(A).signed(KEY_A.lower()))

    def test_an_incomplete_entry_is_not_a_signer(self) -> None:
        # A committed version is validated against the schema committed with it, which a commit can loosen.
        for broken in ({**A, "fingerprint": KEY_A[:16]}, {**A, "key_type": "ssh"}, {**A, "roles": []}, {"name": "x"}, "x"):
            with self.subTest(entry=broken), self.assertRaises(ValueError):
                so.signers_from({"signers": [broken]})

    def test_record_name_must_be_the_signers_name(self) -> None:
        self.git.record_commit("G", KEY_A)
        errors = self.check(A, record=self.record(name="SYN-TEST-SIGNER-B"))
        self.assertTrue(errors and "a person signs only records in their own name" in errors[0], errors)

    def test_record_role_must_be_listed_for_the_signer(self) -> None:
        self.git.record_commit("G", KEY_A)
        errors = self.check(entry("SYN-TEST-SIGNER-A", KEY_A, roles=("nurse-panel",)))
        self.assertTrue(errors and "listed for nurse-panel, not for the record's role 'cso'" in errors[0], errors)

    def test_signer_key_must_be_the_signing_key(self) -> None:
        self.git.record_commit("G", KEY_A)
        record = self.record(authentication={"method": "signed-git-commit", "signer_key": KEY_B})
        errors = self.check(A, record=record)
        self.assertTrue(errors and "authentication.signer_key" in errors[0], errors)
        self.assertEqual(self.check(A, record=self.record(authentication={"method": "signed-git-commit", "signer_key": KEY_A})), [])

    def test_every_commit_touching_the_record_must_be_signed(self) -> None:
        self.git.record_commit("G", KEY_A)
        self.git.record_commit("N", "", body="edit\n")
        self.assertEqual(len(self.check(A)), 1)

    def test_every_commit_touching_the_record_must_be_by_a_listed_key(self) -> None:
        self.git.record_commit("G", KEY_A)
        self.git.record_commit("G", KEY_B, body="edit\n")
        errors = self.check(A)
        self.assertEqual(len(errors), 1)
        self.assertIn(KEY_B, errors[0])

    def test_a_message_cannot_pose_as_a_signed_commit(self) -> None:
        # R-01 verification gap 1: separators in the message once let it add a forged "G" entry.
        forged = f"docs: add\x1e{'e' * 40}\x1fG\x1f{KEY_A}\x1f\x1fdocs: add\x1e\n{'e' * 40}\x00G\x00{KEY_A}\x00\x00\n"
        self.git.record_commit("N", "", body=forged)
        errors = self.check(A)
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("no good signature (git %G? = N", errors[0])

    def test_ai_co_author_trailer_fails(self) -> None:
        self.git.record_commit("G", KEY_A, body=AI_BODY)
        errors = self.check(A)
        self.assertTrue(any("AI co-author trailer" in e for e in errors), errors)

    def test_human_co_author_is_fine(self) -> None:
        self.git.record_commit("G", KEY_A, body="docs(safety): add record\n\nCo-Authored-By: Jane Talbot <jane@example.org>\n")
        self.assertEqual(self.check(A), [])

    def test_uncommitted_changes_fail(self) -> None:
        self.git.status[RECORD_REL] = f" M {RECORD_REL}\n"
        self.git.record_commit("G", KEY_A)
        errors = self.check(A)
        self.assertTrue(errors and "uncommitted changes" in errors[0], errors)

    def test_a_change_hidden_from_git_status_fails(self) -> None:
        # R-01 verification gap 3: assume-unchanged or skip-worktree keeps git status clean.
        self.git.record_commit("G", KEY_A)
        self.record_path.write_text("id: SO-2099-0001\nsubject: HAZ-0009\n", encoding="utf-8")
        errors = self.check(A)
        self.assertTrue(errors and "differs from the committed one although git status shows no change" in errors[0], errors)

    def test_line_endings_alone_are_not_a_change(self) -> None:
        self.git.record_commit("G", KEY_A)
        self.record_path.write_bytes(RECORD_TEXT.replace("\n", "\r\n").encode("utf-8"))
        self.assertEqual(self.check(A), [])

    def test_never_committed_fails(self) -> None:
        errors = self.check(A)
        self.assertTrue(errors and "not in any commit" in errors[0], errors)

    def test_not_a_repository_fails(self) -> None:
        self.git.not_a_repo = True
        errors = self.check(A)
        self.assertTrue(errors and "git cannot inspect the record" in errors[0], errors)

    def test_record_outside_the_repository_fails(self) -> None:
        with tempfile.TemporaryDirectory() as other:
            outside = Path(other) / "SO-2099-0001.yaml"
            errors = self.check(A, record=so.SignoffRecord(outside, {"id": "SO-2099-0001"}))
        self.assertTrue(errors and "outside the repository" in errors[0], errors)

    def test_git_missing_fails(self) -> None:
        def missing(*_args: str, **_kwargs: Any) -> subprocess.CompletedProcess[str]:
            raise FileNotFoundError("git")

        auth = so.GitAuthenticator(self.root, self.signers_path, self.read, missing, trust=so.SignerTrust())
        errors = auth(self.record())
        self.assertTrue(errors and "git is not available" in errors[0], errors)


class TrustChainTest(GitCase):
    """What the history of allowed-signers.yaml lets the gate trust."""

    def trust(self) -> so.SignerTrust:
        return self.authenticator().trust()

    def names(self, trust: so.SignerTrust) -> list[str]:
        return [s.name for s in trust.signers]

    def anchor(self) -> str:
        self.git.change(signers_text())  # the file arrives empty, in an agent commit
        return self.git.change(signers_text(A))  # the trust anchor: needs no signature, verified out of band

    def test_no_file_and_no_history(self) -> None:
        trust = self.trust()
        self.assertEqual((trust.signers, trust.errors, trust.warnings), ([], [], []))

    def test_an_empty_list_needs_no_signature(self) -> None:
        self.git.change(signers_text())
        trust = self.trust()
        self.assertEqual((trust.signers, trust.errors, trust.anchors, trust.warnings), ([], [], [], []))

    def test_the_first_key_is_a_trust_anchor_and_is_reported(self) -> None:
        self.anchor()
        trust = self.trust()
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A"])
        self.assertEqual(trust.errors, [])
        self.assertEqual(len(trust.anchors), 1)
        self.assertTrue(any("is a trust anchor" in w and KEY_A in w and "KA-011" in w for w in trust.warnings), trust.warnings)

    def test_an_anchor_with_an_ai_trailer_is_rejected(self) -> None:
        self.git.change(signers_text(), body=AI_BODY)  # the agent may commit the empty list
        self.git.change(signers_text(A), body=AI_BODY)  # but never the first key
        trust = self.trust()
        self.assertEqual((trust.signers, trust.anchors), ([], []))
        self.assertTrue(any("only a human adds a signer" in e for e in trust.errors), trust.errors)

    def test_an_invalid_list_before_the_anchor_can_be_fixed(self) -> None:
        self.git.change("schema_version: 1\nsigners: [{name: x}]\n")
        self.git.change(signers_text())
        self.git.change(signers_text(A))
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A"])

    def test_an_invalid_list_is_not_a_new_anchor(self) -> None:
        self.anchor()
        self.git.change("schema_version: 1\nsigners: [{name: x}]\n", "G", KEY_A)  # a signed typo
        self.git.change(signers_text(X))  # unsigned: the typo keeps A as the only one who may change the list
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("without a good signature" in e for e in trust.errors), trust.errors)

    def test_a_listed_signer_can_fix_an_invalid_list(self) -> None:
        self.anchor()
        self.git.change("schema_version: 1\nsigners: [{name: x}]\n", "G", KEY_A)
        self.git.change(signers_text(A, B), "G", KEY_A)
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(len(trust.signers), 2)

    def test_the_working_tree_schema_does_not_judge_committed_versions(self) -> None:
        # R-01 verification gap 4: an uncommitted schema that rejects the anchor once made it read as empty,
        # so the agent's next unsigned version became a new anchor.
        strict = Path(self._tmp.name, "strict")
        (strict / "docs" / "safety" / "signoffs").mkdir(parents=True)
        (strict / SCHEMA_REL).write_text('{"$schema": "https://json-schema.org/draft/2020-12/schema", "not": {}}', encoding="utf-8")
        self.read = _signers_reader(SafetyPaths.for_root(strict))
        self.anchor()
        self.assertEqual(self.read(signers_text(A), "working tree", None)[0], None)  # the working-tree schema rejects A ...
        self.git.change(signers_text(X))  # ... yet the committed anchor stands, and an unsigned change is not trusted
        trust = self.trust()
        self.assertEqual((trust.signers, trust.anchors[1:]), ([], []))
        self.assertTrue(any("changed the list without a good signature (git %G? = N)" in e for e in trust.errors), trust.errors)

    def test_a_version_without_its_schema_trusts_no_one(self) -> None:
        self.git.change(signers_text(A), schema=None)
        trust = self.trust()
        self.assertEqual((trust.signers, trust.anchors), ([], []))
        self.assertTrue(any("does not validate against the schema committed with it" in e and "no allowed-signers.schema.json is committed" in e
                            for e in trust.errors), trust.errors)

    def test_a_version_under_a_committed_schema_that_is_not_one_trusts_no_one(self) -> None:
        self.git.change(signers_text(A), schema='{"type": 12}')
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("is not a valid JSON Schema" in e for e in trust.errors), trust.errors)

    def test_a_permissive_committed_schema_does_not_let_an_incomplete_entry_through(self) -> None:
        self.git.change(f"schema_version: 1\nsigners: [{{name: x, fingerprint: {KEY_A}}}]\n", schema='{"type": "object"}')
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("is not a complete entry" in e for e in trust.errors), trust.errors)

    def test_an_unsigned_change_after_the_anchor_fails(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, B))
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("without a good signature (git %G? = N)" in e for e in trust.errors), trust.errors)

    def test_a_change_signed_by_a_listed_key_is_trusted(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, B), "G", KEY_A)
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A", "SYN-TEST-SIGNER-B"])

    def test_a_change_signed_by_a_listed_subkey_is_trusted(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, B), "G", SUBKEY_A, KEY_A)
        self.assertEqual(self.trust().errors, [])

    def test_a_key_cannot_add_itself(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, B), "G", KEY_B)
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any(f"signed by key {KEY_B}, which the version before it does not list" in e for e in trust.errors), trust.errors)

    def test_a_change_of_unknown_validity_fails(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, B), "U", KEY_A)
        self.assertTrue(any("git %G? = U" in e for e in self.trust().errors))

    def test_a_change_with_an_ai_trailer_fails(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, B), "G", KEY_A, body=AI_BODY)
        self.assertTrue(any("AI co-author trailer" in e for e in self.trust().errors))

    def test_a_message_cannot_pose_as_another_commit(self) -> None:
        # R-01 verification gap 1: a message that forges the separators of a signed entry by key A.
        anchor = self.anchor()
        forged = f"docs: tidy\x1e{'e' * 40}\x1f{anchor}\x1fG\x1f{KEY_A}\x1f\x1fdocs: tidy\n\x00G\x00{KEY_A}\x00\x00"
        self.git.change(signers_text(entry("SYN-TEST-SIGNER-A", KEY_X)), body=forged)
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("changed the list without a good signature (git %G? = N)" in e for e in trust.errors), trust.errors)

    def test_a_listing_that_is_not_commit_ids_trusts_no_one(self) -> None:
        self.anchor()
        self.git.listing = "docs: tidy\x1e" + "e" * 40 + "\n"
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("did not list the history of the list as expected" in e for e in trust.errors), trust.errors)

    def test_a_reverted_unsigned_change_leaves_the_list_trusted(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, X))
        self.git.change(signers_text(A))  # an unsigned revert to the trusted version: not a change of it
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A"])
        self.assertEqual(sum("that change is not trusted" in w for w in trust.warnings), 1)

    def test_a_listed_signer_can_sign_over_an_unsigned_change(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, X))
        self.git.change(signers_text(A, B), "G", KEY_A)
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A", "SYN-TEST-SIGNER-B"])

    def test_a_removed_key_cannot_be_restored_without_a_signature(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, X), "G", KEY_A)
        self.git.change(signers_text(A), "G", KEY_A)  # X withdrawn
        self.git.change(signers_text(A, X))  # an unsigned restore of a version that was trusted once
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(trust.errors)

    def test_an_unsigned_removal_of_every_key_cannot_start_a_new_anchor(self) -> None:
        self.anchor()
        self.git.change(signers_text())
        self.git.change(signers_text(X))
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertEqual(len(trust.anchors), 1)
        self.assertTrue(trust.errors)

    def test_deleting_the_list_needs_a_signature(self) -> None:
        self.anchor()
        self.git.change(None)
        self.git.change(signers_text(X))
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("without a good signature" in e for e in trust.errors), trust.errors)

    def test_a_signed_removal_of_every_key_allows_a_new_anchor(self) -> None:
        self.anchor()
        self.git.change(signers_text(), "G", KEY_A)
        self.git.change(signers_text(X))
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-X"])
        self.assertEqual(len(trust.anchors), 2)

    # ------------------------------------------------------------------ merges

    def test_a_merge_that_keeps_the_newest_side_needs_no_signature(self) -> None:
        base = self.anchor()
        newer = self.git.change(signers_text(A, B), "G", KEY_A, parents=[base])
        for parents in ([newer, base], [base, newer]):  # a branch from before the signed change, merged either way
            with self.subTest(parents=parents):
                self.git.commits = self.git.commits[:3]
                self.git.change(signers_text(A, B), parents=parents)
                trust = self.trust()
                self.assertEqual(trust.errors, [])
                self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A", "SYN-TEST-SIGNER-B"])

    def test_a_merge_that_keeps_an_older_side_cannot_restore_a_removed_key(self) -> None:
        # R-01 verification gap 2 (revoke.sh): an unsigned merge with the tree of a version from before X was removed.
        self.git.change(signers_text())
        both = self.git.change(signers_text(A, X))
        removed = self.git.change(signers_text(A), "G", KEY_A)
        for parents, sig, fpr in (([removed, both], "N", ""), ([both, removed], "N", ""), ([removed, both], "G", KEY_X)):
            with self.subTest(parents=parents, sig=sig):
                self.git.commits = self.git.commits[:3]
                self.git.change(signers_text(A, X), sig, fpr, parents=parents)
                trust = self.trust()
                self.assertEqual(trust.signers, [])
                self.assertTrue(any(f"commit {self.git.commits[-1]['sha'][:12]} changed the list" in e for e in trust.errors), trust.errors)

    def test_a_merge_cannot_bring_in_a_key_anchored_on_another_line(self) -> None:
        # R-01 verification gap 2 (merge_attack.sh): the agent anchors its key on a branch from before the
        # human's anchor and merges it, unsigned or signed with its own key.
        root = self.git.change(signers_text())
        human = self.git.change(signers_text(A), parents=[root])
        agent = self.git.change(signers_text(X), parents=[root])
        for sig, fpr, fragment in (("N", "", "without a good signature"), ("G", KEY_X, f"signed by key {KEY_X}, which not every side lists")):
            with self.subTest(sig=sig):
                self.git.commits = self.git.commits[:3]
                self.git.change(signers_text(X), sig, fpr, parents=[human, agent])
                trust = self.trust()
                self.assertEqual(trust.signers, [])
                self.assertEqual(len(trust.anchors), 2)  # both anchors are reported
                self.assertTrue(any("merged lines of history that trust different versions of the list" in e and fragment in e
                                    for e in trust.errors), trust.errors)

    def test_a_merge_of_diverging_versions_needs_a_key_listed_on_every_side(self) -> None:
        base = self.anchor()
        left = self.git.change(signers_text(A, B), "G", KEY_A, parents=[base])
        right = self.git.change(signers_text(A, X), "G", KEY_A, parents=[base])
        self.git.change(signers_text(A, B, X), "G", KEY_B, parents=[left, right])
        self.assertTrue(any(f"signed by key {KEY_B}, which not every side lists" in e for e in self.trust().errors))

    def test_a_merge_signed_by_a_key_listed_on_every_side_is_trusted(self) -> None:
        base = self.anchor()
        left = self.git.change(signers_text(A, B), "G", KEY_A, parents=[base])
        right = self.git.change(signers_text(A, X), "G", KEY_A, parents=[base])
        self.git.change(signers_text(A, B, X), "G", KEY_A, parents=[left, right])
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(len(trust.signers), 3)

    def test_a_key_listed_on_every_side_counts_whatever_its_roles(self) -> None:
        base = self.anchor()
        left = self.git.change(signers_text(A, B), "G", KEY_A, parents=[base])
        right = self.git.change(signers_text(entry("SYN-TEST-SIGNER-A", KEY_A, roles=("cso", "nurse-panel"))), "G", KEY_A, parents=[base])
        self.git.change(signers_text(A, B), "G", KEY_A, parents=[left, right])
        self.assertEqual(self.trust().errors, [])

    def test_an_unsigned_merge_of_diverging_versions_fails_until_a_key_on_every_side_signs(self) -> None:
        base = self.anchor()
        left = self.git.change(signers_text(A, B), "G", KEY_A, parents=[base])
        right = self.git.change(signers_text(A, X), "G", KEY_A, parents=[base])
        self.git.change(signers_text(A, B), parents=[left, right])
        self.assertTrue(any("merged lines of history that trust different versions of the list without a good signature" in e
                            for e in self.trust().errors))
        self.git.change(signers_text(A, B, comment="signed after the merge"), "G", KEY_A)
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A", "SYN-TEST-SIGNER-B"])

    def test_the_same_version_on_every_side_needs_no_signature(self) -> None:
        base = self.anchor()
        left = self.git.change(signers_text(A, B), "G", KEY_A, parents=[base])
        right = self.git.change(signers_text(A, B), "G", KEY_A, parents=[base])
        self.git.change(signers_text(A, B), parents=[left, right])
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(len(trust.signers), 2)

    def test_a_line_on_which_the_list_never_held_a_key_does_not_count(self) -> None:
        root = self.git.change(signers_text())
        comment = self.git.change(signers_text(comment="a comment edited on a branch"), parents=[root])
        human = self.git.change(signers_text(A), parents=[root])
        self.git.change(signers_text(A), parents=[human, comment])
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A"])

    def test_a_merge_of_lines_without_keys_needs_no_signature(self) -> None:
        root = self.git.change(signers_text())
        left = self.git.change(signers_text(comment="left"), parents=[root])
        right = self.git.change(signers_text(comment="right"), parents=[root])
        self.git.change(signers_text(comment="both"), parents=[left, right])
        trust = self.trust()
        self.assertEqual((trust.signers, trust.errors), ([], []))

    def test_a_signed_removal_of_every_key_is_not_undone_by_a_merge(self) -> None:
        base = self.anchor()
        emptied = self.git.change(signers_text(), "G", KEY_A, parents=[base])  # every key withdrawn, signed
        kept = self.git.change(signers_text(A, B), "G", KEY_A, parents=[base])  # meanwhile, on another line
        self.git.change(signers_text(A, B), parents=[emptied, kept])
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("merged lines of history that trust different versions of the list" in e for e in trust.errors), trust.errors)

    def test_an_unreadable_history_trusts_no_one(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, B), "G", KEY_A, parents=["f" * 40])  # a parent the walk never saw
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("the history before it cannot be read" in e for e in trust.errors), trust.errors)

    def test_merged_lines_with_the_same_signers_in_different_texts_need_a_listed_signature(self) -> None:
        base = self.anchor()
        left = self.git.change(signers_text(A, B, comment="left"), "G", KEY_A, parents=[base])
        right = self.git.change(signers_text(B, A, comment="right"), "G", KEY_A, parents=[base])
        self.git.change(signers_text(A, B, comment="left"), parents=[left, right])  # unsigned, keeping one side's text
        self.assertTrue(any("changed the list without a good signature" in e for e in self.trust().errors))
        self.git.commits = self.git.commits[:4]
        self.git.change(signers_text(A, B, comment="left"), "G", KEY_B, parents=[left, right])
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(len(trust.signers), 2)

    def test_merged_lines_that_each_withdrew_every_key_allow_a_new_anchor(self) -> None:
        # Before the redesign of conflicts this locked the list for good (no key in common); now both sides hold
        # no key, so the next key is a trust anchor, reported like any other.
        base = self.anchor()
        left = self.git.change(signers_text(comment="left"), "G", KEY_A, parents=[base])
        right = self.git.change(signers_text(comment="right"), "G", KEY_A, parents=[base])
        self.git.change(signers_text(X), parents=[left, right])
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-X"])
        self.assertEqual(len(trust.anchors), 2)

    # ------------------------------------------------------------------ conflicts between merged lines

    def conflict(self) -> tuple[str, str]:
        """The human anchors key A; the agent anchors key X under the human's name, without a trailer, on a
        line from before the human's anchor (probe-merge.sh). Returns both anchors."""
        root = self.git.change(signers_text())
        human = self.git.change(signers_text(A), parents=[root])
        agent = self.git.change(signers_text(XA), parents=[root])
        return human, agent

    def assertLocked(self, trust: so.SignerTrust, *missing: str) -> None:
        """No signer is trusted, and the last error names every side whose approval the committed version lacks."""
        self.assertEqual(trust.signers, [])
        self.assertTrue(trust.errors and "no signer is trusted, because merge" in trust.errors[-1], trust.errors)
        for side in missing:
            self.assertIn(side, trust.errors[-1].partition("The committed version still needs the approval of: ")[2])

    def test_merges_of_a_line_the_agent_anchored_fail_closed(self) -> None:
        # probe-merge.sh variants 1 to 4, and the agent's own signature on its side.
        human, agent = self.conflict()
        variants = {
            "1 unsigned union": (signers_text(XA, A), "N", "", agent),
            "2 unsigned, the side's version": (signers_text(XA), "N", "", human),
            "3 main's version, signed by A": (signers_text(A), "G", KEY_A, agent),
            "4 union, signed by A": (signers_text(XA, A), "G", KEY_A, agent),
            "union, signed by X": (signers_text(XA, A), "G", KEY_X, human),
            "the side's version, signed by X": (signers_text(XA), "G", KEY_X, human),
        }
        for label, (text, sig, fpr, missing) in variants.items():
            with self.subTest(label):
                self.git.commits = self.git.commits[:3]
                self.git.change(text, sig, fpr, parents=[human, agent])
                self.assertLocked(self.trust(), f"the version of commit {missing[:12]}")

    def test_the_agent_alone_cannot_settle_a_conflict(self) -> None:
        human, agent = self.conflict()
        self.git.change(signers_text(XA, A), "G", KEY_X, parents=[human, agent])
        self.git.change(signers_text(XA, A, comment="again"), "G", KEY_X)
        self.git.change(signers_text(XA), "G", KEY_X)
        self.git.change(signers_text(XA, comment="and again"))
        self.assertLocked(self.trust(), f"the version of commit {human[:12]}, which lists {KEY_A}")

    def test_a_merge_signed_by_one_side_is_settled_by_the_other(self) -> None:
        # The lock found when the R-01 fix was tested: the sides list no key in common, so the old rule (a key
        # listed on every side) rejected every later change for good. Now each side approves with its own keys.
        human, agent = self.conflict()
        merge = self.git.change(signers_text(A), "G", KEY_A, parents=[human, agent])
        trust = self.trust()
        self.assertLocked(trust, f"the version of commit {agent[:12]}, which lists {KEY_X}")
        self.assertNotIn(f"commit {human[:12]}", trust.errors[-1].partition("still needs the approval of: ")[2])
        self.assertTrue(any(f"commit {merge[:12]} merged lines of history that trust different versions of the list in a commit signed "
                            f"by key {KEY_A}, which not every side lists" in e for e in trust.errors), trust.errors)
        self.assertIn("a revert of the merge is a change like any other", trust.errors[-1])
        settle = self.git.change(signers_text(A, comment="approved by the other side"), "G", KEY_X)
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual([s.fingerprint for s in trust.signers], [KEY_A])
        self.assertTrue(any(f"commit {settle[:12]} settled the conflict that merge {merge[:12]} opened" in w for w in trust.warnings), trust.warnings)

    def test_a_side_approves_the_signers_it_already_trusts(self) -> None:
        # The merge keeps the agent's version and the human signs it: the human approves those signers, as a
        # signed change on one line would, and the agent's side already trusts them.
        human, agent = self.conflict()
        merge = self.git.change(signers_text(XA, comment="kept"), "G", KEY_A, parents=[human, agent])
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual([s.fingerprint for s in trust.signers], [KEY_X])
        # The merge settled its own conflict, and the warning says so without naming the merge twice.
        self.assertTrue(any(f"merge {merge[:12]} settled the conflict between the lines it merged" in w for w in trust.warnings), trust.warnings)
        self.assertFalse(any("that merge" in w for w in trust.warnings), trust.warnings)

    def test_a_change_of_signers_starts_the_approvals_again(self) -> None:
        human, agent = self.conflict()
        self.git.change(signers_text(A, C), "G", KEY_A, parents=[human, agent])  # the human's side approves [A, C]
        self.git.change(signers_text(A, C, XA), "G", KEY_X)  # other signers: that approval no longer counts
        self.git.change(signers_text(A, C), "G", KEY_X)  # [A, C] again, approved by the agent's side only
        self.assertLocked(self.trust(), f"the version of commit {human[:12]}")

    def test_a_comment_edit_carries_a_further_approval(self) -> None:
        human, agent = self.conflict()
        self.git.change(signers_text(A, C), "G", KEY_A, parents=[human, agent])
        self.git.change(signers_text(C, A, comment="the other side approves"), "G", KEY_X)  # the same signers, reordered
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(len(trust.signers), 2)

    def test_unsigned_unlisted_trailer_and_invalid_changes_approve_nothing_in_a_conflict(self) -> None:
        human, agent = self.conflict()
        self.git.change(signers_text(A), "G", KEY_A, parents=[human, agent])
        for text, sig, fpr, body, fragment in (
            (signers_text(A, comment="x"), "N", "", "chore: change\n", "without a good signature (git %G? = N)"),
            (signers_text(A, comment="x"), "U", KEY_X, "chore: change\n", "without a good signature (git %G? = U)"),
            (signers_text(A, comment="x"), "G", KEY_B, "chore: change\n", f"signed by key {KEY_B}, which no side lists"),
            (signers_text(A, comment="x"), "G", KEY_X, AI_BODY, "in a commit that carries an AI co-author trailer, which approves nothing"),
            ("schema_version: 1\nsigners: [{name: x}]\n", "G", KEY_X, "chore: change\n", "to a version that does not validate, which no side can approve"),
        ):
            with self.subTest(fragment):
                self.git.commits = self.git.commits[:4]
                self.git.change(text, sig, fpr, body=body)
                trust = self.trust()
                self.assertLocked(trust, f"the version of commit {agent[:12]}")
                self.assertTrue(any("changed the list while its history is in conflict" in e and fragment in e for e in trust.errors), trust.errors)

    def test_a_revert_of_the_merge_does_not_settle_it(self) -> None:
        human, agent = self.conflict()
        self.git.change(signers_text(XA, A), parents=[human, agent])  # the agent's unsigned union
        self.git.change(signers_text(A), "G", KEY_A)  # the human reverts the merge, signed
        self.assertLocked(self.trust(), f"the version of commit {agent[:12]}, which lists {KEY_X}")

    def test_an_octopus_merge_needs_the_approval_of_every_side(self) -> None:
        root = self.git.change(signers_text())
        human = self.git.change(signers_text(A), parents=[root])
        agent = self.git.change(signers_text(XA), parents=[root])
        third = self.git.change(signers_text(C), parents=[root])
        self.git.change(signers_text(A), "G", KEY_A, parents=[human, agent, third])
        self.git.change(signers_text(A, comment="x"), "G", KEY_X)
        self.assertLocked(self.trust(), f"the version of commit {third[:12]}, which lists {KEY_C}")
        self.git.change(signers_text(A, comment="c"), "G", KEY_C)
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A"])

    def test_a_criss_cross_merge_combines_the_approvals_of_both_lines(self) -> None:
        human, agent = self.conflict()
        one = self.git.change(signers_text(A, XA), "G", KEY_A, parents=[human, agent])  # approved by the human's side
        two = self.git.change(signers_text(XA, A), "G", KEY_X, parents=[agent, human])  # by the agent's, on the other line
        self.git.change(signers_text(A, XA), parents=[one, two])  # unsigned: both approvals stand
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(len(trust.signers), 2)

    def test_a_criss_cross_merge_without_approvals_stays_in_conflict(self) -> None:
        human, agent = self.conflict()
        one = self.git.change(signers_text(A), parents=[human, agent])
        two = self.git.change(signers_text(XA), parents=[agent, human])
        self.git.change(signers_text(A), parents=[one, two])
        trust = self.trust()
        self.assertLocked(trust, f"the version of commit {agent[:12]}")
        self.assertTrue(any(f"commit {one[:12]} merged lines" in e for e in trust.errors) and any(f"commit {two[:12]} merged lines" in e for e in trust.errors))

    def test_a_criss_cross_merge_with_a_line_that_settled_the_conflict_needs_nothing(self) -> None:
        # The versions the settled line has replaced are no longer sides, so the reverse merge brings no conflict back.
        human, agent = self.conflict()
        self.git.change(signers_text(A), "G", KEY_A, parents=[human, agent])
        settled = self.git.change(signers_text(A, comment="x"), "G", KEY_X)
        two = self.git.change(signers_text(XA), parents=[agent, human])  # the reverse merge, unsettled on that line
        self.git.change(signers_text(A, comment="x"), parents=[settled, two])
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual([s.fingerprint for s in trust.signers], [KEY_A])

    def test_a_later_merge_of_a_third_line_needs_its_approval_too(self) -> None:
        root = self.git.change(signers_text())
        human = self.git.change(signers_text(A), parents=[root])
        agent = self.git.change(signers_text(XA), parents=[root])
        third = self.git.change(signers_text(C), parents=[root])
        for settled_first in (True, False):
            with self.subTest(settled_first=settled_first):
                self.git.commits = self.git.commits[:4]
                merge = self.git.change(signers_text(A), "G", KEY_A, parents=[human, agent])
                if settled_first:
                    merge = self.git.change(signers_text(A, comment="x"), "G", KEY_X)
                    self.assertEqual(self.trust().errors, [])
                self.git.change(signers_text(A, comment="x"), parents=[merge, third])
                self.assertLocked(self.trust(), f"the version of commit {third[:12]}, which lists {KEY_C}")
                self.git.change(signers_text(A, comment="y"), "G", KEY_C)
                trust = self.trust()
                if settled_first:  # the settled version and the third line approved
                    self.assertEqual(trust.errors, [])
                else:  # the approvals carried from the first conflict; the agent's side has not given one yet
                    self.assertLocked(trust, f"the version of commit {agent[:12]}")
                    self.git.change(signers_text(A, comment="z"), "G", KEY_X)
                    self.assertEqual(self.trust().errors, [])

    def test_merging_an_old_side_again_after_the_conflict_is_settled_needs_nothing(self) -> None:
        human, agent = self.conflict()
        self.git.change(signers_text(A), "G", KEY_A, parents=[human, agent])
        settled = self.git.change(signers_text(A, comment="x"), "G", KEY_X)
        self.git.change(signers_text(A, comment="x"), parents=[settled, agent])
        self.assertEqual(self.trust().errors, [])

    def test_a_side_that_lists_no_key_approves_only_a_list_without_keys(self) -> None:
        base = self.anchor()
        emptied = self.git.change(signers_text(), "G", KEY_A, parents=[base])  # every key withdrawn, signed
        kept = self.git.change(signers_text(A, B), "G", KEY_A, parents=[base])  # meanwhile, on another line
        self.git.change(signers_text(A, B), "G", KEY_A, parents=[emptied, kept])
        self.assertLocked(self.trust(), f"the version of commit {emptied[:12]}, which lists no key")
        self.git.change(signers_text(comment="every key withdrawn on both lines"), "G", KEY_B)  # approved by the kept side
        self.assertEqual(self.trust().errors, [])
        self.git.change(signers_text(A))  # a new trust anchor, reported
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A"])
        self.assertEqual(len(trust.anchors), 2)

    # ------------------------------------------------------------------ the committed file and the host

    def test_an_invalid_committed_list_trusts_no_one(self) -> None:
        self.anchor()
        self.git.change("schema_version: 1\nsigners: [{name: x}]\n", "G", KEY_A)
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("does not validate" in e for e in trust.errors), trust.errors)

    def test_uncommitted_changes_are_not_trusted(self) -> None:
        self.anchor()
        self.assertFalse(any("uncommitted" in w for w in self.trust().warnings))
        self.signers_path.write_text(signers_text(A, X), encoding="utf-8")  # git status may hide it: the text is compared
        trust = self.authenticator().trust()
        self.assertEqual(self.names(trust), ["SYN-TEST-SIGNER-A"])
        self.assertTrue(any("the check trusts only the committed version" in w for w in trust.warnings))

    def test_a_shallow_clone_with_listed_keys_fails(self) -> None:
        self.anchor()
        self.git.shallow = True
        trust = self.trust()
        self.assertEqual(trust.signers, [])
        self.assertTrue(any("shallow clone" in e for e in trust.errors), trust.errors)

    def test_a_shallow_clone_without_keys_only_warns(self) -> None:
        self.git.change(signers_text())
        self.git.shallow = True
        trust = self.trust()
        self.assertEqual(trust.errors, [])
        self.assertTrue(any("shallow clone" in w for w in trust.warnings))

    def test_outside_a_repository_no_signer_is_trusted(self) -> None:
        self.git.not_a_repo = True
        trust = self.trust()
        self.assertEqual((trust.signers, trust.errors), ([], []))
        self.assertTrue(any("no signer is trusted" in w for w in trust.warnings))

    def test_records_are_checked_against_the_trusted_list(self) -> None:
        self.anchor()
        self.git.change(signers_text(A, B))  # unsigned: B is not trusted, and neither is the list
        self.git.record_commit("G", KEY_B)
        record = self.record(name="SYN-TEST-SIGNER-B")
        errors = self.authenticator()(record)
        self.assertTrue(errors and "no signer is trusted" in errors[0], errors)


if __name__ == "__main__":
    unittest.main()
