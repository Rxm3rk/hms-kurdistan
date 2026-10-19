/**
 * Vite for the web app (BUILD-PROMPT.md §4.1; docs/specs/modules/design-system.md §4, §5, §8).
 *
 *   corepack pnpm --filter @hms/web dev                       development server
 *   corepack pnpm --filter @hms/web build                     production build: no demo
 *   VITE_HMS_DEMO=1 corepack pnpm --filter @hms/web build     demo build: /demo/banner and the fixtures
 *   corepack pnpm --filter @hms/web preview                   serves the last build
 *
 * - **The demo exists only in demo builds** (OQ-142). The app imports its demo module from
 *   `src/demo/selected.ts`, which is null. Only when the build sets `VITE_HMS_DEMO=1` does the
 *   `hms-demo-module` plugin resolve that file to `src/demo/index.ts`. So a production bundle holds no demo
 *   route, fixture or simulated sign-in, and a mistake in the switch can only leave the demo out.
 * - **Nothing from another origin** (§4): fonts, icons and catalogues are bundled; servers listen on the
 *   loopback interface only; built pages carry a Content-Security-Policy that allows the page's own origin
 *   (and inline `data:` images and fonts, which Vite makes of small assets) and nothing else, so the browser
 *   itself refuses a request to anywhere else. The development server, whose React refresh needs an inline
 *   script, has no policy.
 * - Unit tests do not use this file: vitest.config.ts uses the workspace's shared settings, and tests import
 *   the demo module directly.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

/** The demo module's two files: what the app imports, and what a demo build gets instead. */
export const DEMO_MODULE_FILES = {
  selected: path.join(appRoot, 'src', 'demo', 'selected.ts'),
  enabled: path.join(appRoot, 'src', 'demo', 'index.ts'),
} as const;

/** True only when the build sets `VITE_HMS_DEMO` to exactly `1`. */
export function isDemoBuild(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.VITE_HMS_DEMO === '1';
}

function samePath(a: string, b: string): boolean {
  const normalise = (file: string): string => path.normalize(file.split('?')[0] ?? file).toLowerCase();
  return normalise(a) === normalise(b);
}

/** Resolves `src/demo/selected.ts` to `src/demo/index.ts` in demo builds; does nothing otherwise. */
function demoModuleSwitch(demo: boolean): Plugin {
  return {
    name: 'hms-demo-module',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!demo || importer === undefined) {
        return null;
      }
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved !== null && samePath(resolved.id, DEMO_MODULE_FILES.selected)) {
        return DEMO_MODULE_FILES.enabled;
      }
      return null;
    },
  };
}

/**
 * The two style elements React Aria (react-aria-components 1.22.1) adds to the page itself, allowed by hash:
 * `touch-action` on pressable elements (usePress) and `overscroll-behavior` while a modal blocks scrolling
 * (usePreventScroll). A static page cannot carry a nonce. If a React Aria upgrade changes the text, the
 * browser refuses the style and reports the new hash; only that style is lost.
 */
const REACT_ARIA_STYLE_HASHES = [
  "'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='",
  "'sha256-gYiS/BvZvRcK27JIXTuwhZ3hs2+VJ1X+2gUlE+farlg='",
];

/** The Content-Security-Policy of built pages: the page's own origin only. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  `style-src 'self' ${REACT_ARIA_STYLE_HASHES.join(' ')}`,
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'hms-content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}

export default defineConfig(({ mode }) => {
  const demo = isDemoBuild(loadEnv(mode, appRoot, 'VITE_'));
  return {
    plugins: [demoModuleSwitch(demo), react(), contentSecurityPolicy()],
    server: { host: '127.0.0.1' },
    preview: { host: '127.0.0.1' },
  };
});
