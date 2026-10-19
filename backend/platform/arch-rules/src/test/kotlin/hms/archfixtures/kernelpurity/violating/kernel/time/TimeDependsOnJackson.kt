package hms.archfixtures.kernelpurity.violating.kernel.time

import com.fasterxml.jackson.annotation.JsonInclude

/** Violating fixture for kernel-libraries-framework-free: the time library depends on a Jackson annotation. */
class TimeDependsOnJackson(
    val inclusion: JsonInclude.Include,
)
