# Licence policy and checks

The licence and dependency policy of BUILD-PROMPT.md §4.3 (ADR-022), as data and checks.

| File | What it is |
|---|---|
| `policy.yaml` | The policy as data: scopes (shipped, build-only), the allowlist, the conditional list, the denylist, the named exclusions, the build-only list [P] and licence-name aliases |
| `register.yaml` | The licence register: one entry per component used under a conditional rule. It records facts, never an approval. Its header lists the entry fields, which `tools/hms licence check` enforces |
| `ort/license-classifications.yml` | The same categories for the OSS Review Toolkit (ORT). A unit test checks that it matches `policy.yaml` |
| `ort/evaluator.rules.kts` | ORT evaluator rules: a denied licence is an ERROR (also for build-only packages), an unmapped licence is an ERROR, a conditional licence or component is a WARNING that needs a register entry until the ORT step exists (see "Conditional licences" below), GPL/AGPL in a shipped package is an ERROR, a named exclusion is an ERROR |
| `ort/curations.yml` | ORT package curations (licence options of multi-licensed packages, "unmodified") |
| `../../.ort.yml` | ORT repository configuration: path and scope excludes |

## The checker that runs now

`tools/hms licence check` applies `policy.yaml` to:

- a CycloneDX JSON SBOM: `sh tools/hms licence check --sbom build/reports/bom.json`
  (a component with CycloneDX scope `excluded` counts as build-only; everything else as shipped);
- the output of `pnpm licenses list --json`:
  from `frontend/`, `corepack pnpm --filter @hms/i18n licenses list --json --prod > ../build/pnpm-prod.json`, then,
  from the repository root, `sh tools/hms licence check --pnpm build/pnpm-prod.json --scope shipped`
  (and the list of every dependency, `corepack pnpm -r licenses list --json`, with `--scope build-only`;
  `docs/program/COMMANDS.md` §3 gives both commands).

It fails (exit 1) on a denied, excluded or unmapped licence, on a conditional one until `register.yaml`
has an entry that matches the component, records the rule and the licence the policy applies to it and
records it as `unmodified: true`, and on a register entry that does not follow the fields in the
register's header (a malformed entry is never used). Several declared licences on one component are
combined with AND, as ORT does; an OR expression takes its best option. A licence or dependency outside
the allowlist is a stop-and-ask item (§3.4 item 2): record it in `docs/program/DECISIONS-NEEDED.md`
instead of changing `policy.yaml` to make the check pass.

## Conditional licences

§4.3 allows MPL-1.1 libraries, the LGPL-2.1 option of dcm4che and dcm4chee, the OpenJDK runtime and
operating-system packages in base images only "unmodified and recorded in the licence register", and
GPL or AGPL only as unmodified, separate containers with a source offer. The register entry is that
record, so `tools/hms licence check` fails on a conditional component without one (review finding
R-18; until then it only warned). For GPL and AGPL containers §4.3 names a source offer, not the
register; requiring a register entry that names the offer (`source_offer`) is a tightening of this
build, so that the check can see the offer. An entry is the record of a component only if it records
the rule the policy applies to that component and the licence the rule applies to (the check's message
names both), and its pattern must name the component: a pattern that matches the empty string (`.*`)
or a package it does not name (`.`, `^pkg:`, `^pkg:npm/`; the check tries a few made-up package URLs and
a made-up name) is refused; otherwise one broad entry under a rule would pass every conditional
component of that rule. For OS packages and GPL or AGPL containers the licence is the
component's declared expression, so packages with different licences need different entries. The
register has no entries yet: no conditional component is a dependency. Add the entry in the change that
first depends on the component (for HAPI HL7 v2, WP-1.1b), together with its curation in
`ort/curations.yml`.

The ORT evaluator rules `CONDITIONAL_LICENSE` and `CONDITIONAL_COMPONENT` stay WARNINGs until the ORT
step exists (WP-0.9). This is a decision of this build, taken for R-18, for three reasons: ORT has never
run and the rules have never been compiled (below); the rules cannot yet see `register.yaml`, so as
ERRORs they would fail every conditional component, registered or not, the first time ORT runs; and no
gate reads their result today, so the warning hides nothing. The check that applies the register is
`tools/hms licence check`: today by hand on the frontend's pnpm lists (`docs/program/COMMANDS.md` §3),
and from WP-0.9 in the merge tier on the CycloneDX SBOM (the `sbom` step). When WP-0.9 builds
the ORT step, it makes both rules ERRORs for any package the register does not record (by reading
`register.yaml` in the rules or by generating ORT resolutions from it) and removes this paragraph; a unit
test (`OrtConsistency` in `tools/hmstools/licence/tests/test_licence.py`) keeps the two in step until then.

## ORT: configured, not run yet

ORT runs in the merge tier from its official container image once a container engine exists on the
build host (WP-0.2 for the engine, WP-0.9 for the release pipeline). The WSL build host has had Docker
Engine since 18 October 2026 (DN-002), but the merge-tier ORT step is built in WP-0.9, so
**ORT has not been run** and the ORT files above are unvalidated: the
evaluator rules follow the ORT rules DSL but have not been compiled against an ORT version. When ORT
first runs, pin its image version, fix any DSL difference and record the result as evidence. Until
then the merge tier reports the ORT step as NOT-BUILT.
