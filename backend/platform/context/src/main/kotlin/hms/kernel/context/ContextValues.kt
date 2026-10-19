package hms.kernel.context

import hms.kernel.ids.UuidV7
import java.util.UUID

// The small values a command context carries (platform-kernel.md §7.1, §7.6). Each checks its form in `init`
// and throws IllegalArgumentException otherwise (a programming error, platform-kernel.md §3).

/** A registered device (workstation, handheld, scanner): a UUIDv7 from the device registry. */
@JvmInline
value class DeviceRef(
    val id: UUID,
) {
    init {
        UuidV7.requireV7(id)
    }
}

/** A registered interface channel: a UUIDv7 from the interface registry (the Hub). */
@JvmInline
value class InterfaceChannelRef(
    val id: UUID,
) {
    init {
        UuidV7.requireV7(id)
    }
}

/** A migration run of the migration loader (§8.3): its UUIDv7. */
@JvmInline
value class MigrationRunRef(
    val id: UUID,
) {
    init {
        UuidV7.requireV7(id)
    }
}

/** A named platform process acting as the SYSTEM actor, for example "platform-tasks.orphan-scan". Grammar `[a-z][a-z0-9.-]*`. */
@JvmInline
value class SystemProcess(
    val name: String,
) {
    init {
        require(isValid(name)) { "SystemProcess name must match [a-z][a-z0-9.-]*, got '$name'" }
    }

    internal companion object {
        private val NAME = Regex("[a-z][a-z0-9.-]*")

        fun isValid(name: String): Boolean = NAME.matches(name)
    }
}

/**
 * Why the data is used (R07 AZ-7): a code from the Trust Plane vocabulary (WP-0.4). The kernel checks only
 * its form, non-blank and at most 64 characters, and defines no values (OQ-KN13).
 */
@JvmInline
value class PurposeOfUse(
    val code: String,
) {
    init {
        require(isValid(code)) { "PurposeOfUse code must be non-blank and at most $MAX_LENGTH characters" }
    }

    internal companion object {
        const val MAX_LENGTH = 64

        fun isValid(code: String): Boolean = code.isNotBlank() && code.length <= MAX_LENGTH
    }
}

/** The command's `Idempotency-Key` (§6.3): 1 to 200 visible ASCII characters (0x21 to 0x7E), the journal's limit. */
@JvmInline
value class IdempotencyKey(
    val value: String,
) {
    init {
        require(isValid(value)) { "IdempotencyKey must be 1 to $MAX_LENGTH visible ASCII characters" }
    }

    internal companion object {
        const val MAX_LENGTH = 200
        private const val FIRST_VISIBLE = '!'
        private const val LAST_VISIBLE = '~'

        fun isValid(value: String): Boolean = value.length in 1..MAX_LENGTH && value.all { it in FIRST_VISIBLE..LAST_VISIBLE }
    }
}

/** Ties together every command and event of one piece of work: a UUIDv7. */
@JvmInline
value class CorrelationId(
    val value: UUID,
) {
    init {
        UuidV7.requireV7(value)
    }
}

/** The event or command that caused this one; a command that is a first cause has none. */
@JvmInline
value class CausationId(
    val value: UUID,
)
