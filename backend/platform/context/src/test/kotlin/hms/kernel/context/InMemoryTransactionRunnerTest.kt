package hms.kernel.context

import hms.kernel.context.inmemory.InMemoryTransactionRunner
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

private class CheckFailed : RuntimeException("synthetic check failure")

/** The in-memory runner: before-commit checks, completion hooks and rollback-only (platform-kernel.md §7.5). */
class InMemoryTransactionRunnerTest :
    FunSpec({
        val runner: TransactionRunner = InMemoryTransactionRunner()
        val tenant = ContextFixtures.TENANT

        test("in-memory-transaction-runner-hooks: a committed block runs its checks before commit, then its hooks with true") {
            val events = mutableListOf<String>()
            val value =
                runner.inTransaction(tenant) { tx ->
                    tx.tenant shouldBe tenant
                    tx.onCompletion { events += "hook-1:$it" }
                    tx.onBeforeCommit { events += "check-1" }
                    tx.onBeforeCommit {
                        events += "check-2"
                        tx.onBeforeCommit { events += "check-3, registered by check-2" }
                    }
                    tx.onCompletion { events += "hook-2:$it" }
                    events += "block"
                    TxOutcome.Commit(42)
                }
            value shouldBe 42
            events shouldBe listOf("block", "check-1", "check-2", "check-3, registered by check-2", "hook-1:true", "hook-2:true")
        }

        test("in-memory-transaction-runner-hooks: a Rollback outcome runs no check, tells the hooks false and returns its value") {
            val events = mutableListOf<String>()
            val value =
                runner.inTransaction(tenant) { tx ->
                    tx.onBeforeCommit { events += "check" }
                    tx.onCompletion { events += "hook:$it" }
                    TxOutcome.Rollback("kept")
                }
            value shouldBe "kept"
            events shouldBe listOf("hook:false")
        }

        test("in-memory-transaction-runner-hooks: a throwing check rolls back and propagates; later checks do not run") {
            val events = mutableListOf<String>()
            val failure = CheckFailed()
            val thrown =
                shouldThrow<CheckFailed> {
                    runner.inTransaction(tenant) { tx ->
                        tx.onBeforeCommit { throw failure }
                        tx.onBeforeCommit { events += "later check" }
                        tx.onCompletion { events += "hook:$it" }
                        TxOutcome.Commit(Unit)
                    }
                }
            (thrown === failure) shouldBe true
            events shouldBe listOf("hook:false")
        }

        test("in-memory-transaction-runner-hooks: a throwing block rolls back and propagates") {
            val events = mutableListOf<String>()
            shouldThrow<CheckFailed> {
                runner.inTransaction<Unit>(tenant) { tx ->
                    tx.onBeforeCommit { events += "check" }
                    tx.onCompletion { events += "hook:$it" }
                    throw CheckFailed()
                }
            }
            events shouldBe listOf("hook:false")
        }

        test("in-memory-transaction-runner-hooks: a rollback-only transaction whose block returns Commit rolls back and throws") {
            val events = mutableListOf<String>()
            val thrown =
                shouldThrow<IllegalStateException> {
                    runner.inTransaction(tenant) { tx ->
                        tx.onBeforeCommit { events += "check" }
                        tx.onCompletion { events += "hook:$it" }
                        tx.markRollbackOnly("synthetic participant failure")
                        tx.isRollbackOnly shouldBe true
                        TxOutcome.Commit(1)
                    }
                }
            thrown.message shouldContain "synthetic participant failure"
            events shouldBe listOf("hook:false")
        }

        test("in-memory-transaction-runner-hooks: a check that marks the transaction rollback-only stops the commit") {
            val events = mutableListOf<String>()
            shouldThrow<IllegalStateException> {
                runner.inTransaction(tenant) { tx ->
                    tx.onBeforeCommit { tx.markRollbackOnly("synthetic late veto") }
                    tx.onCompletion { events += "hook:$it" }
                    TxOutcome.Commit(1)
                }
            }
            events shouldBe listOf("hook:false")
        }

        test("in-memory-transaction-runner-hooks: a rollback-only transaction whose block returns Rollback returns normally") {
            val events = mutableListOf<String>()
            val value =
                runner.inTransaction(tenant) { tx ->
                    tx.markRollbackOnly("synthetic cause")
                    tx.onCompletion { events += "hook:$it" }
                    TxOutcome.Rollback("value")
                }
            value shouldBe "value"
            events shouldBe listOf("hook:false")
        }

        test("in-memory-transaction-runner-hooks: a throwing hook does not stop the other hooks and propagates after the end") {
            val events = mutableListOf<String>()
            val first = CheckFailed()
            val second = CheckFailed()
            val thrown =
                shouldThrow<CheckFailed> {
                    runner.inTransaction(tenant) { tx ->
                        tx.onCompletion { throw first }
                        tx.onCompletion { events += "hook:$it" }
                        tx.onCompletion { throw second }
                        TxOutcome.Commit(1)
                    }
                }
            (thrown === first) shouldBe true
            thrown.suppressed.toList() shouldBe listOf(second)
            events shouldBe listOf("hook:true")
        }

        test("in-memory-transaction-runner-hooks: a blank cause and use after the end are programming errors") {
            var ended: TransactionContext? = null
            runner.inTransaction(tenant) { tx ->
                shouldThrow<IllegalArgumentException> { tx.markRollbackOnly(" ") }
                tx.isRollbackOnly shouldBe false
                ended = tx
                TxOutcome.Commit(Unit)
            }
            val tx = checkNotNull(ended)
            shouldThrow<IllegalStateException> { tx.onBeforeCommit {} }
            shouldThrow<IllegalStateException> { tx.onCompletion {} }
            shouldThrow<IllegalStateException> { tx.markRollbackOnly("late") }
        }

        test("in-memory-transaction-runner-hooks: each call is its own transaction") {
            val events = mutableListOf<String>()
            runner.inTransaction(tenant) { outer ->
                outer.onCompletion { events += "outer:$it" }
                runner.inTransaction(tenant) { inner ->
                    inner.onCompletion { events += "inner:$it" }
                    TxOutcome.Rollback(Unit)
                }
                outer.isRollbackOnly shouldBe false
                TxOutcome.Commit(Unit)
            }
            events shouldBe listOf("inner:false", "outer:true")
        }
    })
