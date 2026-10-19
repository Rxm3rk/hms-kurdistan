# packages/api-client (placeholder)

TypeScript clients generated from the contract-first OpenAPI 3.1 specifications in `docs/specs/api/` land
here (BUILD-PROMPT.md §6.3). They are generated, never written by hand, and follow the API conventions: an
`Idempotency-Key` on every state-changing request and cursor-based pagination (§6.3), with RFC 9457 problem
details for errors (§6.2). No work package names the generator. It is first needed when the web client calls
a module BFF, which in the plan is the badge sign-in flow of WP-0.7 on the Trust Plane of WP-0.4. Every later
work package that changes an API regenerates its client.
