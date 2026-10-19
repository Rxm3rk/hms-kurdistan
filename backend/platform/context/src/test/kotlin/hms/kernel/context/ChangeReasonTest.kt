package hms.kernel.context

import com.tngtech.archunit.core.domain.JavaClass
import com.tngtech.archunit.core.domain.JavaModifier
import hms.kernel.archrules.ProjectArchitecture
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.InvocationTargetException

private fun JavaClass.isReason(): Boolean = isAssignableTo(ChangeReason::class.java)

/** Change reasons are never blank and never defaulted (platform-kernel.md §7.4, §7.6; CTRL-0010-4). */
class ChangeReasonTest :
    FunSpec({
        fun entered(text: String?): ChangeReason.Entered = ChangeReason.entered(text).shouldBeInstanceOf<ChangeReasonResult.Valid>().reason

        test("change-reason-never-blank-never-defaulted: null, blank and over-long reasons are refused") {
            ChangeReason.entered(null) shouldBe ChangeReasonResult.Refused(ChangeReasonError.MISSING)
            listOf("", " ", "\t\n", " ", " ".repeat(3000)).forEach { blank ->
                withClue("blank of length ${blank.length}") {
                    ChangeReason.entered(blank) shouldBe ChangeReasonResult.Refused(ChangeReasonError.BLANK)
                }
            }
            ChangeReason.entered("r".repeat(2001)) shouldBe ChangeReasonResult.Refused(ChangeReasonError.TOO_LONG)
        }

        test("change-reason-never-blank-never-defaulted: a reason of 1 to 2,000 characters is kept as typed") {
            entered("Charted late after a synthetic downtime").text shouldBe "Charted late after a synthetic downtime"
            entered("  padded  ").text shouldBe "  padded  "
            entered("r".repeat(2000)).text.length shouldBe 2000
            // Characters are code points: 2,000 characters outside the BMP are 4,000 UTF-16 units.
            entered("😀".repeat(2000)).text.length shouldBe 4000
            ChangeReason.entered("😀".repeat(2001)) shouldBe ChangeReasonResult.Refused(ChangeReasonError.TOO_LONG)
            entered("x") shouldBe entered("x")
        }

        test("change-reason-never-blank-never-defaulted: a system reason follows [a-z][a-z0-9.-]* and throws otherwise") {
            val reason = ChangeReason.system("platform-tasks.orphan-scan").shouldBeInstanceOf<ChangeReason.SystemGenerated>()
            reason.code shouldBe "platform-tasks.orphan-scan"
            listOf("", "Orphan", "orphan scan", "9scan", "orphan_scan").forEach { bad ->
                withClue(bad) { shouldThrow<IllegalArgumentException> { ChangeReason.system(bad) } }
            }
        }

        test("change-reason-never-blank-never-defaulted: reflective construction with an invalid value throws") {
            val invalid = listOf(ChangeReason.Entered::class.java to "  ", ChangeReason.SystemGenerated::class.java to "Not A Code")
            invalid.forEach { (type, value) ->
                val constructor = type.getDeclaredConstructor(String::class.java)
                constructor.isAccessible = true
                val thrown = shouldThrow<InvocationTargetException> { constructor.newInstance(value) }
                thrown.cause.shouldBeInstanceOf<IllegalArgumentException>()
            }
        }

        test("change-reason-never-blank-never-defaulted: the entered reason's text never shows in toString") {
            entered("synthetic secret").toString().contains("secret") shouldBe false
        }

        test("change-reason-never-blank-never-defaulted: no constant, default parameter or parameterless factory of a reason type") {
            val classes = ProjectArchitecture.importProductionClasses()
            val constants =
                classes.flatMap { type ->
                    type.fields.filter { JavaModifier.STATIC in it.modifiers && it.rawType.isReason() }.map { it.fullName }
                }
            val defaults =
                classes.flatMap { type ->
                    type.methods
                        // A data class's copy$default only copies the current value; it is no default reason.
                        .filter { it.name.endsWith("\$default") && it.name != "copy\$default" }
                        .filter { it.rawParameterTypes.any { parameter -> parameter.isReason() } }
                        .map { it.fullName }
                }
            val parameterless =
                classes.flatMap { type ->
                    val holder = type.simpleName == "Companion" || type.fields.any { it.name == "INSTANCE" }
                    type.methods
                        .filter { it.rawReturnType.isReason() && it.rawParameterTypes.isEmpty() }
                        .filter { holder || JavaModifier.STATIC in it.modifiers }
                        .map { it.fullName }
                }
            constants.shouldBeEmpty()
            defaults.shouldBeEmpty()
            parameterless.shouldBeEmpty()
            val factories = ChangeReason.Companion::class.java.declaredMethods.filter { it.name == "entered" || it.name == "system" }
            factories.map { it.parameterCount }.toSet() shouldBe setOf(1)
        }
    })
