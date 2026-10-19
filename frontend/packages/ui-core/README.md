# packages/ui-core

DOM-free client logic that the web app and the mobile app share (WP-0.7, open question OQ-140;
`docs/specs/modules/design-system.md` §1): `clinical-number.ts` (number display, SI-05), `banner-model.ts` (Zod
schemas for the banner data, SI-16 and SI-01), `patient-context.ts` (the machine in
`docs/specs/state-machines/patient-context.yaml`) and `clock.ts` (a monotonic clock that tests replace). Slice S3
builds them; slice S1 created the package with a smoke test.

It extends `tsconfig.base.json`, which has no DOM library, so code that touches the DOM fails to type-check here.
Tests run with Vitest in the node environment: `corepack pnpm --filter @hms/ui-core test`.
