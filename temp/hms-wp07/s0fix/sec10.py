import re, sys
from pathlib import Path
d = Path(sys.argv[1])
src = (d / "sec10.orig.md").read_text(encoding="utf-8")
head, table_and_rest = src.split("| Key | English | Note for translators |\n", 1)
NOTES = """## 10. Message keys

The keys slices S2 to S6 add to the catalogues, in `en`. Keys follow the catalogue rules (`frontend/packages/i18n/README.md`). Notes for translators:

- **Clinical meaning first.** Several pairs must never read alike: "No known allergies (NKA)" versus "Allergies not assessed" versus "Allergy status unavailable"; "not documented" versus "unavailable"; "No dated weight" versus "Weight unavailable"; "Not signed" versus "It is not known whether this was signed". Under `banner.*` and `clinical.*` a `ckb` or `ar` text equal to the English text fails the lint.
- **No length limit means the text wraps.** Banner labels and statuses wrap and are never truncated, so no maximum is set; keep them short. Where a maximum is given, it is for controls that must stay on one line.
- **Placeholders** use ICU syntax. A plain argument (`{weight}`, `{date}`, `{status}`, `{patientName}`) receives a value already rendered and bidi-isolated by the design system (`ClinicalNumber`, `Bdi`, `ui-intl`): keep it, move it where the language needs it, and never add `number` or `date` formatting to it. Keep units such as `kg` in Latin script.
- **Plurals.** `{count, plural, …}` renders `#` with Western digits. Arabic (`ar`) has the CLDR categories `zero`, `one`, `two`, `few`, `many` and `other`, and 60 falls in `many`: give every category the message can reach, and keep `#` in every branch of a clinical count, because the Arabic `one` and `two` forms are often written without the numeral. Sorani (`ckb`) uses `one` and `other`. The catalogue lint requires only `other`, so it does not catch a missing Arabic category; the reviewer checks it.
- **Gender.** Text that addresses the user, or asks the user to act ("Confirm the patient", "Check the record"), is gendered in Arabic and can be in Sorani. Use gender-neutral forms: a verbal noun, the passive or an impersonal construction.
- **Punctuation.** In `ar` and `ckb` use the Arabic comma `،` (U+060C) between the parts of a composed value such as `banner.weight.value` and `banner.codeStatus.recordedOn`, and keep the parentheses of the English where the language uses them.
- Every `ckb` and `ar` text is an unreviewed draft until a clinician reviews it (DN-new-2).

| Key | English | Note for translators |
"""
rows = table_and_rest.split("\n")
tail_idx = next(i for i, r in enumerate(rows) if not r.startswith("|") and i > 0)
table, rest = rows[:tail_idx], rows[tail_idx:]
assert table[0].startswith("|---")


def key(r):
    return re.match(r"^\| `([^`]+)`", r).group(1)


def R(k, en, note):
    return f"| `{k}` | {en} | {note} |"


replace = {
    "banner.name.script.label": [R("banner.name.kurdish.label", "Name (Kurdish)", "Label of the patient's name in Kurdish, written in Arabic script"),
                                 R("banner.name.arabic.label", "Name (Arabic)", "Label of the patient's name in Arabic")],
    "banner.name.scriptMissing": [R("banner.name.kurdishMissing", "Kurdish name missing", "A registration gap: the Kurdish form of the name is not recorded"),
                                  R("banner.name.arabicMissing", "Arabic name missing", "A registration gap: the Arabic form of the name is not recorded")],
    "banner.name.latinMissing": [R("banner.name.latinMissing", "Latin name missing", "A registration gap: the Latin transliteration is not recorded; identity is incomplete")],
    "banner.allergies.count": [R("banner.allergies.count", "{count, plural, one {# allergy} other {# allergies}}", "Number of recorded allergies; `count` is at least 1. In `ar` give `one`, `two`, `few`, `many` and `other`, each with `#`")],
    "banner.codeStatus.recordedOn": [R("banner.codeStatus.recordedOn", "{status}, recorded {date}", "A whole message: `status` is the governed code-status label, `date` the date it was recorded. Use `،` in `ar` and `ckb`")],
    "banner.weight.value": [R("banner.weight.value", "{weight} ({source}, {date})", "`weight` is the number with its unit (for example `70 kg`), `source` one of the three source texts below, `date` the date measured. Reorder as the language needs; keep all three; use `،` between source and date in `ar` and `ckb`")],
    "patientContext.close": [R("patientContext.close", "Close patient record", "Control that empties the window's patient context; \"record\" means the chart, never the person's body; at most 30 characters")],
    "patientContext.switch.requested": [R("patientContext.switch.requested", "Requested patient", "Heading over the patient the user asked to open")],
    "patientContext.switch.confirm": [R("patientContext.switch.confirm", "Switch to requested patient", "Confirms the switch to the patient under the heading \"Requested patient\", never the current one; it opens that patient's record and never means an act on the person's body; at most 30 characters")],
    "patientContext.clearedByUserChange": [R("patientContext.clearedByUserChange", "The patient was closed because the user changed.", "Shown in every window after a badge tap or sign-in by another user")],
    "sign.authenticate.heading": [R("sign.authenticate.heading", "Confirm it is you", "Heading of the authentication step; use a gender-neutral form")],
    "sign.reverify.title": [R("sign.reverify.title", "Confirm the patient", "Heading of the re-verification step; use a gender-neutral form")],
    "sign.reverify.reason": [R("sign.reverify.reason", "{windowSeconds, plural, one {The patient in this window changed in the last # second. Check that this is the right patient before signing.} other {The patient in this window changed in the last # seconds. Check that this is the right patient before signing.}}", "`windowSeconds` is the re-verification window (60 unless a hospital lengthens it). In `ar`, 60 falls in `many`: give every category, each with `#`")],
    "sign.reverify.reject": [R("sign.reverify.reject", "Not this patient", "Ends signing because the patient shown is not the intended one; at most 40 characters")],
    "sign.failed": [R("sign.failed", "Not signed. Nothing was saved.", "Only when the server confirmed that it rejected the signature; never for a timeout or a lost response (see `sign.outcomeUnknown`)")],
    "commandPalette.resultCount": [R("commandPalette.resultCount", "{count, plural, one {# result} other {# results}}", "Announced to screen readers; `count` may be 0. In `ar` give `zero`, `one`, `two`, `few`, `many` and `other`, each with `#`")],
    "hal.reason.userCancelled": [R("hal.reason.userCancelled", "Cancelled at the device.", "The capture was cancelled at the device or in the shell's capture window")],
}
after = {
    "banner.dob.missing": [R("banner.dob.unavailable", "Date of birth unavailable", "The recorded date of birth could not be read; identity is incomplete and signing is blocked")],
    "banner.weight.missing": [R("banner.weight.unavailable", "Weight unavailable", "The weight data could not be read or is not valid; treat as unknown. Must read differently from \"No dated weight\""),
                              R("banner.label.untranslated", "Not translated", "Marker beside a governed label shown in another language because no translation exists")],
    "patientContext.switch.cancel": [R("patientContext.switch.requestedInvalid", "The requested patient's identity data is unavailable, so this switch cannot be confirmed.", "Shown in the switch confirmation; only \"Keep current patient\" is offered")],
    "sign.authenticate.simulated": [R("sign.authenticate.cosignPin", "Co-signing needs a badge tap and a PIN.", "Shown in the authentication step of a co-signature (§12.8)")],
    "sign.cancel": [R("sign.blockedByBanner", "Signing is not possible: the patient's identity data is incomplete or unavailable.", "Shown when the banner is in its error state or the date of birth is missing or invalid")],
    "sign.reverify.reject": [R("sign.reverify.rejected", "This is not the right patient. Nothing was signed. Close or change the patient.", "Shown after \"Not this patient\"; use a gender-neutral form"),
                             R("sign.reverify.signerDiffers", "The person signing must confirm the patient. Confirm the patient again.", "Shown when someone other than the person who confirmed the patient authenticates")],
    "sign.failed": [R("sign.outcomeUnknown", "It is not known whether this was signed. Check the record before signing again.", "A timeout or lost response: the signature may have been saved; must never read as \"not signed\""),
                    R("sign.contextChanged", "Not signed: the patient in this window changed. Nothing was saved.", "The window's patient changed after the sign step opened")],
    "hal.error.cancelled": [R("hal.error.outcomeUnknown", "The device may already have done this. Check the printer or terminal before trying again.", "A print or payment timed out or failed after it was sent; a second attempt could print twice or charge twice")],
    "hal.sign.prompt.document": [R("hal.capture.discardedAfterContextChange", "The capture was discarded because the patient in this window changed. Nothing was saved.", "A photo, scan or signature arrived after the patient changed")],
}
out = [table[0]]
seen = set()
for r in table[1:]:
    k = key(r)
    seen.add(k)
    out.extend(replace.get(k, [r]))
    out.extend(after.get(k, []))
missing = (set(replace) | set(after)) - seen
assert not missing, missing
new = NOTES + "\n".join(out) + "\n" + "\n".join(rest)
(d / "sec10.md").write_text(new, encoding="utf-8", newline="\n")
keys = [key(r) for r in out[1:]]
assert len(keys) == len(set(keys))
print("keys", len(keys))
