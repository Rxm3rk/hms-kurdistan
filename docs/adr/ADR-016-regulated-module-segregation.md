# ADR-016: Regulated-module segregation
Status: accepted
Date: 2026-10-18   Source: K §5.4, §5.5, §5.6, §7.2 (kept), K-04, K-05, K-06, Appendix A.2 (KDV-3, KDV-5); BP §5.4, §5.5, §7.2; R15 §2.3, §5.1; R08 §1 #14, §14 #10; BUILD-PROMPT §2.1 (SI-05, SI-18), §5.2, §6.8 items 1 and 13, §10.2, §10.3, §10.4, §10.5, §20, §21 (WP-0.3, WP-1.5, WP-3.5, WP-3.10), §4.2

## Context

**The question.** How device-grade (Tier 2) functions are kept apart from the clinical core, so the core stays out of device scope and every Tier 2 function can be switched on only where it is allowed.

**The architecture is part of the safety case** (BP §5.5). The IEC 62304 decomposition separates the Tier 1 Safety Kernel (orders, medications, MAR, results, tasks) from Tier 2 modules. Each Tier 2 module is a separately versioned, process-isolated sidecar on the same node, with a pure-function, schema-versioned API and a deterministic fail-safe. A documented segregation and class-propagation analysis shows the kernel stays Class B. The device boundary includes display of regulated outputs and creation of escalation tasks, so regulated display ships as Tier 2-owned UI components with render-integrity checks, and escalation tasks go through a narrow, versioned task API. R08 says to isolate potential-SaMD logic into separately versioned, validated modules from the first commit (R08 §1 #14, §14 #10).

**Sources.** K keeps BP's ADR-016 (K §7.2; K §5.5; K-06 "Kept"). The reason holds in Kurdistan even without a regulator: it keeps the orders/MAR kernel out of device scope for any later export market, and it is the cleanest safety architecture (K §5.5). K-05 sets the evidence a Tier 2 activation needs. KDV-5 moves the Dose Engine to P2, with the extended fallback control set at go-live. Not marked [P].

**Difference between sources, recorded.** BP §7.2 gives ADR-016 the reopen trigger "NB pre-submission rejects the segregation argument". BUILD-PROMPT §4.2 sets none ("—"). K plans no notified-body submission before an export market chooses one (K-04; KDV-3: ISO 13485 certification deferred to a G5 export decision), so the BP trigger has nothing to fire on in Kurdistan. This ADR follows §4.2 and records the difference for `docs/program/OPEN-QUESTIONS.md` (BUILD-PROMPT §1).

## Decision

**Regulated-module segregation:** Tier 2 functions run as separately versioned, process-isolated sidecars on the same node; the Boundary Register is the only activation switch; one Dose Engine.

**Detail** (BUILD-PROMPT §5.2, §10.2–§10.5, §2.1):
- **Sidecars** (`backend/regulated/`): `reg-ews` (NEWS2, PEWS, MEOWS), `reg-transfusion` (bedside transfusion verification, T2), `reg-screening` (presentation and local tiering of drug-KB screening results), `reg-lis-rules` (LIS autoverification and interpretive rules), `reg-dose` (the Dose Engine, P2). Each has a pure-function, schema-versioned API, its own SBOM, SOUP list and release train, and a deterministic fail-safe: on timeout or error it returns "unavailable, manual check required", never "pass". A local call costs milliseconds, well inside the 500 ms CDS and BCMA budgets.
- **Display:** regulated values are rendered only by Tier 2-owned UI components (`frontend/packages/regulated-ui`) with render-integrity checks (a hash of the module output compared with what is drawn). CPOE and MAR screens host these components but never compute or reformat regulated values.
- **Escalation tasks** are created through a narrow, versioned task API whose contract is part of Tier 2 verification.
- **Activation:** a Tier 2 function activates for a tenant only where the Regulatory Boundary Register says "cleared" or "not required", backed by a stored written local opinion; configuration toggles cannot override it (SI-18). Activation is a C2 change. Expiry or withdrawal reverts the site to the fallback control set (BUILD-PROMPT §10.2, §10.3).
- **One Dose Engine.** Dose arithmetic exists only in `reg-dose`, exactly as defined in BUILD-PROMPT §2.1. Until `reg-dose` is active at a site, no production code does it; the only allowed operations outside it are (a)–(e) of §2.1, and they go through one audited comparison API (§6.8 item 1). Until then the extended fallback control set A applies (BUILD-PROMPT §10.3).
- **Rigour:** Class C rigour for every Tier 2 module regardless of its assessed class; 100% boundary-value coverage and a mutation score threshold (BUILD-PROMPT §6.8 item 13, §10.5). The segregation and class-propagation analysis is a documentation deliverable (BUILD-PROMPT §20).

## Consequences (including safety and licence impact)

**Safety.**
- The Safety Kernel stays Class B because regulated logic and display sit outside it (BUILD-PROMPT §10.5), and every Tier 2 failure degrades to a manual check, never to a silent pass (H2, H4).
- SI-05 is enforced structurally: dose arithmetic outside `reg-dose` fails the build. SI-18 is enforced by the Register: no flag can switch on a Tier 2 function.
- Every Tier 2 function has a pre-built fallback at first go-live (K-05), so segregation never leaves a protection simply switched off.

**Process.** Tier 2 modules ride their own release train (C2, quarterly). Shared UI and the task engine stay on weekly delivery because regulated display and task creation are behind versioned contracts (BP §5.5).

**Licence.** Each sidecar ships its own SBOM and SOUP list (ADR-022). No rules engine runs inside the device boundary (ADR-017), which keeps rule-engine dependencies out of the SOUP list of Tier 2 modules.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Static analysis (no dose arithmetic elsewhere); sidecar contract tests.

**Where and when.**
- **Static analysis:** a custom detekt rule (in the convention plugins under `backend/build-logic/`) plus ArchUnit rules on `Dose`/`Quantity` operations (in `backend/platform/arch-rules`), encoding exactly the §2.1 definition (BUILD-PROMPT §6.8 item 1). BUILD-PROMPT §21 does not assign this rule to a work package. It can act only once the platform `Quantity` type exists (WP-0.3), and it runs in the fast tier once written. The detekt part runs on detekt 1.23.8's embedded Kotlin 2.0.21 front end (ADR-002), which is why the ArchUnit part matters.
- **Sidecar contract tests:** with each sidecar: `reg-screening` in WP-1.5, `reg-lis-rules` in Phase 1.1, `reg-ews` in WP-3.5, `reg-transfusion` in WP-3.10, `reg-dose` in Phase 5. Mutation tests on touched Tier 2 code run in the merge tier (BUILD-PROMPT §19.1).

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

No reopen trigger is set (BUILD-PROMPT §4.2 shows "—"). Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4). (BP §7.2's trigger, "NB pre-submission rejects the segregation argument", is not carried into BUILD-PROMPT; see Context.)
