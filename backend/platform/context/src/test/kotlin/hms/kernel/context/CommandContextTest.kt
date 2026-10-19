@file:OptIn(ActorKindRestricted::class)

package hms.kernel.context

import hms.kernel.context.CommandContextRefusal.BACK_ENTRY_FACILITY_MISMATCH
import hms.kernel.context.CommandContextRefusal.BACK_ENTRY_NEEDS_USER_ACTOR
import hms.kernel.context.CommandContextRefusal.BACK_ENTRY_WHILE_OFFLINE
import hms.kernel.context.CommandContextRefusal.DEVICE_ACTOR_NEEDS_MATCHING_DEVICE
import hms.kernel.context.CommandContextRefusal.OFFLINE_CAPTURE_DEVICE_MISMATCH
import hms.kernel.context.CommandContextRefusal.OFFLINE_CAPTURE_NEEDS_CLINICAL_TIME
import hms.kernel.context.CommandContextRefusal.OFFLINE_CAPTURE_NEEDS_USER_ACTOR
import hms.kernel.context.CommandContextRefusal.ON_BEHALF_OF_NEEDS_USER_ACTOR
import hms.kernel.context.CommandContextRefusal.ON_BEHALF_OF_SELF
import hms.kernel.context.ContextFixtures.CLINICAL_TIME
import hms.kernel.context.ContextFixtures.DEVICE
import hms.kernel.context.ContextFixtures.FACILITY
import hms.kernel.context.ContextFixtures.OTHER_DEVICE
import hms.kernel.context.ContextFixtures.OTHER_FACILITY
import hms.kernel.context.ContextFixtures.OTHER_USER
import hms.kernel.context.ContextFixtures.USER
import hms.kernel.context.ContextFixtures.actor
import hms.kernel.context.ContextFixtures.authority
import hms.kernel.context.ContextFixtures.context
import hms.kernel.context.ContextFixtures.offline
import hms.kernel.time.EntryMode
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.Constructor
import java.lang.reflect.InvocationTargetException
import java.util.UUID

private const val NOT_V7 = "123e4567-e89b-42d3-a456-426614174000"

private fun CommandContextResult.valid(): CommandContext = shouldBeInstanceOf<CommandContextResult.Valid>().context

private fun CommandContextResult.refusals(): Set<CommandContextRefusal> = shouldBeInstanceOf<CommandContextResult.Refused>().reasons

private fun Constructor<*>.newRejected(vararg arguments: Any?) {
    isAccessible = true
    val thrown = shouldThrow<InvocationTargetException> { newInstance(*arguments) }
    thrown.cause.shouldBeInstanceOf<IllegalArgumentException>()
}

/** CommandContext, its refusals, the derived entry mode and the formats of its values (platform-kernel.md §7.1 to §7.3, §7.6). */
class CommandContextTest :
    FunSpec({
        val covered = mutableSetOf<CommandContextRefusal>()

        fun refusedWith(
            result: CommandContextResult,
            vararg expected: CommandContextRefusal,
        ) {
            result.refusals() shouldBe expected.toSet()
            covered += expected
        }

        test("command-context-invariants: a USER actor online at a facility is valid, with every field kept") {
            val context = context(onBehalfOf = OTHER_USER, device = DEVICE, clinicalTime = CLINICAL_TIME).valid()
            context.tenant shouldBe ContextFixtures.TENANT
            context.facility shouldBe FACILITY
            context.actor shouldBe ActorRef.user(USER)
            context.onBehalfOf shouldBe OTHER_USER
            context.device shouldBe DEVICE
            context.purposeOfUse shouldBe ContextFixtures.PURPOSE
            context.clinicalTime shouldBe CLINICAL_TIME
            context.capture shouldBe CaptureChannel.Online
            context.backEntry shouldBe null
            context.idempotencyKey shouldBe ContextFixtures.KEY
            context.correlationId shouldBe ContextFixtures.CORRELATION
            context.causationId shouldBe null
            context.entryMode shouldBe EntryMode.USER
        }

        test("command-context-invariants: tenant-level work has no facility") {
            context(facility = null).valid().facility shouldBe null
        }

        test("command-context-invariants: on-behalf-of needs a USER actor and is never the actor's own user") {
            ActorKind.entries.filter { it != ActorKind.USER }.forEach { kind ->
                withClue(kind) {
                    refusedWith(context(actor = actor(kind), onBehalfOf = OTHER_USER, device = DEVICE), ON_BEHALF_OF_NEEDS_USER_ACTOR)
                }
            }
            refusedWith(context(onBehalfOf = USER), ON_BEHALF_OF_SELF)
        }

        test("command-context-invariants: a DEVICE actor needs its own device on the context") {
            refusedWith(context(actor = actor(ActorKind.DEVICE)), DEVICE_ACTOR_NEEDS_MATCHING_DEVICE)
            refusedWith(context(actor = actor(ActorKind.DEVICE), device = OTHER_DEVICE), DEVICE_ACTOR_NEEDS_MATCHING_DEVICE)
            context(actor = actor(ActorKind.DEVICE), device = DEVICE).valid().entryMode shouldBe EntryMode.DEVICE
        }

        test("command-context-invariants: offline capture needs a USER actor, the capture time and the same device") {
            ActorKind.entries.filter { it != ActorKind.USER }.forEach { kind ->
                withClue(kind) {
                    refusedWith(
                        context(actor = actor(kind), device = DEVICE, clinicalTime = CLINICAL_TIME, capture = offline()),
                        OFFLINE_CAPTURE_NEEDS_USER_ACTOR,
                    )
                }
            }
            refusedWith(context(device = DEVICE, capture = offline()), OFFLINE_CAPTURE_NEEDS_CLINICAL_TIME)
            refusedWith(context(clinicalTime = CLINICAL_TIME, capture = offline()), OFFLINE_CAPTURE_DEVICE_MISMATCH)
            refusedWith(context(device = OTHER_DEVICE, clinicalTime = CLINICAL_TIME, capture = offline()), OFFLINE_CAPTURE_DEVICE_MISMATCH)
            context(device = DEVICE, clinicalTime = CLINICAL_TIME, capture = offline()).valid().entryMode shouldBe EntryMode.OFFLINE_CAPTURE
        }

        test("command-context-invariants: back-entry needs a USER actor, online, at the authority's facility") {
            ActorKind.entries.filter { it != ActorKind.USER }.forEach { kind ->
                withClue(kind) {
                    refusedWith(context(actor = actor(kind), device = DEVICE, backEntry = authority()), BACK_ENTRY_NEEDS_USER_ACTOR)
                }
            }
            refusedWith(
                context(device = DEVICE, clinicalTime = CLINICAL_TIME, capture = offline(), backEntry = authority()),
                BACK_ENTRY_WHILE_OFFLINE,
            )
            refusedWith(context(backEntry = authority(OTHER_FACILITY)), BACK_ENTRY_FACILITY_MISMATCH)
            refusedWith(context(facility = null, backEntry = authority()), BACK_ENTRY_FACILITY_MISMATCH)
            context(backEntry = authority()).valid().entryMode shouldBe EntryMode.BACK_ENTRY
        }

        test("command-context-invariants: every reason that applies is reported at once") {
            refusedWith(
                context(
                    actor = actor(ActorKind.SYSTEM),
                    facility = null,
                    onBehalfOf = OTHER_USER,
                    capture = offline(),
                    backEntry = authority(),
                ),
                ON_BEHALF_OF_NEEDS_USER_ACTOR,
                OFFLINE_CAPTURE_NEEDS_USER_ACTOR,
                OFFLINE_CAPTURE_NEEDS_CLINICAL_TIME,
                OFFLINE_CAPTURE_DEVICE_MISMATCH,
                BACK_ENTRY_NEEDS_USER_ACTOR,
                BACK_ENTRY_WHILE_OFFLINE,
                BACK_ENTRY_FACILITY_MISMATCH,
            )
        }

        test("command-context-invariants: every CommandContextRefusal is exercised above") {
            covered shouldBe CommandContextRefusal.entries.toSet()
        }

        test("command-context-invariants: the entry mode follows the section 7.3 table") {
            context().valid().entryMode shouldBe EntryMode.USER
            context(device = DEVICE, clinicalTime = CLINICAL_TIME, capture = offline()).valid().entryMode shouldBe EntryMode.OFFLINE_CAPTURE
            context(backEntry = authority()).valid().entryMode shouldBe EntryMode.BACK_ENTRY
            context(actor = actor(ActorKind.DEVICE), device = DEVICE).valid().entryMode shouldBe EntryMode.DEVICE
            context(actor = actor(ActorKind.INTERFACE)).valid().entryMode shouldBe EntryMode.INTERFACE
            context(actor = actor(ActorKind.MIGRATION_LOADER)).valid().entryMode shouldBe EntryMode.MIGRATION
            context(actor = actor(ActorKind.SYSTEM)).valid().entryMode shouldBe EntryMode.SYSTEM
        }

        test("command-context-invariants: idempotency key is 1 to 200 visible ASCII characters") {
            IdempotencyKey("a").value shouldBe "a"
            IdempotencyKey("!".repeat(100) + "~".repeat(100)).value.length shouldBe 200
            listOf("", "x".repeat(201), "has space", "tab\t", "café", "del\u007f", "١٢").forEach { bad ->
                withClue(bad) { shouldThrow<IllegalArgumentException> { IdempotencyKey(bad) } }
            }
        }

        test("command-context-invariants: purpose of use is non-blank and at most 64 characters") {
            PurposeOfUse("p".repeat(64)).code.length shouldBe 64
            listOf("", "   ", "p".repeat(65)).forEach { bad ->
                withClue(bad) { shouldThrow<IllegalArgumentException> { PurposeOfUse(bad) } }
            }
        }

        test("command-context-invariants: system process names follow [a-z][a-z0-9.-]*") {
            listOf("a", "platform-tasks.orphan-scan", "hms.kernel.journal.gap-fill2").forEach { good ->
                SystemProcess(good).name shouldBe good
            }
            listOf("", "Platform", "1scan", "-scan", "orphan_scan", "orphan scan", "scan/1").forEach { bad ->
                withClue(bad) { shouldThrow<IllegalArgumentException> { SystemProcess(bad) } }
            }
        }

        test("command-context-invariants: device, interface, migration-run and correlation ids must be UUIDv7") {
            val notV7 = UUID.fromString(NOT_V7)
            shouldThrow<IllegalArgumentException> { DeviceRef(notV7) }
            shouldThrow<IllegalArgumentException> { InterfaceChannelRef(notV7) }
            shouldThrow<IllegalArgumentException> { MigrationRunRef(notV7) }
            shouldThrow<IllegalArgumentException> { CorrelationId(notV7) }
            CausationId(notV7).value shouldBe notV7
        }

        test("command-context-invariants: each actor kind keeps its id, and a SYSTEM actor's id is stable per process name") {
            ActorRef.user(USER).let { (it.kind to it.id) shouldBe (ActorKind.USER to USER.value) }
            ActorRef.device(DEVICE).let { (it.kind to it.id) shouldBe (ActorKind.DEVICE to DEVICE.id) }
            ActorRef.interfaceChannel(ContextFixtures.INTERFACE_CHANNEL).kind shouldBe ActorKind.INTERFACE
            ActorRef.migrationLoader(ContextFixtures.MIGRATION_RUN).kind shouldBe ActorKind.MIGRATION_LOADER
            val scan = ActorRef.system(SystemProcess("platform-tasks.orphan-scan"))
            scan shouldBe ActorRef.system(SystemProcess("platform-tasks.orphan-scan"))
            scan.id shouldBe ActorRef.system(SystemProcess("platform-tasks.orphan-scan")).id
            scan.systemProcess shouldBe SystemProcess("platform-tasks.orphan-scan")
            scan.id shouldNotBe ActorRef.system(SystemProcess("platform-tasks.sla-breach")).id
            ActorRef.user(USER).systemProcess shouldBe null
        }

        test("command-context-invariants: reflective construction with invalid values throws") {
            val actorConstructor = ActorRef::class.java.declaredConstructors.single { it.parameterCount == 3 }
            actorConstructor.newRejected(ActorKind.USER, UUID.fromString(NOT_V7), null)
            actorConstructor.newRejected(ActorKind.USER, USER.value, "platform-tasks.orphan-scan")
            actorConstructor.newRejected(ActorKind.SYSTEM, USER.value, "platform-tasks.orphan-scan")
            actorConstructor.newRejected(ActorKind.SYSTEM, ActorRef.system(SystemProcess("ok")).id, null)

            val contextConstructor = CommandContext::class.java.declaredConstructors.single { it.parameterCount == 12 }
            val system = actor(ActorKind.SYSTEM)
            val tenant = ContextFixtures.TENANT.value
            val correlation = ContextFixtures.CORRELATION.value
            // A SYSTEM actor on behalf of a user.
            contextConstructor.newRejected(
                tenant,
                null,
                system,
                USER.value,
                null,
                "synthetic",
                null,
                CaptureChannel.Online,
                null,
                "k",
                correlation,
                null,
            )
            // An empty idempotency key.
            val online = CaptureChannel.Online
            contextConstructor.newRejected(tenant, null, system, null, null, "synthetic", null, online, null, "", correlation, null)
        }
    })
