import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
def rep(a, b):
    global s
    assert a in s, a
    s = s.replace(a, b)
rep("""            plannedMatch != null -> withPlanned(plannedMatch.groupValues[1])""",
    """            plannedMatch != null -> copy(plannedPropertyTests = (plannedPropertyTests + plannedMatch.groupValues[1]).distinct())""")
rep("""    private fun HazardEntry.withPlanned(name: String): HazardEntry =
        if (name in plannedPropertyTests) this else copy(plannedPropertyTests = plannedPropertyTests + name)

""", "")
rep("""    private fun BacklogFeature.with(
        list: String,
        item: String,
    ): BacklogFeature = if (list == "hazards") copy(hazards = hazards + item) else copy(workPackages = workPackages + item)

""", "")
rep("""                line.startsWith("  - ") && list != null -> feature = feature?.with(list, line.removePrefix("  - ").trim())""",
    """                line.startsWith("  - ") && list == "hazards" -> feature = feature?.let { it.copy(hazards = it.hazards + line.drop(LIST_ITEM)) }
                line.startsWith("  - ") && list != null -> feature = feature?.let { it.copy(workPackages = it.workPackages + line.drop(LIST_ITEM)) }""")
rep("""    private const val KNOWN_ANOMALY_COLUMNS = 7""", """    private const val KNOWN_ANOMALY_COLUMNS = 7
    private const val LIST_ITEM = 4""")
open(p, "w", encoding="utf-8", newline="\n").write(s)
