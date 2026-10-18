# @hms/eslint-plugin

The frontend fitness functions of BUILD-PROMPT.md §6.8 item 6 ("no hard-coded user-facing strings; no
physical CSS directions"), as two ESLint rules and a stylesheet check. The workspace `eslint.config.js`
registers the plugin under the prefix `hms` and enables both rules as errors for every file; `pnpm run fast`
runs ESLint and the stylesheet check.

## Rules

### hms/no-jsx-literals

Every user-facing string comes from the ICU MessageFormat catalogues in `@hms/i18n` (§6.5). The rule reports:

- JSX text containing a letter or a digit in any script (Unicode `\p{L}` and `\p{N}`, so Sorani, Arabic and
  Eastern Arabic-Indic digits count as well as Latin);
- JSX children that are string or number literals or template literals with literal text, including the
  branches of `?:`, `&&`, `||` and `??`, and string concatenation (`{'Dr ' + name}`);
- a string value, written directly or as an expression, of the user-visible attributes `title`, `alt`,
  `placeholder`, `label`, `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription` and
  `aria-valuetext`. Here any visible character counts, punctuation included, because a screen reader
  announces it.

Allowed: whitespace and punctuation-only JSX text (`·`, `—`, `/`), numbers inside arithmetic (`{count + 1}`),
and `alt=""`, the WCAG marker for a decorative image.

### hms/no-physical-css

CSS logical properties only (§6.5 "RTL by construction"). The message names the logical replacement. The
rule reports:

- the physical longhands `marginLeft`/`Right`, `paddingLeft`/`Right`, `borderLeft*`/`borderRight*`, the four
  physical corner radii, `scrollMarginLeft`/`Right`, `scrollPaddingLeft`/`Right` and `insetLeft`/`Right` (not
  CSS properties, caught in case they are written), as keys of any object literal, in camelCase,
  vendor-prefixed (`WebkitBorderTopLeftRadius`) or CSS (`'margin-left'`) spelling;
- `left` and `right` as keys of style-like objects only, because they are common non-style keys. Style-like
  means: a JSX attribute named `style` or ending in `Style`; a variable, property or assignment target named
  `style`, `styles`, `sx` or `css` or ending in `Style`/`Styles`; a value typed or asserted as `CSSProperties`,
  `StyleProp<...>` or a `...Style` type; an argument of `StyleSheet.create` or `Object.assign(element.style,
...)`; and anything nested in, spread into, chosen by a conditional for, or returned by a function in one of
  those positions (React Aria render-prop styles and `useMemo` included);
- the values `'left'` and `'right'` of `textAlign`, `textAlignLast`, `float`, `clear`, `justifyContent`,
  `justifyItems` and `justifySelf`;
- four-value `margin`, `padding`, `inset`, `scrollMargin`, `scrollPadding`, `borderWidth`, `borderStyle` and
  `borderColor` shorthands whose right and left values differ, and `borderRadius` shorthands whose corners
  are not mirror-symmetric;
- DOM style writes: `element.style.marginLeft = ...` and `element.style.setProperty('margin-left', ...)`.

The brief for WP-0.1 lists the longhands and the `textAlign`/`float`/`clear` values. The `textAlignLast` and
`justify*` values, the shorthands and the DOM writes are additions that close the same gap (§3.4 allows
tightening); they are listed in the work package's deviations.

## Stylesheet check

`src/css/check.ts` applies the same tables (`src/physical-css.ts`) to `.css` files, so the two checks cannot
drift apart. The CLI checks every `.css` file under `frontend/apps` and `frontend/packages`:

```sh
node packages/eslint-plugin-hms/src/css/cli.ts [--json] [path ...]
```

With no paths it skips `node_modules`, git-ignored build output (`dist`, `build`, `coverage`) and this
package's `test/fixtures`, which hold deliberate violations. A stylesheet that cannot be parsed is reported
as a finding, so the check fails closed. Exit codes follow the programme check contract: 0 pass, 1 findings,
2 usage error; with `--json` the last stdout line is `{check, ok, counts, errors, warnings}`.

## Known limits

- The rules work on syntax, without type information: a style object built far from its use and named
  without a style word can hide `left` or `right`. The unambiguous physical names are caught anywhere.
- Values that only exist at run time (`var(--x)`, values computed in code) are not judged; a custom
  property's value is not traced to where `var()` uses it.
- Inline `style="..."` attributes and `<style>` blocks in `.html` files are not checked yet. The signage app
  (RTL HTML) needs that before it lands.

## Tests

ESLint's own `RuleTester` runs under Vitest (`test/rule-tester.ts`), with valid and invalid cases for every
listed property, value and context, and expected replacements written out in the tests as the oracle. The
stylesheet check is tested on `test/fixtures/css/*.css`, whose `expect:` comments state the message each line
must produce. `test/plugin.test.ts` loads the real workspace `eslint.config.js` and checks that both rules and
`@typescript-eslint/no-explicit-any` are errors.
