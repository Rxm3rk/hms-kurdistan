# ADR-011: Edge planes A, B and C
Status: accepted
Date: 2026-10-18   Source: K §7.2, §9.2; BP §7.2, §9.2; R16 §2.1, §17; BUILD-PROMPT §4.1 (Desktop shell), §5.1 (site edge agent), §12.8, §16.3, §21 (WP-0.7, WP-1.10, WP-1.13), A.1 (PLT-EDGE-01), §4.2

## Context

**The question.** Where each device, facility and partner integration runs, so that it keeps working during the outages it must survive.

**The research** (R16 §2.1). Three integration planes:
- **A. Workstation shell HAL** on each PC, kiosk or thin client: wristband, label, receipt and report printers; scanners; badge, smartcard and ID readers; signature pads; semi-integrated payment terminals; cameras.
- **B. Site edge agent / device gateway:** nurse call, RTLS, PBX/CTI, paging, building management, IoT gateways, queue displays and signage, the site print service, downtime report push.
- **C. Cloud adapters (Integration Hub):** cloud messaging, payment gateways, national and partner clouds.

Rule: an integration lives in the lowest plane that can satisfy its downtime requirement. Wristband printing must work when the WAN is down, so it belongs in A or B, never cloud-only.

**BP** (BP §7.2): A shell HAL, B site edge agent, C cloud adapters; each integration in the lowest plane that meets its downtime need.

**What K changed** (K §7.2, "Changed"). Plane B (the site edge agent) is merged into the on-site cell for hospitals; it remains a separate hardened appliance for outpatient-tier sites. Planes A and C are unchanged. The backlog note on `PLT-EDGE-01` reads "Outpatient-tier sites; merged into cell at hospitals (ADR-011)". Not marked [P].

## Decision

**Edge planes:** A = workstation shell HAL; B = the on-site cell for hospitals, or a hardened site edge agent for outpatient sites; C = central adapters. Each integration lives in the lowest plane that meets its downtime need.

**What each plane carries in Kurdistan** (K §9.2; BUILD-PROMPT §4.1, §5.1, §12.8):
- **Plane A:** the Tauri 2 shell with a HAL for printers, scanners, badge and ID-card readers, MRZ readers and card terminals (ADR-019). Silent wristband and label printing rendered per printer DPI with Kurdish and Arabic shaping or a raster fallback; HID-POS scanners preserving GS1 FNC1; document scan; camera.
- **Plane B, hospitals: the on-site cell.** Queue state, ESC/POS token printers and RTL HTML signage; the print spool; the analyser and monitor bridge through middleware; semi-integrated card terminals; one VLAN per device class; building signals (mains, generator, UPS).
- **Plane B, outpatient sites: the site edge agent.** A hardened appliance outside the facility's Windows domain with a continuity replica, queue state, print spool and device bridge (BUILD-PROMPT §5.1).
- **Plane C: central adapters.** WhatsApp, Viber and SMS, wallet and payment links, queued centrally until the internet returns; patient SMS during a shutdown goes only through the per-site GSM/SMPP gateway, and critical messages go by voice call (K §9.1, §9.2).

## Consequences (including safety and licence impact)

**Safety.**
- Wristbands, specimen labels and MAR packets print locally when the WAN is down (SI-01, SI-16; H1), and downtime printing works with the core down (EN-4).
- The HMS feeds ADT and staff assignment to nurse-call and alarm platforms but is never in the primary alarm path (BUILD-PROMPT §2.3; ADR-024; H9).
- No card number (PAN) ever touches the HMS; terminals are semi-integrated (BUILD-PROMPT §2.3).
- Central adapters queue external channels for ≥7 days during an internet cut (BUILD-PROMPT §16.3, layer L1).

**Licence.** None specific to this ADR. The shell's licence is ADR-019.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Downtime matrix tests.

**Where and when.**
- WP-1.13: the edge agent for (a) a polyclinic attached to a hospital cell over metro links, including metro-link loss with continuity and downtime blocks, and (b) a stand-alone polyclinic on the pooled tier; power-cut and WAN-cut chaos tests.
- WP-1.10: the GSM/SMPP gateway adapter queues during a simulated internet cut.
- WP-0.7: the shell HAL interfaces with simulated devices; printer capture endpoints for golden tests (BUILD-PROMPT §3.7).
- Chaos runs (WAN cut, power-cut emulation) are in the nightly tier (BUILD-PROMPT §19.1).

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

No reopen trigger is set (BUILD-PROMPT §4.2 shows "—"). Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
