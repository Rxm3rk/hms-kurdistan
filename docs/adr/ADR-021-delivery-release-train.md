# ADR-021: Delivery: weekly central delivery, a monthly on-site release train and staged rings
Status: accepted
Date: 2026-10-18   Source: K §5.4, §7.2, §7.9 (L1), §7.10, §17, §18 (risk 30), Appendix A.2 (KDV-7), Appendix B (L-10); BP §5.4, §7.2; R08 §6.1, §13 #13; R15 §8.3; BUILD-PROMPT §0 (bar #7), §3.6, §4.3, §6.4, §6.7, §6.8 item 9, §7 item 18, §13.1 (SD-8), §16.1, §16.4, §19.1, §19.3, §19.5, §21 (WP-0.3, WP-1.13), §22.1 item 7, §22.3, A.1 (PLT-OPS-07, PLT-SITE-01), §4.2

## Context

**The question.** How releases reach the central site and the on-site hospital cells: how often, in what order, and how far a cell may fall behind.

**The research.**
- R08 gives on-prem deployments a quarterly upgrade cadence with N-2 versions supported (R08 §6.1). It rates "on-prem customers lag upgrades and drift" as a high-likelihood risk, mitigated by an N-2 support policy, operator-automated upgrades, the same artefacts and contract terms (R08 §13 #13).
- R15 sets continuous delivery under validation by change class: C0 continuous, behind flags; C1 flags default off, with CSO review and scenario suites; C2 a batched regulated release (for example quarterly) with full V&V and a regulatory impact assessment (R15 §8.3).

**BP** (BP §7.2, §5.4): ADR-021 "weekly CD, quarterly feature activation, zero planned downtime, N-2 on-prem", with no reopen trigger; the change classes C0, C1 and C2.

**What K changed** (K §7.2; KDV-7, "Changed"). BP's "on-prem installs N-2" is replaced, because on site is the default product, not an exception, so drift is a fleet-wide safety risk (KDV-7). K sets a monthly on-site release train ("N") with C2 regulated changes quarterly; staged rings in which DP#1 is never first; one deferral per site; migrations that always roll back to N-1; signed offline media for cells that cannot reach us; a maximum drift of N-1 instead of BP's N-2; and ≥90 days without call-home, with no lockout. K adds the reopen trigger "any cell beyond N-1 for >45 days". The same trigger is K's risk 30 (owner COO), and the KPI is "on-site cells on N or N-1 of the monthly release train: 100% (alarm beyond N-1 for >45 days)" (K §18, §17). Certificates and licences keep working for ≥90 days through an internet or WAN loss (K §7.9, layer L1), because outages and government shutdowns are expected [L] (K Appendix B, L-10). K §5.4 keeps BP's change classes. Not marked [P].

## Decision

**Delivery:** weekly continuous delivery to the central site; a **monthly on-site release train ("N")** with C2 regulated changes quarterly; cells pull signed releases over an outbound channel in staged rings (reference cell ≥7 days → a non-flagship site ≥14 days → all sites; DP#1 is never first); a site may defer one train for a go-live, a mass-casualty event or a shutdown; migrations always roll back to N-1; signed offline media with pinned keys and anti-rollback; maximum drift N-1; licences, certificates and updates tolerate ≥90 days without call-home, with no lockout.

**Clause by clause** (K §7.2; BUILD-PROMPT §16.1, §19.5):
- **Central site:** weekly continuous delivery.
- **On-site cells:** a monthly release train, called "N". C2 regulated changes ride it quarterly.
- **Distribution:** cells pull signed releases over an outbound channel. Management is outbound-only (ADR-027).
- **Rings, in order:** the reference cell for ≥7 days; then a non-flagship site for ≥14 days; then all sites. DP#1 is never first.
- **Deferral:** a site may defer one train for a go-live, a mass-casualty event or a shutdown.
- **Migrations:** always roll back to N-1. Database migrations are expand → migrate → contract, and CI runs an upgrade-then-rollback test against the previous release (N-1) on every change (BUILD-PROMPT §3.6, §6.4).
- **Offline media:** signed, with pinned keys and anti-rollback, for cells that cannot reach us.
- **Drift:** at most N-1; a cell runs N or N-1.
- **Without call-home:** licences, certificates and updates tolerate ≥90 days without call-home, with no lockout.

**Related detail** (BUILD-PROMPT §19.3, §16.1, §16.4, §7 item 18):
- **Change classes** (§19.3): C0 (no change to clinical behaviour) by continuous delivery; C1 (clinical-behaviour change behind a flag) ships flag-off by default, with CSO review [HUMAN], scenario suites green and the accreditation-impact field filled; C2 (Tier 2 changes, Tier 2 activations, regulated releases) is batched quarterly, with a regulatory-impact assessment, a Boundary Register update and independent concurrence where K-05 requires it [HUMAN].
- **The fleet agent** on each cell carries the outbound channel, release pulls and licence and certificate status (`platform-site`, §7 item 18). **The fleet console** (central) shows each cell's inventory, versions (N/N-1 drift), health, backups, replication lag, licences, certificates, hardware alarms and ring assignment (§16.1, §19.5).
- **Objectives that bear on delivery** (§16.4): zero planned downtime (a major database upgrade ≤30 min a year); critical patches ≤7 days centrally and ≤14 days on site (also SD-8, §13.1).

## Consequences (including safety and licence impact)

**Safety.**
- Staged rings put every release on the reference cell and then on one non-flagship site before the rest of the fleet, and never first at DP#1, which limits how many hospitals a defective release can reach (H6, H7).
- Rollback to N-1, made possible by expand → migrate → contract migrations, lets a bad release be withdrawn without losing data (H6).
- The deferral rule keeps a train away from a hospital during a go-live, a mass-casualty event or a shutdown.
- Capping drift at N-1 keeps every cell within one train of the current hazard controls, fixes and content rules; KDV-7 treats drift as a fleet-wide safety risk.
- Tolerating ≥90 days without call-home, with no lockout, means an internet cut or shutdown cannot stop a hospital through an expired licence, certificate or update check (H7; K §7.9).
- Signed offline media with pinned keys and anti-rollback lets a cell that cannot reach us update, and refuses media signed with another key or carrying an older release.

**A tension recorded for the lead.** The rings take at least 21 days to reach all sites (≥7 days on the reference cell, then ≥14 days at a non-flagship site), while the critical-patch objective is ≤14 days on site (BUILD-PROMPT §16.4; SD-8; K §7.10). The sources do not say how a critical patch moves through the rings. This ADR changes neither figure; the difference is recorded for `docs/program/OPEN-QUESTIONS.md` (BUILD-PROMPT §1).

**Operations.** A monthly train needs a fleet that can be seen: the fleet console's ring, version and drift view is what the reopen trigger is measured with (§16.1, §19.5). Telemetry leaving a cell is PHI-free (BUILD-PROMPT §6.7; SI-20).

**Licence.** Releases are signed. In development and CI that means a local cosign key pair and no public transparency log; production keys and any transparency log need an ADR and a [HUMAN] decision (BUILD-PROMPT §4.3; ADR-022).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Upgrade/rollback tests; drift telemetry.

**Where and when.**
- **Migration upgrade-and-rollback test against N-1:** a merge-tier check on every change (BUILD-PROMPT §6.4, §6.8 item 9, §19.1; Definition of Done item 7, §22.1). It can act once the first Flyway migrations exist, with the journal in WP-0.3; the local CI runner names WP-0.3 for this step.
- **Install, upgrade and N-1 rollback of a whole cell:** on the dev cell for every merge and on the reference cell before release (bar #7, BUILD-PROMPT §0); "upgrade from N-1 and rollback tested" is a release gate (§22.3). The installer, signed offline media, N-1 rollback and the fleet console are WP-1.13 exit evidence (`PLT-OPS-07`, `PLT-SITE-01`).
- **Drift telemetry:** the fleet agent and the fleet console's ring, version and drift view, both with the on-site cell product in WP-1.13 (§16.1, §19.5).
- BUILD-PROMPT names no separate test for the ≥90-day tolerance; it belongs to the on-site cell product (`PLT-SITE-01`: fleet, licensing, certificates, updates), WP-1.13.
- The reference-cell runs wait for hardware [HUMAN: hardware].

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

Any cell beyond N-1 for >45 days.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
