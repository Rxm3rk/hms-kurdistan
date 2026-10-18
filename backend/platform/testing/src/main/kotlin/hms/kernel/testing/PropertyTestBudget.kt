package hms.kernel.testing

/**
 * The number of sequences each property-based test runs (BUILD-PROMPT §18.3, §19.1).
 *
 * Gradle passes the budget to every test JVM as the system property [SYSTEM_PROPERTY]: about 1,000 in
 * the fast tier (the default), 10⁶ in the nightly tier (`-Phms.pbt.sequences=1000000`). Property tests
 * pass it to Kotest and never hard-code an iteration count:
 *
 * ```
 * checkAll(PropertyTestBudget.sequences(), Arb.int()) { value -> ... }
 * ```
 */
object PropertyTestBudget {
    /** System property (and Gradle property) holding the budget. */
    const val SYSTEM_PROPERTY: String = "hms.pbt.sequences"

    /** Fast-tier budget when the property is absent, for example in an IDE run. */
    const val DEFAULT_SEQUENCES: Int = 1000

    /** The configured budget. */
    fun sequences(): Int = parse(System.getProperty(SYSTEM_PROPERTY))

    /** Parses a budget value: absent means [DEFAULT_SEQUENCES]; anything but a positive integer is an error. */
    fun parse(raw: String?): Int {
        if (raw == null) return DEFAULT_SEQUENCES
        val value = raw.trim().toIntOrNull()
        require(value != null && value > 0) { "$SYSTEM_PROPERTY must be a positive integer, got '$raw'" }
        return value
    }
}
