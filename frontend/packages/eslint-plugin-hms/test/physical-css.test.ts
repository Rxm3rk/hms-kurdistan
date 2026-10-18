import { describe, expect, it } from 'vitest';
import {
  checkBorderRadius,
  checkBoxShorthand,
  checkDeclaration,
  checkPhysicalKeywords,
  cssToJsPropertyName,
  formatFinding,
  jsToCssPropertyName,
  normaliseCssPropertyName,
  PHYSICAL_PROPERTIES,
  splitTopLevel,
} from '../src/physical-css.ts';

const whitespace = (character: string): boolean => /\s/.test(character);

describe('property names', () => {
  it('converts JavaScript style names to CSS names, dropping vendor prefixes', () => {
    expect(jsToCssPropertyName('marginLeft')).toBe('margin-left');
    expect(jsToCssPropertyName('borderTopLeftRadius')).toBe('border-top-left-radius');
    expect(jsToCssPropertyName('WebkitBorderTopLeftRadius')).toBe('border-top-left-radius');
    expect(jsToCssPropertyName('msScrollMarginLeft')).toBe('scroll-margin-left');
    expect(jsToCssPropertyName('left')).toBe('left');
    expect(jsToCssPropertyName('margin-left')).toBe('margin-left');
    expect(jsToCssPropertyName('-moz-padding-right')).toBe('padding-right');
  });

  it('normalises CSS names to lower case without a vendor prefix, leaving custom properties alone', () => {
    expect(normaliseCssPropertyName('MARGIN-LEFT')).toBe('margin-left');
    expect(normaliseCssPropertyName('-webkit-border-top-left-radius')).toBe('border-top-left-radius');
    expect(normaliseCssPropertyName('--Margin-Left')).toBe('--Margin-Left');
  });

  it('converts CSS names back to JavaScript names', () => {
    expect(cssToJsPropertyName('border-start-start-radius')).toBe('borderStartStartRadius');
    expect(cssToJsPropertyName('left')).toBe('left');
  });

  it('maps every physical longhand to a logical property', () => {
    for (const [physical, logical] of PHYSICAL_PROPERTIES) {
      expect(physical).toMatch(/left|right/);
      expect(logical).not.toMatch(/left|right|top|bottom/);
      expect(logical).toMatch(/inline|start|end/);
    }
  });
});

describe('splitTopLevel', () => {
  it('splits at top-level whitespace only', () => {
    expect(splitTopLevel('0  calc(1px + 2px)\t4px', whitespace)).toEqual(['0', 'calc(1px + 2px)', '4px']);
    expect(splitTopLevel("url('a b.png') 1px", whitespace)).toEqual(["url('a b.png')", '1px']);
    expect(splitTopLevel('"a \\" b" c', whitespace)).toEqual(['"a \\" b"', 'c']);
    expect(splitTopLevel('   ', whitespace)).toEqual([]);
  });

  it('splits at a chosen separator', () => {
    expect(splitTopLevel('4px 2px / 1px', (character) => character === '/')).toEqual(['4px 2px', '1px']);
  });
});

describe('keyword, shorthand and radius checks', () => {
  it('reports left and right keywords only for keyword properties', () => {
    expect(checkPhysicalKeywords('text-align', 'left')).toEqual([
      { kind: 'keyword', property: 'text-align', value: 'left', replacement: 'start' },
    ]);
    expect(checkPhysicalKeywords('justify-items', 'legacy right')).toHaveLength(1);
    expect(checkPhysicalKeywords('text-align', 'start')).toEqual([]);
    expect(checkPhysicalKeywords('content', 'left')).toEqual([]);
  });

  it('reports a four-value shorthand only when right and left differ', () => {
    expect(checkBoxShorthand('margin', '0 8px 0 0')).toBeDefined();
    expect(checkBoxShorthand('margin', '0 8px 0 0 !important')).toBeDefined();
    expect(checkBoxShorthand('margin', '0 8px 0 8PX')).toBeUndefined();
    expect(checkBoxShorthand('margin', '0 8px 0')).toBeUndefined();
    expect(checkBoxShorthand('margin', 'var(--x) 1px 2px 3px')).toBeUndefined();
    expect(checkBoxShorthand('outline', '1px 2px 3px 4px')).toBeUndefined();
  });

  it('reports a border-radius whose corners are not mirror-symmetric', () => {
    for (const asymmetric of ['4px 0', '1px 2px 3px', '1px 1px 2px 3px', '4px / 1px 2px', '1px 2px 2px']) {
      expect(checkBorderRadius('border-radius', asymmetric), asymmetric).toBeDefined();
    }
    for (const symmetric of ['4px', '4px 4px', '2px 2px 2px', '4px 4px 1px 1px', '4px / 2px', 'env(x) 1px']) {
      expect(checkBorderRadius('border-radius', symmetric), symmetric).toBeUndefined();
    }
    expect(checkBorderRadius('margin', '4px 0')).toBeUndefined();
  });

  it('combines the checks for one declaration', () => {
    expect(checkDeclaration('margin-left')).toHaveLength(1);
    expect(checkDeclaration('margin-left', '4px')).toHaveLength(1);
    expect(checkDeclaration('float', 'left')).toHaveLength(1);
    expect(checkDeclaration('margin-inline-start', '4px')).toEqual([]);
  });
});

describe('formatFinding', () => {
  it('names the logical replacement in CSS or JavaScript form', () => {
    const [finding] = checkDeclaration('margin-left');
    expect(finding).toBeDefined();
    if (finding === undefined) {
      return;
    }
    expect(formatFinding(finding, 'css')).toBe(
      'Physical CSS property "margin-left": use the logical property "margin-inline-start" so the layout mirrors in right-to-left locales (BUILD-PROMPT.md §6.5).',
    );
    expect(formatFinding(finding, 'js', 'marginLeft')).toContain(
      '"marginLeft": use the logical property "marginInlineStart"',
    );
  });
});
