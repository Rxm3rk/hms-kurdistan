package hms.archfixtures.kernelpurity.violating.kernel.ids

import org.springframework.core.env.Environment

/** Violating fixture for kernel-libraries-framework-free: the ids library depends on Spring. */
class IdsDependOnSpring(
    val environment: Environment,
)
