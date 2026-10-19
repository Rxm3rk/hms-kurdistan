# Prior partial review output: 00-lead-reviewer (agent ac63b4671d6f7be45), cut off by a usage limit

The lead reviewer ran these checks at adb631c (WSL clone ~/src/hospitalmanagementsystem) before it stopped. They are
its interim observations, recovered from its activity trail by the lead engineer. Treat them as leads to re-verify,
not as conclusions.

Observed results:
- `sh tools/ci/run merge --no-evidence`: exit 1, "FAIL (8 passed, 0 failed, 15 not built; tests=972 ...)". Fails
  closed as designed. `nightly --list` and `release --list` exit 0.
- `sh tools/hms repo check`: PASS; warns that 4 plan-of-record files have CRLF (BUILD-PROMPT.md,
  research/09-…, research/blueprint-drafts/proposal-A…, proposal-C…), left for a human (DN-012).
- `sh tools/hms safety check`: PASS (hazards=27, controls=193, all planned, sis_covered=21, seeded_hazards=15);
  warns: seeded hazards with no hazard entry yet H7, H9, H11, H15; 22 SACs have no hazard entry yet (§18.1).
- `sh tools/hms backlog check`: PASS (234 features, phase counts equal A.18); warns that §21 WP-2.2 names the
  wildcard RCM-* which is not attached to any feature.
- Planted violations: every planted violation tripped its gate, EXCEPT the secret scan: gitleaks caught a planted
  AWS key but did NOT catch a planted GitHub personal access token. (Candidate finding: verify with a fresh plant.)
- HAZ-0005 control numbers (30-minute pharmacist-cover alarm, 4-hour review, ≥4 weeks shadow running, 3-month
  NICU double check, "metric only") all trace to BUILD-PROMPT §10.3/§10.4 and §18.4: nothing invented.
- Sign-off gate: held against three bypasses (filled accepted_by with an untracked matching record; the same record
  in an unsigned commit; a record for a different subject). All three FAIL as required.
- Licence checks per COMMANDS.md §3: shipped 2 components allowed; build-only 124 allowed; licences seen:
  Apache-2.0, BSD-2-Clause, BSD-3-Clause, BlueOak-1.0.0, ISC, MIT, MPL-2.0.
- `backend/gradlew -p backend ...` in the Linux clone: "Permission denied" (exit 126). git stores backend/gradlew,
  tools/hms, tools/doctor, tools/bootstrap, tools/ci/run and tools/host/provision-ubuntu.sh as mode 100644.
  (Candidate finding: the contract and COMMANDS.md call `backend/gradlew` directly.) The 1,000,000-sequence
  property-budget claim was therefore not re-verified; the 1,000-iteration test passed.
- docs/safety/traceability.csv and its generator do not exist; docs/safety/README.md marks it as a placeholder.
  §3.1 says "every build"; it is not in WP-0.1's exit criteria (observation unless you judge otherwise).
- `sh tools/doctor`: exit 1 (18 ok, 2 required missing: RAM and free disk); `--tier fast` exit 0.

The lead's triage of the programme-docs-fidelity candidates (03-*.md), before verification:
- F-01 likely real (tools/host/README.md says "The human who owns the host ran it"; the agent ran it on the human's
  instruction). F-11 (provision script makes system-wide changes not all documented: apt upgrade, global git config
  for the build user, /usr/local/bin symlinks, systemctl enable) to verify. F-14 (stale step lists in tools/README.md
  and frontend/README.md) to verify. F-09 (WP-0.1.md documents a command that fails per COMMANDS.md) to verify.
  F-07 looked by design (hazard entries are per SI; H7/H9/H11/H15 have no SI) → observation. F-08, F-10 minor.
