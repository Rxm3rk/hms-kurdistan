# Module specification: platform-config

Status: draft for WP-0.3 (specify first, §3.2 step 2). Revised after the automated review (correctness and safety lenses, DN-040 decision 2) and the integrator decisions D1–D17. Date: 2026-10-19.
Module: `platform-config` (§5.2, Platform group). Gradle project `:modules:platform-config`, package `hms.platform.config` [P] (backend/README.md, "Packages").
Features: `PLT-CFG-01` Config-as-product: "Typed registry; change sets; signed bundles; promotion; 3-way merge" (Appendix A.1). It also carries the flags and kill switches of §7 item 8 and SI-19 (§5.2 lists "feature flags and kill switches" under `platform-config`).
Safety impact: **yes**. It implements HAZ-0019 (SI-19) and the flag-side controls of HAZ-0018 (SI-18), and it is the §19.4 content gate. It proposes three new hazards and new causes for HAZ-0019 (section 13).
Sources: §2.1 (preamble, SI-03, SI-10, SI-14, SI-18, SI-19); §2.2 rules 2, 3, 6, 7 and 8; §2.3; §3.4; §3.5; §4.2 (ADR-006, ADR-009, ADR-020, ADR-021); §4.3; §5.2; §5.3; §6.1; §6.2; §6.4; §6.6; §6.8; §7 items 1, 3, 7 and 8; §8.1 P2, P9; §9.6; §10.1; §10.2; §13.1; §14.3; §18.11; §19.2–§19.4; §21 (WP-0.3); §22.1; §23; ADR-010, ADR-016; R08 §3.4, §5, §9, §10, §13 #18, §14 #6; R07 §5.4 (AU-1), §5.7 (SD-4), §13.1 (IA-7); K §5.1, §5.4, §7.7; K-24; BP §5.6, §7.8; DN-040; integrator decisions D1–D17.

References: "§n" is BUILD-PROMPT.md, "K §n" is BLUEPRINT-KURDISTAN.md, "BP §n" is BLUEPRINT.md, "R0n §n" is `research/0n-*.md`. [P] marks this build's own engineering choice. "Dn" is an integrator decision for WP-0.3. Local labels (OQ-CFG-n, KA-CFG-n, DN-CFG-n, ADR-CFG-n, HAZ-CFG-x, CTRL-CFG-x-n) are this spec's; the integrator gives the programme numbers (D9).

---

**Programme numbers (19 October 2026).** DN-CFG-1 to DN-CFG-3 are DN-043; OQ-CFG-1 to OQ-CFG-14 are OQ-174; the proposed hazards of §13.2 are OQ-177; ADR-CFG-1 and ADR-CFG-2 are OQ-178; KA-CFG labels become KA numbers when the code that makes them true is committed. (`docs/program/DECISIONS-NEEDED.md`, `docs/program/OPEN-QUESTIONS.md` §(g).)

## 1. Purpose and scope

**Purpose.** Hospital-specific behaviour is configuration, not code (§2.2 rule 8; §6.2 "No tenant-specific code"). This module makes that configuration safe to change. It is "configuration as a product": a typed registry, change sets, signed bundles, a promotion pipeline, and a vendor foundation with tenant overlays rebased by three-way merge (R08 §14 #6; R08 §9; ADR-020).

**It owns** (§5.2; §6.6; ADR-020 "Owners"):
- the **registry** of content item types and flag definitions, each registered by its owning module;
- **change sets**: the only governed way to change a configured value;
- **signed bundles**: manifest, canonical serialisation, content hashes, signature, trust store and verification;
- **promotion** BUILD → TEST → TRAIN → PROD, the PLAY sandbox, anti-rollback and the promotion gates, including the §19.4 synthetic-content gate;
- the **content store**: immutable, content-addressed bodies of content items (order sets, CDS rules, escalation policies, tariffs), referenced from the chain (5.8);
- the **change-set verifier**: the implementation of tenancy's `ChangeSetVerifier` port, which `platform-tenancy` calls to confirm that a configuration write comes from an approved change set or a verified bundle activation (5.7; D12);
- the **three-way merge** of a tenant overlay onto a new vendor foundation;
- **flags and kill switches** (SI-19) and the flag audit.

**It does not own:**
- setting definitions. There is one store of them: tenancy's `SettingCatalogue` (D2). This module registers each flag's backing setting there and keeps no copy.
- the enterprise hierarchy, the configuration chain, locks and value resolution. These are `platform-tenancy` (§5.2: "Enterprise structure, configuration chain, locks"). This module writes values through the tenancy API and never resolves the chain itself.
- content values. Kurdistan foundation content and pack bundles belong to `content` (§5.2), which uses this module's mechanism. Clinical content values are governed configuration that this module carries, never invents (§3.4 item 3; §3.5).
- the CDS registry (owner, evidence, PPV, tiers, silent mode, retirement). That is `cds` (§5.2; §9.6). This module provides the kill switch that `cds` registers for every rule.
- Tier 2 activation. Only the Regulatory Boundary Register switches a Tier 2 function on (SI-18; §10.2; ADR-016). A flag can only ask the Register.
- tasks. The owned review task of a kill switch is requested here and created by `platform-tasks` (6.3; D14).

**Feature map.**

| Feature | What this module does for it | When |
|---|---|---|
| `PLT-CFG-01` | Everything in this spec | WP-0.3 (domain, in-memory for tests); persistence later (section 11) |
| `PLT-CORE-02` | Consumes the configuration chain with locks; is the governed write path into it | WP-0.3 |
| `PLT-CFG-02` | The Kurdistan pack "loads as signed configuration" (WP-1.1 exit evidence, quoted in ADR-020) on this mechanism | WP-1.1 |
| `PLT-CORE-06`, `CLN-CDS-02`, `CLN-CDS-03` | Kill switch per CDS rule (HAZ-0019 `features`) | Mechanism WP-0.3; rules WP-1.5 |
| `AI-GW-01` | Per-feature, per-site disable (CTRL-0019-6; §17.3 G9) on the same kill switch | P2 |
| `PLT-CFG-04` | Signed plugin packages (R08 §9 tier 3) may reuse the bundle signature format | P2, not designed here |

---

## 2. What is in WP-0.3 and what waits

DN-040 lets WP-0.3 build its cluster-free parts before WP-0.2 is done. Everything that needs PostgreSQL, Kafka, Temporal or containers waits for the cell.

"Built now" means Kotlin code in `:modules:platform-config` with its fast-tier tests in this work package, running in one process on the kernel libraries (`hms.kernel.ids`, `hms.kernel.time`, `hms.kernel.context`, `TestClock`), the journal port and tenancy's api with in-memory adapters. "Specified only" means this spec fixes the contract and the test names, and no code for it is written in WP-0.3.

| Part | Built now (WP-0.3 code and fast-tier tests) | Specified only; built later, and what it waits on |
|---|---|---|
| Registry | Domain model, registration checks, registry versioning; flag backing settings registered through tenancy's `SettingCatalogueRegistrar` at assembly | — |
| Change sets | Domain model, state machine, approval rules, apply through `ConfigurationCommands` with a verified change-set id | In-product human approval: Trust Plane (WP-0.4) and the signature-provider port (OQ-005, L-17) |
| Change-set verifier (D12) | This module's implementation of tenancy's `ChangeSetVerifier`; tenancy calls it on every non-USER write | Its production binding: it is bound only with the persistence slice, so tenancy refuses every write in a deployed system until then (tenancy KA-T4) |
| Canonical serialisation, SHA-256, Ed25519 verification | Pure Kotlin encoder; JDK `MessageDigest` and the JDK's own Ed25519 provider; test keys generated at test time | Production keys, custody and the populated trust store: ADR-CFG-1 and DN-CFG-1, [HUMAN] (§4.3) |
| Promotion and gates | Gate pipeline G1–G13, anti-rollback, synthetic gate, scope addressing, the two-commit activation with reconciliation (5.7), promotion ledger (environments simulated in one process) | Ledger transport between real environments; the per-content replays of §19.4, which come with their modules; terminology validation (`PLT-CORE-05`, WP-1.1) |
| Content store | Port, content-addressed model, `ContentReader` over the in-memory store | Schema (later slice); the first real content types come with their modules |
| Three-way merge | Domain merge with ordered rules and findings | — |
| Flags and kill switches | Registry rules, three-way evaluator, engage, review and release, audit records, the review-task request, the review task kind | Propagation across the nodes of a cell (WP-0.2 cell); BALP audit (WP-0.4); the Boundary Register (WP-0.9) |
| Owned review task | `TaskRequested` journal row written in the engage transaction | Materialised by `platform-tasks` from the journal (D14); the end-to-end test is merge tier |
| Fail-closed production adapters (4.7) | Every adapter of 4.7 and `PlatformConfigProductionWiring`, with their unit tests | The real adapters named in 4.7 |
| Persistence | Repository ports; in-memory adapters in `hms.platform.config.inmemory`, for tests and local development only (D8); the start-up guard (section 11) | Schema, migrations and jOOQ adapters: a later slice [P]. Until then production wiring binds no repository and the application refuses to start with this module wired (section 11) |
| Events | Published through the journal port as the outbox | Debezium → Kafka delivery: WP-0.2 cell |
| Permissions | A port with a deny-all production adapter and a test adapter | Trust Plane SDK (WP-0.4); the break-glass question (DN-CFG-2) |

Every fail-closed port names its mechanism and the test that proves it (4.7; D16). Each is a known anomaly (section 15).

---

## 3. Dependencies

- **Application modules** [P]: `hms.platform.tenancy.api` (chain, catalogue, directory, the `ChangeSetVerifier` port) and `hms.platform.tasks.api` (only the request payload and kind types: `CreateTask`, `TaskKind`, `TaskKindDefinition`, `KindSafety`, `SlaClockPolicy`, `FocusRef`, `OwnerRef`, `TaskPriority`, and the `TaskRequested` and `TaskCompletionRequested` payloads). §5.2's dependency column lists only Trust for `platform-config`. Both dependencies are recorded as OQ-CFG-1 (D5).
- **Kernel libraries:** `hms.kernel.ids` (UUIDv7; `TenantId`, `FacilityId`, `UserId`); `hms.kernel.time` (`RecordedTime`, `AsOf`, `ValidPeriod`, `ValidTimeInput`, `EntryTimingCode`, `EnvironmentClass`, `ContentProvenance`); `hms.kernel.context` (`CommandContext`, `ChangeReason`, `ActorRef` with its kind, `IdempotencyKey`, `CorrelationId`, `CausationId`, `TransactionContext`, `TransactionRunner`; D1); `hms.kernel.events` (envelope, `PartitionKey`); `hms.kernel.journal` (`JournalAppender.append(tx, context, request: AppendRequest)`, and `JournalReaders.forModule(...)` → `ModuleJournalReader` for `byIdempotencyKey`).
- **Gradle.** Today's `build.gradle.kts` has `:platform:ids`, `:platform:time`, `:platform:context` and `:modules:platform-tenancy`. It lacks `:platform:journal`, `:platform:events` and the tasks api. The integrator adds them; this spec changes no build file.
- **Cryptography:** JDK only, `java.security.MessageDigest` ("SHA-256") and `java.security.Signature` ("Ed25519"). No new dependency (§4.3).
- **Ports this module defines and others implement:** section 4.7.

### 3.1 What this module uses from `hms.platform.tenancy.api`

Aligned with `docs/specs/modules/platform-tenancy.md` (§6 and §16). Its names win. Every interface below is in tenancy's api, so this module keeps no fallback for a missing one (CA-01, CA-10, CA-11, CA-12, CA-16, SAF-05, D12).

| Tenancy API | Used here for |
|---|---|
| `ConfigLevel`, `ConfigScope` (`VendorFoundation`, `CountryPack`, `Tenant`, `Node`, `User`), `ResolutionContext` | Scopes of change items and kill switches; flag evaluation contexts. `AsOf` is the kernel's (D4) |
| `SettingCatalogue` (`definition`, `group`, `all`, `version`) and `SettingCatalogueRegistrar.register` (assembly only; sealed afterwards, D-13) | The one store of setting definitions (D2). The registry reads the catalogue and registers flag backing settings through the registrar |
| `SettingDefinition<T>`, `TypedSettingKey<T>`, `SettingValueType<T>` (canonical encoding), `SafetyClass`, `VendorLock` (`None`, `Fixed`, `TightenOnly`), `Direction`, `RequiredBecause`, `ChangeControl` (`ROUTINE`, `GOVERNED`), `sources` | Validation of change items (G5), merge rules (section 7), canonical bundle encoding (5.5) |
| `Strictness.compare(a, b): Order` (`STRICTER`, `EQUAL`, `LOOSER`, `INCOMPARABLE`) with the declared-direction samples (D-7) | Merge rules for tighten-only keys (section 7) |
| `ConfigurationReader.resolve(key: TypedSettingKey<T>, context, at)` → `Resolved` / `NotConfigured` / `Refused` / `Unavailable` | Flag values (6.2); content references (5.8) |
| `ConfigurationCommands.apply(ApplyConfigurationChanges)` carrying `changeSet: ChangeSetId`; no provenance field; all-or-nothing; idempotent | The only way this module writes values and locks (5.7) |
| `ChangeSetVerifier.verify(tenant, changeSet, digest: ChangesDigest): ChangeSetVerdict`, defined in tenancy's api and implemented here | Tenancy confirms every batch before it writes (5.7; W-16) |
| `ChangesDigest.of(changes)`: SHA-256 over the canonical encoding of the ordered changes | Both modules compute the same batch digest |
| `ConfigurationQueries.validate(cmd)`: a dry run against the same write rules | INV-9 and W-rules at submit; gate G7 |
| `ConfigurationQueries.entryAt(tenant, key, scope, at)` and `entries(tenant, filter: EntryFilter, at)`: raw value and lock entries, not resolved values | INV-8 compare-and-set; bundle snapshot; activation difference |
| `ConfigurationQueries.chainOf(context, at)`: the ordered scopes of a context, or a typed refusal | Kill-switch scope check; this module never rebuilds chain logic |
| `ConfigurationQueries.lastActivation(tenant, stream: BundleStreamRef): AppliedOrigin?`, recorded by tenancy in the same transaction as a bundle batch; a lower or equal sequence is refused (W-22) | Anti-rollback authority (G3, INV-12) |
| `ScopeAddress` and `EnterpriseDirectory.resolveAddress(tenant, address, at)`. Tenancy has no reverse lookup: this module builds a node's address from `EnterpriseDirectory.node(...).code` and `ancestors(...)` | Stable scope addressing across environments (5.9) |
| Value types `CONTENT_REF(contentTypeId)`, `STRING(pattern, maxLength)` and `SET(element, maxSize)`. No open key families: a family whose members are known at assembly is one definition per member; open-ended ids are content (tenancy 5.3) | Content references (5.8); approver roles and the review queue (section 12) |
| `Tier2Binding` (`NotTier2`, `RestrictsTier2Function(function)`; `GatesTier2Function` is refused, D-6) | INV-6; G12 (D12) |
| `EvidenceRef` (opaque) and `EvidenceKind` on every `SettingChange`, checked by `GovernedChangeVerifier` | Governed keys (tenancy W-10) |
| `SettingChanged` and the enterprise events (`EnterpriseNodeCreated`, `EnterpriseNodeChanged`, `EnterpriseNodeRetired`) | The flag audit view joins them with this module's records (6.4) |

**Mapping of refusals.** A change set or bundle refused by tenancy carries the tenancy refusals unchanged inside this module's result (`ChangeSetRefusal.CHAIN_REFUSED`, gate G7), so nothing is lost in translation [P].

**Points settled with the tenancy owner** (also in the final answer):
- `ChangeReason` is the kernel's (`hms.kernel.context`, D1). This module's own type is deleted.
- **One write path** (D12). Only this module writes `VENDOR_FOUNDATION`, `COUNTRY_PACK` and `TENANT` … `UNIT` values and locks, and only with a change set that `ChangeSetVerifier` verifies. Administrators change configuration through change sets, never by calling tenancy directly. USER preferences are tenancy's own path for ordinary keys. This replaces tenancy's earlier "administrators write directly" and the actor-permission rule for vendor and pack scopes. It is a tightening [P] (§3.4 item 1), recorded against SAF-01.
- Tenancy DN-T1 (formerly OQ-T8) proposes that the tightening side of SI-18 is the function's kill switch here. This spec agrees (6.3).

---

## 4. Public API (`hms.platform.config.api`)

Small and stable on purpose (D17): other modules code against it. Results are sealed values, not exceptions (§6.2).

Commands carry `hms.kernel.context.CommandContext` (D1): tenant, facility, actor (with its kind: `USER`, `DEVICE`, `INTERFACE`, `MIGRATION_LOADER`, `SYSTEM`), on-behalf-of, device, purpose of use, clinical time, idempotency key, correlation id and causation id (§6.2). `ChangeReason`, `ActorRef` and `UserId` are the kernel's. Every command is idempotent on the idempotency key: a repeat returns the first result and changes nothing (§22.1 item 2).

### 4.1 Registry

```kotlin
interface ConfigRegistry {
    fun register(definition: ContentTypeDefinition<*>): Registration
    fun register(definition: FlagDefinition): Registration   // also registers the backing SettingDefinition through tenancy's SettingCatalogueRegistrar (D2)
    fun flag(key: FlagKey): FlagDefinition?
    fun contentType(id: ContentTypeId): ContentTypeDefinition<*>?
    val version: RegistryVersion
}

sealed interface Registration {
    data class Registered(val version: RegistryVersion) : Registration
    data class Refused(val reason: RegistrationRefusal) : Registration
}
enum class RegistrationRefusal {
    DUPLICATE_KEY, INCOMPATIBLE_CHANGE, SAFETY_RELEVANT_DEFAULT_ON, CLINICAL_FLAG_NOT_SAFETY_RELEVANT,
    MISSING_CONTROL_REFS, UNAVAILABLE_HANDLING_NOT_ALLOWED, CLOSED_LOOP_FLAG_BELOW_FACILITY,
    MISSING_APPROVER_ROLES, INVALID_SCHEMA, NOT_OWNER,
    CATALOGUE_REFUSED   // carries tenancy's D-rule refusal
}

data class ContentTypeDefinition<T : Any>(
    val id: ContentTypeId,                    // e.g. "cds.rule", "orders.order-set" (owners name them)
    val owner: ModuleId,
    val schemaVersion: Int,
    val codec: ContentCodec<T>,               // canonical encode and decode, pure
    val validator: ContentValidator<T>,       // schema and referential checks, pure
    val implementationVersion: Int,           // bumped by the owner when codec or validator behaviour changes
    val safety: SafetyClass,                  // tenancy's type
    val requiredApproverRoles: Set<RoleRef>,  // the vendor set; tenants may add roles, never remove (section 12)
    val promotionChecks: List<PromotionCheck>,// e.g. replay evidence required (§19.4), supplied by the owner
)

data class FlagDefinition(
    val key: FlagKey,
    val kind: FlagKind,                       // CDS_RULE | CLINICAL_BEHAVIOUR | OPERATIONAL
    val owner: ModuleId,
    val safetyRelevant: Boolean,              // forced true for CDS_RULE and CLINICAL_BEHAVIOUR
    val defaultValue: FlagValue,              // must be OFF when safetyRelevant (INV-2)
    val changeClass: ChangeClass,             // C0 | C1 | C2 (§19.3)
    val lowestLevel: ConfigLevel,             // TENANT .. UNIT; at most FACILITY for closed-loop owners (INV-18)
    val whenUnavailable: UnavailableHandling, // no default: the owner declares it; forced for some kinds (6.2)
    val tier2Function: Tier2FunctionId?,      // set => an extra condition on top of the Register, never sufficient (INV-6)
    val controlRefs: Set<ControlId>,          // CTRL ids of the hazard log; at least one when safetyRelevant
)
enum class FlagKind { CDS_RULE, CLINICAL_BEHAVIOUR, OPERATIONAL }
enum class FlagValue { ON, OFF }
enum class UnavailableHandling { TREAT_AS_OFF, MANUAL_CHECK_REQUIRED }
```

Every flag has a kill switch by construction: there is no field to leave it out (INV-1).

Setting definitions are registered by their owners through tenancy's `SettingCatalogueRegistrar.register` (tenancy spec 5.3), not here, and read from the `SettingCatalogue` (D2). The registry is assembled once when `app-hms` starts. A refused registration stops the application from assembling, as tenancy's catalogue does [P].

**`RegistryVersion`** is the SHA-256 of the canonical encoding (5.5) of the declarative fields of every setting definition in the catalogue, every content type and every flag: keys, owners, value types, levels, safety classes, lock kinds, vendor defaults, change control, Tier 2 attributes, schema versions, flag kinds and handling, plus the declared `implementationVersion` of each codec, validator and strictness comparator. Code bodies are not hashed. An owner bumps `implementationVersion` when behaviour changes, and code review checks it [P].

### 4.2 Flags and kill switches

```kotlin
interface FlagEvaluator {
    // Callers pass their own registered flag constant. AsOf is hms.kernel.time.AsOf (D4).
    fun evaluate(flag: FlagDefinition, context: ResolutionContext, at: AsOf): FlagDecision
}
sealed interface FlagDecision {
    val trace: DecisionTrace                  // which level set the value, which switch is engaged, what failed
    data class On(override val trace: DecisionTrace) : FlagDecision
    data class Off(val reason: OffReason, override val trace: DecisionTrace) : FlagDecision
    data class Unavailable(                   // never On, never a silent Off (INV-3, 6.2)
        val reason: UnavailableReason,
        val handling: UnavailableHandling,    // copied from the flag's definition
        override val trace: DecisionTrace,
    ) : FlagDecision
}
enum class OffReason { DEFAULT_OFF, CONFIGURED_OFF, KILL_SWITCH_ENGAGED, TIER2_NOT_CLEARED }
enum class UnavailableReason {
    UNKNOWN_FLAG, CHAIN_REFUSED, NOT_CONFIGURED, KILL_SWITCH_STATE_UNREADABLE, CONFIGURATION_UNREADABLE, REGISTER_UNAVAILABLE
}

interface KillSwitchCommands {
    fun engage(command: EngageKillSwitch): KillSwitchResult
    fun recordReview(command: RecordKillSwitchReview): KillSwitchResult
    fun release(command: ReleaseKillSwitch): KillSwitchResult
}
data class EngageKillSwitch(val context: CommandContext, val flag: FlagKey, val scope: ConfigScope, val reason: ChangeReason)
data class RecordKillSwitchReview(
    val context: CommandContext, val switch: KillSwitchId, val expectedRevision: Long,
    val outcome: ReviewOutcome, val incident: IncidentRef?, val reason: ChangeReason,
)
enum class ReviewOutcome { KEEP_ENGAGED, RELEASE_APPROVED }
data class ReleaseKillSwitch(
    val context: CommandContext, val switch: KillSwitchId, val expectedRevision: Long,
    val review: KillSwitchReviewId, val reason: ChangeReason,
)

sealed interface KillSwitchResult {
    data class Engaged(val switch: KillSwitchId, val revision: Long) : KillSwitchResult
    data class AlreadyEngaged(val switch: KillSwitchId, val revision: Long) : KillSwitchResult  // a further engagement, recorded and audited
    data class Reviewed(val switch: KillSwitchId, val review: KillSwitchReviewId, val revision: Long) : KillSwitchResult
    data class Released(val switch: KillSwitchId, val revision: Long) : KillSwitchResult
    data class Refused(val reason: KillSwitchRefusal) : KillSwitchResult
}
enum class KillSwitchRefusal {
    NOT_PERMITTED, NOT_A_HUMAN_ACTOR, UNKNOWN_FLAG, UNKNOWN_SWITCH, SCOPE_NOT_ALLOWED, SCOPE_NOT_FOUND,
    STALE_REVISION, NOT_ENGAGED, REVIEW_REQUIRED
}
```

`KillSwitchId` is issued (UUIDv7) at the first engagement of a (flag, scope) in a tenant and reused for every later engagement of the same pair. The pair is unique by construction, because all of a tenant's switches live in one aggregate (5.2). `revision` counts the changes of one switch, so a release is checked against the switch the user saw, not against unrelated switches.

### 4.3 Change sets

```kotlin
interface ChangeSetCommands {
    fun submit(command: SubmitChangeSet): ChangeSetResult
    fun recordApproval(command: RecordApproval): ChangeSetResult
    fun reject(command: RejectChangeSet): ChangeSetResult
    fun withdraw(command: WithdrawChangeSet): ChangeSetResult
    fun apply(command: ApplyChangeSet): ChangeSetResult          // BUILD and PLAY only
}
data class SubmitChangeSet(
    val context: CommandContext,
    val environment: Environment,          // BUILD or PLAY; must equal the deployment's environment
    val base: StreamVersion,               // the stream state it was authored against
    val reason: ChangeReason,
    val items: List<ChangeItem>,           // at least one
)
data class ChangeItem(
    val target: ItemTarget,                // Setting(key, scope) | Lock(key, scope) | Content(typeId, itemId, scope) | Flag(key, scope)
    val before: CanonicalValue?,           // the raw entry at (key, scope) at `base` (tenancy entryAt); null = absent
    val after: CanonicalValue?,            // null = clear the value or remove the lock
    val validFrom: Instant?,               // null = from the recorded time of apply or activation (5.10)
    val validTo: Instant?,                 // null = open-ended
    val provenance: ContentProvenance,     // SYNTHETIC | APPROVED (§19.4); the shared kernel type
    val evidence: EvidenceRef?,            // required when the target's definition is GOVERNED (tenancy W-10)
    val accreditationImpact: String?,      // required for C1 flag items (§19.3)
)
data class RecordApproval(val context: CommandContext, val changeSet: ChangeSetId, val evidence: HumanApprovalRef)
data class ApplyChangeSet(val context: CommandContext, val changeSet: ChangeSetId, val expectedVersion: Long)

sealed interface ChangeSetResult {
    data class Accepted(val id: ChangeSetId, val state: ChangeSetState, val version: Long) : ChangeSetResult
    data class Refused(
        val reason: ChangeSetRefusal,
        val item: Int? = null,
        val chainRefusals: List<IndexedRefusal> = emptyList(),   // tenancy's, unchanged
    ) : ChangeSetResult
}
enum class ChangeSetRefusal {
    EMPTY, CHAIN_REFUSED /* carries tenancy's refusals, e.g. BelowLock, VendorLocked, LooserThanParent */,
    UNKNOWN_TARGET, WRONG_ENVIRONMENT, EVIDENCE_REQUIRED, RETROACTIVE_NOT_ALLOWED,
    NOT_PERMITTED, NOT_A_HUMAN_ACTOR, APPROVAL_NOT_FROM_HUMAN, AUTHOR_CANNOT_APPROVE,
    STALE, WRONG_STATE, TIER2_NOT_CONFIGURABLE, CHANGE_SET_NOT_VERIFIED
}
```

### 4.4 Bundles and promotion

```kotlin
interface BundleCommands {
    fun build(command: BuildBundle): BundleBuildResult                // BUILD only: snapshot + sign
    fun activate(command: ActivateBundle): ActivationResult           // in the target environment, for the context's tenant
}
data class BuildBundle(val context: CommandContext, val stream: BundleStreamRef, val reason: ChangeReason)
data class ActivateBundle(val context: CommandContext, val bundle: SignedBundle, val target: Environment)

sealed interface BundleBuildResult {
    data class Built(val bundle: SignedBundle) : BundleBuildResult
    data class Refused(val reason: BuildRefusal) : BundleBuildResult
    // BuildRefusal: SIGNING_UNAVAILABLE, UNRESOLVED_MERGE, SNAPSHOT_UNAVAILABLE
}
sealed interface ActivationResult {
    data class Activated(val manifestHash: Sha256, val sequence: Long, val gates: GateReport) : ActivationResult
    data class Refused(val gates: GateReport) : ActivationResult      // nothing changed in this tenant (INV-11)
    data class Incomplete(val activation: ActivationId) : ActivationResult   // values written; completion left to reconciliation (5.7)
}

class SignedBundle(val manifestBytes: ByteArray, val itemBytes: Map<ItemPath, ByteArray>, val signature: BundleSignature)
data class BundleSignature(val algorithm: String /* "Ed25519" */, val keyId: KeyId, val value: ByteArray)
typealias Environment = hms.kernel.time.EnvironmentClass   // BUILD, TEST, TRAIN, PROD, PLAY; the kernel's type, not redeclared
```

### 4.5 Merge

```kotlin
interface OverlayMerge {
    fun merge(base: LayerSnapshot, overlay: LayerSnapshot, newBase: LayerSnapshot): MergeResult
}
data class MergeResult(val candidate: LayerSnapshot, val findings: List<MergeFinding>) {
    val promotable: Boolean get() = findings.none { it.blocking }
}
```

### 4.6 Queries and content

```kotlin
interface ConfigQueries {
    fun activeBundle(tenant: TenantId, stream: BundleStreamRef): ActiveBundle?
    fun changeSet(id: ChangeSetId): ChangeSetView?
    fun engagedKillSwitches(tenant: TenantId, scope: ConfigScope): List<KillSwitchView>  // at this scope and its ancestors; includes CDS flags switched off by value
    fun flagHistory(key: FlagKey, scope: ConfigScope, recorded: TimeRange): List<FlagAuditRecord>
    fun syntheticItems(tenant: TenantId, stream: BundleStreamRef): List<ItemPath>          // for the Release Evidence Pack (§19.4)
}

interface ContentReader {
    fun <T : Any> resolve(type: ContentTypeDefinition<T>, item: ContentItemId, context: ResolutionContext, at: AsOf): ContentResolution<T>
}
sealed interface ContentResolution<out T> {
    data class Resolved<T>(val value: T, val contentHash: Sha256, val provenance: ContentProvenance, val chain: SettingProvenance) : ContentResolution<T>
    data class NotConfigured(val item: ContentItemId) : ContentResolution<Nothing>
    data class Refused(val reason: ResolutionRefusal) : ContentResolution<Nothing>     // tenancy's
    data class Unavailable(val reason: ContentUnavailableReason) : ContentResolution<Nothing>  // body missing or unreadable
}
```

Each caller's spec must name its fail-closed mechanism and test for `NotConfigured`, `Refused` and `Unavailable`; this module claims none (§3.5; D16).

### 4.7 Ports this module defines (implemented elsewhere) and their production bindings

Every production binding below is fail-closed. Each row names the mechanism and the test that proves it (D16). The bindings live in one wiring class, `PlatformConfigProductionWiring`, which the first test constructs directly.

| Port | Purpose | WP-0.3 production binding: mechanism | Test that proves it | Real adapter |
|---|---|---|---|---|
| `HumanApprovalSource` | Confirms that an approval reference is a human's sign-off for this change set, role and version (§3.5) | `NoApprovalSource`: confirms nothing, so no change set with `APPROVED` items reaches `APPROVED` | `UnitTest:production-approval-source-confirms-nothing` | Build time: the sign-off records under `docs/safety/signoffs/` checked by `sh tools/hms safety check`, for vendor content built from `content/`. Runtime: an in-product approval signed by an authenticated human (WP-0.4; signature-provider port, OQ-005) |
| `BoundaryRegisterPort` | Status of a Tier 2 function for a tenant, version and jurisdiction (§10.2) | `UnavailableRegister`: every query answers `UNAVAILABLE`, so every Tier 2-bound flag evaluates `Unavailable(REGISTER_UNAVAILABLE, TREAT_AS_OFF)` | `PropertyTest:SI-18-activation-only-when-cleared-or-not-required` (the unavailable case) | `safety-registry` (WP-0.9) |
| `TerminologyValidationPort` | "Every code resolves in the terminology service" (§19.4) | `RefusingTerminology`: any item with coded references fails gate G6 | `UnitTest:production-terminology-port-refuses-coded-items` | `terminology` (`PLT-CORE-05`, WP-1.1) |
| `ConfigAuthorization` | Permission decisions (section 9) | `DenyAllConfigAuthorization`: every command from outside is refused `NOT_PERMITTED` | `UnitTest:production-authorization-denies-every-command` | Trust Plane SDK (WP-0.4) |
| `ConfigAudit` | Audit of refused commands (accepted ones are journal entries, section 9) | `OperationalLogConfigAudit`: a structured, PHI-free operational record (configuration carries no PHI, INV-17). Not a BALP audit, and not described as one (KA-CFG-5) | `UnitTest:refused-command-reaches-audit-port` | Journal plus BALP AuditEvent (WP-0.4) |
| `BundleSigner` | Signs a manifest | `UnavailableSigner`: returns `SIGNING_UNAVAILABLE` | `UnitTest:production-signer-refuses-to-sign` | Per ADR-CFG-1 |
| `TrustStore` | Pinned public keys per role and environment, with revocations | Empty: every verification fails G1 with `UNTRUSTED_KEY` | `UnitTest:empty-trust-store-refuses-every-bundle` | Per ADR-CFG-1 |
| `PromotionLedger` | Which manifest hashes were activated in which environment | None in production: G4 fails with `LINEAGE_UNAVAILABLE` outside BUILD and PLAY | `UnitTest:missing-promotion-ledger-refuses-lineage` | Transport between real environments: ADR-CFG-1 [P] |
| Repositories (`ChangeSetRepository`, `KillSwitchBoardRepository`, `StreamActivationRepository`, `FeatureFlagRepository`, `ContentStore`) | State of this module | None in production (D8). The application refuses to start (section 11) | `IntegrationTest:app-hms-refuses-to-start-with-volatile-config-state`; `ArchTest:production-never-binds-test-adapters` | jOOQ adapters (later slice) |

`UnitTest:production-wiring-binds-fail-closed-adapters` constructs `PlatformConfigProductionWiring` and checks that each port above is bound to the named adapter.

**Ports this module implements for others:** `ChangeSetVerifier` (tenancy's, 5.7). The flag evaluator and `ContentReader` are this module's own api.

---

## 5. Domain model and invariants

### 5.1 Invariants

| ID | Invariant | Source |
|---|---|---|
| INV-1 | Every registered flag, of every kind, has a kill switch. The flag model has no way to declare one without it | SI-19 clause a; CTRL-0019-3. Covering `OPERATIONAL` flags too is a tightening [P] (§3.4 item 1) |
| INV-2 | A `CDS_RULE` or `CLINICAL_BEHAVIOUR` flag is safety-relevant. A safety-relevant flag registers with coded default `OFF` and at least one control reference; registration refuses anything else | SI-19 clause b; §19.3 C1 "Ships flag-off by default"; CTRL-0019-5 |
| INV-3 | Evaluation order: (1) flag not registered → `Unavailable(UNKNOWN_FLAG)`; (2) the scope chain from tenancy `chainOf`, refused → `Unavailable(CHAIN_REFUSED)`; (3) kill-switch state unreadable → `Unavailable(KILL_SWITCH_STATE_UNREADABLE)`; any switch engaged at a scope on the chain → `Off(KILL_SWITCH_ENGAGED)`; (4) Tier 2-bound flag: Register `cleared` or `not-required` → continue, another status → `Off(TIER2_NOT_CLEARED)`, Register unavailable → `Unavailable(REGISTER_UNAVAILABLE)`; (5) the backing setting: `Resolved` → `On`, or `Off(CONFIGURED_OFF)` / `Off(DEFAULT_OFF)` by provenance; `NotConfigured` → `Unavailable(NOT_CONFIGURED)`; `Refused` → `Unavailable(CHAIN_REFUSED)`; store failure → `Unavailable(CONFIGURATION_UNREADABLE)`. A kill switch beats every value. No failure yields `On` | SI-19; SI-18; CTRL-0018-3; §3.5; §2.2 rule 6 ("nothing fails silently") |
| INV-4 | A live evaluation (`knownAt` null) applies the latest committed kill-switch state, whatever `validAt` is. An as-was evaluation (`knownAt` set) applies the switch history with recorded time ≤ `knownAt`. An engaged switch takes effect for every live evaluation that starts after the engage transaction commits, without a deploy, restart or bundle promotion | §9.6 acceptance "every kill switch works without a deploy"; HAZ-0019 cause "A kill switch that needs a deploy or a restart"; §7 item 3 (as-was) |
| INV-5 | Every flag change (value through activation, kill-switch engagement, further engagement, review and release) produces one journal entry and audit record with actor, on-behalf-of, reason, before, after, scope, recorded time from the journal's single clock read, and the change set or bundle reference where there is one. The reason is never defaulted | §6.6 "Flag changes are audited"; R07 AU-1 "admin change"; §6.2 (time); D10 |
| INV-6 | No setting, content item or flag can activate a Tier 2 function. A flag with `tier2Function` is only an extra condition on top of the Register; its backing setting declares `Tier2Binding.RestrictsTier2Function(function)`, never `GatesTier2Function`, which tenancy's catalogue refuses for every key (D-6; D12) | SI-18 clause d; CTRL-0018-6; ADR-016 |
| INV-7 | A change set item with `APPROVED` provenance counts as approved only from human approval evidence that `HumanApprovalSource` confirms, for every required role. Only an actor of kind `USER` can approve; no system, device, interface, loader or agent principal can. The author cannot approve their own change set. This is code, not a setting [P] | §3.5 "Never record an approval you did not witness"; §19.3 C1 CSO review [HUMAN]; tenancy §9 ("the chain's own rules are code") |
| INV-8 | Applying a change set is compare-and-set per item: every `before` must equal the raw entry at its key and scope (`entryAt`), not the resolved value; otherwise the change set becomes `STALE` and nothing is written | §6.2 optimistic concurrency; R08 §5 change sets |
| INV-9 | No item writes below a lock. Refused at submit (tenancy dry run), at apply (tenancy refuses the write too) and at activation (gate G7) | §6.6; WP-0.3 exit "A locked setting cannot be overridden below its lock" |
| INV-10 | A vendor-locked safety-invariant parameter can only be tightened below the vendor level, never loosened. A `Fixed` safety key is also never looser than its coded vendor default (D12) | §2.1 preamble; K §5.1; CTRL-00nn-1 of every SI hazard ("config-chain-vendor-lock-SI-nn") |
| INV-11 | Per tenant, a bundle is activated only if every gate passes. The values, locks and tenancy's activation record (W-22) are written in one tenancy batch, all or nothing. A refused bundle changes nothing in that tenant. Completion of this module's own record is reconciled (5.7) | §6.6 "validated, signed, replayed before activation"; §19.4 |
| INV-12 | Anti-rollback: per (tenant, stream) in a deployment, the activated sequence strictly increases. The authority is tenancy's last activation record (`lastActivation`, W-22), written in the same transaction as the values. Reverting is a new bundle with a higher sequence and the older content | ADR-021 "anti-rollback" for releases, applied to bundles [P] |
| INV-13 | A bundle with any `SYNTHETIC` item is refused for TRAIN and PROD (G8). As defence in depth, the change-set verifier answers `NotVerified` for any batch with `SYNTHETIC` provenance in TRAIN or PROD (and tenancy W-18 refuses a `SYNTHETIC` verdict there) | §19.4 "Synthetic content is a gate, not a label"; D11 |
| INV-14 | Canonical serialisation is deterministic: the same logical content gives the same bytes and hash, whatever the insertion order, locale, default charset, line endings or platform | Needed for content hashes and signatures (§2.2 rule 8 "signed-bundle verification") [P] |
| INV-15 | The three-way merge applies the ordered rules of section 7, first match wins, so every tenant override lands in exactly one finding. It never drops or loosens a tenant value silently. It never auto-resolves a conflict on a safety-classified key. Taking a stricter vendor value of a tighten-only key is not resolving a conflict, because nothing loosens; it is still reported | R08 §9 three-way merge; §2.1 preamble (tighten, never loosen); section 7 |
| INV-16 | A kill switch is an emergency stop, not retirement. Engaging one never changes a rule's status in the CDS registry, and this module has no runtime operation that removes a flag definition | SI-14 clause e ("never retired on override rate alone"); CTRL-0014-7 |
| INV-17 | Configuration carries no PHI. Item types may not hold patient references or free-text patient data [P] | §2.3 (never "use real patient data anywhere outside production"); bundles travel through non-production environments; §19.2 synthetic only outside production |
| INV-18 | No flag owned by `orders`, `medications` or `transfusion` may be set below `FACILITY` (`lowestLevel` at most `FACILITY`). Closed-loop capabilities come only from the clinical tier, never from a flag [P] | §6.6; K-24; CTRL-0005-14 |
| INV-19 | Every value or lock this module writes reaches tenancy under a `ChangeSetId` that this module's `ChangeSetVerifier` answers `Verified` for, with origin `AppliedChangeSet` or `BundleActivation`. A batch it does not verify is refused by tenancy and nothing is written | D12; R08 §5 "Every change belongs to a versioned, approved change set" |
| INV-20 | A kill switch is released only after a human review, recorded after the latest engagement, with outcome `RELEASE_APPROVED`. Engage, review and release need an actor of kind `USER` | HAZ-CFG-C; §3.5 [P] |
| INV-21 | Engagement never depends on configuration. A missing review queue or SLA value never blocks or delays an engagement; the review request is then refused by `platform-tasks` and takes the `REQUEST_REFUSED` → `TaskOrphaned` path with its alarm (6.3) [P] | SI-19 clause a; SI-03 |
| INV-22 | A safety-relevant flag is set ON only by a `TENANT_OVERLAY` item at a level from `TENANT` to the flag's `lowestLevel`, approved by roles that include the CSO. A vendor or pack stream never sets a safety-relevant flag ON (G11) [P] | SI-19 clause b; §19.3 C1; CTRL-0019-5 |
| INV-23 | Flag evaluation never fails silently. Every `Unavailable` carries the flag's declared handling and raises the operational alarm `FlagEvaluationUnavailable`. A caller treats `TREAT_AS_OFF` as the established behaviour without the flagged change, and `MANUAL_CHECK_REQUIRED` as "check unavailable, manual check required", never as "rule off" | §3.5; §2.2 rule 6; BP §5.6 ("never simply left off"); D13 |

### 5.2 Aggregates

Every aggregate belongs to one tenant (ADR-006; §6.4). No event concerns a patient. Every aggregate type of this module has keying `TENANT`: the partition key is the tenant id (D6; `envelope.md` §5; journal J-14; catalogue §5).

| Aggregate | Identity (aggregate id) | Holds | Journal aggregate type [P] |
|---|---|---|---|
| `ConfigChangeSet` | `ChangeSetId` (UUIDv7) | Tenant, environment, author, reason, base stream version, items, required roles, approvals, state | `ConfigChangeSet` |
| `KillSwitchBoard` | One per tenant; the aggregate id is the tenant id's UUID | Every switch of the tenant by (flag, scope): `KillSwitchId`, state, revision, engagements, reviews and releases with actor, reason and recorded time | `KillSwitchBoard` |
| `StreamActivation` | One per (tenant, stream) in a deployment; UUIDv7 issued at the first activation; (tenant, stream) unique | Pending and completed activations, gate reports, refusals | `StreamActivation` |
| `FeatureFlag` | One per (tenant, flag key); UUIDv7 issued at the first value change; (tenant, flag key) unique | The flag's value-change history as written by activations (the value itself lives in tenancy) | `FeatureFlag` |
| Content store | Content hash (SHA-256) | Immutable, content-addressed item bodies. Not an aggregate: bodies are written with the `StreamActivation` pending entry, which lists their hashes | not journaled itself |
| `RegistryVersion` | Hash | The set of definitions, built at start-up from module registrations | not journaled; recorded in each bundle manifest |

**Ordering.** All of one tenant's configuration events share one key, so they arrive in commit order (for example `KillSwitchEngaged` before a later `FeatureFlagChanged`). Consumers must not assume any order between config and tenancy events. Caches invalidate per aggregate and re-read state; they never rebuild state from event order [P]. The flag evaluator never relies on events: it reads the switch board and the chain directly (6.2).

**One row per aggregate per append** (this module's own rule [P]; the journal allows consecutive versions of one aggregate in an append, journal §4.5). A command that emits several facts writes each on its own aggregate: a `TaskRequested` row is version 1 of its own request aggregate (type and id per `platform-tasks`), and each `FeatureFlagChanged` row is on that flag's `FeatureFlag` aggregate.

**Contention.** Kill-switch commands are rare, so one board per tenant is enough. A board version conflict caused by a change to a different switch is retried by the handler, because the guard is the switch's own revision [P].

Flag values are settings in the chain (tenancy), written only by change sets and bundle activation. Kill-switch state is not a chain setting: it is this module's own state, so it can change without a bundle (INV-4).

**Change set states.**

| From | Command | Guard | To | Emits |
|---|---|---|---|---|
| — | submit | permitted; at least one item; environment equals the deployment's (BUILD or PLAY); tenancy dry run passes; evidence on governed items; validFrom rules (5.10) | `SUBMITTED` | `ChangeSetSubmitted` |
| `SUBMITTED` | recordApproval | permitted; actor kind `USER`; not the author; `HumanApprovalSource` confirms role and version | `SUBMITTED`, or `APPROVED` at the last required role | `ChangeSetApproved` at the last role |
| `SUBMITTED` | reject | permitted; reason | `REJECTED` | `ChangeSetRejected` |
| `SUBMITTED`, `APPROVED` | withdraw | the author; reason | `WITHDRAWN` | `ChangeSetWithdrawn` |
| `APPROVED`; or `SUBMITTED` when every item is `SYNTHETIC` (BUILD and PLAY only) | apply | permitted; version matches; every `before` equals `entryAt` | `APPLYING`, or `STALE` | `ChangeSetApplyStarted` / `ChangeSetStale` |
| `APPLYING` | tenancy commit confirmed (5.7) | — | `APPLIED` | `ChangeSetApplied` |
| `APPLYING` | tenancy refusal | — | `APPLY_REFUSED` (tenancy refusals kept) | `ChangeSetApplyRefused` |

`STALE`, `REJECTED`, `WITHDRAWN`, `APPLIED` and `APPLY_REFUSED` are final. A synthetic change set may apply without approvals in BUILD and PLAY only; G8 keeps it out of TRAIN and PROD [P].

### 5.3 Bundle streams and layers

A bundle is a full snapshot of one stream, not a delta [P]. Full snapshots make verification, anti-rollback and revert simple.

| Stream | Covers levels | Signed by (key role) | Who authors |
|---|---|---|---|
| `VENDOR_FOUNDATION` | VENDOR_FOUNDATION | Vendor content key | Vendor, from `content/` (§19.4) |
| `COUNTRY_PACK:kri` | COUNTRY_PACK (`CountryPackId("kri")`, tenancy 4.2) | Vendor content key | Vendor; K-26 "one owned Kurdistan pack"; owned by `content` (§5.2) |
| `TENANT_OVERLAY:<tenant code>` | TENANT, LEGAL_ENTITY, FACILITY, DEPARTMENT, UNIT | Tenant configuration key | The hospital's analysts in BUILD. The tenant code, not the tenant UUID, names the stream (5.9) |

**Activation is per tenant** (SAF-18). Tenancy stores vendor and pack values in each tenant's database (ADR-006; §6.4). A vendor or pack stream is activated in each tenant separately, as one tenancy batch for that tenant (INV-11). On a site with several tenants, a vendor rollout is a sequence of per-tenant activations. During it, tenants may run different vendor sequences. Each tenant's overlay lineage (base refs, G4) is checked against that tenant's own active vendor and pack bundles. A failed tenant does not stop or undo the others, and the operator sees a result per tenant [P].

USER-level values are personal preferences for ordinary keys. They are not bundled or promoted; tenancy writes them at runtime on its own path, and they still obey locks [P]. Flags cannot be set at USER level [P] (6.1).

### 5.4 Manifest

```text
BundleManifest {
  formatVersion            // of this manifest format
  stream                   // section 5.3
  sequence                 // strictly increasing per stream (INV-12)
  semanticVersion          // vendor streams: semantic versioning (R08 §9)
  baseRefs[]               // for an overlay: the vendor bundles (stream, sequence, manifest hash) it was authored or merged against
  registryVersion          // the registry the items were validated against
  builtAt                  // RecordedTime from the injected Clock
  builtBy                  // actor
  changeSets[]             // ids of the change sets included since the previous sequence
  items[] {
    path                   // stream-unique: <typeId>/<itemId>@<scope address>, setting/<key>@<scope address> or lock/<key>@<scope address>
    itemType, schemaVersion
    scope                  // a tenancy ScopeAddress: level and node codes (5.9), never a database id
    sha256                 // of the item's canonical bytes
    provenance             // SYNTHETIC | APPROVED (§19.4)
    approvals[]            // HumanApprovalRef per required role; empty only for SYNTHETIC
    evidenceRef?           // required when the target definition is GOVERNED (G9; tenancy W-10)
    validFrom?, validTo?   // explicit effective dating; absent = from the activation's recorded time (5.10)
  }
}
```

The signature covers the canonical bytes of the whole manifest. Item bytes are covered through their hashes. Verification recomputes every item hash; an item present without a manifest entry, or a manifest entry without its item, fails (gate G2).

### 5.5 Canonical serialisation [P]

Pure Kotlin, in the domain, with no JSON library (domain packages may not use Jackson; backend/README.md, "Fitness functions"). The format is a strict JSON subset modelled on RFC 8785 (JSON Canonicalization Scheme). Rules:
- values: object, array, string, boolean, null, and integers within ±(2⁵³−1). No floating-point numbers: decimals travel as strings in a declared decimal format (§6.2 "Never floating point");
- object keys sorted by UTF-16 code units, no duplicates; no insignificant whitespace;
- strings UTF-8, with the minimal escapes only; no Unicode normalisation is applied, so the author's exact text is what is signed;
- the encoder refuses anything outside the subset (a programming error, so it may throw).

Whether to claim RFC 8785 conformance for this subset is an open question (OQ-CFG-11). The properties that matter here (INV-14) are tested directly.

### 5.6 Signature and trust [P]

- Algorithm: Ed25519 through `java.security.Signature.getInstance("Ed25519")`, the JDK's own provider. No new dependency (§4.3).
- `KeyId` = SHA-256 of the public key's encoded form.
- Trust store: pinned public keys, each with a role (vendor content, tenant configuration), the environments it may sign for, a validity period and a revocation flag. The trust store ships inside the signed release, so a site cannot add a key by configuration [P]. Adding, rotating or revoking production keys is decided by ADR-CFG-1 and a [HUMAN] decision (§4.3: "Production keys … need an ADR and a [HUMAN] decision").
- **Revocations survive a release rollback** (SAF-24). ADR-021 allows rollback to N-1, which would bring back an older trust store. Each trust store carries a revocation-set sequence. The deployment keeps the highest revocation-set sequence it has seen, outside the release, and refuses to start with a trust store whose sequence is lower. Revocations are therefore monotonic [P]. Until the persistence slice holds that high-water mark, the production trust store is empty anyway (below).
- Until the key decision, the production trust store is empty and every activation outside tests fails closed with `UNTRUSTED_KEY` (KA-CFG-1).
- Tests generate key pairs with `KeyPairGenerator.getInstance("Ed25519")` at test time. No private key is ever written to the repository or to disk; the secret scan (§6.8 item 7) covers the repository.

### 5.7 Writing through tenancy: change-set verification and the two commits

§2.2 rule 3 and §5.2 let only Safety Kernel modules share a transaction. This module and tenancy therefore commit separately. The design below makes that safe (CA-09) and makes every write verifiable inside tenancy (CA-01, SAF-01, D12). The names on the tenancy side are tenancy's (tenancy §6; 3.1).

**The change set id.** `ApplyConfigurationChanges` carries `changeSet: ChangeSetId` and no provenance. Every batch this module sends has its own `ChangeSetId`, issued here: an applied change set uses its own id, and every bundle activation gets a fresh id for its per-tenant batch. Tenancy asks this module's verifier about that id before it writes (tenancy W-16):

```kotlin
// Defined in hms.platform.tenancy.api (tenancy §6); implemented here.
interface ChangeSetVerifier {
    fun verify(tenant: TenantId, changeSet: ChangeSetId, digest: ChangesDigest): ChangeSetVerdict
}
sealed interface ChangeSetVerdict {
    data class Verified(
        val tenant: TenantId, val changeSet: ChangeSetId, val digest: ChangesDigest,
        val origin: ChangeOrigin,                   // AppliedChangeSet | BundleActivation(stream, sequence, manifestHash)
        val contentProvenance: ContentProvenance,
        val humanApproved: Boolean,
        val governedRolesApproved: Boolean,
    ) : ChangeSetVerdict
    data class NotVerified(val reason: VerificationRefusal) : ChangeSetVerdict
    data object Unavailable : ChangeSetVerdict
}
sealed interface ChangeOrigin {
    data object AppliedChangeSet : ChangeOrigin
    data class BundleActivation(val stream: BundleStreamRef, val sequence: Long, val manifestHash: String) : ChangeOrigin
}
// VerificationRefusal: UNKNOWN_CHANGE_SET, WRONG_TENANT, DIGEST_MISMATCH, NOT_APPROVED, BUNDLE_NOT_VERIFIED
// The digest is ChangesDigest.of(changes), tenancy's function over the canonical encoding (5.5).
```

This module's verifier answers `Verified` only for:
- **An applied change set** (origin `AppliedChangeSet`) of this tenant in state `APPLYING`, in an environment of BUILD or PLAY that equals the deployment's, whose items give exactly the batch's `ChangesDigest`, and whose `APPROVED` items have every required approval confirmed by `HumanApprovalSource` (INV-7). `humanApproved` and `governedRolesApproved` report those approvals. A change set with only `SYNTHETIC` items is verified as `SYNTHETIC`.
- **A bundle activation batch** (origin `BundleActivation`) of this tenant in state `PENDING`, whose gates all passed in this process, whose manifest hash and sequence match, and whose computed difference gives exactly the batch's `ChangesDigest`. Items that passed gate G9 report `humanApproved` and `governedRolesApproved`.
- Never `SYNTHETIC` content provenance in TRAIN or PROD (INV-13; D11): such a batch answers `NotVerified`. Tenancy's W-18 refuses a `SYNTHETIC` verdict there as well.

Anything else answers `NotVerified` with tenancy's `VerificationRefusal`; a store failure answers `Unavailable`. Tenancy then refuses the batch (INV-19). A fabricated change set id, a forged provenance or a direct call from another module therefore writes nothing. Tenancy also restricts `ConfigurationCommands` to `hms.platform.config` and its own USER-preference handler with an arch rule (tenancy spec; D7).

**Activation in three steps.**
1. **Gates and pending record** (this module's transaction). Run G1–G13 read-only. If any fails, append `BundlePromotionRefused` with the gate report and stop (`Refused`; nothing changed in tenancy). A gate run is a recorded outcome, so it is journaled; a command refused before any gate runs (permission, malformed input) goes to the audit port (section 9). Otherwise write the content bodies into the content store and append `BundleActivationPending(activation id, change set id, manifest hash, sequence, batch digest)` on `StreamActivation`. Only one activation per (tenant, stream) may be pending.
2. **Values** (tenancy's transaction). Call `ConfigurationCommands.apply` with the activation's `ChangeSetId`. Tenancy calls `ChangeSetVerifier`, applies the batch all-or-nothing and records the activation (stream, sequence, manifest hash; read back through `lastActivation`) in the same transaction, refusing a sequence not above the last one (W-22). Tenancy is idempotent: a repeat with the same idempotency key returns the first result, and the same manifest hash again is an idempotent repeat (W-22).
3. **Completion** (this module's transaction). Append `BundlePromoted` on `StreamActivation` (state `ACTIVATED`), a `FeatureFlagChanged` row on each changed flag's `FeatureFlag` aggregate, and a `TaskRequested` row for each `CDS_RULE` flag switched from ON to OFF by value (6.1).

If step 2 is refused, step 3 appends `BundlePromotionRefused` with tenancy's refusals, and nothing changed in tenancy. If the process stops between steps 2 and 3, the call returns `Incomplete` or nothing.

**Reconciliation.** A reconciler in `hms.platform.config.application.system` runs at start-up and on a timer as the `SYSTEM` actor (kernel §7.2 `SYSTEM_PROCESSES`) [P]. For each `PENDING` activation it reads tenancy's `ConfigurationQueries.lastActivation(tenant, stream)`. If tenancy shows the manifest hash, it completes step 3 (idempotent). If not, it re-runs step 2 with the same change set id, which is safe because tenancy is idempotent and checks the sequence (W-22). A pending activation still unresolved after the reconciliation bound raises the operational alarm `ActivationStuck` and becomes an owned task through the same `TaskRequested` path as 6.3. The bound is a deployment parameter set with the cell; it is not a clinical value (OQ-CFG-4).

**Change sets** follow the same pattern: `APPLYING` (this module), the tenancy batch with the change set's own id (origin `AppliedChangeSet`), then `APPLIED`. The reconciler resolves `APPLYING` change sets the same way.

**Which record anti-rollback trusts:** tenancy's last activation record (`lastActivation`, W-22), because it commits with the values (INV-12). This module's `StreamActivation` is the gate and audit history.

### 5.8 Content items (CA-11)

Content items (order sets, CDS rules, escalation policies, tariffs) are versioned, effective-dated and scoped like settings, but their bodies are structured documents. The design splits the two [P]:
- **The chain holds references.** There are no open key families: tenancy's catalogue is sealed at assembly (D-13), and open-ended ids are content, not settings (tenancy 5.3). So an owning module declares fixed keys whose value type is `CONTENT_REF(contentTypeId)`, one per place that points at content (for example `orders.default-order-set`). The value is the content type, item id and content hash. Tenancy resolves which reference applies at a context and time, with locks, effective dating and provenance, exactly as for any setting. Chain logic is never duplicated here.
- **This module holds bodies.** The content store keeps each body once, under its SHA-256, immutable. A body without a reference is unreachable and harmless.
- **Readers** (`cds` for rules, `orders` for order sets, `platform-tasks` for escalation policies, `rcm` for tariffs) use `ContentReader.resolve`, which resolves the reference through tenancy and decodes the body with the type's codec.
- **Activation** writes bodies in step 1 and references in the step 2 batch, so a reader sees a new body only once its reference has committed.

`platform-tasks` keeps its escalation policies as items of the content type `platform.tasks.escalation-policy`, read through `ContentReader` (tasks §4.2 and A-6). OQ-CFG-13 is closed.

### 5.9 Scope addressing across environments (CA-12)

BUILD, TEST, TRAIN and PROD each hold their own tenant database, so node and tenant UUIDs differ between them. Bundles therefore never carry database ids. A bundle item's scope is tenancy's `ScopeAddress`: the level and the node codes from the facility down, or the legal-entity code (tenancy H-8 keeps codes unique per kind among overlapping validity) [P]. The tenant is the activation's tenant, so the address carries no tenant id.
- The bundle builder turns each `ConfigScope` into a `ScopeAddress`. Tenancy has no reverse lookup, so the builder reads the node's `code` with `EnterpriseDirectory.node(tenant, id, at)` and its ancestors' codes with `ancestors(tenant, id, ORGANISATIONAL, at)`.
- Activation turns each `ScopeAddress` back into the target environment's `ConfigScope` through `EnterpriseDirectory.resolveAddress(tenant, address, at)`. An address that does not resolve, or resolves to a node that is not active, refuses the activation at gate G13. Nothing maps to "nothing".
- The enterprise structure itself is not promoted in WP-0.3. Each environment sets it up with the same codes (WP-1.1 tooling). Whether the structure should travel in its own signed stream is OQ-CFG-14.

### 5.10 Time (D4, D10; CA-22, SAF-25)

- **Valid periods of items.** `ChangeItem` and manifest items carry `validFrom` and `validTo`. An absent `validFrom` means "from the recorded time of the apply or activation", which tenancy assigns. Future starts are allowed (for example next year's holidays).
- **No retroactive items** [P]. An explicit `validFrom` earlier than the recorded time of the apply or activation is refused: at submit (`RETROACTIVE_NOT_ALLOWED`), and at activation as a G7 finding. A bundle built in BUILD with an explicit start that has passed by the time it reaches PROD is therefore refused with a clear finding, not silently re-based. The author re-issues it without the start or with a later one. This holds for every key; tenancy's W-11 already refuses retroactive safety-classified writes, and this module adds the same for ordinary items in bundles because a bundle has no retroactive permission to carry (OQ-CFG-12).
- **This module's own journal rows** record administrative acts at the moment they are recorded. Their entry timing is computed by the journal appender with the kernel's `EntryTimeClassifier`, from the command's context and its single clock read (D10). Every row has valid-time kind `EFFECTIVE`. This module never asks for back-dating and has no back-entry path. The command states expected timing `EFFECTIVE_DATED`; any other classification is refused as `TimingMismatch`, and the command fails [P]. The appender has no per-module rule.
- **`AsOf`** is `hms.kernel.time.AsOf(validAt: Instant, knownAt: Instant? = null)` (D4). Callers pass the clinical time of the act being decided as `validAt`; it never defaults to "now". An as-was query builds it from an `Instant`, or with `AsOf.knownAt(validAt, recorded)` from a recorded time already held (kernel spec §6.1).

---

## 6. Flags and kill switches (SI-19)

### 6.1 Flag kinds

| Kind | Meaning | Safety-relevant | Default | Kill switch | When unavailable |
|---|---|---|---|---|---|
| `CDS_RULE` | One per CDS rule; `cds` registers it with the rule (§9.6 "Every rule and flag has a kill switch") | Always | OFF | Always | `MANUAL_CHECK_REQUIRED`, forced |
| `CLINICAL_BEHAVIOUR` | A clinical-behaviour change behind a flag (§19.3 C1), AI features from P2 (§17.3 G9) | Always | OFF | Always | Declared by the owner, reviewed with its hazard analysis |
| `OPERATIONAL` | No change to clinical behaviour (C0) | As declared | As declared; OFF if declared safety-relevant | Always [P] | Declared by the owner |
| any kind with `tier2Function` | An extra condition on a Tier 2 function | As its kind | OFF | Always | `TREAT_AS_OFF`, forced |

A flag declared `OPERATIONAL` by its owner is a claim that it does not change clinical behaviour. The claim is reviewed with the owning module's hazard analysis (§2.4 safety-impact field); this module cannot verify it (OQ-CFG-10).

**Backing setting.** A flag's value is a setting in the chain. Registering a flag registers a backing `SettingDefinition` through tenancy's `SettingCatalogueRegistrar` [P]:
- key `flag.<flag key>`; type `ENUM(FlagValue)`; owner the flag's owner; `vendorDefault` the flag's default;
- `allowedLevels` from `VENDOR_FOUNDATION` to the flag's `lowestLevel`, never `USER` (tenancy D-4 for safety-classified keys);
- `safety`: `SafetyRelevant(controlRefs)` for every safety-relevant flag, otherwise `Ordinary`;
- `vendorLock`: `None`, stated explicitly. SI-19's locked parts are rules, not the value (6.5);
- `changeControl`: `GOVERNED` for `CDS_RULE` and `CLINICAL_BEHAVIOUR` flags in both directions, and for every C1 flag; `ROUTINE` otherwise (SAF-09);
- `tier2Binding`, stated explicitly: `Tier2Binding.RestrictsTier2Function(function)` for a Tier 2-bound flag (a restriction, never sufficient; tenancy D-6; INV-6), otherwise `NotTier2`.

Tenancy's write rules guard every write of the value. This module adds the SI-19 rules on top.

**How a safety-relevant flag gets turned on** (INV-22; CA-33). The coded default is OFF. An ON value arrives only as a `TENANT_OVERLAY` item, at a level from `TENANT` to the flag's `lowestLevel`, in an approved change set whose approver roles include the CSO [HUMAN], carried in a bundle that passes promotion. A C1 item also carries the accreditation-impact field (§19.3). The vendor-validated CDS baseline that is interruptive from day 0 (SI-14 clause c) is turned on the same way: in the tenant's approved go-live bundle, not through a default and not in the vendor or pack stream. So SI-19 clause b and SI-14 clause c do not conflict. The `cds` module's go-live gate (CTRL-0014-5) runs as a promotion check of the `cds.rule` content type on that bundle (G10).

**Turning a CDS rule off by value** (SAF-09). Setting a `CDS_RULE` flag's value to OFF is a governed change too: it needs the same approvals, raises the same owned review task as an engagement (6.3), and appears on every engaged-switch view as "switched off by value". It is a cause of HAZ-CFG-C.

### 6.2 Evaluation

`FlagEvaluator.evaluate(flag, context, at)` follows INV-3. It is pure apart from four reads: the switch board, tenancy (`chainOf` and `resolve`) and, for a Tier 2-bound flag, the Register. It never reads the system clock. Every decision returns a trace (which level set the value, which switch is engaged, what failed) for the as-was view and support.

**Time.** The value is resolved through tenancy with the caller's `AsOf`. The kill switch follows INV-4: a live evaluation applies today's switch state even for a back-entered act, so an emergency stop also stops late paths. An as-was evaluation ("was the rule off at 09:12, as known then?") uses the switch history up to `knownAt`.

**What `Unavailable` means, per kind** (D13). The safe side differs by kind, so the flag carries its handling and the caller must act on it:
- **`CDS_RULE` → `MANUAL_CHECK_REQUIRED`.** Treating the rule as off would silently remove a protection, perhaps a Tier A hard stop. Treating it as on would ignore a switch that may be stopping a faulty rule. So `cds` shows "CDS check unavailable for this rule, manual check required" and the alarm fires (§3.5; BP §5.6).
- **Tier 2-bound → `TREAT_AS_OFF`.** SI-18: the function is on only where the Register clears it. Off is the governed safe side, and the fallback control sets stay in force (CTRL-0018-3; §10.3).
- **`CLINICAL_BEHAVIOUR` → declared.** `TREAT_AS_OFF` when the flag enables a new behaviour whose absence is the established state (the C1 default-off pattern). `MANUAL_CHECK_REQUIRED` when the behaviour is itself a protection. The owner declares it; there is no default.
- **`OPERATIONAL` → declared.**
- **Kill-switch state unreadable.** The decision is never `On`, because an engaged switch might be stopping a faulty rule. For `TREAT_AS_OFF` flags the effect equals an engaged switch. For `MANUAL_CHECK_REQUIRED` flags it is "manual check required", because treating the rule as switched off would silently remove a protection.

Every `Unavailable` raises the operational alarm `FlagEvaluationUnavailable`, aggregated per flag, scope and reason [P]. `FlagDecision` is a sealed type, so a caller's `when` must handle all three outcomes. Each consumer carries its own handling test when it is built (for example `cds` in WP-1.5).

### 6.3 Kill switch

**State machine** (one switch on the tenant's `KillSwitchBoard`, per flag and scope):

| From | Command | Guard | To | Emits (one journal append; each row on its own aggregate) |
|---|---|---|---|---|
| `RELEASED` (initial, implicit) | engage | permitted; actor kind `USER`; flag known; scope level allowed and active (`chainOf`); reason | `ENGAGED` | `KillSwitchEngaged`; `TaskRequested` (review task) |
| `ENGAGED` | engage (a new idempotency key) | permitted; actor kind `USER`; reason | `ENGAGED` (`AlreadyEngaged`) | `KillSwitchEngagementConfirmed` with this actor and reason |
| `ENGAGED` | recordReview | permitted; actor kind `USER`; reason; revision matches | `ENGAGED` | `KillSwitchReviewed`; a by-focus-owner completion request for the open review task; for `KEEP_ENGAGED`, a new `TaskRequested` for the next review |
| `ENGAGED` | release | permitted; actor kind `USER`; reason; revision matches; the named review is `RELEASE_APPROVED` and recorded after the latest engagement | `RELEASED` | `KillSwitchReleased` |
| `RELEASED` | release (a new idempotency key) | — | `RELEASED`; `Refused(NOT_ENGAGED)`, audited | — |

A true retry (the same idempotency key) returns the first result (§22.1 item 2). A further engagement by another person keeps the state but records that person and their reason (SAF-23).

**Scope.** A switch engaged at a scope applies to that scope and every scope below it: the evaluator takes the chain of the `ResolutionContext` from tenancy's `chainOf` and checks each scope on it (INV-3). Allowed scopes: `ConfigScope.Tenant` and `ConfigScope.Node` at LEGAL_ENTITY, FACILITY, DEPARTMENT or UNIT, down to the flag's `lowestLevel`. Not USER: switching a rule off for one user is not an emergency stop [P]. A vendor-wide stop waits (below).

**Immediacy.** In WP-0.3 (one process) the next live evaluation after commit sees the switch (INV-4). On a three-node cell every node must see it within a bound. No source sets the bound; it is OQ-CFG-4, and the cell test waits for WP-0.2 (KA-CFG-6).

**The owned review task** (SAF-12; D14; CTRL-CFG-C-2). Mechanism:
- The engage transaction appends a `TaskRequested` journal row (the `CreateTask` fields of `hms.platform.tasks.api`) with the `KillSwitchEngaged` row. `platform-tasks` materialises it from the journal in the same database, behind a watermark (D14). The task exists if and only if the engagement committed.
- Kind: this module declares it in code in its `api` package (tasks §3.4): `TaskKindDefinition(code = "platform.config.kill-switch-review", owner = "platform-config", safety = KindSafety.SafetyRelevant(setOf("CTRL-CFG-C-2")), slaClock = CONTINUOUS_ONLY, defaultSla = platform.config.killswitch.review-sla, escalationPolicy = <code of an item of the content type platform.tasks.escalation-policy>)`. The SLA key is `TightenOnly`, `configurationRequired`, `GOVERNED` (section 12; tasks K-3, tenancy D-2). This module sets no SLA value; it is [HUMAN]. The escalation policy's vendor sample is synthetic and marked NOT FOR CLINICAL USE. Whether the policy also notifies the CSO's queue (a `NOTIFY` step) is declared in that policy (tasks §7.5).
- Facility: the switch's facility, or none for a tenant-level switch (a tenant-level task, which `platform-tasks` routes through the tenant-level fallback queue, D14). Focus: `FocusRef("platform-config", "KillSwitchBoard", <the tenant's board id>)`, the aggregate that holds the switch; the switch id is in the request's payload. Priority: `STAT`, the highest the task engine offers [P].
- Owner: the queue in `platform.config.killswitch.review-queue` at the switch's scope (section 12).
- **When the queue is not configured,** the request is still written, with `owner = null`. The `platform-tasks` domain refuses it (`OwnerMissing`), and its intake opens `TaskOrphaned` (cause `REQUEST_REFUSED`) on the `TaskRequest` at once, with an orphan-alarm task in the fallback supervisory queue (`platform.tasks.orphan-alarm.fallback-queue`; tasks §4.4 and §7.5). There is no dead-letter step. A review SLA with no value is refused the same way (`SettingUnavailable`). This module also raises the operational alarm `KillSwitchReviewQueueMissing`. The engagement itself is never refused or delayed (INV-21). G11 also refuses a tenant overlay that sets a safety-relevant flag ON at a facility without a resolvable review queue.
- **If the request row is never materialised,** `platform-tasks` raises `TaskOrphaned` for a `TaskRequested` row older than the grace without a task, within the 5-minute bound (D14).
- The task is completed only by this module, through a by-focus-owner request when a review is recorded (D14). No generic `task.cancel` permission closes it.

**Who may engage, review and release.** Permissions `config.killswitch.engage`, `config.killswitch.review` and `config.killswitch.release`, per scope, decided by the Trust Plane (port until WP-0.4). Proposal [P], pending the CSO (OQ-CFG-2):
- engaging must be fast: one permitted person, a reason, step-up authentication (§13.1 IA-7 "admin policy changes");
- reviewing records an outcome by a permitted person, with an optional incident reference (SAF-11);
- releasing restores a behaviour that was stopped for cause, so it needs the release permission, a reason and a `RELEASE_APPROVED` review recorded after the latest engagement (INV-20).

**When no one can be authorised** (SAF-10). In WP-0.3 production wiring denies every command, and from WP-0.4 a policy decision point can be unavailable. An emergency stop that cannot be used fails SI-19; an unauthorised stop is also a hazard. This is a patient-safety choice for the CSO, recorded as DN-CFG-2 and blocking R1 go-live. Until it is answered, no clinical behaviour behind a flag may go live, which KA-CFG-4 records against HAZ-0019 CTRL-0019-3.

**Tier A hard stops (SI-14).** Engaging a kill switch on a `CDS_RULE` flag stops the rule from firing. For a Tier A hard stop, that removes a governed protection (§14.3). The sources say every rule has a kill switch (§9.6) and that Tier A/B rules are never retired on override rate alone (SI-14). They do not say what engaging the switch on a Tier A rule requires. This is a question for the CSO (OQ-CFG-3). Interim default to build with (§23), marked [P]: allowed, because an emergency stop that cannot be used fails SI-19. It needs the engage permission, a reason and step-up authentication, raises the review task at `STAT`, is shown on every engaged-switch view, and never changes the rule's registry status (INV-16).

**Tier 2 functions.** A kill switch on a Tier 2-bound flag keeps a cleared function off at that scope. Releasing it never activates the function by itself, because the Register is asked on every evaluation (INV-3). This is the "tenant may tighten" side of SI-18 that tenancy's DN-T1 (formerly OQ-T8) proposes; this spec agrees.

**Waits:**
- multi-node propagation and its bound (WP-0.2 cell);
- a vendor-signed kill-switch directive that a cell applies immediately, verified against the vendor key but without the promotion gates [P] (OQ-CFG-5; it depends on ADR-CFG-1);
- the safety dashboard view of engaged switches (`quality`, §9.29).

### 6.4 Flag audit record

```kotlin
data class FlagAuditRecord(
    val flag: FlagKey,
    val scope: ConfigScope,
    val change: FlagChangeKind,          // VALUE_CHANGED | KILL_SWITCH_ENGAGED | KILL_SWITCH_ENGAGEMENT_CONFIRMED
                                         // | KILL_SWITCH_REVIEWED | KILL_SWITCH_RELEASED
    val before: FlagState,
    val after: FlagState,
    val actor: ActorRef,                 // hms.kernel.context, with its kind
    val onBehalfOf: ActorRef?,
    val reason: ChangeReason,            // never defaulted
    val recordedAt: RecordedTime,        // the journal row's recorded time (D10)
    val changeSet: ChangeSetId?,         // for VALUE_CHANGED
    val bundle: Sha256?,                 // for VALUE_CHANGED: the activated manifest
    val review: KillSwitchReviewId?,     // for KILL_SWITCH_RELEASED
    val correlationId: CorrelationId,
    val causationId: CausationId?,
)
```

For a value changed by bundle activation, the actor and reason are the change set's author and reason, and the activation's actor is recorded too.

### 6.5 SI-19 in the configuration chain (CTRL-0019-1; CA-15, SAF-08)

CTRL-0019-1 says SI-19 is "vendor-locked in the configuration chain: a tenant may tighten it and can never loosen it". A flag's value cannot be vendor-locked: tighten-only with OFF as stricter would stop any tenant from turning a validated baseline on, and `Fixed` would do the same. This spec reads "vendor-locked" as applying to SI-19's rules, not to flag values [P]:
- every flag has a kill switch (code, INV-1);
- a safety-relevant flag's coded default is OFF (registry, INV-2);
- a flag's kind, safety classification and handling cannot be changed below the vendor (code; no setting expresses them);
- the backing setting's levels, safety class, lock and change control are code (6.1), and no vendor or pack stream sets a safety-relevant flag ON (INV-22);
- turning a safety-relevant flag ON or a CDS rule OFF is governed with CSO approval (6.1).

`PropertyTest:config-chain-vendor-lock-SI-19` is therefore this module's own property over the catalogue and the registry, not tenancy's W-4 … W-7 harness. For random flags and random write sequences at every level, it checks each rule above, and that every backing definition is `SafetyRelevant`, `VendorLock.None`, without USER, `GOVERNED` where required, with vendor default OFF. Tenancy's harness accepts this instance for SI-19 (tenancy spec). The reading is an interpretation of an SI, so it is DN-CFG-3 for the CSO (§3.4 item 1). CTRL-0019-1 stays `planned` until that decision and the test pass.

---

## 7. Three-way merge

**Inputs** (R08 §9): `base` = the vendor layers (VENDOR_FOUNDATION and COUNTRY_PACK) the tenant overlay was authored against; `overlay` = the tenant overlay; `newBase` = the new vendor layers. **Output:** a candidate overlay and a list of findings. The merge is a pure function [P].

**Rules per (key or item, scope), in order: the first matching row decides** (INV-15). `B`, `O`, `N` are the base, overlay and new-base values. "Safety-classified" means `SafetyRelevant` or `SafetyInvariant`. A key with no tenant override takes the vendor value `N` (new, changed or removed keys included) and produces no finding.

| # | Case (with a tenant override `O`) | Result | Finding | Blocking |
|---|---|---|---|---|
| 1 | Key or item removed from `N` | Not carried | `ORPHANED_OVERRIDE` | yes |
| 2 | `O` no longer valid against the new schema version | Not carried | `SCHEMA_INVALID` | yes |
| 3 | `VendorLock.Fixed` key | Vendor value `N` | `DROPPED_LOCKED` (the override should never have existed; defence in depth) | yes when the key is safety-classified; no otherwise |
| 4 | `O == N` (converged) | Drop the now-redundant override | `CONVERGED` | no |
| 5 | Tighten-only key, `O` at least as strict as `N` | Keep `O` | `TIGHTENING_KEPT` | no |
| 6 | Tighten-only key, `N` strictly stricter than `O` | `N` | `VENDOR_STRICTER_TAKEN` | no |
| 7 | Tighten-only key, `O` and `N` incomparable | Keep `O` in the candidate | `CONFLICT_SAFETY` | yes; never auto-resolved |
| 8 | Vendor changed (`B != N`), key safety-classified | Keep `O` in the candidate | `CONFLICT_SAFETY` | yes; never auto-resolved |
| 9 | Vendor changed (`B != N`), key not safety-classified | Keep `O` in the candidate | `CONFLICT` | yes, until a human resolves it [P] (OQ-CFG-8) |
| 10 | Vendor unchanged (`B == N`) | Keep `O` | `KEPT` | no |

Rows 5 and 6 never loosen: the effective value is the stricter one in both, so taking `N` in row 6 is not a conflict resolution, and it is still reported. Row 3 is blocking for safety-classified keys because a vendor may have turned a tighten-only key into a `Fixed` one with a value looser than the tenant's tightening; a human decides.

Overlay items include tenant governed locks (tenancy lock entries) as well as values. A lock is merged like a value of its key; tenancy rule D-5 already keeps locks off tighten-only keys. Content items are merged by their reference (5.8): a changed vendor body is a changed `N`.

Every tenant override appears in exactly one finding, so nothing is dropped silently (INV-15). A blocking finding is resolved only by a change set authored by a human with a reason, approved like any other. The bundle builder refuses to build while a blocking finding is open (`UNRESOLVED_MERGE`).

**No customer branches.** A tenant overlay is data in the tenant's database, exported as bundles. It is never a git branch (§2.3; ADR-020). The branch and tenant-identifier detector (`sh tools/hms repo check`, ADR-020 "Fitness test") already guards the repository; this module adds no code path keyed on a tenant identifier (§6.2).

---

## 8. Promotion and gates

**Environments** (§19.2; §6.6): BUILD → TEST → TRAIN → PROD. Change sets are authored and applied only in BUILD (and PLAY). TEST, TRAIN and PROD change configured values only by activating a signed bundle; the only runtime changes there are kill switches, kill-switch reviews and USER preferences [P] (OQ-CFG-12). Every non-production environment holds synthetic data only (§19.2).

**One write path for governed values** (SAF-16). A `GOVERNED` value, such as a facility's clinical tier or a CDS rule flag, is changed by: a change set in BUILD whose item carries its evidence reference and approvals → a bundle → activation in TEST, TRAIN and PROD. The evidence reference travels in the manifest item and becomes `SetValue.evidence` in the tenancy batch, where tenancy W-10 checks it again.

**PLAY** (§6.6, R08 §9) is a sandbox beside the path. It accepts any bundle and its own change sets, and nothing is promoted out of it: a change tried in PLAY is re-authored as a change set in BUILD [P] (OQ-CFG-6).

**Lineage.** A bundle is activated in TEST, TRAIN or PROD only if the same manifest hash has an activation in the previous environment, read from the `PromotionLedger` [P].

**Applying an activated bundle.** The bundle is a snapshot (5.3). Activation computes the difference between the snapshot and the tenant's current raw entries for the stream (tenancy `entries`), and writes it through the three steps of 5.7. A tenancy refusal refuses the activation, and nothing is written in that tenant (INV-11).

**Gates.** `activate` runs every gate in step 1 of 5.7, records every result in a `GateReport`, and activates only if all pass (INV-11).

| Gate | Check | Source |
|---|---|---|
| G1 Signature | Ed25519 signature valid; key in the trust store, not revoked, in its validity period, allowed for this stream's role and this environment | §2.2 rule 8 "signed-bundle verification"; ADR-020 |
| G2 Integrity | Every item hash matches; no item without an entry, no entry without an item; manifest well formed | ADR-020 |
| G3 Anti-rollback | Sequence greater than tenancy's `lastActivation` for (tenant, stream); no other activation pending for it | INV-12 |
| G4 Lineage | Previous environment activated the same manifest hash; base refs of an overlay match this tenant's active vendor and pack bundles | §19.2 |
| G5 Schema | Every item validates against its registered type and schema version; unknown types refused | §19.4 "schema and referential validation"; §6.6 extension tier 1 "typed, validated" |
| G6 Referential | References resolve (settings, content items, orderables to charge mappings or "non-chargeable"); codes resolve through `TerminologyValidationPort` (fails closed until WP-1.1) | §19.4 |
| G7 Chain | Tenancy's dry run (`validate`) of the batch passes: no value below a lock, tighten-only keys not loosened, `Fixed` keys not looser than their coded default, no explicit `validFrom` in the past (5.10) | §6.6; INV-9, INV-10 |
| G8 Provenance | Target TRAIN or PROD: no `SYNTHETIC` item | §19.4 |
| G9 Approvals and evidence | Every included change set `APPLIED` in BUILD; every `APPROVED` item's approvals confirmed by `HumanApprovalSource` for its required roles; every item on a `GOVERNED` definition carries an evidence reference | §3.5; §19.3; §6.6 |
| G10 Content checks | Each content type's `promotionChecks` pass (silent run and replay evidence for CDS rules, re-pricing replay for tariffs, translation coverage, CTRL-0014-5's go-live rule); supplied by the owning modules | §19.4; §18.11 |
| G11 Flags | Every flag item names a registered flag; no `VENDOR_FOUNDATION` or `COUNTRY_PACK` item sets a safety-relevant flag ON; an ON value for a safety-relevant flag is a `TENANT_OVERLAY` item at or above the flag's `lowestLevel` with approvals including the CSO; C1 items carry the accreditation-impact field; every facility where a safety-relevant flag is ON resolves `platform.config.killswitch.review-queue` | SI-19; §19.3; INV-22 |
| G12 Tier 2 | No item targets a definition with `GatesTier2Function` (which tenancy's catalogue refuses anyway, D-6); no item makes a Tier 2-bound flag sufficient on its own | SI-18 clause d; CTRL-0018-6; D12 |
| G13 Scopes | Every item's `ScopeAddress` resolves (`resolveAddress`) in this environment to an active scope of this tenant (5.9) | Tightening [P] (CA-12) |

The Release Evidence Pack lists every synthetic item still present (§19.4); this module offers the query, and WP-0.9 builds the pack.

**The deployment environment.** `platform.config.environment` (section 12) is a deployment parameter, read once at start-up. A missing or unknown value stops the application from starting (`UnitTest:environment-missing-refuses-start`). It is the environment class that D11's production gate reads to refuse synthetic provenance in TRAIN and PROD; that gate and its test belong to the kernel spec.

---

## 9. Permissions and audit

**Permissions** (port `ConfigAuthorization`; the Trust Plane SDK decides them from WP-0.4; deny-all in production wiring until then):

| Permission | Covers | Step-up (§13.1 IA-7) [P] |
|---|---|---|
| `config.registry.read` | Registry and queries | no |
| `config.changeset.submit` | Submit, withdraw own | no |
| `config.changeset.approve` | Record an approval (evidence from `HumanApprovalSource` still required) | yes |
| `config.changeset.reject` | Reject | no |
| `config.changeset.apply` | Apply in BUILD and PLAY | no |
| `config.bundle.build` | Build and sign in BUILD | yes |
| `config.bundle.activate.<env>` | Activate in TEST, TRAIN, PROD | yes for TRAIN and PROD |
| `config.merge.run`, `config.merge.resolve` | Run a merge; resolve findings through a change set | no; resolve: yes for safety-classified keys |
| `config.killswitch.engage` | Engage at a scope | yes |
| `config.killswitch.review` | Record a review | yes |
| `config.killswitch.release` | Release at a scope | yes |
| `config.audit.read` | Flag history and audit | no |

Role assignment is Trust Plane data, not this module's. Who holds the kill-switch permissions is OQ-CFG-2. What happens when no decision can be made is DN-CFG-2.

**Internal steps** run as the `SYSTEM` actor and are not commands from outside: reconciliation (5.7) and operational alarms. They live in `hms.platform.config.application.system`, the package the kernel's `SYSTEM_PROCESSES` allow-list names for this module (kernel §7.2). They continue a command that was already authorised, or raise an alarm, so `ConfigAuthorization` never refuses them [P] (D14 pattern). The review-task request (6.3) is not one of them: it is a row in the user's own engage or review append, under that user's context. A review task the reconciler requests for `ActivationStuck` (5.7) is a SYSTEM row.

**Audit** (CA-23). Every accepted command is a journal entry written in the same transaction as the state change (§5.3 C; §22.1 item 2), with actor, on-behalf-of, device, purpose of use, reason, before, after, scope, recorded time, correlation and causation ids (R07 AU-1: who, what, when, where, why and outcome). Every refused command goes to the `ConfigAudit` port with its refusal reason, not to the journal: a refusal changes no state and has no version (journal J-3). From WP-0.4 both also become BALP AuditEvents. Configuration carries no PHI (INV-17), so these records carry none.

---

## 10. Events published

Internal platform events, not in the §8.5 clinical catalogue. The catalogue (`docs/specs/events/catalogue.md` §4) lists every name below (SAF-17), with valid-time kind `EFFECTIVE`. They follow the envelope and type-naming rules of the events specification (`hms.kernel.events`; `docs/specs/events/`). No event carries a patient; every aggregate here has keying `TENANT`, so the partition key is the tenant id (D6; 5.2). Written to the journal (outbox) in the same transaction as the change (§5.3).

| Event | Aggregate | When | Main data | Consumers | Catalogue |
|---|---|---|---|---|---|
| `ChangeSetSubmitted` | `ConfigChangeSet` | Submit accepted | id, environment, author, item count | UI read models | listed |
| `ChangeSetApproved` | `ConfigChangeSet` | Last required approval recorded | id, roles | UI, audit | listed |
| `ChangeSetRejected`, `ChangeSetWithdrawn`, `ChangeSetStale`, `ChangeSetApplyStarted`, `ChangeSetApplyRefused` | `ConfigChangeSet` | As named | id, actor, reason or refusals | UI; reconciliation (5.7) | listed |
| `BundleActivationPending` | `StreamActivation` | Step 1 of 5.7 passed | environment, stream, sequence, manifest hash, change set id, batch digest, actor | Reconciliation (5.7) | listed |
| `ChangeSetApplied` | `ConfigChangeSet` | Apply completed | id, new stream version | Cache invalidation (R08 §5) | listed |
| `BundlePromoted` | `StreamActivation` | Activation completed in this environment for this tenant | environment, stream, sequence, manifest hash, actor | Every module that caches configuration (R08 §5 "invalidated by events") | listed |
| `BundlePromotionRefused` | `StreamActivation` | Activation refused | environment, stream, failed gates, actor | Operations alarm [P] | listed |
| `OverlayMergeCompleted` | `StreamActivation` of the overlay | Merge run | finding counts, blocking count | UI | listed |
| `FeatureFlagChanged` | `FeatureFlag` | A flag value changed by activation | flag, scope, before, after, valid period, actor, on-behalf-of, reason, change set, manifest hash | `cds`, owning modules | listed |
| `KillSwitchEngaged` | `KillSwitchBoard` | Engage | switch id, flag, scope, actor, on-behalf-of, reason | Owning module, cache invalidation | listed |
| `KillSwitchEngagementConfirmed` | `KillSwitchBoard` | A further engagement | switch id, actor, on-behalf-of, reason | Audit, UI | listed |
| `KillSwitchReviewed` | `KillSwitchBoard` | Review recorded | switch id, review id, outcome, incident ref, actor, reason | Audit, UI | listed |
| `KillSwitchReleased` | `KillSwitchBoard` | Release | switch id, flag, scope, review id, actor, on-behalf-of, reason | As engaged | listed |

This module also appends `TaskRequested` rows and by-focus-owner completion requests in `platform-tasks`' format (6.3); `platform-tasks` owns those types.

Schemas evolve backward-compatibly with a 12-month deprecation window (§5.3).

---

## 11. Persistence

- **WP-0.3:** repository ports (`ChangeSetRepository`, `KillSwitchBoardRepository`, `StreamActivationRepository`, `FeatureFlagRepository`, `ContentStore`, `PromotionLedger`). Optimistic concurrency on aggregate version (§6.2). Every state change appends to the journal through `JournalAppender` with the same `TransactionContext` (`hms.kernel.context`, D1).
- **In-memory adapters** live in `hms.platform.config.inmemory`, for tests and local development only (D8). Each implements the kernel's shared marker `hms.kernel.context.VolatileStore` (`platform-kernel.md` §7.5), which the journal, tenancy and tasks use for their in-memory stores too (one marker, one rule for all).
- **Production wiring binds no repository** (D8; SAF-04). An in-memory kill switch would be lost on restart or failover, silently releasing every engaged switch, so it is never bound. The mechanism has three parts:
  1. `PlatformConfigProductionWiring` requires the repository ports, and no production class implements them before the persistence slice, so the application context fails to start, naming the missing port.
  2. `ArchTest:production-never-binds-test-adapters`, the kernel's rule (kernel §11; in `:platform:arch-rules`, D7), forbids `app-hms` production sources and every module's production wiring from referencing `..inmemory..` or `..testing..`, except `app-hms`'s dev and test wiring package.
  3. A start-up guard, `ConfigPersistenceGuard`, refuses to start if any bound repository is a `VolatileStore` while an environment class is set (BUILD, TEST, TRAIN, PROD or PLAY); volatile stores are allowed only in the `dev` profile with no environment class.
  `IntegrationTest:app-hms-refuses-to-start-with-volatile-config-state` proves the guard (merge tier, `app-hms`).
- **Later slice [P]:** a schema `platform_config` (one schema per module, §6.4) with `tenant_id`, UUIDv7 ids and audit columns. History tables are append-only and checked by the shared migration linter in `:platform:arch-rules` (§6.8 #2; D7). Bundle bytes are stored as received, so the signature can be re-verified at any time. The trust-store revocation high-water mark (5.6) is stored here. `IntegrationTest:kill-switch-survives-restart` (CTRL-0019-3) and `IntegrationTest:config-state-persisted-append-only` come with it; `IntegrationTest:config-values-survive-restart` is tenancy's.
- **Configuration values** live in tenancy's store. This module never reads another module's tables (§5.2).

---

## 12. Configuration this module needs

Lock names are tenancy's `VendorLock` values. Every key states its safety class, change control and sources (SAF-22).

| Key [P] | Type | Levels | `VendorLock` | `SafetyClass` | Change control | Vendor default | Sources and note |
|---|---|---|---|---|---|---|---|
| `platform.config.approver-roles.<content-type>`: one definition per content type registered at assembly (tenancy 5.3 "Key families"; no open family) | `SET(STRING(role pattern))`, role codes of the Trust Plane | VENDOR_FOUNDATION, COUNTRY_PACK, TENANT | `TightenOnly`: a superset is stricter; a partial order with `Direction` samples citing CTRL-CFG-A-3 (tenancy D-7) | `SafetyRelevant(CTRL-CFG-A-3)` | `GOVERNED` | the type's `requiredApproverRoles` | R08 §5; §3.5 |
| `platform.config.killswitch.review-queue` | `STRING([a-z][a-z0-9-]{0,62}, 63)`, a queue code, the same type as `platform-tasks`' `platform.tasks.orphan-alarm.fallback-queue` | TENANT, FACILITY | `None` | `SafetyRelevant(CTRL-CFG-C-2)` | `ROUTINE` | none: required. Missing → the review request is refused and takes the `REQUEST_REFUSED` → `TaskOrphaned` path (6.3); G11 refuses a facility with a safety-relevant flag ON and no queue | SI-03; SI-19 |
| `platform.config.killswitch.review-sla` | `DURATION(min, max)`; the bounds are a content request [HUMAN] | VENDOR_FOUNDATION, COUNTRY_PACK, TENANT, FACILITY | `TightenOnly`: shorter is stricter, with `Direction` samples citing CTRL-CFG-C-2 (tenancy D-7) | `SafetyRelevant(CTRL-CFG-C-2)` | `GOVERNED` | none: `configurationRequired = RequiredBecause("CTRL-CFG-C-2")` (tenancy D-2); the value is [HUMAN] | SI-19; SI-03. The `defaultSla` of the kind `platform.config.kill-switch-review` (6.3; tasks K-3). Missing → the review request is refused (`SettingUnavailable`) and takes the `REQUEST_REFUSED` → `TaskOrphaned` path |
| `platform.config.killswitch.max-propagation` | `DURATION` | VENDOR_FOUNDATION | `Fixed`, with `Direction` "shorter is stricter" and samples citing CTRL-0019-3 (tenancy D-7, D-9) | `SafetyRelevant(CTRL-0019-3)` | `GOVERNED` | none: `configurationRequired = RequiredBecause("CTRL-0019-3")`, set with the cell (OQ-CFG-4). Tenancy W-6 accepts the first vendor value only as a `GOVERNED` change | SI-19. Read only by the cell's propagation monitor (waits). `NotConfigured` → the monitor treats every engagement as unconfirmed until every node confirms, and alarms |

**Not a chain setting:** `platform.config.environment`, a deployment parameter (`BUILD`, `TEST`, `TRAIN`, `PROD` or `PLAY`), read once at start-up; missing or unknown stops the start (section 8).

**Removed after review.** `platform.config.change-set.author-cannot-approve` is now code (INV-7): a setting that could turn off separation of duties would itself be a loosening, and tenancy §9 keeps the chain's own rules in code. `platform.config.killswitch.engagement-task-sla` is replaced by `platform.config.killswitch.review-sla`, the `defaultSla` that tasks K-3 requires of the kind this module declares. Tenancy's D-2 now registers a tighten-only key with no default when it is `configurationRequired` and `GOVERNED` (CA-14).

The trust store is part of the signed release, not configuration (5.6).

**[L] keys.** This module defines no [L] key. [L] facts are configuration with K's default, and code names its assumption (§23; ASSUMPTIONS.md). Calendar keys are generic, `calendar.weekend-days` and `calendar.holidays`, and the Kurdistan pack supplies their values under the L-20 items `kri.calendar.weekend` and `kri.calendar.holidays` (D3). This module adds a build check [P]: every L-number cited by a setting definition, flag or bundle item exists in `docs/program/ASSUMPTIONS.md`, and every Kurdistan pack item named in ASSUMPTIONS.md's configuration column maps to a registered definition (`UnitTest:l-item-references-exist`).

---

## 13. Hazards and controls

### 13.1 Existing controls this module implements

"State" uses the hazard log's states only (planned, implemented, verified). Every control here stays `planned` until its named tests pass in a recorded run (§10.1; §3.5). The last column says what WP-0.3 aims to deliver.

| Hazard | Control | What this module does | Verified by (name per the hazard log) | State / WP-0.3 target |
|---|---|---|---|---|
| HAZ-0019 | CTRL-0019-1 | SI-19 enforced in the domain for every command path; its locked parts are rules (6.5) | `PropertyTest:config-chain-vendor-lock-SI-19` (this module's instance, 6.5); `PropertyTest:SI-19-channels-*` (channel adapters do not exist yet: waits) | planned; target: the domain part, after DN-CFG-3 |
| HAZ-0019 | CTRL-0019-2 | Property tests on the flag and kill-switch lifecycle; scenario suite | `PropertyTest:SI-19-*` (section 14); `ScenarioSuite:kill-switch (proposed)` waits for the WP-0.5 scenario framework | planned; target: the property tests |
| HAZ-0019 | CTRL-0019-3 | INV-1, INV-3, INV-4, INV-5; switch per tenant and site without a deploy; registration without a switch is impossible | `PropertyTest:SI-19-every-rule-and-flag-has-a-kill-switch`; `AcceptanceTest:kill-switch-works-without-deploy` (one process now); `IntegrationTest:kill-switch-survives-restart` (persistence slice, waits); the per-site cell acceptance (waits for WP-0.2) | planned; target: the single-process part. The cell and persistence parts wait |
| HAZ-0019 | CTRL-0019-4 | Build check over declarations in code and content | `StaticAnalysis:every-flag-and-rule-has-a-kill-switch` (section 14) | planned; target: implemented |
| HAZ-0019 | CTRL-0019-5 | INV-2, INV-22; turned on only by an approved tenant change set with the CSO (G9, G11) | `PropertyTest:SI-19-safety-relevant-flags-default-off` | planned; target: implemented |
| HAZ-0019 | CTRL-0019-6 | Mechanism only; AI features register `CLINICAL_BEHAVIOUR` flags in P2 | `AcceptanceTest:ai-feature-kill-switch-per-site (P2)` | planned; waits (P2) |
| HAZ-0018 | CTRL-0018-3 | Tier 2-bound flags ask the Register; OFF unless `cleared` or `not-required`; `Unavailable(TREAT_AS_OFF)` while the Register is absent | `PropertyTest:SI-18-activation-only-when-cleared-or-not-required` (flag side) | planned; target: flag side. Register in WP-0.9 |
| HAZ-0018 | CTRL-0018-6 | INV-6; gate G12; Tier-2 restriction only, never a binding (D12) | `PropertyTest:SI-18-configuration-toggle-cannot-override-register`; `ArchTest:tier-2-activation-only-through-register` | planned; target: flag and config side |
| HAZ-0014 | CTRL-0014-5 | Hosts the go-live promotion check as a G10 check of `cds.rule` on the tenant go-live bundle | `PromotionGate:go-live-bundle-blocked-while-a-baseline-rule-has-neither-ppv-nor-exception` | planned; mechanism in WP-0.3, check in WP-1.5 |
| HAZ-0014 | CTRL-0014-7 | INV-16: a kill switch never retires a rule | `UnitTest:kill-switch-never-retires-a-rule` (proposed addition to CTRL-0014-7's planned verification) | planned; target: implemented |
| HAZ-0005 | CTRL-0005-14 | INV-18: no closed-loop flag below FACILITY | `UnitTest:closed-loop-flag-below-facility-refused` (proposed addition to CTRL-0005-14's planned verification); the readers carry `PropertyTest:clinical-tier-has-no-partial-loop` | planned; target: the registry refusal |
| HAZ-0001…HAZ-0021 | CTRL-00nn-1 (vendor lock) | Change-set and gate side of every `config-chain-vendor-lock-SI-nn` test: a write that loosens a vendor-locked SI parameter is refused at submit, apply and activation | `PropertyTest:config-chain-vendor-lock-SI-nn` (shared with tenancy, which owns the chain side) | planned; target: with tenancy |

No control state in the hazard log changes because of this spec. States change only with passing tests in a recorded run (§10.1; §3.5).

**Proposed new causes of HAZ-0019** (to be numbered with it):
- *A flag evaluation that fails is read as OFF, so a CDS rule's protection is silently absent.* Control: INV-3 and INV-23, the three-way decision and per-kind handling (6.2). Verified by `PropertyTest:SI-19-evaluation-failure-never-silent`.
- *Kill-switch state held in memory is lost on restart or failover, so a stopped rule fires again.* Control: no volatile store in a deployment (section 11). Verified by `IntegrationTest:app-hms-refuses-to-start-with-volatile-config-state` now and `IntegrationTest:kill-switch-survives-restart` with the persistence slice.
- *No one can engage a kill switch because authorisation is unavailable.* Control: DN-CFG-2's answer; until then KA-CFG-4 and no flagged clinical behaviour goes live.

### 13.2 Proposed new hazards (local labels)

Existing entries do not cover these failure modes: HAZ-0019 covers a missing or slow kill switch and unsafe defaults; nothing covers a bundle that should not have been activated, a merge that loses a tightening, or a kill switch misused.

**HAZ-CFG-A: Tampered, unsigned, rolled-back, synthetic, unapproved or unverified configuration takes effect.**
- seeded_hazard: [H2, H4, H6]; invariants: [SI-19] (and §19.4, which has no SI); modules: [platform-config, platform-tenancy, content]; features: [PLT-CFG-01, PLT-CFG-02].
- Causes: a bundle altered after signing; a bundle signed by an untrusted, revoked or wrong-role key; a revoked key restored by a release rollback; activation without verification; an older bundle replayed; synthetic thresholds or codes promoted to TRAIN or PROD; an approval recorded by a system or agent; a direct write to the chain with a fabricated change set or provenance; a partial activation between the two modules; a node-scoped item mapped to the wrong node in another environment.
- Effects: wrong order sets, rules, escalation policies or thresholds reach patients; a safety tightening is reverted.
- Initial risk (agent proposal for CSO triage, not an acceptance): severity major, likelihood remote, level medium.
- Controls:
  - CTRL-CFG-A-1 (design): gates G1–G4 before any activation; empty trust store fails closed; trust store only in the signed release; monotonic revocations. Verified by `PropertyTest:bundle-any-altered-byte-refused`, `UnitTest:bundle-untrusted-or-revoked-key-refused`, `UnitTest:empty-trust-store-refuses-every-bundle`, `PropertyTest:bundle-anti-rollback`, `UnitTest:release-rollback-keeps-revocations`.
  - CTRL-CFG-A-2 (design): §19.4 synthetic gate (G8) and the change-set verifier's runtime refusal. Verified by `PromotionGate:synthetic-item-blocks-train-and-prod`, `UnitTest:change-set-verifier-refuses-synthetic-in-train-and-prod`.
  - CTRL-CFG-A-3 (design): approvals only from `HumanApprovalSource` by human actors (INV-7, G9). Verified by `PropertyTest:change-set-approval-only-from-human-evidence`, `IntegrationTest:bundle-approvals-only-from-sign-off-records`.
  - CTRL-CFG-A-4 (design): per-tenant atomic activation with tenancy's activation record (W-22); reconciliation of the second commit (INV-11, 5.7). Verified by `PropertyTest:refused-activation-changes-nothing`, `PropertyTest:activation-interrupted-between-commits-reconciles`.
  - CTRL-CFG-A-5 (design): deterministic canonical form (INV-14). Verified by `PropertyTest:canonical-serialisation-deterministic`.
  - CTRL-CFG-A-6 (design): every chain write carries a change set id this module verifies (INV-19; D12). Verified by `PropertyTest:fabricated-change-set-writes-nothing`.
  - CTRL-CFG-A-7 (design): scopes travel as code paths and must resolve (G13). Verified by `UnitTest:node-scoped-item-promotes-build-to-test`, `UnitTest:unresolvable-scope-path-refuses-activation`.

**HAZ-CFG-B: An upgrade merge silently loses or loosens a tenant's safety setting.**
- seeded_hazard: [H2, H4]; invariants: [SI-01 … SI-21 preamble: tighten, never loosen]; modules: [platform-config, platform-tenancy]; features: [PLT-CFG-01, PLT-CORE-02].
- Causes: a tenant tightening dropped when the vendor foundation changes; a conflict on a safety-classified key auto-resolved; overlapping merge rules applied in an arbitrary order; incomparable tighten-only values; a vendor turning a key `Fixed` with a value looser than the tenant's; an override of a removed or retyped key carried silently or dropped silently.
- Effects: a hospital's stricter safety parameter returns to the looser vendor value without anyone deciding it.
- Initial risk (agent proposal): severity major, likelihood occasional, level high.
- Controls:
  - CTRL-CFG-B-1 (design): the ordered rules of section 7 (INV-15). Verified by `PropertyTest:merge-each-override-matches-exactly-one-rule`, `PropertyTest:merge-never-drops-a-tenant-value-silently`, `PropertyTest:merge-tightening-kept-while-stricter`, `PropertyTest:merge-safety-conflict-never-auto-resolved`.
  - CTRL-CFG-B-2 (design): blocking findings stop the bundle build. Verified by `UnitTest:bundle-build-refused-with-unresolved-merge`.
  - CTRL-CFG-B-3 (design): gate G7 re-checks locks and tighten-only on the merged result. Verified by `PropertyTest:merged-overlay-passes-lock-gate-or-is-refused`.

**HAZ-CFG-C: A safety rule or behaviour is switched off without authority, review or anyone noticing, or cannot be switched off when needed.**
- seeded_hazard: [H2, H4]; invariants: [SI-19, SI-14, SI-03]; modules: [platform-config, cds, platform-tasks]; features: [PLT-CFG-01, CLN-CDS-02].
- Causes: engagement by someone without the role; engagement left in place indefinitely; engagement on a Tier A hard stop treated as retirement; no owner told; a CDS rule switched off by an ordinary value change; release without review; an engagement that fails because its task configuration is missing; no one able to engage while authorisation is unavailable.
- Effects: a governed protection is absent while clinicians assume it is active; or a faulty rule keeps firing.
- Initial risk (agent proposal): severity major, likelihood remote, level medium.
- Controls:
  - CTRL-CFG-C-1 (design): permission, human actor and step-up for engage, review and release; reason never defaulted; release only after a `RELEASE_APPROVED` review (INV-20). Verified by `PropertyTest:SI-19-flag-change-reason-never-defaulted`, `UnitTest:kill-switch-engage-needs-permission`, `UnitTest:kill-switch-release-needs-review`.
  - CTRL-CFG-C-2 (design): every engagement, and every CDS rule switched off by value, requests an owned `STAT` review task in the same transaction; the engagement never depends on task configuration (INV-21). Verified by `UnitTest:kill-switch-engagement-writes-task-request`, `UnitTest:kill-switch-engages-without-review-queue`, `UnitTest:cds-rule-off-by-value-requests-review-task`, and `IntegrationTest:kill-switch-engagement-raises-owned-task` (with `platform-tasks`; merge tier).
  - CTRL-CFG-C-3 (design): INV-16. Verified by `UnitTest:kill-switch-never-retires-a-rule`.
  - CTRL-CFG-C-4 (information): engaged switches and CDS rules switched off by value visible on every view of the flag and on the safety dashboard (§9.29, later). Verified by `AcceptanceTest:engaged-kill-switches-listed`.
  - CTRL-CFG-C-5 (design): `CDS_RULE` flags are `GOVERNED` in both directions with the CSO among the approvers (6.1). Verified by `UnitTest:cds-rule-flag-backing-setting-governed`.

---

## 14. Tests

Kinds and names follow `docs/safety/README.md` "Test names". Property tests take their sequence count from `PropertyTestBudget` (backend/README.md); none hard-codes a count. Synthetic values in tests are marked `ContentProvenance.SYNTHETIC` (§19.4).

| Test | Tier | Verifies |
|---|---|---|
| `PropertyTest:SI-19-every-rule-and-flag-has-a-kill-switch` | fast | INV-1, CTRL-0019-3 |
| `PropertyTest:SI-19-safety-relevant-flags-default-off` | fast | INV-2, INV-22, CTRL-0019-5 |
| `PropertyTest:SI-19-kill-switch-always-wins` | fast | INV-3: any sequence of value changes and engagements at any scope; an engaged ancestor always yields OFF |
| `PropertyTest:SI-19-evaluation-failure-never-silent` | fast | INV-3, INV-23: for random failures (unknown flag, chain refusal, `NotConfigured`, unreadable switch board or store, Register unavailable) the decision is `Unavailable` with the flag's handling, never `On`, never a plain `Off`; the alarm is raised |
| `PropertyTest:SI-19-kill-switch-live-and-as-was` | fast | INV-4: a live evaluation with any earlier `validAt` sees the current switch; an as-was evaluation sees the history up to `knownAt` |
| `PropertyTest:SI-19-flag-change-reason-never-defaulted` | fast | INV-5; kernel `ChangeReason` construction |
| `PropertyTest:SI-19-every-flag-change-audited` | fast | INV-5: one complete record per change, including further engagements and reviews; recorded time from the test clock |
| `PropertyTest:config-chain-vendor-lock-SI-19` | fast | CTRL-0019-1 as read in 6.5: no write at any level below the vendor can remove a kill switch, change a safety-relevant default, reclassify a flag or set a safety-relevant flag ON from a vendor or pack stream; every backing definition has the 6.1 shape |
| `AcceptanceTest:kill-switch-works-without-deploy` | fast (one process); merge (cell, waits) | INV-4, CTRL-0019-3 |
| `StaticAnalysis:every-flag-and-rule-has-a-kill-switch` | fast | CTRL-0019-4: (1) start-up check of every module's registrations; (2) content check of every flag item in bundles under `content/`; (3) the ArchUnit rule that module code reads flags only through `FlagEvaluator`, and a detekt rule against ad-hoc toggles such as Spring's `@ConditionalOnProperty` in module code [P]. Rules (3) live in `:platform:arch-rules` and apply to every module (D7) |
| `UnitTest:kill-switch-engage-needs-permission` | fast | CTRL-CFG-C-1 |
| `UnitTest:kill-switch-release-needs-review` | fast | INV-20: release without a `RELEASE_APPROVED` review after the latest engagement is refused `REVIEW_REQUIRED` |
| `UnitTest:kill-switch-engagement-writes-task-request` | fast | 6.3: the `TaskRequested` row is in the same append as `KillSwitchEngaged` |
| `UnitTest:kill-switch-engages-without-review-queue` | fast | INV-21: a missing queue never refuses or delays the engagement; the request has `owner = null`; `KillSwitchReviewQueueMissing` raised |
| `UnitTest:cds-rule-off-by-value-requests-review-task` | fast | 6.1, CTRL-CFG-C-2 |
| `UnitTest:cds-rule-flag-backing-setting-governed` | fast | 6.1, CTRL-CFG-C-5 |
| `UnitTest:kill-switch-further-engagement-audited` | fast | SAF-23: a second engagement by another person keeps the state and records actor and reason |
| `UnitTest:kill-switch-first-engagements-race-gives-one-switch` | fast | 5.2: concurrent first engagements of one (flag, scope) give one `KillSwitchId` |
| `PropertyTest:SI-18-activation-only-when-cleared-or-not-required` | fast | CTRL-0018-3, flag side, with a fake Register and the production `UnavailableRegister` |
| `PropertyTest:SI-18-configuration-toggle-cannot-override-register` | fast | CTRL-0018-6 |
| `ArchTest:tier-2-activation-only-through-register` | fast | CTRL-0018-6; the rule is shared with `safety-registry` and lives in `:platform:arch-rules` |
| `UnitTest:kill-switch-never-retires-a-rule` | fast | INV-16 |
| `UnitTest:closed-loop-flag-below-facility-refused` | fast | INV-18, CTRL-0005-14 (proposed addition) |
| `PropertyTest:canonical-serialisation-deterministic` | fast | INV-14: shuffled key order, default charset and locale changes give identical bytes |
| `PropertyTest:bundle-any-altered-byte-refused` | fast | G1, G2: flip any byte of manifest, item or signature → refused |
| `UnitTest:bundle-untrusted-or-revoked-key-refused` | fast | G1 |
| `UnitTest:empty-trust-store-refuses-every-bundle` | fast | 5.6, 4.7 |
| `UnitTest:release-rollback-keeps-revocations` | fast | 5.6: a trust store with a lower revocation-set sequence is refused |
| `PropertyTest:bundle-anti-rollback` | fast | INV-12, G3 |
| `PropertyTest:promotion-follows-build-test-train-prod` | fast | G4 |
| `PromotionGate:synthetic-item-blocks-train-and-prod` | fast | INV-13, G8 |
| `UnitTest:change-set-verifier-refuses-synthetic-in-train-and-prod` | fast | INV-13, D11 defence in depth |
| `PropertyTest:fabricated-change-set-writes-nothing` | fast | INV-19: with the real tenancy domain, a batch with an unknown, wrong-tenant, wrong-state or digest-mismatched change set id writes nothing |
| `PropertyTest:refused-activation-changes-nothing` | fast | INV-11 |
| `PropertyTest:activation-interrupted-between-commits-reconciles` | fast | 5.7: inject a failure between the tenancy commit and the completion commit; the reconciler completes once, never applies twice and never rolls back the head |
| `UnitTest:per-tenant-activation-isolated` | fast | 5.3: a refused activation in one tenant leaves the others' activations and values unchanged |
| `UnitTest:node-scoped-item-promotes-build-to-test` | fast | 5.9: an item authored at a unit in BUILD lands on the unit with the same code path in TEST |
| `UnitTest:unresolvable-scope-path-refuses-activation` | fast | G13 |
| `UnitTest:retroactive-item-refused-at-activation` | fast | 5.10, G7 |
| `UnitTest:governed-item-without-evidence-refused` | fast | G9; `EVIDENCE_REQUIRED` at submit |
| `UnitTest:content-reference-and-body-resolve` | fast | 5.8: a reader sees a body only after its reference commits; a missing body gives `Unavailable` |
| `PropertyTest:change-set-approval-only-from-human-evidence` | fast | INV-7, including non-`USER` actors and the author |
| `PropertyTest:change-set-stale-base-writes-nothing` | fast | INV-8 against raw entries |
| `PropertyTest:change-set-below-lock-refused` | fast | INV-9 (config side of the WP-0.3 exit criterion) |
| `PropertyTest:merge-each-override-matches-exactly-one-rule` | fast | INV-15: for random `B`, `O`, `N` and definitions of every lock and safety class, exactly one row of section 7 matches each override |
| `PropertyTest:merge-never-drops-a-tenant-value-silently` | fast | INV-15 |
| `PropertyTest:merge-tightening-kept-while-stricter` | fast | INV-15 |
| `PropertyTest:merge-safety-conflict-never-auto-resolved` | fast | INV-15, including incomparable values and safety-classified `Fixed` keys |
| `PropertyTest:merged-overlay-passes-lock-gate-or-is-refused` | fast | CTRL-CFG-B-3 |
| `UnitTest:bundle-build-refused-with-unresolved-merge` | fast | Section 7 |
| `UnitTest:l-item-references-exist` | fast | Section 12 |
| `UnitTest:environment-missing-refuses-start` | fast | Section 8 |
| `UnitTest:production-wiring-binds-fail-closed-adapters` | fast | 4.7 (D16) |
| `UnitTest:production-approval-source-confirms-nothing`, `UnitTest:production-terminology-port-refuses-coded-items`, `UnitTest:production-authorization-denies-every-command`, `UnitTest:production-signer-refuses-to-sign`, `UnitTest:missing-promotion-ledger-refuses-lineage`, `UnitTest:refused-command-reaches-audit-port` | fast | 4.7: each production adapter's fail-closed behaviour (D16) |
| `ArchTest:production-never-binds-test-adapters` | fast | Section 11 (D8); the kernel's rule (kernel §11) with its exception for `app-hms`'s dev and test wiring package; in `:platform:arch-rules` |
| `IntegrationTest:app-hms-refuses-to-start-with-volatile-config-state` | merge (`app-hms`) | Section 11 (D8, D16) |
| `IntegrationTest:bundle-approvals-only-from-sign-off-records` | merge | `HumanApprovalSource` build-time adapter against `sh tools/hms safety check` |
| `IntegrationTest:kill-switch-engagement-raises-owned-task` | merge, with `platform-tasks` | CTRL-CFG-C-2 end to end through the journal watermark (D14) |
| `IntegrationTest:kill-switch-survives-restart` | merge, waits for the persistence slice | CTRL-0019-3; HAZ-0019 new cause |
| `IntegrationTest:config-state-persisted-append-only` | merge, waits | Section 11 later slice |
| `ArchitectureTest` (existing rules) | fast | Domain free of frameworks and system clock; this module imports only `tenancy.api`, the tasks api payload types and the kernel |

---

## 15. Known anomalies to record (local labels)

| KA | Description | Hazard refs | Closes with |
|---|---|---|---|
| KA-CFG-1 | Production trust store is empty and the production `BundleSigner` returns `SIGNING_UNAVAILABLE`: no bundle can be built or activated outside tests | HAZ-CFG-A | ADR-CFG-1 and DN-CFG-1 [HUMAN] |
| KA-CFG-2 | `HumanApprovalSource` production adapter confirms nothing: no change set with `APPROVED` items reaches `APPROVED` outside tests, so nothing needing approval can reach TRAIN or PROD | HAZ-0019; HAZ-CFG-A | WP-0.4 and the signature-provider port (OQ-005) |
| KA-CFG-3 | Governed values cannot be activated until tenancy's `GovernedChangeVerifier` and the evidence model exist (tenancy KA-T3); no facility can move to `CLINICAL_SAFETY` and no CDS rule flag can be turned on | HAZ-0005; HAZ-0019 | Tenancy's verifier (WP-0.9, `IMP-RDY-01`) |
| KA-CFG-4 | `ConfigAuthorization` is deny-all in production wiring, so no one can engage, review or release a kill switch in a deployed system. An emergency stop that cannot be used fails SI-19 clause a; until DN-CFG-2 is answered, no clinical behaviour behind a flag may go live | HAZ-0019 (CTRL-0019-3); HAZ-CFG-C | WP-0.4 and DN-CFG-2 |
| KA-CFG-5 | Refused commands go to an operational log adapter, not a BALP audit | HAZ-CFG-C | WP-0.4 (Audit SDK) |
| KA-CFG-6 | No persistent repositories: production wiring binds none and the application refuses to start with this module wired (section 11). An in-memory kill switch would be lost on restart and silently released; that is why none is bound. Kill-switch propagation across the nodes of a cell is unproven | HAZ-0019 (CTRL-0019-3) | Later slice (schema) and WP-0.2 cell (DN-040) |
| KA-CFG-7 | `BoundaryRegisterPort` production adapter answers `UNAVAILABLE`: every Tier 2-bound flag evaluates `Unavailable(REGISTER_UNAVAILABLE)`, handled as off; the fallback control sets stay in force | HAZ-0018 | WP-0.9 |
| KA-CFG-8 | `TerminologyValidationPort` fails closed: any item with coded references fails gate G6 | §19.4; HAZ-CFG-A | WP-1.1 (`PLT-CORE-05`) |
| KA-CFG-9 | Closed: every tenancy interface that 3.1 uses is in tenancy's api (tenancy §6), so no fallback remains | HAZ-CFG-A | Closed by tenancy's revised spec |

---

## 16. Open questions (local labels)

1. **OQ-CFG-1 (D5): this module's dependencies against §5.2's column.** §5.2 lists only Trust for `platform-config`. This spec depends on `hms.platform.tenancy.api` (it is the chain's governed write path) and on `hms.platform.tasks.api` for the `TaskRequested` payload types only. Proposal: record both in the module map.
2. **OQ-CFG-2 (CSO, Trust Plane): who may engage, review and release kill switches, per scope.** Default: three separate permissions; release needs a `RELEASE_APPROVED` review [P]. Should the reviewer differ from the person who engaged?
3. **OQ-CFG-3 (CSO): what engaging a kill switch on a Tier A hard stop (or a Tier B baseline rule) requires.** SI-19 gives every rule a kill switch; SI-14 says Tier A/B rules are never retired on override rate alone and the baseline is interruptive from day 0; §9.6 and §14.3 say nothing about who may stop one or what must happen next. Options: anyone with the engage permission (interim default, 6.3); a second person or the CSO; a mandatory time limit; a compensating manual check (for example pharmacist review) while engaged. Default to build with: anyone with the engage permission, step-up, reason, `STAT` review task, registry status untouched.
4. **OQ-CFG-4: the maximum propagation delay of a kill switch across the nodes of a cell** (`platform.config.killswitch.max-propagation`) **and the reconciliation bound of 5.7.** No source sets them. To be set with the WP-0.2 cell and confirmed by the CSO.
5. **OQ-CFG-5: a vendor-wide kill switch.** Should a vendor-signed kill-switch directive apply immediately at every cell without the promotion gates? Default: not built; a hospital engages locally after a field safety notice (§10.1).
6. **OQ-CFG-6 [P]: PLAY is a sink.** Nothing is promoted out of PLAY; changes are re-authored in BUILD. Confirm.
7. **OQ-CFG-7 [P]: separation of duties.** The author of a change set cannot approve it (INV-7, now code). Confirm, or name the content types where one person may do both (that would be a code change with hazard review).
8. **OQ-CFG-8 [P]: non-safety merge conflicts.** Default: every conflict blocks until a human resolves it. Should an owning module be able to declare "keep the tenant value" for a non-safety key?
9. **OQ-CFG-9: does SI-19 clause b ("safety-relevant changes default to off") also govern safety-relevant setting values delivered in a bundle**, beyond flags? Default [P]: a bundle item that changes a safety-relevant setting needs CSO approval, as a C1 flag does.
10. **OQ-CFG-10: who checks a flag's `OPERATIONAL` claim and a `CLINICAL_BEHAVIOUR` flag's declared `whenUnavailable`.** This module cannot tell whether a flag changes clinical behaviour or protects a patient. Default: the owning module's hazard analysis and the code review state it; both are listed in the Release Evidence Pack [P].
11. **OQ-CFG-11 [P]: canonical serialisation.** Confirm the JSON subset of 5.5, and whether to claim RFC 8785 conformance for it.
12. **OQ-CFG-12 [P]: no runtime value changes outside bundles in TEST, TRAIN and PROD** (only kill switches, reviews and USER preferences), **and no retroactive items in bundles** (5.10). Confirm, or name operational settings that need a faster path.
13. **OQ-CFG-13 (with `platform-tasks`): escalation policies as a content type.** Closed: escalation policies are items of the content type `platform.tasks.escalation-policy`, read through `ContentReader` (5.8; tasks §4.2 and A-6).
14. **OQ-CFG-14 [P]: promoting the enterprise structure.** Bundles address scopes by tenancy's `ScopeAddress` (5.9) and each environment sets up its own structure. Should the structure travel in its own signed stream with stable ids instead?

---

## 17. Decisions needed and ADRs (local labels)

- **ADR-CFG-1, proposed: Configuration bundle signing and trust.** Ed25519 through the JDK provider; key roles (vendor content, tenant configuration); the trust store shipped in the signed release; rotation and revocation, with the revocation-set sequence kept outside the release so that a rollback cannot restore a revoked key (5.6); anti-rollback per tenant and stream; how promotion records travel between environments; key custody (TPM or HSM, aligned with ADR-008) and escrow. Guarded by the section 14 bundle tests. Reopen if a Kurdistan rule or a buyer requires a different algorithm or a transparency log.
- **ADR-CFG-2, proposed: Governed configuration writes across the module boundary.** Tenancy verifies every non-USER write through `ChangeSetVerifier`, implemented here; activation and apply run as two commits with tenancy's activation record (`lastActivation`) as the anti-rollback authority and a reconciler for the second commit (5.7); content bodies in a content-addressed store, references in the chain (5.8); scopes addressed by code paths across environments (5.9). Guarded by `PropertyTest:fabricated-change-set-writes-nothing` and `PropertyTest:activation-interrupted-between-commits-reconciles`. Reopen if `platform-config` and `platform-tenancy` are ever allowed one transaction.
- **DN-CFG-1 [HUMAN]: production custody of the configuration-signing keys.** §4.3: "Production keys and any transparency log need an ADR and a [HUMAN] decision." Blocks: activation outside tests (KA-CFG-1), not WP-0.3's domain work. Approval: status requested; approver and date empty.
- **DN-CFG-2 [HUMAN] (CSO): engaging a kill switch when no authorisation decision can be made.** In WP-0.3 production wiring denies every command; from WP-0.4 the policy decision point can be unavailable. Choosing between an unusable stop and an unauthorised stop is a patient-safety choice and a reading of SI-19 clause a (§3.4 items 1 and 8). Options: (a) refuse, and accept that the stop is unusable during the outage; (b) a local break-glass engage path, audited, with step-up on cell-local credentials and a mandatory review afterwards; (c) engage-only break-glass (never release) for named roles held locally. No default is chosen here. Blocks: R1 go-live of any clinical behaviour behind a flag (KA-CFG-4; HAZ-0019 CTRL-0019-3). Approval: status requested; approver and date empty.
- **DN-CFG-3 [HUMAN] (CSO): what "vendor-locked" means for SI-19 in the configuration chain.** This spec reads it as locking SI-19's rules, not flag values (6.5). The alternative, a tighten-only flag value, would stop any tenant from turning a validated baseline on. Blocks: CTRL-0019-1 leaving `planned`. Approval: status requested; approver and date empty.

---

## 18. Acceptance criteria (WP-0.3)

1. Registering a `CDS_RULE` or `CLINICAL_BEHAVIOUR` flag with default ON, any flag claimed safety-relevant with default ON or without a control reference, or a closed-loop flag below FACILITY, is refused; every registered flag has a kill switch.
2. An engaged kill switch at a scope turns the flag OFF at that scope and every scope below it for the next live evaluation, whatever the configured value or the caller's `validAt`, with no restart (one process). An as-was evaluation shows the switch state as known then.
3. A failed flag evaluation is `Unavailable` with the flag's declared handling and an alarm; it is never `On` and never a plain `Off`.
4. Every flag change and every kill-switch engagement, further engagement, review and release produces a complete audit record; a blank reason cannot be expressed; a release without a `RELEASE_APPROVED` review is refused; an engagement writes its review-task request in the same transaction and never fails for lack of task configuration.
5. A Tier 2-bound flag is OFF unless the (fake) Register says `cleared` or `not-required`; with no Register it is `Unavailable` and handled as off.
6. A change set item below a lock, loosening a vendor-locked safety parameter, or starting in the past, is refused at submit, at apply and at activation.
7. A change set reaches `APPROVED` only with human approval evidence for every required role, from human actors, never from its author.
8. A batch sent to tenancy with a fabricated, foreign, stale or digest-mismatched change set id writes nothing.
9. A bundle with any altered byte, an unknown or revoked key, a lower or equal sequence, a skipped environment, an unresolvable scope address, a governed item without evidence, or (for TRAIN and PROD) a synthetic item is refused, and the refusal changes nothing in that tenant. An activation interrupted between its two commits is completed exactly once by reconciliation.
10. Canonical serialisation gives identical bytes for the same content across runs, orders, locales and charsets.
11. A three-way merge places every tenant override in exactly one rule of the ordered table; keeps tenant tightenings that stay stricter; never auto-resolves a conflict on a safety-classified key; and the bundle builder refuses while a blocking finding is open.
12. Architecture tests pass: the domain is free of framework types and the system clock; the module imports only `tenancy.api`, the tasks api payload types and the kernel; no `..inmemory..` adapter is reachable from production wiring; the application refuses to start with volatile configuration state.
13. Every fail-closed port is recorded in `KNOWN-ANOMALIES.md` with its hazard reference, its mechanism and its test.

All are checked by the section 14 tests in the fast tier, except where marked "merge" or "waits".
