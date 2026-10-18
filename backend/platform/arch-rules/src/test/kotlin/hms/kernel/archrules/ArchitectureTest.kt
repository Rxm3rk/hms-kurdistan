package hms.kernel.archrules

import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.TestFactory

/** This project's production code obeys the shared HMS architecture rules (BUILD-PROMPT §6.8 #3). */
class ArchitectureTest {
    @TestFactory
    fun `production classes obey every HMS architecture rule`(): List<DynamicTest> {
        val classes = ProjectArchitecture.importProductionClasses()
        return HmsArchitectureRules.all().map { rule -> dynamicTest(rule.description) { rule.check(classes) } }
    }
}
