import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
start = s.index("        // ---- walkInSessionOpen\n")
end = s.index("        // ---- consultationCompleted")
s = s[:start] + '''        // ---- walkInSessionOpen
        test("walkInSessionOpen holds for a running walk-in session of the requested service") {
            guards.walkInSessionOpen(base) shouldBe true
        }
        test("walkInSessionOpen boundaries: holds at exactly the session start, fails at exactly its end") {
            val session = SessionFacts(SERVICE, PROVIDER, acceptsWalkIns = true, start = NOW, end = NOW.plus(minutes(60)))
            val ended = session.copy(start = NOW.minus(minutes(60)), end = NOW)
            guards.walkInSessionOpen(base.withWalkIn { copy(sessions = listOf(session)) }) shouldBe true
            guards.walkInSessionOpen(base.withWalkIn { copy(sessions = listOf(ended)) }) shouldBe false
        }
        test("walkInSessionOpen fails for a session that accepts no walk-ins, another service, or another requested provider") {
            guards.walkInSessionOpen(base.withWalkIn { copy(sessions = sessions.map { it.copy(acceptsWalkIns = false) }) }) shouldBe false
            guards.walkInSessionOpen(base.withWalkIn { copy(requestedService = "SYN-SVC-DERM") }) shouldBe false
            guards.walkInSessionOpen(base.withWalkIn { copy(requestedProvider = "SYN-PRV-02") }) shouldBe false
            guards.walkInSessionOpen(base.withWalkIn { copy(requestedProvider = PROVIDER) }) shouldBe true
        }
        test("walkInSessionOpen fails without a requested service or walk-in facts") {
            guards.walkInSessionOpen(base.withWalkIn { copy(requestedService = null) }) shouldBe false
            guards.walkInSessionOpen(base.copy(walkIn = null)) shouldBe false
        }

''' + s[end:]
s = s.replace(
    "private fun AppointmentFacts.withConfig(",
    "private fun AppointmentFacts.withWalkIn(transform: WalkInFacts.() -> WalkInFacts) = copy(walkIn = walkIn?.transform())\n\n"
    "private fun AppointmentFacts.withConfig(",
    1,
)
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line))
