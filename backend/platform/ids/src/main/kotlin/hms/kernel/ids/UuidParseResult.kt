package hms.kernel.ids

import java.util.UUID

/** The outcome of [UuidV7.parse] (platform-kernel spec §5): input is a business outcome, never an exception. */
sealed interface UuidParseResult {
    /** A canonical version 7 UUID with the RFC 9562 variant. */
    data class Valid(
        val uuid: UUID,
    ) : UuidParseResult

    /** Why the text is not a UUIDv7. */
    data class Invalid(
        val error: UuidParseError,
    ) : UuidParseResult
}
