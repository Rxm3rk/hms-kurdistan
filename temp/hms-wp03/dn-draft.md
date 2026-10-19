
## DN-042: The CSO's decisions on the kernel libraries' time and dose rules (WP-0.3 kernel spec DN-KN1 to DN-KN6)

- **Status:** requested. Decided by: (empty). Date: (empty).
- **Who decides:** the CSO [HUMAN] (§3.4 items 1 and 3: safety-invariant parameters and their readings are not the agent's to choose).
- **Blocks:** nothing in WP-0.3, whose code refuses or labels as below; every clinical entry that needs a timing policy from Phase 1 (DN-KN1); the medications module and CDS (DN-KN2 to DN-KN5); back-entry and offline capture (DN-KN6).
- **The six decisions,** each with its default, options and context in `docs/specs/modules/platform-kernel.md` §19 under its local label:
  1. **DN-KN1:** values and direction of the SI-10 entry-time tolerances. Default: no vendor value; the definitions are `configurationRequired`; every entry that needs a timing policy is refused; tests use synthetic policies.
  2. **DN-KN2:** what "audited" means in "one audited comparison API" (§6.8 #1; CTRL-0005-5). Default: every outcome carries a `ComparisonRecord` that the caller stores with its journal row and audit event; the kernel writes nothing.
  3. **DN-KN3:** the KB comparisons of §2.1 (c), including the 10× KB-maximum hard stop (CTRL-0005-7). Default: kernel spec §10.5 as written.
  4. **DN-KN4:** what counts as a unit-less dose, and zero rates. Default: the unity `1`, numbers without an atom and annotation-only units are refused; a dose is positive; a rate bound may be zero. A tightening of SI-05; counted doses cannot be expressed until answered.
  5. **DN-KN5:** clinical number and unit display beyond the stated ISMP rules (grouping, separators in `ar` and `ckb`, Eastern Arabic-Indic digits). Default: `.` as separator, no grouping, ASCII input, the UCUM code as the unit.
  6. **DN-KN6:** entry-timing labels, windows, back-entry privilege and offline capture. Default: kernel spec §6.2 as written.

## DN-043: Configuration signing keys and the SI-19 kill-switch readings (WP-0.3 config spec DN-CFG-1 to DN-CFG-3)

- **Status:** requested. Decided by: (empty). Date: (empty).
- **Who decides:** the human lead for key custody (§4.3: "Production keys and any transparency log need an ADR and a [HUMAN] decision"); the CSO for the two SI-19 readings (§3.4 items 1 and 8).
- **Blocks:** bundle activation outside tests (DN-CFG-1); R1 go-live of any clinical kill switch (DN-CFG-2); CTRL-0019-1 leaving `planned` (DN-CFG-3). Not WP-0.3's domain work, which signs with test-only keys generated at test time.
- **The decisions** (`docs/specs/modules/platform-config.md`, open items): DN-CFG-1 production custody of the configuration-signing keys; DN-CFG-2 engaging a kill switch when no authorisation decision can be made (refuse; audited local break-glass; engage-only break-glass), no default chosen; DN-CFG-3 what "vendor-locked" means for SI-19 (default: SI-19's rules are locked, not the flag values).

## DN-044: Readings of the task engine, tenancy and workflow specifications (WP-0.3 local DN-TK1 to DN-TK7, DN-T1, DN-T2, DN-W1, DN-W2)

- **Status:** requested. Decided by: (empty). Date: (empty).
- **Who decides:** the CSO for DN-TK1 to DN-TK6, DN-T1 and DN-T2 (readings of SI-03, SI-18 and CTRL-0018-1); the human lead for DN-TK7, DN-W1 and DN-W2 (an aggregate-boundary deviation from §8.2; ADR-010's guard and §5.2's dependency column, stop-and-ask item 2).
- **Blocks:** nothing in WP-0.3, which builds the defaults; the Temporal adapter (DN-W1, DN-W2) and `rcm`'s use of workflows.
- **The decisions,** each with its default in its spec's open-items section:
  - `platform-tasks.md`: DN-TK1 safety timers never pause for the calendar; DN-TK2 SLA of back-entered work runs from the paper time; DN-TK3 a directory outage raises one "orphan detection blind" alarm per scope; DN-TK4 a dead-letter task's SLA breach at 5 minutes is the §6.7 alarm; DN-TK5 an unroutable terminal escalation owner keeps the routable holder and alarms the fallback queue; DN-TK6 the task engine has no kill switch (SI-03 cannot be switched off); DN-TK7 tasks are their own aggregate.
  - `platform-tenancy.md`: DN-T1 the reading of CTRL-0018-1 (no configuration layer holds Tier 2 activation; the Register is the only switch); DN-T2 safety parameters with no coded default take their first value only from a governed bundle, and readers fail closed until then.
  - `platform-workflow.md`: DN-W1 where workflow definitions live and in what form; DN-W2 how `rcm` and `migration` reach `WorkflowPort` and `platform-tasks`.
