package hms.kernel.time

import hms.kernel.archrules.HmsArchitectureRules
import hms.kernel.archrules.ProjectArchitecture
import io.kotest.core.spec.style.FunSpec

/** This project's production code obeys the shared HMS architecture rules (BUILD-PROMPT §6.8 #3; platform-kernel.md §4, §11). */
class ArchitectureTest :
    FunSpec({
        val classes = ProjectArchitecture.importProductionClasses()

        HmsArchitectureRules.all().forEach { rule ->
            test(rule.description) { rule.check(classes) }
        }
    })
