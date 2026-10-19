// @vitest-environment node
/**
 * The demo is absent from production builds (docs/specs/modules/design-system.md §5, §9 demo-exclusion row of
 * ArchTest:banner-present-on-every-clinical-route; OQ-142, OQ-163).
 *
 * The route-tree test shows that the app builds no `/demo` route from `src/demo/selected.ts`. This file tests
 * the switch that decides which file a bundle gets: the `hms-demo-module` plugin of vite.config.ts on its own,
 * and then two real builds in memory, one without the flag and one with it, whose JavaScript is searched for
 * the demo's marks (synthetic patient ids, the demo path, the demo user, the synthetic photo). The demo build
 * shows that the search finds them when they are there.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin, type Rolldown } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT_SECURITY_POLICY,
  DEMO_MODULE_FILES,
  demoEnabled,
  demoModuleSwitch,
} from '../vite.config.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** What only the demo module brings into a bundle. */
const DEMO_MARKS = ['SYN-PAT-', 'demo/banner', 'user-synthetic-demo', 'iVBORw0KGgo'] as const;

type ResolveId = (
  this: { resolve: (source: string, importer?: string, options?: object) => Promise<{ id: string } | null> },
  source: string,
  importer: string | undefined,
  options: object,
) => Promise<string | null>;

/** Runs the plugin's resolveId as Vite would, with a resolver that maps a source to `resolved`. */
async function resolveWith(
  plugin: Plugin,
  source: string,
  importer: string | undefined,
  resolved: string,
): Promise<string | null> {
  const hook = plugin.resolveId as unknown as ResolveId;
  return hook.call({ resolve: () => Promise.resolve({ id: resolved }) }, source, importer, {});
}

/** Builds the app in memory and returns its JavaScript and its index.html. */
async function buildInMemory(): Promise<{ js: string; html: string }> {
  const result = await build({
    root: appRoot,
    configFile: path.join(appRoot, 'vite.config.ts'),
    mode: 'production',
    logLevel: 'silent',
    build: { write: false, chunkSizeWarningLimit: Number.POSITIVE_INFINITY },
  });
  const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[];
  let js = '';
  let html = '';
  for (const item of outputs.flatMap((output) => output.output)) {
    if (item.type === 'chunk') {
      js += item.code;
    } else if (item.fileName.endsWith('.html')) {
      html += typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source);
    } else if (item.fileName.endsWith('.js')) {
      js += typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source);
    }
  }
  return { js, html };
}

/** The policy as Vite writes it into the content attribute. */
const htmlAttribute = (value: string): string => `content="${value.replaceAll("'", '&#39;')}"`;

const marksIn = (js: string): string[] => DEMO_MARKS.filter((mark) => js.includes(mark));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('demo-absent-from-production-bundle', () => {
  it('a build gets the demo only with VITE_HMS_DEMO=1; the development server unless it is set otherwise', () => {
    expect(demoEnabled('build', {})).toBe(false);
    expect(demoEnabled('build', { VITE_HMS_DEMO: '' })).toBe(false);
    expect(demoEnabled('build', { VITE_HMS_DEMO: '0' })).toBe(false);
    expect(demoEnabled('build', { VITE_HMS_DEMO: 'true' })).toBe(false);
    expect(demoEnabled('build', { VITE_HMS_DEMO: '1' })).toBe(true);
    expect(demoEnabled('serve', {})).toBe(true);
    expect(demoEnabled('serve', { VITE_HMS_DEMO: '1' })).toBe(true);
    expect(demoEnabled('serve', { VITE_HMS_DEMO: '0' })).toBe(false);
  });

  it('the plugin resolves nothing when the demo is off', async () => {
    const plugin = demoModuleSwitch(false);
    const importer = path.join(appRoot, 'src', 'app', 'create-services.ts');
    expect(await resolveWith(plugin, '../demo/selected.ts', importer, DEMO_MODULE_FILES.selected)).toBeNull();
    expect(await resolveWith(plugin, './other.ts', importer, path.join(appRoot, 'src', 'other.ts'))).toBeNull();
  });

  it('the plugin maps only src/demo/selected.ts to src/demo/index.ts when the demo is on', async () => {
    const plugin = demoModuleSwitch(true);
    const importer = path.join(appRoot, 'src', 'app', 'create-services.ts');
    expect(await resolveWith(plugin, '../demo/selected.ts', importer, DEMO_MODULE_FILES.selected)).toBe(
      DEMO_MODULE_FILES.enabled,
    );
    expect(
      await resolveWith(plugin, '../demo/selected.ts?x', importer, `${DEMO_MODULE_FILES.selected}?x`),
    ).toBe(DEMO_MODULE_FILES.enabled);
    expect(await resolveWith(plugin, './other.ts', importer, path.join(appRoot, 'src', 'other.ts'))).toBeNull();
    // An entry point (no importer) is never swapped.
    expect(await resolveWith(plugin, DEMO_MODULE_FILES.selected, undefined, DEMO_MODULE_FILES.selected)).toBeNull();
  });

  it('a production build holds none of the demo; a demo build holds it', async () => {
    vi.stubEnv('VITE_HMS_DEMO', undefined);
    const production = await buildInMemory();
    expect(production.js.length).toBeGreaterThan(0);
    expect(marksIn(production.js)).toEqual([]);
    expect(production.html).toContain(htmlAttribute(CONTENT_SECURITY_POLICY));

    vi.stubEnv('VITE_HMS_DEMO', '1');
    const demo = await buildInMemory();
    expect(marksIn(demo.js)).toEqual([...DEMO_MARKS]);
    expect(demo.html).toContain(htmlAttribute(CONTENT_SECURITY_POLICY));
  }, 120_000);
});
