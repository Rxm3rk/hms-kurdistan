package hms.archfixtures.testadapters.kernel.testing

import java.time.Instant

/** D8 fixture: a controllable clock in the kernel's testing package (like `hms.kernel.testing.TestClock`). */
class FixtureTestClock(
    var now: Instant,
)
