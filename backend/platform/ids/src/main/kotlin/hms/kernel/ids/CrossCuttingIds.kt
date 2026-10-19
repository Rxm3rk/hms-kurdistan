package hms.kernel.ids

import java.util.UUID

// The typed ids that cross every module (platform-kernel spec §5, D1). Each refuses a UUID that is not a
// version 7 UUID with the RFC 9562 variant (IllegalArgumentException, a programming error).

/** A tenant. */
@JvmInline
value class TenantId(
    override val value: UUID,
) : TypedId {
    init {
        UuidV7.requireV7(value)
    }
}

/** A facility of a tenant. */
@JvmInline
value class FacilityId(
    override val value: UUID,
) : TypedId {
    init {
        UuidV7.requireV7(value)
    }
}

/** A person in `empi`, never an MRN. */
@JvmInline
value class PatientId(
    override val value: UUID,
) : TypedId {
    init {
        UuidV7.requireV7(value)
    }
}

/** An HMS user account issued by `trust-identity`, never an IdP subject and never a practitioner record. */
@JvmInline
value class UserId(
    override val value: UUID,
) : TypedId {
    init {
        UuidV7.requireV7(value)
    }
}
