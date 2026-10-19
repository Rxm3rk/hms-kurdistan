# packages/ui-core

DOM-free client logic that the web app and the mobile app share (WP-0.7, open question OQ-140;
`docs/specs/modules/design-system.md` §1). `src` may use ECMAScript and its own imports only: `tsconfig.src.json`
type-checks it with no ambient types (no DOM library, no Node.js types), so code that touches the DOM, Node.js or a
Web API such as `crypto` fails to type-check. `tsconfig.json` adds the tests, which run in Node.js, with Node types;
`corepack pnpm --filter @hms/ui-core typecheck` runs both (OQ-158). Slice S1 created the package; slice S3 built:

- `src/clinical-number.ts` (SI-05; design-system §2.6; CTRL-0005-17): `formatClinicalNumber` and
  `formatClinicalQuantity` normalise a decimal string for display (a leading zero, no trailing zero, one form of
  zero, U+202F grouping per DN-031) and work on characters only: no conversion to a number, no arithmetic, no
  rounding. Units go through a display map; `SYNTHETIC_UNIT_DISPLAY_MAP` is a synthetic sample, NOT FOR CLINICAL
  USE (OQ-152, KA-036).
- `src/banner-model.ts` (SI-16, SI-01; design-system §2.1): `parseBannerData` parses untrusted banner data field by
  field with strict Zod schemas into a `BannerModel` whose fields each carry their own missing or unavailable
  state. It first copies the input into plain data (own data properties only, objects with no prototype), so an
  inherited or polluted property never supplies a value at any depth. Allergy status is `nka`, `not-assessed`, `list` or `unavailable`, and bad data never gives `nka`. The
  model has no location field. `errorState` and `signingBlocked` feed the patient-context predicates (DN-032).
  `SYNTHETIC_BANNER_VOCABULARIES` holds synthetic code-status and isolation codes, NOT FOR CLINICAL USE (OQ-143).
- `src/patient-context.ts` (SI-16 clauses e and f; CTRL-0016-6, CTRL-0016-7 client part): the machine of
  `docs/specs/state-machines/patient-context.yaml`. `TRANSITIONS` restates the YAML's transitions one for one and
  `PREDICATES` implements each named predicate once; `transition(snapshot, event, deps)` is pure apart from reading
  the injected clock and the window's modal state. The app injects the idempotency key source; ui-core has no
  default. The server-side context and sign refusal are not built (KA-025).
- `src/clock.ts`: the injectable `Clock` (monotonic time for the 60 s window, wall time only to stamp the sign
  command), `systemClock` and `FakeClock`. An unreadable clock reads as `undefined`, which the machine treats as
  within the window (fail closed, DN-026).

Engineering choices made here are open question OQ-158; known limitations are in `docs/program/KNOWN-ANOMALIES.md`.

## Tests

Vitest in the node environment: `corepack pnpm --filter @hms/ui-core test`. The test names follow
design-system §9: `UnitTest:clinical-number-ismp-display-rules`, `PropertyTest:clinical-number-*`,
`StaticAnalysis:clinical-number-no-arithmetic`, `UnitTest:allergy-status-nka-distinct-from-not-assessed`,
`PropertyTest:SI-16-re-verification-at-signing-after-recent-context-change` and
`UnitTest:context-switch-requires-confirmation`. `test/patient-context.test.ts` also reads the YAML and fails when
the states, predicates or transitions differ from it, or when two transitions to different states can be enabled
together. The SI-16 property drives random event sequences against a hand-written model that predicts every
result (state, patient, context change, re-verifier, sign command) from the events and the fake clock alone; it is
written by hand until WP-0.5's generator exists, and the generated model must pass the same tests. Test data is synthetic (`test/fixtures.ts`).
