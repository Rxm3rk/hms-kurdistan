// TEMPORARY: bundles smoke-entry.tsx for Node (SSR build), deleted after the integration pass.
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

await build({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  logLevel: 'warn',
  build: {
    ssr: path.join(here, 'smoke-entry.tsx'),
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
  },
  ssr: { noExternal: true, external: ['jsdom'], resolve: { conditions: ['browser', 'module', 'import', 'default'], externalConditions: ['browser'] } },
  resolve: { conditions: ['browser', 'module', 'import', 'default'] },
});
console.log('built');
