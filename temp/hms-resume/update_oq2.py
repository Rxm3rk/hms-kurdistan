"""Adds OQ-101 to OQ-105 (gaps found while writing ADR-020..028) to section (d) of OPEN-QUESTIONS.md."""
import sys
from pathlib import Path

p = Path(sys.argv[1]) / "docs/program/OPEN-QUESTIONS.md"
s = p.read_text(encoding="utf-8")
anchor = "## (e) Content requests"
assert s.count(anchor) == 1
s = s.replace(anchor, """### OQ-101: Release rings against the critical-patch deadline
- **Sources:** ADR-021 (§4.2, K §7.9) stages every on-site release through rings: the reference cell for at least 7 days, then a non-flagship site for at least 14 days, then all sites, so a release reaches every site after 21 days at the earliest. SD-8 (§13.1) and the §16 table require critical and KEV fixes on site within 14 days.
- **Reading in use:** neither figure is changed (ADR-021 records the tension). An expedited path for critical fixes needs a human decision when WP-1.13 builds the release train.
- **Status:** open

### OQ-102: No freshness target for the central data landing
- **Sources:** ADR-023 sets the reporting replica at ≤60 s and lands encrypted CDC bronze data centrally, but neither K nor BUILD-PROMPT restates BP's ≤15-minute lakehouse figure for the central landing.
- **Reading in use:** the freshness tests that guard ADR-023 test the ≤60 s replica target only until a central target is set.
- **Status:** open

### OQ-103: Care-team assignment has no feature ID, owning module or work package
- **Sources:** ADR-024 (§4.2) makes care-team assignment a core ES-lite domain that feeds nurse call; §9 says role and unit assignment from the staff master feed it and that it feeds the nurse-call and ACM platforms, but Appendix A gives it no feature ID and §21 no work package. ADR-024 also records that R16 §2.2 and §8.5 describe the nurse-call feed differently.
- **Reading in use:** it is built with the work package that builds ADT and the staff assignment it depends on, once a human assigns it; the nurse-call feed format waits for that decision.
- **Status:** open

### OQ-104: The dependency scorecard has no file or work package
- **Sources:** §4.3 requires a scorecard (steward, funding, release cadence, bus factor, licence history) for every runtime dependency, and §4.1 uses it to choose the object store and to re-resolve pins at phase boundaries; no file and no work package are named for it.
- **Reading in use:** the scorecard is created as `docs/program/dependency-scorecard.md` by the first work package that adds a runtime dependency to a running system: WP-0.2, which also chooses the object store through it [P].
- **Status:** open

### OQ-105: Two ADR guards have no exit criterion that names them
- **Sources:** ADR-027's guard is "break-glass tests", but WP-1.13's exit evidence does not name them; ADR-023's guard is "freshness tests", which no exit criterion names.
- **Reading in use:** both tests are added with the work packages that build those features (WP-1.13; the reporting replica's work package) and listed in their exit evidence when those packages are planned.
- **Status:** open

""" + anchor)
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
