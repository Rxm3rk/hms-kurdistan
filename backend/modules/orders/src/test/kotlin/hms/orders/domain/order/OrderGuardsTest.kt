package hms.orders.domain.order

import hms.orders.domain.order.OrderSamples.NOW
import hms.orders.domain.order.OrderSamples.clean
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

// Unit tests of every order predicate (docs/specs/state-machines/order.yaml; WP-0.5 spec §2.1 rule 12): for each, at
// least one case where it holds and one where it does not, each test name containing the predicate's id, plus the
// boundary of every time window and every fail-closed unknown. Synthetic facts only (OrderSamples; NOT FOR CLINICAL USE).

private val G = OrderGuards

private fun OrderFacts.order(change: OrderRecord.() -> OrderRecord) = copy(order = order.change())

private fun OrderFacts.issuer(change: Actor.() -> Actor) = copy(issuer = issuer.change())

private fun OrderFacts.config(change: OrderConfiguration.() -> OrderConfiguration) = copy(configuration = configuration.change())

private fun OrderFacts.cds(change: CdsEvaluation.() -> CdsEvaluation) = copy(cds = cds.change())

private fun OrderFacts.formulary(change: FormularyFlags.() -> FormularyFlags) =
    order { copy(formulary = (formulary ?: FormularyFlags(false, false, false, false, false)).change()) }

private fun OrderFacts.context(
    change: Instant?,
    vararg answers: ReverificationAnswer,
    window: Duration? = null,
) = copy(identity = IdentityContext(change, window, answers.toList()))

private fun confirmed(
    user: String? = OrderSamples.ISSUER,
    at: Instant? = NOW,
    forThisCommand: Boolean = false,
) = ReverificationAnswer(user, ReverificationOutcome.CONFIRMED, at, forThisCommand)

private fun disputed(at: Instant?) = ReverificationAnswer(OrderSamples.ISSUER, ReverificationOutcome.NOT_THIS_PATIENT, at, false)

private fun reason(
    code: String?,
    text: String? = null,
    chosen: Boolean = true,
) = GivenReason(code, text, chosen)

private val clinicianWithoutStopPrivileges =
    OrderSamples.clinician().copy(privileges = OrderSamples.ALL_PRIVILEGES - OrderSamples.PRIV_HOLD - OrderSamples.PRIV_DISCONTINUE)

class OrderGuardsTest :
    FunSpec({
        // ---- order kind (exact complements)
        test("medicationOrder holds and notMedicationOrder fails for a medication order") {
            G.medicationOrder(clean(OrderKind.MEDICATION)) shouldBe true
            G.notMedicationOrder(clean(OrderKind.MEDICATION)) shouldBe false
        }
        test("medicationOrder fails and notMedicationOrder holds for every other order kind") {
            (OrderKind.entries - OrderKind.MEDICATION).forEach { kind ->
                G.medicationOrder(clean(kind)) shouldBe false
                G.notMedicationOrder(clean(kind)) shouldBe true
            }
        }

        // ---- who acts
        test("signerAuthenticatedHuman holds for a human who authenticated for this signature") {
            G.signerAuthenticatedHuman(clean()) shouldBe true
        }
        test("signerAuthenticatedHuman fails for an AI agent, a service, a system, an interface, a migration loader or an unknown kind") {
            (PrincipalKind.entries - PrincipalKind.HUMAN + listOf(null)).forEach { kind ->
                G.signerAuthenticatedHuman(clean().issuer { copy(kind = kind) }) shouldBe false
            }
        }
        test("signerAuthenticatedHuman fails for a human who did not authenticate for this signature") {
            G.signerAuthenticatedHuman(clean().issuer { copy(authenticatedForThisCommand = false) }) shouldBe false
        }

        test("ordererPrivileged holds for a signer with a valid practitioner licence and the ordering privilege") {
            G.ordererPrivileged(clean()) shouldBe true
        }
        test("ordererPrivileged fails for a licence expiring exactly at the server's time, an unknown expiry or no licence") {
            G.ordererPrivileged(clean().issuer { copy(licences = listOf(Licence(LicenceKind.PRACTITIONER, NOW))) }) shouldBe false
            G.ordererPrivileged(clean().issuer { copy(licences = listOf(Licence(LicenceKind.PRACTITIONER, NOW.plusMillis(1)))) }) shouldBe
                true
            G.ordererPrivileged(clean().issuer { copy(licences = listOf(Licence(LicenceKind.PRACTITIONER, null))) }) shouldBe false
            G.ordererPrivileged(clean().issuer { copy(licences = listOf(OrderSamples.validLicence(LicenceKind.PHARMACIST))) }) shouldBe
                false
        }
        test("ordererPrivileged fails for a missing privilege or an unknown privilege requirement") {
            G.ordererPrivileged(clean().issuer { copy(privileges = emptySet()) }) shouldBe false
            G.ordererPrivileged(clean().config { copy(orderingPrivilege = null) }) shouldBe false
        }
        test("ordererPrivileged reads a verbal order's source practitioner, not the receiving signer") {
            val verbal = OrderSamples.verbalOrder()
            G.ordererPrivileged(clean().copy(verbal = verbal).issuer { copy(privileges = emptySet()) }) shouldBe true
            G.ordererPrivileged(clean().copy(verbal = verbal.copy(source = verbal.source.copy(privileges = emptySet())))) shouldBe false
        }

        test("actorPrivileged holds for a human with the command's privilege and the licence it needs") {
            G.actorPrivileged(clean()) shouldBe true
            G.actorPrivileged(
                clean()
                    .issuer {
                        copy(licences = emptyList())
                    }.config { copy(commandRequirement = CommandRequirement(OrderSamples.PRIV_COMMAND, null)) },
            ) shouldBe
                true
        }
        test("actorPrivileged fails for an unknown user, an unknown requirement, a missing privilege, a non-human or an expired licence") {
            G.actorPrivileged(clean().issuer { copy(userId = null) }) shouldBe false
            G.actorPrivileged(clean().config { copy(commandRequirement = null) }) shouldBe false
            G.actorPrivileged(clean().issuer { copy(privileges = emptySet()) }) shouldBe false
            G.actorPrivileged(clean().issuer { copy(kind = PrincipalKind.SYSTEM) }) shouldBe false
            G.actorPrivileged(clean().issuer { copy(licences = listOf(Licence(LicenceKind.PRACTITIONER, NOW))) }) shouldBe false
        }

        test("mayHoldOrder holds for a human with the configured hold privilege, whatever their licence") {
            G.mayHoldOrder(clean()) shouldBe true
            G.mayHoldOrder(clean().issuer { copy(licences = emptyList()) }) shouldBe true
        }
        test("mayHoldOrder fails for a human without the configured hold privilege when the configuration names someone") {
            G.mayHoldOrder(clean().copy(issuer = clinicianWithoutStopPrivileges)) shouldBe false
        }
        test("mayHoldOrder holds for a care-team prescriber or a pharmacist when the hold configuration is missing or names nobody") {
            val prescriber = clinicianWithoutStopPrivileges.copy(roles = setOf(StaffRole.PRESCRIBER), licences = emptyList())
            val pharmacist = clinicianWithoutStopPrivileges.copy(roles = setOf(StaffRole.PHARMACIST), onPatientCareTeam = false)
            listOf(null, StopPrivilege(OrderSamples.PRIV_HOLD, grantedToAnyone = false)).forEach { configured ->
                G.mayHoldOrder(clean().copy(issuer = prescriber).config { copy(holdPrivilege = configured) }) shouldBe true
                G.mayHoldOrder(clean().copy(issuer = pharmacist).config { copy(holdPrivilege = configured) }) shouldBe true
            }
        }
        test("mayHoldOrder fails under the baseline for a nurse or a prescriber off the care team") {
            val nurse = clinicianWithoutStopPrivileges.copy(roles = setOf(StaffRole.NURSE))
            val offTeam = clinicianWithoutStopPrivileges.copy(roles = setOf(StaffRole.PRESCRIBER), onPatientCareTeam = false)
            G.mayHoldOrder(clean().copy(issuer = nurse).config { copy(holdPrivilege = null) }) shouldBe false
            G.mayHoldOrder(clean().copy(issuer = offTeam).config { copy(holdPrivilege = null) }) shouldBe false
        }
        test("mayHoldOrder holds for a registered system or interface principal authenticated as itself") {
            G.mayHoldOrder(clean().copy(issuer = OrderSamples.systemPrincipal())) shouldBe true
            G.mayHoldOrder(clean().copy(issuer = OrderSamples.systemPrincipal().copy(kind = PrincipalKind.INTERFACE))) shouldBe true
        }
        test("mayHoldOrder fails for an unregistered or unauthenticated system principal, an AI agent, a service or an unknown kind") {
            val system = OrderSamples.systemPrincipal()
            G.mayHoldOrder(clean().copy(issuer = system.copy(registrations = setOf(SystemRegistration.DISCONTINUE_ORDERS)))) shouldBe false
            G.mayHoldOrder(clean().copy(issuer = system.copy(authenticatedForThisCommand = false))) shouldBe false
            listOf(PrincipalKind.AI_AGENT, PrincipalKind.SERVICE, PrincipalKind.MIGRATION_LOADER, null).forEach { kind ->
                G.mayHoldOrder(clean().issuer { copy(kind = kind) }) shouldBe false
            }
        }

        test("mayDiscontinueOrder holds for a human with the configured privilege, whatever their licence") {
            G.mayDiscontinueOrder(clean().issuer { copy(licences = listOf(Licence(LicenceKind.PRACTITIONER, NOW))) }) shouldBe true
        }
        test("mayDiscontinueOrder holds for a care-team prescriber when the configuration is missing or empty, never a pharmacist") {
            val prescriber = clinicianWithoutStopPrivileges.copy(roles = setOf(StaffRole.PRESCRIBER), licences = emptyList())
            val pharmacist = clinicianWithoutStopPrivileges.copy(roles = setOf(StaffRole.PHARMACIST))
            listOf(null, StopPrivilege(OrderSamples.PRIV_DISCONTINUE, grantedToAnyone = false)).forEach { configured ->
                G.mayDiscontinueOrder(clean().copy(issuer = prescriber).config { copy(discontinuePrivilege = configured) }) shouldBe true
                G.mayDiscontinueOrder(clean().copy(issuer = pharmacist).config { copy(discontinuePrivilege = configured) }) shouldBe false
            }
        }
        test("mayDiscontinueOrder fails for a human without the configured privilege, an AI agent or an unknown kind") {
            G.mayDiscontinueOrder(clean().copy(issuer = clinicianWithoutStopPrivileges)) shouldBe false
            G.mayDiscontinueOrder(clean().issuer { copy(kind = PrincipalKind.AI_AGENT) }) shouldBe false
            G.mayDiscontinueOrder(clean().issuer { copy(kind = null) }) shouldBe false
        }
        test("mayDiscontinueOrder holds for a system principal registered to discontinue, and fails when it is registered only to hold") {
            G.mayDiscontinueOrder(clean().copy(issuer = OrderSamples.systemPrincipal())) shouldBe true
            val holdOnly = OrderSamples.systemPrincipal().copy(registrations = setOf(SystemRegistration.HOLD_ORDERS))
            G.mayDiscontinueOrder(clean().copy(issuer = holdOnly)) shouldBe false
        }

        test("verifierIsPharmacist holds for a human with the verification privilege and a valid pharmacist licence") {
            G.verifierIsPharmacist(clean()) shouldBe true
        }
        test("verifierIsPharmacist fails without the privilege, with an unknown privilege, an expired or unknown licence, or a non-human") {
            G.verifierIsPharmacist(clean().issuer { copy(privileges = privileges - OrderSamples.PRIV_VERIFY) }) shouldBe false
            G.verifierIsPharmacist(clean().config { copy(verificationPrivilege = null) }) shouldBe false
            G.verifierIsPharmacist(clean().issuer { copy(licences = listOf(Licence(LicenceKind.PHARMACIST, NOW))) }) shouldBe false
            G.verifierIsPharmacist(clean().issuer { copy(licences = listOf(Licence(LicenceKind.PHARMACIST, null))) }) shouldBe false
            G.verifierIsPharmacist(clean().issuer { copy(kind = PrincipalKind.AI_AGENT) }) shouldBe false
        }

        test("verifierIndependentOfOrderer holds for a pharmacist who neither ordered, signed, received nor created the order") {
            G.verifierIndependentOfOrderer(clean()) shouldBe true
            G.verifierIndependentOfOrderer(clean().copy(verbal = OrderSamples.verbalOrder())) shouldBe true
        }
        test("verifierIndependentOfOrderer fails for the signer, the creator (pre-builder), the verbal source or the verbal receiver") {
            listOf(OrderSamples.SIGNER, OrderSamples.AUTHOR).forEach { user ->
                G.verifierIndependentOfOrderer(clean().issuer { copy(userId = user) }) shouldBe false
            }
            listOf(OrderSamples.SOURCE, OrderSamples.RECEIVER).forEach { user ->
                G.verifierIndependentOfOrderer(clean().copy(verbal = OrderSamples.verbalOrder()).issuer { copy(userId = user) }) shouldBe
                    false
            }
        }
        test("verifierIndependentOfOrderer fails closed for an unknown verifier, signer, creator or verbal receiver") {
            G.verifierIndependentOfOrderer(clean().issuer { copy(userId = null) }) shouldBe false
            G.verifierIndependentOfOrderer(clean().order { copy(signerId = null) }) shouldBe false
            G.verifierIndependentOfOrderer(clean().order { copy(createdBy = null) }) shouldBe false
            val verbal = OrderSamples.verbalOrder()
            G.verifierIndependentOfOrderer(clean().copy(verbal = verbal.copy(receiver = verbal.receiver.copy(userId = null)))) shouldBe
                false
        }

        // ---- SI-16 (DN-026, DN-027, DN-028)
        test("identityReverificationSatisfied holds when the context changed more than 60 000 ms ago and is not disputed") {
            G.identityReverificationSatisfied(clean().context(NOW.minusMillis(60_001))) shouldBe true
        }
        test("identityReverificationSatisfied fails at exactly 60 000 ms (the window is inclusive, DN-026) without a confirmation") {
            G.identityReverificationSatisfied(clean().context(NOW.minusMillis(60_000))) shouldBe false
        }
        test("identityReverificationSatisfied fails for an unknown change time or a negative elapsed time without a confirmation") {
            G.identityReverificationSatisfied(clean().context(null)) shouldBe false
            G.identityReverificationSatisfied(clean().context(NOW.plusMillis(1))) shouldBe false
        }
        test("identityReverificationSatisfied holds within the window when the issuer confirmed after the change") {
            G.identityReverificationSatisfied(clean().context(NOW.minusSeconds(10), confirmed(at = NOW))) shouldBe true
        }
        test("identityReverificationSatisfied fails for a confirmation by another user (DN-027), at the change time or of unknown time") {
            val change = NOW.minusSeconds(10)
            G.identityReverificationSatisfied(clean().context(change, confirmed(user = OrderSamples.OTHER_USER))) shouldBe false
            G.identityReverificationSatisfied(clean().context(change, confirmed(at = change))) shouldBe false
            G.identityReverificationSatisfied(clean().context(change, confirmed(at = null))) shouldBe false
            G.identityReverificationSatisfied(clean().context(change, confirmed()).issuer { copy(userId = null) }) shouldBe false
        }
        test("identityReverificationSatisfied with an unknown change time holds only for a confirmation recorded for this command") {
            G.identityReverificationSatisfied(clean().context(null, confirmed(at = null, forThisCommand = true))) shouldBe true
            G.identityReverificationSatisfied(clean().context(null, confirmed(forThisCommand = false))) shouldBe false
        }
        test("identityReverificationSatisfied fails after 60 s while 'Not this patient' stands, and holds once the issuer confirms") {
            val change = NOW.minus(Duration.ofMinutes(10))
            G.identityReverificationSatisfied(clean().context(change, disputed(NOW.minusSeconds(5)))) shouldBe false
            G.identityReverificationSatisfied(clean().context(change, disputed(NOW.minusSeconds(5)), confirmed())) shouldBe true
            G.identityReverificationSatisfied(clean().context(change, confirmed(at = NOW.minusSeconds(5)), disputed(NOW))) shouldBe false
        }
        test("identityReverificationSatisfied never reads a tenant window shorter than 60 000 ms, and reads a longer one") {
            G.identityReverificationSatisfied(clean().context(NOW.minusSeconds(30), window = Duration.ofSeconds(1))) shouldBe false
            G.identityReverificationSatisfied(clean().context(NOW.minus(Duration.ofMinutes(10)), window = Duration.ofMinutes(15))) shouldBe
                false
            G.identityReverificationSatisfied(clean().context(NOW.minus(Duration.ofMinutes(16)), window = Duration.ofMinutes(15))) shouldBe
                true
        }

        // ---- SI-15
        test("notOfflineWithoutFullCds holds online, and when only the internet or the WAN is lost") {
            listOf(ConnectivityMode.ONLINE, ConnectivityMode.INTERNET_LOST, ConnectivityMode.WAN_LOST).forEach { mode ->
                G.notOfflineWithoutFullCds(clean().copy(issuedInMode = mode)) shouldBe true
            }
        }
        test("notOfflineWithoutFullCds fails in every offline mode and for an unknown mode") {
            listOf(ConnectivityMode.ON_SITE_CELL_LOST, ConnectivityMode.EDGE_AGENT, ConnectivityMode.MOBILE_OFFLINE, null).forEach { mode ->
                G.notOfflineWithoutFullCds(clean().copy(issuedInMode = mode)) shouldBe false
            }
        }
        test("notOfflineWithoutFullCds holds in an offline mode the offline matrix lists with full CDS") {
            val facts =
                clean().copy(issuedInMode = ConnectivityMode.EDGE_AGENT).config {
                    copy(offlineModesWithFullCds = setOf(ConnectivityMode.EDGE_AGENT))
                }
            G.notOfflineWithoutFullCds(facts) shouldBe true
        }

        // ---- CDS (DN-052 item 8)
        test("localHardStopsSatisfied holds when no matching local rule fired or failed, and when none matches") {
            G.localHardStopsSatisfied(clean()) shouldBe true
            G.localHardStopsSatisfied(clean().cds { copy(localRules = emptyList()) }) shouldBe true
        }
        test("localHardStopsSatisfied fails when a local rule fired, even for a STAT or emergency-listed order") {
            val fired = clean().cds { copy(localRules = listOf(LocalRuleOutcome.FIRED)) }
            G.localHardStopsSatisfied(fired) shouldBe false
            G.localHardStopsSatisfied(fired.order { copy(priority = OrderPriority.STAT) }) shouldBe false
            G.localHardStopsSatisfied(fired.formulary { copy(onEmergencyOverrideList = true) }) shouldBe false
        }
        test("localHardStopsSatisfied fails closed when a rule could not run or the runtime gave no evaluation") {
            G.localHardStopsSatisfied(clean().cds { copy(localRules = listOf(LocalRuleOutcome.COULD_NOT_RUN)) }) shouldBe false
            G.localHardStopsSatisfied(clean().cds { copy(localRules = null) }) shouldBe false
            G.localHardStopsSatisfied(clean().cds { copy(localRules = null) }.formulary { copy(onEmergencyOverrideList = null) }) shouldBe
                false
        }
        test("localHardStopsSatisfied holds for a rule that could not run on a STAT or emergency-listed order (the gap is recorded)") {
            val failed = clean().cds { copy(localRules = listOf(LocalRuleOutcome.COULD_NOT_RUN)) }
            G.localHardStopsSatisfied(failed.order { copy(priority = OrderPriority.STAT) }) shouldBe true
            G.localHardStopsSatisfied(failed.formulary { copy(onEmergencyOverrideList = true) }) shouldBe true
            G.localHardStopsSatisfied(failed.order { copy(priority = OrderPriority.ASAP) }) shouldBe false
        }

        test("kbHardStopNotFired fails when the KB answered in exactly the ordered unit, in time, and fired its Tier A hard stop") {
            G.kbHardStopNotFired(clean().cds { copy(kbDoseCheck = KbDoseCheck(true, KbAnswer(OrderSamples.UNIT, true, true))) }) shouldBe
                false
        }
        test("kbHardStopNotFired holds when the KB answered and the threshold was not met, or no KB rule covers the order") {
            G.kbHardStopNotFired(clean()) shouldBe true
            G.kbHardStopNotFired(clean().cds { copy(kbDoseCheck = KbDoseCheck(false, KbAnswer(OrderSamples.UNIT, true, true))) }) shouldBe
                true
        }
        test("kbHardStopNotFired holds whenever the KB gave no usable answer (outage, no reference, other unit, late, no dose)") {
            listOf(
                KbDoseCheck(true, null),
                KbDoseCheck(true, KbAnswer(null, true, true)),
                KbDoseCheck(true, KbAnswer(OrderSamples.OTHER_UNIT, true, true)),
                KbDoseCheck(true, KbAnswer(OrderSamples.UNIT, false, true)),
            ).forEach { check -> G.kbHardStopNotFired(clean().cds { copy(kbDoseCheck = check) }) shouldBe true }
            val firedAnswer = clean().cds { copy(kbDoseCheck = KbDoseCheck(true, KbAnswer(OrderSamples.UNIT, true, true))) }
            G.kbHardStopNotFired(firedAnswer.order { copy(orderedDose = null) }) shouldBe true
        }

        test("interruptiveAlertsAnswered holds with no alert, an alert resolved by change, or one overridden with a chosen reason") {
            G.interruptiveAlertsAnswered(clean()) shouldBe true
            val answered =
                listOf(
                    TierBAlert(AlertResolution.RESOLVED_BY_CHANGE, null),
                    TierBAlert(AlertResolution.OVERRIDDEN, reason(OrderSamples.REASON)),
                )
            G.interruptiveAlertsAnswered(clean().cds { copy(tierBAlerts = answered) }) shouldBe true
        }
        test("interruptiveAlertsAnswered fails for an unresolved alert or an override whose reason was defaulted or missing") {
            listOf(
                TierBAlert(AlertResolution.UNRESOLVED, null),
                TierBAlert(AlertResolution.OVERRIDDEN, reason(OrderSamples.REASON, chosen = false)),
                TierBAlert(AlertResolution.OVERRIDDEN, reason(null)),
                TierBAlert(AlertResolution.OVERRIDDEN, null),
            ).forEach { alert -> G.interruptiveAlertsAnswered(clean().cds { copy(tierBAlerts = listOf(alert)) }) shouldBe false }
        }

        test("cdsGapsReviewed holds with no gap, a gap since answered, or the verifying pharmacist's attested manual check") {
            G.cdsGapsReviewed(clean()) shouldBe true
            G.cdsGapsReviewed(clean().cds { copy(gaps = listOf(CdsGap(true, null))) }) shouldBe true
            G.cdsGapsReviewed(clean().cds { copy(gaps = listOf(CdsGap(false, ManualCheck(OrderSamples.ISSUER, true)))) }) shouldBe true
        }
        test("cdsGapsReviewed fails for an unreviewed gap, another pharmacist's check, an unattested check or an unknown verifier") {
            G.cdsGapsReviewed(clean().cds { copy(gaps = listOf(CdsGap(false, null))) }) shouldBe false
            G.cdsGapsReviewed(clean().cds { copy(gaps = listOf(CdsGap(false, ManualCheck(OrderSamples.OTHER_USER, true)))) }) shouldBe false
            G.cdsGapsReviewed(clean().cds { copy(gaps = listOf(CdsGap(false, ManualCheck(OrderSamples.ISSUER, false)))) }) shouldBe false
            val checked = clean().cds { copy(gaps = listOf(CdsGap(false, ManualCheck(null, true)))) }
            G.cdsGapsReviewed(checked.issuer { copy(userId = null) }) shouldBe false
        }

        // ---- ordering rules
        test("coSignRuleSatisfied holds when no rule requires a co-signature, or a privileged other practitioner co-signed") {
            G.coSignRuleSatisfied(clean()) shouldBe true
            val cosigned = CoSign(true, CoSignature(OrderSamples.clinician(OrderSamples.COSIGNER)))
            G.coSignRuleSatisfied(clean().copy(coSign = cosigned)) shouldBe true
        }
        test("coSignRuleSatisfied fails with no co-signature, or a self, unauthenticated, unlicensed or unprivileged co-signer") {
            val cosigner = OrderSamples.clinician(OrderSamples.COSIGNER)
            listOf(
                null,
                CoSignature(OrderSamples.clinician()),
                CoSignature(cosigner.copy(authenticatedForThisCommand = false)),
                CoSignature(cosigner.copy(licences = listOf(Licence(LicenceKind.PRACTITIONER, NOW)))),
                CoSignature(cosigner.copy(privileges = emptySet())),
                CoSignature(cosigner.copy(userId = null)),
            ).forEach { signature -> G.coSignRuleSatisfied(clean().copy(coSign = CoSign(true, signature))) shouldBe false }
        }

        test("verbalOrderPermitted holds for a non-verbal order and for a verbal order the policy allows, received by a privileged user") {
            G.verbalOrderPermitted(clean()) shouldBe true
            G.verbalOrderPermitted(clean().copy(verbal = OrderSamples.verbalOrder())) shouldBe true
        }
        test("verbalOrderPermitted fails outside the policy's situations, for an unprivileged receiver or an unknown privilege") {
            val verbal = OrderSamples.verbalOrder()
            G.verbalOrderPermitted(clean().copy(verbal = verbal.copy(situationAllowed = false))) shouldBe false
            G.verbalOrderPermitted(clean().copy(verbal = verbal.copy(receiver = verbal.receiver.copy(privileges = emptySet())))) shouldBe
                false
            G.verbalOrderPermitted(clean().copy(verbal = verbal).config { copy(verbalReceiptPrivilege = null) }) shouldBe false
        }

        test("verbalOrderDocumented holds for a non-verbal order, and for a read-back with a co-sign due time exactly at the limit") {
            G.verbalOrderDocumented(clean()) shouldBe true
            val verbal = OrderSamples.verbalOrder()
            G.verbalOrderDocumented(clean().copy(verbal = verbal)) shouldBe true
            val atLimit = verbal.copy(coSignDueAt = verbal.receivedAt?.plus(Duration.ofHours(24)))
            G.verbalOrderDocumented(clean().copy(verbal = atLimit)) shouldBe true
        }
        test("verbalOrderDocumented fails beyond the limit, at the receipt time, without a read-back or with an unknown time or limit") {
            val verbal = OrderSamples.verbalOrder()
            val received = verbal.receivedAt ?: NOW
            listOf(
                verbal.copy(coSignDueAt = received.plus(Duration.ofHours(24)).plusMillis(1)),
                verbal.copy(coSignDueAt = received),
                verbal.copy(coSignDueAt = null),
                verbal.copy(receivedAt = null),
                verbal.copy(readBack = null),
                verbal.copy(readBack = ReadBack(OrderSamples.OTHER_USER, OrderSamples.RECEIVER, received)),
                verbal.copy(readBack = ReadBack(OrderSamples.SOURCE, null, received)),
                verbal.copy(readBack = ReadBack(OrderSamples.SOURCE, OrderSamples.RECEIVER, null)),
            ).forEach { v -> G.verbalOrderDocumented(clean().copy(verbal = v)) shouldBe false }
            G.verbalOrderDocumented(clean().copy(verbal = verbal).config { copy(coSignLimit = null) }) shouldBe false
        }

        test("notVerbalAntineoplastic holds for a non-verbal antineoplastic and a verbal non-antineoplastic or non-medication order") {
            G.notVerbalAntineoplastic(clean().formulary { copy(antineoplastic = true) }) shouldBe true
            G.notVerbalAntineoplastic(clean().copy(verbal = OrderSamples.verbalOrder())) shouldBe true
            G.notVerbalAntineoplastic(clean(OrderKind.LABORATORY).copy(verbal = OrderSamples.verbalOrder())) shouldBe true
        }
        test("notVerbalAntineoplastic fails for a verbal antineoplastic, an unknown flag or no formulary entry") {
            val verbal = clean().copy(verbal = OrderSamples.verbalOrder())
            G.notVerbalAntineoplastic(verbal.formulary { copy(antineoplastic = true) }) shouldBe false
            G.notVerbalAntineoplastic(verbal.formulary { copy(antineoplastic = null) }) shouldBe false
            G.notVerbalAntineoplastic(verbal.order { copy(formulary = null) }) shouldBe false
        }

        test("restrictedAntimicrobialApproved holds for an unrestricted order, and for a restricted one with indication and approver") {
            G.restrictedAntimicrobialApproved(clean()) shouldBe true
            val approver = OrderSamples.clinician(OrderSamples.APPROVER).copy(roles = setOf(StaffRole.ANTIMICROBIAL_APPROVER))
            val restricted = clean().formulary { copy(antimicrobial = true, restricted = true) }
            G.restrictedAntimicrobialApproved(restricted.copy(antimicrobialApprover = approver)) shouldBe true
        }
        test("restrictedAntimicrobialApproved holds for a STAT or ASAP restricted order with an indication and no approver yet") {
            val restricted = clean().formulary { copy(antimicrobial = true, restricted = true) }
            G.restrictedAntimicrobialApproved(restricted.order { copy(priority = OrderPriority.STAT) }) shouldBe true
            G.restrictedAntimicrobialApproved(restricted.order { copy(priority = OrderPriority.ASAP) }) shouldBe true
        }
        test("restrictedAntimicrobialApproved fails without an approver, for the signer as approver, a non-approver or no indication") {
            val approver = OrderSamples.clinician(OrderSamples.APPROVER).copy(roles = setOf(StaffRole.ANTIMICROBIAL_APPROVER))
            val restricted = clean().formulary { copy(antimicrobial = true, restricted = true) }
            G.restrictedAntimicrobialApproved(restricted) shouldBe false
            G.restrictedAntimicrobialApproved(restricted.order { copy(priority = null) }) shouldBe false
            G.restrictedAntimicrobialApproved(restricted.copy(antimicrobialApprover = approver.copy(userId = OrderSamples.ISSUER))) shouldBe
                false
            G.restrictedAntimicrobialApproved(restricted.copy(antimicrobialApprover = approver.copy(roles = emptySet()))) shouldBe false
            val stat = restricted.order { copy(priority = OrderPriority.STAT, indication = null) }
            G.restrictedAntimicrobialApproved(stat) shouldBe false
        }
        test("restrictedAntimicrobialApproved reads an unknown restriction or class flag on a medicine as restricted") {
            G.restrictedAntimicrobialApproved(clean().formulary { copy(antimicrobial = true, restricted = null) }) shouldBe false
            G.restrictedAntimicrobialApproved(clean().order { copy(formulary = null) }) shouldBe false
            G.restrictedAntimicrobialApproved(clean(OrderKind.LABORATORY).order { copy(formulary = null) }) shouldBe true
        }

        test("antimicrobialStopOrReviewDateSet holds for a non-antimicrobial, and for an antimicrobial with a stop or review date") {
            G.antimicrobialStopOrReviewDateSet(clean().order { copy(stopDate = null) }) shouldBe true
            val antimicrobial = clean().formulary { copy(antimicrobial = true) }
            G.antimicrobialStopOrReviewDateSet(antimicrobial) shouldBe true
            G.antimicrobialStopOrReviewDateSet(antimicrobial.order { copy(stopDate = null, reviewDate = NOW) }) shouldBe true
        }
        test("antimicrobialStopOrReviewDateSet fails for an antimicrobial (or unknown class) with neither date") {
            G.antimicrobialStopOrReviewDateSet(clean().formulary { copy(antimicrobial = true) }.order { copy(stopDate = null) }) shouldBe
                false
            G.antimicrobialStopOrReviewDateSet(clean().formulary { copy(antimicrobial = null) }.order { copy(stopDate = null) }) shouldBe
                false
        }

        test("indicationRecordedWhereRequired holds where no indication is required, and where one is recorded") {
            G.indicationRecordedWhereRequired(clean().order { copy(indication = null) }) shouldBe true
            G.indicationRecordedWhereRequired(clean(OrderKind.IMAGING)) shouldBe true
        }
        test("indicationRecordedWhereRequired fails for an antimicrobial, a PRN or an imaging order without an indication") {
            G.indicationRecordedWhereRequired(clean().formulary { copy(antimicrobial = null) }.order { copy(indication = null) }) shouldBe
                false
            G.indicationRecordedWhereRequired(clean().order { copy(prn = true, indication = " ") }) shouldBe false
            G.indicationRecordedWhereRequired(clean(OrderKind.IMAGING).order { copy(indication = null) }) shouldBe false
        }

        test("datedWeightRecordedIfWeightBased holds for an absolute dose, and for a weight-based dose with a dated, sourced weight") {
            G.datedWeightRecordedIfWeightBased(clean().copy(patient = PatientFacts(null, false))) shouldBe true
            listOf(WeightSource.MEASURED, WeightSource.STATED, WeightSource.ESTIMATED).forEach { source ->
                val facts =
                    clean()
                        .order {
                            copy(doseBasis = DoseBasis.PER_BODY_SURFACE_AREA)
                        }.copy(patient = PatientFacts(DosingWeight(NOW, source), false))
                G.datedWeightRecordedIfWeightBased(facts) shouldBe true
            }
        }
        test("datedWeightRecordedIfWeightBased fails for a weight-based dose with no weight, an undated weight or an unknown source") {
            val weightBased = clean().order { copy(doseBasis = DoseBasis.PER_BODY_WEIGHT) }
            listOf(null, DosingWeight(null, WeightSource.MEASURED), DosingWeight(NOW, null)).forEach { weight ->
                G.datedWeightRecordedIfWeightBased(weightBased.copy(patient = PatientFacts(weight, false))) shouldBe false
            }
        }

        test("replacedOrderDiscontinuable holds for a draft that replaces nothing, or an open order the signer may discontinue") {
            G.replacedOrderDiscontinuable(clean()) shouldBe true
            listOf(OrderState.PENDING_VERIFICATION, OrderState.ACTIVE, OrderState.ON_HOLD).forEach { state ->
                val replaced = ReplacedOrder(state, false, null)
                G.replacedOrderDiscontinuable(clean().order { copy(replaces = replaced) }) shouldBe true
            }
        }
        test("replacedOrderDiscontinuable fails for a replaced order that is ended, already replaced or not discontinuable") {
            listOf(OrderState.DRAFT, OrderState.COMPLETED, OrderState.REVOKED, OrderState.ENTERED_IN_ERROR).forEach { state ->
                G.replacedOrderDiscontinuable(clean().order { copy(replaces = ReplacedOrder(state, false, null)) }) shouldBe false
            }
            G.replacedOrderDiscontinuable(clean().order { copy(replaces = ReplacedOrder(OrderState.ACTIVE, true, null)) }) shouldBe false
            val configured = ReplacedOrder(OrderState.ACTIVE, false, StopPrivilege("SYN-PRIV-NONE", true))
            G.replacedOrderDiscontinuable(clean().order { copy(replaces = configured) }) shouldBe false
        }

        // ---- verification status (exact complements)
        test("notReturned holds and verificationReturned fails for a pending or verified order and a non-medication order") {
            listOf(
                clean(status = VerificationStatus.PENDING),
                clean(status = VerificationStatus.VERIFIED),
                clean(OrderKind.LABORATORY),
            ).forEach { facts ->
                G.notReturned(facts) shouldBe true
                G.verificationReturned(facts) shouldBe false
            }
        }
        test("notReturned fails and verificationReturned holds for a returned order, and for a medication order with no status") {
            listOf(clean(status = VerificationStatus.RETURNED), clean().order { copy(verificationStatus = null) }).forEach { facts ->
                G.notReturned(facts) shouldBe false
                G.verificationReturned(facts) shouldBe true
            }
        }

        // ---- control set A (disjoint pair)
        test("controlSetASatisfied holds when the set does not apply and no calculation was recorded since the last submission") {
            G.controlSetASatisfied(clean()) shouldBe true
            G.controlSetAMismatch(clean()) shouldBe false
        }
        test("controlSetASatisfied fails when the set applies and no calculation was recorded (weight, high-alert infusion, neonate)") {
            listOf(
                clean().order { copy(doseBasis = DoseBasis.PER_BODY_WEIGHT) },
                clean().order { copy(infusion = true) }.formulary { copy(highAlert = true) },
                clean().order { copy(infusion = true) }.formulary { copy(highAlert = null) },
                clean().copy(patient = PatientFacts(null, null)),
                clean().copy(patient = PatientFacts(null, true)),
            ).forEach { facts ->
                G.controlSetASatisfied(facts) shouldBe false
                G.controlSetAMismatch(facts) shouldBe false
            }
        }
        test("controlSetASatisfied holds for the verifier's attested calculation equal in value and unit, every bound, 5 equal to 5.00") {
            val applies = clean().order { copy(doseBasis = DoseBasis.PER_BODY_WEIGHT) }
            G.controlSetASatisfied(applies.copy(calculations = listOf(OrderSamples.matchingCalculation()))) shouldBe true
            val scaled = OrderSamples.matchingCalculation().copy(dose = OrderSamples.ORDERED.copy(lower = BigDecimal("5.00")))
            G.controlSetASatisfied(applies.copy(calculations = listOf(scaled))) shouldBe true
            val range = DoseAmount(BigDecimal.ONE, BigDecimal.TWO, OrderSamples.UNIT)
            val ranged =
                applies
                    .order {
                        copy(
                            orderedDose = range,
                        )
                    }.copy(calculations = listOf(OrderSamples.matchingCalculation().copy(dose = range)))
            G.controlSetASatisfied(ranged) shouldBe true
        }
        test("controlSetASatisfied fails for another pharmacist's, an unattested or an unknown-author calculation, or no ordered dose") {
            val calc = OrderSamples.matchingCalculation()
            listOf(
                clean().copy(calculations = listOf(calc.copy(recordedBy = OrderSamples.OTHER_USER))),
                clean().copy(calculations = listOf(calc.copy(attestedMatches = false))),
                clean().copy(calculations = listOf(calc.copy(recordedBy = null))).issuer { copy(userId = null) },
                clean().order { copy(doseBasis = DoseBasis.PER_BODY_WEIGHT, orderedDose = null) },
            ).forEach { facts -> G.controlSetASatisfied(facts) shouldBe false }
        }
        test("controlSetAMismatch holds for a latest calculation differing in value, unit or range bound, applying or not") {
            val calc = OrderSamples.matchingCalculation()
            val ordered = OrderSamples.ORDERED
            listOf(
                ordered.copy(lower = BigDecimal("50")),
                ordered.copy(unit = OrderSamples.OTHER_UNIT),
                ordered.copy(upper = BigDecimal.TEN),
            ).forEach { dose ->
                val facts = clean().copy(calculations = listOf(calc.copy(dose = dose)))
                G.controlSetAMismatch(facts) shouldBe true
                G.controlSetASatisfied(facts) shouldBe false
            }
            G.controlSetAMismatch(clean().order { copy(orderedDose = null) }.copy(calculations = listOf(calc))) shouldBe true
        }
        test("controlSetAMismatch and controlSetASatisfied read only the latest calculation recorded strictly after the last submission") {
            val submitted = NOW.minus(Duration.ofHours(1))
            val oldMismatch =
                OrderSamples.matchingCalculation().copy(
                    recordedAt = submitted,
                    dose = OrderSamples.ORDERED.copy(unit = OrderSamples.OTHER_UNIT),
                )
            val laterMatch = OrderSamples.matchingCalculation()
            G.controlSetAMismatch(clean().copy(calculations = listOf(oldMismatch))) shouldBe false
            G.controlSetASatisfied(clean().copy(calculations = listOf(oldMismatch))) shouldBe true
            val newerMismatch = oldMismatch.copy(recordedAt = NOW)
            G.controlSetAMismatch(clean().copy(calculations = listOf(laterMatch, newerMismatch))) shouldBe true
            G.controlSetASatisfied(clean().copy(calculations = listOf(newerMismatch, laterMatch))) shouldBe false
            G.controlSetAMismatch(clean().order { copy(lastSubmittedAt = null) }.copy(calculations = listOf(oldMismatch))) shouldBe true
        }

        // ---- reasons
        test("returnReasonEntered holds for a chosen code from the governed return list") {
            G.returnReasonEntered(clean()) shouldBe true
        }
        test("returnReasonEntered fails for a defaulted, unlisted, missing or 'other' reason, or a missing list") {
            listOf(
                null,
                reason(OrderSamples.REASON, chosen = false),
                reason(OrderSamples.UNLISTED_REASON),
                reason(null),
                reason("other", "x"),
            ).forEach { r ->
                G.returnReasonEntered(clean().copy(reason = r)) shouldBe false
            }
            G.returnReasonEntered(clean().config { copy(returnReasons = emptySet()) }) shouldBe false
        }

        test("prescriberResponseRecorded holds for the ordering practitioner, or a privileged practitioner, with a chosen response") {
            G.prescriberResponseRecorded(clean()) shouldBe true
            G.prescriberResponseRecorded(clean().issuer { copy(userId = OrderSamples.SIGNER, privileges = emptySet()) }) shouldBe true
        }
        test("prescriberResponseRecorded fails for the pharmacist who returned the order, even one with prescribing privileges") {
            G.prescriberResponseRecorded(clean().issuer { copy(userId = OrderSamples.RETURNER) }) shouldBe false
        }
        test("prescriberResponseRecorded fails for an unprivileged non-orderer, an unknown issuer or returner, or a defaulted reason") {
            G.prescriberResponseRecorded(clean().issuer { copy(privileges = emptySet()) }) shouldBe false
            G.prescriberResponseRecorded(clean().issuer { copy(userId = null) }) shouldBe false
            G.prescriberResponseRecorded(clean().order { copy(returnedBy = null) }) shouldBe false
            G.prescriberResponseRecorded(clean().copy(reason = reason(OrderSamples.REASON, chosen = false))) shouldBe false
            G.prescriberResponseRecorded(clean().config { copy(responseReasons = emptySet()) }) shouldBe false
        }

        test("holdReasonEntered holds for a chosen listed code, and for 'other' with free text even when the list is missing") {
            G.holdReasonEntered(clean()) shouldBe true
            G.holdReasonEntered(clean().copy(reason = reason("other", "SYN text")).config { copy(holdReasons = emptySet()) }) shouldBe true
        }
        test("holdReasonEntered holds for a registered system principal giving its system reason, and fails for another reason") {
            val system = clean().copy(issuer = OrderSamples.systemPrincipal())
            G.holdReasonEntered(system.copy(reason = reason(OrderSamples.SYSTEM_REASON, chosen = false))) shouldBe true
            G.holdReasonEntered(system.copy(reason = reason(OrderSamples.REASON))) shouldBe false
        }
        test("holdReasonEntered fails for a defaulted, unlisted or missing reason, or 'other' without free text") {
            listOf(
                null,
                reason(OrderSamples.REASON, chosen = false),
                reason(OrderSamples.UNLISTED_REASON),
                reason(null),
                reason("other", " "),
            ).forEach { r ->
                G.holdReasonEntered(clean().copy(reason = r)) shouldBe false
            }
        }

        // ---- verification on resume (exact complements)
        test("verifiedOrNotMedication holds and medicationAwaitingVerification fails for a verified or non-medication order") {
            listOf(clean(status = VerificationStatus.VERIFIED), clean(OrderKind.NURSING)).forEach { facts ->
                G.verifiedOrNotMedication(facts) shouldBe true
                G.medicationAwaitingVerification(facts) shouldBe false
            }
        }
        test("verifiedOrNotMedication fails and medicationAwaitingVerification holds for a pending, returned or status-less medicine") {
            listOf(
                clean(status = VerificationStatus.PENDING),
                clean(status = VerificationStatus.RETURNED),
                clean().order {
                    copy(verificationStatus = null)
                },
            ).forEach { facts ->
                G.verifiedOrNotMedication(facts) shouldBe false
                G.medicationAwaitingVerification(facts) shouldBe true
            }
        }

        // ---- SI-03 timers
        test("draftReviewDue holds exactly at the first review time (creation plus the interval) and fails 1 ms before") {
            val created = NOW.minus(Duration.ofHours(1))
            G.draftReviewDue(clean().order { copy(createdAt = created) }) shouldBe true
            G.draftReviewDue(clean().order { copy(createdAt = created.plusMillis(1)) }) shouldBe false
        }
        test("draftReviewDue fails while the owner task is open, and follows the previous review at the same interval") {
            G.draftReviewDue(clean().order { copy(draftReview = DraftReviewTimer(null, ownerTaskOpen = true)) }) shouldBe false
            G.draftReviewDue(clean().order { copy(draftReview = DraftReviewTimer(NOW.minus(Duration.ofMinutes(59)), false)) }) shouldBe
                false
            G.draftReviewDue(clean().order { copy(draftReview = DraftReviewTimer(NOW.minus(Duration.ofMinutes(60)), false)) }) shouldBe true
        }
        test("draftReviewDue uses the shorter pre-build interval, and the vendor default for a missing or zero interval") {
            val young = clean().order { copy(createdAt = NOW.minus(Duration.ofMinutes(30))) }
            G.draftReviewDue(young) shouldBe false
            G.draftReviewDue(young.order { copy(prebuild = true) }) shouldBe true
            val defaulted = clean().config { copy(draftReviewInterval = Duration.ZERO) }
            G.draftReviewDue(defaulted.order { copy(createdAt = NOW.minus(Duration.ofHours(3))) }) shouldBe false
            G.draftReviewDue(defaulted.order { copy(createdAt = NOW.minus(Duration.ofHours(4))) }) shouldBe true
            G.draftReviewDue(clean().config { copy(draftReviewInterval = null) }) shouldBe false
        }

        test("holdReviewDue holds exactly at the hold time plus the interval, and at an earlier review time the issuer set") {
            G.holdReviewDue(
                clean().order { copy(holdReview = HoldReviewTimer(NOW.minus(Duration.ofHours(1)), null, null, false)) },
            ) shouldBe
                true
            G.holdReviewDue(
                clean().order { copy(holdReview = HoldReviewTimer(NOW.minus(Duration.ofMinutes(10)), NOW, null, false)) },
            ) shouldBe
                true
        }
        test("holdReviewDue fails before it is due, while a review task is open, or for an order with no hold") {
            G.holdReviewDue(
                clean().order { copy(holdReview = HoldReviewTimer(NOW.minus(Duration.ofMinutes(59)), null, null, false)) },
            ) shouldBe
                false
            G.holdReviewDue(
                clean().order {
                    copy(holdReview = HoldReviewTimer(NOW.minus(Duration.ofMinutes(10)), NOW.plusMillis(1), null, false))
                },
            ) shouldBe
                false
            G.holdReviewDue(clean().order { copy(holdReview = holdReview?.copy(reviewTaskOpen = true)) }) shouldBe false
            G.holdReviewDue(clean().order { copy(holdReview = null) }) shouldBe false
        }
        test("holdReviewDue follows the previous review at the interval, and uses the vendor default when the interval is missing") {
            val reviewed = HoldReviewTimer(NOW.minus(Duration.ofHours(5)), null, NOW.minus(Duration.ofMinutes(30)), false)
            G.holdReviewDue(clean().order { copy(holdReview = reviewed) }) shouldBe false
            val defaulted = clean().config { copy(holdReviewInterval = null) }
            G.holdReviewDue(
                defaulted.order { copy(holdReview = HoldReviewTimer(NOW.minus(Duration.ofHours(3)), null, null, false)) },
            ) shouldBe
                false
            G.holdReviewDue(
                defaulted.order { copy(holdReview = HoldReviewTimer(NOW.minus(Duration.ofHours(4)), null, null, false)) },
            ) shouldBe
                true
        }

        // ---- completion
        test("fulfilmentComplete holds for a medication order past its stop date with every dose terminal") {
            G.fulfilmentComplete(clean()) shouldBe true
            G.fulfilmentComplete(
                clean().copy(fulfilment = clean().fulfilment.copy(medication = MedicationFulfilment(false, null, emptyList()))),
            ) shouldBe
                true
        }
        test("fulfilmentComplete fails for a medication order with a dose open, at or before its stop date, or no stop date") {
            listOf(
                clean().copy(
                    fulfilment = clean().fulfilment.copy(medication = MedicationFulfilment(false, null, listOf(DoseProgress.SCHEDULED))),
                ),
                clean().copy(
                    fulfilment = clean().fulfilment.copy(medication = MedicationFulfilment(false, null, listOf(DoseProgress.IN_PROGRESS))),
                ),
                clean().order { copy(stopDate = NOW) },
                clean().order { copy(stopDate = null) },
                clean().copy(fulfilment = clean().fulfilment.copy(medication = null)),
            ).forEach { facts -> G.fulfilmentComplete(facts) shouldBe false }
        }
        test("fulfilmentComplete for a once-only or fixed-count order reads the last dose's due time as the stop date") {
            val onceOnly = { due: Instant? ->
                clean().copy(
                    fulfilment = clean().fulfilment.copy(medication = MedicationFulfilment(true, due, listOf(DoseProgress.TERMINAL))),
                )
            }
            G.fulfilmentComplete(onceOnly(NOW.minusMillis(1)).order { copy(stopDate = null) }) shouldBe true
            G.fulfilmentComplete(onceOnly(NOW)) shouldBe false
            G.fulfilmentComplete(onceOnly(null)) shouldBe false
        }
        test("fulfilmentComplete holds for a diagnostic order whose every item is final, amended or corrected") {
            val results = listOf(ResultState.FINAL, ResultState.AMENDED, ResultState.CORRECTED)
            G.fulfilmentComplete(
                clean(OrderKind.LABORATORY).copy(fulfilment = clean().fulfilment.copy(diagnosticResults = results)),
            ) shouldBe
                true
        }
        test("fulfilmentComplete fails for a diagnostic order with an item pending, cancelled or entered in error, or an unknown report") {
            listOf(
                listOf(ResultState.FINAL, null),
                listOf(ResultState.PRELIMINARY),
                listOf(ResultState.CANCELLED),
                listOf(ResultState.ENTERED_IN_ERROR),
                emptyList(),
                null,
            ).forEach { results ->
                G.fulfilmentComplete(
                    clean(OrderKind.IMAGING).copy(fulfilment = clean().fulfilment.copy(diagnosticResults = results)),
                ) shouldBe
                    false
            }
        }
        test("fulfilmentComplete for any other order holds when its tasks are done and fails when not done or unknown") {
            G.fulfilmentComplete(clean(OrderKind.NURSING)) shouldBe true
            G.fulfilmentComplete(clean(OrderKind.NURSING).copy(fulfilment = clean().fulfilment.copy(otherTasksDone = false))) shouldBe false
            G.fulfilmentComplete(clean(OrderKind.NURSING).copy(fulfilment = clean().fulfilment.copy(otherTasksDone = null))) shouldBe false
        }

        // ---- discontinue and replacement (exact complements)
        test("reasonIsReplacement holds and reasonIsNotReplacement fails for the reason 'replaced'") {
            val facts = clean().copy(reason = reason(OrderGuards.REPLACED_REASON, chosen = false))
            G.reasonIsReplacement(facts) shouldBe true
            G.reasonIsNotReplacement(facts) shouldBe false
        }
        test("reasonIsReplacement fails and reasonIsNotReplacement holds for any other reason or none") {
            listOf(null, reason(OrderSamples.REASON), reason(null), reason("other", "x")).forEach { r ->
                G.reasonIsReplacement(clean().copy(reason = r)) shouldBe false
                G.reasonIsNotReplacement(clean().copy(reason = r)) shouldBe true
            }
        }

        test("discontinueReasonEntered holds for a chosen listed code, and for 'other' with free text even when the list is missing") {
            G.discontinueReasonEntered(clean()) shouldBe true
            G.discontinueReasonEntered(
                clean().copy(reason = reason("other", "SYN text")).config { copy(discontinueReasons = emptySet()) },
            ) shouldBe
                true
            val system = clean().copy(issuer = OrderSamples.systemPrincipal(), reason = reason(OrderSamples.SYSTEM_REASON, chosen = false))
            G.discontinueReasonEntered(system) shouldBe true
        }
        test("discontinueReasonEntered fails for 'replaced' even if a list contains it, and for a defaulted, unlisted or missing reason") {
            val replaced =
                clean().copy(reason = reason(OrderGuards.REPLACED_REASON)).config {
                    copy(discontinueReasons = setOf(OrderGuards.REPLACED_REASON))
                }
            G.discontinueReasonEntered(replaced) shouldBe false
            listOf(null, reason(OrderSamples.REASON, chosen = false), reason(OrderSamples.UNLISTED_REASON), reason("other", null)).forEach { r ->
                G.discontinueReasonEntered(clean().copy(reason = r)) shouldBe false
            }
        }

        test("replacingOrderSignedTogether holds when the replacing order replaces this order and is signed by this command") {
            G.replacingOrderSignedTogether(clean()) shouldBe true
        }
        test("replacingOrderSignedTogether fails for no replacing order, another order's link, or another or no signing command") {
            listOf(
                null,
                ReplacingOrder(null, OrderSamples.COMMAND_ID),
                ReplacingOrder("SYN-ORD-0002", OrderSamples.COMMAND_ID),
                ReplacingOrder(OrderSamples.ORDER_ID, null),
                ReplacingOrder(OrderSamples.ORDER_ID, "SYN-CMD-0002"),
            ).forEach { replacing -> G.replacingOrderSignedTogether(clean().copy(replacingOrder = replacing)) shouldBe false }
        }

        // ---- correction
        test("privilegedAndAudited holds for an issuer with the entered-in-error privilege when the audit record can be written") {
            G.privilegedAndAudited(clean()) shouldBe true
        }
        test("privilegedAndAudited fails without the privilege, with an unknown privilege, or during an audit outage") {
            G.privilegedAndAudited(clean().issuer { copy(privileges = privileges - OrderSamples.PRIV_ERROR) }) shouldBe false
            G.privilegedAndAudited(clean().config { copy(enteredInErrorPrivilege = null) }) shouldBe false
            G.privilegedAndAudited(clean().copy(auditWritable = false)) shouldBe false
        }

        test("errorReasonEntered holds for a chosen code from the governed list") {
            G.errorReasonEntered(clean()) shouldBe true
        }
        test("errorReasonEntered fails for a defaulted, unlisted or missing reason, or a missing list") {
            listOf(null, reason(OrderSamples.REASON, chosen = false), reason(OrderSamples.UNLISTED_REASON), reason(null)).forEach { r ->
                G.errorReasonEntered(clean().copy(reason = r)) shouldBe false
            }
            G.errorReasonEntered(clean().config { copy(errorReasons = emptySet()) }) shouldBe false
        }

        // ---- the facts type
        test("OrderConfiguration refuses a zero vendor default review interval (never zero)") {
            io.kotest.assertions.throwables.shouldThrow<IllegalArgumentException> {
                OrderSamples.configuration().copy(vendorDefaultReviewInterval = Duration.ZERO)
            }
        }
    })
