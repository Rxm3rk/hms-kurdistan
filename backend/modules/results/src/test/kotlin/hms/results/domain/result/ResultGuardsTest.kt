package hms.results.domain.result

import hms.results.domain.result.ResultSamples.LAST_VALUE_CHANGE
import hms.results.domain.result.ResultSamples.MEASURED_AT
import hms.results.domain.result.ResultSamples.NEW_VALUE
import hms.results.domain.result.ResultSamples.NOW
import hms.results.domain.result.ResultSamples.VERSION
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.Duration

/**
 * Unit tests of [ResultGuards] (docs/specs/state-machines/result.yaml; spec §2.1 rule 12): for every predicate at least
 * one case where it holds and one where it does not, the boundary of every time window, every fail-closed unknown, and
 * the two complement pairs tested as complements. Synthetic facts only (NOT FOR CLINICAL USE).
 */
class ResultGuardsTest :
    FunSpec({
        val base = ResultSamples.facts()
        val guards = ResultGuards

        fun withValues(vararg values: ResultValue) = base.copy(versionBeingFiled = VERSION.copy(values = values.toList()))

        fun inHouse(value: ResultValue): Performer.InHouse = value.performer as Performer.InHouse

        // --- technologistValidated -------------------------------------------------------------------------------
        test("technologistValidated holds for a validation of this version by the privileged human issuing the command") {
            guards.technologistValidated(base) shouldBe true
        }
        test("technologistValidated holds at both window boundaries: recorded exactly at the last value change and exactly now") {
            guards.technologistValidated(base.copy(validation = base.validation!!.copy(recordedAt = LAST_VALUE_CHANGE))) shouldBe true
            guards.technologistValidated(base.copy(validation = base.validation!!.copy(recordedAt = NOW))) shouldBe true
        }
        test("technologistValidated fails for a validation recorded one second before the last value change or after now") {
            val before = base.validation!!.copy(recordedAt = LAST_VALUE_CHANGE.minusSeconds(1))
            guards.technologistValidated(base.copy(validation = before)) shouldBe false
            guards.technologistValidated(base.copy(validation = base.validation!!.copy(recordedAt = NOW.plusSeconds(1)))) shouldBe false
        }
        test("technologistValidated fails for a validation of another version") {
            guards.technologistValidated(base.copy(validation = base.validation!!.copy(versionId = "SYN-OTHER"))) shouldBe false
        }
        test("technologistValidated fails when the validator is not the user issuing the command") {
            val other = base.validation!!.copy(validatedBy = ResultSamples.OTHER_USER_ID)
            guards.technologistValidated(base.copy(validation = other)) shouldBe false
        }
        test("technologistValidated fails for a system, integration or AI-agent account, or an unauthenticated user") {
            listOf(AccountKind.SYSTEM, AccountKind.INTEGRATION, AccountKind.AI_AGENT).forEach { kind ->
                guards.technologistValidated(base.copy(actingUser = base.actingUser!!.copy(kind = kind))) shouldBe false
            }
            guards.technologistValidated(base.copy(actingUser = base.actingUser!!.copy(authenticated = false))) shouldBe false
        }
        test("technologistValidated fails without the validation privilege for the test's laboratory section") {
            val privilege = base.validationPrivilege!!
            guards.technologistValidated(base.copy(validationPrivilege = privilege.copy(granted = false))) shouldBe false
            guards.technologistValidated(base.copy(validationPrivilege = privilege.copy(laboratorySection = "SYN-HAEM"))) shouldBe false
            val otherUser = privilege.copy(userId = ResultSamples.OTHER_USER_ID)
            guards.technologistValidated(base.copy(validationPrivilege = otherUser)) shouldBe false
        }
        test("technologistValidated fails closed when the version, the validation, the user or the privilege answer is missing") {
            guards.technologistValidated(base.copy(versionBeingFiled = null)) shouldBe false
            guards.technologistValidated(base.copy(validation = null)) shouldBe false
            guards.technologistValidated(base.copy(actingUser = null)) shouldBe false
            guards.technologistValidated(base.copy(validationPrivilege = null)) shouldBe false
        }

        // --- specimenUsable --------------------------------------------------------------------------------------
        test("specimenUsable holds when every specimen behind a new or changed value is in a usable state") {
            guards.specimenUsable(base) shouldBe true
            listOf(SpecimenStatus.RECEIVED, SpecimenStatus.RESULTED, SpecimenStatus.STORED).forEach { state ->
                guards.specimenUsable(base.copy(specimens = mapOf(ResultSamples.SPECIMEN_ID to state))) shouldBe true
            }
        }
        test("specimenUsable fails when a specimen is rejected, lost, cancelled or entered in error") {
            listOf(SpecimenStatus.REJECTED, SpecimenStatus.LOST, SpecimenStatus.CANCELLED, SpecimenStatus.ENTERED_IN_ERROR).forEach {
                guards.specimenUsable(base.copy(specimens = mapOf(ResultSamples.SPECIMEN_ID to it))) shouldBe false
            }
        }
        test("specimenUsable fails closed for an unknown specimen state, an unknown specimen or a value with no specimen reference") {
            guards.specimenUsable(base.copy(specimens = mapOf(ResultSamples.SPECIMEN_ID to SpecimenStatus.UNKNOWN))) shouldBe false
            guards.specimenUsable(base.copy(specimens = emptyMap())) shouldBe false
            guards.specimenUsable(withValues(NEW_VALUE.copy(specimenId = null))) shouldBe false
            guards.specimenUsable(withValues(NEW_VALUE.copy(specimenId = " "))) shouldBe false
            guards.specimenUsable(base.copy(versionBeingFiled = null)) shouldBe false
        }
        test("specimenUsable checks a changed value's specimen and does not check a value carried unchanged") {
            val rejected = base.copy(specimens = mapOf(ResultSamples.SPECIMEN_ID to SpecimenStatus.REJECTED))
            val changed = NEW_VALUE.copy(change = ValueChange.CHANGED_WITHOUT_NEW_MEASUREMENT)
            val carried = NEW_VALUE.copy(change = ValueChange.CARRIED_UNCHANGED)
            guards.specimenUsable(rejected.copy(versionBeingFiled = VERSION.copy(values = listOf(changed)))) shouldBe false
            guards.specimenUsable(rejected.copy(versionBeingFiled = VERSION.copy(values = listOf(carried)))) shouldBe true
        }
        test("specimenUsable needs a reference laboratory's own specimen reference as well as a usable specimen we sent") {
            val sent = NEW_VALUE.copy(performer = Performer.ReferenceLaboratory("SYN-REFLAB", "SYN-REFLAB-SPEC"))
            guards.specimenUsable(withValues(sent)) shouldBe true
            guards.specimenUsable(withValues(sent.copy(performer = Performer.ReferenceLaboratory("SYN-REFLAB", null)))) shouldBe false
            guards.specimenUsable(withValues(sent.copy(performer = Performer.ReferenceLaboratory("SYN-REFLAB", "")))) shouldBe false
            val lost = withValues(sent).copy(specimens = mapOf(ResultSamples.SPECIMEN_ID to SpecimenStatus.LOST))
            guards.specimenUsable(lost) shouldBe false
        }

        // --- qcAllowsRelease -------------------------------------------------------------------------------------
        test("qcAllowsRelease holds for a new measurement whose run QC and current analyser QC passed and are in date") {
            guards.qcAllowsRelease(base) shouldBe true
        }
        test("qcAllowsRelease run QC window: valid from exactly the measurement holds; valid until exactly the measurement fails") {
            val qc = ResultSamples.PASSED_QC
            fun run(record: QcRecord) = withValues(NEW_VALUE.copy(performer = inHouse(NEW_VALUE).copy(runQc = record)))
            guards.qcAllowsRelease(run(qc.copy(validFrom = MEASURED_AT))) shouldBe true
            guards.qcAllowsRelease(run(qc.copy(validFrom = MEASURED_AT.plusSeconds(1)))) shouldBe false
            guards.qcAllowsRelease(run(qc.copy(validUntil = MEASURED_AT))) shouldBe false
            guards.qcAllowsRelease(run(qc.copy(validUntil = MEASURED_AT.plusSeconds(1)))) shouldBe true
        }
        test("qcAllowsRelease current QC window: valid from exactly now holds; valid until exactly now (overdue) fails") {
            val qc = ResultSamples.PASSED_QC
            fun current(record: QcRecord) = withValues(NEW_VALUE.copy(performer = inHouse(NEW_VALUE).copy(currentAnalyserQc = record)))
            guards.qcAllowsRelease(current(qc.copy(validFrom = NOW))) shouldBe true
            guards.qcAllowsRelease(current(qc.copy(validFrom = NOW.plusSeconds(1)))) shouldBe false
            guards.qcAllowsRelease(current(qc.copy(validUntil = NOW))) shouldBe false
            guards.qcAllowsRelease(current(qc.copy(validUntil = NOW.plusSeconds(1)))) shouldBe true
        }
        test("qcAllowsRelease fails closed for failed, unknown or missing QC, or QC with no validity times") {
            val qc = ResultSamples.PASSED_QC
            val bad =
                listOf(
                    qc.copy(status = QcStatus.FAILED),
                    qc.copy(status = QcStatus.UNKNOWN),
                    qc.copy(validFrom = null),
                    qc.copy(validUntil = null),
                    null,
                )
            bad.forEach { record ->
                val run = inHouse(NEW_VALUE).copy(runQc = record)
                val current = inHouse(NEW_VALUE).copy(currentAnalyserQc = record)
                guards.qcAllowsRelease(withValues(NEW_VALUE.copy(performer = run))) shouldBe false
                guards.qcAllowsRelease(withValues(NEW_VALUE.copy(performer = current))) shouldBe false
            }
            guards.qcAllowsRelease(base.copy(versionBeingFiled = null)) shouldBe false
        }
        test("qcAllowsRelease for a changed value with no new measurement checks only its original run's QC") {
            val changed = NEW_VALUE.copy(change = ValueChange.CHANGED_WITHOUT_NEW_MEASUREMENT)
            val currentFailed = inHouse(changed).copy(currentAnalyserQc = ResultSamples.PASSED_QC.copy(status = QcStatus.FAILED))
            guards.qcAllowsRelease(withValues(changed.copy(performer = currentFailed))) shouldBe true
            val runFailed = inHouse(changed).copy(runQc = ResultSamples.PASSED_QC.copy(status = QcStatus.FAILED))
            guards.qcAllowsRelease(withValues(changed.copy(performer = runFailed))) shouldBe false
        }
        test("qcAllowsRelease does not check a value carried unchanged, so a version that only withdraws values passes") {
            val failed = inHouse(NEW_VALUE).copy(runQc = null, currentAnalyserQc = null)
            val carried = NEW_VALUE.copy(change = ValueChange.CARRIED_UNCHANGED, performer = failed)
            guards.qcAllowsRelease(withValues(carried)) shouldBe true
            guards.qcAllowsRelease(withValues()) shouldBe true
        }
        test("qcAllowsRelease needs a reference laboratory's identification on its value") {
            val referred = NEW_VALUE.copy(performer = Performer.ReferenceLaboratory("SYN-REFLAB", "SYN-REFLAB-SPEC"))
            guards.qcAllowsRelease(withValues(referred)) shouldBe true
            val unidentified = Performer.ReferenceLaboratory(null, "SYN-REFLAB-SPEC")
            val blank = Performer.ReferenceLaboratory(" ", "SYN-REFLAB-SPEC")
            guards.qcAllowsRelease(withValues(referred.copy(performer = unidentified))) shouldBe false
            guards.qcAllowsRelease(withValues(referred.copy(performer = blank))) shouldBe false
        }

        // --- criticalValueFlagged / noCriticalValueFlagged ---------------------------------------------------------
        test("criticalValueFlagged holds for a critical verdict, a value not evaluated, or a value the technologist marked") {
            val cases =
                listOf(
                    NEW_VALUE.copy(criticalVerdict = CriticalVerdict.CRITICAL),
                    NEW_VALUE.copy(criticalVerdict = CriticalVerdict.NOT_EVALUATED_TEST_NOT_IN_POLICY),
                    NEW_VALUE.copy(criticalVerdict = CriticalVerdict.NOT_EVALUATED_CONTEXT_MISSING),
                    NEW_VALUE.copy(markedCriticalByTechnologist = true),
                )
            cases.forEach { value ->
                guards.criticalValueFlagged(withValues(NEW_VALUE, value)) shouldBe true
                guards.noCriticalValueFlagged(withValues(NEW_VALUE, value)) shouldBe false
            }
        }
        test("noCriticalValueFlagged holds when every verdict is not critical or no-critical-limits and none is marked") {
            val noLimits = NEW_VALUE.copy(criticalVerdict = CriticalVerdict.NO_CRITICAL_LIMITS)
            guards.noCriticalValueFlagged(withValues(NEW_VALUE, noLimits)) shouldBe true
            guards.criticalValueFlagged(withValues(NEW_VALUE, noLimits)) shouldBe false
        }
        test("criticalValueFlagged counts a critical value carried unchanged, because it is a value of the version filed") {
            val carried = NEW_VALUE.copy(change = ValueChange.CARRIED_UNCHANGED, criticalVerdict = CriticalVerdict.CRITICAL)
            guards.criticalValueFlagged(withValues(NEW_VALUE, carried)) shouldBe true
        }
        test("criticalValueFlagged fails closed with no version; noCriticalValueFlagged then fails") {
            guards.criticalValueFlagged(base.copy(versionBeingFiled = null)) shouldBe true
            guards.noCriticalValueFlagged(base.copy(versionBeingFiled = null)) shouldBe false
        }
        test("criticalValueFlagged and noCriticalValueFlagged are exact complements over every verdict and mark") {
            CriticalVerdict.entries.forEach { verdict ->
                listOf(true, false).forEach { marked ->
                    val facts = withValues(NEW_VALUE.copy(criticalVerdict = verdict, markedCriticalByTechnologist = marked))
                    guards.criticalValueFlagged(facts) shouldBe !guards.noCriticalValueFlagged(facts)
                }
            }
        }

        // --- patientDischarged / patientNotDischarged --------------------------------------------------------------
        val admitting = listOf(EncounterClass.INPATIENT, EncounterClass.EMERGENCY, EncounterClass.DAY_CASE)
        val active =
            listOf(
                EncounterStatus.PLANNED,
                EncounterStatus.ARRIVED,
                EncounterStatus.TRIAGED,
                EncounterStatus.IN_PROGRESS,
                EncounterStatus.ON_LEAVE,
            )
        test("patientDischarged holds for an inpatient, emergency or day-case encounter in any state but the five active ones") {
            admitting.forEach { encounterClass ->
                (EncounterStatus.entries - active.toSet()).forEach { status ->
                    guards.patientDischarged(base.copy(encounter = EncounterLink.Resolved(encounterClass, status))) shouldBe true
                }
            }
        }
        test("patientDischarged fails for an inpatient, emergency or day-case encounter in one of the five active states") {
            admitting.forEach { encounterClass ->
                active.forEach { status ->
                    guards.patientDischarged(base.copy(encounter = EncounterLink.Resolved(encounterClass, status))) shouldBe false
                }
            }
        }
        test("patientDischarged fails closed for an unknown class, an unknown state, and a missing or unresolved encounter link") {
            EncounterStatus.entries.forEach { status ->
                guards.patientDischarged(base.copy(encounter = EncounterLink.Resolved(EncounterClass.UNKNOWN, status))) shouldBe true
            }
            val unknownState = EncounterLink.Resolved(EncounterClass.INPATIENT, EncounterStatus.UNKNOWN)
            guards.patientDischarged(base.copy(encounter = unknownState)) shouldBe true
            guards.patientDischarged(base.copy(encounter = EncounterLink.Missing)) shouldBe true
            guards.patientDischarged(base.copy(encounter = EncounterLink.Unresolved)) shouldBe true
        }
        test("patientNotDischarged holds for an order recorded with no encounter and for an outpatient visit in any state") {
            guards.patientNotDischarged(base.copy(encounter = EncounterLink.NoEncounterRecorded)) shouldBe true
            EncounterStatus.entries.forEach { status ->
                val outpatient = base.copy(encounter = EncounterLink.Resolved(EncounterClass.OUTPATIENT, status))
                guards.patientNotDischarged(outpatient) shouldBe true
            }
        }
        test("patientNotDischarged fails for a finished inpatient encounter") {
            val finished = EncounterLink.Resolved(EncounterClass.INPATIENT, EncounterStatus.FINISHED)
            guards.patientNotDischarged(base.copy(encounter = finished)) shouldBe false
        }
        test("patientDischarged and patientNotDischarged are exact complements over every link, class and state") {
            val links =
                listOf(EncounterLink.NoEncounterRecorded, EncounterLink.Missing, EncounterLink.Unresolved) +
                    EncounterClass.entries.flatMap { encounterClass ->
                        EncounterStatus.entries.map { EncounterLink.Resolved(encounterClass, it) }
                    }
            links.forEach { link ->
                val facts = base.copy(encounter = link)
                guards.patientNotDischarged(facts) shouldBe !guards.patientDischarged(facts)
            }
        }

        // --- correctionReasonEntered, cancellationReasonEntered, errorReasonEntered ----------------------------------
        test("correctionReasonEntered holds for a coded reason the user chose from the correction list, with or without text") {
            guards.correctionReasonEntered(base) shouldBe true
            val withText = ResultSamples.CORRECTION_REASON.copy(text = "SYN text")
            guards.correctionReasonEntered(base.copy(correctionReason = withText)) shouldBe true
        }
        test("correctionReasonEntered fails for a preselected or defaulted code, text alone, a blank code, another list's code or none") {
            val chosen = ResultSamples.CORRECTION_REASON
            listOf(
                chosen.copy(selection = ReasonSelection.PRESELECTED),
                chosen.copy(selection = ReasonSelection.DEFAULTED),
                chosen.copy(code = null, text = "SYN text only"),
                chosen.copy(code = " "),
                chosen.copy(code = ResultSamples.CANCELLATION_CODE),
                null,
            ).forEach { guards.correctionReasonEntered(base.copy(correctionReason = it)) shouldBe false }
        }
        test("cancellationReasonEntered holds for a coded reason the user chose from the cancellation list") {
            guards.cancellationReasonEntered(base) shouldBe true
        }
        test("cancellationReasonEntered fails for a defaulted code, text alone, another list's code or none") {
            val chosen = ResultSamples.CANCELLATION_REASON
            listOf(
                chosen.copy(selection = ReasonSelection.DEFAULTED),
                chosen.copy(selection = ReasonSelection.PRESELECTED),
                chosen.copy(code = null, text = "SYN text only"),
                chosen.copy(code = ResultSamples.ERROR_CODE),
                null,
            ).forEach { guards.cancellationReasonEntered(base.copy(cancellationReason = it)) shouldBe false }
        }
        test("errorReasonEntered holds for a coded reason the user chose from the entered-in-error list") {
            guards.errorReasonEntered(base) shouldBe true
        }
        test("errorReasonEntered fails for a preselected code, text alone, another list's code or none") {
            val chosen = ResultSamples.ERROR_REASON
            listOf(
                chosen.copy(selection = ReasonSelection.PRESELECTED),
                chosen.copy(selection = ReasonSelection.DEFAULTED),
                chosen.copy(code = null),
                chosen.copy(code = ResultSamples.CORRECTION_CODE),
                null,
            ).forEach { guards.errorReasonEntered(base.copy(errorReason = it)) shouldBe false }
        }

        // --- privilegedAndAudited ----------------------------------------------------------------------------------
        test("privilegedAndAudited holds for a privileged authenticated human with a complete audit context") {
            guards.privilegedAndAudited(base) shouldBe true
        }
        test("privilegedAndAudited holds with no version filed yet when the audit context names none") {
            val registered = base.copy(currentVersionId = null, audit = base.audit!!.copy(versionActedOn = null))
            guards.privilegedAndAudited(registered) shouldBe true
        }
        test("privilegedAndAudited audit time boundary: exactly now holds, one second after now fails") {
            guards.privilegedAndAudited(base.copy(audit = base.audit!!.copy(at = NOW))) shouldBe true
            guards.privilegedAndAudited(base.copy(audit = base.audit!!.copy(at = NOW.plusSeconds(1)))) shouldBe false
        }
        test("privilegedAndAudited fails without the privilege, for another user's or result's answer, or for a non-human account") {
            val privilege = base.actionPrivilege!!
            guards.privilegedAndAudited(base.copy(actionPrivilege = privilege.copy(granted = false))) shouldBe false
            guards.privilegedAndAudited(base.copy(actionPrivilege = privilege.copy(userId = ResultSamples.OTHER_USER_ID))) shouldBe false
            guards.privilegedAndAudited(base.copy(actionPrivilege = privilege.copy(resultId = "SYN-RES-0002"))) shouldBe false
            guards.privilegedAndAudited(base.copy(actionPrivilege = null)) shouldBe false
            listOf(AccountKind.SYSTEM, AccountKind.INTEGRATION, AccountKind.AI_AGENT).forEach { kind ->
                guards.privilegedAndAudited(base.copy(actingUser = base.actingUser!!.copy(kind = kind))) shouldBe false
            }
            guards.privilegedAndAudited(base.copy(actingUser = base.actingUser!!.copy(authenticated = false))) shouldBe false
            guards.privilegedAndAudited(base.copy(actingUser = null)) shouldBe false
        }
        test("privilegedAndAudited fails for an incomplete or mismatched audit context") {
            val audit = base.audit!!
            listOf(
                audit.copy(userId = null),
                audit.copy(userId = ResultSamples.OTHER_USER_ID),
                audit.copy(at = null),
                audit.copy(resultId = null),
                audit.copy(resultId = "SYN-RES-0002"),
                audit.copy(versionActedOn = null),
                audit.copy(versionActedOn = ResultSamples.FILED_VERSION_ID),
                null,
            ).forEach { guards.privilegedAndAudited(base.copy(audit = it)) shouldBe false }
            guards.privilegedAndAudited(base.copy(currentVersionId = null)) shouldBe false
        }

        // --- autoverificationActive --------------------------------------------------------------------------------
        val auto = ResultSamples.AUTOVERIFICATION
        val entry = ResultSamples.REGISTER_ENTRY
        val opinion = entry.opinion!!
        fun withEntry(changed: RegisterEntry?) = base.copy(autoverification = auto.copy(registerEntry = changed))
        test("autoverificationActive holds: flag on, cleared or not-required entry, current opinion in scope, validated rule set") {
            guards.autoverificationActive(base) shouldBe true
            guards.autoverificationActive(withEntry(entry.copy(status = RegisterStatus.NOT_REQUIRED))) shouldBe true
        }
        test("autoverificationActive: the tenant flag alone never makes it true, and the flag off makes it false") {
            guards.autoverificationActive(withEntry(null)) shouldBe false
            guards.autoverificationActive(base.copy(autoverification = auto.copy(tenantFlagOn = false))) shouldBe false
        }
        test("autoverificationActive fails for any Register status but cleared or not-required") {
            listOf(RegisterStatus.NOT_ASSESSED, RegisterStatus.REQUIRED, RegisterStatus.WITHDRAWN).forEach {
                guards.autoverificationActive(withEntry(entry.copy(status = it))) shouldBe false
            }
        }
        test("autoverificationActive fails for another function, function version or jurisdiction, or a blank running version") {
            guards.autoverificationActive(withEntry(entry.copy(function = "SYN-other"))) shouldBe false
            guards.autoverificationActive(withEntry(entry.copy(functionVersion = "SYN-2.0"))) shouldBe false
            guards.autoverificationActive(withEntry(entry.copy(jurisdiction = "SYN-OTHER"))) shouldBe false
            val blank = auto.copy(runningFunctionVersion = "", registerEntry = entry.copy(functionVersion = ""))
            guards.autoverificationActive(base.copy(autoverification = blank)) shouldBe false
            val blankJurisdiction = auto.copy(tenantJurisdiction = "", registerEntry = entry.copy(jurisdiction = ""))
            guards.autoverificationActive(base.copy(autoverification = blankJurisdiction)) shouldBe false
        }
        test("autoverificationActive opinion expiry boundary: one second before expiry holds, expiry exactly now fails") {
            guards.autoverificationActive(withEntry(entry.copy(opinion = opinion.copy(expiresAt = NOW.plusSeconds(1))))) shouldBe true
            guards.autoverificationActive(withEntry(entry.copy(opinion = opinion.copy(expiresAt = NOW)))) shouldBe false
            guards.autoverificationActive(withEntry(entry.copy(opinion = opinion.copy(expiresAt = null)))) shouldBe false
        }
        test("autoverificationActive fails with no stored opinion, another scope, another purpose or another rule-set version") {
            guards.autoverificationActive(withEntry(entry.copy(opinion = null))) shouldBe false
            guards.autoverificationActive(withEntry(entry.copy(opinion = opinion.copy(documentRef = null)))) shouldBe false
            guards.autoverificationActive(withEntry(entry.copy(opinion = opinion.copy(documentRef = " ")))) shouldBe false
            val otherTest = ResultSamples.TEST.copy(method = "SYN-METHOD-02")
            guards.autoverificationActive(withEntry(entry.copy(opinion = opinion.copy(scope = setOf(otherTest))))) shouldBe false
            val otherPurpose = opinion.copy(intendedPurpose = OpinionPurpose.OTHER)
            guards.autoverificationActive(withEntry(entry.copy(opinion = otherPurpose))) shouldBe false
            guards.autoverificationActive(withEntry(entry.copy(opinion = opinion.copy(validatedRuleSetVersion = "SYN-6")))) shouldBe false
            guards.autoverificationActive(withEntry(entry.copy(opinion = opinion.copy(validatedRuleSetVersion = null)))) shouldBe false
        }
        test("autoverificationActive fails when the verdict names no rule-set version or there is no verdict") {
            val noRuleSet = auto.copy(verdict = ResultSamples.VERDICT.copy(ruleSetVersion = null))
            guards.autoverificationActive(base.copy(autoverification = noRuleSet)) shouldBe false
            guards.autoverificationActive(base.copy(autoverification = auto.copy(verdict = null))) shouldBe false
        }

        // --- autoverificationRulesPassed ---------------------------------------------------------------------------
        val verdict = ResultSamples.VERDICT
        fun withVerdict(changed: RulesVerdict?) = base.copy(autoverification = auto.copy(verdict = changed))
        test("autoverificationRulesPassed holds for a release verdict for this version after every rule in order") {
            guards.autoverificationRulesPassed(base) shouldBe true
        }
        test("autoverificationRulesPassed fails for a hold, another version, no rule-set version, missing or reordered rules, or none") {
            listOf(
                verdict.copy(outcome = RulesOutcome.HOLD),
                verdict.copy(versionId = ResultSamples.CURRENT_VERSION_ID),
                verdict.copy(ruleSetVersion = null),
                verdict.copy(ruleSetVersion = ""),
                verdict.copy(rulesRun = AutoverificationRule.entries.drop(1)),
                verdict.copy(rulesRun = AutoverificationRule.entries.reversed()),
                null,
            ).forEach { guards.autoverificationRulesPassed(withVerdict(it)) shouldBe false }
            guards.autoverificationRulesPassed(base.copy(versionBeingFiled = null)) shouldBe false
        }

        test("the baseline sample is NOT FOR CLINICAL USE and every time in it lies before now") {
            ResultSamples.RESULT_ID.startsWith("SYN-") shouldBe true
            (Duration.between(MEASURED_AT, NOW).isNegative) shouldBe false
        }
    })
