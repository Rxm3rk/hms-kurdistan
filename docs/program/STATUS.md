# STATUS (updated 2026-10-19 04:09 Asia/Baghdad)
Phase: 0   Work package: WP-0.7 Design system and client shells (stacked on WP-0.1; DN-011, DN-020)
Branch: wp/0.7-design-system @ `1dced55` (slice S1), after the S0 checkpoint `5a9a230`, on top of `05f159a`, the WP-0.1 review-fix commit (the branch was cut from `wp/0.1-programme-bootstrap` and fast-forwarded to `05f159a` before its first commit)
Last green: fast @ d3e14de, WSL build host, no cell (`docs/program/evidence/ci/2026-10-18-fast-d3e14de.json`; WP-0.1's record). No run of record on this branch yet
In-flight slice: none; S0 (`5a9a230`) and S1 (`1dced55`) committed. Next: S2, S3, S4 and S8 in parallel, with S9 and S10
Open review findings: none recorded for WP-0.7. WP-0.1's (`docs/program/reviews/WP-0.1.md`) are tracked in `STATUS.md` on `wp/0.1-programme-bootstrap`
Blocking decisions: DN-005 (lite cell and WP-0.2's failover criterion), DN-011 (merging before the merge tier exists); no WP-0.7 item blocks now (DN-033 blocks WP-0.7's close-out, not its slices)
ID ranges for the stacked branches [P]: WP-0.1 continues from OQ-122, KA-014 and DN-015 only if it needs more; WP-0.2 takes DN-015…DN-019, OQ-122…OQ-139, KA-014…KA-024, HAZ-0028…HAZ-0029 and ADR-030; WP-0.7 takes DN-020…DN-039, OQ-140…OQ-159, KA-025…KA-044 and HAZ-0030…HAZ-0034, and no ADR

## Last session
- Committed, WP-0.7 slice S1, the dependency gate (`1dced55`):
  - 26 exact pins in the pnpm catalog under the §4.1 version rule (OQ-153…OQ-156; ADR-002 lists them, split into shipped and build-only); the lockfile regenerated;
  - package frames for `@hms/ui-core` and `@hms/hal-client` (new), `@hms/design-system` and `@hms/web`, each with a smoke test; `frontend/tsconfig.dom.json`; jsdom and `.tsx` tests in `vitest.shared.ts`; react-hooks rules in `eslint.config.js`; fast-check for `@hms/i18n`;
  - 0BSD, Unicode-3.0 and Zlib on the shipped allowlist (DN-022), with a dated ADR-022 note and a test;
  - DN-033 (open, human lead) and KA-037: isbot 5.2.2 (Unlicense, through TanStack Router) fails the shipped-scope licence check (components=39, unmapped=1); the build-only scope passes (components=280);
  - not in S1: the `apps/shell` package files and the `.expo/`, `android/` and `ios/` ignore lines (slices S9 and S10); the dependency-scorecard rows (DN-020, OQ-104; ADR-002 marks them outstanding for the lead);
  - checked on the Windows host only (not evidence of record): `sh tools/ci/run fast --no-evidence` PASS, 8 of 8 steps, tests=1266, failures=0 (python 674, backend 66, frontend 526). The plan's S1 gate in the WSL build host has not run.
- Built, WP-0.7 slice S0 (specification only; no code exists yet and no test the specifications name has run):
  - `docs/specs/modules/design-system.md` (the module specification; its tests in §9, the message keys in §10);
  - `docs/specs/state-machines/patient-context.yaml` and `.md` (Appendix B.3, version 1; approval requested from cso, physician-panel and nurse-panel, `approved_by` empty, `record: null`; every transition proposed; OQ-149);
  - `docs/specs/hal/` (HAL contract v1: README, `hal-v1.schema.json`, 69 synthetic fixtures; OQ-150).
- Programme entries: DN-020…DN-032, OQ-140…OQ-152, KA-025…KA-036; KA-013 names `patient-context.yaml`. Tightening notes [P] on CTRL-0005-17, CTRL-0016-3, CTRL-0016-6 and CTRL-0016-7, with their rows and open question 10 in `docs/safety/README.md`; every control is still `planned`. PLT-UX-01, PLT-UX-02, PLT-UX-03 and KRI-LOC-01 are `spec` in the backlog. WP-0.7 is in-progress in `WORK-PACKAGES.md`; `work-packages/WP-0.7.md` lists the slices S0…S13.
- Human decisions: DN-021 (the `ckb` and `ar` text: agent drafts marked unreviewed, clinician review before hospital use) and DN-022 (0BSD, Unicode-3.0 and Zlib allowed in shipped code), answered in chat through the question tool by the human lead on 2026-10-18.
- Checked on the Windows host only, against the uncommitted S0 tree on top of `05f159a` (not evidence of record): safety, backlog and repo checks PASS (hazards=27, controls=193, all `planned`; approval_fields_filled=0; status_spec=4); `sh tools/ci/run fast --no-evidence` PASS.
- WP-0.1 at `05f159a`: its pending records of record (R-06, R-07) belong to `wp/0.1-programme-bootstrap`, whose `STATUS.md` tracks them; none is on this branch.

## Next exact step
1. In the WSL clone at `1dced55`: `sh tools/bootstrap && sh tools/ci/run fast` as the WP-0.7 record of record, with the S1 gate (`corepack pnpm install --frozen-lockfile` and `corepack pnpm run fast` in `frontend/`).
2. S2, S3, S4 and S8 in parallel, with S9 and S10 beside them (S10 starts with the DN-025 spike). WP-0.1's later commits reach this branch by merge, never by rebase (§3.6).

## Blocked / waiting on humans
- DN-005: the lite cell (the WSL VM has 10 GB) cannot show WP-0.2's single-node-loss criterion with two PostgreSQL instances.
- DN-011: §3.6 merges a branch only after the merge tier passes, and its last steps arrive in WP-1.12; the default stacks the branches.
- Next: DN-025 (Expo and pnpm settings) before slice S10; DN-033 (isbot under the Unlicense; KA-037) before WP-0.7's close-out (S12); the dependency-scorecard rows for S1's pins (DN-020); DN-023 (Windows shell bundle); DN-024 (Android SDK and macOS; device builds are deferred to WP-3.3); DN-013 (free disk on C:) when WP-0.2 pulls images; DN-014 (the CSO's reading of SI-14's "a measured PPV") before WP-1.5.
- For the CSO [HUMAN], not blocking yet, with the stricter default in use: DN-026…DN-032, the readings of SI-16, SI-01 and SI-05, before WP-1.2, WP-1.4 and WP-1.7 build on them; OQ-141 for the Western digits of CTRL-0005-17; approval of the patient-context machine (OQ-149). Also OQ-120, OQ-121 and KA-013 (a state-machine spec changed without a version bump keeps its approval; WP-0.5).
- Content [HUMAN]: OQ-143 (code-status and isolation vocabularies), OQ-151 (clinician review of the `ckb` and `ar` text, before any hospital use), OQ-152 (the UCUM unit display map).
- Later: DN-007 (Windows Git `core.autocrlf`), DN-008 (Git identity), DN-009 (reference cell), DN-010 (remote, hosted CI, CODEOWNERS handles; also KA-004 and KA-011: until a protected branch exists, verify every listed signer and every trust anchor out of band), DN-012 (four plan-of-record files committed with CRLF).
- Q-K1…Q-K19, the A.20 conflicts, the Appendix A placements and notes (OQ-040…OQ-082, OQ-108…OQ-116), the engineering choices [P] (OQ-094…OQ-100; WP-0.7's: OQ-140…OQ-142, OQ-144…OQ-150, OQ-153…OQ-156), the ADR gaps (OQ-101…OQ-105) and the ADR differences from BP and the C9 reading (OQ-117…OQ-119) wait in `OPEN-QUESTIONS.md`; L-1…L-37 in `ASSUMPTIONS.md`.

## Read next: BUILD-PROMPT top through §3; §2.1 (SI-01, SI-05, SI-16), §4.1, §4.3, §6, §12.8, §13.5, §14.6, §14.7, §18.9 and §21 (WP-0.7); `docs/specs/modules/design-system.md`, `docs/specs/state-machines/patient-context.md`, `docs/specs/hal/README.md`; ADR-002, ADR-019, ADR-022
