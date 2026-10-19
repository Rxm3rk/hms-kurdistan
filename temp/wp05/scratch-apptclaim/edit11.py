import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])


def edit(path, pairs, regex=False):
    p = root / path
    s = p.read_text(encoding="utf-8")
    for old, new in pairs:
        if regex:
            s, n = re.subn(old, new, s)
            assert n > 0, old
        else:
            assert s.count(old) == 1, old[:100]
            s = s.replace(old, new)
    p.write_text(s, encoding="utf-8", newline="\n")
    for n, line in enumerate(s.splitlines(), 1):
        if len(line) > 140:
            print(path, n, len(line))


APT = "backend/modules/scheduling/src/propertyTest/kotlin/hms/scheduling/domain/appointment/AppointmentPropertyTest.kt"
CLM = "backend/satellites/rcm/src/propertyTest/kotlin/hms/rcm/domain/creditclaim/CreditClaimPropertyTest.kt"

edit(APT, [(r"stats\.requireFired\(\*(.*)\)\n", r"\1.forEach { stats.requireFired(it) }\n")], regex=True)
edit(CLM, [(r"stats\.requireFired\(\*(.*)\)\n", r"\1.forEach { stats.requireFired(it) }\n")], regex=True)

edit(APT, [
    ("""/** SI-01 at check-in, re-read from the raw facts: stated name matched by empi; MRN valid and the patient's; DOB stated. */
private fun AppointmentFacts.oracleIdentified(): Boolean {
    val c = checkIn ?: return false
    val name = !c.statedName.isNullOrBlank() && c.nameSource == IdentifierSource.PATIENT_STATED && c.nameMatch == EmpiMatch.MATCH
    val searchFoundOnlyThisPatient = c.mrnSource == IdentifierSource.EMPI_SEARCH && c.empiSearchCandidates == listOf(patientId)
    val mrn =
        c.recordMrn != null &&
            c.presentedMrn == c.recordMrn &&
            c.mrnCheckDigitValid == true &&
            (c.mrnSource in PRESENTED_OR_STATED || searchFoundOnlyThisPatient)
    val dob =
        c.recordDob != null &&
            when (c.recordApproximateDob) {
                true -> c.statedApproximateAgeMatch == EmpiMatch.MATCH
                false -> c.statedDob != null && c.dobSource == IdentifierSource.PATIENT_STATED
                null -> false
            }
    return name && mrn && dob
}
""", """/** The stated name, matched by empi's cross-script answer. */
private val CheckInFacts.oracleName: Boolean
    get() = !statedName.isNullOrBlank() && nameSource == IdentifierSource.PATIENT_STATED && nameMatch == EmpiMatch.MATCH

/** The record's MRN with a valid check digit, from a card, a wristband, the patient, or a one-candidate empi search. */
private fun CheckInFacts.oracleMrn(patientId: String): Boolean {
    val searchFoundOnlyThisPatient = mrnSource == IdentifierSource.EMPI_SEARCH && empiSearchCandidates == listOf(patientId)
    return recordMrn != null &&
        presentedMrn == recordMrn &&
        mrnCheckDigitValid == true &&
        (mrnSource in PRESENTED_OR_STATED || searchFoundOnlyThisPatient)
}

/** The DOB the patient stated (at least its year equal to the record's), or empi's match of the stated approximate age. */
private val CheckInFacts.oracleDob: Boolean
    get() =
        recordDob != null &&
            when (recordApproximateDob) {
                true -> statedApproximateAgeMatch == EmpiMatch.MATCH
                false -> dobSource == IdentifierSource.PATIENT_STATED && statedDob?.year == recordDob.year
                null -> false
            }

/** SI-01 at check-in, re-read from the raw facts: stated name matched by empi; MRN valid and the patient's; DOB stated. */
private fun AppointmentFacts.oracleIdentified(): Boolean = checkIn?.let { it.oracleName && it.oracleMrn(patientId) && it.oracleDob } ?: false
"""),
    ("""private val FINANCIAL_WORDS =
    listOf(
        "pay",
        "deposit",
        "bill",
        "balance",
        "estimate",
        "approval",
        "coverage",
        "insur",
        "price",
        "charge",
        "tariff",
        "amount",
        "currency",
        "money",
        "cash",
        "invoice",
        "debt",
        "cost",
        "fee",
    )
""", """/** Whole words (camelCase and SNAKE_CASE parts, lowercased) that name a financial value. */
private val FINANCIAL_WORDS =
    setOf(
        "deposit",
        "deposits",
        "balance",
        "estimate",
        "approval",
        "preapproval",
        "coverage",
        "price",
        "charge",
        "charges",
        "tariff",
        "amount",
        "currency",
        "money",
        "cash",
        "invoice",
        "debt",
        "cost",
        "fee",
        "fees",
    )

/** Word prefixes that name a financial value (pay, payment, payer; bill, billing; insurer, insurance). */
private val FINANCIAL_PREFIXES = listOf("pay", "bill", "insur", "financ")

/** Splits "Owner.someFieldName:Type" or "Enum.SOME_CONSTANT" into lowercase words. */
private fun words(entry: String): List<String> =
    entry
        .split('.', ':', '_')
        .flatMap { it.split(Regex("(?<=[a-z0-9])(?=[A-Z])")) }
        .map { it.lowercase() }
        .filter { it.isNotEmpty() }

private fun financial(entry: String): Boolean =
    words(entry).any { word -> word in FINANCIAL_WORDS || FINANCIAL_PREFIXES.any { word.startsWith(it) } }
"""),
    ("""            vocabulary.filter { word -> FINANCIAL_WORDS.any { word.lowercase().contains(it) } }.shouldBeEmpty()""",
     """            vocabulary.filter(::financial).shouldBeEmpty()
            withClue("the word check itself recognises financial names") {
                listOf("Facts.depositAmount", "Facts.payerId", "Status.BILL_CLEARED").all(::financial) shouldBe true
                listOf("EncounterStatus.DISCHARGED_NOT_CLOSED", "Facts.pastOffers").none(::financial) shouldBe true
            }"""),
])

edit(CLM, [
    ("""                        effect.description shouldContain "desk"
                        effect.description shouldContain "never"
                        effect.description shouldContain "clinician\"""",
     """                        val text = effect.description.lowercase()
                        text shouldContain "desk"
                        text shouldContain "never"
                        text shouldContain "clinician\""""),
])

ARBS = "backend/modules/scheduling/src/testFixtures/kotlin/hms/scheduling/domain/appointment/AppointmentArbs.kt"
edit(ARBS, [
    ("private const val SOMETIMES = 0.25\n", ""),
    ("private const val RESPOND_WEIGHT = 4\n", "private const val RESPOND_WEIGHT = 6\n"),
    ("private const val LIKELY_ACCEPTED = 0.7\n", "private const val LIKELY_ACCEPTED = 0.85\n"),
    ("""    private val startOffsets = listOf(-150L, -150L, -45L, -15L, 0L, 10L, 30L, 60L, 1500L)""",
     """    private val startOffsets = listOf(-150L, -150L, -150L, -45L, -15L, 0L, 10L, 30L, 60L, 1500L)"""),
    ("""            earlyCheckInWindow = random.pick(listOf(minutes(EARLY_MINUTES), minutes(EARLY_MINUTES), null, Duration.ZERO)),""",
     """            earlyCheckInWindow = random.pick(listOf(minutes(EARLY_MINUTES), minutes(EARLY_MINUTES), minutes(EARLY_MINUTES), null, Duration.ZERO)),"""),
    ("""            LinkedEncounterFacts(EncounterStatus.ARRIVED, leftWithoutBeingSeen = null, consultationRecorded = true),
""", """            LinkedEncounterFacts(EncounterStatus.ARRIVED, leftWithoutBeingSeen = null, consultationRecorded = true),
            LinkedEncounterFacts(EncounterStatus.IN_PROGRESS, leftWithoutBeingSeen = null, consultationRecorded = true),
            LinkedEncounterFacts(EncounterStatus.ENTERED_IN_ERROR, leftWithoutBeingSeen = null, consultationRecorded = false),
"""),
    ("""                status = random.pick(listOf(EncounterStatus.IN_PROGRESS, EncounterStatus.TRIAGED, EncounterStatus.FINISHED)),
                encounterClass = random.pick(listOf(EncounterClass.INPATIENT, EncounterClass.EMERGENCY, EncounterClass.OUTPATIENT)),
                start = around.minus(Duration.ofHours(random.pick(listOf(1L, 48L)))),
                end = random.pick(listOf(null, around.minus(minutes(EARLY_MINUTES)))),""",
     """                status = random.pick(listOf(EncounterStatus.IN_PROGRESS, EncounterStatus.IN_PROGRESS, EncounterStatus.TRIAGED, EncounterStatus.FINISHED)),
                encounterClass = random.pick(listOf(EncounterClass.INPATIENT, EncounterClass.EMERGENCY, EncounterClass.EMERGENCY, EncounterClass.OUTPATIENT)),
                start = around.minus(Duration.ofHours(random.pick(listOf(1L, 48L)))),
                end = random.pick(listOf(null, null, around.minus(minutes(EARLY_MINUTES)))),"""),
])

edit("backend/satellites/rcm/src/testFixtures/kotlin/hms/rcm/domain/creditclaim/CreditClaimArbs.kt", [
    ("private const val DENIAL_GOOD = 0.3\n", "private const val DENIAL_GOOD = 0.4\n"),
])

TEST = "backend/modules/scheduling/src/test/kotlin/hms/scheduling/domain/appointment/AppointmentGuardsTest.kt"
edit(TEST, [("class AppointmentGuardsTest :\n",
             "// Rule 12 needs every predicate's tests in this one file, so the spec is long by design.\n"
             "@Suppress(\"LargeClass\")\nclass AppointmentGuardsTest :\n")])
print("ok")
