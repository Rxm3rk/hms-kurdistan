# ADR-025: The single-hospital edge cell is the default; the multi-site edge cell is P3
Status: accepted
Date: 2026-10-18   Source: K §2 (Power, Internet), §7.2, §7.7, §7.8, K-16, Appendix A.2 (KDV-1, KDV-2); BP §7.2, §7.9; R08 §6.2, §6.4, §13 #8; BUILD-PROMPT §2.1 (SI-15), §3.5, §5.1, §10.1, §21 (Phase 6), A.1 (PLT-OPS-03), A.19, §4.2

## Context

**The question.** Whether a hospital's clinical data is written in one place or in several, and when, if ever, several cells may write for one tenant.

**The research** (R08 §6.2, §6.4).
- R08's edge cell is a three-node cluster (or two nodes plus a witness) running the full core for a site. The site is home, the single writer, for its encounters, beds, local scheduling and local stock, and replicates asynchronously to the centre (R08 §6.2).
- A single writer per tenant is the rule. Active-active applies only to stateless tiers and read models, because multi-master clinical writes create conflicts that no algorithm can safely resolve (R08 §6.4). Offline and edge conflicts producing unsafe data are rated a critical risk (R08 §13 #8).

**BP** (BP §7.2, §7.9): ADR-025 "Edge cell is P3, only for a contracted site with measured WAN availability <99.9% or any outage over 1 h in a month (despite dual-carrier WAN), after a dedicated reconciliation hazard analysis", reopened when that trigger is met. BP's edge cell is a three-node local single writer for its encounters, beds and stock (BP §7.9).

**What K changed** (K §7.2; KDV-2, "Changed"; K-16). The edge cell becomes the default: each hospital's on-site cell is the full single-writer tenant. Power and internet are unreliable in Kurdistan [L] (K §2), and BP's own edge-cell trigger would fire at most sites [I] (K-16; KDV-1). The multi-site edge cell (several cells writing for one tenant) stays P3, after a dedicated reconciliation hazard analysis, and K sets the reopen trigger "a group contract needs it". The single writer per hospital keeps SI-15 intact (KDV-2). Not marked [P].

## Decision

**The single-hospital edge cell is the default.** The multi-site edge cell (several cells writing for one tenant) is P3, after a dedicated reconciliation hazard analysis.

**Detail** (K §7.2, §7.7; BUILD-PROMPT §5.1, §21):
- Each hospital's on-site cell is the full single-writer tenant (K §7.2). The topology and what runs in the cell are ADR-007.
- A group is one tenant on its primary cell only where its other hospitals pass the link test of ADR-006. Otherwise each hospital gets its own cell and tenant, with identities cross-referenced (P2) until the multi-site edge cell (P3) (K §7.2; ADR-006). Cross-referenced group identities are a P2 item (BUILD-PROMPT A.19).
- No MVP topology has several cells writing for one tenant: the multi-site edge cell is a P3 topology (BUILD-PROMPT §5.1), built as `PLT-OPS-03` in Phase 6, after a dedicated reconciliation hazard analysis (BUILD-PROMPT §21, Phase 6; A.1).

## Consequences (including safety and licence impact)

**Safety.**
- One writer per hospital means no multi-master reconciliation of clinical state, which removes the conflict classes R08 says no algorithm can safely resolve (R08 §6.4). SI-15's ban on last-writer-wins and CRDT merges on clinical state stays straightforward to keep (H2, H6).
- Until P3, the hospitals of a group that fails the link test are separate tenants with cross-referenced identities from P2, a cross-system seam that its hazard entries must cover (H15; ADR-006).
- The P3 multi-site cell cannot start before its reconciliation hazard analysis. The agent may prepare that analysis; accepting its risks is a [HUMAN] act (BUILD-PROMPT §3.5, §10.1).

**Commercial.** A group that wants one record across hospitals whose links fail the test cannot have it before P3. That demand is this ADR's reopen trigger, and a close relative of ADR-006's.

**Licence.** None specific to this ADR.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** none is named ("—").

**Related checks** that touch this decision but are not its guard: the offline and downtime matrix and its conflict suite (SI-15; ADR-012), the tenancy tests (ADR-006) and the conformance suite on the three-node cell (ADR-007).

**State on 2026-10-18:** no guard is defined for this ADR, and none is claimed.

## Reopen if

A group contract needs it.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
