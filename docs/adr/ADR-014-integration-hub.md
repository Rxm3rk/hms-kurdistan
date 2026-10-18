# ADR-014: The native Integration Hub owns every interface
Status: accepted
Date: 2026-10-18   Source: K §7.2 (kept), §7.3, §9; BP §7.2, §7.7, §9; R06 §1 #2, §7.2; R08 §4.3, §12.5, §13 #7, §14 #4; R02 §9; RL #12; BUILD-PROMPT §3.7, §4.1 (Health standards), §4.3, §5.2 (hub), §12 (intro, §12.1), §21 (WP-1.1b, WP-1.12), §4.2

## Context

**The question.** Who owns the HL7 v2, FHIR, DICOM and Kurdistan-format interfaces: our own engine, or a third-party interface engine.

**The research.** R02 proposed reusing Eclipse OIE as the interface engine; R06 proposed a first-party gateway with no hard third-party dependency; R08 took a hybrid (RL #12). The reconciliation adopted the hybrid: the native Integration Hub owns MLLP/v2, FHIR, DICOM and national adapters with acknowledgement state and replay; OIE or the customer's own engine is optional for site-specific transforms only, under a patch-lag policy (CVE monitoring, plus a patched build or compensating controls if upstream misses the SLA). On 16 Oct 2026 OIE's latest release was still v4.6.0 (9 Jul 2026), with its September 2026 CVE fixes unreleased (RL #12; R08 §12.5). Mirth Connect went closed-source from v4.6. R06: "An HMS without a strong v2/MLLP engine cannot be sold anywhere" (R06 §1 #2). The VA "unknown queue" sent more than 11,000 orders to an unknown queue (BUILD-PROMPT §12.1; R08 §13 #7).

**Sources.** K keeps BP's ADR-014 text (K §7.2); with no national exchange in Kurdistan [L], K §9 follows R06's no-regret path (IPS `$summary` from day one, a thin Kurdistan pack). Not marked [P].

## Decision

**Native Integration Hub** owns every interface.

**Detail** (BUILD-PROMPT §5.2, §12, §12.1; K §9):
- `hub` is the anti-corruption layer to every external format. No other module emits HL7 v2, FHIR, DICOM or Kurdistan formats directly. It runs inside each cell, with central adapters at the central site.
- Outbound messages are generated only from domain events (ADR-004, ADR-009).
- **Channel operations, every channel, no exceptions:** an owner, visible acknowledgement state, an owned dead-letter queue that alarms at 5 minutes, and a replay console. Zero silent drops. Store-and-forward with ordered replay and idempotency keys; per-patient ordering (A08 never overtakes A01); MSH-10 idempotency; message-level audit retention. War-room dashboards for go-lives.
- **Optional customer engines** (Eclipse OIE or the hospital's own) are allowed for site transforms only, under a patch-lag policy. No hard dependency on Mirth Connect or any cloud-only FHIR service.
- **Libraries:** HAPI FHIR structures and validator; HAPI HL7 v2, used unmodified under its MPL-1.1 option (BUILD-PROMPT §4.1).
- **Scope** (K §9): HL7 v2 2.3–2.8 with per-interface conformance profiles; the FHIR R4 façade (ADR-005); DICOM MWL/MPPS, DICOMweb and IID; analysers through middleware (ASTM/CLSI LIS01-02 for legacy, IHE LAW as the target); POCT through a data manager.
- **Simulators:** every external party gets a local simulator under `tools/simulators/<party>` with contract fixtures before the work package that needs it (BUILD-PROMPT §3.7).

## Consequences (including safety and licence impact)

**Safety.**
- Owned, alarmed dead-letter queues and acknowledgement state make "nothing fails silently" (constitution rule 6) true at the interfaces, addressing H5 and H15 and supporting SI-03.
- Per-patient ordering and idempotency stop out-of-order or duplicated clinical messages (H6).
- One emitter of external formats means one place to enforce message-body rules (no clinical content in message bodies, SI-20) and egress control (H13).

**Engineering.** The Hub is a day-one product, not plumbing (R08 §14 #4): breadth of adapters is our own work, per pack.

**Licence.** HAPI HL7 v2 is dual-licensed MPL-1.1 or GPL-2.0 and is used unmodified under MPL-1.1, recorded in the licence register (BUILD-PROMPT §4.3; ADR-022). Mirth Connect ≥4.6 is excluded by name. OIE (MPL-2.0) is optional and never a hard dependency.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Channel tests; zero-silent-drop chaos test.

**Where and when.**
- The Hub lives in `backend/hub/` (BUILD-PROMPT §6.1).
- WP-1.1b: an ADT message round-trips over MLLP/TLS to a simulator with acknowledgement tracking; a dead-lettered message raises an owned task and an alarm; ordered replay works after a simulated outage; outbound messages come only from domain events.
- WP-1.12: conformance profiles for the R1 message set; dead-letter alarm and ordered replay in chaos tests.
- Chaos runs are in the nightly tier; HL7 v2 conformance profiles run in the merge tier's contract tests (BUILD-PROMPT §19.1).

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

No reopen trigger is set (BUILD-PROMPT §4.2 shows "—"). Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
