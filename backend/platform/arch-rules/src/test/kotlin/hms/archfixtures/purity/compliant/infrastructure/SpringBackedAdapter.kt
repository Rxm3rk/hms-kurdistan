package hms.archfixtures.purity.compliant.infrastructure

import hms.archfixtures.purity.compliant.domain.PureAggregate
import org.springframework.core.env.Environment

/** Compliant fixture for rule (a): framework types are allowed outside the domain package. */
class SpringBackedAdapter(
    val environment: Environment,
) {
    fun describe(aggregate: PureAggregate): String = environment.getProperty("fixture.name", aggregate.id)
}
