package hms.archfixtures.locale.compliant.domain

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.NumberFormat
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Formatter
import java.util.Locale

/** Compliant fixture: every zone and locale is passed in, as configuration supplies them (§4.1, §8.1 P10). */
class ExplicitZoneAndLocale(
    private val zone: ZoneId,
    private val locale: Locale,
) {
    fun text(count: Int): String = String.format(locale, "%d doses", count)

    fun code(raw: String): String = raw.uppercase() + raw.lowercase()

    fun number(): NumberFormat = NumberFormat.getInstance(locale)

    fun decimal(): DecimalFormat = DecimalFormat("0.##", DecimalFormatSymbols.getInstance(Locale.ROOT))

    fun date(): DateTimeFormatter = DateTimeFormatter.ofPattern("dd MMM yyyy", locale).withZone(zone)

    fun iso(time: OffsetDateTime): String = DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(time)

    fun formatter(): Formatter = Formatter(StringBuilder(), locale)
}
