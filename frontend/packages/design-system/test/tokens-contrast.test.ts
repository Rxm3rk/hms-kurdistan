// @vitest-environment node
/**
 * UnitTest:tokens-contrast (docs/specs/modules/design-system.md §9; BUILD-PROMPT.md §6.5 "text contrast
 * ≥4.5:1"): every text and background token pair of src/tokens.css reaches 4.5:1, in both densities.
 *
 * The test reads tokens.css itself, the file the browser loads, and applies its cascade per density
 * (`:root`, then the density's own rule). Pairs come from the role names documented in tokens.css:
 * - every neutral text token (--hms-color-text*) on every neutral surface (--hms-color-bg*) and on every
 *   light status surface (info, success, warning, danger);
 * - every --hms-color-<role>-text on its --hms-color-<role>-bg.
 * Non-text marks must reach 3:1 against the surfaces they sit on (WCAG 2.2 1.4.11): borders on the neutral
 * and status surfaces, role borders on the neutral surfaces, and the focus indicator on every surface, the
 * filled accent one included (one of its two rings must reach 3:1 there, and the rings 3:1 against each
 * other). Only the accent text may sit on the filled accent surface: every stylesheet of the package is
 * checked for that.
 * Every --hms-color-* token must fit one of these roles, so a colour added without a checked pair fails.
 * Contrast follows WCAG 2.2's relative luminance and contrast ratio definitions.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TOKENS_CSS = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
const DENSITIES = ['comfortable', 'compact'] as const;
type Density = (typeof DENSITIES)[number];

interface Rule {
  readonly selectors: readonly string[];
  readonly declarations: ReadonlyMap<string, string>;
}

/** Splits a flat stylesheet (no at-rules, no nesting) into rules. */
function parseFlatCss(css: string): Rule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (source.includes('@')) {
    throw new Error('tokens.css must stay flat: an at-rule would change the cascade this test reads');
  }
  const rules: Rule[] = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let consumed = '';
  for (const match of source.matchAll(rulePattern)) {
    const [whole, selectorText = '', body = ''] = match;
    consumed += whole;
    const declarations = new Map<string, string>();
    for (const declaration of body.split(';')) {
      const colon = declaration.indexOf(':');
      if (declaration.trim() === '') {
        continue;
      }
      if (colon < 0) {
        throw new Error(`unparsed declaration in tokens.css: ${declaration.trim()}`);
      }
      declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
    }
    rules.push({ selectors: selectorText.split(',').map((s) => s.trim()), declarations });
  }
  // Fail closed: nothing outside the matched rules but whitespace.
  expect(source.replace(/\s/g, '')).toBe(consumed.replace(/\s/g, ''));
  return rules;
}

/** The custom properties in effect on <html> for one density, in cascade order. */
function tokensFor(rules: readonly Rule[], density: Density): Map<string, string> {
  const applies = (selector: string): boolean =>
    selector === ':root' || selector === `:root[data-density='${density}']`;
  for (const rule of rules) {
    for (const selector of rule.selectors) {
      if (selector !== ':root' && !/^:root\[data-density='(comfortable|compact)'\]$/.test(selector)) {
        throw new Error(`unexpected selector in tokens.css: ${selector}`);
      }
    }
  }
  const tokens = new Map<string, string>();
  // `:root` and `:root[data-density=…]` differ in specificity; apply the plain :root rules first.
  for (const pass of [false, true]) {
    for (const rule of rules) {
      const matched = rule.selectors.filter(applies);
      if (matched.length === 0) {
        continue;
      }
      const specific = matched.some((s) => s !== ':root');
      if (specific !== pass) {
        continue;
      }
      for (const [name, value] of rule.declarations) {
        tokens.set(name, value);
      }
    }
  }
  return tokens;
}

function channel(hex: string, index: number): number {
  const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** A mark and the surface it sits on. With several foregrounds (the two focus rings), one must reach it. */
interface Pair {
  readonly foregrounds: readonly string[];
  readonly background: string;
  readonly minimum: number;
}

const ROLE = /^--hms-color-([a-z]+)-(bg|text|border)$/;

/**
 * Role surfaces that are filled action colours (documented in tokens.css): only their own -text sits on
 * them, which the stylesheet check below enforces. Every other role surface is a light status surface, on
 * which neutral text and borders are checked too.
 */
const FILLED_ROLES: ReadonlySet<string> = new Set(['accent']);

function pairsFor(colours: ReadonlyMap<string, string>): { pairs: Pair[]; unclassified: string[] } {
  const names = [...colours.keys()];
  const neutralSurfaces = names.filter((n) => /^--hms-color-bg(-[a-z]+)?$/.test(n));
  const neutralText = names.filter((n) => /^--hms-color-text(-[a-z]+)?$/.test(n));
  const neutralMarks = names.filter((n) => /^--hms-color-border(-[a-z]+)?$/.test(n));
  const focusRings = names.filter((n) => /^--hms-color-focus(-inner)?$/.test(n));
  // A role counts only with both its surface and its text; a lone role token stays unclassified and fails.
  const roles = names.flatMap((n) => {
    const match = ROLE.exec(n);
    const role = match?.[1] ?? '';
    return match?.[2] === 'bg' && colours.has(`--hms-color-${role}-text`) ? [role] : [];
  });
  const roleSurfaces = roles.map((role) => `--hms-color-${role}-bg`);
  const statusSurfaces = roles
    .filter((role) => !FILLED_ROLES.has(role))
    .map((role) => `--hms-color-${role}-bg`);
  const pairs: Pair[] = [];
  const classified = new Set([
    ...neutralSurfaces,
    ...neutralText,
    ...neutralMarks,
    ...focusRings,
    ...roleSurfaces,
  ]);

  for (const foreground of neutralText) {
    for (const background of [...neutralSurfaces, ...statusSurfaces]) {
      pairs.push({ foregrounds: [foreground], background, minimum: 4.5 });
    }
  }
  for (const foreground of neutralMarks) {
    for (const background of [...neutralSurfaces, ...statusSurfaces]) {
      pairs.push({ foregrounds: [foreground], background, minimum: 3 });
    }
  }
  // The focus indicator can sit on any surface, the filled accent one included.
  for (const background of [...neutralSurfaces, ...roleSurfaces]) {
    pairs.push({ foregrounds: focusRings, background, minimum: 3 });
  }
  const [outerRing, innerRing] = focusRings;
  if (outerRing !== undefined && innerRing !== undefined) {
    pairs.push({ foregrounds: [outerRing], background: innerRing, minimum: 3 });
  }
  for (const role of roles) {
    const text = `--hms-color-${role}-text`;
    const border = `--hms-color-${role}-border`;
    classified.add(text);
    pairs.push({ foregrounds: [text], background: `--hms-color-${role}-bg`, minimum: 4.5 });
    if (colours.has(border)) {
      classified.add(border);
      // A role border separates its surface from the page around it.
      for (const surface of neutralSurfaces) {
        pairs.push({ foregrounds: [border], background: surface, minimum: 3 });
      }
    }
  }
  return { pairs, unclassified: names.filter((n) => !classified.has(n)) };
}

/** The innermost declaration blocks of a stylesheet, each as a map of property to value. */
function declarationBlocks(css: string): Map<string, string>[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...source.matchAll(/\{([^{}]*)\}/g)].map(([, body = '']) => {
    const declarations = new Map<string, string>();
    for (const declaration of body.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon >= 0) {
        declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
      }
    }
    return declarations;
  });
}

/** Rules that put a filled role surface behind anything but that role's own text colour. */
function filledSurfaceMisuse(css: string): string[] {
  const misuse: string[] = [];
  for (const block of declarationBlocks(css)) {
    const background = `${block.get('background-color') ?? ''} ${block.get('background') ?? ''}`;
    for (const role of FILLED_ROLES) {
      if (
        background.includes(`--hms-color-${role}-bg`) &&
        block.get('color') !== `var(--hms-color-${role}-text)`
      ) {
        misuse.push(`${role}: color is ${block.get('color') ?? 'not set'}`);
      }
    }
  }
  return misuse;
}

/** Every .css file under a directory, recursively. */
function stylesheets(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return stylesheets(new URL(`${entry.name}/`, directory));
    }
    return entry.name.endsWith('.css') ? [new URL(entry.name, directory)] : [];
  });
}

const rules = parseFlatCss(TOKENS_CSS);

describe('tokens-contrast', () => {
  for (const density of DENSITIES) {
    describe(`${density} density`, () => {
      const tokens = tokensFor(rules, density);
      const colours = new Map([...tokens].filter(([name]) => name.startsWith('--hms-color-')));

      it('writes every colour token as #rrggbb', () => {
        expect(colours.size).toBeGreaterThan(0);
        for (const [name, value] of colours) {
          expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
        }
      });

      it('gives every colour token a role whose pairs are checked', () => {
        expect(pairsFor(colours).unclassified).toEqual([]);
      });

      it('has text and background pairs to check, a status pair among them', () => {
        const { pairs } = pairsFor(colours);
        expect(pairs.filter((p) => p.minimum === 4.5).length).toBeGreaterThanOrEqual(5);
        expect(pairs).toContainEqual({
          foregrounds: ['--hms-color-warning-text'],
          background: '--hms-color-warning-bg',
          minimum: 4.5,
        });
      });

      it('checks neutral text on the status surfaces and the focus rings on every surface, accent included', () => {
        const { pairs } = pairsFor(colours);
        expect(pairs).toContainEqual({
          foregrounds: ['--hms-color-text-muted'],
          background: '--hms-color-danger-bg',
          minimum: 4.5,
        });
        expect(pairs).toContainEqual({
          foregrounds: ['--hms-color-focus', '--hms-color-focus-inner'],
          background: '--hms-color-accent-bg',
          minimum: 3,
        });
        expect(pairs).toContainEqual({
          foregrounds: ['--hms-color-focus'],
          background: '--hms-color-focus-inner',
          minimum: 3,
        });
        // The filled accent surface carries only its own text, so neutral text is not paired with it.
        expect(pairs.filter((p) => p.background === '--hms-color-accent-bg' && p.minimum === 4.5)).toEqual([
          { foregrounds: ['--hms-color-accent-text'], background: '--hms-color-accent-bg', minimum: 4.5 },
        ]);
      });

      it('reaches 4.5:1 for every text and background pair, and 3:1 for every non-text mark', () => {
        const failures = pairsFor(colours)
          .pairs.map((pair) => {
            const background = colours.get(pair.background) ?? '';
            const ratio = Math.max(
              ...pair.foregrounds.map((f) => contrast(colours.get(f) ?? '', background)),
            );
            return { ...pair, ratio: Math.round(ratio * 100) / 100 };
          })
          .filter((result) => result.ratio < result.minimum);
        expect(failures).toEqual([]);
      });
    });
  }

  it('puts only the accent text on the filled accent surface, in every stylesheet of the package', () => {
    const files = stylesheets(new URL('../src/', import.meta.url));
    expect(files.length).toBeGreaterThanOrEqual(4);
    const misuse = files.flatMap((file) =>
      filledSurfaceMisuse(readFileSync(file, 'utf8')).map((finding) => `${file.pathname}: ${finding}`),
    );
    expect(misuse).toEqual([]);
    // The check itself finds neutral text, or no text colour, on the accent surface.
    expect(
      filledSurfaceMisuse(
        '.a { color: var(--hms-color-text); background-color: var(--hms-color-accent-bg); }',
      ),
    ).toHaveLength(1);
    expect(filledSurfaceMisuse('.a { background: var(--hms-color-accent-bg); }')).toHaveLength(1);
    expect(
      filledSurfaceMisuse(
        '.a { color: var(--hms-color-accent-text); background-color: var(--hms-color-accent-bg); }',
      ),
    ).toEqual([]);
  });

  it('computes WCAG contrast correctly (black on white is 21:1, a colour on itself 1:1)', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
    expect(contrast('#0a4f96', '#0a4f96')).toBe(1);
  });

  it('reads the compact rule over the default one', () => {
    expect(tokensFor(rules, 'compact').get('--hms-target-min-size')).toBe('24px');
    expect(tokensFor(rules, 'comfortable').get('--hms-target-min-size')).toBe('44px');
  });
});
