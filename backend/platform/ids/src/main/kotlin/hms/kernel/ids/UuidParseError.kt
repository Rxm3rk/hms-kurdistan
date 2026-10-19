package hms.kernel.ids

/** Why [UuidV7.parse] refused its input (platform-kernel spec §5). */
enum class UuidParseError {
    /** Not exactly 36 characters of ASCII hex in the `8-4-4-4-12` form. */
    MALFORMED,

    /** Canonical text, but the version nibble is not 7. */
    NOT_VERSION_7,

    /** Version 7, but the variant bits are not the RFC 9562 `10`. */
    NOT_RFC_9562_VARIANT,
}
