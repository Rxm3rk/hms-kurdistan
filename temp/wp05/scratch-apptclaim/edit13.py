import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:100], s.count(old))
    s = s.replace(old, new)


rep("""private fun AppointmentFacts.oracleGraceElapsed(): Boolean {
    val end = appointmentSlot?.end ?: return false
    val grace = config.noShowGrace?.takeUnless { it.isNegative } ?: Duration.ZERO
    return now >= end.plus(grace)
}""", """private val AppointmentFacts.oracleGraceElapsed: Boolean
    get() {
        val end = appointmentSlot?.end ?: return false
        val grace = config.noShowGrace?.takeUnless { it.isNegative } ?: Duration.ZERO
        return now >= end.plus(grace)
    }""")
rep("""private fun AppointmentFacts.oracleLate(): Boolean {
    val window = config.lateCancelWindow?.takeUnless { it.isNegative } ?: Duration.ZERO
    val start: Instant = appointmentSlot?.start ?: return false
    return window > Duration.ZERO && now >= start.minus(window)
}""", """private val AppointmentFacts.oracleLate: Boolean
    get() {
        val window = config.lateCancelWindow?.takeUnless { it.isNegative } ?: Duration.ZERO
        val start: Instant = appointmentSlot?.start ?: return false
        return window > Duration.ZERO && now >= start.minus(window)
    }""")
rep("""private fun AppointmentFacts.oracleIdentified(): Boolean =
    checkIn?.let""", """private val AppointmentFacts.oracleIdentified: Boolean
    get() = checkIn?.let""")
rep(".oracleIdentified()", ".oracleIdentified", 2)
rep(".oracleGraceElapsed()", ".oracleGraceElapsed")
rep(".oracleLate()", ".oracleLate")
rep("""/** Splits "Owner.someFieldName:Type" or "Enum.SOME_CONSTANT" into lowercase words. */
private fun words(entry: String): List<String> =
    entry
        .split('.', ':', '_')
        .flatMap { it.split(Regex("(?<=[a-z0-9])(?=[A-Z])")) }
        .map { it.lowercase() }
        .filter { it.isNotEmpty() }

private fun financial(entry: String): Boolean =
    words(entry).any { word -> word in FINANCIAL_WORDS || FINANCIAL_PREFIXES.any { word.startsWith(it) } }
""", """private val CAMEL_BOUNDARY = Regex("(?<=[a-z0-9])(?=[A-Z])")

/** "Owner.someFieldName:Type" or "Enum.SOME_CONSTANT" contains a financial word (its camelCase and SNAKE_CASE parts). */
private fun financial(entry: String): Boolean =
    entry
        .split('.', ':', '_')
        .flatMap { it.split(CAMEL_BOUNDARY) }
        .map { it.lowercase() }
        .any { word -> word in FINANCIAL_WORDS || FINANCIAL_PREFIXES.any { word.startsWith(it) } }
""")
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line))
print("functions:", sum(1 for l in s.splitlines() if l.startswith("private fun ") or l.startswith("fun ")))
