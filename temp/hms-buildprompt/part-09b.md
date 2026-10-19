
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
