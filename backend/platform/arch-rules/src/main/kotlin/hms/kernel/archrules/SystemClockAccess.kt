package hms.kernel.archrules

import com.tngtech.archunit.base.DescribedPredicate
import com.tngtech.archunit.core.domain.JavaCall
import com.tngtech.archunit.core.domain.JavaClass

/**
 * What counts as reading the system clock for rule (d) (BUILD-PROMPT §6.2: inject `Clock`; never call
 * `now()` inside the domain).
 *
 * The rule covers the calls §6.2 names (`Instant.now()`, `LocalDate.now()`, `LocalDateTime.now()`,
 * `ZonedDateTime.now()`, `OffsetDateTime.now()`, `System.currentTimeMillis()`, `Clock.systemUTC()`,
 * `Clock.systemDefaultZone()`) and tightens them to every other hidden time source on the JVM: the
 * `now(ZoneId)` overloads and the other `java.time` types, system-backed `Clock` and `InstantSource`
 * factories, `System.nanoTime()`, `Date()`, `Calendar.getInstance()` and `GregorianCalendar()`, and the
 * Kotlin and kotlinx-datetime system clocks. Calls that pass a `Clock` remain allowed.
 */
internal object SystemClockAccess {
    private const val CLOCK = "java.time.Clock"
    private const val CONSTRUCTOR = "<init>"

    /** `java.time` types whose `now(...)` reads the system clock unless a `Clock` is passed. */
    private val nowOwners: Set<String> =
        setOf(
            "java.time.Instant",
            "java.time.LocalDate",
            "java.time.LocalDateTime",
            "java.time.LocalTime",
            "java.time.ZonedDateTime",
            "java.time.OffsetDateTime",
            "java.time.OffsetTime",
            "java.time.Year",
            "java.time.YearMonth",
            "java.time.MonthDay",
        )

    /** Static methods that read the clock or return a system-backed clock, by owner. */
    private val systemMethods: Map<String, Set<String>> =
        mapOf(
            CLOCK to setOf("systemUTC", "systemDefaultZone", "system", "tickMillis", "tickSeconds", "tickMinutes"),
            "java.time.InstantSource" to setOf("system"),
            "java.lang.System" to setOf("currentTimeMillis", "nanoTime"),
            "java.util.Calendar" to setOf("getInstance"),
        )

    /** System time-source objects; any use of them in domain code is a violation. */
    private val timeSourceTypes: Set<String> =
        setOf(
            "kotlin.time.Clock\$System",
            "kotlin.time.TimeSource\$Monotonic",
            "kotlinx.datetime.Clock\$System",
        )

    /** Matches calls that read the system clock. */
    val calls: DescribedPredicate<JavaCall<*>> =
        DescribedPredicate.describe("read the system clock") { call -> readsSystemClock(call) }

    /** Matches the Kotlin and kotlinx-datetime system time sources. */
    val timeSources: DescribedPredicate<JavaClass> =
        DescribedPredicate.describe("are system time sources ${timeSourceTypes.sorted()}") { type ->
            type.fullName in timeSourceTypes
        }

    private fun readsSystemClock(call: JavaCall<*>): Boolean {
        val target = call.target
        val owner = target.owner.fullName
        val parameters = target.rawParameterTypes.map { it.fullName }
        return when {
            owner in nowOwners && target.name == "now" -> CLOCK !in parameters
            target.name == CONSTRUCTOR -> constructorCapturesNow(owner, parameters)
            else -> target.name in systemMethods[owner].orEmpty()
        }
    }

    private fun constructorCapturesNow(
        owner: String,
        parameters: List<String>,
    ): Boolean =
        when (owner) {
            "java.util.Date" -> parameters.isEmpty()
            "java.util.GregorianCalendar" -> parameters.none { it == "int" }
            else -> false
        }
}
