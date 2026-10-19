package hms.archfixtures.kernelpurity.violating.kernel.quantity

import io.cloudevents.CloudEvent

/** Violating fixture for kernel-libraries-framework-free: the quantity library depends on CloudEvents (D7). */
class QuantityDependsOnCloudEvents(
    val event: CloudEvent,
)
