package hms.tests.scenarios.application.catalogue

import hms.tests.scenarios.api.PlannedScenario
import hms.tests.scenarios.api.ScenarioSuite
import hms.tests.scenarios.api.WaitsOn

/**
 * The ten clinical scenario suites of BUILD-PROMPT §18.5 (docs/specs/modules/state-machines-and-invariants.md §5).
 *
 * Each suite's area is the name the hazard log plans (`ScenarioSuite:<area>` in `docs/safety/hazard-log.yaml`). Its
 * hazards are the hazard-log entries with a control that plans it, its SIs and seeded hazards are those entries'
 * (`SuiteCatalogueTest` checks all three against the hazard log). The scenarios are titles taken verbatim from §18.5,
 * registered as NOT-BUILT stubs: none has steps, none can pass, and none holds a clinical value. Writing them needs
 * CSO-approved content where §18.5 says so [HUMAN]. No suite has a binding, so all ten are NOT-BUILT (KA-064); each
 * names the §21 work packages and the Appendix A features that bind it.
 *
 * Unlinked seeded hazards are this build's proposal [P] where §18.5's text exercises a seeded hazard (§2.4) that no
 * hazard-log entry linked to the suite carries; they await CSO triage [HUMAN] and are never treated as links.
 */
object SuiteCatalogue {
    /** The known anomaly that lists the NOT-BUILT suites. */
    const val KNOWN_ANOMALY: String = "KA-064"

    private const val CSO_CONTENT = "CSO-approved scenario content [HUMAN] (§18.5)"
    private const val LICENSED_KB = "the licensed drug knowledge base (Q-K8) [HUMAN]"

    private val cpoe =
        ScenarioSuite(
            area = "cpoe-error-category-harness",
            number = 1,
            title = "CPOE error-category harness",
            hazards = listOf("HAZ-0005", "HAZ-0014"),
            seededHazards = listOf("H2", "H4"),
            invariants = listOf("SI-05", "SI-14"),
            mockKb = true,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-1.5", "WP-3.1", "WP-3.14"),
                    backlog = listOf("CLN-CDS-01", "CLN-CDS-02", "CLN-CDS-03", "CLN-ORD-02"),
                    knownAnomaly = KNOWN_ANOMALY,
                    human = listOf(LICENSED_KB, "CSO-approved scenarios for the threshold [HUMAN] (§18.5 #1, §21 WP-3.14)"),
                ),
            scenarios =
                PlannedScenario.numbered(
                    "cpoe-error-category-harness",
                    listOf("serious-error scenarios", "Excessive Alerts", "\"should not alert\" set", "alert-budget accounting"),
                ),
            sources =
                listOf(
                    "§18.5 #1 (Leapfrog-style and unofficial: never report a \"Leapfrog result\")",
                    "§21 WP-1.5 (mock-KB run on foundation content), WP-3.1, WP-3.14 (licensed KB, CSO-approved scenarios)",
                    "hazard log CTRL-0005-2, CTRL-0014-2, CTRL-0014-8",
                ),
        )

    private val ismp =
        ScenarioSuite(
            area = "ismp",
            number = 2,
            title = "ISMP",
            hazards = listOf("HAZ-0005", "HAZ-0013"),
            seededHazards = listOf("H2"),
            invariants = listOf("SI-05", "SI-13"),
            // Stricter reading [P]: the ISMP scenarios are caught by KB rules too, so a mock-KB run is not
            // clinical evidence either. §18.5 states the label for #1 only; proposed as a CSO decision.
            mockKb = true,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-1.5", "WP-1.6", "WP-3.1", "WP-3.2", "WP-3.3", "WP-3.14"),
                    backlog = listOf("CLN-CDS-01", "CLN-CDS-02", "MED-FRM-01", "CLN-ORD-02", "MED-PHV-01", "MED-MAR-01", "MED-INF-01"),
                    knownAnomaly = KNOWN_ANOMALY,
                    human = listOf(LICENSED_KB, CSO_CONTENT),
                ),
            scenarios =
                PlannedScenario.numbered(
                    "ismp",
                    listOf(
                        "weekly methotrexate",
                        "minibag vincristine",
                        "opioid tolerance",
                        "metric-only weights",
                        "10× decimal errors",
                        "look-alike/sound-alike drugs",
                        "concentration standardisation",
                        "insulin and heparin protocols",
                        "seeded 10× and unit errors in every integrated cycle",
                    ),
                ),
            sources =
                listOf(
                    "§18.5 #2",
                    "§21 WP-3.2 (the KB ≥10× hard stop; seeded 10× errors stopped), WP-3.3 (high-alert double check), " +
                        "WP-3.14 (integrated test cycles with seeded errors)",
                    "hazard log CTRL-0005-2, CTRL-0005-16, CTRL-0013-2",
                ),
        )

    private val closedLoop =
        ScenarioSuite(
            area = "closed-loop-medication",
            number = 3,
            title = "Closed-loop medication",
            hazards = listOf("HAZ-0001", "HAZ-0002", "HAZ-0005", "HAZ-0012", "HAZ-0013", "HAZ-0015"),
            seededHazards = listOf("H1", "H2", "H4", "H6"),
            invariants = listOf("SI-01", "SI-02", "SI-05", "SI-12", "SI-13", "SI-15"),
            mockKb = false,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-2.4", "WP-3.1", "WP-3.2", "WP-3.3", "WP-3.13"),
                    backlog = listOf("MED-DSP-01", "CLN-ORD-02", "MED-PHV-01", "MED-MAR-01", "MED-BCM-01", "PLT-UX-04", "IMP-MIG-01"),
                    knownAnomaly = KNOWN_ANOMALY,
                    human = listOf(CSO_CONTENT),
                ),
            scenarios =
                PlannedScenario.numbered(
                    "closed-loop-medication",
                    listOf(
                        "prescribe → verify → dispense → BCMA",
                        "wrong patient",
                        "wrong drug",
                        "expired product",
                        "dose out of range",
                        "discontinued in transit",
                        "offline administration on a stale order",
                        "PRN double dose at shift change",
                        "cutover \"last given\" carry-over",
                        "no payment rule delays a time-critical dose",
                        "unverified patient-supplied medicine cannot be scanned",
                    ),
                ),
            unlinkedSeededHazards = listOf("H11"),
            sources =
                listOf(
                    "§18.5 #3 (H11 cutover double dose: the \"last given\" carry-over scenario; no hazard-log entry carries H11)",
                    "§21 WP-2.4 (patient-supplied medicine workflow), WP-3.1, WP-3.2, WP-3.3, WP-3.13 (\"last given\" banner)",
                    "hazard log CTRL-0001-2, CTRL-0002-2, CTRL-0002-6, CTRL-0005-2, CTRL-0012-2, CTRL-0013-2, CTRL-0015-2",
                ),
        )

    private val transfusion =
        ScenarioSuite(
            area = "transfusion",
            number = 4,
            title = "Transfusion",
            hazards = listOf("HAZ-0001", "HAZ-0011"),
            seededHazards = listOf("H1", "H8"),
            invariants = listOf("SI-01", "SI-11"),
            mockKb = false,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-1.7", "WP-3.4", "WP-3.10"),
                    backlog = listOf("DX-LAB-01", "NUR-FLW-01", "DX-BB-01", "DX-BB-KRI-01", "DX-BB-02"),
                    knownAnomaly = KNOWN_ANOMALY,
                    human = listOf(CSO_CONTENT),
                ),
            scenarios =
                PlannedScenario.numbered(
                    "transfusion",
                    listOf(
                        "consent → bedside-labelled sample → request → issue → two-person check → vitals → reaction → haemovigilance",
                        "a mismatch injected at each step",
                        "relabel at receipt with blind double entry; relabel errors must be 0",
                    ),
                ),
            sources =
                listOf(
                    "§18.5 #4",
                    "§21 WP-1.7 (specimen lifecycle), WP-3.4 (flowsheets), WP-3.10 (relabel with blind double entry; reg-transfusion)",
                    "hazard log CTRL-0001-2, CTRL-0011-2, CTRL-0011-4, CTRL-0011-6, CTRL-0011-11",
                ),
        )

    private val resultsClosure =
        ScenarioSuite(
            area = "results-closure",
            number = 5,
            title = "Results closure",
            hazards = listOf("HAZ-0003", "HAZ-0004", "HAZ-0017"),
            seededHazards = listOf("H3", "H5"),
            invariants = listOf("SI-03", "SI-04", "SI-17"),
            mockKb = false,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-0.3", "WP-1.7", "WP-3.11"),
                    backlog = listOf("PLT-CORE-07", "DX-ORD-01", "DX-CRT-01", "CLN-RES-01", "CLN-DOC-03"),
                    knownAnomaly = KNOWN_ANOMALY,
                    human = listOf("critical-value policy tables as governed content [HUMAN] (§9.7, §3.4 item 3)"),
                ),
            scenarios =
                PlannedScenario.numbered(
                    "results-closure",
                    listOf(
                        "critical value → named recipient → escalation",
                        "a discharged patient's result",
                        "an amended result",
                        "external referrers",
                    ),
                ),
            sources =
                listOf(
                    "§18.5 #5",
                    "§21 WP-0.3 (task engine, escalation), WP-1.7 (critical results to named internal and external " +
                        "recipients), WP-3.11 (results inbox, pending-at-discharge queues)",
                    "hazard log CTRL-0003-2, CTRL-0004-2, CTRL-0004-5, CTRL-0004-6, CTRL-0017-2",
                ),
        )

    private val identity =
        ScenarioSuite(
            area = "identity",
            number = 6,
            title = "Identity",
            hazards = listOf("HAZ-0001", "HAZ-0008", "HAZ-0016"),
            seededHazards = listOf("H1", "H12"),
            invariants = listOf("SI-01", "SI-08", "SI-16"),
            mockKb = false,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-0.6", "WP-1.1b", "WP-1.2"),
                    backlog = listOf("INT-ENG-01", "ACC-ID-01", "ACC-ID-02", "ACC-ID-03", "KRI-ID-01", "ACC-REG-01"),
                    knownAnomaly = KNOWN_ANOMALY,
                ),
            scenarios =
                PlannedScenario.numbered(
                    "identity",
                    listOf(
                        "newborn naming",
                        "trauma alias",
                        "merge/unmerge with downstream notification",
                        "similar-name alerts",
                        "cross-script duplicates",
                    ),
                ),
            sources =
                listOf(
                    "§18.5 #6",
                    "§21 WP-0.6 (the §18.10 synthetic population with cross-script duplicates), WP-1.1b (outbound messages " +
                        "from domain events), WP-1.2 (reversible merge with downstream propagation)",
                    "hazard log CTRL-0001-2, CTRL-0008-2, CTRL-0008-4, CTRL-0008-5, CTRL-0016-2",
                ),
        )

    private val downtime =
        ScenarioSuite(
            area = "downtime",
            number = 7,
            title = "Downtime",
            hazards = listOf("HAZ-0001", "HAZ-0010", "HAZ-0015"),
            seededHazards = listOf("H1", "H2", "H6"),
            invariants = listOf("SI-01", "SI-10", "SI-15"),
            mockKb = false,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-0.2", "WP-0.3", "WP-1.13"),
                    backlog =
                        listOf(
                            "PLT-CORE-01",
                            "TRU-BCP-01",
                            "TRU-BCP-02",
                            "TRU-BCP-03",
                            "TRU-BCP-05",
                            "PLT-SITE-01",
                            "PLT-PWR-01",
                            "PLT-EDGE-01",
                        ),
                    knownAnomaly = KNOWN_ANOMALY,
                ),
            scenarios =
                PlannedScenario.numbered(
                    "downtime",
                    listOf(
                        "read-only continuity",
                        "pre-allocated IDs",
                        "back-entry with original times",
                        "cell loss",
                        "WAN cut",
                        "power cut",
                    ),
                ),
            unlinkedSeededHazards = listOf("H7"),
            sources =
                listOf(
                    "§18.5 #7 (H7 unavailability: cell loss, WAN cut, power cut; no hazard-log entry carries H7)",
                    "§21 WP-0.2 (the dev cell), WP-0.3 (clinical vs recorded time, the journal), WP-1.13 (continuity, " +
                        "downtime ID blocks, back-entry, power-loss resilience)",
                    "hazard log CTRL-0001-8, CTRL-0010-2, CTRL-0010-6, CTRL-0015-2",
                ),
        )

    private val deterioration =
        ScenarioSuite(
            area = "deterioration",
            number = 8,
            title = "Deterioration",
            hazards = listOf("HAZ-0018"),
            seededHazards = emptyList(),
            invariants = listOf("SI-18"),
            mockKb = false,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-0.9", "WP-3.4", "WP-3.5"),
                    backlog = listOf("TRU-REG-01", "NUR-FLW-01", "NUR-FLW-02", "CLN-CDS-05"),
                    knownAnomaly = KNOWN_ANOMALY,
                    human =
                        listOf(
                            "the NEWS2 source document in docs/content-sources with its licence status [HUMAN] (§3.5)",
                            "the hospital's PEWS and MEOWS variants as governed content [HUMAN] (§3.5)",
                            "CSO approval before activation [HUMAN] (§3.5)",
                        ),
                ),
            // §3.5: the NEWS2 bands become test oracles only once the RCP source is in the repository, so the
            // first scenario is registered by its name only, without the bands §18.5 quotes.
            scenarios =
                PlannedScenario.numbered(
                    "deterioration",
                    listOf("NEWS2 boundaries", "SpO₂ Scale 2", "escalation timers", "PEWS and MEOWS only where the Register allows"),
                ),
            unlinkedSeededHazards = listOf("H4"),
            sources =
                listOf(
                    "§18.5 #8 (H4 delayed escalation: escalation timers; HAZ-0018 maps SI-18 to no seeded hazard, CSO triage)",
                    "§21 WP-0.9 (Boundary Register), WP-3.4 (flowsheets, risk scores), WP-3.5 (reg-ews and its fallback)",
                    "hazard log CTRL-0018-2",
                ),
        )

    private val revenue =
        ScenarioSuite(
            area = "revenue-si-12",
            number = 9,
            title = "Revenue and SI-12",
            hazards = listOf("HAZ-0012"),
            seededHazards = listOf("H2", "H4"),
            invariants = listOf("SI-12"),
            mockKb = false,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-1.9", "WP-2.1", "WP-2.2", "WP-3.3", "WP-3.6"),
                    backlog =
                        listOf(
                            "RCM-ACC-01",
                            "RCM-CHG-01",
                            "RCM-CSH-01",
                            "KRI-RCM-01",
                            "ACC-ADT-01",
                            "OPS-FLW-01",
                            "MED-MAR-01",
                            "CLN-ED-01",
                        ),
                    knownAnomaly = KNOWN_ANOMALY,
                ),
            scenarios =
                PlannedScenario.numbered(
                    "revenue-si-12",
                    listOf(
                        "charges from events only",
                        "package coverage and leakage",
                        "deposit and payment rules never blocking discharge, emergency care or time-critical doses",
                        "dual-currency shift close",
                    ),
                ),
            sources =
                listOf(
                    "§18.5 #9",
                    "§21 WP-1.9 (charges from clinical events only; per-currency shift close), WP-2.1 (discharge never blocked " +
                        "by money), WP-2.2 (inpatient billing), WP-3.3 (time-critical doses never delayed by money), " +
                        "WP-3.6 with §9.14 (no payment rule blocks ED registration)",
                    "hazard log CTRL-0012-2, CTRL-0012-5",
                ),
        )

    private val seam =
        ScenarioSuite(
            area = "seam",
            number = 10,
            title = "Seam (W1-K)",
            hazards = listOf("HAZ-0003", "HAZ-0008", "HAZ-0009"),
            seededHazards = listOf("H2", "H5", "H12"),
            invariants = listOf("SI-03", "SI-08", "SI-09"),
            mockKb = false,
            waitsOn =
                WaitsOn(
                    workPackages = listOf("WP-1.2", "WP-1.3", "WP-1.7", "WP-3.11"),
                    backlog = listOf("ACC-ID-01", "INT-SEAM-01", "ACC-SCH-02", "DX-LAB-01", "CLN-MRC-01"),
                    knownAnomaly = KNOWN_ANOMALY,
                    human = listOf("the seam hazard analysis covering H15, signed by DP#1's CSO [HUMAN] (§21 Phase 1)"),
                ),
            scenarios =
                PlannedScenario.numbered(
                    "seam",
                    listOf(
                        "referral acknowledgement within 24 h",
                        "no overlays",
                        "polyclinic LIS limited to its own patients",
                        "medication list as reconciliation input only",
                    ),
                ),
            unlinkedSeededHazards = listOf("H15"),
            sources =
                listOf(
                    "§18.5 #10 (H15 cross-system seam failure, §2.4; no hazard-log entry carries H15)",
                    "§21 WP-1.2 (EMPI), WP-1.3 (INT-SEAM-01, referral tracking), WP-1.7 with §9.8 (the polyclinic LIS seam " +
                        "rule), WP-3.11 (med rec), WP-1.15 (seam scenario suite green)",
                    "hazard log CTRL-0003-2, CTRL-0003-6, CTRL-0008-2, CTRL-0009-2",
                ),
        )

    /** The ten suites, in §18.5 order. */
    val suites: List<ScenarioSuite> =
        listOf(cpoe, ismp, closedLoop, transfusion, resultsClosure, identity, downtime, deterioration, revenue, seam)
}
