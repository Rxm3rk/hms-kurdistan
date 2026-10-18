# ADR-026: Power: separate UPS feeds, crash-safe storage and time without the internet
Status: accepted
Date: 2026-10-18   Source: K §2 (Power, Internet), §7.2 (new), §7.4, §7.8, §7.9 (L1b), §7.10, §9.2, §13.2, §13.3 (RG1, RG3), §18 (risk 8), K-18, Appendix B (L-9, L-10); BUILD-PROMPT §0 (bar #4), §2.1 (SI-10), §5.1, §5.2 (platform-site), §5.4, §6.7, §7 item 18, §13.1 (AU-1), §16.1, §16.2, §16.3, §16.5, §18.7, §19.1, §21 (WP-0.2, WP-1.13), A.1 (PLT-PWR-01, PLT-SITE-01), §4.2

## Context

**The question.** How an on-site cell rides through mains cuts and generator switchovers without losing data, and how it keeps trustworthy time when the internet is down.

**The Kurdistan facts** [L] (K §2; K Appendix B, L-9 and L-10). Grid supply has improved, but cuts still happen; hospitals rely on generators and UPS, and switchovers cause short blackouts at workstations. Internet outages happen, including government-ordered shutdowns. K draws the consequences: clients must survive power blips (autosave, fast re-login), and power design is a readiness gate (RG1).

**K's decision** (K §7.2, "026 (new)"; K-18). ADR-026 is new in K; BP has no ADR-026. K-18 ("downtime-first, strengthened") makes mains-power design an RG1 prerequisite: a server-room UPS for ≥60 min plus a generator auto-start, and UPS at the pharmacy, ED, ICU, lab and nursing stations. Layer L1b of K's downtime table (mains power loss) adds separate UPS per node, graceful shutdown below 10 minutes of UPS, client autosave and a monthly generator transfer test, with the objective "no data loss; clinical work continues at UPS-backed points" (K §7.9). The hospital's infrastructure obligations (UPS, generator, network, server-room environment) are written into the contract and verified at RG1 (K §7.10): RG1 needs the on-site cell installed with burn-in, failover and power-cut tests passed, and RG3 a mains-power-cut drill (K §13.3). K's risk 8 (on-site cell failure or neglect: hardware, power, heat, theft) is mitigated by three nodes on separate UPS, monitoring, spares, remote hands, the DR standby, ADR-026 and ADR-027 (K §18). Not marked [P].

**K's fuller wording, recorded.** K §7.2 says "battery-backed or power-loss-protected drives" where BUILD-PROMPT §4.2 says "power-loss-protected drives"; BUILD-PROMPT's reference hardware specifies NVMe with power-loss protection (§5.1). K words the reopen trigger "any data-loss event from power; any clinical write with clock skew >5 s". This ADR follows §4.2.

## Decision

**Power:** separate UPS feeds per node with ≥60 minutes runtime and generator auto-start; crash-safe storage (synchronous commit, power-loss-protected drives); graceful shutdown below 10 minutes of UPS; mains, generator and UPS status monitored as building signals; clients autosave drafts and re-authenticate fast after a blip; GPS or stratum-1 NTP per cell; clock skew >1 s between nodes alarms; a node more than 5 s out is blocked from clinical writes.

**Clause by clause, with who provides each** (BUILD-PROMPT §5.1, §5.4, §6.7, §7 item 18, §16.1, §16.2):
- **Separate UPS feeds per node, ≥60 minutes runtime, generator auto-start:** hospital infrastructure, written into the contract and verified at RG1 (K §7.10, §13.3) [HUMAN: hospital]. The reference hardware has two online double-conversion UPS units with ≥60 minutes runtime (§5.1). The installer verifies UPS signalling before it starts (§16.1).
- **Crash-safe storage:** synchronous commit and power-loss-protected drives; the reference hardware specifies NVMe with power-loss protection (§5.1). Separately, the cell's PostgreSQL runs as three instances with quorum synchronous replication: a commit waits for one of the two standbys and never degrades to asynchronous (§16.2; ADR-001).
- **Graceful shutdown below 10 minutes of UPS:** a graceful, ordered shutdown (§16.1); "UPS on battery and runtime <10 minutes" is a minimum alarm (§6.7). The 10-minute figure rests on a local assumption, and `docs/program/ASSUMPTIONS.md` records it as a configuration key with K's default (L-9).
- **Mains, generator and UPS status as building signals:** published as events by the site services (`platform-site`, §5.2; §7 item 18), in edge plane B (K §9.2; ADR-011).
- **Clients:** drafts autosave, re-authentication is fast (badge tap ≤2 s), and nothing is lost on a workstation reboot (§5.4; ADR-019).
- **Time without the internet:** a GPS or stratum-1 NTP source per cell; clock skew >1 s between nodes alarms (§6.7, §16.1); a node more than 5 s out is blocked from clinical writes (§16.1). Time-sync health and the clock-skew write block are site services (`platform-site`; §7 item 18). The installer verifies the time source before it starts (§16.1), and audit records take their time from the cell's NTP source (AU-1, §13.1).

## Consequences (including safety and licence impact)

**Safety.**
- "Power blip: no data loss" is part of the bar (BUILD-PROMPT §0, bar #4). Crash-safe storage, quorum synchronous replication and a graceful shutdown before the UPS runs out protect against H6; fast client recovery and UPS-backed points keep clinical work going (H7).
- Clinical time is distinct from system time (SI-10), and both the journal's times and the audit trail's times (AU-1) depend on clocks that agree. Alarming at 1 s of skew and blocking clinical writes from a node more than 5 s out keep a drifting clock from writing wrong times into the record when no internet time source exists (H6).
- The hospital's power infrastructure is part of the safety case. RG1 needs it in place and tested, and RG3 needs a mains-power-cut drill passed (K §13.3); the agent prepares the evidence and never marks a [HUMAN] gate passed (BUILD-PROMPT §3.5).

**Operations.** The generator transfer is tested monthly (K §7.9), with test support in the monthly game days on the reference cell (BUILD-PROMPT §18.7). Drills produce evidence with measured recovery times (§16.5).

**Licence.** None specific to this ADR.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Power-cut chaos tests; clock-skew tests.

**Where and when.**
- **Nightly chaos** (BUILD-PROMPT §18.7, §19.1): power-cut emulation (the graceful shutdown path) and clock skew are among the nightly drills, which assert alarms ≤5 min and no data loss. They need the dev cell of WP-0.2; the local CI runner names WP-0.2 for the chaos step.
- **WP-1.13** (`PLT-PWR-01`, `PLT-SITE-01`): its exit evidence includes "power-cut and WAN-cut chaos tests pass". §21 names no clock-skew exit criterion; the clock-skew write block is a site service (`platform-site`, §5.2; §7 item 18) of the on-site cell product that WP-1.13 builds.
- **On real hardware:** the burn-in suite's power-cut test on an installed cell (§16.1) feeds the RG1 evidence [HUMAN: hardware]; spike S9-K re-runs C2 and C9 on the real on-site cell with power-cut and WAN-cut injection (K §7.4). On the dev cell, a power cut can only be emulated.

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

Any data loss from power; any clinical write with skew >5 s.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
