"""A small synthetic plan with the shape of BUILD-PROMPT.md §21 and Appendix A, for the backlog tests.

Totals: R1 7 IDs / 143 ew, R2b 1 / 8, P2 6 / 99 (plus the scheme part row's 3 ew, included), DROPPED-K 1 / 50;
MVP 8 / 151; All 15 / 300.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from hmstools.backlog.paths import BacklogPaths

EXPECTED_IDS = 15

PLAN = """\
# Synthetic plan (tests only)

## 21. Build sequence

### Phase 0: Foundation

| WP | Depends on | Scope | Exit evidence |
|---|---|---|---|
| **0.1 Bootstrap** | — | Layout; `tools/doctor`; `.gitattributes` | Green with `PLT-CORE-01` in exit text |
| **0.3 Kernel** (`PLT-CORE-01`, `PLT-CORE-02`, `PLT-UX-03` base) | 0.1 | Journal; `Clock` | Rebuild |

### Phase 1: Wedge

Intro paragraph naming `RCM-US-01`, which is not read because this phase has a table.

| WP | Depends on | Features | Exit evidence |
|---|---|---|---|
| **1.1 Enterprise, workforce** | Phase 0 | `PLT-CORE-02` (full), `PLT-CORE-06` (non-device rules) | Tree |
| **1.1b Hub core** | 1.1 | `INT-ENG-01` (base): MLLP over TLS, owned queues. WPs 1.2 and 1.4 add types here (§5.2) | ADT |
| **1.9 Revenue** | 1.1 | `RCM-SCH-01`, `KRI-ID-01`, control sets B and C (§10.3) | Charges |

### Phase 2: Inpatient

| WP | Depends on | Features | Exit evidence |
|---|---|---|---|
| **2.2 Inpatient billing** | 1.9 | `RCM-*` inpatient scope (§9.20–§9.21) | Deposits |
| **2.5 Registers** | 1.9 | `CLN-CDS-05` (`reg-ews`) and its fallback | Locked |

### Phase 1.1: R1.1 (≈M25)

document-pack automation (`RCM-SCH-01`); LIS rules in `reg-lis-rules`, activated only where allowed (`INT-ENG-01`); MIS breadth. Exit: each item works.

### Phase 5: P2 depth

Order of work: **the Dose Engine first** (`MED-DOSE-01`; shadow mode, C2 activation), then lite GL (`ERP-FIN-02`) and CMMS (`ERP-HTM-01`), which make the wave. Then the rest of P2: `PLT-CFG-04`, the scheme part of `RCM-SCH-01`, the AI platform (`AI-GW-01`, `AI-GOV-01`; none before G3). Items without IDs: Ramadan mode.

---

## 22. Definition of Done

Nothing here is read.

## Appendix A. The backlog of record

Preamble.

### A.1 PLT: Platform/NFR

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `PLT-CORE-01` | Clinical journal | XL | R1 | B | Bitemporal append-only journal |
| `PLT-CORE-02` | Enterprise \\| hierarchy | L | R1 | B | Tenant>facility; a \\| b choice · *Kept (K §5.1) · Placed R1: [P] pulled forward* |
| `PLT-CORE-06` | Rules engine | M | R1 | B† | Versioned rules · *Inferred R1* |
| `PLT-UX-03` | i18n / RTL | L+M | R1 | B | RTL; Hijri |
| `PLT-CFG-04` | Extension SDK | M | P2 | B | Plugin slots |

### A.2 RCM: Revenue

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `RCM-SCH-01` | Corporate credit | M (−3) | R1 | B | Scheme + corporate credit · *Scheme part split to P2* |
| `RCM-SCH-01 · part: scheme` | Scheme billing | ≈3 ew | P2 | B | Government-scheme part of RCM-SCH-01 |
| `RCM-US-01` | US RCM | XL (BP L→XL) | DROPPED-K | B+I | X12 · *Dropped: US-only* |

### A.3 KRI: Kurdistan features

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `KRI-ID-01` | Iraqi identity | L (+12 net) | R1 | B+I† | Name parts · *+12 net over ACC-ID-02* |

### A.4 INT: Interoperability

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `INT-ENG-01` | HL7 v2 engine | L | R1 | B+I | MLLP/TLS |

### A.5 CLN: Clinical core

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `CLN-CDS-05` | NEWS2 | M | R2b | B | EWS (reg Y) |

### A.6 MED: Medication

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `MED-DOSE-01` | Dose Engine | L | P2 | B† | Tier 2 |

### A.7 ERP: ERP

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `ERP-FIN-02` | Lite GL | L | P2 | B | Native lite GL |
| `ERP-HTM-01` | CMMS | M | P2 | B | Asset register |

### A.8 AI: AI and data

| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |
|---|---|---|---|---|---|
| `AI-GW-01` | AI gateway | L | P2 | B | Routing |
| `AI-GOV-01` | AI control plane | L | P2 | B | Registry |

### A.18 Totals after the placements above

| Phase | Feature IDs | Engineer-weeks |
|---|---|---|
| R1 | 7 | 143 |
| R1.1 | 0 | 0 |
| R2a | 0 | 0 |
| R2b | 1 | 8 |
| R2.1 | 0 | 0 |
| P2 | 6 | 99 |
| P3 | 0 | 0 |
| DROPPED-K | 1 | 50 |
| **MVP (R1 to R2.1)** | **8** | **151** |
| **All** | **15** | 300 |

These per-feature sums differ slightly from K's release-level figures because K costs the AI gateway and control plane at 20 engineer-weeks where R14 sizes them at 40, and because of the placements noted above.
### A.19 Controls and items without feature IDs

| Item | Phase | Where specified |
|---|---|---|
| Control set B | R2a | §10.3 |

---

## Appendix B. Templates

Nothing here is read.
"""


# Only 'hazards[].id' and 'hazards[].features' are read by the backlog. Expected links: KRI-ID-01 -> HAZ-0001,
# HAZ-0002 (entries out of order, a feature named twice by one entry); RCM-SCH-01 and its scheme part row ->
# HAZ-0002; INT-ENG-01 -> HAZ-0001; HAZ-0003 names no feature.
HAZARD_LOG = """\
schema_version: 1
hazards:
  - id: HAZ-0002
    title: Second fixture hazard
    features: [RCM-SCH-01, KRI-ID-01, KRI-ID-01]
  - id: HAZ-0001
    title: First fixture hazard
    features: [KRI-ID-01, INT-ENG-01]
  - id: HAZ-0003
    title: Fixture hazard with no feature
    features: []
"""
EXPECTED_HAZARDS = {
    "KRI-ID-01": ["HAZ-0001", "HAZ-0002"],
    "RCM-SCH-01": ["HAZ-0002"],
    "RCM-SCH-01 · part: scheme": ["HAZ-0002"],
    "INT-ENG-01": ["HAZ-0001"],
}


class SyntheticRepo:
    """A temporary repository layout holding a plan text and a hazard log; remove with cleanup()."""

    def __init__(self, plan: str = PLAN, hazard_log: str | None = HAZARD_LOG) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="hms-backlog-test-")
        root = Path(self._tmp.name)
        self.paths = BacklogPaths.for_root(root)
        self.write_plan(plan)
        if hazard_log is not None:
            self.write_hazard_log(hazard_log)

    def write_plan(self, plan: str) -> None:
        with open(self.paths.source, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(plan)

    def write_hazard_log(self, text: str) -> None:
        self.paths.hazard_log.parent.mkdir(parents=True, exist_ok=True)
        with open(self.paths.hazard_log, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)

    def cleanup(self) -> None:
        self._tmp.cleanup()
