package hms.kernel.testing.statemachine

import io.kotest.core.spec.style.FunSpec

/**
 * P1 to P7 on the toy door at the property budget (docs/specs/modules/state-machines-and-invariants.md §3.3), in the
 * form a generated `<P>GeneratedPropertyTest` takes. It also times the harness: `-Phms.pbt.sequences=N`.
 */
class ToyDoorSequencePropertyTest :
    FunSpec({
        include(
            machineSequenceProperties(
                name = ToyDoor.spec.machine,
                spec = ToyDoor.spec,
                holds = ToyDoor::holds,
                facts = ToyDoor.facts,
            ),
        )
    })
