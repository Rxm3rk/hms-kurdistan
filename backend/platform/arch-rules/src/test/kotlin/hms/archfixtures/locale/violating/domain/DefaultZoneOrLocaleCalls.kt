package hms.archfixtures.locale.violating.domain

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.MessageFormat
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.time.Clock
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.format.FormatStyle
import java.util.Calendar
import java.util.Formatter
import java.util.Locale
import java.util.TimeZone

// Violating fixtures for no-system-default-zone-or-locale: one domain class per call that uses the JVM default
// zone or locale. Java's String.toUpperCase() and toLowerCase() without a Locale are in the Java fixtures, because
// Kotlin refuses to compile them.

// The calls platform-kernel.md §11 names.

class CallsZoneIdSystemDefault {
    fun zone(): ZoneId = ZoneId.systemDefault()
}

class CallsTimeZoneGetDefault {
    fun zone(): TimeZone = TimeZone.getDefault()
}

class CallsLocaleGetDefault {
    fun locale(): Locale = Locale.getDefault()
}

@Suppress("ImplicitDefaultLocale") // The fixture plants exactly this violation.
class CallsStringFormatWithoutLocale {
    fun text(count: Int): String = "%d doses".format(count)
}

class CallsNumberFormatGetInstance {
    fun format(): NumberFormat = NumberFormat.getInstance()
}

class CallsNumberFormatGetNumberInstance {
    fun format(): NumberFormat = NumberFormat.getNumberInstance()
}

class ConstructsDecimalFormatWithPattern {
    fun format(): DecimalFormat = DecimalFormat("0.##")
}

class CallsDateTimeFormatterOfPattern {
    fun format(): DateTimeFormatter = DateTimeFormatter.ofPattern("dd MMM yyyy")
}

class ConstructsFormatterWithoutLocale {
    fun format(): Formatter = Formatter(StringBuilder())
}

// The tightening: the other overloads that use a default implicitly.

class CallsLocaleGetDefaultForCategory {
    fun locale(): Locale = Locale.getDefault(Locale.Category.FORMAT)
}

class SetsDefaultLocale {
    fun reset(locale: Locale) = Locale.setDefault(locale)
}

class CallsClockSystemDefaultZone {
    fun clock(): Clock = Clock.systemDefaultZone()
}

class CallsLocalizedDateFormatter {
    fun format(): DateTimeFormatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT)
}

class CallsFormatterBuilderToFormatter {
    fun format(): DateTimeFormatter = DateTimeFormatterBuilder().appendPattern("yyyy").toFormatter()
}

class CallsDecimalFormatSymbolsGetInstance {
    fun symbols(): DecimalFormatSymbols = DecimalFormatSymbols.getInstance()
}

class ConstructsSimpleDateFormat {
    fun format(): SimpleDateFormat = SimpleDateFormat("yyyy-MM-dd")
}

class CallsStaticMessageFormat {
    fun text(count: Int): String = MessageFormat.format("{0} doses", count)
}

class CallsCalendarGetInstanceWithLocaleOnly {
    fun calendar(locale: Locale): Calendar = Calendar.getInstance(locale)
}
