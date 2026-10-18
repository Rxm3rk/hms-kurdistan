# Licence policy and checks

The licence and dependency policy of BUILD-PROMPT.md §4.3 (ADR-022), as data and checks.

| File | What it is |
|---|---|
| `policy.yaml` | The policy as data: scopes (shipped, build-only), the allowlist, the conditional list, the denylist, the named exclusions, the build-only list [P] and licence-name aliases |
| `register.yaml` | The licence register: one entry per component used under a conditional rule. It records facts, never an approval |
| `ort/license-classifications.yml` | The same categories for the OSS Review Toolkit (ORT). A unit test checks that it matches `policy.yaml` |
| `ort/evaluator.rules.kts` | ORT evaluator rules: a denied licence is an ERROR (also for build-only packages), an unmapped licence is an ERROR, a conditional licence or component is a WARNING that needs a register entry, GPL/AGPL in a shipped package is an ERROR, a named exclusion is an ERROR |
| `ort/curations.yml` | ORT package curations (licence options of multi-licensed packages, "unmodified") |
| `../../.ort.yml` | ORT repository configuration: path and scope excludes |

## The checker that runs now

`tools/hms licence check` applies `policy.yaml` to:

- a CycloneDX JSON SBOM: `sh tools/hms licence check --sbom build/reports/bom.json`
  (a component with CycloneDX scope `excluded` counts as build-only; everything else as shipped);
- the output of `pnpm licenses list --json`:
  `corepack pnpm --dir frontend licenses list --json --prod > build/pnpm-prod.json` then
  `sh tools/hms licence check --pnpm build/pnpm-prod.json --scope shipped`
  (and `--dev` with `--scope build-only` for the development dependencies).

It fails (exit 1) on a denied, excluded or unmapped licence and warns on a conditional one until
`register.yaml` has a matching entry. Several declared licences on one component are combined with
AND, as ORT does; an OR expression takes its best option. A licence or dependency outside the
allowlist is a stop-and-ask item (§3.4 item 2): record it in `docs/program/DECISIONS-NEEDED.md`
instead of changing `policy.yaml` to make the check pass.

## ORT: configured, not run yet

ORT runs in the merge tier from its official container image once a container engine exists on the
build host (WP-0.2 for the engine, WP-0.9 for the release pipeline). The WSL build host has had Docker
Engine since 18 October 2026 (DN-002), but the merge-tier ORT step is built in WP-0.9, so
**ORT has not been run** and the ORT files above are unvalidated: the
evaluator rules follow the ORT rules DSL but have not been compiled against an ORT version. When ORT
first runs, pin its image version, fix any DSL difference and record the result as evidence. Until
then the merge tier reports the ORT step as NOT-BUILT.
