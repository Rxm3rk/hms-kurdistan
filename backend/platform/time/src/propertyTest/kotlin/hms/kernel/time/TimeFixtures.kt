package hms.kernel.time

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID

/** Synthetic test values for hms.kernel.time (§19.4: every configuration value here is SYNTHETIC). */
@OptIn(SafetyParameterFactory::class, EpisodeRegistryOnly::class)
internal object TimeFixtures {
    val VITAL_SIGN: TimingClass = TimingClass("vital-sign")

    fun recordedAt(instant: Instant): RecordedTime = RecordedTime.now(Clock.fixed(instant, ZoneOffset.UTC))

    fun parameter(
        key: String,
        value: Duration,
        provenance: ContentProvenance = ContentProvenance.SYNTHETIC,
    ): ResolvedParameter<Duration> = ResolvedParameter(key, value, provenance, "test-entry-$key", null)

    fun parameters(
        values: List<Duration>,
        timingClass: TimingClass = VITAL_SIGN,
        provenance: ContentProvenance = ContentProvenance.SYNTHETIC,
    ): List<ResolvedParameter<Duration>> = EntryTimePolicy.keys(timingClass).zip(values) { key, value -> parameter(key, value, provenance) }

    fun build(
        parameters: List<ResolvedParameter<Duration>>,
        timingClass: TimingClass = VITAL_SIGN,
        environment: EnvironmentClass = EnvironmentClass.TEST,
    ): SafetyParameterResult<EntryTimePolicy> =
        EntryTimePolicy.fromResolved(timingClass, parameters[0], parameters[1], parameters[2], parameters[3], environment)

    fun policy(
        contemporaneous: Duration,
        future: Duration,
        interfaceLateness: Duration,
        offlineCapture: Duration,
    ): EntryTimePolicy {
        val result = build(parameters(listOf(contemporaneous, future, interfaceLateness, offlineCapture)))
        return (result as SafetyParameterResult.Built).parameter
    }

    fun episode(
        start: Instant,
        endExclusive: Instant?,
        id: UUID = UUID.fromString("01890a5d-ac96-774b-bcce-b302099a8057"),
    ): BackEntryEpisode {
        val window =
            if (endExclusive == null) ValidPeriod.from(start) else (ValidPeriod.of(start, endExclusive) as ValidPeriodResult.Valid).period
        return BackEntryEpisode.fromRegistry(id, window)
    }

    fun clinical(
        instant: Instant,
        offset: ZoneOffset = ZoneOffset.ofHours(3),
    ): ClinicalTime = ClinicalTime.of(instant, offset)

    fun given(
        start: ClinicalTime,
        endExclusive: ClinicalTime? = null,
    ): ValidTimeInput.Given =
        ValidTimeInput.Given(
            if (endExclusive == null) ValidTime.from(start) else (ValidTime.of(start, endExclusive) as ValidTimeResult.Valid).validTime,
        )
}
