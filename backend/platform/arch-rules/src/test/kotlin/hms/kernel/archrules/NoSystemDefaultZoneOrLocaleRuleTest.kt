package hms.kernel.archrules

import hms.archfixtures.locale.compliant.domain.ExplicitZoneAndLocale
import hms.archfixtures.locale.compliant.infrastructure.ReadsDefaultZoneOutsideDomain
import hms.archfixtures.locale.violating.domain.CallsCalendarGetInstanceWithLocaleOnly
import hms.archfixtures.locale.violating.domain.CallsClockSystemDefaultZone
import hms.archfixtures.locale.violating.domain.CallsDateTimeFormatterOfPattern
import hms.archfixtures.locale.violating.domain.CallsDecimalFormatSymbolsGetInstance
import hms.archfixtures.locale.violating.domain.CallsFormatterBuilderToFormatter
import hms.archfixtures.locale.violating.domain.CallsLocaleGetDefault
import hms.archfixtures.locale.violating.domain.CallsLocaleGetDefaultForCategory
import hms.archfixtures.locale.violating.domain.CallsLocalizedDateFormatter
import hms.archfixtures.locale.violating.domain.CallsNumberFormatGetInstance
import hms.archfixtures.locale.violating.domain.CallsNumberFormatGetNumberInstance
import hms.archfixtures.locale.violating.domain.CallsStaticMessageFormat
import hms.archfixtures.locale.violating.domain.CallsStringFormatWithoutLocale
import hms.archfixtures.locale.violating.domain.CallsTimeZoneGetDefault
import hms.archfixtures.locale.violating.domain.CallsZoneIdSystemDefault
import hms.archfixtures.locale.violating.domain.ConstructsDecimalFormatWithPattern
import hms.archfixtures.locale.violating.domain.ConstructsFormatterWithoutLocale
import hms.archfixtures.locale.violating.domain.ConstructsSimpleDateFormat
import hms.archfixtures.locale.violating.domain.JavaFormatsWithoutLocale
import hms.archfixtures.locale.violating.domain.JavaLowerCasesWithoutLocale
import hms.archfixtures.locale.violating.domain.JavaUpperCasesWithoutLocale
import hms.archfixtures.locale.violating.domain.SetsDefaultLocale
import hms.archfixtures.locale.violating.kernel.money.KernelFormatsWithDefaultLocale
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** `ArchTest:no-system-default-zone-or-locale` (platform-kernel.md §3, §11; BUILD-PROMPT §4.1, §8.1 P10). */
class NoSystemDefaultZoneOrLocaleRuleTest {
    private val violatingRule = KernelArchitectureRules.noSystemDefaultZoneOrLocale("hms.archfixtures.locale.violating")

    @TestFactory
    fun `no-system-default-zone-or-locale fails on each default zone or locale use in domain and kernel code`(): List<DynamicTest> =
        listOf(
            CallsZoneIdSystemDefault::class,
            CallsTimeZoneGetDefault::class,
            CallsLocaleGetDefault::class,
            CallsStringFormatWithoutLocale::class,
            JavaFormatsWithoutLocale::class,
            JavaUpperCasesWithoutLocale::class,
            JavaLowerCasesWithoutLocale::class,
            CallsNumberFormatGetInstance::class,
            CallsNumberFormatGetNumberInstance::class,
            ConstructsDecimalFormatWithPattern::class,
            CallsDateTimeFormatterOfPattern::class,
            ConstructsFormatterWithoutLocale::class,
            CallsLocaleGetDefaultForCategory::class,
            SetsDefaultLocale::class,
            CallsClockSystemDefaultZone::class,
            CallsLocalizedDateFormatter::class,
            CallsFormatterBuilderToFormatter::class,
            CallsDecimalFormatSymbolsGetInstance::class,
            ConstructsSimpleDateFormat::class,
            CallsStaticMessageFormat::class,
            CallsCalendarGetInstanceWithLocaleOnly::class,
            KernelFormatsWithDefaultLocale::class,
        ).map { fixture ->
            dynamicTest(fixture.java.simpleName) { assertRuleFails(violatingRule, importFixtures(fixture), fixture) }
        }

    @Test
    fun `no-system-default-zone-or-locale passes on explicit zones and locales, and outside domain and kernel code`() {
        val root = "hms.archfixtures.locale.compliant"
        assertRulePasses(
            KernelArchitectureRules.noSystemDefaultZoneOrLocale(root),
            importFixturePackage(root),
            ExplicitZoneAndLocale::class,
            ReadsDefaultZoneOutsideDomain::class,
        )
    }
}
