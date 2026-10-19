# WP-0.7 implementation plan: design system and client shells

I checked the workspace, ADR-002/011/019/022, the CI tiers, the hazard log, and the DN, OQ and KA files. I also checked this host. Today the npm registry, crates.io, GitHub and the Playwright CDN all answer from the Windows host. In WSL there is Rust 1.99.1 (minimal profile: no clippy or rustfmt), Node 24.22, the Tauri Linux packages and the main Chromium libraries. There is no Android SDK on either host.

## 0. Before starting
- **Uncommitted work on wp/0.1.** The WP-0.1 review fixes in `tools/hmstools/{bootstrap,doctor,licence,repo}` are not committed. WP-0.7 must branch after that commit.
- **Branch base (DN-A).** `wp/0.2-environments` already holds ADR-029 and `docs/program/dependency-scorecard.md`. The repo check rejects any gap in ADR numbers. So WP-0.7 either stacks on `wp/0.2-environments`, or branches from wp/0.1 and records its own [P] engineering choices as OQ entries, as WP-0.1 did, with no new ADR.

## 1. Slices in build order

**Who changes the lockfiles.** `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `frontend/package.json`, `eslint.config.js`, `vitest.shared.ts`, every `package.json` and the ADR-002 pinned set change only in S1 and in S10's own dependency turn, never at the same time. `Cargo.lock` belongs to S9 only. Programme files (STATUS, KNOWN-ANOMALIES, hazard log, backlog, CHANGELOG) change only in the integrator's checkpoint commits (S0, S12), so parallel slices never edit them.

**Order.**
- S0 → S1 run one after the other.
- Then S2, S3, S4 and S8 run in parallel, with S9 and S10 alongside them.
- S5a and S5b follow S3 and S4, in parallel with each other.
- S6 follows S2 and S5a; S7 follows S6. **The demo milestone is reached here.**
- S11, then S12, come last. S13 comes after WP-0.4.

**S0. Specify and ready** (integrator, runs alone)
- **Files:** `docs/specs/modules/design-system.md`, with the full message-key list; `docs/specs/state-machines/patient-context.yaml` (template B.3, `approval: requested`); `docs/specs/hal/{README.md, hal-v1.schema.json, fixtures/*.json}`; DN, OQ and KA entries; the backlog work packages for PLT-UX-01/02/03 and KRI-LOC-01.
- **Tests:** repo, safety and backlog checks.

**S1. Dependency gate** (runs alone)
- **Deliverable:** resolve the versions; add the catalog entries; create the package files (`package.json`, `tsconfig.json`, `vitest.config.ts`, all scripts, one smoke test each) for `apps/web`, `apps/shell` (JS side), `packages/design-system`, and two new packages, `packages/ui-core` and `packages/hal-client`; add `frontend/tsconfig.dom.json`.
- **Shared config changes:**
  - `vitest.shared.ts` gets options for a jsdom environment and `*.test.tsx` files.
  - `eslint.config.js` adds react-hooks.
  - `.gitignore` adds `test-results/`, `playwright-report/`, `target/`, `.expo/`, `android/` and `ios/`.
  - ADR-002 and the scorecard get their rows.
- **Tests:** `pnpm install --frozen-lockfile` and `pnpm run fast` in WSL; `tools/hms licence check --pnpm` for the shipped scope, with every shipped package in `--filter`, and for the build-only scope.

**S2. i18n** (`packages/i18n/**` only)
- **Deliverable:**
  - `src/pseudo.ts` builds the pseudo-locales in memory. The catalogue lint rejects any catalogue file outside the UI locales, so they cannot be files.
  - `src/ui-intl.ts` gives `ckb-u-nu-latn-ca-gregory` and the same for the other locales.
  - `src/sorani-letters.json` lists the ten letters plus the ي/ی, ك/ک, ه/ە pairs. WP-0.8 reuses it.
  - `src/lint/clinical-keys.ts`: under `banner.*` and `clinical.*`, a ckb or ar value equal to the English one is an error.
  - The catalogues get their new keys.
- **Tests:** `pseudo.property.test.ts` (placeholders preserved, fast-check), `ui-intl.test.ts` (no U+0660–0669 or U+06F0–06F9 digits), `sorani-letters.test.ts`, lint tests.
- **Touches:** H2, KRI-LOC-01.

**S3. ui-core** (no DOM, so the mobile app can share it)
- **Deliverable:**
  - `clinical-number.ts` normalises decimal strings only. It never uses `Number`, so it does no SI-05 arithmetic.
  - `banner-model.ts` holds the Zod schemas. Allergy status is `nka | not-assessed | list`.
  - `patient-context.ts` and `clock.ts`.
- **Tests (names from the hazard log):**
  - `clinical-number-ismp-display-rules` plus property tests (leading zero, no trailing zero, ASCII digits only);
  - `allergy-status-nka-distinct-from-not-assessed` (missing or invalid data never shows NKA);
  - `SI-16-re-verification-at-signing-after-recent-context-change` (property test with a fake clock at 59.999, 60.000 and 60.001 s);
  - `context-switch-requires-confirmation` (CTRL-0016-6).
- **Touches:** SI-01, SI-16, H1, H2.

**S4. Design-system foundation**
- **Deliverable:** tokens as logical CSS with `[data-density]`; `fonts.css`; `LocaleProvider` (sets `html lang` and `dir`; IntlProvider); `Bdi`; `ClinicalNumber` (`<bdi dir="ltr">`); `Modal` with a stack guard; `DensityProvider`.
- **Tests:** `tokens-contrast` (every text/background pair ≥4.5:1); `font-coverage` (cmap of the bundled woff2 has every Sorani letter, every variant and the Western digits); `modal-no-stacking`; `locale-sets-dir-and-lang`.

**S5a. Banner** (`design-system/src/banner/**`)
- **Deliverable:** photo, MRN plus DOB or the approximate-DOB flag, allergies, code status, isolation, dated weight, and the name in the patient's script plus a Latin transliteration.
- **Tests:** `banner-renders-every-field`; `banner-missing-data-visible` (a missing transliteration or photo is shown as missing); `banner-identifiers-never-room-or-bed`; `colour-not-only-carrier`; `bidi-isolation`; long four-part names wrap and are never truncated.
- **Touches:** SI-01, SI-16, H1.

**S5b. Sign/co-sign, command palette, density** (`design-system/src/{sign,command-palette,density}/**`)
- **Tests:** `sign-requires-reverification`; `cosign-same-pattern`; `palette-keyboard-only`; `palette-never-preselects-patient` (Enter with no highlighted item does nothing).

**S6. Web frame and demo route** (`apps/web/{index.html, vite.config.ts, src/**}`)
- **Deliverable:**
  - code-based TanStack routes, where `staticData.clinical` is required by type;
  - a `_clinical` layout that renders the banner;
  - `/demo/banner` with Zod-validated synthetic fixtures and a "NOT FOR CLINICAL USE" watermark, built only when `VITE_HMS_DEMO=1`;
  - the TanStack Query cache keyed by patient and cleared when the patient changes.
- **Tests:** `route-tree.test.ts`, which is `ArchTest:banner-present-on-every-clinical-route`. It also checks that every route declares the clinical flag and that `/demo` is absent from the production route tree.

**S7. E2E harness** (`apps/web/{playwright.config.ts, e2e/**}`; JUnit goes to `frontend/reports/e2e/`, because the fast tier clears `reports/junit`)
- **Specs:**
  - `banner-trilingual-rtl` (en, ckb, ar: `dir`, computed direction, name in script plus Latin, `<bdi>`);
  - `axe` (tags up to `wcag22aa`, zero violations);
  - `visual` (locale × density; baselines `e2e/__screenshots__/linux/`);
  - `pseudo-locale` (hard-coded text, truncation);
  - `targets-24px` (compact density);
  - `glyph-render` (CDP `CSS.getPlatformFontsForNode`: only the bundled font, `isCustomFont`);
  - `digits-western`; `no-external-requests`; `one-patient-context-per-window`; `sign-after-context-change-forces-re-verification`.
- **Evidence:** `docs/program/evidence/screenshots/<date>-banner-rtl-<sha>/`.

**S8. HAL client and printer simulator**
- **Deliverable:**
  - `packages/hal-client/src/{contract.ts, transport-tauri.ts, transport-none.ts, transport-sim.ts}`: every call returns `{ok, value | error, auditId}`. With no shell present, every call returns `unavailable`.
  - `tools/simulators/label-printer/` (Python standard library): a raw port-9100 capture endpoint that stores ZPL or PDF.
- **Tests:** `hal-contract-fixtures`, `no-shell-fails-closed`, `test_printer_capture`.

**S9. Tauri shell** (WSL)
- **Files:** `frontend/apps/shell/{Cargo.toml, Cargo.lock, rust-toolchain.toml, crates/hal-core/**, src-tauri/**}`.
- **Deliverable:**
  - `hal-core` is pure Rust: typed results; UUIDv7 audit IDs; a local audit log with no PHI (H13).
  - Simulated badge reader, printer, scanner, camera, signature and kiosk lock.
  - `hal.id.read` and `hal.pay.request` fail closed (KA) until the WP-1.2 and WP-1.9 simulators exist.
  - Capabilities allow IPC only from the cell's origin.
- **Tests:**
  - `cargo test` for `hal-core`: the JSON fixtures round-trip through serde (the same fixtures `hal-client` tests);
  - a mock-runtime test per HAL command (the full test list is in step 2);
  - `clippy -D warnings` and `fmt --check`.

**S10. Mobile skeleton** (second lockfile turn; `frontend/apps/mobile/**`)
- **Deliverable:** Expo with the New Architecture; nurse and physician modes; a banner built on the ui-core model.
- **Tests:** `modes.test.ts`, `mobile-banner-model.test.ts`, `tsc`, and a smoke `expo export --platform android` run with `EXPO_OFFLINE=1` and `EXPO_NO_TELEMETRY=1`.
- **Spike first:** whether pnpm's isolated linker and strict peers work with Metro.

**S11. CI and tools wiring** (runs alone)
- **Files:** `tools/hmstools/ci/{tiers.py, counts.py, tests/test_ci.py}` (with a parser for cargo's test summary); a `bootstrap playwright` step (browsers into `.tools/ms-playwright`); a cargo-metadata input for the licence check; `COMMANDS.md`; the READMEs.
- **Steps that become real:** merge `e2e-smoke`, `axe` and `rtl-visual-diffs`; nightly `e2e-full`; a new fast step `shell-fast`; release `desktop-shell` (Linux `.deb`).
- **Steps that stay NOT-BUILT [HUMAN]:** the Windows shell bundle and `mobile-builds`.

**S12. Close-out**
- **Deliverable:** hazard log `implemented_in` and `verified_by` for CTRL-0016-3/4/5/6/7 and CTRL-0005-17; KA entries; trilingual help text; the merge and nightly records in WSL; reviewer handover.

**S13 (after WP-0.4).** `badge-tap-switch.spec.ts` measures simulated reader → shell → Keycloak step-up → session swap, and must show ≤2 s.

## 2. Tests and evidence

**Tests by slice**

| Test | Slice | Where it runs |
|---|---|---|
| Unit tests (Vitest; jsdom for components) | S2–S6, S8, S10 | fast tier (`frontend-fast`) |
| Property tests (fast-check) | S2 pseudo-locales; S3 `ClinicalNumber` and the 60 s re-verification | fast tier |
| Glyph coverage, cmap level (`font-coverage`) | S4 | fast tier |
| Glyph coverage, rendered (`glyph-render`, CDP) | S7 | merge tier |
| Rust: `cargo test` (fixture round-trip, simulated devices), `clippy -D warnings`, `fmt --check` | S9 | fast tier (`shell-fast`) |
| Tauri mock-runtime command tests | S9 | `shell-fast` |
| Playwright functional and smoke (en, ckb, ar) | S7 | merge tier (`e2e-smoke`) |
| axe, tags up to `wcag22aa`, zero violations | S7 | merge tier (`axe`) |
| RTL visual diffs (Linux baselines) | S7 | merge tier (`rtl-visual-diffs`) |
| Full Playwright suite | S7 | nightly tier (`e2e-full`) |

**Tauri mock-runtime tests (S9).** There is one test per HAL call: `hal.print.label`, `hal.print.raw`, `hal.print.document`, `hal.scan.onBarcode`, `hal.scan.document`, `hal.id.read`, `hal.auth.onBadge`, `hal.sign.capture`, `hal.pay.request`, `hal.camera.photo`, `hal.kiosk.lock` and `hal.capabilities`. Each checks a typed result and an audit ID; `hal.id.read` and `hal.pay.request` must return `unavailable`.

**Evidence.** The merge and nightly records under `docs/program/evidence/ci/` (the merge tier still fails overall until other work packages build their steps, but the WP-0.7 steps show PASS); the screenshot sets under `docs/program/evidence/screenshots/`; the licence-check outputs; a `.deb` build log.

**Not built in WP-0.7.** Two SI-16 parts stay planned, each with a KA entry: server-side refusal to sign without re-verification (CTRL-0016-7) comes with the first sign command; mobile and print banner tests need Maestro and WP-0.8.

## 3. New dependencies
None is pinned yet. **How to choose each version (§4.1):** take the newest generally available release that has had at least one patch release, whose version fits the peer ranges of the packages that depend on it, and that meets the stated minimum (Tauri **2**; React Native with the New Architecture; Node 24; TypeScript 6.0.3, which typescript-eslint caps below 6.1; Vite 8.3.4). Pin it exactly and record it in ADR-002 and the scorecard. Check with `pnpm view <pkg> time peerDependencies` and `cargo info`. **Network (§3.7):** the npm registry and crates.io are allowed and reachable today. The Playwright CDN is the vendor's official download, which I read as allowed. Expo network calls, telemetry and EAS cloud builds are not allowed.

- **Pick Expo first.** Its React Native version pins React, and with strict peers that sets the workspace's React. A named catalog is the fallback if web and mobile need different versions.

| Dependency | Licence | Ships? |
|---|---|---|
| react, react-dom, @tanstack/react-router, @tanstack/react-query, react-intl and the @formatjs packages, zod | MIT | shipped |
| react-aria-components and its @react-aria, @react-stately and @internationalized packages | Apache-2.0 | shipped |
| @tauri-apps/api; crates `tauri`, `serde`, `serde_json`, `uuid`, `thiserror` | MIT OR Apache-2.0 | shipped |
| expo, react-native, Hermes | MIT | shipped |
| @fontsource/noto-sans-arabic and noto-sans (or Vazirmatn) | OFL-1.1 | shipped; the glyph tests decide the family |
| @vitejs/plugin-react, jsdom, @testing-library/*, fast-check, eslint-plugin-react-hooks, fontkit | MIT | build-only |
| @tauri-apps/cli | MIT OR Apache-2.0 | build-only |
| @playwright/test and its browsers | Apache-2.0; Chromium BSD-3-Clause | build-only |
| axe-core, @axe-core/playwright | MPL-2.0 | build-only |

## 4. What this host can and cannot do

**Windows checkout:** editing, `pnpm run fast`, Playwright functional and axe runs, the Expo export. These runs are not evidence of record.

**WSL clone (gates of record):**
- everything above, plus the visual baselines;
- the cargo tests, clippy and fmt (`rust-toolchain.toml` adds clippy and rustfmt through rustup, in `~/.rustup`, outside the repository);
- `tauri build --bundles deb`;
- a WSLg screenshot of the shell (indicative only).

If Chromium reports a missing library, the `apt` line goes into a DN for the human.

**Has to wait:**
- the badge tap, which needs WP-0.4, which needs WP-0.3 and WP-0.2;
- the Windows bundle (Windows Rust and MSVC toolchain, WebView2 terms) [HUMAN];
- the Android SDK and Maestro, and iOS on macOS [HUMAN];
- physical printers and readers (S7-K).

## 5. Demo route first
The fastest way to a working screen is S0 → S1 → (S2, S3, S4 in parallel) → S5a → S6 → S7. Then `corepack pnpm --filter @hms/web dev` serves `/demo/banner?locale=ckb`. `banner-trilingual-rtl`, `axe` and `visual` must pass in WSL, and the screenshots are stored. That covers the first three exit criteria; S13 covers the fourth.

## 6. Decisions and conflicts

**For DECISIONS-NEEDED:**
- **A. Branch base and ID allocation** (section 0).
- **B. ckb and ar text for the banner and UI.** `packages/i18n/README.md` forbids invented or machine translation, but the WP needs three languages. Default: the human supplies the text; until then the screens use marked synthetic text, and the "three languages" evidence is blocked.
- **C. Licences not on the shipped allowlist.** These are likely in the dependency trees: 0BSD (tslib), Unicode-3.0 (unicode-ident; ICU4X through `url`/`idna`) and Zlib (foldhash). Adding any of them is stop-and-ask item 2.
- **D. Windows packaging** of the shell.
- **E. Android SDK and macOS** for device builds.
- **F. Expo and pnpm.** If Expo needs `nodeLinker: hoisted` or looser peers, that changes a setting for the whole workspace.

**For OPEN-QUESTIONS:**
- "Within 60 s" is read as inclusive (the stricter reading).
- Two new packages beyond §6.1: `ui-core` and `hal-client`.
- Every UI number uses Western digits (a recorded tightening of §6.5).
- The demo route is left out of production builds.
- Code-status and isolation vocabularies are clinical content: synthetic values plus a content request.
- The API-client generator waits for WP-0.4.
- `shell-fast` will fail on the Windows checkout, which has no Rust.
- Changing language on mobile needs an app restart.
- The HAL audit log stays local until WP-0.4.
- One font family is shared with WP-0.8.

**Conflicts between the plan of record and the existing workspace:**
- `vitest.shared.ts` runs only `.ts` tests in a node environment.
- `tsconfig.base.json` uses `nodenext` with no DOM library.
- The localisation lint rejects pseudo-locale catalogue files.
- The fast tier clears `reports/junit`, so Playwright must report elsewhere.
- `apps/shell/README.md` still says Rust is a [HUMAN] item, but DN-004 is closed.
- WP-0.8 repeats the font-coverage test.
- WP-0.7 cannot close until WP-0.4 brings the badge flow.

### Critical Files for Implementation
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\frontend\pnpm-workspace.yaml
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\frontend\vitest.shared.ts
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\frontend\packages\i18n\src\lint\catalogue-lint.ts
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\tools\hmstools\ci\tiers.py
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\docs\safety\hazard-log.yaml
