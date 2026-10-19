package hms.platform.docs.domain.rules

import java.time.DateTimeException
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DecimalStyle
import java.util.Locale

/**
 * How a print shows a time (docs/specs/modules/platform-docs.md §2, §8.5): the instant in the tenant's zone
 * as `YYYY-MM-DD HH:mm`, always with Western digits whatever the label language. Formatting is not
 * arithmetic, and the instant always comes from the caller: domain code never reads the clock (BUILD-PROMPT
 * §6.2).
 */
object PrintTime {
    private val formatter: DateTimeFormatter =
        DateTimeFormatter
            .ofPattern("uuuu-MM-dd HH:mm", Locale.ROOT)
            .withDecimalStyle(DecimalStyle.STANDARD)

    /** The instant in [zone], for example `2026-10-19 14:05`. */
    fun format(
        instant: Instant,
        zone: ZoneId,
    ): String = formatter.format(instant.atZone(zone))

    /** Parses a configured zone id; null when it is not a valid zone (the caller refuses the print). */
    fun zoneOrNull(zoneId: String): ZoneId? =
        try {
            ZoneId.of(zoneId)
        } catch (ignored: DateTimeException) {
            null
        }
}
