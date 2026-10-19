# WP-0.5 slice S3: SI test scaffold `tests/invariants` (INTERIM, overwritten as work proceeds)

Status (11:20): step 1 written; its first verifying Gradle run is queued behind `:modules:lis:ktlintFormat` (lock held
since 10:49). Step 2: the medication-administration specification layer is written and parked in
`%TEMP%\wp05\si-scratch\pending\` until that machine's report says its Gradle run passed; no machine report says so yet.
Windows host, not evidence of record.

## Interface (integrator's contract) and the differences
- Register `tests/invariants/si-register.json`: `{"version": 1, "description", "entries": [...]}`, SI-01…SI-21 in order;
  each entry has `si`, `title` (§2.1 verbatim), `title_source`, `enforced_in` (§2.1 verbatim), `hazards`, `planned_test`
  (`PropertyTest:SI-nn-*`), `planned_tests` (every PropertyTest name of those hazards), `spec_layer`, `domain_layer`,
  `waits_on`, `waits_on_source`, `backlog`, `ka`, `domain_marker`, `domain_watch`.
- Differences from the contract: `spec_layer[].clauses` is a LIST of hazard-log clause ids, and each item has `covers`
  (prose: the claim and its limits). `waits_on` for SI-07 is `"Phase 5"` (P2; no WP id). The trip rule is `domain_watch`'s,
  not `exists(domain_marker)`: a path trips when it exists and holds an entry its `known` list does not name; with
  `known: []` as soon as it exists. `domain_marker` = first watch path.
- Status `tests/invariants/build/si-status/SI-nn.json`: the five agreed keys (`si`, `spec_layer` HOLDS|NONE|FAILED,
  `spec_layer_properties`, `domain_layer`, `sequences`) plus `budget`, `domain_test` (PASSED|FAILED|NOT-RUN),
  `domain_test_message`, `domain_test_name`, `waits_on`, `ka`, `properties[]`. Written by the `propertyTest` task
  (directory cleared first); nothing is written outside Gradle.
- The SI specs live in `src/propertyTest` (so nightly `propertyTest -Phms.pbt.sequences=1000000` runs them at 10^6);
  `src/test` holds the self-tests. Verification therefore runs `:tests:invariants:propertyTest` too.

## Trips to expect at merges (by design, spec §4 rule 3)
- Merging `wp/0.7-design-system` creates `frontend/packages/ui-core`: SI-16's domain test fails until its domain-layer
  test exists or the register is changed (KA-063).
- Merging `wp/0.3-platform-kernel` adds libraries under `backend/platform`: SI-03, SI-06, SI-10 and SI-19 trip (their
  `backend/platform` watch knows only arch-rules, state-machine, testing, README.md). Libraries that do not enforce the SI
  go into `known`; the task engine, journal and flags need their domain-layer tests.
- Any new package beside a WP-0.5 machine package in adt, lis, medications, orders, results, scheduling or rcm trips the SIs
  that watch that module.
