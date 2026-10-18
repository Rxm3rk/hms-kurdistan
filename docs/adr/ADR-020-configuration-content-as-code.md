# ADR-020: Configuration and content as code: signed bundles, promotion and no customer branches
Status: accepted
Date: 2026-10-18   Source: K §7 (intro), §7.2 (kept), §7.7, §5.4, §17, K-26; BP §5.4, §7.1 rule 8, §7.2, §7.8; R08 §9, §13 #18, §14 #6; R15 §8.1; BUILD-PROMPT §2.1, §2.2 rule 8, §2.3, §5.2 (platform-config, content), §6.1, §6.2, §6.6, §6.8 item 8, §7 items 7–8, §19.2, §19.4, §21 (WP-0.1, WP-0.3, WP-1.1), §22.1 item 7, A.1 (PLT-CFG-01, PLT-CFG-02), §4.2

## Context

**The question.** How hospital-specific behaviour, configuration and clinical content are changed, tested and delivered without forking the code for any customer.

**The research.**
- Configuration lives as data in the database but is exported as signed, diffable bundles. Bundles promote through BUILD → TEST → TRAIN → PROD, plus a PLAY sandbox, gated by automated configuration tests (order sets reference valid orderables, CQL compiles, forms render, print templates fit their labels). Vendor foundation content is semantically versioned, and tenant overlays are rebased with three-way merges at each upgrade, so the product keeps the benefit of a vendor foundation without merging forks by hand. One codebase, no customer branches, extension only through declared extension points (R08 §9).
- R08 says to design the configuration system as a product: typed registry, inheritance chain, change sets, signed bundles, promotion pipeline, foundation plus overlays (R08 §14 #6). Its risk register names configuration sprawl recreating forks (R08 §13 #18).
- Order sets, CDS rules, escalation policies, reference ranges, tariffs, packages and payer rules change care and revenue as surely as code does, so they are versioned, signed content bundles with an owner, evidence link, review date, approval workflow, effective dating and their own hazard-log links (R15 §8.1).

**BP** (BP §7.2, §5.4, §7.1, §7.8): ADR-020 "Configuration and content as code: signed bundles BUILD → TEST → TRAIN → PROD; three-way merges; no customer branches", with no reopen trigger. Content is a regulated artefact and ships as signed bundles (BP §5.4). Constitution rule 8 ("configuration over code, promoted like code; extend through events and effects, never forks") is checked by a branch-per-tenant detector and signed-bundle verification (BP §7.1). The configuration chain runs from vendor foundation to user; the most specific setting wins unless a parent has locked it, and safety invariants and Tier 2 activation are vendor-locked (BP §7.8).

**Sources.** K keeps BP's ADR-020 text (K §7.2) and the configuration chain, with the Kurdistan pack in place of BP's country pack (K §7.7). K keeps "make each new hospital a configuration task, not a code branch" as one of the architecture's jobs (K §7 intro). K-26: one owned Kurdistan pack, because country behaviour is data, not a fork. K §5.4 keeps content as a regulated artefact, and K §17 sets the KPI "custom code branches per tenant: 0". BUILD-PROMPT §4.2 states the decision with the word "promoted". Not marked [P].

## Decision

**Configuration and content as code:** signed bundles promoted BUILD → TEST → TRAIN → PROD; three-way merges; no customer branches.

**Detail** (BUILD-PROMPT §6.6, §19.2, §19.4, §5.2, §6.2):
- **The configuration chain:** vendor foundation → Kurdistan pack → tenant → legal entity → facility → department → unit → user. The most specific value wins unless a parent has locked it. Safety invariants and Tier 2 activation are vendor-locked (K §7.7). A tenant may tighten a safety invariant and can never loosen it (BUILD-PROMPT §2.1).
- **Promotion:** signed bundles are promoted BUILD → TEST → TRAIN → PROD, with three-way merges and no customer branches. A PLAY environment beside them lets hospital analysts experiment safely (§6.6). The environments run `dev` (compose) → `ci` → `test` → `train` → reference cell → production rings, and configuration bundles follow the same promotion path; no production PHI exists outside production (§19.2).
- **Content is a regulated artefact** (§6.6, §19.4). Order catalogues, formulary, CDS rules, tariffs and packages, forms, templates and translations are versioned sources in `content/`, built into signed bundles and validated before promotion:
  - schema and referential validation: every code resolves in the terminology service; every orderable has a charge mapping or an explicit "non-chargeable" flag;
  - CDS rules: the CPOE error-category harness; new or locally modified rules run silent for 2–4 weeks with replay against up to 90 days of orders where electronic orders exist;
  - tariffs and packages: a re-pricing replay of 3–6 months of encounters before activation, with variance reports;
  - drug-KB content releases are regression-replayed like code;
  - translations: zero missing keys in clinical paths; clinician review recorded [HUMAN].
- **Synthetic content is a gate, not a label** (§19.4). Every content item and test fixture carries `provenance: synthetic | approved` as data. Promotion to TRAIN or PROD fails if any item is synthetic, and the Release Evidence Pack lists every synthetic item still present.
- **Flags** (§6.6): every CDS rule and clinical-behaviour flag has a kill switch; safety-relevant changes default to off; flag changes are audited (SI-19).
- **The clinical tier** (§6.6; K-24): `CORE` or `CLINICAL_SAFETY` is one facility-level setting, locked against department, unit and user override. Tests prove that no configuration state yields CPOE without eMAR/BCMA, or a MAR on any unit of a `CORE` facility.
- **Extension tiers** (§6.6; R08 §9): (1) configuration (forms, order sets, rules, worklists, print templates: typed, validated, versioned, tested); (2) low-code (sandboxed, no database access); (3) server plugins (P2, `PLT-CFG-04`) that run out of process, receive events and return effects the core validates; (4) external SMART apps and CDS Hooks services. Behaviour is extended through events and effects, never forks (constitution rule 8).
- **No tenant-specific code:** behaviour differences are configuration, and a detector fails the build on tenant identifiers in code (§6.2). Never fork code or keep a branch for any customer (§2.3).
- **Owners** (§5.2, §6.1): `platform-config` (signed bundles, promotion, feature flags and kill switches) and `content` (Kurdistan foundation content and pack bundles); content sources live in `content/`. Every feature's configuration is delivered as a bundle (Definition of Done item 7, §22.1).

## Consequences (including safety and licence impact)

**Safety.**
- Content changes care as surely as code (R15 §8.1). Signing, validation, silent running and replay before activation are the controls against a wrong order set, rule or escalation policy reaching patients (H2, H4).
- Vendor-locking the safety invariants and Tier 2 activation in the chain means no tenant, facility, unit or user setting can switch off a safety control or switch on a Tier 2 function (SI-18; ADR-016).
- The synthetic-content gate stops sample thresholds, ranges and codes from reaching TRAIN or PROD (BUILD-PROMPT §3.4 item 3, §19.4).
- Kill switches default safety-relevant changes to off (SI-19; H4).
- With no customer branches, every safety fix reaches every site through the same release train (ADR-021).

**Engineering.** Configuration becomes a product of its own (`PLT-CFG-01`: typed registry, change sets, signed bundles, promotion, three-way merge), built in WP-0.3. In exchange, onboarding a hospital is configuration work, not a code branch (K §7 intro).

**Licence.** The sources name no signing tool for configuration bundles. Production signing keys of any kind and any transparency log need an ADR and a [HUMAN] decision (BUILD-PROMPT §4.3; ADR-022). Licensed content (drug KB, SNOMED CT, LOINC tables, WHO ICD-10 and ATC files) enters a bundle only from files a human has placed under `content/licensed/` (git-ignored) after accepting the licences (BUILD-PROMPT §3.4 item 5; ADR-015).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Signed-bundle verification; branch detector.

**Where and when.**
- **Branch detector:** `sh tools/hms repo check` (WP-0.1) checks every local and remote-tracking branch name against §3.6 (`main`, `wp/<n.m>-<slug>`, `release/…`, `hotfix/…`), rejects names containing "customer", "tenant" or "client" or naming a tenant registered in `tools/config/tenant-identifiers.yaml`, and scans source and configuration under `backend/`, `frontend/`, `content/` and `deploy/` for registered tenant identifiers (the tenant-identifier detector of BUILD-PROMPT §6.2 and §6.8 item 8). It runs in the fast tier as the `repo-check` step of `tools/ci/run fast`. Only synthetic tenants are registered until a real tenant is onboarded [HUMAN].
- **Signed-bundle verification:** with the signed configuration bundles of WP-0.3 (`PLT-CFG-01`) and the Kurdistan pack, which WP-1.1 loads as signed configuration (`PLT-CFG-02`; exit evidence "the Kurdistan pack loads as signed configuration"). BUILD-PROMPT does not say which CI tier runs it.
- **Related checks** (not this ADR's named guards): the content-pipeline validations and the synthetic-content promotion gate (§19.4), and the WP-0.3 exit evidence "a locked setting cannot be overridden below its lock".

**State on 2026-10-18:** the branch and tenant-identifier detectors are written in the WP-0.1 working tree (`tools/hmstools/repo/rules.py`, rules (c) and (d)); at the time of writing, no record under `docs/program/evidence/ci/` shows a run of them. Signed-bundle verification is not implemented. This ADR claims no result.

## Reopen if

No reopen trigger is set (BUILD-PROMPT §4.2 shows "—"). Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
