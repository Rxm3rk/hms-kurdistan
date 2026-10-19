package hms.kernel.ids

import java.util.UUID

/**
 * Implemented by every typed id (platform-kernel spec §5). The kernel declares the four ids that cross every
 * module; every other typed id is a value class in its owning module's `api` package that checks the version
 * in `init` with [UuidV7.requireV7].
 */
interface TypedId {
    /** The UUIDv7. */
    val value: UUID
}

/** Makes a typed id: `ids.next(::TaskId)`. */
fun <T : TypedId> IdGenerator.next(wrap: (UUID) -> T): T = wrap(newId())
