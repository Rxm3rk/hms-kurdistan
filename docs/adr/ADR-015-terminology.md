# ADR-015: Terminology
Status: accepted
Date: 2026-10-18   Source: K §7.2, §8, §19.2 (Q-K9), Appendix A.2 (KDV-14); BP §7.2, §7.7; R06 §5, §8; R13 §11 #5; BUILD-PROMPT §3.4 item 5, §4.1 (Terminology), §7 item 9, §8.6, §8.7, §19.4, §21 (WP-1.1), §4.2

## Context

**The question.** Which code systems the product uses, how they are licensed, and where the terminology service runs.

**BP** (BP §7.2, §7.7): Snowstorm for SNOMED CT, HAPI for LOINC, ICD and national code systems; a licence-entitlement service; code sets and groupers versioned by date of service as data (R13 §11 #5). BP flags that Snowstorm depends on Elasticsearch, whose licence is not on the allowlist for modification.

**What K changed** (K §7.2, "Changed"; KDV-14). The codes are WHO ICD-10 (with WHO's commercial-use permission), LOINC, UCUM, ATC (WHOCC file licence), the regional drug master and local codes. SNOMED CT runs on Snowstorm only if a licence is taken (Q-K9); until then the SNOMED Global Patient Set is used where useful. Iraq is probably not a SNOMED member [L], and fees apply by income band (R06 §5). On-site cells get terminology and drug-KB snapshots, so Snowstorm's Elasticsearch never runs on site. Not marked [P].

**Licensed content is a human matter.** The agent never downloads, scrapes or ships unlicensed content and never writes standard codes from memory (BUILD-PROMPT §3.4 item 5).

## Decision

**Terminology:** WHO ICD-10 (commercial-use permission needed), LOINC (seeded via LIVD), UCUM, ATC (WHOCC file licence), the regional drug master and local codes. SNOMED CT only if licensed (Q-K9); until then the free SNOMED Global Patient Set where useful. On-site cells receive terminology and drug-KB snapshots.

**Detail** (BUILD-PROMPT §4.1, §7 item 9, §8.7, §19.4):
- **The service:** a terminology service on HAPI for ICD-10, LOINC, UCUM, ATC and local codes; Snowstorm only centrally and only if a SNOMED CT licence is taken. Code systems, value sets and maps, versioned by date of service; licence entitlements (`PLT-CORE-05`).
- **Positions per code system** (BUILD-PROMPT §8.7): ICD-10 (WHO base version, for insurers and statistics; commercial use needs WHO permission [HUMAN]); ICD-11 dual coding if the KRG adopts it; LOINC (seeded via LIVD) and UCUM used throughout; ATC electronic files need a WHOCC licence [HUMAN]; SNOMED CT as above; drugs: no national drug file [L], so the regional brand master plus the licensed drug-KB concepts.
- **Every coded element** keeps the local code, standard code, display, original text and code-system version (R06 §8: retrofitting this is "ruinous").
- **Licensed files** are downloaded by a human after accepting the licences and placed under `content/licensed/` (git-ignored). The agent writes the loaders, checksums and tests (BUILD-PROMPT §3.4 item 5).
- **Until the files exist,** synthetic code systems are used: codes from `urn:hms:synthetic:*` code systems, never real LOINC, ICD-10, ATC or SNOMED CT codes recalled from memory, with `provenance: synthetic`. Promotion to TRAIN or PROD fails if any item is synthetic (BUILD-PROMPT §19.4).

## Consequences (including safety and licence impact)

**Safety.**
- A wrong code or map can misfile a result or mislead a check (H2, H3). Keeping the original text and code-system version on every element preserves what the clinician actually entered.
- Synthetic content is a gate, not a label: no synthetic code can reach a production bundle (BUILD-PROMPT §19.4).
- On-site snapshots mean coding and checks keep working when the internet is cut (H7).

**Licence.**
- ICD-10 commercial use needs WHO permission, ATC files need a WHOCC licence, and SNOMED CT needs an affiliate licence if one is ever taken: each is a [HUMAN] decision (BUILD-PROMPT §8.7; Q-K9). LOINC tables are licensed content a human downloads after accepting the licence (BUILD-PROMPT §3.4 item 5).
- Snowstorm (Apache-2.0) depends on Elasticsearch, so it runs only centrally and only if SNOMED is licensed (BP §7.7; K §7.2).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Terminology conformance tests.

**Where and when.** The `terminology` module (`backend/modules/terminology/`) is built in WP-1.1 (`PLT-CORE-05`). Its exit evidence is a terminology service that loads LOINC, UCUM and ICD-10 from licensed files when a human supplies them [HUMAN: licences], with the loaders verified on synthetic files, plus local codes. Conformance tests run in the merge tier.

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

SNOMED licence taken.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
