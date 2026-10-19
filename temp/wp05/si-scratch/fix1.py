import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = """            val entry = current ?: continue
            current =
                when {
                    hazardInvariants.containsMatchIn(line) -> entry.copy(invariants = items(hazardInvariants.find(line)!!.groupValues[1]))
                    hazardClause.containsMatchIn(line) -> entry.copy(clauses = entry.clauses + hazardClause.find(line)!!.groupValues[1])
                    plannedPropertyTest.containsMatchIn(line) -> entry.withPlanned(plannedPropertyTest.find(line)!!.groupValues[1])
                    else -> entry
                }
"""
new = """            current = current?.read(line)
"""
assert old in s
s = s.replace(old, new)
old2 = """    private fun items(raw: String)"""
new2 = """    private fun HazardEntry.read(line: String): HazardEntry {
        hazardInvariants.find(line)?.let { return copy(invariants = items(it.groupValues[1])) }
        hazardClause.find(line)?.let { return copy(clauses = clauses + it.groupValues[1]) }
        plannedPropertyTest.find(line)?.let { return withPlanned(it.groupValues[1]) }
        return this
    }

    private fun items(raw: String)"""
s = s.replace(old2, new2)
s = s.replace("""    ): List<String> = lines.dropWhile { !it.startsWith(heading) }.drop(1).takeWhile { !it.startsWith(nextHeading) || it.startsWith("$nextHeading#") }""",
              """    ): List<String> = lines.dropWhile { !it.startsWith(heading) }.drop(1).takeWhile { !it.startsWith(nextHeading) }""")
s = s.replace('private val listKey = Regex("""^([a-z]+): \[(.*)]""")', 'private val listKey = Regex("""^([a-z]+): \[([^\]]*)]""")')
open(p, "w", encoding="utf-8", newline="\n").write(s)
