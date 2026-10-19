p = "MedicationAdministrationSpecLayer.kt"
s = open(p, encoding="utf-8").read()
pairs = [
("""                MarProperty({ live(it) && WRISTBAND_SCAN_MATCHES in it.holding }, { liveTransition(it) && WRISTBAND_SCAN_MATCHES in it.guard }) { step ->
                    withClue("SI-01 clause b: never room or bed") { step.facts.scans.wristband?.labelKind shouldBe LabelKind.PATIENT_WRISTBAND }
                },""",
"""                MarProperty(
                    { live(it) && WRISTBAND_SCAN_MATCHES in it.holding },
                    { liveTransition(it) && WRISTBAND_SCAN_MATCHES in it.guard },
                ) { step ->
                    withClue("SI-01 clause b: never room or bed") {
                        step.facts.scans.wristband?.labelKind shouldBe LabelKind.PATIENT_WRISTBAND
                    }
                },"""),
("""                    withClue("SI-02: an override keeps SI-01 (two identifiers), SI-12 (supply cleared), SI-13 (double check), SI-15 (offline)") {""",
"""                    withClue("SI-02: an override keeps SI-01 (identifiers), SI-12 (supply), SI-13 (double check), SI-15 (offline)") {"""),
("""                        step.holding.containsAll(listOf(PATIENT_SUPPLIED_CLEARED, HIGH_ALERT_CHECK_SATISFIED, OFFLINE_ALLOWED)) shouldBe true""",
"""                        val kept = listOf(PATIENT_SUPPLIED_CLEARED, HIGH_ALERT_CHECK_SATISFIED, OFFLINE_ALLOWED)
                        step.holding.containsAll(kept) shouldBe true"""),
]
for a, b in pairs:
    assert a in s, a
    s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="\n").write(s)
