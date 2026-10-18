/**
 * Physical-direction CSS and the logical CSS that replaces it (BUILD-PROMPT.md §6.5 "RTL by construction",
 * §14.7). The ESLint rule `hms/no-physical-css` and the stylesheet checker both use these tables, so one list
 * is enforced everywhere. Names are held in CSS form (kebab-case); the ESLint rule converts JavaScript style
 * names (camelCase) before looking them up.
 */

/** Physical longhand properties, each with the logical property that replaces it. */
export const PHYSICAL_PROPERTIES: ReadonlyMap<string, string> = new Map([
  ['left', 'inset-inline-start'],
  ['right', 'inset-inline-end'],
  ['margin-left', 'margin-inline-start'],
  ['margin-right', 'margin-inline-end'],
  ['padding-left', 'padding-inline-start'],
  ['padding-right', 'padding-inline-end'],
  ['border-left', 'border-inline-start'],
  ['border-left-color', 'border-inline-start-color'],
  ['border-left-style', 'border-inline-start-style'],
  ['border-left-width', 'border-inline-start-width'],
  ['border-right', 'border-inline-end'],
  ['border-right-color', 'border-inline-end-color'],
  ['border-right-style', 'border-inline-end-style'],
  ['border-right-width', 'border-inline-end-width'],
  ['border-top-left-radius', 'border-start-start-radius'],
  ['border-top-right-radius', 'border-start-end-radius'],
  ['border-bottom-left-radius', 'border-end-start-radius'],
  ['border-bottom-right-radius', 'border-end-end-radius'],
  ['scroll-margin-left', 'scroll-margin-inline-start'],
  ['scroll-margin-right', 'scroll-margin-inline-end'],
  ['scroll-padding-left', 'scroll-padding-inline-start'],
  ['scroll-padding-right', 'scroll-padding-inline-end'],
  // Not CSS properties; listed so that a physical spelling of the inset longhands is still caught.
  ['inset-left', 'inset-inline-start'],
  ['inset-right', 'inset-inline-end'],
]);

/** The logical keyword for each physical keyword of one property. */
export interface KeywordReplacements {
  readonly left: string;
  readonly right: string;
}

/** Properties whose `left` and `right` keywords are physical, with the logical keywords. */
export const PHYSICAL_KEYWORD_PROPERTIES: ReadonlyMap<string, KeywordReplacements> = new Map([
  ['text-align', { left: 'start', right: 'end' }],
  ['text-align-last', { left: 'start', right: 'end' }],
  ['float', { left: 'inline-start', right: 'inline-end' }],
  ['clear', { left: 'inline-start', right: 'inline-end' }],
  ['justify-content', { left: 'start', right: 'end' }],
  ['justify-items', { left: 'start', right: 'end' }],
  ['justify-self', { left: 'start', right: 'end' }],
]);

/**
 * Box shorthands whose four-value form is "top right bottom left". A four-value form whose right and left
 * values differ is physical; the logical pair replaces it.
 */
export const BOX_SHORTHANDS: ReadonlyMap<string, readonly [block: string, inline: string]> = new Map([
  ['margin', ['margin-block', 'margin-inline']],
  ['padding', ['padding-block', 'padding-inline']],
  ['inset', ['inset-block', 'inset-inline']],
  ['scroll-margin', ['scroll-margin-block', 'scroll-margin-inline']],
  ['scroll-padding', ['scroll-padding-block', 'scroll-padding-inline']],
  ['border-width', ['border-block-width', 'border-inline-width']],
  ['border-style', ['border-block-style', 'border-inline-style']],
  ['border-color', ['border-block-color', 'border-inline-color']],
]);

/** The logical corner longhands that replace an asymmetric `border-radius` shorthand. */
export const LOGICAL_RADIUS_LONGHANDS = [
  'border-start-start-radius',
  'border-start-end-radius',
  'border-end-end-radius',
  'border-end-start-radius',
] as const;

/** One physical-direction use found in a declaration. Property and replacement names are in CSS form. */
export type PhysicalCssFinding =
  | { readonly kind: 'property'; readonly property: string; readonly replacement: string }
  | {
      readonly kind: 'keyword';
      readonly property: string;
      readonly value: 'left' | 'right';
      readonly replacement: string;
    }
  | { readonly kind: 'shorthand'; readonly property: string; readonly replacements: readonly string[] };

const CSS_VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/;
const JS_VENDOR_PREFIX = /^(?:Webkit|Moz|ms|Ms|O)(?=[A-Z])/;

/** A CSS property name in canonical form: lower case, without a vendor prefix. Custom properties stay as they are. */
export function normaliseCssPropertyName(name: string): string {
  if (name.startsWith('--')) {
    return name;
  }
  return name.toLowerCase().replace(CSS_VENDOR_PREFIX, '');
}

/**
 * The CSS name for a property key written in a JavaScript style object: `marginLeft` and `WebkitMarginEnd`
 * become `margin-left` and `margin-end`. A key that is already in CSS form (`'margin-left'`) is normalised.
 */
export function jsToCssPropertyName(name: string): string {
  if (name.includes('-')) {
    return normaliseCssPropertyName(name);
  }
  const unprefixed = name.replace(JS_VENDOR_PREFIX, '');
  return unprefixed.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '');
}

/** The JavaScript style-object name for a CSS property: `border-start-start-radius` becomes `borderStartStartRadius`. */
export function cssToJsPropertyName(name: string): string {
  return name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/**
 * Splits a CSS value at top-level separators, ignoring separators inside parentheses and quoted strings.
 * Empty parts are dropped.
 */
export function splitTopLevel(value: string, isSeparator: (character: string) => boolean): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);
    if (quote !== null) {
      current += character;
      if (character === '\\' && index + 1 < value.length) {
        index += 1;
        current += value.charAt(index);
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
    } else if (character === '(') {
      depth += 1;
      current += character;
    } else if (character === ')') {
      depth = Math.max(0, depth - 1);
      current += character;
    } else if (depth === 0 && isSeparator(character)) {
      if (current.trim() !== '') {
        parts.push(current.trim());
      }
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim() !== '') {
    parts.push(current.trim());
  }
  return parts;
}

const isWhitespace = (character: string): boolean => /\s/.test(character);

/** Value tokens, without a trailing `!important`. */
function valueTokens(value: string): string[] {
  const tokens = splitTopLevel(value, isWhitespace);
  if (tokens.at(-1)?.toLowerCase() === '!important') {
    tokens.pop();
  }
  return tokens;
}

/** True when a token could expand to several values (a custom property or similar), so counting is unsafe. */
function mayExpand(token: string): boolean {
  return /\b(?:var|env|attr)\s*\(/i.test(token);
}

/** The finding for a physical longhand property, if the property is one. */
export function checkPhysicalProperty(cssName: string): PhysicalCssFinding | undefined {
  const replacement = PHYSICAL_PROPERTIES.get(cssName);
  return replacement === undefined ? undefined : { kind: 'property', property: cssName, replacement };
}

/** Findings for physical `left` and `right` keywords in the value of a keyword property. */
export function checkPhysicalKeywords(cssName: string, value: string): PhysicalCssFinding[] {
  const replacements = PHYSICAL_KEYWORD_PROPERTIES.get(cssName);
  if (replacements === undefined) {
    return [];
  }
  const findings: PhysicalCssFinding[] = [];
  for (const token of valueTokens(value)) {
    const keyword = token.toLowerCase();
    if (keyword === 'left' || keyword === 'right') {
      findings.push({
        kind: 'keyword',
        property: cssName,
        value: keyword,
        replacement: replacements[keyword],
      });
    }
  }
  return findings;
}

/** The finding for a four-value box shorthand whose right and left values differ. */
export function checkBoxShorthand(cssName: string, value: string): PhysicalCssFinding | undefined {
  const logical = BOX_SHORTHANDS.get(cssName);
  if (logical === undefined) {
    return undefined;
  }
  const tokens = valueTokens(value);
  if (tokens.length !== 4 || tokens.some(mayExpand)) {
    return undefined;
  }
  const [, right, , left] = tokens;
  if (right === undefined || left === undefined || right.toLowerCase() === left.toLowerCase()) {
    return undefined;
  }
  return { kind: 'shorthand', property: cssName, replacements: logical };
}

/** True when a one-to-four-value radius list draws the left corners differently from the right ones. */
function isAsymmetricRadiusList(tokens: readonly string[]): boolean {
  const [a, b, c, d] = tokens.map((token) => token.toLowerCase());
  switch (tokens.length) {
    case 2:
      return a !== b;
    case 3:
      return a !== b || b !== c;
    case 4:
      return a !== b || c !== d;
    default:
      return false;
  }
}

/** The finding for a `border-radius` shorthand whose corners are not mirror-symmetric. */
export function checkBorderRadius(cssName: string, value: string): PhysicalCssFinding | undefined {
  if (cssName !== 'border-radius') {
    return undefined;
  }
  const lists = splitTopLevel(value.replace(/!important\s*$/i, ''), (character) => character === '/').map(
    (part) => splitTopLevel(part, isWhitespace),
  );
  if (lists.length > 2 || lists.some((tokens) => tokens.length > 4 || tokens.some(mayExpand))) {
    return undefined;
  }
  if (!lists.some(isAsymmetricRadiusList)) {
    return undefined;
  }
  return { kind: 'shorthand', property: cssName, replacements: LOGICAL_RADIUS_LONGHANDS };
}

/** Every physical-direction finding for one declaration. Pass no value when it is not known statically. */
export function checkDeclaration(cssName: string, value?: string): PhysicalCssFinding[] {
  const findings: PhysicalCssFinding[] = [];
  const property = checkPhysicalProperty(cssName);
  if (property !== undefined) {
    findings.push(property);
  }
  if (value !== undefined) {
    findings.push(...checkPhysicalKeywords(cssName, value));
    const shorthand = checkBoxShorthand(cssName, value) ?? checkBorderRadius(cssName, value);
    if (shorthand !== undefined) {
      findings.push(shorthand);
    }
  }
  return findings;
}

/** Shapes property names for a message: CSS form for stylesheets, JavaScript form for style objects. */
export type NameForm = 'css' | 'js';

function formatName(name: string, form: NameForm): string {
  return form === 'css' ? name : cssToJsPropertyName(name);
}

function joinNames(names: readonly string[]): string {
  const quoted = names.map((name) => `"${name}"`);
  if (quoted.length <= 1) {
    return quoted.join('');
  }
  return `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1) ?? ''}`;
}

/** Message templates shared by the ESLint rule (as `meta.messages`) and the stylesheet checker. */
export const PHYSICAL_CSS_MESSAGES = {
  physicalProperty:
    'Physical CSS property "{{property}}": use the logical property "{{replacement}}" so the layout mirrors in right-to-left locales (BUILD-PROMPT.md §6.5).',
  physicalKeyword:
    '"{{property}}: {{value}}" is a physical direction: use "{{replacement}}" so the layout mirrors in right-to-left locales (BUILD-PROMPT.md §6.5).',
  physicalShorthand:
    'This "{{property}}" shorthand sets left and right differently: use {{replacement}} so the layout mirrors in right-to-left locales (BUILD-PROMPT.md §6.5).',
} as const;

export type PhysicalCssMessageId = keyof typeof PHYSICAL_CSS_MESSAGES;

/**
 * The message id and the placeholder values for a finding. Replacement names are given in `form`; the
 * property is shown as `writtenAs` (the spelling in the source) when given.
 */
export function describeFinding(
  finding: PhysicalCssFinding,
  form: NameForm,
  writtenAs?: string,
): { messageId: PhysicalCssMessageId; data: Readonly<Record<string, string>> } {
  const property = writtenAs ?? formatName(finding.property, form);
  switch (finding.kind) {
    case 'property':
      return {
        messageId: 'physicalProperty',
        data: { property, replacement: formatName(finding.replacement, form) },
      };
    case 'keyword':
      return {
        messageId: 'physicalKeyword',
        data: { property, value: finding.value, replacement: finding.replacement },
      };
    case 'shorthand':
      return {
        messageId: 'physicalShorthand',
        data: {
          property,
          replacement: joinNames(finding.replacements.map((name) => formatName(name, form))),
        },
      };
  }
}

/** A one-line, human-readable message for a finding (used by the stylesheet checker). */
export function formatFinding(finding: PhysicalCssFinding, form: NameForm, writtenAs?: string): string {
  const { messageId, data } = describeFinding(finding, form, writtenAs);
  return PHYSICAL_CSS_MESSAGES[messageId].replace(
    /\{\{(\w+)\}\}/g,
    (_match, name: string) => data[name] ?? '',
  );
}
