package hms.tests.scenarios.api

/**
 * A synthetic patient of a scenario world: an identifier that starts with `SYN-` and nothing else (BUILD-PROMPT
 * §18.10: synthetic data only, never for clinical validation). A patient with any other identifier cannot be
 * constructed, so no scenario can carry a real identifier.
 */
class SyntheticPatient(
    val id: String,
) {
    init {
        require(id.startsWith(SyntheticPatients.PREFIX) && SyntheticPatients.ID.matches(id)) {
            "a scenario patient's identifier must be synthetic (${SyntheticPatients.PREFIX}nnnnnn), got '$id'"
        }
    }

    override fun equals(other: Any?): Boolean = other is SyntheticPatient && other.id == id

    override fun hashCode(): Int = id.hashCode()

    override fun toString(): String = "SyntheticPatient($id, ${SyntheticPatients.LABEL})"
}

/**
 * The synthetic patient factory of one scenario world: `SYN-000001`, `SYN-000002`, ... in order, unique within the
 * world. The §18.10 population generator (Kurdistan locale pack: four-part names in three scripts, Iraqi identifier
 * types, DOB precision flags) is WP-0.6's; scenarios that need it wait on WP-0.6.
 */
class SyntheticPatients {
    private val issued = mutableListOf<SyntheticPatient>()

    /** A new synthetic patient. */
    fun next(): SyntheticPatient {
        check(issued.size < MAX_PATIENTS) { "a scenario world holds at most $MAX_PATIENTS synthetic patients" }
        val patient = SyntheticPatient(PREFIX + (issued.size + 1).toString().padStart(DIGITS, '0'))
        issued += patient
        return patient
    }

    /** Every patient issued so far, in order. */
    fun issued(): List<SyntheticPatient> = issued.toList()

    companion object {
        /** Every synthetic identifier starts with this prefix. */
        const val PREFIX: String = "SYN-"

        /** The label every synthetic record carries (§18.10). */
        const val LABEL: String = "NOT FOR CLINICAL USE"

        private const val DIGITS = 6
        private const val MAX_PATIENTS = 999_999
        internal val ID = Regex("SYN-\\d{$DIGITS}")
    }
}
