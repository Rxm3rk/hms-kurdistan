import pathlib
import sys

root = pathlib.Path(sys.argv[1])


def edit(path, pairs):
    p = root / path
    s = p.read_text(encoding="utf-8")
    for old, new in pairs:
        assert s.count(old) == 1, old[:100]
        s = s.replace(old, new)
    p.write_text(s, encoding="utf-8", newline="\n")


edit("docs/specs/state-machines/appointment.yaml", [
    ("""is an ED or inpatient encounter overlapping the slot time, so the patient could not attend\"""",
     """is an ED or inpatient encounter overlapping the slot time, so the patient could not attend. When the appointment's slot start or end is unknown, every open ED or inpatient encounter counts, so an unknown slot time never allows a no-show\""""),
    ("""or both are equal and its entry id sorts first (a total, deterministic order; DN-057 item 8)\"""",
     """or both are equal and its entry id sorts first (a total, deterministic order; DN-057 item 8). A priority code outside the governed list has no rank: this entry is then never top ranked, and a competitor without a rank ranks before it, so an entry of unknown priority is never passed over silently\""""),
])
edit("docs/specs/state-machines/credit-claim.yaml", [
    ("""queryResponseComplete: "every item of the open query has an answer text or an attached document, recorded by an authenticated corporate/insurer desk user\"""",
     """queryResponseComplete: "the open query has at least one item, and every item has an answer text or an attached document, recorded by an authenticated corporate/insurer desk user\""""),
    ("""and the approved services with their approved units.""",
     """and the approved services (at least one) with their approved units (each a positive integer)."""),
    ("""deductionReasonsRecorded: "every deduction the payer made on this settlement carries""",
     """deductionReasonsRecorded: "at least one deduction is recorded for this settlement, and every deduction the payer made on it carries"""),
])
print("ok")
