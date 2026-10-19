"""Adds OQ-093 (section d) and section (f) with the WP-0.1 engineering choices [P] to OPEN-QUESTIONS.md."""
import sys
from pathlib import Path

p = Path(sys.argv[1]) / "docs/program/OPEN-QUESTIONS.md"
s = p.read_text(encoding="utf-8")

anchor = "## (e) Content requests"
assert s.count(anchor) == 1
s = s.replace(anchor, """### OQ-093: §21 names some scope without feature IDs
- **Sources:** BUILD-PROMPT §21 names scope in words where Appendix A has a feature ID, so the backlog generator cannot attach the work package: "MIS breadth" (Phase 1.1; probably `OPS-MIS-01`), "AP/AR breadth" and the consignment purchase order (Phase 4; probably `ERP-FIN-01` and `ERP-IMP-01`), and "basic privacy reports" (WP-3.12; probably `TRU-AUD-02`). WP-2.2 also names the wildcard `RCM-*`, which matches no single feature (a warning of `tools/hms backlog check`).
- **Reading in use:** those features carry no work package from these phrases yet. `work_packages` is a hand-edited field that regeneration keeps, so the mapping is added by hand when the phase is planned.
- **Status:** open

""" + anchor)

s = s.rstrip("\n") + """

## (f) Engineering choices [P] made in WP-0.1, awaiting confirmation

Choices the build made where the plan of record sets no value. They bind until a human confirms or changes them; changing one is an ordinary change with a recorded reason, except where a [HUMAN] role is named.

### OQ-094: Host resource thresholds in `tools/doctor`
- **Choice:** the dev cell needs at least 32 GB of RAM (at least 30 GiB measured) and 8 cores; the lite cell at least 16 GB (15 GiB measured) and 4 cores; at least 50 GiB of free disk; on Windows the WSL2 VM is sized as host RAM minus 4 GiB (`tools/hmstools/doctor/checks.py`).
- **Sources:** BUILD-PROMPT "Before the first session" sets 32 GB and 8 cores for the full dev cell and no figure for the lite cell or the disk.
- **Next:** WP-0.2 measures what the lite cell uses on this host (a 10 GB VM, DN-005) and confirms or changes the lite-cell and disk thresholds.
- **Status:** open

### OQ-095: The hazard-log risk vocabulary
- **Choice:** severity `negligible`, `minor`, `serious`, `major`, `catastrophic`; likelihood `improbable`, `remote`, `occasional`, `probable`, `frequent`; level `low`, `medium`, `high`, `very-high` (`docs/safety/README.md`, `docs/safety/hazard-log.schema.json`). The `initial_risk` values in the hazard log are proposals, never acceptances.
- **Sources:** BUILD-PROMPT Appendix B.2 uses this family of words without fixing the scale.
- **Who confirms:** the CSO [HUMAN].
- **Status:** open

### OQ-096: Backend packages and test tiers
- **Choice:** base package `hms`; modules in `hms.<module>` with hyphens turned into dots; shared kernel libraries in `hms.kernel.<lib>`. Each test tier has its own source set: `src/test` (unit and architecture tests, fast tier), `src/propertyTest` (property-based tests, fast tier with 1,000 sequences and nightly with 10⁶), `src/integrationTest` (merge tier) (`backend/README.md`).
- **Why source sets:** splitting one source set by test tags made Kotest report the excluded tests as skipped and left an empty placeholder test in the JUnit reports, so the tier counts were wrong (81 tests and 14 skipped reported where 66 ran).
- **Status:** open

### OQ-097: Licences acceptable for build-only tools
- **Choice:** `tools/licence/policy.yaml` lists licences acceptable only for tools that never ship (for example 0BSD, CC0-1.0, the Boost licence BSL-1.0, and GPL or AGPL build tools). §4.3 checks build- and CI-only tools for use restrictions, not distribution terms; the list is not an extension of the shipped allowlist.
- **Status:** open

### OQ-098: When each §6.8 fitness function arrives
- **Choice:** the work package that adds each fitness function the skeleton cannot express yet (`backend/README.md`, "Fitness functions"). Where §21 names the evidence (WP-0.3 journal rebuild, WP-0.4 repository access and canary scan) the placement follows it; the others are [P]: dose-arithmetic analysis in WP-0.3 when `Quantity` exists, the fact-table write ban and the N-1 migration test with the first migrations in WP-0.3, Modulith verification when `app-hms` exists (WP-0.3), the egress test with the dev cell (WP-0.2), Tier 2 coverage and mutation gates with the first Tier 2 module.
- **Status:** open

### OQ-099: Branch names and the tenant-identifier register
- **Choice:** branches must match `main`, `wp/<n.m>-<slug>` (§3.6), `release/<version>` or `hotfix/<slug>`, and may not contain a registered tenant identifier or the words customer, tenant or client (`tools/hmstools/repo/rules.py`). `tools/config/tenant-identifiers.yaml` registers only the reserved synthetic examples `SYN-TENANT-0001` and `SYN-TENANT-0002`; real tenants are added at onboarding [HUMAN].
- **Sources:** §3.6 names only `main` and `wp/<work-package>-<slug>`; `release/` and `hotfix/` are this build's additions.
- **Status:** open

### OQ-100: Evidence labels for the two checkouts
- **Choice:** runs on the Windows checkout are labelled "Windows host" and are never evidence of record; fast-tier and doctor evidence of record comes from the WSL clone at a committed SHA, labelled "WSL build host, no cell" (`docs/program/evidence/README.md`, KA-001).
- **Status:** open
"""
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
