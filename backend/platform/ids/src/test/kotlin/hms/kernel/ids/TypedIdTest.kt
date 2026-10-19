package hms.kernel.ids

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.util.UUID

/** `UnitTest:kernel-typed-ids-require-v7` (platform-kernel spec §5, §17). */
class TypedIdTest :
    FunSpec({
        val v7 = UUID.fromString("017f22e2-79b0-7cc3-98c4-dc0c0c07398f")
        val notV7 =
            mapOf(
                "a version 4 UUID" to UUID.fromString("919108f7-52d1-4320-9bac-f847db4148a8"),
                "a version 1 UUID" to UUID.fromString("c232ab00-9414-11ec-b3c8-9f6bdeced846"),
                "version 7 with another variant" to UUID.fromString("017f22e2-79b0-7cc3-c8c4-dc0c0c07398f"),
                "the nil UUID" to UUID(0, 0),
                "the max UUID" to UUID(-1, -1),
            )
        val kinds: Map<String, (UUID) -> TypedId> =
            mapOf(
                "TenantId" to ::TenantId,
                "FacilityId" to ::FacilityId,
                "PatientId" to ::PatientId,
                "UserId" to ::UserId,
            )

        kinds.forEach { (name, make) ->
            test("kernel-typed-ids-require-v7: $name keeps a v7 UUID") {
                make(v7).value shouldBe v7
            }

            notV7.forEach { (what, uuid) ->
                test("kernel-typed-ids-require-v7: $name refuses $what") {
                    shouldThrow<IllegalArgumentException> { make(uuid) }
                }
            }
        }

        test("typed ids are values: equal UUIDs give equal ids") {
            TenantId(v7) shouldBe TenantId(UUID.fromString(v7.toString()))
            PatientId(v7).value shouldBe UserId(v7).value
        }
    })
