import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep("""
private infix fun QueryStage?.shouldNotBe(other: QueryStage) {
    listOf(other) shouldNotContain this
}
""", "")
rep("import io.kotest.matchers.collections.shouldNotContain\nimport io.kotest.matchers.shouldBe\n",
    "import io.kotest.matchers.shouldBe\nimport io.kotest.matchers.shouldNotBe\n")
rep("""private fun CreditClaimFacts.oracleReference(): Money? =
    if (finalApproval != null) finalApproval.payerPayable else appeal?.amountAppealed ?: dischargeAuthRequest?.amountRequested
""", """private fun CreditClaimFacts.oracleReference(): Money? =
    when {
        finalApproval != null -> finalApproval.payerPayable
        appeal != null -> appeal.amountAppealed
        else -> dischargeAuthRequest?.amountRequested
    }
""")
rep("""                            appliesTo = { it.fired?.to == CreditClaimState.SETTLED && it.fired?.on == CreditClaimCommand.RecordSettlement },""",
    """                            appliesTo = { it.fired?.on == CreditClaimCommand.RecordSettlement && it.fired?.to == CreditClaimState.SETTLED },""")
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
