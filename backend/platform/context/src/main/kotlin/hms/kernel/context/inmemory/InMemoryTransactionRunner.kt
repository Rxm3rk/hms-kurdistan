package hms.kernel.context.inmemory

import hms.kernel.context.TransactionContext
import hms.kernel.context.TransactionRunner
import hms.kernel.context.TxOutcome
import hms.kernel.ids.TenantId

/**
 * The [TransactionRunner] for tests and the dev profile (platform-kernel.md §7.5; D8). Production wiring never
 * binds it (`ArchTest:production-never-binds-test-adapters`). It holds no data itself: the in-memory adapters
 * of the journal and the modules enlist through [TransactionContext.onCompletion] to keep or drop their changes.
 *
 * Each call opens its own transaction, used from one thread. A block that returns Commit commits when the
 * transaction is not rollback-only and every before-commit check returns, the checks running in registration
 * order (a check may register further checks, which run too). Any throw from the block or a check rolls back
 * and propagates. The completion hooks then run in registration order; if a hook throws, the remaining hooks
 * still run and the first throw propagates afterwards (the others are added to it as suppressed).
 */
class InMemoryTransactionRunner : TransactionRunner {
    override fun <T> inTransaction(
        tenant: TenantId,
        block: (TransactionContext) -> TxOutcome<T>,
    ): T {
        val transaction = InMemoryTransaction(tenant)
        val result = runCatching { transaction.run(block) }
        val hookFailure = transaction.complete(committed = result.isSuccess && transaction.committed)
        result.exceptionOrNull()?.let { failure ->
            hookFailure?.let(failure::addSuppressed)
            throw failure
        }
        if (hookFailure != null) throw hookFailure
        return result.getOrThrow()
    }
}

private class InMemoryTransaction(
    override val tenant: TenantId,
) : TransactionContext {
    private val beforeCommit = mutableListOf<() -> Unit>()
    private val completion = mutableListOf<(Boolean) -> Unit>()
    private var rollbackCause: String? = null
    private var ended = false

    var committed: Boolean = false
        private set

    override val isRollbackOnly: Boolean get() = rollbackCause != null

    override fun markRollbackOnly(cause: String) {
        require(cause.isNotBlank()) { "markRollbackOnly needs a non-blank cause" }
        checkOpen()
        if (rollbackCause == null) rollbackCause = cause
    }

    override fun onBeforeCommit(check: () -> Unit) {
        checkOpen()
        beforeCommit += check
    }

    override fun onCompletion(hook: (committed: Boolean) -> Unit) {
        checkOpen()
        completion += hook
    }

    fun <T> run(block: (TransactionContext) -> TxOutcome<T>): T =
        when (val outcome = block(this)) {
            is TxOutcome.Rollback -> {
                outcome.value
            }

            is TxOutcome.Commit -> {
                checkNotRollbackOnly()
                var index = 0
                while (index < beforeCommit.size) {
                    beforeCommit[index]()
                    index++
                }
                checkNotRollbackOnly()
                committed = true
                outcome.value
            }
        }

    /** Ends the transaction and runs the completion hooks; returns the first hook failure, if any. */
    fun complete(committed: Boolean): Throwable? {
        ended = true
        var firstFailure: Throwable? = null
        completion.forEach { hook ->
            runCatching { hook(committed) }.exceptionOrNull()?.let { failure ->
                val first = firstFailure
                if (first == null) firstFailure = failure else first.addSuppressed(failure)
            }
        }
        return firstFailure
    }

    private fun checkNotRollbackOnly() {
        val cause = rollbackCause
        check(cause == null) { "the block returned Commit but the transaction is rollback-only ($cause); rolled back" }
    }

    private fun checkOpen() {
        check(!ended) { "the transaction has already ended" }
    }
}
