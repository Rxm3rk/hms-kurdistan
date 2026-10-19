"""One-off edits to part-09b.md (§22, §23, Appendix B) from the executability review."""
import sys
from pathlib import Path

p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')


def rep(old, new):
    global s
    n = s.count(old)
    assert n == 1, (n, old[:70])
    s = s.replace(old, new)


rep("runs on the three-node cell profile;", "runs on the dev cell (the three-node profile);")
rep("10. **Reviewed:** the reviewer session found no unresolved blocking findings.",
    "10. **Reviewed:** the automated review found no unresolved critical or major findings. Tier 1 and Tier 2 changes also show a human code review, or are listed as \"awaiting human code review\" (§3.5).")
rep("the Release Evidence Pack and known-anomalies list generated; Safety Board approval [HUMAN].",
    "the Release Evidence Pack and known-anomalies list generated; no synthetic content in the promoted bundles (§19.4); human code review recorded for every Tier 1 and Tier 2 change [HUMAN]; Safety Board approval [HUMAN].")
rep("Keep them in `DECISIONS-NEEDED.md` until a human closes them.",
    "Keep them in `OPEN-QUESTIONS.md` until a human closes them; one moves to `DECISIONS-NEEDED.md` only when it blocks a work package.")
rep("Any code that depends on one names it in a comment and reads its value from the Kurdistan pack.",
    "Track them in `ASSUMPTIONS.md` (§3.1). Any code that depends on one names it in a comment and reads its value from the Kurdistan pack.")

# B.2 hazard entry: initial state, nothing pre-approved
start = s.index("```yaml\n- id: HAZ-0042")
end = s.index("```\n", start + 10) + 4
s = s[:start] + """```yaml
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
""" + s[end:]

# B.3 state machine: approval requested, named-predicate guards
start = s.index("```yaml\nmachine: medication-administration")
end = s.index("```\n", start + 10) + 4
s = s[:start] + """```yaml
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
""" + s[end:]

rep("Entry criteria:\nDeliverables:",
    "Depends on: <WP IDs from the §21 table>   Simulators needed: <§3.7>\nEntry criteria:\nDeliverables:")

start = s.index("```markdown\n# STATUS (updated <date>)")
end = s.index("```\n", start + 10) + 4
s = s[:start] + """```markdown
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
""" + s[end:]

p.write_text(s, encoding='utf-8')
print('ok')
