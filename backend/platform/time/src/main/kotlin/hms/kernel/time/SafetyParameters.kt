package hms.kernel.time

import java.util.UUID

/** §19.4 content provenance vocabulary; platform-tenancy and platform-config use this type (platform-kernel.md §6.5). */
enum class ContentProvenance { SYNTHETIC, APPROVED }

/** The deployment environment. Same values as platform-config's Environment, which may alias this type (platform-kernel.md §6.5). */
enum class EnvironmentClass { BUILD, TEST, TRAIN, PROD, PLAY }

/**
 * A value resolved from the configuration chain, with where it came from: the setting key, the content
 * provenance and the source entry (platform-kernel.md §6.5; D11). Safety parameters are built only from these.
 */
class ResolvedParameter<T : Any>(
    val key: String,
    val value: T,
    val provenance: ContentProvenance,
    /** The value entry id, or "definition-default". */
    val sourceRef: String,
    val changeSet: UUID?,
) {
    init {
        require(key.isNotBlank()) { "ResolvedParameter key must not be blank" }
        require(sourceRef.isNotBlank()) { "ResolvedParameter sourceRef must not be blank (key $key)" }
    }

    override fun equals(other: Any?): Boolean =
        other is ResolvedParameter<*> &&
            key == other.key &&
            value == other.value &&
            provenance == other.provenance &&
            sourceRef == other.sourceRef &&
            changeSet == other.changeSet

    override fun hashCode(): Int = listOf(key, value, provenance, sourceRef, changeSet).hashCode()

    override fun toString(): String = "ResolvedParameter(key=$key, value=$value, provenance=$provenance, sourceRef=$sourceRef, changeSet=$changeSet)"
}

/**
 * Kotlin opt-in marker for safety-parameter factories (D11). The binding check is
 * `ArchTest:safety-parameter-factories-only-in-resolvers` over the `SAFETY_PARAMETER_RESOLVERS` allow-list
 * (platform-kernel.md §6.5, §11).
 */
@RequiresOptIn(level = RequiresOptIn.Level.ERROR, message = "Safety parameters are built only by allow-listed resolvers (platform-kernel.md §6.5).")
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class SafetyParameterFactory

/** The result of a [SafetyParameterFactory] function (platform-kernel.md §6.5). */
sealed interface SafetyParameterResult<out T> {
    data class Built<T>(
        val parameter: T,
    ) : SafetyParameterResult<T>

    data class Refused(
        val reason: SafetyParameterRefusal,
        val key: String,
    ) : SafetyParameterResult<Nothing>
}

enum class SafetyParameterRefusal { SYNTHETIC_IN_TRAIN_OR_PROD, VALUE_OUT_OF_RANGE, KEY_MISMATCH }

/**
 * The synthetic gate every safety-parameter factory applies (§19.4 "a gate, not a label"; platform-kernel.md
 * §6.5): the first parameter with [ContentProvenance.SYNTHETIC] is refused when the environment is TRAIN or PROD.
 */
internal fun syntheticRefusal(
    environment: EnvironmentClass,
    parameters: List<ResolvedParameter<*>>,
): SafetyParameterResult.Refused? =
    parameters
        .takeIf { environment == EnvironmentClass.TRAIN || environment == EnvironmentClass.PROD }
        ?.firstOrNull { it.provenance == ContentProvenance.SYNTHETIC }
        ?.let { SafetyParameterResult.Refused(SafetyParameterRefusal.SYNTHETIC_IN_TRAIN_OR_PROD, it.key) }
