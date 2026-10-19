### 2.6 `ClinicalNumber` and number display (SI-05; CTRL-0005-17)

`ClinicalNumber` renders a clinical numeral and its unit. It takes a **decimal string** exactly as entered or as returned by a knowledge base, never a JavaScript number, and only normalises the string for display (`ui-core/clinical-number.ts`):

| Input | Shown | Rule |
|---|---|---|
| `.5` | `0.5` | A leading zero before a decimal point, never a naked decimal (ISMP) |
| `5.0`, `2.50` | `5`, `2.5` | No trailing zero after a decimal point (ISMP; for results, decision DN-new-11) |
| `0.0`, `-0` | `0` | Zero has one form [P] |
| `007`, `00.5` | `7`, `0.5` | Redundant leading zeros of the integer part are removed [P] |
| `1000`, `150000`, `999` | `1 000`, `150 000`, `999` (the space is U+202F) | Integer parts of 1000 and above are grouped in threes with a narrow no-break space (U+202F), never with a comma or a full stop; decimal digits are not grouped. ISMP asks for a separator in large numbers so that 100000 is not misread as 10000; a comma beside right-to-left text can be read as the Arabic decimal separator `٫`, so this specification uses the narrow space. This departs from the letter of ISMP's comma and is decision DN-new-12 for the CSO |
| `-1.5` | `-1.5` | A minus sign is kept (results, balances), inside the isolated left-to-right run |
| `1e3`, `1,5`, `1 000`, `٠٫٥`, `+2`, text | invalid marker | Anything outside `-?[0-9]*(\.[0-9]+)?` with at least one digit is shown as "Invalid value" (`clinical.number.invalid`), never guessed or converted. Input is never accepted already grouped |
| empty | missing marker | "Not recorded" (`clinical.value.missing`) |

- **No arithmetic, and the numeric value never changes** (SI-05 and its §2.1 definition). The function works on characters only. It never calls `Number`, `parseFloat`, `parseInt`, `Math`, `toFixed`, `toPrecision` or `Intl.NumberFormat`, never rounds and never converts a unit. It changes only the display form, under the ISMP rules of CTRL-0005-17: a leading zero, no trailing zero, one form of zero, the grouping space. The numeric value is the one entered or returned, which §2.1 allows under (a). CTRL-0005-6 requires entered and knowledge-base values to be "displayed unchanged"; this specification reads a display-form normalisation that keeps the numeric value as no change under CTRL-0005-6. Removing a trailing zero does drop the precision a value was written with (a result of `4.0` shows as `4`). Both points are decision DN-new-11 for the CSO and the laboratory CSO, before WP-1.7 shows results.
- **Western digits only**, ASCII 0–9 with `.` as the decimal point, on every locale (§6.5, §11.1).
- **Units through a governed display map.** The unit is stored as a UCUM code and shown through a display map from UCUM code to an ISMP-safe form, in Latin script and never translated: for example `ug` is shown as `mcg`, `U` as `units` and `[iU]` as `units`, because `ug`, `U` and `IU` are on ISMP's list of error-prone abbreviations (misread as mg, as 0 or 4, and as IV or 10). A unit that is not in the map is never shown as its raw code: the value and unit are shown as "Invalid value". The map is clinical content (§3.4 item 3): WP-0.7 ships a synthetic sample (`kg`, `g`, `mg`, `ug` → `mcg`, `mL`, `L`, `U` → `units`, `mmol/L`, `%`), labelled NOT FOR CLINICAL USE, with a content request (OQ-new-13).
- The number and its unit sit together in one `<bdi dir="ltr">` with a no-break space between them, so `0.5 mg` keeps its order inside right-to-left text.
- **Not in WP-0.7:** tall-man lettering for look-alike names (it needs the governed LASA list, §3.4 item 3), the CSO-approved unit display map (OQ-new-13) and number display on prints (WP-0.8). CTRL-0005-17 is therefore only partly built (KA-new-12).

**Western digits in the whole staff UI** (a recorded tightening of §6.5, OQ-new-2). §6.5 and §11.1 require Western digits for clinical numerals and allow Eastern Arabic-Indic digits, by configuration, only for non-clinical numbers in patient-facing Kurdish and Arabic text. The staff workspaces built here use Western digits for every number: the UI locales are `en`, `ckb-u-ca-gregory-nu-latn` and `ar-u-ca-gregory-nu-latn` (`ui-intl.ts`; canonical BCP 47 form, with the Unicode extension keys in alphabetical order, which is what `Intl` reports back), and no UI path formats digits from U+0660–U+0669 or U+06F0–U+06F9. The §6.5 configuration for patient-facing text (templates, signage, the front door) is not removed; it comes with those surfaces.

