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

## Catalogues

`src/messages/<locale>.json` holds one flat JSON object per UI locale, mapping a message key to an ICU
MessageFormat message. Keys are dot-separated lower-camel segments (`app.name`, `language.ckb.endonym`).
`CATALOGUES` exposes them typed by the keys of `en.json`, so type checking also fails if `ckb.json` or
`ar.json` lacks a key.

WP-0.1 holds only non-clinical shell keys: `app.name`, the product name, kept in Latin script in every
catalogue, and `language.<locale>.endonym`, each UI language's name for itself (English, کوردی, العربية), which
a language picker shows the same in every locale.

Adding a message: add the key to all three catalogues in the same change, with the same placeholders. Never
machine-translate, and never invent clinical wording or translations: until reviewed text exists, log a
content request in `docs/program/OPEN-QUESTIONS.md` (§3.3). Translations need clinician review before release
[HUMAN] (§11.1, §18.9).

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
  select branches may differ between locales.

It does not judge wording or translation quality. Exit codes follow the programme check contract: 0 pass,
1 findings, 2 usage error; with `--json` the last stdout line is `{check, ok, counts, errors, warnings}`.

## Tests

`test/` covers the locale metadata, the shipped catalogues, every lint failure class (in memory) and the CLI
against `test/fixtures/valid` and `test/fixtures/invalid`, whose messages are synthetic `SYN-` placeholders.
