package hms.tests.invariants

import hms.tests.invariants.application.register.SiRegister
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.nio.file.Files

/**
 * The SI scaffold is complete (BUILD-PROMPT §21 WP-0.5 "a test scaffold per SI with a named test for each";
 * docs/specs/modules/state-machines-and-invariants.md §4): a test spec SI01PropertyTest … SI21PropertyTest exists for
 * every SI of the register, and the register holds SI-01…SI-21.
 */
class SiScaffoldPropertyTest :
    FunSpec({
        test("the register holds SI-01…SI-21, in order") {
            Scaffold.register.entries.map { it.si } shouldBe SiRegister.SI_IDS
        }

        test("every SI has its test spec SInnPropertyTest, a Kotest spec that registers that SI's tests") {
            SiRegister.SI_IDS.forEach { si ->
                val name = "hms.tests.invariants.SI${si.removePrefix("SI-")}PropertyTest"
                val source =
                    Scaffold.files.repositoryRoot.resolve(
                        "tests/invariants/src/propertyTest/kotlin/hms/tests/invariants/${name.substringAfterLast('.')}.kt",
                    )
                withClue(name) {
                    val spec = runCatching { Class.forName(name) }.getOrNull()
                    (spec != null && FunSpec::class.java.isAssignableFrom(spec)) shouldBe true
                    Files.readString(source).contains("siInvariantTests(\"$si\"") shouldBe true
                }
            }
        }
    })
