"""Add the WP-0.7 S0 notes to four controls of docs/safety/hazard-log.yaml (text only; no state changes)."""
import pathlib
import re
import sys
import textwrap

BASE = {"DN": 19, "OQ": 139, "KA": 24}
PAT = re.compile(r"\b(DN|OQ|KA)-new-(\d+)\b")


def num(text: str) -> str:
    return PAT.sub(lambda m: f"{m.group(1)}-{BASE[m.group(1)] + int(m.group(2)):03d}", text)


NOTES = {
    "CTRL-0016-7": "Tightening [P] (§3.4 item 1): 'within the last 60 s' is read inclusively (exactly 60.000 s still requires re-verification) on a monotonic clock, and an unknown change time, an unreadable clock or a negative elapsed time counts as within the window; a re-verification counts only if the user who authenticates for the signature confirmed it; after a 'Not this patient' answer every sign step in the window requires re-verification until the context changes. §2.1 SI-16, §8.4 (order: sign, '<60 s ago') and §9.4 acceptance ('within 60 s') fix no bound, say nothing of an unreadable clock and do not say who re-verifies. These add to clause f and replace no clause; the CSO confirms or removes them [HUMAN] (DN-new-7, DN-new-8; docs/safety/README.md, 'Tightenings').",
    "CTRL-0016-3": "Tightening [P] (§3.4 item 1; DN-new-10, DN-new-13): the banner shows the Kurdish, Arabic and Latin name forms and flags each missing one; its error state (patient id, MRN or every name form missing or invalid) disables clinical actions, and a missing or invalid date of birth disables signing. §2.1 SI-16 requires 'trilingual name display' and §11.2 stores the three forms, but neither says what a missing form shows or whether missing identity data blocks signing. They add to clauses a and c and replace no clause; the CSO confirms or removes them [HUMAN]. Gap: WP-0.7 builds no sensitivity indicators (WP-0.4) and no mobile or print banner (KA-new-2, KA-new-9).",
    "CTRL-0005-17": "Tightening [P] (§3.4 item 1; OQ-new-2, DN-new-11, DN-new-12): the ISMP display rules apply to every clinical numeral, results included; Western digits are used for every number in the staff UI; units are shown through a governed UCUM display map that replaces ISMP's error-prone abbreviations (ug → mcg; U and IU → units), and an unmapped unit is shown as an invalid value; integer parts of 1000 and above are grouped with a narrow no-break space. §2.1 (acceptance criteria), §6.5 and SAC-50 name the leading-zero, trailing-zero and naked-decimal rules for doses and Western digits for clinical numerals, and say nothing of results, units or grouping. The grouping departs from the letter of ISMP's comma (DN-new-12), and the effect on reported result precision is DN-new-11. They add to clause b and replace no clause; the CSO confirms or removes them [HUMAN].",
}
APPEND_0016_6 = "Further tightenings [P] proposed in WP-0.7 (DN-new-9, DN-new-13): a change of user clears the patient context of every window of the workstation session; the context, never a URL, selects whose data a clinical route shows; a device capture whose result arrives after a context change is discarded, and a barcode read goes only to the focused window; a switch cannot be confirmed while the requested patient's identity data is invalid. They add to clause e and replace no clause; the CSO confirms or removes them [HUMAN]."

IND = " " * 10
WIDTH = 100


def block(text: str) -> str:
    return "\n".join(textwrap.wrap(num(text), width=WIDTH, initial_indent=IND, subsequent_indent=IND,
                                   break_long_words=False, break_on_hyphens=False)) + "\n"


def control_span(lines: list[str], cid: str) -> tuple[int, int]:
    start = next(i for i, l in enumerate(lines) if l == f"      - id: {cid}\n")
    end = start + 1
    while end < len(lines) and not lines[end].startswith("      - id: ") and not lines[end].startswith("    residual_risk"):
        end += 1
    return start, end


path = pathlib.Path(sys.argv[1])
lines = path.read_bytes().decode("utf-8").splitlines(keepends=True)
for cid, text in NOTES.items():
    s, e = control_span(lines, cid)
    assert not any(l.startswith("        notes:") for l in lines[s:e]), cid
    lines[e:e] = ["        notes: >-\n", block(text)]
    lines = "".join(lines).splitlines(keepends=True)
s, e = control_span(lines, "CTRL-0016-6")
assert any(l.startswith("        notes: >-") for l in lines[s:e])
assert lines[e - 1].rstrip().endswith('"Tightenings").'), lines[e - 1]
lines[e:e] = [block(APPEND_0016_6)]
path.write_bytes("".join(lines).encode("utf-8"))
print("ok")
