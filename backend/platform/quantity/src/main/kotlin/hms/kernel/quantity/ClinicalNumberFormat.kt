@file:OptIn(DoseMagnitudeAccess::class)

package hms.kernel.quantity

import java.math.BigDecimal

/**
 * The ISMP clinical number display (platform-kernel.md §10.4; §2.1 (a); §6.5; SAC-50; CTRL-0005-17): a leading zero
 * before a decimal point, no trailing zeros after it (zeros before the point are kept), no exponent, ASCII digits on
 * every locale, `.` as the separator, no grouping, then one space and the UCUM code. It never rounds: the value
 * shown equals the value held. Text is built from [BigDecimal.toPlainString]; no locale-sensitive formatter is used.
 */
object ClinicalNumberFormat {
    fun format(quantity: Quantity): String = "${formatNumber(quantity.magnitude())} ${quantity.unit.code}"

    fun format(dose: DoseQuantity): String = format(dose.asQuantity())

    fun format(rate: DoseRate): String = format(rate.asQuantity())

    /** The number alone, by the same rules; for comparison records in this package. */
    internal fun formatNumber(value: BigDecimal): String {
        val plain = value.toPlainString()
        return if ('.' in plain) plain.trimEnd('0').trimEnd('.') else plain
    }
}
