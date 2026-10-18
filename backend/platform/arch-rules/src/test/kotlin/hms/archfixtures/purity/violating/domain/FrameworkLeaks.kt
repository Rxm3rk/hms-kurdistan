package hms.archfixtures.purity.violating.domain

import com.fasterxml.jackson.annotation.JsonInclude
import io.temporal.client.WorkflowClient
import jakarta.inject.Provider
import org.apache.kafka.clients.producer.Producer
import org.jooq.DSLContext
import org.springframework.core.env.Environment
import tools.jackson.core.JsonParser
import javax.sql.DataSource

// Violating fixtures for rule (a): one domain class per forbidden framework package.

class UsesSpring(
    val environment: Environment,
)

class UsesJakarta(
    val provider: Provider<String>,
)

class UsesJavax(
    val dataSource: DataSource,
)

class UsesJooq(
    val dsl: DSLContext,
)

class UsesJackson2Annotations(
    val inclusion: JsonInclude.Include,
)

class UsesJackson3(
    val parser: JsonParser,
)

class UsesTemporal(
    val client: WorkflowClient,
)

class UsesKafka(
    val producer: Producer<String, String>,
)
