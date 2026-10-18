# ADR-027: Fleet operations: outbound-only management, co-signed local break-glass and supported hardware
Status: accepted
Date: 2026-10-18   Source: K §2 (Internet), §7.2 (new), §7.8, §7.9 (L1), §9.2, §10, §13.2, §15.1 (G1), §15.4 (S7-K), §16.5, §18 (risks 8 and 10); R16 §15, §17 #11; BUILD-PROMPT §3.5, §5.1, §12.8, §13.1 (IA-6, AZ-4, PL-3), §13.2, §13.5, §16.1, §20, §21 (WP-1.13), A.1 (PLT-SITE-01), A.2 (TRU-IAM-03), §4.2

## Context

**The question.** How a fleet of on-site cells is managed and repaired, including when the vendor cannot reach a cell over the internet, and which hardware a cell may run on.

**The research** (R16 §15, §17 #11). A certified-hardware programme: tiers (certified, compatible, community), a conformance kit, partner obligations (firmware change notice at least 60 days ahead, SBOM, CVE disclosure SLA, 5-year availability or replacement, in-country service) and a per-market Supported Hardware List versioned with the release train and attached to tender responses. R16 says to run it from day one.

**K's decision** (K §7.2, "027 (new)"). ADR-027 is new in K; BP has no ADR-027. The Kurdistan facts behind it:
- internet outages and government shutdowns happen [L] (K §2), so a field engineer may have to work on a cell that remote support cannot reach; during an internet or WAN loss, field engineers use co-signed local break-glass (K §7.9, layer L1);
- vendor access is just-in-time privileged access with session recording, customer lockbox approval of every vendor session and a customer-visible support-access log; K lists field engineers' local break-glass for internet shutdowns alongside these rules (K §10);
- a Kurdistan Supported Hardware List applies, with in-country service from a hardware partner (K §9.2, carried over from R16 §17); K expects a Kurdistan IT integrator with in-country service in each governorate [L], hardware on the partner's paper and a 60-day firmware notice (K §16.5);
- K's risk 8 (on-site cell failure or neglect) is mitigated by spares per governorate, remote hands, the DR standby, ADR-026 and ADR-027, and risk 10 (internet shutdowns) partly by co-signed local break-glass (K §18).

K freezes ADR-027 at M9, later than the other ADRs, which are frozen at company gate G1 (M6) (K §7.2, §15.1). Not marked [P].

**Not clinical break-the-glass.** Clinical break-the-glass (AZ-4, BUILD-PROMPT §13.1; `TRU-IAM-03`; ADR-013) is a user's emergency access to a patient's record. ADR-027's break-glass is a field engineer's access to a cell's operations plane.

## Decision

**Fleet operations:** outbound-only management channel; local break-glass for field engineers during internet cuts (on-site co-sign by the hospital IT lead or CSO, single-use sealed credentials rotated after use, operations plane only, recorded session the customer reviews within 5 working days); spare parts and remote hands per governorate; hardware only from the Kurdistan Supported Hardware List.

**Clause by clause** (K §7.2, §10; BUILD-PROMPT §13.1, §13.2, §13.5, §16.1, §12.8):
- **Outbound-only management channel:** cells pull releases over an outbound channel (ADR-021), and traffic to the central site is outbound mTLS only (§13.5).
- **Vendor access in normal operation:** just-in-time privileged access with approval and session recording, a customer-visible log and mandatory customer lockbox approval (IA-6, §13.1; §13.2).
- **Local break-glass for field engineers during internet cuts** (§13.2, §16.1):
  - an on-site co-sign by the hospital IT lead or CSO [HUMAN];
  - single-use sealed credentials, rotated after use;
  - the operations plane only;
  - a recorded session that the customer reviews within 5 working days [HUMAN].
- **Spare parts and remote hands per governorate:** spare-parts stock and remote-hands contracts per governorate (K §7.2), through the hardware partner (K §16.5). These are business arrangements, not software [HUMAN].
- **Hardware only from the Kurdistan Supported Hardware List** (§12.8, §13.2): the installer installs onto nodes from the list and verifies hardware before it starts (§16.1); S7-K's tests of Sorani, Badini and Arabic printing on target printers feed the list (K §15.4); a hospital's devices are inventoried against it in the T-120 site infrastructure assessment (K §13.2).
- **The fleet console** (central) shows each cell's inventory, versions, health, backups, replication lag, licences, certificates, hardware alarms and ring assignment (§16.1).
- **Runbook:** break-glass is one of the operations runbooks (§20).

## Consequences (including safety and licence impact)

**Safety and security.**
- Local break-glass means an internet cut cannot leave a failing cell without an engineer (H7). The co-sign, the single-use sealed credentials rotated after use, the operations-plane-only scope and the recorded session reviewed by the customer keep that access accountable and narrow.
- Outbound-only management is part of the cell's security baseline (§13.2, §13.5), and support reaches data only inside the cell (PL-3, §13.1; SI-20).
- Spare parts and remote hands per governorate bound the time a cell waits for hardware, which is what the reopen trigger measures (H7).
- The Supported Hardware List limits cells and peripherals to tested hardware; S7-K's printer tests behind it protect wristband and label printing in the patient's script (SI-01).

**Human roles.** The co-sign, the session review and the partner contracts are human acts [HUMAN]. The software captures a co-sign as a human action and never records one on anyone's behalf (BUILD-PROMPT §3.5).

**Licence.** None specific to this ADR.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Break-glass tests.

**Where and when.**
- BUILD-PROMPT §16.1 places field-engineer break-glass in the on-site cell product (`PLT-SITE-01`, `PLT-OPS-02`, `PLT-PWR-01`), which WP-1.13 builds alongside the Phase 1 work packages. WP-1.13's exit evidence in §21 lists, among other items, the installer and burn-in suite, the fleet console, signed offline media and the power-cut and WAN-cut chaos tests, but does not name the break-glass test; it belongs with them in WP-1.13.
- The fleet console's health and hardware alarms (WP-1.13) are the nearest data for the reopen trigger. BUILD-PROMPT names no metric for "down awaiting hardware".

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

Any cell down >4 h awaiting hardware.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
