package hms.results.domain.result

import java.time.Duration
import java.time.Instant

/**
 * Synthetic result facts for the unit tests, the property tests and the SI scaffold (docs/specs/state-machines/result.yaml;
 * docs/specs/modules/state-machines-and-invariants.md §2.3). NOT FOR CLINICAL USE: every identifier is `SYN-`, the reason
 * codes are invented samples, and no value is a real threshold, code or range (§3.4 item 3, §3.5).
 *
 * [facts] is a baseline in which every positive predicate holds: the version is validated, its specimen usable, its QC
 * valid, no value is critical, the patient is an inpatient in progress (not discharged), every reason is chosen, the
 * action is privileged and audited, and autoverification is active with a release verdict. Tests change one part with
 * `copy` to make one predicate fail.
 */
object ResultSamples {
    /** The time of the command in every sample. */
    val NOW: Instant = Instant.parse("2026-10-19T08:00:00Z")

    /** When the sample version's values last changed. */
    val LAST_VALUE_CHANGE: Instant = NOW.minus(Duration.ofMinutes(MINUTES_SINCE_CHANGE))

    /** When the sample new measurement was made. */
    val MEASURED_AT: Instant = LAST_VALUE_CHANGE.minus(Duration.ofMinutes(MINUTES_MEASUREMENT_BEFORE_CHANGE))

    /** The sample result. */
    const val RESULT_ID: String = "SYN-RES-0001"

    /** The result's current filed version in the samples. */
    const val CURRENT_VERSION_ID: String = "SYN-RES-0001-V1"

    /** The version the sample command files. */
    const val FILED_VERSION_ID: String = "SYN-RES-0001-V2"

    /** The sample technologist, who issues the command. */
    const val USER_ID: String = "SYN-USER-TECH-01"

    /** Another user. */
    const val OTHER_USER_ID: String = "SYN-USER-TECH-02"

    /** The sample specimen. */
    const val SPECIMEN_ID: String = "SYN-SPEC-0001"

    /** The reg-lis-rules version running in the samples. */
    const val FUNCTION_VERSION: String = "SYN-REG-LIS-RULES-1.1.0"

    /** The tenant's jurisdiction in the samples. */
    const val JURISDICTION: String = "SYN-JURISDICTION-KRI"

    /** The rule-set version validated under the sample Register entry. */
    const val RULE_SET_VERSION: String = "SYN-RULESET-7"

    /** Sample correction reason code (NOT FOR CLINICAL USE). */
    const val CORRECTION_CODE: String = "SYN-CORR-TRANSCRIPTION"

    /** Sample cancellation reason code (NOT FOR CLINICAL USE). */
    const val CANCELLATION_CODE: String = "SYN-CANC-TEST-NOT-PERFORMED"

    /** Sample entered-in-error reason code (NOT FOR CLINICAL USE). */
    const val ERROR_CODE: String = "SYN-EIE-WRONG-PATIENT"

    /** The sample test. */
    val TEST: TestIdentity =
        TestIdentity(
            laboratorySection = "SYN-SECTION-CHEM",
            analyte = "SYN-ANALYTE-001",
            specimenType = "SYN-SPECIMEN-TYPE-SERUM",
            method = "SYN-METHOD-01",
            analyser = "SYN-ANALYSER-01",
        )

    /** The governed reason lists of the samples (synthetic, NOT FOR CLINICAL USE). */
    val GOVERNED_REASONS: GovernedReasonLists =
        GovernedReasonLists(
            correction = setOf(CORRECTION_CODE, "SYN-CORR-UNIT"),
            cancellation = setOf(CANCELLATION_CODE),
            enteredInError = setOf(ERROR_CODE),
        )

    /** QC that passed and covers both [MEASURED_AT] and [NOW]. */
    val PASSED_QC: QcRecord =
        QcRecord(
            status = QcStatus.PASSED,
            validFrom = MEASURED_AT.minus(Duration.ofHours(QC_HOURS)),
            validUntil = NOW.plus(Duration.ofHours(QC_HOURS)),
        )

    /** The user issuing the command: an authenticated human. */
    val USER: ActingUser = ActingUser(USER_ID, AccountKind.HUMAN, authenticated = true)

    /** A non-critical value from a new in-house measurement on [SPECIMEN_ID] with valid QC. */
    val NEW_VALUE: ResultValue =
        ResultValue(
            valueId = "SYN-VAL-0001",
            change = ValueChange.NEW_MEASUREMENT,
            specimenId = SPECIMEN_ID,
            performer = Performer.InHouse(MEASURED_AT, runQc = PASSED_QC, currentAnalyserQc = PASSED_QC),
            criticalVerdict = CriticalVerdict.NOT_CRITICAL,
            markedCriticalByTechnologist = false,
        )

    /** The version being filed in [facts]: one new value. */
    val VERSION: FiledVersion = FiledVersion(FILED_VERSION_ID, LAST_VALUE_CHANGE, listOf(NEW_VALUE))

    /** A chosen correction reason. */
    val CORRECTION_REASON: ReasonEntry = ReasonEntry(CORRECTION_CODE, ReasonSelection.USER_SELECTED, text = null)

    /** A chosen cancellation reason. */
    val CANCELLATION_REASON: ReasonEntry = ReasonEntry(CANCELLATION_CODE, ReasonSelection.USER_SELECTED, text = null)

    /** A chosen entered-in-error reason. */
    val ERROR_REASON: ReasonEntry = ReasonEntry(ERROR_CODE, ReasonSelection.USER_SELECTED, text = "SYN filed against another patient")

    /** A reg-lis-rules Register entry that allows autoverification for [TEST]. */
    val REGISTER_ENTRY: RegisterEntry =
        RegisterEntry(
            function = ResultGuards.AUTOVERIFICATION_FUNCTION,
            functionVersion = FUNCTION_VERSION,
            jurisdiction = JURISDICTION,
            status = RegisterStatus.CLEARED,
            opinion =
                RegisterOpinion(
                    documentRef = "SYN-OPINION-0001",
                    expiresAt = NOW.plus(Duration.ofDays(OPINION_DAYS_LEFT)),
                    scope = setOf(TEST),
                    intendedPurpose = OpinionPurpose.RELEASE_OF_RESULTS_BY_AUTOVERIFICATION,
                    validatedRuleSetVersion = RULE_SET_VERSION,
                ),
        )

    /** A release verdict for [FILED_VERSION_ID] after every rule. */
    val VERDICT: RulesVerdict =
        RulesVerdict(FILED_VERSION_ID, RulesOutcome.RELEASE, RULE_SET_VERSION, AutoverificationRule.entries.toList())

    /** Autoverification facts under which it is active. */
    val AUTOVERIFICATION: AutoverificationFacts =
        AutoverificationFacts(
            tenantFlagOn = true,
            runningFunctionVersion = FUNCTION_VERSION,
            tenantJurisdiction = JURISDICTION,
            registerEntry = REGISTER_ENTRY,
            verdict = VERDICT,
        )

    /** The baseline facts: every positive predicate holds (see the class comment). */
    fun facts(): ResultFacts =
        ResultFacts(
            now = NOW,
            resultId = RESULT_ID,
            test = TEST,
            currentVersionId = CURRENT_VERSION_ID,
            versionBeingFiled = VERSION,
            actingUser = USER,
            validation = TechnologistValidation(FILED_VERSION_ID, USER_ID, NOW),
            validationPrivilege = ValidationPrivilege(USER_ID, TEST.laboratorySection, granted = true),
            actionPrivilege = ActionPrivilege(USER_ID, RESULT_ID, granted = true),
            audit = AuditContext(USER_ID, NOW, RESULT_ID, CURRENT_VERSION_ID),
            specimens = mapOf(SPECIMEN_ID to SpecimenStatus.IN_PROCESS),
            encounter = EncounterLink.Resolved(EncounterClass.INPATIENT, EncounterStatus.IN_PROGRESS),
            correctionReason = CORRECTION_REASON,
            cancellationReason = CANCELLATION_REASON,
            errorReason = ERROR_REASON,
            governedReasons = GOVERNED_REASONS,
            autoverification = AUTOVERIFICATION,
        )
}

private const val MINUTES_SINCE_CHANGE = 10L
private const val MINUTES_MEASUREMENT_BEFORE_CHANGE = 20L
private const val QC_HOURS = 4L
private const val OPINION_DAYS_LEFT = 300L
