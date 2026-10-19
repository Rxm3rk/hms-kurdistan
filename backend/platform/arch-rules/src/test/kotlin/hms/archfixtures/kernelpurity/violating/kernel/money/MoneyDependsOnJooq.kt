package hms.archfixtures.kernelpurity.violating.kernel.money

import org.jooq.DSLContext

/** Violating fixture for kernel-libraries-framework-free: the money library depends on jOOQ. */
class MoneyDependsOnJooq(
    val dsl: DSLContext,
)
