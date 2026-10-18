"""Backlog of record (BUILD-PROMPT.md §3.1, §21 WP-0.1, Appendix A).

``tools/hms backlog generate`` builds docs/program/backlog.yaml from the Appendix A feature tables and the
§21 work packages, with each feature's hazards taken from docs/safety/hazard-log.yaml; ``render`` derives
the hazards again and writes docs/program/BACKLOG.md; ``check`` verifies both against the plan and the hazard
log; ``spot-check`` prints seeded random rows beside their parsed records for a human comparison.
"""
