All runs were on the Windows host, in the worktree `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\wp07`, after the last edit. They are not evidence of record (KA-001).

**$ sh tools/hms repo check: PASS, EXIT=0**
- `repo: PASS (text_files_checked=416, binary_files_skipped=3, crlf_files=0, crlf_plan_of_record=4, required_files_present=11, adrs_total=28, adrs_valid=28, tenant_files_scanned=132, tenant_matches=0, branches=4, blocking_now_items=2, status_lines=29)`
- The only warnings are the four existing CRLF warnings for plan-of-record files (BUILD-PROMPT.md and three research files; DN-012).

**$ sh tools/hms safety check: PASS, EXIT=0**
- `safety: PASS (hazards=27, controls=193, controls_planned=193, controls_implemented=0, controls_verified=0, sis_covered=21, seeded_hazards=15, sensitivity_label_entries=6, sacs_referenced=31, feature_ids_known=234, feature_source_backlog_yaml=1, signoff_records=0, state_machine_specs=1, approval_fields_filled=0)`
- The warnings are the existing ones: H7/H9/H11/H15 have no hazard entry, and 22 SACs have none (KA-008).
- This check only counts the state-machine spec and scans its approval fields (0 filled). It does not validate the machine's structure.
- It ran against the worktree's committed hazard log, not the main checkout's uncommitted WP-0.1 fixes.

**HAL fixtures against the schema**
- The README's one-line command (`.tools/venv/Scripts/python.exe -I -c ...`; it checks the schema, every fixture, the response/audit `auditId` match and the event audit IDs) printed `all 69 fixtures valid`, EXIT=0.
- Scratch checker `C:\Users\Surface\AppData\Local\Temp\hms-wp07\s0fix\check_hal.py`, EXIT=0:
  - `check_schema` passes; 69 fixtures with 0 errors, covering all 12 calls;
  - every fixture name matches its file name;
  - all five README cross-checks pass, and no audit ID repeats across the fixtures;
  - 36 deliberately broken copies, all rejected. They include the reviewers' three mutations (an ok response with an error audit record, a mismatched event subscriptionId, a print call's audit record with `event: badge-tap`), a raw badge `credential`, a print timeout marked retryable, a fixture suffix that names the wrong reason, `no-shell` written by the shell, and `eventAudits` on a call that is not a subscription.

**State machine.** Scratch script `check_machine.py` printed `states=7 predicates=21 transitions=24 pairs=20` and `machine structure OK`, EXIT=0. It checks that:
- the top-level keys are exactly the Appendix B.3 keys;
- the approval block reads `requested` with `approved_by` empty and `record: null`;
- every guard predicate is defined and every predicate is used;
- the drawn from→to pairs equal `proposed`;
- no (state, event) pair can reach two different targets under any assignment of the predicates.

**Other runs**
- `sh tools/hms backlog check`: PASS (rows=236 … status_todo=234), with the existing warning about the wildcard RCM-* (§21 WP-2.2), EXIT=0.
- `.tools/bin/gitleaks.exe dir docs/specs`: "no leaks found", EXIT=0. The synthetic `stepUpRef` is the low-entropy value `SYN-STEPUP-0000000000000001`.
- Node `Intl`: confirmed the canonical locale tags and the Arabic plural categories (60 falls in `many`).
- No CRLF in the four edited files.
- The §10 key table now has 121 unique keys.

**Not run**
- The Python tool tests (I changed no tool code).
- The fast tier (`frontend-fast`, `backend-fast`).