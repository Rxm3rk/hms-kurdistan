import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep("""            reason = random.pick(listOf(PendingReason.WAITLIST_OFFER, PendingReason.AWAITING_ACCEPTANCE, PendingReason.AWAITING_ACCEPTANCE, null)),
""", """            reason = random.pick(holdReasons),
""")
rep("""    private fun hold(random: Random): HoldFacts =""", """    private val holdReasons = listOf(PendingReason.WAITLIST_OFFER, PendingReason.AWAITING_ACCEPTANCE, PendingReason.AWAITING_ACCEPTANCE, null)

    private fun hold(random: Random): HoldFacts =""")
rep("""    private fun linkedEncounter(random: Random): LinkedEncounterFacts? = if (random.chance(USUALLY)) random.pick(encounterVariants) else null
""", """    private fun linkedEncounter(random: Random): LinkedEncounterFacts? =
        if (random.chance(USUALLY)) random.pick(encounterVariants) else null
""")
rep("""            channel = random.pick(listOf(EntryChannel.DESK_USER, EntryChannel.DESK_USER, EntryChannel.DESK_USER, EntryChannel.FRONT_DOOR_LINK, null)),
""", """            channel = random.pick(channels),
""")
rep("""    private fun cancellation(random: Random): CancellationFacts {""", """    private val channels = listOf(EntryChannel.DESK_USER, EntryChannel.DESK_USER, EntryChannel.DESK_USER, EntryChannel.FRONT_DOOR_LINK, null)

    private fun cancellation(random: Random): CancellationFacts {""")
rep("""            command = random.pick(listOf(AppointmentCommand.UndoCheckIn, AppointmentCommand.ReverseNoShow, AppointmentCommand.MarkEnteredInError, null)),
""", """            command = random.pick(correctionCommands),
""")
rep("""    private fun correction(random: Random): CorrectionFacts =""", """    private val correctionCommands =
        listOf(AppointmentCommand.UndoCheckIn, AppointmentCommand.ReverseNoShow, AppointmentCommand.MarkEnteredInError, null)

    private fun correction(random: Random): CorrectionFacts =""")
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
