All counts are exactly as printed. Windows host runs are on the uncommitted tree. WSL runs used the WSL clone's venv but read the Windows checkout under /mnt/c, so they are not at a committed SHA. Nothing here is evidence of record.

WINDOWS HOST
- Whole suite, `.tools/venv/Scripts/python.exe -I -m unittest discover -s tools -t tools -p "test_*.py"`: "Ran 673 tests in 185.901s" "OK". The count includes the untracked test files. It ran before my last edit, which only changed the signoffs.py module docstring.
- Per area, after the edits:
  - test_signoff_gate.py: "Ran 94 tests in 34.542s OK" (was 68)
  - GpgSignedRecordTest: "Ran 17 tests in 30.602s OK" (was 15)
  - test_git_authentication.py: "Ran 85 tests in 1.588s OK"
  - licence: "Ran 64 tests in 0.629s OK" (was 61)
  - repo: "Ran 72 tests in 17.272s OK"
  - test_seeded_content.py: "Ran 10 tests in 0.049s OK"
- One intermediate safety-suite run, "Ran 310 tests in 138.803s FAILED (failures=1)", failed only because `test_seeded_content` pins the words "recorded as a tightening [P] (§3.4 item 1)". I reworded the CTRL-0014-4 notes to keep those words and extended the test. The whole-suite run above includes the fix.
- `sh tools/hms safety check`: exit 0, "safety: PASS (hazards=27, controls=193, controls_planned=193, controls_implemented=0, controls_verified=0, sis_covered=21, seeded_hazards=15, sensitivity_label_entries=6, sacs_referenced=31, feature_ids_known=234, feature_source_backlog_yaml=1, signoff_records=0, allowed_signers=0, state_machine_specs=0, approval_fields_filled=0)". 4 warnings: H7/H9/H11/H15; the 22 SACs; allowed-signers.yaml uncommitted; no trusted signer (KA-011).
- `sh tools/hms repo check`: exit 0, "repo: PASS (text_files_checked=354, binary_files_skipped=3, crlf_files=0, crlf_plan_of_record=4, required_files_present=11, adrs_total=28, adrs_valid=28, tenant_files_scanned=132, tenant_matches=0, branches=4, blocking_now_items=2, status_lines=37, executables_checked=6)".
- `sh tools/hms backlog check`: exit 0, "backlog: PASS (hazard_log_entries=27, features_with_hazards=101, hazard_links=237, rows=236, features=234, part_rows=2, ..., wp_references_not_mapped=1)". 1 warning (the WP-2.2 RCM-* wildcard).
- Secret scan as the fast tier runs it, `sh tools/ci/run fast --only secret-scan --no-evidence`: "[1/1] secret-scan: PASS (2.5 s) history_findings=0, working_tree_findings=0", then "tools/ci/run fast: PARTIAL (1 passed, ...)", exit 3 (the designed exit code for an `--only` run).
- Also run:
  - `sh tools/bootstrap jdk`: "reusing .tools/jdk-25.0.4.1+1 (... the pinned release)", exit 0.
  - `sh tools/doctor --tier fast`: "doctor: PASS (5 ok, 0 required missing, 0 warnings)".
  - Frontend licence checks: "licence: PASS (components=2, allowed=2, ...)" and "licence: PASS (components=124, allowed=124, ...)" (build-only scope).
  - The reviewer's licence files: reg-dot.yaml and reg-list.yaml now FAIL with exit 1, and print no traceback.
  - The reviewer's probes now all fail as they should.

WSL UBUNTU-24.04
- Safety tests (final run, after every edit; the gpg and ssh-keygen tests run here): "Ran 310 tests in 89.283s" "OK". An earlier run gave "Ran 310 tests in 86.891s OK".
- `python -I tools/hms.py safety check`: PASS, same counts as on Windows.
- repo: "Ran 72 tests in 2.594s OK". licence: "Ran 64 tests in 1.451s OK".
- gpg clock check with `--faked-system-time`, 30 s before key creation:
  - with no option: "was created 30 seconds in the future ... Unusable secret key", rc=2;
  - with `ignore-time-conflict` in gpg.conf: rc=0, "[GNUPG:] GOODSIG", "TRUST_ULTIMATE".

NOT RUN BY ME
- The fast, nightly or gates-bite tiers in a WSL clone.
- Any record of record.