# Fast-tier gates fail on planted violations (2026-10-18)

**What this shows.** Each quality gate of the fast tier fails when a violation is planted, and passes again once the violation is removed. A gate that never fails proves nothing (BUILD-PROMPT §3.5, §19.1).

**Where it ran.** The Windows 11 host (Git Bash, project-local toolchain in `.tools/`: Temurin JDK 25.0.4.1, Gradle 9.8.1; Node 24.13.0 with pnpm 12.12.1 through Corepack), on the working tree of branch `wp/0.1-programme-bootstrap` before the first build commit (base `ed023b6`). No cell is involved. Each scratch file was deleted after its run, and `git status` showed none left.

## Backend: `backend/gradlew -p backend fastTier`

| Planted violation (scratch file in `backend/platform/testing/src/`) | Result |
|---|---|
| `main/.../ScratchKtlint.kt`: `fun value( ) : Int = 1` | Failed. With `--continue`, `:platform:testing:ktlintMainSourceSetCheck` reported five findings (`parameter-list-spacing`, `paren-spacing`, `function-signature`, `function-return-type-spacing`, `colon-spacing`), and `:platform:testing:detekt` also failed (`FunctionOnlyReturningConstant`) |
| `main/.../ScratchDetekt.kt`: `fun noop() {}` (ktlint-clean) | Failed: `:platform:testing:detekt` |
| `propertyTest/.../ScratchFailingPropertyTest.kt`: a false property over `Arb.int()` | Failed: `:platform:testing:propertyTest` |
| `main/.../domain/ScratchClock.kt`: domain code calling `Instant.now()` | Failed: `:platform:testing:test` (`ArchitectureTest`: domain code never reads the system clock, §6.2) |
| None (all scratch files removed) | Passed: 66 tests, 0 failures, 0 skipped |

A second run with no changes passed in 5 s (configuration cache reused, every task up to date).

## Frontend: `cd frontend && corepack pnpm run fast`

Planted `packages/i18n/src/ScratchBanner.tsx`:

```tsx
export function ScratchBanner() {
  return (
    <div title="Patient" style={{ marginLeft: 4, textAlign: 'left' }}>
      Hello
    </div>
  );
}
```

and `packages/i18n/src/scratch.css` with `margin-left: 4px` and `float: right`.

| Command | Result |
|---|---|
| `corepack pnpm run lint:es` | Failed with four errors: `hms/no-jsx-literals` on the `title` attribute and on the text "Hello"; `hms/no-physical-css` on `marginLeft` (use `marginInlineStart`) and on `textAlign: left` (use `start`) |
| `corepack pnpm run lint:css` | Failed with two errors: `margin-left` (use `margin-inline-start`) and `float: right` (use `inline-end`) |
| `corepack pnpm run fast` | Failed |
| `corepack pnpm run fast` after removing both files | Passed in 14 s: ESLint, the CSS check, type-checking, 514 Vitest tests (473 in `@hms/eslint-plugin`, 41 in `@hms/i18n`) and the localisation lint (3 catalogues, 4 keys, 12 messages) |

The ESLint rules are also covered by their RuleTester suites (valid and invalid cases for every listed attribute and property), which run in the same `fast` script.

**Note.** Corepack chooses the pnpm version from the `packageManager` field of the `package.json` in the current directory, so run the frontend scripts from `frontend/`. From the repository root, `corepack pnpm --dir frontend run fast` starts Corepack's default pnpm, which stops with `ERR_PNPM_BAD_PM_VERSION`. `tools/ci/run` runs the step from `frontend/`.
