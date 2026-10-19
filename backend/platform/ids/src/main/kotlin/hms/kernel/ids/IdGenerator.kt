package hms.kernel.ids

import java.util.UUID

/**
 * Makes identifiers (platform-kernel spec §5; BUILD-PROMPT §5.3). Inject it; domain code never calls a
 * static generator. Production binds one [UuidV7Generator] per JVM; tests drive one with a `TestClock`.
 */
fun interface IdGenerator {
    /** A new UUIDv7. */
    fun newId(): UUID
}
