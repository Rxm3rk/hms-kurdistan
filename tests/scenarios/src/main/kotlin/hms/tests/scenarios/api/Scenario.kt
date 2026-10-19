package hms.tests.scenarios.api

/** The kind of a scenario step, in the given-when-then form. */
enum class StepKind(
    val keyword: String,
) {
    GIVEN("given"),
    WHEN("when"),
    THEN("then"),
}

/**
 * One step: its text, read in the pass matrix, and the function that performs it on the [ScenarioWorld].
 * A `then` step asserts (Kotest matchers or `check`), and an assertion error makes the scenario FAIL with its message.
 */
class ScenarioStep(
    val kind: StepKind,
    val text: String,
    val action: (ScenarioWorld) -> Unit,
) {
    init {
        require(text.isNotBlank()) { "a ${kind.keyword} step has no text" }
    }
}

/** A step that sets up the world. */
fun given(
    text: String,
    action: (ScenarioWorld) -> Unit,
): ScenarioStep = ScenarioStep(StepKind.GIVEN, text, action)

/** A step that issues the command or event under test. */
fun whenever(
    text: String,
    action: (ScenarioWorld) -> Unit,
): ScenarioStep = ScenarioStep(StepKind.WHEN, text, action)

/** A step that asserts the outcome. */
fun then(
    text: String,
    action: (ScenarioWorld) -> Unit,
): ScenarioStep = ScenarioStep(StepKind.THEN, text, action)

/**
 * An executable scenario, supplied by a [SuiteBinding]. Its [id] matches a [PlannedScenario] of the catalogue
 * (or is a new one, appended). A scenario with no `then` step asserts nothing and FAILS when run (fail closed).
 */
class Scenario(
    val id: String,
    val title: String,
    val steps: List<ScenarioStep>,
    /** Hazard-log entries the scenario serves; empty means the suite's hazards. */
    val hazards: List<String> = emptyList(),
) {
    init {
        require(ID.matches(id)) { "scenario id '$id' must read SCN-<area>-nnn" }
        require(title.isNotBlank()) { "scenario $id has no title" }
        hazards.forEach { require(ScenarioSuite.HAZARD.matches(it)) { "scenario $id: '$it' is not a hazard id" } }
    }

    companion object {
        internal val ID = Regex("SCN-[a-z0-9]+(-[a-z0-9]+)*-\\d{3}")
        private const val MAX_NUMBER = 999
        private const val DIGITS = 3

        /** `SCN-<area>-nnn` for the [number]th scenario of a suite. */
        fun idOf(
            area: String,
            number: Int,
        ): String {
            require(number in 1..MAX_NUMBER) { "scenario number $number is outside 1..$MAX_NUMBER" }
            return "${ScenarioSuite.ID_PREFIX}$area-${number.toString().padStart(DIGITS, '0')}"
        }
    }
}
