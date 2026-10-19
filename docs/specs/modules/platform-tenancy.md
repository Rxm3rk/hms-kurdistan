# Module specification: platform-tenancy

Module: `platform-tenancy` (Gradle `:modules:platform-tenancy`, package `hms.platform.tenancy`)   Group: Platform (BUILD-PROMPT §5.2)
Work package: WP-0.3, domain level first (DN-040); persistence and the Trust Plane wiring wait   Status: draft, revised after the automated review, 2026-10-19
Features: `PLT-CORE-02` base (Appendix A.1; full in WP-1.1, §21); the configuration-chain part of `PLT-CFG-01` that `platform-config` builds on
Sources: BUILD-PROMPT §2.1 (preamble, SI-03, SI-05, SI-10, SI-18, SI-19), §2.2 rules 1, 2, 6, 7 and 8, §3.4 items 1, 3, 4 and 10, §3.5, §4.2 (ADR-003, ADR-004, ADR-006, ADR-020), §5.2, §5.3, §6.1, §6.2, §6.4, §6.6, §6.8, §7 items 1, 3 and 7, §8.1 (P2, P3, P9, P10), §8.2 (Enterprise row), §8.3, §8.5, §10.2, §11.7, §19.2, §19.3, §19.4, §21 (WP-0.3, WP-1.1), §22.1; K §5.1, §7.7, K-24; BP §7 (intro), §7.8; R08 §5, §9; R11 §1, §2, §16; R07 §5.2 (AZ-1, AZ-6), §5.4 (AU-1); `docs/adr/ADR-006-tenancy.md`; `docs/adr/ADR-020-configuration-content-as-code.md`; `docs/program/ASSUMPTIONS.md` (L-20); `docs/program/DECISIONS-NEEDED.md` DN-040; `docs/safety/hazard-log.yaml` CTRL-0001-1 … CTRL-0021-1, CTRL-0005-14, CTRL-0018-6; integrator decisions D1–D17 (WP-0.3 spec round). Sibling specifications: `platform-kernel.md` (`hms.kernel.ids`, `hms.kernel.time`, `hms.kernel.context`), `platform-journal.md`, `platform-config.md`, `platform-tasks.md`, `docs/specs/events/envelope.md`, `docs/specs/events/catalogue.md`.

Risk class of this work: patient-safety-relevant. It holds the vendor locks on safety-invariant parameters and the clinical tier (DN-040 decision 2: at least two review lenses).

Local labels: open items carry local labels (OQ-T1, KA-T1, HAZ-T1, DN-T1 and so on). The integrator numbers them (D9).

Revision note: this revision answers the correctness and safety review of 2026-10-19 (findings CA-01 … CA-38, SAF-01 … SAF-29) and applies integrator decisions D1–D17. Section 16 lists what this spec assumes of its siblings.

**Programme numbers (19 October 2026).** DN-T1 and DN-T2 are DN-044; OQ-T1 to OQ-T13 are OQ-173; HAZ-T1 is OQ-177; KA-T labels become KA numbers when the code that makes them true is committed. (`docs/program/DECISIONS-NEEDED.md`, `docs/program/OPEN-QUESTIONS.md` §(g).)

## 1. Purpose and scope

`platform-tenancy` owns the enterprise structure, the configuration chain and its locks (§5.2). Every other module asks it two questions: "where does this node sit in the enterprise?" and "what value applies here, as of this time, and who set it?".

**In scope.**
- The enterprise hierarchy: tenant → legal entity → facility → building → floor → department → unit → room → bed, plus service points (clinics, counters, labs, OT suites) (§7 item 1; WP-0.3). The physical, organisational and financial hierarchies stay separate but cross-referenced (§8.2; R11 §2; R08 §5). §7 item 1 lists the levels as one line; this spec reads it through §8.2's rule, so building and floor are physical and department is organisational (section 4).
- The configuration chain: vendor foundation → Kurdistan pack → tenant → legal entity → facility → department → unit → user. The most specific value wins unless a parent has locked it (§6.6; K §7.7; BP §7.8; R08 §5).
- The one store of setting definitions (D2): typed keys, value types, allowed levels, lockability, safety classification, the vendor locks on safety-invariant parameters, their direction of strictness, and cross-key constraints. A tenant may tighten a safety invariant and can never loosen it (§2.1 preamble; K §5.1).
- Effective-dated values and locks, resolved as of any valid time and as known at any recorded time (§8.1 P2, P9; §2.2 rule 2).
- The facility-level clinical tier `CORE` / `CLINICAL_SAFETY` (§6.6; K-24).
- The data behind tenant business calendars: weekend days and holidays as configuration ([L] L-20; §7 item 1; §11.7; D3).

**Out of scope.** Signed bundles, change sets, approvals, promotion, three-way merges, content types, flags and kill switches belong to `platform-config` (§5.2; ADR-020; D2). Content items (order sets, CDS rules, escalation policies, tariffs) are not values in this chain; a setting may point at one through a `CONTENT_REF` value (5.3). `platform-config` depends on `hms.platform.tenancy.api` only, and implements the `ChangeSetVerifier` port that this module defines (D12). The Boundary Register belongs to `safety-registry` (§10.2). Bed status and occupancy belong to `adt` (§5.2, §8.4 Bed; OQ-T3). Users, roles and policy decisions belong to the Trust Plane (§5.2; WP-0.4).

**Why it matters for safety.** The SI parameters are vendor-locked in this chain (§2.1 preamble). If the chain resolves a looser value at some unit, an invariant is weakened there without anyone deciding it. If a unit is attached to the wrong facility, it inherits the wrong clinical tier. If any caller could write the chain directly, the approval, signature and synthetic-content gates of `platform-config` would mean nothing. These are the subject of the proposed hazard HAZ-T1 (section 15).

## 2. What is in WP-0.3 and what waits

Status words: **Built now** means code and tests in the first WP-0.3 pass (pure Kotlin, cluster-free, DN-040). **Later WP-0.3 slice** means specified here and written later in WP-0.3, with tests that wait for the cell. **Specified only** means this spec fixes the contract (a port, a refusing binding) and the real implementation comes in a later work package. **Not built** means out of WP-0.3.

| Part | Status in WP-0.3 | Waits for | Why |
|---|---|---|---|
| Hierarchy domain model, invariants, commands | **Built now**: pure Kotlin `domain`, unit and property tests | — | §21 WP-0.3 |
| Configuration chain: definitions, direction samples, write rules, locks, cross-key constraints, resolution, as-of | **Built now**: pure Kotlin `domain`, unit and property tests | — | Exit criterion "a locked setting cannot be overridden below its lock" (§21) |
| Clinical-tier setting and its structural lock | **Built now** (definition, write and read rules, tests) | Its readers (`orders`, `medications`, `transfusion`, R2a/R2b) | §6.6 |
| Calendar data (weekend, holidays, facility zone) → `BusinessCalendar` | **Built now** (definitions and assembly) | The Kurdistan pack values (WP-1.1, `PLT-CFG-02`) | L-20; D3 |
| `EntryTimePolicyResolver` (implements the kernel's `EntryTimePolicySource`, 5.12) | **Built now**, with its test. In production it answers `NotConfigured` for every timing class, because no tolerance has a value (kernel DN-KN1) | The tolerance values (CSO, DN-KN1) | D11; D16; kernel §6.3 |
| Repository ports | **Built now** | — | — |
| In-memory adapters | **Built now** in `hms.platform.tenancy.inmemory`, for tests and the dev profile only (D8) | — | `app-hms` production wiring never binds them; see 11 |
| Journal rows for every accepted command (write-audit trail and outbox) | **Built now** against `hms.kernel.journal`'s `JournalAppender` | The jOOQ adapter and Debezium wiring (journal spec; cell) | §5.3 C |
| `TenancyAudit` production binding `OperationalLogTenancyAudit` (PHI-free operational record of refusals) | **Built now**, with its test | BALP AuditEvents (WP-0.4, `trust-audit`) | R07 AU-1; D16 |
| PostgreSQL schema, Flyway migrations, jOOQ adapters | **Later WP-0.3 slice** [P]; writing them needs no cell (DN-040) | Running their integration tests waits for the cell (WP-0.2) | DN-040 allows schemas now; this is a sequencing choice [P] |
| Persistence-backed evidence of the lock exit criterion | **Later WP-0.3 slice**: written as `src/integrationTest`, recorded as waiting | The cell (WP-0.2) | DN-040 |
| Change-set verification (`ChangeSetVerifier`, D12) | **Specified only**: port defined here; test double only. No production binding, so every configuration write is refused in a deployed system (KA-T4) | `platform-config` with persistence | D12; §19.4 |
| Authorisation (who may write at which level) | **Specified only**: port; deployed wiring denies every write (KA-T2) | WP-0.4 (`trust-policy`) | §7 item 2; ADR-013 |
| Back-dating decision for retroactive changes | **Specified only** (the journal's `BackDatingAuthorization` port); its production binding refuses every back-dated append (D10), so every retroactive change is refused (KA-T5) | WP-0.4 | SI-10 |
| Verification of site evidence for governed changes (clinical tier, RG1–RG4) | **Specified only**: port; deployed wiring refuses every change that needs it (KA-T3) | Readiness evidence tooling (WP-0.9, `IMP-RDY-01`) | §6.6 |
| Location attributes (gender restriction, isolation capability, telemetry, level of care), HealthcareService, stores, payer and referring organisations | **Not built** | WP-1.1 (`PLT-CORE-02` full) | §8.2; §21 WP-1.1 |
| Effective-configuration cache invalidated by events | **Not built**; every read resolves from the repository [P] | After persistence; a performance need | R08 §5 |

## 3. Packages and dependencies

| Package | Holds |
|---|---|
| `hms.platform.tenancy.api` | Typed ids, `NodeKind`, `Axis`, `ConfigLevel`, `ConfigScope`, `ScopeAddress`, `ResolutionContext`, `SettingDefinition` and its parts, `TypedSettingKey`, `SettingGroup`, command and result types, event payloads, the query and command interfaces, the `ChangeSetVerifier` port that `platform-config` implements, the definitions this module declares (`TenancySettings`) |
| `hms.platform.tenancy.api.testing` | The `VendorLockHarness` and a synthetic chain for other modules' tests (section 13). Test sources only (D8 rule below) |
| `hms.platform.tenancy.domain` | `EnterpriseStructure`, `TenantConfiguration`, `UserPreferences` (aggregates), `SettingCatalogue`, the write rules and the resolver. Pure Kotlin, no framework types, no system clock (arch rules (a) and (d)) |
| `hms.platform.tenancy.application` | Command and query handlers; idempotency; the unit of work that appends journal rows; the ports `TenancyAuthorization`, `TenancyAudit`, `GovernedChangeVerifier` and the repository ports; the production bindings `DenyAllTenancyAuthorization`, `RefusingGovernedChangeVerifier` and `OperationalLogTenancyAudit` (section 10) |
| `hms.platform.tenancy.application.settings` | `EntryTimePolicyResolver`, the implementation of the kernel's `EntryTimePolicySource` (5.12). The only tenancy package in the kernel's `SAFETY_PARAMETER_RESOLVERS` allow-list (kernel §6.5; D11) |
| `hms.platform.tenancy.infrastructure.persistence` | jOOQ adapters (later slice); the only tenancy package that may call `RecordedTime.restore` (kernel rule `..infrastructure.persistence..`) |
| `hms.platform.tenancy.inmemory` | In-memory repository adapters, each implementing the shared `VolatileStore` marker (D8; section 11) |
| `hms.platform.tenancy.events` | Mappers from journal rows to the published event payloads |

No `web` package in WP-0.3: the administration screens come with WP-1.1.

**Dependencies (main).** `:platform:ids`, `:platform:time`, `:platform:context` (D1), `:platform:journal`, `:platform:events`. No application module. The Gradle file lacks `:platform:context`, `:platform:journal` and `:platform:events` today; the integrator adds them (CA-27).

**Arch rules this module needs** (in `:platform:arch-rules`, D7):
- `ArchTest:config-commands-only-from-platform-config`: only `hms.platform.config..` may depend on `ConfigurationCommands` and `ApplyConfigurationChanges`. Every other module reads only. User preferences use `UserPreferenceCommands` (D12).
- `ArchTest:production-never-binds-test-adapters` (the kernel's shared D8 rule, kernel §11): no main class outside `..testing..` and `..inmemory..` packages depends on `hms.kernel.testing..` or on any `..testing..` or `..inmemory..` package, except `app-hms`'s dev and test wiring package named by the `app-hms` specification. This module adds no rule of its own for it.
- `ArchTest:safety-parameter-factories-only-in-resolvers` (the kernel's D11 rule, kernel §6.5): `hms.platform.tenancy.application.settings..` is on its allow-list; no other tenancy package calls `EntryTimePolicy.fromResolved`.
- `ArchTest:resolved-setting-built-only-by-resolver`: `Resolution.Resolved` and `SettingProvenance` have internal constructors; only `hms.platform.tenancy..` builds them in main code, and `..testing..` builds synthetic ones in tests (D11).

## 4. The enterprise hierarchy

### 4.1 Axes and node kinds

Three axes, cross-referenced (§8.2; R11 §2 "a ward belongs physically to a building but organisationally to a department and financially to a cost centre"; R08 §5 "model separate axes, not one tree"). A node has at most one parent on each axis at any valid instant.

| Node kind | Organisational parent | Physical parent | Financial link | FHIR anchor (R11 §2) |
|---|---|---|---|---|
| `TENANT` | — (root) | — | — | none (platform concept) |
| `LEGAL_ENTITY` | `TENANT` | — | — | `Organization` |
| `FACILITY` | `LEGAL_ENTITY` | — (physical root) | — | `Location` (si) + `Organization` |
| `BUILDING` | — | `FACILITY` | — | `Location` (bu) |
| `FLOOR` | — | `BUILDING` | — | `Location` (lvl) |
| `DEPARTMENT` | `FACILITY` | — | optional cost centre | `Organization` (type dept) |
| `UNIT` (ward) | `DEPARTMENT` (required [P]) | `FLOOR` | optional cost centre | `Location` (wa) |
| `ROOM` | — | `UNIT` [P] | — | `Location` (ro) |
| `BED` | — | `ROOM` | optional cost centre (§8.2) | `Location` (bd) |
| `SERVICE_POINT` | `DEPARTMENT` or `FACILITY` [P] | `FLOOR` or `UNIT` [P] | optional cost centre | `Location` / `HealthcareService` later |
| `COST_CENTRE` | — | — | parent `LEGAL_ENTITY` (financial axis) | ERP, not FHIR (R11 §2) |

`UNIT` and `SERVICE_POINT` are the junction nodes: they sit on both the organisational and the physical axis. The shape choices marked [P] (a unit always has a department; departments do not nest; no campus level, which R08 §5 has and §7 item 1 does not; a room hangs only under a unit; one country pack per tenant) are confirmed with the first customer's master data in WP-1.1 (OQ-T2).

`ServicePointKind` is `CLINIC`, `COUNTER`, `LABORATORY`, `OT_SUITE`, the four examples §7 item 1 names. New kinds are additive.

### 4.2 Node attributes and identifiers

Every node: `id` (`NodeId`, UUIDv7), `tenant` (`TenantId`), `kind`, `code` (short local code), `displayNames` (map from a BCP 47 language tag to a name; at least one) [P], `validPeriod` (`hms.kernel.time.ValidPeriod`, half-open), parent links per axis (each effective-dated), an optional effective-dated cost-centre link, and the `RecordedTime` of each change.

**Identifiers (D1).** `TenantId`, `FacilityId` and `UserId` are `hms.kernel.ids` types. `NodeId`, `LegalEntityId`, `DepartmentId` and `UnitId` are this module's and implement `TypedId` with `UuidV7.requireV7` in `init`. A kind-specific id wraps the same UUID as the node's `NodeId`. `NodeId.of(id)` converts; a kind-specific id is accepted only where the node has that kind (H-3, W-8, `contextOf`).

Kind-specific: `TENANT.countryPack` (`CountryPackId`, effective-dated; the Kurdistan pack is `kri`, matching the `kri.*` items in ASSUMPTIONS.md); `FACILITY.zone` (an IANA `ZoneId`, required at creation, never defaulted in code, effective-dated; §8.1 P10); `SERVICE_POINT.kind`.

Location attributes from §8.2 (gender restriction, isolation capability, telemetry, level of care), HealthcareService, stores and payer or referring organisations wait for WP-1.1.

### 4.3 Invariants

Each is enforced in the domain, so it holds for every channel (§2.2 rule 7; R11 P11). Each has a test in section 13.

| # | Invariant | Source |
|---|---|---|
| H-1 | **Acyclic.** No node is its own ancestor on any axis at any valid instant | R11 §2 (a tree per axis); follows from H-3, tested separately |
| H-2 | **One parent per axis.** A node's parent links on one axis never overlap in valid time. Root kinds (`TENANT`; `FACILITY` on the physical axis) have none | R08 §5; R11 §2 |
| H-3 | **Levels in order.** A parent's kind is one of the kinds allowed in 4.1 for that axis | §7 item 1; §8.2 |
| H-4 | **Tenant isolation.** A node, its parents and its cost centre belong to one tenant. No command, query or resolution crosses tenants; a foreign id is answered as "not found", never with another tenant's data | ADR-006; §6.4 (`tenant_id` on every row); R07 AZ-6 |
| H-5 | **No deletion.** Nodes are retired by closing their valid period; retired nodes stay readable for as-of queries. There is no delete command, and no repository port has a delete operation | §2.2 rule 2; §8.1 P3 |
| H-6 | **Nested validity.** A node's valid period lies inside each parent's valid period. A node cannot be retired while it has a child on any axis whose period extends beyond the retirement instant; the children are moved or retired first | [P], from H-5 |
| H-7 | **Junction consistency.** A unit's facility through its department equals its facility through floor and building; the same for a service point. A cost centre's legal entity equals the legal entity of the node's facility | [P], from §8.2 "separate but cross-referenced" |
| H-8 | **Unique codes.** Among nodes of the same kind whose valid periods overlap, a `code` is unique: tenant-wide for `LEGAL_ENTITY`, `FACILITY` and `COST_CENTRE`; within the facility for `BUILDING`, `FLOOR`, `DEPARTMENT`, `UNIT` and `SERVICE_POINT`; within the parent for `ROOM` (unit) and `BED` (room). Group tenants reuse unit and room codes across hospitals (K §7.7) | [P]; OQ-T2 |
| H-9 | **Moves are effective-dated.** A move closes the old parent link and opens the new one at the same instant; history is never rewritten | §8.1 P3 |

**Scope addresses.** H-8 gives every configuration node a natural address that is the same in every environment: a `ScopeAddress` of the level and the codes from the facility down (for example facility code, then unit code), or the legal-entity code. Bundles name scopes by address, because node ids differ between BUILD, TEST, TRAIN and PROD (CA-12). `EnterpriseDirectory.resolveAddress` maps an address to a `ConfigScope` as of a time, or refuses. Whether the hierarchy itself is promoted between environments is OQ-T10.

`EnterpriseStructure` is one aggregate per tenant with one version [P]: H-6 and H-7 span many nodes, and enterprise structures are small (a few thousand beds at most), so per-tenant optimistic concurrency is simple and enough.

### 4.4 Node lifecycle

A node is `ACTIVE` at valid instant t when t lies in its valid period, `PLANNED` before it and `RETIRED` after it. There is no other state.

Commands: `CreateNode`, `UpdateNode` (code, names, cost-centre link), `MoveNode` (new parent on one axis from a valid instant), `RetireNode` (closes the valid period), `ChangeCountryPack` (tenant; from a valid instant), `ChangeFacilityZone` (facility; from a valid instant). Each carries the kernel `CommandContext` and a `ChangeReason`.

- A future `validFrom` plans a change; its row is `EFFECTIVE_DATED`. A `validFrom` earlier than the recorded time is retroactive: the kernel classifier (valid-time kind `EFFECTIVE`, start before the recorded time) classifies the row `BackDated` (`BACK_DATED`), which requires a back-dating decision and an entered reason (D10; kernel §6.2; 5.7). In WP-0.3 that decision is always refused (KA-T5).
- `ChangeCountryPack` changes every resolution of the tenant. It is never retroactive, needs the `enterprise.structure.governed` permission, and is reported to `TenancyAudit` [P] (CA-37).
- `ChangeFacilityZone` changes the facility's calendars and local-time display. It is never retroactive and needs the same permission [P].

## 5. The configuration chain

### 5.1 Levels and write paths

`ConfigLevel`, from least to most specific (§6.6; K §7.7):

`VENDOR_FOUNDATION` → `COUNTRY_PACK` → `TENANT` → `LEGAL_ENTITY` → `FACILITY` → `DEPARTMENT` → `UNIT` → `USER`

| Level | Scope | Written only by (D12; section 10) |
|---|---|---|
| `VENDOR_FOUNDATION` | none (global) | The definition's coded default, or the activation of a verified vendor foundation bundle in this tenant's database |
| `COUNTRY_PACK` | a `CountryPackId` (`kri`) | The activation of a verified country-pack bundle for that pack (`PLT-CFG-02`) |
| `TENANT` … `UNIT` | the tenant, or an organisational node of that kind | An approved change set applied in BUILD or PLAY, or the activation of a verified tenant-overlay bundle in TEST, TRAIN or PROD (`platform-config` §8) |
| `USER` | a user within a tenant | The user, through `UserPreferenceCommands`, ordinary keys only (D-4) |

There is no other write path. Administrators author change sets in `platform-config`; they do not write this chain directly (SAF-01). `ConfigurationCommands` is open only to `hms.platform.config` (arch rule in section 3), and every batch is verified through the `ChangeSetVerifier` port (W-16 … W-18).

**Where vendor and pack values live.** Each tenant has its own database (ADR-006; §6.4). Vendor-foundation and country-pack entries are stored in each tenant's `TenantConfiguration`, as copies written by that tenant's activation of the vendor or pack stream. Activation is per tenant; a multi-tenant site rolls a vendor bundle out tenant by tenant, and each tenant's activation is atomic on its own (`platform-config` owns the rollout) [P] (CA-08, SAF-18).

Physical nodes (building, floor, room, bed) and service points are not configuration levels. They map onto the chain through the context mapping below.

### 5.2 Resolution context and its mapping onto the hierarchy

```kotlin
data class ResolutionContext(
    val tenant: TenantId,                  // hms.kernel.ids
    val legalEntity: LegalEntityId? = null,
    val facility: FacilityId? = null,      // hms.kernel.ids
    val department: DepartmentId? = null,
    val unit: UnitId? = null,
    val user: UserId? = null,              // hms.kernel.ids
)
```

- The chain for a context is: vendor foundation; the tenant's country pack as of t (if any); the tenant; then each organisational node given, from legal entity down to unit; then the user.
- Lower fields may be left out. A context with a unit and nothing else between it and the tenant is completed from the hierarchy as of t (unit → department → facility → legal entity). Fields that are given must agree with the hierarchy as of t; otherwise resolution is refused with `INCONSISTENT_CONTEXT` [P]. A wrong context never resolves silently.
- `EnterpriseDirectory.contextOf(tenant, node, at)` builds the context for any node: a room or bed maps to its unit (bed → room → unit, physical axis); a building or floor maps to its facility; a service point maps to its organisational parent (department or facility); a cost centre is not a configuration context and is refused.
- A node that is not `ACTIVE` at t, or belongs to another tenant, is refused (`SCOPE_NOT_FOUND`), never skipped.
- `ConfigurationQueries.chainOf(context, at)` returns the completed, validated chain of scopes, or the same typed refusal. `platform-config` uses it for kill-switch scope checks and never rebuilds the chain itself (CA-10).
- As-was: the hierarchy used to build the chain is the one known at `knownAt` (5.7).

### 5.3 Setting definitions

A setting is declared in code by its owning module, in that module's `api` package, and registered in the `SettingCatalogue` when the application assembles (§6.2 "no tenant-specific code": the definition is product code, the values are configuration) [P]. The catalogue is the one store of setting definitions (D2). `platform-config` registers each flag's backing setting here.

```kotlin
class SettingDefinition<T : Any>(                // not a data class: no copy() that bypasses the catalogue
    val key: SettingKey,                       // "platform.tasks.orphan-alarm.max-delay" (owned by platform-tasks)
    val type: SettingValueType<T>,
    val owner: String,                         // owning module id, e.g. "platform-tasks"
    val allowedLevels: Set<ConfigLevel>,       // a write rule and a read filter
    val lockableAt: Set<ConfigLevel>,          // levels that may apply a governed lock; empty = not lockable
    val safety: SafetyClass,
    val vendorLock: VendorLock<T>,
    val vendorDefault: T?,                     // the coded VENDOR_FOUNDATION value
    val configurationRequired: RequiredBecause?, // set when vendorDefault is null on a safety key (D-2)
    val requiredAt: ConfigLevel?,              // every ACTIVE node of this level must resolve a value (W-20)
    val mergeRule: MergeRule,                  // MOST_SPECIFIC, or UNION for collection types (D-10)
    val changeControl: ChangeControl,          // ROUTINE or GOVERNED
    val siteEvidence: EvidenceKind?,           // e.g. READINESS_RG1_RG4; checked by GovernedChangeVerifier (W-10)
    val tier2Binding: Tier2Binding,            // mandatory; no default (D-6)
    val sources: List<String>,                 // e.g. ["§2.1 SI-03"], ["[L] L-20"]
)

class TypedSettingKey<T : Any>(val key: SettingKey, val type: SettingValueType<T>)   // what readers hold

sealed interface SafetyClass {
    data object Ordinary : SafetyClass
    data class SafetyRelevant(val controls: Set<String>) : SafetyClass                          // CTRL ids
    data class SafetyInvariant(val invariants: Set<String>, val controls: Set<String>) : SafetyClass  // "SI-03"
}

sealed interface VendorLock<out T> {
    data object None : VendorLock<Nothing>
    data class Fixed<T>(val direction: Direction<T>?) : VendorLock<T>      // only the vendor level; see W-6
    data class TightenOnly<T>(val direction: Direction<T>) : VendorLock<T> // below vendor: at least as strict
}

enum class Order { STRICTER, EQUAL, LOOSER, INCOMPARABLE }

/** A partial order: compare(a, b) says how a stands against b. Code in the owning module, never configuration. */
fun interface Strictness<T> { fun compare(a: T, b: T): Order }

class Direction<T>(
    val strictness: Strictness<T>,
    val samples: List<DirectionSample<T>>,     // at least one; supplied and cited by the owning SI's spec
    val meet: ((T, T) -> T)? = null,           // optional: the strictest combination of incomparable values
)
class DirectionSample<T>(val reference: T, val looser: T, val stricter: T, val source: String)  // source: a CTRL id

data class RequiredBecause(val control: String)   // the hazard control that makes the value mandatory
sealed interface Tier2Binding {
    data object NotTier2 : Tier2Binding
    data class RestrictsTier2Function(val function: String) : Tier2Binding   // a restriction only, never sufficient to activate (D-6)
    data class GatesTier2Function(val function: String) : Tier2Binding       // always refused (D-6)
}
```

**Key grammar.** Dot-separated segments of `[a-z][a-z0-9-]*` (lower-case kebab-case). The first segment names the owner's area, or one of the reserved shared namespaces `calendar` (this module), `flag` (`platform-config` backing settings) and `platform.time.entry` (the kernel's SI-10 tolerance keys `platform.time.entry.<timing-class>.*`, kernel §6.3, declared by the module that owns each timing class). The namespace `tier2` is reserved and refused [P] (CA-24). Keys with camelCase segments are refused; the `platform-tasks` keys follow this grammar (section 16).

**Key families.** A family of keys whose members are known at assembly (for example one key per registered content type) is registered as one definition per member. Open-ended ids (escalation policies, order sets) are content, not settings; a setting may point at a content item through `CONTENT_REF` (CA-11).

**Value types** (`SettingValueType<T>`, a closed set [P]): `BOOLEAN`, `INTEGER(min, max)`, `DECIMAL(min, max, scale)` on `BigDecimal`, `DURATION(min, max)`, `STRING(pattern, maxLength)`, `ENUM(E)`, `SET(element, maxSize)` (a set of `ENUM` or `STRING` values), `DAY_OF_WEEK_SET`, `HOLIDAY_CALENDAR` (5.10), `ZONE_ID`, `CONTENT_REF(contentTypeId)` (a content type, item id and content hash; `platform-config` resolves it, gate G6). No `Double` or `Float` anywhere (§6.2). Each type validates a value and encodes it canonically, so `platform-config` serialises bundles deterministically and both modules compute the same `ChangesDigest` (5.5). The `min` and `max` bounds of a safety-classified type are values too: the owner cites their source in `sources`, or marks them as a content request (§3.4 item 3).

**Cross-key constraints (`SettingGroup`).** An owner may declare a group of keys with a pure predicate over their resolved values, for example the SI-03 bound `C + S + G + B + F ≤ L` in `platform-tasks` (directory staleness, scan interval, grace, scan budget and leader takeover against the orphan-alarm limit; `platform-tasks` §8) (SAF-06). The group is checked at write (W-19) and at read (5.6).

```kotlin
class SettingGroup(val id: SettingGroupId, val owner: String, val members: List<SettingKey>,
                   val constraint: GroupConstraint, val sources: List<String>)
fun interface GroupConstraint { fun check(values: Map<SettingKey, Any>): ConstraintResult }   // pure code
```

**Definition rules** (checked when the catalogue registers a definition; a violation stops the application from assembling, and a unit test runs the real catalogue):

| # | Rule | Source |
|---|---|---|
| D-1 | Keys follow the grammar and are unique | [P] |
| D-2 | `SafetyInvariant` ⇒ `vendorLock` is `Fixed` or `TightenOnly` and at least one SI is named. Any `SafetyInvariant` or `TightenOnly` key ⇒ `VENDOR_FOUNDATION ∈ allowedLevels`, and either `vendorDefault` is set, or `configurationRequired` names a hazard control and `changeControl` is `GOVERNED` (DN-T2) | §2.1 preamble; K §5.1; CA-14 (kernel DN-KN1) |
| D-3 | `Fixed` ⇒ `allowedLevels == {VENDOR_FOUNDATION}` | §6.6, K §7.7 ("vendor-locked") |
| D-4 | `SafetyRelevant` or `SafetyInvariant` ⇒ `USER ∉ allowedLevels` | Tightening [P] |
| D-5 | `TightenOnly` ⇒ `lockableAt` is empty. A governed lock would mask a stricter lower value, so a lock could loosen | Tightening [P] |
| D-6 | `tier2Binding` must be `NotTier2` or `RestrictsTier2Function` (a setting that can only restrict a Tier 2 function, never enable it, for example a `platform-config` backing setting); a definition declaring `GatesTier2Function` is refused. No key in the `tier2` namespace. A `BOOLEAN` or `ENUM` definition owned by a Tier 2 module (`hms.reg..`) is refused [P] (OQ-T11). Tier 2 activation is not a setting (5.9) | §2.1 SI-18; §10.2; CTRL-0018-1, CTRL-0018-6; D12 |
| D-7 | Every `Direction` has at least one sample. For each sample: `compare(stricter, reference) == STRICTER` and `compare(looser, reference) == LOOSER`. The samples come from the owning SI's spec and cite a control; this module never chooses them. Changing a sample is a safety-test change (§3.4 item 10) | D12; CA-02 |
| D-8 | `vendorDefault`, when set, passes the type's validation | [P] |
| D-9 | A `Fixed` key that is `SafetyRelevant` or `SafetyInvariant` declares a `Direction`, or none, in which case its vendor entries must equal the coded default (W-6) | D12; SAF-02 |
| D-10 | `mergeRule == UNION` only for collection types on `Ordinary` keys; never with `Fixed` or `TightenOnly` | [P] |
| D-11 | A `SettingGroup`'s members are registered, are owned by the group's owner, and none allows `USER` | [P] |
| D-12 | A definition with `siteEvidence` (evidence about one site, such as RG1–RG4) allows none of `VENDOR_FOUNDATION`, `COUNTRY_PACK` and `TENANT`: site evidence cannot be inherited | D12; CA-13, SAF-03 |
| D-13 | After `app-hms` has assembled, the catalogue is sealed; a later `register` returns `CatalogueSealed` | CA-21 |

The direction is how "tighten" is defined per parameter. For the SI-03 orphan alarm a shorter delay is stricter (CTRL-0003-1 "an orphan alarm later than 5 minutes is refused"); `platform-tasks` writes that comparator and its samples. This module never decides which direction is safer for a clinical parameter (§3.4 item 3). Its tests prove only that the declared direction is used, and the samples prove that the declared direction is the one the hazard log means.

### 5.4 Values, locks and aggregates

Both are append-only, bitemporal facts (§2.2 rule 2; §5.3 B):

- **Value entry:** `entryId`, `entrySeq` (position in the batch), `key`, `scope` (`ConfigScope`), `value` or `CLEARED`, `validPeriod`, `recordedAt` (`RecordedTime`), `changeSet` (`ChangeSetId`), `origin` and `contentProvenance` (`SYNTHETIC` or `APPROVED`), both taken from the verifier's verdict, never from the caller (§19.4), `actor`, `reason` (`ChangeReason`, never defaulted), `evidence` where given.
- **Lock entry:** `lockId`, `entrySeq`, `key`, `scope`, `validPeriod`, `recordedAt`, `changeSet`, `origin`, `actor`, `reason`. A lock at scope S forbids values at every scope strictly below S on the chain for the contexts under S.
- A newer entry for the same key and scope supersedes an older one for the overlapping valid time. "Newer" is ordered by (`recordedAt`, `entrySeq`). Nothing is updated or deleted. "Clear" and "remove lock" are new entries.

Lock sources, in order of strength:
1. **Structural:** a level not in `allowedLevels`. Code only; no command removes it. The clinical tier is locked to `FACILITY` this way (5.8).
2. **Vendor:** `VendorLock.Fixed` or `TightenOnly`. Code only.
3. **Governed:** a lock entry applied at a scope in `lockableAt`, removable only at the same scope or above.

**Aggregates** (D6; journal mapping in 11):

| Aggregate | Aggregate id | Holds | Written by |
|---|---|---|---|
| `EnterpriseStructure` | the tenant id | nodes, links, country pack, zones | `EnterpriseStructureCommands` |
| `TenantConfiguration` | the tenant id | value and lock entries of every level from `VENDOR_FOUNDATION` to `UNIT`, and the last applied bundle origin per stream | `ConfigurationCommands` (`platform-config` only) |
| `UserPreferences` | the user id | `USER`-level value entries of one user | `UserPreferenceCommands` |

`TenantConfiguration` serialises every governed write of a tenant, so a parent's lock or tightening never races a child write. Such writes are rare: they arrive as change sets and bundle activations. `USER` preferences are written often, by every user, so they have their own aggregate per user (CA-20). A user write is checked against the tenant's entries read at write time (W-5, W-7); if a lock lands concurrently, the read filter still masks the user value (step 3).

### 5.5 Write rules

A command applies an ordered batch of changes (`SetValue`, `ClearValue`, `ApplyLock`, `RemoveLock`) to one aggregate. The batch is all-or-nothing: if any change is refused, nothing is written and the result names every refusal [P]. Each change is checked against the state left by the changes before it in the batch, over every instant of its valid period. A batch holds at most one change per (key, scope) (W-21).

`validFrom = null` means "from the recorded time of this command" (5.7). Clients and bundles send null for "now"; they never send their own clock reading (CA-22, SAF-25).

| # | Rule | Refusal (`WriteRefusal`) | Source |
|---|---|---|---|
| W-1 | The key is registered | `UnknownSetting` | [P] |
| W-2 | The scope's level is in `allowedLevels` | `LevelNotAllowed(level, allowed)` | §6.6 (clinical tier) |
| W-3 | The value passes the type's validation | `InvalidValue(violations)` | R08 §5 "typed and schema-validated" |
| W-4 | `VendorLock.Fixed`: any write below `VENDOR_FOUNDATION` is refused | `VendorLocked(key)` | §2.1 preamble; §6.6; K §7.7 |
| W-5 | `TightenOnly`, below the vendor level: the value must be `STRICTER` or `EQUAL` against the effective value of the parent scope at every instant of its valid period. `INCOMPARABLE` is refused. If the parent resolves `NotConfigured`, a write below `COUNTRY_PACK` is refused (a tenant cannot tighten a value that does not exist); at `COUNTRY_PACK` it is accepted only as a `GOVERNED` change (DN-T2). For a `USER` scope the parent is the tenant's effective value | `LooserThanParent(parentValue, parentProvenance)`, `IncomparableWithParent`, `ParentNotConfigured` | §2.1 preamble ("may tighten, never loosen"); SAF-05; CA-14; CA-28 |
| W-6 | `TightenOnly`, and `Fixed` on a safety-classified key, at the vendor level: a vendor value is never looser than (and never incomparable with) the coded `vendorDefault`. A `Fixed` safety key without a `Direction` accepts only a value equal to the coded default. With no coded default (`configurationRequired`), the first vendor or pack value is accepted only as a `GOVERNED` change. Loosening an SI parameter is a code change with hazard-log review (§3.4 item 1) | `LooserThanVendorDefault`, `NotEqualToCodedDefault` | D12; SAF-02; tightening [P] |
| W-7 | No governed lock on this key is in effect at a scope strictly above the target scope during the valid period. For a `USER` scope: no lock at `TENANT` or above; locks lower on a context's chain mask the user value on read | `BelowLock(lockScope, lockId)` | §6.6; exit criterion (§21); CA-28 |
| W-8 | The scope exists, belongs to the command's tenant, has the kind the scope names, and is `ACTIVE` over the whole valid period | `ScopeNotFound`, `ScopeNotActive`, `ScopeKindMismatch` | H-4; CA-30 |
| W-9 | A `ChangeReason` and an actor are given (the kernel type cannot be blank). `USER` preferences need no reason [P] | `ReasonRequired` | R07 AU-1 (who and why); after SI-02 ("never defaulted") |
| W-10 | `GOVERNED` key, any change kind (set, clear, lock, remove lock), and every change W-23 makes governed: the verdict must say that the approvals include the governed-change roles `platform-config` requires (`governedRolesApproved`), confirmed from human evidence or carried by a verified bundle whose items passed gate G9 (W-16). If the definition names `siteEvidence`, the change must also carry an `EvidenceRef` that `GovernedChangeVerifier` accepts for this key, scope, before and after | `GovernedApprovalMissing`, `GovernedEvidenceMissing`, `GovernedEvidenceRejected` | §6.6 ("a governed change backed by RG1–RG4 evidence"); D12; CA-16 |
| W-11 | A `validFrom` before the recorded time is retroactive. Refused for `SafetyRelevant` and `SafetyInvariant` keys. For ordinary keys the journal row is `BackDated` and needs a back-dating decision (D10), which WP-0.3 always refuses | `RetroactiveNotAllowed`; the journal's back-dating refusal | Tightening [P], after SI-10 ("back-dating is privileged and audited") |
| W-12 | `ApplyLock`: the scope's level is in `lockableAt`. If values exist strictly below the scope during the lock's period, the lock is refused unless the batch also ends them | `NotLockable`, `DescendantOverridesExist(entries)` | [P] |
| W-13 | `RemoveLock`: the lock exists and the scope is the lock's scope or above | `LockNotFound`, `NotAtLockScope` | [P] |
| W-14 | The batch's expected aggregate version matches | `VersionConflict(expected, actual)` | §6.2 |
| W-15 | The actor is permitted (`TenancyAuthorization`; section 10) | `NotPermitted` | §5.2 (calls Trust) |
| W-16 | `ConfigurationCommands` only: `ChangeSetVerifier.verify` returns `Verified` for this tenant, this change-set id and this batch's `ChangesDigest`. Anything else (`NotVerified`, `Unavailable`, no binding) refuses the whole batch | `ChangeSetNotVerified(reason)` | D12; CA-01, SAF-01 |
| W-17 | The verified origin fits each change's level and the environment. `VENDOR_FOUNDATION`: only a vendor-foundation bundle activation. `COUNTRY_PACK(p)`: only an activation of pack p's stream. `TENANT` … `UNIT`: an applied change set (environment class BUILD or PLAY) or a tenant-overlay bundle activation. `USER`: never through this command | `OriginNotAllowedForLevel`, `OriginNotAllowedInEnvironment` | D12; §6.6; `platform-config` §8 |
| W-18 | A `SYNTHETIC` verdict is refused when the deployment's environment class is TRAIN or PROD. Defence in depth behind `platform-config`'s gate G8 | `SyntheticNotAllowed` | §19.4 "Synthetic content is a gate, not a label"; D11 |
| W-19 | Every `SettingGroup` with a changed member still holds at every context under the changed scope, at every instant of the valid period (it is enough to check each boundary instant of the relevant entries and hierarchy links) | `GroupConstraintViolated(group, context, instant)` | SAF-06 |
| W-20 | A batch never makes an `ACTIVE` node of a definition's `requiredAt` level stop resolving a value | `RequiredValueMissing(node)` | SAF-06 |
| W-21 | At most one change per (key, scope) in a batch | `DuplicateTargetInBatch` | CA-29 |
| W-22 | A bundle-activation origin has a sequence greater than the last one applied for that stream in this tenant. The same manifest hash again is an idempotent repeat | `StaleBundleSequence` | CA-09; `platform-config` INV-12 |
| W-23 | **Relaxation is governed.** A change to a `TightenOnly` key (or a safety `Fixed` key with a direction) that leaves the effective value at some context under the scope looser than before the batch is treated as `GOVERNED` (W-10), even though it stays at least as strict as the parent | `GovernedApprovalMissing` | Tightening [P]; SAF-20 |

Clearing a tighten-only value is allowed: the result is the parent's effective value, which is never looser than the vendor's. If that is looser than the cleared value, W-23 applies. The journal row still records the before and after values.

**Dry run.** `ConfigurationQueries.validate(cmd)` runs every rule except W-14 and W-16 … W-18, and writes nothing. It returns the refusals and the indexes of the changes that are governed (by definition or by W-23), so `platform-config` can require the governed-change roles at submit. `platform-config` uses it at change-set submit and in gate G7, so the rules exist in one place (CA-10).

### 5.6 Resolution

`resolve(key, context, at)` returns `Resolved(value, provenance: SettingProvenance)`, `NotConfigured(key)`, `Refused(reason)` or `Unavailable(cause)`. It never throws for a business outcome (§6.2). A store failure is `Unavailable`, never a default and never `NotConfigured` (D13).

The caller passes a `TypedSettingKey<T>`. The resolver uses the registered definition for that key, never one supplied by the caller. A key whose type differs from the registered definition's is refused with `DEFINITION_MISMATCH` (CA-21).

1. Build the chain of scopes from the context, using the hierarchy as of `validAt`, as known at `knownAt` (5.2).
2. For each scope, take the value entry in effect at `validAt` as known at `knownAt` (the newest by (`recordedAt`, `entrySeq`) with `recordedAt ≤ knownAt`, covering `validAt`). A `CLEARED` entry means no value at that scope.
3. **Read filter (defence in depth).** Ignore values at levels not in `allowedLevels`. For `Fixed`, ignore every value below the vendor level; for a safety `Fixed` or `TightenOnly` key, ignore a vendor value that W-6 would refuse. Find the most general scope with a governed lock in effect; ignore every value strictly below it. Ignored entries are reported in the provenance as `masked`, with the reason.
4. **`MOST_SPECIFIC` keys (ordinary and `Fixed`):** the value of the most specific remaining scope wins.
5. **`TightenOnly` keys:** the strictest remaining value wins; on a tie, the most specific. If the remaining values have no unique strictest element, the definition's `meet` combines them when it has one; otherwise the answer is `Refused(INCOMPARABLE_VALUES)` (SAF-05). Each caller's spec must name its fail-closed mechanism and test for that answer; this module claims none.
6. **`UNION` keys:** the union of the remaining values; every contributing entry is in the provenance.
7. No remaining value: the coded `vendorDefault` with source `DefinitionDefault`; if there is none, `NotConfigured(key)`. For `NotConfigured`, `Refused` and `Unavailable`, each caller's spec must name its fail-closed mechanism and test ("unavailable, manual check required"; §3.5); this module claims none. Its own caller, `EntryTimePolicyResolver`, does so in 5.12.
8. **Groups.** If the key belongs to a `SettingGroup`, the group is evaluated at this context; a violation answers `Refused(CONSTRAINT_VIOLATED)`. `resolveGroup` returns every member resolved together, so a caller never mixes values from two different states.

```kotlin
class SettingProvenance internal constructor(   // not hms.kernel.events.Provenance
    val level: ConfigLevel,
    val scope: ConfigScope,
    val source: Source,              // DefinitionDefault | Entry(entryId, changeSet, origin, contentProvenance, recordedAt, validPeriod)
    val contributors: List<Source>,  // UNION and meet results: every entry used
    val masked: List<MaskedEntry>,   // entries ignored in steps 3 and 5, with the reason
    val catalogueVersion: CatalogueVersion,   // hash of every registered definition, canonical form
)
```

`catalogueVersion` records which definitions answered. As-was answers use the definitions of the running release; a release that changes a definition (`vendorDefault`, `allowedLevels`, a comparator) can change past answers, and the recorded version shows when that happened [P] (CA-35). Keeping historical definitions is not planned.

**Resolution properties** (each is a property test, section 13):
- **R-L (locks).** For every context under a lock scope S, the result never comes from a scope strictly below S, whatever entries exist below S, including entries planted in the repository past the write rules.
- **R-T (tighten-only).** For every context, the result is `STRICTER` or `EQUAL` against every remaining value on its chain and the coded default, or the answer is `Refused(INCOMPARABLE_VALUES)`.
- **R-S (most specific).** With no lock and a `MOST_SPECIFIC` ordinary key, the result is the most specific value on the chain.
- **R-A (as-was stability).** Entries recorded after `knownAt` never change `resolve(…, knownAt)` under the same catalogue version.
- **R-C (clinical tier).** For every context under a facility, the tier equals the facility's own value, otherwise the coded default `CORE`. No other entry is ever used.
- **R-G (groups).** No `Resolved` member of a group comes from a state in which the group's constraint fails.

### 5.7 Effective dating, as-of and as-was

- Every value, lock and hierarchy link has a valid period. Future-dated changes are allowed. Retroactive ones follow W-11 and 4.4.
- `validAt` answers "what applied at that time". The caller passes the clinical time of the act being decided, never "now" by default: a back-entered act after downtime resolves configuration as of its paper time (SI-10; §6.2 "clinical time and recorded time are separate fields everywhere") (SAF-14).
- `knownAt` answers "what did the system believe then", which an investigation needs to explain a past decision (§7 item 3; §8.1 P2, P3). It is null for the latest knowledge. An as-was query builds it from an `Instant`, or with `AsOf.knownAt(validAt, recorded)` from a `RecordedTime` (D4; section 16). The domain never reads the clock (§6.2).
- `AsOf` is `hms.kernel.time.AsOf(validAt: Instant, knownAt: Instant? = null)`, with the kernel's `AsOf.latest(validAt)` and `AsOf.knownAt(validAt, recorded)`; this module declares no `AsOf` of its own (D4).
- **Recorded time.** The handler and the journal use one clock reading per command (D10). The handler does not read time from the transaction context. It builds its fact rows after `append` returns, in the same transaction, from `AppendResult.Appended.entries[0].recordedAt`. `validFrom = null` takes that reading. A `validFrom` at or after it is future-dated; one before it is retroactive.
- **Mapping to `EntryTiming` (D10).** The journal row's valid time is the recorded time when no change is retroactive (future validity is payload, like a due time), and the valid-time kind is `EFFECTIVE`, so the kernel classifies the row `EffectiveDated` (`EFFECTIVE_DATED`; kernel §6.2). When a change is retroactive, the row's valid time is the earliest retroactive `validFrom`, and the appender classifies it `BackDated`. The entry mode comes from the `CommandContext`, never from request input.
- Every `Resolved` carries enough provenance (entry id, change set, origin, recorded time, catalogue version) for a caller to record which configuration it acted on.

### 5.8 The clinical tier

§6.6 (K-24): `CORE` or `CLINICAL_SAFETY` is one facility-level setting, locked against department, unit and user override. `CLINICAL_SAFETY` turns on CPOE, pharmacist verification, eMAR/BCMA and transfusion verification together for every inpatient area of the facility, NICU and PICU included (CTRL-0005-14); none can be enabled on its own. `CORE` exposes no MAR, administration schedule or active-medicines view. Changing the tier is a governed change backed by RG1–RG4 evidence.

```kotlin
enum class ClinicalTier { CORE, CLINICAL_SAFETY }

val CLINICAL_TIER = SettingDefinition(
    key = SettingKey("platform.tenancy.clinical-tier"),
    type = ENUM(ClinicalTier::class),
    owner = "platform-tenancy",
    allowedLevels = setOf(FACILITY),                      // nothing above or below the facility (D-12)
    lockableAt = emptySet(),
    safety = SafetyRelevant(setOf("CTRL-0005-14")),
    vendorLock = VendorLock.None,
    vendorDefault = ClinicalTier.CORE,                    // coded default only, never a writable vendor entry [P], OQ-T5
    configurationRequired = null,
    requiredAt = null,
    mergeRule = MergeRule.MOST_SPECIFIC,
    changeControl = ChangeControl.GOVERNED,
    siteEvidence = EvidenceKind.READINESS_RG1_RG4,
    tier2Binding = Tier2Binding.NotTier2,
    sources = listOf("§6.6", "K-24"),
)
```

- Only `FACILITY` is allowed. A vendor-foundation, country-pack, tenant, legal-entity, department, unit or user write is refused (W-2), and any such entry planted in the store is ignored on read (step 3). So no vendor bundle can switch every facility to `CLINICAL_SAFETY`, and a new facility never inherits it (D12; CA-13, SAF-03).
- The coded default is `CORE`, the paper status quo for orders and the MAR (K-24) [P].
- Every change (set or clear, in either direction) is `GOVERNED` and needs site evidence that `GovernedChangeVerifier` accepts (W-10). Until that verifier exists, deployed wiring refuses it (KA-T3).
- **Test obligation for the modules that read it.** No configuration state may yield CPOE without eMAR/BCMA, or a MAR, administration schedule or active-medicines view, on any inpatient area of a facility, NICU and PICU included, unless the facility's tier is `CLINICAL_SAFETY`; and no state may leave NICU, PICU or any other inpatient area of a `CLINICAL_SAFETY` facility outside the loop (§6.6; CTRL-0005-14 `PropertyTest:clinical-tier-has-no-partial-loop (NICU and PICU included)`). `orders`, `medications` and `transfusion` derive these capabilities from this one value, never from separate settings or flags of their own, and each carries that property test when it is built (R2a/R2b). `platform-config` refuses flags that would enable a part of the loop per unit (SAF-19, its spec). This module proves only R-C and the write refusals.

### 5.9 Tier 2 activation is not a setting

A Tier 2 function activates for a tenant only where the Regulatory Boundary Register says "cleared" or "not required"; configuration toggles cannot override it (§2.1 SI-18; §10.2 "the flag service asks the Register before enabling any Tier 2 function"). So activation is not a value in this chain at any level:
- Every definition declares `tier2Binding`, with no default. The catalogue refuses `GatesTier2Function`, refuses the `tier2` namespace, and refuses `BOOLEAN` and `ENUM` definitions owned by a Tier 2 module (D-6).
- Tier 2 code reads activation only through the Register port (`ArchTest:tier-2-activation-only-through-register`, owned by `safety-registry` and `platform-config`, CTRL-0018-6).
- **What this module's test proves, and what it does not.** `PropertyTest:config-chain-vendor-lock-SI-18` proves that no registered definition declares a Tier 2 binding, no `tier2` key exists, and no Tier 2 module owns an on/off setting. It cannot prove that a setting of a non-Tier-2 module is never read as an activation switch. That is the arch rule's job. CTRL-0018-1 stays `planned` until both pass (CA-03, SAF-13).
- The tightening side of CTRL-0018-1 ("a tenant may tighten it") is the function's kill switch in `platform-config` (SI-19). Turning it on again still needs the Register. This is a reading of a hazard control, recorded as DN-T1 with a proposed amendment to CTRL-0018-1's description (SAF-21).

### 5.10 Calendars

Tenant calendars hold the Friday–Saturday weekend and the Kurdistan holidays as data [L] (§7 item 1; §11.7; L-20). The keys are generic (D3). This module declares the definitions and assembles a `hms.kernel.time.BusinessCalendar` from them and the facility's `zone`:

| Key | Type | Allowed levels | Lockable | Merge | Vendor default | Safety | Value source |
|---|---|---|---|---|---|---|---|
| `calendar.weekend-days` | `DAY_OF_WEEK_SET` | `COUNTRY_PACK`, `TENANT` | no | most specific | none | `Ordinary` | Kurdistan pack ([L] L-20 item `kri.calendar.weekend`) |
| `calendar.holidays` | `HOLIDAY_CALENDAR` | `COUNTRY_PACK`, `TENANT` | no | union | none | `Ordinary` | Kurdistan pack ([L] L-20 item `kri.calendar.holidays`); tenant additions |

- **`HOLIDAY_CALENDAR`** is a map from year to a set of holidays (date and name key), with the years it covers listed explicitly. A covered year with no holidays is a valid value. Next year's holidays are added by a new value that takes effect now and lists both years; they are not future-dated, so a deadline that crosses the year boundary sees them (CA-18).
- **Merge.** A tenant value adds local holidays; it never removes a pack holiday [P]. The covered years are those of the least specific level that has a value (normally the pack), so a tenant addition never makes a year look covered.
- Neither key is lockable. A pack lock would stop tenants adding local holidays (CA-26, SAF-27).
- No weekend day or holiday date appears in code. Tests use synthetic calendars.
- `CalendarReader.businessCalendar(context, at)` returns `NotConfigured` when either value is missing, `Refused(NO_FACILITY_ZONE)` for a context without a facility, and `Refused(INVALID_CALENDAR)` when `BusinessCalendar.of` refuses the values (`NoBusinessDayInWeek`, `HolidayOutsideConfirmedYears`). It calls the kernel's `BusinessCalendar.of(zone, weekend, holidays, confirmedYears)` with the value's holiday dates as one `Set<LocalDate>` and its covered years as `confirmedYears` (kernel §6.4); there is no separate confirmed-years setting. A calendar-aware SLA with no calendar must not quietly fall back to "no holidays".
- The answer carries a `CalendarProvenance`: both settings' provenance, the facility zone and the node version it came from, and a calendar version digest. `platform-tasks` records that version on each task.
- Safety-relevant timers (`TaskOrphaned`, clinical task SLAs, escalation) run on continuous time and never read the calendar; calendar-aware SLAs apply only to work types configured for them (`platform-tasks` spec).
- Open (OQ-T4): a facility-level override, and a calendar for tenant-level contexts that have no facility zone. §5.2 gives calendars and holidays to `platform-i18n`, which is not in WP-0.3; the definitions move there when it exists.

### 5.11 Definitions this module declares

`TenancySettings.CLINICAL_TIER`, `TenancySettings.WEEKEND_DAYS`, `TenancySettings.HOLIDAYS`. Other modules declare their own. For example, `platform-tasks` declares the SI-03 orphan-alarm limit (`platform.tasks.orphan-alarm.max-delay`; vendor default 5 minutes, §2.1 SI-03; `TightenOnly`, shorter is stricter, with its direction samples) and the group `C + S + G + B + F ≤ L` that binds it to the directory staleness, scan interval, grace, scan budget and leader takeover (`platform-tasks` §8). `platform-tasks` also declares the dead-letter alarm setting `platform.events.dead-letter-alarm-after` (`platform-tasks` §8). `platform-config` declares its flags' backing settings. The module that owns the SI-10 tolerances declares them `configurationRequired` until the CSO sets values (kernel DN-KN1; D-2).

### 5.12 The entry-time policy resolver

`hms.platform.tenancy.application.settings.EntryTimePolicyResolver` implements the kernel port `EntryTimePolicySource.policyFor(context, timingClass, at)` (kernel §6.3, §7.6; D2, D11). The journal reads the SI-10 tolerances only through it.

1. It builds a `ResolutionContext` from the `CommandContext`'s tenant and facility (kernel §6.3 "Resolution").
2. It names the four keys of the timing class: `platform.time.entry.<timing-class>.contemporaneous-tolerance`, `.future-tolerance`, `.interface-lateness-tolerance` and `.offline-capture-tolerance` (kernel §6.3; the reserved namespace in 5.3).
3. It looks each definition up with `SettingCatalogue.definition(key)`. If any is missing, it answers `NotConfigured(timingClass, missingKeys)`.
4. It resolves the four keys at the `AsOf` it is given (the journal passes `AsOf.latest(recorded)`), by the same resolution as every reader (5.6). If any key answers `NotConfigured`, it answers `NotConfigured` with the missing keys. If any key answers `Unavailable` or `Refused`, it answers `Unavailable`.
5. It converts each `Resolution.Resolved` and its `SettingProvenance` into a kernel `ResolvedParameter<Duration>`: the key, the value, the source entry's `ContentProvenance`, the entry id as `sourceRef` (or `definition-default`), and the change set.
6. It calls `EntryTimePolicy.fromResolved(timingClass, …, environment)` with the `EnvironmentClass` that `app-hms` injects (section 9). `Built` answers `Available(policy)`. `Refused` (for example a synthetic value in TRAIN or PROD) answers `Unavailable`.

It never answers a default and never throws for a business outcome. In production it answers `NotConfigured` for every timing class until DN-KN1 is answered, because no tolerance has a value (kernel DN-KN1). The journal refuses an append that needs a policy unless the answer is `Available` (journal §4.4). Test: `UnitTest:entry-time-policy-resolver-answers-not-configured`. It is the only tenancy class that calls `EntryTimePolicy.fromResolved` (section 3).

## 6. Public API (`hms.platform.tenancy.api`)

Kept small: other streams code against it (D17). Signatures are Kotlin-like. Every command carries the kernel `CommandContext` (D1) and every command handler is idempotent on its idempotency key (§22.1 item 2).

```kotlin
// Identifiers. TenantId, FacilityId, UserId: hms.kernel.ids (D1). These implement TypedId, requireV7 in init.
@JvmInline value class NodeId(override val value: UUID) : TypedId
@JvmInline value class LegalEntityId(override val value: UUID) : TypedId
@JvmInline value class DepartmentId(override val value: UUID) : TypedId
@JvmInline value class UnitId(override val value: UUID) : TypedId
@JvmInline value class LockId(override val value: UUID) : TypedId
@JvmInline value class ChangeSetId(override val value: UUID) : TypedId   // issued and owned by platform-config
@JvmInline value class CountryPackId(val value: String)                // "kri"
@JvmInline value class SettingKey(val value: String)
@JvmInline value class ChangesDigest(val sha256Hex: String) { companion object { fun of(changes: List<SettingChange>): ChangesDigest } }

enum class NodeKind { TENANT, LEGAL_ENTITY, FACILITY, BUILDING, FLOOR, DEPARTMENT, UNIT, ROOM, BED, SERVICE_POINT, COST_CENTRE }
enum class Axis { ORGANISATIONAL, PHYSICAL, FINANCIAL }
enum class ConfigLevel { VENDOR_FOUNDATION, COUNTRY_PACK, TENANT, LEGAL_ENTITY, FACILITY, DEPARTMENT, UNIT, USER }
enum class OrgLevelKind(val level: ConfigLevel) { LEGAL_ENTITY(ConfigLevel.LEGAL_ENTITY), FACILITY(ConfigLevel.FACILITY), DEPARTMENT(ConfigLevel.DEPARTMENT), UNIT(ConfigLevel.UNIT) }
// EnvironmentClass and ContentProvenance: hms.kernel.time (kernel §6.5). Imported, not declared here.

sealed interface ConfigScope {
    val level: ConfigLevel
    data object VendorFoundation : ConfigScope { override val level get() = ConfigLevel.VENDOR_FOUNDATION }
    data class CountryPack(val pack: CountryPackId) : ConfigScope { override val level get() = ConfigLevel.COUNTRY_PACK }
    data class Tenant(val tenant: TenantId) : ConfigScope { override val level get() = ConfigLevel.TENANT }
    data class Node(val tenant: TenantId, val node: NodeId, val kind: OrgLevelKind) : ConfigScope {
        override val level get() = kind.level                     // W-8 checks the node really has this kind
    }
    data class User(val tenant: TenantId, val user: UserId) : ConfigScope { override val level get() = ConfigLevel.USER }
}
data class ScopeAddress(val level: ConfigLevel, val codes: List<String>)   // e.g. FACILITY ["ERB-01"]; UNIT ["ERB-01", "ICU"]

data class NodeView(
    val id: NodeId, val tenant: TenantId, val kind: NodeKind, val code: String,
    val displayNames: Map<String, String>, val validPeriod: ValidPeriod,
    val parents: Map<Axis, NodeId>,          // as of the query's time
    val costCentre: NodeId?, val zone: ZoneId?, val servicePointKind: ServicePointKind?,
    val countryPack: CountryPackId?,
)
sealed interface ContextResult {
    data class Context(val context: ResolutionContext) : ContextResult
    data class Refused(val reason: ResolutionRefusal) : ContextResult
}

// Queries (AsOf = hms.kernel.time.AsOf)
interface EnterpriseDirectory {
    fun node(tenant: TenantId, id: NodeId, at: AsOf): NodeView?
    fun ancestors(tenant: TenantId, id: NodeId, axis: Axis, at: AsOf): List<NodeView>  // nearest first
    fun children(tenant: TenantId, id: NodeId, axis: Axis, at: AsOf): List<NodeView>
    fun contextOf(tenant: TenantId, id: NodeId, at: AsOf): ContextResult            // 5.2
    fun resolveAddress(tenant: TenantId, address: ScopeAddress, at: AsOf): ScopeResult // ConfigScope or refusal
}

interface ConfigurationReader {
    fun <T : Any> resolve(key: TypedSettingKey<T>, context: ResolutionContext, at: AsOf): Resolution<T>
    fun resolveGroup(group: SettingGroupId, context: ResolutionContext, at: AsOf): Resolution<ResolvedGroup>
}

interface CalendarReader {
    fun businessCalendar(context: ResolutionContext, at: AsOf): Resolution<CalendarResolution>  // calendar + CalendarProvenance
}

interface ConfigurationQueries {    // for platform-config (CA-10)
    fun entries(tenant: TenantId, filter: EntryFilter, at: AsOf): List<EntryView>   // raw value and lock entries by level, scope or key
    fun entryAt(tenant: TenantId, key: SettingKey, scope: ConfigScope, at: AsOf): EntryView?   // null = absent
    fun chainOf(context: ResolutionContext, at: AsOf): ChainResult                  // ordered scopes or a typed refusal
    fun validate(cmd: ApplyConfigurationChanges): ValidationReport                  // dry run (5.5): refusals + governed change indexes
    fun missingRequired(tenant: TenantId, at: AsOf): List<MissingRequired>          // W-20 gaps, for gates G5/G6
    fun lastActivation(tenant: TenantId, stream: BundleStreamRef): AppliedOrigin?   // W-22 record
}

sealed interface Resolution<out T> {
    class Resolved<T> internal constructor(val value: T, val provenance: SettingProvenance) : Resolution<T>
    data class NotConfigured(val key: SettingKey) : Resolution<Nothing>
    data class Refused(val reason: ResolutionRefusal) : Resolution<Nothing>
    data class Unavailable(val cause: UnavailableCause) : Resolution<Nothing>       // store or directory failure
}
enum class ResolutionRefusal {
    UNKNOWN_SETTING, DEFINITION_MISMATCH, INCONSISTENT_CONTEXT, SCOPE_NOT_FOUND, NOT_A_CONFIGURATION_CONTEXT,
    INCOMPARABLE_VALUES, CONSTRAINT_VIOLATED, NO_FACILITY_ZONE, INVALID_CALENDAR,
}

// Commands
interface EnterpriseStructureCommands {
    fun createNode(cmd: CreateNode): NodeCommandResult
    fun updateNode(cmd: UpdateNode): NodeCommandResult
    fun moveNode(cmd: MoveNode): NodeCommandResult
    fun retireNode(cmd: RetireNode): NodeCommandResult
    fun changeCountryPack(cmd: ChangeCountryPack): NodeCommandResult
    fun changeFacilityZone(cmd: ChangeFacilityZone): NodeCommandResult
}
// Each node command: context: CommandContext, reason: ChangeReason, expectedVersion: Long, and its fields
// (kind, code, names, parents, validFrom; or node, axis, new parent, validFrom; and so on).

interface ConfigurationCommands {          // only hms.platform.config may depend on this (section 3)
    fun apply(cmd: ApplyConfigurationChanges): ConfigurationCommandResult
}
data class ApplyConfigurationChanges(
    val context: CommandContext,           // hms.kernel.context
    val changeSet: ChangeSetId,
    val expectedVersion: Long,             // TenantConfiguration version (aggregate id = tenant id)
    val reason: ChangeReason,              // hms.kernel.context
    val changes: List<SettingChange>,      // ordered; at most one per (key, scope)
)                                          // no provenance field: it comes from the verifier (W-16)

interface UserPreferenceCommands {
    fun apply(cmd: ApplyUserPreferences): ConfigurationCommandResult
}
data class ApplyUserPreferences(
    val context: CommandContext, val user: UserId, val expectedVersion: Long,
    val changes: List<SettingChange>,      // USER scope of this user, ordinary keys only
)

sealed interface SettingChange {
    val key: SettingKey?; val scope: ConfigScope; val evidence: EvidenceRef?
    data class SetValue(override val key: SettingKey, override val scope: ConfigScope, val value: Any,
                        val validFrom: Instant?, val validTo: Instant?, override val evidence: EvidenceRef? = null) : SettingChange
    data class ClearValue(override val key: SettingKey, override val scope: ConfigScope, val validFrom: Instant?,
                          override val evidence: EvidenceRef? = null) : SettingChange
    data class ApplyLock(override val key: SettingKey, override val scope: ConfigScope, val validFrom: Instant?, val validTo: Instant?,
                         val endDescendantValues: Boolean = false, override val evidence: EvidenceRef? = null) : SettingChange
    data class RemoveLock(val lockId: LockId, override val scope: ConfigScope, val validFrom: Instant?,
                          override val evidence: EvidenceRef? = null) : SettingChange { override val key: SettingKey? get() = null }
}
// validFrom null = from this command's recorded time (5.7)

sealed interface ConfigurationCommandResult {
    data class Applied(val version: Long, val entries: List<UUID>) : ConfigurationCommandResult
    data class AlreadyApplied(val version: Long, val entries: List<UUID>) : ConfigurationCommandResult   // idempotent repeat
    data class Refused(val refusals: List<IndexedRefusal>) : ConfigurationCommandResult   // index into changes + WriteRefusal
}
sealed interface NodeCommandResult {
    data class Accepted(val node: NodeId, val version: Long) : NodeCommandResult
    data class Refused(val reason: NodeRefusal) : NodeCommandResult
}
// NodeRefusal: PARENT_KIND_NOT_ALLOWED, PARENT_NOT_FOUND, CROSS_TENANT, CYCLE, OVERLAPPING_PARENT,
//   OUTSIDE_PARENT_VALIDITY, HAS_ACTIVE_CHILDREN, FACILITY_MISMATCH, DUPLICATE_CODE, ALREADY_RETIRED,
//   RETROACTIVE_NOT_ALLOWED, VERSION_CONFLICT, NOT_PERMITTED

// Port defined here, implemented by platform-config (D12)
interface ChangeSetVerifier {
    fun verify(tenant: TenantId, changeSet: ChangeSetId, digest: ChangesDigest): ChangeSetVerdict
}
sealed interface ChangeSetVerdict {
    data class Verified(
        val tenant: TenantId, val changeSet: ChangeSetId, val digest: ChangesDigest,
        val origin: ChangeOrigin,
        val contentProvenance: ContentProvenance,   // SYNTHETIC | APPROVED (§19.4)
        val humanApproved: Boolean,                 // every required role confirmed by HumanApprovalSource, or bundle items passed G9
        val governedRolesApproved: Boolean,         // the approvals include the governed-change roles (W-10)
    ) : ChangeSetVerdict
    data class NotVerified(val reason: VerificationRefusal) : ChangeSetVerdict
    data object Unavailable : ChangeSetVerdict
}
sealed interface ChangeOrigin {
    data object AppliedChangeSet : ChangeOrigin                     // BUILD or PLAY
    data class BundleActivation(val stream: BundleStreamRef, val sequence: Long, val manifestHash: String) : ChangeOrigin
}
sealed interface BundleStreamRef {
    data object VendorFoundation : BundleStreamRef
    data class CountryPack(val pack: CountryPackId) : BundleStreamRef
    data object TenantOverlay : BundleStreamRef
}
enum class VerificationRefusal { UNKNOWN_CHANGE_SET, WRONG_TENANT, DIGEST_MISMATCH, NOT_APPROVED, BUNDLE_NOT_VERIFIED }

// Catalogue
interface SettingCatalogue {                       // read side
    fun definition(key: SettingKey): SettingDefinition<*>?
    fun group(id: SettingGroupId): SettingGroup?
    fun all(): List<SettingDefinition<*>>
    val version: CatalogueVersion
}
interface SettingCatalogueRegistrar {              // used during app-hms assembly only
    fun register(definitions: Collection<SettingDefinition<*>>, groups: Collection<SettingGroup> = emptyList()): CatalogueResult  // D-1 … D-13
    fun seal(): CatalogueVersion                   // later register calls return CatalogueSealed
}
```

Helper types, all in the api: `ScopeResult` and `ChainResult` (a scope or an ordered list of scopes, or a `ResolutionRefusal`); `EntryFilter` (level, scope, key, any combination); `EntryView` (one raw value or lock entry with its fields from 5.4); `ValidationReport` (indexed refusals and governed change indexes); `MissingRequired` (key, node); `AppliedOrigin` (stream, sequence, manifest hash, recorded time); `ResolvedGroup` (each member's value and provenance); `CalendarResolution` (`BusinessCalendar` and `CalendarProvenance`); `UnavailableCause` (`STORE`, `DIRECTORY`); `IndexedRefusal` (change index and `WriteRefusal`); `CatalogueVersion` (a SHA-256 of the definitions in canonical form); `CatalogueResult` (registered, or the D-rule refusals, or `CatalogueSealed`); `EvidenceRef` and `EvidenceKind` (opaque reference and its kind, checked by `GovernedChangeVerifier`); `ChangeControl` (`ROUTINE`, `GOVERNED`); `MergeRule` (`MOST_SPECIFIC`, `UNION`); `SettingGroupId` (a `SettingKey`-style name).

`SettingChange.SetValue.value` is typed `Any` at the API edge only. The handler checks it against the registered definition's type (W-3) before anything else, and `platform-config` decodes bundle values through `SettingValueType` [P].

## 7. Commands, queries and their results

| Command / query | Main checks | Result | Journal row and event |
|---|---|---|---|
| `CreateNode` | H-2, H-3, H-4, H-6, H-7, H-8; permission | `Accepted` / `Refused(NodeRefusal)` | `EnterpriseNodeCreated` |
| `UpdateNode` (code, names, cost centre) | H-4, H-7, H-8 | same | `EnterpriseNodeChanged` (change kind `UPDATED`) |
| `MoveNode` (one axis, from `validFrom`) | H-1 … H-3, H-6, H-7, H-9 | same | `EnterpriseNodeChanged` (`MOVED`) |
| `ChangeCountryPack`, `ChangeFacilityZone` | not retroactive; governed permission | same | `EnterpriseNodeChanged` (`COUNTRY_PACK_CHANGED`, `ZONE_CHANGED`) |
| `RetireNode` | H-5, H-6 | same | `EnterpriseNodeRetired` |
| `ApplyConfigurationChanges` | W-1 … W-23, all-or-nothing | `Applied` / `AlreadyApplied` / `Refused(list)` | one row per accepted batch: `SettingChanged` |
| `ApplyUserPreferences` | W-1 … W-9, W-11, W-14, W-15, W-21 | same | one row per accepted batch: `SettingChanged` (USER scope) |
| `resolve`, `resolveGroup`, `businessCalendar` | 5.2, 5.6, 5.10 | `Resolved` / `NotConfigured` / `Refused` / `Unavailable` | none (reads are not journaled) |
| `ConfigurationQueries.*` | H-4 | views, refusals or a dry-run list | none |
| `node`, `ancestors`, `children`, `contextOf`, `resolveAddress` | H-4 (foreign ids are "not found") | views or typed refusal | none |

Refusals are never journal rows: a refusal changes no state and has no version (journal J-3). Every refused command that touches a `SafetyRelevant` or `SafetyInvariant` key, or that fails W-16 … W-18, is reported to `TenancyAudit` with the refusal reason (an attempt to loosen an SI parameter or to bypass the governed path is worth seeing; R07 AU-1 "failed access … admin change") [P] (CA-23).

## 8. Events published

Written atomically with the change as journal rows (the outbox) and published through it (§5.3; §8.5 "events are written atomically with the state change"). The names are the event catalogue's (`docs/specs/events/catalogue.md` §4), in R11's past-tense style (CA-25, SAF-17).

| Event | Payload (no PHI) | Consumers |
|---|---|---|
| `EnterpriseNodeCreated` | node id, tenant, kind, code, display names, parents per axis, valid period, cost centre, zone, country pack | `adt` (bed board structure), `scheduling`, `rcm` (cost centres), Trust Plane (ABAC facility and department attributes, R07 AZ-1, AZ-6), analytics |
| `EnterpriseNodeChanged` | node id, change kind (`UPDATED`, `MOVED`, `COUNTRY_PACK_CHANGED`, `ZONE_CHANGED`), fields before and after (for a move: axis, old parent, new parent), valid from | same |
| `EnterpriseNodeRetired` | node id, valid to | same |
| `SettingChanged` | change set, origin, content provenance, catalogue version, and the batch's changes in order: for each, the kind (value set, value cleared, lock applied, lock removed), key, scope, before, after, valid period, evidence reference where given; and `reason`, the change reason (the catalogue's free-text field). Actor, on-behalf-of and both times are in the envelope and the journal row; the reason is also in the journal row | effective-configuration caches (later), `platform-config` (flag audit view), analytics |

- **Partition key (D6).** None of these aggregates has a patient. Every one, `UserPreferences` included, has keying `TENANT`, so the partition key is the tenant id (journal J-14; catalogue §5). One tenant's structure, configuration and user-preference changes therefore stay in one order. The read filter still masks a user value under a newer lock whatever the order (CA-07).
- `platform-config` emits its own flag and kill-switch events from its own aggregates; a flag value written through this chain appears here as `SettingChanged` on the backing key. Whether `platform-config` also emits `FeatureFlagChanged` for that write is its spec's decision.
- Delivery is at-least-once; consumers are idempotent on the CloudEvents id (§5.3).
- User-level `SettingChanged` events carry a user id, staff data and not PHI. Their `reason` is a coded reason, never free text.

## 9. Configuration this module needs

| Key | Levels | Lock | Default | Notes |
|---|---|---|---|---|
| `platform.tenancy.clinical-tier` | `FACILITY` only | structural; governed change with site evidence | `CORE`, coded only [P] | 5.8 |
| `calendar.weekend-days` | `COUNTRY_PACK`, `TENANT` | not lockable | none | [L] L-20; D3 |
| `calendar.holidays` | `COUNTRY_PACK`, `TENANT` | not lockable; union merge | none | [L] L-20; D3 |

The module reads no other configuration. The chain's own rules (the level order, the lock semantics, the tighten-only rule, the write paths) are code, not configuration: a setting that could switch them off would itself loosen every SI [P].

The deployment's `EnvironmentClass` is not a setting. `app-hms` injects it from the signed release's deployment descriptor. If it is missing, the module refuses to start (section 11).

## 10. Permissions and audit

**Write paths (D12).** Section 5.1 lists the only ways a value is written. There is no direct administrator write to `TENANT` … `UNIT`: administrators author change sets in `platform-config`, and TEST, TRAIN and PROD change only by bundle activation (`platform-config` §8). This replaces the earlier draft's "administrators write directly" (SAF-01; recorded as tightening 13).

The policy decision point arrives with WP-0.4 (`trust-policy`; ADR-013). Until then the application layer calls a port:

```kotlin
interface TenancyAuthorization {   // application layer port
    fun decide(actor: ActorRef, action: TenancyAction, scope: ConfigScope): Decision   // PERMIT | DENY(reason); ActorRef: hms.kernel.context
}
```

Proposed actions [P]:
- `enterprise.structure.write` (create, update, move, retire under a node) and `enterprise.structure.governed` (country pack, zone).
- For `ConfigurationCommands`, the actor must hold the permission that its origin requires: `config.changeset.apply` (BUILD, PLAY) or `config.bundle.activate.<env>`. `platform-config` owns these names and checks them first; this module asks again for the same action as defence in depth.
- `VENDOR_FOUNDATION` and `COUNTRY_PACK` are never authorised by an actor permission alone. They need a verified bundle origin of the matching stream (W-17): a module capability confirmed by the verifier, not a tenant role.
- `USER`: the user, for their own ordinary preferences (D-4); writing another user's preferences is OQ-T7.

**No silent stubs (§3.5; D16).**
- `TenancyAuthorization`: the deployed wiring binds `DenyAllTenancyAuthorization`. Test: `UnitTest:tenancy-deployed-wiring-denies-every-write` (KA-T2).
- `ChangeSetVerifier`: no production binding exists in WP-0.3. The handler treats a missing binding as `Unavailable` and refuses (W-16). Test: `UnitTest:config-write-refused-when-verifier-missing-or-unavailable` (KA-T4).
- `GovernedChangeVerifier`: the deployed wiring binds `RefusingGovernedChangeVerifier`. Test: `UnitTest:governed-change-refused-without-verifier` (KA-T3).
- Back-dating: the journal's production `BackDatingAuthorization` refuses every back-dated append (D10). Test: `UnitTest:config-retroactive-ordinary-change-refused-without-back-dating-decision` (KA-T5).
- `TenancyAudit`: the deployed wiring binds `OperationalLogTenancyAudit`, a structured, PHI-free operational record of each refusal (configuration and structure carry no PHI). It is not a BALP audit and is not described as one. If the record cannot be written, the command is refused, never accepted unaudited. Test: `UnitTest:tenancy-refusal-reaches-audit-port` (KA-T2).
- Reads need no permission decision in WP-0.3: configuration holds no PHI [P].

**Audit.** Every accepted change is a journal row with actor, actor kind, on-behalf-of, device, purpose of use, reason, before, after, scope, valid period, recorded time, change set and origin: the write-audit trail (§5.3 C). Refusals go to `TenancyAudit`, never to the journal (section 7). `TenancyAudit` emits BALP AuditEvents from WP-0.4 through the Audit SDK (R07 AU-1, AU-2; §7 item 2). In WP-0.3 its production binding is `OperationalLogTenancyAudit` (above); tests use an in-memory adapter. In a deployed system every write is denied anyway (KA-T2, KA-T4), so no write goes unaudited.

## 11. Persistence

- **Repository ports.** `EnterpriseStructureRepository`, `TenantConfigurationRepository`, `UserPreferencesRepository`, each with load, append and version; no update or delete operation exists on any port (H-5).
- **In-memory adapters (D8).** In `hms.platform.tenancy.inmemory`, for tests and the dev profile. Each implements the kernel's shared marker `hms.kernel.context.VolatileStore` (`platform-kernel.md` §7.5; one marker for the journal, config, tenancy and tasks). An in-memory configuration store would lose every tenant tightening of an SI parameter on restart and silently fall back to vendor values (H6; HAZ-T1). So it is never bound in a deployed system.
- **Fail closed at start (D8, D16).** The module's assembly checks each repository binding and the `EnvironmentClass`. A missing repository, or a repository that is a `VolatileStore` while any environment class is set (BUILD, TEST, TRAIN, PROD or PLAY), stops `app-hms` from starting. Volatile stores are allowed only in the dev profile with no environment class. A deployed system without an environment class does not start either (section 9). Until the jOOQ adapters exist, `app-hms` therefore does not start in a deployed environment; it never runs on memory. Test: `UnitTest:tenancy-refuses-to-start-without-durable-repositories` (KA-T1).
- **Journal mapping.** Each accepted command appends exactly one journal row through `hms.kernel.journal`'s append port, in the same unit of work as the aggregate change (§5.3 C; journal spec §6). Aggregate types (PascalCase): `EnterpriseStructure`, `TenantConfiguration`, `UserPreferences`; aggregate ids as in 5.4; patient id empty; keying `TENANT`, so the partition key is the tenant id for every aggregate (D6; journal J-14). One row per batch is this module's own rule; it keeps one version step per command (CA-06). The row's reason is the command's `ChangeReason`; its valid time and expected timing follow 5.7.
- **Schema slice [P], later in WP-0.3.** Schema `tenancy` with append-only, bitemporal fact tables (node versions, parent links, value entries, lock entries, applied origins) carrying `tenant_id`, UUIDv7 `id`, `valid_period tstzrange`, `recorded_at`, `entry_seq`, `supersedes_id` and audit columns (§6.4); exclusion constraints for H-2 and H-8 where PostgreSQL can hold them; the same `UPDATE`/`DELETE` guard as the journal (trigger, `REVOKE`, and the shared migration linter class in `:platform:arch-rules`, §6.8 #2, D7); Flyway expand → migrate → contract and the N-1 rollback test (§6.4, §6.8 #9); jOOQ adapters behind the Trust Plane SDK wrapper once WP-0.4 lands (§5.2; §6.8 #4). Writing these needs no cell; running their integration tests does (DN-040).
- Read models (the effective-configuration cache, R08 §5) are rebuildable from the journal (§2.2 rule 1) and wait for a measured need.

## 12. Hazards and controls

This module implements the configuration-chain part of these controls. Where a control's parameters belong to another module, this module provides the mechanism and the test harness, and the owner provides the parameter, its direction samples and the test instance. Test names not already in a control's `planned_verification` are marked "proposed addition"; the integrator adds them to the hazard log in the same slice without changing any control's state (SAF-28).

| Hazard / control | What this module implements | Verified by (section 13) |
|---|---|---|
| HAZ-0001 … HAZ-0021, CTRL-0001-1 … CTRL-0021-1 (SI preamble: parameters vendor-locked; a tenant may tighten, never loosen; §2.1; K §5.1) | D-2 … D-5, D-7, D-9; W-4 … W-7, W-23; read steps 3 and 5 (R-L, R-T); the governed write path (W-16 … W-18) | `PropertyTest:config-chain-vendor-lock-SI-*` (planned verification); proposed additions: `PropertyTest:config-chain-tighten-only-never-loosens`, `PropertyTest:config-chain-vendor-locked-key-refused-below-vendor`, `PropertyTest:config-chain-lock-never-loosens-safety-invariant`, `PropertyTest:config-chain-fixed-si-parameter-never-loosened-by-bundle`, `PropertyTest:config-direct-apply-with-unverified-change-set-refused` |
| HAZ-0003, CTRL-0003-1 (SI-03, "an orphan alarm later than 5 minutes is refused") | The chain mechanism and group constraints; `platform-tasks` declares the parameters, the direction samples and the `C + S + G + B + F ≤ L` group in WP-0.3 | `PropertyTest:config-chain-vendor-lock-SI-03` (harness on the `platform-tasks` definitions, including the group) |
| HAZ-0005, CTRL-0005-14 (clinical tier, no partial loop, NICU and PICU included; §6.6, K-24) | The facility-only tier, its structural lock and governed change with site evidence (5.8; D-12) | The readers carry `PropertyTest:clinical-tier-has-no-partial-loop (NICU and PICU included)`; proposed addition: `PropertyTest:clinical-tier-locked-below-facility` |
| HAZ-0010, CTRL-0010-1 (SI-10 vendor-locked) | W-11 (no retroactive safety-classified change; ordinary retroactive changes go through the journal's back-dating decision); `configurationRequired` lets the SI-10 tolerances be declared with no value until DN-KN1 | `PropertyTest:config-chain-vendor-lock-SI-10` once the tolerance definitions exist; proposed addition: `UnitTest:config-retroactive-safety-change-refused` |
| HAZ-0018, CTRL-0018-1 and part of CTRL-0018-6 (SI-18; §10.2) | D-6: no definition may bind a Tier 2 function; no Tier 2 on/off setting (5.9). The rest of CTRL-0018-6 is the arch rule in `safety-registry` and `platform-config` | `PropertyTest:config-chain-vendor-lock-SI-18` (proves only what 5.9 says); `ArchTest:tier-2-activation-only-through-register` (owned elsewhere) |
| HAZ-0019, CTRL-0019-1 (SI-19 vendor-locked) | The catalogue and harness hooks for the flag backing settings that `platform-config` declares | `PropertyTest:config-chain-vendor-lock-SI-19` in rule mode, with `platform-config`'s checks (section 13) |
| §19.4 synthetic gate (defence in depth behind `platform-config` G8) | W-18 | `UnitTest:config-synthetic-change-refused-in-train-and-prod` |
| Proposed: HAZ-T1, configuration resolves an unintended value | Section 15 | Section 13 |

The other SIs' parameters (for example SI-05's 10× and 100× thresholds, SI-08's precision floor, SI-16's 60-second window) arrive with their modules, each with its direction samples. Each control stays `planned` until its owner declares the parameter and its `config-chain-vendor-lock-SI-nn` instance passes.

Seeded hazards touched (WP-0.3): H4 delayed escalation and H5 orphaned work, through the SI-03 and SI-19 parameters; H6 data loss or corruption, through the append-only, bitemporal history and the refusal to run on memory; H2, through the clinical tier.

## 13. Tests

Kinds follow the hazard log's `<Kind>:<name>` form; `UnitTest:` and `IntegrationTest:` are this spec's names for the plain unit and integration tiers [P]. Property tests take their count from `PropertyTestBudget` (backend/README.md). Every property test generates random enterprise structures (several tenants, all node kinds, moves and retirements), random definitions of every lock kind (with lawful partial orders and their samples), and random write, lock and clear sequences with random valid and recorded times, on `TestClock`. The verifier is a test double that answers `Verified`, `NotVerified` or `Unavailable` as the case needs.

**The vendor-lock harness** (`hms.platform.tenancy.api.testing.VendorLockHarness`) lets each owning module run the same property on its own definitions without importing this module's `domain`. It has two modes (CA-15, SAF-08):
- **Parameter mode:** runs W-4 … W-7, W-23 and R-T on every definition tagged with the SI, and asserts that each direction sample's `looser` value is refused at every level below the vendor and at the vendor level (W-6), and each `stricter` value is accepted. It also runs every group constraint the definitions belong to.
- **Rule mode:** runs owner-supplied checks against the catalogue (for SI-18, D-6; for SI-19, `platform-config`'s checks that every flag has a kill switch, a safety-relevant flag defaults OFF and no backing setting allows `USER`).
- An SI instance must have at least one non-empty mode. It fails on zero definitions and zero checks unless the SI is in a reviewed "no configurable parameter" list in the test source with its reason (OQ-T6), so a pass is never vacuous.

| Test | Proves | Controls / criterion | Tier | WP-0.3 |
|---|---|---|---|---|
| `PropertyTest:config-chain-locked-setting-cannot-be-overridden-below-its-lock` | Every write strictly below an effective lock is refused with `BelowLock`; R-L holds for every context, including entries planted in the repository past the write rules | Exit criterion (§21) | fast; nightly 10⁶ | built (domain) |
| `UnitTest:config-chain-write-below-lock-refused-*` | One case per pair of lock level and write level, `TENANT` to `USER`, with the typed refusal | Exit criterion | fast | built |
| `PropertyTest:config-chain-most-specific-wins-without-lock` | R-S | §6.6 | fast | built |
| `PropertyTest:config-chain-tighten-only-never-loosens` | W-5, W-6 and R-T on partial orders: no accepted write is looser than or incomparable with its parent's effective value; no resolution is looser than any value on its chain or the coded default, including after later tightenings above; incomparable remainders answer `INCOMPARABLE_VALUES` or the declared meet | CTRL-00nn-1 (proposed addition) | fast; nightly | built |
| `UnitTest:setting-catalogue-direction-samples` | D-7: a definition whose comparator is reversed against its samples is refused at registration; the real catalogue's samples all hold | CTRL-00nn-1; CA-02 | fast | built |
| `PropertyTest:config-chain-vendor-locked-key-refused-below-vendor` | W-4: every write of a `Fixed` key below the vendor level is refused, and planted entries are ignored on read | CTRL-00nn-1 (proposed addition) | fast | built |
| `PropertyTest:config-chain-fixed-si-parameter-never-loosened-by-bundle` | W-6 for `Fixed` safety keys: a vendor value looser than, or (without a direction) different from, the coded default is refused, and ignored on read if planted | CTRL-00nn-1 (proposed addition); SAF-02 | fast | built |
| `PropertyTest:config-chain-lock-never-loosens-safety-invariant` | D-5 and step 5: no lock, clear or move makes a `TightenOnly` key resolve looser at any context | CTRL-00nn-1 (proposed addition); HAZ-T1 | fast | built |
| `PropertyTest:config-chain-relaxation-is-governed` | W-23: any change that makes an effective tighten-only value looser at some context is refused without governed approval | Tightening 12 | fast | built |
| `PropertyTest:config-chain-group-constraint-holds` | W-19 and R-G: no accepted batch breaks a group at any context and instant; a group broken by a hierarchy move reads as `CONSTRAINT_VIOLATED` | CTRL-0003-1 (with `platform-tasks`); SAF-06 | fast; nightly | built |
| `UnitTest:config-required-value-cannot-be-removed` | W-20 and `missingRequired` | SAF-06 | fast | built |
| `PropertyTest:config-direct-apply-with-unverified-change-set-refused` | W-16: a batch with a fabricated change-set id, a digest that differs from the verified one, another tenant's change set, or a verifier answering `Unavailable`, writes nothing | D12; CA-01, SAF-01 | fast | built |
| `UnitTest:config-origin-must-fit-level-and-environment` | W-17: vendor and pack levels only from the matching verified bundle stream; an applied change set refused in TEST, TRAIN and PROD | D12 | fast | built |
| `UnitTest:config-synthetic-change-refused-in-train-and-prod` | W-18 for both environment classes; accepted in BUILD, TEST and PLAY | §19.4; D11 | fast | built |
| `UnitTest:config-write-refused-when-verifier-missing-or-unavailable` | No binding or `Unavailable` refuses the batch | D16; KA-T4 | fast | built |
| `UnitTest:config-stale-bundle-sequence-refused` | W-22, and the idempotent repeat of the same manifest hash | CA-09 | fast | built |
| `PropertyTest:config-chain-as-was-stable` | R-A | §8.1 P2, P3; §7 item 3 | fast | built |
| `PropertyTest:config-chain-batch-all-or-nothing` | A batch with any refusal leaves state and version unchanged and appends no journal row | §6.2 | fast | built |
| `UnitTest:config-batch-duplicate-target-refused` | W-21 | CA-29 | fast | built |
| `UnitTest:config-write-requires-reason` | W-9 for every change kind | R07 AU-1 | fast | built |
| `UnitTest:config-retroactive-safety-change-refused` | W-11 for safety-classified keys, at every level | CTRL-0010-1 (proposed addition) | fast | built |
| `UnitTest:config-retroactive-ordinary-change-refused-without-back-dating-decision` | A retroactive ordinary change maps to a `BackDated` row and is refused by the production back-dating binding; accepted with the test double's decision | D10; KA-T5 | fast | built |
| `UnitTest:config-null-valid-from-takes-recorded-time` | `validFrom = null` starts at the command's recorded time; the row is `EFFECTIVE_DATED` | 5.7; CA-22 | fast | built |
| `UnitTest:config-change-journal-entry-complete` | Every accepted batch appends one row with actor, actor kind, reason, before, after, scope, valid period, both times, change set and origin | §5.3 C; acceptance 6 | fast | built |
| `UnitTest:config-user-preference-rules` | User writes: ordinary keys only, checked against tenant-level locks and values (W-5, W-7), masked on read by any lock on the context's chain | CA-28 | fast | built |
| `UnitTest:setting-catalogue-definition-rules` | D-1 … D-13 against violating and compliant definitions, and against the real catalogue that `app-hms` assembles; sealing | CTRL-00nn-1 | fast | built |
| `UnitTest:resolve-uses-registered-definition` | A key with a different type answers `DEFINITION_MISMATCH`; registration after sealing returns `CatalogueSealed` | CA-21 | fast | built |
| `UnitTest:resolution-store-failure-is-unavailable` | A failing repository or directory answers `Unavailable`, never a default or `NotConfigured` | D13 | fast | built |
| `PropertyTest:config-chain-vendor-lock-SI-*` (one instance per SI) | The harness, as described above | CTRL-0001-1 … CTRL-0021-1 | fast; nightly | harness built; instances for SI-03 (with `platform-tasks`), SI-18 (rule mode, D-6), SI-19 (rule mode, with `platform-config`); SI-10 once its definitions exist; the others wait for their modules |
| `PropertyTest:config-chain-vendor-lock-SI-18` | The SI-18 instance in rule mode: no definition declares a Tier 2 binding; no `tier2` key; no `BOOLEAN` or `ENUM` definition owned by a Tier 2 module, through any registration or write at any level | CTRL-0018-1 | fast | built |
| `PropertyTest:clinical-tier-locked-below-facility` | R-C; vendor-foundation, pack, tenant, legal-entity, department, unit and user writes refused and planted entries ignored; a change in either direction without approval or accepted site evidence refused | CTRL-0005-14 (proposed addition; this module's part) | fast | built |
| `PropertyTest:enterprise-hierarchy-invariants` | H-1 … H-9 after every accepted command; every refused command leaves the structure unchanged | §7 item 1; ADR-006 "tenancy tests" | fast; nightly | built |
| `PropertyTest:tenant-isolation` | No query, resolution or command for tenant A returns or changes anything of tenant B | H-4; ADR-006 | fast | built |
| `UnitTest:context-mapping` | `contextOf` for every node kind; `INCONSISTENT_CONTEXT` for disagreeing fields; `chainOf` agrees with `resolve` | 5.2 | fast | built |
| `UnitTest:scope-address-resolution` | `resolveAddress` gives the same scope for the same codes in two synthetic environments with different node ids; a missing address is refused | CA-12 | fast | built |
| `UnitTest:business-calendar-assembly` | Synthetic weekend and holiday calendars and the facility zone give the expected `BusinessCalendar`; covered years; a covered year with no holidays; tenant additions never remove pack holidays or cover a year; `NotConfigured`, `NO_FACILITY_ZONE`, `INVALID_CALENDAR`; the composite provenance | L-20; CA-18 | fast | built |
| `UnitTest:entry-time-policy-resolver-answers-not-configured` | `EntryTimePolicyResolver` answers `NotConfigured` with the missing keys when a definition or a value of any of the four keys is missing, `Unavailable` on a store failure or a refused resolution, `Unavailable` when the factory refuses a synthetic value in TRAIN or PROD, and `Available` with the four sources for four approved values | D11; D16; kernel §6.3; CTRL-0010-1 | fast | built |
| `UnitTest:tenancy-deployed-wiring-denies-every-write` | The deployed binding of `TenancyAuthorization` denies structure and configuration writes | D16; KA-T2 | fast | built |
| `UnitTest:governed-change-refused-without-verifier` | The deployed `GovernedChangeVerifier` refuses every change that needs site evidence | D16; KA-T3 | fast | built |
| `UnitTest:tenancy-refuses-to-start-without-durable-repositories` | In every environment class (BUILD, TEST, TRAIN, PROD, PLAY), a missing repository or a `VolatileStore` repository stops assembly; so does a deployed system with no environment class; the dev profile with no environment class starts on memory | D8; D16; KA-T1 | fast | built |
| `UnitTest:tenancy-refusal-reaches-audit-port` | A refused command touching a safety-classified key, or failing W-16 … W-18, reaches `TenancyAudit` through the production binding `OperationalLogTenancyAudit` with its reason and no PHI; a failed audit write refuses the command | D16; R07 AU-1; KA-T2 | fast | built |
| `ArchitectureTest` (`HmsArchitectureRules.all`) plus the three rules of section 3 | `domain` framework-free and clock-free; api-only use by other modules; `ConfigurationCommands` only from `platform-config`; `..inmemory..` and `..testing..` only from test sources; `Resolved` built only by the resolver | §6.8 #3; D7; D8; D11 | fast | built |
| `ArchitectureTest:modulith-verification` (`app-hms`) | The module is in `app-hms`'s Modulith verification | Acceptance 7 | fast | built |
| `IntegrationTest:config-chain-lock-persisted` | The lock property against PostgreSQL through the jOOQ adapter: write, reload, resolve; planted below-lock rows are ignored | Exit criterion (persistence-backed) | merge | written, waiting for the cell (DN-040) |
| `IntegrationTest:config-values-survive-restart` | Values, locks and tightenings are the same after a restart of the application | H6; HAZ-T1 | merge | schema slice; waits for the cell |
| `IntegrationTest:tenancy-fact-tables-append-only` | `UPDATE` and `DELETE` on the tenancy fact tables fail (trigger and permissions); the migration linter passes | §6.8 #2 | merge | schema slice; waits for the cell |

## 14. Acceptance criteria (WP-0.3 part)

1. The hierarchy invariants H-1 … H-9 hold after every command: `PropertyTest:enterprise-hierarchy-invariants` and `PropertyTest:tenant-isolation` pass in the fast tier.
2. **A locked setting cannot be overridden below its lock** at domain level: `PropertyTest:config-chain-locked-setting-cannot-be-overridden-below-its-lock` and the `UnitTest:config-chain-write-below-lock-refused-*` cases pass. The persistence-backed evidence is `IntegrationTest:config-chain-lock-persisted`, recorded as waiting for the cell (DN-040), not as passed.
3. A safety-invariant parameter can be tightened and never loosened at any level, in the direction its owner declared: `PropertyTest:config-chain-tighten-only-never-loosens`, `UnitTest:setting-catalogue-direction-samples`, `PropertyTest:config-chain-fixed-si-parameter-never-loosened-by-bundle`, `PropertyTest:config-chain-lock-never-loosens-safety-invariant` and `PropertyTest:config-chain-relaxation-is-governed` pass, and `PropertyTest:config-chain-vendor-lock-SI-03` passes on the `platform-tasks` definitions and group.
4. The clinical tier is a facility-only setting that no vendor, pack, tenant, legal-entity, department, unit or user write can change: `PropertyTest:clinical-tier-locked-below-facility` passes.
5. No setting definition can bind or switch a Tier 2 function, and no Tier 2 module owns an on/off setting: `PropertyTest:config-chain-vendor-lock-SI-18` passes. This is the chain's part of CTRL-0018-1 and CTRL-0018-6 only (5.9).
6. No caller can write the chain without a change set or bundle that `platform-config` verifies, and synthetic content is refused in TRAIN and PROD: `PropertyTest:config-direct-apply-with-unverified-change-set-refused`, `UnitTest:config-origin-must-fit-level-and-environment`, `UnitTest:config-synthetic-change-refused-in-train-and-prod` and `ArchTest:config-commands-only-from-platform-config` pass.
7. Every accepted change appends one journal row with actor, reason, before, after, scope and both times; every refusal is a typed value, not an exception: `UnitTest:config-change-journal-entry-complete` and `PropertyTest:config-chain-batch-all-or-nothing` pass.
8. The architecture tests pass and `app-hms`'s Modulith verification includes the module: `ArchitectureTest` and `ArchitectureTest:modulith-verification`.
9. Every fail-closed claim has its test passing: `UnitTest:tenancy-deployed-wiring-denies-every-write`, `UnitTest:config-write-refused-when-verifier-missing-or-unavailable`, `UnitTest:governed-change-refused-without-verifier`, `UnitTest:config-retroactive-ordinary-change-refused-without-back-dating-decision`, `UnitTest:tenancy-refuses-to-start-without-durable-repositories`, `UnitTest:tenancy-refusal-reaches-audit-port`, `UnitTest:entry-time-policy-resolver-answers-not-configured`.
10. KA-T1 … KA-T5 are recorded in `KNOWN-ANOMALIES.md`, checked by `sh tools/hms safety check` [P], and the hazard-log controls above stay `planned` until their named tests pass in a recorded run.

## 15. Open questions, decisions needed, known anomalies, hazard and tightenings (to be numbered by the integrator)

**Open questions.**
- **OQ-T1: closed** by D1 (kernel ids and `hms.kernel.context`) and D6 (partition key). Kept as a label for traceability.
- **OQ-T2: Hierarchy shape choices to confirm with real master data in WP-1.1.** A unit always has a department; departments do not nest; no campus level (R08 §5 has one, §7 item 1 does not); a room hangs only under a unit; service points have a department or facility as organisational parent and a floor or unit as physical parent; cost centres sit under a legal entity; one country pack per tenant (a group spanning the Kurdistan and federal Iraq packs, §11.10, would need a pack per legal entity or facility); code uniqueness per facility for facility-level kinds (H-8). Owner: implementation lead with the first customer's enterprise-structure data (R11 §16).
- **OQ-T3: Who owns the bed.** §8.2 puts the location tree, with "operational status" among bed attributes, in `platform-tenancy`; §5.2 gives beds to `adt`, and §8.4's bed state machine is approved by the nurse panel and bed manager. Proposal: this module owns the bed as a location node with its structural attributes; `adt` owns bed status and occupancy (the §8.4 machine and the exclusion constraint, §9.12).
- **OQ-T4: Calendar levels.** Keys decided by D3 (`calendar.weekend-days`, `calendar.holidays`, levels `COUNTRY_PACK` and `TENANT`; the pack supplies the [L] L-20 items). Open: a facility-level override; which calendar applies to a tenant-level context with no facility zone; and the move of both definitions to `platform-i18n` when it exists (§5.2).
- **OQ-T5: The clinical tier's coded default and its evidence check.** Proposal: coded default `CORE` (K-24: Core-first is the normal entry; `CLINICAL_SAFETY` needs RG1–RG4 evidence, §6.6), facility level only. Who builds the `GovernedChangeVerifier` that checks RG1–RG4 evidence (WP-0.9 release evidence, or `IMP-RDY-01`), and what evidence a downgrade to `CORE` needs?
- **OQ-T6: SIs with no configurable parameter.** The hazard log plans `PropertyTest:config-chain-vendor-lock-SI-nn` for all 21 SIs. Some (for example SI-06, signed notes immutable) may have no parameter at all. Proposal: the harness fails on zero definitions and zero rule checks unless the SI is in a reviewed list with a reason, and such a control is verified by a catalogue rule rather than by a vacuous pass. CSO to confirm the reading.
- **OQ-T7: Another user's preferences.** May an administrator write a user's preferences, or only the user?
- **OQ-T8: moved** to DN-T1 (a reading of CTRL-0018-1 is a decision, not a question).
- **OQ-T9: Configuration reads by every module (D5).** §5.2's dependency column lists only some modules' synchronous calls. D5 lets every module read configuration through `hms.platform.tenancy.api`. Record this against §5.2 for the human lead.
- **OQ-T10: Enterprise structure across environments.** Proposal: the hierarchy is master data per environment, not promoted; bundles address scopes by `ScopeAddress` (H-8 codes), resolved at activation and refused if missing. Alternative: promote the hierarchy in its own signed stream with stable ids. Decide with `platform-config` and the implementation lead.
- **OQ-T11: Tier 2 modules and on/off settings.** D-6 refuses every `BOOLEAN` and `ENUM` definition owned by a Tier 2 module (`hms.reg..`), so an on/off switch there can only be a flag that asks the Register. This may block harmless display settings. Confirm with `safety-registry` and the CSO.
- **OQ-T12: Recorded time before the append. Closed.** Tenancy does not read time from the transaction context. It builds its fact rows after `append` returns, in the same transaction, from `AppendResult.Appended.entries[0].recordedAt`, so the rows carry the journal's single reading (5.7; D10).
- **OQ-T13: Home of `EnvironmentClass`. Closed.** The kernel declares `EnvironmentClass` and `ContentProvenance` in `hms.kernel.time` (kernel §6.5). Tenancy imports both and declares neither; `platform-config` aliases its `Environment` to `EnvironmentClass`.

**Decisions needed.**
- **DN-T1: Reading of CTRL-0018-1.** CTRL-0018-1 says "Tier 2 activation is vendor-locked in the configuration chain: a tenant may tighten it". This spec keeps activation out of the chain altogether (5.9) and puts the tenant's tightening on the function's kill switch in `platform-config` (SI-19). Proposed amendment to the description: "No configuration layer holds Tier 2 activation; the Register is the only switch. A tenant may keep a cleared function off through its kill switch, and releasing the switch never activates it." It needs every Tier 2 function in the Register to have a `tier2Function`-bound flag (a `platform-config` registry rule). A reading of a hazard control, so the CSO's [HUMAN] (§3.4 item 1). Status: requested.
- **DN-T2: Safety parameters with no coded default.** D-2 lets an SI or tighten-only parameter be declared `configurationRequired` (no coded value) when the CSO has not set one, as the kernel's SI-10 tolerances are (DN-KN1). Its first value then comes only from a governed vendor or pack bundle. Until then the resolver answers `NotConfigured`, and each reader's spec names its fail-closed mechanism and test (for the SI-10 tolerances, 5.12). Confirm this route [HUMAN]. Status: requested.

**Known anomalies (proposed).**
- **KA-T1:** In WP-0.3's first pass `platform-tenancy` has no schema and only volatile in-memory repositories. An in-memory store would lose tenant tightenings on restart, so `app-hms` refuses to start in every environment class (BUILD, TEST, TRAIN, PROD, PLAY); memory is allowed only in the dev profile with no environment class (D8; `UnitTest:tenancy-refuses-to-start-without-durable-repositories`). The lock exit criterion is evidenced at domain level only; `IntegrationTest:config-chain-lock-persisted` waits for the cell (DN-040).
- **KA-T2:** `TenancyAuthorization` has no production adapter before WP-0.4. Deployed wiring denies every structure and configuration write (`UnitTest:tenancy-deployed-wiring-denies-every-write`); test adapters permit them. `TenancyAudit` is bound to `OperationalLogTenancyAudit`, a PHI-free operational record, not a BALP audit, until WP-0.4 (`UnitTest:tenancy-refusal-reaches-audit-port`).
- **KA-T3:** No `GovernedChangeVerifier` exists. Deployed wiring refuses every change that needs site evidence, so no facility can change its clinical tier until the verifier is built (OQ-T5; `UnitTest:governed-change-refused-without-verifier`).
- **KA-T4:** `ChangeSetVerifier` has no production binding until `platform-config` has persistence. Every configuration write is refused in a deployed system (`UnitTest:config-write-refused-when-verifier-missing-or-unavailable`). User preferences are unaffected but also denied by KA-T2.
- **KA-T5:** The journal's production back-dating binding refuses every back-dated append until WP-0.4 (D10), so no retroactive structure or configuration change is possible (`UnitTest:config-retroactive-ordinary-change-refused-without-back-dating-decision`).

**Proposed hazard.**
- **HAZ-T1: The configuration chain resolves an unintended value for a safety-relevant setting.**
  - *Description:* a context resolves a value that no authorised decision intended: a looser SI parameter, a below-lock override, a value written outside the governed path, or another facility's clinical tier.
  - *Causes:* a lock masking a stricter lower value; a parent or vendor tightening that leaves an older lower value looser; a reversed strictness comparator; incomparable values resolved arbitrarily; a vendor bundle loosening a `Fixed` SI parameter; a direct write with a fabricated change set or synthetic content; a vendor-level clinical tier; a cross-key constraint broken by one tightened key; a unit whose physical and organisational facilities disagree; a resolution context that does not match the hierarchy; a retroactive change rewriting what applied in the past; a race between a parent lock and a child write; a routine relaxation of a tenant's own SI tightening; volatile storage losing tightenings on restart; a stale cache (later). Over-tightening can also harm: an alarm or hard-stop flood (alert fatigue, H4) or a near-zero scan interval overloading a scanner; the type bounds that limit this are owner-sourced values (5.3).
  - *Effects:* an SI or a fallback control weakened at one scope without a decision (for example a later orphan alarm, H5; a delayed escalation, H4); a unit of a `CORE` facility treated as `CLINICAL_SAFETY`, or the reverse (H2); configuration that differs from what was approved (H6).
  - *Seeded hazards:* H2, H4, H5, H6.
  - *Proposed controls:* D-2 … D-13; W-4 … W-7, W-10, W-11, W-14, W-16 … W-23; read steps 3, 5 and 8; H-7; `INCONSISTENT_CONTEXT`; per-tenant aggregate versions; the start-up refusal of volatile storage.
  - *Planned verification:* the property and unit tests of section 13 (lock, tighten-only, direction samples, fixed SI, relaxation, groups, unverified change set, synthetic, as-was, clinical tier, hierarchy invariants, tenant isolation, start-up refusal), `IntegrationTest:config-chain-lock-persisted` and `IntegrationTest:config-values-survive-restart`.
  - *Initial risk:* for CSO triage [HUMAN]; agent proposal severity major, likelihood remote (medium on the log's matrix).

**Tightenings [P] to record (§3.4 item 1; `docs/safety/README.md` "Tightenings"), each against the CTRL-00nn-1 preamble controls unless stated.**
1. Safety-classified settings never have a user level (D-4).
2. Tighten-only is checked against the parent's effective value, not only the vendor's (W-5).
3. Reads of tighten-only keys return the strictest value on the chain, so a later tightening above always wins; incomparable values are refused, never picked (step 5, R-T).
4. A vendor value looser than the coded default is refused for tighten-only and `Fixed` SI keys; loosening an SI parameter is a code change with hazard-log review (W-6; D-9).
5. Governed locks are not allowed on tighten-only keys, so a lock can never loosen (D-5).
6. Safety-classified keys cannot be changed retroactively (W-11; CTRL-0010-1).
7. No definition may bind a Tier 2 function; the `tier2` namespace is reserved; Tier 2 modules own no on/off setting (D-6; CTRL-0018-1; DN-T1).
8. The clinical tier exists at the facility level only, with no vendor, pack or tenant value, and every change needs approval and site evidence (5.8; D-12; CTRL-0005-14).
9. Reads ignore values below a lock, at a level the definition does not allow, or looser than a safety key's coded default, as defence in depth (step 3).
10. Every tighten-only direction is proven by owner-supplied samples at registration (D-7).
11. A relaxation of a tighten-only value, even one still at least as strict as the parent, is a governed change (W-23).
12. Tenancy refuses synthetic content in TRAIN and PROD itself, behind `platform-config`'s gate G8 (W-18; §19.4).
13. The chain has no direct administrator write path: every non-user write is a verified change set or bundle (W-16, W-17; D12).

**ADR.** None proposed. The chain semantics, the change-set verification port and the per-tenant copies of vendor and pack values refine ADR-006 and ADR-020 without changing them.

## 16. Interfaces assumed from sibling specifications

- **Kernel (`platform-kernel.md`, D1, D4, D10, D11).** `hms.kernel.ids`: `TypedId`, `UuidV7.requireV7`, `TenantId`, `FacilityId`, `UserId`. `hms.kernel.context`: `CommandContext` (tenant, facility, actor, on-behalf-of, device, purpose of use, clinical time, idempotency key, correlation id, causation id), `ChangeReason` (non-blank, never defaulted), `ActorRef` with its kind, `TransactionContext` and `TransactionRunner` (tenancy reads no time from the transaction context; 5.7), `EntryTimePolicySource` (implemented here by `EntryTimePolicyResolver`, 5.12). `hms.kernel.time`: `RecordedTime`, `ValidPeriod`, `AsOf(validAt: Instant, knownAt: Instant? = null)` with `AsOf.latest(validAt)` and `AsOf.knownAt(validAt, recorded)`, `EntryTiming` and `EntryTimingCode`, `BusinessCalendar.of(zone, weekend, holidays: Set<LocalDate>, confirmedYears: Set<Year>)` returning `Valid`, `NoBusinessDayInWeek` or `HolidayOutsideConfirmedYears`, `EnvironmentClass`, `ContentProvenance`, `ResolvedParameter`, `TimingClass`, `EntryTimePolicy` and `EntryTimePolicyLookup`. The kernel's policy factories (D11) take `ResolvedParameter`s plus the `EnvironmentClass` and refuse synthetic provenance in TRAIN and PROD; the resolvers convert a tenancy `Resolution.Resolved` into them.
- **Journal (`platform-journal.md`, D10).** `JournalAppender.append(tx, context, request: AppendRequest)` in the caller's transaction, returning `AppendResult` (`Appended.entries[0].recordedAt` is the single reading the fact rows use, 5.7), with PascalCase `AggregateType`, UUID aggregate ids, an expected `EntryTimingCode` per entry (one entry per aggregate per append is this module's own rule, section 11); the appender stamps one recorded time, derives the entry mode from the `CommandContext`, classifies the row, and refuses `BackDated` without a `BackDatingAuthorization` decision (always refused in WP-0.3 production).
- **Events (`envelope.md`, `catalogue.md`, D6).** Keying `TENANT` for `EnterpriseStructure`, `TenantConfiguration` and `UserPreferences`: partition key = tenant id (journal J-14). The catalogue's names `EnterpriseNodeCreated`, `EnterpriseNodeChanged`, `EnterpriseNodeRetired` and `SettingChanged`; the catalogue's §4 row for `SettingChanged` should say "one row per accepted batch, listing its changes", and `EnterpriseNodeChanged` covers moves, country-pack and zone changes.
- **Config (`platform-config.md`, D2, D12, D13).** Implements `ChangeSetVerifier` (tenant, change set, digest, origin, content provenance, `humanApproved`, `governedRolesApproved`) and computes `ChangesDigest` with this module's function; requires the governed-change roles for the changes `validate` marks governed; records each activation's diff digest before calling tenancy, so the verifier can confirm it; calls `ConfigurationCommands` only for applied change sets (BUILD, PLAY) and per-tenant bundle activations; uses `ConfigurationQueries` (`entries`, `entryAt`, `chainOf`, `validate`, `missingRequired`, `lastActivation`) instead of rebuilding chain logic; addresses scopes in bundles by `ScopeAddress`; carries evidence references on governed items into `SettingChange.evidence`; gives bundle items without an explicit start `validFrom = null`; uses `CountryPackId("kri")`; registers flag backing settings here with an explicit `vendorLock` and `tier2Binding` (`RestrictsTier2Function(function)` for a setting that restricts a Tier 2 function, otherwise `NotTier2`; 5.3); maps `NotConfigured`, `Refused` and `Unavailable` to its own `Unavailable` flag outcome (D13); runs the SI-19 harness instance in rule mode.
- **Tasks (`platform-tasks.md`, D14).** Keys in kebab-case under `platform.tasks.` (for example `platform.tasks.orphan-alarm.max-delay`, `.scan-interval`, `.grace`, `.scan-budget`, `.leader-takeover`, and `platform.tasks.routing.directory-max-staleness`); the SI-03 parameters `TightenOnly` with direction samples taken from SI-03; the `C + S + G + B + F ≤ L` constraint as a `SettingGroup`; the fallback queue `platform.tasks.orphan-alarm.fallback-queue` with `requiredAt`; the dead-letter alarm setting `platform.events.dead-letter-alarm-after`, which `platform-tasks` owns and declares (`platform-tasks` §8); the generic calendar keys of D3; escalation policies as content referenced through `CONTENT_REF`, or as structured settings whose type the tasks spec proposes.
