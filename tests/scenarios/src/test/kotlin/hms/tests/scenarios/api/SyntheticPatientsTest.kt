package hms.tests.scenarios.api

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldStartWith

/** The synthetic patient factory produces SYN- identifiers only (BUILD-PROMPT §18.10). */
class SyntheticPatientsTest :
    FunSpec({
        test("the factory issues SYN-000001, SYN-000002, ... in order, all unique") {
            val patients = SyntheticPatients()
            val issued = List(1000) { patients.next() }
            issued.take(3).map { it.id } shouldContainExactly listOf("SYN-000001", "SYN-000002", "SYN-000003")
            issued.last().id shouldBe "SYN-001000"
            issued.forEach { it.id shouldStartWith "SYN-" }
            issued.map { it.id }.toSet().size shouldBe issued.size
            patients.issued() shouldContainExactly issued
        }

        test("two worlds' factories are independent") {
            val a = SyntheticPatients()
            val b = SyntheticPatients()
            a.next()
            a.next()
            b.next().id shouldBe "SYN-000001"
        }

        listOf("MRN-000001", "syn-000001", "SYN-1", "SYN-0000001", "SYN-00000A", "", " SYN-000001", "XSYN-000001").forEach { id ->
            test("an identifier that is not synthetic is refused: '$id'") {
                shouldThrow<IllegalArgumentException> { SyntheticPatient(id) }.message shouldContain "must be synthetic"
            }
        }

        test("a synthetic patient carries the NOT FOR CLINICAL USE label") {
            SyntheticPatients.LABEL shouldBe "NOT FOR CLINICAL USE"
            SyntheticPatient("SYN-000042").toString() shouldContain "NOT FOR CLINICAL USE"
        }
    })
