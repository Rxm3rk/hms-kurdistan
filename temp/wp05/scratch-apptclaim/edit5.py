import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep('''        test("SI-20 (appointment): every patient-message effect states the SI-20 and SI-21 content rule (structural only)") {
            AppointmentEffect.entries.filter { FRONT_DOOR in targets(it) }.forEach { effect ->
                withClue(effect.id) {''', '''        test("SI-20 (appointment): every patient-message effect states the SI-20 and SI-21 content rule (structural only)") {
            val messages =
                listOf(
                    AppointmentEffect.SEND_WAITLIST_OFFER,
                    AppointmentEffect.SCHEDULE_REMINDERS,
                    AppointmentEffect.NOTIFY_PATIENT_OF_CHANGE,
                )
            AppointmentEffect.entries.filter { FRONT_DOOR in targets(it) } shouldContainAll messages
            messages.forEach { effect ->
                withClue(effect.id) {''')
rep('''            stats.requireFired(*indexesOf { it.to != AppointmentState.ARRIVED && (it.to in TERMINAL || !it.from.contains(it.to)) })''',
    '''            stats.requireFired(*indexesOf { it.to !in it.from })''')
rep('''private typealias AppointmentStep = Step<AppointmentState, AppointmentCommand, AppointmentPredicate, AppointmentEffect, AppointmentFacts>
private typealias AppointmentCheck = StepCheck<AppointmentState, AppointmentCommand, AppointmentPredicate, AppointmentEffect, AppointmentFacts>
''', '''private typealias AppointmentStep =
    Step<AppointmentState, AppointmentCommand, AppointmentPredicate, AppointmentEffect, AppointmentFacts>
private typealias AppointmentCheck =
    StepCheck<AppointmentState, AppointmentCommand, AppointmentPredicate, AppointmentEffect, AppointmentFacts>
''')
rep("import io.kotest.matchers.collections.shouldBeEmpty\n", "import io.kotest.matchers.collections.shouldBeEmpty\nimport io.kotest.matchers.collections.shouldContainAll\n")
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
