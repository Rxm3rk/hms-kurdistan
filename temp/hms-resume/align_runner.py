"""Aligns DN-011, KA-003 and backend/README.md with the CI runner's NOT-BUILT step owners."""
import sys
from pathlib import Path

root = Path(sys.argv[1])


def rep(rel, old, new):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, (rel, old[:80])
    p.write_text(s.replace(old, new), encoding="utf-8", newline="\n")


rep("docs/program/DECISIONS-NEEDED.md",
    "The merge tier fails closed while any of its steps is NOT-BUILT (KA-003, §19.1 \"no shortcuts\"). Its steps arrive with WP-0.2 (Testcontainers integration tests; licence, vulnerability and container scans), WP-0.3 (migration upgrade-and-rollback, contract tests), WP-0.7 (end-to-end smoke in three languages, axe, RTL visual diffs) and WP-0.9 (SBOM). So no Phase 0 work package can merge until late in Phase 0, and the branches form a long stack.",
    "The merge tier fails closed while any of its steps is NOT-BUILT (KA-003, §19.1 \"no shortcuts\"). `sh tools/ci/run merge --list` names the work package that builds each step: WP-0.3 (Testcontainers integration tests, AsyncAPI contract tests, the N-1 migration test, coverage gates), WP-0.4 (OpenAPI contract tests), WP-0.7 (end-to-end smoke in three languages, axe, RTL visual diffs), WP-0.9 (ORT licence scan, vulnerability and container scans, SBOM), WP-1.1b (HL7 v2 conformance profiles), WP-1.5 (mutation tests on the first Tier 2 sidecar) and WP-1.12 (the FHIR validator). Read strictly, no work package can merge into `main` before WP-1.12, and the branches form a stack that long.")
rep("docs/program/DECISIONS-NEEDED.md",
    "  1. **Stack the branches** (default, as §3.6 says) and merge the stack into `main` in order once the merge tier passes.",
    "  1. **Stack the branches** (default, as §3.6 says) and merge the stack into `main` in order once the merge tier passes (after WP-1.12).")

p = root / "docs/program/KNOWN-ANOMALIES.md"
lines = p.read_text(encoding="utf-8").split("\n")
for i, line in enumerate(lines):
    if line.startswith("| KA-003 |"):
        lines[i] = (
            "| KA-003 | `tools/ci/run` builds only the fast tier in WP-0.1. The merge, nightly and release tiers fail closed: "
            "every step a later work package builds is NOT-BUILT, names that work package and counts as a failure "
            "(`sh tools/ci/run <tier> --list`). Their steps arrive from WP-0.2 (the cell check, chaos, Helm charts) to "
            "WP-1.12 (the FHIR validator) and WP-1.13 (the restore test, offline media): for example the Testcontainers "
            "integration tests in WP-0.3, the nightly 10⁶-sequence property runs and scenario suites in WP-0.5, the scaled "
            "day in WP-0.6, and signing, SBOM, VEX, provenance and the Release Evidence Pack in WP-0.9. No tier reports a "
            "pass it did not run (§19.1); the merge rule this implies is DN-011 "
            "| H1–H15: the nightly property runs (C2) and scenario suites that verify SI controls do not exist yet; no product code exists either "
            "| `TRU-SEC-01`, `PLT-OPS-06`, `PLT-CORE-03` | 2026-10-18 | open |"
        )
p.write_text("\n".join(lines), encoding="utf-8", newline="\n")

rep("backend/README.md",
    "| 7 | Licence scan, SBOM, secret scan, dependency and container scans | Secret scan: WP-0.1 (fast tier). ORT is configured in WP-0.1 and runs in the merge tier with the scans (WP-0.2); SBOM, VEX and signing in WP-0.9 |",
    "| 7 | Licence scan, SBOM, secret scan, dependency and container scans | Secret scan: WP-0.1 (fast tier). ORT is configured in WP-0.1; the ORT run, the vulnerability and container scans and the SBOM join the merge tier in WP-0.9 (`sh tools/ci/run merge --list`) |")
rep("backend/README.md",
    "| 9 | Migration upgrade-and-rollback test (N-1) | WP-0.3, with the first migrations [P]; the merge tier runs it |",
    "| 9 | Migration upgrade-and-rollback test (N-1) | WP-0.3, with the first migrations [P]; the merge tier runs it (`migration-n-1`) |")
rep("backend/README.md",
    "| 13 | Tier 2 boundary-value coverage and mutation score | With the first Tier 2 module (PIT in the merge tier) [P] |",
    "| 13 | Tier 2 boundary-value coverage and mutation score | With the first Tier 2 sidecar, WP-1.5 (PIT in the merge tier) [P] |")
print("ok")
