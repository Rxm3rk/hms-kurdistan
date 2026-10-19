import type { RuleTester } from 'eslint';
import { rules } from '../src/index.ts';
import { tsxRuleTester } from './rule-tester.ts';

/**
 * The physical longhands of the WP-0.1 brief with their logical replacements (CSS Logical Properties and
 * Values Level 1, horizontal writing mode), written out here as the test oracle.
 */
const LONGHANDS: readonly (readonly [physical: string, logical: string])[] = [
  ['left', 'insetInlineStart'],
  ['right', 'insetInlineEnd'],
  ['marginLeft', 'marginInlineStart'],
  ['marginRight', 'marginInlineEnd'],
  ['paddingLeft', 'paddingInlineStart'],
  ['paddingRight', 'paddingInlineEnd'],
  ['borderLeft', 'borderInlineStart'],
  ['borderLeftColor', 'borderInlineStartColor'],
  ['borderLeftStyle', 'borderInlineStartStyle'],
  ['borderLeftWidth', 'borderInlineStartWidth'],
  ['borderRight', 'borderInlineEnd'],
  ['borderRightColor', 'borderInlineEndColor'],
  ['borderRightStyle', 'borderInlineEndStyle'],
  ['borderRightWidth', 'borderInlineEndWidth'],
  ['borderTopLeftRadius', 'borderStartStartRadius'],
  ['borderTopRightRadius', 'borderStartEndRadius'],
  ['borderBottomLeftRadius', 'borderEndStartRadius'],
  ['borderBottomRightRadius', 'borderEndEndRadius'],
  ['scrollMarginLeft', 'scrollMarginInlineStart'],
  ['scrollMarginRight', 'scrollMarginInlineEnd'],
  ['scrollPaddingLeft', 'scrollPaddingInlineStart'],
  ['scrollPaddingRight', 'scrollPaddingInlineEnd'],
  ['insetLeft', 'insetInlineStart'],
  ['insetRight', 'insetInlineEnd'],
];

/** Properties whose 'left'/'right' values are physical, with the logical value for each. */
const KEYWORDS: readonly (readonly [property: string, physical: 'left' | 'right', logical: string])[] = [
  ['textAlign', 'left', 'start'],
  ['textAlign', 'right', 'end'],
  ['textAlignLast', 'left', 'start'],
  ['textAlignLast', 'right', 'end'],
  ['float', 'left', 'inline-start'],
  ['float', 'right', 'inline-end'],
  ['clear', 'left', 'inline-start'],
  ['clear', 'right', 'inline-end'],
  ['justifyContent', 'left', 'start'],
  ['justifyContent', 'right', 'end'],
  ['justifyItems', 'left', 'start'],
  ['justifyItems', 'right', 'end'],
  ['justifySelf', 'left', 'start'],
  ['justifySelf', 'right', 'end'],
];

const kebab = (name: string): string => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const property = (written: string, replacement: string): RuleTester.TestCaseError => ({
  messageId: 'physicalProperty',
  data: { property: written, replacement },
});
const keyword = (written: string, value: string, replacement: string): RuleTester.TestCaseError => ({
  messageId: 'physicalKeyword',
  data: { property: written, value, replacement },
});
const shorthand = (written: string, replacement: string): RuleTester.TestCaseError => ({
  messageId: 'physicalShorthand',
  data: { property: written, replacement },
});

const isLeftOrRight = (name: string): boolean => name === 'left' || name === 'right';

// left and insetLeft share a replacement, so the valid cases are de-duplicated (RuleTester rejects duplicates).
const longhandValid: string[] = [
  ...new Set(
    LONGHANDS.flatMap(([, logical]) => [
      `<div style={{ ${logical}: 4 }} />`,
      `const styles = { root: { ${logical}: 4 } };`,
      `const style = { '${kebab(logical)}': 4 };`,
    ]),
  ),
];

/**
 * A quoted key with a hyphen ('margin-left') is a CSS name and gets CSS replacements; one without ('left')
 * is a JavaScript name and gets camelCase replacements.
 */
const quotedReplacement = (physical: string, logical: string): string =>
  kebab(physical).includes('-') ? kebab(logical) : logical;

const longhandInvalid: RuleTester.InvalidTestCase[] = LONGHANDS.flatMap(([physical, logical]) => [
  { code: `<div style={{ ${physical}: 4 }} />`, errors: [property(physical, logical)] },
  { code: `const styles = { root: { ${physical}: 4 } };`, errors: [property(physical, logical)] },
  {
    code: `const style = { '${kebab(physical)}': 4 };`,
    errors: [property(kebab(physical), quotedReplacement(physical, logical))],
  },
  { code: `element.style.${physical} = '4px';`, errors: [property(physical, logical)] },
  {
    code: `element.style.setProperty('${kebab(physical)}', '4px');`,
    errors: [property(kebab(physical), kebab(logical))],
  },
  // Unambiguous physical names are reported in any object literal; left and right only in styles (below).
  ...(isLeftOrRight(physical)
    ? []
    : [{ code: `const options = { ${physical}: 4 };`, errors: [property(physical, logical)] }]),
]);

const keywordValid: string[] = [
  "<p style={{ textAlign: 'start' }} />",
  "<p style={{ textAlign: 'end' }} />",
  "<p style={{ textAlign: 'center' }} />",
  "<p style={{ textAlign: 'justify' }} />",
  "<p style={{ textAlignLast: 'start' }} />",
  "<div style={{ float: 'inline-start' }} />",
  "<div style={{ float: 'none' }} />",
  "<div style={{ clear: 'both' }} />",
  "<div style={{ clear: 'inline-end' }} />",
  "<div style={{ justifyContent: 'flex-start' }} />",
  "<div style={{ justifyContent: 'space-between' }} />",
  "<div style={{ justifyItems: 'start' }} />",
  "<div style={{ justifySelf: 'end' }} />",
  'const style = { textAlign: alignment };',
];

const keywordInvalid: RuleTester.InvalidTestCase[] = KEYWORDS.flatMap(([name, physical, logical]) => [
  { code: `<p style={{ ${name}: '${physical}' }} />`, errors: [keyword(name, physical, logical)] },
  {
    code: `const style = { '${kebab(name)}': '${physical}' };`,
    errors: [keyword(kebab(name), physical, logical)],
  },
  { code: `element.style.${name} = '${physical}';`, errors: [keyword(name, physical, logical)] },
]);

const shorthandValid: string[] = [
  "<div style={{ margin: '0 8px' }} />",
  "<div style={{ margin: '1px 2px 3px' }} />",
  "<div style={{ margin: '1px 2px 3px 2px' }} />",
  "<div style={{ margin: 'calc(1px + 2px) 4px 5px 4px' }} />",
  // A custom property may expand to several values, so the four-value form cannot be judged.
  "<div style={{ margin: 'var(--a) 1px 2px 3px' }} />",
  '<div style={{ margin: 0 }} />',
  "<div style={{ padding: '4px' }} />",
  "<div style={{ inset: '0 auto' }} />",
  "<div style={{ borderWidth: '1px 2px 1px 2px' }} />",
  "<div style={{ borderRadius: '4px' }} />",
  "<div style={{ borderRadius: '4px 4px' }} />",
  "<div style={{ borderRadius: '4px 4px 4px' }} />",
  "<div style={{ borderRadius: '4px 4px 2px 2px' }} />",
  "<div style={{ borderRadius: '4px / 2px' }} />",
  "<div style={{ borderRadius: '4px 4px / 2px 2px' }} />",
];

const shorthandInvalid: RuleTester.InvalidTestCase[] = [
  {
    code: "<div style={{ margin: '0 8px 0 0' }} />",
    errors: [shorthand('margin', '"marginBlock" and "marginInline"')],
  },
  {
    code: "<div style={{ padding: '1px 2px 3px 4px' }} />",
    errors: [shorthand('padding', '"paddingBlock" and "paddingInline"')],
  },
  {
    code: "<div style={{ inset: '0 auto 0 0' }} />",
    errors: [shorthand('inset', '"insetBlock" and "insetInline"')],
  },
  {
    code: "<div style={{ scrollMargin: '0 1rem 0 0' }} />",
    errors: [shorthand('scrollMargin', '"scrollMarginBlock" and "scrollMarginInline"')],
  },
  {
    code: "<div style={{ scrollPadding: '0 0 0 1rem' }} />",
    errors: [shorthand('scrollPadding', '"scrollPaddingBlock" and "scrollPaddingInline"')],
  },
  {
    code: "<div style={{ borderWidth: '1px 2px 1px 0' }} />",
    errors: [shorthand('borderWidth', '"borderBlockWidth" and "borderInlineWidth"')],
  },
  {
    code: "<div style={{ borderStyle: 'solid none solid dashed' }} />",
    errors: [shorthand('borderStyle', '"borderBlockStyle" and "borderInlineStyle"')],
  },
  {
    code: "<div style={{ borderColor: 'red blue red green' }} />",
    errors: [shorthand('borderColor', '"borderBlockColor" and "borderInlineColor"')],
  },
  {
    code: "const style = { 'margin': '0 8px 0 0' };",
    errors: [shorthand('margin', '"marginBlock" and "marginInline"')],
  },
  ...['4px 0 0 4px', '4px 0', '1px 2px 3px', '4px 4px 0 2px', '4px / 2px 0'].map((value) => ({
    code: `<div style={{ borderRadius: '${value}' }} />`,
    errors: [
      shorthand(
        'borderRadius',
        '"borderStartStartRadius", "borderStartEndRadius", "borderEndEndRadius" and "borderEndStartRadius"',
      ),
    ],
  })),
];

/** Where `left` and `right` count as style properties, and where they do not. */
const contextValid: string[] = [
  'const node = { left: a, right: b };',
  'const pair = { left: 1, right: 2 } as Pair;',
  'function tree() { return { left: null, right: null }; }',
  'const { left, right } = node;',
  'call({ left: 1 });',
  'Object.assign(target, { left: 1 });',
  'type Margins = { marginLeft: number };',
  "const style = { '--margin-left': '4px' };",
  "const style = { marginInlineStart: 4, insetInlineStart: 0, textAlign: 'start' };",
  "element.style.marginInlineStart = '4px';",
  "element.dataset.left = '1';",
];

const leftError = property('left', 'insetInlineStart');
const rightError = property('right', 'insetInlineEnd');

const contextInvalid: RuleTester.InvalidTestCase[] = [
  { code: '<List contentContainerStyle={{ right: 0 }} />', errors: [rightError] },
  { code: 'const style = { left: 0 };', errors: [leftError] },
  { code: 'const buttonStyle = { right: 0 };', errors: [rightError] },
  { code: 'const panelStyles = { header: { left: 0 } };', errors: [leftError] },
  { code: 'const box = { sx: { left: 0 } };', errors: [leftError] },
  { code: 'const s: CSSProperties = { left: 0 };', errors: [leftError] },
  { code: 'const s: React.CSSProperties = { left: 0 };', errors: [leftError] },
  { code: 'const s: StyleProp<ViewStyle> = { left: 0 };', errors: [leftError] },
  { code: 'const s = { left: 0 } as CSSProperties;', errors: [leftError] },
  { code: 'const s = { left: 0 } satisfies CSSProperties;', errors: [leftError] },
  { code: 'StyleSheet.create({ root: { left: 0 } });', errors: [leftError] },
  { code: '<Button style={({ isPressed }) => ({ left: isPressed ? 1 : 0 })} />', errors: [leftError] },
  { code: '<View style={[base, { right: 0 }]} />', errors: [rightError] },
  { code: '<div style={open ? { left: 0 } : undefined} />', errors: [leftError] },
  { code: '<div style={open && { left: 0 }} />', errors: [leftError] },
  { code: '<div style={{ ...base, ...{ left: 0 } }} />', errors: [leftError] },
  { code: 'function overlay(): CSSProperties { return { left: 0 }; }', errors: [leftError] },
  { code: 'function overlayStyle() { return { left: 0 }; }', errors: [leftError] },
  { code: 'const overlayStyle = () => ({ right: 0 });', errors: [rightError] },
  { code: 'const style = useMemo(() => ({ left: 0 }), []);', errors: [leftError] },
  { code: 'this.styles = { left: 0 };', errors: [leftError] },
  { code: "Object.assign(element.style, { left: '0' });", errors: [leftError] },
  { code: 'const style = { left };', errors: [leftError] },
  { code: "const style = { ['left']: 0 };", errors: [leftError] },
  {
    code: "<p style={{ textAlign: isRtl ? 'right' : 'left' }} />",
    errors: [keyword('textAlign', 'right', 'end'), keyword('textAlign', 'left', 'start')],
  },
  {
    code: '<div style={{ WebkitBorderTopLeftRadius: 4 }} />',
    errors: [property('WebkitBorderTopLeftRadius', 'borderStartStartRadius')],
  },
  {
    code: "const style = { '-webkit-margin-left': 4 };",
    errors: [property('-webkit-margin-left', 'margin-inline-start')],
  },
];

tsxRuleTester().run('hms/no-physical-css', rules['no-physical-css'], {
  valid: [...longhandValid, ...keywordValid, ...shorthandValid, ...contextValid],
  invalid: [...longhandInvalid, ...keywordInvalid, ...shorthandInvalid, ...contextInvalid],
});
