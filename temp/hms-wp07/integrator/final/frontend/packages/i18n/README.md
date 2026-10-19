# @hms/i18n

UI locales, their text direction, the ICU MessageFormat catalogues and the localisation lint
(BUILD-PROMPT.md §4.1, §6.5, §11.1, §14.7, §18.9).

## Locales

| Locale    | Language                                | Direction | Use                                         |
| --------- | --------------------------------------- | --------- | ------------------------------------------- |
| `en`      | English                                 | ltr       | UI and patient templates; catalogue source  |
| `ckb`     | Central Kurdish (Sorani), Arabic script | rtl       | UI and patient templates                    |
| `ar`      | Arabic                                  | rtl       | UI and patient templates                    |
| `ku-Arab` | Badini (Kurmanji) in Arabic script      | rtl       | Patient-facing templates only, never the UI |

`ku-Latn` is added only if open question Q-K17 says Latin-script Kurmanji output is needed. The document's
`dir` comes from `textDirection(locale)`.

### Intl tags and digits

Formatting (react-intl and every `Intl` formatter) uses `uiIntlLocale(locale)`: `en-u-ca-gregory-nu-latn`,
`ckb-u-ca-gregory-nu-latn` and `ar-u-ca-gregory-nu-latn` (`src/ui-intl.ts`), the canonical BCP 47 form. Every
number in the staff UI has Western digits and every date the Gregorian calendar (OQ-141); without the
extension, `ckb` would format Arabic-Indic digits. `hasNonWesternArabicDigits(text)` finds a U+0660–U+0669 or
U+06F0–U+06F9 digit, for tests and checks. `<html lang>` keeps the plain tag.

### Sorani letters

`src/sorani-letters.json` (typed as `SORANI_LETTERS`) lists the ten letters Sorani adds to the Arabic
alphabet (پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە) and the Arabic and Kurdish letter pairs ي/ی, ك/ک and ه/ە, with code points and
Unicode names. ي and ك never occur in Sorani text (`ARABIC_FORMS_NOT_IN_SORANI`); ه does (it writes /h/), so
ه and ە are never swapped mechanically. The design system's font-coverage test and WP-0.8's print fonts and
input normalisation read the same file (OQ-148).

### Pseudo-locales

`pseudoCatalogue(locale)` builds a pseudo-locale in memory from the `en` catalogue, for development and test
builds only; the lint rejects catalogue files outside the UI locales, so they are never files
(`src/pseudo.ts`):

| Locale  | Direction | Text                                                                                            |
| ------- | --------- | ----------------------------------------------------------------------------------------------- |
| `en-XA` | ltr       | `[Áççéñťéď ťéxť ~~~~~ ~]` for "Accented text": ASCII letters accented, bracketed, padded by 40% |
| `ar-XB` | rtl       | each run of literal text wrapped in RIGHT-TO-LEFT OVERRIDE … POP DIRECTIONAL FORMATTING         |

Only literal text changes; every placeholder, plural and select branch, `#` and tag stays as it is
(`PropertyTest:pseudo-locale-preserves-placeholders`). Both format with the `en` Intl tag, since their
plural branches are English.

## Catalogues

`src/messages/<locale>.json` holds one flat JSON object per UI locale, mapping a message key to an ICU
MessageFormat message. Keys are dot-separated lower-camel segments (`app.name`, `language.ckb.endonym`).
`CATALOGUES` exposes them typed by the keys of `en.json`, so type checking also fails if `ckb.json` or
`ar.json` lacks a key.

WP-0.1 added the non-clinical shell keys: `app.name`, the product name, kept in Latin script in every
catalogue, and `language.<locale>.endonym`, each UI language's name for itself (English, کوردی, العربية), which
a language picker shows the same in every locale. WP-0.7 added every key of
`docs/specs/modules/design-system.md` §10, whose English text is the specification's; read §10's notes for
translators before changing one.

### Agent-drafted translations, marked unreviewed (DN-021)

**Deviation, recorded.** The rule below forbids invented or machine translation. For WP-0.7 the human lead
decided otherwise (DN-021, 18 October 2026): the build agent, which is an LLM, drafted every `ckb` and `ar`
message in its own session; no text went to any other translation or LLM service. Each draft is marked
`unreviewed`. A clinician
review of every draft stays a gate before any hospital use [HUMAN] (OQ-151; KA-031). The rule still applies
to every other change.

The status of each translated message lives beside its catalogue, in `src/messages/review/<locale>.json`
for `ckb` and `ar`: a flat JSON object from every key of the catalogue to `"unreviewed"`. The lint keeps it
complete (see below), and `reviewStatus(locale, key)` and `TRANSLATION_REVIEW` give it to screens and
evidence. `unreviewed` is the only status: the format of a reviewed status (who reviewed which text, when)
comes with the clinician review, so no message can be marked reviewed until the lint learns it (OQ-159).

Adding a message: add the key to all three catalogues in the same change, with the same placeholders, and
mark it `unreviewed` in both review files. Never machine-translate, and never invent clinical wording or
translations: until reviewed text exists, log a content request in `docs/program/OPEN-QUESTIONS.md` (§3.3).
Translations need clinician review before release [HUMAN] (§11.1, §18.9).

## Localisation lint

```sh
node packages/i18n/src/lint/cli.ts [--json] [--dir <catalogue directory>]
```

`pnpm run i18n:lint` (part of `pnpm run fast`) runs it on `src/messages`. It fails when:

- a UI locale has no catalogue, or a catalogue exists for any other locale (`ku-Arab` included);
- a catalogue is not UTF-8 without a byte order mark, is not valid JSON, repeats a key (JSON would silently
  keep only the last value), is not a flat object of strings, or has a malformed key;
- a key is missing from any UI catalogue;
- a message is empty or whitespace only;
- a message is not valid ICU MessageFormat (parsed with `@formatjs/icu-messageformat-parser`; plural and
  select need an `other` clause);
- a message's placeholder arguments differ from the same message in `en`: names and kinds (`{name}`,
  `{n, number}`, `{n, plural}`, `{d, date}`, rich-text tags such as `<b>`), nested ones included. Plural and
  select branches may differ between locales;
- a clinical-keys rule fails (`src/lint/clinical-keys.ts`; `UnitTest:clinical-keys-lint`):
  - under `banner.*` and `clinical.*`, a `ckb` or `ar` message is the same as the `en` one. The parsed
    messages are compared, so the spacing of ICU syntax and the order of branches do not count; in literal
    text, NFC is applied and white space, format characters (RLM, LRM, ALM, bidi embeddings and isolates,
    ZWSP, ZWNJ, ZWJ, the BOM, the soft hyphen) and other default-ignorable characters are removed. A message
    that does not parse is compared on its text, normalised the same way;
  - a `ckb` or `ar` plural or selectordinal drops `#` in a branch, when the key is under `banner.*` or
    `clinical.*`, or when the `en` message keeps `#` in every branch of the same argument. A `#` inside a
    rich-text tag counts; one inside a nested plural belongs to that plural;
- the review marking is wrong (`src/lint/review-marking.ts`): `review/ckb.json` or `review/ar.json` is
  missing; a review file exists for another locale; a review file is not a flat JSON object (the same file
  checks as a catalogue); a message has no status; a status names a key the catalogue lacks; or a status is
  not `unreviewed`.

It does not judge wording or translation quality, and it does not check that an Arabic plural gives every
CLDR category it can reach: the reviewer does. Exit codes follow the programme check contract: 0 pass,
1 findings, 2 usage error; with `--json` the last stdout line is `{check, ok, counts, errors, warnings}`, and
`counts.unreviewed` is the number of messages marked `unreviewed`.

## Tests

`test/` covers the locale metadata, the shipped catalogues (every §10 key with its English text; Kurdish
letter forms in `ckb`, Arabic ones in `ar`; Western digits only), every lint failure class (in memory), the
review marking (`UnitTest:ckb-ar-drafts-marked-unreviewed`), the clinical-keys rules
(`UnitTest:clinical-keys-lint`), the Intl tags (`UnitTest:ui-intl-western-digits`), the letter list
(`UnitTest:sorani-letters`), the pseudo-locales (`PropertyTest:pseudo-locale-preserves-placeholders`,
fast-check) and the CLI against `test/fixtures/valid` and `test/fixtures/invalid`, whose messages are
synthetic `SYN-` placeholders.
