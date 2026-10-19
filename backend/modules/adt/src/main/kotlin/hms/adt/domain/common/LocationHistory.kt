package hms.adt.domain.common

import java.time.Instant

/**
 * One bed period of an encounter's location history, in clinical time (R11 §5 key rule: the location history is the
 * single source of truth for bed occupancy; §8.2; §9.12). The period is half-open, `[start, end)`; an open period has
 * no [end]. A period marked [enteredInError] is kept, never deleted (§8.1 P3), and every occupancy check ignores it.
 */
data class LocationPeriod(
    val id: String,
    val encounterId: String,
    val bedId: String,
    val start: Instant,
    val end: Instant?,
    val enteredInError: Boolean = false,
)

/** One leave-of-absence entry of an encounter's location history; the bed period stays open (held) during it (§9.12). */
data class LeaveEntry(
    val id: String,
    val encounterId: String,
    val start: Instant,
    val end: Instant?,
    val enteredInError: Boolean = false,
)

/**
 * The exclusion constraint over location periods (§8.2 "one authority and an exclusion constraint against double
 * occupancy"; §9.12 acceptance; encounter.yaml `targetBedFreeForNewPeriod`, bed.yaml `noOverlappingOccupancy`),
 * implemented once for both machines.
 */
object Occupancy {
    /** True when the half-open intervals `[aStart, aEnd)` and `[bStart, bEnd)` share an instant; a null end is open. */
    fun overlaps(
        aStart: Instant,
        aEnd: Instant?,
        bStart: Instant,
        bEnd: Instant?,
    ): Boolean = (bEnd == null || aStart < bEnd) && (aEnd == null || bStart < aEnd)

    /**
     * The periods in [periods] that are on [bedId], not entered in error, of an encounter not in [excluding], and
     * overlap `[start, end)`.
     */
    fun conflicts(
        periods: List<LocationPeriod>,
        bedId: String,
        excluding: Set<String>,
        start: Instant,
        end: Instant?,
    ): List<LocationPeriod> =
        periods.filter {
            it.bedId == bedId && !it.enteredInError && it.encounterId !in excluding && overlaps(start, end, it.start, it.end)
        }

    /** The open, valid (not entered-in-error) bed periods of [encounterId]. */
    fun openPeriodsOf(
        periods: List<LocationPeriod>,
        encounterId: String,
    ): List<LocationPeriod> = periods.filter { it.encounterId == encounterId && !it.enteredInError && it.end == null }
}
