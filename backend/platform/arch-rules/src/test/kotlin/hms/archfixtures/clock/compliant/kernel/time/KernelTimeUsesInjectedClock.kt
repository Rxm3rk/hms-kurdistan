package hms.archfixtures.clock.compliant.kernel.time

import java.time.Clock
import java.time.Instant

/** Compliant fixture for the extended rule (d): a kernel library reads only the Clock it is given. */
class KernelTimeUsesInjectedClock(
    private val clock: Clock,
) {
    fun read(): Instant = Instant.now(clock)
}
