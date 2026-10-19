package hms.kernel.context

import hms.kernel.ids.TenantId
import hms.kernel.time.AsOf
import hms.kernel.time.EntryTimePolicyLookup
import hms.kernel.time.TimingClass

/**
 * The caller's open transaction (platform-kernel.md §7.5; ADR-004). Implemented by the runners: the journal's
 * jOOQ adapter in production, [hms.kernel.context.inmemory.InMemoryTransactionRunner] in tests and the dev
 * profile. It carries no time: a module that needs the append's recorded time reads it from the append result.
 */
interface TransactionContext {
    /** The tenant the transaction was opened for. */
    val tenant: TenantId

    /** True once any participant called [markRollbackOnly]. */
    val isRollbackOnly: Boolean

    /** Dooms the transaction. cause: non-blank, for the log; never PHI. */
    fun markRollbackOnly(cause: String)

    /** Runs before commit; a throw rolls the transaction back and propagates. */
    fun onBeforeCommit(check: () -> Unit)

    /** Runs after the end; committed is false after a rollback. */
    fun onCompletion(hook: (committed: Boolean) -> Unit)
}

/**
 * Runs a block in one transaction (platform-kernel.md §7.5). A plain interface, not a `fun interface` as the
 * spec writes it: Kotlin does not allow a type parameter on a fun interface's single function.
 */
interface TransactionRunner {
    /**
     * Runs block in one transaction; commits only when block returns TxOutcome.Commit, otherwise rolls back.
     * A rollback-only transaction whose block returns Commit rolls back and throws IllegalStateException.
     */
    fun <T> inTransaction(
        tenant: TenantId,
        block: (TransactionContext) -> TxOutcome<T>,
    ): T
}

/** What a transaction block decides (platform-kernel.md §7.5); either way the value is returned to the caller. */
sealed interface TxOutcome<T> {
    data class Commit<T>(
        val value: T,
    ) : TxOutcome<T>

    data class Rollback<T>(
        val value: T,
    ) : TxOutcome<T>
}

/**
 * Marker with no members for every in-memory repository or store of the journal and of every module
 * (platform-kernel.md §7.5; D8). Each module's start-up guard refuses a `VolatileStore` binding whenever an
 * environment class is set; volatile stores are allowed only in the dev profile with no environment class.
 */
interface VolatileStore

/** Port: the SI-10 tolerances of a timing class (platform-kernel.md §6.3, §7.6). Implemented by platform-tenancy's resolver. */
fun interface EntryTimePolicySource {
    /** The policy of [timingClass] for the context's tenant and facility, as configured at [at]. */
    fun policyFor(
        context: CommandContext,
        timingClass: TimingClass,
        at: AsOf,
    ): EntryTimePolicyLookup
}
