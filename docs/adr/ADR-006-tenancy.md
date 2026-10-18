# ADR-006: Tenancy: tenant = the contracting enterprise; each hospital on its own on-site cell
Status: accepted
Date: 2026-10-18   Source: K §7.2, §7.7, §7.8, K-01, K-16, Appendix A.2 (KDV-2, KDV-8); BP §7.2, §7.8, §7.12; R08 §5, §6.4, §13 #4; BUILD-PROMPT §5.1, §6.4, §13.1 (PL-1), §21 (WP-0.3, WP-1.1, WP-1.13), §4.2

## Context

**The question.** What a tenant is, and how tenants are isolated.

**The research** (R08 §5). Tenant = the contracting enterprise, which may be a ministry, with one EMPI and one longitudinal record per enterprise across its facilities. Database per tenant gives strong logical isolation and per-tenant backup, restore and keys. Pooled tables with PostgreSQL row-level security are the lowest-cost model, but with sharp edges: owners and `BYPASSRLS` roles bypass the policies unless `FORCE ROW LEVEL SECURITY` is set; foreign-key and unique checks bypass RLS (a covert channel); policies with sub-selects can race. R08 recommends pooled RLS only for a small-clinic tier. A single writer per tenant is mandatory for clinical state (R08 §6.4).

**BP** (BP §7.2): tenant = contracting enterprise; database per tenant in shared cells; a pooled tier for hospitals under 150 beds (P2) with FORCE RLS and no `BYPASSRLS` roles; reopen if a national deal crosses the Citus thresholds (BP §7.12).

**What K changed** (K §7.2; KDV-8, "Changed"). Most Kurdistan hospitals are under 150 beds [L], and inpatient care must survive WAN loss, so any inpatient site gets its own on-site cell and the pooled tier serves outpatient facilities only. A multi-hospital group is one tenant on a primary cell, and other hospitals join it only if their links pass a measured availability test; otherwise each hospital gets its own cell and tenant, with identities cross-referenced (P2) until the multi-site edge cell (P3; ADR-025). The single writer per hospital keeps SI-15 intact (KDV-2). DP#1's polyclinic connects to hospital A's cell over metro links with a site edge agent (K §7.8). Not marked [P].

## Decision

**Tenancy:** tenant = the contracting enterprise. A single hospital runs on its own on-site cell. A group is one tenant on a primary cell; other hospitals join over dual metro links with a site edge agent only if 60 days of measured availability show ≥99.95% (including an exam-shutdown window, unless the links are private circuits), retested yearly; otherwise each hospital gets its own cell and tenant. Outpatient facilities use the pooled tier at the central site with `FORCE ROW LEVEL SECURITY` and no `BYPASSRLS` roles.

**Detail** (K §7.2, §7.7; BUILD-PROMPT §5.1, §6.4):
- One database per tenant; one schema per module; each module owns its tables. Every table carries `tenant_id`, a UUIDv7 `id` and audit columns, and `facility_id` where it applies, as defence in depth even inside a per-tenant database (R08 §3.11).
- A group that fails the link test becomes separate tenants on separate cells, with identities cross-referenced in P2 until the multi-site edge cell in P3.
- A multi-entity, multi-currency ledger runs from day one (K §7.7).
- Pooled tier: `FORCE ROW LEVEL SECURITY` on every table; no role has `BYPASSRLS`; RLS tests in CI (BUILD-PROMPT §6.4). Hard blast radius per cell; noisy-neighbour limits (PL-1).
- The configuration chain inside a tenant (vendor foundation → Kurdistan pack → tenant → legal entity → facility → department → unit → user) is ADR-020.

## Consequences (including safety and licence impact)

**Safety and privacy.**
- One writer per hospital means no multi-master clinical writes and no reconciliation of conflicting clinical state (SI-15; R08 §6.4), which addresses H2 and H6.
- In the pooled tier, isolation between outpatient tenants rests on RLS, so the RLS tests are a privacy control (SI-20, SI-21; H13, H14). Pooled-tier schemas must also be designed against the foreign-key and unique-check covert channel R08 §5 names.
- A group whose links fail the test has separate records per hospital until P2 cross-referencing, which is a cross-system seam (H15) that its hazard entries must cover.

**Operations.** Per-tenant databases make per-tenant restore (ADR-001 C7) and crypto-shredding (ADR-008) possible, at the cost of fleet migration tooling (R08 §5).

**Licence.** None beyond PostgreSQL (ADR-001).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** RLS tests; tenancy tests.

**Where and when.**
- **Tenancy tests:** with the enterprise hierarchy and the configuration chain, WP-0.3 (`PLT-CORE-02`, exit evidence "a locked setting cannot be overridden below its lock") and WP-1.1 (`PLT-CORE-02` full).
- **RLS tests:** with the pooled tier, WP-1.13 (edge agent for a stand-alone polyclinic on the pooled tier), as merge-tier integration tests on PostgreSQL through Testcontainers (BUILD-PROMPT §19.1).
- **The link test** for a group hospital is operational evidence measured on the customer's links before the topology is chosen; BUILD-PROMPT assigns no work package to its tooling.

**State on 2026-10-18:** not implemented. This ADR claims no result.

## Reopen if

A group needs one record across sites whose links fail the test.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
