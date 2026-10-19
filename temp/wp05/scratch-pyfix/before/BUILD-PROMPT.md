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

---

## 4. Fixed technical decisions

### 4.1 Technology stack

Pin each component to the newest generally available release that has had at least one patch release, is supported by the components that depend on it, and meets the minimum below. Pin it in the Gradle version catalogue, the pnpm lockfile and the Helm charts, and record the pinned set in ADR-002 and the SBOM. Re-resolve versions only at phase boundaries, through the dependency scorecard (§4.3).

| Layer | Choice | Licence | Source |
|---|---|---|---|
| Backend language and runtime | Kotlin 2.x on OpenJDK 25 LTS (21 minimum) | Apache-2.0; GPLv2+CE | K ADR-002. C#/.NET is the recorded near-tie; switching needs an ADR backed by the S18-K talent survey |
| Backend framework | Spring Boot (current GA line) with **Spring Modulith** for module boundaries, events and verification | Apache-2.0 | K §7.6 |
| Build | Gradle (Kotlin DSL), version catalogue, convention plugins in `build-logic/` | Apache-2.0 | [P] |
| Database | PostgreSQL 18 (17 minimum) on CloudNativePG, one database per tenant; on site, three instances with quorum synchronous replication (§5.1) | PostgreSQL | K §7.6; [P] quorum |
| SQL access and migrations | jOOQ open-source edition (type-safe SQL, works naturally with exclusion constraints and range types); Flyway community edition | Apache-2.0 | [P] |
| Event backbone | Kafka 4.x in KRaft mode via Strimzi (three small brokers on the three cell nodes); Debezium outbox CDC; CloudEvents 1.0 envelopes; Apicurio schema registry. **Fallback:** NATS JetStream everywhere if the on-site footprint test (C9) fails | Apache-2.0 | K ADR-009 |
| Workflow | Temporal on PostgreSQL persistence, used only behind a `WorkflowPort` interface | MIT | K ADR-010 |
| Identity and authorisation | Keycloak (OIDC, WebAuthn/passkeys, federation to the hospital IdP); OpenFGA (relationship-based checks such as care relationships), both wrapped by the Trust Plane SDK | Apache-2.0 | ADR-013 |
| Cache | Valkey, cache only, never a system of record | BSD-3 | K §7.6 |
| Search | PostgreSQL full-text search plus `pg_trgm`, with Kurdish/Arabic normalisation functions | PostgreSQL | K ADR-028 |
| Health standards | HAPI FHIR structures and validator; HAPI HL7 v2 | HAPI FHIR: Apache-2.0. HAPI HL7 v2: MPL-1.1 or GPL-2.0 (dual licence), used unmodified under MPL-1.1 | K §7.6 |
| Terminology | A terminology service on HAPI for ICD-10, LOINC, UCUM, ATC and local codes; Snowstorm only centrally and only if a SNOMED CT licence is taken | Apache-2.0 | K ADR-015 |
| Web client | React with strict TypeScript and **React Aria Components**; Vite; TanStack Router and TanStack Query; FormatJS (ICU MessageFormat); Zod for runtime validation | MIT/Apache-2.0 | K §7.6 (React, React Aria); [P] for the rest |
| Desktop shell | Tauri 2 with a hardware abstraction layer (HAL) for printers, scanners, badge and ID-card readers, MRZ readers and card terminals | MIT/Apache-2.0 | ADR-019 |
| Mobile | React Native (New Architecture) with Expo; encrypted SQLite (SQLCipher) for the offline store; MDM-managed devices | MIT/BSD | ADR-019; [P] for SQLCipher |
| Document rendering | HTML templates → PDF/A through a renderer with HarfBuzz-grade text shaping for Sorani and Arabic. Candidates: a WeasyPrint container (BSD) or headless Chromium. Spike S7-K decides by golden-image tests on the target printers | — | [P]; K §6.7 |
| Label and token printing | ZPL rendered server-side per printer DPI; `^PA` shaping with `^CI28` UTF-8 on Zebra firmware V60.14/V50.14 or later; `^GF` raster fallback; ESC/POS for token printers | — | K §6.7, §9.2; R16 §9.1 |
| Fonts | OFL-licensed fonts covering every Sorani letter (پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە), for example Noto Sans Arabic / Noto Naskh Arabic or Vazirmatn; glyph coverage tested in CI | OFL-1.1 | [P]; K §6.7 |
| On-site substrate | k3s or RKE2 on three nodes; Helm; Argo CD in pull mode; OpenTelemetry collector exporting PHI-free telemetry to the central site | Apache-2.0 | K §7.6 |
| Kubernetes packaging | Upstream operators and charts: CloudNativePG, Strimzi, the Keycloak Operator, the Temporal and OpenFGA charts, official Valkey images. No Bitnami images or charts (Bitnami's free versioned images were withdrawn in 2025) | Apache-2.0; MIT; BSD | [P] |
| Object storage | An S3-compatible server under Apache-2.0 or LGPL that implements Object Lock in compliance mode, chosen through the dependency scorecard and proven by a WORM test (an object cannot be deleted or its retention shortened before expiry). Not MinIO (AGPL, and its community edition no longer ships maintained builds) | Apache-2.0 or LGPL | [P]; K §7.8 |
| Secrets and keys | OpenBao for secrets and the KMS; never HashiCorp Vault (BSL, denylisted). Development stand-ins: swtpm for the TPM and SoftHSM2 over PKCS#11 for the HSM | MPL-2.0; BSD | [P]; ADR-008 |
| Central site | Kubernetes in Kurdistan colocation; Prometheus; Grafana and Loki (AGPL) only centrally, unmodified, never shipped on site; OpenSearch only for central log search | Apache-2.0; AGPL (central only) | K §7.6; BP §7.7 |
| Infrastructure as code | OpenTofu | MPL-2.0 | BP §7.7 |
| Central analytics | Apache Iceberg, Trino, dbt Core, SQL-on-FHIR (P2: OMOP) | Apache-2.0 | K §7.6 |
| Imaging tier (integrated, not built) | dcm4chee (MPL-1.1) or an unmodified Orthanc container (GPLv3/AGPL with a source offer); OHIF viewer (MIT), labelled non-diagnostic | — | K §7.6 |
| Test tooling | JUnit (current major); Kotest (including property-based testing); Testcontainers; ArchUnit plus Spring Modulith verification; Playwright (web end-to-end and visual diffs); Maestro (mobile flows); Gatling (load); Chaos Mesh and Toxiproxy (chaos); axe-core (accessibility); Jazzer (fuzzing parsers); PIT (mutation testing on Tier 2 modules) | Apache/MIT/MPL/EPL | [P] |
| Quality and supply-chain tooling | detekt, ktlint, ESLint, Prettier; Semgrep CE; gitleaks; Trivy and OSV-Scanner; CycloneDX SBOMs; Sigstore cosign signing with SLSA provenance (local keys and no public transparency log in dev and CI, §4.3); OSS Review Toolkit (ORT) for licence compliance | Apache/MIT/LGPL | [P]; BP §7.7 |

**Locales [P]:** `en` (English), `ckb` (Central Kurdish / Sorani, Arabic script, RTL), `ar` (Arabic, RTL) for the UI; `ku-Arab` (Badini/Kurmanji in Arabic script) for patient-facing templates only; `ku-Latn` only if Q-K17 says Latin-script Kurmanji output is needed. Default time zone `Asia/Baghdad`, configurable per tenant.

### 4.2 ADR baseline

Create one file per ADR in `docs/adr/` during WP-0.1, with status, context, decision, consequences, the fitness test that guards it and its reopen trigger. "Baseline" means accepted for the build; ADR-001 and ADR-009 stay "accepted-provisional" until their spike criteria pass on the reference cell (WP-0.6).

| ADR | Decision | Guarded by | Reopen if |
|---|---|---|---|
| 001 | **Core data, Option A:** our own FHIR-shaped domain model on PostgreSQL, one database per tenant, HAPI libraries for structures and validation. Stable facts (Observation, Condition, AllergyIntolerance, QuestionnaireResponse) are stored FHIR-shaped so their projection is near-identity; translation is concentrated where FHIR is weakest (workflow states such as the verification queue). A repository/port abstraction stays whatever the outcome | Spike harness C1–C9 (§18.6) | Option B (FHIR-native core) passes C2 and beats A by ≥15 weighted points; or C2 fails for both, in which case stop and redesign the order/MAR boundary. If C9 fails for Option A, apply the ADR-009 (NATS JetStream) and ADR-010 (lighter workflow persistence) fallbacks and re-run C9 before any reopen (K §7.4) |
| 002 | **Runtime:** Kotlin on the JVM, Spring Boot plus Spring Modulith | Build | S18-K shows only .NET can be staffed |
| 003 | **Modular monolith plus satellites.** Orders, Medications (including the MAR), Results and Tasks share one transactional boundary (the Safety Kernel). RCM, the Integration Hub, the document renderer, the AI gateway (P2) and analytics are satellites (BP §7.2). Tier 2 modules are separate processes | Modulith verification; ArchUnit | Boundary violations rise for two consecutive sprints |
| 004 | **Event model:** event-sourcing-lite, with the bitemporal journal as the transactional outbox. Full event sourcing for MedicationOrder/MedicationAdministration only if the spike shows BCMA p95 ≤500 ms, order-sign ≤1.5 s, tooling ≤8 engineer-weeks and no critical-path cost | Spike S2; performance suite | Tooling >8 engineer-weeks; BCMA p95 >500 ms; upcasting >20% of medication capacity; any C1 miss |
| 005 | **Canonical Model Versioning and a projection compiler:** FHIR R4 (4.0.1) now; R5 only via backports (Subscriptions); R6 as a second projection when a partner or market needs it, with no storage migration. Bounded FHIR writes (Appointment, QuestionnaireResponse, DocumentReference, device/patient Observation, Consent, Task) become domain commands. Finance, supply and formulary stay internal aggregates because those resources leave R6 core | Projection round-trip tests; FHIR validator | A partner or market mandates R6 |
| 006 | **Tenancy:** tenant = the contracting enterprise. A single hospital runs on its own on-site cell. A group is one tenant on a primary cell; other hospitals join over dual metro links with a site edge agent only if 60 days of measured availability show ≥99.95% (including an exam-shutdown window, unless the links are private circuits), retested yearly; otherwise each hospital gets its own cell and tenant. Outpatient facilities use the pooled tier at the central site with `FORCE ROW LEVEL SECURITY` and no `BYPASSRLS` roles | RLS tests; tenancy tests | A group needs one record across sites whose links fail the test |
| 007 | **On-site hospital cells,** a Kurdistan central and DR site, and a PHI-free control plane. Substrate portability (k3s/RKE2 on site; Kubernetes centrally) proven in CI | Conformance suite on both substrates | — |
| 008 | **Keys:** per-tenant envelope keys with crypto-shredding; on site, keys sealed to the TPM or held in a small HSM, escrowed at the DR site under dual control; off-site copies encrypted under hospital-held keys | Key-rotation and shredding tests | A Kurdistan rule changes key custody |
| 009 | **Messaging:** journal-as-outbox, one event backbone everywhere: Kafka KRaft by default, NATS JetStream if C9 fails. Events keyed by patient. No hidden dead-letter topics | C9 footprint test; ordering tests | C9 fails on reference hardware |
| 010 | **Workflow:** Temporal behind `WorkflowPort` for long-running processes (discharge, pre-approval, claims, migration, cutover). Never order or MAR state, never sub-second decisions. Fork-readiness plan under ADR-022 | ArchUnit: no Temporal types outside the adapter | C9 fails (first apply the fallback: lighter workflow persistence behind the same `WorkflowPort`, then re-run C9), or the upstream licence or steward changes |
| 011 | **Edge planes:** A = workstation shell HAL; B = the on-site cell for hospitals, or a hardened site edge agent for outpatient sites; C = central adapters. Each integration lives in the lowest plane that meets its downtime need | Downtime matrix tests | — |
| 012 | **Offline and downtime safety matrix** in the hazard log (SI-15). "Offline" means losing the on-site cell (rare), losing the central site for pooled-tier sites, or mobile offline. Internet loss alone is not an offline state for a hospital | Offline conflict suite (S9-K) | S9-K finds an uncovered conflict class |
| 013 | **Trust Plane:** Keycloak + OpenFGA; mandatory Policy and Audit SDKs for all data access | ArchUnit: no repository access without the SDK | — |
| 014 | **Native Integration Hub** owns every interface | Channel tests; zero-silent-drop chaos test | — |
| 015 | **Terminology:** WHO ICD-10 (commercial-use permission needed), LOINC (seeded via LIVD), UCUM, ATC (WHOCC file licence), the regional drug master and local codes. SNOMED CT only if licensed (Q-K9); until then the free SNOMED Global Patient Set where useful. On-site cells receive terminology and drug-KB snapshots | Terminology conformance tests | SNOMED licence taken |
| 016 | **Regulated-module segregation:** Tier 2 functions run as separately versioned, process-isolated sidecars on the same node; the Boundary Register is the only activation switch; one Dose Engine | Static analysis (no dose arithmetic elsewhere); sidecar contract tests | — |
| 017 | **CDS:** a drug-KB adapter; DMN decision tables for non-device rules on an Apache-2.0 engine (Apache KIE/Drools DMN is the candidate, confirmed by the dependency scorecard); native deterministic Tier 2 calculators; CQL from P2 for measures, KPIs and non-device third-party CDS only. **No rules engine inside the device boundary** | ArchUnit; Tier 2 boundary-value tests | A change to the device boundary agreed through the Safety Board |
| 018 | **AI gateway and control plane (P2):** counsel-approved region pinning, zero retention, PHI minimisation, version pinning, kill switch, `draft-ai` state; an on-site small-model option evaluated; no model touches the database | DB-credential scanner; `draft-ai` tests | — |
| 019 | **Clients:** React/TypeScript with one design system; Tauri 2 shell with the HAL; React Native mobile | — | — |
| 020 | **Configuration and content as code:** signed bundles promoted BUILD → TEST → TRAIN → PROD; three-way merges; no customer branches | Signed-bundle verification; branch detector | — |
| 021 | **Delivery:** weekly continuous delivery to the central site; a **monthly on-site release train ("N")** with C2 regulated changes quarterly; cells pull signed releases over an outbound channel in staged rings (reference cell ≥7 days → a non-flagship site ≥14 days → all sites; DP#1 is never first); a site may defer one train for a go-live, a mass-casualty event or a shutdown; migrations always roll back to N-1; signed offline media with pinned keys and anti-rollback; maximum drift N-1; licences, certificates and updates tolerate ≥90 days without call-home, with no lockout | Upgrade/rollback tests; drift telemetry | Any cell beyond N-1 for >45 days |
| 022 | **Licence and dependency governance** (§4.3) | ORT licence scan in CI | Upstream licence change |
| 023 | **Data platform:** reporting replica (≤60 s) and read models on site; encrypted CDC bronze landing centrally in the MVP; silver layer, OMOP and SQL-on-FHIR in P2 | Freshness tests | — |
| 024 | **Care-team assignment** uses ES-lite and is a core domain that feeds nurse call | Event tests | — |
| 025 | **The single-hospital edge cell is the default.** The multi-site edge cell (several cells writing for one tenant) is P3, after a dedicated reconciliation hazard analysis | — | A group contract needs it |
| 026 | **Power:** separate UPS feeds per node with ≥60 minutes runtime and generator auto-start; crash-safe storage (synchronous commit, power-loss-protected drives); graceful shutdown below 10 minutes of UPS; mains, generator and UPS status monitored as building signals; clients autosave drafts and re-authenticate fast after a blip; GPS or stratum-1 NTP per cell; clock skew >1 s between nodes alarms; a node more than 5 s out is blocked from clinical writes | Power-cut chaos tests; clock-skew tests | Any data loss from power; any clinical write with skew >5 s |
| 027 | **Fleet operations:** outbound-only management channel; local break-glass for field engineers during internet cuts (on-site co-sign by the hospital IT lead or CSO, single-use sealed credentials rotated after use, operations plane only, recorded session the customer reviews within 5 working days); spare parts and remote hands per governorate; hardware only from the Kurdistan Supported Hardware List | Break-glass tests | Any cell down >4 h awaiting hardware |
| 028 | **Search:** PostgreSQL full-text and trigram indexes in the product (patient search p95 ≤200 ms); OpenSearch only for central logs and analytics | Search performance test | Patient search p95 >200 ms on the reference cell |

### 4.3 Licence and dependency policy

- **Allowlist:** Apache-2.0, MIT, BSD, ISC, MPL-2.0, LGPL, EPL, OFL (fonts). Also allowed, unmodified and recorded in the licence register:
  - MPL-1.1 libraries (for example HAPI HL7 v2, used under its MPL-1.1 option);
  - the LGPL-2.1 option of tri-licensed dcm4che and dcm4chee;
  - GPL-2.0 with the Classpath exception for the OpenJDK runtime;
  - operating-system packages inside base images, as unmodified system components listed in the SBOM.
- **Scope:** the policy governs everything shipped to a site. Build- and CI-only tools are checked for use restrictions (for example Semgrep registry rule terms or Docker Desktop's subscription terms), not distribution terms. Encode all of this as ORT curations and a policy file in WP-0.1.
- **GPL and AGPL** only as unmodified, separate containers with a source offer. Every Kurdistan hospital is an on-site install, and on-site installs count as distribution, so this rule is checked on every release (K §7.6).
- **Denylist:** BSL, SSPL, competing-use clauses, AI-ingestion clauses, "functional source" licences. Excluded by name: Camunda 8.6+, Redpanda, Mirth Connect ≥4.6, Liquibase under FSL, any cloud-only FHIR service, Medplum components inside the product (BP §7.7).
- **Dependency scorecard** for every runtime dependency: steward, funding, release cadence, bus factor, licence history. Critical-path dependencies with a single corporate steward (Temporal) are wrapped behind ports with a fork-readiness note.
- **SOUP list:** every third-party component used by Tier 1 or Tier 2 code is recorded with version, purpose, known anomalies and the verification that covers it (IEC 62304 practice, §20).
- **Signing in development and CI:** a local key pair from `cosign generate-key-pair` (git-ignored; passphrase from the environment); images stay in the dev cell's local registry; transparency-log upload is disabled (`--tlog-upload=false` in cosign 2, or a signing configuration without a Rekor service in cosign 3) and verification uses the matching offline option. Never keyless signing, Fulcio, the public Rekor log or a public registry. Production keys and any transparency log need an ADR and a [HUMAN] decision.

---

## 5. System architecture

### 5.1 Deployment topologies

| Topology | What runs there | Phase |
|---|---|---|
| **On-site hospital cell** | Three nodes (or two plus a witness) on separate UPS feeds. The full tenant: the modular monolith and its satellites (RCM, document renderer, analytics); PostgreSQL as three instances with quorum synchronous replication (a commit waits for any one of the two standbys and never degrades to asynchronous; a two-node-plus-witness cell needs its own ADR stating its RPO); the event backbone; Temporal; Keycloak; OpenFGA; the Integration Hub; print, queue and device bridges; the reporting replica; Tier 2 sidecars; local terminology and drug-KB snapshots. An on-site immutable backup target (object-lock NAS) in a separate fire compartment or building. Outbound-only management. Co-signed local break-glass (ADR-027) | MVP |
| **Kurdistan central and DR site** | Colocation in Erbil or Sulaymaniyah, with its own DR in the other city. The PHI-free control plane (signed releases, configuration bundles, licences, PHI-free telemetry); the **pooled tier** for outpatient facilities (database per tenant, FORCE RLS); an encrypted **warm standby of every hospital cell** (async, RPO ≤15 min while replication is up); continuity instances; central terminology and analytics; the CI reference cell | MVP |
| **Site edge agent** | For outpatient-tier sites on the pooled tier, and for a group's outpatient site attached to the group's hospital cell over metro links (DP#1's polyclinic on hospital A's cell, K §7.8): a hardened appliance outside the facility's Windows domain with a continuity replica, queue state, print spool and device bridge | MVP |
| **Continuity instance** | A read-only shadow per hospital at the DR site, with identity independent of the hospital's IdP, used when the hospital's own estate is compromised | MVP |
| **Regional cloud (optional)** | Ciphertext backups under hospital-held keys and PHI-free services only, after a counsel opinion (Q-K2) | P2 |
| **Multi-site edge cell** | Several cells writing for one group tenant | P3 |

**Reference hardware per hospital [E]:** three servers (16–32 cores, 128–256 GB RAM, NVMe with power-loss protection), a pair of 10 GbE switches, an object-lock NAS, two online double-conversion UPS units with ≥60 minutes runtime, rack and environmental monitoring. The **reference cell** for C7, C9, the 300-bed day and the SLOs is three servers of 32 cores, 128 GB and NVMe each, provided by a human [HUMAN] (K §7.4, §7.8).

**Development profile [P]:** a `docker compose` stack for fast inner-loop work, and the **dev cell**: a three-node `k3d` cluster on the build host that mirrors the on-site cell for integration and chaos tests. Both use the production container images; the dev cell also uses the production Helm charts. On a host with less than 32 GB of RAM, a **lite cell** (one Kafka broker, two PostgreSQL instances, no Argo CD) replaces the dev cell.

**Which cell a number comes from.** Every performance, footprint or restore result names its cell. Dev-cell numbers are "indicative" and lite-cell numbers "lite"; only reference-cell numbers count as evidence for C7, C9, the SLOs and release gates.

### 5.2 Bounded contexts and the module map

The context map is BP §7.4, unchanged for Kurdistan except that the revenue context gains dual-currency cash handling and the doctor-fee ledger (K §7.3). Each module below is a Spring Modulith application module (or a separate process where marked).

| Group | Module | Owns | May call synchronously |
|---|---|---|---|
| **Trust Plane** | `trust-identity` | Users, sessions, authenticators, badge and PIN, device registrations | — |
| | `trust-policy` | Roles, ABAC attributes, care relationships (OpenFGA), consent, sensitivity labels, purpose-of-use, break-the-glass | `trust-identity` |
| | `trust-audit` | BALP AuditEvents in a hash-chained WORM store; SIEM stream; access reports | — |
| | `trust-keys` | Envelope keys, crypto-shredding, escrow, egress policy | — |
| **Platform** | `platform-tenancy` | Enterprise structure, configuration chain, locks | Trust |
| | `platform-journal` | Bitemporal journal, outbox, domain-event publication, as-was queries | — |
| | `platform-config` | Signed bundles, promotion, feature flags and kill switches | Trust |
| | `platform-i18n` | Locales, catalogues, transliteration, name normalisation, calendars and holidays, digit policy | — |
| | `platform-tasks` *(Safety Kernel)* | Tasks, owned queues, pools, SLA timers, escalation chains, `TaskOrphaned` | Trust, journal |
| | `platform-docs` (+ renderer satellite) | Document templates, PDF/A, FHIR documents, labels, wristbands, print jobs, watermarking | Trust, i18n |
| | `platform-forms` | Versioned forms and assessments (QuestionnaireResponse-shaped facts) | Trust, journal |
| | `platform-notify` | PHI-free notifications, in-app inbox | Trust |
| | `platform-files` | Binary objects and document references in object-lock storage | Trust, keys |
| | `platform-workflow` | `WorkflowPort` and the Temporal adapter | — |
| | `platform-site` | Power and building signals, time sync status, downtime number blocks, backup orchestration, fleet agent | — |
| **Patient access and flow** | `empi` | Patients, identifiers, names, links and merges, matching, steward queue | Trust, i18n |
| | `scheduling` | Resources, slots, appointments, OPD tokens and queues, referrals intake | `empi`, tasks |
| | `adt` | Encounters, episodes, location history, beds, census, leave, transfers, discharge | `empi`, tasks |
| **Safety Kernel** (one transactional boundary, Tier 1) | `orders` | Orders and order sets, CPOE, order lifecycle, verbal-order read-back and co-sign | kernel, `cds` |
| | `medications` | Formulary, regional brand master, verification, dispensing (IP and OP), transcription control set, eMAR, BCMA, med rec, controlled drugs, patient-supplied medicines | kernel, `cds`, Tier 2 |
| | `results` | Result filing, acknowledgement, critical-result service, amended-result notices, pending-at-discharge routing | kernel |
| **Regulated modules** (Tier 2, separate processes, own release train) | `reg-ews` | NEWS2, PEWS, MEOWS from nurse-validated observations; escalation-task requests | pure function |
| | `reg-transfusion` | Bedside transfusion verification (T2) | pure function |
| | `reg-screening` | Presentation and local tiering of drug-KB screening results | pure function |
| | `reg-lis-rules` | LIS autoverification and interpretive rules | pure function |
| | `reg-dose` (P2) | The Dose Engine | pure function |
| **Clinical record** | `record` | Problems, allergies, observations, notes and signatures, immunisations, code status, documents | Trust, journal, tasks |
| | `nursing` | Assessments, flowsheets, I&O, care plans, worklists, brain-sheet, handover | `record`, kernel |
| | `ed` · `periop` · `icu` · `maternity` | Specialty workflows (§9) | `record`, kernel, `adt` |
| **Diagnostics** | `lis` | Accessioning, specimens, worklists, analyser results, QC, validation, lab-quality pack, send-outs | kernel |
| | `ris` | Imaging orders, protocoling, scheduling, MWL/MPPS, reports, PACS links, MRI safety | kernel |
| | `transfusion` | T1 workflow, blood-unit receipt and relabelling, issue, reactions, haemovigilance | kernel, `reg-transfusion` |
| **Knowledge** | `cds` | Alert registry, drug-KB adapter, non-device rule execution, tiers, silent mode, kill switches, PPV tracking | `terminology` |
| | `terminology` | Code systems, value sets, maps, licence entitlements | — |
| | `content` | Kurdistan foundation content and pack bundles | `platform-config` |
| | `safety-registry` | Hazard log service and Regulatory Boundary Register (TRU-REG-02) | — |
| **Revenue and ERP** | `rcm` *(satellite, ADR-003: its own deployable and schema on every cell)* | Accounts, ledger, charge router, tariffs, packages, deposits, estimates, cashiering, dual currency, discounts, refunds, doctor-fee ledger, credit contracts, pre-approvals, claims, statements | Trust (SDK); its own journal and outbox from the platform libraries |
| | `supply` | Item master, stores, lots, FEFO, indents, ward stock, consumption-to-charge, procurement-lite, consignment | Trust |
| | `finance-export` *(runs in the RCM satellite)* | AP/AR, daily summarised GL journals with drill-back; lite GL in P2 | `rcm` in-process; `supply` through its public API and events |
| | `workforce` | Staff master, typed practitioner identifiers, credentials, privileges; rostering in P2 | Trust |
| **Governance** | `him` | Legal health record, deficiencies, release of information, coding (R2.1) | `record` |
| | `statutory` | MLC, narcotics, births, deaths, notifiable diseases; KRG returns; DHIS2 export | kernel (read) |
| | `quality` | Incidents and RCA, accreditation-pack engine, safety dashboard | — |
| | `migration` | Migration Workbench, Legacy Data Viewer | via public APIs only |
| **Edges** (satellites) | `hub` | HL7 v2 engine, FHIR façade, DICOM, analyser bridges, Kurdistan pack adapters, channel operations | public APIs and events only |
| | `front-door` | WhatsApp/Viber/SMS adapters, report release, booking and payment links | public APIs and events only |
| | `analytics` | Read models, reporting replica, measures, CDC landing | events and CDC only |
| | `ai-gateway` (P2) | AI gateway and control plane | public APIs only, never the database |

**Dependency rules (enforced by ArchUnit and Modulith verification):**
- A module imports only another module's `api` package (commands, queries, published events). No module reads another module's tables.
- Only the Safety Kernel modules (`orders`, `medications`, `results`, `platform-tasks`) may share a database transaction. An order-sign is one atomic transaction: order + CDS override record + verification task + MAR schedule + charge event (ADR-001 criterion C1).
- Every module reaches its data store only through repositories wrapped by the Trust Plane Policy and Audit SDKs.
- `rcm` is a downstream conformist: it consumes clinical events (for example `ChargeGenerated`) and never changes clinical aggregates. SI-12 is enforced at the boundary: no RCM state can block an ADT, order or MAR command. Because `rcm` is a satellite, no kernel, ADT or order command calls it synchronously; screens that show both (for example the OP pharmacy POS) compose them in the BFF, and during an RCM outage clinical work continues while charge events wait in the outbox and post when RCM recovers.
- `hub` is the anti-corruption layer to every external format. No other module emits HL7 v2, FHIR, DICOM or Kurdistan formats directly.
- Tier 2 sidecars expose a pure-function, schema-versioned API. On timeout or error they fail to "unavailable, manual check required", never to "pass". Regulated values are displayed only by Tier 2-owned UI components (`frontend/packages/regulated-ui`) with render-integrity checks (a hash of the module output compared with what is drawn). Escalation tasks are created through a narrow, versioned task API whose contract is part of Tier 2 verification (BP §5.5).

### 5.3 Storage shapes, journal and events

Per tenant database (BP §7.6; R08 §3.11):
- **A. Relational aggregates** with foreign keys and exclusion constraints (for example, no double bed occupancy).
- **B. Immutable facts** with `valid_period`, `recorded_at`, `author`, `attester`, `source` (`user`, `device`, `ai-draft`, `migrated`, `interface`) and `supersedes_id`.
- **C. The bitemporal journal,** written in the same transaction as the state change. One append-only row per change: aggregate type and id, patient id, valid time, recorded time, actor, on-behalf-of, device, purpose-of-use, reason, payload, previous version. It is the transactional outbox and the write-audit trail. It is never updated.
- **D. Read models,** rebuildable from the journal and pushed to clients over server-sent events.

**Event layers:**
1. **Clinical journal** (above).
2. **Domain events:** CloudEvents 1.0 envelopes; schemas in Apicurio; backward-compatible evolution only, with a 12-month deprecation window; Debezium → Kafka keyed by patient so each patient's events stay ordered; at-least-once delivery; idempotent consumers. The event catalogue (§8.5) is a published product surface.
3. **Integration messages:** HL7 v2, FHIR and Kurdistan formats generated by the Hub from domain events; per-patient ordering (A08 never overtakes A01); MSH-10 idempotency; acknowledgement state per message; replay.

**Identifiers and time:** UUIDv7 for every identifier; instants stored in UTC with the original offset; every row carries `tenant_id` and, where it applies, `facility_id`. Downtime numbers (MRN, encounter and accession blocks) carry a site prefix. `TaskOrphaned` is a first-class alarm. Undeliverable messages land in owned queues that alarm after 5 minutes.

### 5.4 Clients

- **Web workspaces** (React) served from the cell, opened inside the **Tauri 2 shell** on hospital workstations so the shell's HAL can drive printers, scanners, badge readers, ID-card and MRZ readers, and card terminals. A plain browser works for roles that need no peripherals.
- **Mobile** (React Native): nurse mode (BCMA, bedside specimen labels, vitals, photos) and physician mode (result acknowledgement, critical read-back, patient-context secure chat, tablet rounds) (§15).
- **Signage** for queue display boards (RTL HTML).
- All clients survive power blips: drafts autosave, re-authentication is fast (badge tap ≤2 s), and nothing is lost on a workstation reboot.

---

## 6. Repository layout and engineering conventions

### 6.1 Monorepo layout [P]

```text
/
├── BUILD-PROMPT.md  BLUEPRINT.md  BLUEPRINT-KURDISTAN.md  research/   # plan and evidence (read-only for the build)
├── docs/
│   ├── program/        # STATUS, BACKLOG, WORK-PACKAGES, DECISIONS-NEEDED, OPEN-QUESTIONS, ASSUMPTIONS, COMMANDS, KNOWN-ANOMALIES, evidence/, reviews/
│   ├── adr/            # ADR-001 … ADR-0nn
│   ├── safety/         # hazard-log.yaml, traceability.csv, safety-case/, boundary-register/, soup.yaml
│   ├── specs/          # state-machines/, modules/, api/ (OpenAPI), events/ (AsyncAPI), hl7/, fhir/
│   ├── runbooks/       # operations, install, upgrade, restore, downtime, break-glass
│   └── user/           # help content in en, ckb, ar
├── backend/
│   ├── build-logic/    # Gradle convention plugins (Kotlin, detekt, jOOQ, Flyway, test tiers)
│   ├── platform/       # shared kernel libraries: ids, time, money, journal, trust-sdk, i18n, testing
│   ├── modules/        # one directory per application module (§5.2)
│   ├── app-hms/        # the modular-monolith Spring Boot application
│   ├── regulated/      # Tier 2 sidecars, each its own deployable and release train
│   ├── hub/            # Integration Hub satellite
│   └── satellites/     # rcm (with finance-export), document renderer, analytics, ai-gateway (P2)
├── frontend/
│   ├── apps/web  apps/shell  apps/mobile  apps/signage
│   └── packages/design-system  packages/regulated-ui  packages/i18n  packages/api-client
├── content/            # Kurdistan foundation content and pack sources (sample content flagged NOT FOR CLINICAL USE)
├── deploy/
│   ├── helm/  site-cell/  central/  edge-agent/  tofu/
├── tools/              # synthetic data generator, workload generator (1,000/300-bed day), migration CLI, golden-image tools
└── tests/              # cross-module scenario suites, end-to-end, performance, chaos, conformance
```

**Inside each backend module** (hexagonal): `api/` (the only package other modules may import), `domain/` (aggregates, state machines, invariants; pure Kotlin, no framework types), `application/` (command and query handlers, transactions, policy checks), `infrastructure/` (jOOQ repositories, adapters), `web/` (BFF endpoints for that module's screens), `events/` (outbound mappers), `test/` (unit, property, integration).

### 6.2 Backend conventions

- **Commands carry context:** tenant, facility, actor, on-behalf-of, device, purpose-of-use, clinical (valid) time, idempotency key and correlation id. They return the result and the new aggregate version. Optimistic concurrency on aggregate version.
- **Business outcomes are values, not exceptions:** sealed result types in the domain; RFC 9457 problem details at the HTTP boundary.
- **Money** is `BigDecimal` plus an ISO 4217 currency in a platform `Money` type with explicit rounding. Never floating point. IQD and USD; cash rounding per tenant (for example to IQD 250 [L]).
- **Time:** inject `Clock`; never call `now()` inside the domain. Clinical time and recorded time are separate fields everywhere.
- **Units:** every quantity carries a UCUM unit in a platform `Quantity` type. Unit-less doses do not compile into a valid command.
- **PHI-safe logging:** a logging API with an allowlist of fields; free-text and identifiers are never logged. CI runs the scenario suites with canary synthetic identities and fails if any canary value appears in logs, traces or metrics.
- **No tenant-specific code:** behaviour differences are configuration. A detector fails the build on tenant identifiers in code.

### 6.3 API conventions

- Contract-first OpenAPI 3.1 for module BFFs and public APIs, stored in `docs/specs/api/`, with generated TypeScript clients. AsyncAPI for published events.
- `Idempotency-Key` on every state-changing request. Cursor-based pagination. Versioned paths for public APIs (`/api/v1/...`), backward-compatible evolution, 12-month deprecation.
- Every endpoint passes through the policy enforcement point; every PHI read and write emits a BALP AuditEvent. Exports and prints are audited as their own event types.
- Server-sent events push read-model changes (worklists, boards, queues).
- The FHIR R4 façade and the HL7 v2 interfaces belong to the Hub (§12).

### 6.4 Database conventions

- One database per tenant; one schema per module; each module owns its tables.
- Every table has `tenant_id`, an UUIDv7 `id`, and audit columns; fact tables are bitemporal (`valid_period tstzrange`, `recorded_at`, `supersedes_id`). Database permissions and a linter forbid `UPDATE` and `DELETE` on fact tables.
- Use exclusion constraints, check constraints and foreign keys for invariants the database can hold; the domain holds the rest.
- Flyway migrations follow expand → migrate → contract. CI runs an upgrade-then-rollback test against the previous release (N-1) on every change.
- Encrypted volumes with keys sealed to the TPM; envelope encryption with per-tenant keys for documents, images and designated fields, so crypto-shredding works (ADR-008).
- Pooled tier: `FORCE ROW LEVEL SECURITY` on every table; no role has `BYPASSRLS`; RLS tests in CI.

### 6.5 Frontend conventions

- Strict TypeScript; no `any`. React Aria Components for every interactive primitive. Design tokens only.
- **RTL by construction:** CSS logical properties only (a lint rule bans `left`, `right`, `margin-left` and similar); `dir` comes from the locale; mixed strings (a Sorani name, an English drug, a dose and a unit) are bidi-isolated (`<bdi>`, `unicode-bidi: isolate`).
- **No string literals in JSX:** every user-facing string comes from the catalogues (ICU MessageFormat). Missing keys fail the build for clinical paths.
- **Clinical numerals** render through a `ClinicalNumber` component that always uses Western digits, on every locale. Eastern Arabic-Indic digits are allowed only for non-clinical numbers in patient-facing Kurdish and Arabic text, by configuration.
- **The banner** is mandatory on every clinical route (a test enforces it). One patient context per window.
- Defaults never select a dose, route or patient. Keyboard-first with a command palette. Density modes. No stacked modals. One sign/co-sign pattern everywhere.
- Accessibility details: text contrast ≥4.5:1; colour is never the only carrier of meaning; targets ≥24×24 px; doses always with a leading zero and never a trailing zero; WCAG 2.2 AA including Redundant Entry and Accessible Authentication (R08 §8).
- Per-route performance budgets and bundle-size budgets run in CI.

### 6.6 Configuration, content and flags

- **Configuration chain:** vendor foundation → Kurdistan pack → tenant → legal entity → facility → department → unit → user. The most specific value wins unless a parent has locked it. Safety invariants and Tier 2 activation are vendor-locked (K §7.7).
- **Clinical tier (no partial loop, K-24):** `CORE` or `CLINICAL_SAFETY` is one facility-level setting, locked against department, unit and user override.
  - `CLINICAL_SAFETY` turns on CPOE, pharmacist verification, eMAR/BCMA and transfusion verification together, for every inpatient area of the facility: wards, ED, OT/PACU, labour and delivery, ICU and NICU/PICU (T1 always; T2 where the Boundary Register allows). None of these can be enabled on its own.
  - `CORE` exposes no MAR, administration schedule or active-medicines view (control set B).
  - Changing the tier is a governed change backed by RG1–RG4 evidence.
  - Tests prove that no configuration state yields CPOE without eMAR/BCMA, or a MAR on any unit of a `CORE` facility.
- **Signed bundles** promoted BUILD → TEST → TRAIN → PROD, with three-way merges and no customer branches. Content (order catalogues, formulary, rules, tariffs, forms, templates, translations) is a regulated artefact: versioned, validated, signed, replayed before activation (§19.4).
- **Flags:** every CDS rule and clinical-behaviour flag has a kill switch. Safety-relevant changes default to off. Flag changes are audited.
- **Extension tiers (R08 §9):** (1) configuration (forms, order sets, rules, worklists, print templates: typed, validated, versioned, tested); (2) low-code (form builder, FHIRPath expressions, pathway templates compiled to our task engine; sandboxed, no database access); (3) server plugins (P2, `PLT-CFG-04`) that run out of process, receive events and return effects the core validates; (4) external SMART apps and CDS Hooks services. A PLAY environment beside BUILD → TEST → TRAIN → PROD lets hospital analysts experiment safely.

### 6.7 Observability

OpenTelemetry traces, metrics and logs, PHI-free by construction. On-site collectors buffer and export to the central site. SLO dashboards per cell. Alarms at minimum for: `TaskOrphaned`; dead-letter queue items older than 5 minutes; DR replication lag >15 minutes; clock skew >1 s; UPS on battery and runtime <10 minutes; disk, memory and certificate expiry; licence days remaining; backup failures; failed restore tests; integration channels without acknowledgements.

### 6.8 Fitness functions and static analysis (all in CI; a failure blocks merge)

1. No dose arithmetic outside `reg-dose`, exactly as defined in §2.1 (custom detekt rule plus ArchUnit on `Dose`/`Quantity` operations; the allowed comparisons (a)–(e) go through one audited comparison API).
2. No `UPDATE`/`DELETE` on fact tables.
3. Module boundaries (Modulith verification; ArchUnit layering; `domain` packages free of framework types).
4. No repository access without the Trust Plane SDK.
5. No PHI in logs, traces or metrics (canary scan).
6. No hard-coded user-facing strings; no physical CSS directions; banner present on clinical routes.
7. Licence scan, SBOM generation, secret scan, dependency vulnerability scan, container scan.
8. Branch-per-tenant and tenant-identifier detectors.
9. Migration upgrade-and-rollback test (N-1).
10. Read-model rebuild test from the journal.
11. Egress test: the cell's network policy allows only the approved outbound destinations.
12. Performance budgets (§0, §14.4) and the 300-bed-day regression gate.
13. Tier 2: 100% boundary-value coverage and a mutation score threshold.

---

## 7. Platform foundation (build this before any clinical module)

Each capability below is a backlog item in Appendix A (mostly `PLT-*` and `TRU-*`). Read: R08 §12; R07 §5 and §9.1; BP §7.

1. **Tenancy and enterprise structure.** Tenant → legal entity → facility → building → floor → department → unit → room → bed, plus service points (clinics, counters, labs, OT suites). Tenant calendars with the Friday–Saturday weekend and Kurdistan holidays (Newroz on 21 March, the Eids and others) as data [L]. Calendar-aware SLA timers.
2. **Trust Plane.** Identity: federation with the hospital IdP; phishing-resistant MFA (passkeys, FIDO2, smartcards; never SMS codes) for remote, privileged and vendor access; badge tap-and-go ≤2 s; badge plus PIN for co-signature, controlled drugs and break-the-glass; no shared accounts; deprovisioning within minutes. Authorisation: RBAC plus ABAC plus care relationship plus sensitivity labels plus purpose-of-use plus consent, decided by one policy decision point and enforced on every API, print and export. Break-the-glass with reason capture, privacy-office notification and review within one working day. Audit: BALP AuditEvents for every view, write, print and export, in a hash-chained WORM store that tenant admins cannot disable, with free SIEM streaming and a one-year patient access report in ≤5 s. Keys: per-tenant envelope keys, crypto-shredding, TPM/HSM sealing, escrow (§13).
3. **Clinical journal and fact store** with as-was queries ("what did the clinician see at 09:12") for medico-legal review and CDS replay. Back-entry tooling records valid time = paper time and recorded time = now, labelled.
4. **Task engine:** every task has an owner (a person, a pool or a queue), an SLA, an escalation chain and a state. Team inboxes with pools. `TaskOrphaned` fires within 5 minutes for unowned or unroutable work.
5. **Event backbone and outbox:** Debezium, CloudEvents, schema registry, per-patient ordering, idempotent consumers, owned and alarmed dead-letter queues, replay.
6. **Workflow port** with the Temporal adapter, for discharge, pre-approval, claims, migration and cutover.
7. **Configuration and content service:** the configuration chain with locks; signed bundles; promotion; replay harness.
8. **Flags and kill switches.**
9. **Terminology service:** code systems, value sets and maps, versioned by date of service; every coded element keeps local code, standard code, display, original text and code-system version (R06 §8).
10. **Localisation platform:** catalogues and translation memory for `en`, `ckb`, `ar` and `ku-Arab` templates; a **transliteration service** (Kurdish/Arabic ↔ Latin, with stored variants); **name normalisation** (ي/ی, ك/ک, ه/ە, alef forms, taa marbuta); collation and search normalisation; digit policy; calendars (§11).
11. **Documents and printing:** HTML templates → PDF/A and FHIR documents from one source; wristbands and labels rendered per printer DPI with Sorani and Arabic shaping or raster fallback; golden-image tests; a print spool on the cell; print watermarking; every print audited.
12. **Forms engine:** versioned, configurable forms and assessments with validation, scoring hooks (non-device only) and QuestionnaireResponse-shaped storage.
13. **Notifications:** in-app and push, never carrying PHI.
14. **Search:** patient search across scripts with trigram and normalised indexes, p95 ≤200 ms.
15. **Files:** object storage with object lock for documents, scans and photos.
16. **Safety registry (TRU-REG-02):** the hazard log and the Regulatory Boundary Register as services with UI, API and the CI gate (§10.1–§10.2).
17. **Read models and the reporting replica** (≤2 s boards, ≤60 s replica).
18. **Site services:** power and building signals (mains, generator, UPS) as events; time-sync health and the clock-skew write block; downtime number blocks with site prefix; backup orchestration; the fleet agent (outbound channel, release pulls, licence and certificate status).
19. **Downtime support:** the continuity replica; downtime packet printing (census, active orders, MAR, allergies, recent notes and results); back-entry reconciliation.
20. **Design-system shell:** workspace frame, banner, patient-context management, sign/co-sign pattern, command palette, density modes, RTL, autosave.

---

## 8. The canonical data model

R11 is the specification: **patient-centric, encounter-anchored, order-driven.** FHIR is the vocabulary and the external contract, never the storage schema. Every fact records who, what, when (effective vs recorded), where, why, how sure and from where. Finance is a projection of clinical activity. Domain events map 1:1 to interoperability triggers (R11 §0; BP §8; K §8). Read: R11 in full before WP-0.4; K §8.

### 8.1 Modelling principles (R11 §1)

| # | Principle |
|---|---|
| P1 | Patient-centric, encounter-anchored: every clinical record has a subject and, where it applies, an encounter. Problems, allergies and home medicines are patient-level |
| P2 | Clinical time ≠ system time: store effective, recorded/authored and transaction time; display effective, audit both |
| P3 | Immutable history: updates are versions; entered-in-error replaces delete; merges are links; the "as-was" view is reconstructible |
| P4 | Explicit status with an allowed-transition table per record type |
| P5 | Coded plus text: {local code, standard code(s), display, original text, code-system version}, value-set bound per field |
| P6 | UCUM units everywhere; an explicit, versioned dosing weight; conversions only through the terminology service |
| P7 | Namespaced identifiers `{system, value, type, period, assigner}`, unique per system |
| P8 | Provenance everywhere (user, device, interface, AI model, patient); AI content labelled until a human verifies it |
| P9 | Configuration is versioned, scoped to a node of the enterprise tree, inherited downward and promoted through environments |
| P10 | Instants in UTC with the facility time zone; date of birth is a date without a zone; local-calendar rendering (Gregorian; Hijri display optional) |
| P11 | Safety invariants live in the domain layer, for every channel |
| P12 | Privacy labels on records; access = role + care relationship + labels + consent |

### 8.2 Aggregate catalogue (owning module in brackets)

Physical, organisational and financial hierarchies stay separate but cross-referenced: a ward sits physically in a building, organisationally in a department and financially in a cost centre (R11 §2).

| Area | Aggregates and key attributes |
|---|---|
| **Enterprise** (`platform-tenancy`) | Tenant (residency, deployment, licensing, locale pack, keys); Organization (legal entity, department, payer, referring organisation); Location tree facility → building → floor → unit → room → bed (operational status, gender restriction, isolation capability, telemetry, level of care, cost centre); HealthcareService (specialty, hours, referral method, eligibility); cost centre; store |
| **Identity** (`empi`, `workforce`, `trust-identity`) | Patient (identifier list, names in several scripts with parts and use, sex and gender fields, birth date with precision flag, deceased, contacts, language and interpreter flag, photo, links); match candidate (score, algorithm version, status, reviewer); merge link (survivor, replaced-by, algorithm version; reversible); newborn link; RelatedPerson (next of kin, guardian, proxy, guarantor); Person (links one human's patient and staff records, for employee-as-patient rules); Practitioner and PractitionerRole (typed identifiers, privileges per hospital, visiting-consultant flag); CareTeam; user account (never conflated with practitioner); employee |
| **Access and flow** (`scheduling`, `adt`) | Schedule; Slot; Appointment and responses; referral (ServiceRequest with from/to, urgency, reason, attachments, authorisation status); waitlist entry; **OPD queue token** (number, service point, status waiting/called/in-service/done/skipped, call count, estimated wait); surgical case request; EpisodeOfCare; **Encounter** (class AMB/EMER/IMP/OBSENC/SS/VR, status and class history, participants, diagnoses with role and rank, hospitalisation details, **location history = the single source for census, patient-days and bed charges**); ADT event log; triage record; leave; bed with one authority and an exclusion constraint against double occupancy |
| **Clinical record** (`record`, `nursing`) | Problem (clinical and verification status); encounter diagnosis; allergy/intolerance ("NKA" is an explicit assertion distinct from "not assessed"); vital signs and flowsheet rows (LOINC, UCUM, method, device, validated-by-nurse flag); scores (components, total, calculation version); forms (QuestionnaireResponse-shaped); clinical note (type, authors, status, attestation, addenda, per-segment source attribution typed/dictated/copied/AI, hashed rendering at signature); procedure; care plan and goals; immunisation (vaccine, lot from stores, expiry, site, route, dose number, performer, consent); flags (fall risk, isolation, code status, violence risk, carrier status, VIP, interpreter); advance directive and code status (own model, banner-visible) |
| **Orders and tasks** (`orders`, `platform-tasks`) | One aggregate holds the request, its tasks and its status history: placer and filler identifiers, basedOn/replaces, group identifier for order sets, status, intent, priority, code and details, timing, as-needed, requester and on-behalf-of (verbal orders: read-back flag and co-sign due time), performer, reason, supporting info. Order kinds: lab, imaging, procedure, nursing, therapy, consult, referral, medication, diet, device, blood, ADT, order set. Every fulfilment step is a Task; worklists are read models over open tasks |
| **Diagnostics** (`lis`, `ris`, `results`, `transfusion`) | Specimen (accession, barcode, type, container, collection details, condition, parent for aliquots, logistics state); result (LOINC, value, UCUM, versioned reference range, interpretation, method, analyser, performer, status); report; imaging study (Study Instance UID, accession, modality, DICOMweb endpoint); critical-result communication (Communication + Task: recipient, time, read-back, escalation); blood unit (unit number, product, ABO/Rh, expiry, status, location, relabel record); transfusion (witnesses, vitals, reactions). Microbiology (P2) is hierarchical: specimen → isolate → susceptibility panel; never flattened |
| **Medications** (`medications`) | Medication product (regional brand master codes, form, ingredients with UCUM strength, manufacturer, lot/expiry, high-alert, LASA, controlled schedule); formulary item; **MedicationOrder with its own dose model** (independent of FHIR `Dosage`; dosing weight/height and renal function used; Dose Engine calculation ID from P2); pharmacist verification (Task + Provenance, interventions); transcribed paper order (R2a: image, transcribing pharmacist, ordering practitioner; never a MAR); dispense (quantity, lot, location, prepared-by, checked-by); **administration** (status and reason, time, dose and rate, route and site, performer, barcode evidence or override reason, witness, pump, order link); patient-supplied medicine; home medicines; medication reconciliation (decision per item, reason, who, when) |
| **Finance** (`rcm`) | All internal aggregates (§9.20): guarantor, account, ledger, charge, tariff, package, deposit, estimate, invoice, pre-approval, credit claim, payment, adjustment, `Money`, exchange rate, cashier drawer and shift, doctor-fee ledger |
| **Supply, assets, workforce** (`supply`, `workforce`) | Item master; stock and lot; requisition and transfer; PO, GRN and vendor invoice; implant/device instance (UDI DI+PI, recall status); biomedical asset (P2); roster (P2); credential and privilege. Internal aggregates, because these resources leave FHIR R6 core |
| **Cross-cutting** (Trust Plane, kernel) | AuditEvent (every read, write, print, export, break-the-glass); Provenance (including AI agent and model version); Consent; sensitivity label; Task; Communication; List; Binary/DocumentReference (object storage plus hash); terminology and definitional content (versioned, promotable); topic subscriptions; device metrics; release-of-information request |
| **Statutory** (`statutory`) | Register entries (locked, append-only, corrections as addenda): MLC with police-notification timestamps, narcotics, births, deaths with ICD-10 cause, notifiable diseases; KRG return and DHIS2 data-value sets |

### 8.3 Storage shapes and identifiers

As §5.3: relational aggregates (A), immutable bitemporal facts (B), the journal-as-outbox (C), rebuildable read models (D). UUIDv7 identifiers; UTC instants with the original offset; `tenant_id` and `facility_id` on every row; site-prefixed downtime number blocks; migrated data carries `migrated` provenance with its original times. Back-dating is privileged and audited; back-entry keeps valid time = paper time.

### 8.4 State machines

Write each machine as an executable YAML spec (Appendix B.3) and generate property-test models from it **before any UI**. Guards are lists of named predicates (for example `[activeVerifiedOrder, twoIdentifiersConfirmed, productScanMatches]`); each predicate is implemented once in the module's domain package and unit-tested, prose goes in a `description` field, and the generator fails on an unknown predicate. Each machine has an owner module and an approval gate [HUMAN]. Where R11 leaves a transition undrawn (noted below), propose the transition, mark it "proposed", and put it to the approving panel.

**Encounter** (approval: nurse panel + HIM + CSO):

| From | Command | Guard / effect | To |
|---|---|---|---|
| (start) | Pre-admit / schedule | — | planned |
| planned | Arrive | — | arrived |
| planned | Cancel | — | cancelled |
| arrived | Triage | Triage record (scale, complaint, vitals, time) | triaged |
| arrived, triaged | Admit to bed | No bed allocation offline (SI-15); no deposit rule blocks ED registration or emergency orders (SI-12) | in-progress |
| in-progress | Transfer / swap bed | Appends a location-history period | in-progress |
| in-progress | Leave → return | — | on-leave → in-progress |
| in-progress | Discharge | Never blocked by bill, deposit or pre-approval (SI-12); pending results routed to owned queues (SI-17) | discharged-not-closed |
| discharged-not-closed | Administrative close (coding and charging done) | — | finished |
| finished | Cancel discharge | Audited | in-progress |
| in-progress | Cancel admission | Audited | entered-in-error |

**Order** (approval: pharmacist and nurse panel + CSO):

| From | Command | Guard / effect | To |
|---|---|---|---|
| (start) | Save unsigned; cutover pre-build "pending prescriber signature" | — | draft |
| draft | Sign | Privileges (§9.26); identity re-verified if the context changed <60 s ago (SI-16); CDS checks; co-sign rules; verbal orders carry read-back and a co-sign due time and are refused for antineoplastics; restricted antimicrobials need indication and approver | active (medication: pending-verification) |
| draft | Discard | — | revoked |
| active: pending-verification | Pharmacist verifies | Control set A where it applies; emergency/first-dose override path with review ≤4 h | active: verified |
| active | Hold / resume | — | on-hold ↔ active |
| active | Fulfilled / result final | — | completed |
| active | Discontinue | Reason required | revoked |
| active | Mark error | — | entered-in-error |

Every order reaches completed, revoked or entered-in-error (SI-03). A modification is a new request that `replaces` the old one.

**Medication administration, per scheduled dose** (approval: pharmacist and nurse panel + CSO):

| From | Command | Guard / effect | To |
|---|---|---|---|
| (start) | Dose falls due | Late-dose windows configurable; tighter for time-critical drugs | scheduled |
| scheduled | Start / give | Active verified order or documented override with a non-defaulted reason (SI-02); wristband scan with two identifiers (SI-01); product scan within tolerance, else stop with reason; high-alert independent double check (SI-13); unverified patient-supplied product unscannable (SI-12); offline only for orders verified before the outage (SI-15) | in-progress (infusions) or completed |
| in-progress | Complete | — | completed |
| scheduled, in-progress | Not done (held, refused, missed, NPO, off unit) | Reason required | not-done |
| in-progress | Stop | — | stopped |
| any | Mark error | Audited | entered-in-error |

R11 draws only the outcomes after in-progress; the direct scheduled → completed and scheduled → not-done transitions above are proposed and need approval.

**Specimen** (approval: lab CSO): ordered → label printed → collected (collector, time, scanned wristband) → in transit → received → in process → resulted → stored or disposed. Rejected (unlabelled, haemolysed, insufficient, wrong container, expired stability) → recollection task. R11 does not say which states can reject; propose: received and in process.

**Result** (approval: lab CSO + physician panel): registered → preliminary → final → amended or corrected; cancelled; entered-in-error. Every correction notifies the orderer and everyone who acknowledged the earlier version. Final requires technologist validation until autoverification is active.

**Bed** (approval: nurse panel + bed manager): available → reserved/assigned (not offline) → occupied (exclusion constraint) → dirty → cleaning → available; side states blocked (isolation, contamination, maintenance, staffing; reason required) and closed. Every change emits ADT^A20, projected to HL7 table 0116 codes. Entry and exit paths for blocked and closed are proposed for approval.

**Appointment** (approval: OPD panel): proposed → pending → booked → checked-in/arrived → fulfilled; cancelled (by whom, why, late-cancel flag); no-show; waitlist (constraints, priority, auto-offer); reschedule and modify as their own events.

**Credit claim and pre-approval** (approval: RCM lead + Kurdistan pack PM): §9.23.

**Other lifecycles to specify the same way:**
- *Identity:* match candidate possible → confirmed-same / confirmed-different (reviewer); merge → unmerge (restores). Never offline; overlays are safety incidents; results are never silently re-attached.
- *Clinical note:* preliminary → final (signed, rendering hashed) → amended (new version with reason); addendum as a linked note; retraction → entered-in-error with reason; `draft-ai` until signed (P2).
- *Blood unit:* received → blind double entry → relabelled → stored → issued → bedside-verified → transfused, or quarantined (mismatch or temperature excursion), or returned → final disposition.
- *Patient-supplied medicine:* received → identified → expiry-checked → relabelled and flagged → administrable.
- *Medication reconciliation:* each item continue / modify / hold / stop / new with reason; completion blocked while any item is undecided.
- *Critical result:* flagged → named recipient → read-back → acknowledged, otherwise escalated (`CriticalResultEscalated`).
- *Referral:* created → owned queue → appointment or admission → acknowledgement → closure letter.
- *Task:* open → claimed → done / cancelled, with SLA timers, escalation and `TaskOrphaned`.

### 8.5 Domain-event catalogue (R11 §14; BP §7.6)

| Event | HL7 v2 | FHIR |
|---|---|---|
| PatientRegistered / Updated | ADT^A04 / A08 / A28 / A31 | Patient |
| PatientMerged / Unmerged | A40; there is no standard unmerge trigger (agree A47/A08 corrections per interface) | Patient.link |
| AppointmentBooked / Rescheduled / Modified / Cancelled / NoShow | SIU^S12 / S13 / S14 / S15 / S26 | Appointment |
| PatientArrived / CheckedIn | ADT^A04 or A10; SIU^S14 | Encounter |
| EncounterAdmitted / PatientTransferred / PatientDischarged | A01 / A02 / A03 | Encounter |
| AdmissionCancelled / DischargeCancelled | A11 / A13 | Encounter |
| Leave / return; pending admit; pre-admit; bed swap | A21 / A22; A14; A05; A17 | Encounter |
| OrderSigned / Modified / Discontinued | OML^O21, OMI^O23, OMG^O19, ORM^O01 (legacy), RDE^O11 | ServiceRequest / MedicationRequest |
| MedicationVerified / Dispensed | RDS^O13 | MedicationDispense |
| MedicationAdministered / NotGiven / Overridden | RAS^O17 | MedicationAdministration |
| SpecimenCollected / Received / Rejected | OML; SSU^U03; OUL^R22 | Specimen |
| ResultPreliminary / Final / Corrected; ResultAcknowledged | ORU^R01 | Observation / DiagnosticReport |
| CriticalResultCommunicated / Acknowledged / Escalated | ORU + ACK workflow | Communication / Task |
| ImagingStudyAvailable | ORU/OMI; DICOM MPPS | ImagingStudy |
| NoteSigned / Amended | MDM^T02 / T08 | Composition / DocumentReference |
| ChargeCreated / Credited | DFT^P03 / P11 | Internal API (finance resources leave R6 core) |
| ClaimSubmitted / Adjudicated | Document pack (no X12) | Claim / ClaimResponse where an insurer accepts FHIR |
| BedStatusChanged | A20 | Location.operationalStatus |
| ConsentRecorded / Revoked | CON segment | Consent |
| BreakTheGlassAccess | — | AuditEvent |
| ImmunizationRecorded | VXU^V04 | Immunization |
| ReferralSent / Accepted | REF / RRI | ServiceRequest |
| StaffAssignmentChanged; IdentityVerified; PaymentReconciled | — | Internal |
| **TaskOrphaned** | — | First-class alarm |

Canonical names follow R11 §14. BP §7.6 uses `ChargeGenerated` and `EncounterMoved` for `ChargeCreated` and `PatientTransferred`: treat those as aliases, never as separate events. Events are written atomically with the state change and published through the outbox; the Hub translates them.

### 8.6 Master data required before go-live (R11 §16, Kurdistan form)

Each ships as a validated, importable template in the Migration Workbench with a named owner. Kurdistan foundation content supplies ≥90% of it; the hospital adds its own price lists, formulary, staff and services.

1. Enterprise structure, departments, cost centres.
2. Users, roles, security classes, the practitioner directory and privileges (Kurdistan identifiers).
3. Order catalogue with codes (LOINC and local; SNOMED Global Patient Set where useful).
4. Lab definitions, reference ranges, specimen definitions, analyser maps.
5. Imaging catalogue and modality map.
6. Formulary, dispensing locations and the regional brand master, linked to the licensed drug KB.
7. Order sets, templates, flowsheets and forms (trilingual; patient templates in Sorani, Badini and Arabic).
8. Charge master, price lists, packages and contracts (IQD by default).
9. Payer master: insurers, corporates and NGOs with contract prices, eligibility letters, credit limits and co-pay.
10. Classifications: WHO ICD-10 (ICD-11 if adopted).
11. Terminologies (§8.7).
12. Item master, vendors, stores and par levels (several GTINs per orderable, scan-tested).
13. Interface endpoints and code maps (the Kurdistan pack: identifier URIs, endpoints, consent rules, residency policy).

Kurdistan additions: the exchange-rate table and cash-rounding unit; tenant calendars and holidays; KRG return formats, notifiable-disease rules and birth and death forms (when supplied); doctor-fee rules; site-prefixed downtime number blocks.

### 8.7 Terminology and coding (K ADR-015; Q-K9)

| Code system | Position |
|---|---|
| ICD-10 | WHO base version, for insurers and statistics; commercial use needs WHO permission [HUMAN] |
| ICD-11 | Dual coding if the KRG adopts it (free) |
| LOINC (seeded via LIVD), UCUM | Free; used throughout |
| ATC | Electronic files need a WHOCC licence [HUMAN] |
| SNOMED CT | Iraq is probably not a member [L]; an affiliate licence is priced on request. Default: the free Global Patient Set for coded exchange, local codes for the rest, and a licence only when CDS subsumption, a partner or an export market needs it |
| Drugs | No national drug file [L]: the regional brand master (§9.10) plus the licensed drug-KB concepts |

Every coded element keeps the local code, standard code, display, original text and code-system version; retrofitting this is "ruinous" (R06 §8). Code sets are versioned by date of service as data. On-site cells receive terminology and drug-KB snapshots.

### 8.8 FHIR projection policy

FHIR R4 (4.0.1) is the contract now: IPA, SMART App Launch 2.2, Bulk `$export`, topic-based Subscriptions (backport), and IPS `$summary` from day one. R6 is a second projection added on demand, with no storage migration (ADR-005; spike C5). Never build anything canonical on resources leaving R6 core (ChargeItem, ChargeItemDefinition, Invoice, InventoryItem, SupplyRequest, SupplyDelivery, DeviceUsage, FormularyItem, Contract, InsurancePlan, ClinicalImpression, MedicationKnowledge); they are edge projections at most. Bounded FHIR writes become domain commands.

---

## 9. Functional modules (the full catalogue)

Each module below gives its **release**, the **feature IDs** (Appendix A), the owning **code modules** (§5.2), what to **build**, the **rules** that matter, minimum **acceptance** tests, and where to **read** for depth. Everything in §2 applies to every module. Content values (thresholds, order sets, templates) are governed configuration; ship synthetic samples flagged NOT FOR CLINICAL USE until clinicians approve real content [HUMAN]. Platform capabilities (Trust Plane, journal, tasks, printing, configuration, the Hub, the cell) are specified in §7, §12, §13 and §16 and are not repeated here.

### 9.0 The module catalogue at a glance

| § | Module | Releases | Main features |
|---|---|---|---|
| 9.1 | Patient identity, registration and EMPI | R1 | `ACC-ID-01`–`03`, `KRI-ID-01`, `ACC-REG-01` |
| 9.2 | Scheduling, OPD flow, referrals and the seam | R1 (display boards R1.1); P2 kiosks, transfer centre | `ACC-SCH-01`, `ACC-SCH-02`, `ACC-OPD-01`, `INT-SEAM-01` |
| 9.3 | The outpatient visit | R1 | `CLN-ORD-02` (OPD), `CLN-IMM-01`, `MED-OPP-01` |
| 9.4 | The clinical record | R1 (outpatient) → R2b (inpatient) | `CLN-CHT-01`–`03`, `CLN-DOC-01`–`02`, `CLN-IPC-01`, `CLN-ACP-01` |
| 9.5 | Orders and CPOE | R1 outpatient; R2b inpatient | `CLN-ORD-01`, `CLN-ORD-02` |
| 9.6 | Clinical decision support | R1 screening; R2b full; P2 CDS Hooks, sepsis | `CLN-CDS-01`–`08` |
| 9.7 | Diagnostics shared services | R1 | `DX-ORD-01`, `DX-CRT-01` |
| 9.8 | Laboratory (LIS) | R1; R1.1; P2; P3 | `DX-LAB-01`–`06`, `DX-MIC-01`, `DX-AP-01`, `DX-POC-01` |
| 9.9 | Radiology (RIS) and PACS | R1; P2 | `DX-RIS-01`–`03`, `DX-PAC-01`, `DX-CRD-01` |
| 9.10 | Medication management | R1 outpatient; R2a inpatient dispensing; R2b closed loop; P2 | `MED-*`, `CLN-MRC-01` |
| 9.11 | Transfusion | R2b; P2 | `DX-BB-01`, `-02`, `-03a`, `DX-BB-KRI-01` |
| 9.12 | ADT, beds, patient flow and handoff | R2a; R2b handoff; P2 | `ACC-ADT-01`, `ACC-ADT-02`, `OPS-FLW-01`, `CLN-HND-01` |
| 9.13 | Nursing | R2b; P3 staffing | `NUR-FLW-01`, `NUR-FLW-02`, `NUR-CP-01`, `NUR-WND-01`, `CLN-BH-01` |
| 9.14 | Emergency department | R2b (MLC register R2a); P2 MCI mode | `CLN-ED-01`–`03` |
| 9.15 | Perioperative and anaesthesia | R2a scheduling and billing; R2b checklist and record; R2.1 anaesthesia; P2 AIMS | `SPC-OT-01`–`04`, `SPC-AN-01`–`02` |
| 9.16 | Critical care | R2b; R2.1 monitor feed; P2 scores; P3 tele-ICU | `SPC-ICU-01`–`03` |
| 9.17 | Maternity and neonatal | R2a registration; R2b L&D record; P2 antenatal, NICU | `SPC-MAT-01`–`02`, `SPC-NIC-01` |
| 9.18 | Results management, discharge and care transitions | R1 outpatient results; R2b inpatient | `CLN-RES-01`, `CLN-DOC-03`, `CLN-MRC-01` |
| 9.19 | Devices and vitals integration | R2.1; P2; P3 | `DEV-GW-01`, `DEV-VAL-01`, `DEV-ALM-01`, `DEV-SDC-01` |
| 9.20 | Revenue cycle core | R1; R2a | `RCM-ACC-01`, `RCM-CHG-01`, `RCM-TAR-01`, `OPS-FLW-01` |
| 9.21 | Cashiering, deposits and dual currency | R1; R1.1 | `RCM-CSH-01`, `KRI-RCM-01`, `KRI-PAY-01`, `DFD-PAY-01`, `RCM-TAX-01` |
| 9.22 | Doctor fees and payouts | R1 | `KRI-RCM-02` |
| 9.23 | Credit, pre-approvals and claims | R1; R1.1; P2 | `RCM-INS-01`, `RCM-DEN-01`, `RCM-SCH-01` |
| 9.24 | Clinical coding | R2.1; P2 | `RCM-COD-01`, `RCM-AI-01` |
| 9.25 | Supply chain, stores and procurement | R1; R2a; R2.1; P2 | `ERP-INV-01`, `ERP-FIN-01`, `ERP-PRC-01`, `ERP-IMP-01` |
| 9.26 | Workforce, credentialing and privileges | R1; P2 | `ERP-HR-01`, `ERP-ROS-01` |
| 9.27 | Health information management | R2b; R2.1 | `CLN-DOC-04` |
| 9.28 | Statutory registers and Ministry reporting | R1; R1.1; R2a; R2.1 | `OPS-STAT-01`, `OPS-STAT-02`, `KRI-STAT-02`, `SPC-DTH-01` |
| 9.29 | Quality, incidents and accreditation | R1; R2b; P2 | `CLN-INC-01`, `CLN-QI-01`, `IMP-MAT-01` |
| 9.30 | Patient and referrer front door | R1; R1.1; P2; P3 | `DFD-*`, `KRI-MSG-01` |
| 9.31 | MIS, dashboards and reporting | R1; R1.1; P2 | `OPS-MIS-01`, `AI-DAT-01`, `AI-DAT-02a` |
| 9.32 | Migration Workbench and go-live tooling | R1; R2b; R2.1 | `IMP-*` |
| 9.33 | Other ancillary services | R2b; P2; P3 | `SPC-DIE-01`, `SPC-REH-01`, `SPC-DIA-01`, `ERP-SVC-01` |

### 9.1 Patient identity, registration and EMPI

**Release:** R1 (P2: kiosks; same-gender clinician preference). **Features:** `ACC-ID-01` (L) EMPI; `ACC-ID-02` (M) identity documents (re-scoped to Iraqi documents) together with `KRI-ID-01` (L) Iraqi identity and cross-script EMPI, built as one epic; `ACC-ID-03` (M) aliases, newborn naming, photo; `ACC-REG-01` (M) registration. **Module:** `empi`. **Read:** R03 §3.1; R11 §3; K §8; §11.2 of this prompt.

**Build:**
- **Search before create:** by name (cross-script, phonetic and trigram), date of birth, sex, phone, identifiers and address, with similar-name warnings. Patient search p95 ≤200 ms.
- **Capture from the document:** national card barcode or OCR, residency card, passport MRZ through the shell HAL; never typed when a document is present; identity verification recorded separately (`IdentityVerified`, "verify later").
- **Identity data:** the identifier list (§11.2); four-part names in Kurdish (Arabic script), Arabic and Latin with transliteration variants and a display name per locale; the mother's full name; birth date with its precision flag; administrative sex, clinical sex parameter and gender identity; contacts (a mobile number is contact data and a matching feature, never an identifier); preferred language for patient outputs; interpreter need; next of kin and guardians.
- **Photo** at registration, shown on the banner, MAR and order entry.
- **Wristbands and labels** at registration: ≥2 identifiers and a barcode; the name in the patient's script plus Latin; MRN plus date of birth or the approximate-DOB flag.
- **Alias pools** of pre-allocated, unique, non-confusable identifiers ("Trauma Zulu-17") for unknown, trauma, mass-casualty and downtime patients, merged into the real identity later.
- **Newborns:** created automatically at delivery and linked to the mother; a distinct name in the pattern "Baby of <mother's name> <sex> <A/B for multiples>" in each script (configurable); never a bare generic "Baby".
- **Duplicates and merges:** real-time and batch matching (Fellegi–Sunter with a document-number shortcut, Kurdish/Arabic normalisation, transliteration dictionaries, weighting on father's, grandfather's and mother's names and DOB precision) feeding the HIM steward queue; merges are reversible links that re-point clinical data, orders, results and accounts, propagate downstream (A40, `Patient.link`) and record the algorithm version. **An overlay is a safety incident:** freeze, split by provenance, notify, RCA.
- **Deceased** flag with record lock; VIP and employee-as-patient labels; consent capture at registration (messaging per channel).
- A **gold-set evaluation tool** reports precision and recall on the 2,000-pair cross-script set (S14-K).

**Rules:** SI-01, SI-08, SI-15 (no identifiers outside pre-allocated blocks and no merges offline), SI-16, SI-12 (no deposit rule blocks ED registration), SI-21.

**Acceptance:** duplicates <1%, zero overlays and ≥99.9% auto-merge precision on the synthetic cross-script gold set; unmerge restores every re-pointed record; band and label golden images pass in three scripts, including long-name and newborn truncation cases; a mobile number alone never matches two people.

### 9.2 Scheduling, OPD flow, referrals and the seam

**Release:** R1 (display boards R1.1; P2 kiosks `ACC-OPD-03` and transfer centre `ACC-TRF-01`). **Features:** `ACC-SCH-01` (L), `ACC-OPD-01` (M), `ACC-SCH-02` (M), `INT-SEAM-01` (M). **Modules:** `scheduling`, `hub`. **Read:** R03 §3.3; R05 §4.6; R16 §6; K §13.1.

**Build:**
- **Scheduling:** provider, room, equipment and OT-block templates; linked and recurring bookings; capped overbooking; waitlists with auto-offer; reason-coded cancellations and no-shows; the Friday–Saturday weekend and Kurdistan holidays; trilingual reminders.
- **The OPD token journey:** registration → vitals → consultation → lab → pharmacy → billing, with checkpoints configurable per hospital (pay-first sites put the cashier before services). Tokens are issued at check-in, called to a service point, served, skipped or recalled; one token follows the patient across queues; numbers are masked on displays; timestamps for generation, call and service feed TAT dashboards; queue state lives in the cell or edge agent so it survives WAN loss; ESC/POS token printing; RTL HTML display boards in R1.1.
- **Referral tracking:** intake from internal and external sources; every referral is an owned task in a queue with an SLA, through created → owned queue → appointment or admission → acknowledgement → closure letter to the referrer. Open referrals >14 days are reported.
- **The seam (W1-K, while hospital A is on paper or legacy):** one group tenant and EMPI from day one; if hospital A has an electronic ADT, its numbers arrive as alternate identifiers (INT-SEAM-01); if it is on paper, its admission desk gets a search-only EMPI client so polyclinic patients keep one number. Every referral or transfer to hospital A carries a printed and structured visit summary and the active medication list; hospital A's logged receipt counts as acknowledgement. Seam KPIs: unacknowledged referrals >24 h = 0; overlays = 0.

**Acceptance:** the token journey runs end to end with WAN cut; referral SLA timers respect the tenant calendar; the seam suite (§18.5 #10) passes.

### 9.3 The outpatient visit

**Release:** R1 (P2: patient app, teleconsultation, English dictation structuring; P3: ambient AI). **Features:** `CLN-ORD-02` (outpatient scope), `CLN-IMM-01` (M), `MED-OPP-01` (M) for the pharmacy hand-off, plus the record features in §9.4. **Modules:** `record`, `orders`, `medications`. **Read:** R03 §4; K §6.1.

**Build:**
- **The consultant's one-screen visit,** driven by the token queue: pre-visit view (outstanding results and referrals, care gaps); rooming (height, weight, BMI, BP with repeat logic, coded allergies with reaction and severity, medication list with source, reason for visit, screenings, immunisation status); history, examination and data review; assessment and plan per coded problem; diagnosis-linked orders from favourites, order chips and order sets; e-prescribing with typo-tolerant brand↔generic search over the regional brand master, screened (§9.6), sent to the outpatient pharmacy POS; patient instructions in the patient's language from approved templates; check-out (book follow-up and referrals); sign and close; trainee co-signature. Target: median documentation ≤90 s for a follow-up visit [E].
- **Visiting consultants** work evenings, often on tablets: fast login (badge or passkey), large touch targets, favourites, minimal typing.
- **Immunisation record:** vaccine, lot from the stores ledger, expiry, site, route, dose number, performer, consent; HL7 VXU and FHIR Immunization projections.
- **After the visit:** results go to the ordering and responsible clinician for acknowledgement (§9.18); reports reach patients only through the release rule (§9.30).
- The documentation profile is free of US billing norms (no E/M levelling).

**Acceptance:** the demo encounter "token → consult → lab → pharmacy → dual-currency bill" (K-02) runs end to end on synthetic data in three UI languages; an e-prescription for a patient with a recorded allergy to the drug raises the screening alert; instructions print in Sorani, Badini and Arabic with drug names and doses in Latin script.

### 9.4 The clinical record

**Release:** R1 (outpatient record); R2b (inpatient notes, discharge, code documentation); R2a (code status and advance care planning workflow). **Features:** `CLN-CHT-01` (L) chart and banner; `CLN-CHT-02` (M) problems, allergies, home medicines; `CLN-CHT-03` (M) results review; `CLN-DOC-01` (L) notes; `CLN-DOC-02` (M) copy-forward provenance; `CLN-IPC-01` (S) isolation flags; `CLN-ACP-01` (S) code status and advance care planning. **Module:** `record`. **Read:** R03 §15; R11 §6; K §6.4.

**Build:**
- **The banner (SI-16)** as a design-system component on every clinical screen, mobile view and print: photo, two identifiers, trilingual name, allergies ("NKA" distinct from "not assessed"), code status, isolation, dated weight, sensitivity indicators where the user is entitled to see them.
- **Problems** (coded, longitudinal, with clinical and verification status) and **allergies** (coded substance or class, reaction, severity, criticality, verification) driving drug–disease and drug–allergy CDS; home medicines with source.
- **Results review:** trends, cumulative views, graphs, abnormal flags.
- **Notes:** specialty templates; smart phrases; smart links (live data with timestamp and source); smart lists with required choices; problem-based charting. **Notes are synthesis, not accumulation:** composed from structured data with span-level provenance; copied text is marked with its source, and smart links are preferred over static copies. English clinical text. Signing with authentication, intent and manifestation; co-signature for trainees, verbal orders and scribes with timeliness tracking; signed notes immutable, with amendments as versions and addenda as links (SI-06); per-author length and redundancy analytics (no blanket copy-paste ban).
- **Flags:** fall risk, isolation (contact/droplet/airborne, constraining bed assignment from R2a), code status, violence risk, MDRO carrier, VIP, interpreter needed.
- **Code status and advance directives** in their own model: banner-visible, time-stamped, reviewable.
- **Clinical photos** in-app only (never the device gallery), with consent, body site and labels; scanned documents indexed to patient, encounter and type with mis-indexing QA.
- **eConsent** by the performing clinician, with witness, interpreter and versioned forms; guardian or co-signer and chaperone documentation from R2b.
- **Back-entry after downtime** keeps the paper's clinical time and is labelled (SI-10).

**Acceptance:** the banner test passes on every clinical route and print; signing after a patient-context change within 60 s forces re-verification; a signed note cannot be edited through any channel; copied text shows its source on screen and in print.

### 9.5 Orders and CPOE

**Release:** R1 (outpatient orders); R2b (inpatient CPOE, activated site-wide only, never unit by unit); R2a sites keep orders on paper (pharmacy transcription, §9.10). **Features:** `CLN-ORD-01` (L) orderables and order sets; `CLN-ORD-02` (XL) CPOE. **Module:** `orders` (Safety Kernel). **Read:** R03 §7; R11 §7, §10.2; K §4.2, §6.1.

**Build:**
- **Order types:** medications, laboratory, imaging, procedures, nursing, diet (with religious preferences), activity, consults, referrals, blood products, isolation, ADT, therapy, respiratory, code status. Structured by default; free text monitored and alerted when a structured equivalent exists.
- **Orderables master:** coded (LOINC for laboratory; the regional brand master for medicines), defaults, required fields, specimen requirements, synonyms including brand names, tall-man lettering; typo-tolerant search.
- **Order sets:** versioned and evidence-linked, with an owner and a review date; pre-selected versus optional items; conditional logic (weight, renal function); nurse-driven protocols (electrolytes, insulin, anticoagulation nomograms, catheter removal); linked monitoring orders (aminoglycosides, digoxin, lithium, phenytoin, warfarin).
- **Timing types:** STAT/ASAP/routine/timed; future; standing and recurring with expiry and renewal reminders; conditional ("if K < 3.5 then …"); PRN with indication and maximum frequency; titratable with parameters; tapers. Phase-of-care orders (pre-op → intra-op → PACU → post-op) and signed-and-held orders released on transfer.
- **Verbal and telephone orders** only in defined situations: read-back captured with source and receiver; co-signature timers within policy, tracked in the HIM deficiency queue; **refused for antineoplastics except hold or stop**.
- **Checks at ordering:** duplicate checks (exact and therapeutic, with look-back per orderable); age, dated weight, allergies and pregnancy status visible; no weight-based medicine signable without a dated weight; indication required for antimicrobials (with the stewardship control set), PRNs and imaging.
- **The order lifecycle** (§8.4) with actor, time and reason on every transition; order-to-result tracking with an overdue "not yet resulted" view per clinician and unit.
- **Order-sign** is one atomic transaction in the Safety Kernel: order + CDS override record + verification task + MAR schedule + charge event (C1, p95 ≤300 ms server time at 3× peak; ≤1.5 s end to end with CDS).
- **Tablet-first rounds** for visiting consultants: favourites, order chips, order sets, minimal typing.

**Acceptance:** property tests prove every order reaches a terminal state and no medication order is dispensable before verification (except the emergency override list); a verbal antineoplastic order is refused; the CPOE error-category harness (§18.5) runs on foundation content; CPOE share is measurable by unit (targets ≥70% at 90 days and ≥85% at 12 months, K §17).

### 9.6 Clinical decision support

**Release:** R1 (drug-KB adapter and outpatient screening [P], telemetry and harness); R2a (screening at pharmacist transcription); R2b (full inpatient checks, VTE prompts, NEWS2 as Regulated Module #1); P2 (CDS Hooks and CQL `CLN-CDS-04`, sepsis screen `CLN-CDS-06` as Regulated Module #2, stewardship module `CLN-AMS-01`); P3 (partner predictive deterioration `CLN-CDS-07`, silent first). **Features:** `CLN-CDS-01` (M, partner content), `CLN-CDS-02` (L), `CLN-CDS-03` (M), `CLN-CDS-05` (M, Tier 2), `CLN-CDS-08` (S). **Modules:** `cds`, `reg-screening`, `reg-ews`. **Read:** R03 §8; K §5.2, §5.6, §6.3.

**Build:**
- **The CDS registry:** every artefact has purpose, evidence, owner, intended users, trigger, format (tier A–D, §14.3), expected firing rate and a review-by date; firing, acceptance, override and reason telemetry; time-to-action; in-workflow feedback; quarterly alert-burden reports. Every rule and flag has a kill switch (SI-19).
- **The checks catalogue:** drug–allergy with tiered cross-sensitivity; drug–drug by severity with a suppression list; drug–disease from the problem list; dose range (single, daily, cumulative; weight, BSA, renal, hepatic, age, paediatric) **shown verbatim from the licensed KB, with no local arithmetic until the Dose Engine**; duplicate therapy; drug–lab; drug–route (fatal routes are hard stops); pregnancy and lactation; monitoring reminders; advisories inside order sets.
- **The minimal interruptive set:** level-1 interactions, true severe allergies, high-alert dose limits and fatal routes. Everything else goes to order sets, passive guidance or the pharmacist queue. Hard stops only for absolute contraindications on the governed list (for example intrathecal vincristine) (SI-14).
- **Rollout:** the vendor-validated baseline is interruptive from day 0; new or locally modified rules run silent for 2–4 weeks with replay; rules overridden >90% are reviewed, never auto-retired (Tier A/B exempt).
- **VTE:** a risk assessment (Padua, Caprini or UK DoH, chosen per tenant) in the admission order set and at transfer, with contraindications and a prophylaxis order or documented reason; reassessment at 24 h and on change. As a sweep candidate it runs as **prompts with clinician-chosen actions** until its Boundary Register triage is written.
- **NEWS2/PEWS/MEOWS** in `reg-ews` (§10.4): inputs RR, SpO₂ scale 1 or 2, air versus oxygen, systolic BP, pulse, ACVPU (new confusion scores 3), temperature; NEWS2 response bands 0 (≥12-hourly), 1–4 (4–6-hourly), a single parameter of 3 (≥hourly with urgent ward review), 5–6 (urgent response), ≥7 (emergency response); components visible; escalation as a tracked task; PEWS age-banded; MEOWS in pregnancy. **Activation and frequency scheduling only where the Boundary Register allows**; until then the fallback (§10.3) runs.
- **The stewardship control set** (§10.3 C) from R2a.
- **CDS for visiting consultants** must stay within the ≤1.5 s order-sign budget (≤500 ms per CDS service; services fail open with a banner, except hard stops, which fail closed).

**Acceptance:** interruptive alerts ≤8 per 100 medication orders on the synthetic replay; zero interruptive alerts on the "should not alert" set; every kill switch works without a deploy; NEWS2 boundary tests at 100%; the screening presenter never alters KB output.

### 9.7 Diagnostics shared services: one order lifecycle and the critical-result service

**Release:** R1 (the wedge carries this platform). **Features:** `DX-ORD-01` (L), `DX-CRT-01` (M). **Modules:** `orders`, `results`, `platform-tasks`. **Read:** R04 §1, §11; R11 §10.2, §10.5; K SI-04.

**Build:**
- **One lifecycle** shared by lab, radiology, transfusion and pharmacy (and POCT and cardiology in P2): order → identify (patient plus specimen, unit, exam or dose) → perform → result or document → verify → notify and acknowledge → bill → analyse. Every step is a timestamped event (order, collect, dispatch, receive, accession, start, result, verify, notify, acknowledge), so turnaround-time KPIs come out of the box.
- **Five shared services** (R04 §1):
  - *identity and barcode:* wristbands with ≥2 identifiers; IHE LBL specimen labels; one ISBT 128 parser and validator; GS1 GTIN, lot, expiry and serial; UDI; every scan is an immutable event with user, device, location and time;
  - *rules:* non-device decision tables, versioned, effective-dated, with simulation and replay against history, an approval workflow and audit (ADR-017). Anything that releases a result without human review or interprets it belongs to a Tier 2 sidecar (`reg-lis-rules`), not this engine;
  - *closed-loop notification:* the critical-result service below;
  - *worklists:* one task primitive with domain views (collection lists, accession queues, bench worklists, reading worklists, verification queues);
  - *device and instrument gateway:* one ingestion tier (HL7 v2, ASTM via middleware, DICOM, later POCT01), with store-and-forward, clock sync and device–patient association.
- **"Scan, don't type."** Every override of a failed scan is a reportable event (SI-02).
- **The critical-result service** (SI-04):
  - policy tables per test or analyte, location and age: threshold, target notification time and escalation chain (ordering → covering provider → charge nurse → rapid response). Thresholds are governed content approved by the lab director and CSO [HUMAN];
  - channels: secure chat; phone with read-back capture; inbox with acknowledgement;
  - the recipient is **picked from the directory, never typed** ("RN notified" fails); read-back is recorded when phoned; electronic delivery counts only with confirmed receipt;
  - unacknowledged results escalate automatically on calendar-aware timers; a dashboard shows performance against policy;
  - **external referring doctors** of outpatient-tier patients are first-class recipients, with the same record and read-back logger;
  - the record holds date, time, the responsible lab person, the traceable recipient, the result and the read-back.
- **Designed downtime per ancillary:** label printing with downtime accession ranges; cached modality worklists; offline BCMA; a read-only cached MAR (R04 §11 #13).

**Acceptance (minimum):**
1. Every diagnostic order reaches a terminal state; anything unowned raises `TaskOrphaned` within 5 minutes (SI-03).
2. A critical result cannot be closed without a directory-picked recipient, and a phoned result cannot be closed without read-back.
3. Escalation fires on the configured timers in scenario tests with a simulated clock, including weekends and holidays.
4. Turnaround for every step is computable from events for 100% of orders.
5. External-referrer notification works end to end for outpatient-tier results, including during the outpatient lab downtime protocol (phone with read-back logged on the edge agent, back-entry within 4 h).

### 9.8 Laboratory information system (LIS)

**Release:** R1 core; R1.1 autoverification where the Boundary Register allows (manual technologist validation until then, with delta and critical rules as flags only); P2 microbiology (`DX-MIC-01`) and POCT (`DX-POC-01`, integrate); P3 anatomic pathology (`DX-AP-01`) and ISO 15189 document control (`DX-LAB-06`). **Features:** `DX-LAB-01` (L) worklists, bedside labels, accessioning and tracking; `DX-LAB-02` (L) analysers via middleware; `DX-LAB-03` (L) validation, reports, delta and critical rules, autoverification v1 (Tier 2 part); `DX-LAB-04` (M) QC and lot tracking; `DX-LAB-05` (M) send-outs; the lab-quality pack. **Module:** `lis` (+ `reg-lis-rules`). **Read:** R04 §2; K §4.2, §5.6, §9.1.

**Build:**
- **Pre-analytic:** test catalogue per orderable (specimen, container, minimum volume, stability, priority STAT/ASAP/timed/routine, LOINC order code); ask-at-order-entry questions (fasting, dose time for drug levels); duplicate-order checks; collection lists by unit, collector and time window that consolidate tubes; **bedside collection** on the handheld (scan wristband → print labels on demand → record collector, time and device; labels applied in the patient's presence); labels by tube type and draw order (IHE LBL); transport tracking by scan events (no pneumatic-tube integration); receipt scan with acceptability checks (haemolysis, clotting, insufficient quantity, wrong container, expired stability, unlabelled or mislabelled), a coded rejection reason, and an automatic recollection task to the care team; accessioning with aliquots, routing and storage location for add-ons.
- **Analytic:** host query or download of work orders; results return with instrument flags, QC status, dilutions and reruns; analyser status on the lab workspace; reagent and calibrator lots linked to every result for look-back.
- **Post-analytic:** an exception review queue with the reason highlighted; preliminary, final and corrected reports with a corrected-report trail; reference intervals by age, sex, pregnancy and method; interpretive comments; performing-lab identification; LOINC and UCUM on every result; add-on handling (stability, residual volume, stored tube); reflex rules approved by the lab director; reference-lab send-outs over HL7 v2 or FHIR with PDF fallback, keeping the performing lab's units and ranges; notifiable-disease triggers to the Directorate of Health format.
- **QC:** Westgard rules (1-2s warning; 1-3s, 2-2s, R-4s, 4-1s, 10-x rejection; selection by Sigma metric); Levey-Jennings charts; **QC lockout** (no release while QC has failed or is overdue); patient moving averages; QC frequency configurable per test.
- **Lab-quality pack (ISO 15189-aligned):** EQA enrolment and results; a rejection register; amended-report audit; TAT per test against policy.
- **Autoverification (R1.1, Tier 2, `reg-lis-rules`):** the rule stack in order: instrument error codes and QC status → HIL indices → measurement range and dilution → absurd limits → critical value (to manual review and notification) → delta check → cross-analyte consistency → patient context (dialysis, neonatal, post-transfusion) → release. Each rule has a rationale, validation evidence from simulated and historical cases, a version, and revalidation after any instrument or method change.
- **Patient release:** OTP to the registered mobile plus a knowledge check; single-use link valid ≤72 h; no clinical content in the message body; SI-21-labelled results and pregnancy tests never released by message; every release audited (§9.30).
- **Seam rule (W1-K):** the polyclinic LIS serves only the polyclinic's own patients until hospital A goes live, so a legacy order → our lab → legacy result path never exists (K §13.1c).

**Interfaces:** HL7 v2.5.1 OML/ORM and ORU/OUL (IHE PaLM LTW); analysers through middleware (ASTM E1381/E1394 = CLSI LIS01-A2/LIS02-A2 for legacy; IHE LAW / CLSI AUTO16 as the target, with query mode, echoed AWOS IDs and enhanced acks MSH-15 = NE, MSH-16 = AL); LIVD to seed analyser → LOINC maps.

**Acceptance (minimum):**
1. A specimen cannot be received without a scanned label that matches an order; mislabelled specimens follow the rejection path with a recollection task.
2. No result is released while its analyser's QC is failed or overdue.
3. A corrected result notifies the orderer and everyone who acknowledged the earlier version (R11 §10.5).
4. With autoverification off (the default), every result needs technologist validation; with it on, only results that pass every rule in the stack release, and each release records the rule-set version.
5. Analyser parallel-run tooling compares our results with the legacy path during cutover (K §13.2).

### 9.9 Radiology (RIS) and PACS integration

**Release:** R1 (RIS is in the wedge, KDV-10); P2 dose capture (`DX-RIS-03`) and ECG/endoscopy reports (`DX-CRD-01`, integrate); P3 imaging-AI orchestration. **Never** build a PACS. **Features:** `DX-RIS-01` (L) RIS core; `DX-RIS-02` (M) templates and actionable follow-up; `DX-PAC-01` (M, integrate) PACS link with the open-source viewer labelled non-diagnostic. **Module:** `ris`. **Read:** R04 §4; K §4.2–§4.3, §5.6–§5.7.

**Build:**
1. **Order** with reason and structured indication; duplicate-imaging and prior-study checks.
2. **Protocoling:** protocol, contrast and sedation; CT protocols record indication, contrast, age, size and the expected dose-index range.
3. **Scheduling** by modality, room and resource, with preparation instructions and reminders (trilingual).
4. **Screening at check-in:** MRI safety (implants, devices, foreign bodies, claustrophobia) **with incident capture**; contrast allergy and renal function; pregnancy status.
5. **Modality worklist (MWL):** demographics, accession number, requested procedure; the RIS assigns the Study Instance UID.
6. **MPPS** (in progress / completed / discontinued) drives exam status, technologist documentation, contrast and radiopharmaceutical documentation (dose, lot) and charge capture. Storage commitment confirms archive receipt.
7. **Reconciliation** for trauma and unidentified patients (IHE PIR).
8. **Reading worklist** by urgency, subspecialty and SLA timers, with priors fetched.
9. **Reporting:** structured templates (including RADS families), sign, addenda; measurements and dose auto-populated where available.
10. **Critical and actionable findings** go through the critical-result service (ACR categories: Cat 1 within minutes, Cat 2 within hours, Cat 3 within days).
11. **Incidental-finding follow-up:** recommendation capture, due dates, patient and referrer letters, closure reporting. R04 calls this the biggest gap in many RIS products.
- **Image access:** IHE IID launch from the chart; DICOMweb (QIDO-RS, WADO-RS, STOW-RS); the bundled OHIF viewer always shows a "non-diagnostic" banner; never couple to a proprietary PACS API.

**Interfaces:** IHE SWF.b (HL7 v2 OMI, DICOM MWL, MPPS, Storage Commitment); DICOMweb; IID; FHIR DiagnosticReport and ImagingStudy projections; DICOM SR for measurements.

**Acceptance (minimum):**
1. MWL use ~100% and orphan studies at zero in the integration test bed (a modality simulator plus an Orthanc or dcm4chee container).
2. MRI cannot be marked "screened" without a completed safety screen; an incident can be captured from the exam.
3. A Cat 1 finding follows the critical-result path with a named recipient and read-back.
4. Every incidental-finding recommendation has a due date, an owner and a closure state.

### 9.10 Medication management: formulary, pharmacy, eMAR and BCMA

**Release:** R1 formulary, brand master, outpatient e-prescribing and the outpatient pharmacy POS; R2a inpatient dispensing against transcribed paper orders (control sets B and C); **R2b the closed loop** (CPOE → pharmacist verification → dispensing → eMAR → BCMA, with control set A, and control set C at order entry); P2 Dose Engine, stewardship module, pumps, ADC and chemotherapy; P3 IV compounding. **Features:** `MED-FRM-01` (M) formulary with LASA, tall-man and high-alert flags; `MED-KRI-01` (M) regional brand master and in-house unit-dose labels; `MED-OPP-01` (M) outpatient pharmacy POS; `MED-CS-01` (M) Iraqi narcotics registers; `MED-DSP-01` (L) inpatient dispensing; `MED-PHV-01` (L) pharmacist verification; `MED-MAR-01` (L) eMAR; `MED-BCM-01` (L) mobile offline BCMA; `MED-INF-01` (M) infusion model. P2: `MED-DOSE-01`, `CLN-AMS-01`, `MED-INF-02`, `MED-ADC-01`, `MED-ONC-01`. P3: `MED-IV-01`. **Modules:** `medications` (Safety Kernel), `reg-screening`, `reg-dose` (P2). **Read:** R04 §5; R03 §9; K §4.2, §5.1, §5.6, §8, §12.1.

**Formulary and the regional brand master (R1):**
- Formulary items with LASA, tall-man and high-alert flags; ISMP display rules (no trailing zeros, no naked decimals); P&T status and restrictions (for example antimicrobials needing approval); therapeutic interchange; standardised concentrations; shortage substitution.
- **Regional brand master:** brand → clinical drug → generic and ATC → package GTINs → lot, plus the licensed drug-KB concept. Several GTINs map to one orderable. New products are scan-tested before use. Coverage KPI: unmapped formulary ≤5% at T-90. There is no national drug file [L].
- Typo-tolerant brand↔generic search across regional brands.
- **Drug knowledge base: licensed, never built.** A vendor-neutral adapter (`CLN-CDS-01`) with local re-tiering and regional brand mapping; a synthetic mock KB for development and tests (Q-K8). K first uses the adapter at R2a transcription; this prompt brings `CLN-CDS-01` and the outpatient subset of `CLN-CDS-02` (allergy, interaction, duplicate and dose-range screening shown verbatim) forward to **R1**, because outpatient e-prescribing without screening is unsafe [P]. Record the change in `OPEN-QUESTIONS.md`.

**Outpatient pharmacy POS (R1):** retail sale with batch and expiry; dual-currency payment (§9.21); price checks against KRG price lists if they exist [L]; narcotics registers; stock decrement and charge in one event; labels in the patient's language with drug names in Latin script.

**In-house unit-dose labels:** for imported drugs without a usable barcode, pharmacy prints unit-dose barcode labels that link to the brand master and lot. Label printing is a pharmacist workspace tool.

**Screening (`reg-screening`, Tier 2 presenter):** allergy and cross-sensitivity; drug–drug, drug–disease and duplicates; dose range by measured weight and BSA; renal and hepatic adjustment; pregnancy and lactation; paediatric and neonatal ranges; IV compatibility. KB output is shown verbatim. Alert tiers A–D (§14.3). Safe-regimen defaults: weekly oral methotrexate; vinca alkaloids in minibags only; opioid-tolerance check before extended-release opioids.

**Inpatient dispensing under the Core transcription control set (R2a):** control set B (§10.3) exactly, plus control set C (stewardship) and the patient-supplied medicine workflow. The screen is labelled "dispensing record, not an order or MAR". No MAR or schedule exists at a Core site.

**Pharmacist verification (R2b):** a queue ranked by STAT, first dose, high-alert and time due, with a STAT ≤15-minute timer; interventions with outcome codes; control set A (extended Dose Engine fallback) exactly as §10.3; the pharmacist-cover alarm; emergency and first-dose override paths with retrospective review within 4 h.

**Dispensing:** unit dose or ward stock; returns; charge on dispense or on administration per tenant configuration; perpetual stock across central pharmacy and satellites; GS1 DataMatrix at receipt populates lot and expiry for recalls; FEFO.

**Patient-supplied medicines (R2a onward):** received by pharmacy → identified against the brand master → expiry-checked → relabelled to the patient → flagged "patient-supplied" → only then scannable for administration (SI-12).

**Controlled drugs:** locked, append-only registers (corrections are addenda); perpetual counts; shift reconciliation; witnessed waste; no controlled-drug stock movement offline (SI-15).

**eMAR and BCMA (R2b):**
- eMAR: schedules generated from verified orders; PRN with reassessment tasks; titrations; independent double check for high-alert drugs (SI-13); late-dose windows configurable (tighter for time-critical drugs); holds, refusals and missed doses with reasons.
- BCMA: scan patient wristband and medication (GS1 or in-house label) → five-rights check against the verified order → document. Overrides need a reason that is never defaulted (SI-02). Compliance dashboards by unit and user. BCMA p95 ≤500 ms.
- **Mobile offline BCMA:** an encrypted cache; administration only against orders verified before the outage; server revalidation on reconnect; no last-writer-wins. A dose given offline against an order that was discontinued meanwhile is recorded as a fact and flagged to the prescriber and pharmacist as an owned task (SI-15; §15).
- **Time-critical doses** (STAT and first doses, antimicrobials, insulin, anticoagulants, anticonvulsants) can never be delayed by any payment, deposit or counter rule; they are charged to the running bill (SI-12).
- Scanning extends to ED, OT, recovery, labour and delivery and NICU.
- **Rollout is site-wide only, never unit by unit** (K §13.1). The facility-level clinical tier setting (§6.6) enforces this: the closed loop switches on for the whole facility or not at all.

**Infusion model (`MED-INF-01`, MVP):** infusion orders with rate, volume and concentration; pump-channel association recorded manually; manual rate and volume validation. Pump autoprogramming is P2 (`MED-INF-02`, one vendor, orders never commands, only once BCMA ≥95%).

**Medication reconciliation (R2b, `CLN-MRC-01`):** admission list, comparison, discrepancy resolution and a written discharge list at every level-of-care transition; cannot complete while any item is undecided (SI-09); at an upgrade, transcribed orders and seam medication lists are reconciliation input only.

**P2 and P3:** the Dose Engine (§10.4); the stewardship module (approval workflow, IV-to-PO prompts, bug–drug mismatch alerts, antibiogram at order entry, DOT per 1,000 patient-days); ADC integration (HL7 profiles and formulary to the cabinet; dispense, waste, return and discrepancy back; override review policy); pump integration (IHE PIV, IPEC via the vendor gateway; DERS compliance >95%); chemotherapy (regimens, cycles, cumulative dose, double checks; all BSA/AUC arithmetic inside the Dose Engine); IV compounding (P3).

**Acceptance (minimum):**
1. Property tests: no administration without an active verified order or a documented override (SI-02); high-alert administration impossible without a recorded independent double check (SI-13); offline administration impossible against an order not verified before the outage (SI-15).
2. Control set A: verification of a weight-, BSA-based, high-alert-infusion or neonatal order cannot complete without the pharmacist's independently entered dose and attestation; a mismatch returns the order; seeded 10× errors are stopped.
3. Control set B: no screen at a Core site shows a MAR, schedule or active-medicines list built from transcriptions (UI and API tests).
4. A payment hold on the account never blocks a time-critical dose (property test across the RCM ↔ MAR boundary).
5. An unverified outside medicine cannot be scanned for administration.
6. Static analysis proves no dose arithmetic exists outside `reg-dose` (which is absent in the MVP).
7. The CPOE error-category harness (§18.5) runs on the foundation content; interruptive alerts ≤8 per 100 medication orders on the synthetic replay.

### 9.11 Transfusion

**Release:** R2b. **Features:** `DX-BB-01` (M, Tier 2 part) bedside verification, orders, consent, reactions; `DX-BB-KRI-01` (S) blood-unit receipt and relabelling; `DX-BB-02` blood-bank interface (built as an optional inbound adapter; not assumed, because public blood banks issue on paper [L]); P2 `DX-BB-03a` blood-centre inventory and ISBT 128 labelling (regulated track; `DX-BB-03b`, the compatibility engine, is dropped). **Never:** a compatibility engine, electronic crossmatch, ABO-compatibility assignment or donor workflows. **Modules:** `transfusion`, `reg-transfusion`. **Read:** R04 §3; K SI-11, §5.6; Q-K14.

**Build:**
- **The loop as timed events:** consent → bedside-labelled sample (WBIT detection: a second concordant ABO/Rh determination, historical or from a second sample, configurable) → request → issue → two-person bedside verification → vitals timers → reaction → haemovigilance.
- **Receipt and relabel (default: every unit is relabelled at receipt, the safer reading of K-08 vs SI-11; record the choice in `OPEN-QUESTIONS.md`):** two-person **blind double entry** of unit number, ABO/Rh, product and expiry from the original label and the issue note; the original label is never covered; the new label prints unit number and ABO/Rh beside our barcode; any mismatch quarantines the unit; fridge temperature excursions (building signals) quarantine units.
- **Crossmatch results** from the issuing blood bank are recorded as entered results with their source document; our system never computes compatibility.
- **Bedside verification (T2, `reg-transfusion`)** runs inside the BCMA flow: wristband ↔ unit ↔ order ↔ sample match; two-person electronic witness; hard stop on mismatch; the witness confirms the unit number on the original label.
- **Fallback until T2 is activated:** the scripted two-person check (§10.3).
- Special-requirement flags (irradiated, CMV-safe, washed), returns under time and temperature rules, final disposition and reaction workup are workflow steps whose content the hospital configures [HUMAN].
- One shared ISBT 128 parser and validator (data identifiers, check characters) for future labelled units.

**Acceptance (minimum):** a unit cannot be issued or administered without a matching relabel record and two witness signatures; any field mismatch at receipt quarantines; any identifier mismatch at the bedside is a hard stop; relabel errors are measurable (target 0); WBIT per 1,000 samples is reported.

### 9.12 ADT, beds, patient flow and handoff

**Release:** R2a (ADT, bed board, census, non-blocking discharge clearance); R2b (I-PASS handoff); P2 (transfer centre, RTLS ingestion); P3 (predictive discharge). **Features:** `ACC-ADT-01` (L), `ACC-ADT-02` (M), `OPS-FLW-01` (M), `CLN-HND-01` (M). **Module:** `adt`. **Read:** R03 §3.2, §6; R05 §4.1; R11 §5, §10.1, §10.6.

**Build:**
- **ADT:** pending admission (expected date, level of care); a timestamped decision to admit (level, service, attending, isolation); bed request → assign → ready → arrival, each timed; inpatient versus observation class with a status-change workflow; transfers (bed swap, inter-unit with transfer med rec and handoff, level-of-care, service or attending change); leave of absence (suspends due times, holds the bed, records the return); pending transfer and discharge with an expected discharge date; cancellations with a reason; back-dated events only with supervisor rights and audit; midnight census reconciliation; downtime re-entry keeping clinical time.
- **Location history** is the single source of truth for census, patient-days, bed charges, isolation tracking and outbreak line lists.
- **Bed board:** the bed state machine (§8.4) with EVS cleaning status, gender and isolation constraints, blocks with reasons, and escalation timers from decision-to-admit to patient-in-bed; isolation-room pressure alarms from building signals block assignment.
- **Admission order set:** level of care, attending, diet with religious preferences, activity, VTE assessment, code status, isolation, nursing protocols, admission med rec (R2b).
- **Rounding lists** by team, unit and service: vitals trend, NEWS2, new results, lines and catheter days, VTE status, discharge readiness; the visiting consultant's evening queue (results, co-signs, orders to sign, consults, discharges due; "changes since last note").
- **Consults:** question, urgency, acceptance and response times; the note routes back to the requester.
- **I-PASS handoff (R2b):** Illness severity (stable/watcher/unstable), Patient summary, Action list with owners and due times, Situation awareness and contingencies, Synthesis by the receiver; auto-filled allergies, code status, drips, lines and recent critical results with attribution; printable and mobile sign-out; handoff audit (who handed to whom, when); bedside nursing SBAR.
- **Discharge clearance** runs in parallel and never blocks the clinical discharge order (SI-12); the discharge event creates the bed-cleaning job.

**Acceptance:** two patients can never occupy one bed (database constraint and property test); census and bed-day charges reconcile with location history; a discharge order succeeds with an unpaid balance; I-PASS coverage per shift is measurable.

### 9.13 Nursing

**Release:** R2b (P3: nursing ambient AI through a partner only after S8-K; acuity-based staffing `NUR-STF-01`). **Features:** `NUR-FLW-01` (L) assessments, flowsheets, I&O, lines and devices, charting by exception; `NUR-FLW-02` (M) Braden, Morse and delirium with care-plan triggers; `NUR-CP-01` (M) care plans, shift worklists, handoff; `NUR-WND-01` (S) wound photography; `CLN-BH-01` (S) suicide screening, restraint and seclusion. **Module:** `nursing`. **Read:** R03 §10, §14.4; K §6.5.

**Build:**
- **The shift brain-sheet** (home queue): due, overdue, PRN-eligible, changed, escalations; I-PASS/SBAR generated from the chart.
- **Admission assessment:** history, function, skin, falls, nutrition screen, pain, psychosocial, learning needs, home medicines, devices, isolation screen; validated suicide screening (behavioural-health contexts, age ≥12) with risk level and plan.
- **Shift assessments by exception** against defined normals; reassessment intervals driven by acuity, scores and policy.
- **Flowsheets:** vitals (nurse-entered in R2b; device-captured and nurse-validated from R2.1), I&O with a running balance, lines, drains and airways (insertion date, site, day count, removal), wounds (body map, staging, measurements, consented in-app photos, dressing plan), neuro checks, glucose and insulin, sedation scales. **Flowsheet field governance** is a product feature: a catalogue of fields with owners, retirement and duplication checks.
- **Scores** with components and calculation version: Braden, Morse, delirium (CAM-ICU/4AT), RASS, CPOT, GCS, pain. Braden and Morse care-plan triggers are sweep candidates: until their Boundary Register triage is written, they are **prompts with nurse-chosen actions**.
- **Care plans:** problem → goal → interventions → evaluation, from a governed library.
- **Worklists** from orders, protocols, scores (for example a turning task when Braden indicates risk), the MAR, overdue documentation and escalations, ordered by due time.
- **Restraint and seclusion:** orders with expiry timers, no standing or PRN orders, a face-to-face assessment task, a monitoring flowsheet and discontinuation prompts; time limits are configurable rule packs with source and review date [HUMAN] (the research gives only US values).
- **Language:** each nurse chooses Sorani, Arabic or English for the UI; drug names, doses and units stay in Latin script and Western digits, so a nurse never translates a dose. Screens are sized for staff new to computers.

**Acceptance:** documentation by exception produces a complete legal record; a score with care-plan triggers never auto-orders anything unless the Register says `cleared` or `not-required` for that tenant (tested for `not-assessed`, `required` and `withdrawn`); restraint orders cannot be PRN and expire on schedule; nurse documentation time per shift is measurable (target −20% at 12 months).

### 9.14 Emergency department

**Release:** R2b (the MLC register from R2a); P2 (MCI/disaster mode `CLN-ED-03`; the sepsis screen); P3 (partner triage AI). **Features:** `CLN-ED-01` (L) quick registration, triage, tracking board; `CLN-ED-02` (M) pathway clocks, disposition, boarding view. **Module:** `ed`. **Read:** R03 §5; K §4.3, §9.1.

**Build:**
- **Quick registration** with a pre-allocated alias; **no deposit or payment rule can block ED registration or emergency orders** (SI-12).
- **First-class timestamps,** never inferred from notes: arrival, quick registration, triage start and end, roomed, first provider, first ECG, CT start and read, first antibiotic, lactate and cultures, decision to admit, bed request, assignment and ready, departure, discharge, LWBS (including after triage), against medical advice.
- **Triage:** one configurable scale per tenant (ESI v5, ATS, MTS or CTAS, with their published levels and target times); coded chief complaint, vitals, pain, allergies, pregnancy status, infection screen, suicide screen, falls risk; an algorithmic level suggestion with nurse override and reason; standing protocol orders where policy allows (for example an ECG within 10 minutes for chest pain); re-triage timers for waiting patients. The scale itself is chosen by the hospital [HUMAN].
- **Tracking board:** room, patient (with similar-name flag), age and sex, acuity, complaint, timers (arrival, last vitals, orders pending), doctor and nurse; icons for pending orders, new or critical results, consults, bed requests, isolation, fall risk and sepsis concern; streams (resuscitation, acute, fast track, paediatric, behavioural, results-pending, observation, boarders).
- **Pathway clocks** (workflow timers, not a device): stroke (last known well, NIHSS, code-stroke order set; door-to-needle targets ≤60 min, with stricter tiers), STEMI (first ECG ≤10 min, door-to-balloon ≤90 min), sepsis (visible time zero; the 3-hour and 6-hour bundle elements); trauma activation with a massive-transfusion order set. Thrombolytic dose arithmetic waits for the Dose Engine; until then KB output is shown verbatim under the pharmacist double check (control set A).
- **Consults and disposition:** consult request time and response clocks; discharge, admit (decision time, bed request, I-PASS), transfer out, observation, AMA, LWBS; boarders receive inpatient orders, MAR and nursing assessments.
- **MLC register** entries created from the ED with police-notification timestamps (§9.28).
- **Code documentation** (resuscitation record) feeding resuscitation review.
- **P2 MCI mode:** a command switch; pre-printed barcoded alias bands; triage tags; minimal data sets; location tracking and family reunification; simplified order sets; post-event merge.

**Acceptance:** every timestamp above is captured as an event and reportable; the board updates within 2 s; a patient with an unpaid balance can be registered, triaged, treated and admitted without any payment prompt blocking care.

### 9.15 Perioperative and anaesthesia

**Release:** R2a (OT booking and lists; implants and consumables to charge and stock); R2b (WHO checklist, consent, site marking, intra-op clinical record); R2.1 (anaesthesia pre-assessment and intra-op/PACU record, lite; paper record until then); P2 (full AIMS with device feed `SPC-AN-02`; OR analytics `SPC-OT-04`). **Features:** `SPC-OT-01` (M), `SPC-OT-02` (S), `SPC-OT-03` (M), `SPC-AN-01` (M). **Module:** `periop`. **Read:** R03 §12; K §4.2–§4.3.

**Build:**
- **Case request and scheduling:** procedure, laterality, expected duration (from surgeon history), equipment, implants, blood, anaesthesia type, positioning; block schedules with release times; add-on and urgent classes; preference cards linked to supply. **Privileges gate booking**; **no OT allocation offline** (SI-15).
- **Pre-op assessment:** ASA, airway, comorbidities, cardiac risk, tests, medication instructions (including perioperative anticoagulant protocols), optimisation pathways.
- **eConsent** with procedure-specific risks, patient, witness and clinician signatures, interpreter, versioned forms, displayed in the theatre.
- **Holding-area checklist:** identity, consent, site marking, fasting, allergies, labs, blood availability, implants, antibiotics, H&P, nursing and anaesthesia assessments, imaging. Site marking by the accountable practitioner, with alternatives where marking is impossible.
- **WHO Surgical Safety Checklist** captured by role in real time: sign in (identity, site, procedure, consent, marking, anaesthesia machine and medicines check, oximeter, allergy, airway and aspiration risk, expected blood loss >500 mL or 7 mL/kg in children), time out (introductions, confirmation, critical events, antibiotic prophylaxis within 60 minutes, imaging displayed), sign out (procedure recorded, counts, specimen labels, equipment problems, recovery concerns). **Incision time cannot be recorded before the time out.**
- **Intra-op record:** in-room, anaesthesia start, incision, closure and out-of-room times; personnel; positioning; skin preparation; tourniquet times; counts; barcoded specimens; **implants by UDI scan** (lot, serial) to the patient record, charge and stock; wound class; drains; perioperative syringe labels printed at the anaesthesia workstation.
- **PACU:** recovery scoring, pain and PONV, the anaesthesia-to-PACU handoff, discharge criteria.

**Acceptance:** the time-out cannot be skipped or back-filled silently; an implant scan creates the implant record, stock movement and charge in one transaction; an OT booking by a surgeon without the privilege is refused.

### 9.16 Critical care

**Release:** R2b (ICU flowsheet with nurse-entered vitals; code documentation); R2.1 (validated monitor feed through §9.19); P2 (severity scores `SPC-ICU-02`); P3 (tele-ICU `SPC-ICU-03`). NEWS2 is excluded from ICU by its intended purpose. **Feature:** `SPC-ICU-01` (L). **Module:** `icu`. **Read:** R03 §11.

**Build:** a 24-hour grid with hourly charting; infusions with rate, dose, concentration and units, and titration checked against ordered parameters; hourly I&O balance; lines, drains and airway days; the ventilator bundle (head of bed, sedation and breathing trials, oral care); multidisciplinary rounds with daily goals, line necessity and antibiotic time-out; transfer out with med rec and handoff. High-resolution waveforms, if captured, stay outside the legal record. P2 severity scores (SOFA, APACHE, SAPS) store components. **Never in the primary alarm path.**

**Acceptance:** infusion titrations outside ordered parameters require a reason; the fluid balance reconciles with I&O entries; after R2.1, only nurse-validated device values reach the flowsheet.

### 9.17 Maternity and neonatal

**Release:** R2a (newborn registration, mother–baby link, birth notification); R2b (labour and delivery record; MEOWS where the Register allows; NICU/PICU live with the rest of the site under control set A); P2 (antenatal episode and WHO Labour Care Guide `SPC-MAT-02`; NICU flowsheets, feeds and human-milk tracking `SPC-NIC-01`). **Features:** `SPC-MAT-01` (M). **Module:** `maternity`. **Read:** R03 §13; K §9.1.

**Build:**
- **Obstetric triage** with MEOWS for maternal observations (Register-gated; nurse-calculated fallback).
- **Labour and delivery record:** mode of delivery; times (full dilatation, delivery, placenta); perineal trauma; quantitative blood loss with a PPH bundle; oxytocin and tranexamic acid as high-alert medicines; cord gases; Apgar scores.
- **Newborn:** created automatically at delivery with a shared episode, linked bands and distinct naming (§9.1); assessment, vitamin K, immunisations, feeding, screening, growth.
- **Statutory:** the KRG birth notification at R2a; deaths with ICD-10 cause in the WHO format (§9.28).
- **Postnatal:** maternal observations, VTE assessment, breastfeeding support.
- **NICU basics (R2b):** corrected gestational age; until the Dose Engine (P2), **the system never calculates, converts or rounds a weight-based dose** (SI-05). The KB range is shown verbatim, the pharmacist records an independently calculated dose under control set A (double check on every neonatal order), and the screen displays the entered value and unit (for example to 0.1 mL/h) without recomputing it; NICU goes live with the site, never later.
- The reproductive-health label applies; pregnancy tests are never released by message.
- **P2:** antenatal episode (EDD by LMP versus ultrasound, gravidity and parity, risk category, booking bloods, ultrasound, growth charts, birth plan); the WHO Labour Care Guide (active first stage from 5 cm, time limits configured from the WHO manual, an "alert" column that requires a recorded response); NICU depth (parenteral nutrition, human-milk barcode matching to the infant, growth charts, ventilator integration).

**Acceptance:** mother and baby are linked from the delivery event with distinct identities and bands; the birth notification produces a locked register entry; neonatal orders cannot be verified without the independent double check.

### 9.18 Results management, discharge and care transitions

**Release:** R1 (outpatient result acknowledgement through the diagnostic order lifecycle; critical results, §9.7); R2b (inpatient results inbox, discharge, med rec, transition summaries); P2 (AI discharge drafts in English, `draft-ai`). **Features:** `CLN-RES-01` (M), `CLN-DOC-03` (M), `CLN-MRC-01` (M). **Modules:** `results`, `record`, `medications`. **Read:** R03 §6.4–§6.5, §16, §17.

**Build:**
- **Results inbox:** every result has an ordering and a responsible clinician; abnormal flags; trends and graphs; sort, filter and pools; surrogates for absence; self-reminders; amended results notify and are visibly flagged; **explicit queues for results pending at discharge and results for discharged patients** (SI-17); unacknowledged abnormal results >7 days reported; mobile acknowledgement and critical read-back.
- **Discharge:** an expected discharge date from admission; a readiness checklist (criteria met, medicines ready, teach-back, equipment, transport, follow-up booked); the discharge order with disposition (never blocked by money); the discharge summary (diagnoses, procedures, course, results pending with an owner, medication changes, follow-up); after-visit instructions and the medication list in the patient's language from templates, with new, changed, stopped and unchanged items flagged; transmission to the referrer; post-discharge contact through the front door (no clinical content in messages).
- **Medication reconciliation** (§9.10): best possible medication history with source and last dose; a decision per item at admission, transfer and discharge; cannot complete while any item is undecided (SI-09).
- **Transition summaries:** IPS `$summary` and PDF/A from one source; referral letters and transfer summaries as owned tasks until acknowledged.

**Acceptance:** a result arriving after discharge always lands in an owned queue and raises a task; discharge cannot complete med rec with undecided items; the discharge summary lists every pending result with its owner.

### 9.19 Devices and vitals integration

**Release:** R2.1 (the validated ICU monitor feed). In R2b the ICU flowsheet and ward vitals are nurse-entered, so nothing clinical depends on a device feed before R2.1. P2 IHE ACM consumer and RTLS ingestion (`OPS-RTL-01`); P3 alarm analytics (`DEV-ALM-01`) and SDC (`DEV-SDC-01`). **Never:** alarm forwarding, a nurse-call or RTLS engine; the HMS is never in the primary alarm path. **Features:** `DEV-GW-01` (L) device gateway via middleware with device–patient association; `DEV-VAL-01` (M) nurse validation UX. **Module:** `hub` (gateway) and `nursing`/`icu` (validation). **Read:** R04 §6; R16 §3; K §9.2.

**Build:**
- Consume IHE DEC PCD-01 (HL7 v2 ORU) from vendor middleware, normalised to IEEE 11073-10101 terms; store-and-forward.
- **Association:** scan-to-associate a device to a patient; automatic dissociation on discharge or transfer; the associated patient shown; full audit.
- **Validation:** device data lands unvalidated at a configurable granularity (≈15 min in ICU, on demand on wards); the nurse validates, marks artefacts or edits with a reason; **only validated values are charted and feed scores and CDS**; raw streams are kept separately and summarised, never one row per data point.
- Care-team assignment and ADT feed nurse-call and ACM platforms (P2 consumer of their acknowledgements).

**Acceptance:** no unvalidated device value appears on a flowsheet, in NEWS2 or in CDS; dissociation on transfer is automatic and tested; device → flowsheet latency <1 minute in the test bed.

### 9.20 Revenue cycle core: accounts, ledger, charge router, tariffs and packages

**Release:** R1 (outpatient accounts, charges, tariffs, packages); R2a (inpatient accounts, running bills, discharge billing, OT billing). **Features:** `RCM-ACC-01` (XL) patient account and ledger; `RCM-CHG-01` (L) charge router; `RCM-TAR-01` (L) tariff engine; `OPS-FLW-01` (M, R2a) non-blocking discharge clearance. **Module:** `rcm` (Tier 0, a downstream conformist of clinical events). **Read:** R05 §1, §7, §8, §9; R11 §10.8, §11; K §12; BP §12.

**Principles (non-negotiable):** one patient account across clinical and financial domains; charges come from clinical events through the charge router and clinicians never type charges; an append-only double-entry ledger with reversal links and no in-place updates; everything effective-dated (prices, contracts, code sets, tax rates, edits); clinical truth kept separate from billing representation (bills, packages and claims are derived and can be regenerated); explicit liability transfer between payer and patient buckets; SI-12 at the boundary. Build the charge router early, "even for cash-only MVPs" (R11 §17 #6).

**Data model** (internal aggregates; FHIR only as an edge projection on R6-core payer resources): guarantor and guarantor account; encounter billing account (open, discharged-not-final-billed, billed, closed); coverage with priority order; pre-approval; estimate; charge item (charge code, service date, quantity, unit price from the price list, **performing and ordering practitioner, both mandatory**, local code, cost centre, source-event link, lot/UDI; statuses planned, billable, not-billable, aborted, billed, entered-in-error; override reason); price list; package; payer contract; coding abstract; claim and settlement; liability buckets with balances; financial transactions (charge, payment, adjustment by type, refund, transfer; GL mapping; reversal links; immutable, with functional-currency and original-currency amounts); deposits; patient payments; invoices and statements; denial work items; summarised GL journals; `Money`, exchange-rate table, cashier drawer and shift, and the doctor-fee ledger (K §8).

**Charge router:**
- Rules generate charge items from clinical events, with full traceability: order-driven (on result or verification), documentation-driven (MAR, nursing flowsheets, the OT record with implants, supplies and times), time-based (anaesthesia, OT minutes, observation hours, ventilator days), bed-days from location history, point-of-use GS1 scans, dietary extras. Manual entry is the exception and needs an override reason.
- `ChargeCreated` / `ChargeCredited` events map to HL7 DFT^P03/P11.
- Charge master (CDM): code, description, local code, price per price list, cost centre, GL revenue account, unit of measure, effective dates, statistical-unit flag. The item master carries a chargeable flag and a CDM link.
- **Daily reconciliation** of expected against captured charges by department; late charges (>3 days after service) flagged; an **unbilled-consumption** report (target ≤0.5% of consumption value at 90 days).

**Tariffs and contracts:**
- Price lists × room category × patient category × payer, with inheritance (a base list plus overrides) and effective dating. Types: general, corporate tiers, insurer-specific, international patient, staff, VIP. **IQD lists by default; USD lists behind a tenant setting that stays off until Q-K19 is answered.**
- A payer → plan → contract → terms registry. Contract methods: per diem, % of charges, fee schedule, packages, capitation, carve-outs, stop-loss/outlier, lesser-of logic, implants at invoice plus a percentage.
- One contract engine produces estimates and the **re-pricing replay**: before any tariff, package or payer rule goes live, re-price the last 3–6 months of encounters under the old and new rules; the revenue delta must be explained line by line, with zero unpriced services (K §12.1; R15 §8.2).
- Decision tables for price derivation, package logic, discount approvals, authorisation requirements and claim edits are versioned, simulated and effective-dated (non-device DMN, ADR-017).

**Packages:** fixed price with inclusions, exclusions, length-of-stay limits, room-category multipliers, implant pass-through, overrun rules, a free revisit window and doctor package-share rules; package coverage and leakage reports. The sources name overrun and revisit-window behaviour but do not define it: build both as configurable rules and log the semantics in `OPEN-QUESTIONS.md`.

**Running bill and inpatient billing (R2a):** a day-wise running bill shown against the estimate; room-class tariff multipliers; bed-day charges from location history; per-line payer / patient / non-payable split; discharge billing that never blocks the clinical discharge (financial clearance is separate, SI-12).

**Acceptance (minimum):**
1. Every charge links to a source clinical event and carries ordering and performing practitioners; a property test proves no charge exists without a source or an override reason.
2. The ledger is append-only: corrections are reversals (schema test plus property test).
3. Re-pricing replay on 3 months of synthetic encounters produces an explained delta and zero unpriced services.
4. No RCM state can block an ADT, order, discharge or MAR command (cross-boundary property test, SI-12).

### 9.21 Cashiering, deposits, refunds and dual currency

**Release:** R1; R2a (inpatient deposits and top-ups). **Features:** `KRI-RCM-01` (M) dual-currency cashiering; `RCM-CSH-01`; `KRI-PAY-01` (M) card-terminal and wallet adapters; `DFD-PAY-01` (payment links; wallet links in R1.1); `RCM-TAX-01` (re-scoped to Kurdistan receipt and tax rules). **Module:** `rcm` with the shell HAL for terminals. **Read:** K §8, §12.1; R05 §2.5; R16 §7.

**Build:**
- **Deposits:** set by package or bed category; held in the tendered currency; top-up alerts when the running bill crosses a threshold; transfers between encounters or family members under approval; refund of the unused balance at discharge, reconciled against the final bill; payment links for deposits and top-ups. **No deposit rule can block an ED registration, an emergency order, a discharge order or a time-critical dose** (SI-12; deposits before elective admission remain hospital policy [L]).
- **Estimates:** written, with validity, patient share and separate surgeon and anaesthetist fee lines; variance against actuals tracked.
- **Cashier shifts:** open with a float → transactions by tender (cash, card, wallet, cheque, credit) → close with a **denomination count per currency** → variance approval → handover to the main cash office. Target drawer variance: 0 per currency per shift.
- **Dual currency:** IQD price lists by default; payment in either currency at the posted rate from the effective-dated exchange-rate table (source and timestamp); change given in either currency; cash rounding per tenant (for example to IQD 250 [L]); each payment records tendered currency, amount, rate and change given; the ledger runs in the functional currency with original amounts kept and FX differences posted to the GL export; reconciliation "to the dinar".
- **Discounts, charity and waivers:** approval thresholds by role, amount and percentage; charity or Zakat funds; staff and VIP price lists; reason, approver and policy on every adjustment; audit reports; bad debt and charity tracked separately.
- **Refunds:** to the original instrument where possible; cash refunds need approval thresholds; refund currency is configurable (record the policy question).
- **Receipts:** trilingual; tax lines from a configurable tax engine. Zero rate is a development default only; the live treatment is configured from the tax-counsel opinion required before R1 (Q-K6).
- **Payments:** semi-integrated card terminals through the shell HAL or the cell: the HMS sends amount, reference and type and receives approved/declined, auth code, masked PAN, token and scheme. **No card number ever touches the HMS.** Wallet and QR payment links (R1.1) confirmed by webhook plus status polling, with a static-QR fallback reconciled manually. **Three-way reconciliation** of HMS receipts, terminal batch reports and acquirer or wallet settlement files, with unmatched items in a work queue. During downtime terminals run standalone and references are back-entered into the reconciliation queue; care is never blocked by payment capture.
- **Credit patients and guarantors:** a guarantor (person or organisation) with credit status; payment plans; statements by SMS or print.

**Acceptance (minimum):** a shift cannot close until every currency's count is entered and any variance is approved; a cash-drawer and dual-currency reconciliation drill passes (an RG3 item); the exchange rate used on every payment is the one effective at that instant; no PAN appears anywhere in the database, logs or traces (scanner test).

### 9.22 Doctor fees and payouts

**Release:** R1. **Feature:** `KRI-RCM-02` (M). **Module:** `rcm`, exported through `finance-export`. **Read:** K §8, §12.1.

**Build:** surgeon, anaesthetist and consultant fees as separate charge lines carrying the performing practitioner; package-share rules; payout rules per practitioner and service (percentage, fixed or package share), with the basis (billed or collected, net of payer deductions) configurable per rule because the sources leave it open; a payable sub-ledger per practitioner; settlement cycles and statements; settlement at the cashier where the hospital pays that way; export to accounts payable. **Payables, never payroll. No referral-commission feature of any kind.**

**Acceptance:** each payout statement reconciles to the charge lines that produced it; reversing a charge reverses its fee accrual; there is no data field, rule type or report that pays a referrer.

### 9.23 Corporate, NGO and insurer credit; pre-approvals; claims

**Release:** R1 (manual document packs); R1.1 (document-pack automation); P2 (scheme adapters; AI document-pack assembly). **Features:** `RCM-INS-01` (L; corporate, NGO and insurer credit; document-pack claims); `RCM-DEN-01` (M) denial and rejection queues; `RCM-SCH-01` (corporate credit in the MVP; its government-scheme part in P2); P2 `AI-RCM-01` claim scrubbing. **Module:** `rcm` with a `WorkflowPort` workflow for pre-approval and claims. **Read:** R05 §1.2, §1.8; R11 §10.8; R13 §3.7–§3.8; K §9.1, §12.1.

**Build:**
- **Contracts:** price list per contract; eligibility letters (captured, since there is no eligibility rail); credit limits; co-pay; per-line payer / patient / non-payable splits; deduction-reason codes.
- **Pre-approval** as a first-class entity linked to orders, scheduled procedures, coverage, units, validity dates and payer reference, checked again at claim build. SLA timers pause while a payer query is open; escalation goes to the corporate/insurer desk, never to clinicians; a pre-approval never blocks discharge or emergency care.
- **Credit-claim states:** Intimation → PreApprovalRequested (documents, ICD-10 diagnosis, proposed procedure, estimate, room category) → Query ⇄ QueryResponse (repeatable, clock paused) → PreApprovalApproved (amount, room-rent cap, co-pay, sub-limits) → EnhancementRequested → EnhancementApproved (repeatable) → DischargeAuthRequested (final bill, discharge summary, investigations, pharmacy returns) → FinalApproved (payer-payable, deductions, patient-payable) → ClaimDocsSubmitted → Settled / PartiallySettled / Denied → Reconciliation / Appeal. The generic claim machine (draft → scrubbed → submitted → acknowledged → adjudicated → appealed or resubmitted → closed) sits underneath.
- **Document packs:** PDF plus a structured summary, sent by email or portal; FHIR Claim only where an insurer can accept it. Pack completeness at first submission is tracked (target ≥95%).
- **Statements and receivables:** monthly statements per corporate account; ageing; patient-related corporate receivables in the HMS sub-ledger; corporate DSO tracked (target ≤60 days).
- **Denials:** root-cause queues by category (eligibility, authorisation, coding, medical necessity, timely filing, duplicate, bundling, clinical validation) with SLA timers and appeal templates; root causes feed registration, pre-approval rules and documentation.
- **Scheme abstraction (P2):** one "scheme" object (package master, eligibility check, pre-auth workflow, document checklist, claim format, rate master) plugged in as configuration, ready for national health insurance (Law No. 22 of 2020 [L]); the federal adapter belongs to the Iraq pack.

**Acceptance:** the credit-claim state machine is specified (§8.4), property-tested and approved [HUMAN, by M9 in the business plan]; a pre-approval query pauses and resumes its SLA clock correctly across weekends and holidays; a claim cannot be built for a line outside its pre-approval without a flagged exception.

### 9.24 Clinical coding

**Release:** R2.1 (a manual coding sheet until then). **Features:** `RCM-COD-01` (M; re-scoped to WHO ICD-10; no IHACPA or CPT licences); P2 `RCM-AI-01` AI coding suggestions; P3 `RCM-CST-01` patient-level costing. **Read:** R05 §1.5; K §8, §12.1.

**Build:** a coding workbench on WHO ICD-10 (commercial use needs WHO permission [HUMAN]) with ICD-11 dual coding ready if the KRG adopts it; diagnoses sequenced; code-set versions effective-dated by date of service; never a single "the diagnosis" column; audit sampling and an edit check before final. Procedure classification for insurer claims is unresolved (no CPT): use the local procedure codes of the order catalogue until a decision is logged. AI coding suggestions are P2 from a partner.

### 9.25 Supply chain, stores and procurement

**Release:** R1 (pharmacy and lab stores, consumption-to-charge, controlled-drug registers); R2a (ward stock, OT implants and consumables); R2.1 (procurement-lite breadth, AP/AR); P2 (lite GL, fixed assets, CMMS, CSSD-lite). **Features:** `ERP-INV-01` (L, R1) item master, stores, FEFO, indents, ward stock, consumption-to-charge; `ERP-FIN-01` (M, R1; breadth R2.1) AP/AR and GL export; `ERP-PRC-01` (M, R2.1) procurement-lite; `SPC-OT-03` (R2a) OT implants and consumables to charge and stock. P2: `ERP-IMP-01` implant/UDI capture and recall trace (its consignment bill-only purchase order is pulled into R2.1 with procurement-lite, per K §12.2), `ERP-FIN-02` lite GL and fixed assets, `ERP-FIN-03` enterprise ERP connectors, `ERP-HTM-01` CMMS, `ERP-SVC-01` support services including CSSD-lite, `ERP-HR-02` payroll integration. **Modules:** `supply`, `finance-export`. **Read:** R05 §3; R11 §12; K §12.2.

**Build:**
- **Item master:** code, GTIN, UDI-DI, unit-of-measure conversions (box → each), category, chargeable flag and CDM link, implant flag, lot and serial tracking, storage conditions. Pharmacy items link to the regional brand master.
- **Stock:** store, bin, lot, serial, expiry, quantity, consignment flag; requisitions and transfers with approval; FEFO picking; near-expiry alerts; quarantine of expired or excursion-affected stock (fridge temperature excursions from building signals quarantine vaccine lots and blood units); ward par levels; pharmacy stores with separate ledgers and permissions.
- **Point-of-use capture:** one GS1 scan in the OT documents usage, decrements stock, triggers replenishment and creates the charge.
- **Implants and recall:** UDI-DI plus UDI-PI (lot, serial, expiry) linked to patient, procedure and charge, with recall status. The recall workflow (search by GTIN and lot → locate stock → quarantine → identify affected patients → notify clinicians) is P2 (`ERP-IMP-01`); UDI capture on the intra-op record (SAC-40, `SPC-OT-03`) is MVP, so the data for recall exists from day one.
- **Consignment:** a bill-only purchase order raised on use.
- **Procurement-lite:** requisition → approval with budget check → purchase order → goods receipt → vendor invoice → three-way match within tolerances → payment.
- **Finance export:** accounts payable and patient receivables; **daily summarised GL journals** (revenue by cost centre and payer class, contractual adjustments, cash, bad debt, charity, FX differences) by CSV or API with drill-back, never line-level; a cost-centre hierarchy.
- **Costing data captured from day one:** resource IDs, start and stop timestamps and consumed lots on clinical events (costing itself is P3).
- **Payroll, HCM and time and attendance are always integrated, never built.**

**Acceptance:** an OT implant scan creates the implant record, the stock movement and the charge in one transaction; FEFO picking is enforced; the daily GL journal reconciles to the ledger to the dinar; from P2 (`ERP-IMP-01`), a recall finds every patient who received an affected lot.

### 9.26 Workforce, credentialing and privileges

**Release:** R1 (needed for ordering, charging and fees); P2 rostering. **Features:** `ERP-HR-01` (M, R1) staff master with credentialing and privileging records; `TRU-IAM-02` privilege-gated clinical actions; P2 `ERP-ROS-01` rostering and `ERP-HR-02` payroll/HR integration; P3 `NUR-STF-01` acuity-based staffing. **Module:** `workforce`. **Read:** R05 §3.5; K §8, §12.2.

**Build:** the staff master with typed practitioner identifiers [L] (syndicate number, KRG or federal practice licence, board certificates), each with period and assigner; primary-source verification records; expiry alerts and an automatic block from scheduling and ordering when a licence expires; delineated privileges per procedure and per hospital; **privilege checks gate order entry and OT booking**; competencies; the visiting-consultant flag; role and unit assignment feeding care-team assignment (ADR-024). Basic rostering (self-scheduling, float pool, on-call, skill mix) in P2; acuity-based staffing in P3.

**Acceptance:** an order or OT booking by a practitioner without the needed privilege is refused with a clear reason; an expired licence blocks new orders immediately and raises a task to medical administration.

### 9.27 Health information management and the legal record

**Release:** R2b (legal health record, deficiencies, manual release-of-information register); R2.1 (release-of-information workflow automation, coding in §9.24). **Feature:** `CLN-DOC-04` (L). **Modules:** `him`, `record`. **Read:** R07 §8; K §10.1; §13.4 of this prompt.

**Build:** the per-tenant legal health record definition and release rendering (§13.4); **deficiency tracking** (unsigned notes, missing co-signatures, incomplete discharge summaries) as owned queues with SLA timers; chart scanning and indexing into DocumentReference with barcode cover sheets and OCR indexing; patient-requested amendments as addenda with a statement of disagreement; the release-of-information register (intake, identity and authority checks, redaction of sensitivity-labelled content, disclosure log, SLA timers), automated in R2.1; retention schedules and legal holds; a record-review sampler for quality audits; court-evidence export with hash, audit trail and certificate template; the HIM view of the EMPI steward queue.

**Acceptance:** a signed note can never be altered, only amended or marked entered-in-error (SI-06); a release containing labelled content is redacted unless purpose and authority allow it, and every disclosure is logged; a legal hold blocks destruction on every copy, including backups.

### 9.28 Statutory registers and Ministry reporting

**Release:** R1 (narcotics registers, notifiable diseases, KRG outpatient returns); R1.1 (DHIS2); R2a (MLC register, births, deaths, inpatient returns); R2.1 (secondary returns); P2 (wider public-health reporting, `INT-PH-01`). **Features:** `OPS-STAT-01`, `OPS-STAT-02`, `KRI-STAT-02`, `SPC-DTH-01`, `SPC-MAT-01` (birth notification), `MED-CS-01`. **Module:** `statutory`. **Read:** K §8, §9.1; §11.5 of this prompt.

**Build:**
- A **register framework:** locked, append-only entries; corrections only as addenda; per-format exports; required-time SLA timers (target: 100% of entries within the required times); access logging on locked records, with MLC entries carrying the forensic/MLC sensitivity label.
- **MLC register** fed from ED and ADT, with police-notification timestamps.
- **Narcotics registers** fed from controlled-drug movements (§9.10).
- **Births** from newborn registration; **deaths** with ICD-10 cause of death in the WHO certificate format and a mortuary register.
- **Notifiable diseases** triggered from LIS results and coded diagnoses through a configurable rule list approved by the hospital [HUMAN].
- **KRG returns** generated from the indicator catalogue (§9.31); **DHIS2** data-value sets through the Web API if the KRG uses it. Formats load as configuration when the Ministry supplies them (Q-K3).

**Acceptance:** a register entry cannot be edited or deleted through any channel; a sample KRG return and a DHIS2 payload validate against their configured formats; a notifiable result creates a report task with an owner and a due time.

### 9.29 Quality, incidents, accreditation and the safety dashboard

**Release:** R1 (incident reporting, measure engine); R2b (JCI and KRG packs complete; safety dashboard for Clinical Safety KPIs); P2 (evidence packs and EMRAM readiness, `IMP-MAT-01`). **Features:** `CLN-INC-01`, `CLN-QI-01`, `TRU-REG-02` (hazard-log UI). **Module:** `quality`. **Read:** K §5.8, §17; BP §5.8.

**Build:**
- **Incident and safety-event reporting** with an anonymous option, categories, severity, an optional patient or encounter link, RCA workflow and CAPA tracking. A "system-attributable sentinel event" flag notifies the Safety Board, which can freeze new go-lives until the CAPA closes [HUMAN].
- **The accreditation-pack engine:** chapter → standard → measurable element → evidence query or attestation → KPI (numerator, denominator, sampling) → manual fallback. Packs: JCI 8th edition first, then KRG licensing and inspection checklists [L]. The system computes numerators and denominators; manual entry is the minimum fallback.
- **The safety dashboard**, live from hour 0 of every go-live: BCMA scan compliance; overrides by user and unit; orphaned work; critical results within policy (including external referrers); extended double-check completion; pharmacist-cover alarms; time-critical doses delayed by payment (target 0); transfusion bedside verification, WBIT and relabel errors; NEWS2 escalations within policy; interruptive alerts per 100 medication orders; EMPI duplicates and overlays; statutory registers on time; system-attributable sentinel events.

**JCI traceability (K §5.8):**

| Requirement | Feature | SI | Evidence produced |
|---|---|---|---|
| IPSG.1 patient identification | EMPI; trilingual wristbands; BCMA | 01, 08, 16 | Scan compliance by unit; duplicate and overlay reports |
| IPSG.2 critical results | Critical-result service, including external referrers | 04 | Timeliness and read-back log |
| IPSG.3 high-alert medications | High-alert and LASA flags; double checks | 13 | Double-check completion |
| IPSG.4 safe surgery | WHO checklist; site marking; time-out | — | Checklist completion |
| IPSG.6 falls | Morse with care-plan prompts | 03 | Assessment completion; falls per 1,000 bed-days |
| MMU medication management | Verification; med rec; controlled-drug registers; extended dosing double check | 05, 09 | Med-rec and double-check completion |
| MOI information management | Append-only record; legal health record; continuity drills | 06, 10, 15 | Record-review and drill reports with measured recovery |
| KRG licensing indicators [L] | Measure engine; statutory registers | — | Monthly returns |

**Acceptance:** every dashboard KPI is computed from source events and reconciles with a hand count on synthetic data; each JCI row's evidence query runs and produces its report.

### 9.30 Patient and referrer front door

**Release:** R1 (messaging without an account, report release, trilingual outputs); R1.1 (booking and wallet payment links); P2 (patient app, teleconsultation, CRM, referrer portal, IVR); P3 (remote monitoring). **Features:** `DFD-MSG-01`, `KRI-MSG-01`, `DFD-REC-01`, `DFD-BOK-01`, `DFD-PAY-01`; P2 `DFD-APP-01`, `DFD-TEL-01`, `DFD-CRM-01`; P3 `DFD-RPM-01`. **Module:** `front-door`. **Read:** R09 §7; K §9.1–§9.2.

**Build:**
- **One channel-agnostic engagement engine:** journeys (reminders, preparation instructions, result-ready notices, payment requests, follow-ups), trilingual templates in Sorani, Badini, Arabic and English, per-channel consent (opt-in), delivery receipts, and channels WhatsApp Business, Viber and SMS. No patient account is needed.
- **The report-release rule (all channels):** OTP to the registered mobile **plus** a knowledge check when the link is opened; single-use links valid ≤72 h; **no clinical content in message bodies**; SI-21-labelled results and pregnancy tests are never released by message; an "expect a call" flag holds release for results a clinician wants to explain first; every release is audited (BALP).
- **Shutdowns:** SMS goes through the per-site GSM/SMPP gateway; critical messages go by voice call; central adapters queue store-and-forward for ≥7 days.
- **Booking links** (rules-based self-scheduling) and **payment links** for deposits, top-ups and bills, confirmed by webhook (R1.1). Queue status by message.
- **P2:** the patient app (records, messaging, proxy access with identity proofing, refills), teleconsultation with booking and billing, a CRM and international-patient desk, a referrer portal **with no commission features**, and an IVR under the same release rule.

**Acceptance:** a message body never contains clinical content (template linter and payload tests); a labelled result is never offered for release; a link works once and expires at 72 h; during a simulated internet cut, SMS leaves through the site gateway and central messages queue, then send in order when the internet returns.

### 9.31 MIS, dashboards and reporting

**Release:** R1 (MIS basics, owner dashboard); R1.1 (MIS breadth); P2 command-centre data. **Features:** `OPS-MIS-01` (M), `AI-DAT-01` (M) reporting replica and report builder, `AI-DAT-02a` (M) central CDC bronze landing; P2 `OPS-CMD-01`, `AI-DAT-02b`. **Module:** `analytics` on the reporting replica. **Read:** R05 §5; K §6.1, §11.1.

**Build:**
- **One indicator catalogue** drives dashboards, accreditation measures and statutory returns: each indicator has a definition, numerator and denominator, data source, period, disaggregations and target.
- **The owner's daily dashboard:** revenue and collections by currency; unbilled consumption (leakage); deposits outstanding; corporate receivables; occupancy; safety KPIs.
- MIS basics: daily revenue and collections, payer mix (self-pay, corporate, NGO, insurer), occupancy and ALOS, receivables ageing, statutory returns; departmental P&L and productivity in R1.1.
- A report builder on the replica, with row-level security by facility, department and role; exports audited and watermarked.

**Acceptance:** every dashboard figure reconciles to the ledger or the clinical record for the same period; dashboards render from the replica without touching the transactional database.

### 9.32 Migration Workbench, foundation content and go-live tooling

**Release:** R1 (all, for the wedge); R2b (inpatient cutover pack); R2.1 (governance intake, `IMP-GOV-01`); P2 (partner academy tooling, `IMP-CRT-01`). **Features:** `IMP-FND-01`, `IMP-MIG-01`, `IMP-RDY-01`, `IMP-TRN-01`, `IMP-TEL-01`, `IMP-SUP-01`. **Module:** `migration` (public APIs only). **Read:** R15 §9–§10; K §13.

**Build:**
- **Migration Workbench:** connectors (JDBC for Oracle, SQL Server, PostgreSQL and MySQL; CSV/SFTP; HL7 v2 archive replay; FHIR Bulk; DICOM metadata); staging and profiling (null rates, code distributions, date anomalies); a mapping studio producing ConceptMaps to ICD-10, LOINC, UCUM, ATC and the regional brand master; EMPI pre-match with gold-set tooling and a steward queue; loaders that go **through domain APIs only** (idempotent, re-runnable, `migrated` provenance, original clinical times; every SI applies to loaders too); reconciliation dashboards with the accounting identity and a clinician sample-review app; opening balances (deposits and packages per currency reconciled to the dinar, corporate receivables); a pharmacy count app (GS1 scanning, witnessed controlled-drug counts); the active-order assistant (pharmacist pre-build, prescriber signs at go-live); a cutover orchestrator (a `WorkflowPort` runbook with go/no-go checkpoints); and the **Legacy Data Viewer** in patient context.
- **Paper-site packs:** most Kurdistan sites start from paper plus a local billing or pharmacy program, so "migration" is mostly a master-data build from foundation content and the hospital's own lists, plus patient-index seeding from the billing system with EMPI pre-match.
- **Foundation content tooling:** load, diff and adopt the Kurdistan foundation content; a deviation log that alarms above 10%; content always flagged NOT FOR CLINICAL USE until approved [HUMAN].
- **Readiness tooling:** the readiness scorecard; RG1–RG4 evidence templates (§18.13); cutover and rehearsal runbooks; rollback tooling for the three levels; model-ward and UAT kits (scripts mapped to hazards, synthetic patients, expected results, sign-off forms, a pre-filled deployment hazard log for the customer's CSO, an interface pack, a downtime-drill script, an upgrade regression subset).
- **Training:** the TRAIN environment with synthetic patients and role sandboxes; micro-learning; proficiency tracking in three languages.
- **Telemetry:** clinician time and task telemetry, micro-surveys, SUS and NEES capture for the T-120 baselines.
- **Support:** service-desk integration and a status page (built and run locally; publishing it is a [HUMAN] decision, §3.7).

**Acceptance:** a mock conversion on synthetic legacy data reaches the accounting identity at 100% with every reject coded; the cutover orchestrator runs a dry-run end to end with checkpoints; the Legacy Data Viewer opens in patient context with audit.

### 9.33 Other ancillary services

| Service | Phase | Scope |
|---|---|---|
| Dietary | R2b (`SPC-DIE-01`) | Diet orders with religious preferences, NPO, therapeutic diets, allergy propagation to tray tickets; patient charges for extras. Diet kitchen operations in P2 (`ERP-SVC-01`) |
| POCT | P2 (integrate, `DX-POC-01`) | POCT01 data manager; result filing; operator and QC lockouts; unmatched-result queue |
| ECG and endoscopy reports | P2 (integrate, `DX-CRD-01`) | Orders and report display; DICOM waveform / HL7 aECG |
| CSSD-lite | P2 (`ERP-SVC-01`) | Set and load tracking; OT links set and load IDs to the case; recall by load |
| Rehabilitation (PT/OT/speech) | P2 (`SPC-REH-01`) | Referral, evaluation, plan of care, notes, scheduling |
| Dialysis | P3 (`SPC-DIA-01`) | Documentation; machines via the device gateway; in-unit BCMA |

---

## 10. Regulated modules and safety tooling

**Why device-grade rigour where no regulator asks** (K §5.6): the hazards are identical wherever the software runs; hospital due diligence and international accreditation look for it; and a later Gulf export needs it. Process: IEC 62304 Class B-equivalent for Tier 1 (ADT/EMPI, CPOE, eMAR/BCMA, results routing, downtime) and Class C for Tier 2; ISO 14971 risk management; IEC 62366-1 usability engineering; IEC 82304-1; IEC 81001-5-1 secure development. Tier 0 (billing, ERP, HR, BI) follows the standard SDLC (K §5.4; BP §5.4). Read: R15 §2–§8; K §5; BP §5.

### 10.1 The hazard log service (TRU-REG-02)

Build it in Phase 0 as data plus a CI gate, and grow it into a service with UI in Phase 1.
- **Hazard record:** ID; title; description; causes; effects; initial severity, likelihood and risk; controls (each typed as design, protective or information, with implementation references and the IDs of the tests that verify it); residual risk; status; owner; linked features, invariants, incidents and releases.
- **Story link:** every backlog item carries a safety-impact field. "Possible" or "yes" opens CSO triage with a 2-working-day SLA timer. **Safety valve:** if more than 10% of triages miss the target in a month, C1 and C2 promotion pauses until the backlog clears (K §5.3).
- **CI gate:** each control carries `state: planned | implemented | verified`. Seeded controls start as `planned`. Promotion of a release is blocked while any control for a feature in that release is not `verified` with passing test IDs in `verified_by`. Never change a state to make a gate pass.
- **Human fields:** CSO triage, risk acceptance (status `accepted`) and approvals are written only from a human sign-off record (§3.5).
- **Release outputs, generated:** the Clinical Safety Case Report and the Release Evidence Pack (safety case, SBOM/VEX, test results, regulatory-impact assessment, known anomalies, Boundary Register state).
- **Customer outputs:** DCB0160-style deployment-case and UAT kits per hospital; field safety notices in FSN format within 24 hours of confirmation; the known-anomalies list; the annual Safety Performance Report.
- **One Safety Event pipeline** carries safety tickets, telemetry anomalies, AI issue reports (P2, with model, prompt and sources) and security incidents.
- **[HUMAN]** CSO triage, risk acceptance, safety case sign-off, the weekly Safety Board and its release veto, sentinel-event attribution by the joint panel.

### 10.2 The Regulatory Boundary Register (SI-18)

- **Entry per function and version:** function; intended purpose (written for the minimum class); tier; jurisdiction (KRG, federal Iraq, later others); status (`not-assessed`, `required`, `not-required`, `cleared`, `withdrawn`); fallback control set; evidence.
- **Evidence for activation (K-05):** a written local opinion (KRG Ministry of Health and counsel) that no registration applies, or the registration itself, with its scope (function, intended purpose, version, jurisdiction) and expiry (24 months, or on any change); the safety case; the hospital's clinical-governance sign-off; **independent-assessor concurrence** for the first activation of each Tier 2 function and each major version at any customer, and for every activation at customers #1–3; product-liability insurance naming the function. Federal Iraq sites need a federal Ministry opinion.
- **Mechanics:** the flag service asks the Register before enabling any Tier 2 function; a configuration toggle cannot override it. Activation is a C2 change. Expiry or withdrawal reverts the site to the fallback control set and raises tasks.
- Seed the Register with every Tier 2 function and the "sweep candidates" (VTE prompts, Braden/Morse care-plan triggers, the critical-result escalation chain, NEWS2 frequency scheduling, the imaging viewer) (K §5.6).

### 10.3 Fallback control sets (built, tested and active in the MVP)

Each fallback is pre-built, hazard-logged and signed by the Chief CSO [HUMAN]. Where a fallback removes an automated protection, a named manual control set replaces it; it is never simply left off (BP §5.6).

**A. Extended Dose Engine fallback** (every Clinical Safety site until the Dose Engine is active there; K §5.6):
1. A system-enforced, documented independent pharmacist double check on every weight- or BSA-based dose at any age, every high-alert infusion and every neonatal order. Verification cannot complete until the pharmacist records an independently calculated dose and attests that it matches the order. A mismatch returns the order to the prescriber. **The system performs no dose arithmetic** (the definition and the narrow allowed comparisons are in §2.1).
2. A drug-KB result ≥10× the maximum dose is a **Tier A hard stop**, with the KB output shown verbatim.
3. Seeded adult and paediatric 10× and unit errors are part of every integrated test cycle (ship them as test assets).
4. An alarm when no pharmacist is logged in to the verification queue for more than 30 minutes; a pharmacist review task within 4 hours of any dose given before verification.
5. Core sites apply item 1 at transcription.
6. 24×7 pharmacist cover is an RG1 obligation at Clinical Safety sites [HUMAN].
Live KPIs: double-check completion 100%; intercepted dose errors; STAT neonatal verification time.

**B. Core transcription control set** (R2a; K §4.2):
- only pharmacists transcribe, with an image of the signed paper order attached;
- drug-KB allergy, interaction and dose screening runs at transcription, plus the dosing double check from A;
- the ordering practitioner is mandatory, so result and task routing works;
- high-alert and paediatric orders get a second check;
- **no MAR, schedule or "active medicines" view is built from transcribed orders;** the screen is labelled "dispensing record, not an order or MAR";
- transcribed orders are reconciliation input only at the Clinical Safety upgrade;
- an audit tool samples 50 transcribed orders a month.

**C. Stewardship control set** (until CLN-AMS-01 in P2; K §5.2): restricted antimicrobials need an indication and an approver at order entry (Clinical Safety) or transcription (Core); a mandatory 48–72 h time-out task goes to the prescriber; every antimicrobial order carries a stop or review date; a monthly DDD/DOT report from dispensing data; a named hospital stewardship lead at RG1 [HUMAN].

**D. Other fallbacks** (K §5.6):

| Function | Fallback |
|---|---|
| NEWS2/PEWS/MEOWS | Electronic observation charting; nurse-calculated score; nurse-assigned escalation tasks; observation frequency set by the nurse, never by a score |
| Bedside transfusion verification (T2) | Scripted two-person check: identifiers scanned and shown side by side; both electronic signatures required; no automated pass/fail; the witness confirms the unit number on the original label |
| LIS autoverification and interpretive rules | Manual technologist validation; delta and critical rules shown as flags only |
| Screening presenter | Drug-KB screening shown verbatim |
| Sweep candidates | Prompts with clinician-chosen actions; imaging viewer labelled non-diagnostic |
| Sepsis rules (P2) | Pathway clocks and a non-scoring checklist |
| Pump autoprogramming (P2) | Manual pump programming with a BCMA scan |
| AI documentation (P2) | Manual documentation |

### 10.4 Tier 2 module engineering

- **Isolation:** each Tier 2 module is a separately versioned, process-isolated sidecar on the same node as the core, with a pure-function, schema-versioned API, its own SBOM, SOUP list and release train, and a deterministic fail-safe ("unavailable, manual check required", never "pass"). A local call costs milliseconds, well inside the 500 ms CDS and BCMA budgets (BP §5.5).
- **Display:** regulated values are rendered only by Tier 2-owned UI components with render-integrity checks. CPOE and MAR screens host these components but never compute or reformat regulated values.
- **Calculators:** native, guideline-verbatim, deterministic code. No rules engine inside the device boundary. 100% boundary-value tests; mutation testing; every result stores components, total and calculation version.
- **Intended purposes** are written for the minimum class. NEWS2 "calculates and displays the score and components from nurse-validated discrete observations on non-ICU wards … and creates escalation tasks according to the hospital's configured policy". Nothing "detects" or "predicts". ICU use is excluded.

| Module | Phase | Scope |
|---|---|---|
| `reg-ews` (Regulated Module #1) | R2b, where the Register allows | NEWS2, PEWS and MEOWS on non-ICU wards from nurse-validated observations; escalation tasks per hospital policy; frequency scheduling only if the Register entry covers it. The PEWS and MEOWS variant used is chosen by the hospital and approved by the CSO [HUMAN] |
| `reg-transfusion` (T2) | R2b | Wristband ↔ unit ↔ order ↔ sample matching; two-person electronic witness; hard stop on mismatch; checks on relabelled units (SI-11) |
| `reg-screening` | R1 (outpatient e-prescribing, [P]); R2a at transcription; R2b full inpatient. Its Register entry, with the KB vendor's written regulatory position, is required before wedge RG1 | Presentation and local tiering of the licensed drug-KB's interaction, allergy and dose-range results; output verbatim |
| `reg-lis-rules` | R1.1, where the Register allows | Autoverification, delta checks, interpretive rules |
| `reg-dose` (the Dose Engine) | P2 (≈GA wave) | Weight- and BSA-based dosing, rounding, maximum-dose and 10×/100× checks, paediatric and neonatal logic, UCUM throughout. Activation is a C2 change with ≥4 weeks of shadow running visible only to pharmacists; the NICU double check stays for 3 months after activation |
| Sepsis screen (Regulated Module #2) | P2, after Module #1 is live | Rule-based screen; pathway clocks meanwhile |

### 10.5 IEC 62304 software safety class per module (R15 §2.3)

Class C means a failure could still contribute to death or serious injury after external controls act. Tier 0 (billing, ERP, HR, BI) follows the standard SDLC.

| Module | Tier | Class | External controls relied on |
|---|---|---|---|
| ADT, EMPI merge/unmerge | 1 | B | HIM steward queue; reversible merges |
| CPOE and order lifecycle | 1 | B | Pharmacist verification; result-closure tracking |
| eMAR and BCMA | 1 | B | Wristband and product barcodes; nurse judgement |
| Interaction, allergy and dose-range screening presenter | 2 | B | Pharmacist verification; the KB vendor's own controls |
| Weight/BSA dose calculation (Dose Engine, P2) | 2 | **C** | None reliable at 03:00; 10× errors are lethal |
| NEWS2/PEWS/MEOWS with escalation | 2 | B | Nurse observation and manual escalation |
| Sepsis rules (P2) | 2 | B (C if it ever placed autonomous orders, which it must not) | Clinician review |
| Bedside transfusion verification (T2) | 2 | **C** | The two-person check is the only other barrier |
| Pump autoprogramming (P2) | 1–2 | C-level rigour | Pump DERS; confirmation at the pump |
| AI documentation (P2) | 1 | B | Mandatory clinician sign-off |

K §5.4 asks for a Class C process for all of Tier 2; apply Class C rigour to every Tier 2 module regardless of its assessed class. A documented segregation and class-propagation analysis shows the Safety Kernel stays Class B (§5.2).

---

## 11. The Kurdistan pack

One owned pack with a product manager (K-26). Country behaviour is data, never a fork. Everything here is configuration with K's defaults, and every [L] value is listed in `ASSUMPTIONS.md` until confirmed.

### 11.1 Languages and scripts (KRI-LOC-01, KRI-LOC-02, PLT-UX-03)

- Three UI languages per user (English, Sorani, Arabic). Each patient's preferred output language is captured at registration. Clinical content (orders, results, notes) is English. Patient outputs are in the patient's language, from approved templates (Sorani, Badini in Arabic script, Arabic, English).
- **Sorani:** font coverage, printer shaping, collation and search normalisation for پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە, and the Arabic versus Kurdish forms of ي/ی, ك/ک and ه/ە. Spike S7-K tests this on the target printers and produces the Kurdistan Supported Hardware List.
- **Badini:** patient templates are reviewed by Duhok staff [HUMAN]. Latin-script Kurmanji output only if Q-K17 requires it.
- **Digits:** Western digits always for clinical numerals; Eastern Arabic-Indic digits configurable for non-clinical numbers in patient-facing Kurdish and Arabic text.
- **Localisation is a release gate:** clinician-reviewed translation [HUMAN]; **zero untranslated strings in clinical paths** across all three languages; a translation memory owned by the content team.

### 11.2 Identity (KRI-ID-01; replaces ACC-ID-02's content)

- **Identifier types [L]:** Iraqi Unified National Card number; older civil ID and nationality certificate; Kurdistan residency card; passport (ICAO 9303 MRZ); UNHCR registration and IDP documents; hospital MRN with check digit. Typed with system, value, type, period and assigner.
- **Capture from the document** (barcode, MRZ or OCR), never typed, with identity verification recorded separately ("verify later": no online verification service is assumed, Q-K12).
- **Mobile number** is contact data and a matching feature, never an identifier (phones are often shared within a family).
- **Names:** given, father's, grandfather's and family or tribal name; the mother's full name as an identifying attribute; Kurdish (Arabic script), Arabic and Latin forms, with transliteration variants stored and a display name per locale; search across scripts.
- **Birth date** with a precision flag (exact, year only, estimated). Placeholder dates such as 1 January or 1 July carry low weight in matching.
- **Matching:** Fellegi–Sunter with a document-number shortcut; Kurdish and Arabic character normalisation; transliteration dictionaries (Muhammad/Mohammed/Mihemed and similar); higher weight on father's and grandfather's names, the mother's name and DOB precision (tuned in S14-K).
- **Special identities:** alias pools for trauma, mass-casualty incidents and downtime; newborn naming "Baby of [mother]" (cut NICU wrong-patient orders by 36.3%, R03 §3.1).
- **Targets:** duplicates <1%, **zero overlays**, auto-merge precision ≥99.9% on a 2,000-pair cross-script gold set (K §8).

### 11.3 Practitioners (ERP staff master; K §8)

Typed identifiers [L]: syndicate number for doctors, pharmacists and nurses; KRG or federal Ministry practice licence; board certificates (Kurdistan Board, Iraqi Board of the Iraqi Council for Medical Specializations, Arab Board, foreign boards). Privileges per hospital gate order entry and OT booking. A **visiting-consultant** flag. Every charge carries the ordering and performing practitioner (needed for doctor-fee payouts).

### 11.4 Money (KRI-RCM-01; §9 Revenue)

ISO 4217 amounts (IQD, USD) as decimals; an effective-dated exchange-rate table with source and timestamp; per-payment tendered currency, amount, rate and change given (possibly in the other currency); cash rounding per tenant; per-currency drawers; the ledger in the tenant's functional currency with original amounts kept and FX differences posted to the GL export. **IQD price lists by default**; USD prices, deposits and contracts only where Q-K19 / L-33 confirms they are allowed.

### 11.5 Statutory registers and reporting (OPS-STAT-01, OPS-STAT-02, KRI-STAT-02)

Locked, append-only registers whose corrections are addenda: the **MLC register** with police-notification timestamps; **narcotics registers**; **birth and death notifications** on KRG forms (death certificate with ICD-10 cause of death in the WHO format); **notifiable diseases** from LIS results and diagnoses, in the Directorate of Health's surveillance format; **KRG Ministry returns** from an indicator catalogue; **DHIS2** data-value sets through the DHIS2 Web API if the KRG uses it (R1.1). Formats arrive as configuration when the Ministry supplies them (Q-K3); build the framework first.

### 11.6 Messaging and payments (KRI-MSG-01, KRI-PAY-01)

- WhatsApp Business, Viber and local SMS gateways, with trilingual templates. A **per-site GSM/SMPP gateway** that does not use the internet carries SMS during shutdowns; critical messages go by voice call. Central adapters queue store-and-forward for ≥7 days.
- Semi-integrated card terminals (no card number ever touches the HMS); wallet and QR payment links (example providers [L]: FIB, FastPay, ZainCash, Qi Card; partners chosen by Q-K10); three-way reconciliation of receipts, terminal batches and acquirer or wallet files.

### 11.7 Calendars

Gregorian; Friday–Saturday weekend; Kurdistan holidays (Newroz on 21 March, the Eids and others) in tenant calendars; calendar-aware SLA timers. Hijri display optional. Ramadan mode (fasting-aware medication timing templates) in P2.

### 11.8 Accreditation and licensing packs (`CLN-QI-01`)

The accreditation-pack engine models chapter → standard → measurable element → evidence query → KPI (numerator, denominator, sampling) → manual fallback. Ship in this order: **JCI 8th edition** (configuration), **KRG Ministry licensing and inspection checklists** [L], the WHO Patient Safety Friendly Hospital Initiative if the KRG uses it [L], Iraqi federal standards at Wave 2 (K §5.8).

### 11.9 Kurdistan foundation content (IMP-FND-01)

Formulary with regional brands; order catalogues; charge-master and package templates; trilingual forms; lab definitions and analyser maps; the 13 master-data sets (§8.6). Target ≥90% adoption per customer, with a deviation log that alarms above 10%. Until clinicians and pharmacists approve real content [HUMAN], ship synthetic sample content flagged **NOT FOR CLINICAL USE**.

### 11.10 Iraq federal pack (P2, ≤40 PM)

Federal Ministry returns; the federal health insurance scheme adapter (rollout reportedly begun [L]); federal practitioner registration fields; an Arabic-first content review with Baghdad users (K §3.4).

---

## 12. Integration and interoperability

The native Integration Hub owns every interface; it runs inside each cell, with central adapters at the central site (ADR-014; K §9). R06: "An HMS without a strong v2/MLLP engine cannot be sold anywhere." Read: R06 §3, §7, §8; R16 §2, §4–§10, §12, §14; K §9.

### 12.1 Channel operations (every channel, no exceptions)

- An owner, visible acknowledgement state, an owned dead-letter queue that alarms at 5 minutes, and a replay console. **Zero silent drops** (the VA failure sent >11,000 orders to an unknown queue).
- Store-and-forward with ordered replay and idempotency keys; per-patient ordering (A08 never overtakes A01); message-level audit retention.
- War-room dashboards for go-lives: queue age, unacknowledged messages, error rates per channel.
- Optional customer engines (Eclipse OIE or the hospital's own) are allowed for site transforms only, under a patch-lag policy. No hard dependency on Mirth Connect or any cloud-only FHIR service.

### 12.2 HL7 v2 engine (`INT-ENG-01`, R1)

- Accept 2.3–2.8 as dialects with one conformance profile per interface; tolerate Z-segments.
- Original (AA/AE/AR) and enhanced (CA/CE/CR via MSH-15/16) acknowledgements; MLLP over TLS across network zones; MSH-10 idempotency.
- v2-to-FHIR mappings follow the HL7 v2-to-FHIR IG only, never private mappings.
- **MVP message baseline:** ADT (A01–A08, A11–A13, A21–A27, A28/A31, A40/A47, A60), orders (ORM^O01, OML^O21/O33/O35, OMG^O19, OMI^O23 with ORL/ORG/ORI), results (ORU^R01, OUL^R22), scheduling (SIU^S12–S26), charges (DFT^P03/P11), documents (MDM^T01–T11), pharmacy (RDE^O11, RDS^O13, RAS^O17, RGV^O15), immunisation (VXU^V04), master files (MFN), referrals (REF/RRI), PIX/PDQ queries (QBP/RSP).

### 12.3 FHIR façade (`INT-FHIR-01`; read API in R1, SMART/Bulk/Subscriptions in R1.1)

- A projection service keeps a materialised R4 store for read and search, `$export`, `$summary`, `$docref` and Subscriptions. It is generated from domain events (constitution rule 4).
- Writes are accepted only for Appointment, QuestionnaireResponse, DocumentReference, device/patient Observation, Consent and Task, and each becomes a domain command; nothing writes into the projection directly.
- **Profiles:** IPA 1.1 as the default patient-access API; SMART App Launch 2.2 (`.well-known/smart-configuration`, EHR and standalone launch, v2 scopes, `private_key_jwt`, PKCE S256 only, Backend Services, token introspection); Bulk Data `$export` (system, Patient, Group) as async NDJSON; topic-based Subscriptions through the R5 backport; **IPS 2.0.1 `$summary` from day one** (`INT-IPS-01`, R1).
- REST features: conditional create and update for idempotent interfaces, history, batch/transaction, chaining, `_include`/`_revinclude`, `_has`, `$everything`, `$validate`, `$match`.
- Pin IG versions and validate in CI with the HL7 validator. Several FHIR versions can run side by side (R4 now, R6 when needed); skip R4B and R5 as server targets.
- CDS Hooks 2.0.1 for third-party CDS and FHIRcast 3.0.0 for context sync are P2.

### 12.4 Documents (`INT-DOC-01`, R1)

PDF/A and FHIR documents generated from one source; recent paper charts scanned to PDF/A with document references (§9.32); every document carries its provenance and, once signed, a hash.

### 12.5 Imaging, laboratory and device standards

- **Imaging:** DICOM MWL (C-FIND) provider, MPPS receiver, Storage Commitment, DICOMweb client (QIDO-RS, WADO-RS, STOW-RS), IHE IID launch, OMI/ORU with the RIS; plan for IHE SWF.b, PIR and IOCM. The imaging tier is integrated: dcm4chee or an unmodified Orthanc container, with the OHIF viewer labelled non-diagnostic.
- **Laboratory:** analysers through vendor middleware (ASTM/CLSI LIS01-A2/LIS02-A2 for legacy; IHE LAW / CLSI AUTO16 as the target, query mode); LOINC orders and results, UCUM units; manufacturer LIVD files imported to seed analyser maps; reference-lab send-outs over HL7 v2 or FHIR with PDF fallback.
- **Devices:** gateway ORU^R01 under IHE DEC PCD-01, coded in IEEE 11073-10101; IHE ACM, PIV and IPEC in P2; SDC/SDPi on the roadmap only.

### 12.6 Identity, audit and consent interfaces

- EMPI exposes PIX/PDQ (v2) and PIXm/PDQm and `$match` (FHIR) with match grades, and emits A40/A47 and FHIR `Patient.link` events.
- ATNA (TLS syslog, node authentication) and BALP AuditEvents; Provenance for authors, devices and AI agents.
- Consent as FHIR Consent with purpose-of-use and security labels.
- There is no national exchange to connect to in Kurdistan [L]. Follow R06's no-regret path: IPS everywhere, an OpenHIE-style point-of-service posture, and a thin Kurdistan pack that holds identifier URIs, endpoints, consent rules and residency policy.

### 12.7 The Kurdistan pack interfaces (K §9.1)

| Partner [L] | Interface | Release |
|---|---|---|
| KRG Ministry of Health | Statistical returns from the indicator catalogue (formats as configuration, Q-K3) | R1 outpatient; R2a inpatient |
| Directorate of Health surveillance | Notifiable diseases from LIS results and diagnoses; WHONET/GLASS export with microbiology | R1; P2 |
| DHIS2, if the KRG uses it | Data-value sets through the DHIS2 Web API (`KRI-STAT-02`) | R1.1 |
| Civil registration | Birth and death notifications; death certificate with ICD-10 cause in the WHO format | R2a |
| Police | MLC register with notification timestamps (locked) | R2a |
| Insurers, corporates, NGOs | Pre-approval and claims by document pack (PDF plus structured summary) over email or portal; FHIR Claim where an insurer can take it | R1; automation R1.1 |
| Card acquirers and wallets | Semi-integrated terminals; wallet and QR payment links; settlement files for three-way reconciliation | R1; wallet links R1.1 |
| Messaging | WhatsApp Business, Viber, local SMS gateways; a per-site GSM/SMPP gateway for shutdowns | R1 |
| Identity documents | National card barcode/OCR, residency card, passport MRZ; no online verification ("verify later") | R1 |
| Public blood banks | Paper or label issue; units relabelled at receipt; optional inbound adapter (`DX-BB-02`) only if a bank ever supports one | R2b |
| Reference laboratories | HL7 v2 or FHIR send-outs, PDF fallback | R1 |
| Hospital accounting software | Daily summarised GL journals (CSV or API) with drill-back; never line-level | R1 |
| Iraq federal pack | Federal Ministry returns; federal health insurance scheme adapter | P2 |

### 12.8 Facility, peripheral and hardware integration (R16; K §9.2)

**Three planes; each integration lives in the lowest plane that meets its downtime need** (ADR-011). Wristband printing is never cloud-only.

| Plane | Runs on | MVP | P2 | Never |
|---|---|---|---|---|
| **A. Workstation shell (Tauri HAL)** | Each PC, kiosk or thin client | Silent wristband and label printing rendered per printer DPI with Sorani/Arabic shaping (`^PA`, `^CI28`) or `^GF` raster fallback, golden-image tests; HID-POS scanners preserving GS1 FNC1/GS; document scanning (TWAIN/WIA) into DocumentReference; camera; ID-card barcode and passport MRZ readers; badge tap-to-switch ≤2 s; on-glass signature | Signature pads | — |
| **B. On-site cell (hospitals) or site edge agent (outpatient tier)** | The cell, or a hardened appliance | Queue state; ESC/POS token printers; RTL HTML signage; print spool; analyser and monitor bridge via middleware; semi-integrated card terminals; one VLAN per device class; building signals (mains, generator, UPS); fridge-temperature excursions quarantining blood units and vaccine lots; the per-site GSM/SMPP SMS gateway | IHE ACM consumer; RTLS ingestion | Pneumatic tube |
| **C. Central adapters** | Central site | WhatsApp, Viber and SMS under the report-release rule (§9.30); wallet payment links; KRG returns; DHIS2 | IVR (same release rule) | Alarm, nurse-call or RTLS engines |

**The HAL contract** (a versioned bridge; every call returns a typed result and an audit ID): `hal.print.label / raw / document()`, `hal.scan.onBarcode / document()`, `hal.id.read({type})`, `hal.auth.onBadge()`, `hal.sign.capture()`, `hal.pay.request()`, `hal.camera.photo()`, `hal.kiosk.lock()`, and `hal.capabilities()`, which reports the devices attached, healthy and permitted for this workstation profile and user. Drivers are signed plugins that load only if signature and policy allow. The shell caches templates, the unit's wristband queue and downtime accounts, and can print to USB with no network. With no shell present, the UI degrades to the site print service.

**Canonical events:** `StaffAssignmentChanged` (feeds nurse call and communications platforms), `AlertAcknowledged` from ACM platforms (P2), `EnvironmentExcursion`, `DeviceStatusChanged`, `TokenIssued / Called / Served / Recalled`, `IdentityVerified`, `PaymentCaptured / Refunded / Failed`, `PrintJobCompleted / Failed` (with template version).

**Rules** (R16 §17; K §9.2):
- No card PAN ever touches the HMS; three-way reconciliation of receipts, terminal batches and acquirer or wallet files.
- Care-team assignment is a core domain and feeds nurse call. The HMS feeds ADT and staff assignment to nurse-call and ACM platforms and consumes their acknowledgements, but **is never in the primary alarm path**.
- `IdentityVerified {method, assurance level, source, timestamp, operator, evidence hash, result}` is stored as provenance, separate from the identity record. Lookups never block registration. Raw biometrics are never stored.
- Wristbands carry ≥2 identifiers and a barcode (DataMatrix with MRN and encounter); newborn names are never truncated; the first band after any template or printer change is scan-verified.
- Badge tap goes reader → shell → Keycloak step-up bound to the workstation certificate → session swap in <2 s; co-signature, controlled drugs and break-the-glass need tap plus PIN.
- Building-system data is context only (isolation-room pressure loss blocks bed assignment; med-gas alarms show a unit banner); the HMS is never the annunciator.
- A **Kurdistan Supported Hardware List** with in-country service from a hardware partner; messaging passed through at cost plus a capped margin.

**Peripheral downtime behaviour** (R16 §12, read through K §7.9): wristband and label printing must work from the cell or edge cache, and from the shell's USB fallback if the edge is down; local ID reads keep working; BCMA uses its time-bounded offline cache; messaging queues (never time-critical alerts); terminals run standalone into the reconciliation queue; online ID lookups never block registration; fridge quarantine back-dates on reconnect. Encode this matrix in the hazard log and test every degraded mode before go-live.

**Acceptance (minimum, §12):** conformance profiles exist and pass for every MVP message type; a chaos test that drops a downstream system raises the dead-letter alarm within 5 minutes and replays in order with no duplicates; FHIR projections pass the validator for every exposed profile; `$summary` produces a valid IPS for a synthetic inpatient; golden-image print tests pass for Sorani, Arabic and English wristbands on every printer model on the Supported Hardware List.

---

## 13. Security, privacy and the medico-legal record

**Frame.** Every module uses the Trust Plane's shared services and touches data only through the Policy and Audit SDKs (ADR-013). R07 calls retrofitting segmentation and audit "the industry's most expensive mistake", so it is built in Phase 0. **MUST** means release-blocking at GA; **SHOULD** means within 12 months of GA (R07 §5). In Kurdistan every MUST applies except four US-only items: IA-4, CN-3, AP-1 and AI-1 (K §10). Read: R07 §5, §6, §8, §9; K §10.

### 13.1 The controls baseline (R07 §5, filtered for Kurdistan)

| Area | MUST (build all of these) | SHOULD |
|---|---|---|
| **Identity** | **IA-1** OIDC/SAML federation with the hospital IdP, SCIM, deprovisioning within minutes, no local workforce passwords. **IA-2** phishing-resistant MFA (FIDO2/passkeys, smartcards) for remote, privileged, admin, vendor and developer access; never SMS codes. **IA-3** badge tap-and-go with PIN, fast user switching (≤2 s), session roaming, proximity/inactivity lock, kiosk mode. **IA-5** unique IDs, no shared or default accounts, workload identities instead of static service keys. **IA-6** vendor privileged access with JIT elevation, approval, session recording, a customer-visible log and **mandatory customer lockbox approval** (K §10). **IA-7** step-up authentication for break-the-glass, bulk export, admin policy changes and key operations; badge + PIN for co-signature and controlled drugs. **IA-9** portal identity proofing and proxy access (from P2, when the patient app arrives). **IA-10** Argon2id/bcrypt, secrets never logged. **IA-11** help-desk identity verification before any reset, logged and alerted. *IA-4 (US EPCS) dropped* | **IA-8** risk-based authentication, token binding, one-click session revocation |
| **Authorisation** | **AZ-1** one policy decision point (RBAC + ABAC: facility, department, encounter, care team, time, device trust, purpose) enforced server-side on every API, search, report, print and export. **AZ-2** care-relationship access, otherwise a reason prompt or break-the-glass. **AZ-3** confidentiality codes and sensitivity labels propagated to documents, results, orders, messages, prints, FHIR `meta.security` and analytics (SI-21 labels, plus employee-as-patient). **AZ-4** break-the-glass: reason code and text, time-boxed and scope-limited, immediate privacy-office notice, review within one working day. **AZ-5** field-level masking, confidential demographics, "restricted patient" mode. **AZ-6** scoping by group, legal entity and facility. **AZ-7** purpose-of-use on every access and disclosure | **AZ-8** patient-directed restrictions with emergency override |
| **Consent** | **CN-1** consent registry (FHIR Consent-shaped): treatment eConsent by the performing clinician, messaging consent per channel, research opt-in, optional guardian or co-signer. **CN-2** consent enforced at the policy enforcement point for interfaces, FHIR, exports and analytics, not only in the UI. *CN-3 (US) dropped; the release-of-information disclosure log stays* | **CN-4** patient access-transparency view (P2) |
| **Audit** | **AU-1** every view, create, update, delete, print, export, search, login, failed access, consent change, break-the-glass and admin change, with who/what/when/where/why/outcome, time from the cell's NTP source. **AU-2** FHIR AuditEvent per IHE BALP; ATNA syslog for legacy; OpenTelemetry for system events. **AU-3** append-only, hash-chained WORM store that tenant admins cannot disable, with integrity reports; chain heads are periodically anchored to the object-lock store and the DR site (never to a public service, §3.7). **AU-4** retention configurable per log class (no Kurdistan figure yet; default to the 25-year record floor for clinical-access audit) [L]. **AU-5** free near-real-time SIEM streaming. **AU-6** privacy analytics (household, coworker, neighbour, VIP, employee-patient, terminated user, high volume, after hours) with case management. **AU-7** patient- and user-centric audit reports (one-year patient access report in ≤5 s), export with chain of custody, legal-hold integration | **AU-8** patient-visible access log (P2) |
| **Data protection** | **DP-1** TLS 1.2+ (prefer 1.3) externally, mTLS internally, no plaintext MLLP on untrusted networks. **DP-2** AES-256 at rest for every store, including indexes, caches, queues, logs, backups and analytics copies. **DP-3** per-tenant envelope keys, rotation, crypto-shredding (ADR-008). **DP-5** secrets vault, rotation, CI detection. **DP-6** no unmanaged local PHI; encrypted, policy-controlled offline stores; remote wipe. **DP-8** export throttles and approvals; print and PDF watermarking (user, time, patient); bulk-export anomaly detection; mobile clipboard and screenshot limits; egress monitoring. **DP-9** retention and legal-hold engine with deletion certificates; never auto-delete (§13.4) | **DP-4** BYOK; **DP-7** application-layer encryption of national IDs and the most sensitive results; **DP-10** de-identification service |
| **Platform** | **PL-1** hard blast radius per cell; database per tenant; RLS in the pooled tier; per-tenant keys; noisy-neighbour limits. **PL-2** identical controls in every topology. **PL-3** PHI-free control plane; scrubbed telemetry; support reaches data only inside the cell. **PL-4** infrastructure as code, immutable images, CIS baselines, drift detection. **PL-5** separate environments; no production PHI outside production | — |
| **Secure development** | **SD-1** IEC 81001-5-1 + NIST SSDF; STRIDE and LINDDUN threat models per epic; security requirements traced. **SD-2** CI gates: SAST, SCA, secrets, IaC and container scans, DAST on staging, two-person review by humans (an AI review is recorded as automated review and never counts as the second person, §3.5), protected branches. **SD-3** SBOM and VEX for every release. **SD-5** memory-safe languages; framework-level injection and XSS defences. **SD-6** OWASP ASVS L2 (L3 for authentication, authorisation, break-the-glass, admin and PHI APIs), MASVS, API Top 10. **SD-7** public vulnerability-disclosure policy with safe harbour; CVEs. **SD-8** critical/KEV fixes ≤7 days centrally and ≤14 days on site; high ≤30 days; signed updates. **SD-9** continuous scanning. **SD-10** independent penetration test annually and after major change. **SD-11** sub-processor and open-source governance; exit plans | **SD-4** Sigstore signing and SLSA L3 provenance (we adopt it now, §4.1) |
| **APIs and integration** | **AP-3** gateway with rate limits, schema validation, bulk-anomaly detection, per-client quotas, partner mTLS. **AP-4** interface engine with TLS, journaling, replay, owned dead-letter queues, PHI-minimised logs. *AP-1 (US) dropped, but the FHIR façade still implements SMART 2.2 with PKCE (§12)* | **AP-2** SMART Backend Services for system clients |
| **Endpoints and devices** | **EN-1** browser-first and signed desktop clients without local admin. **EN-2** mobile MDM/MAM, attestation, root detection, encrypted storage, no PHI in push, biometric unlock bound to device keys. **EN-3** segmented device gateway (VLAN per device class, no device-to-internet path, read-only by default). **EN-4** downtime printing of wristbands, specimen labels and MAR that works with the core down | — |
| **AI** (from P2) | **AI-2** oversight UX showing inputs and basis; never auto-execute; capture accept/override reasons. **AI-3** log AI inputs, outputs, versions and user actions. **AI-4** no PHI to external models without a DPA, a counsel opinion and the SI-20 processor entry; prompt-injection defences; provenance labels. **AI-5** versioned rollback. *AI-1 (US ONC) dropped; its substance is built through G1–G2 (§17.3)* | — |

**Conflict to record in `OPEN-QUESTIONS.md`:** AU-6 privacy analytics is MUST at GA in K §10 but listed as P2 in K §4.3. Interim default: build rules-based privacy reports (VIP, break-the-glass, employee-as-patient, after-hours, high-volume) and case management by R2b; the advanced analytics and the patient-visible log follow in P2.

### 13.2 Kurdistan additions (K §10)

- **Physical:** locked server room with an access log and tamper alerts; encrypted disks with TPM-sealed keys escrowed at the DR site; no local admin accounts; remote wipe for a stolen node; hardware only from the Supported Hardware List.
- **Vendor access:** JIT access with session recording; customer lockbox approval of every session; a customer-visible support-access log; outbound-only management.
- **Field-engineer break-glass during internet cuts** (ADR-027): on-site co-sign by the hospital IT lead or CSO; single-use sealed credentials rotated after use; operations plane only; a recorded session the customer reviews within 5 working days.
- **Insider and VIP risk:** a VIP label for public figures and officials; break-the-glass reviewed within one working day; monthly access reports to the hospital's privacy lead.
- **Ransomware:** immutable backups on site and at the DR site with ≥90 days of restore points; clean-room rebuild; quarterly restore tests; an annual cyber-recovery exercise; a published 72-hour T0 objective.
- **Breach notification:** the hospital is notified within 24 hours of a confirmed breach. No statutory clock is known [L]; incident playbooks hold clock values as configuration.

### 13.3 Privacy by contract, consent and residency (K §10)

- **Roles:** the hospital is the controller; we are the processor; sub-processors are bound by the same terms.
- **Lawful basis:** health care under professional secrecy. Consent is not the basis for core record-keeping; messaging, research and secondary use are opt-in.
- **Patient rights tooling:** record access; corrections by addendum, never overwrite; a patient-visible access log in P2; a DPIA kit per hospital (data-flow maps, processing records).
- **Residency (SI-20):** usable PHI stays in the on-site cell and the Kurdistan DR site. Offshore ciphertext backups need a counsel opinion and hospital approval; offshore AI inference additionally needs a Safety Board processor entry. Default until Q-K2 is answered: nothing offshore. Egress tests run on every release.

### 13.4 The medico-legal record (R07 §8; K §10.1)

| Topic | Build |
|---|---|
| Legal health record | Defined per tenant: which documents, results, images, messages, audit metadata and device data belong to it. Release rendering as paginated PDF/A plus a structured export, with version history and signature manifestation |
| Entry metadata | Author, authenticator, signature time, clinical event time, entry time (late and downtime entries flagged), versions, amendment links, source and device provenance (SI-10) |
| Signatures | Simple electronic signatures with strong authentication, intent, manifestation, linkage and audit; co-signature workflows; badge + PIN for co-signature; on-glass signing in the MVP, signature pads in P2; a **pluggable signature-provider port** in case Iraqi law requires qualified signatures (Q-K5) |
| Amendments | Signed entries are never overwritten or deleted. Corrections are linked new versions with reason, author and time; the original stays viewable. Patient-requested amendments become an addendum with a flag and a statement of disagreement. Wrong-patient documentation is moved under a controlled, audited workflow that sends corrected messages downstream (SI-06) |
| Retention | **Never auto-delete.** A 25-year floor until Kurdistan rules are confirmed. Destruction needs a schedule, an approval and a legal-hold check. The engine covers backups, archives, indexes and analytics copies |
| Legal hold | By patient, encounter, user or date range; suspends purges on every copy; preserves versions and audit trails; records custodian and chain of custody; overrides every schedule |
| Release of information | Request intake; identity and authority checks; redaction of sensitivity-labelled content; disclosure log; SLA timers. A manual register until R2.1, then workflow automation |
| Court evidence | Exports carry a hash, the audit trail and a certificate template, once local admissibility rules are confirmed (Q-K5) |

### 13.5 Device and peripheral security (R16 §11)

- A VLAN per device class (nurse call, BMS, POS, printers, kiosks, analysers, monitors). The on-site cell, or the site edge agent at outpatient sites, is the only bridge to HMS services; traffic to the central site is outbound mTLS only.
- A device certificate per shell or kiosk, bound to a logical workstation record (location, printers, kiosk mode, allowed devices).
- Partners supply firmware notes, SBOMs, a CVE process and an end-of-support date; the device registry correlates SBOMs with vulnerability feeds. Our shell and edge agent ship signed, with SBOMs.
- Shell capabilities (raw print, ID read, payment) are granted per workstation profile and role, and every call is audited. No arbitrary native code can be reached from the web layer.
- Kiosk hardening (P2): assigned-access OS, no local admin, auto-logout, privacy screens, tamper sensors, PCI PTS PIN pads only.

### 13.6 Never

Trackers or session replay on authenticated pages; PHI in logs, analytics, push notifications or third-party SaaS; PHI to an external LLM without a DPA, a counsel opinion and the SI-20 processor entry; a single external dependency (lab, payment, messaging) without a degraded mode; "HIPAA/GDPR certified" or any other certification claim we do not hold (R07 §9.4; K §10).

---

## 14. UX, design system and localisation

**Principle:** slow is unsafe, and noisy is unsafe. Only 38% of implementations "hit the mark", and 75% of clinicians dissatisfied at go-live are still dissatisfied two years later (R10 §2). Kurdistan users will compare us with the Middle East's best KLAS results, not with paper (K §6). Experience targets are release blockers. Read: K §6; BP §6; R10 §2–§3; R03 §15.

### 14.1 Role-based workspaces (each has an owned home queue)

| Workspace | Home queue | Signature tools |
|---|---|---|
| OPD consultant (often visiting) | Token-driven patient queue | One-screen visit; favourites and order chips; brand↔generic e-prescribing with regional brands; median documentation ≤90 s for a follow-up [E] |
| Inpatient physician, including visiting consultants on evening rounds | Results, co-signs, orders to sign, consults, discharges due | Tablet-first rounds; order sets; verbal orders with read-back and co-sign timers; I-PASS; "changes since last note" |
| Nurse | Shift brain-sheet: due, overdue, PRN-eligible, changed, escalations | Mobile BCMA; charting by exception; validated vitals; NEWS2 tasks; UI language per nurse |
| Pharmacist (inpatient and outpatient retail) | Verification queue ranked by STAT and high-alert; OP sales | Extended double-check workflow; screening tiers; narcotics registers; STAT ≤15 min timer; unit-dose label printing |
| Lab and radiology (including outpatient front desks) | Accession worklists, QC, critical calls | Analyser status; read-back logger to internal and external doctors; RIS protocoling |
| Cashier | Deposits, top-ups, running bills, discount approvals, refunds | Dual-currency drawer; exchange-rate display; per-currency shift close; doctor-fee settlement |
| Corporate / insurer desk | Pre-approvals, credit limits, statements, ageing | Document packs; per-line payer/patient split; deduction reasons |
| Owner / managing director | Daily dashboard | Revenue and collections by currency; unbilled consumption (leakage); deposits outstanding; corporate receivables; occupancy; safety KPIs |
| HIM / quality / CSO | Deficiencies; merge steward queue; incidents; JCI KPIs | Hazard log; safety dashboard; evidence packs |
| Registration / front desk | Arrivals, tokens, ID capture | Document scan (card barcode, MRZ, OCR); duplicate warnings; wristband and label printing |
| Stores | Indents, receipts, expiries | FEFO picking; GRN; consumption review |

### 14.2 Design system rules

One design system on React Aria primitives; keyboard-first with a command palette; typo-tolerant brand↔generic search across regional brands; density modes; no stacked modals; identical sign and co-sign patterns everywhere. **Defaults never select a dose, route or patient.** Clinical numerals are always Western digits. The banner (SI-16) is a design-system component, not a per-screen implementation (K §6.2).

### 14.3 Alert-fatigue strategy (CDS tiers)

| Tier | Behaviour | Budget |
|---|---|---|
| A | Hard stop, from the governed list only | ≤20 rules |
| B | Interruptive, reason required (never defaulted) | ≤8 per 100 medication orders at go-live; ≤5 by month 12 |
| C | Inline, passive | — |
| D | Routed to the pharmacist queue | — |

The vendor-validated baseline is interruptive from day 0 (a first site has no order history to replay). New or locally modified rules run silent for 2–4 weeks first. Rules with >90% override are reviewed, never auto-retired; Tier A/B are exempt from retirement on override rate. The CPOE error-category harness (§18.5) runs on customer content after every KB or content release (K §6.3).

### 14.4 Performance and usability targets (release blockers)

| Metric | Target |
|---|---|
| Login / tap-to-switch | ≤5 s / ≤2 s p95 |
| Warm screen / cold chart open p95 on the on-site cell | ≤1.0 s / ≤1.5 s |
| BFF p95 / p99 | 300 / 800 ms |
| Patient search p95; order sign with CDS p95; BCMA scan-to-confirm p95 | 200 ms; 1.5 s (≤500 ms per CDS service, failing open with a banner except hard stops); 500 ms |
| Pooled-tier core flows on a poor network | Usable at 1 Mbps / 300 ms RTT |
| Task time vs previous release | A >10% regression on a critical task blocks release |
| SUS physicians / nurses (each site's T-120 baseline) | ≥68 / ≥72 at 12 months; ≥72 / ≥75 at 24 months; and at least baseline +10 [HUMAN measurement] |
| Nurse documentation minutes per shift | −20% at 12 months [HUMAN measurement] |
| Accessibility | WCAG 2.2 AA on every workspace, with a low-bandwidth mode for patient-facing pages (BP §6.7; R09 §7.8) |

### 14.5 Documentation burden

Notes are synthesis, not accumulation: composed from structured data, with span-level provenance and copy-forward visibly marked. Clinical text is English; patient-facing text is in the patient's language. A Kurdistan documentation profile free of US billing norms. A team inbox with pools (K §6.4).

### 14.6 Nursing first

Design around the shift: brain-sheet, worklists, I-PASS/SBAR generated from the chart, charting by exception. Flowsheet field governance is a product feature (Mercy saved 32 minutes per nurse per day). Device vitals are validated, not transcribed. Nurses choose Sorani, Arabic or English for the UI; drug names, doses and units stay in Latin script and Western digits in every language, so a nurse never translates a dose. Screens and training are sized for staff new to computers (K §6.5).

### 14.7 Localisation engineering (with §11.1)

- CSS logical properties; `dir` from the locale; bidi isolation tests for mixed strings (a Sorani name + an English drug + a dose + a unit); RTL screenshot diffs on every release.
- Pseudo-localisation in CI (expanded strings, RTL mirroring) to catch truncation and hard-coded text.
- Culture: chaperone documentation and guardian or co-signer consent in R2b; same-gender clinician preference in scheduling and Ramadan mode in P2.

---

## 15. Mobile

**One React Native app with two modes** (K §6.6; R09 §8):
- **Nurse mode:** BCMA (wristband, GS1 DataMatrix and in-house unit-dose labels), bedside specimen labelling, vitals capture with device association, wound photos, worklist, PRN reassessment, escalation tasks.
- **Physician mode:** result acknowledgement, critical-result read-back, patient-context secure chat, tablet rounds, co-signature of verbal orders.

**Offline and security rules:**
- The offline store is encrypted (SQLCipher) and holds only what the unit needs.
- Offline administration is allowed only against orders verified before the outage (SI-15). On reconnect every offline command is revalidated by the server; there is no last-writer-wins merge.
- **An administration that happened is a fact.** If the order was discontinued or changed during the outage, the dose is recorded as given (with its real clinical time) and flagged to the prescriber and pharmacist as an owned task. It is never silently dropped and never overwritten (R08 §6.3).
- Facts are append-only, so they never conflict. State transitions sync as commands. Offline registrations take identifiers only from the pre-allocated, site-prefixed downtime blocks (SI-15, SAC-06) and go to a reconciliation queue. Nothing generates an MRN or encounter number outside a block. CRDT-style merging is allowed only for draft note text and UI preferences.
- No new prescribing offline; no controlled-drug stock movement offline.
- Notifications carry no PHI. Photos go straight to the server-side file store and are not kept in the device gallery.
- Shared ward devices are MDM-managed. Physician mode on a personal phone requires an MDM work profile.
- Spike S9-K proves the offline-BCMA conflict model against the real on-site cell before R2b (ADR-012).

---

## 16. On-site cell, fleet, DR and downtime engineering

Read: K §7.8–§7.11; R08 §6; R16 §12, §14; R07 §6.

### 16.1 The on-site cell product (PLT-SITE-01, PLT-OPS-02, PLT-PWR-01)

- **Installer:** one command installs a cell from signed artefacts onto three nodes from the Supported Hardware List (k3s or RKE2, CloudNativePG with three instances and quorum synchronous replication, Strimzi Kafka or NATS, Temporal, Keycloak, OpenFGA, the HMS, Tier 2 sidecars, the Hub, print/queue/device bridges, the reporting replica, terminology and drug-KB snapshots, the OpenTelemetry collector). It verifies signatures, hardware, UPS signalling, time source and network before it starts.
- **Burn-in suite:** failover tests, a power-cut test, a WAN-cut test and the 300-bed day at customer sizing, producing an RG1/RG2 evidence report.
- **Fleet console** (central): inventory of cells, versions (N/N-1 drift), health, backups, replication lag, licences, certificates, hardware alarms, ring assignment.
- **Updates:** pulled over an outbound channel in staged rings; signed offline media with pinned keys and anti-rollback for cells that cannot reach us; database migrations always roll back to N-1; a site may defer one train.
- **Licensing and certificates** tolerate ≥90 days without call-home, with no lockout.
- **Power (ADR-026):** UPS and generator status as building signals; graceful, ordered shutdown below 10 minutes of UPS; crash-safe storage; clients autosave.
- **Time (ADR-026):** GPS or stratum-1 NTP per cell; skew >1 s alarms; a node >5 s out is blocked from clinical writes.
- **Break-glass (ADR-027):** co-signed, single-use, sealed credentials for field engineers when the internet is down; operations plane only; session recorded for customer review.
- **Physical security:** encrypted disks with TPM-sealed keys escrowed at the DR site; no local admin accounts; tamper alerts; remote wipe for a stolen node.

### 16.2 Backup, replication and recovery

- Quorum synchronous replication inside the cell (three PostgreSQL instances; a commit waits for one of the two standbys and never degrades to asynchronous): RPO 0 when any one node fails, RTO ≤5 min engineering (≤15 min contract). Losing two nodes stops writes rather than risking data.
- Asynchronous encrypted replication to the DR site's warm standby: RPO ≤15 min while replication is up; lag >15 min alarms the hospital. During an internet cut the standby falls behind, so the real recovery point equals the length of the cut.
- Immutable backups on site (object-lock NAS in a separate fire compartment) and at the DR site, with ≥90 days of restore points. During a cut longer than 24 h, a daily encrypted removable backup is taken off site (tooling and runbook).
- Quarterly restore tests per hospital; single-tenant point-in-time restore of a 5-year, 150-bed tenant on on-site hardware in ≤4 h (C7).
- Site loss: promote the warm standby at the DR site (RTO ≤4 h contract); clinicians connect over the internet or mobile data.
- Ransomware or logical corruption: clean-room rebuild; tenant restore ≤24 h engineering, T0 ≤72 h contract; the continuity instance (independent identity) and per-unit cellular clean kits keep clinical access; safe degraded operation for 4–6 weeks.

### 16.3 Downtime layers (K §7.9)

| Layer | Failure | Required behaviour |
|---|---|---|
| L0 | Node loss in the cell | Automatic failover; no clinical interruption beyond seconds |
| L1 | Internet or WAN loss (including government shutdowns) | **Hospitals: no clinical effect.** External channels (messaging, wallets, replication, KRG returns) queue for ≥7 days; certificates and licences keep working; SMS only through the per-site GSM gateway; critical messages by voice. **Outpatient sites:** read-only continuity on the edge agent, downtime ID blocks, printed packets and the outpatient lab downtime protocol (middleware holds and validates results; paper reports carry downtime accession numbers; critical results phoned with read-back logged on the edge agent and back-entered within 4 h) |
| L1b | Mains power loss | UPS and generator; no data loss; clinical work continues at UPS-backed points |
| L2 | Site loss | DR standby promotion |
| L3 | Ransomware or corruption | Immutable restore, continuity instance, clean kits |
| L4 | Prolonged outage | Paper packets every 1–4 h; downtime forms; back-entry with valid time = paper time, labelled |

**Never offline** (SI-15): new prescribing without full CDS; bed or OT-slot allocation; identifiers outside pre-allocated blocks; controlled-drug stock movement; identity merges. At an on-site hospital these apply only if the cell itself is lost.

### 16.4 SLOs (K §7.10)

| Metric | Engineering SLO | Contract SLA |
|---|---|---|
| T0 write paths (ADT, CPOE, eMAR/BCMA, results filing) at the cell | 99.99% | 99.95% per month |
| Read and continuity paths | 99.99% | 99.99% |
| In-cell RPO / RTO | 0 / ≤5 min | 0 / ≤15 min |
| Site-loss RPO / RTO | ≤5 min / ≤60 min | ≤15 min / ≤4 h |
| Cyber recovery | Tenant restore ≤24 h | T0 ≤72 h |
| Planned downtime | 0 (major database upgrade ≤30 min a year) | 0 |
| HL7 end to end | p95 ≤5 s; zero silent drops; alarm at >5 min unacknowledged | Reported |
| Orphaned work | 0; alarm ≤5 min | >2 h with patient impact is a Level-3 rollback trigger |
| Critical patches | ≤7 days central; ≤14 days on site | Same |

### 16.5 Drills the software must support

Monthly game days on the reference cell; quarterly restore tests; Code-Dark drills twice a year per unit; planned WAN-loss drills before announced shutdowns; an annual cyber-recovery exercise including the hospital-estate-down scenario. Build drill modes, scripts and reports so each drill produces evidence with measured recovery times.

---

## 17. Data platform, analytics and AI

Read: K §11; R09 §5–§6, §9.

### 17.1 Data platform

| Phase | Components |
|---|---|
| MVP | **On site:** read models (≤2 s) and the reporting replica (≤60 s), carrying MIS, JCI measures, KRG returns, safety telemetry and the **owner's dashboard** (revenue and collections by currency, unbilled consumption, deposits outstanding, corporate receivables, occupancy). A report builder on the replica. **Centrally:** encrypted CDC bronze landing per tenant for migration staging, CDS replay and analytics |
| P2 | Silver layer; OMOP and SQL-on-FHIR outputs; command-centre data |
| P3 | Opt-in benchmarking with hospitals as co-owners. **We never sell identifiable data** |

### 17.2 AI (P2 and later; nothing in the MVP)

- **Platform (P2, starting only after company gate G3: hospital A's 90-day stabilisation and independent assessment, exit ≈M40; AI work from ≈M42, K-23):** the AI gateway (counsel-approved region pinning, zero retention, PHI minimisation, version pinning, kill switch, on-site small-model option), the grounding service, the control plane (registry, model cards, evaluation harness, monitoring, provenance) and the human-in-the-loop UX kit. No model touches the database (constitution rule 10). Control-plane requirements G1–G16 (R09 §5.4) are MUST at AI GA (§17.3).
- **First products (P2):** source-cited English discharge-summary drafts with an omission checklist (diagnoses, discharge medications, follow-up, pending results) completed before sign-off; structuring of short English dictation; insurer document-pack assembly; Kurdish and Arabic patient instructions **suggested from the approved template library** (never free machine translation; new text approved by a bilingual clinician).
- **Later:** Arabic and English ambient documentation (P3, partners only); Sorani and Badini only after two partners pass S8-K; predictive deterioration and sepsis only from cleared partners, run silent first.
- **Rules:** output stays `draft-ai` until signed (SI-07); per-sentence citations; unsourced diagnoses or treatments are blocked; evaluation sets in English, Arabic and Sorani gate every model or prompt release; every AI surface has one-click issue reporting into the Safety Event pipeline; every AI feature degrades cleanly to "unavailable" with the manual path intact, including during internet shutdowns. Cross-border inference needs a counsel opinion, hospital approval and a Safety Board processor entry (SI-20).

### 17.3 AI control plane requirements (G1–G16, MUST at AI GA; R09 §5.4; K §11.3)

| # | Requirement |
|---|---|
| G1 | Registry of every model, prompt and agent: version pinning, owner, intended use, risk tier, approval status, deployment scope (sites, units, roles) |
| G2 | Model cards and source attributes shown in the workflow (an "i" button on every AI output), editable for local models |
| G3 | Immutable, exportable provenance: model and version, prompt-template version, sources, raw output, human edits, signer and time |
| G4 | No AI output enters the record, reaches a patient, or executes an order or claim without an accountable human (SI-07) |
| G5 | Structured accept/edit/reject and override reasons, feeding monitoring |
| G6 | Retrospective and silent evaluation: calibration, PPV and sensitivity at thresholds, alert burden, subgroups |
| G7 | Monitoring of drift, performance, usage, edit distance, overrides and subgroup gaps, with alert thresholds; cost per encounter |
| G8 | AI safety events into the incident pipeline, with a blinded option |
| G9 | Per-feature, per-site disable and instant rollback (kill switch, SI-19) |
| G10 | Patient-facing AI identifies itself; patient text comes only from approved templates |
| G11 | Recording consent for any ambient feature (P3), with opt-out honoured |
| G12 | PHI minimisation; counsel-approved region pinning; no vendor retention or training; segmentation and labels enforced by the grounding service (SI-20, SI-21) |
| G13 | Agents: least-privilege tool scopes, approval for writes, prompt-injection defences, action logs |
| G14 | A classification record per AI feature in the Boundary Register |
| G15 | Regression evaluation (English, Arabic, Sorani sets) before any model or prompt update; release notes |
| G16 | Declared protected-attribute inputs and stratified equity reports |

Components to build: registry, model-card store, evaluation harness, runtime monitoring, HITL UX kit, feedback capture, safety-event reporting, provenance store, policy engine, kill switch, equity toolkit, grounding service, model gateway (multi-vendor, never hard-wired to one), and an agent framework with tool scopes. ISO/IEC 42001 alignment by AI GA (K §9.3).

---

## 18. Verification and validation

Read: R15 §6–§10; R03 §19, §21; BP §5; K §5, §13.3–§13.5. Over-alerting fails the build exactly as a missed alert does (R15 §11 #10).

### 18.1 Traceability

- **Chain:** user need → requirement (feature ID) → hazard(s) → risk control(s) → verification test(s) → validation evidence → release.
- Tests carry requirement and hazard IDs in their names or tags; CI publishes results keyed by those IDs; `docs/safety/traceability.csv` is **generated, never hand-maintained**.
- Every SI has a hazard entry, state-machine property tests and a nightly scenario suite. Every SAC (§18.4) has a hazard ID and an acceptance test.
- Clinical timestamps are first-class events, never inferred from notes.

### 18.2 Test portfolio

| Layer | Scope and tools | Gate | Evidence |
|---|---|---|---|
| Unit and property | State machines (orders, MAR doses, encounters, specimens, beds, claims) and invariants with Kotest property tests; generators produce random, out-of-order and duplicate events; R11 §15 is the property list | Every commit (short runs); nightly 10⁶ sequences | Invariant coverage report |
| Module and contract | Spring Modulith module tests; consumer-driven REST and event contracts; an HL7 v2 conformance profile per interface (structure, cardinality, vocabulary) | Every merge | Conformance report per interface |
| FHIR | HL7 validator against pinned profiles; R4 projections, IPS `$summary`, the KRG return bundle | Every merge | Validation report per artefact |
| Integration | Testcontainers with real PostgreSQL, Kafka, Keycloak and OpenFGA; analyser, modality, card-terminal and printer simulators | Every merge | Test report |
| End to end | Playwright clinical journeys in `en`, `ckb`, `ar`; Maestro mobile flows including offline BCMA | Merge (smoke); nightly (full) | Videos and traces on failure |
| Clinical scenarios | §18.5 | Nightly and pre-release | Pass matrix linked to hazards |
| Performance | §18.6 | Nightly; any p95 regression blocks release | Load report against SLOs |
| Resilience | §18.7 | Nightly chaos; monthly game days; quarterly restore | Measured RTO/RPO |
| Security | SAST, SCA, secrets, container and IaC scans; DAST on staging; SBOM diff; annual penetration test and a pre-release test for Tier 2 changes | Per merge / release / annual | Scan reports; pen-test summary |
| Usability | Formative tests every sprint with a clinician panel [HUMAN]; summative per §18.8 | Before a feature's first release and after significant UI change | IEC 62366 report |
| Localisation, RTL, accessibility | §18.9 | Every merge and release | Pseudo-locale, RTL diffs, axe and WCAG audit |
| Topology and egress | The same signed artefacts on the three-node cell (dev cell in CI, reference cell before release) and the central substrate; no usable PHI leaves the cell | Every release | Conformance and egress reports |
| Tier 2 | 100% boundary-value tests; mutation testing (PIT); render-integrity tests; fail-safe tests on timeout | Every merge touching Tier 2 | Tier 2 verification report |
| Migration and UAT | §18.12; UAT kits per customer | Per customer | Reconciliation pack; signed UAT [HUMAN] |

### 18.3 Property-based invariant testing (criterion C2)

For every SI, write a property that drives random command sequences through **every channel adapter** (UI command layer, API, mobile sync, HL7 inbound, migration loader, plugin effects) and asserts the invariant after every step. Include offline-BCMA conflict replays, out-of-order and duplicate events, clock skew, and back-entry. The nightly run executes 10⁶ sequences at the application-command layer with in-memory adapters, plus at least 10⁴ sequences through each real channel adapter, with **zero violations** as a hard gate; the evidence records the actual counts; a violation is a Sev-1 safety defect with a hazard-log entry.

### 18.4 Patient-safety acceptance criteria (SAC-01 to SAC-53, from R03 §19 and BP §5.1)

Each criterion gets a traceability ID, a hazard link and at least one automated test. Where an SI applies, it is enforced server-side on every channel.

| SAC | Criterion | SI / phase |
|---|---|---|
| 01 | Every label, wristband, MAR entry, print and verification step shows ≥2 identifiers, never room or bed; name in the patient's script plus Latin; MRN plus DOB or the approximate-DOB flag | SI-01 |
| 02 | A photo is captured and shown on the banner, MAR and order entry | SI-16 |
| 03 | MRNs carry a check digit; invalid MRNs are rejected at entry and scan | — |
| 04 | Barcoded wristbands and labels carry ≥2 identifiers and print at registration, with Kurdish/Arabic shaping or raster fallback | SI-01 |
| 05 | Similar-name warnings at registration and search, distinct across scripts; retract-and-reorder monitored | SI-16 |
| 06 | Unknown, trauma, MCI and downtime patients get unique temporary IDs (alias pools, pre-allocated blocks) that merge into permanent IDs | SI-15 |
| 07 | Newborns get distinct names ("Baby of [mother]") that pass truncation tests in all three scripts | — |
| 08 | Merge and unmerge are reversible and propagate downstream; duplicate-rate dashboard; overlays are incidents | SI-08 |
| 09 | Specimens labelled at the bedside in the patient's presence, with WBIT detection | — |
| 10 | Orders structured by default; free text monitored and alerted when a structured equivalent exists | — |
| 11 | Ordering shows dated, sourced weight, height, coded allergies and pregnancy status; "NKA" ≠ "not assessed"; no weight-based medicine signed without a weight; metric only; no unit-less dose fields | SI-05, SI-16 |
| 12 | Dose-range checks show their working before submission (in full from Dose Engine activation in P2; control set A until then) | SI-05 |
| 13 | Paediatric dose rounding happens only inside `reg-dose` (P2). Until then the system shows corrected age, never rounds or recalculates a dose, and rounding is the pharmacist's documented decision under control set A | SI-05 |
| 14 | The CPOE error-category harness (eight Leapfrog-style categories) passes with the licensed KB and CSO-approved scenarios [HUMAN]; hard stops only from the governed list | SI-14 |
| 15 | The excessive-alert suppression list is versioned content exercised by the Excessive Alerts category | SI-14 |
| 16 | Firing, override and acceptance rates and override reasons recorded per rule; in-workflow feedback | SI-14 |
| 17 | AI and predictive tools show source attributes, local validation, drift monitoring and governance (P2; partners only, silent first) | SI-07 |
| 18 | Verbal orders capture read-back and track co-signature; antineoplastic verbal orders rejected except hold/stop | — |
| 19 | Tests, referrals and transitions tracked to completion; unowned work raises `TaskOrphaned` within 5 min | SI-03 |
| 20 | BCMA live site-wide (inpatient, ICU, labour and delivery, pre-op, PACU), patient and medication scans ≥95% per unit (R2b) | SI-02 |
| 21 | Override reasons never defaulted; scan-failure analytics; every override reportable | SI-02 |
| 22 | A high-alert dose cannot be documented without a recorded independent double check | SI-13 |
| 23 | Pump autoprogramming and auto-documentation: **P2** (one vendor, orders never commands, only after BCMA ≥95%); manual programming with BCMA scan until then | — |
| 24 | No first dose without pharmacist verification except defined emergency overrides; review within 4 h; alarm if the queue is unstaffed >30 min | SI-02, SI-05 |
| 25 | Formulary holds standard concentrations, premixed anticoagulants, reversal and perioperative protocols (content [HUMAN]) | — |
| 26 | Med rec at admission, transfer and discharge with a decision per item; cannot complete with undecided items; written discharge list | SI-09 |
| 27 | Opioid high-risk monitoring and pain-reassessment tasks | — |
| 28 | Stewardship reporting (DOT/DDD) and the stewardship control set until P2 | — |
| 29 | Critical-result definitions and timeliness targets configured; read-back logged; named recipient with a timed escalation chain, including external referrers | SI-04 |
| 30 | Every result has a responsible clinician; amended results notify and flag; pending-at-discharge results go to owned queues | SI-03, SI-17 |
| 31 | Surrogate inbox coverage; unacknowledged abnormal results >7 days monitored; labelled results and pregnancy tests never released by message | SI-17, SI-21 |
| 32 | Structured I-PASS handoff with audit and a per-shift coverage KPI | — |
| 33 | Reliable secure messaging for high-risk information; no PHI in notifications | SI-20 |
| 34 | NEWS2/PEWS/MEOWS calculated with visible components, escalation tasks and response-time tracking, passing boundary tests; only where the Register allows | SI-18 |
| 35 | Observation frequency driven by the score **only if the Register entry covers it**; until then the nurse sets frequency | SI-18 |
| 36 | Alarm configuration authority: **out of scope** (the HMS is never in the primary alarm path) | — |
| 37 | A code sheet documents resuscitations and feeds review (R2b) | — |
| 38 | Pre-procedure checklist, site marking, role-based time-out and all three WHO checklist phases captured | — |
| 39 | Perioperative syringe labels print | — |
| 40 | Implant UDI capture on the intra-op record | — |
| 41 | Bedside transfusion: wristband ↔ unit ↔ order ↔ sample match plus two-person e-witness; mismatch is a hard stop; relabel controls; scripted fallback until T2 | SI-11 |
| 42 | Human-milk barcode matching in NICU: **P2** | — |
| 43 | Validated suicide screening with documented risk and plan | — |
| 44 | Restraint and seclusion orders with expiry, no PRN, face-to-face task, monitoring; time limits as configurable rule packs with source and review date [HUMAN] | — |
| 45 | Signed notes immutable; amendments are versions; entered-in-error replaces delete; signed rendering hashed | SI-06 |
| 46 | Copy-forward text attributed and highlighted | — |
| 47 | Read-only continuity snapshots, downtime registration, labelled back-entry keeping clinical time distinct; Code-Dark drills supported | SI-10, SI-15 |
| 48 | Data and configuration backups restore-tested quarterly per hospital | — |
| 49 | Updates tested in an integrated context with clinical scenarios; impactful changes notified (release notes, known anomalies, flag defaults) | — |
| 50 | ISMP display rules (no trailing zeros, no naked decimals) and tall-man lettering | SI-05 |
| 51 | The banner distinguishes "NKA" from "not assessed" | SI-16 |
| 52 | RIS MRI-safety screening with incident capture | — |
| 53 | Device auto-dissociation on discharge or transfer | — |

### 18.5 Clinical scenario suites (nightly release gates)

1. **CPOE error-category harness** (Leapfrog-style and unofficial: the Leapfrog CPOE Evaluation Tool is Leapfrog's own test, which hospitals take; never report a "Leapfrog result"). It covers all eight categories, including Excessive Alerts, and runs after every KB or CDS change. Threshold: ≥60% of serious-error scenarios caught **and** zero interruptive alerts on the "should not alert" set [E]. The threshold applies only with the licensed KB and CSO-approved scenarios [HUMAN]; with the mock KB the harness checks plumbing and alert-budget accounting only, and each such run is recorded as "mock-KB run, not clinical evidence". Budgets: Tier A ≤20 rules; Tier B ≤8 interruptive alerts per 100 medication orders at go-live and ≤5 by month 12.
2. **ISMP:** weekly methotrexate; minibag vincristine; opioid tolerance; metric-only weights; 10× decimal errors; look-alike/sound-alike drugs; concentration standardisation; insulin and heparin protocols; seeded 10× and unit errors in every integrated cycle.
3. **Closed-loop medication:** prescribe → verify → dispense → BCMA, with failures injected: wrong patient, wrong drug, expired product, dose out of range, discontinued in transit, offline administration on a stale order, PRN double dose at shift change, cutover "last given" carry-over; plus the SI-12 extensions (no payment rule delays a time-critical dose; unverified patient-supplied medicine cannot be scanned).
4. **Transfusion:** consent → bedside-labelled sample → request → issue → two-person check → vitals → reaction → haemovigilance, with a mismatch injected at each step; relabel at receipt with blind double entry; relabel errors must be 0.
5. **Results closure:** critical value → named recipient → escalation; a discharged patient's result; an amended result; external referrers.
6. **Identity:** newborn naming; trauma alias; merge/unmerge with downstream notification; similar-name alerts; cross-script duplicates.
7. **Downtime:** read-only continuity; pre-allocated IDs; back-entry with original times; cell loss, WAN cut, power cut.
8. **Deterioration:** NEWS2 boundaries (0 / 1–4 / a single parameter scoring 3 / 5–6 / ≥7), SpO₂ Scale 2, escalation timers; PEWS and MEOWS only where the Register allows.
9. **Revenue and SI-12:** charges from events only; package coverage and leakage; deposit and payment rules never blocking discharge, emergency care or time-critical doses; dual-currency shift close.
10. **Seam (W1-K):** referral acknowledgement within 24 h; no overlays; polyclinic LIS limited to its own patients; medication list as reconciliation input only.

### 18.6 Performance: spike criteria, the 1,000-bed day and the 300-bed day

- **The 1,000-bed day** [E]: ≈1,000 inpatients, 3,000 OPD visits, 300 ED arrivals, ≈20,000 orders, 25,000 administrations, 15,000 results, vitals every 4 h, ≈300,000 HL7/FHIR messages, two years of history preloaded, and a 07:00–09:00 peak at 3× average concurrency. Runs on the central pooled-tier profile.
- **The 300-bed day** on the three-node reference cell (3 × 32 cores, 128 GB, NVMe) with **every component running** [HUMAN: hardware]. Dev-cell runs of the same workload are indicative and never count as C9 evidence. Scale the 1,000-bed workload to 300 beds and 800 sessions; record the scaled volumes in the spike report. Pass (C9): p95 targets met with CPU and memory utilisation ≤60% (record the interpretation in the ADR, since K's wording is ambiguous). Re-run at customer sizing on the installed cell at RG2.
- **ADR-001 spike criteria** (decision rule in §4.2):

| # | Criterion | Weight | Pass |
|---|---|---|---|
| C1 | Atomic order-sign: order + CDS override + verification task + MAR schedule + charge event | 15 | p95 ≤300 ms at 3× peak |
| C2 | Invariants under 10⁶ randomised command sequences, including offline-BCMA conflict replays | 25 | Zero violations (hard gate) |
| C3 | Bitemporal "what did the clinician see at 09:12" on a 30-day chart | 10 | p95 ≤1.5 s |
| C4 | FHIR R4 read/search over the projection | 5 | p95 ≤300 ms; lag p99 ≤5 s |
| C5 | R4 → R6 from unchanged storage | 10 | ≤15 engineer-days; no storage migration |
| C6 | IPS `$summary` and a KRG return bundle from the same facts | 5 | 100% validator conformance |
| C7 | Point-in-time restore of a 5-year, 150-bed tenant on on-site hardware | 10 | ≤4 h |
| C8 | Add a clinical fact type end to end | 15 | ≤3 days |
| C9 | The 300-bed day on the three-node cell | 5 | As above |

- Cell SLOs (release blockers): BFF p95/p99 300/800 ms; warm screen 1.0 s and cold chart 1.5 s p95; patient search 200 ms; order sign with CDS 1.5 s; BCMA 500 ms; HL7 end to end p95 ≤5 s with zero silent drops.

### 18.7 Chaos, DR and downtime drills

| Cadence | Drill |
|---|---|
| Nightly (CI) | Node kill, PostgreSQL failover, broker loss, network partition, slow terminology service, WAN cut, power-cut emulation (graceful shutdown path), clock skew; assert alarms ≤5 min and no data loss |
| Monthly | Game day on the reference cell (database primary kill, Kafka partition, certificate expiry); generator-transfer test support |
| Quarterly | Restore test per hospital; DR promotion with measured RTO/RPO (two consecutive failed restores reopen K-17) |
| Twice a year | Code-Dark drill per unit (packets, continuity instance, back-entry) |
| Before announced shutdowns | Planned WAN-loss drill |
| Annual | Cyber-recovery exercise with one customer, including the hospital-estate-down scenario |
| Before go-live | RG1: burn-in, failover and power-cut tests. RG3: WAN-cut and mains-cut drills; cash-drawer and dual-currency drill |

Pass criteria per layer are in §16.3–§16.4. Build drill modes and reports so each drill produces evidence with measured times.

### 18.8 Summative usability support

The studies themselves are [HUMAN]. Engineering provides: IEC 62366-1 use specifications per role; task scripts for the critical tasks (patient search and selection; weight-based and high-alert ordering; BCMA with override; transfusion check; NEWS2 escalation; critical-result acknowledgement; discharge med rec; pick-lists); a study environment in TRAIN with synthetic patients; task-timing telemetry; and NISTIR 7742-format report templates. **Kurdish-first, Arabic-first and English-first users are separate groups of 15–20 each**, before every Tier 2 function and Tier 1 critical task. Release blockers: task time worse by >10% or any new critical use error.

### 18.9 Localisation, RTL and accessibility tests

| Test | Requirement |
|---|---|
| Pseudo-locale | Expansion builds catch truncation and hard-coded text |
| RTL | Layout, icons, charts and tables mirrored correctly; screenshot diffs every release |
| Bidi | Mixed strings (Sorani or Arabic name + English drug + numerals + units) isolated correctly |
| Digits | Clinical numerals Western on every screen and print; Eastern Arabic-Indic only for configured non-clinical patient text |
| Script | Every Sorani letter renders, shapes, sorts and searches; Arabic vs Kurdish letter variants normalised |
| Printing | Golden images per printer model and language; S7-K results drive the Supported Hardware List |
| Names | Four-part names with transliteration; cross-script search; trilingual banner; newborn band truncation |
| Calendar | Friday–Saturday weekend; holidays; calendar-aware SLA timers |
| Translation gate | Zero missing keys in clinical paths; clinician review recorded [HUMAN] |
| Accessibility | WCAG 2.2 AA per release (axe in CI plus a manual audit per release) |

### 18.10 Synthetic data

- A generator (Synthea-based or our own) with a **Kurdistan locale pack:** four-part names in Kurdish (Arabic script), Arabic and Latin with transliteration variants and character-variant noise; the mother's name; Iraqi identifier types with plausible formats (the sources give no format or check-digit rules, so mark the generators as assumptions); DOB precision flags with placeholder dates (1 January, 1 July); phones shared within families; several identifiers per person; mixed-script duplicates.
- **Canary identities** for the PHI-leak scan (§6.2).
- Clinical content in samples is labelled NOT FOR CLINICAL USE.
- Production PHI never enters non-production environments. Synthetic data is for development and testing only, never for clinical validation.

### 18.11 Content validation and replay

The pipeline is §19.4. Acceptance per content type [E]:

| Content | Simulation | Acceptance |
|---|---|---|
| CDS rule | Silent 2–4 weeks, then replay of up to 90 days of orders: firing rate, PPV, overlap | No rise in interruptive alerts per 100 orders without CDS committee sign-off [HUMAN] |
| Order set | Diff against the prior version; dose and interaction replay; CPOE error-category harness | Zero new hard-stop conflicts; harness passes |
| NEWS2 policy | Replay 90 days of observations: escalations per ward per shift | Within agreed nursing capacity [HUMAN] |
| Tariff, package, payer rule | Re-price 3–6 months of encounters under old and new rules | Delta explained line by line; zero unpriced services |
| Lab range, autoverification rule | Replay historical results: autoverification rate, flag changes | Lab director sign-off [HUMAN] |

A first site with no electronic history uses the vendor-validated Tier A/B baseline, interruptive from day 0, validated on the harness and on synthetic or multi-site replay.

### 18.12 Migration verification

- **Mocks:** Mock 1 at T-120 (full extract, ≥95% loaded, mapping gaps listed); Mock 2 at T-75 (≥99.5% loaded, every reject with a reason code, clinicians review 30–50 charts); Mock 3 at T-45 (production-like and timed, 100% reconciled, HIM and finance sign-off); dress rehearsal at T-14 (full runbook within plan).
- **Metrics:** the accounting identity holds at 100% (source = loaded + rejected with reason + intentionally excluded); control totals and hashes on deposits, receivables, package balances, allergies per patient and active medicines per inpatient; zero defects in critical fields (identifiers, allergies, active medicines, blood group, code status, weight) and <0.5% elsewhere; 100% review of active inpatient allergies and medicines; the load fits the window with 25% headroom; deposits and packages reconciled to the dinar per currency.
- **EMPI:** duplicates <1%, zero overlays loaded, ≥99.9% precision at the auto-merge threshold on the 2,000-pair gold set; HIM adjudicates 100% of high-score pairs before Mock 3; every legacy MRN kept as an alternate identifier.
- **The three most dangerous items** (scripted, owned, reconciled, signed off, rehearsed in Mock 3 and the dress rehearsal): active medicines and PRN last-given times; deposits and packages; pharmacy opening balances including controlled drugs.

### 18.13 Go-live readiness evidence (RG1–RG4) and rollback

The gates are contractual and [HUMAN]; the software produces their evidence.

| Gate | Timing | Evidence the system must produce |
|---|---|---|
| RG1 Build complete | T-90 | Code frozen (Clinical Safety sites feature-complete since T-150); foundation content adoption ≥90% with the deviation log; Boundary Register state and fallback sets per Tier 2 function; control set A and 24×7 pharmacist cover confirmed (Clinical Safety sites) or the transcription double check (Core sites); control set C configured and a hospital stewardship lead named (every site); control set B configured (Core sites); infrastructure obligations evidenced (UPS, generator transfer, cell burn-in, failover and power-cut tests, Wi-Fi survey); blood-unit relabelling workflow agreed; calendars configured; seam controls live |
| RG2 Integrated testing | T-45 | Mock 3 passed; scenario suites green; the 300-bed day at customer sizing on the installed cell within SLOs; deployment hazard log signed by the customer's CSO |
| RG3 Readiness | T-14 | Dress rehearsal passed; device-class rehearsal including Kurdish and Arabic printing; training ≥95% complete, proficiency ≥85%, ≥80% "ready" per unit; downtime drill including WAN-cut and mains-cut drills; cash-drawer and dual-currency drill; zero open Sev-1; no unmitigated high-risk hazard; orphan queue at zero; control set A validated for NICU/PICU and paediatrics and signed by the Chief CSO; statutory registers live; pharmacist-cover alarm tested; patient-supplied medicine workflow live; command centre staffed; independent assessor concurs (customers #1–3) |
| RG4 Go/no-go | T-1 | Final delta load on time; safety dashboard live; continuity instance and clean kits ready; DR standby replicating within target; insurance bound; card terminals and wallet links tested; KRG return formats tested; independent assessor concurs (customers #1–3) |

**Rollback levels:** (1) a feature flag, any time; (2) a unit falls back to downtime procedures; (3) full fallback to paper or legacy, **only within 72 hours**. **Level-3 triggers:** orphaned items >2 h with patient impact; BCMA down >4 h across units; order-sign p95 >5× SLO for >4 h; a system-attributable sentinel event; while seams exist, unmatched results >0 for 1 h; the on-site cell unavailable >4 h without DR promotion. Build the dashboards and alarms that detect each trigger automatically.

**Rollout ruling: "pilot the product, big-bang the hospital."** A model ward (1–2 weeks of scripted shifts on the production build with real staff and synthetic patients) precedes one site-wide cutover of inpatient clinical and revenue modules. **BCMA is never rolled out unit by unit.** Phasing is allowed only for back office, outpatients before inpatients where medication records do not interleave, self-contained units and multi-site waves. Two big bangs per hospital (Core, then Clinical Safety) are normal in Kurdistan; NICU and PICU go live with the rest of the site, never later.

---

## 19. CI/CD and release engineering

### 19.1 Pipeline tiers

**What CI means here.** Until a human provides a remote and a CI service, CI is `tools/ci/run <fast|merge|nightly|release>`, which you run locally (built in WP-0.1, listed in `COMMANDS.md`).
- **Evidence:** each run writes `docs/program/evidence/ci/<date>-<tier>-<sha>.json` with the commands, counts, durations, host, cell and result.
- **Blocks merge:** a `wp/*` branch merges into `main` only if `merge` passed on the merge candidate (§3.6).
- **Nightly:** run `tools/ci/run nightly` at the end of every session that changed code, unless a human has scheduled it. A red nightly is the next session's first task.
- **Hosted CI:** you may write hosted-CI configuration, but it is not evidence until it has actually run.
- **No shortcuts:** never report a shortened run as the gate. Record the actual sequence counts and durations.

| Tier | Trigger | Contents | Budget |
|---|---|---|---|
| **Fast** | Every commit | Compile; detekt, ktlint, ESLint, TypeScript; unit tests; short property-based runs (≈1,000 sequences per machine); architecture tests (§6.8); localisation lint; secret scan | ≤10 min |
| **Merge** | Every pull request | Integration tests (Testcontainers); contract tests (OpenAPI, AsyncAPI, HL7 v2 conformance profiles, FHIR validator); migration upgrade-and-rollback (N-1); end-to-end smoke in `en`, `ckb` and `ar`; axe accessibility checks; RTL visual diffs; licence, vulnerability and container scans; SBOM; coverage gates; mutation tests on touched Tier 2 code | ≤45 min |
| **Nightly** | End of every session that changed code, or a human-scheduled run | 10⁶ randomised property-based command sequences across all invariants (C2), at the application-command layer with in-memory adapters, plus at least 10⁴ sequences through each real channel adapter; the clinical scenario suites; full end-to-end; golden-image print tests; a scaled functional day (about 30 beds) on the dev cell, with p95 compared against the same host's last baseline (a regression above 15% across three runs fails); the **300-bed day** on the reference cell and the **1,000-bed day** on the central profile once that hardware exists; chaos (node kill, WAN cut, power-cut emulation, broker loss, database failover, clock skew); a restore test; parser fuzzing | Overnight |
| **Release** | Release branch or tag | Signed container images, Helm charts, Tier 2 sidecars, desktop shell and mobile builds; CycloneDX SBOM and VEX; SLSA provenance; cosign signatures; the **Release Evidence Pack** (§10.1); trilingual release notes; offline media image | Per release |

Any p95 regression in the reference-cell performance run blocks release (K §7.11). A red nightly is the first task of the next session.

### 19.2 Environments

`dev` (compose) → `ci` (an ephemeral dev cell plus the central profile) → `test` → `train` → reference cell on real hardware (when available) → production rings. Configuration bundles follow the same promotion path: BUILD → TEST → TRAIN → PROD. No production PHI exists outside production; every non-production environment uses synthetic data only.

### 19.3 Change classes (BP §5.4; K §5.4)

| Class | What | Process |
|---|---|---|
| **C0** | No change to clinical behaviour | Continuous delivery |
| **C1** | Clinical-behaviour change behind a flag | Ships flag-off by default; CSO review [HUMAN]; scenario suites green; accreditation-impact field filled |
| **C2** | Tier 2 changes, Tier 2 activations, regulated releases | Batched quarterly; regulatory-impact assessment; Boundary Register update; independent concurrence where K-05 requires it [HUMAN] |

### 19.4 Content pipeline (content is a regulated artefact)

Order catalogues, formulary, CDS rules, tariffs and packages, forms, templates and translations are versioned sources in `content/`, built into signed bundles and validated before promotion:
- schema and referential validation (every code resolves in the terminology service; every orderable has a charge mapping or an explicit "non-chargeable" flag);
- CDS rules: the CPOE error-category harness (§18.5); new or locally modified rules run silent for 2–4 weeks with replay against up to 90 days of orders where electronic orders exist;
- tariffs and packages: a **re-pricing replay of 3–6 months of encounters** before activation, with variance reports;
- drug-KB content releases are regression-replayed like code;
- translations: zero missing keys in clinical paths; clinician review recorded [HUMAN].

**Synthetic content is a gate, not a label.** Every content item and test fixture carries `provenance: synthetic | approved` as data. Promotion to TRAIN or PROD fails if any item is synthetic, and the Release Evidence Pack lists every synthetic item still present. Synthetic identifiers use reserved forms so they can never match a real product or patient:
- GTINs with the GS1 demonstration prefix 952;
- MRNs and accession numbers prefixed `SYN-`;
- drug names such as "Synthdrug A 500 mg tablet";
- codes from `urn:hms:synthetic:*` code systems, never real LOINC, ICD-10, ATC or SNOMED CT codes recalled from memory;
- thresholds and ranges whose source is recorded as "synthetic", never copied from guidelines.

### 19.5 Release trains and rings (ADR-021)

Weekly to the central site; a monthly on-site train with C2 changes quarterly; staged rings (reference cell ≥7 days → a non-flagship site ≥14 days → all sites; DP#1 never first); one deferral allowed per site for a go-live, a mass-casualty event or a shutdown; maximum drift N-1; signed offline media for cells that cannot reach us. The fleet console shows ring, version and drift per cell.

### 19.6 Delivery metrics

DORA targets: weekly deploys centrally, lead time under 7 days, change-failure rate under 10%, MTTR under 60 minutes. Track releases with a complete evidence pack (target 100%) and CSO triage time (≤2 working days) (K §17).

---

## 20. Documentation and evidence the build produces

Treat documentation as part of the product. The agent writes and maintains it; [HUMAN] reviewers approve the safety and regulatory items.

| Area | Artefacts |
|---|---|
| Architecture | C4 context, container and component diagrams as code; the bounded-context map; ADRs; the IEC 62304 software-system decomposition showing the Safety Kernel and the Tier 2 split, with the segregation and class-propagation analysis |
| Specifications | Module specs; executable state-machine specs; OpenAPI and AsyncAPI contracts; the domain-event catalogue; HL7 v2 conformance profiles per interface; the FHIR CapabilityStatement and profiles; the Kurdistan pack data dictionary |
| Safety and quality | Hazard log; per-release Clinical Safety Case Report; traceability matrix; SOUP list; ISO 14971 risk management file per Tier 2 module; IEC 62366-1 usability engineering file (use specification, user-interface specification, critical tasks, formative and summative evaluation plans); software development plan; verification plans and reports; known-anomalies list; instructions for use per module in three languages |
| Security and privacy | Threat model per module (STRIDE) and per deployment topology; SBOM and VEX per release; penetration-test readiness pack; data-flow maps; processor records; the hospital DPIA kit inputs |
| Operations | Runbooks: install, upgrade, rollback, restore, DR promotion, break-glass, downtime and Code-Dark, key rotation, certificate renewal, removable off-site backup; monitoring and alarm guide; capacity guide |
| Implementation | Migration Workbench guide; foundation-content guide; configuration guide; RG1–RG4 evidence templates; trilingual training material skeletons and in-product help |

---

## 21. Build sequence: phases, work packages and exit criteria

**Rules for the sequence.**
- Build in dependency order. The phases follow K's release sequence (R1 → R1.1 → R2a → R2b → R2.1 → P2 → P3). The business-plan month for each release is shown in brackets for reference only.
- **Gates, not dates.** Never compress testing, validation or a [HUMAN] gate to hit a date. R1.1 and R2.1 already hold no safety control or statutory register, and every item in them has a manual path on go-live day (K §4.2). If capacity still falls short, apply K §14.2's descope rules (capacity is reviewed at M10, M12, M15, M28 and M32):
  - **The only pre-agreed wedge descope** is report release over WhatsApp and Viber. On go-live day, reports are then released in print at the counter.
  - **Never descope in the wedge:** EMPI and the seam controls; referral tracking; the Trust Plane and audit; downtime blocks; the critical-result service; ledger integrity, including dual-currency drawers; narcotics registers and the KRG statutory items the wedge's services trigger.
  - **Never descope in the inpatient release:** anything in the closed loop; SI-01…SI-21 and their fallback control sets; the MLC register and birth and death notifications; the downtime suite; readiness tooling; on-site cell resilience.
  - **Any other cut** is a [HUMAN] decision recorded in `DECISIONS-NEEDED.md`. Go-live moves within its window instead; test cycles and training never shrink.
- **The wedge carries the platform.** Phase 0 and Phase 1 build most of the platform. Keep the clinical scope of R1 narrow (K §4.2).
- **Entry criteria.** A work package starts when the work packages in its "Depends on" column are merged, or reviewed and stacked (§3.6), and the simulators it needs exist (§3.7). Packages whose dependencies are met may run in any order.
- Each work package (WP) follows §3.2 and ends with the Definition of Done (§22) and a reviewer report. Work-package files use the template in Appendix B.4.
- Feature IDs refer to Appendix A. A feature listed under an earlier phase may be completed in a later one; the note in Appendix A says which part.

### Phase 0: Foundation (business plan M0–M9; no clinical go-live)

| WP | Depends on | Scope | Exit evidence |
|---|---|---|---|
| **0.1 Programme bootstrap** | — | Monorepo layout (§6.1); programme control files (§3.1), including `OPEN-QUESTIONS.md` (Q-K list, A.20 conflicts), `ASSUMPTIONS.md` ([L] items) and `COMMANDS.md`; `backlog.yaml` generated from Appendix A by a script, with a ten-row spot check; baseline ADR files (§4.2); hazard log seeded with H1–H15 and one entry per SI-01…SI-21, every control `planned`; `tools/doctor` (checks every prerequisite and resource limit and prints what is missing); `.gitattributes` (`* text=auto eol=lf`; images and fonts binary); Gradle and pnpm workspaces; `tools/ci/run` with the fast tier and evidence records (§19.1); licence policy, ORT configuration and curations (§4.3); secret scanning; PR template; CODEOWNERS by module | `tools/ci/run fast` green on an empty skeleton with stored evidence; `tools/doctor` output recorded; every ADR file present; hazard log parses in CI; the backlog renders all 234 feature IDs |
| **0.2 Environments** | 0.1 | `docker compose` dev stack; the dev cell (three-node `k3d`, §5.1; a lite cell on small hosts) with CloudNativePG (three instances, quorum synchronous replication), Strimzi Kafka KRaft (three brokers), Temporal, Keycloak, OpenFGA, Valkey and an S3-compatible object store with Object Lock (§4.1); upstream operators and charts only; a local image registry with offline signing (§4.3); Argo CD in pull mode; OpenTelemetry collector; one-command bootstrap and teardown | The cell boots from locally signed images with one command; a smoke test passes; killing any single node (primary or standby) keeps PostgreSQL writable with no committed transaction lost, and losing two nodes stops writes instead of degrading to asynchronous; the object store refuses to delete a locked object |
| **0.3 Platform kernel** (`PLT-CORE-01`, `PLT-CORE-02`, `PLT-CORE-04`, `PLT-CORE-07`, `PLT-CFG-01`) | 0.2 | Platform libraries (UUIDv7, `Clock`, clinical vs recorded time, `Money`, `Quantity` with UCUM); bitemporal journal-as-outbox; Debezium → Kafka with CloudEvents and Apicurio; enterprise hierarchy and the configuration chain with locks; signed configuration bundles; flags and kill switches; task engine with owners, SLA timers, escalation and `TaskOrphaned`; `WorkflowPort` with the Temporal adapter | Journal-rebuild test passes; events arrive in per-patient order with idempotent consumers; `TaskOrphaned` fires within 5 minutes in a chaos test; a locked setting cannot be overridden below its lock |
| **0.4 Trust Plane v1** (`TRU-IAM-01`, `TRU-IAM-02`, `TRU-IAM-03`, `TRU-PRV-01`, `TRU-AUD-01`, `TRU-KEY-01` base) | 0.3 | Keycloak federation and passkeys; badge-and-PIN flow against a simulated reader; the policy decision point (RBAC + ABAC + OpenFGA care relationships + labels + purpose-of-use); policy enforcement for API, print and export; break-the-glass with review queue; BALP audit to a hash-chained WORM store; per-tenant envelope keys and crypto-shredding; PHI-safe logging with the canary scan | ArchUnit proves no repository access without the SDK; every PHI read in the test suite produces an AuditEvent; tampering with the audit chain is detected; canary values never appear in logs, traces or metrics |
| **0.5 State machines and invariants** (`PLT-CORE-03`) | 0.3 | Executable specs (Appendix B.3) for encounter, order, medication administration, specimen, result and bed, then appointment and credit claim (§8.4); generated property-test models; a test scaffold per SI with a named test for each; the scenario-suite framework | Each of the six machines that company gate G1 needs (encounter, order, medication administration, specimen, result, bed) has a spec with named-predicate guards, a generated model and passing property tests; every approval block reads `status: requested` with `approved_by` empty; approval requests filed in `DECISIONS-NEEDED.md` [HUMAN: pharmacist and nurse panels, lab CSO, HIM, CSO] |
| **0.6 Synthetic data and the ADR-001 harness** (`PLT-OPS-06`) | 0.4, 0.5 | Synthetic population generator (§18.10); 1,000-bed-day and 300-bed-day workload generators; benchmark harness for spike criteria C1–C9 (§18.6), including offline-BCMA conflict replays; Kafka vs NATS footprint comparison. Measure Option A only; assess Options B and A′ on paper from R08 and K §7.4 (a desk assessment) unless the human asks for a prototype. Spike code lives in `spikes/adr-001/`, is not production code, and is rebuilt from specs in Phase 1. For C5, C8 and ADR-004's tooling criterion, report what you can measure (files, modules and migrations touched; agent wall-clock time) and ask the human to convert it into engineer-days | A written spike report: C1–C6 and C8 measured on the dev cell (indicative); C7 and C9 harnesses built and dry-run at reduced scale. ADR-001 and ADR-009 stay accepted-provisional until a reference-cell run [HUMAN: hardware], unless a measured result already triggers a reopen rule, which you record |
| **0.7 Design system and client shells** (`PLT-UX-01`, `PLT-UX-02`, `PLT-UX-03` base, `KRI-LOC-01` base) | 0.1 (badge flow: 0.4) | Web workspace frame; banner component (SI-16) with patient-context management and re-verification at signing; sign/co-sign pattern; command palette; density modes; `ClinicalNumber`; locales `en`, `ckb`, `ar` with RTL; Tauri shell with HAL interfaces and simulated devices; React Native app skeleton; Playwright, axe and RTL-diff harnesses | A demo route renders the banner in three languages with correct RTL; axe clean; visual diffs stored; a simulated badge tap switches users in ≤2 s |
| **0.8 Documents and printing** | 0.3 | Template engine; PDF/A renderer satellite with Sorani and Arabic shaping; ZPL renderer per printer DPI with `^PA`/`^CI28` and `^GF` fallback; golden-image test harness; font-coverage test for every Sorani letter; print audit and watermarking; the S7-K printer test kit | Golden images pass for the paths we rasterise ourselves (PDF/A pages at fixed DPI; the ZPL `^GF` raster decoded from our own output) for a trilingual wristband, specimen label and receipt. ZPL text-mode output is checked byte for byte against approved fixtures; its printed appearance is verified only in S7-K on physical printers [HUMAN: printers], and the S7-K kit is ready to run. The renderer choice stays accepted-provisional until S7-K. The font-coverage test passes. Label data never goes to an online renderer |
| **0.9 Safety registry and release evidence** (`TRU-REG-01`, `TRU-REG-02`, `TRU-SEC-01`) | all other Phase 0 WPs | Hazard-log service and Regulatory Boundary Register (API and minimal UI) with the CI promotion gate; SOUP list; SBOM, VEX, signing and provenance in the release pipeline; the Release Evidence Pack generator | A dry-run release produces a complete evidence pack; promotion is blocked when a control for a feature in the release is not `verified` |

**Phase 0 exit:** all nine WPs done; every CI tier runs through `tools/ci/run` with stored evidence (nightly property runs included); the spike report written; the dev cell installs from signed artefacts (the reference-cell install waits for hardware [HUMAN]). [HUMAN] state-machine approvals requested; ADR freeze confirmed by the human lead.

### Phase 1: R1 wedge (code-complete = RG1 at M19; live M22)

Outpatient, laboratory, radiology, outpatient pharmacy and dual-currency billing at a polyclinic or diagnostic centre, on the full platform. The wedge runs on hospital A's on-site cell, which is installed and burn-in tested by M18; the polyclinic connects over metro links with a site edge agent (K §7.8, §15.2).

**Wedge variants (Q-K1, K §13.1).** W1-K (DP#1's polyclinic, live M22) is the plan. Keep the other two buildable:
- **W2-K.** Use it if DP#1 has no satellite site. It is also K's default while Q-K1 is unanswered. Phase 2 (R2a) then completes together with Phase 1: code-complete at M21, which is that go-live's RG1. Go-live is Core HIS across hospital A at ≈M24, with clinical orders and the MAR on paper until the M37 Clinical Safety big bang. DP#1's CSO signs a W2-K hazard analysis (transcription seam, control set B) before that RG1 [HUMAN]. If the pull-forward fails, W2-K moves to ≈M27.
- **W3-K.** The last resort: OPD-only at hospital A, with lab and imaging staying on legacy. It adds the order and result seam controls through `INT-SEAM-01`.
- **Seam hazard analysis (W1-K and W3-K).** It covers H15, is completed before company gate G1 (M6) and is signed by DP#1's CSO before wedge RG1 [HUMAN]. Every control has a hazard-log entry and a test.

| WP | Depends on | Features | Exit evidence |
|---|---|---|---|
| **1.1 Enterprise, workforce, terminology, configuration** | Phase 0 | `PLT-CORE-02` (full), `ERP-HR-01`, `PLT-CORE-05`, `PLT-CFG-02`, `PLT-CFG-03`, `PLT-CORE-06` (non-device rules) | Facility tree, staff with typed practitioner identifiers and privileges, terminology service that loads LOINC, UCUM and ICD-10 from licensed files when a human supplies them [HUMAN: licences], with loaders verified on synthetic files, plus local codes; the Kurdistan pack loads as signed configuration; a form renders in three languages |
| **1.1b Hub core** | 1.1 | `INT-ENG-01` (base): MLLP over TLS, acknowledgement state, owned dead-letter queues, ordered replay, outbound generation from domain events, DICOM and ASTM bridge skeletons, the simulators from §3.7. WPs 1.2, 1.4, 1.7 and 1.8 add their message types here, so no other module emits HL7 v2, FHIR or DICOM (§5.2) | An ADT message round-trips over MLLP/TLS to a simulator with acknowledgement tracking; a dead-lettered message raises an owned task and an alarm; ordered replay works after a simulated outage; outbound messages come only from domain events; the DICOM and ASTM skeletons answer their simulators |
| **1.2 Identity and registration** | 1.1b, 0.7, 0.8 | `ACC-ID-01`, `ACC-ID-02`, `ACC-ID-03`, `KRI-ID-01`, `ACC-REG-01`, `TRU-PRV-02` | Document capture (barcode, MRZ, OCR) through the HAL; four-part names in three scripts; cross-script search ≤200 ms p95; reversible merge with downstream propagation; gold-set evaluation tool reporting precision (§11.2 targets); wristbands and labels print correctly |
| **1.3 Scheduling, OPD flow and referrals** | 1.2 | `ACC-SCH-01`, `ACC-OPD-01`, `ACC-SCH-02`, `INT-SEAM-01` | Appointments with the Kurdistan calendar; the token journey end to end; owned referral queues; the seam bridge (alternate identifiers from a legacy ADT feed, or the search-only EMPI client) with seam KPIs |
| **1.4 Outpatient record and orders** | 1.3 | `CLN-CHT-01`, `CLN-CHT-02`, `CLN-CHT-03`, `CLN-DOC-01`, `CLN-DOC-02`, `CLN-ORD-01`, `CLN-ORD-02` (outpatient), `CLN-IMM-01`, `CLN-IPC-01`, `CLN-INC-01` | One-screen OPD visit; problems and allergies (NKA vs not assessed); notes with provenance; lab, imaging and medication orders with order sets; immunisation with VXU; incident reporting |
| **1.5 CDS foundation** | 1.4 | `CLN-CDS-01`, `CLN-CDS-02` (outpatient subset), `CLN-CDS-03`, `reg-screening` sidecar | Mock-KB screening shown verbatim; alert tiers; silent mode; kill switches; override telemetry; the CPOE error-category harness runs on foundation content (a mock-KB run: plumbing and alert-budget accounting only, not clinical evidence) |
| **1.6 Outpatient pharmacy and stores** | 1.5 | `MED-FRM-01`, `MED-KRI-01`, `MED-OPP-01`, `MED-CS-01`, `ERP-INV-01` | Brand master with GTIN mapping and scan testing; POS sale in IQD and USD with change in either currency; narcotics register entries locked; stock decrement and charge in one transaction; FEFO |
| **1.7 Diagnostics and LIS** | 1.4 | `DX-ORD-01`, `DX-CRT-01`, `DX-LAB-01`, `DX-LAB-02`, `DX-LAB-03`, `DX-LAB-04`, `DX-LAB-05` | Specimen lifecycle; analyser simulator over ASTM and HL7; QC lockout; manual validation; critical results to named internal and external recipients with read-back; send-outs; notifiable-disease triggers |
| **1.8 RIS and PACS** | 1.4 | `DX-RIS-01`, `DX-RIS-02`, `DX-PAC-01` | MWL and MPPS against a modality simulator and an Orthanc or dcm4chee container; MRI safety screen; structured reports; actionable-finding follow-up; IID launch with the non-diagnostic banner |
| **1.9 Revenue** | 1.2 (charge sources from 1.4–1.8 as they land) | `RCM-ACC-01`, `RCM-CHG-01`, `RCM-TAR-01`, `RCM-CSH-01`, `KRI-RCM-01`, `KRI-RCM-02`, `KRI-PAY-01`, `RCM-TAX-01`, `RCM-INS-01`, `RCM-SCH-01`, `RCM-DEN-01`, `ERP-FIN-01` | Charges from clinical events only; packages and deposits; per-currency shift close with zero variance in drills; doctor-fee statements; corporate credit with pre-approval and document packs; three-way reconciliation with a simulated acquirer; daily GL journal reconciles to the dinar; the re-pricing replay works |
| **1.10 Front door and messaging** | 1.7, 1.8, 1.9 | `DFD-MSG-01`, `KRI-MSG-01`, `DFD-REC-01`, `KRI-LOC-01`, `KRI-LOC-02` (framework) | Report release with OTP plus knowledge check, single-use links ≤72 h, labelled results blocked; GSM/SMPP gateway adapter queues during a simulated internet cut; trilingual receipts and reports |
| **1.11 Reporting and statutory** | 1.6, 1.7, 1.9 | `OPS-MIS-01`, `OPS-STAT-01`, `OPS-STAT-02`, `AI-DAT-01`, `AI-DAT-02a`, `CLN-QI-01` (engine) | Owner's dashboard from the replica; indicator catalogue; KRG return framework with a sample format; notifiable diseases; locked registers; CDC landing at the central profile |
| **1.12 Integration Hub completion** | 1.1b, 1.4, 1.7 | `INT-ENG-01` (full), `INT-FHIR-01` (read), `INT-DOC-01`, `INT-IPS-01` | Conformance profiles for the R1 message set; dead-letter alarm and ordered replay in chaos tests; FHIR projections validate; IPS `$summary`; PDF/A documents |
| **1.13 On-site cell, central site, continuity** | Phase 0 (grows alongside every Phase 1 WP) | `PLT-OPS-01`, `PLT-OPS-02`, `PLT-SITE-01`, `PLT-PWR-01`, `PLT-OPS-04`, `PLT-OPS-05`, `PLT-OPS-07`, `PLT-EDGE-01`, `TRU-BCP-01`, `TRU-BCP-02`, `TRU-BCP-03`, `TRU-BCP-04`, `TRU-BCP-05`, `TRU-KEY-01` (full), `TRU-SEC-02`, `TRU-SEC-03` | Installer and burn-in suite; fleet console; signed offline media; N-1 rollback; DR replication with lag alarms; continuity instance; edge agent for (a) a polyclinic attached to a hospital cell over metro links (DP#1's wedge topology, including metro-link loss with continuity and downtime blocks) and (b) a stand-alone polyclinic on the pooled tier; downtime number blocks and packets; power-cut and WAN-cut chaos tests pass; backups restore |
| **1.14 Implementation tooling** | 1.2–1.9 | `IMP-FND-01`, `IMP-MIG-01`, `IMP-RDY-01`, `IMP-TRN-01`, `IMP-TEL-01`, `IMP-SUP-01` | Foundation content (synthetic, flagged) loads; the Migration Workbench runs a mock conversion with the accounting identity at 100%; readiness scorecard and RG evidence templates; a TRAIN environment with synthetic patients; usability telemetry; status page |
| **1.15 R1 hardening and evidence** | all other Phase 1 WPs | — | The 300-bed day on the reference cell within SLOs [HUMAN: reference hardware]; wedge scenario suites green; seam scenario suite green; penetration-test readiness pack; Release Evidence Pack; RG1–RG4 evidence prepared [HUMAN: independent assessor, CSO, hospital] |

**Phase 1 exit (R1):** every R1 feature done; the R1 scenario suites, chaos suite and restore test green; zero open Sev-1 defects; no unmitigated high-risk hazard; zero untranslated strings in clinical paths; evidence pack complete. Go-live itself is a [HUMAN] decision through RG1–RG4 (§18.13); the wedge RG1 evidence also includes the signed seam hazard analysis and the tax-counsel opinion (Q-K6).

### Phase 1.1: R1.1 (≈M25)

`DFD-PAY-01` wallet and QR payment links; `DFD-BOK-01` booking links; `KRI-STAT-02` DHIS2 export; document-pack automation (`RCM-INS-01`); LIS autoverification v1 in `reg-lis-rules`, activated only where the Boundary Register allows (`DX-LAB-03`); MIS breadth; queue display boards (`ACC-OPD-01`); FHIR SMART, Bulk and Subscriptions (`INT-FHIR-01`). Exit: each item works and its manual path is documented; autoverification passes its validation set and stays off until the Register says otherwise.

### Phase 2: R2a inpatient Core (code-complete M24, or M21 under W2-K; first live M27)

| WP | Depends on | Features | Exit evidence |
|---|---|---|---|
| **2.1 ADT and bed board** | 1.3 | `ACC-ADT-01`, `ACC-ADT-02`, `OPS-FLW-01` | Admission, transfer, leave and discharge with location history as the single source of truth; the bed state machine with exclusion constraints; census; discharge never blocked by money (SI-12 property tests) |
| **2.2 Inpatient billing** | 2.1, 1.9 | `RCM-*` inpatient scope (§9.20–§9.21) | Deposits by package or bed category with top-up alerts; day-wise running bill against the estimate; packages with inclusions, exclusions and LOS limits; discharge billing separate from clinical discharge |
| **2.3 Operating theatres: scheduling and billing** | 2.1, 1.6, 1.9 | `SPC-OT-01`, `SPC-OT-03` (charging and stock) | Bookings gated by privileges; lists; implants and consumables to charge and stock in one scan |
| **2.4 Inpatient pharmacy under control sets** | 2.1, 1.5, 1.6 | `MED-DSP-01`, control sets B and C (§10.3), the patient-supplied medicine workflow | Pharmacist-only transcription with the order image; KB screening and the dosing double check at transcription; no MAR anywhere; monthly audit sampler; stewardship control set; patient-supplied items unscannable until received and relabelled |
| **2.5 Registers and maternity registration** | 2.1 | `CLN-ACP-01`, `SPC-MAT-01` (newborn registration, mother–baby link, birth notification), `SPC-DTH-01`, `OPS-STAT-02` (MLC, births, deaths) | Locked registers with addenda; death certificate with ICD-10 cause; code status recorded and on the banner |
| **2.6 R2a hardening** | 2.1–2.5 | — | Two integrated test cycles on complete Core scope; scenario suites green; transcription-seam hazard evidence complete (under W2-K it must be signed by DP#1's CSO before the M21 RG1 [HUMAN]) |

### Phase 3: R2b Clinical Safety (feature-complete = T-150 at M32; code freeze = RG1 at M34; live M37)

| WP | Depends on | Features | Exit evidence |
|---|---|---|---|
| **3.1 Inpatient CPOE** | Phase 2 | `CLN-ORD-02` (inpatient), `CLN-CDS-02` (full), `CLN-CDS-08` | All timing types; order sets; verbal orders with read-back and co-sign timers (refused for antineoplastics); pregnancy status at ordering; the atomic order-sign transaction (C1); control set C at order entry (indication and approver for restricted antimicrobials, the 48–72 h time-out task, a stop or review date on every antimicrobial order, DDD/DOT reporting that includes CPOE orders) |
| **3.2 Verification and dispensing** | 3.1 | `MED-PHV-01`, control set A, the KB ≥10× hard stop, the pharmacist-cover alarm | Verification queue with the STAT timer; independent double check enforced; seeded 10× errors stopped; alarm after 30 minutes without a logged-in pharmacist |
| **3.3 eMAR and BCMA** | 3.2 | `MED-MAR-01`, `MED-BCM-01`, `MED-INF-01`, `PLT-UX-04` | Web and mobile BCMA; offline mode with revalidation and flagged facts; high-alert double check; time-critical doses never delayed by money; property tests for SI-02, SI-13 and SI-15 at 10⁶ sequences |
| **3.4 Nursing** | 2.1 | `NUR-FLW-01`, `NUR-FLW-02`, `NUR-CP-01`, `NUR-WND-01`, `CLN-BH-01` | Brain-sheet, flowsheets with field governance, I&O, assessments, care plans, wound photos, restraint timers, suicide screening; nurse UI language with Latin drug names and Western digits |
| **3.5 Early warning (Regulated Module #1)** | 3.4 | `CLN-CDS-05` (`reg-ews`) and its fallback | NEWS2/PEWS/MEOWS from the source documents in `docs/content-sources/` (§3.5) with 100% boundary-value tests; render integrity; fail-safe; escalation tasks; activation blocked until the Register allows |
| **3.6 Emergency department** | 3.1 | `CLN-ED-01`, `CLN-ED-02` | Quick registration; one configurable triage scale; tracking board; pathway clocks; MLC flow |
| **3.7 Perioperative** | 2.3, 3.3 | `SPC-OT-02`, `SPC-OT-03` (clinical record) | WHO checklist (sign-in, time-out, sign-out) with site marking; intra-op record with counts and implants |
| **3.8 ICU and code documentation** | 3.3, 3.4 | `SPC-ICU-01` | Hourly flowsheet, fluid balance, drips, ventilator, bundles, with nurse-entered vitals; code documentation |
| **3.9 Maternity and diet** | 2.5, 3.4 | `SPC-MAT-01` (L&D record), `SPC-DIE-01` | Labour and delivery record; diet orders with religious preferences and allergy propagation |
| **3.10 Transfusion** | 3.3 | `DX-BB-01`, `DX-BB-KRI-01`, `DX-BB-02` (optional) | Relabel with blind double entry and quarantine on mismatch; T1 workflow; `reg-transfusion` T2 and the scripted fallback; WBIT checks |
| **3.11 Results, discharge, handoff, med rec** | 3.3 | `CLN-RES-01`, `CLN-DOC-03`, `CLN-MRC-01`, `CLN-HND-01` | Results inbox with surrogates and pending-at-discharge queues; discharge summary and trilingual patient instructions from templates; med rec blocked while undecided; I-PASS |
| **3.12 HIM and the legal record** | 2.5 | `CLN-DOC-04`, chaperone documentation, guardian/co-signer consent, basic privacy reports (§13.1) | Legal health record definition; deficiencies; manual release-of-information register; retention and legal hold |
| **3.13 Cutover tooling for active inpatients** | 3.3 | `IMP-MIG-01` (inpatient pack) | Pharmacist pre-build of orders "pending prescriber signature"; hard MAR cut; "last given" banner for 24 h; chart scanning to PDF/A |
| **3.14 R2b validation** | all other Phase 3 WPs | — | Three integrated test cycles on complete scope with seeded errors; the CPOE error-category harness with the licensed KB and CSO-approved scenarios [HUMAN]; model-ward scripts in TRAIN; S9-K offline-conflict suite on the real cell profile; summative-usability materials in three languages; Release Evidence Pack [HUMAN: usability studies, CSO sign-off, independent assessor, Boundary Register opinions] |

**Phase 3 exit:** everything in §22.3, plus BCMA, CPOE and transfusion scenario suites green; interruptive alerts ≤8 per 100 medication orders on replay; NICU/PICU scripts pass under control set A.

### Phase 4: R2.1 (by M40)

`SPC-AN-01` anaesthesia pre-assessment and intra-op/PACU record (lite); `RCM-COD-01` ICD-10 coding workbench; `DEV-GW-01` and `DEV-VAL-01` the validated ICU monitor feed; `ERP-PRC-01` procurement-lite with AP/AR breadth and the consignment bill-only purchase order; `IMP-GOV-01` governance intake; release-of-information workflow automation (`CLN-DOC-04`); secondary statutory returns (`OPS-STAT-01`). Each has a manual path until it ships.

### Phase 5: P2 depth (M38–M54; GA wave ≈M50)

Order of work: **the Dose Engine first** (`MED-DOSE-01`; shadow mode ≥4 weeks, C2 activation), then the stewardship module (`CLN-AMS-01`), microbiology (`DX-MIC-01`), maternity depth (`SPC-MAT-02`, `SPC-NIC-01`), full AIMS (`SPC-AN-02`), the patient app (`DFD-APP-01`), lite GL (`ERP-FIN-02`) and CMMS (`ERP-HTM-01`), which together make up K's GA wave. Then the rest of P2: `PLT-CFG-04`, `TRU-AUD-02`, `ACC-OPD-03`, `ACC-TRF-01`, `CLN-CDS-04`, `CLN-CDS-06` (sepsis screen, Regulated Module #2), `CLN-ED-03`, `CLN-IPC-02`, `MED-INF-02`, `MED-ADC-01`, `MED-ONC-01`, `DX-POC-01`, `DX-RIS-03`, `DX-CRD-01`, `DX-BB-03a`, `SPC-OT-04`, `SPC-ICU-02`, `SPC-ONC-01`, `SPC-REH-01`, the scheme part of `RCM-SCH-01`, `RCM-AI-01`, `ERP-FIN-03`, `ERP-IMP-01`, `ERP-HR-02`, `ERP-ROS-01`, `ERP-SVC-01`, `OPS-CMD-01`, `OPS-RTL-01`, `INT-PH-01`, the AI platform and products (`AI-GW-01`, `AI-GOV-01`, `AI-DCS-01`, `AI-SUM-01`, `AI-RCM-01`, `AI-PAT-01`; none of this starts before company gate G3, ≈M40, K-23), `AI-DAT-02b`, `DFD-TEL-01`, `DFD-CRM-01`, `IMP-MAT-01`, `IMP-CRT-01`. Items without IDs: the Iraq federal pack, IHE ACM consumer, referrer portal (no commission features), Ramadan mode, same-gender clinician preference, cross-referenced group identities, regional-cloud ciphertext backups (after Q-K2), and the first AI SKUs (dictation structuring, insurer document-pack assembly, template-suggested patient instructions, no-show outreach).

### Phase 6: P3 (M52+ or partner-led)

`PLT-OPS-03` multi-site edge cell (after a dedicated reconciliation hazard analysis), `NUR-STF-01`, `MED-IV-01`, `DX-LAB-06`, `DX-AP-01`, `DEV-ALM-01`, `DEV-SDC-01`, `SPC-ICU-03`, `SPC-DIA-01`, `SPC-OTH-01`, `RCM-CST-01`, `OPS-PRD-01`, `INT-OEHR-01`, `AI-AMB-01` (Sorani and Badini only after S8-K), `AI-NUR-01`, `AI-INB-01`, `AI-IMG-01`, `DFD-RPM-01`, `CLN-CDS-07`, federated benchmarking and an app marketplace.

---

## 22. Definition of Done

### 22.1 Feature (every item true, with evidence)

1. **Specified:** feature ID, acceptance criteria and safety-impact value; module spec updated; the state machines and invariants it touches specified first.
2. **Domain-correct:** invariants enforced in the domain layer for every channel; commands idempotent; journal rows written in the same transaction; domain events published as catalogued; clinical time and recorded time both captured.
3. **Trusted:** policy checks on every access; BALP audit events for every PHI read, write, print and export; sensitivity labels and purpose-of-use honoured.
4. **Tested:** unit, property-based (for anything with state), integration and contract tests; end-to-end tests for critical paths; scenario suite updated; everything green in this session. Coverage [P]: domain and application layers ≥85% line and branch; Tier 2 modules 100% boundary-value coverage and a mutation score ≥85%.
5. **Usable:** complete in `en`, `ckb` and `ar` with zero missing keys in clinical paths; RTL screenshots captured and checked; no serious or critical axe findings; full keyboard path; banner present on clinical screens; route performance budget met.
6. **Safe:** hazard entries updated; each control verified by a named test; kill switch for any clinical behaviour; known anomalies recorded.
7. **Operable:** metrics, traces and alarms in place; runbook updated; runs on the dev cell (the three-node profile); migration upgrade-and-rollback (N-1) passes; configuration delivered as a bundle.
8. **Documented:** API and event docs regenerated; trilingual help text; CHANGELOG; ADR for any decision.
9. **Evidenced:** test summary, screenshots and performance numbers stored; traceability regenerated.
10. **Reviewed:** the automated review found no unresolved critical or major findings. Tier 1 and Tier 2 changes also show a human code review, or are listed as "awaiting human code review" (§3.5).

### 22.2 Work package

All its features are done; its exit criteria in §21 are met with evidence; `STATUS.md`, `BACKLOG.md`, `KNOWN-ANOMALIES.md` and the hazard log are current; a reviewer report exists.

### 22.3 Release

All features done; scenario suites, chaos suite and restore test green; the 300-bed day within SLOs on the reference cell; no unwaived critical or high vulnerabilities; SBOM, VEX, provenance and signatures produced; upgrade from N-1 and rollback tested; the Release Evidence Pack and known-anomalies list generated; no synthetic content in the promoted bundles (§19.4); human code review recorded for every Tier 1 and Tier 2 change [HUMAN]; Safety Board approval [HUMAN].

---

## 23. Open decisions and assumptions: how to build around them

Build every one of these as configuration or a port with K's default, so a later answer is a data change, not a rewrite. Keep them in `OPEN-QUESTIONS.md` until a human closes them; one moves to `DECISIONS-NEEDED.md` only when it blocks a work package.

| # | Question | Default to build with |
|---|---|---|
| Q-K1 | Does design partner #1 have a polyclinic or diagnostic centre? Is hospital A on paper or an electronic ADT? | Build for W1-K (polyclinic first, with the seam controls in §9.2) and keep W2-K buildable (§21, wedge variants). K's default if this stays unanswered is W2-K: Core HIS across hospital A at ≈M24, with R2a code-complete at M21. Build the search-only EMPI client and `INT-SEAM-01` |
| Q-K2 | May encrypted backups or PHI-free services use a regional cloud? May AI inference run offshore? | No PHI offshore in any form; Kurdistan DR site only. Regional-cloud backup target behind a disabled-by-default adapter |
| Q-K3 | KRG return formats, notifiable-disease rules, DHIS2 use, birth and death forms | Build the indicator catalogue and export framework; formats load as configuration |
| Q-K4 | Device status of NEWS2, transfusion verification, LIS autoverification, the Dose Engine; any vigilance channel | Treat all as devices; fallback control sets active; voluntary post-market surveillance reports |
| Q-K5 | Electronic signatures and records law; admissibility; retention | Simple electronic signatures with strong authentication and audit behind a pluggable signature-provider port; never auto-delete; 25-year retention floor |
| Q-K6 | Tax on hospital services; receipt rules | A configurable tax and receipt engine; receipt templates as configuration. The zero rate is a development default only: a tax-counsel opinion is a [HUMAN] prerequisite for the R1 go-live and part of the wedge RG1 evidence (K §12.1) |
| Q-K7 | Kotlin vs C# | Kotlin (ADR-002) |
| Q-K8 | Drug-KB vendor and licence | A vendor-neutral drug-KB port with a synthetic mock KB for tests; the regional brand master is our own asset |
| Q-K9 | SNOMED CT licence | Global Patient Set plus local codes; terminology service ready for SNOMED |
| Q-K10 | Payment, wallet and messaging partners | Card-terminal and wallet ports with one reference adapter each, plus WhatsApp and SMS adapters; vendors chosen later |
| Q-K11 | Colocation operators | Central and DR deployment parameterised by site; no operator-specific code |
| Q-K12 | National ID verification service or card SDK; MRZ and barcode formats | Capture from the document, verify later; card-format parsers as plug-ins |
| Q-K13 | National health insurance in the Region | The scheme abstraction is ready; no adapter until the scheme arrives; the federal adapter sits in the Iraq pack |
| Q-K14 | Public blood bank labels and issue documents | Relabel at receipt (SI-11 controls); ISBT 128 parsing ready |
| Q-K15 | Accreditation targets buyers value | JCI pack first |
| Q-K16 | Federal entry route | Iraq pack as configuration |
| Q-K17 | Badini output script | Arabic script; Latin-script templates possible through `ku-Latn` |
| Q-K18 | Public-sector pilot funding | No public-sector-specific features |
| Q-K19 | May hospitals price, take deposits and invoice in USD? | IQD price lists, with USD accepted at the posted rate; USD price lists disabled by default behind a tenant setting |

The 37 local assumptions L-1…L-37 are in K Appendix B. Track them in `ASSUMPTIONS.md` (§3.1). Any code that depends on one names it in a comment and reads its value from the Kurdistan pack.

---

---

## Appendix A. The backlog of record (Kurdistan)

Every feature the programme builds, integrates or deliberately drops, from R14 Appendix A as amended by BP §4.1 and K §4.1. **Sizes** are engineer-weeks of happy-path coding (S≈3, M≈8, L≈20, XL≈50); squad person-months ≈ engineer-weeks × 0.72 plus regulated overhead. **Stance:** B build, I integrate, P partner or licence († = domain-level stance). **Phase** is the first Kurdistan release that runs the feature: R1 wedge, R1.1, R2a inpatient Core, R2b Clinical Safety, R2.1, P2, P3, or DROPPED-K. Where this prompt places a feature differently from the K text or from a "not determinable" placement, the note says so, and **[P]** marks a safety-driven change of this prompt. Keep this table in `docs/program/backlog.yaml` and use it for scope as §1 says: where it deliberately differs from K (a note, a [P] mark or an A.20 entry), follow it and keep the item open until a human confirms; where it differs from K without such a mark, K wins.

### A.1 PLT: Platform/NFR

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `PLT-CORE-01` | Clinical journal | XL | R1 | B | Bitemporal append-only journal; entered-in-error/amend semantics; provenance |
| `PLT-CORE-02` | Enterprise hierarchy | L | R1 | B | Tenant>legal entity>facility>unit>bed; scoped config inheritance |
| `PLT-CORE-03` | State machines + invariants | L | R1 | B | Domain state machines; server-side safety invariants on all channels · *SI-01..21 kept; SI-20/21 restated (K §5.1)* |
| `PLT-CORE-04` | Event catalogue + outbox | M | R1 | B | Domain event catalogue; transactional outbox |
| `PLT-CORE-05` | Terminology service | L | R1 | B+I | SNOMED/LOINC/ICD-10 variants/UCUM/ATC + licence entitlements · *WHO ICD-10; SNOMED GPS until licensed (ADR-015)* |
| `PLT-CORE-06` | Rules engine | L | R1 | B | Versioned rules; simulation/replay; approval; effective dating (reg C) |
| `PLT-CORE-07` | Task/work-queue engine | M | R1 | B | Every item owned; SLA timer; orphan alarm · *Seam messages to hospital A are owned tasks (SI-03)* |
| `PLT-CFG-01` | Config-as-product | L | R1 | B | Typed registry; change sets; signed bundles; promotion; 3-way merge |
| `PLT-CFG-02` | Country packs | M | R1 | B | Effective-dated code sets, tax, claims, statutory reports · *Kurdistan pack; BP calendar addition kept (with PLT-UX-03)* |
| `PLT-CFG-03` | Forms engine | L | R1 | B | FHIR Questionnaire/SDC renderer + builder |
| `PLT-CFG-04` | Extension SDK | M | P2 | B | Plugin slots; SMART app launch |
| `PLT-UX-01` | Design system | M | R1 | B | Keyboard-first design system; WCAG 2.2 AA · *Western digits for clinical numerals (K §6.2)* |
| `PLT-UX-02` | Workstation shell | M | R1 | B | Silent ZPL wristband/label print; scanners; badge tap; FHIRcast · *Kurdish/Arabic label shaping or raster fallback (K §9.2)* |
| `PLT-UX-03` | i18n / RTL | L | R1 | B | Arabic RTL; Hijri+Gregorian; bilingual prints; multi-script/phonetic name search · *Re-scoped, same size: Kurdish+Arabic RTL; Hijri optional* |
| `PLT-UX-04` | Mobile app framework | L | R2b | B | Mobile clinical app framework; encrypted offline cache · *One app: nurse mode (BCMA, R2b) + physician mode (K §6.6) · Placed R2b: Mobile app is needed for nurse BCMA in R2b* |
| `PLT-OPS-01` | Cells | XL | R1 | B | Cell-based multi-tenant SaaS with in-country cells (IN/SA/AE) · *Becomes on-site hospital cells + Kurdistan central/DR site (K-16)* |
| `PLT-OPS-02` | On-prem install | L | R1 | B | On-prem/state-DC install from same signed artefacts · *P2→MVP inside PLT-SITE-01; cell at hospital A by M18* |
| `PLT-OPS-03` | Edge cell | XL | P3 | B | Edge cell (local primary) for low-connectivity hospitals · *Single-hospital cell now default; multi-site edge cell P3 (KDV-2)* |
| `PLT-OPS-04` | HA + DR | L | R1 | B | HA multi-AZ; cross-region DR; PITR · *On-site sync HA; Kurdistan DR site, RPO ≤15 min (K-17)* |
| `PLT-OPS-05` | Observability | M | R1 | B | Observability; RUM per screen/site; SLO dashboards |
| `PLT-OPS-06` | Performance gate | M | R1 | B | Synthea 1000-bed day-in-the-life load test in CI · *K tests 300-bed day on three-node cell (K-13)* |
| `PLT-OPS-07` | Zero-downtime releases | M | R1 | B | Expand/contract releases; N-2 on-prem policy · *Monthly on-site train; max drift N-1 (ADR-021)* |
| `PLT-EDGE-01` | Site edge agent (BP new) | L | R1 | B† | Plane B appliance: continuity replica, queue state, print spool, device bridge · *Outpatient-tier sites; merged into cell at hospitals (ADR-011)* |
| `PLT-SITE-01` | On-site cell (K new) | L+M | R1 | B† | Umbrella, 48 ew: PLT-OPS-02 (L) + fleet/licensing/certificates/updates (L) + on-site immutable backup, off-site replication (M) · *Sub-IDs not assigned; ew here excludes PLT-OPS-02* |
| `PLT-PWR-01` | Power-loss resilience (K new) | M | R1 | B† | Power-loss resilience (K §4.1); power design in ADR-026 · *Inferred R1: RG1 power obligations; M18 power-cut tests* |

### A.2 TRU: Trust plane, security, downtime

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `TRU-IAM-01` | SSO/MFA | L | R1 | B+I | SAML/OIDC SSO; SCIM; phishing-resistant MFA; badge tap-and-go |
| `TRU-IAM-02` | RBAC/ABAC | L | R1 | B | RBAC+ABAC+care relationship; privilege-gated clinical actions |
| `TRU-IAM-03` | Break-the-glass | S | R1 | B | Reason capture; review queue |
| `TRU-PRV-01` | Sensitivity labels | M | R1 | B | Labels + purpose-of-use propagated to UI/API/print/HIE · *SI-21 labels: HIV, MH, reproductive, GBV, MLC, VIP* |
| `TRU-PRV-02` | Consent management | M | R1 | B | Consent management incl. ABDM consent artefacts · *ABDM artefacts out; K consent registry (K §10)* |
| `TRU-AUD-01` | BALP audit | M | R1 | B | 100% PHI-access audit; tamper-evident; SIEM streaming · *Message report releases logged* |
| `TRU-AUD-02` | Privacy monitoring | M | P2 | B+I | Privacy monitoring; patient-facing access log · *Patient-visible access log P2 (K §10)* |
| `TRU-KEY-01` | Per-tenant KMS | M | R1 | B+I | Per-tenant KMS + BYOK/HYOK · *BP P2→MVP; HSM/TPM KMS, no HYOK (ADR-008); inferred R1* |
| `TRU-SEC-01` | Secure SDLC | M | R1 | B | IEC 81001-5-1/SSDF; SBOM/VEX; signed builds; VDP |
| `TRU-SEC-02` | ISO 27001 + SOC 2 | L | R1 | B | ISO 27001/27701/27017/27018 + SOC 2 Type II · *ISO 27001(+27701) ≈M24; SOC 2 only if a buyer asks · Placed R1: Controls built from R1; the certification itself is [HUMAN]* |
| `TRU-SEC-03` | Market attestations | M | R1 | B | CERT-In Safe-to-Host; NCA ECC/CCC; ADHICS; MeitY/CST · *Replaced, same size: ISO 27001 and local attestations · Placed R1: Controls built from R1; attestations are [HUMAN]* |
| `TRU-BCP-01` | Read-only continuity | L | R1 | B | Unit snapshots ≤15 min stale; shadow viewer; printable packets · *Edge-agent continuity R1; DR continuity instance by hospital A RG4* |
| `TRU-BCP-02` | Downtime ID blocks | M | R1 | B | Downtime MRN/encounter/accession blocks; offline wristband/label print · *Downtime accession numbers in outpatient lab protocol* |
| `TRU-BCP-03` | Back-entry | L | R1 | B | Back-entry + reconciliation keeping original event times · *Frequent outages; sized for back-entry (SI-10); inferred R1* |
| `TRU-BCP-04` | Immutable backups | L | R1 | B | Isolated immutable backups; clean-room rebuild; quarterly restore tests · *On site + DR site; ≥90 days of restore points* |
| `TRU-BCP-05` | Code-Dark drills | S | R1 | B | Drill tooling; SAFER self-assessment workbook · *BP P2→MVP; WAN- and power-cut drills gate RG3* |
| `TRU-REG-01` | QMS + Boundary Register | XL (BP L→XL) | R1 | B | ISO 13485/IEC 62304/ISO 14971 QMS; Regulatory Boundary Register service (reg Y) · *ISO 13485 certificate deferred; Register is Tier 2 switch (K-05)* |
| `TRU-REG-02` | Safety case + hazard log | L (BP M→L) | R1 | B | Hazard-log service; Release Evidence Pack generator · *DCB0129 model; safety case per release (K §5.3)* |

### A.3 ACC: Patient access

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `ACC-ID-01` | EMPI | L | R1 | B | Probabilistic match; steward queue; reversible merge/unmerge · *Cross-script gold set (S14-K); auto-merge precision ≥99.9%* |
| `ACC-ID-02` | National ID plug-ins | M | R1 | B | ABHA; Absher/Nafath/Iqama; Emirates ID/UAE Pass · *Replaced, same size: Iraqi ID documents (card, residency, passport, UNHCR/IDP)* |
| `ACC-ID-03` | Aliases, newborn, photo | M | R1 | B | Unknown/trauma/MCI aliases; distinct newborn naming; photo capture · *Inferred R1 (registration); K §4.3 Identity list* |
| `ACC-REG-01` | Registration | M | R1 | B | Sponsor/payer selection; coverage; consents; AR/EN names · *Output language captured at registration (K §6.7)* |
| `ACC-ADT-01` | ADT | L | R2a | B | ADT incl. pending/LOA/corrections; HL7 ADT broadcast |
| `ACC-ADT-02` | Bed board | M | R2a | B | Bed state machine; EVS status; isolation |
| `ACC-SCH-01` | Scheduling | L | R1 | B | Provider/resource scheduling; templates; overbooking; waitlists · *Friday–Saturday weekend; Kurdistan holidays* |
| `ACC-SCH-02` | Referral tracking | M | R1 | B | Referral intake; order-to-completion tracking · *BP P2→MVP; owned queues across hospital-A seam* |
| `ACC-OPD-01` | OPD token journey | M | R1 | B | Token/queue; reg>vitals>consult>bill>lab>pharmacy journey; display boards · *Display boards in R1.1* |
| `ACC-OPD-02` | ABDM Scan-and-Share | S | DROPPED-K | B | ABDM QR registration (IN) · *Dropped: India national rail* |
| `ACC-OPD-03` | Kiosk | M | P2 | B+I | Self-service check-in + payment |
| `ACC-TRF-01` | Transfer centre | M | P2 | B | Transfer centre; patient transport tasks |

### A.4 CLN: Clinical core

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `CLN-CHT-01` | Chart + banner | L | R1 | B | Banner: photo, 2 IDs, allergies, code status, isolation, dated weight · *Name in patient's script plus Latin (SI-01, SI-16)* |
| `CLN-CHT-02` | Problems/allergies | M | R1 | B | Coded problems; coded allergies (reaction/severity); home meds · *'NKA' distinct from 'not assessed'* |
| `CLN-CHT-03` | Results review | M | R1 | B | Results review; trending; cumulative views · *Inferred R1 (wedge LIS/RIS results)* |
| `CLN-ORD-01` | Orderables + order sets | L | R1 | B | Orderables catalogue; versioned order sets |
| `CLN-ORD-02` | CPOE | XL | R1 | B | All timing types; verbal read-back/co-sign; lifecycle; order-to-result tracking · *OPD orders R1; inpatient CPOE R2b; R2a orders on paper · Outpatient orders R1; inpatient CPOE R2b* |
| `CLN-CDS-01` | Drug KB adapter | M | R1 | P | Drug KB abstraction (FDB/Medi-Span/Multum/MIMS/regional); local re-tiering · *Regional brand mapping; R1 OPD use unstated · Placed R1: [P] Pulled to R1 so outpatient e-prescribing is screened* |
| `CLN-CDS-02` | Order checks | L | R1 | B | DDI/allergy/dose/route/duplicate/renal/age checks (reg C) · *KB screening at R2a transcription; CPOE checks R2b · Placed R1: [P] Outpatient subset in R1; transcription checks R2a; full CPOE checks R2b* |
| `CLN-CDS-03` | CDS telemetry + harness | M | R1 | B | Override/PPV/alert-burden telemetry; CPOE error-category regression harness (Leapfrog-style, unofficial) · *Harness runs after every KB/content release (K §6.3) · Placed R1: CDS runs from R1, so telemetry and the harness do too* |
| `CLN-CDS-04` | CDS Hooks + CQL | M | P2 | B+I | CDS Hooks client; CQL engine |
| `CLN-CDS-05` | NEWS2/PEWS/MEOWS | M | R2b | B | EWS from validated obs; escalation tasks; obs frequency (reg Y) · *Regulated Module #1; non-ICU wards; Register-gated* |
| `CLN-CDS-06` | Sepsis screen | S | P2 | B | Rule-based non-interruptive worklist flag (reg Y) · *Regulated Module #2 (K-07)* |
| `CLN-CDS-07` | Predictive deterioration | M | P3 | P | Cleared partner; silent-mode local validation (reg Y) · *Conflict: K §4.3 P2 vs K §11.2 P3 · Placed P3: Device-grade partner model, silent first (K §11.2 AI-3)* |
| `CLN-CDS-08` | VTE prompts | S | R2b | B | VTE risk assessment; prophylaxis prompts · *Inferred R2b (inpatient CPOE); sweep candidate (K §5.6)* |
| `CLN-DOC-01` | Clinical notes | L | R1 | B | H&P/progress/consult notes; templates; co-sign; addenda · *English clinical text; OPD chart in R1* |
| `CLN-DOC-02` | Copy-forward provenance | M | R1 | B | Copy-forward provenance; bloat indicators; change-since-last-note · *BP P2→MVP (bloat indicator BP R2.1); K §4.2 silent · Placed R1: Provenance from the first note; bloat indicators by R2b* |
| `CLN-DOC-03` | Discharge + AVS | M | R2b | B | Discharge navigator; summary; bilingual AVS · *Patient instructions: Sorani/Badini/Arabic approved templates* |
| `CLN-DOC-04` | HIM + legal record | L (BP M→L) | R2b | B | Deficiencies; scanning; ROI; amendments; LHR; signatures; retention · *Manual ROI register until R2.1; never auto-delete* |
| `CLN-MRC-01` | Med rec | M | R2b | B | Med rec at admission/transfer/discharge · *Polyclinic history is reconciliation input only (SI-09)* |
| `CLN-HND-01` | I-PASS | M | R2b | B | I-PASS handoff; team/rounding lists · *Inferred R2b (inpatient)* |
| `CLN-RES-01` | Results inbox | M | R2b | B | Routing; surrogates; unacknowledged monitoring; pending-at-discharge queue · *Named in R2b; R1 OPD inbox unstated · Outpatient result acknowledgement runs in R1 through DX-ORD-01* |
| `CLN-ED-01` | ED triage + board | L | R2b | B | ED quick-reg; configurable triage; tracking board with timers · *One triage scale per tenant* |
| `CLN-ED-02` | ED pathway clocks | M | R2b | B | Stroke/STEMI/sepsis clocks; disposition; boarding view · *Workflow timers, not a device* |
| `CLN-ED-03` | MCI mode | M | P2 | B | MCI/disaster mode |
| `CLN-BH-01` | Suicide screen + restraint | S | R2b | B | Suicide screening; restraint/seclusion orders and timers · *Inferred R2b (inpatient orders)* |
| `CLN-IPC-01` | Isolation flags | S | R1 | B | Isolation flags and alerts · *Banner (R1) and bed board (R2a) both carry isolation · Placed R1: Banner flag in R1; bed-board use in R2a* |
| `CLN-IPC-02` | HAI surveillance | M | P2 | B | HAI surveillance; device-days; outbreaks |
| `CLN-AMS-01` | Stewardship | M | P2 | B | Restricted-antimicrobial approval; time-outs; DOT · *BP P2→MVP; K →P2; stewardship control set at go-live* |
| `CLN-ACP-01` | Code status + ACP | S | R2a | B | Code status; advance care planning documents · *Code status on banner (R1); 'code documentation' in R2b · Placed R2a: Inpatient workflow; the banner field exists from R1* |
| `CLN-INC-01` | Incidents + RCA | M | R1 | B | Incident/safety-event reporting; RCA workflow · *In K §4.3 Quality MVP; release unstated · Placed R1: Safety-event reporting from the first go-live* |
| `CLN-QI-01` | Accreditation KPIs | M | R1 | B | NABH/CBAHI/JAWDA/JCI indicator capture · *Replaced, same size: JCI + KRG licensing indicators · Placed R1: Measure engine in R1; JCI and KRG packs complete by R2b* |
| `CLN-IMM-01` | Immunisation (BP new) | M | R1 | B† | Administration/history; lot from stores; BCMA scan; VXU, FHIR Immunization · *BCMA scan with inpatient BCMA (BP); ABDM part unaddressed in K* |

### A.5 NUR: Nursing

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `NUR-FLW-01` | Flowsheets | L | R2b | B | Assessments; flowsheets; I&O; LDAs; charting by exception · *UI language per nurse; drug names, units in Latin* |
| `NUR-FLW-02` | Risk scores | M | R2b | B | Braden/Morse/delirium with care-plan triggers |
| `NUR-CP-01` | Care plans | M | R2b | B | Care plans; shift worklists; nurse handoff |
| `NUR-WND-01` | Wound photos | S | R2b | B | Wound photography + documentation |
| `NUR-STF-01` | Acuity staffing | M | P3 | B | Acuity-based staffing view |

### A.6 MED: Medication

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `MED-PHV-01` | Pharmacist verification | L | R2b | B | Verification queue with clinical screening · *Pharmacist-cover alarm; 24×7 cover is an RG1 obligation* |
| `MED-FRM-01` | Formulary | M | R1 | B | Formulary; LASA/tall-man; high-alert flags; item-master link · *Inferred R1 (OP POS); regional brands* |
| `MED-DSP-01` | IP dispensing | L | R2a | B | Unit dose/ward stock; returns; charge on dispense/admin · *Against transcribed paper orders, Core transcription control set* |
| `MED-OPP-01` | OP pharmacy POS | M | R1 | B | Retail POS; batch/expiry; e-Rx receipt · *Re-scoped: retail, dual currency, KRG pricing; H1/X, DPCO dropped* |
| `MED-MAR-01` | eMAR | L | R2b | B | Schedules; PRN reassessment; independent double-check; titrations · *No MAR from transcribed orders in R2a* |
| `MED-BCM-01` | Mobile BCMA | L | R2b | B | Patient+med scan; override reasons; dashboards; offline cache · *Unverified patient-supplied medicines never scannable* |
| `MED-INF-01` | Infusion model | M | R2b | B | Infusion data model; pump-channel association; manual rate/volume checks · *Inferred R2b (with eMAR)* |
| `MED-INF-02` | Smart pumps | L | P2 | I | PIV/IPEC via first vendor gateway (reg C) · *Only once BCMA ≥95% (K-09)* |
| `MED-ADC-01` | ADC/robots | M | P2 | I | ADC/robot interfaces; override policy |
| `MED-CS-01` | Controlled drugs | M | R1 | B | Controlled-substance registers + reconciliation (NDPS/SFDA/MOHAP) · *Replaced, same size: Iraqi narcotics registers* |
| `MED-ONC-01` | Chemotherapy | L | P2 | B | Regimens; BSA dosing; dual verification (reg C) |
| `MED-IV-01` | IV compounding | M | P3 | B+I | IV compounding/TPN; IV workflow interfaces |
| `MED-ERX-01` | National e-Rx | M | DROPPED-K | B | Wasfaty; Riayati/NABIDH; ABDM e-Rx · *Dropped: national e-Rx interface (K §14.2)* |
| `MED-DOSE-01` | Dose Engine (BP new) | L | P2 | B† | Shared Class C Dose Engine (Tier 2) · *MVP→P2 (≈M50); extended fallback control set meanwhile* |
| `MED-TNT-01` | Track-and-trace (BP new) | M | DROPPED-K | B† | SFDA RSD and UAE Tatmeen from GS1 scans · *Dropped: KSA/UAE-only* |
| `MED-KRI-01` | Brand master + labels (K new) | M | R1 | B† | Regional brand master; in-house unit-dose barcode labels · *Release unstated; brands serve POS, labels serve BCMA · Placed R1: Brand master for the R1 POS; unit-dose labels by R2a* |

### A.7 DX: Diagnostics (LIS, RIS, imaging, transfusion)

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `DX-ORD-01` | Diagnostic order lifecycle | L | R1 | B | Order>specimen/exam>result>ack |
| `DX-CRT-01` | Critical results | M | R1 | B | Named recipient; read-back; escalation · *Extended to external referring doctors (SI-04)* |
| `DX-LAB-01` | Phlebotomy + accessioning | L | R1 | B | Worklists; bedside labels; accessioning; tracking |
| `DX-LAB-02` | Analyzer connectivity | L | R1 | B+I | Middleware + direct ASTM/HL7 drivers; LAW-ready |
| `DX-LAB-03` | Validation + autoverification | L | R1 | B | Result validation; autoverification v1; delta/critical rules; reports (reg C) · *Autoverification v1 R1.1; manual validation until then* |
| `DX-LAB-04` | QC / lab-quality pack | M (BP L; K M) | R1 | B | Levey-Jennings/Westgard QC; reagent/lot tracking · *NABL upsizing dropped; ISO 15189-aligned quality pack kept* |
| `DX-LAB-05` | Send-outs | M | R1 | B | Send-out tests; reference-lab interfaces |
| `DX-LAB-06` | ISO 15189 doc control | M | P3 | B | Document control; risk register · *BP NABL condition (P3→P2) not addressed in K* |
| `DX-MIC-01` | Microbiology | L | P2 | B | Culture; AST; cascade reporting; antibiogram · *WHONET/GLASS export* |
| `DX-AP-01` | Anatomic pathology | L | P3 | B | AP workflow; synoptic reporting |
| `DX-POC-01` | POCT | M | P2 | I | POCT data-manager integration |
| `DX-RIS-01` | RIS core | L | R1 | B | Orders; scheduling; protocoling; MWL/MPPS broker; tracking · *Moved into wedge (KDV-10); BP had R2* |
| `DX-RIS-02` | Radiology reporting | M | R1 | B | Templates; structured reports; actionable-finding follow-up · *BP Form F gate dropped (PCPNDT out)* |
| `DX-RIS-03` | Dose capture | M | P2 | B | RDSR capture; exceedance review · *Not in K §4.3; K §14.2 keeps P2* |
| `DX-PAC-01` | PACS integration | M | R1 | I | DICOMweb + IID launch; bundled OSS PACS tier · *OSS viewer labelled non-diagnostic* |
| `DX-CRD-01` | ECG/endoscopy | M | P2 | I | ECG/cardiology + endoscopy report integration |
| `DX-BB-01` | Bedside transfusion | M | R2b | B | BCMA extension; orders; consent; reactions (reg C) · *Two-person e-witness; relabelled units; Register-gated T2* |
| `DX-BB-02` | Blood bank interface | M | R2b | I | e-RaktKosh/third-party/cleared BECS interface · *Not dropped in K §4.1; K §9.1 assumes no interface · Placed R2b: Optional inbound adapter only; no interface assumed (K §9.1)* |
| `DX-BB-03a` | Blood-centre inventory (BP split) | L | P2 | B | Inventory; ISBT 128 labelling (regulated track) |
| `DX-BB-03b` | Compatibility engine (BP split) | XL | DROPPED-K | B | IVD-grade compatibility engine · *Never built; licensed if ever needed* |
| `DX-BB-KRI-01` | Unit receipt + relabel (K new) | S | R2b | B+I† | Receipt of public blood-bank units; relabel with our barcode · *Blind two-person double entry; mismatch quarantines (SI-11)* |

### A.8 DEV: Devices

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `DEV-GW-01` | Device gateway | L | R2.1 | B+I | Middleware PCD-01/DEC; device–patient association · *Inferred: validated ICU monitor feed R2.1 · Nothing clinical depends on a device feed before R2.1* |
| `DEV-VAL-01` | Vitals validation UX | M | R2.1 | B | Nurse validation of auto-captured vitals; artifact marking · *Inferred with ICU monitor feed (R2.1)* |
| `DEV-ALM-01` | Alarm analytics | M | P3 | I | Via ACM-capable platform (reg Y) · *Alarm forwarding never built* |
| `DEV-SDC-01` | SDC/SDPi | L | P3 | B | ISO/IEEE 11073 SDC plug-and-play (reg C) · *Not in K §4.3; K §14.2 keeps P3* |

### A.9 SPC: Specialty

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `SPC-OT-01` | OT booking | M | R2a | B | OT booking/scheduling; list management · *Privileges gate OT booking (K §12.2)* |
| `SPC-OT-02` | WHO checklist | S | R2b | B | WHO checklist; consent; site marking; pre-op checklist |
| `SPC-OT-03` | Intra-op record + charging | M | R2a | B | Intra-op record; counts; implants/consumables to charge+stock; op note · *OT billing R2a; clinical intra-op record release unstated · OT charging and stock R2a; clinical intra-op record R2b* |
| `SPC-AN-01` | Anaesthesia record | M | R2.1 | B | Pre-assessment; intra-op/PACU record (manual/semi-auto vitals) · *Lite; paper record until R2.1* |
| `SPC-AN-02` | Full AIMS | L | P2 | B | Machine/monitor feed (reg C) |
| `SPC-OT-04` | OR analytics | M | P2 | B | Utilisation; turnover; first-case on-time |
| `SPC-ICU-01` | ICU flowsheet | L | R2b | B | q1h flowsheet; fluid balance; drips; ventilator; bundles · *Validated monitor feed in R2.1* |
| `SPC-ICU-02` | ICU severity scores | S | P2 | B | APACHE II/SOFA (reg C) |
| `SPC-ICU-03` | Tele-ICU | L | P3 | B+P | Tele-ICU |
| `SPC-MAT-01` | L&D + newborn | M | R2a | B | L&D record; newborn registration; mother–baby link; birth notification · *Re-scoped; KRG birth notification R2a; L&D release unstated · Newborn registration, mother-baby link and birth notification R2a; electronic L&D record R2b* |
| `SPC-MAT-02` | Antenatal + partograph | L | P2 | B | Antenatal episode; WHO LCG; fetal monitoring |
| `SPC-NIC-01` | NICU | M | P2 | B | NICU flowsheets; feeds; human-milk tracking |
| `SPC-ONC-01` | Oncology | L | P2 | B | Regimens; cycles; staging |
| `SPC-DIE-01` | Diet orders | S | R2b | B | Diet orders with allergy logic; tray tickets · *Religious preferences; inferred R2b (inpatient orders)* |
| `SPC-REH-01` | Rehab | M | P2 | B | Rehab/physio/dietitian documentation |
| `SPC-DIA-01` | Dialysis | M | P3 | B | Dialysis documentation; machine integration |
| `SPC-OTH-01` | Specialty kits | L | P3 | B+P | Ophthalmology/dental/cath/endoscopy |
| `SPC-DTH-01` | Death certificate | S | R2a | B | MCCD/national forms; mortuary register · *Re-scoped: KRG forms; WHO-format ICD-10 cause of death* |

### A.10 RCM: Revenue

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `RCM-ACC-01` | Patient account + ledger | XL | R1 | B | Single patient financial account; append-only ledger · *Functional-currency ledger keeps original amounts (K §12.1)* |
| `RCM-CHG-01` | Charge router | L | R1 | B | Charges from orders, administrations, bed-days, supplies |
| `RCM-TAR-01` | Tariff engine | L | R1 | B | Price lists; room categories; packages; effective dating · *IQD lists default; USD only where permitted (L-33)* |
| `RCM-CSH-01` | Cashiering | L | R1 | B | Deposits; interim bills; discounts; refunds; shifts; UPI/mada/card · *Re-scoped, same size; dual currency builds on it* |
| `RCM-TAX-01` | Tax engine | M | R1 | B | Tax + e-invoicing (GST; ZATCA Fatoora; UAE VAT) · *Replaced, same size: Kurdistan receipt/tax rules (Q-K6)* |
| `RCM-INS-01` | Payer contracts + claims | L | R1 | B | Contract rules; eligibility; pre-auth; claims with attachments · *Re-scoped: corporate/NGO/insurer credit, document packs; automation R1.1* |
| `RCM-NAT-01` | NPHIES | L | DROPPED-K | B | NPHIES adapter (SA) · *Dropped: KSA national rail* |
| `RCM-NAT-02` | NHCX/PM-JAY/TPA | L | DROPPED-K | B | NHCX + PM-JAY TMS + TPA workflows (IN) · *Dropped: India national rail* |
| `RCM-NAT-03` | Shafafiya/eClaimLink | M | DROPPED-K | B | DoH/DHA XML adapters (AE) · *Dropped: UAE national rail* |
| `RCM-COD-01` | Coding workbench | M | R2.1 | B | Coding workbench (ICD-10-AM/SBS; ICD-10; CPT); CDI worklists · *Re-scoped: WHO ICD-10, no CPT/IHACPA; manual sheet until R2.1* |
| `RCM-DEN-01` | Denials | M | R1 | B | Rejection/denial queues; resubmission; payer aging · *Inferred R1 (credit flow); denial root-cause queues* |
| `RCM-SCH-01` | Corporate credit | M (−3) | R1 | B | Government scheme + corporate credit billing (CGHS/ECHS/corporates) · *Corporate credit stays; scheme part split to P2* |
| `RCM-SCH-01 · part: scheme` | Scheme billing | ≈3 ew | P2 | B | Government-scheme part of RCM-SCH-01 · *Activated when national insurance reaches the Region* |
| `RCM-GRP-01` | DRG grouper SPI | M | DROPPED-K | I | AR-DRG shadow billing; IR-DRG (SA;AE) · *BP P2→MVP (R3 KSA); K drops: no DRG grouper* |
| `RCM-AI-01` | AI coding | M | P2 | P | AI coding suggestions with confidence routing |
| `RCM-CST-01` | Costing | L | P3 | B | Patient-level costing (TDABC/PLICS) |
| `RCM-US-01` | US RCM | XL | DROPPED-K | B+I | X12; Da Vinci; price transparency (US) · *Dropped: US-only (K §14.2)* |

### A.11 ERP: ERP

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `ERP-INV-01` | Stores | L | R1 | B | Item master; stores; FEFO; indents; ward stock; consumption-to-charge · *Inferred R1 (OP POS dependency)* |
| `ERP-PRC-01` | Procurement-lite | M | R2.1 | B | PR>PO>GRN>3-way match; vendor master · *K R2.1 says 'breadth'; base release unstated* |
| `ERP-FIN-01` | AP/AR + GL export | M | R1 | B+I | AP/AR; GL journal posting/export · *Daily GL journals R1 (K §9.1); AP/AR breadth R2.1* |
| `ERP-FIN-02` | Lite GL | L | P2 | B | Native lite GL (multi-entity, multi-currency); fixed assets |
| `ERP-FIN-03` | ERP connectors | M | P2 | I | SAP S/4; Oracle Fusion; Workday; Dynamics · *Not in K §4.3; K §14.2 keeps P2* |
| `ERP-IMP-01` | Implant/UDI | M | P2 | B | Implant/UDI capture; consignment; recall trace · *K §12.2 puts consignment in MVP procurement-lite · Consignment bill-only PO built in R2.1 with ERP-PRC-01* |
| `ERP-HTM-01` | CMMS | M | P2 | B | Biomedical asset register; PM; work orders |
| `ERP-HR-01` | Staff master | M | R1 | B | Staff master; credentialing/privileging records · *Medical Syndicate/IMA registration IDs; inferred R1* |
| `ERP-HR-02` | Payroll integration | M | P2 | I | HR/payroll/attendance via local payroll · *Always integrated* |
| `ERP-ROS-01` | Rostering | M | P2 | B | Basic rostering; acuity staffing |
| `ERP-SVC-01` | Support services | M | P2 | B | CSSD; linen; housekeeping/BMW; diet kitchen · *CSSD-lite (K §4.3)* |

### A.12 OPS: Operations

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `OPS-FLW-01` | Discharge clearance | M | R2a | B | Non-blocking clearance; expected discharge date; discharge tasks · *Inferred R2a (discharge billing); SI-12 extended* |
| `OPS-CMD-01` | Command-centre data | L | P2 | B | Command-centre data layer + tiles |
| `OPS-PRD-01` | Predictive discharge | M | P3 | B | Predictive discharge/census forecasting · *Conflict: K §4.3 P3 vs K §11.2 forecasts P2* |
| `OPS-MIS-01` | MIS dashboards | M | R1 | B | Revenue; collections; payer mix; occupancy/ALOS; TAT · *MIS basics R1, breadth R1.1; owner's dashboard by currency* |
| `OPS-STAT-01` | Statutory returns | M | R1 | B | HMIS/DHIS2; MoH statistics; notifiable disease · *Replaced, same size: KRG Ministry returns; inpatient R2a* |
| `OPS-RTL-01` | RTLS | M | P2 | I | RTLS location events · *BP/K §4.3 list RTLS ingestion P2; counts keep P3 · Placed P2: RTLS ingestion is P2 (K §4.3, §9.2); the engine is never built* |
| `OPS-STAT-02` | Statutory registers (BP new) | L | R1 | B† | Locked append-only registers; per-format export · *Kurdistan content; MLC, births/deaths R2a* |

### A.13 INT: Interoperability

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `INT-ENG-01` | HL7 v2 engine | L | R1 | B+I | MLLP/TLS; ack-state visibility; replay; owned queues |
| `INT-FHIR-01` | FHIR façade | L | R1 | B+I | FHIR R4 façade (IPA; SMART; Bulk; Subscriptions) · *SMART/Bulk/Subscriptions in R1.1* |
| `INT-DOC-01` | Documents | M | R1 | B | PDF/A + CDA/FHIR documents from one source · *K §4.3 lists PDF/A + FHIR (no CDA)* |
| `INT-ABDM-01` | ABDM | L | DROPPED-K | B | ABDM M1/M2/M3 (IN) · *Dropped: India national rail* |
| `INT-SEHE-01` | SeHE | M | DROPPED-K | B | Saudi HIE connectivity (SA) · *Dropped: KSA national rail* |
| `INT-UAE-01` | UAE HIEs | L | DROPPED-K | B | Malaffi/NABIDH/Riayati adapters (AE) · *Dropped: UAE national rail* |
| `INT-IPS-01` | IPS $summary | M | R1 | B | IPS $summary generation · *Conflict: K §4.3/§9 MVP 'from day one'; §4.1 silent* |
| `INT-PH-01` | Public-health reporting | M | P2 | B | IHIP/IDSP; HESN · *Not in K §4.3; notifiable diseases via OPS-STAT (R1)* |
| `INT-OEHR-01` | openEHR adapter | M | P3 | I | openEHR CDR adapter (EHRbase) · *Kept (K §14.2)* |
| `INT-EU-01` | EHDS | XL | DROPPED-K | B | EHDS components (EU) · *Dropped: EU-only (K §14.2)* |
| `INT-US-01` | ONC/TEFCA | XL | DROPPED-K | B+P | ONC + TEFCA via partner (US) · *Dropped: US-only (K §14.2)* |
| `INT-SEAM-01` | Group seam bridge (BP new) | M | R1 | B† | Alternate IDs from legacy ADT; REF/ADT/MDM; ORM/OML/ORU with ack state · *Hospital-A seam until its M37 go-live* |

### A.14 AI: AI and data

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `AI-GW-01` | AI gateway | L | P2 | B | In-country model routing; prompt mgmt; evaluation; kill switch · *MVP→P2 (≈M42); counsel-approved region pinning* |
| `AI-GOV-01` | AI control plane | L | P2 | B | Registry; model cards; provenance; draft states; monitoring · *MVP→P2; K costs gateway + plane at 20 total* |
| `AI-AMB-01` | Ambient OPD | M | P3 | P | Ambient OPD documentation (EN/AR/HI), ≥2 partners · *MVP→P3; Sorani/Badini only after S8-K* |
| `AI-DCS-01` | Discharge draft | M | P2 | B | Source-linked discharge summary draft; clinician sign-off · *MVP→P2; English drafts with omission checklist* |
| `AI-SUM-01` | Chart summary | M | P2 | B | Chart summary / pre-visit brief · *Not in K §4.3; K §14.2 keeps P2* |
| `AI-NUR-01` | Nursing ambient | M | P3 | P | Nursing voice/ambient to flowsheets · *Conflict: K §4.3 P3 vs §14.2 arithmetic P2* |
| `AI-RCM-01` | Claim scrubbing | M | P2 | B | Pre-submission scrubbing; denial prediction · *K §4.3 marks claim scrubbing (P)* |
| `AI-PAT-01` | Result explanations | S | P2 | B | Templated result explanations only (K §11.2): AI may suggest a template, never generate patient text; never used for SI-21-labelled results or pregnancy tests; released only through the §9.30 release rule (control-plane requirement G10, SI-07) · *Not in K §4.3; K §14.2 keeps P2* |
| `AI-INB-01` | In-basket AI | M | P3 | B | In-basket triage; grounded draft replies · *Not in K §4.3; K §14.2 keeps P3* |
| `AI-IMG-01` | Imaging AI | M | P3 | I | AIW-I/AIR orchestration; governance ledger (reg Y) |
| `AI-DAT-01` | Reporting replica | M | R1 | B | Reporting replica ≤60 s; report builder · *On the on-site cell; inferred R1 (MIS basics)* |
| `AI-DAT-02a` | CDC bronze (BP split) | M | R1 | B | CDC bronze landing in object storage · *Central site; migration staging; inferred R1* |
| `AI-DAT-02b` | Silver/OMOP (BP split) | M | P2 | B | Silver layer; OMOP; SQL-on-FHIR views |

### A.15 DFD: Front door

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `DFD-MSG-01` | SMS/WhatsApp | M | R1 | B+I | Reminders/outreach without an account · *DLT dropped; OTP + knowledge-check release; Viber via KRI-MSG-01* |
| `DFD-BOK-01` | Booking link | M | R1.1 | B | Web booking link; rules-based self-scheduling · *BP R2.1; K §4.2 silent · Placed R1.1: Ships with wallet payment links* |
| `DFD-PAY-01` | Payment links | M | R1.1 | B+I | Payment links; bill pay (UPI/mada/cards) · *Re-scoped: wallet links (FIB, FastPay, ZainCash, Qi Card)* |
| `DFD-REC-01` | Report download | M (−3) | R1 | B | Report download + national PHR push · *Download by OTP/expiring link stays; PHR part dropped* |
| `DFD-REC-01 · part: PHR push` | PHR push | ≈3 ew | DROPPED-K | B | National PHR push (ABHA app; Sehhaty) · *No national PHR* |
| `DFD-APP-01` | Portal/app | XL | P2 | B | Records; messaging; proxy; refills |
| `DFD-TEL-01` | Teleconsultation | M | P2 | B+I | Video with booking and billing |
| `DFD-CRM-01` | CRM | M | P2 | B | CRM/contact centre; leads; international patient desk · *Not in K §4.3; K §14.2 keeps P2* |
| `DFD-RPM-01` | RPM | L | P3 | B+P | RPM / hospital-at-home |

### A.16 IMP: Implementation tooling and telemetry

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `IMP-FND-01` | Foundation content | XL | R1 | B | Order sets, flowsheets, templates, CDS, roles, reports, charge masters · *Re-scoped: Kurdistan foundation build (regional brands, trilingual forms)* |
| `IMP-MIG-01` | Migration Workbench | XL (BP L→XL) | R1 | B | 12-part Migration Workbench; legacy archive viewer · *Paper and local-billing packs; master-data build* |
| `IMP-RDY-01` | Readiness tooling | L (BP M→L) | R1 | B | Readiness scorecard; cutover/rehearsal; rollback; model-ward/UAT kits · *RG3 adds WAN-, power-cut, dual-currency drills* |
| `IMP-TRN-01` | Training tooling | M | R1 | B | Training sandbox; micro-learning; proficiency tracking |
| `IMP-TEL-01` | Clinician telemetry | M | R1 | B | Clinician-time + usability telemetry; micro-surveys · *K §4.3 drops 'telemetry' from BP's tooling list · Placed R1: Usability telemetry from the first go-live (T-120 baselines)* |
| `IMP-SUP-01` | Service desk + status page | S | R1 | B+I | Service-desk integration; ticket telemetry; status page · *Inferred R1 (24×7 support M21); status page (K §13.7)* |
| `IMP-GOV-01` | Governance intake | S | R2.1 | B | Requests; scoring; 30-day loop closure · *BP P2→MVP; manual path until R2.1* |
| `IMP-MAT-01` | Maturity + evidence packs | M | P2 | B | EMRAM readiness report; accreditation evidence packs |
| `IMP-CRT-01` | Partner academy | M | P2 | B | Analyst/partner certification academy · *Academy live by M36 (K §13.7)* |

### A.17 KRI: Kurdistan features (K §4.1)

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `KRI-LOC-01` | Trilingual UI/outputs | M | R1 | B† | Sorani, Arabic, English UI; trilingual outputs · *Trilingual receipts and reports at R1* |
| `KRI-LOC-02` | Badini templates | S | R1 | B† | Badini patient templates · *Release unstated; Duhok review; Latin-script need via S7-K · Placed R1: Framework in R1; Badini content before the first Duhok go-live* |
| `KRI-ID-01` | Iraqi identity + cross-script EMPI | L (+12 net) | R1 | B† | Iraqi name parts; Kurdish/Arabic/Latin transliteration; cross-script matching (K §8) · *+12 net over ACC-ID-02* |
| `KRI-RCM-01` | Dual-currency cashiering | M | R1 | B† | IQD/USD; per-currency drawers; change in either currency; rounding |
| `KRI-RCM-02` | Doctor-fee ledger | M | R1 | B† | Practitioner fee lines; package shares; payout ledger; statements · *No referral-commission feature* |
| `KRI-PAY-01` | Card/wallet adapters | M | R1 | B† | Card-terminal and wallet adapters; K §12.1 pairs them with three-way reconciliation · *Wallet links R1.1; no card PAN in HMS* |
| `KRI-STAT-02` | DHIS2 export | S | R1.1 | B† | DHIS2 data-value sets via Web API · *Only if the KRG uses DHIS2* |
| `KRI-MSG-01` | Viber + SMS gateways | S | R1 | B† | Viber; local SMS gateways · *Per-site GSM/SMPP gateway in K §9.1 (R1)* |

### A.18 Totals after the placements above

| Phase | Feature IDs | Engineer-weeks |
|---|---|---|
| R1 | 110 | 1606 |
| R1.1 | 3 | 19 |
| R2a | 9 | 86 |
| R2b | 25 | 266 |
| R2.1 | 6 | 55 |
| P2 | 48 | 558 |
| P3 | 19 | 266 |
| DROPPED-K | 14 | 326 |
| **MVP (R1 to R2.1)** | **153** | **2032** |
| **All** | **234** | 3182 |

These per-feature sums differ slightly from K's release-level figures (≈2,060 MVP engineer-weeks; ≈1,370 squad PM including the control sets) because K costs the AI gateway and control plane at 20 engineer-weeks where R14 sizes them at 40, and because of the placements noted above. K's release-level plan of record governs capacity; this table governs scope.
### A.19 Controls and items without feature IDs

| Item | Phase | Where specified |
|---|---|---|
| Core transcription control set (control set B) | R2a | §10.3 |
| Stewardship control set (control set C) | R2a (Core sites at transcription; Clinical Safety sites at order entry) | §10.3 |
| Patient-supplied medicine workflow | R2a | §9.10; SI-12 |
| Extended Dose Engine fallback control set (control set A), including the KB ≥10× hard stop and the pharmacist-cover alarm | R2b (and at transcription in R2a) | §10.3; SI-05 |
| Chaperone documentation; guardian or co-signer consent | R2b | §14.7 |
| Iraq federal pack (federal returns, insurance scheme adapter, practitioner fields, Arabic-first review) | P2 | §11.10 |
| IHE ACM consumer; referrer portal without commission features; Ramadan mode; same-gender clinician preference; cross-referenced group identities; regional-cloud ciphertext backups | P2 | §12.8, §9.30, §11.7, ADR-006, Q-K2 |
| First AI SKUs: dictation structuring, insurer document-pack assembly, template-suggested patient instructions, no-show outreach; grounding service; HITL UX kit | P2 | §17 |
| Federated benchmarking; app marketplace; partner-only triage AI | P3 | §17.1 |

### A.20 Source conflicts and how this prompt resolves them

| Conflict | Resolution used here (record each in `OPEN-QUESTIONS.md` for confirmation) |
|---|---|
| AI gateway and control plane: 20 engineer-weeks in K §4.1 vs 40 in R14 | Scope follows R14 (both features); capacity planning follows K |
| `INT-IPS-01`: "from day one" (K §4.3, §9) vs not moved in K §4.1 | R1 |
| `AI-NUR-01`, `CLN-CDS-07`: P2 in places, P3 in K §11.2 | P3 |
| `OPS-PRD-01` predictive discharge P3 vs AI-0 forecasts P2 | Operational forecasts P2; predictive discharge P3 |
| `OPS-RTL-01`: P3 in counts vs RTLS ingestion P2 in K §4.3 | P2 ingestion; never an engine |
| `DX-BB-02` blood-bank interface kept vs "no interface assumed" | Optional inbound adapter in R2b; manual receipt is the default |
| `ACC-ID-02` vs `KRI-ID-01` | One identity epic; build both IDs together in WP-1.2 |
| `DFD-MSG-01`: K drops BP's +4 as DLT governance, but the +4 also covered OTP/expiring-link release | Keep the release rule in R1 |
| `DX-LAB-04` back to M vs the lab-quality pack kept in K §4.3 | Build the lab-quality pack in R1 under `DX-LAB-04`/`DX-LAB-05`; watch capacity |
| `DEV-GW-01`: dependency of the ICU flowsheet (R14) vs monitor feed in R2.1 (K) | R2.1; the R2b ICU flowsheet uses nurse-entered vitals |
| `TRU-AUD-02`: privacy analytics MUST at GA vs P2 | Rules-based privacy reports by R2b; full analytics and the patient-visible log in P2 |
| `ERP-IMP-01` at P2 vs consignment in MVP procurement-lite (K §12.2) | Consignment bill-only PO in R2.1; UDI recall trace in P2 |
| `IMP-CRT-01` academy tooling P2 vs academy live by M36 | Tooling in P2; the academy itself is a business activity |
| `CLN-DOC-02` bloat indicator in BP R2.1, absent from K | Provenance in R1; bloat indicators by R2b |
| LIS rules: one shared rules engine (R04) vs Tier 2 isolation (K) | Releasing or interpreting results = Tier 2 `reg-lis-rules`; reflex, add-on and routing rules = non-device decision tables |
| Relabel scope: units "without a usable barcode" (K-08) vs every unit (SI-11) | Relabel every unit at receipt (the safer, uniform reading; Q-K14 default) |
| Event names: `ChargeCreated`/`PatientTransferred` (R11) vs `ChargeGenerated`/`EncounterMoved` (BP) | R11 names canonical; BP names are aliases |
| Undrawn transitions (medication administration, specimen rejection, bed blocked/closed) | Proposed in §8.4 and put to the approving panels |
| "Paediatric weight-based rounding" in K §4.3's MVP nursing scope (carried over from BP, where the Dose Engine was MVP) vs SI-05 with the Dose Engine in P2 | No dose arithmetic or rounding outside `reg-dose`; until P2 the pharmacist decides under control set A (SAC-13) |
| `AI-PAT-01` "templated then AI" (R14, BP) vs template-only patient text (K §11.2, §11.3) | Templates only; AI may suggest a template and never writes patient text |

---

## Appendix B. Templates

### B.1 ADR

```markdown
# ADR-0nn: <title>
Status: proposed | accepted | accepted-provisional | superseded by ADR-0mm
Date: <yyyy-mm-dd>   Source: <K §, BP §, R §>
## Context
## Decision
## Consequences (including safety and licence impact)
## Fitness test that guards it
## Reopen if
```

### B.2 Hazard-log entry (`docs/safety/hazard-log.yaml`)

```yaml
- id: HAZ-0042
  title: Offline administration against an order discontinued during an outage
  seeded_hazard: H2
  invariants: [SI-02, SI-15]
  features: [MED-BCM-01]
  causes:
    - Mobile device offline while the order is discontinued on the cell
  effects: Dose given after discontinuation
  initial_risk: {severity: major, likelihood: occasional, level: high}
  controls:
    - id: CTRL-0042-1
      type: design
      description: Offline administration allowed only against orders verified before the outage; on reconnect the server revalidates; an administration against an order discontinued meanwhile is recorded as a fact and flagged to prescriber and pharmacist as an owned task
      state: planned          # planned | implemented | verified; "verified" only with passing tests listed below
      implemented_in: []      # e.g. backend/modules/medications/...
      verified_by: []         # e.g. PropertyTest:OfflineBcmaRevalidation, Scenario:SCN-MED-017
  residual_risk:
    proposed: null            # the agent may propose {severity, likelihood, level}
    accepted_by: null         # [HUMAN] CSO only, from a sign-off record
  status: open                # open -> controls-implemented -> controls-verified (agent, with evidence); accepted is [HUMAN]
  owner: medications-squad
  cso_triage: {by: null, date: null}   # [HUMAN]
```

### B.3 State-machine specification (`docs/specs/state-machines/<name>.yaml`)

```yaml
machine: medication-administration
version: 1
owner: medications
approval: {status: requested, required: [pharmacist-panel, nurse-panel, cso], approved_by: [], record: null}
  # approved_by and record are written only from a human sign-off record (§3.5)
states: [scheduled, in-progress, completed, not-done, stopped, entered-in-error]
terminal: [completed, not-done, stopped, entered-in-error]
predicates:   # each implemented once in the medications domain package and unit-tested
  activeVerifiedOrder: "the order is active and pharmacist-verified"
  wristbandScanMatches: "the wristband scan matches two identifiers"
  twoIdentifiersConfirmed: "wristbandScanMatches, or a recorded manual two-identifier check with a reason"
  productScanMatches: "the product scan matches the verified order"
  highAlertCheckSatisfied: "not high-alert, or an independent double check is recorded"
  overrideReasonEntered: "an override reason was chosen by the user (never defaulted)"
  offlineAllowed: "online, or the order was verified before the outage"
  patientSuppliedCleared: "not patient-supplied, or received, identified and relabelled by pharmacy"
  notDoneReasonValid: "reason in [held, refused, missed, npo, off-unit]"
  privilegedAndAudited: "the user holds the privilege and the action is audited"
transitions:
  - {from: scheduled, on: Give, guard: [activeVerifiedOrder, wristbandScanMatches, productScanMatches, highAlertCheckSatisfied, offlineAllowed, patientSuppliedCleared], to: completed}
  - {from: scheduled, on: StartInfusion, guard: [activeVerifiedOrder, wristbandScanMatches, productScanMatches, highAlertCheckSatisfied, offlineAllowed, patientSuppliedCleared], to: in-progress}
  # An override replaces only the failed product scan or the missing verification (SI-02).
  # It never waives SI-01, SI-12, SI-13 or SI-15.
  - {from: scheduled, on: GiveWithOverride, guard: [overrideReasonEntered, twoIdentifiersConfirmed, highAlertCheckSatisfied, offlineAllowed, patientSuppliedCleared], to: completed}
  - {from: [scheduled, in-progress], on: NotDone, guard: [notDoneReasonValid], to: not-done}
  - {from: in-progress, on: Complete, to: completed}
  - {from: in-progress, on: Stop, to: stopped}
  - {from: "*", on: MarkEnteredInError, guard: [privilegedAndAudited], to: entered-in-error}
proposed: ["scheduled→completed", "scheduled→not-done"]   # not drawn in R11 §10.3; awaiting panel approval
invariants: [SI-01, SI-02, SI-12, SI-13, SI-15]
events: [MedicationAdministered, MedicationNotGiven, MedicationAdministrationOverridden]
```

(The full set of machines and their guards is in §8.4 and R11 §10.)

### B.4 Work package

```markdown
# WP-<n.m>: <title>
Phase / release: <Phase n / R1 …>   Features: <IDs>
Read first: <this prompt §…; research §…>
Depends on: <WP IDs from the §21 table>   Simulators needed: <§3.7>
Entry criteria:
Deliverables:
Exit criteria (evidence required):
Hazards touched:
[HUMAN] gates:
```

### B.5 STATUS.md

```markdown
# STATUS (updated <date and time>)
Phase: <n>   Work package: <WP-…>
Branch: <wp/…> @ <sha>
Last green: <tier> @ <sha> (<evidence path>)
In-flight slice: <id>: spec | tests | impl | verified
Open review findings: <reviews/<file> #ids>
Blocking decisions: <DN-ids>
## Last session
- Built: …
- Verified: <command> → <result>
## Next exact step
## Blocked / waiting on humans
## Read next: <BUILD-PROMPT §…>, <research §…>
```

---

## Appendix C. Reading map

Read the research only for the topic in hand, using these sections. Acronyms are in `research/GLOSSARY.md`.

| Topic | Read |
|---|---|
| Kurdistan decisions, context and assumptions | K §1–§2; K Appendix B ([L] register); K §19 (open questions) |
| Scope and releases | K §4; R14 §3, §5, Appendix A |
| Safety invariants, hazards, Tier 2 | K §5; BP §5; R15 §2–§6 |
| Architecture and stack | K §7; BP §7; R08 §3.11, §4–§7, §12–§14 |
| Data model and state machines | R11 (all); BP §8; K §8 |
| Identity, EMPI, names | R03 §3.1; R11 §3; K §8; R15 §9.3 |
| Clinical modules | R03 §3–§17 |
| Diagnostics, pharmacy, transfusion, devices | R04 §1–§9 |
| Revenue cycle, ERP, operations | R05 §1–§9; K §12 |
| Interoperability and terminology | R06 §3, §5, §7–§8; K §9 |
| Security, privacy, medico-legal | R07 §5, §6, §8, §9; K §10 |
| AI, data platform, front door, mobile | R09 §5–§9; K §11 |
| UX, implementation lessons, training | R10 §2–§5, §10; K §6, §13 |
| Hardware and peripherals | R16 §2, §6–§12, §14, §17 |
| Verification, migration, go-live | R15 §7–§10; K §13.3–§13.5 |
| Where sources disagree | `research/RECONCILIATION-LOG.md`; Appendix A.20 of this prompt |
