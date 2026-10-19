package hms.archfixtures.testadapters.app.wiring

import hms.archfixtures.testadapters.kernel.testing.FixtureTestClock

/** Violating D8 fixture: production wiring binds the test clock, which would freeze every timer (SI-03). */
class ProductionWiringUsesTestClock(
    val clock: FixtureTestClock,
)
