package hms.archfixtures.clock.violating.kernel.time

import java.time.Instant

/** Violating fixture for the extended rule (d): a kernel library class (not a domain package) reads the system clock. */
class KernelTimeReadsClock {
    fun read(): Instant = Instant.now()
}
