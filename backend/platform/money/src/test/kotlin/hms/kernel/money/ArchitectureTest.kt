package hms.kernel.money

import hms.kernel.archrules.HmsArchitectureRules
import hms.kernel.archrules.ProjectArchitecture
import io.kotest.core.spec.style.FunSpec

/** This project's production code obeys the shared HMS architecture rules (BUILD-PROMPT §6.8 #3). */
class ArchitectureTest :
    FunSpec({
        val classes = ProjectArchitecture.importProductionClasses()

        HmsArchitectureRules.all().forEach { rule ->
            test(rule.description) { rule.check(classes) }
        }
    })
