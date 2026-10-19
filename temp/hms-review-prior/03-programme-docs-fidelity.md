# Prior partial review output: 03-programme-docs-fidelity (agent a802a2845bff3b35c)

## Review of WP-0.1 programme documents and commit history (honesty and fidelity)

Scope read: all control files, every evidence file, every README listed, `tools/host/provision-ubuntu.sh`, the four commit messages and stats, and the governing text. No tools were run; findings rest on reading and `git` read commands only.

### A. Candidate findings

**F-01 — major — a README attributes the host provisioning to the human; every other record says the agent did it**
- `tools/host/README.md:9-10`: "The human who owns the host ran it on 2026-10-18 with explicit approval; see `docs/program/DECISIONS-NEEDED.md` (DN-001 to DN-004) for the record."
- Contradicted by `docs/program/DECISIONS-NEEDED.md:40`: "On that instruction the build agent carried out the host steps itself. This deviates from §3.4 item 9…"; `STATUS.md:11`: "on the human's instruction the Linux build host was provisioned"; commit `1b4415e` body: "on the human's instruction the build agent provisioned the Linux build host (WSL2, Ubuntu 24.04 and its toolchain), a recorded deviation from §3.4 item 9".
- Rule: §3.5 (never record a human action/approval not witnessed; report every deviation plainly). Scenario: an auditor reading `tools/host/` concludes the privileged host changes were made by the host owner and the §3.4 item 9 deviation never happened.

**F-02 — minor (host, not product) — "pinned and checksum-verified" / "every downloaded binary is verified against its publisher's SHA-256" is overstated**
- Claimed at `COMMANDS.md:18` ("pinned and checksum-verified"), `provision-ubuntu.sh:4`, `tools/host/README.md:6`, `DECISIONS-NEEDED.md:44` ("every downloaded binary is verified against its publisher's checksum").
- Script reading (`tools/host/provision-ubuntu.sh`): SHA-256 enforced for Helm (`:56-58`, same-origin `.sha256sum`), k3d (`:12`, `:68`, hash pinned in the script), Node (`:76-78`, same-origin `SHASUMS256.txt`, not the signed `.asc`). Not enforced: `rustup-init.sh` (`:89`, `curl … -o /tmp/rustup-init.sh && sh /tmp/rustup-init.sh … --default-toolchain stable`: no checksum, toolchain unpinned); Docker apt key (`:24`), Kubernetes apt key (`:31`), Corretto key (`:47`): TLS-only, no fingerprint check; Docker, kubectl, JDK via apt (`:37`, `:43`) pinned only to a repository/minor line; `apt-get -y -qq upgrade` (`:17`) upgrades the whole distribution. No `curl | bash` and no `apt-key`; `K3D_BINARY` (`:66-67`) lets a locally supplied binary bypass the download but still enforces the pinned hash.
- Rule: §3.5 (claims must match artefacts). Scenario: a reader relies on "every binary verified" when the Rust toolchain and three signing keys were trusted on TLS alone.

**F-03 — minor — §3.6 line 360 ("every commit builds and passes the fast tier") is not met for `1b4415e` on the build host, and the deviation is not called one**
- `b24f94e` body: "A fresh clone had no frontend/node_modules, and neither tools/bootstrap nor tools/ci/run installed it, so the documented gate command ('sh tools/bootstrap && sh tools/ci/run fast') failed at the frontend step in the WSL clone." `1b4415e` body claims only "Verified on the Windows checkout: tools/ci/run fast passes every step" (run with `--no-evidence`, `COMMANDS.md:33`). `STATUS.md:12` lists it as a defect fixed, not as a deviation.
- No evidence record exists for `1b4415e` or `b24f94e`; the only fast-tier record is `evidence/ci/2026-10-18-fast-d3e14de.json`. Rule: §3.6 line 360; §3.5 last bullet.

**F-04 — minor — "each gate fails on a planted violation" is broader than the evidence**
- `STATUS.md:16` and `evidence/ci/2026-10-18-gates-bite.md:3` ("Each quality gate of the fast tier fails when a violation is planted"). The file shows four backend gates (`:11-14`) and two frontend lints (`:37-38`). Not planted: repo-check, safety-check approval gate, backlog-check, secret-scan, typecheck, i18n lint (some have unit self-tests, e.g. `tools/hmstools/safety/tests/test_signoff_gate.py`, `tools/hmstools/ci/tests/test_secret_scan.py`, but that is not what the sentence claims).
- The record ran "on the working tree … before the first build commit (base `ed023b6`)" (`:5`), on the Windows host, and is not named with a SHA/`-dirty` as `evidence/README.md:19-25` requires. Rule: §3.5, §19.1.

**F-05 — minor — claims whose only evidence is the sentence**
- `COMMANDS.md:18` "WSL, twice (the second run changed nothing)"; `:24` "reproduced the committed file byte for byte" (the only test, `tools/hmstools/bootstrap/tests/test_bootstrap.py:261`, compares pins, not bytes); `:84` "1,000,000 iterations, 5 s"; `:111-112` "byte-identical output" (a fixture idempotency test exists, `tools/hmstools/backlog/tests/test_generate.py:83`, but `evidence/backlog/2026-10-18-spot-check.md:128` records that at the time re-running generate "changed nothing except the backlog.yaml header comment").
- `STATUS.md:16` / `COMMANDS.md:64-65` "frontend licence checks pass (shipped: 2 components; build-only: 124)" — a claim of a check passing with no stored record (`build/` is git-ignored), against the repository's own rule `evidence/README.md:3`: "Nothing counts as passing unless it ran and its record is here." This one is the §3.5 concern; the others are descriptive claims.

**F-06 — minor — internal contradiction in COMMANDS**
- `COMMANDS.md:3`: "Every command below was run on 18 October 2026" vs `:87` `ktlintFormat` "not run (it changes files)".

**F-07 — minor — KNOWN-ANOMALIES is incomplete (§3.1: "every known defect, stub, limitation or fallback")**
- (a) `docs/safety/traceability.csv` (§3.1 "generated … Every build"; §6.1) does not exist (`git ls-files docs/safety` lists 5 files); `docs/safety/README.md:19`: "Placeholder: not generated yet. Its generator is not part of WP-0.1; the lead places it in a work package". No KA, OQ or DN entry mentions traceability (grep over `docs/program` returns nothing).
- (b) `docs/safety/README.md:127-128`: H7, H9, H11, H15 have no hazard entry; 22 SACs have no hazard entry although "§18.1 says every SAC has a hazard ID". The check only warns (`tools/hmstools/safety/check.py:499,502`; `warnings_reported: 2` in the CI record). KA-006 says only "The hazard log holds only planned controls".
- (c) `tools/licence/README.md:36-37`: ORT files "are unvalidated: the evaluator rules … have not been compiled against an ORT version" — KA-005 says configured/not run, not that the rules are uncompiled.
- (d) `docs/safety/README.md:72`: the gate does not yet cross-check that `verified_by` tests passed in evidence (deferred to WP-0.9) — not in KA.
- (e) `soup.yaml`, `safety-case/`, `boundary-register/` are listed as "Placeholder" (`docs/safety/README.md:20-22`) but no file or directory exists.
- (f) the unverified rustup/GPG-key fetches of F-02.

**F-08 — minor — KA-005 is imprecise about ORT vs the in-house check**
- `KNOWN-ANOMALIES.md:13`: "Licence scanning is configured … but not run" while `COMMANDS.md:64-65` records `tools/hms licence check --pnpm …` PASS on 2 and 124 components. The closing sentence ("No dependency has been licence-checked by ORT yet") is accurate; the opening sentence is not. Suggest: "ORT has not run; the in-house check ran on the frontend lists on the Windows host, without a stored record."

**F-09 — minor — a deliverable is documented with a command the repository says does not work**
- `docs/program/work-packages/WP-0.1.md:19`: "`corepack pnpm --dir frontend run fast` runs ESLint…"; `COMMANDS.md:91`, `frontend/README.md:26-28` and `gates-bite.md:44` state that this exact invocation "stops with `ERR_PNPM_BAD_PM_VERSION`".

**F-10 — minor — mirror downloads: an inconsistent record and no §3.7 label**
- `DECISIONS-NEEDED.md:197`: "The mirror download is the one place where a file did not come straight from the official source" — contradicted by `:42` (Ubuntu image "from the `mirrors.edge.kernel.org` copy") and by the `K3D_BINARY` bypass ("a copy verified elsewhere may be passed", `provision-ubuntu.sh:66`). §3.7 allows downloads "from their official registries"; both mirror fetches were checksum-verified and recorded with a reason (slow network), but neither is labelled a §3.7 deviation.

**F-11 — minor — system-wide changes made by the script that DN-001..004 do not record**
- `provision-ubuntu.sh:17` `apt-get -y -qq upgrade` (whole-distribution upgrade); `:93` `git config --global init.defaultBranch main` for `surface`; `:82` symlinks into `/usr/local/bin`; `:39` `systemctl enable --now docker containerd` (only implied at `DECISIONS-NEEDED.md:74`). Recorded correctly: `.wslconfig` (`:43`, `:166`), docker group (`:74`), Docker and Kubernetes apt repositories (`:74`, `:101`), default distribution (`:24`), `/etc/wsl.conf` untouched ("Systemd is on in the Ubuntu 24.04 WSL image", `:74`). `DECISIONS-NEEDED.md:74` also reports pull speeds from ghcr.io, quay.io and Docker Hub without naming the images pulled. Rule: §3.4 item 9 ("Write the exact commands into DECISIONS-NEEDED.md"), §3.5 last bullet.

**F-12 — minor — unverifiable or incomplete provenance in DN-001**
- `DECISIONS-NEEDED.md:41`: "the human approved the administrator prompt and pointed the repair at the verified copy" (a human action the agent can only infer from success); the MSI's SHA-256 "matched Microsoft's published release" but the value is not recorded; the Ubuntu image hash is truncated (`bb415d82…039e`, `:42`). Rule: §3.5; reproducibility of the record.

**F-13 — observation (reviewer decides) — five DN items closed on one blanket sentence**
- DN-001, 002, 003, 004 and DN-006 are `closed` on "Please do all the steps you have full approval go ahead" (`DECISIONS-NEEDED.md:40`, `:190`). DN-006 (`:190`) and KA-002 (`KNOWN-ANOMALIES.md:10`) say "confirmed by the human", which is an inference from a blanket approval to a list that contained the question, not a specific answer. The quote is recorded verbatim with date, which is the honest form; whether it counts as a witnessed decision for administrator-level changes is for the reviewer. `DECISIONS-NEEDED.md:46` still reads "**Blocks:** now" although the item is closed (stale).

**F-14 — minor — stale documentation after the fix commits**
- `tools/README.md:11` lists bootstrap steps `[all|jdk|gradle|gitleaks|venv|env]` and `tools/bootstrap:3` lists `[all|jdk|gradle|gitleaks|venv|env|requirements-lock]`; the tool accepts `frontend` and `requirements-lock` (`tools/hmstools/bootstrap/__main__.py:73`). `frontend/README.md:71`: "@types/node 24.13.6 … matching the Node.js 24.13 runtime on the build host" — the build host of record runs `v24.22.0` (`evidence/ci/…json:25`). `README.md:9`: "This repository currently holds research, planning and the build brief. No product code has been written yet" — untouched since the plan import (defensible as "no product code", but the first clause is no longer complete).

**F-15 — minor — `gates-bite.md` departs from the evidence naming rule**
- `evidence/README.md:19-25` requires `<date>-<tier-or-test>-<shortsha>[-dirty]`; `evidence/ci/2026-10-18-gates-bite.md` has no SHA and was a dirty-tree run (`:5`).

**F-16 — observation — placeholder READMEs**
- All name a filling work package except `backend/regulated/README.md:3` ("Each arrives with the work package of the feature that needs it (§21)", no WP number) and `frontend/apps/signage/README.md:5` ("R1.1 item (Phase 1.1)", which has no WP number in §21). `backend/hub/README.md:3`, `backend/regulated/README.md:3` and `deploy/site-cell/README.md:3` describe future components in the present tense before stating when they arrive; nothing claims an artefact exists that does not.

### B. What checked out (no finding)

- STATUS.md: 29 lines (`wc -l`; CI record `status_lines: 30`), every B.5 field present (`STATUS.md:1-7, 9, 18, 22, 29`), "Blocking decisions" matches "Blocking now" (2 items, ≤10; `blocking_now_items: 2`). `STATUS.md:3` records `@ d3e14de` and explains that the evidence commit follows; `adb631c` is documentation only (`git show --stat`: 7 files under `docs/program/`). The reviewed tip should be named as `adb631c`.
- Plan-of-record files untouched: `git diff --stat ed023b6 adb631c -- BUILD-PROMPT.md 'BLUEPRINT*' research/ README.md assets/` is empty.
- Commits: Conventional Commits (`feat(programme)`, `fix(tools)`, `fix(doctor)`, `chore(programme)`); bodies name tests added, KA references, "No feature ID is built", hazard seeding (§3.6 line 362). Python test counts are consistent across commits (384 → +5 → 389 → +3 → 392).
- Evidence run was at the committed SHA on a clean tree 11 s after the commit (`git.dirty: false`, `started_at 18:43:45` vs commit 18:43:34).
- No "HIPAA", "GDPR certified", "compliant" or certification claims in CHANGELOG/README/control files (only ADR text about third-party certified hardware and OQ-043/044, which mark certification as [HUMAN]).
- No [HUMAN] gate is marked passed (`WP-0.1.md:36-37`); hazard log: 193 controls all `planned`, 0 implemented/verified, `approval_fields_filled: 0`.
- Nothing outward-facing found in the record (no accounts, publishing, pushes; `git remote -v` empty; downloads only). This cannot be proven from the repository alone.
- OQ-084..105 read as genuine open items; OQ-084 correctly "moved" to DN-005; no OQ found that blocks now; DN-007/008/012 are "later" items that need the human (§3.4 item 9 or plan-of-record files), so DN is the right home.

### C. Claims checked and artefacts found

| Claim | Where | Artefact | Verdict |
|---|---|---|---|
| fast PASS 8/8, 972 tests (392/66/514), 0 fail, 0 skip, 69 s, WSL, clean tree @ d3e14de | STATUS:4,14; adb631c body; WORK-PACKAGES:13 | `evidence/ci/2026-10-18-fast-d3e14de.json:8,10,13,84,161,180,206-216` | evidenced (step logs under git-ignored `build/ci-logs/`) |
| doctor 18 OK; RAM 9.7 GiB; 36.4 GiB free on C: | STATUS:15; COMMANDS:25-26 | `evidence/doctor/…txt:22,25,39`; `.json` counts ok 18 / missing 2 | evidenced |
| merge/nightly/release fail closed, NOT-BUILT steps name WP | STATUS:16; KA-003; COMMANDS:37-38 | `tools/hmstools/ci/tiers.py:230-275`, `runner.py:212-224`, `test_ci.py:100` | design evidenced; the Windows runs themselves have no record |
| each gate fails on a planted violation | STATUS:16; backend/README:52 | `gates-bite.md` (4 backend gates, 2 frontend lints) | partial (F-04) |
| spot-check 10/10 | STATUS:16; COMMANDS:113 | `evidence/backlog/2026-10-18-spot-check.md:29-44` | evidenced (narrative, dirty tree) |
| licence checks pass 2 shipped / 124 build-only | STATUS:16; COMMANDS:64-65 | none | sentence-only (F-05) |
| "Every command below was run on 18 Oct" | COMMANDS:3 | contradicted by COMMANDS:87 | sentence-only (F-06) |
| provision run twice, second changed nothing | COMMANDS:18; DN-001:44 | none | sentence-only |
| requirements-lock byte-for-byte | COMMANDS:24 | `test_bootstrap.py:261` (pins only) | sentence-only for byte-identity |
| PBT 10⁶ iterations, 5 s | COMMANDS:84 | none | sentence-only |
| generate/render byte-identical | COMMANDS:111-112 | `test_generate.py:83` (fixture); spot-check.md:128 contradicts for that day | partial |
| 234 feature IDs; 28 ADRs; hazard log parses | STATUS:10; WP exit | CI record `features: 234`, `adrs_valid: 28`, safety-check PASS | evidenced |
| STATUS ≤150 lines; Blocking now ≤10 enforced | COMMANDS:52 | `repo/rules.py:54,377-388`; CI record | evidenced |
| bootstrap verifies every download (SHA-256 / lockfile sha512) | COMMANDS:20; KA-002 | `bootstrap/steps.py:135,142,165,252-263,325-350`; `gradle-wrapper.properties` `distributionSha256Sum` | evidenced in code |
| Gradle from Aliyun verified vs official SHA | KA-002; DN-006:194 | `steps.py:229,258-263` | mechanism evidenced; the event sentence-only |
| host versions (Docker 29.9.1, k3d 5.8.3, kubectl 1.37.1, Helm 4.3.1, Node 24.22.0, Rust 1.99.1) | DN table:25-30 | `doctor…txt:6-14` | evidenced |
| provision script "pinned and checksum-verified" | COMMANDS:18; README; DN-001:44 | script read | overstated (F-02) |
| `1b4415e` passes fast tier | 1b4415e body | none; b24f94e body says the gate failed in the WSL clone | not evidenced (F-03) |
| `b24f94e` passes fast tier (389/66/514) | b24f94e body | none | sentence-only |
| secret scan no findings | STATUS:14 | CI record `history_findings: 0, working_tree_findings: 0` | evidenced |
| ORT not run | KA-005; tools/licence/README:36 | `tiers.py:240` NOT-BUILT | consistent |
| no CRLF outside plan of record; 4 plan files CRLF | DN-012 | `git ls-files --eol`: exactly those 4 | evidenced |

### D. Not checked

- No tool, test or CI command was run; no WSL access. Logs under `build/ci-logs/` (git-ignored) were not inspected.
- External facts not verifiable from the repository: the human's chat instruction and its scope, the UAC approval, the MSI/Ubuntu-image checksums against Microsoft's publications, the actual `.wslconfig` / `/etc/wsl.conf` on the host, pull speeds, whether anything outward-facing happened outside git.
- Not read line by line: ADR bodies (only ADR-002 grep and the index), `hazard-log.yaml` content against §2.1 text, `backlog.yaml`/`BACKLOG.md`, `ASSUMPTIONS.md` beyond its header, OQ-001..083 individually, WP-0.3..0.9 files, the Gradle catalogue versus ADR-002's pin list, `pnpm-lock.yaml`, the full `CODEOWNERS`.
