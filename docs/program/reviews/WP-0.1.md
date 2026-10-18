# Review: WP-0.1 Programme bootstrap

| | |
|---|---|
| Work package | WP-0.1 Programme bootstrap (BUILD-PROMPT §21, Phase 0) |
| Branch | `wp/0.1-programme-bootstrap` |
| Commit reviewed | `adb631c96f4c30fdd27cedda3c5d209cc3514fdb` (commits `1b4415e`, `b24f94e`, `d3e14de`, `adb631c` on top of the plan of record `ed023b6`) |
| Date | 2026-10-18 |
| Reviewer | automated review (AI); model Claude Fable 5.1 (`claude-fable-5-1`). This is not a human review (§3.5). |
| Governing text read | BUILD-PROMPT §2, §3, §4.1–§4.3, §6.1, §6.8, §19.1, §21 (Phase 0), §22, §23, Appendix B; `docs/program/STATUS.md`; `docs/program/work-packages/WP-0.1.md` |
| Where | Code read in a detached worktree at `adb631c`; every command run in the Linux build host's clone `~/src/hospitalmanagementsystem` (Ubuntu 24.04.5, WSL2) at `adb631c`, restored afterwards to a detached, clean `adb631c` (verified: `git status --short` empty, no scratch branch or file left) |

Verdict in one line: the exit evidence of §21 is met and the gates bite, but the work package is not done under §22.2 until the four major findings below are resolved (none is critical).

## 1. Exit evidence (§21 WP-0.1) and §22.2

| Exit evidence | Verdict | Evidence |
|---|---|---|
| `tools/ci/run fast` green on an empty skeleton with stored evidence | **met** | Stored: `docs/program/evidence/ci/2026-10-18-fast-d3e14de.json` (WSL build host, clean tree at `d3e14de`, PASS 8/8, 972 tests: 392 Python, 66 backend, 514 frontend, 0 failures, 0 skipped, 69 s, cell `none`). Re-run by this review at the handover commit `adb631c`: PASS 8/8, 972 tests, 60 s (record written in the clone, not committed). The handover commit changed documentation only (`git show --stat adb631c`: 7 files under `docs/program/`) |
| `tools/doctor` output recorded | **met** | `docs/program/evidence/doctor/2026-10-18-d3e14de.txt` and `.json` (18 OK; RAM 9.7 GiB and free disk on C: below the [P] guides, so `FAIL (18 ok, 2 required missing)` and no cell profile). Re-run by this review: the same two items missing (C: now 35.5 GiB) |
| Every ADR file present | **met** | `ADR-001` to `ADR-028` present, named per template B.1, linked from `docs/adr/README.md`; `repo check` reports `adrs_total=28, adrs_valid=28`; ADR-001 and ADR-009 `accepted-provisional`, the rest `accepted`; every §4.2 Decision and Reopen cell reproduced verbatim (sub-review of all 28) |
| Hazard log parses in CI | **met** | `safety-check` PASS in the fast tier: 27 entries (HAZ-0001…0021 one per SI, HAZ-0022…0027 one per SI-21 label), 193 controls all `planned`, 21 invariants quoted verbatim, `approval_fields_filled=0`, `signoff_records=0` |
| The backlog renders all 234 feature IDs | **met** | `backlog-check` PASS: `features=234, rows=236` (two part rows), A.18 counts and engineer-weeks reconciled; `BACKLOG.md` byte-identical to a fresh render; the recorded ten-row spot check (seed 20261018) reproduced, plus fifteen further rows (seed 424242) checked by this review against `BUILD-PROMPT.md` Appendix A and §21: 25 of 25 match |
| Scope column (§21): monorepo layout, control files incl. OPEN-QUESTIONS/ASSUMPTIONS/COMMANDS, generated backlog with spot check, baseline ADRs, seeded hazard log, `tools/doctor`, `.gitattributes`, Gradle and pnpm workspaces, `tools/ci/run` with fast tier and evidence, licence policy and ORT configuration, secret scanning, PR template, CODEOWNERS | **met** | Every item exists and was exercised (section 2). `.gitattributes` carries `* text=auto eol=lf` with images, fonts and archives binary; the PR template carries every §3.6 field; CODEOWNERS is by §5.2 module with placeholder handles (KA-004) |
| §22.2: `STATUS.md`, `BACKLOG.md`, `KNOWN-ANOMALIES.md` and the hazard log current; a reviewer report with no unresolved critical or major findings | **partly** | Control files are current in substance; `KNOWN-ANOMALIES.md` omits known limitations (R-05). This report exists and carries four major findings (R-01 to R-04), so the work package is not yet done |

The Definition of Done for features (§22.1) does not apply: no feature ID is built, and `backlog.yaml` says so (`status: todo` for all 234).

## 2. Commands run and results

All runs in the WSL clone at `adb631c` unless marked. Planted violations were applied one at a time and the clone reset to `adb631c` after each (`git reset --hard`, `git clean -fd`).

| Command (COMMANDS.md) | Result |
|---|---|
| `sh tools/bootstrap` | exit 0 in 1.7 s: JDK 25.0.4.1, Gradle 9.8.1 (verified zip), gitleaks 8.30.1, venv (7 pins) and `frontend/node_modules` all reused; nothing fetched (idempotent) |
| `sh tools/doctor` / `--tier fast` | exit 1, `FAIL (18 ok, 2 required missing)`: RAM 9.7 GiB, free disk 35.5 GiB on C: / exit 0, `PASS (5 ok)` |
| `sh tools/ci/run fast` (with evidence) | exit 0, **PASS** 8 of 8 steps; tests 972 (392/66/514), 0 failures, 0 skipped; secret scan 0 findings over history and 344 working-tree files; 60 s; record `evidence/ci/2026-10-18-fast-adb631c.json` with commands, counts, durations, host (Ubuntu 24.04.5 WSL2, 8 CPUs, 9.7 GB, Java 25.0.4.1, Node v24.22.0), cell `none`, result |
| `sh tools/ci/run merge` | exit 1, **FAIL (8 passed, 0 failed, 15 not built)**: every merge-only step is `NOT-BUILT` and names its work package (WP-0.3, 0.4, 0.7, 0.9, 1.1b, 1.5, 1.12). Fails closed as KA-003 says. The record was named `-dirty` only because the untracked evidence file of the previous fast run was in the tree (observation O-5) |
| `sh tools/ci/run <tier> --list` for all four tiers | exit 0; step lists match §19.1 (fast, merge, nightly, release); nightly 12 and release 12 further NOT-BUILT steps, each with a work package |
| `sh tools/ci/run fast --only backlog-check --no-evidence` | exit 3, `PARTIAL`, never PASS |
| `backend/gradlew -p backend --version` as written in COMMANDS.md §4 | **`Permission denied`, exit 126** (R-02). `sh backend/gradlew …` works, which is what `tools/ci/run` uses |
| `sh backend/gradlew -p backend fastTier -Phms.pbt.sequences=1000000 --no-build-cache` | BUILD SUCCESSFUL in 22 s; JUnit XML of `propertyTest` holds `a trivial property runs exactly the configured 1000000 iterations` (2.06 s). The 10⁶ claim of COMMANDS.md §4 is confirmed |
| `sh tools/hms backlog spot-check --seed 20261018 --count 10` | exit 0; the same ten rows as `evidence/backlog/2026-10-18-spot-check.md` |
| `sh tools/hms backlog spot-check --seed 424242 --count 15` | exit 0; DEV-VAL-01, CLN-ORD-01, CLN-AMS-01, OPS-CMD-01, SPC-OT-03, CLN-DOC-02, PLT-UX-01, NUR-FLW-02, ACC-OPD-01, IMP-FND-01, TRU-SEC-03, IMP-GOV-01, SPC-MAT-01, MED-INF-01, NUR-CP-01 compared by this review, independently of the tool, with the Appendix A rows (`BUILD-PROMPT.md` lines 2453–2742) and the §21 mentions: 15 of 15 match in every field |
| `sh tools/hms backlog generate` then `render` | exit 0, exit 0; `git status` unchanged: byte-identical |
| `sh tools/bootstrap requirements-lock` | exit 0; `tools/requirements.txt` unchanged: byte-identical, as COMMANDS.md §1 claims |
| `sh tools/hms repo check` / `safety check` / `backlog check` | PASS / PASS / PASS with the recorded warnings (4 plan-of-record files with CRLF; H7, H9, H11, H15 and 22 SACs without a hazard entry; the `RCM-*` wildcard of WP-2.2) |
| Frontend licence checks (COMMANDS.md §3) | shipped list: `PASS (components=2, allowed=2)`; build-only list: `PASS (components=124, allowed=124)`; the same 124 judged as shipped: `FAIL` on `minimatch@10.2.6` (BlueOak-1.0.0 unmapped), so the scope rule is what makes the build-only list pass, as designed |

Planted violations, each removed and the clone reset afterwards:

| Gate | Plant | Result |
|---|---|---|
| secret-scan | GitHub PAT (`ghp_` + 36 alphanumerics) in an untracked file; the same token only in the history of a scratch branch; an AWS access key id; a PEM private-key block | all four **FAIL** (`github-pat`, `aws-access-token`, `private-key`), secrets redacted. A plain `password = "…"` assignment is not a finding under gitleaks' default rules (expected) |
| safety-check (sign-off gate) | `accepted_by` filled with no record; a matching record untracked; the record in an unsigned commit; the record in a commit signed by a throwaway key **with** an AI co-author trailer; `status: accepted`; a control `verified` with empty `verified_by`; one word of SI-01's `invariant_text` changed; a `covers` list emptied; `cso_triage` filled; a state-machine spec with `approval.approved_by` filled; an unparsable hazard log | all eleven **FAIL** with the right message |
| safety-check (sign-off gate) | the record committed in a commit signed by a GPG key the review generated itself (temporary keyring), no trailer | **PASS** (R-01) |
| repo-check | a CRLF file outside the plan of record; `SYN-TENANT-0001` and its hostname in backend configuration; branches `wp/9.9-syn-tenant-0001`, `customer-acme`, `feature/scratch`; STATUS.md at 159 lines; ADR-010 deleted; ADR-001 set to `accepted`; ADR-002's `## Reopen if` renamed; the index link to ADR-002 broken; 13 "Blocking now" items | all nine **FAIL** |
| backlog-check | `status: built` and `status: verified` with no tests; a hand-edited title; the KRI-ID-01 record deleted; `BACKLOG.md` hand-edited | all **FAIL** (the deletion also trips the 234 tripwire and the A.18 totals) |
| backend `fastTier` | a class in `hms.scratchbeta.application` using `hms.scratchalpha.domain` | `:platform:testing:test` **FAIL**: the module-boundary rule names both methods. (ktlint, detekt, a false property and a domain clock read are covered by `evidence/ci/2026-10-18-gates-bite.md`) |
| frontend `fast` | a JSX literal and a `title` attribute; `margin-left` and `float: right` in a stylesheet; a key missing from `ckb.json`; an ICU syntax error in `ar.json` | `lint:es`, `lint:css`, `i18n:lint` **FAIL** each time |
| CI runner | a check that exits 0 but prints `ok: false` | the step **FAIL**s: "exit code 0 but the JSON says ok=false" |

Method note. All gate runs and plants were script files executed inside WSL (`wsl.exe --exec bash -l <script>`), so their paths, evidence records and reflog entries are those of the Linux clone. In the reviewer's Git Bash one-liners, `$(…)` substitutions were expanded on the Windows side by the tool harness; such substitutions were read-only and none of their readings is used as evidence here. A separate session (the WP-0.2 build) worked in its own clone `~/src/hms-wp02` during this review; the two did not interfere.

## 3. Findings

Severity: critical = could let unsafe behaviour or a false claim of safety through a gate, or breaks a §2 non-negotiable; major = an exit criterion or DoD item not met, a gate that does not bite, a material misstatement in a control file, or a defect that will mislead later work packages; minor = everything else worth fixing. Each finding has an empty Resolution field for the next build session.

| ID | Severity | Title | Where |
|---|---|---|---|
| R-01 | major | The sign-off gate accepts a record signed with a key the agent generated itself; the limitation is not recorded | `tools/hmstools/safety/signoffs.py:20,222-226`; `docs/safety/signoffs/README.md:52-56`; `docs/program/KNOWN-ANOMALIES.md` |
| R-02 | major | The documented commands do not run on the build host of record: the wrapper and the entry scripts are not executable | `backend/gradlew`, `tools/ci/run`, `tools/hms`, `tools/doctor`, `tools/bootstrap`, `tools/host/provision-ubuntu.sh` (mode 100644); `docs/program/COMMANDS.md:83-87`; `backend/README.md:27-28`; `docs/program/work-packages/WP-0.1.md:18-19` |
| R-03 | major | A README attributes the host provisioning to the human; every other record says the agent ran it | `tools/host/README.md:9-10` vs `docs/program/DECISIONS-NEEDED.md:40`, `docs/program/STATUS.md:11` |
| R-04 | major | A planned SI-14 control narrows the invariant: the registry gate omits "a measured PPV" | `docs/safety/hazard-log.yaml:2357-2362` (CTRL-0014-4); `docs/safety/README.md:124` |
| R-05 | minor | KNOWN-ANOMALIES omits known limitations | `docs/program/KNOWN-ANOMALIES.md`; `docs/safety/README.md:19,72,127-128` |
| R-06 | minor | Evidence claims without a record of record, and evidence files outside the naming rule | `docs/program/STATUS.md:16`; `docs/program/COMMANDS.md:3,84,87`; `docs/program/evidence/ci/2026-10-18-gates-bite.md`; `docs/program/evidence/backlog/2026-10-18-spot-check.md:5` |
| R-07 | minor | No nightly run of record at the end of the session, and the deviation is not reported | `docs/program/STATUS.md`; `docs/program/evidence/ci/` |
| R-08 | minor | Appendix A rows whose note records a difference from K are not kept open in OPEN-QUESTIONS | `docs/program/OPEN-QUESTIONS.md` §(c); `BUILD-PROMPT.md:2592,2608,2663,2689,2694,2708,2710,2712,2729` |
| R-09 | minor | One sentence reads as a weakening of the Phase 0 exit criterion | `docs/program/WORK-PACKAGES.md:32` |
| R-10 | minor | STATUS.md calls the slice "verified" before review and names a report that did not exist | `docs/program/STATUS.md:5-6` |
| R-11 | minor | The host-provisioning record overstates its verification and omits system-wide changes | `tools/host/provision-ubuntu.sh:4,17,24,31,47,82,89,93`; `tools/host/README.md:6`; `docs/program/COMMANDS.md:18`; `docs/program/DECISIONS-NEEDED.md:41-44,197` |
| R-12 | minor | Stale or self-contradicting documentation | `tools/README.md:11`; `tools/bootstrap:3`; `frontend/README.md:71`; `README.md:9`; `docs/adr/ADR-010-workflow-temporal.md:42`; `docs/adr/ADR-020-configuration-content-as-code.md:60`; `docs/adr/README.md:83` |
| R-13 | minor | The first build commit does not pass the fast tier on a fresh clone, and this is not reported as a §3.6 deviation | commit `1b4415e` body; commit `b24f94e` body |
| R-14 | minor | ADR-002 records a JDK pin that nothing pins | `docs/adr/ADR-002-runtime-kotlin-jvm-spring.md:35`; `tools/hmstools/bootstrap/steps.py:37,125-149`; `backend/gradle/libs.versions.toml:17` |
| R-15 | minor | "Recorded in the licence register" is claimed while the register is empty | `docs/adr/ADR-014-integration-hub.md:35`; `backend/gradle/libs.versions.toml:59-60`; `tools/licence/register.yaml:17` |
| R-16 | minor | ADRs promise OPEN-QUESTIONS or DECISIONS-NEEDED records that do not exist | `docs/adr/ADR-016-regulated-module-segregation.md:13`; `docs/adr/ADR-017-cds.md:15`; `docs/adr/ADR-001-core-data-option-a.md:72` |
| R-17 | minor | The repo check's ADR rule is weaker than described | `tools/hmstools/repo/rules.py:40,151-170`; `docs/adr/README.md:83` |
| R-18 | minor | Conditional licences only warn, although §4.3 allows them only when recorded in the register | `tools/hmstools/licence/__main__.py:70-77`; `tools/hmstools/licence/policy.py:154-157`; `tools/licence/ort/evaluator.rules.kts:138-161` |
| R-19 | minor | Hazard-log control wording: an overclaim, an automated check in a manual fallback, a missing §18.3 count, unrecorded tightenings, and a README contradiction | `docs/safety/hazard-log.yaml:234-235,252,903-907,1937-1940,2771-2772,2984-2988,3143-3146,3269-3272,3607-3609,3687-3689,3767-3769,3850-3852,3931-3933,4013-4015`; `docs/safety/README.md:125` |
| R-20 | minor | Sign-off record semantics: no decision or a `triaged` decision authorises an acceptance; version and role are not matched | `tools/hmstools/safety/signoffs.py:20,152-176`; `docs/safety/signoffs/README.md:21`; `docs/safety/signoffs/signoff.schema.json:20-23,50-53` |
| R-21 | minor | The hazard-log schema is stricter than template B.2 without saying so | `docs/safety/hazard-log.schema.json:116,127,130,147,155`; `docs/safety/README.md:28` |

### R-01 (major) The sign-off gate accepts a record signed with a key the agent generated itself; the limitation is not recorded

- Where: `tools/hmstools/safety/signoffs.py:222-226` accepts `git %G?` of `G` or `U` (any key the local keyring can verify, including one of unknown validity); the only "not the agent" test is the co-author trailer regex at `:23-25`; `signoff.schema.json:34-38` lets `name` be any string and never reads `signer_key`. `docs/safety/signoffs/README.md:56` says the tool checks "that a record exists, matches and is authenticated" and leaves who may sign to the reviewer and the CSO. `KNOWN-ANOMALIES.md` does not list the limitation.
- Rule: §3.5 line 350 ("CI fails if such a field is filled without a matching sign-off record that a human has added"); §3.1 (KNOWN-ANOMALIES: "every known defect, stub, limitation or fallback").
- What happened: with `HAZ-0001 residual_risk.accepted_by: Dr Scratch Reviewer` filled and `SO-2026-0001.yaml` committed in a commit signed by a GPG key generated for the test in a temporary keyring (no trailer), `sh tools/hms safety check` returned **PASS**. Every other bypass tried (no record, untracked record, unsigned commit, signed commit with an AI trailer, status `accepted`, triage filled, state-machine approval filled) failed as required.
- Failure scenario: a session fills a CSO acceptance, writes the record under the CSO's name and signs the commit with a key it generated; the fast tier stays green and the hazard reads as accepted. The same holds on a host where the human's own signing key is unlocked for an agent-made commit.
- Direction (not a patch): record the limitation in KNOWN-ANOMALIES and the safety README; keep a human-maintained allowed-signers list (fingerprints, `gpg.ssh.allowedSignersFile` or an equivalent file under `docs/safety/signoffs/`) and have the check match `%GF`/`%GK` against it and reject `U`; have the reviewer verify fingerprints until an external CI exists; fold in R-20.

Resolution:

### R-02 (major) The documented commands do not run on the build host of record

- Where: git stores `backend/gradlew`, `tools/ci/run`, `tools/hms`, `tools/doctor`, `tools/bootstrap` and `tools/host/provision-ubuntu.sh` as mode 100644 (`git ls-files -s`). `docs/program/COMMANDS.md:83-87` and `backend/README.md:27-28` give `backend/gradlew -p backend fastTier` as the command; `docs/program/work-packages/WP-0.1.md:18` states the deliverable as "`backend/gradlew -p backend fastTier` runs …". `WP-0.1.md:19` states the frontend deliverable as `corepack pnpm --dir frontend run fast`, which `COMMANDS.md:91`, `frontend/README.md:26-28` and `evidence/ci/2026-10-18-gates-bite.md:45` say stops with `ERR_PNPM_BAD_PM_VERSION`.
- Rule: §3.1 (COMMANDS.md holds "the exact commands … Reviewers run these"); §21 WP-0.1 scope ("Gradle workspace … with the wrapper `backend/gradlew`"); §3.5 (claims match artefacts).
- What happened: in the WSL clone `backend/gradlew -p backend --version`, `tools/ci/run fast --list` and `tools/doctor --tier fast` each returned `Permission denied` (exit 126). `tools/ci/run` itself invokes `sh backend/gradlew`, so the gate of record is unaffected; the COMMANDS.md "Checked" column honestly says these rows were checked on Windows only, where Git Bash ignores the mode bit.
- Failure scenario: a reviewer or the next session follows COMMANDS.md §4 on the Linux host and gets no build; a later WP that scripts `backend/gradlew` directly (a hosted CI job, DN-010) fails for a reason unrelated to the code.
- Direction: set the executable bit in the index (`git update-index --chmod=+x`) for the wrapper and the entry scripts, or write every command as `sh …` and say why; correct WP-0.1.md:19.

Resolution:

### R-03 (major) A README attributes the host provisioning to the human

- Where: `tools/host/README.md:9-10`: "The human who owns the host ran it on 2026-10-18 with explicit approval; see `docs/program/DECISIONS-NEEDED.md` (DN-001 to DN-004) for the record." The record says the opposite: `DECISIONS-NEEDED.md:40` "On that instruction the build agent carried out the host steps itself. This deviates from §3.4 item 9"; `STATUS.md:11`; commit `1b4415e` body ("the build agent provisioned the Linux build host … a recorded deviation from §3.4 item 9").
- Rule: §3.5 ("Never record an approval you did not witness"; "Report every deviation from this prompt, with the reason"); §3.4 item 9.
- Failure scenario: a reader of `tools/host/` concludes the administrator-level host changes were made by the host owner and that no §3.4 deviation occurred; the deviation disappears from the audit trail that DN-001 built.
- Direction: make the README say what DN-001 says (the agent ran it on the human's instruction, a recorded deviation).

Resolution:

### R-04 (major) A planned SI-14 control narrows the invariant

- Where: `docs/safety/hazard-log.yaml:2357-2362`, CTRL-0014-4 (the only control covering clause b): "a rule without owner, evidence or review-by date cannot be interruptive … How the day-0 baseline meets "a measured PPV" before local telemetry exists is open for the CSO". `docs/safety/README.md:124` records the open question.
- Rule: §2.1 SI-14 (line 207): "Every interruptive rule has an owner, evidence, a measured PPV and a review-by date"; §3.4 item 1 (weakening or reinterpreting an invariant is never the agent's decision); `docs/safety/README.md:47` ("An invariant is never weakened, narrowed or reinterpreted").
- Failure scenario: WP-1.5 builds the registry gate as planned; a locally modified rule with an owner, evidence and a review date but no PPV passes the gate and becomes interruptive, and the fourth requirement of SI-14 is never enforced. The tension with the day-0 baseline is real, but the invariant text stays in force until a human rules.
- Direction: plan the gate with all four requirements and the stricter interim reading (a rule without a measured PPV is not interruptive; the vendor-validated baseline needs an explicit, human-approved exception); file the day-0 question as a DN item for the CSO [HUMAN] rather than a README note.

Resolution:

### R-05 (minor) KNOWN-ANOMALIES omits known limitations

- Where: `docs/program/KNOWN-ANOMALIES.md` lists KA-001 to KA-006. Not listed: `docs/safety/traceability.csv` is not generated although §3.1 says "every build" (`docs/safety/README.md:19` calls it a placeholder with no work package); H7, H9, H11 and H15 and 22 SACs have no hazard entry (`README.md:127-128`, `safety check` warnings; KA-006 says only "planned controls"); the check does not yet cross-check `verified_by` against evidence (`README.md:72`, deferred to WP-0.9); the sign-off gate limitation (R-01); the backlog's `hazards` field is empty for every row while the hazard log already links 101 feature IDs (`backlog.yaml`, `hazard-log.yaml` `features:` lists; §3.1 BACKLOG.md "with … hazards"); KA-005's first sentence ("Licence scanning is configured … but not run") is imprecise, since the in-house check did run on the frontend lists (COMMANDS.md:64-65).
- Rule: §3.1, §3.5.
- Failure scenario: the next session trusts KA as the complete list of limitations and plans WP-0.2 without the traceability generator or the hazard-link rendering.
- Direction: add one KA row per limitation, each with its hazard reference and the work package that closes it; have `backlog render` derive `hazards` from the hazard log or add a cross-check.

Resolution:

### R-06 (minor) Evidence claims without a record of record, and evidence files outside the naming rule

- Where: `STATUS.md:16` cites under "Verified" the gates-bite record and the spot check, both dirty-tree Windows runs before the first commit (`evidence/ci/2026-10-18-gates-bite.md:5`, `evidence/backlog/2026-10-18-spot-check.md:5`), named without the `<shortsha>[-dirty]` that `evidence/README.md:19-25` requires; gates-bite covers four backend gates and two frontend lints, not "each gate"; the frontend licence results (2 shipped, 124 build-only), the 10⁶-sequence run and the "twice, the second run changed nothing" provisioning claim have no stored record; `COMMANDS.md:3` says every command was run while `:87` says `ktlintFormat` was not.
- Rule: §3.5, §19.1, `evidence/README.md:3` ("Nothing counts as passing unless it ran and its record is here").
- Note: this review re-ran every one of these claims on the Linux host and all hold (section 2); the defect is the record, not the substance.
- Direction: re-run the spot check and the plant matrix at a committed SHA in the WSL clone with the right names; store the licence-check output; make COMMANDS.md:3 accurate.

Resolution:

### R-07 (minor) No nightly run of record at the end of the session

- Where: `docs/program/evidence/ci/` holds no nightly record; `COMMANDS.md:38` records a Windows run only; `STATUS.md` and KA-003 explain that the tier fails closed but do not report the missing run as a deviation.
- Rule: §19.1 ("run `tools/ci/run nightly` at the end of every session that changed code"; "a red nightly is the next session's first task"); §3.5 last bullet.
- Direction: run it in the WSL clone at the session's last commit, store the (failing, NOT-BUILT) record, and say in STATUS.md that it cannot pass before WP-0.5/0.6.

Resolution:

### R-08 (minor) Appendix A rows whose note records a difference from K are not kept open in OPEN-QUESTIONS

- Where: `OPEN-QUESTIONS.md` §(c) has no entry for `INT-DOC-01` (`BUILD-PROMPT.md:2689`, note "K §4.3 lists PDF/A + FHIR (no CDA)"), `AI-RCM-01` (`:2710`, "K §4.3 marks claim scrubbing (P)"), nor for the "Not in K §4.3; K §14.2 keeps P2/P3" family `DX-RIS-03`, `DEV-SDC-01`, `ERP-FIN-03`, `AI-SUM-01`, `AI-INB-01`, `DFD-CRM-01` and `INT-PH-01` (grep: zero mentions; only `AI-PAT-01` is tracked, via A.20).
- Rule: §1 line 178 ("Where it deliberately differs from K (a note, a [P] mark or an A.20 entry) … keep the item open in `OPEN-QUESTIONS.md` until a human confirms it").
- Failure scenario: CDA document scope or a build-versus-partner stance is built without a human confirming the departure from K.

Resolution:

### R-09 (minor) One sentence reads as a weakening of the Phase 0 exit criterion

- Where: `WORK-PACKAGES.md:32`, under "Phase 0 exit criteria (§21)": "On this host the dev-cell items can be met only by a lite cell (DN-005)". §21 line 2295 requires that the dev cell installs from signed artefacts; `work-packages/WP-0.2.md:25`, `DECISIONS-NEEDED.md:168` and `OPEN-QUESTIONS.md:288` correctly say the criterion is not weakened and stays open on a lite cell.
- Rule: §3.4 item 1; §21.
- Direction: "can only be attempted on a lite cell; they stay open (DN-005)".

Resolution:

### R-10 (minor) STATUS.md calls the slice "verified" before review and names a report that did not exist

- Where: `STATUS.md:5` "In-flight slice: WP-0.1 bootstrap: verified"; `:6` "review in progress: `docs/program/reviews/WP-0.1.md`" while `docs/program/reviews/` held only its README at `adb631c`. §3.1 reserves `verified` for "the review found nothing unresolved"; `WORK-PACKAGES.md:13` says `review`.
- Direction: "impl; handed over for review" and "report not yet written".

Resolution:

### R-11 (minor) The host-provisioning record overstates its verification and omits system-wide changes

- Where: `provision-ubuntu.sh:4`, `tools/host/README.md:6`, `COMMANDS.md:18` and `DECISIONS-NEEDED.md:44` say every downloaded binary is checksum-verified; the script verifies Helm (`:56-58`), k3d (`:12,68`) and Node (`:76-78`) but fetches `rustup-init.sh` and runs it unverified with an unpinned toolchain (`:89`), trusts the Docker, Kubernetes and Corretto apt keys on TLS alone (`:24,31,47`), and runs `apt-get upgrade` on the whole distribution (`:17`). DN-001 to DN-004 do not itemise the upgrade, the global git configuration written for the build user (`:93`), the `/usr/local/bin` symlinks (`:82`) or `systemctl enable --now docker containerd` (`:39`). `DECISIONS-NEEDED.md:197` calls the Gradle mirror "the one place where a file did not come straight from the official source" while `:42` records the Ubuntu image from a kernel.org mirror; the MSI checksum is not recorded and the image hash is truncated (`:41-42`).
- Rule: §3.5; §3.4 item 9 ("Write the exact commands into `DECISIONS-NEEDED.md`"); §3.7.
- Direction: state exactly what is verified and what is trusted on TLS; list the system-wide changes in DN-001..004 (the script is in the repository, so a pointer per change suffices); record both mirror fetches as §3.7 deviations with their full hashes.

Resolution:

### R-12 (minor) Stale or self-contradicting documentation

- `tools/README.md:11` and `tools/bootstrap:3` list the bootstrap steps without `frontend` (and `tools/README.md` without `requirements-lock`), which `tools/hmstools/bootstrap/__main__.py:73` accepts.
- `frontend/README.md:71`: "@types/node 24.13.6 … matching the Node.js 24.13 runtime on the build host"; the host of record runs v24.22.0 (`evidence/ci/2026-10-18-fast-d3e14de.json`, `evidence/doctor/…txt:12`).
- `README.md:9`: "No product code has been written yet" (defensible, but the repository now holds build skeletons, tooling and tests).
- `docs/adr/ADR-010-workflow-temporal.md:42`: "State on 2026-10-18: not implemented", while the Temporal-boundary rule exists and runs (`backend/platform/arch-rules/src/main/kotlin/hms/kernel/archrules/HmsArchitectureRules.kt:66-76`, fixtures and `TemporalBoundaryRuleTest.kt`); `docs/adr/README.md:20` says "A rule in `backend/platform/arch-rules`".
- `docs/adr/ADR-020-configuration-content-as-code.md:60`: "no record under `docs/program/evidence/ci/` shows a run of them", while the stored fast record shows `repo-check: PASS`.
- `docs/adr/README.md:83`: "It does not check ADR numbers above 028 or this index"; `rules.py:188-205` checks both (gap detection up to the highest number, index link per file).
- Rule: §3.5 (claims match artefacts).

Resolution:

### R-13 (minor) The first build commit does not pass the fast tier on a fresh clone

- Where: commit `b24f94e` body: a fresh clone had no `frontend/node_modules`, so `sh tools/bootstrap && sh tools/ci/run fast` failed at the frontend step at `1b4415e`; `1b4415e`'s body claims only a Windows pass; no evidence record exists for `1b4415e` or `b24f94e`.
- Rule: §3.6 line 360 ("From the first commit that adds build files, every commit builds and passes the fast tier"); §3.5 last bullet (report every deviation).
- Direction: record it as a deviation in STATUS.md or KA (the fix is in place from `b24f94e`); never rebase `1b4415e`.

Resolution:

### R-14 (minor) ADR-002 records a JDK pin that nothing pins

- Where: `ADR-002:35` records "OpenJDK 25.0.4 (Eclipse Temurin 25.0.4.1+1)"; `libs.versions.toml:17` pins the major only (`java = "25"`); `tools/hmstools/bootstrap/steps.py:125-135` fetches whatever `api.adoptium.net/v3/assets/latest/25/hotspot` returns that day, with an Amazon Corretto "latest" fallback (`:138-149,159-163`); the checksum verified is the one the API returns, not a recorded value.
- Rule: §4.1 line 396 ("Pin each component … record the pinned set in ADR-002 … Re-resolve versions only at phase boundaries").
- Failure scenario: a later bootstrap installs 25.0.5 or Corretto; evidence records and the SBOM name a runtime ADR-002 does not.
- Direction: pin the Temurin release and its checksum in bootstrap (re-resolved only at phase boundaries), or state in ADR-002 that the patch level is "newest 25 at bootstrap time" and record it per host.

Resolution:

### R-15 (minor) "Recorded in the licence register" is claimed while the register is empty

- Where: `docs/adr/ADR-014-integration-hub.md:35` and `backend/gradle/libs.versions.toml:59-60` say HAPI HL7 v2 is "used unmodified under MPL-1.1, recorded in the licence register"; `tools/licence/register.yaml:17` is `entries: []` (ADR-022:78 says so correctly; the fact lives only in `tools/licence/ort/curations.yml`).
- Rule: §4.3 line 468-469; §3.5.
- Direction: add the register entry when the artefact is first depended on, and until then write "to be recorded".

Resolution:

### R-16 (minor) ADRs promise OPEN-QUESTIONS or DECISIONS-NEEDED records that do not exist

- Where: `ADR-016:13` and `ADR-017:15` each say "This ADR … records the difference for `docs/program/OPEN-QUESTIONS.md`" (the reopen trigger dropped relative to BP §7.2); `OPEN-QUESTIONS.md` has no mention of ADR-016 or ADR-017 (OQ-101 to OQ-105 cover ADR-021/022/023/024/027). `ADR-001:72` sets an interim C9 aggregation reading "until a human settles this" with no DN or OQ item.
- Rule: §1 line 177 ("record the difference in `docs/program/OPEN-QUESTIONS.md`"); §1 line 180 (flag an interim default).

Resolution:

### R-17 (minor) The repo check's ADR rule is weaker than described

- Where: `tools/hmstools/repo/rules.py:40` matches the status by prefix (`^(proposed|accepted-provisional|accepted|superseded by ADR-\d{3})\b`), so `Status: accepted, approved by the CSO` passes (verified); `:151-170` check only a `Status:` line, a `Date:` line and five heading prefixes at any level, not the H1 form, the `Source:` field or section order; `docs/adr/README.md:83` says "a `Status:` line with an allowed value". No test covers these cases.
- Rule: §3.5 line 350; template B.1.
- Direction: anchor the status regex (`$`), check the H1 and `Source:` lines, add failing-case tests.

Resolution:

### R-18 (minor) Conditional licences only warn

- Where: `tools/hmstools/licence/__main__.py:70-77` turns a conditional verdict without a register entry into a warning, so the check passes; `tools/licence/ort/evaluator.rules.kts:138-161` likewise emit `warning(...)` for conditional licences and components. §4.3 allows MPL-1.1, the dcm4che LGPL option, the OpenJDK runtime and OS packages only "unmodified and recorded in the licence register".
- Failure scenario: WP-1.1b adds `hapi-base`; the check passes with a warning nobody reads; the register stays empty.
- Direction: fail on a conditional component without a register entry (the register entry is the record §4.3 asks for); keep the warning only for the ORT run until it exists.

Resolution:

### R-19 (minor) Hazard-log control wording

- `hazard-log.yaml:903-907` (CTRL-0005-7): "the KB ≥10× Tier A rule … also stops any 100× deviation", while CTRL-0005-10 (`:956-960`) and §2.1 (c) (line 219) route a KB result with no maximum to pharmacist review ("dose check unavailable"), not a hard stop.
- `:1937-1940` (CTRL-0011-9): the witness confirmation is "compared with the relabel record; a difference is a mismatch", citing both the T2 behaviour and the §10.3 D fallback, which §2.1 SI-11 (line 204) and §10.3 (line 1546) define as a scripted two-person check with "no automated pass/fail". The control should say which mode compares.
- `:2984-2988`, `:3143-3146`, `:3269-3272` and the six label entries (`:3607-3609` … `:4013-4015`): the nightly property control omits "at least 10⁴ sequences through each real channel adapter" (§18.3 line 2021), which every other SI entry states (e.g. `:178-183`).
- `:234-235` ("A template linter rejects any clinical template that lacks a slot"), `:252` ("confirmed by the registrar"), `:2771-2772`: mechanisms the cited sources do not contain, not recorded as tightenings (§3.4 item 1: "Tightening is allowed and must be recorded"; `docs/safety/README.md:47`).
- `docs/safety/README.md:125` says §18.5 names no suite for SI-09 and SI-18, while the log cites §18.5 #10 for SI-09 (`:1575`) and #8 for SI-18 (`:2989`), which `BUILD-PROMPT.md:2092,2094` confirm.
- Rule: §2.1, §3.4 item 1, §18.3, §3.5.

Resolution:

### R-20 (minor) Sign-off record semantics

- Where: `signoffs.py:20` (`AUTHORISING_DECISIONS = {None, "approved", "accepted", "triaged"}`) and `:152-176`: a record with no `decision` authorises; a `triaged` record on `residual_risk.accepted_by` authorises an acceptance; `subject_version` (`signoff.schema.json:20-23`) is never read, so a record for HAZ-0005 at one version still authorises acceptance after its controls change; `approval.required: [cso]` is not matched against the record's `role`. `signoffs/README.md:21` documents the "no decision authorises" rule.
- Rule: §3.5 line 350; §10.1 line 1504.
- Direction: require `decision`, match the decision kind to the field (accept → `accepted_by`, triage → `cso_triage`, approve → `approval`), and compare `subject_version` with the subject's current version.

Resolution:

### R-21 (minor) The hazard-log schema is stricter than template B.2 without saying so

- Where: `hazard-log.schema.json` requires `description` (`:155`), `initial_risk.basis` (`:116`) and a non-empty `planned_verification` per control (`:127,147`), and fixes a control `type` enum (`:130`) the plan never defines (§10.1 line 1501 defines design/protective/information, carried in the optional `risk_control_option`). The B.2 example (`BUILD-PROMPT.md:2834-2855`) does not validate; `docs/safety/README.md:28` calls the extra fields "added", not mandatory.
- Rule: §3.5 last bullet (report every deviation); Appendix B.2.
- Direction: say in the README which B.2 fields became mandatory and why, or relax the schema to B.2 plus optional extras.

Resolution:

## 4. Observations (not defects)

- O-1 The fast tier passes at the handover commit `adb631c` on the Linux host (this review's run), so the stored record at `d3e14de` is not stale in substance; the handover commit changed documentation only.
- O-2 The hazard log quotes all 21 invariants character for character, rebuilds each from its clauses, covers every clause with at least one control (one narrowing, R-04), keeps every approval field empty, and every number in it traces to BUILD-PROMPT (the risk vocabulary and the `initial_risk` ratings are agent proposals marked [P] and disclosed, OQ-095). No clinical value, drug list, scoring band or standard code is written from memory.
- O-3 The 28 ADRs reproduce every §4.2 Decision and Reopen cell verbatim, carry the "Guarded by" text, and say "not implemented … claims no result" wherever the guard does not exist; ADR-002's pinned set matches the Gradle catalogue, the pnpm catalogue and `tools/requirements.txt`. Several pins are `.0` releases (ktlint 1.8.0, ktlint-gradle 14.2.0, Flyway 12.4.0, jsonschema 4.26.0 and others); whether they satisfy the §4.1 "at least one patch release" rule could not be verified offline.
- O-4 gitleaks' default rules do not flag a plain `password = "…"` assignment (no keyword/entropy match); the PAT, AWS and private-key rules fire. This is the expected behaviour of the default ruleset, not a defect of the configuration.
- O-5 A run's evidence record, written under `docs/program/evidence/ci/` and still untracked, makes the next run in the same tree `-dirty` (this review's merge record was named `…-merge-adb631c-dirty.json` for that reason alone). A commit subject on `wp/0.2-environments` seen in the Windows checkout's reflog suggests the build already addresses this; not verified here.
- O-6 The repo check accepts `release/<version>` and `hotfix/<slug>` branch names beyond §3.6's `main` and `wp/…`; OQ-099 records this as a choice [P].
- O-7 `WORK-PACKAGES.md:13-18` abbreviates some §21 scope cells under a "(§21)" header (for example WP-0.6's "rebuilt from specs in Phase 1" and the C5/C8 sentence, both present in `WP-0.6.md`); the Phase 1 exit line omits the RG1 seam hazard analysis and the tax-counsel opinion. No exit criterion is weakened; the per-package files are complete.
- O-8 DN-001 to DN-004 and DN-006 are closed on one quoted instruction ("Please do all the steps you have full approval go ahead", 18 October 2026). The quote is recorded verbatim with its date, which is the honest form; `DECISIONS-NEEDED.md:46` still reads "Blocks: now" for a closed item.
- O-9 The frontend `fast` script stops at the first failing part (`&&`), unlike `tools/ci/run`, which runs every step; the CI record therefore shows the first frontend failure only.
- O-10 `docs/safety/README.md:19-22` lists `traceability.csv`, `safety-case/`, `boundary-register/` and `soup.yaml` as placeholders that do not exist yet; the gate scans every YAML under `docs/safety/`, so they are covered from the day they appear. `backend/regulated/README.md:3` and `frontend/apps/signage/README.md:5` name no work-package number.
- O-11 The hazard-log schema alone would accept a filled `accepted_by` or a `verified` control with no tests (`hazard-log.schema.json:144-147,209,212,219-223`); the check (`check.py:401-409,474-481`) enforces these in the fast tier and the schema says it holds "structural rules only".
- O-12 The spot-check tool prints rows for a human comparison and makes no comparison itself; the "ten of ten" verdict is the build agent's reading (honestly labelled "not a person"). This review's own 25-row comparison agrees.

## 5. Appendix: candidates from the earlier, interrupted review that were dropped, and why

| Candidate | Outcome |
|---|---|
| Lead: gitleaks missed a planted GitHub personal access token | **Not reproduced.** A token of the correct form (`ghp_` + 36 alphanumerics) was found both in an untracked file and in the history of a scratch branch (rule `github-pat`). The earlier plant was probably malformed. Dropped |
| Lead: the 1,000,000-sequence claim not re-verified | Verified in this review (BUILD SUCCESSFUL, JUnit testcase "exactly the configured 1000000 iterations"). Not a finding |
| F-07(e), Z-12: safety README lists artefacts that do not exist | They are labelled "Placeholder" in the README table; honest. Observation O-10 |
| F-13: five DN items closed on one blanket approval | Recorded verbatim with date; a human decision for the lead, not a defect. Observation O-8 |
| F-16: placeholder READMEs without a work-package number | Observation O-10 |
| 05-F-2: the 236-row cross-check is unreproducible | Superseded: this review reproduced the recorded ten rows and checked fifteen more independently (section 2); the tool-design point is observation O-12 |
| 05-F-6: WORK-PACKAGES.md abbreviates §21 cells | No criterion weakened. Observation O-7 |
| 05-F-8: evidence of record predates the handover commit | The fast tier passes at `adb631c` (this review's run); STATUS.md states the SHA honestly. Observation O-1 |
| 05-F-9: backlog parser edge cases | No present defect; the 234 tripwire and the field-by-field comparison hold. Not a finding |
| Z-04: the JSON Schema alone accepts filled approvals and `verified` with no tests | Enforced by `check.py` in the fast tier and documented as structural-only. Observation O-11 |
| A-02: seven `.0` version pins | Cannot be verified offline. Observation O-3 |
| A-09: present-tense guard wording in ADR context sections | Each is corrected by the ADR's own "State on 2026-10-18" line; no false claim. Not a finding |
| F-11 as a stand-alone finding (system-wide changes not in DN) | The script holding the exact commands is committed and referenced from DN-001..004; the omissions are folded into R-11 |

Candidates confirmed and carried: F-01 (R-03), F-02/F-10/F-11/F-12 (R-11), F-03 (R-13), F-04/F-05/F-06/F-15 and 05-F-1 (R-06), F-07/F-08 and 05-F-3 (R-05), F-09 (R-02), F-14 (R-12), 05-F-4 (R-09), 05-F-5 (R-08), 05-F-7 (R-10), the lead's `gradlew` mode candidate (R-02), the lead's traceability note (R-05); from the sub-reviews of this session: A-01 (R-14), A-03/A-04 (R-16), A-05/A-06/A-07 (R-12), A-08 (R-17), A-10 (R-15), Z-01 (R-04), Z-02 (R-01), Z-03/Z-11 (R-20), Z-05 to Z-09 (R-19), Z-10 (R-21).
