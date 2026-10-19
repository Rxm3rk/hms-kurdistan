import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep("""            appealDeadline = random.pick(listOf(null, null, NOW.plus(Duration.ofDays(30)), NOW.plus(Duration.ofDays(30)), NOW, NOW.minusSeconds(1))),""",
    """            appealDeadline = random.pick(deadlines),""")
rep("""    private fun encounterStatus(random: Random): EncounterStatus? =""",
    """    private val deadlines = listOf(null, null, NOW.plus(Duration.ofDays(30)), NOW.plus(Duration.ofDays(30)), NOW, NOW.minusSeconds(1))

    private fun encounterStatus(random: Random): EncounterStatus? =""")
rep("""        listOf(goodAppeal.copy(templateId = null), goodAppeal.copy(appealedItems = emptySet()), goodAppeal.copy(amountAppealed = null), null)""",
    """        listOf(
            goodAppeal.copy(templateId = null),
            goodAppeal.copy(appealedItems = emptySet()),
            goodAppeal.copy(amountAppealed = null),
            null,
        )""")
rep("""        listOf(WithdrawalFacts(WITHDRAWAL, ReasonOrigin.DEFAULTED), WithdrawalFacts("SYN-WDR-X", ReasonOrigin.USER), WithdrawalFacts(null, null), null)""",
    """        listOf(
            WithdrawalFacts(WITHDRAWAL, ReasonOrigin.DEFAULTED),
            WithdrawalFacts("SYN-WDR-X", ReasonOrigin.USER),
            WithdrawalFacts(null, null),
            null,
        )""")
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
