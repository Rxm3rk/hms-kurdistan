package hms.archfixtures.kernelpurity.violating.kernel.context

import jakarta.inject.Provider

/** Violating fixture for kernel-libraries-framework-free: the context library depends on Jakarta. */
class ContextDependsOnJakarta(
    val provider: Provider<String>,
)
