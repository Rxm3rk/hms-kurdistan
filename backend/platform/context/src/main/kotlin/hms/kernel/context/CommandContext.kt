package hms.kernel.context

import hms.kernel.ids.FacilityId
import hms.kernel.ids.TenantId
import hms.kernel.ids.UserId
import hms.kernel.ids.UuidV7
import hms.kernel.time.ClinicalTime
import hms.kernel.time.EntryMode

/**
 * What every command carries (BUILD-PROMPT §6.2; platform-kernel.md §7.1, §7.6): tenant, facility, actor,
 * on-behalf-of, device, purpose of use, clinical time, capture channel, back-entry authority, idempotency key,
 * correlation id and causation id. Built only through [of], which refuses the combinations of §7.1 and §7.3;
 * the `init` block checks them again, so reflective construction cannot make an invalid context.
 * The change reason belongs to each change, not to the context (§7.1).
 */
@Suppress("LongParameterList") // The fields are fixed by platform-kernel.md §7.6.
class CommandContext private constructor(
    val tenant: TenantId,
    val facility: FacilityId?,
    val actor: ActorRef,
    val onBehalfOf: UserId?,
    val device: DeviceRef?,
    val purposeOfUse: PurposeOfUse,
    val clinicalTime: ClinicalTime?,
    val capture: CaptureChannel,
    val backEntry: BackEntryAuthority?,
    val idempotencyKey: IdempotencyKey,
    val correlationId: CorrelationId,
    val causationId: CausationId?,
) {
    init {
        // From Kotlin these values are valid by construction; reflection or Java can pass raw ones.
        require(PurposeOfUse.isValid(purposeOfUse.code)) { "invalid PurposeOfUse" }
        require(IdempotencyKey.isValid(idempotencyKey.value)) { "invalid IdempotencyKey" }
        require(listOfNotNull(tenant.value, facility?.value, onBehalfOf?.value, device?.id, correlationId.value).all(UuidV7::isV7)) {
            "CommandContext ids must be UUIDv7"
        }
        val refusals = refusalsOf(facility, actor, onBehalfOf, device, clinicalTime, capture, backEntry)
        require(refusals.isEmpty()) { "invalid CommandContext: $refusals" }
    }

    /** SI-10 entry mode, derived (section 7.3); never taken from request input. */
    val entryMode: EntryMode = entryModeOf(actor.kind, capture, backEntry)

    override fun toString(): String =
        "CommandContext(tenant=${tenant.value}, facility=${facility?.value}, actor=$actor, entryMode=$entryMode, " +
            "correlationId=${correlationId.value})"

    companion object {
        /** Builds a context, or refuses it with every reason that applies (platform-kernel.md §7.1, §7.3). */
        @Suppress("LongParameterList") // The signature is fixed by platform-kernel.md §7.6.
        @JvmStatic
        fun of(
            tenant: TenantId,
            facility: FacilityId?,
            actor: ActorRef,
            onBehalfOf: UserId?,
            device: DeviceRef?,
            purposeOfUse: PurposeOfUse,
            clinicalTime: ClinicalTime?,
            capture: CaptureChannel,
            backEntry: BackEntryAuthority?,
            idempotencyKey: IdempotencyKey,
            correlationId: CorrelationId,
            causationId: CausationId?,
        ): CommandContextResult {
            val refusals = refusalsOf(facility, actor, onBehalfOf, device, clinicalTime, capture, backEntry)
            if (refusals.isNotEmpty()) return CommandContextResult.Refused(refusals)
            val context =
                CommandContext(
                    tenant,
                    facility,
                    actor,
                    onBehalfOf,
                    device,
                    purposeOfUse,
                    clinicalTime,
                    capture,
                    backEntry,
                    idempotencyKey,
                    correlationId,
                    causationId,
                )
            return CommandContextResult.Valid(context)
        }

        @Suppress("LongParameterList")
        private fun refusalsOf(
            facility: FacilityId?,
            actor: ActorRef,
            onBehalfOf: UserId?,
            device: DeviceRef?,
            clinicalTime: ClinicalTime?,
            capture: CaptureChannel,
            backEntry: BackEntryAuthority?,
        ): Set<CommandContextRefusal> =
            buildSet {
                addAll(actorRefusals(actor, onBehalfOf, device))
                if (capture is CaptureChannel.OfflineQueued) addAll(offlineRefusals(actor, device, clinicalTime, capture))
                if (backEntry != null) addAll(backEntryRefusals(facility, actor, capture, backEntry))
            }

        private fun actorRefusals(
            actor: ActorRef,
            onBehalfOf: UserId?,
            device: DeviceRef?,
        ): Set<CommandContextRefusal> =
            buildSet {
                if (onBehalfOf != null && actor.kind != ActorKind.USER) add(CommandContextRefusal.ON_BEHALF_OF_NEEDS_USER_ACTOR)
                if (onBehalfOf != null && actor.kind == ActorKind.USER && onBehalfOf.value == actor.id) {
                    add(CommandContextRefusal.ON_BEHALF_OF_SELF)
                }
                if (actor.kind == ActorKind.DEVICE && device?.id != actor.id) add(CommandContextRefusal.DEVICE_ACTOR_NEEDS_MATCHING_DEVICE)
            }

        private fun offlineRefusals(
            actor: ActorRef,
            device: DeviceRef?,
            clinicalTime: ClinicalTime?,
            capture: CaptureChannel.OfflineQueued,
        ): Set<CommandContextRefusal> =
            buildSet {
                if (actor.kind != ActorKind.USER) add(CommandContextRefusal.OFFLINE_CAPTURE_NEEDS_USER_ACTOR)
                if (clinicalTime == null) add(CommandContextRefusal.OFFLINE_CAPTURE_NEEDS_CLINICAL_TIME)
                if (device?.id != capture.device.id) add(CommandContextRefusal.OFFLINE_CAPTURE_DEVICE_MISMATCH)
            }

        private fun backEntryRefusals(
            facility: FacilityId?,
            actor: ActorRef,
            capture: CaptureChannel,
            backEntry: BackEntryAuthority,
        ): Set<CommandContextRefusal> =
            buildSet {
                if (actor.kind != ActorKind.USER) add(CommandContextRefusal.BACK_ENTRY_NEEDS_USER_ACTOR)
                if (capture is CaptureChannel.OfflineQueued) add(CommandContextRefusal.BACK_ENTRY_WHILE_OFFLINE)
                if (facility?.value != backEntry.facility.value) add(CommandContextRefusal.BACK_ENTRY_FACILITY_MISMATCH)
            }

        /** The platform-kernel.md §7.3 table, for a context that passed [refusalsOf]. */
        private fun entryModeOf(
            kind: ActorKind,
            capture: CaptureChannel,
            backEntry: BackEntryAuthority?,
        ): EntryMode =
            when (kind) {
                ActorKind.USER -> {
                    when {
                        backEntry != null -> EntryMode.BACK_ENTRY
                        capture is CaptureChannel.OfflineQueued -> EntryMode.OFFLINE_CAPTURE
                        else -> EntryMode.USER
                    }
                }

                ActorKind.DEVICE -> {
                    EntryMode.DEVICE
                }

                ActorKind.INTERFACE -> {
                    EntryMode.INTERFACE
                }

                ActorKind.MIGRATION_LOADER -> {
                    EntryMode.MIGRATION
                }

                ActorKind.SYSTEM -> {
                    EntryMode.SYSTEM
                }
            }
    }
}

/** The answer of [CommandContext.of]. */
sealed interface CommandContextResult {
    data class Valid(
        val context: CommandContext,
    ) : CommandContextResult

    /** Every reason that applies, never empty. */
    data class Refused(
        val reasons: Set<CommandContextRefusal>,
    ) : CommandContextResult
}

/** Why a context was refused (platform-kernel.md §7.1, §7.3). */
enum class CommandContextRefusal {
    ON_BEHALF_OF_NEEDS_USER_ACTOR,
    ON_BEHALF_OF_SELF,
    DEVICE_ACTOR_NEEDS_MATCHING_DEVICE,
    OFFLINE_CAPTURE_NEEDS_USER_ACTOR,
    OFFLINE_CAPTURE_NEEDS_CLINICAL_TIME,
    OFFLINE_CAPTURE_DEVICE_MISMATCH,
    BACK_ENTRY_NEEDS_USER_ACTOR,
    BACK_ENTRY_WHILE_OFFLINE,
    BACK_ENTRY_FACILITY_MISMATCH,
}
