### OQ-143: Code-status and isolation vocabularies
- **Content needed:** the code-status vocabulary (values, definitions, labels in en, ckb and ar) and the isolation-precaution vocabulary (§9.4: contact, droplet, airborne, and any others), approved for clinical use [HUMAN] (§3.4 item 3).
- **In use:** synthetic sample entries (`provenance: synthetic`, NOT FOR CLINICAL USE) in the WP-0.7 demo fixtures only (`docs/specs/modules/design-system.md` §2.1). Until approved content exists, a code that the client vocabulary does not know shows the field as unavailable (design-system §2.1 rule 6).
- **Needed by:** WP-1.4 (`CLN-IPC-01`) and R2a (`CLN-ACP-01`), before any clinical use.
- **Status:** open

### OQ-151: Clinician review of the ckb and ar UI text
- **Content needed:** a clinician review [HUMAN] of every `ckb` and `ar` message the agent drafted (DN-021), starting with the `banner.*`, `clinical.*` and `sign.*` keys; and a translation memory owned by the content team (§11.1).
- **In use:** agent-drafted text, marked `unreviewed` per key (KA-031).
- **Needed by:** before any hospital use; it is part of the release translation gate (§11.1, §18.9; Phase 1 exit).
- **Status:** open

### OQ-152: The UCUM unit display map
- **Content needed:** a governed map from each UCUM unit code used on screens to its ISMP-safe display form (for example `ug` → `mcg`; `U` and `[iU]` → `units`), approved for clinical use [HUMAN] (§3.4 item 3). The ISMP list of error-prone abbreviations is the source.
- **In use:** a synthetic sample (`kg`, `g`, `mg`, `ug` → `mcg`, `mL`, `L`, `U` → `units`, `mmol/L`, `%`), labelled NOT FOR CLINICAL USE. A unit not in the map shows "Invalid value" (`docs/specs/modules/design-system.md` §2.6).
- **Needed by:** the work package that builds the formulary (`MED-FRM-01`) and WP-1.7 (results), before clinical use.
- **Status:** open
