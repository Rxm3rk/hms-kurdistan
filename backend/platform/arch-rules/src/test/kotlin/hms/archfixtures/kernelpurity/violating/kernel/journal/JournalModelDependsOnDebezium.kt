package hms.archfixtures.kernelpurity.violating.kernel.journal

import io.debezium.archfixtures.DebeziumStandIn

/** Violating fixture for kernel-journal-framework-free-outside-infrastructure: the journal model depends on Debezium. */
class JournalModelDependsOnDebezium(
    val change: DebeziumStandIn,
)
