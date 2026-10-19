import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:80]
    s = s.replace(old, new)


rep("""    override fun waitlistEntryComplete(facts: AppointmentFacts): Boolean {
        val entry = facts.waitlistEntry ?: return false
        val earliest = entry.earliest ?: return false
        val latest = entry.latest ?: return false
        val datesValid = !earliest.isAfter(latest) && !latest.isBefore(facts.today)
""", """    override fun waitlistEntryComplete(facts: AppointmentFacts): Boolean {
        val entry = facts.waitlistEntry ?: return false
        val earliest = entry.earliest
        val latest = entry.latest
        val datesValid = earliest != null && latest != null && !earliest.isAfter(latest) && !latest.isBefore(facts.today)
""")
rep("""        val entry = facts.waitlistEntry ?: return false
        val slot = facts.targetSlot ?: return false
        return matches(entry, slot)
""", """        val entry = facts.waitlistEntry
        val slot = facts.targetSlot
        return entry != null && slot != null && matches(entry, slot)
""")
rep("""        val earliest = entry.earliest ?: return false
        val latest = entry.latest ?: return false
        val provider = entry.providers.isEmpty() || slot.providerId in entry.providers
        val location = entry.locations.isEmpty() || slot.locationId in entry.locations
        val dates = !slot.date.isBefore(earliest) && !slot.date.isAfter(latest)
""", """        val earliest = entry.earliest
        val latest = entry.latest
        val provider = entry.providers.isEmpty() || slot.providerId in entry.providers
        val location = entry.locations.isEmpty() || slot.locationId in entry.locations
        val dates = earliest != null && latest != null && !slot.date.isBefore(earliest) && !slot.date.isAfter(latest)
""")
rep("""        val entry = facts.waitlistEntry ?: return false
        val slot = facts.targetSlot ?: return false
        val ranks = facts.config.waitlistPriorityRanks
        val rank = ranks[entry.priorityCode] ?: return false
        return facts.competingEntries
            .filter { it.entryId != entry.entryId && matches(it, slot) }
            .none { competitor -> ranksBefore(competitor, ranks[competitor.priorityCode], entry, rank) }
""", """        val entry = facts.waitlistEntry
        val slot = facts.targetSlot
        val ranks = facts.config.waitlistPriorityRanks
        val rank = entry?.let { ranks[it.priorityCode] }
        return entry != null &&
            slot != null &&
            rank != null &&
            facts.competingEntries
                .filter { it.entryId != entry.entryId && matches(it, slot) }
                .none { competitor -> ranksBefore(competitor, ranks[competitor.priorityCode], entry, rank) }
""")
rep("""        recordDob: java.time.LocalDate,
    ): Boolean {
        val stated = checkIn.statedDob ?: return false
        if (checkIn.dobSource != IdentifierSource.PATIENT_STATED) return false
        return when (checkIn.recordDobPrecision) {
            null -> false
            DobPrecision.DAY -> stated == recordDob
            DobPrecision.MONTH -> stated.year == recordDob.year && stated.month == recordDob.month
            DobPrecision.YEAR -> stated.year == recordDob.year
        }
    }
""", """        recordDob: LocalDate,
    ): Boolean {
        val stated = checkIn.statedDob ?: return false
        val equalAtPrecision =
            when (checkIn.recordDobPrecision) {
                null -> false
                DobPrecision.DAY -> stated == recordDob
                DobPrecision.MONTH -> stated.year == recordDob.year && stated.month == recordDob.month
                DobPrecision.YEAR -> stated.year == recordDob.year
            }
        return checkIn.dobSource == IdentifierSource.PATIENT_STATED && equalAtPrecision
    }
""")
rep("""        val slot = facts.appointmentSlot ?: return false
        val start = slot.start ?: return false
        val sessionEnd = slot.sessionEnd ?: return false
        val opens = start.minus(window(facts.config.earlyCheckInWindow))
        return !facts.now.isBefore(opens) && facts.now.isBefore(sessionEnd)
""", """        val start = facts.appointmentSlot?.start
        val sessionEnd = facts.appointmentSlot?.sessionEnd
        return start != null &&
            sessionEnd != null &&
            !facts.now.isBefore(start.minus(window(facts.config.earlyCheckInWindow))) &&
            facts.now.isBefore(sessionEnd)
""")
rep("""        val walkIn = facts.walkIn ?: return false
        val service = walkIn.requestedService ?: return false
        return walkIn.sessions.any { session ->
            session.serviceType == service &&
                (walkIn.requestedProvider == null || session.providerId == walkIn.requestedProvider) &&
                session.acceptsWalkIns &&
                running(session, facts.now)
        }
""", """        val walkIn = facts.walkIn ?: return false
        val service = walkIn.requestedService
        return service != null &&
            walkIn.sessions.any { session ->
                session.serviceType == service &&
                    (walkIn.requestedProvider == null || session.providerId == walkIn.requestedProvider) &&
                    session.acceptsWalkIns &&
                    running(session, facts.now)
            }
""")
rep("""        val encounter = facts.linkedEncounter ?: return false
        val status = encounter.status ?: return false
        if (status in voidEncounterStates) return false
        val endedSeen = status in endedEncounterStates && encounter.leftWithoutBeingSeen == false
        return encounter.consultationRecorded == true || endedSeen
""", """        val encounter = facts.linkedEncounter ?: return false
        val status = encounter.status
        val endedSeen = status in endedEncounterStates && encounter.leftWithoutBeingSeen == false
        return status != null && status !in voidEncounterStates && (encounter.consultationRecorded == true || endedSeen)
""")
rep("""        val encounter = facts.linkedEncounter ?: return false
        val status = encounter.status ?: return false
        val ended = status in voidEncounterStates || (status in endedEncounterStates && encounter.leftWithoutBeingSeen == true)
        return ended && encounter.consultationRecorded == false
""", """        val encounter = facts.linkedEncounter ?: return false
        val status = encounter.status
        val ended = status in voidEncounterStates || (status in endedEncounterStates && encounter.leftWithoutBeingSeen == true)
        return status != null && ended && encounter.consultationRecorded == false
""")
rep("""        val cancellation = facts.cancellation ?: return false
        val rule = facts.config.cancellationReasons[cancellation.reasonCode] ?: return false
        val text = !rule.requiresText || !cancellation.reasonText.isNullOrBlank()
""", """        val cancellation = facts.cancellation ?: return false
        val rule = facts.config.cancellationReasons[cancellation.reasonCode]
        val text = rule != null && (!rule.requiresText || !cancellation.reasonText.isNullOrBlank())
""")
rep("""        val party = cancellation.requestingParty ?: return false
        val channel =
            when (cancellation.channel) {
                null -> false
                EntryChannel.DESK_USER -> true
                EntryChannel.FRONT_DOOR_LINK -> party == CancellingParty.PATIENT
            }
        return channel && !cancellation.entrantId.isNullOrBlank() && cancellation.entrantAuthenticated
""", """        val party = cancellation.requestingParty
        val channel =
            when (cancellation.channel) {
                null -> false
                EntryChannel.DESK_USER -> true
                EntryChannel.FRONT_DOOR_LINK -> party == CancellingParty.PATIENT
            }
        return party != null && channel && !cancellation.entrantId.isNullOrBlank() && cancellation.entrantAuthenticated
""")
rep("import java.time.Instant\n", "import java.time.Instant\nimport java.time.LocalDate\n")
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
