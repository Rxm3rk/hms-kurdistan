package hms.archfixtures.purity.compliant.domain

import java.time.Instant

/** Compliant fixture for rule (a): domain code using only Kotlin and the JDK's java.time. */
data class PureAggregate(
    val id: String,
    val recordedAt: Instant,
) {
    fun withId(newId: String): PureAggregate = copy(id = newId)
}
