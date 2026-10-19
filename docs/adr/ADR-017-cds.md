# ADR-017: Clinical decision support: drug-KB adapter, DMN for non-device rules, native Tier 2 calculators
Status: accepted
Date: 2026-10-18   Source: K §5.5, §7.2 (kept), K-04, K-10, Appendix A.2 (KDV-3); BP §5.5, §6.3, §7.2, §7.7, §15.4 (S11); R08 §4.5, §12.5; BUILD-PROMPT §2.1 (SI-14, SI-19), §2.3, §4.3, §5.2 (cds), §9.6, §10.4, §14.3, §21 (WP-1.1, WP-1.5, WP-3.5), §4.2

## Context

**The question.** Which engines run clinical decision support, and which of them may sit inside the device boundary.

**The research** (R08 §4.5, §12.5). CQL is HL7's language for clinical logic, and CDS Hooks lets first- and third-party CDS use the same hook points; services "SHOULD respond quickly (on the order of 500 ms)". Drug knowledge comes from licensed knowledge bases behind an adapter, and that component is the most likely to be regulated as a device. Operational rules use DMN-style decision tables, versioned as configuration.

**BP** (BP §5.5, §7.2). One rule: no rules engine (CQL or DMN) inside the device boundary. Tier 2 calculators are native, guideline-verbatim modules with 100% boundary-value tests. CQL from P2 only for measures, KPIs and non-device CDS. The DMN engine runs on an Apache-2.0 engine, with Apache KIE/Drools DMN the candidate, confirmed in the dependency scorecard. BP's spike S11 (before P2 CQL work) sizes CQL latency and SOUP burden for non-device paths; K's spike list does not carry S11 (K §15.4), so it is context here. BP's reopen trigger is "a notified-body-agreed change to the device boundary".

**Sources.** K keeps BP's ADR-017 text (K §7.2; K §5.5). Quiet-by-default CDS is K-10. Not marked [P].

**Difference between sources, recorded.** BUILD-PROMPT §4.2 words the reopen trigger as "a change to the device boundary agreed through the Safety Board", where BP §7.2 (kept by K) says "a notified-body-agreed change". K plans no notified-body route before an export market chooses one (K-04; KDV-3), so §4.2 names the body that exists in Kurdistan. This ADR follows §4.2; the difference is open in `docs/program/OPEN-QUESTIONS.md` as OQ-118 until a human confirms it (BUILD-PROMPT §1).

## Decision

**CDS:** a drug-KB adapter; DMN decision tables for non-device rules on an Apache-2.0 engine (Apache KIE/Drools DMN is the candidate, confirmed by the dependency scorecard); native deterministic Tier 2 calculators; CQL from P2 for measures, KPIs and non-device third-party CDS only. **No rules engine inside the device boundary.**

**Detail** (BUILD-PROMPT §5.2, §9.6, §10.4, §14.3; §2.1, §2.3):
- **The `cds` module** owns the alert registry, the drug-KB adapter, non-device rule execution, tiers, silent mode, kill switches and PPV tracking.
- **Never build a drug knowledge base:** licence one and build an adapter (BUILD-PROMPT §2.3). Drug-KB screening is presented verbatim by `reg-screening`, and dose ranges are shown verbatim from the licensed KB with no local arithmetic until the Dose Engine (ADR-016).
- **Governance:** hard stops come only from a governed list; every interruptive rule has an owner, evidence, a measured PPV and a review-by date; the vendor-validated baseline (Tier A/B) is interruptive from day 0; new or locally modified rules run silent first; Tier A/B rules are never retired on override rate alone (SI-14). Every CDS rule and clinical-behaviour flag has a kill switch, and safety-relevant changes default to off (SI-19).
- **Timing:** order sign with CDS ≤1.5 s p95, ≤500 ms per CDS service; services fail open with a banner, except hard stops, which fail closed (BUILD-PROMPT §9.6).
- **Tier 2 calculators** are native, guideline-verbatim, deterministic code; every result stores components, total and calculation version (BUILD-PROMPT §10.4). Calculator content is implemented only from source documents a human has placed in `docs/content-sources/` (BUILD-PROMPT §3.5).
- **CDS Hooks and CQL** arrive in P2 (`CLN-CDS-04`; BUILD-PROMPT §9.6).

## Consequences (including safety and licence impact)

**Safety.**
- Keeping rules engines out of the device boundary keeps Tier 2 logic inspectable and fully boundary-tested (H2, H4). A Tier 2 calculator is code that can be reviewed line by line against its guideline.
- The alert-fatigue controls (tiers, silent mode, governed hard stops, PPV) address the override rates of 46–96% the research reports (K-10).
- Content values (thresholds, dose limits, rule content) are clinical content, governed and versioned, with synthetic samples until a CSO approves them (BUILD-PROMPT §3.4 item 3).

**Licence.** The DMN engine must be Apache-2.0 and is scored in the dependency scorecard before adoption (ADR-022). The drug KB is licensed content a human contracts for [HUMAN].

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** ArchUnit; Tier 2 boundary-value tests.

**Where and when.**
- **ArchUnit:** a rule in `backend/platform/arch-rules` (library created in WP-0.1) that no DMN or CQL engine type is reachable from `backend/regulated/`. It can act once a rules engine enters the build, with the non-device rules engine in WP-1.1 (`PLT-CORE-06`) and the CDS foundation in WP-1.5. Fast tier.
- **Tier 2 boundary-value tests:** per calculator, with its sidecar (`reg-screening` WP-1.5; `reg-ews` WP-3.5, from the source documents in `docs/content-sources/` with 100% boundary-value tests). Mutation tests on touched Tier 2 code run in the merge tier (BUILD-PROMPT §19.1).

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

A change to the device boundary agreed through the Safety Board.

(BP §7.2's wording, for reference: "A notified-body-agreed change to the device boundary"; see Context.)

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
