p = "MedicationAdministrationSpecLayer.kt"
s = open(p, encoding="utf-8").read()
a = """private typealias MarStep =
    Step<MedicationAdministrationState, MedicationAdministrationCommand, MedicationAdministrationPredicate, MedicationAdministrationEffect, MedicationAdministrationFacts>
private typealias MarTransition =
    Transition<MedicationAdministrationState, MedicationAdministrationCommand, MedicationAdministrationPredicate, MedicationAdministrationEffect>"""
b = """private typealias MarStep = Step<
    MedicationAdministrationState,
    MedicationAdministrationCommand,
    MedicationAdministrationPredicate,
    MedicationAdministrationEffect,
    MedicationAdministrationFacts,
>
private typealias MarTransition = Transition<
    MedicationAdministrationState,
    MedicationAdministrationCommand,
    MedicationAdministrationPredicate,
    MedicationAdministrationEffect,
>"""
assert a in s
s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="\n").write(s)
