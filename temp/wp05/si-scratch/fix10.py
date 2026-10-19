p = "MedicationAdministrationSpecLayer.kt"
s = open(p, encoding="utf-8").read()
def rep(a, b):
    global s
    assert a in s, a
    s = s.replace(a, b)
rep("""/**
 * One specification-layer property of the medication-administration machine.
 *
 * @property appliesTo The steps the property speaks about.
 * @property about The transitions it is about; each must fire in the run.
 * @property check The assertion on each step it applies to.
 */
private class MarProperty(
    val appliesTo: (MarStep) -> Boolean,
    val about: (MarTransition) -> Boolean,
    val check: (MarStep) -> Unit,
)

""", """private typealias MarProperty = SpecLayerCheck<
    MedicationAdministrationState,
    MedicationAdministrationCommand,
    MedicationAdministrationPredicate,
    MedicationAdministrationEffect,
    MedicationAdministrationFacts,
>

""")
rep("""internal object MedicationAdministrationSpecLayer {
    const val MACHINE: String = MedicationAdministrationMachine.MACHINE

""", """internal object MedicationAdministrationSpecLayer {
""")
rep("""    /** Runs [property] (a hazard-log name) and returns the sequences run. */
    fun run(property: String): Int {
        val definition = properties[property] ?: throw IllegalArgumentException("$MACHINE has no specification-layer property $property")
        return specLayerRun(
            name = "$property ($MACHINE)",
            spec = MedicationAdministrationMachine.spec,
            holds = { predicate, facts -> MedicationAdministrationMachine.holds(predicate, MedicationAdministrationGuards, facts) },
            facts = MedicationAdministrationArbs.facts,
            check = StepCheck(property, definition.appliesTo, definition.check),
            requireFired = definition.about,
        )
    }

""", "")
rep("""    private val properties: Map<String, MarProperty> =
        mapOf(""", """    /** The properties, by hazard-log name. */
    val layer by lazy {
        MachineSpecLayer(
            spec = MedicationAdministrationMachine.spec,
            holds = { predicate, facts -> MedicationAdministrationMachine.holds(predicate, MedicationAdministrationGuards, facts) },
            facts = MedicationAdministrationArbs.facts,
            properties = properties,
        )
    }

    private val properties: Map<String, MarProperty> =
        mapOf(""")
rep("import hms.kernel.testing.statemachine.StepCheck\n", "")
rep("                MarProperty(", "                MarProperty(")
open(p, "w", encoding="utf-8", newline="\n").write(s)
