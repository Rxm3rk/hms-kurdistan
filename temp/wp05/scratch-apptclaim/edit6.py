import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep("""    override fun coverageActive(facts: CreditClaimFacts): Boolean {
        val date = facts.episode.startDate ?: return false
        val coverage = facts.coverage ?: return false
        val contractFrom = coverage.contractActiveFrom
        val contractTo = coverage.contractActiveTo
        val contract =
            !coverage.contractSuspended &&
                contractFrom != null &&
                !date.isBefore(contractFrom) &&
                (contractTo == null || !date.isAfter(contractTo))
        return contract && coverage.letterCaptured && within(date, coverage.letterValidFrom, coverage.letterValidTo)
    }
""", """    override fun coverageActive(facts: CreditClaimFacts): Boolean {
        val date = facts.episode.startDate
        val coverage = facts.coverage
        return date != null &&
            coverage != null &&
            contractActive(coverage, date) &&
            coverage.letterCaptured &&
            within(date, coverage.letterValidFrom, coverage.letterValidTo)
    }

    private fun contractActive(
        coverage: CoverageFacts,
        date: LocalDate,
    ): Boolean {
        val from = coverage.contractActiveFrom
        val to = coverage.contractActiveTo
        return !coverage.contractSuspended && from != null && !date.isBefore(from) && (to == null || !date.isAfter(to))
    }
""")
rep("""    /** adt reports the episode's encounter in discharged-not-closed or finished; unknown, cancelled or entered in error do not count. */""",
    """    /** adt reports the episode's encounter discharged-not-closed or finished; unknown, cancelled or entered in error do not count. */""")
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
