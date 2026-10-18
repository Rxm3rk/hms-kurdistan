# WP-0.9: Safety registry and release evidence
Phase / release: Phase 0 Foundation / no clinical go-live (features first run in R1)   Features: `TRU-REG-01`, `TRU-REG-02`, `TRU-SEC-01`
Read first: BUILD-PROMPT §2.1 (SI-18); §3.5; §4.3 (SOUP list, signing in development and CI); §10.1; §10.2; §10.5; §13.1 (SD-1 to SD-3); §18.1; §19.1 (release tier); §19.3; §19.4; §20; §22.3; Appendix B.2. Research: R15 §2–§8; K §5; BP §5 (the §10 "Read:" line)
Depends on: all other Phase 0 WPs (WP-0.1 to WP-0.8)   Simulators needed: none
Entry criteria:
- WP-0.1 to WP-0.8 merged, or reviewed and stacked (§3.6, §21).
- Not met yet: waits on WP-0.2 and everything after it.
Deliverables:
- The hazard-log service (`TRU-REG-02`): API and minimal UI over the hazard data (hazard record per §10.1: causes, effects, risk, typed controls with implementation references and verifying test IDs, residual risk, status, owner, links). The CI promotion gate blocks a release while any control for a feature in it is not `verified` with passing test IDs in `verified_by`; a state is never changed to make a gate pass (§10.1). §10.1 grows this into a service with full UI in Phase 1 (OQ-087).
- The Regulatory Boundary Register (`TRU-REG-01`; SI-18): API and minimal UI; an entry per function and version with intended purpose, tier, jurisdiction, status (`not-assessed`, `required`, `not-required`, `cleared`, `withdrawn`), fallback control set and evidence; the flag service asks the Register before enabling any Tier 2 function and a configuration toggle cannot override it; seeded with every Tier 2 function and the sweep candidates (§10.2).
- Human fields (CSO triage, risk acceptance, approvals) written only from sign-off records a human adds under `docs/safety/signoffs/` (§3.5, §10.1).
- The SOUP list (`docs/safety/soup.yaml`): every third-party component used by Tier 1 or Tier 2 code, with version, purpose, known anomalies and the verification that covers it (§4.3).
- SBOM (CycloneDX), VEX, cosign signing with local keys and no public transparency log, and SLSA provenance in the release pipeline (`TRU-SEC-01`; §4.3, §19.1).
- The Release Evidence Pack generator: safety case, SBOM/VEX, test results, regulatory-impact assessment, known anomalies, Boundary Register state; it lists every synthetic content item still present and every Tier 1 and Tier 2 change "awaiting human code review" (§10.1, §19.4, §3.5).
- The release tier of `tools/ci/run` (KA-003).
Exit criteria (evidence required):
- A dry-run release produces a complete evidence pack.
- Promotion is blocked when a control for a feature in the release is not `verified`.
- §22.2 work-package Definition of Done and a reviewer report.
Hazards touched:
- SI-18 (the Boundary Register is the only activation switch for Tier 2 functions; §2.1 lists no seeded hazard for it).
- The promotion gate covers every hazard H1–H15 through the controls of the features in a release.
[HUMAN] gates:
- CSO triage, risk acceptance, safety-case sign-off and the Safety Board's release veto (§10.1).
- Human code review of Tier 1 and Tier 2 changes (§3.5).
- Boundary Register evidence for any activation (written local opinions, independent-assessor concurrence, K-05; §10.2).
- Production signing keys and any transparency log need an ADR and a [HUMAN] decision (§4.3).
- Phase 0 exit: ADR freeze confirmed by the human lead (§21).
