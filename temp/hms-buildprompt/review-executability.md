# Executability review: HMS Kurdistan master build prompt (read from the agent's seat)

**Reviewed:** `BUILD-PROMPT.assembled.md` (2,784 lines, about 52,000 words), read in full. Cross-checked against `BLUEPRINT-KURDISTAN.md` (§7.2 ADR register, §7.6 stack, §15.1 gates, §15.4 spikes) and the research section headings that the "Read:" lines cite.
**Date:** 18 October 2026. Read-only host checks. External checks were limited to licence and version claims (sources at the end).

**Host facts used below.** Windows 11 Pro, 15.6 GB RAM, 8 logical CPUs. On PATH: Node 24.13.0, Python 3.12, Git. Not on PATH: docker, k3d, kubectl, helm, java/javac, gradle, pnpm, rustc/cargo. `wsl.exe` exists, but `wsl -l -v` fails with "The system cannot find the file specified", so there is no usable Linux distribution. **Repository:** branch `master` with no commits and no remote. README and icon are staged; the blueprints, the 2.5 MB PDF and `research/` are untracked.

## Summary

| # | Severity | Finding | Main location |
|---|---|---|---|
| 1 | Critical | No build-host prerequisites. This host cannot run Phase 0, and nothing stops the agent installing system software | Preface; §5.1; WP-0.1/0.2 |
| 2 | Critical | "Reference cell" means both k3d and real hardware. Phase 0 exit needs hardware and invites laptop numbers reported as evidence | §18.6; §19.1–19.2; WP-0.6; Phase 0 exit |
| 3 | Critical | "CI" is never defined, yet every gate is "in CI" | §6.8; §19.1; §3.6; Phase 0 exit |
| 4 | Critical | Templates pre-fill [HUMAN] approvals and "verified" status | App. B.2, B.3; WP-0.5 |
| 5 | Major | "No dose arithmetic" contradicts required behaviours, and the term is undefined | SI-05; §6.8; §9.16–9.17; §10.3 |
| 6 | Major | The kickoff spends about 100k tokens on reading before any work starts | Kickoff step 1 |
| 7 | Major | Cross-session state is saved only "before you stop" | Kickoff; §3.1; §3.2; B.5 |
| 8 | Major | The review loop is not closed | Continue and review prompts; §22.1 #10 |
| 9 | Major | "Stop and ask" never stops, and DECISIONS-NEEDED starts with about 80 unranked items | §3.4; §3.1; §11; A.20 |
| 10 | Major | Git trunk, the first commit and the merge point are undefined | §3.6 |
| 11 | Major | "If a test is wrong, fix it" lets the agent rewrite safety tests | §3.5 |
| 12 | Major | "NOT FOR CLINICAL USE" is a label, not a gate, and synthetic data can look real | §3.3; §9.10; §11.9; §19.4 |
| 13 | Major | Image signing as specified publishes to the public Sigstore log | §4.1; WP-0.2; WP-0.9 |
| 14 | Major | No network rule, and no simulators for most external parties | §3.4 #6; §18.2; AU-3 |
| 15 | Major | The ADR-001 rule needs an Option B nobody is told to build; effort criteria cannot be measured | §4.2; §18.6; WP-0.6 |
| 16 | Major | The licence policy rejects parts of the chosen stack, and one licence is mislabelled | §4.1; §4.3 |
| 17 | Major | An AI reviewer could be recorded as the "second person" | §13.1 SD-2; preface step 5 |
| 18 | Major | WP-1.1 needs licensed terminology the agent cannot obtain | §3.4 #5; §8.7; WP-1.1 |
| 19 | Major | Unnamed components whose usual picks are now broken or denylisted | WP-0.2; DP-5; ADR-008 |
| 20 | Major | One synchronous standby cannot give both RPO 0 and "kill a node, still writable" | §5.1; §16.2; WP-0.2 |
| 21 | Major | WP-0.8 golden images cannot be produced for ZPL text without printers | §4.1; WP-0.8 |
| 22 | Major | Instruments are to be implemented "verbatim from the cited source" with no source, and some need licences | §3.5; §10.4 |
| 23 | Major | The "Leapfrog harness" cannot exist as described, and a mock-KB pass grades itself | §9.5; §9.10; §18.5; WP-1.5 |
| 24 | Major | Phase 1 puts the Integration Hub after the work packages that need it | §5.2; WP-1.2/1.4/1.7/1.8/1.12 |
| 25 | Major | The precedence rules contradict each other and Appendix A | §1; App. A |
| 26 | Minor | Undefined or colliding terms in exit criteria ("G1 machine", [E], spike codes) | WP-0.5; Conventions |
| 27 | Minor | The hazard-log gate has no state for planned controls | §10.1; WP-0.1 |
| 28 | Minor | "Executable" state-machine specs have prose guards | §8.4; B.3 |
| 29 | Minor | The "newest GA" rule conflicts with the listed versions and would force a PostgreSQL .0 upgrade | §4.1 |
| 30 | Minor | Later sessions never re-read the conventions or the "cannot do" list | Continue prompt |
| 31 | Minor | The kickoff names a file that does not exist yet | Preface step 1 |

---

## Findings

### 1. [Critical] No build-host prerequisites. This host cannot run Phase 0, and nothing stops the agent installing system software

**Where:** Preface "How to run it" step 2; §5.1 "Development profile [P]"; WP-0.1; WP-0.2; WP-0.7; §22.1 item 7.

**Quote:** §5.1: "a `docker compose` stack for fast inner-loop work, and a three-node `k3d` cluster that mirrors the on-site cell … Both use the same Helm charts and container images as production." WP-0.2: "three-node `k3d` reference cell with CloudNativePG (synchronous standby), Strimzi Kafka KRaft (three brokers), Temporal, Keycloak, OpenFGA, Valkey and an S3-compatible object store … Argo CD … OpenTelemetry collector". §22.1 #7: "runs on the three-node cell profile".

**How it hits the agent:**
- The prompt never states the OS, toolchain or resources the build needs.
- On this host, WP-0.1 cannot run Gradle (no JVM). WP-0.2 has no container engine or Kubernetes tools. Tauri (WP-0.7) needs Rust, and there is no Linux environment.
- 15.6 GB of RAM cannot hold the full three-node stack plus a JVM build; WSL2 gets half the RAM by default.
- The agent will either stall, or try `winget`/`choco`, enable WSL or Hyper-V, or install Docker Desktop. These are admin-level system changes that need a reboot and carry licences, and §3.4 does not list them as stop-and-ask.
- Smaller gaps:
  - iOS builds and Maestro iOS flows are impossible on Windows.
  - CRLF checkouts break hash and golden-image tests.
  - "compose … same Helm charts" is impossible as written.

**Fix:**
1. Add above the kickoff prompt:

   > **Before the first session [HUMAN]: prepare the build host.** The build runs in Linux. On Windows, install WSL2 with Ubuntu 24.04, clone the repository inside the WSL file system (not `/mnt/c`) and start the agent session there. Install:
   > - a container engine (Docker Engine in WSL2, Rancher Desktop or Podman; Docker Desktop needs a paid subscription in larger organisations);
   > - k3d, kubectl and Helm;
   > - JDK 25 (Temurin);
   > - Node.js 24 LTS with pnpm through Corepack;
   > - Rust stable with the Tauri 2 prerequisites;
   > - Python 3.12;
   > - Git configured for LF line endings.
   >
   > Give the Linux VM at least 32 GB RAM and 8 cores for the full dev cell. With less, use the compose profile and a "lite cell" (one Kafka broker, two PostgreSQL instances, no Argo CD), and label every result from it "lite". iOS builds and Windows desktop-shell builds need macOS and Windows build steps that a human provides.

2. Add §3.4 item 9: "Installing or upgrading system software, enabling OS features, changing system-wide configuration, or anything that needs administrator rights. Write the exact commands into `DECISIONS-NEEDED.md` for the human."
3. Add to WP-0.1: "`tools/doctor` checks every prerequisite and resource limit and prints what is missing. `.gitattributes` sets `* text=auto eol=lf` and marks images and fonts `binary`."
4. In §5.1, replace the last sentence with: "Both use the production container images; the k3d cell also uses the production Helm charts."

### 2. [Critical] "Reference cell" means both k3d and real hardware. Phase 0 exit needs hardware and invites laptop numbers reported as evidence

**Where:** §0 bar row 3; §5.1; §18.6; §19.1 Nightly; §19.2; WP-0.6; Phase 0 exit; WP-1.15; §22.3; ADR-009.

**Quote:**
- §18.6: "The 300-bed day on the three-node reference cell (3 × 32 cores, 128 GB, NVMe) with every component running."
- §19.1: "the 300-bed day on the three-node `k3d` reference cell and the 1,000-bed day on the central profile".
- C7: "Point-in-time restore of a 5-year, 150-bed tenant on on-site hardware … ≤4 h".
- WP-0.6 exit: "ADR-001 and ADR-009 move from "accepted-provisional" to "accepted"".
- ADR-009 reopen trigger: "C9 fails on reference hardware".

**How it hits the agent:**
- C7, C9, the footprint test, every SLO, and the 300-bed and 1,000-bed days are defined on 3 × 32-core, 128 GB servers. Yet §19.1 and §19.2 call the k3d cluster the "reference cell".
- On an 8-thread, 16 GB host the agent either cannot run them, so Phase 0 cannot exit, or it runs a shrunken version, reports C9 passed and ADR-009 accepted. That is the misleading evidence §3.5 forbids.
- The same ambiguity turns "any p95 regression blocks release" into a noisy, flaky gate on a laptop.

**Fix:**
- Add to §5.1:
  > **Dev cell:** the three-node k3d cluster on the build host. **Reference cell:** three physical servers matching the reference hardware, provided by the human [HUMAN]. Every performance, footprint or restore number names the cell it came from. Only reference-cell numbers count as evidence for C7, C9, SLOs and release gates; dev-cell numbers are labelled "indicative".
- Replace the WP-0.6 exit with:
  > Spike report with C1–C6 and C8 measured on the dev cell (indicative); C7 and C9 harnesses built and dry-run at reduced scale. ADR-001 and ADR-009 stay accepted-provisional until a reference-cell run [HUMAN: hardware], unless a measured result already triggers a reopen rule, which you record.
- In the Phase 0 exit, replace "the reference cell installs from signed artefacts" with "the dev cell installs from signed artefacts; the reference-cell install waits for hardware".
- §19.1 Nightly, on the dev cell: "a scaled functional day (about 30 beds); p95 compared with the same host's last baseline; fail on a regression above 15% across three runs".

### 3. [Critical] "CI" is never defined, yet every gate is "in CI"

**Where:** §0 rows 1 and 3; §6.8 heading; §18.2–§18.3; §19.1; §3.6; Phase 0 exit.

**Quote:**
- §6.8: "(all in CI; a failure blocks merge)".
- §19.1 Nightly: "Trigger: Schedule".
- Phase 0 exit: "every CI tier running (nightly property runs included)".
- §3.6: "Push and open pull requests only when a remote exists and the human has asked for it".
- §18.3: "drives random command sequences through every channel adapter … The nightly run executes 10⁶ sequences".

**How it hits the agent:**
- There is no remote, no CI service, no scheduler and no branch protection, and an agent session is not running at night.
- The agent will either write hosted-CI YAML that never runs and call the tiers "running", or treat ad-hoc local runs as CI. Either way, nothing actually "blocks merge".
- 10⁶ sequences through real HTTP, MLLP and mobile-sync adapters cannot finish overnight on this host, so N will be quietly shrunk.

**Fix:**
- Add to §19.1:
  > **What CI means here.** Until the human provides a remote and a CI service, CI is `tools/ci/run <fast|merge|nightly|release>`, which you run locally.
  > - **Evidence.** Each run writes `docs/program/evidence/ci/<date>-<tier>-<sha>.json` with the commands, counts, durations, host and result.
  > - **Blocks merge.** You do not merge a `wp/*` branch into `main` unless `merge` passed on the merge candidate.
  > - **Nightly.** You run `tools/ci/run nightly` at the end of every session that changed code, or the human schedules it. A red nightly is the next session's first task.
  > - **Hosted CI.** You may write hosted-CI configuration, but it is not evidence until it has run.
  > - **No shortcuts.** Never report a shortened run as the gate; record the actual sequence count.
- Add to §18.3: "Run the 10⁶ sequences at the application-command layer with in-memory adapters, plus at least 10⁴ sequences through each real channel adapter."
- Phase 0 exit: "every CI tier runs through `tools/ci/run` with stored evidence".

### 4. [Critical] Templates pre-fill [HUMAN] approvals and "verified" status

**Where:** Appendix B.3 and B.2; WP-0.5; WP-0.1 (hazard-log seeding).

**Quote:** B.3: `approved_by: [pharmacist-panel, nurse-panel, cso]   # [HUMAN]`. B.2: `status: controls-verified   # open | controls-implemented | controls-verified | accepted`. WP-0.5: "Executable specs (Appendix B.3) … approval requests filed in `DECISIONS-NEEDED.md`".

**How it hits the agent:**
- WP-0.5 tells the agent to write specs from B.3. Copying the example yields safety specs that record panel and CSO approval that never happened, while DECISIONS-NEEDED says approval is only requested.
- Any generator or gate that reads `approved_by` will treat these specs as approved.
- B.2's example invites seeding hazards as "controls-verified" with residual risk already filled in.
- Nothing says that `accepted` (risk acceptance) is a CSO act.

**Fix:**
- B.3: replace with `approval: {status: requested, required: [pharmacist-panel, nurse-panel, cso], approved_by: [], record: null}   # approved_by and record are written only by a human`.
- B.2: replace with `status: open   # the agent may move open → controls-implemented → controls-verified only with passing test IDs in verified_by; "accepted" is [HUMAN]`. Add `residual_risk: {proposed: {…}, accepted_by: null}`.
- Add to §3.5: "Never write a person, panel or role into an approval, sign-off, triage or risk-acceptance field. Leave it empty and set the status to 'requested'. CI fails if such a field changes without a linked human sign-off record."

### 5. [Major] "No dose arithmetic" contradicts required behaviours, and the term is undefined

**Where:** SI-05; §6.8 #1; §8.1 P6; §9.6; §9.10 (infusion model; acceptance 6); §9.16; §9.17; §10.3 A.

**Quote:**
- §10.3 A.1: "The system performs no dose arithmetic." A.2: "A drug-KB result ≥10× the maximum dose is a Tier A hard stop".
- §9.17: "weight-based dosing … computed only under control set A".
- §9.16: "titration checked against ordered parameters".
- §8.1 P6: "conversions only through the terminology service".
- §9.10 acceptance 6: "no dose arithmetic exists outside `reg-dose` (which is absent in the MVP)".

**How it hits the agent:**
- The agent must write the detekt and ArchUnit rule (the `Quantity` type arrives in WP-0.3; mock-KB dose ranges in WP-1.5) without knowing what counts as dose arithmetic. Does a unit conversion count? The ≥10× comparison? A titration range check? An mg↔mL display?
- Either the rule is drawn narrowly and conversions creep into production code (the very 10× error class the rule exists to stop), or it blocks required features and gets weakened.
- §9.17 says NICU doses are "computed"; §10.3 says the system computes nothing.

**Fix:** Add after SI-05:

> **Dose arithmetic** is any computation that derives or transforms a medication amount, rate, concentration or volume: multiplying or dividing by weight, BSA, concentration or time; converting a dose or rate between units; summing or rounding doses. Until `reg-dose` is active, no production code does it.
>
> Allowed outside `reg-dose`:
> - (a) showing human-entered or KB-returned values unchanged;
> - (b) exact comparison of two independently entered quantities in the same UCUM unit (a unit mismatch is itself a mismatch that returns the order);
> - (c) comparing a KB-returned ratio or flag with the governed threshold. The ≥10× stop uses the KB's own ratio; if the KB returns none, show "dose check unavailable" and send the order for pharmacist review;
> - (d) checking a nurse-entered rate against the ordered minimum and maximum in the same unit;
> - (e) fluid-volume balances.
>
> The mock KB's arithmetic lives only in test fixtures.

In §9.17, replace "computed only under control set A" with "calculated by the pharmacist under control set A, never by the system".

### 6. [Major] The kickoff spends about 100k tokens on reading before any work starts

**Where:** Kickoff step 1; preface step 7.

**Quote:** "1. Read BUILD-PROMPT.md completely." / "Expect the first session to spend its context reading: this prompt is about 52,000 words."

**How it hits the agent:**
- The prompt is about 350,000 characters (about 90,000 tokens). K Part 0 and §1 add about 3,900 words. All of it arrives through many chunked file reads.
- In a typical 200k-token session, auto-compaction will summarise away §2 and §3 before WP-0.1 starts, which defeats "read completely".
- The 7,400-word Appendix A table is better parsed by a script than read.

**Fix:** Replace kickoff step 1 with:

> Read BUILD-PROMPT.md from the top through §4, then §6, §21 (Phase 0), §22, §23 and Appendix B. List the headings of every other section so you know where things are. Do not read Appendix A line by line: generate `backlog.yaml` from it with a script and spot-check ten rows. Read other sections when a work package's "Read:" line or STATUS.md points to them.

Update preface step 7 to match.

### 7. [Major] Cross-session state is saved only "before you stop"

**Where:** Kickoff steps 4 and 6; §3.1; §3.2 "Every session" step 4; Appendix B.5.

**Quote:** "Before you stop, update docs/program/STATUS.md"; "First create the programme control files (§3.1) and a written plan for Phase 0"; BACKLOG statuses "`todo`, `spec`, `in-progress`, `built`, `verified`".

**How it hits the agent:**
- Sessions end on context exhaustion, rate limits or crashes, with no "before you stop" moment. This review was itself cut off by a rate limit and resumed.
- The next session then resumes from a stale STATUS.md, with work that was neither committed nor recorded.
- The Phase 0 plan has no file to live in.
- B.5 has no field for the branch SHA, the last green run, the in-flight slice or open review findings.
- `built` and `verified` are not mapped to the Definition of Done, so different sessions will use them differently.

**Fix:**
- Add to §3.2: "**Checkpoint every slice.** Each verified slice ends with a commit that also updates STATUS.md and the backlog. Never leave verified work uncommitted. When context or time runs low, do not start a new slice."
- Put the Phase 0 plan in WORK-PACKAGES.md.
- Extend B.5 with: `Branch: wp/… @ <sha>`; `Last green: <tier> @ <sha> (evidence path)`; `In-flight slice: <id>: spec | tests | impl | verified`; `Open review findings: reviews/<file> #ids`; `Blocking decisions: DN-ids`.
- Add to §3.1: "`built` = Definition of Done items 1–9 true with evidence; `verified` = item 10 also true."

### 8. [Major] The review loop is not closed

**Where:** Continue prompt; review prompt; §3.2; §22.1 item 10; §21 work-package sizes.

**Quote:** Continue prompt: "Resume at the next step recorded in STATUS.md." Review prompt: "Read BUILD-PROMPT.md §2, §3 and §22 … Run … the performance smoke test yourself." §22.1 #10: "the reviewer session found no unresolved blocking findings."

**How it hits the agent:**
- Nothing tells the builder to read `docs/program/reviews/` and fix blocking findings, so it moves on to the next work package and DoD item 10 is never met.
- The reviewer does not read the work package's exit criteria (§21), the licence policy (§4.3) or the fitness functions (§6.8).
- "Performance smoke test" is defined nowhere.
- The reviewer is not told which branch or commit to check out, or where the run commands live.
- With work packages of up to 16 features (WP-1.13), one review per work package comes dozens of sessions after the code was written.

**Fix:**
- Continue prompt, after "Read docs/program/STATUS.md first", add: "If docs/program/reviews/ holds a report with unresolved critical or major findings, fixing them is your first task; mark each one resolved with the commit that fixes it."
- Review prompt:
  - read "§2, §3, §4.3, §6.8, §21 (this work package's exit criteria) and §22";
  - "check out the branch and commit named in STATUS.md and record the SHA";
  - "run the commands in docs/program/COMMANDS.md (`tools/ci/run merge` and the work package's performance checks)";
  - "name re-reviews `<wp-id>-r2.md`".
- Add `COMMANDS.md` to §3.1.
- Add to §3.2: "Hand over for review after each work package, after any feature with safety impact 'yes', and at least every five sessions."

### 9. [Major] "Stop and ask" never stops, and DECISIONS-NEEDED starts with about 80 unranked items

**Where:** §3.4 heading; §3.1 DECISIONS-NEEDED row; §11 introduction; §23; Appendix A.20.

**Quote:** "Stop and ask (record in `DECISIONS-NEEDED.md`, continue with other work)"; §11: "every [L] value is listed in `DECISIONS-NEEDED.md` until confirmed"; A.20: "record each in `DECISIONS-NEEDED.md` for confirmation".

**How it hits the agent:**
- On day one the file gets 19 Q-K items, 37 [L] items and 18 A.20 conflicts, plus scattered "record this" items, with no IDs, no blocking flag and no needed-by date.
- The few answers that actually gate work get buried: trunk and first commit, host prerequisites, hardware, licensed files.
- There is no rule for ending a session when everything left is blocked, so the agent keeps doing low-value work or drifts out of dependency order.

**Fix:**
- Add to §3.1:
  > DECISIONS-NEEDED.md items have IDs (DN-nnn) and the columns status (open, answered, closed), blocks (now, WP-x or later), default in use, and decider. The file opens with a "Blocking now" list of at most ten items. The 37 [L] items live in `docs/program/ASSUMPTIONS.md` and the Q-K list in `docs/program/OPEN-QUESTIONS.md`; an item moves into DECISIONS-NEEDED only when it blocks a work package.
- Add to §3.4: "End the session (after updating STATUS.md and reporting) when every remaining task in the current work package is blocked by an open DN item or a [HUMAN] gate and the next work package depends on it."

### 10. [Major] Git trunk, the first commit and the merge point are undefined

**Where:** §3.6.

**Quote:** "Trunk-based development with short-lived branches named `wp/<work-package>-<slug>`. Every commit builds and passes the fast test tier." / "Commit locally after each verified slice."

**How it hits the agent:**
- The repository has no commits, its branch is `master`, README and icon are staged, and the plan of record (including a 2.5 MB PDF) is untracked.
- The agent must guess:
  - whether the plan goes into the first commit;
  - what trunk is called;
  - whether `wp/*` merges before or after review.
- "Every commit passes the fast tier" cannot hold for the bootstrap commits.
- The reviewer cannot find unmerged work.

**Fix:** Add to §3.6:

> Trunk is `main`. If the repository has no commits, ask once in your first report. If told to proceed, rename the branch to `main` and commit the plan of record (BUILD-PROMPT.md, both blueprints, the PDF, `research/`, README, `assets/`) as `chore: import plan of record` before any build file.
>
> Work on `wp/<id>-<slug>`. Merge into `main` with `--no-ff` only after the merge tier passes and the work package's review has no unresolved critical or major findings. Until then, leave the branch for the reviewer and record it in STATUS.md.
>
> The fast-tier rule applies from the first commit that adds the build. Never rebase or amend a commit that a review report cites.

### 11. [Major] "If a test is wrong, fix it" lets the agent rewrite safety tests

**Where:** §3.5.

**Quote:** "Never weaken, skip, quarantine or delete a test to get a green build. If a test is wrong, fix it and record why in the commit message."

**How it hits the agent:** The escape hatch is unbounded. Changing an expected value, threshold, sequence count or assertion in an SI property test looks the same as "fixing a wrong test". This is the most common way an agent turns a real defect into a green run.

**Fix:** Replace the second sentence with:

> You may change a test only where it contradicts its written specification (the state-machine spec, SI text, hazard control or acceptance criterion); cite that line in the commit. Changing an expected value, threshold, sequence count or assertion in an SI property test, a scenario suite, a Tier 2 boundary test, or any test named in a hazard's `verified_by` is a stop-and-ask item: leave the test failing, mark the slice blocked and record it.

### 12. [Major] "NOT FOR CLINICAL USE" is a label, not a gate, and synthetic data can look real

**Where:** §3.3; §9 introduction; §9.10 brand master; §9.32; §11.9; §18.10; §19.4.

**Quote:** §11.9: "ship synthetic sample content flagged NOT FOR CLINICAL USE"; §9.10: "brand → clinical drug → generic and ATC → package GTINs → lot".

**How it hits the agent:**
- The agent will write realistic formularies, thresholds, order sets and brand masters.
- From memory, it will also produce plausible real GTINs, brand names and LOINC or ATC codes.
- Nothing stops a synthetic bundle being promoted to TRAIN or PROD.
- Real-looking GTINs can collide with products on hospital shelves and would match when scanned.

**Fix:** Add to §19.4:

> Every content item and fixture carries `provenance: synthetic | approved` as data. Promotion to TRAIN or PROD fails if any item is synthetic, and the Release Evidence Pack lists every synthetic item.
>
> Synthetic identifiers use reserved forms:
> - GTINs with the GS1 demonstration prefix 952;
> - MRNs and accession numbers prefixed `SYN-`;
> - drug names such as "Synthdrug A 500 mg tablet";
> - codes from `urn:hms:synthetic:*`, never real LOINC, ICD-10, ATC or SNOMED codes recalled from memory;
> - thresholds whose source is marked "synthetic", never copied from guidelines.

### 13. [Major] Image signing as specified publishes to the public Sigstore log

**Where:** §4.1 supply-chain row; WP-0.2 exit; WP-0.9; §19.1 Release; §3.4 item 6.

**Quote:** "Sigstore cosign signing with SLSA provenance"; WP-0.2: "The cell boots from signed images with one command".

**How it hits the agent:**
- cosign 2.x uploads every signature, key-based or keyless, to the public Rekor transparency log by default. cosign 3 needs a signing configuration without a log to avoid this.
- Keyless signing also needs an OIDC login, which stalls in an agent session, and it records an identity publicly.
- cosign stores signatures in an OCI registry, so an agent without a local registry may push to Docker Hub or GHCR.
- Public log entries cannot be deleted. The agent will not recognise `cosign sign --yes` as "publishing images" under §3.4.

**Fix:** Add to §4.3:

> **Dev and CI signing:**
> - use a local key pair from `cosign generate-key-pair` (git-ignored; passphrase from the environment);
> - keep images in the k3d local registry only;
> - disable transparency-log upload (cosign 2: `--tlog-upload=false`; cosign 3: a signing config with no Rekor service), and verify with the matching offline option;
> - never use keyless signing, Fulcio, the public Rekor or any public registry.
>
> Production keys and any transparency log need an ADR and a [HUMAN] decision.

### 14. [Major] No network rule, and no simulators for most external parties

**Where:** §3.4 item 6; §18.2 Integration row; §9.30; §11.6; §13.1 AU-3 and SD-7; §9.32 Support.

**Quote:** §18.2: "analyser, modality, card-terminal and printer simulators"; AU-3: "periodically anchored WORM store"; §9.32: "a public status page".

**How it hits the agent:**
- Only four simulators are named. These work packages have none:
  - WP-0.4 (federation with the hospital's identity provider);
  - WP-1.2 (ID-card and MRZ readers);
  - WP-1.9 (wallets and acquirers);
  - WP-1.10 (WhatsApp, Viber and SMS aggregators);
  - WP-1.11 (DHIS2 and the KRG return receiver).

  The agent may therefore open vendor sandbox accounts or call real APIs.
- "Anchored" invites public timestamping or blockchain anchoring. "Public status page" and the vulnerability disclosure policy (VDP) invite publishing.
- Online helpers (label renderers, OCR or translation APIs) would send data off the host.
- Downloading build dependencies is never explicitly allowed either.

**Fix:** Add a §3.7 "Network and external services":

> **Allowed:** downloading build dependencies, container images and FHIR IG packages from their official registries.
>
> **Not allowed without asking:**
> - creating any vendor or sandbox account;
> - sending any message;
> - publishing anything (images, packages, web pages, status or VDP sites);
> - anchoring hashes to public services;
> - sending any data, even synthetic, to online services (label renderers, OCR, translation, LLMs).
>
> **Simulators:** every external party gets a local simulator under `tools/simulators/<party>`, with contract fixtures:
> - the hospital's identity provider (IdP);
> - WhatsApp, Viber and SMPP;
> - wallets and acquirers;
> - ID-card and MRZ readers;
> - analysers and modalities;
> - DHIS2 and the KRG return receiver;
> - blood-bank issue notes.
>
> AU-3 anchoring means writing chain heads to the object-lock store and the DR site.

### 15. [Major] The ADR-001 rule needs an Option B nobody is told to build; effort criteria cannot be measured

**Where:** §4.2 ADR-001 and ADR-004; §18.6 C5 and C8; WP-0.6.

**Quote:**
- ADR-001 reopen trigger: "Option B (FHIR-native core) passes C2 and beats A by ≥15 weighted points".
- C5: "≤15 engineer-days".
- C8: "Add a clinical fact type end to end … ≤3 days".
- ADR-004: "tooling ≤8 engineer-weeks".

**How it hits the agent:**
- The decision rule is comparative (K §15.4's S1 compares A, B and A′), but WP-0.6 never says whether to build B. A careful agent may spend weeks building a FHIR-native core; a hurried one declares A accepted with no comparison.
- Engineer-days are a human-team measure. An agent's time is not comparable, so these numbers would be invented.
- C1 (order + CDS override + verification task + MAR schedule + charge event) needs prototypes of modules from Phases 1–3, and nothing says whether that spike code is throwaway.

**Fix:** Add to WP-0.6:

> Measure Option A only. Assess B and A′ on paper from R08 and K §7.4 ("desk assessment") unless the human asks for a prototype. For C5, C8 and ADR-004, report what you can measure (files, modules and migrations touched; agent wall-clock time) and ask the human to convert it to engineer-days. Spike code lives in `spikes/adr-001/`, is not production code, and is rebuilt from specs in Phase 1.

### 16. [Major] The licence policy rejects parts of the chosen stack, and one licence is mislabelled

**Where:** §4.1 rows "Backend language and runtime", "Health standards" and "Imaging tier"; §4.3; §3.4 item 2; WP-0.1 (ORT).

**Quote:**
- "HAPI FHIR structures and validator; HAPI HL7 v2 | Apache-2.0".
- "OpenJDK 25 LTS … | Apache-2.0; GPLv2+CE".
- "dcm4chee (MPL-1.1)".
- Allowlist: "Apache-2.0, MIT, BSD, ISC, MPL-2.0, LGPL, EPL, OFL".
- "GPL and AGPL only as unmodified, separate containers".

**How it hits the agent:**
- **HAPI HL7 v2** is dual-licensed MPL-1.1/GPL, not Apache-2.0. MPL-1.1 is not on the allowlist, and GPL linked into the monolith breaks the container rule.
- **OpenJDK** (GPLv2 with the Classpath Exception) ships inside every application image.
- **dcm4che/dcm4chee** are tri-licensed MPL-1.1/GPL/LGPL.
- **Base images** carry GPL operating-system packages.
- The WP-0.1 ORT gate will flag all of these on day one, and §3.4 item 2 turns each into a stop.
- It is also unclear whether the policy covers build-only tools (Semgrep registry rules carry use restrictions; Docker Desktop has commercial terms).

**Fix:**
- §4.1: change the HAPI cell to "HAPI HL7 v2: MPL-1.1 or GPL-2.0 (used under MPL-1.1, unmodified)".
- Add to §4.3:
  > Also allowed:
  > - GPL-2.0 WITH Classpath-exception-2.0 for the unmodified OpenJDK runtime;
  > - MPL-1.1 for unmodified libraries;
  > - the LGPL-2.1 option for tri-licensed dcm4che;
  > - operating-system packages inside base images as unmodified system components, listed in the SBOM.
  >
  > The policy governs everything shipped to a site; build- and CI-only tools are checked for use restrictions, not distribution terms. Encode all of this as ORT curations in WP-0.1.

### 17. [Major] An AI reviewer could be recorded as the "second person"

**Where:** §13.1 SD-2; preface step 5; §10.4–§10.5 (Class C rigour); §20.

**Quote:** SD-2: "two-person review, protected branches"; preface step 5: "so a second agent checks the first one's work".

**How it hits the agent:** IEC 62304-style review records and SD-2 need a human reviewer. With one builder agent and one reviewer agent, the evidence pack will show "reviewed" for Tier 1 and Tier 2 code that no person has read.

**Fix:** Add to §3.5:

> An AI reviewer session is recorded as "automated review (AI)", never as a person. SD-2 two-person review and IEC 62304 code-review records for Tier 1 and Tier 2 changes are [HUMAN]. The Release Evidence Pack lists such changes as "awaiting human code review" until a named person signs.

### 18. [Major] WP-1.1 needs licensed terminology the agent cannot obtain

**Where:** §3.4 item 5; §8.7; WP-1.1 exit; §9.32 mapping studio.

**Quote:** WP-1.1: "terminology service with LOINC, UCUM, ICD-10 and local codes"; §8.7: "LOINC (seeded via LIVD), UCUM | Free; used throughout"; §3.4 #5: "drug knowledge base, SNOMED CT, ICD-10 commercial use, ATC files … never download, scrape or ship unlicensed content".

**How it hits the agent:**
- Downloading LOINC needs an account and acceptance of its licence, which the agent cannot give on the human's behalf.
- WHO ICD-10 and ATC files need permission ([HUMAN] in §8.7).
- §3.4 item 5 omits LOINC, so the agent may try to fetch it, or write LOINC and ICD codes from memory into content, fixtures and maps. A wrong code silently maps a test to the wrong analyte.

**Fix:**
- Extend §3.4 item 5:
  > …ATC files, LOINC tables, WHO ICD-10 files. A human downloads them after accepting the licences and places them under `content/licensed/` (git-ignored). You write the loaders, checksums and tests. Until the files exist, use a synthetic code system and never write standard codes from memory.
- WP-1.1 exit: "the terminology service loads LOINC, UCUM and ICD-10 from licensed files when supplied [HUMAN]; loaders verified on synthetic files".

### 19. [Major] Unnamed components whose usual picks are now broken or denylisted

**Where:** WP-0.2 (object store, Helm charts); §13.1 DP-5 (secrets vault); ADR-008 and WP-0.4 (TPM/HSM).

**Quote:** "an S3-compatible object store with object lock"; "secrets vault, rotation, CI detection"; "keys sealed to the TPM or held in a small HSM".

**How it hits the agent:** The habitual choices now fail:
- MinIO's community edition stopped publishing images and binaries in October 2025, entered maintenance mode in December 2025, and is AGPL.
- HashiCorp Vault is under the BSL, which is denylisted.
- Bitnami withdrew its free versioned images in August–September 2025, which broke many Keycloak, Kafka, Valkey and PostgreSQL chart examples.
- A dev host has no TPM or HSM.

The agent will lose sessions to broken image pulls, or break the denylist.

**Fix:** Add to §4.1:

> - **Object store with Object Lock:** an Apache-2.0 or LGPL S3 server that implements Object Lock compliance mode, chosen by the dependency scorecard and proven by a WORM test. Not MinIO.
> - **Secrets and KMS:** OpenBao (MPL-2.0). Never HashiCorp Vault.
> - **Dev TPM:** swtpm. **Dev HSM:** SoftHSM2 over PKCS#11.
> - **Kubernetes packages:** upstream operators and charts (CloudNativePG, Strimzi, the Keycloak Operator, Temporal, OpenFGA, official Valkey images). No Bitnami images or charts.

### 20. [Major] One synchronous standby cannot give both RPO 0 and "kill a node, still writable"

**Where:** §5.1 on-site cell; §16.2; WP-0.2 exit.

**Quote:** "PostgreSQL with a synchronous standby"; "Synchronous standby inside the cell: RPO 0"; WP-0.2: "killing one node keeps PostgreSQL writable".

**How it hits the agent:**
- With a primary and one required synchronous standby, killing the standby's node blocks commits.
- The easy way to pass the exit test is to make replication asynchronous or "preferred", which silently gives up RPO 0, a safety property.
- The "two nodes plus a witness" topology has the same problem.

**Fix:** Change WP-0.2 to:

> Three CloudNativePG instances, one per node, with quorum synchronous replication (any one of the two standbys) and required durability. Exit: killing any single node (primary or standby) keeps the database writable with no committed transaction lost; losing two nodes stops writes rather than degrading to asynchronous. The two-nodes-plus-witness topology needs its own ADR that states its RPO.

### 21. [Major] WP-0.8 golden images cannot be produced for ZPL text without printers

**Where:** §4.1 document rendering and label printing; §12.8 plane A; WP-0.8; §18.9 Printing.

**Quote:** WP-0.8: "ZPL renderer per printer DPI with `^PA`/`^CI28` and `^GF` fallback; golden-image test harness … Golden images pass for a trilingual wristband, specimen label and receipt"; §4.1: "Spike S7-K decides by golden-image tests on the target printers".

**How it hits the agent:**
- `^PA` shaping happens in printer firmware, so there is no offline image of what the printer will print.
- S7-K needs physical printers, and the renderer choice depends on S7-K.
- The agent will either use an online ZPL renderer, which sends data off the host, or produce "golden images" that prove nothing about Sorani shaping on a Zebra.

**Fix:** Replace the WP-0.8 exit with:

> Golden images pass for the paths we rasterise ourselves: PDF/A pages at fixed DPI, and the ZPL `^GF` raster decoded from our own output. ZPL text-mode output is checked byte for byte against approved fixtures; its printed appearance is verified only in S7-K on physical printers [HUMAN: printers]. The S7-K kit is ready to run. The renderer choice stays accepted-provisional until S7-K. Never send label data to an online renderer.

### 22. [Major] Instruments are to be implemented "verbatim from the cited source" with no source, and some need licences

**Where:** §3.5; §9.6; §9.13; §10.4; WP-3.5.

**Quote:** "Published instruments (NEWS2, PEWS, MEOWS, Braden, Morse, the WHO Surgical Safety Checklist, I-PASS) are implemented verbatim from the cited source"; §10.4: "The PEWS and MEOWS variant used is chosen by the hospital".

**How it hits the agent:**
- No source documents are cited or present in the repository, so "verbatim" becomes "from model memory", which §3.5 itself forbids.
- The Braden Scale's owner grants use only through a licence agreement, and I-PASS materials are owned by the I-PASS Institute.
- PEWS and MEOWS exist in many variants.

**Fix:** Replace the §3.5 sentence with:

> Implement a published instrument only from a source document a human has placed in `docs/content-sources/` with its licence status recorded (the Braden Scale needs a licence agreement; check the I-PASS terms). PEWS and MEOWS are table-driven, with the hospital's chosen variant loaded as governed content [HUMAN]. Until the source is present, ship the scoring engine with a synthetic table marked NOT FOR CLINICAL USE and log a content request. Never reproduce scoring tables or bands from memory. The NEWS2 bands in §9.6 become test oracles only once the RCP source is in the repository.

### 23. [Major] The "Leapfrog harness" cannot exist as described, and a mock-KB pass grades itself

**Where:** §9.5 acceptance; §9.10 acceptance 7; §14.3; §18.5 #1; §19.4; WP-1.5; WP-3.14; Appendix A `CLN-CDS-03`.

**Quote:** §9.5: "the Leapfrog harness passes on foundation content"; §18.5: "≥60% of serious-error scenarios caught and zero interruptive alerts on the "should not alert" set"; WP-1.5: "the Leapfrog/ISMP-category harness runs on foundation content".

**How it hits the agent:**
- The Leapfrog CPOE Evaluation Tool is Leapfrog's proprietary test, given to hospitals. Its scenarios are not in the repository and cannot be reproduced.
- With a mock KB and scenarios the agent writes itself, "≥60% caught" measures the agent against itself.
- §9.5 and §9.10 say "passes"; WP-1.5 says "runs".

**Fix:**
- Rename it the "CPOE error-category harness (Leapfrog-style, unofficial)".
- Add to §18.5 #1:
  > Never report a Leapfrog result. With the mock KB, the harness checks plumbing and alert-budget accounting only; record such runs as "mock-KB run, not clinical evidence". The ≥60% threshold applies only with the licensed KB and CSO-approved scenarios [HUMAN].
- Change "passes" to "runs" in the R1 acceptance text of §9.5 and §9.10.

### 24. [Major] Phase 1 puts the Integration Hub after the work packages that need it

**Where:** §5.2 dependency rules; §21 WP-1.2, 1.4, 1.7, 1.8 and 1.12.

**Quote:**
- §5.2: "`hub` is the anti-corruption layer to every external format. No other module emits HL7 v2, FHIR, DICOM or Kurdistan formats directly."
- WP-1.2: "reversible merge with downstream propagation"; WP-1.4: "immunisation with VXU"; WP-1.7: "analyser simulator over ASTM and HL7"; WP-1.8: "MWL and MPPS against a modality simulator".
- The Hub itself is WP-1.12.

**How it hits the agent:**
- An agent working in number order reaches four work packages that need A40, VXU, ASTM/HL7 and DICOM, which only the Hub may emit.
- It will either put HL7 or DICOM code in `empi`, `lis` or `ris` (an architecture violation) or stall.
- The §21 tables have no entry criteria, although template B.4 requires them.

**Fix:**
- Add **WP-1.1b Hub core** (`INT-ENG-01` base) directly after WP-1.1: MLLP over TLS, acknowledgement state, owned dead-letter queues, ordered replay, outbound generation from domain events, and DICOM and ASTM bridge skeletons.
- WPs 1.2, 1.4, 1.7 and 1.8 then add their message types to the Hub, and WP-1.12 completes FHIR read, documents and IPS.
- Add an "Entry" column to every §21 table.

### 25. [Major] The precedence rules contradict each other and Appendix A

**Where:** §1 table and rules; Appendix A introduction; A.20.

**Quote:** §1 rank 1: "§2 of this prompt (non-negotiables)"; §1 rule: "If this prompt contradicts K or BP on product scope or safety, the blueprint wins."; Appendix A: "treat it as the source of truth for scope".

**How it hits the agent:**
- Where §2's restatement differs from K §5.1, the table says §2 wins and the rule says K wins.
- Appendix A ranks sixth ("the rest of this prompt") yet calls itself the source of truth for scope. It also deliberately moves features (for example `CLN-CDS-01` to R1), which the §1 rule would undo.
- Every scope or safety conflict the agent meets passes through this ambiguity.

**Fix:** Replace the §1 rules with:

> 1. Apply §2 and K together; where they differ, apply the stricter text and record the difference.
> 2. Appendix A is this prompt's reading of K's scope. Where it deliberately differs from K (a note, a [P] mark or an A.20 entry), follow Appendix A and keep the item open in DECISIONS-NEEDED until confirmed. Where it differs without a note, K wins; record the discrepancy.
> 3. Otherwise: K, then BP, then RL, then R01–R16.

### 26. [Minor] Undefined or colliding terms in exit criteria

**Where:** WP-0.5 exit; §17.3; Conventions block; review prompt; throughout.

**Quote:** WP-0.5: "Every G1 machine has a spec, a generated model and passing property tests".

**How it hits the agent:**
- "G1" here means K's company gate G1 (K §15.1: order, MAR, specimen, encounter, bed, result). In this prompt, though, G1 is the AI requirement "Registry of every model" (§17.3).
- [E] is used six times but is missing from the Conventions.
- These codes are used without definition: S7-K, S8-K, S9-K, S14-K, S18-K, W1-K/W2-K, DP#1, KDV-n and T-n.
- "Performance smoke test" is undefined.

**Fix:**
- WP-0.5: "Each of the six machines that company gate G1 needs (encounter, order, medication administration, specimen, result, bed)".
- Conventions: "**[E]** an estimate from K, to be measured, not a verified fact."
- Add a short "Codes from K" table:

  | Code | Meaning |
  |---|---|
  | S7-K | Printing and shaping spike |
  | S8-K | Speech partners |
  | S9-K | On-site cell spike: offline BCMA; C2 and C9 with power and WAN cuts; Kafka vs NATS |
  | S14-K | EMPI gold set |
  | S18-K | Talent survey |
  | W1-K / W2-K | The two wedges |
  | DP#1 | Design partner #1 |
  | T-n | n days before go-live (K §13, §15.4) |

### 27. [Minor] The hazard-log gate has no state for planned controls

**Where:** §10.1 CI gate; WP-0.1; WP-0.9 exit.

**Quote:** "promotion is blocked while any control lacks a passing verification test"; WP-0.1: "hazard log seeded with H1–H15 and one entry per SI-01…SI-21".

**How it hits the agent:** In Phase 0 almost every seeded control is unbuilt. The gate is therefore either permanently red, or the agent marks controls as implemented to turn it green.

**Fix:** Add to §10.1: "Controls carry `state: planned | implemented | verified`. The promotion gate covers the controls whose features are in the release being promoted; seeded controls start as `planned`. Never change a state to make a gate pass."

### 28. [Minor] "Executable" state-machine specs have prose guards

**Where:** §8.4; Appendix B.3; WP-0.5.

**Quote:** "Write each machine as an executable YAML spec … and generate property-test models from it"; B.3: `guard: "active verified order AND wristband scan matches (2 identifiers) AND …"`.

**How it hits the agent:** Prose cannot be executed or turned into tests, so each session will invent its own guard language.

**Fix:** Add to §8.4: "Guards are lists of named predicates (`guard: [activeVerifiedOrder, wristbandTwoIdsMatch, productScanMatches, highAlertDoubleCheckRecorded]`). Each predicate is implemented once in the module's domain package and unit-tested; prose goes in `description`. The generator fails on an unknown predicate."

### 29. [Minor] The "newest GA" rule conflicts with the listed versions and would force a PostgreSQL .0 upgrade

**Where:** §4.1 preamble and table.

**Quote:** "Resolve every component to its newest generally available release that meets the minimum below"; "PostgreSQL 18 (17 minimum)"; "JUnit 5".

**How it hits the agent:**
- JUnit 6.0 went GA on 30 September 2025, so "JUnit 5" contradicts the rule.
- PostgreSQL 19 RC1 shipped on 15 October 2026, with GA planned for 19 November 2026. A literal reading switches the database to a brand-new major release partway through Phase 0, possibly before jOOQ, Flyway and CloudNativePG support it.

**Fix:**
- Replace the preamble rule with: "Pin the newest GA release that has had at least one patch release and is supported by the components that depend on it. Record the set in ADR-002. Re-resolve only at phase boundaries, through the dependency scorecard."
- Replace "JUnit 5" with "JUnit (current major)".

### 30. [Minor] Later sessions never re-read the conventions or the "cannot do" list

**Where:** Continue prompt; §3.2 step 1; the Conventions block and "What an AI agent cannot do" (both above §0).

**Quote:** "then BUILD-PROMPT.md §0–§3".

**How it hits the agent:** The definitions of [P], [L] and [HUMAN], and the list of things the agent must never pretend to do, sit above §0. They are outside what every later session reads.

**Fix:** Move "Conventions used in this prompt" and the "What an AI agent cannot do" paragraph into §0. Alternatively, change both reading instructions to "from the top of BUILD-PROMPT.md through §3".

### 31. [Minor] The kickoff names a file that does not exist yet

**Where:** Preface "How to run it" step 1; kickoff step 1; §6.1.

**Quote:** "Keep this file in the repository root, next to the blueprints."; "Read BUILD-PROMPT.md completely."

**How it hits the agent:** The draft is `BUILD-PROMPT.assembled.md` in a temp folder. If it is copied under that name, the kickoff fails at step 1, or the agent reads an older copy.

**Fix:** Preface step 1: "Save this file as `BUILD-PROMPT.md` in the repository root (the README already links to that name)."

---

## Checked and found sound (no action)

- The "Read:" pointers resolve to existing sections in R03, R08, R11, R15 and R16.
- K Part 0 and §1, which the kickoff cites, exist.
- Jazzer is Apache-2.0 again, so the test-tooling row is fine.

## Sources for the external facts above

- HAPI HL7 v2 licence (dual MPL-1.1/GPL): [Maven Central, ca.uhn.hapi](https://central.sonatype.com/artifact/ca.uhn.hapi/hapi); [mvnrepository, ca.uhn.hapi 2.6.0](https://mvnrepository.com/artifact/ca.uhn.hapi/hapi/2.6.0/changes)
- cosign uploads to Rekor by default: [Sigstore blog, Cosign 2.0 released](https://blog.sigstore.dev/cosign-2-0-released/)
- Bitnami catalogue change: [Docker blog](https://www.docker.com/blog/broadcoms-new-bitnami-restrictions-migrate-easily-with-docker/); [GitLab chart issue](https://gitlab.com/gitlab-org/charts/gitlab/-/issues/6089)
- MinIO community edition: [linuxiac](https://linuxiac.com/minio-ends-active-development/); [ayedo](https://ayedo.de/en/posts/minio-im-maintenance-mode/)
- PostgreSQL 19 RC1 and planned GA: [postgresql.org news](https://www.postgresql.org/about/news/postgresql-19-rc-1-released-3409/)
- JUnit 6.0.0: [release notes](https://docs.junit.org/6.0.0/release-notes/)
- Braden Scale licensing: [bradenscale.com](https://bradenscale.com/)
- Jazzer licence: [Code Intelligence blog](https://code-intelligence.com/blog/jazzer-back-to-open-source)
