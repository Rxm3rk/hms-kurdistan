import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep('''private val checklist = DocumentChecklist(mandatory = setOf("SYN-DOC-A", "SYN-DOC-B"), attached = setOf("SYN-DOC-A", "SYN-DOC-B", "SYN-DOC-C"))''',
    '''private val checklist =
    DocumentChecklist(mandatory = setOf("SYN-DOC-A", "SYN-DOC-B"), attached = setOf("SYN-DOC-A", "SYN-DOC-B", "SYN-DOC-C"))''')
rep('''private val line = ClaimLineFacts("SYN-LINE-1", SERVICE, START.plusDays(1), units = 3, exception = null, disposition = LineDisposition.PAID_BY_PAYER)''',
    '''private val line =
    ClaimLineFacts("SYN-LINE-1", SERVICE, START.plusDays(1), units = 3, exception = null, disposition = LineDisposition.PAID_BY_PAYER)''')
rep('''        settlement = SettlementFacts("SYN-PAY-0001", START.plusDays(30), iqd(800_000), listOf(SettlementDeduction(NO_REASON, ReasonOrigin.USER))),
        denial = DenialFacts("SYN-PAYER-D-0001", listOf(DenialReason("SYN-DEN-NOT-COVERED", DenialRootCause.ELIGIBILITY, ReasonOrigin.USER))),
        appeal = AppealFacts("SYN-APL-TPL-1", "the deduction contradicts the contract", setOf("SYN-LINE-1"), iqd(50_000), setOf("SYN-DOC-E")),
''', '''        settlement =
            SettlementFacts("SYN-PAY-0001", START.plusDays(30), iqd(800_000), listOf(SettlementDeduction(NO_REASON, ReasonOrigin.USER))),
        denial =
            DenialFacts("SYN-PAYER-D-0001", listOf(DenialReason("SYN-DEN-NOT-COVERED", DenialRootCause.ELIGIBILITY, ReasonOrigin.USER))),
        appeal =
            AppealFacts("SYN-APL-TPL-1", "the deduction contradicts the contract", setOf("SYN-LINE-1"), iqd(50_000), setOf("SYN-DOC-E")),
''')
rep('''        correction = CorrectionFacts(holdsCorrectionPrivilege = true, auditWritable = true, reason = "late remittance", reasonOrigin = ReasonOrigin.USER),''',
    '''        correction =
            CorrectionFacts(holdsCorrectionPrivilege = true, auditWritable = true, reason = "late remittance", reasonOrigin = ReasonOrigin.USER),''')
rep('''private fun CreditClaimFacts.withFinal(transform: FinalApprovalFacts.() -> FinalApprovalFacts) = copy(finalApproval = finalApproval?.transform())''',
    '''private fun CreditClaimFacts.withFinal(transform: FinalApprovalFacts.() -> FinalApprovalFacts) =
    copy(finalApproval = finalApproval?.transform())''')
rep('''private val exception = FlaggedException("SYN-LINE-1", "SYN-EXC-EMERGENCY-UPGRADE", ReasonOrigin.USER, "SYN-USR-DESK-01", flaggedByAuthenticated = true)''',
    '''private val exception =
    FlaggedException("SYN-LINE-1", "SYN-EXC-EMERGENCY-UPGRADE", ReasonOrigin.USER, "SYN-USR-DESK-01", flaggedByAuthenticated = true)''')
rep('''            (EncounterStatus.entries.filterNot { it == EncounterStatus.DISCHARGED_NOT_CLOSED || it == EncounterStatus.FINISHED } + listOf(null))
                .forEach''', '''            val notDischarged = EncounterStatus.entries.filterNot { it == EncounterStatus.DISCHARGED_NOT_CLOSED || it == EncounterStatus.FINISHED }
            (notDischarged + listOf(null))
                .forEach''')
rep('''                base.withDischargeAuth { copy(episodeInvestigations = emptySet(), referencedInvestigations = emptySet(), investigationsRecordedAsNone = true) },''',
    '''                base.withDischargeAuth {
                    copy(episodeInvestigations = emptySet(), referencedInvestigations = emptySet(), investigationsRecordedAsNone = true)
                },''')
rep('''test("everyLineWithinPreApprovalOrFlagged counts units over all lines of the service: equal to the approved units holds, more fails") {''',
    '''test("everyLineWithinPreApprovalOrFlagged counts units over all lines of a service: equal to approved holds, more fails") {''')
rep('''test("everyLineWithinPreApprovalOrFlagged fails for an unapproved service or a date outside validity; the boundaries are included") {''',
    '''test("everyLineWithinPreApprovalOrFlagged fails for an unapproved service or a date outside validity; boundaries included") {''')
rep('''test("everyLineWithinPreApprovalOrFlagged fails for an exception with another line, an ungoverned or defaulted reason, or no user") {''',
    '''test("everyLineWithinPreApprovalOrFlagged fails for an exception naming another line, an ungoverned reason, or no user") {''')
rep('''test("settledInFull without a final approval uses the amount appealed, else the discharge-authorisation amount (settledShort complements)") {''',
    '''test("settledInFull without a final approval uses the amount appealed, else the amount requested (settledShort complements)") {''')
p.write_text(s, encoding="utf-8", newline="\n")
for n, line in enumerate(s.splitlines(), 1):
    if len(line) > 140:
        print(n, len(line), line.strip()[:90])
