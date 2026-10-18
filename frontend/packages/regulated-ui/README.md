# packages/regulated-ui (placeholder)

Tier 2-owned UI components land here (BUILD-PROMPT.md §5.2, §10.4). They are the only components that
display regulated values, and each one carries a render-integrity check: a hash of the Tier 2 module's output
is compared with what is drawn. CPOE and MAR screens host these components but never compute or reformat a
regulated value. The first component arrives with the `reg-screening` sidecar in WP-1.5 (drug-knowledge-base
screening shown verbatim); more follow with each Tier 2 module (`reg-ews` and `reg-transfusion` in R2b,
`reg-dose` in P2). Their render-integrity tests run on every merge that touches Tier 2 code (§18.2).
