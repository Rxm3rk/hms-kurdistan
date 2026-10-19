# packages/hal-client

The typed client for the workstation shell's hardware abstraction layer, HAL contract v1 (WP-0.7, open questions
OQ-140 and OQ-150; BUILD-PROMPT.md §12.8). The contract is `docs/specs/hal/`: every call returns
`{ok, value | error, auditId}`. Slice S8 builds `contract.ts` and three transports: Tauri (the shell, through
`@tauri-apps/api`), none (no shell: every call returns `unavailable` / `no-shell`) and a simulator for tests.
Slice S1 created the package with a smoke test.

Tests run with Vitest: `corepack pnpm --filter @hms/hal-client test`. Ajv validates the fixtures in
`docs/specs/hal/fixtures/` against `hal-v1.schema.json` itself.
