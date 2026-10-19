import io, sys
p = sys.argv[1]
s = io.open(p, encoding="utf-8", newline="").read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old[:60]
    s = s.replace(old, new)
rep("# STATUS (updated 2026-10-19 03:15 Asia/Baghdad)", "# STATUS (updated 2026-10-19 04:09 Asia/Baghdad)")
rep("Branch: wp/0.7-design-system @ the S0 checkpoint commit on top of `05f159a`,",
    "Branch: wp/0.7-design-system @ `1dced55` (slice S1), after the S0 checkpoint `5a9a230`, on top of `05f159a`,")
rep("In-flight slice: WP-0.7 S0 (specification): spec",
    "In-flight slice: none; S0 (`5a9a230`) and S1 (`1dced55`) committed. Next: S2, S3, S4 and S8 in parallel, with S9 and S10")
rep("no WP-0.7 item blocks now", "no WP-0.7 item blocks now (DN-033 blocks WP-0.7's close-out, not its slices)")
rep("""## Last session
- Built, WP-0.7 slice S0""", """## Last session
- Committed, WP-0.7 slice S1, the dependency gate (`1dced55`):
  - 26 exact pins in the pnpm catalog under the §4.1 version rule (OQ-153…OQ-156; ADR-002 lists them, split into shipped and build-only); the lockfile regenerated;
  - package frames for `@hms/ui-core` and `@hms/hal-client` (new), `@hms/design-system` and `@hms/web`, each with a smoke test; `frontend/tsconfig.dom.json`; jsdom and `.tsx` tests in `vitest.shared.ts`; react-hooks rules in `eslint.config.js`; fast-check for `@hms/i18n`;
  - 0BSD, Unicode-3.0 and Zlib on the shipped allowlist (DN-022), with a dated ADR-022 note and a test;
  - DN-033 (open, human lead) and KA-037: isbot 5.2.2 (Unlicense, through TanStack Router) fails the shipped-scope licence check (components=39, unmapped=1); the build-only scope passes (components=280);
  - not in S1: the `apps/shell` package files and the `.expo/`, `android/` and `ios/` ignore lines (slices S9 and S10); the dependency-scorecard rows (DN-020, OQ-104; ADR-002 marks them outstanding for the lead);
  - checked on the Windows host only (not evidence of record): `sh tools/ci/run fast --no-evidence` PASS, 8 of 8 steps, tests=1266, failures=0 (python 674, backend 66, frontend 526). The plan's S1 gate in the WSL build host has not run.
- Built, WP-0.7 slice S0""")
rep("""1. In the WSL clone at the S0 checkpoint commit: `sh tools/bootstrap && sh tools/ci/run fast` as the WP-0.7 record of record.
2. Slice S1, the dependency gate (`work-packages/WP-0.7.md`): resolve the versions; the catalog entries and package files for `apps/web`, `apps/shell`, `packages/design-system`, `packages/ui-core` and `packages/hal-client` (OQ-140); the ADR-002 rows; 0BSD, Unicode-3.0 and Zlib in the licence policy (DN-022); the licence checks for the shipped and build-only scopes.
3. Then S2, S3, S4 and S8 in parallel,""",
"""1. In the WSL clone at `1dced55`: `sh tools/bootstrap && sh tools/ci/run fast` as the WP-0.7 record of record, with the S1 gate (`corepack pnpm install --frozen-lockfile` and `corepack pnpm run fast` in `frontend/`).
2. S2, S3, S4 and S8 in parallel,""")
rep("- Next: DN-025 (Expo and pnpm settings) before slice S10;",
    "- Next: DN-025 (Expo and pnpm settings) before slice S10; DN-033 (isbot under the Unlicense; KA-037) before WP-0.7's close-out (S12); the dependency-scorecard rows for S1's pins (DN-020);")
rep("(OQ-094…OQ-100; WP-0.7's: OQ-140…OQ-142, OQ-144…OQ-150)", "(OQ-094…OQ-100; WP-0.7's: OQ-140…OQ-142, OQ-144…OQ-150, OQ-153…OQ-156)")
io.open(p, "w", encoding="utf-8", newline="").write(s)
print("ok")
