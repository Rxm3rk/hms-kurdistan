package hms.kernel.archrules

import com.tngtech.archunit.core.domain.AccessTarget.CodeUnitAccessTarget
import com.tngtech.archunit.core.domain.JavaClass
import com.tngtech.archunit.lang.ArchCondition
import com.tngtech.archunit.lang.ArchRule
import com.tngtech.archunit.lang.ConditionEvents
import com.tngtech.archunit.lang.SimpleConditionEvent
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes

/**
 * A family of restricted kernel functions (platform-kernel.md §3, §11), matched by name so that arch-rules
 * does not depend on the kernel projects.
 *
 * A function belongs to the family when its resolved member carries the opt-in [annotation] (a fully
 * qualified name), or, as a fallback when the member cannot be resolved, when its owner and name are in
 * [namedMembers] (`<owner>#<name>`). Both the `@JvmStatic` method and the `Companion` method match: the
 * Kotlin compiler copies the annotation to both, and the name fallback ignores a trailing `$Companion`.
 * Kotlin mangles the name of a function that takes or returns a value class (`restore-isIDzeE`); the
 * part after the hyphen, and a `$default` suffix, are ignored.
 */
internal class RestrictedFunctions(
    val annotation: String,
    val namedMembers: Set<String>,
) {
    /** True when [target] is one of these functions. */
    fun matches(target: CodeUnitAccessTarget): Boolean {
        val annotated = target.resolveMember().map { it.isAnnotatedWith(annotation) }.orElse(false)
        return annotated || memberKey(target) in namedMembers
    }

    companion object {
        /** `<owner>#<name>` of [target], with the companion, mangling and default-argument suffixes removed. */
        fun memberKey(target: CodeUnitAccessTarget): String {
            val owner = target.owner.name.removeSuffix("\$Companion")
            val name = target.name.substringBefore('-').removeSuffix("\$default")
            return "$owner#$name"
        }
    }
}

/**
 * Calls and method references to [functions] are allowed only from the packages that [allowListOf] gives for
 * the called function (resolved ArchUnit patterns). Calls from inside the declaring class (its companion
 * and the `@JvmStatic` bridge) are allowed, because the restriction is on other callers.
 */
internal class CallOnlyFromAllowList(
    private val label: String,
    private val functions: RestrictedFunctions,
    private val allowListOf: (CodeUnitAccessTarget) -> List<String>,
) : ArchCondition<JavaClass>("call $label functions only from their allow-list") {
    override fun check(
        item: JavaClass,
        events: ConditionEvents,
    ) {
        for (access in item.codeUnitAccessesFromSelf) {
            val target = access.target
            val restricted = functions.matches(target) && outermost(item) != outermost(target.owner)
            val allowed = if (restricted) allowListOf(target) else emptyList()
            if (restricted && !KernelPackages.matchesAny(item.packageName, allowed)) {
                val message = "${access.description} calls a $label function from outside its allow-list $allowed"
                events.add(SimpleConditionEvent.violated(access, message))
            }
        }
    }

    private fun outermost(type: JavaClass): String = type.name.substringBefore('$')
}

/** A rule that applies [condition] to every class below [root], with [reason], allowing an empty subject set. */
internal fun restrictedCallRule(
    root: String,
    condition: CallOnlyFromAllowList,
    reason: String,
): ArchRule =
    classes()
        .that()
        .resideInAPackage("$root..")
        .should(condition)
        .because(reason)
        .allowEmptyShould(true)
