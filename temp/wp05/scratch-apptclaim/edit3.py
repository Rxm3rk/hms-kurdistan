import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep('''                ParticipantFacts("SYN-PAT-0001", required = true, response = ParticipantResponse.ACCEPTED, responseSlotId = "SYN-SLOT-0002"),
                ParticipantFacts("SYN-PRV-01", required = true, response = ParticipantResponse.ACCEPTED, responseSlotId = "SYN-SLOT-0002"),
                ParticipantFacts("SYN-EQP-01", required = false, response = ParticipantResponse.NEEDS_ACTION, responseSlotId = null),
''', '''                ParticipantFacts(PATIENT, required = true, response = ParticipantResponse.ACCEPTED, responseSlotId = "SYN-SLOT-0002"),
                ParticipantFacts(PROVIDER, required = true, response = ParticipantResponse.ACCEPTED, responseSlotId = "SYN-SLOT-0002"),
                ParticipantFacts("SYN-EQP-01", required = false, response = ParticipantResponse.NEEDS_ACTION, responseSlotId = null),
''')
rep('''                sessions = listOf(SessionFacts(SERVICE, PROVIDER, acceptsWalkIns = true, start = NOW.minus(minutes(60)), end = NOW.plus(minutes(180)))),
''', '''                sessions =
                    listOf(
                        SessionFacts(SERVICE, PROVIDER, acceptsWalkIns = true, start = NOW.minus(minutes(60)), end = NOW.plus(minutes(180))),
                    ),
''')
rep('''private fun AppointmentFacts.withEntry(transform: WaitlistEntryFacts.() -> WaitlistEntryFacts) = copy(waitlistEntry = waitlistEntry?.transform())
''', '''private fun AppointmentFacts.withEntry(transform: WaitlistEntryFacts.() -> WaitlistEntryFacts) =
    copy(waitlistEntry = waitlistEntry?.transform())
''')
rep('''                base.withSlot { copy(status = SlotStatus.BUSY, heldByAppointmentId = "SYN-APT-0099", overbookable = true, overbookCap = null) },
''', '''                base.withSlot {
                    copy(status = SlotStatus.BUSY, heldByAppointmentId = "SYN-APT-0099", overbookable = true, overbookCap = null)
                },
''')
rep('''test("requiredParticipantsAccepted holds and participantAcceptanceAwaited fails when every required participant accepted the slot") {''',
    '''test("requiredParticipantsAccepted holds and participantAcceptanceAwaited fails when every required participant accepted") {''')
rep('''            val awaiting = base.copy(participants = base.participants.map { if (it.participantId == PROVIDER) it.copy(response = ParticipantResponse.NEEDS_ACTION) else it })
''', '''            val awaiting =
                base.copy(
                    participants =
                        base.participants.map {
                            if (it.participantId == PROVIDER) it.copy(response = ParticipantResponse.NEEDS_ACTION) else it
                        },
                )
''')
rep('''            val earlier = base.copy(participants = base.participants.map { if (it.required) it.copy(responseSlotId = "SYN-SLOT-0001") else it })
''', '''            val earlier =
                base.copy(participants = base.participants.map { if (it.required) it.copy(responseSlotId = "SYN-SLOT-0001") else it })
''')
rep('''test("offeredSlotMatchesConstraints holds for a slot within the entry's service, location set and dates (empty provider set means any)") {''',
    '''test("offeredSlotMatchesConstraints holds for a slot within the entry's service, locations and dates (no providers means any)") {''')
rep('''test("patientIdentifiedByTwoIdentifiers holds for a stated name matched by empi, a scanned MRN with a valid check digit and the stated DOB") {''',
    '''test("patientIdentifiedByTwoIdentifiers holds for a stated name matched by empi, a scanned valid MRN and the stated DOB") {''')
rep('''test("patientIdentifiedByTwoIdentifiers fails when the name is not confirmed: no match, empi unavailable, blank, or read from the screen") {''',
    '''test("patientIdentifiedByTwoIdentifiers fails for an unconfirmed name: no match, empi unavailable, blank, or screen-read") {''')
rep('''                search.withCheckIn { copy(empiSearchCandidates = listOf(PATIENT), statedDob = null, recordApproximateDob = true, statedApproximateAgeMatch = EmpiMatch.MATCH) },
''', '''                search.withCheckIn {
                    copy(
                        empiSearchCandidates = listOf(PATIENT),
                        statedDob = null,
                        recordApproximateDob = true,
                        statedApproximateAgeMatch = EmpiMatch.MATCH,
                    )
                },
''')
rep('''test("patientIdentifiedByTwoIdentifiers fails for a record whose MRN, DOB or approximate-DOB flag is missing, or without check-in facts") {''',
    '''test("patientIdentifiedByTwoIdentifiers fails for a record without MRN, DOB or approximate-DOB flag, or no check-in facts") {''')
rep('''            EncounterStatus.entries.filterNot { it == EncounterStatus.CANCELLED || it == EncounterStatus.ENTERED_IN_ERROR }.forEach { status ->
''', '''            val open = EncounterStatus.entries.filterNot { it == EncounterStatus.CANCELLED || it == EncounterStatus.ENTERED_IN_ERROR }
            open.forEach { status ->
''')
rep('''test("linkedEncounterEndedWithoutConsultation holds for cancelled, entered in error, or ended as left without being seen, with no consultation") {''',
    '''test("linkedEncounterEndedWithoutConsultation holds for cancelled, entered in error, or left without being seen, unconsulted") {''')
rep('''test("cancellationNeedsRebooking holds when party and reason are unknown: an unknown never ends the need (cancellationEndsNeed fails)") {''',
    '''test("cancellationNeedsRebooking holds for unknown party and reason: an unknown never ends the need (cancellationEndsNeed fails)") {''')
rep('''                    listOf(EncounterStatus.DISCHARGED_NOT_CLOSED, EncounterStatus.FINISHED, EncounterStatus.CANCELLED, EncounterStatus.ENTERED_IN_ERROR)
                        .map { listOf(encounter(status = it)) }
''', '''                    listOf(
                        EncounterStatus.DISCHARGED_NOT_CLOSED,
                        EncounterStatus.FINISHED,
                        EncounterStatus.CANCELLED,
                        EncounterStatus.ENTERED_IN_ERROR,
                    ).map { listOf(encounter(status = it)) }
''')
rep('''test("patientInHospital overlap boundaries: ending exactly at the slot start or starting exactly at the slot end does not overlap") {''',
    '''test("patientInHospital overlap boundaries: ending exactly at the slot start or starting exactly at its end does not overlap") {''')
rep('''            val facts = base.withAppointmentSlot { copy(start = null) }.copy(patientEncounters = listOf(encounter(start = NOW.plus(Duration.ofDays(9)))))
''', '''            val facts =
                base
                    .withAppointmentSlot { copy(start = null) }
                    .copy(patientEncounters = listOf(encounter(start = NOW.plus(Duration.ofDays(9)))))
''')
rep('''                frontDesk.withCorrection { copy(command = AppointmentCommand.ReverseNoShow) }.withAppointmentSlot { copy(date = TODAY.minusDays(1)) },
''', '''                frontDesk
                    .withCorrection { copy(command = AppointmentCommand.ReverseNoShow) }
                    .withAppointmentSlot { copy(date = TODAY.minusDays(1)) },
''')
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
