package hms.kernel.ids

import hms.kernel.archrules.HmsArchitectureRules
import hms.kernel.archrules.ProjectArchitecture
import io.kotest.core.spec.style.FunSpec

/**
 * This project's production code obeys the shared HMS architecture rules: (a) to (e) and the kernel rules of
 * platform-kernel.md §11, which [HmsArchitectureRules.all] includes (BUILD-PROMPT §6.8 #3; platform-kernel.md §4).
 */
class ArchitectureTest :
    FunSpec({
        val classes = ProjectArchitecture.importProductionClasses()

        HmsArchitectureRules.all().forEach { rule ->
            test(rule.description) { rule.check(classes) }
        }
    })
