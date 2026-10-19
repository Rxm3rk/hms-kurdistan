package hms.archfixtures.locale.violating.kernel.money

import java.math.BigDecimal
import java.text.NumberFormat

/** Violating fixture for no-system-default-zone-or-locale: a kernel library class (not a domain package) formats with the default locale. */
class KernelFormatsWithDefaultLocale {
    fun display(amount: BigDecimal): String = NumberFormat.getCurrencyInstance().format(amount)
}
