package hms.archfixtures.kernelpurity.compliant.kernel.time

import java.time.Instant

/** Compliant fixture: a kernel type that uses only the JDK and the Kotlin standard library. */
class PureKernelType(
    val at: Instant,
)
