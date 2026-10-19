# State machines and invariants (`state-machines-and-invariants`)

The specification of WP-0.5 (`PLT-CORE-03`), written before the code it governs (BUILD-PROMPT §3.2 step 2, §22.1 item 1). It covers the executable state-machine format and its schema, the generator and its checks, where each predicate lives, the generated property-test models, the SI test scaffold and how an SI test reports while its domain does not exist (§3.5), the scenario-suite framework (§18.5) and the CI wiring (§19.1). Sources: §2.1, §2.4, §3.4, §3.5, §5.2, §6.1, §6.2, §8.4, §18.1–§18.3, §18.5, §19.1, §21 (row 0.5), Appendix A.20, B.2 and B.3; R11 §10 and §15; K §5. Work package file: `docs/program/work-packages/WP-0.5.md`.

WP-0.5 starts before WP-0.3 is merged, a deviation approved by the human lead on 2026-10-19 and recorded as DN-050: only the parts that need no cluster are built, and the branch `wp/0.5-state-machines` is stacked on `wp/0.1-programme-bootstrap` at `09afa41`. Every result in this package comes from the Windows host and is not evidence of record (§3.5) until the lead runs the gates in the WSL clone.

**What this package does and does not prove.** The machines are specified, generated into executable models and property-tested at the **specification layer**: the generated model, driven by the real predicate implementations over generated facts. No aggregate, command handler, repository, journal or channel adapter exists yet, so no test here runs at the application-command layer of §18.3 or through a channel adapter. Every SI test says which layer it ran at (§4), and the nightly tier fails closed on every layer that is not built (§7). No hazard-log control moves beyond `planned` because of this package: a specification-layer property does not verify a domain control.

## 1. The executable specification format

One `<machine>.yaml` per machine in `docs/specs/state-machines/`, with a `<machine>.md` explanation beside it (Appendix B.3). The machine-readable schema is `docs/specs/state-machines/state-machine.schema.json` (JSON Schema 2020-12). It is written so that the patient-context machine already reviewed on `wp/0.7-design-system` (`docs/specs/state-machines/patient-context.yaml` at `fcadc88`) validates against it unchanged; a copy of that file is a test fixture of the checks (§2).

### 1.1 Keys

| Key | Required | Meaning | Source |
|---|---|---|---|
| `machine` | yes | Kebab-case name; equals the file name without `.yaml` | B.3 |
| `version` | yes | Integer ≥ 1. Raised on every change after a sign-off record exists for the current version (§2.3, KA-013) | B.3; KA-013 |
| `owner` | yes | The owning §5.2 module | B.3; §8.4 "Each machine has an owner module" |
| `approval` | yes | `{status: requested, required: [roles], approved_by: [], record: null}`. `approved_by` and `record` are written only from a human sign-off record (§3.5); the safety gate (`sh tools/hms safety check`) enforces it | B.3; §3.5 |
| `states` | yes | Kebab-case state names, unique | B.3 |
| `terminal` | yes | The states in which the lifecycle has ended; may be empty for a recurrent lifecycle (the bed) | B.3 |
| `initial` | no (new) | The state an instance is created in; default `states[0]` (patient-context has no `initial` and starts in `states[0]`, `no-patient`) | §8.4 "(start)" rows |
| `created_by` | no (new) | The commands that create an instance (§8.4 "(start)" rows), for example `[DoseFallsDue]`. They have no transition; the model starts in `initial` | §8.4 |
| `predicates` | yes | Map of camelCase predicate name → description (prose). Each is implemented once in the owner's domain package (§3) | B.3; §8.4 |
| `effects` | no (new) | Map of camelCase effect name → description: obligations a transition places on the domain (§8.4's "effect" column: "appends a location-history period", "pending results routed to owned queues (SI-17)", "every change emits ADT^A20") | §8.4 "Guard / effect" |
| `transitions` | yes | List of `{from, on, guard?, effects?, to, proposed?, description?}`: `from` is a state, a list of states or `"*"`; `on` is a PascalCase command; `guard` a list of predicate names (all must hold); `effects` a list of effect names; `proposed: true` (new) marks one transition as proposed when its edge is also drawn (a denial on the same edge as a drawn approval); `description` prose | B.3; §8.4 "prose goes in a description field" |
| `proposed` | no | List of `"<from>→<to>"` edges (`"*→<to>"` for a `"*"` transition) that R11 does not draw, awaiting panel approval | B.3; §8.4; A.20 |
| `invariants` | yes | The SIs the machine helps enforce | B.3 |
| `events` | yes | Domain events the machine publishes (§8.5 names; may be empty) | B.3 |
| `hazards` | no (new) | Hazard-log entries the machine serves (`HAZ-nnnn`); each must exist in `docs/safety/hazard-log.yaml` | §18.1 traceability |
| `sources` | no (new) | Citations for the transitions (BUILD-PROMPT, R11, K sections) | §3.5 house style |

A transition is proposed when its own `proposed` flag is set or its edge is in the top-level `proposed` list. The keys marked "new" are additions to B.3. They are optional, so patient-context validates without them. They are recorded as decision DN-059 (default in use: keep them; the alternative is comments only, which no tool can check).

### 1.2 Reading rules

- **Keys are read as written.** A YAML 1.1 parser reads the key `on` as the boolean `true` (and `yes`, `no`, `off` likewise). The tools load these files with a loader that resolves only `true` and `false` as booleans, rejects duplicate keys, and fails on any other implicit boolean (`patient-context.md` already notes the trap).
- **`"*"`** means every state except the transition's own `to` (so `"*" → entered-in-error` includes the terminal `completed`, as B.3's `MarkEnteredInError` needs, and never loops on itself).
- **Several transitions may share a `from` and an `on`.** They are alternatives with different guards (patient-context's `OpenSign` has five). Exactly one may apply: at most one candidate's guard may hold for any facts. A model step in which two hold is a specification defect (§3.3, property P3).
- **A command with no transition from the current state is not applicable**; a command whose candidates' guards all fail is **refused**. Neither changes the state or produces an effect.
- **Leaving a terminal state** is allowed only as an audited correction or reversal: every transition out of a terminal state must carry the predicate `privilegedAndAudited` (B.3's name: "the user holds the privilege and the action is audited"). Encounter's "Cancel discharge (audited)" and every "Mark error" from a terminal state are of this kind.

## 2. The generator and its checks (`tools/hms statemachines`)

`sh tools/hms statemachines check [--json]` validates every spec; `sh tools/hms statemachines generate` writes the generated Kotlin. Both live in `tools/hmstools/statemachines/` (Python, the project venv, PyYAML and jsonschema already pinned). `check` runs in the fast tier as its own step, `state-machines-check` (§7).

### 2.1 Rules (each a failure, never a warning)

1. The file parses with the reading rules of §1.2 and validates against the schema; `<machine>.md` exists beside it.
2. `machine` equals the file name; `owner` is a §5.2 module (the module list the safety check parses from BUILD-PROMPT §5.2).
3. `terminal` and `initial` are states; every `from` and `to` is a state or `"*"`; every state is reachable from `initial`.
4. **Unknown predicate:** a guard names a predicate that `predicates` does not declare → failure, naming the machine, the transition and the predicate. A declared predicate that no guard uses is also a failure. The same two rules hold for effects.
5. **Static determinism:** two transitions with the same `from` state (after expanding `"*"` and lists) and the same `on` fail when one guard is a subset of the other (both guards then hold at once, the empty guard included).
6. **Liveness:** from every reachable state a terminal state is reachable; for a machine with no terminal state, `initial` is reachable from every state (the bed returns to `available`).
7. **Terminal exits:** every transition leaving a terminal state carries `privilegedAndAudited` (§1.2).
8. Every `proposed` edge is the edge of at least one transition.
9. The approval block reads `status: requested`, `approved_by: []`, `record: null` (until a sign-off record exists, which the safety gate checks), and `required` names exactly the approvers of §8.4 for the eight §8.4 machines (OQ-083: the fuller §8.4 list). Roles are kebab-case ids: `nurse-panel`, `him`, `cso`, `pharmacist-panel`, `lab-cso`, `physician-panel`, `bed-manager`, `opd-panel`, `rcm-lead`, `kurdistan-pack-pm`. A machine §8.4 does not list (patient-context) may name any roles.
10. `invariants` are SI-01…SI-21; every `hazards` entry exists in the hazard log.
11. **Generated files are current:** each generated file carries the SHA-256 of its spec's canonical content and the generator version, and `check` regenerates in memory and fails on any difference.
12. **Each predicate is implemented once and unit-tested:** the owner's domain package holds exactly one object implementing the generated predicate interface (`<Prefix>Guards`), and the unit-test file `<Prefix>GuardsTest.kt` names every predicate in at least one test name. Kotlin's compiler adds the second half of rule 4: an object that does not implement a generated predicate does not compile.
13. **A changed spec keeps no approval (KA-013):** for every sign-off record whose `subject` is the machine and whose `subject_version` equals the spec's current `version`, the spec's canonical content at the commit that added the record must equal its content now; otherwise the check fails with "content changed since approval record SO-… without a version bump". No sign-off record exists yet; fixture repositories test the rule.

Patient-context is validated by rules 1–10 and 13 (it is a client-side machine in `frontend/packages/ui-core`; §3.2). Generating a TypeScript model for it is open question OQ-200.

### 2.2 Canonical content

The canonical content of a spec is its parsed document as canonical JSON (sorted keys, no spaces, UTF-8) without the approval block's human fields (`status`, `approved_by`, `record`), the same reduction the sign-off gate uses (`docs/safety/signoffs/README.md`, "Subject version"). Comments and layout do not count; every key and value does.

### 2.3 What is generated

For a machine with prefix `P` (the PascalCase of the machine name: `medication-administration` → `MedicationAdministration`) owned by module `m`, in package `hms.<m>.domain.<machine without hyphens>` (`hms.medications.domain.medicationadministration`):

- **Main source set:** `<P>Machine.kt` holds `enum class <P>State(val id: String)`, `enum class <P>Command`, `enum class <P>Predicate(val id: String, val description: String)`, `enum class <P>Effect(val id: String, val description: String)`, `interface <P>Predicates` with one function `fun <predicate>(facts: <P>Facts): Boolean` per predicate (its description as KDoc), and `object <P>Machine` with `MACHINE`, `VERSION`, `SOURCE_SHA256`, the `spec` (a `hms.kernel.statemachine.MachineSpec`), `holds(predicate, predicates, facts)` and `fire(state, command, predicates, facts)`.
- **Property-test source set:** `<P>GeneratedPropertyTest.kt`, a Kotest spec that runs the generic sequence properties of §3.3 on the generated model with the domain's `<P>Guards` and the facts generator `<P>Arbs.facts`.

Hand-written, in the same package: `<P>Facts` (the facts the predicates read) and `object <P>Guards : <P>Predicates` (main); `<P>GuardsTest` (unit tests, `src/test`); `<P>Arbs` (facts generator, `src/testFixtures`, so that the SI scaffold in `tests/invariants` can drive the same machine with the same facts); and the machine's own properties (`<P>PropertyTest`, `src/propertyTest`). Generated files start with a header naming the spec, its SHA-256 and "generated by tools/hms statemachines generate; do not edit".

The generated code is committed, not produced at build time, so a reviewer can read it and the build needs no Python. Rule 11 keeps it in step with the spec. OQ-201 records this choice [P].

## 3. Where the predicates live, the engine and the models

### 3.1 Domain packages before the modules exist

§8.4 puts each predicate in "the module's domain package", and no clinical module exists yet. WP-0.5 therefore creates each owning module as a Gradle project now, holding only its state-machine domain package; the work package that builds the module later adds its aggregates beside it (OQ-201 [P]):

| Machine | Owner (§5.2) | Gradle project | Package |
|---|---|---|---|
| encounter | `adt` | `backend/modules/adt` | `hms.adt.domain.encounter` |
| bed | `adt` | `backend/modules/adt` | `hms.adt.domain.bed` |
| order | `orders` | `backend/modules/orders` | `hms.orders.domain.order` |
| medication-administration | `medications` | `backend/modules/medications` | `hms.medications.domain.medicationadministration` |
| specimen | `lis` | `backend/modules/lis` | `hms.lis.domain.specimen` |
| result | `results` | `backend/modules/results` | `hms.results.domain.result` |
| appointment | `scheduling` | `backend/modules/scheduling` | `hms.scheduling.domain.appointment` |
| credit-claim | `rcm` | `backend/satellites/rcm` | `hms.rcm.domain.creditclaim` |

`rcm` is a satellite (ADR-003), so its project sits under `backend/satellites/`. The domain packages are pure Kotlin (the domain-purity architecture rule applies from their first class) and read no clock: time arrives in the facts. Predicates use `java.time` types and plain values; they move onto the WP-0.3 kernel types (`Clock`, clinical and recorded time, UUIDv7 identifiers, `Quantity`) when `wp/0.3-platform-kernel` is merged (KA-061).

**Facts, not aggregates.** A predicate is a pure function from a `<P>Facts` value to a Boolean. The facts are what the aggregate will know when it decides the command (the order's status and verification, the scans, the double check, connectivity, the reason chosen, the clock reading). The aggregate that assembles them does not exist; until it does, the facts come from generators in the property tests. A predicate implements its rule from the facts (it compares the scanned identifiers with the patient's, it checks that the double-check user differs from the administering user); a fact is never a pre-computed answer to the predicate's own question unless another module owns that answer (for example the identity service's MRN check-digit result), and the description says so.

### 3.2 The engine (`backend/platform/state-machine`, `hms.kernel.statemachine`)

A small generic library, not a kernel type that WP-0.3 builds:

- `Transition<S, C, P, E>(index, from: Set<S>, on: C, guard: List<P>, to: S, effects: List<E>, proposed: Boolean)`;
- `MachineSpec<S, C, P, E>(machine, version, states, initial, terminal, createdBy, transitions)` with `candidates(state, command)` and `fire(state, command, holds: (P) -> Boolean): Outcome`;
- `Outcome`: `Fired(from, command, transition)` (the target and effects come from the transition), `Refused(from, command, failed)` (every candidate with the predicates that did not hold), `NotApplicable(from, command)`, and `Ambiguous(from, command, matching)` when more than one candidate's guard holds. `fire` evaluates every predicate of every candidate (no short-circuit), so a refusal names every failed predicate. An ambiguous or refused outcome changes nothing.

The engine is unit-tested in its own project, including a spec built by hand that has an ambiguous pair.

### 3.3 The generated property-test model

`hms.kernel.testing.statemachine` (in `backend/platform/testing`, which every property-test source set already uses) runs the sequence properties. Each sequence starts in `initial`, has a random length of 1 to 32 steps, and at each step picks a command (mostly one with a transition from the current state, sometimes any command, including creation commands) and fresh facts from `<P>Arbs.facts`. Sequences come from seeds, and a failure prints the seed that reproduces it. The number of sequences is `PropertyTestBudget.sequences()` (1,000 in the fast tier, 10⁶ nightly, §19.1). After every step:

| # | Property |
|---|---|
| P1 | The state is one of the machine's states |
| P2 | A transition fired only if every predicate of its guard holds for the step's facts (evaluated again, independently of the engine) |
| P3 | At most one candidate's guard holds (no `Ambiguous` outcome) |
| P4 | A refused or not-applicable command leaves the state unchanged and produces no effect |
| P5 | A transition that leaves a terminal state fired only with `privilegedAndAudited` holding |
| P6 | The effects produced are exactly the fired transition's effects |
| P7 | At the end of the run, every transition has fired at least once (coverage), when the budget is at least 1,000 |

Each run writes `build/pbt-counts/<test>.json` (machine, budget, sequences, steps, fired, refused, not applicable, transitions covered and total), so the CI record holds the actual counts (§19.1 "record the actual sequence counts"). Each machine's own `<P>PropertyTest` adds its machine-level properties through the same driver (for example "a dose reaches `completed` only through a give path whose guards include `activeVerifiedOrder`, or the override path with `overrideReasonEntered`").

## 4. The SI test scaffold and how an SI test reports (§3.5)

`tests/invariants` (Gradle project `:tests:invariants`, package `hms.tests.invariants`) holds one named test spec per SI, `SI01…` to `SI21…`, and the register `tests/invariants/si-register.json`. Each SI test has up to two layers:

- **Specification layer**, where a machine of this package encodes part of the SI: a property over random command sequences of the generated models, at the property budget (for example SI-02 on medication administration: no step reaches an administered state without an active verified order or a documented override, and the override never waives SI-01, SI-12, SI-13 or SI-15). It asserts the property and passes or fails like any property test. It claims only what the machine encodes; the register lists the SI clauses it covers.
- **Domain layer**, the SI enforced "in the domain layer, below the API, for every channel" (§2.1). While its domain does not exist, this layer is **NOT-BUILT**, and it reports as follows.

**The reporting rule (the §3.5 decision of this package).** A domain-layer SI test whose domain does not exist:

1. **runs, and is never skipped, disabled, quarantined or tagged out.** Its test name carries the status: `SI-20 domain layer NOT-BUILT (waits on WP-0.4; KA-060)`.
2. **fails closed:** it calls the SI's domain probe, which returns `Verdict.NotBuilt` with the backlog IDs, the hazard reference and the work package it waits on. The test asserts that the verdict is `NotBuilt` and that its register entry is complete (backlog IDs that exist, a hazard entry that exists, a known-anomaly ID, the work package it waits on, the test name the hazard log plans). A probe can never return `Holds` without a real domain test behind it: `Verdict.Holds` can be produced only by running the domain property, and the scaffold has none yet.
3. **trips when the domain arrives:** each entry names a domain marker (the path of the module's domain package that will enforce the SI). If that path exists while the entry still says NOT-BUILT, the test fails ("the domain exists: write the domain-layer test and remove the NOT-BUILT entry"). A NOT-BUILT entry can therefore never outlive its domain unnoticed.
4. **is counted and listed:** the test writes `build/si-status/SI-nn.json`, the CI step sums them (`si_spec_layer_holds`, `si_domain_not_built`), and `KNOWN-ANOMALIES.md` lists the not-built domain layers (KA-060).
5. **fails the nightly tier:** the nightly step `si-domain-layer` fails while any SI's domain layer is NOT-BUILT, listing them (§7). The fast tier passes on it, because the fast tier shows that what exists is correct and that what does not exist is declared; the nightly tier shows that C2 ("across all invariants") is not met yet. No green run anywhere claims an SI holds at a layer it did not run at.

A fast-tier pass of an SI test therefore means: its specification-layer property held for the sequences run, and its missing domain layer is declared, fails closed and is tracked. It never means the SI is enforced. Changing an SI test's assertion, threshold or sequence count later is stop-and-ask item 10 (§3.4).

**Test names** follow the hazard log's `planned_verification` (`PropertyTest:SI-02-…`); where the hazard log plans several, the scaffold uses the SI's umbrella name (`PropertyTest:SI-02-*`) and the register maps the rest.

## 5. The scenario-suite framework (§18.5)

`tests/scenarios` (Gradle project `:tests:scenarios`, package `hms.tests.scenarios`):

- **Model:** a suite (`SCN-<area>`, its §18.5 number, title, hazards, SIs, mock-KB flag) holds scenarios (`SCN-<area>-nnn`, title, hazards, steps). A step is `given`, `when` or `then` text bound to a function of a `ScenarioWorld` (a simulated clock on `java.time`, synthetic `SYN-` patients only, the bound domain ports). A suite is bound to the domain through a `SuiteBinding`; a suite with no binding is **NOT-BUILT**.
- **Runner:** `sh backend/gradlew -p backend :tests:scenarios:scenarioSuites` runs every catalogued suite and writes the pass matrix linked to hazards (§18.2 evidence) as `tests/scenarios/build/reports/scenarios/pass-matrix.json` and `.md`: suite × scenario × result (`PASS`, `FAIL`, `NOT-BUILT`), with hazards and SIs.
- **Catalogue:** the ten suites of §18.5 are registered with their hazards and SIs: CPOE error-category harness (labelled "mock-KB run, not clinical evidence" whenever the mock KB is bound, §18.5 #1), ISMP, closed-loop medication, transfusion, results closure, identity, downtime, deterioration, revenue and SI-12, seam. None has a domain binding yet, so all ten are NOT-BUILT (KA-064). Writing their clinical scenarios needs CSO-approved content where §18.5 says so [HUMAN].
- **Self-tests** (fast tier, unit tests): the runner, the matrix, the NOT-BUILT reporting and the simulated clock, on a fixture suite bound to a toy binding.

The nightly step `scenario-suites` fails while any suite is NOT-BUILT or failing.

## 6. The machines

Encounter, order, medication administration, specimen, result and bed (the six company gate G1 needs, K §15.1), then appointment and credit claim (§8.4). Each `<machine>.md` explains its states, guards, effects, proposed transitions and what it leaves to later work packages, citing §8.4 and R11 §10 for every transition. Transitions R11 leaves undrawn are proposed (A.20): medication administration scheduled → completed and scheduled → not-done; specimen rejection from received and in process; bed blocked and closed entry and exit paths. Anything else this build adds beyond §8.4 and R11 is also listed in `proposed`, and every reading of an SI that a guard encodes beyond its text is a decision for the CSO or the approving panel. Each is listed, with options, in that machine's approval request (DN-051 to DN-058), with the stricter reading as the default until the approvers decide.

Each machine has an approval request in `DECISIONS-NEEDED.md` naming the §8.4 approvers (DN-051 to DN-058; OQ-083).

## 7. CI wiring (§19.1)

| Tier | Step | What it runs | Passes when |
|---|---|---|---|
| fast | `state-machines-check` (new) | `sh tools/hms statemachines check --json` | Every rule of §2.1 holds |
| fast | `backend-fast` (exists) | `fastTier -Phms.pbt.sequences=1000`, now including the module projects, the engine, `:tests:invariants` and `:tests:scenarios` | As before; its record now adds `pbt_sequences`, `si_spec_layer_holds`, `si_domain_not_built` |
| nightly | `property-1e6` (was NOT-BUILT) | `propertyTest -Phms.pbt.sequences=1000000` on every project | Every property passes; the record holds the actual sequence count per test. Today these are specification-layer models and SI properties; the step's message says so |
| nightly | `si-domain-layer` (new) | `sh tools/hms statemachines si-status --require-domain --json` | No SI's domain layer is NOT-BUILT (fails today, listing 21 SIs) |
| nightly | `scenario-suites` (was NOT-BUILT) | `:tests:scenarios:scenarioSuites` | Every suite is bound and passes (fails today: ten NOT-BUILT) |
| nightly | `property-channels` (stays NOT-BUILT) | ≥10⁴ sequences through each real channel adapter | Waits on each channel adapter's work package (UI command layer, API, mobile sync, HL7 inbound, migration loader, plugin effects) |

The JUnit globs of the backend step include `tests/**/build/test-results`, because the two `tests/` projects build outside `backend/`.

## 8. Hazards, decisions, anomalies

- **Hazards:** the machines serve H1 (SI-01, SI-16), H2 (SI-02, SI-12, SI-13, SI-15), H3 (SI-17), H5 (SI-03) and H6 (entered-in-error instead of delete). No control changes state in this package: a specification-layer property is not a domain control's verification (KA-062). New hazard entries from this package, if the review finds a hazard the log does not hold, use HAZ-0040…HAZ-0044.
- **Decisions for humans:** DN-050 (the deviation), DN-051…DN-058 (one approval request per machine, each listing the readings of SIs and the policy questions its guards encode), DN-059 (the format additions), DN-060 (the T3 harness branches and `repo check`; resolved by the lead), DN-061 (ADR numbers on a stacked branch).
- **Known anomalies:** KA-060 (SI domain layers NOT-BUILT), KA-061 (java.time instead of kernel types), KA-062 (specification-layer models only; no application-command layer, no channel adapters), KA-063 (patient-context not on this branch and not generated), KA-064 (scenario suites NOT-BUILT); KA-013 closes with rule 13.
- **Engineering choices [P]:** OQ-201 (executable specs with committed generated models, and predicate packages created ahead of their modules) and OQ-202 (cross-module test projects under `tests/` in the backend build). They are open questions, not ADRs: `sh tools/hms repo check` rejects a gap in ADR numbers, and ADR-029 to ADR-034 exist only on other branches, so ADR-035 and ADR-036 are written when the branches merge in order (DN-061).
