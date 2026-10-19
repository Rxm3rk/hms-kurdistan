# WP-0.5: State machines and invariants
Phase / release: Phase 0 Foundation / no clinical go-live (feature first runs in R1)   Features: `PLT-CORE-03`
Read first: BUILD-PROMPT §2.1; §2.4; §3.5; §8.4; §18.1; §18.2; §18.3; §18.5; §19.1 (sequence counts per tier); Appendix B.2 and B.3; Appendix A.20 ("Undrawn transitions"). Research: R11 §10 (state machines) and R11 §15 (property list); K §5
Depends on: WP-0.3   Simulators needed: none
Entry criteria:
- WP-0.3 merged, or reviewed and stacked (§3.6, §21).
- Not met: WP-0.3 is being built at the same time on `wp/0.3-platform-kernel`. **Approved deviation (DN-050):** on 2026-10-19 the human lead approved starting the cluster-free parts of WP-0.5 before WP-0.3 is merged, a deviation from §21's "Depends on" order and from this entry criterion. Scope: the machine specifications, the generator, the generated models and property tests, the SI scaffold and the scenario-suite framework. Still waiting: anything that needs a container (none is written here), the application-command layer and channel adapters of §18.3, and the gates of record. The branch `wp/0.5-state-machines` is stacked on `wp/0.1-programme-bootstrap` at `09afa41` and merges `wp/0.2-environments` and `wp/0.3-platform-kernel` (`--no-ff`) when they are ready; the predicates move onto the WP-0.3 kernel types then (KA-061).
State: in-progress (specification: `docs/specs/modules/state-machines-and-invariants.md`).
Deliverables:
- Executable specifications in `docs/specs/state-machines/<name>.yaml`, each with a `.md` explanation (template B.3), for encounter, order, medication administration, specimen, result and bed, then appointment and credit claim (§8.4). Guards are lists of named predicates; each predicate is implemented once in the module's domain package and unit-tested; prose goes in a `description` field; the generator fails on an unknown predicate.
- Transitions R11 leaves undrawn are marked "proposed" and put to the approving panel: medication administration scheduled → completed and scheduled → not-done; specimen rejection from received and in process; bed blocked and closed entry and exit paths (§8.4; A.20).
- Every approval block reads `status: requested` with `approved_by: []` and `record: null`; `approved_by` and `record` are written only from a human sign-off record (§3.5).
- Property-test models generated from the specifications (Kotest property testing, §4.1); short runs (≈1,000 sequences per machine) in the fast tier, 10⁶ sequences nightly (§19.1, §18.3).
- A test scaffold per SI (SI-01…SI-21) with a named test for each (§21). How an SI test whose domain does not exist yet reports is decided in this work package's specification under §3.5: no silent stubs, never skipped, quarantined or weakened.
- The scenario-suite framework (§18.5) under `tests/`, for the nightly tier.
- Approval requests filed in `DECISIONS-NEEDED.md`, one per machine, naming the approvers §8.4 gives.
Exit criteria (evidence required):
- Each of the six machines that company gate G1 needs (encounter, order, medication administration, specimen, result, bed) has a specification with named-predicate guards, a generated model and passing property tests (actual sequence counts recorded).
- Every approval block reads `status: requested` with `approved_by` empty.
- Approval requests filed in `DECISIONS-NEEDED.md` [HUMAN: pharmacist and nurse panels, lab CSO, HIM, CSO].
- §22.2 work-package Definition of Done and a reviewer report.
Hazards touched:
- Specifications for every SI-01…SI-21 scaffold.
- The six G1 machines touch H1 wrong patient (SI-01, SI-16), H2 wrong drug, dose, route or time (SI-02, SI-12, SI-13, SI-15), H3 missed or late result (SI-17), H5 orphaned work (SI-03: every order reaches a terminal state) and H6 data loss or corruption (entered-in-error instead of delete).
[HUMAN] gates:
- State-machine approvals, never marked by the agent. Approvers per §8.4: encounter (nurse panel + HIM + CSO); order (pharmacist and nurse panel + CSO); medication administration (pharmacist and nurse panel + CSO); specimen (lab CSO); result (lab CSO + physician panel); bed (nurse panel + bed manager); appointment (OPD panel); credit claim and pre-approval (RCM lead + Kurdistan pack PM). §21 lists "pharmacist and nurse panels, lab CSO, HIM, CSO"; the fuller §8.4 list is used (OQ-083).
- Company gate G1 (M6) needs the six machines approved (K §15.1) [HUMAN].
