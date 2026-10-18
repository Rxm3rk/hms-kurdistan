# ADR-028: Search: PostgreSQL full-text and trigram indexes in the product; OpenSearch only centrally
Status: accepted
Date: 2026-10-18   Source: K §7.2 (new), §7.6, §7.10, Appendix A.2 (KDV-9); BP §7.7, §7.11; R08 §7, §12.5, §12.6, §13 #9, #17; BUILD-PROMPT §0 (bar #3), §3.5, §4.1 (Search, Central site), §5.2 (empi, platform-i18n), §7 items 10 and 14, §9.1, §14.4, §18.6, §19.1, §21 (WP-0.6, WP-1.2), §22.3, §4.2

## Context

**The question.** What powers patient search, and search generally, in a product that runs on a three-node on-site cell.

**The research.** R08 recommended OpenSearch, with ICU, phonetic and transliteration analysers, for multilingual patient search and full-text search over documents, keeping exact lookups in PostgreSQL (R08 §7). Its stack table lists OpenSearch for search, with PostgreSQL full-text search among the alternatives and index consistency (CDC-driven, rebuildable) as the risk (R08 §12.5), and sets patient search type-ahead at p95 ≤200 ms (R08 §12.6). OpenSearch is foundation-governed (R08 §13 #9).

**BP** (BP §7.7, §7.11): OpenSearch in the stack; patient search p95 200 ms. BP has no ADR-028.

**What K changed** (K §7.2, "028 (new)"; KDV-9). PostgreSQL full-text and trigram indexes in the product; patient search at ≤200 ms fits Kurdistan's scale [E]; OpenSearch is kept only for central log and analytics search. This keeps one code path and drops a component that is hard to operate on site [I]; K points to R08's talent risk (R08 §13 #17). KDV-9's argument is on-site footprint, operations skills and one code path. K sets the reopen trigger "patient search p95 >200 ms on the reference cell". Not marked [P].

## Decision

**Search:** PostgreSQL full-text and trigram indexes in the product (patient search p95 ≤200 ms); OpenSearch only for central logs and analytics.

**Detail** (BUILD-PROMPT §4.1, §7 items 10 and 14, §9.1, §14.4):
- **Stack:** PostgreSQL full-text search plus `pg_trgm`, with Kurdish/Arabic normalisation functions (§4.1).
- **Patient search across scripts,** with trigram and normalised indexes, p95 ≤200 ms (§7 item 14). The normalisation comes from `platform-i18n`: name normalisation (ي/ی, ك/ک, ه/ە, alef forms, taa marbuta), a transliteration service (Kurdish/Arabic ↔ Latin, with stored variants), and collation and search normalisation (§7 item 10; §5.2).
- **Search before create** in `empi` (§9.1): by name (cross-script, phonetic and trigram), date of birth, sex, phone, identifiers and address, with similar-name warnings; patient search p95 ≤200 ms.
- **OpenSearch** runs only at the central site, for central log search and analytics; it is never part of an on-site cell (§4.1; K §7.2).
- **The target is a release blocker:** patient search p95 200 ms is one of the cell SLOs checked on the reference cell before release (BUILD-PROMPT §0, bar #3; §14.4; §18.6).

## Consequences (including safety and licence impact)

**Safety.** Search before create, across scripts with normalisation and similar-name warnings, is a control against selecting the wrong patient and against duplicate records that later need merging (H1, H12; SI-01, SI-08).

**Footprint and operations.** One store and one code path on the cell, with no search cluster to run on site and no separately indexed copy to keep consistent, the risk R08 §12.5 names for OpenSearch (K §7.2; KDV-9).

**Performance risk.** The ≤200 ms target rests on Kurdistan's scale, an estimate [E] (K §7.2). If the reference cell measures patient search p95 >200 ms, this ADR reopens.

**Licence.** PostgreSQL full-text search and `pg_trgm` come under the PostgreSQL licence (BUILD-PROMPT §4.1). OpenSearch runs only centrally, so it never ships to a site.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Search performance test.

**Where and when.**
- **WP-1.2** (identity and registration): its exit evidence includes "cross-script search ≤200 ms p95" (§21). The result names its cell; a dev-cell or lite-cell number is indicative (§3.5).
- **Nightly** (§19.1): a scaled functional day (about 30 beds) on the dev cell, with p95 compared against the same host's last baseline (a regression above 15% across three runs fails), and the 300-bed day on the reference cell once that hardware exists. The workload generators are WP-0.6.
- **Release:** the 300-bed day within SLOs on the reference cell, including patient search 200 ms (§18.6, §22.3) [HUMAN: hardware]. Only reference-cell numbers can fire the reopen trigger (§3.5).

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

Patient search p95 >200 ms on the reference cell.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
