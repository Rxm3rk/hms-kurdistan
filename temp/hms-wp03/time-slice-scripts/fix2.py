import sys

ROOT = sys.argv[1]


def rep(p, pairs):
    path = ROOT + "/" + p
    s = open(path, encoding="utf-8").read()
    for a, b in pairs:
        assert a in s, (p, a)
        s = s.replace(a, b)
    open(path, "w", encoding="utf-8", newline="\n").write(s)


M = "main/kotlin/hms/kernel/time/"
rep(M + "ClinicalTimeParser.kt", [
    ("""        val numbers = groups.subList(1, OFFSET_GROUP - 1).map { it.toInt() }
        val (year, month, day, hour, minute, second) = numbers
""", """        val numbers = groups.subList(1, FRACTION_GROUP).map { it.toInt() }
        val second = numbers[SECOND_INDEX]
"""),
    ("Field.Ok(LocalDateTime.of(LocalDate.of(year, month, day), LocalTime.of(hour, minute, second, nanos)))",
     "Field.Ok(LocalDateTime.of(localDate(numbers), LocalTime.of(numbers[HOUR_INDEX], numbers[MINUTE_INDEX], second, nanos)))"),
    ("            else -> offsetOf(match.groupValues[1], match.groupValues[2].toInt(), match.groupValues[3].toInt())",
     "            else -> {\n                val (sign, hours, minutes) = match.destructured\n                offsetOf(sign, hours.toInt(), minutes.toInt())\n            }"),
    ("    private operator fun <T> List<T>.component6(): T = this[5]\n",
     "    private fun localDate(numbers: List<Int>): LocalDate = LocalDate.of(numbers[0], numbers[1], numbers[DAY_INDEX])\n"),
    ("    private const val FRACTION_GROUP = 7\n",
     "    private const val DAY_INDEX = 2\n    private const val HOUR_INDEX = 3\n    private const val MINUTE_INDEX = 4\n    private const val SECOND_INDEX = 5\n    private const val FRACTION_GROUP = 7\n"),
])
s = open(ROOT + "/" + M + "EntryTimeClassifier.kt", encoding="utf-8").read()
s = s.replace("    private fun refused(reason: EntryTimeRefusal): EntryTimingResult = EntryTimingResult.Refused(reason)\n", "")
s = s.replace("refused(EntryTimeRefusal.", "EntryTimingResult.Refused(EntryTimeRefusal.")
open(ROOT + "/" + M + "EntryTimeClassifier.kt", "w", encoding="utf-8", newline="\n").write(s)

for d in ("test", "propertyTest"):
    rep(d + "/kotlin/hms/kernel/time/TimeFixtures.kt", [
        ("EntryTimePolicy.fromResolved(timingClass, parameters[0], parameters[1], parameters[2], parameters[3], environment)",
         "EntryTimePolicy.fromResolved(timingClass, parameters[0], parameters[1], parameters[2], parameters.last(), environment)"),
        ("        offset: ZoneOffset = ZoneOffset.ofHours(3),", "        offset: ZoneOffset = ZoneOffset.ofHours(FIXTURE_OFFSET_HOURS),"),
        ("    val VITAL_SIGN: TimingClass = TimingClass(\"vital-sign\")\n",
         "    val VITAL_SIGN: TimingClass = TimingClass(\"vital-sign\")\n\n    private const val FIXTURE_OFFSET_HOURS = 3\n"),
    ])
    s = open(ROOT + "/" + d + "/kotlin/hms/kernel/time/TimeFixtures.kt", encoding="utf-8").read()
    assert s.count("parameters.last()") == 1

rep("propertyTest/kotlin/hms/kernel/time/EntryTimeClassifierPropertyTest.kt", [
    ('// Generator weights and ranges are test data, not domain values.\n@file:Suppress("MagicNumber")',
     '// Generator weights and ranges are test data, not domain values; the case generator has one branch per input shape.\n@file:Suppress("MagicNumber", "CyclomaticComplexMethod")'),
])
print("ok")
