package hms.archfixtures.safetykernel.platform.tasks.application

import java.time.Clock
import java.time.Instant

/** Compliant fixture for rule (e): platform-tasks runs its timers on its injected clock, not on the workflow engine. */
class TasksRunOwnTimers(
    private val clock: Clock,
) {
    fun dueAt(): Instant = clock.instant()
}
