# @hms/design-system

The one design system, built on React Aria Components (`PLT-UX-01`; BUILD-PROMPT.md §6.5, §14.2, §14.7). The
specification is `docs/specs/modules/design-system.md`. Its strings come only from `@hms/i18n`
(`hms/no-jsx-literals`), its CSS uses logical properties only (`hms/no-physical-css` and the stylesheet
check), and its DOM-free logic (number display, the banner model, the patient context) lives in
`@hms/ui-core`.

## Foundation (WP-0.7 slice S4)

| Export                                          | What it does                                                                                                                                                  | Spec                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `styles.css`                                    | Import once at the application root: `fonts.css`, `tokens.css`, `base.css`                                                                                    | §3                         |
| `fonts.css`                                     | Noto Sans (`latin`, `latin-ext`) and Noto Sans Arabic (`arabic`), weights 400 and 700, woff2 from the Fontsource packages, bundled by Vite (no network)       | §3, OQ-148, OQ-156, OQ-160 |
| `tokens.css`                                    | Colour, type, spacing and target tokens; spacing, type and targets change under `[data-density]` on `<html>`                                                  | §2.5                       |
| `LocaleProvider`                                | Sets `lang` and `dir` on `<html>`; supplies react-intl and React Aria with the `ui-intl` locale (Western digits, Gregorian calendar) and the catalogue        | §2.9                       |
| `DensityProvider`, `useDensity`                 | Sets `data-density` (`comfortable` or `compact`) on `<html>`; stores it per user on the device                                                                | §2.5                       |
| `Bdi`                                           | `<bdi>` with `unicode-bidi: isolate`, an explicit `dir` and the value's `lang`                                                                                | §2.7                       |
| `ClinicalNumber`                                | A clinical numeral, and its unit, in `<bdi dir="ltr">`, from ui-core's display form; "Invalid value" and "Not recorded" otherwise                             | §2.6                       |
| `Modal`, `ModalStackProvider`, `useIsModalOpen` | The React Aria modal behind the window's stack guard: a second modal is refused (it throws in development and tests; in production it is announced and shown) | §2.8                       |
| `windowModalStackGuard`                         | The window's one guard, without React; a HAL capture holds it as a modal does, with an owner object of its own; only the holder's token releases it           | §2.8                       |
| `Message`                                       | A catalogue message in JSX; a key missing at run time shows as the key in a visible error style                                                               | §2.9                       |
| `messageKey`                                    | Types a message id as a key of the `en` catalogue                                                                                                             | §2.9                       |

An application wraps its tree as `LocaleProvider` → `DensityProvider` → `ModalStackProvider` (the
provider's live region needs the catalogue).

Tests import `@hms/design-system/testing` for a guard of their own (`createModalStackGuard`, in either refusal
mode) and `ModalStackTestProvider`. Both throw in production builds, so an application has one guard per
window.

## Patient banner (WP-0.7 slice S5a)

| Export                             | What it does                                                                                                                                                                                                                                                                                                                                                              | Spec         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `PatientBanner`                    | The one patient banner: identity, allergies (NKA, not assessed, unavailable or every item whole), code status, isolation and the dated weight with its source, through `ClinicalNumber`; an error state that still renders every field; `data-error-state`, `data-signing-blocked` and `data-identity-incomplete` from ui-core's banner model; an optional `actions` slot | §2.1, OQ-161 |
| `PatientIdentity`                  | The photo, every name form (own script first, each labelled, a missing form shown as missing), the MRN, the date of birth at its precision with the approximate-DOB flag and "Identity incomplete"; reused by the switch confirmation, the re-verification step, the palette and the chooser                                                                              | §2.1, §2.2   |
| `PatientPhoto`                     | The photo with its alt text, or "No photo" when it is absent, invalid or fails to load                                                                                                                                                                                                                                                                                    | §2.1         |
| `BannerStatus`, `BANNER_STATUSES`  | Each banner status with its own text, icon shape and tone, so colour is never the only carrier                                                                                                                                                                                                                                                                            | §2.1, §6.5   |
| `StatusIcon`, `ICON_SHAPES`        | Inline SVG icons, `aria-hidden`, never mirrored, with outlines distinct within a field                                                                                                                                                                                                                                                                                    | §2.1         |
| `GovernedLabel`, `useBannerLocale` | A governed label isolated with its own `lang` and `dir`, with "Not translated" when it falls back to another locale                                                                                                                                                                                                                                                       | §2.1 rule 6  |

The banner's stylesheet is `banner/banner.css`, imported by `styles.css`: logical properties and tokens only,
and nothing that cuts text (no ellipsis, line clamp, fixed height, hidden overflow or `nowrap`).

## Sign and co-sign, command palette and density control (WP-0.7 slice S5b)

| Export                                                                   | What it does                                                                                                                                                                                                                                                                          | Spec         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `SignDialog`                                                             | A view of ui-core's patient-context machine: review, then re-verification or authentication, then the intent statement with Sign or Co-sign; it sends only the machine's events; a timeout, an error or a malformed answer is outcome unknown, and a retry reuses the idempotency key | §2.3, OQ-162 |
| `SignButton`, `signingIdentityValid`                                     | Opens a sign session; disabled, with `sign.blockedByBanner`, while the banner identity blocks signing                                                                                                                                                                                 | §2.3         |
| `createSimulatedAuthenticator`                                           | The simulated sign-in and badge tap plus PIN of WP-0.7 (KA-032); it throws in a production build unless `VITE_HMS_DEMO=1`                                                                                                                                                             | §2.3, KA-043 |
| `CommandPalette`, `isPaletteShortcut`                                    | Ctrl+K or Cmd+K (physical key); React Aria `Autocomplete` and `Menu`; nothing is highlighted on open or on new results; a chosen item runs after the palette has closed                                                                                                               | §2.4         |
| `languageCommands`, `foldForSearch`, `matchesQuery`, `patientSearchText` | Palette commands and search (ي→ی, ك→ک, ه→ە folded for matching only)                                                                                                                                                                                                                  | §2.4         |
| `DensityControl`, `useDensityCommand`, `otherDensity`                    | The density setting as a radio group, and its palette command, on `DensityProvider`                                                                                                                                                                                                   | §2.5         |

Their stylesheets (`sign/sign.css`, `command-palette/command-palette.css`, `density/density-control.css`) are
imported by `styles.css`.

## Tests

`pnpm --filter @hms/design-system test` (Vitest; jsdom for components, Node for the font and token files):

- `UnitTest:tokens-contrast`: every text and background token pair of `tokens.css` reaches 4.5:1 in both
  densities, neutral text on the status surfaces included, and borders 3:1; one of the two focus rings reaches
  3:1 on every surface, the accent one included; only the accent text sits on the accent surface in any
  stylesheet of the package; a colour token without a role fails.
- `UnitTest:font-coverage`: for every Sorani letter, the ي/ی, ك/ک and ه/ە forms, the Western digits, the Sorani
  and Arabic alphabets and the Kurdish Latin letters, the woff2 the browser would choose from `fonts.css` has
  the glyph in its cmap; every Sorani letter takes its joined forms. It also pins KA-038 (U+202F).
- `UnitTest:modal-no-stacking`: a second modal is refused while one is open, in development and in production
  mode, never queued, and while a HAL capture holds the guard; the refusal is exposed to assistive technology
  while the modal hides the page, and shown on screen; the guard cannot be split, released by another holder
  or matched by label.
- `UnitTest:locale-sets-dir-and-lang`: `<html>` gets `lang` and `dir` for `en`, `ckb` and `ar` and updates on
  change.
- `clinical-number.test.tsx`, `density-provider.test.tsx` and `message.test.tsx` cover `ClinicalNumber`, `Bdi`,
  `DensityProvider` and `Message` in the DOM.
- `test/banner/` (slice S5a): `UnitTest:banner-renders-every-field`, `UnitTest:banner-missing-data-visible`,
  `UnitTest:banner-identifiers-never-room-or-bed`, `UnitTest:colour-not-only-carrier`, `UnitTest:bidi-isolation`
  and `UnitTest:banner-long-names-wrap` (its unit part; jsdom has no layout, so the narrowest width is checked
  in `E2E:visual` and `E2E:pseudo-locale`).
- `test/sign/`, `test/command-palette/` and `test/density/` (slice S5b): `UnitTest:sign-requires-reverification`,
  `UnitTest:cosign-same-pattern`, `UnitTest:sign-outcome-unknown-reuses-idempotency-key`,
  `UnitTest:palette-keyboard-only`, `UnitTest:palette-never-preselects-patient`,
  `UnitTest:palette-selects-patient-via-confirmation`; also the simulated-authenticator and density-control
  tests.

Rendering in a real browser (computed direction, the fonts actually used, axe, screenshots) is tested with
Playwright in `apps/web` (slice S7), not here.

## Known limits

- U+202F, the group separator of `ClinicalNumber`, is drawn with a system font (KA-038).
- A message key missing at run time shows in the error style only through `Message`; in string-only text (an
  `aria-label`, say) it shows as plain text (KA-039).
- A dialog built on `react-aria-components` directly, outside this package, bypasses the stack guard; no lint
  forbids it yet (KA-042).
- The sign dialog's authentication step reuses other keys and is simulated until WP-0.4 (KA-032, KA-043).
