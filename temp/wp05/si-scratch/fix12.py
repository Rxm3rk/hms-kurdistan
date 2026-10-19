import io
def edit(p, pairs):
    s = open(p, encoding="utf-8").read()
    for a, b in pairs:
        assert a in s, (p, a)
        s = s.replace(a, b)
    open(p, "w", encoding="utf-8", newline="\n").write(s)
edit("AdtSpecLayer.kt", [
("""                        withClue("SI-12 clause a: the outcome of ${step.command} in ${step.from} never depends on payment facts ($finance)") {
                            EncounterMachine.fire(step.from, step.command, EncounterGuards, step.facts.copy(finance = finance)) shouldBe step.outcome""",
"""                        withClue("SI-12 clause a: ${step.command} in ${step.from} never depends on payment facts ($finance)") {
                            val refired = EncounterMachine.fire(step.from, step.command, EncounterGuards, step.facts.copy(finance = finance))
                            refired shouldBe step.outcome"""),
("""                EncounterProperty({ step -> step.fired?.effects?.any { it in allocating } == true }, { t -> t.effects.any { it in allocating } }) { step ->""",
"""                EncounterProperty(
                    { step -> step.fired?.effects?.any { it in allocating } == true },
                    { transition -> transition.effects.any { it in allocating } },
                ) { step ->"""),
])
edit("OrderSpecLayer.kt", [
("""withClue("SI-15 clause a: an order signed in an offline mode holds notOfflineWithoutFullCds; an unknown mode never signs") {""",
"""withClue("SI-15 clause a: signed offline only with notOfflineWithoutFullCds; never in an unknown mode") {"""),
])
edit("ResultSpecLayer.kt", [
("""                ResultProperty({ filed(it) && PATIENT_DISCHARGED in it.holding }, { ROUTE_TO_DISCHARGED_PATIENT_QUEUE in it.effects }) { step ->""",
"""                ResultProperty(
                    { filed(it) && PATIENT_DISCHARGED in it.holding },
                    { ROUTE_TO_DISCHARGED_PATIENT_QUEUE in it.effects },
                ) { step ->"""),
("""                    { autoverify(it) && it.from == ResultState.REGISTERED && it.facts.autoverification.tenantFlagOn && !registerPermits(it) },""",
"""                    { autoverify(it) && it.from == ResultState.REGISTERED && flagWithoutRegister(it) },"""),
("""    private val properties: Map<String, ResultProperty> =""",
"""    private fun flagWithoutRegister(step: ResultStep): Boolean = step.facts.autoverification.tenantFlagOn && !registerPermits(step)

    private val properties: Map<String, ResultProperty> ="""),
])
edit("SpecimenAppointmentSpecLayer.kt", [
("""withClue("SI-01 clauses a, d: a specimen is labelled or collected only after a wristband scan match or an active two-identifier check") {""",
"""withClue("SI-01 clauses a, d: labelled or collected only after a wristband match or an active two-identifier check") {"""),
("""withClue("SI-01 clause b: no printed label holds a room or bed as an identifier, and no identity check rests on a location") {""",
"""withClue("SI-01 clause b: no label identifier slot holds a room or bed; no identity check rests on a location") {"""),
("""withClue("SI-11 clause a (sample part): a pre-transfusion sample is never labelled or collected without a wristband scan match") {""",
"""withClue("SI-11 clause a (sample): a pre-transfusion sample is never labelled or collected without a wristband match") {"""),
])
