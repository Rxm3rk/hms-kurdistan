package hms.kernel.context

/**
 * The reason for one change; the journal takes it per entry (platform-kernel.md §7.4, §7.6). Never defaulted:
 * no constant, default parameter or empty reason exists. `toString` never shows the text, which may hold PHI.
 */
sealed interface ChangeReason {
    /** Typed or chosen by the user for this change: non-blank, at most 2,000 characters. */
    class Entered private constructor(
        val text: String,
    ) : ChangeReason {
        init {
            require(enteredError(text) == null) { "ChangeReason.Entered must be non-blank and at most $MAX_ENTERED_LENGTH characters" }
        }

        override fun equals(other: Any?): Boolean = other is Entered && text == other.text

        override fun hashCode(): Int = text.hashCode()

        override fun toString(): String = "ChangeReason.Entered(${text.length} chars)"

        internal companion object {
            fun create(text: String): Entered = Entered(text)
        }
    }

    /** A coded reason of a SYSTEM actor; the journal refuses it for other actor kinds. Grammar `[a-z][a-z0-9.-]*`. */
    class SystemGenerated private constructor(
        val code: String,
    ) : ChangeReason {
        init {
            require(SYSTEM_CODE.matches(code)) { "ChangeReason.SystemGenerated code must match [a-z][a-z0-9.-]*, got '$code'" }
        }

        override fun equals(other: Any?): Boolean = other is SystemGenerated && code == other.code

        override fun hashCode(): Int = code.hashCode()

        override fun toString(): String = "ChangeReason.SystemGenerated($code)"

        internal companion object {
            fun create(code: String): SystemGenerated = SystemGenerated(code)
        }
    }

    companion object {
        /** Refuses null, blank after trim, and more than 2,000 characters [P]. No default exists. */
        @JvmStatic
        fun entered(text: String?): ChangeReasonResult {
            val error = enteredError(text)
            return when {
                text == null -> ChangeReasonResult.Refused(ChangeReasonError.MISSING)
                error != null -> ChangeReasonResult.Refused(error)
                else -> ChangeReasonResult.Valid(Entered.create(text))
            }
        }

        /** Grammar `[a-z][a-z0-9.-]*`; throws IllegalArgumentException otherwise (a programming error). */
        @JvmStatic
        fun system(code: String): ChangeReason = SystemGenerated.create(code)
    }
}

/** The answer of [ChangeReason.entered]. */
sealed interface ChangeReasonResult {
    data class Valid(
        val reason: ChangeReason.Entered,
    ) : ChangeReasonResult

    data class Refused(
        val error: ChangeReasonError,
    ) : ChangeReasonResult
}

/** Why an entered reason was refused (platform-kernel.md §7.4). */
enum class ChangeReasonError { MISSING, BLANK, TOO_LONG }

/** The longest entered reason, in characters (Unicode code points). */
private const val MAX_ENTERED_LENGTH = 2000

private val SYSTEM_CODE = Regex("[a-z][a-z0-9.-]*")

private fun enteredError(text: String?): ChangeReasonError? =
    when {
        text == null -> ChangeReasonError.MISSING
        text.isBlank() -> ChangeReasonError.BLANK
        text.codePointCount(0, text.length) > MAX_ENTERED_LENGTH -> ChangeReasonError.TOO_LONG
        else -> null
    }
