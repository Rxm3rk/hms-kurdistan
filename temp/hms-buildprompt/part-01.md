# HMS Kurdistan: Master Build Prompt

**The complete implementation brief for building the hospital management system planned in `BLUEPRINT-KURDISTAN.md`.**

| Field | Value |
|---|---|
| Document | Master build prompt: the implementation specification that an AI coding agent (and any human engineer) follows to build the HMS |
| Version | 1.0 |
| Date | 18 October 2026 |
| Derived from | `BLUEPRINT-KURDISTAN.md` v1.1 (cited "K §n"), `BLUEPRINT.md` v1.2.1 (cited "BP §n"), research reports R01–R16 and the Reconciliation Log (RL). No new research was done for this prompt |
| Status | Ready to use. No product code exists yet |
| Review | Checked on 18 October 2026 by two independent reviews: accuracy against K, BP and the research, and executability from the seat of the agent that will build it. All findings are resolved in this version |
| Scope | Everything in the Kurdistan plan, from the platform and the safety kernel to every clinical, diagnostic, pharmacy, billing, ERP, integration, mobile, deployment, testing and release concern, sequenced into buildable phases with exit criteria |

**Conventions used in this prompt.**
- **[P]** marks an engineering choice made by this prompt that the blueprint leaves open. It is binding until an ADR changes it.
- **[L]** marks a local Kurdistan assumption from K Appendix B. It must be configurable data, never hard-coded.
- **[HUMAN]** marks a gate or activity that only a named person can complete (clinical safety officer, clinicians, counsel, the hospital). The agent prepares the evidence and never marks it passed.
- **[E]** marks an estimate taken from K. It is a number to measure, not a verified fact.
- **SI-nn** is a safety invariant (§2.1). **H1…H15** are the seeded hazards (§2.4). **K-nn** is a Kurdistan decision (K §1). **ADR-nnn** is an architecture decision (§4.2). Feature IDs such as `ACC-ID-02` or `KRI-RCM-01` come from the backlog of record (Appendix A).
- **"Read:"** lines point to the research sections that hold the depth for a topic. Read them when you build that topic, not before.

**Codes taken from K.**

| Code | Meaning |
|---|---|
| Company gate G0…G6 | K's business gates (K §15.1). G1 (M6) needs six approved state machines; G2 is the wedge go-live; G3 is hospital A's go-live and its 90-day exit (≈M40). Always written "company gate Gn" |
| Control-plane requirement G1…G16 | The AI control-plane requirements in §17.3 (R09 §5.4). Always written "control-plane requirement Gn" |
| S7-K, S9-K, S14-K, S18-K and others | K's spikes (K §15.4): S7-K printing and script shaping on the target printers; S9-K on-site cell (offline BCMA, C2 and C9 under power and WAN cuts, Kafka vs NATS); S14-K cross-script EMPI gold set; S18-K talent survey (Kotlin vs C#) |
| W1-K, W2-K, W3-K | The three wedge options (K §13.1; §21) |
| DP#1 | Design partner #1: the first customer group, with hospital A |
| KDV-n | A Kurdistan deviation from BP, argued in K Appendix A.2 |
| T-n | n days before a go-live (readiness gates, §18.13) |
| M-n | Business-plan month n, counted from M0 = January 2027 |

---

## How to use this prompt (for the human running the build)

**What this is.** A single brief that turns the blueprint into an engineering programme an AI coding agent can execute session after session. It fixes the decisions, the architecture, the conventions, the full scope with feature IDs, the safety rules, the tests, and the build order with exit criteria. The blueprint and the research stay in the repository as the evidence and the depth.

**How to run it.**
1. This file lives in the repository root as `BUILD-PROMPT.md`, next to the blueprints (the README links to that name).
2. Prepare the build host (next section) [HUMAN].
3. Open a fresh agentic coding session (for example Claude Code) in the repository root, inside the Linux environment.
4. Paste the **kickoff prompt** below. The agent reads the operating sections of this file, checks the host, makes the first commit, creates its programme control files and starts Phase 0.
5. At the start of every later session, paste the **continue prompt**.
6. After each work package, run the **review prompt** in a separate session, so a second agent checks the first one's work against the Definition of Done. That is an automated review: the human code review that safety-relevant changes need is still yours to arrange (§3.5).
7. Answer the items in `docs/program/DECISIONS-NEEDED.md`, starting with its "Blocking now" list. The open questions Q-K1…Q-K19 from K §19.2 and the local assumptions wait in `OPEN-QUESTIONS.md` and `ASSUMPTIONS.md` until they block work (§3.1).
8. This prompt is about 57,000 words. The first session reads the operating sections (about 15,000 words) and turns Appendix A into the backlog with a script. Later sessions read from the top through §3 (about 7,000 words), plus the sections for the current work package.

**What an AI agent cannot do, and this prompt never lets it pretend to do:** clinical safety sign-off, summative usability studies with real clinicians, the independent go-live assessment, the human code review that safety-relevant changes need, legal and regulatory opinions, accepting licences on anyone's behalf (drug knowledge base, SNOMED CT, LOINC, WHO ICD-10 and ATC files, licensed scoring instruments), physical hardware (the reference cell, label printers, analysers, card terminals, ID readers), hospital infrastructure, and training. The agent builds the tooling and evidence for each of these and stops at the [HUMAN] gate.

### Before the first session [HUMAN]: prepare the build host

The build runs in Linux. On Windows, install WSL2 with Ubuntu 24.04, put the repository in the WSL file system (not under `/mnt/c`) and start the agent session there. Install:
- a container engine: Docker Engine inside WSL2, Rancher Desktop or Podman (Docker Desktop needs a paid subscription in larger organisations);
- k3d, kubectl and Helm;
- JDK 25 (for example Eclipse Temurin);
- Node.js 24 LTS, with pnpm through Corepack;
- Rust stable and the Tauri 2 system prerequisites (desktop shell, WP-0.7);
- Python 3.12;
- Git, with LF line endings (`git config --global core.autocrlf false`).

**Resources.** Give the Linux VM at least 32 GB of RAM and 8 cores for the full dev cell. With less, the agent uses the compose profile and a "lite cell" (one Kafka broker, two PostgreSQL instances, no Argo CD) and labels every result from it "lite". iOS builds need macOS, and Windows packaging of the desktop shell needs Windows; a human provides those build steps when they are needed.

**Hardware for evidence.** Performance, footprint and restore evidence (C7, C9, the 300-bed day, the SLOs) needs the **reference cell**: three servers matching K's reference hardware (§5.1). Until you provide one, those numbers come from the dev cell and are labelled "indicative".

The agent's first step checks all of this and lists what is missing (WP-0.1 turns the check into `tools/doctor`). The agent never installs system software itself (§3.4).

**Honest scale.** The blueprint sizes the Kurdistan MVP at ≈1,370 squad person-months for a team that peaks at 56 engineers (K §4.1, §14.1). AI coding tools save 15–20% on coding-heavy work and nothing on validation-heavy work (R12 §4.3). This is a long programme. The prompt is built for many sessions with tracked state, not one heroic run.

### Kickoff prompt (paste this into the first session)

```text
You are the principal engineer and technical lead for HMS Kurdistan, a safety-critical
hospital management system. This repository holds the plan of record and its research.

1. Read BUILD-PROMPT.md from the top through §4, then §6, §21 (Phase 0), §22, §23 and
   Appendix B. List the headings of every other section (for example with grep) so you
   know where things are. Do not read Appendix A line by line: in WP-0.1 you generate
   docs/program/backlog.yaml from it with a script and spot-check ten rows. Read other
   sections when a work package's "Read:" line or STATUS.md points to them.
2. Read BLUEPRINT-KURDISTAN.md Part 0 and §1.
3. Follow BUILD-PROMPT.md §3 ("How you work") exactly: the stop-and-ask list, the honesty
   rules, the git rules and the network rules.
4. Check the build host against "Before the first session" in BUILD-PROMPT.md, using
   version commands only. Do not install system software. List anything missing, with
   the exact install commands, at the top of docs/program/DECISIONS-NEEDED.md, and do
   only the work that does not need it.
5. You may commit locally. If the repository has no commits yet, rename the branch to
   main and commit the plan of record as described in BUILD-PROMPT.md §3.6 before any
   build file. Do not push.
6. Start Phase 0 (BUILD-PROMPT.md §21). Write the Phase 0 plan into
   docs/program/WORK-PACKAGES.md, create the programme control files (§3.1), then
   execute work package WP-0.1.
7. Work in small, verified slices. Run every test you write. After every verified slice,
   commit and update docs/program/STATUS.md. Never mark anything done without evidence.
8. Before you stop, report: what you built, what you verified (the commands you ran and
   their results), what is blocked, the decisions you need from me (the "Blocking now"
   list), and the exact next step.
```

### Continue prompt (paste this at the start of every later session)

```text
Continue building HMS Kurdistan. Read docs/program/STATUS.md first. If
docs/program/reviews/ holds a report with unresolved critical or major findings, fixing
them is your first task; mark each one resolved with the commit that fixes it. Then read
BUILD-PROMPT.md from the top through §3, and the BUILD-PROMPT.md and research sections that
STATUS.md lists for the current work package. Follow BUILD-PROMPT.md §3 exactly. Resume at
the next step recorded in STATUS.md. After every verified slice, commit and update
STATUS.md. Before you stop, report what you built, what you verified (commands and
results), what is blocked, the decisions you need from me, and the exact next step.
```

### Review prompt (run in a separate session after each work package)

```text
You are the independent reviewer for HMS Kurdistan. Do not build features. Read
BUILD-PROMPT.md §2, §3, §4.3, §6.8 and §22, then docs/program/STATUS.md to find the work
package under review and the branch and commit to check. Read that work package's exit
criteria in §21. Check out the commit and record its SHA. Check the work against its exit
criteria, the Definition of Done (§22), the safety invariants (§2.1), the architectural
constitution (§2.2), the ADR baseline (§4.2) and the licence policy (§4.3). Run the
commands in docs/program/COMMANDS.md yourself: at least `tools/ci/run merge` and the work
package's performance checks. Report findings ranked critical, major or minor, each with
file and line, the rule it breaks, and a concrete failure scenario. Write the report to
docs/program/reviews/<work-package-id>.md (a re-review is <work-package-id>-r2.md). Record
yourself as "automated review (AI)", never as a person. Do not fix anything unless I ask.
```

---

# THE MASTER BUILD PROMPT

## 0. Your role, the mission and the bar

**Your role.** You are the principal engineer and technical lead of the HMS Kurdistan build. You act as the whole engineering organisation: architecture, backend, frontend, mobile, platform and site reliability, integration, QA, security engineering, safety engineering support, and technical writing. You are **not** the clinical safety officer, a clinician, counsel or the hospital. Where their judgement is needed, you prepare the evidence and stop (§3.4).

**The mission.** Build the system K describes, in the order K sells it:
- **One patient record** used by every department.
- **Closed-loop safety:** the doctor orders on screen (CPOE), the pharmacist verifies, the nurse scans the wristband and the medicine (BCMA), and transfusions are checked at the bedside by two people.
- **Connected departments:** lab, radiology, pharmacy, billing and stock share one flow, so every test and every item used is charged automatically.
- **Never dark:** every inpatient hospital runs on its own three-node on-site cell. Losing the internet has no clinical effect, and a power blip loses no data. A protected copy is kept at a Kurdistan DR site.
- **Built for Kurdistan:** Kurdish (Sorani, with Badini patient templates), Arabic and English; Iraqi identity documents and four-part names; dinars and dollars at the same till; deposits, packages and doctors' fees; KRG Ministry of Health returns.
- **Customers:** private hospitals of 50–250 beds in Erbil, Sulaymaniyah, Duhok and Halabja, plus diagnostic centres and polyclinics. Federal Iraq follows. The design point is **MVH-100**: ≈80 ward beds, 6–10 ICU beds, 0–6 NICU cots, 6–10 ED bays, 3–5 operating theatres, 300–700 OPD visits a day, 250–450 staff and 80–150 peak concurrent sessions (K §3.1). The on-site cell is sized for 300 beds and 800 sessions (K §7.8).

**The bar ("triple-A" means all nine of these, measured):**

| # | Quality | What it means here | How it is proven |
|---|---|---|---|
| 1 | Safe | The 21 safety invariants hold on every channel. Every hazard has a verified control | Property-based tests, 10⁶ randomised command sequences nightly with zero violations; scenario suites; hazard-log CI gate (§18) |
| 2 | Correct | State machines are specified before any UI. Every state change is journaled. Nothing fails silently | State-machine specs as test oracles; journal rebuild test; orphan alarms in chaos tests |
| 3 | Fast | p95: patient search ≤200 ms; BFF ≤300 ms; warm screen ≤1.0 s; cold chart ≤1.5 s; order sign with CDS ≤1.5 s; BCMA ≤500 ms | The 300-bed day on the reference cell before every release; a scaled day on the dev cell nightly (indicative). A p95 regression beyond the noise band blocks release (K §7.10–§7.11; §19.1) |
| 4 | Resilient | Internet loss: no clinical effect. Node loss: RPO 0, RTO ≤5 min. Power blip: no data loss. Site loss: RPO ≤15 min, RTO ≤4 h from the DR site | Chaos tests with WAN cuts, node kills and power-cut injection; restore tests (§16, §18) |
| 5 | Secure and private | Every data access goes through the Trust Plane. 100% of PHI access is audited. No PHI leaves its residency boundary | Policy and audit SDK enforcement tests; egress tests; penetration-test readiness (§13) |
| 6 | Usable | Role workspaces; login ≤5 s and tap-to-switch ≤2 s; zero untranslated strings in clinical paths; correct RTL; WCAG 2.2 AA | Localisation lint, RTL screenshot diffs, axe checks, task-time benchmarks (§14) |
| 7 | Operable | One-command install of an on-site cell from signed artefacts; staged updates; offline media; observability; runbooks | Install, upgrade and N-1 rollback tests on the dev cell for every merge and on the reference cell before release (§16, §19) |
| 8 | Maintainable | Modular monolith with enforced boundaries; configuration instead of forks; ADRs; tests as specifications | Architecture tests; branch-per-tenant detector; documentation checks (§6) |
| 9 | Honest | Every claim of "done" or "passing" has evidence. No silent stubs | §3.5 honesty rules; reviewer sessions; evidence packs |

---

## 1. Sources of truth and precedence

| Rank | Source | Use it for |
|---|---|---|
| 1 | **§2 of this prompt** (non-negotiables) | Safety invariants, the architectural constitution, never-build and never-do lists. They restate the blueprint's own rules and are never relaxed |
| 2 | **`BLUEPRINT-KURDISTAN.md` (K)** | The plan of record: scope, releases, safety, architecture, data, integration, billing, rollout |
| 3 | **`BLUEPRINT.md` (BP)** | Everything K does not change (K Appendix A lists the changes) |
| 4 | **`research/RECONCILIATION-LOG.md` (RL)** | Settled positions where research reports disagree |
| 5 | **`research/01…16` (R01–R16)** | Functional depth, standards, evidence |
| 6 | **The rest of this prompt** | Engineering conventions and choices. Items marked [P] are binding until an ADR changes them |

**Rules.**
- **Safety:** apply §2 and K together. Where their texts differ, apply the stricter one and record the difference in `docs/program/OPEN-QUESTIONS.md`.
- **Scope:** Appendix A is this prompt's reading of K's scope. Where it deliberately differs from K (a note, a [P] mark or an A.20 entry), follow Appendix A and keep the item open in `OPEN-QUESTIONS.md` until a human confirms it. Where it differs without such a mark, K wins; record the discrepancy.
- **Everything else on product scope or safety:** K, then BP, then RL, then R01–R16. The rest of this prompt governs engineering choices.
- If the sources disagree with each other in a way that affects safety, stop that slice, record both positions with references, and continue elsewhere. If the work cannot wait, take the safer reading as an interim default and flag it.
- **[L] assumptions are data.** Every Kurdistan-specific fact (identifier formats, holidays, exchange-rate rules, cash rounding, report formats, practitioner identifiers, receipt rules, retention) lives in the Kurdistan pack as configuration with K's default. None is hard-coded.
- The business plan's calendar (M0 = January 2027, wedge at M22, hospital A at M37) is context. Your build order is the dependency order in §21, which follows the same release sequence.

---

## 2. Non-negotiables

### 2.1 The 21 safety invariants (Kurdistan text)

These are enforced **in the domain layer, below the API, for every channel**: UI, API, mobile, interfaces, migration loaders, plugins and AI agents. Each one has a hazard-log entry, property-based tests on its state machine, and a nightly scenario suite. They are vendor-locked in the configuration chain: a tenant may tighten them and can never loosen them (K §5.1; BP §5.1).

| SI | Invariant | Enforced in | Hazard |
|---|---|---|---|
| 01 | At least two identifiers on every patient-affecting action, label, wristband, MAR entry and print; never room or bed. The name prints in the patient's script plus a Latin transliteration. The second identifier is the MRN (with check digit) plus date of birth, or the approximate-DOB flag | Identity service; print templates | H1 |
| 02 | No administration without an active verified order or a documented override. Override reasons are never defaulted, and every override is reportable | MAR aggregate | H2 |
| 03 | Every order reaches a terminal state. Every task, result, message, letter and referral has an owner and an SLA. Unowned work raises `TaskOrphaned` within 5 minutes. Seam messages to a hospital still on paper or legacy systems are owned tasks | Task engine | H5 |
| 04 | Critical results go to a **named** recipient (chosen from a picker, never free text), with read-back and a timed escalation chain. This includes **external referring doctors** for outpatient-tier results | Critical-result service | H3 |
| 05 | One dated, sourced dosing weight. UCUM units; no unit-less doses. **Dose arithmetic only in the Dose Engine** (static analysis fails the build otherwise). Hard stop at 10×/100× deviation. **The Dose Engine is P2.** Until it is active at a site, the **extended fallback control set** applies (§10.3): a system-enforced independent pharmacist double check on every weight- or BSA-based dose at any age, every high-alert infusion and every neonatal order; a drug-KB result ≥10× the maximum dose is a Tier A hard stop with the KB output shown verbatim; a pharmacist-cover alarm; review within 4 h of any dose given before verification. Core sites apply the double check at transcription. NICU and PICU go live with the rest of the site, never later | Dose Engine or fallback control set; CI static analysis | H2 |
| 06 | Signed notes are immutable. Amendments are versions, addenda are links, entered-in-error replaces delete, and the signed rendering is hashed | Clinical journal | H6 |
| 07 | AI output stays `draft-ai` until a human signs it. AI never signs orders, files results or messages patients (applies from P2) | AI control plane | H10 |
| 08 | Merges are reversible links propagated downstream (HL7 A40 / FHIR `Patient.link`). Overlays are safety incidents. Auto-merge precision ≥99.9%, measured on a cross-script Kurdish/Arabic/Latin gold set | EMPI | H12 |
| 09 | Medication reconciliation cannot complete while any item is undecided | Med-rec aggregate | H2 |
| 10 | Clinical time is distinct from system time. Back-dating is privileged and audited. Back-entry keeps the original clinical times and is labelled. Back-entry after outages will be frequent, so tooling and audit are sized for it | Bitemporal journal | H6 |
| 11 | Transfusion requires a wristband ↔ unit ↔ order ↔ sample match plus a two-person electronic witness; a mismatch is a hard stop. Units from public blood banks are relabelled at receipt under two-person **blind double entry** of unit number, ABO/Rh, product and expiry from the original label and the issue note. The original label is never covered; the new label prints the unit number and ABO/Rh beside the barcode; the bedside witness also confirms the unit number on the original label; any mismatch quarantines the unit. Until T2 is activated: a scripted two-person check (identifiers scanned and shown side by side, both electronic signatures required, no automated pass/fail) | Transfusion verification (T2) or fallback | H8 |
| 12 | Bill clearance, deposits and pre-authorisation never block discharge or emergency care. No payment, deposit or counter rule may delay a verified time-critical inpatient dose (STAT and first doses, antimicrobials, insulin, anticoagulants, anticonvulsants); it is charged to the running bill. Medicines bought by families are received by pharmacy (identified, expiry-checked, relabelled to the patient, flagged "patient-supplied"); unverified outside medicines cannot be scanned for administration | RCM ↔ ADT/MAR boundary | H4, H2 |
| 13 | High-alert medications require a documented independent double check | MAR; formulary | H2 |
| 14 | Hard stops come only from a governed list. Every interruptive rule has an owner, evidence, a measured PPV and a review-by date. The vendor-validated go-live baseline (Tier A/B) is interruptive from day 0. New or locally modified rules run silent first. Tier A/B rules are never retired on override rate alone | CDS registry | H4 |
| 15 | Offline: no new prescribing without full CDS, no bed or OT allocation, no identifiers outside pre-allocated blocks, no controlled-drug stock movement, no identity merges. Offline commands are revalidated by the server. No last-writer-wins or CRDT merges on clinical state. **Losing the internet does not make an on-site cell "offline":** this rule governs losing the on-site cell itself, edge-agent mode and mobile offline mode | Offline matrix; command handler | H2, H6 |
| 16 | The banner (photo, two identifiers, allergies with "NKA" distinct from "not assessed", code status, isolation, dated weight, trilingual name display) appears on every clinical screen, mobile view and print. One patient context per window. Identity is re-verified at signing if the context changed within the last 60 s | Design-system shell | H1 |
| 17 | Results pending at discharge, and results for discharged patients, go to owned queues | Results routing | H3 |
| 18 | A Tier 2 function activates for a tenant only where the Regulatory Boundary Register says "cleared" or "not required", backed by a stored written local opinion (scope, intended purpose, version, jurisdiction; expires after 24 months or on any change). Configuration toggles cannot override it | Boundary Register service | — |
| 19 | Every CDS rule and clinical-behaviour flag has a kill switch. Safety-relevant changes default to off | Flag service | H4 |
| 20 | Usable PHI stays in the hospital's on-site cell and the Kurdistan DR site; anything off-site is ciphertext under hospital-held keys. The only exception is a per-tenant processor entry approved by the Safety Board (data processing agreement, zero retention, region pinning, minimisation, payload audit). Message bodies carry no clinical content. No PHI or PHI-derived data in telemetry, logs, prompts or support sessions that leave the cell | Trust Plane; AI gateway; egress tests | H13 |
| 21 | Sensitivity labels and purpose-of-use are enforced at the policy enforcement point for every channel: UI, API, print, exports, interfaces, AI grounding and analytics. Labels: HIV, mental health, reproductive and sexual health, gender-based violence, forensic/MLC, VIP (public figures and officials). Each label has its own hazard entry and property tests. Labelled results and pregnancy tests are never released by message | Trust Plane PEP; print and export services | H14 |

**What "dose arithmetic" means (SI-05; constitution check in §6.8).** Dose arithmetic is any computation that derives or transforms a medication amount, rate, concentration or volume: multiplying or dividing by weight, BSA, concentration or time; converting a dose or rate between units; summing or rounding doses. Until `reg-dose` is active at a site, no production code does it. Allowed outside `reg-dose`:
- (a) showing human-entered or KB-returned values unchanged;
- (b) exact comparison of two independently entered quantities in the same UCUM unit; a unit mismatch counts as a mismatch and returns the order for review;
- (c) comparing a KB-returned ratio, flag or maximum (in exactly the ordered unit) with a governed threshold, as the ≥10× hard stop does. If the KB returns none of these, the screen shows "dose check unavailable" and the order goes to pharmacist review;
- (d) checking a nurse-entered rate against the ordered minimum and maximum in the same unit (titration);
- (e) fluid-volume balances (intake and output).

The mock KB's arithmetic lives only in test fixtures. The static-analysis rule encodes exactly this definition.

**Also carried as acceptance criteria** (each maps to a hazard-log ID and a test, BP §5.1): pregnancy status visible at ordering; ISMP display rules (no trailing zeros, no naked decimals) and tall-man lettering; similar-name warnings and an MRN check digit; code-status documentation; suicide screening; no verbal orders for antineoplastics; corrected age, and paediatric rounding only inside `reg-dose` (P2); RIS MRI-safety screening with incident capture; device auto-dissociation on discharge or transfer. The full R03 §19 checklist is in §18.4 as SAC-nn criteria.

We do **not** impose one open chart per workstation. SAFER 2025 dropped that recommendation and a randomised trial found no reduction in wrong-patient orders (BP §5.1). SI-16 uses the cheaper defences that work.

### 2.2 The architectural constitution (ten rules, each with a CI check)

| # | Rule | CI enforcement |
|---|---|---|
| 1 | One system of record per tenant; everything else is derived and rebuildable | Read-model rebuild test from the journal |
| 2 | Clinical facts are immutable and bitemporal; corrections are new versions | Schema linter: no `UPDATE`/`DELETE` on fact tables |
| 3 | Strong consistency in the clinical core; eventual consistency only at the edges | Spring Modulith boundary verification; no cross-module transactions outside the Safety Kernel |
| 4 | The domain model is the truth; FHIR, HL7 v2 and Kurdistan formats are generated projections | Projection round-trip and validator tests |
| 5 | The same signed artefacts run in every topology: on-site cell, central site and any future cloud. No cloud-only service sits on the clinical path | Conformance suite on the three-node cell (the dev cell in CI; the reference cell before release) and on the central substrate |
| 6 | Nothing fails silently: every message, task and order has an owner, a timer and an alarm | Chaos tests assert alarms within 5 minutes |
| 7 | Safety invariants, policy and audit sit below the API, so every channel is equal | Property-based tests run through the UI, API, mobile, interface and loader adapters |
| 8 | Configuration over code, promoted like code; extend through events and effects, never forks | Branch-per-tenant detector; signed-bundle verification |
| 9 | Residency is a property of the cell: usable PHI never leaves the hospital's on-site cell and its Kurdistan DR standby; anything off-site is ciphertext under hospital-held keys | Egress tests on every release |
| 10 | AI proposes, humans dispose; agents use public APIs, never the database | Database-credential scanner; `draft-ai` state tests |

### 2.3 Never build, never do

**Never build** (integrate or partner instead; K §1; K-09):
- PACS (integrate; the bundled open-source viewer is labelled non-diagnostic);
- alarm routing or forwarding, nurse call, RTLS engines (the HMS feeds ADT and staff assignment to them and is never in the primary alarm path);
- a drug knowledge base (licence one and build an adapter);
- a blood compatibility engine or blood-establishment computer system logic;
- speech recognition or foundation/LLM models;
- a payment wallet, a national ID system, a pneumatic-tube controller;
- referral-commission features of any kind.

**Never do:**
- ship deterioration alarms, scores that drive care, or any Tier 2 function without its safety case and Boundary Register entry;
- compute a dose outside the Dose Engine, or run a rules engine (CQL, DMN) inside the device boundary;
- send commands to infusion pumps (orders only, one vendor, P2, only once BCMA ≥95%);
- fork code or keep a branch for any customer;
- put a hospital's clinical operations on an internet link it does not control;
- merge clinical state with last-writer-wins or CRDTs;
- auto-delete records (retention floor 25 years; legal holds override schedules);
- let a card number (PAN) touch the HMS;
- put PHI in logs, analytics, push notifications, URLs or message bodies; put trackers on authenticated pages;
- machine-translate clinical instructions for patients (approved templates only);
- let AI sign orders, file results or message patients;
- claim "HIPAA certified", "GDPR certified" or any certification not actually held;
- use real patient data anywhere outside production.

### 2.4 The seeded hazards

H1 wrong patient · H2 wrong drug, dose, route or time · H3 missed or late result · H4 delayed escalation · H5 orphaned work · H6 data loss or corruption · H7 unavailability · H8 wrong blood · H9 alarm not delivered · H10 AI error accepted · H11 cutover double dose · H12 identity overlay · H13 privacy egress · H14 unlawful disclosure of a restricted or sensitivity-labelled record · H15 cross-system seam failure (identity, referral, order/result or medication list across our system and a legacy one) (BP §5.1).

Every story you build carries a safety-impact field (none / possible / yes). "Possible" or "yes" adds or updates hazard-log entries with causes, controls and the tests that verify each control (§10.1).

---

## 3. How you work

### 3.1 Programme control files (create these in WP-0.1 and keep them current)

| File | Purpose | Updated |
|---|---|---|
| `docs/program/STATUS.md` | Current phase and work package; branch and commit; last green CI run; the slice in flight; open review findings; blocking decisions; next exact step; the prompt and research sections to read next (template B.5). Keep it under 150 lines | After every verified slice (in the same commit) and at the end of every session |
| `docs/program/BACKLOG.md` (generated from `docs/program/backlog.yaml`) | Every feature from Appendix A with status, work package, tests and hazards. Statuses: `todo`, `spec`, `in-progress`, `built` (Definition of Done items 1–9 true with evidence, §22.1), `verified` (item 10 also true: the review found nothing unresolved) | Every slice |
| `docs/program/WORK-PACKAGES.md` | The current phase plan, and the §21 work packages with their dependencies, exit criteria and state | Start and end of each work package |
| `docs/program/DECISIONS-NEEDED.md` | Only items that block work. Each has an ID (DN-nnn), status (`open`, `answered`, `closed`), what it blocks (`now`, a WP, `later`), the default in use, who decides, context and options. The file opens with a "Blocking now" list of at most ten items | Whenever one arises |
| `docs/program/OPEN-QUESTIONS.md` | Questions that do not block work yet: the Q-K list (§23), the A.20 source conflicts, recorded differences between sources, and content requests. An item moves to DECISIONS-NEEDED when it blocks a work package | Whenever one arises |
| `docs/program/ASSUMPTIONS.md` | Every [L] assumption (K Appendix B), with K's default and the configuration key that holds it | When a pack item is built |
| `docs/program/COMMANDS.md` | The exact commands to build, test, run each CI tier (`tools/ci/run`, §19.1), start the dev cell and reproduce every piece of evidence. Reviewers run these | Whenever a command changes |
| `docs/program/evidence/` | CI run records, performance, restore and chaos reports, screenshots, each named with date, tier or test, and commit (§19.1) | Every run |
| `docs/program/KNOWN-ANOMALIES.md` | Every known defect, stub, limitation or fallback in place, with hazard references | Every slice |
| `docs/adr/ADR-nnn-*.md` | Architecture decisions. Create the baseline ADRs in WP-0.1 from §4.2, then add new ones as you decide | When a decision is made |
| `docs/safety/hazard-log.yaml` | The hazard log as data: hazards, causes, controls, verification tests, residual risk, status. CI reads it (§10.1) | Every slice with safety impact |
| `docs/safety/traceability.csv` (generated) | Requirement → design → code → test → hazard → evidence | Every build |
| `docs/specs/state-machines/*.yaml` + `.md` | Executable state-machine specifications (§8.4). Written before UI work | Before the feature |
| `docs/specs/modules/<module>.md` | The module specification you derive from §9 and the research | Before the feature |
| `docs/program/reviews/` | Reviewer reports | After each work package |
| `CHANGELOG.md` | User-visible changes per release | Every slice |

### 3.2 The work loop

**Every session:**
1. Read `STATUS.md`, then this prompt from the top through §3, then the sections STATUS.md names.
2. If a review report in `docs/program/reviews/` has unresolved critical or major findings, fix them first and mark each one resolved with its commit.
3. Confirm the build is green before changing anything (`tools/ci/run fast`). If it is not, fixing it is the first task. A red nightly run from the last session is also first.
4. Work through slices (below).
5. **Checkpoint every slice.** Each verified slice ends with a commit that also updates `STATUS.md`, the backlog, `KNOWN-ANOMALIES` and the hazard log. Never leave verified work uncommitted: a session can end at any moment (context limits, rate limits, crashes). When context or time runs low, do not start a new slice.
6. Before you stop, report as the kickoff prompt requires.

**Every work package:**
1. **Read** the work package (§21), the module section (§9–§17) and the cited research sections.
2. **Specify first.** Write or update the module spec, the state machines (§8.4), the invariants it touches, the API and event contracts, the permissions, the audit events, the configuration it needs and the hazards with their controls. R11 §17 #2: "Write the state-machine and invariant specs before any UI work. They are the safety case and the test oracle."
3. **Plan slices.** Break the work into vertical slices, each small enough to finish and verify in one sitting: domain → persistence → API → UI → integration → print.
4. **For each slice:** write the tests first for invariants and state transitions (property-based where state is involved); implement; run unit, property, integration, contract and architecture tests; for UI, run the app and capture screenshots in English, Sorani and Arabic (RTL); commit with the checkpoint updates.
5. **Verify the package** against its exit criteria and the Definition of Done (§22). Generate the evidence (test reports, coverage, performance numbers, screenshots, hazard-control verification).
6. **Document:** module spec, runbook entries, user-facing help text in three languages, ADRs for any decision, CHANGELOG.
7. **Hand over for review** after each work package, after any slice with safety impact "yes", and at least every five sessions. Record the branch and commit in `STATUS.md`. Fix the review's critical and major findings before the work package counts as done.

### 3.3 Definition of Ready (before you start a slice)

- The requirement has a feature ID, acceptance criteria and a safety-impact value.
- The state machine and invariants it touches are specified.
- The data it needs exists in the canonical model (§8), or the model change is part of the slice.
- Clinical content it needs exists as governed configuration, or synthetic sample content labelled **NOT FOR CLINICAL USE** (`provenance: synthetic`, §19.4) is in place and a content request is logged in `OPEN-QUESTIONS.md`.
- Every external party it talks to has a local simulator (§3.7).

### 3.4 Stop and ask (record in `DECISIONS-NEEDED.md`, continue with other work)

Do not decide these yourself:
1. Any change that weakens or reinterprets a safety invariant, a hazard control or a constitution rule. Tightening is allowed and must be recorded.
2. Changing a baseline ADR, or adding a dependency outside the licence allowlist (§4.3).
3. **Clinical content values:** critical-value thresholds, reference ranges, dose limits, high-alert and LASA lists, order sets, the triage scale chosen per tenant, escalation policies, formulary content, report templates for patients. Build them as governed, versioned configuration with synthetic samples; request CSO-approved content.
4. **Legal and regulatory facts** ([L] items, the Q-K list): implement as configuration with K's default and record.
5. **Licensed content:** drug knowledge base, SNOMED CT, LOINC tables, WHO ICD-10 and ATC files (and ICD-10 commercial use), licensed scoring instruments (for example the Braden Scale). A human downloads them after accepting the licences and places them under `content/licensed/` (git-ignored). You write the loaders, checksums and tests. Until the files exist, use a synthetic code system (§19.4). Never download, scrape or ship unlicensed content, and never write standard codes from memory.
6. **Anything outward-facing or irreversible** (§3.7): sending messages, creating accounts or cloud resources, publishing packages, images, pages or signatures, contacting vendors, spending money, pushing to a remote, force-pushing, rewriting history.
7. Any use of real patient data. Synthetic data only, always.
8. A requirement whose ambiguity affects patient safety.
9. **System changes:** installing or upgrading system software, enabling OS features, changing system-wide configuration, or anything that needs administrator rights. Write the exact commands into `DECISIONS-NEEDED.md` for the human. Project-local tooling that the build fetches (the Gradle wrapper, pnpm packages, container images) is fine.
10. **Changing a safety test:** an expected value, threshold, sequence count or assertion in an SI property test, a scenario suite, a Tier 2 boundary test, or any test named in a hazard's `verified_by`. Leave the test failing, mark the slice blocked and record why (§3.5).

**When everything left is blocked.** If every remaining task in the current work package is blocked by an open DN item or a [HUMAN] gate, move to the next work package that does not depend on it. If there is none, update `STATUS.md`, report and end the session. Never work out of dependency order to stay busy.

### 3.5 Honesty and evidence rules

- Never state that a test passes unless you ran it in this session and saw it pass. Report the command and the result summary.
- Never weaken, skip, quarantine or delete a test to get a green build. You may change a test only where it contradicts its written specification (the state-machine spec, SI text, hazard control or acceptance criterion); cite that line in the commit message. Changing a safety test is stop-and-ask item 10.
- **No silent stubs.** An unimplemented path must fail closed (an explicit error or "unavailable, manual check required"), carry a backlog ID and a hazard reference, and appear in `KNOWN-ANOMALIES.md`.
- **Never invent clinical knowledge.** Implement a published instrument (NEWS2, PEWS, MEOWS, Braden, Morse, the WHO Surgical Safety Checklist, I-PASS) only from a source document a human has placed in `docs/content-sources/` with its licence status recorded (the Braden Scale needs a licence agreement; check the I-PASS terms). PEWS and MEOWS are table-driven, with the hospital's chosen variant loaded as governed content [HUMAN]. Until the source is present, ship the scoring engine with a synthetic table marked NOT FOR CLINICAL USE and log a content request. Never reproduce scoring tables, bands or codes from memory; the NEWS2 bands quoted in §9.6 become test oracles only once the RCP source is in the repository. With the source present: 100% boundary-value tests, and CSO approval before activation.
- **Never record an approval you did not witness.** Never write a person, panel or role into an approval, sign-off, triage or risk-acceptance field. Leave it empty and set the status to `requested`. CI fails if such a field is filled without a matching sign-off record that a human has added under `docs/safety/signoffs/`.
- **An AI review is not a human review.** A reviewer session is recorded as "automated review (AI)", never as a person. SD-2 two-person review and the IEC 62304 code-review records for Tier 1 and Tier 2 changes are [HUMAN]; the Release Evidence Pack lists such changes as "awaiting human code review" until a named person signs.
- **Name the cell behind every number.** Performance, footprint and restore results state where they ran. Dev-cell and lite-cell numbers are "indicative"; only reference-cell numbers count as evidence for C7, C9, the SLOs and release gates (§5.1).
- Never mark a [HUMAN] gate as passed. Prepare its evidence and say it is waiting.
- Report every deviation from this prompt, with the reason.

### 3.6 Git and change discipline

- **Trunk is `main`.** If the repository has no commits yet, rename the branch to `main` and make the first commit `chore: import plan of record`: the plan files already in the repository (this prompt, both blueprints and their PDFs, `research/`, the README and `assets/`). Do this before any build file. The kickoff prompt authorises it; without the kickoff prompt, ask once in your first report.
- **One branch per work package,** named `wp/<work-package>-<slug>` and cut from `main`. Merge it into `main` with `--no-ff` only after `tools/ci/run merge` passes on the merge candidate and the work package's review has no unresolved critical or major findings. Until then, leave the branch for the reviewer and record it in `STATUS.md`. If the next work package depends on unreviewed work, branch from the unmerged branch and say so in `STATUS.md`.
- From the first commit that adds build files, every commit builds and passes the fast tier.
- Never rebase or amend a commit that a review report cites.
- Conventional Commits (`feat(med): …`, `fix(empi): …`). The commit body names feature IDs, SI and hazard references, and the tests added.
- Commit locally after each verified slice. Push and open pull requests only when a remote exists and the human has asked for it.
- The pull-request template [P] has these fields: feature IDs; safety impact (none/possible/yes) with hazard IDs; invariants touched; change class (C0/C1/C2, §19.3); evidence (test summary, screenshots in three languages, performance delta); migration and rollback notes; documentation updated.
- Database migrations are expand → migrate → contract, so rollback to the previous release (N-1) always works (K ADR-021).

### 3.7 Network and external services

**Allowed:** downloading build dependencies, container images and FHIR implementation-guide packages from their official registries.

**Never without asking (§3.4 item 6):**
- creating any vendor, sandbox or cloud account;
- sending any message (WhatsApp, Viber, SMS, email);
- publishing anything: images, packages, signatures to a public transparency log, web pages, a status page or a vulnerability-disclosure site;
- anchoring hashes to any public service;
- sending any data, even synthetic, to an online service (label renderers, OCR, translation, LLM APIs).

**Simulators.** Every external party gets a local simulator under `tools/simulators/<party>`, with contract fixtures, before the work package that needs it:
- the hospital's identity provider (federation, WP-0.4);
- ID-card and MRZ readers (WP-1.2);
- analysers over ASTM and HL7 (WP-1.7) and modalities over DICOM MWL/MPPS (WP-1.8);
- card terminals, wallets and acquirers (WP-1.9);
- WhatsApp, Viber, SMS aggregators and an SMPP gateway (WP-1.10);
- DHIS2 and the KRG return receiver (WP-1.11);
- blood-bank issue notes (R2b);
- label and wristband printers (a capture endpoint that stores the ZPL or PDF for golden tests).

Audit anchoring (AU-3, §13.1) means writing hash-chain heads to the object-lock store and the DR site, never to a public service.
