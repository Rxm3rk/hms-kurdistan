import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep("""    private val startOffsets = listOf(-150L, -45L, -15L, 0L, 10L, 30L, 60L, 1500L)""",
    """    private val startOffsets = listOf(-150L, -150L, -45L, -15L, 0L, 10L, 30L, 60L, 1500L)""")
rep("""        val status = random.pick(SlotStatus.entries + listOf(SlotStatus.FREE, SlotStatus.FREE, SlotStatus.FREE, SlotStatus.FREE))
        val start = if (random.chance(USUALLY)) NOW.plus(Duration.ofDays(1)) else NOW.minus(minutes(SLOT_MINUTES))
        return SlotFacts(
            slotId = if (random.chance(OFTEN)) TARGET_SLOT else CURRENT_SLOT,""",
    """        val status = random.pick(SlotStatus.entries + List(FREE_WEIGHT) { SlotStatus.FREE })
        val start = if (random.chance(MOSTLY)) NOW.plus(Duration.ofDays(1)) else NOW.minus(minutes(SLOT_MINUTES))
        return SlotFacts(
            slotId = if (random.chance(LIKELY)) TARGET_SLOT else CURRENT_SLOT,""")
rep("""            providerId = if (random.chance(OFTEN)) PROVIDER else OTHER_PROVIDER,
            locationId = if (random.chance(OFTEN)) LOCATION else OTHER_LOCATION,""",
    """            providerId = if (random.chance(LIKELY)) PROVIDER else OTHER_PROVIDER,
            locationId = if (random.chance(LIKELY)) LOCATION else OTHER_LOCATION,""")
rep("""        val accepted = random.chance(HALF)""", """        val accepted = random.chance(LIKELY_ACCEPTED)""")
rep("""            waitlistEntry = if (random.chance(USUALLY)) waitlistEntry(random, "SYN-WL-0005") else null,""",
    """            waitlistEntry = if (random.chance(MOSTLY)) waitlistEntry(random, "SYN-WL-0005") else null,""")
rep("""            hold = if (random.chance(USUALLY)) hold(random) else null,""", """            hold = if (random.chance(MOSTLY)) hold(random) else null,""")
rep("""            serviceType = if (random.chance(USUALLY)) SERVICE else null,
            providers = if (random.chance(HALF)) emptySet() else setOf(PROVIDER),
            locations = if (random.chance(HALF)) emptySet() else setOf(LOCATION),
            earliest = if (random.chance(USUALLY)) TODAY else null,
            latest = random.pick(listOf(TODAY.plusDays(WAITLIST_DAYS), TODAY.plusDays(WAITLIST_DAYS), TODAY, TODAY.minusDays(1), null)),
            priorityCode = random.pick(listOf(ROUTINE, ROUTINE, URGENT, "SYN-PRIO-UNKNOWN", null)),
            priorityOrigin = if (random.chance(USUALLY)) ReasonOrigin.USER else random.pick(ReasonOrigin.entries),""",
    """            serviceType = if (random.chance(MOSTLY)) SERVICE else null,
            providers = if (random.chance(HALF)) emptySet() else setOf(PROVIDER),
            locations = if (random.chance(HALF)) emptySet() else setOf(LOCATION),
            earliest = if (random.chance(MOSTLY)) TODAY else null,
            latest = random.pick(List(LATEST_WEIGHT) { TODAY.plusDays(WAITLIST_DAYS) } + listOf(TODAY, TODAY.minusDays(1), null)),
            priorityCode = random.pick(listOf(ROUTINE, ROUTINE, ROUTINE, ROUTINE, URGENT, URGENT, "SYN-PRIO-UNKNOWN", null)),
            priorityOrigin = if (random.chance(MOSTLY)) ReasonOrigin.USER else random.pick(ReasonOrigin.entries),""")
rep("""            pastOffers = if (random.chance(SOMETIMES)) listOf(declined) else emptyList(),""",
    """            pastOffers = if (random.chance(SELDOM)) listOf(declined) else emptyList(),""")
rep("""        listOf(PendingReason.WAITLIST_OFFER, PendingReason.AWAITING_ACCEPTANCE, PendingReason.AWAITING_ACCEPTANCE, null)""",
    """        listOf(
            PendingReason.WAITLIST_OFFER,
            PendingReason.WAITLIST_OFFER,
            PendingReason.WAITLIST_OFFER,
            PendingReason.AWAITING_ACCEPTANCE,
            PendingReason.AWAITING_ACCEPTANCE,
            null,
        )""")
rep("""            respondBy = random.pick(listOf(NOW.plus(Duration.ofHours(1)), NOW.plus(Duration.ofHours(1)), NOW, NOW.minusSeconds(1), null)),""",
    """            respondBy = random.pick(List(RESPOND_WEIGHT) { NOW.plus(Duration.ofHours(1)) } + listOf(NOW, NOW.minusSeconds(1), null)),""")
rep("""        val party = random.pick(CancellingParty.entries + listOf(CancellingParty.HOSPITAL, null))""",
    """        val party = random.pick(CancellingParty.entries + listOf(CancellingParty.HOSPITAL, CancellingParty.PATIENT, null))""")
rep("""        listOf(EntryChannel.DESK_USER, EntryChannel.DESK_USER, EntryChannel.DESK_USER, EntryChannel.FRONT_DOOR_LINK, null)""",
    """        List(DESK_WEIGHT) { EntryChannel.DESK_USER } + listOf(EntryChannel.FRONT_DOOR_LINK, null)""")
rep("""            entrantId = if (random.chance(USUALLY)) DESK_USER else null,
            entrantAuthenticated = random.chance(USUALLY),""",
    """            entrantId = if (random.chance(MOSTLY)) DESK_USER else null,
            entrantAuthenticated = random.chance(MOSTLY),""")
rep("""private const val USUALLY = 0.9
""", """private const val MOSTLY = 0.95
private const val USUALLY = 0.9
private const val LIKELY = 0.85
private const val LIKELY_ACCEPTED = 0.7
""")
rep("""private const val RARELY = 0.1
""", """private const val SELDOM = 0.15
private const val RARELY = 0.1

// Repetitions of the good option in a list, which weight a pick towards it.
private const val FREE_WEIGHT = 8
private const val LATEST_WEIGHT = 8
private const val RESPOND_WEIGHT = 4
private const val DESK_WEIGHT = 5
""")
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
