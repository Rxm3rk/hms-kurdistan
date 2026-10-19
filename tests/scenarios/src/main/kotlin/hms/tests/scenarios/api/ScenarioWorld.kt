package hms.tests.scenarios.api

import kotlin.reflect.KClass

/**
 * The world one scenario runs in, made fresh for every scenario: the simulated [clock], the synthetic [patients]
 * and the domain [ports] its suite's binding bound. Nothing in it reads the host clock or real data.
 */
class ScenarioWorld(
    val clock: SimulatedClock,
    val patients: SyntheticPatients,
    val ports: BoundPorts,
)

/**
 * The domain ports a [SuiteBinding] binds for one scenario, by type. Asking for a port that is not bound fails
 * with [PortNotBoundException], which the runner reports as FAIL: a step never runs against a missing port.
 */
class BoundPorts private constructor(
    private val ports: Map<KClass<*>, Any>,
) {
    /** The bound port of [type]. */
    fun <T : Any> get(type: KClass<T>): T = type.java.cast(ports[type] ?: throw PortNotBoundException(type.java.name, names()))

    /** The bound port of type [T]. */
    inline fun <reified T : Any> get(): T = get(T::class)

    /** The bound port types, sorted. */
    fun names(): List<String> = ports.keys.map { it.java.name }.sorted()

    /** Builds a [BoundPorts]; each port is bound under the type it is given for. */
    class Builder {
        private val ports = LinkedHashMap<KClass<*>, Any>()

        /** Binds [port] as the implementation of [type]. */
        fun <T : Any> bind(
            type: KClass<T>,
            port: T,
        ): Builder {
            require(type !in ports) { "port ${type.java.name} is bound twice" }
            ports[type] = port
            return this
        }

        /** The ports bound so far. */
        fun build(): BoundPorts = BoundPorts(ports.toMap())
    }

    companion object {
        /** No ports at all. */
        val NONE: BoundPorts = BoundPorts(emptyMap())

        /** A builder for the ports of one scenario. */
        fun builder(): Builder = Builder()
    }
}

/** A step asked for a port its binding did not bind. */
class PortNotBoundException(
    type: String,
    bound: List<String>,
) : IllegalStateException("port $type is not bound (bound: ${bound.ifEmpty { listOf("none") }.joinToString()})")
