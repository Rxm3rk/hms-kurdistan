package hms.adt.domain.common

/**
 * The answer another module gives the adt domain for one command: the identity service, the Trust Plane, the record
 * module, the journal or the bed and encounter aggregates (docs/specs/modules/state-machines-and-invariants.md §3.1:
 * a fact may be another module's answer when that module owns it). [UNKNOWN] means no answer could be read; every
 * predicate that reads an answer fails on it unless its description says otherwise.
 */
enum class Answer {
    YES,
    NO,
    UNKNOWN,
}

/** Where a value in a command came from: chosen or typed by the user, or filled in by the system. */
enum class EntrySource {
    /** The user chose or typed the value for this command. */
    USER,

    /** The value was pre-filled or defaulted; the encounter and bed specs never accept it where they say "never defaulted". */
    DEFAULTED,
}

/**
 * A value carried by a command together with its [source], so that "the user chose it; it is never defaulted"
 * (encounter.yaml and bed.yaml, every reason and choice predicate) is a check on the facts, not an assumption.
 */
data class Chosen<T>(
    val value: T,
    val source: EntrySource,
) {
    /** True when the user chose the value. */
    val byUser: Boolean get() = source == EntrySource.USER
}

/** True when the user typed or chose a reason that is not blank (encounter and bed `reasonEntered`; §9.12). */
fun Chosen<String>?.isUserReason(): Boolean = this != null && byUser && value.isNotBlank()
