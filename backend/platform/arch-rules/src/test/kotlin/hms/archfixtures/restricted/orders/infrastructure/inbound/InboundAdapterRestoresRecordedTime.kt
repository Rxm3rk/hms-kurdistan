package hms.archfixtures.restricted.orders.infrastructure.inbound

import hms.archfixtures.restricted.kernel.time.PersistenceOnly
import hms.archfixtures.restricted.kernel.time.RecordedTime
import java.time.Instant

/** Violating fixture for persistence-only-factories: an inbound adapter turning a request instant into a recorded time. */
class InboundAdapterRestoresRecordedTime {
    @OptIn(PersistenceOnly::class)
    fun fromRequest(instant: Instant): RecordedTime = RecordedTime.restore(instant)
}
