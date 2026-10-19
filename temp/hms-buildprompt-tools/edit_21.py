"""One-off edits to part-09a.md (§21) from the executability review."""
import sys
from pathlib import Path

p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')


def rep(old, new):
    global s
    n = s.count(old)
    assert n == 1, (n, old[:70])
    s = s.replace(old, new)


# --- Phase 0 rows
rep("| **0.1 Programme bootstrap** | Monorepo layout (§6.1); programme control files (§3.1); `backlog.yaml` generated from Appendix A; baseline ADR files (§4.2); hazard log seeded with H1–H15 and one entry per SI-01…SI-21; Gradle and pnpm workspaces; fast CI tier; licence policy and ORT config; secret scanning; PR template; CODEOWNERS by module | Fast tier green on an empty skeleton; every ADR file present; hazard log parses in CI; backlog renders |",
    "| **0.1 Programme bootstrap** | Monorepo layout (§6.1); programme control files (§3.1), including `OPEN-QUESTIONS.md` (Q-K list, A.20 conflicts), `ASSUMPTIONS.md` ([L] items) and `COMMANDS.md`; `backlog.yaml` generated from Appendix A by a script, with a ten-row spot check; baseline ADR files (§4.2); hazard log seeded with H1–H15 and one entry per SI-01…SI-21, every control `planned`; `tools/doctor` (checks every prerequisite and resource limit and prints what is missing); `.gitattributes` (`* text=auto eol=lf`; images and fonts binary); Gradle and pnpm workspaces; `tools/ci/run` with the fast tier and evidence records (§19.1); licence policy, ORT configuration and curations (§4.3); secret scanning; PR template; CODEOWNERS by module | `tools/ci/run fast` green on an empty skeleton with stored evidence; `tools/doctor` output recorded; every ADR file present; hazard log parses in CI; the backlog renders all 234 feature IDs |")
rep("| **0.2 Environments** | `docker compose` dev stack; three-node `k3d` reference cell with CloudNativePG (synchronous standby), Strimzi Kafka KRaft (three brokers), Temporal, Keycloak, OpenFGA, Valkey and an S3-compatible object store with object lock; Helm charts; Argo CD in pull mode; OpenTelemetry collector; one-command bootstrap and teardown | The cell boots from signed images with one command; a smoke test passes; killing one node keeps PostgreSQL writable |",
    "| **0.2 Environments** | `docker compose` dev stack; the dev cell (three-node `k3d`, §5.1; a lite cell on small hosts) with CloudNativePG (three instances, quorum synchronous replication), Strimzi Kafka KRaft (three brokers), Temporal, Keycloak, OpenFGA, Valkey and an S3-compatible object store with Object Lock (§4.1); upstream operators and charts only; a local image registry with offline signing (§4.3); Argo CD in pull mode; OpenTelemetry collector; one-command bootstrap and teardown | The cell boots from locally signed images with one command; a smoke test passes; killing any single node (primary or standby) keeps PostgreSQL writable with no committed transaction lost, and losing two nodes stops writes instead of degrading to asynchronous; the object store refuses to delete a locked object |")
rep("| Every G1 machine has a spec, a generated model and passing property tests; approval requests filed in `DECISIONS-NEEDED.md` [HUMAN: pharmacist and nurse panels, lab CSO, HIM, CSO] |",
    "| Each of the six machines that company gate G1 needs (encounter, order, medication administration, specimen, result, bed) has a spec with named-predicate guards, a generated model and passing property tests; every approval block reads `status: requested` with `approved_by` empty; approval requests filed in `DECISIONS-NEEDED.md` [HUMAN: pharmacist and nurse panels, lab CSO, HIM, CSO] |")
rep("| Synthetic population generator (§18.10); 1,000-bed-day and 300-bed-day workload generators; benchmark harness for spike criteria C1–C9 (§18.6) on the reference cell, including offline-BCMA conflict replays; Kafka vs NATS footprint comparison | A written spike report with measured C1–C9 results; ADR-001 and ADR-009 move from \"accepted-provisional\" to \"accepted\", or the reopen rule is triggered and recorded |",
    "| Synthetic population generator (§18.10); 1,000-bed-day and 300-bed-day workload generators; benchmark harness for spike criteria C1–C9 (§18.6), including offline-BCMA conflict replays; Kafka vs NATS footprint comparison. Measure Option A only; assess Options B and A′ on paper from R08 and K §7.4 (a desk assessment) unless the human asks for a prototype. Spike code lives in `spikes/adr-001/`, is not production code, and is rebuilt from specs in Phase 1. For C5, C8 and ADR-004's tooling criterion, report what you can measure (files, modules and migrations touched; agent wall-clock time) and ask the human to convert it into engineer-days | A written spike report: C1–C6 and C8 measured on the dev cell (indicative); C7 and C9 harnesses built and dry-run at reduced scale. ADR-001 and ADR-009 stay accepted-provisional until a reference-cell run [HUMAN: hardware], unless a measured result already triggers a reopen rule, which you record |")
rep("| Golden images pass for a trilingual wristband, specimen label and receipt; the font-coverage test passes |",
    "| Golden images pass for the paths we rasterise ourselves (PDF/A pages at fixed DPI; the ZPL `^GF` raster decoded from our own output) for a trilingual wristband, specimen label and receipt. ZPL text-mode output is checked byte for byte against approved fixtures; its printed appearance is verified only in S7-K on physical printers [HUMAN: printers], and the S7-K kit is ready to run. The renderer choice stays accepted-provisional until S7-K. The font-coverage test passes. Label data never goes to an online renderer |")
rep("| A dry-run release produces a complete evidence pack; promotion is blocked when a control lacks a passing test |",
    "| A dry-run release produces a complete evidence pack; promotion is blocked when a control for a feature in the release is not `verified` |")
rep("**Phase 0 exit:** all nine WPs done; every CI tier running (nightly property runs included); the spike report written; the reference cell installs from signed artefacts. [HUMAN] state-machine approvals requested; ADR freeze confirmed by the human lead.",
    "**Phase 0 exit:** all nine WPs done; every CI tier runs through `tools/ci/run` with stored evidence (nightly property runs included); the spike report written; the dev cell installs from signed artefacts (the reference-cell install waits for hardware [HUMAN]). [HUMAN] state-machine approvals requested; ADR freeze confirmed by the human lead.")

# --- Phase 1
rep("terminology service with LOINC, UCUM, ICD-10 and local codes;",
    "terminology service that loads LOINC, UCUM and ICD-10 from licensed files when a human supplies them [HUMAN: licences], with loaders verified on synthetic files, plus local codes;")
rep("| **1.2 Identity and registration** |",
    "| **1.1b Hub core** | `INT-ENG-01` (base) | MLLP over TLS; acknowledgement state; owned dead-letter queues with alarms; ordered replay; outbound generation from domain events; DICOM and ASTM bridge skeletons; the simulators from §3.7 wired in. WPs 1.2, 1.4, 1.7 and 1.8 add their message types here, so no other module emits HL7 v2, FHIR or DICOM (§5.2) |\n"
    "| **1.2 Identity and registration** |")
rep("| **1.12 Integration Hub** | `INT-ENG-01`, `INT-FHIR-01` (read), `INT-DOC-01`, `INT-IPS-01` |",
    "| **1.12 Integration Hub completion** | `INT-ENG-01` (full), `INT-FHIR-01` (read), `INT-DOC-01`, `INT-IPS-01` |")
rep("| — | The 300-bed day on the reference cell within SLOs;",
    "| — | The 300-bed day on the reference cell within SLOs [HUMAN: reference hardware];")
rep("It covers H15, is completed before G1 and is signed by DP#1's CSO before wedge RG1 [HUMAN].",
    "It covers H15, is completed before company gate G1 (M6) and is signed by DP#1's CSO before wedge RG1 [HUMAN].")
rep("none of this starts before G3, ≈M40, K-23)", "none of this starts before company gate G3, ≈M40, K-23)")
rep("| NEWS2/PEWS/MEOWS verbatim with 100% boundary-value tests;",
    "| NEWS2/PEWS/MEOWS from the source documents in `docs/content-sources/` (§3.5) with 100% boundary-value tests;")

# --- Dependency column
DEPS = {
    '0.1': '—', '0.2': '0.1', '0.3': '0.2', '0.4': '0.3', '0.5': '0.3', '0.6': '0.4, 0.5',
    '0.7': '0.1 (badge flow: 0.4)', '0.8': '0.3', '0.9': 'all other Phase 0 WPs',
    '1.1': 'Phase 0', '1.1b': '1.1', '1.2': '1.1b, 0.7, 0.8', '1.3': '1.2', '1.4': '1.3',
    '1.5': '1.4', '1.6': '1.5', '1.7': '1.4', '1.8': '1.4',
    '1.9': '1.2 (charge sources from 1.4–1.8 as they land)', '1.10': '1.7, 1.8, 1.9',
    '1.11': '1.6, 1.7, 1.9', '1.12': '1.1b, 1.4, 1.7',
    '1.13': 'Phase 0 (grows alongside every Phase 1 WP)', '1.14': '1.2–1.9',
    '1.15': 'all other Phase 1 WPs',
    '2.1': '1.3', '2.2': '2.1, 1.9', '2.3': '2.1, 1.6, 1.9', '2.4': '2.1, 1.5, 1.6', '2.5': '2.1',
    '2.6': '2.1–2.5',
    '3.1': 'Phase 2', '3.2': '3.1', '3.3': '3.2', '3.4': '2.1', '3.5': '3.4', '3.6': '3.1',
    '3.7': '2.3, 3.3', '3.8': '3.3, 3.4', '3.9': '2.5, 3.4', '3.10': '3.3', '3.11': '3.3',
    '3.12': '2.5', '3.13': '3.3', '3.14': 'all other Phase 3 WPs',
}
out = []
seen = set()
for line in s.split('\n'):
    if line.startswith('| WP | '):
        line = line.replace('| WP | ', '| WP | Depends on | ', 1)
    elif line.startswith('|---|---|---|') and out and out[-1].startswith('| WP | Depends on'):
        line = '|---|---|---|---|'
    else:
        import re
        m = re.match(r'^\| \*\*(\d+\.\d+b?) ', line)
        if m:
            wp = m.group(1)
            assert wp in DEPS, wp
            seen.add(wp)
            first_end = line.index(' | ', 2)
            line = line[:first_end] + ' | ' + DEPS[wp] + line[first_end:]
    out.append(line)
assert seen == set(DEPS), set(DEPS) ^ seen
s = '\n'.join(out)

rep("- Each work package (WP) follows §3.2 and ends with the Definition of Done (§22) and a reviewer report. Work-package files use the template in Appendix B.4.",
    "- **Entry criteria.** A work package starts when the work packages in its \"Depends on\" column are merged, or reviewed and stacked (§3.6), and the simulators it needs exist (§3.7). Packages whose dependencies are met may run in any order.\n"
    "- Each work package (WP) follows §3.2 and ends with the Definition of Done (§22) and a reviewer report. Work-package files use the template in Appendix B.4.")

p.write_text(s, encoding='utf-8')
print('ok', len(seen), 'WPs')
