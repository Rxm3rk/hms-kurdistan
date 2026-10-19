import sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()
P = "MedicationAdministration"
TYPES4 = f"        {P}State,\n        {P}Command,\n        {P}Predicate,\n        {P}Effect,\n"
R = [
    ("MedicationAdriationGuards", "MedicationAdministrationGuards"),
    (
        f"    Step<{P}State, {P}Command, {P}Predicate, {P}Effect, {P}Facts>\n",
        f"    Step<\n{TYPES4}        {P}Facts,\n    >\n",
    ),
    (
        f"    StepCheck<{P}State, {P}Command, {P}Predicate, {P}Effect, {P}Facts>\n",
        f"    StepCheck<\n{TYPES4}        {P}Facts,\n    >\n",
    ),
    (
        f"    Transition<{P}State, {P}Command, {P}Predicate, {P}Effect>\n",
        f"    Transition<\n{TYPES4}    >\n",
    ),
    (
        f"    Outcome<{P}State, {P}Command, {P}Predicate, {P}Effect>\n",
        f"    Outcome<\n{TYPES4}    >\n",
    ),
    (
        "private const val BACK_ENTRY = 10\n",
        "private const val BACK_ENTRY = 10\nprivate const val COMPLETE = 13\nprivate const val STOP = 14\n",
    ),
    (
        "private val ADMINISTRATIONS = LIVE_ADMINISTRATIONS + RECORDS_AFTER_THE_FACT\n",
        "private val ADMINISTRATIONS = LIVE_ADMINISTRATIONS + RECORDS_AFTER_THE_FACT\n"
        "private val LIVE_GIVES = intArrayOf(GIVE, GIVE_SCAN_OVERRIDE, GIVE_VERIFICATION_OVERRIDE, GIVE_WRISTBAND_OVERRIDE)\n"
        "private val RECORD_OFFLINE = intArrayOf(RECORD_OFFLINE_GIVE, RECORD_OFFLINE_INFUSION)\n"
        "private val ORDER_ENDED = intArrayOf(ORDER_ENDED_SCHEDULED, ORDER_ENDED_RUNNING)\n"
        "private val RECORDED_AND_REVIEWED = listOf(REPORT_OVERRIDE, CREATE_ADMINISTRATION_REVIEW_TASK, EMIT_MEDICATION_ADMINISTERED)\n"
        "private val VERIFICATION_REPLACEMENT =\n"
        "    listOf(ORDER_AWAITING_VERIFICATION, EMERGENCY_OVERRIDE_LISTED, FIRST_DOSE_OF_ORDER, REASON_ON_VERIFICATION_OVERRIDE_LIST)\n",
    ),
    (
        "                    ORDER_ENDED_RUNNING to MedicationAdministrationCommand.OrderEnded,\n                )",
        "                    ORDER_ENDED_RUNNING to MedicationAdministrationCommand.OrderEnded,\n"
        "                    COMPLETE to Complete,\n                    STOP to Stop,\n                )",
    ),
    (
        "    val expired = scan.expiry != null && (date == null || scan.expiry!!.isBefore(date))\n",
        "    val expiry = scan.expiry\n    val expired = expiry != null && (date == null || expiry.isBefore(date))\n",
    ),
    (
        "                                ACTIVE_VERIFIED_ORDER ->\n"
        "                                    listOf(ORDER_AWAITING_VERIFICATION, EMERGENCY_OVERRIDE_LISTED, FIRST_DOSE_OF_ORDER, REASON_ON_VERIFICATION_OVERRIDE_LIST)\n",
        "                                ACTIVE_VERIFIED_ORDER -> VERIFICATION_REPLACEMENT\n",
    ),
    (
        "                        step.effects() shouldContainAll listOf(REPORT_OVERRIDE, CREATE_ADMINISTRATION_REVIEW_TASK, EMIT_MEDICATION_ADMINISTERED)\n"
        "                        if (step.command == BackEnterAdministration) {\n"
        "                            step.holding shouldContainAll listOf(PRIVILEGED_AND_AUDITED, BACK_ENTRY_DOCUMENTED, MANUAL_TWO_IDENTIFIERS_CONFIRMED)\n",
        "                        step.effects() shouldContainAll RECORDED_AND_REVIEWED\n"
        "                        if (step.command == BackEnterAdministration) {\n"
        "                            val backEntry = listOf(PRIVILEGED_AND_AUDITED, BACK_ENTRY_DOCUMENTED, MANUAL_TWO_IDENTIFIERS_CONFIRMED)\n"
        "                            step.holding shouldContainAll backEntry\n",
    ),
    ("            stats.requireFired(*ADMINISTRATIONS, 13, 14)\n", "            stats.requireFired(*ADMINISTRATIONS, COMPLETE, STOP)\n"),
    (
        '        test("SI-02 (medication-administration): every override and every record after the fact is reported (PropertyTest:SI-02-every-override-reportable)") {\n',
        '        test(\n            "SI-02 (medication-administration): every override and every record after the fact is reported " +\n'
        '                "(PropertyTest:SI-02-every-override-reportable)",\n        ) {\n',
    ),
    (
        '                    check("an override or a record after the fact emits reportOverride", appliesTo = { it.command in ADMINISTERING_COMMANDS && it.fired() != null }) { step ->\n',
        '                    check(\n                        "an override or a record after the fact emits reportOverride, and a live give does not",\n'
        '                        appliesTo = { it.command in ADMINISTERING_COMMANDS && it.fired() != null },\n                    ) { step ->\n',
    ),
    (
        '                        "an override\'s reason was chosen by the administering user, never defaulted (PropertyTest:SI-02-override-reason-never-defaulted)",\n',
        '                        "an override\'s reason was chosen by the administering user, never defaulted " +\n'
        '                            "(PropertyTest:SI-02-override-reason-never-defaulted)",\n',
    ),
    (
        '                    check("a wristband-failure override raises the wristband reprint task", appliesTo = { it.firedOneOf(WRISTBAND_OVERRIDES) }) { step ->\n'
        '                        step.effects() shouldContain CREATE_WRISTBAND_REPRINT_TASK\n'
        '                    },\n',
        '                    check(\n                        "a wristband-failure override raises the wristband reprint task",\n'
        '                        appliesTo = { it.firedOneOf(WRISTBAND_OVERRIDES) },\n'
        '                    ) { step -> step.effects() shouldContain CREATE_WRISTBAND_REPRINT_TASK },\n',
    ),
    (
        '        test("SI-02 (medication-administration): an identified mismatch blocks the product-scan override and a wrong-patient scan the wristband override") {\n',
        '        test(\n            "SI-02 (medication-administration): an identified product mismatch blocks the product-scan override, " +\n'
        '                "and a wrong-patient scan the wristband-failure override",\n        ) {\n',
    ),
    (
        "                            step.holding shouldContainAll listOf(ORDER_AWAITING_VERIFICATION, EMERGENCY_OVERRIDE_LISTED, FIRST_DOSE_OF_ORDER)\n",
        "                            step.holding shouldContainAll VERIFICATION_REPLACEMENT\n",
    ),
    (
        '                        "a live give of a fixed-dose order: the entered amount equals the ordered dose exactly in the same unit (raw facts)",\n'
        "                        appliesTo = { it.firedOneOf(intArrayOf(GIVE, GIVE_SCAN_OVERRIDE, GIVE_VERIFICATION_OVERRIDE, GIVE_WRISTBAND_OVERRIDE)) },\n",
        '                        "a live give: the entered amount equals the fixed ordered dose exactly, in the same unit (raw facts)",\n'
        "                        appliesTo = { it.firedOneOf(LIVE_GIVES) },\n",
    ),
    (
        "                        ordered shouldNotBe null\n"
        "                        entered?.unit shouldBe ordered?.unit\n"
        "                        entered?.value?.compareTo(ordered?.value) shouldBe 0\n",
        '                        withClue("entered $entered, ordered $ordered") {\n'
        "                            (ordered != null && entered != null && entered.unit == ordered.unit && entered.value.compareTo(ordered.value) == 0) shouldBe\n"
        "                                true\n"
        "                        }\n",
    ),
    (
        '                        "a live high-alert administration has an attested double check by another authenticated, privileged user (raw facts)",\n',
        '                        "a live high-alert administration has an attested check by another authenticated, privileged user (raw facts)",\n',
    ),
    (
        "                        step.effects() shouldContainAll listOf(REPORT_OVERRIDE, CREATE_ADMINISTRATION_REVIEW_TASK, EMIT_MEDICATION_ADMINISTERED)\n",
        "                        step.effects() shouldContainAll RECORDED_AND_REVIEWED\n",
    ),
    (
        "                        appliesTo = { it.firedOneOf(intArrayOf(RECORD_OFFLINE_GIVE, RECORD_OFFLINE_INFUSION)) },\n",
        "                        appliesTo = { it.firedOneOf(RECORD_OFFLINE) },\n",
    ),
    (
        '        test("SI-01 (medication-administration): a location label never identifies the patient (PropertyTest:SI-01-location-never-an-identifier)") {\n',
        '        test(\n            "SI-01 (medication-administration): a location label never identifies the patient " +\n'
        '                "(PropertyTest:SI-01-location-never-an-identifier)",\n        ) {\n',
    ),
    (
        "                        appliesTo = { step -> step.facts.scans.wristband.let { it != null && it.labelKind != LabelKind.PATIENT_WRISTBAND } },\n",
        "                        appliesTo = { step -> step.facts.scans.wristband?.let { it.labelKind != LabelKind.PATIENT_WRISTBAND } == true },\n",
    ),
    (
        "                        val keyed = manual?.keyedMrnIdentity?.patientId == facts.dose.patientId && manual?.keyedMrnIdentity?.currentForPatient == true\n",
        "                        val keyedIdentity = manual?.keyedMrnIdentity\n"
        "                        val keyed = keyedIdentity?.patientId == facts.dose.patientId && keyedIdentity?.currentForPatient == true\n",
    ),
    (
        '        test("SI-10 (medication-administration): back-dating is privileged and audited (PropertyTest:SI-10-back-dating-is-privileged-and-audited)") {\n',
        '        test(\n            "SI-10 (medication-administration): back-dating is privileged and audited " +\n'
        '                "(PropertyTest:SI-10-back-dating-is-privileged-and-audited)",\n        ) {\n',
    ),
    ("java.time.Duration.ZERO", "Duration.ZERO"),
    (
        '                        "a live administration of a patient-supplied item used its own relabel, naming this patient, administrable (raw facts)",\n',
        '                        "a patient-supplied item is given only through its own administrable relabel naming this patient (raw facts)",\n',
    ),
    (
        "                                dose.copy(dueTime = step.facts.context.receivedAt.minus(dose.lateDoseWindow).minusSeconds(1), flaggedLate = false),\n",
        "                                dose.copy(dueTime = windowStart.minusSeconds(1), flaggedLate = false),\n",
    ),
    (
        "                        val dose = step.facts.dose\n",
        "                        val dose = step.facts.dose\n                        val windowStart = step.facts.context.receivedAt.minus(dose.lateDoseWindow)\n",
    ),
    (
        "                                dose.copy(dueTime = step.facts.context.receivedAt.plus(dose.lateDoseWindow), flaggedLate = false),\n",
        "                                dose.copy(dueTime = windowStart, flaggedLate = false),\n",
    ),
    (
        "                        appliesTo = { it.from == MedicationAdministrationState.IN_PROGRESS && (it.command == Complete || it.command == Stop) },\n",
        "                        appliesTo = { it.from == MedicationAdministrationState.IN_PROGRESS && it.command in setOf(Complete, Stop) },\n",
    ),
    (
        "                        appliesTo = { it.firedOneOf(intArrayOf(ORDER_ENDED_SCHEDULED, ORDER_ENDED_RUNNING)) },\n",
        "                        appliesTo = { it.firedOneOf(ORDER_ENDED) },\n",
    ),
    (
        "            withClue(\"classes walked: ${classes.map { it.simpleName }}\") { classes.size shouldNotBe 1 }\n",
        "            classes shouldContainAll listOf(DoseFacts::class.java, ProductScan.Identified::class.java, DoubleCheck::class.java)\n",
    ),
    ("import java.time.LocalDate\n", "import java.time.Duration\nimport java.time.LocalDate\n"),
]
for a, b in R:
    if a not in s:
        print("MISSING:", a[:120])
        continue
    s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="\n").write(s)
