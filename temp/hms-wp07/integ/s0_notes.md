S0's three spec items are written and pass the repo, safety and backlog checks. Nothing in this slice needs a decision from you before S1 starts.

Things I did beyond the listed files, or chose myself:
- **Extra file.** I added `docs/specs/state-machines/patient-context.md`, because the state-machines README requires a `.md` beside every machine.
- **Extra key in the state machine.** It has a `parameters:` key (`reverificationWindowMs: 60000`) that the B.3 template does not have. WP-0.5's generator should accept it or move it into a predicate.
- **No schema to validate against.** The safety check has no schema for state-machine files; it only scans approval fields. So "validates" means: the approval gate passed with 0 filled fields, and my own script confirmed that every state, guard and drawn pair matches the `proposed` list.
- **Secret scan.** The first badge-credential fixture tripped gitleaks. I changed the value to `SYN-BADGE-0000000000000001`; the allowlist is untouched. If S9 adds credential fixtures, keep them low-entropy.
- **Stricter readings I chose, all recorded as OQ entries for the CSO:**
  - re-verification at exactly 60 s (OQ-new-1);
  - what re-verification means (OQ-new-11);
  - what counts as a context change, and that a change of user clears the context (OQ-new-12);
  - what "trilingual name" means (OQ-new-13);
  - trailing zeros removed from every clinical number, results included (OQ-new-16);
  - the banner's blocking rules (OQ-new-18).

  Each of these tightens a rule or makes it more specific; none weakens one. The `ckb` and `ar` deviation and the licence change are the human's 18 October answers, quoted in DN-new-2 and DN-new-3.

Conflicts and follow-ups:
- **Scorecard rows.** The plan puts ADR-002 and dependency-scorecard rows in S1, but the scorecard file exists only on `wp/0.2-environments`. DN-new-1 keeps those rows in the WP-0.7 evidence until the branches meet.
- **`apps/shell/README.md` is out of date.** It still calls Rust a [HUMAN] item although DN-004 is closed. S9 or S11 should fix it.
- **FHIRcast.** It is in PLT-UX-02's backlog scope but not in WP-0.7. It needs a placement; the backlog note flags it.
- **Hazard-log additions for S12.** §9 of the spec lists tests that no control names yet, for example:
  - `UnitTest:context-switch-requires-confirmation` → CTRL-0016-6
  - `UnitTest:banner-identifiers-never-room-or-bed` → CTRL-0001-4
  - `E2E:digits-western` → CTRL-0005-17
  - `StaticAnalysis:clinical-number-no-arithmetic` → CTRL-0005-6

  You decide at S12 whether to add them to those controls' `planned_verification`.
- **CHANGELOG** (not in your list), if you want one line: "WP-0.7 S0: design-system module specification, patient-context state machine (approval requested), HAL contract v1 with 67 synthetic fixtures."

**Placeholders.** The spec files contain DN-new-*, OQ-new-* and KA-new-* placeholders, which must be replaced when you assign numbers.