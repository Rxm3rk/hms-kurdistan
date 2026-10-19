# Scratch helper (not part of the repo): builds tests/invariants/si-register.json, copying the SI text and the
# "Enforced in" column verbatim from BUILD-PROMPT §2.1 and the planned PropertyTest names from the hazard log.
# Usage: python -I genreg.py <repo root> [spec-layer.json]
import json
import re
import sys

import yaml

sys.stdout.reconfigure(encoding="utf-8")
root = sys.argv[1]
# genreg.py <root> <enabled machines, comma-separated> <spec-layer json>...
enabled = set(sys.argv[2].split(",")) if len(sys.argv) > 2 and sys.argv[2] else set()
spec_layer = {}
for path in sys.argv[3:]:
    for si, items in json.load(open(path, encoding="utf-8")).items():
        spec_layer.setdefault(si, []).extend(i for i in items if i["machine"] in enabled)
bp = open(root + "/BUILD-PROMPT.md", encoding="utf-8").read().splitlines()
start = next(i for i, l in enumerate(bp) if l.startswith("### 2.1 "))
end = next(i for i, l in enumerate(bp) if l.startswith("### 2.2 "))
rows = {}
for l in bp[start:end]:
    m = re.match(r"^\| (\d\d) \| ", l)
    if not m:
        continue
    parts = l[2:-2].split(" | ")
    assert len(parts) == 4, (l, len(parts))
    rows["SI-" + parts[0]] = (parts[1], parts[2], parts[3])
hl = yaml.safe_load(open(root + "/docs/safety/hazard-log.yaml", encoding="utf-8"))
haz = {h["id"]: h for h in hl["hazards"]}


def planned(hids):
    out = []
    for hid in hids:
        for c in haz[hid]["controls"]:
            for p in c["planned_verification"]:
                if p.startswith("PropertyTest:"):
                    name = p.split(" (")[0]
                    if name not in out:
                        out.append(name)
    return out


MOD = "backend/modules"


def mod_domain(m):
    return f"{MOD}/{m}/src/main/kotlin/hms/{m.replace('-', '/')}/domain"


def W(path, known=()):
    return {"path": path, "known": list(known)}


PLATFORM_KNOWN = ["README.md", "arch-rules", "state-machine", "testing"]
MED = W(mod_domain("medications"), ["medicationadministration"])
ORD = W(mod_domain("orders"), ["order"])
ADT = W(mod_domain("adt"), ["bed", "common", "encounter"])
RES = W(mod_domain("results"), ["result"])
LIS = W(mod_domain("lis"), ["specimen"])
SCH = W(mod_domain("scheduling"), ["appointment"])
RCM = W("backend/satellites/rcm/src/main/kotlin/hms/rcm/domain", ["creditclaim"])
PLAT = W("backend/platform", PLATFORM_KNOWN)


def NEW(m):
    # A module that does not exist yet: its domain package (BUILD-PROMPT §6.1; backend/modules/README.md) trips as
    # soon as it exists.
    return W(mod_domain(m))


def REG(m):
    return W(f"backend/regulated/{m}")


def SAT(m):
    return W(f"backend/satellites/{m}")


# waits_on: the §21 work package that builds the component in the §2.1 "Enforced in" column; backlog: the
# features of that work package which the SI's hazard entry lists; watch[0] is the domain marker.
plan = {
    "SI-01": ("WP-1.2", "§21 WP-1.2 (Identity and registration: EMPI, Iraqi identity and registration; 'wristbands and labels print correctly') builds the identity service of §2.1's 'Enforced in'; the print templates come with WP-0.8",
              ["ACC-ID-01", "KRI-ID-01", "ACC-REG-01"], [NEW("empi"), NEW("platform-docs"), MED, LIS, SCH, ADT]),
    "SI-02": ("WP-3.3", "§21 WP-3.3 (eMAR and BCMA; 'property tests for SI-02, SI-13 and SI-15 at 10⁶ sequences') builds the MAR aggregate",
              ["MED-MAR-01", "MED-BCM-01", "MED-INF-01"], [MED, ORD]),
    "SI-03": ("WP-0.3", "§21 WP-0.3 (Platform kernel: 'task engine with owners, SLA timers, escalation and TaskOrphaned') builds the task engine",
              ["PLT-CORE-07"], [NEW("platform-tasks"), PLAT, ORD, RES, SCH, MED, ADT, LIS, RCM]),
    "SI-04": ("WP-1.7", "§21 WP-1.7 (Diagnostics and LIS: 'critical results to named internal and external recipients with read-back') builds the critical-result service",
              ["DX-CRT-01", "DX-ORD-01"], [RES, LIS]),
    "SI-05": ("WP-3.2", "The Dose Engine is P2 (§2.1; MED-DOSE-01, §21 Phase 5). Until it is active the extended fallback control set applies; §21 WP-3.2 (Verification and dispensing: 'control set A, the KB ≥10× hard stop, the pharmacist-cover alarm') builds it",
              ["MED-PHV-01"], [MED, ORD, REG("reg-dose")]),
    "SI-06": ("WP-0.3", "§21 WP-0.3 (Platform kernel, PLT-CORE-01 clinical journal) builds the clinical journal of §2.1's 'Enforced in'; clinical notes follow in WP-1.4",
              ["PLT-CORE-01"], [NEW("platform-journal"), PLAT, NEW("record")]),
    "SI-07": ("Phase 5", "The AI control plane is P2: §21 Phase 5 lists the AI platform and products (AI-GW-01, AI-GOV-01; none of it starts before company gate G3)",
              ["AI-GW-01", "AI-GOV-01"], [SAT("ai-gateway"), ORD, RES]),
    "SI-08": ("WP-1.2", "§21 WP-1.2 (Identity and registration: 'reversible merge with downstream propagation') builds the EMPI",
              ["ACC-ID-01", "KRI-ID-01", "ACC-ID-03"], [NEW("empi")]),
    "SI-09": ("WP-3.11", "§21 WP-3.11 (Results, discharge, handoff, med rec: 'med rec blocked while undecided') builds the med-rec aggregate",
              ["CLN-MRC-01"], [MED]),
    "SI-10": ("WP-0.3", "§21 WP-0.3 (Platform kernel: 'clinical vs recorded time; bitemporal journal-as-outbox') builds the bitemporal journal",
              ["PLT-CORE-01"], [NEW("platform-journal"), PLAT, MED, ADT, LIS]),
    "SI-11": ("WP-3.10", "§21 WP-3.10 (Transfusion: relabel with blind double entry and quarantine on mismatch; reg-transfusion T2 and the scripted fallback) builds transfusion verification",
              ["DX-BB-01", "DX-BB-KRI-01"], [NEW("transfusion"), REG("reg-transfusion"), LIS]),
    "SI-12": ("WP-2.1", "§21 WP-2.1 (ADT and bed board: 'discharge never blocked by money (SI-12 property tests)') builds the ADT side of the RCM ↔ ADT/MAR boundary; the MAR side follows in WP-3.3, RCM in WP-1.9",
              ["ACC-ADT-01", "OPS-FLW-01"], [ADT, RCM, MED, ORD, SCH]),
    "SI-13": ("WP-3.3", "§21 WP-3.3 (eMAR and BCMA: 'high-alert double check'; 'property tests for SI-02, SI-13 and SI-15 at 10⁶ sequences') builds the MAR",
              ["MED-MAR-01", "MED-BCM-01", "MED-INF-01"], [MED]),
    "SI-14": ("WP-1.5", "§21 WP-1.5 (CDS foundation: alert tiers, silent mode, kill switches, override telemetry) builds the CDS registry",
              ["CLN-CDS-01", "CLN-CDS-03"], [NEW("cds"), ORD]),
    "SI-15": ("WP-3.3", "§21 WP-3.3 (eMAR and BCMA: 'offline mode with revalidation and flagged facts'; 'property tests for SI-02, SI-13 and SI-15 at 10⁶ sequences'); the offline matrix of the on-site cell and the edge agent follows in WP-1.13",
              ["MED-BCM-01", "PLT-UX-04"], [MED, ORD, ADT, LIS, NEW("platform-site"), NEW("empi")]),
    "SI-16": ("WP-0.7", "§21 WP-0.7 (Design system and client shells: 'banner component (SI-16) with patient-context management and re-verification at signing') builds the design-system shell, on its own branch (KA-063)",
              ["PLT-UX-01", "PLT-UX-02"], [W("frontend/packages/ui-core"), ORD]),
    "SI-17": ("WP-3.11", "§21 WP-3.11 (Results, discharge, handoff, med rec: 'pending-at-discharge queues') builds results routing",
              ["CLN-RES-01", "CLN-DOC-03"], [RES, ADT]),
    "SI-18": ("WP-0.9", "§21 WP-0.9 (Safety registry and release evidence: the Regulatory Boundary Register) builds the Boundary Register service",
              ["TRU-REG-01", "TRU-REG-02"], [NEW("safety-registry"), RES]),
    "SI-19": ("WP-0.3", "§21 WP-0.3 (Platform kernel: 'flags and kill switches') builds the flag service",
              ["PLT-CFG-01"], [NEW("platform-config"), PLAT]),
    "SI-20": ("WP-0.4", "§21 WP-0.4 (Trust Plane v1: per-tenant envelope keys and crypto-shredding; PHI-safe logging with the canary scan) builds the Trust Plane part; the AI gateway is P2 and the egress tests come with WP-1.13",
              ["TRU-KEY-01"], [NEW("trust-keys"), NEW("trust-policy"), SCH, RCM]),
    "SI-21": ("WP-0.4", "§21 WP-0.4 (Trust Plane v1: the policy decision point with labels and purpose-of-use; policy enforcement for API, print and export) builds the Trust Plane PEP",
              ["TRU-PRV-01", "TRU-IAM-02", "TRU-IAM-03", "TRU-AUD-01"], [NEW("trust-policy"), NEW("trust-audit"), SCH]),
}
entries = []
for n in range(1, 22):
    si = f"SI-{n:02d}"
    text, enforced, _hazard_column = rows[si]
    hids = [h["id"] for h in hl["hazards"] if si in (h.get("invariants") or [])]
    waits, why, backlog, watch = plan[si]
    entries.append({
        "si": si,
        "title": text,
        "title_source": f"BUILD-PROMPT §2.1 SI-{n:02d}, the Invariant column, verbatim",
        "enforced_in": enforced,
        "hazards": hids,
        "planned_test": f"PropertyTest:{si}-*",
        "planned_tests": planned(hids),
        "spec_layer": spec_layer.get(si, []),
        "domain_layer": "NOT-BUILT",
        "waits_on": waits,
        "waits_on_source": why,
        "backlog": backlog,
        "ka": "KA-060",
        "domain_marker": watch[0]["path"],
        "domain_watch": watch,
    })
doc = {
    "version": 1,
    "description": (
        "The SI register of the SI test scaffold (docs/specs/modules/state-machines-and-invariants.md §4; BUILD-PROMPT "
        "§2.1, §3.5, §18.1, §18.3). One entry per SI-01…SI-21, in order. A domain_layer of NOT-BUILT is declared, fails "
        "closed and is tracked by KA-060; it never means that the SI is enforced. spec_layer lists the specification-layer "
        "properties the scaffold runs and the hazard-log clauses each covers at that layer only. domain_watch: the SI's "
        "domain-layer test fails while it says NOT-BUILT and a watched path exists and holds an entry that its known list "
        "does not name (a path with an empty known list trips as soon as it exists, a file as soon as it exists). The first "
        "watched path is the domain_marker: the domain package that will enforce the SI, or, where that module already holds "
        "WP-0.5 state-machine packages (known), the module's domain package, which trips when anything else appears in it. "
        "Read by tests/invariants (hms.tests.invariants) and by sh tools/hms statemachines si-status."
    ),
    "entries": entries,
}
out = root + "/tests/invariants/si-register.json"
open(out, "w", encoding="utf-8", newline="\n").write(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
print("wrote", out, len(entries))
