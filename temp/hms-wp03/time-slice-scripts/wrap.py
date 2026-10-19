import sys

ROOT = sys.argv[1]


def rep(p, pairs):
    path = ROOT + "/" + p
    s = open(path, encoding="utf-8").read()
    for a, b in pairs:
        assert a in s, (p, a)
        s = s.replace(a, b)
    open(path, "w", encoding="utf-8", newline="\n").write(s)


T = "test/kotlin/hms/kernel/time/"
P = "propertyTest/kotlin/hms/kernel/time/"
rep(T + "BusinessCalendarTest.kt", [
    ("            cal.businessDaysBetween(LocalDate.of(2026, 1, 1), LocalDate.of(2027, 1, 1)).value shouldBe 261 - 1 // the synthetic 21 March 2026 is a Saturday",
     "            // 261 weekdays in 2026; the synthetic 21 March 2026 is a Saturday, so only the Tuesday counts.\n            cal.businessDaysBetween(LocalDate.of(2026, 1, 1), LocalDate.of(2027, 1, 1)).value shouldBe 261 - 1"),
    ("            BusinessCalendar.of(zone, DayOfWeek.entries.toSet(), emptySet(), setOf(y2026)) shouldBe BusinessCalendarResult.NoBusinessDayInWeek",
     "            BusinessCalendar.of(zone, DayOfWeek.entries.toSet(), emptySet(), setOf(y2026)) shouldBe\n                BusinessCalendarResult.NoBusinessDayInWeek"),
])
rep(T + "EntryTimeClassifierTest.kt", [
    ('test("kernel-entry-timing-table row 1: a retroactive EFFECTIVE start is BackDated(EFFECTIVE_DATE) in every mode, without a policy")',
     'test("kernel-entry-timing-table row 1: a retroactive EFFECTIVE start is BackDated(EFFECTIVE_DATE) in every mode")'),
    ("            classify(input, CLINICAL_AT_RECORDING, USER) shouldBe accepted(EntryTiming.BackDated(late, ClinicalTimeSource.ENTERED), input, true)",
     "            classify(input, CLINICAL_AT_RECORDING, USER) shouldBe\n                accepted(EntryTiming.BackDated(late, ClinicalTimeSource.ENTERED), input, true)"),
    ("            EntryTiming.BackEntry(micro, episodeId).let { (it.code to it.source) shouldBe (EntryTimingCode.BACK_ENTRY to ClinicalTimeSource.ENTERED) }\n            EntryTiming.OfflineCapture(micro).let { (it.code to it.source) shouldBe (EntryTimingCode.OFFLINE_CAPTURE to ClinicalTimeSource.ENTERED) }",
     "            EntryTiming.BackEntry(micro, episodeId).let { it.code to it.source } shouldBe\n                (EntryTimingCode.BACK_ENTRY to ClinicalTimeSource.ENTERED)\n            EntryTiming.OfflineCapture(micro).let { it.code to it.source } shouldBe\n                (EntryTimingCode.OFFLINE_CAPTURE to ClinicalTimeSource.ENTERED)"),
    ("            val inputs = listOf(lagged(Duration.ZERO), lagged(Duration.ofHours(1)), lagged(Duration.ofMinutes(-1)), ValidTimeInput.AtRecording)",
     "            val inputs =\n                listOf(lagged(Duration.ZERO), lagged(Duration.ofHours(1)), lagged(Duration.ofMinutes(-1)), ValidTimeInput.AtRecording)"),
])
rep(T + "EntryTimePolicyTest.kt", [
    ("            listOf(policy.contemporaneousTolerance, policy.futureTolerance, policy.interfaceLatenessTolerance, policy.offlineCaptureTolerance) shouldBe\n                values",
     "            val built = listOf(policy.contemporaneousTolerance, policy.futureTolerance, policy.interfaceLatenessTolerance, policy.offlineCaptureTolerance)\n            built shouldBe values"),
    ('test("synthetic-safety-parameters-refused-in-train-and-prod: EntryTimePolicy.fromResolved refuses synthetic values in TRAIN and PROD")',
     'test("synthetic-safety-parameters-refused-in-train-and-prod: EntryTimePolicy refuses synthetic values in TRAIN and PROD")'),
    ("            TimeFixtures.build(wrongAndNegative, environment = EnvironmentClass.PROD).shouldBeInstanceOf<SafetyParameterResult.Refused>().reason shouldBe\n                SafetyParameterRefusal.KEY_MISMATCH",
     "            val refusal = TimeFixtures.build(wrongAndNegative, environment = EnvironmentClass.PROD)\n            refusal.shouldBeInstanceOf<SafetyParameterResult.Refused>().reason shouldBe SafetyParameterRefusal.KEY_MISMATCH"),
    ("            ).forEach { attempt -> shouldThrow<InvocationTargetException> { attempt() }.cause.shouldBeInstanceOf<IllegalArgumentException>() }",
     "            ).forEach { attempt ->\n                shouldThrow<InvocationTargetException> { attempt() }.cause.shouldBeInstanceOf<IllegalArgumentException>()\n            }"),
])
rep(T + "RecordedTimeTest.kt", [
    ('            val constructor = RecordedTime::class.java.getDeclaredMethod("constructor-impl", Instant::class.java).apply { isAccessible = true }\n            shouldThrow<InvocationTargetException> { constructor.invoke(null, instant) }.cause.shouldBeInstanceOf<IllegalArgumentException>()',
     '            val constructor = RecordedTime::class.java.getDeclaredMethod("constructor-impl", Instant::class.java)\n            constructor.isAccessible = true\n            val thrown = shouldThrow<InvocationTargetException> { constructor.invoke(null, instant) }\n            thrown.cause.shouldBeInstanceOf<IllegalArgumentException>()'),
])
rep(P + "BusinessCalendarPropertyTest.kt", [
    ("                calendar.isBusinessDay(start) shouldBe CalendarAnswer(calendar.naiveIsBusiness(start), calendar.naiveUncovered(start, start))",
     "                calendar.isBusinessDay(start) shouldBe\n                    CalendarAnswer(calendar.naiveIsBusiness(start), calendar.naiveUncovered(start, start))"),
    ("                shouldThrow<IllegalArgumentException> { calendar.plusBusinessDaysAtLocalTime(start.atStartOfDay(zone).toInstant(), negative) }",
     "                val midnight = start.atStartOfDay(zone).toInstant()\n                shouldThrow<IllegalArgumentException> { calendar.plusBusinessDaysAtLocalTime(midnight, negative) }"),
    ("            val starts = arbitrary { Instant.ofEpochSecond(Arb.long(1_672_531_200L..1_924_992_000L).bind(), Arb.long(0L..999_999_999L).bind()) }",
     "            // 2023-01-01 to 2031-01-01.\n            val starts =\n                arbitrary { Instant.ofEpochSecond(Arb.long(1_672_531_200L..1_924_992_000L).bind(), Arb.long(0L..999_999_999L).bind()) }"),
])
rep(P + "EntryTimeClassifierPropertyTest.kt", [
    ("        Row(8, POLICY_MODES, InputMatch.GIVEN, CLINICAL, { it.laterThan(it.policy.futureTolerance) }, refuse(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)),\n        Row(9, setOf(BACK_ENTRY, MIGRATION), InputMatch.GIVEN, CLINICAL, { it.laterThan(Duration.ZERO) }, refuse(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)),",
     "        Row(8, POLICY_MODES, InputMatch.GIVEN, CLINICAL, { it.laterThan(it.policy.futureTolerance) }, refuse(FUTURE)),\n        Row(9, setOf(BACK_ENTRY, MIGRATION), InputMatch.GIVEN, CLINICAL, { it.laterThan(Duration.ZERO) }, refuse(FUTURE)),"),
    ("        Row(19, setOf(MIGRATION), InputMatch.GIVEN, ANY_KIND, { !it.laterThan(Duration.ZERO) }, accept(false) { EntryTiming.Migrated(it.lag) }),",
     "        Row(19, setOf(MIGRATION), InputMatch.GIVEN, ANY_KIND, { !it.laterThan(Duration.ZERO) }, accept(false) {\n            EntryTiming.Migrated(it.lag)\n        }),"),
    ("private val POLICY_MODES = setOf(USER, OFFLINE_CAPTURE, DEVICE, INTERFACE)\n",
     "private val POLICY_MODES = setOf(USER, OFFLINE_CAPTURE, DEVICE, INTERFACE)\nprivate val FUTURE = EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE\n"),
    ("                    Instant.ofEpochSecond(Arb.long(MIN_RECORDED_SECOND..MAX_RECORDED_SECOND).bind(), Arb.long(0L..MAX_MICRO).bind() * 1_000),",
     "                    Instant.ofEpochSecond(\n                        Arb.long(MIN_RECORDED_SECOND..MAX_RECORDED_SECOND).bind(),\n                        Arb.long(0L..MAX_MICRO).bind() * 1_000,\n                    ),"),
    ("""            val episode =
                when (Arb.int(0..5).bind()) {
                    0 -> null
                    1 -> TimeFixtures.episode(start.instant.minus(before), start.instant.plus(after), id)
                    2 -> TimeFixtures.episode(start.instant.minus(before), null, id)
                    3 -> TimeFixtures.episode(start.instant.minus(before).minus(after), start.instant.minus(before).plus(nudges.bind()).plus(MICRO), id)
                    4 -> TimeFixtures.episode(start.instant.plus(nudges.bind()).plus(MICRO), start.instant.plus(after).plus(MICRO).plus(MICRO), id)
                    else -> TimeFixtures.episode(start.instant, start.instant.plus(after), id)
                }""", """            val s = start.instant
            val episode =
                when (Arb.int(0..5).bind()) {
                    0 -> null
                    1 -> TimeFixtures.episode(s.minus(before), s.plus(after), id)
                    2 -> TimeFixtures.episode(s.minus(before), null, id)
                    // Ends at, just before or just after the start.
                    3 -> TimeFixtures.episode(s.minus(before).minus(after), s.minus(before).plus(nudges.bind()).plus(MICRO), id)
                    // Starts at, or just after the start.
                    4 -> TimeFixtures.episode(s.plus(nudges.bind()).plus(MICRO), s.plus(after).plus(MICRO).plus(MICRO), id)
                    else -> TimeFixtures.episode(s, s.plus(after), id)
                }"""),
    ('test("kernel-entry-timing-back-dated-requirements: every USER entry later than the tolerance is BackDated with its four requirements")',
     'test("kernel-entry-timing-back-dated-requirements: every USER entry beyond the tolerance is BackDated with four requirements")'),
    ('test("kernel-entry-timing-back-entry-keeps-clinical-time: BackEntry keeps the given time; refused without an episode or outside it")',
     'test("kernel-entry-timing-back-entry-keeps-clinical-time: kept; refused without an episode or outside its window")'),
    ("                    val reason = if (case.mode == SYSTEM) EntryTimeRefusal.SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME else EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE",
     "                    val reason = if (case.mode == SYSTEM) EntryTimeRefusal.SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME else FUTURE"),
    ('test("kernel-entry-timing-interface-late-arrival: device and interface within lateness are Contemporaneous, beyond it LateArrival")',
     'test("kernel-entry-timing-interface-late-arrival: within lateness Contemporaneous with the channel source, beyond it LateArrival")'),
    ("                            setOf(TimingRequirement.CHANNEL_IDENTITY, TimingRequirement.AUDIT_BOTH_TIMES, TimingRequirement.LABEL_ON_DISPLAY_PRINT_EXPORT)",
     "                            setOf(\n                                TimingRequirement.CHANNEL_IDENTITY,\n                                TimingRequirement.AUDIT_BOTH_TIMES,\n                                TimingRequirement.LABEL_ON_DISPLAY_PRINT_EXPORT,\n                            )"),
    ('test("kernel-at-recording-only-where-declared: AtRecording only for declared kinds and online USER or SYSTEM; stamped with the recorded time")',
     'test("kernel-at-recording-only-where-declared: only for declared kinds and USER or SYSTEM; stamped with the recorded time")'),
])
rep(P + "TimeAxesPropertyTest.kt", [
    ("                    first to (ValidPeriod.of(first.start.plusNanos(shift), first.start.plusNanos(shift + NEAR_PERIOD_NANOS)) as ValidPeriodResult.Valid).period",
     "                    val second = ValidPeriod.of(first.start.plusNanos(shift), first.start.plusNanos(shift + NEAR_PERIOD_NANOS))\n                    first to (second as ValidPeriodResult.Valid).period"),
])
print("ok")
