package hms.adt.domain.toylight

data class ToyLightFacts(val mainsOn: Boolean, val generatorOn: Boolean, val inspectionPassed: Boolean, val privileged: Boolean, val audited: Boolean)

object ToyLightGuards : ToyLightPredicates {
    override fun powerAvailable(facts: ToyLightFacts): Boolean = facts.mainsOn || facts.generatorOn
    override fun lampIntact(facts: ToyLightFacts): Boolean = facts.inspectionPassed
    override fun privilegedAndAudited(facts: ToyLightFacts): Boolean = facts.privileged && facts.audited
}

fun main() {
    val facts = ToyLightFacts(true, false, true, false, false)
    println(ToyLightMachine.fire(ToyLightState.OFF, ToyLightCommand.SwitchOn, ToyLightGuards, facts))
    println(ToyLightMachine.fire(ToyLightState.RETIRED, ToyLightCommand.Reinstate, ToyLightGuards, facts))
    println(ToyLightMachine.spec.transitions.map { it.proposed })
    println(ToyLightEffect.LOGS_SWITCH.description)
}
