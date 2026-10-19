package hms.kernel.archrules

import hms.archfixtures.clock.compliant.domain.UsesInjectedClock
import hms.archfixtures.clock.compliant.infrastructure.SystemClockProvider
import hms.archfixtures.clock.compliant.kernel.journal.infrastructure.JournalAdapterCreatesClock
import hms.archfixtures.clock.compliant.kernel.time.KernelTimeUsesInjectedClock
import hms.archfixtures.clock.violating.domain.CallsCalendarGetInstance
import hms.archfixtures.clock.violating.domain.CallsClockSystemDefaultZone
import hms.archfixtures.clock.violating.domain.CallsClockSystemUtc
import hms.archfixtures.clock.violating.domain.CallsClockSystemWithZone
import hms.archfixtures.clock.violating.domain.CallsClockTickSeconds
import hms.archfixtures.clock.violating.domain.CallsInstantNow
import hms.archfixtures.clock.violating.domain.CallsInstantSourceSystem
import hms.archfixtures.clock.violating.domain.CallsKotlinClockSystem
import hms.archfixtures.clock.violating.domain.CallsLocalDateNow
import hms.archfixtures.clock.violating.domain.CallsLocalDateNowWithZone
import hms.archfixtures.clock.violating.domain.CallsLocalDateTimeNow
import hms.archfixtures.clock.violating.domain.CallsLocalTimeNow
import hms.archfixtures.clock.violating.domain.CallsMonthDayNow
import hms.archfixtures.clock.violating.domain.CallsOffsetDateTimeNow
import hms.archfixtures.clock.violating.domain.CallsOffsetTimeNow
import hms.archfixtures.clock.violating.domain.CallsSystemCurrentTimeMillis
import hms.archfixtures.clock.violating.domain.CallsSystemNanoTime
import hms.archfixtures.clock.violating.domain.CallsYearMonthNow
import hms.archfixtures.clock.violating.domain.CallsYearNow
import hms.archfixtures.clock.violating.domain.CallsZonedDateTimeNow
import hms.archfixtures.clock.violating.domain.ConstructsDate
import hms.archfixtures.clock.violating.domain.ConstructsGregorianCalendar
import hms.archfixtures.clock.violating.domain.MarksKotlinMonotonicTime
import hms.archfixtures.clock.violating.kernel.journal.JournalModelReadsClock
import hms.archfixtures.clock.violating.kernel.journal.inmemory.InMemoryJournalReadsClock
import hms.archfixtures.clock.violating.kernel.time.KernelTimeReadsClock
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * Rule (d), `ArchTest:no-now-in-domain`: domain code never reads the system clock; it is given a Clock (BUILD-PROMPT
 * §6.2). platform-kernel.md §11 extends it to the kernel libraries and the journal's pure model.
 */
class SystemClockRuleTest {
    private val violatingRoot = "hms.archfixtures.clock.violating"
    private val compliantRoot = "hms.archfixtures.clock.compliant"

    @TestFactory
    fun `fails on each call that reads the system clock`(): List<DynamicTest> =
        listOf(
            CallsInstantNow::class,
            CallsLocalDateNow::class,
            CallsLocalDateTimeNow::class,
            CallsZonedDateTimeNow::class,
            CallsOffsetDateTimeNow::class,
            CallsSystemCurrentTimeMillis::class,
            CallsClockSystemUtc::class,
            CallsClockSystemDefaultZone::class,
            CallsLocalDateNowWithZone::class,
            CallsLocalTimeNow::class,
            CallsOffsetTimeNow::class,
            CallsYearNow::class,
            CallsYearMonthNow::class,
            CallsMonthDayNow::class,
            CallsClockSystemWithZone::class,
            CallsClockTickSeconds::class,
            CallsInstantSourceSystem::class,
            CallsSystemNanoTime::class,
            ConstructsDate::class,
            CallsCalendarGetInstance::class,
            ConstructsGregorianCalendar::class,
            CallsKotlinClockSystem::class,
            MarksKotlinMonotonicTime::class,
        ).map { fixture ->
            dynamicTest(fixture.java.simpleName) {
                assertRuleFails(HmsArchitectureRules.domainDoesNotReadTheSystemClock(violatingRoot), importFixtures(fixture), fixture)
            }
        }

    @TestFactory
    fun `no-now-in-domain fails on kernel libraries and the journal model reading the system clock`(): List<DynamicTest> =
        listOf(KernelTimeReadsClock::class, JournalModelReadsClock::class, InMemoryJournalReadsClock::class).map { fixture ->
            dynamicTest(fixture.java.simpleName) {
                assertRuleFails(HmsArchitectureRules.domainDoesNotReadTheSystemClock(violatingRoot), importFixtures(fixture), fixture)
            }
        }

    @Test
    fun `passes on domain code that uses an injected Clock and on infrastructure that creates the system clock`() {
        assertRulePasses(
            HmsArchitectureRules.domainDoesNotReadTheSystemClock(compliantRoot),
            importFixturePackage(compliantRoot),
            UsesInjectedClock::class,
            SystemClockProvider::class,
            KernelTimeUsesInjectedClock::class,
            JournalAdapterCreatesClock::class,
        )
    }
}
