import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
APT = root / "backend/modules/scheduling/src/propertyTest/kotlin/hms/scheduling/domain/appointment/AppointmentPropertyTest.kt"
CLM = root / "backend/satellites/rcm/src/propertyTest/kotlin/hms/rcm/domain/creditclaim/CreditClaimPropertyTest.kt"
ARBS = root / "backend/modules/scheduling/src/testFixtures/kotlin/hms/scheduling/domain/appointment/AppointmentArbs.kt"

for p in (APT, CLM):
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"^(\s+)(indexesOf \{.*\})\.forEach \{ stats\.requireFired\(it\) \}$",
               lambda m: f"{m.group(1)}{m.group(2)}\n{m.group(1)}    .forEach {{ stats.requireFired(it) }}" if len(m.group(0)) > 140 else m.group(0),
               s, flags=re.M)
    p.write_text(s, encoding="utf-8", newline="\n")

s = ARBS.read_text(encoding="utf-8")
pairs = [
    ("""            earlyCheckInWindow = random.pick(listOf(minutes(EARLY_MINUTES), minutes(EARLY_MINUTES), minutes(EARLY_MINUTES), null, Duration.ZERO)),""",
     """            earlyCheckInWindow = random.pick(List(EARLY_WEIGHT) { minutes(EARLY_MINUTES) } + listOf(null, Duration.ZERO)),"""),
    ("""                status = random.pick(listOf(EncounterStatus.IN_PROGRESS, EncounterStatus.IN_PROGRESS, EncounterStatus.TRIAGED, EncounterStatus.FINISHED)),
                encounterClass = random.pick(listOf(EncounterClass.INPATIENT, EncounterClass.EMERGENCY, EncounterClass.EMERGENCY, EncounterClass.OUTPATIENT)),""",
     """                status = random.pick(encounterStates),
                encounterClass = random.pick(encounterClasses),"""),
    ("""    private fun patientEncounters(""", """    private val encounterStates =
        listOf(EncounterStatus.IN_PROGRESS, EncounterStatus.IN_PROGRESS, EncounterStatus.TRIAGED, EncounterStatus.FINISHED)
    private val encounterClasses =
        listOf(EncounterClass.INPATIENT, EncounterClass.EMERGENCY, EncounterClass.EMERGENCY, EncounterClass.OUTPATIENT)

    private fun patientEncounters("""),
    ("private const val DESK_WEIGHT = 5\n", "private const val DESK_WEIGHT = 5\nprivate const val EARLY_WEIGHT = 3\n"),
]
for old, new in pairs:
    assert s.count(old) == 1, old[:80]
    s = s.replace(old, new)
ARBS.write_text(s, encoding="utf-8", newline="\n")
for p in (APT, CLM, ARBS):
    for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
        if len(line) > 140:
            print(p.name, n, len(line), line.strip()[:100])
