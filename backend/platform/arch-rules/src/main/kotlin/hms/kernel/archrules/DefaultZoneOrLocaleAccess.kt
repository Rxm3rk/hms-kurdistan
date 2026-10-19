package hms.kernel.archrules

import com.tngtech.archunit.core.domain.AccessTarget.CodeUnitAccessTarget
import com.tngtech.archunit.core.domain.JavaClass
import com.tngtech.archunit.lang.ArchCondition
import com.tngtech.archunit.lang.ConditionEvents
import com.tngtech.archunit.lang.SimpleConditionEvent

/**
 * What counts as using the system default time zone or locale for `ArchTest:no-system-default-zone-or-locale`
 * (platform-kernel.md §3, §11; BUILD-PROMPT §4.1, §8.1 P10).
 *
 * The rule covers the calls §11 names: `ZoneId.systemDefault()`, `TimeZone.getDefault()`, `Locale.getDefault()`,
 * `String.format` without a `Locale` (Kotlin's `String.format` extension compiles to it), Java's
 * `String.toUpperCase()` and `toLowerCase()` without a `Locale`, `NumberFormat.get*Instance()` without a
 * `Locale`, `DecimalFormat(String)`, `DateTimeFormatter.ofPattern(String)` without a `Locale` and
 * `java.util.Formatter()` without a `Locale`. It tightens them to the other JDK overloads that use the default
 * implicitly: setting the defaults, `String.formatted`, `Clock.systemDefaultZone()`, the localized
 * `DateTimeFormatter` factories, `DateTimeFormatterBuilder.toFormatter()`, `DecimalFormatSymbols`,
 * `DateFormat` and `SimpleDateFormat`, `MessageFormat`, `Collator`, `BreakIterator`, `printf`/`format` on
 * print streams and writers, and `Calendar`/`GregorianCalendar` without both a zone and a locale.
 */
internal object DefaultZoneOrLocaleAccess {
    private const val INIT = "<init>"
    private const val LOCALE = "java.util.Locale"
    private const val TIME_ZONE = "java.util.TimeZone"
    private const val STRING = "java.lang.String"
    private const val DATE_TIME_FORMATTER = "java.time.format.DateTimeFormatter"
    private const val DECIMAL_FORMAT = "java.text.DecimalFormat"
    private const val SIMPLE_DATE_FORMAT = "java.text.SimpleDateFormat"
    private const val MESSAGE_FORMAT = "java.text.MessageFormat"

    private val never: (List<String>) -> Boolean = { false }
    private val hasLocale: (List<String>) -> Boolean = { LOCALE in it }
    private val hasZoneAndLocale: (List<String>) -> Boolean = { LOCALE in it && TIME_ZONE in it }

    private val numberFactories =
        setOf(
            "getInstance",
            "getNumberInstance",
            "getIntegerInstance",
            "getCurrencyInstance",
            "getPercentInstance",
            "getCompactNumberInstance",
        )
    private val dateFactories = setOf("getInstance", "getDateInstance", "getTimeInstance", "getDateTimeInstance")
    private val breakFactories = setOf("getCharacterInstance", "getWordInstance", "getLineInstance", "getSentenceInstance")

    /** One check: a call to one of [names] on one of [owners] is safe only when [safeWhen] holds for its parameter types. */
    private class Check(
        val owners: Set<String>,
        val names: Set<String>,
        val safeWhen: (List<String>) -> Boolean,
    )

    private val checks: List<Check> =
        listOf(
            Check(setOf("java.time.ZoneId"), setOf("systemDefault"), never),
            Check(setOf(TIME_ZONE), setOf("getDefault", "setDefault"), never),
            Check(setOf(LOCALE), setOf("getDefault", "setDefault"), never),
            Check(setOf("java.time.Clock"), setOf("systemDefaultZone"), never),
            Check(
                setOf(DATE_TIME_FORMATTER),
                setOf("ofLocalizedDate", "ofLocalizedTime", "ofLocalizedDateTime", "ofLocalizedPattern"),
                never,
            ),
            Check(setOf(STRING), setOf("format", "formatted", "toUpperCase", "toLowerCase"), hasLocale),
            Check(setOf("java.text.NumberFormat", DECIMAL_FORMAT), numberFactories, hasLocale),
            Check(setOf(DECIMAL_FORMAT), setOf(INIT)) { "java.text.DecimalFormatSymbols" in it },
            Check(setOf("java.text.DecimalFormatSymbols"), setOf(INIT, "getInstance"), hasLocale),
            Check(setOf("java.text.DateFormat", SIMPLE_DATE_FORMAT), dateFactories, hasLocale),
            Check(setOf(SIMPLE_DATE_FORMAT), setOf(INIT)) { LOCALE in it || "java.text.DateFormatSymbols" in it },
            Check(setOf(DATE_TIME_FORMATTER), setOf("ofPattern"), hasLocale),
            Check(setOf("java.time.format.DateTimeFormatterBuilder"), setOf("toFormatter"), hasLocale),
            Check(setOf("java.util.Formatter"), setOf(INIT), hasLocale),
            Check(setOf(MESSAGE_FORMAT), setOf(INIT), hasLocale),
            // The static MessageFormat.format(String, Object...) only; the instance format methods use the instance's locale.
            Check(setOf(MESSAGE_FORMAT), setOf("format")) { it.size != 2 || it[0] != STRING || "java.lang.Object" !in it[1] },
            Check(setOf("java.text.Collator"), setOf("getInstance"), hasLocale),
            Check(setOf("java.text.BreakIterator"), breakFactories, hasLocale),
            Check(setOf("java.io.PrintStream", "java.io.PrintWriter"), setOf("printf", "format"), hasLocale),
            Check(setOf("java.util.Calendar"), setOf("getInstance"), hasZoneAndLocale),
            Check(setOf("java.util.GregorianCalendar"), setOf(INIT), hasZoneAndLocale),
        )

    /** True when calling [target] uses the default zone or locale. */
    fun usesDefault(target: CodeUnitAccessTarget): Boolean {
        val owner = target.owner.fullName
        val parameters = target.rawParameterTypes.map { it.fullName }
        return checks.any { owner in it.owners && target.name in it.names && !it.safeWhen(parameters) }
    }

    /** The condition: no call or method reference that uses the default zone or locale. */
    val condition: ArchCondition<JavaClass> =
        object : ArchCondition<JavaClass>("not use the system default time zone or locale") {
            override fun check(
                item: JavaClass,
                events: ConditionEvents,
            ) {
                item.codeUnitAccessesFromSelf.filter { usesDefault(it.target) }.forEach { access ->
                    events.add(SimpleConditionEvent.violated(access, "${access.description} uses the default zone or locale"))
                }
            }
        }
}
