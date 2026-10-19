/**
 * Vite for the HMS Kurdistan clickable prototype (throwaway demo, outside the product repository).
 *
 *   ../../node_modules/.bin/vite          development server on http://127.0.0.1:5200 (loopback only)
 *   ../../node_modules/.bin/vite build    static build in dist/
 *
 * - **The demo is always on.** `VITE_HMS_DEMO` is forced to `1` before Vite reads the environment, so the
 *   design system's simulated sign-in (KA-032) is allowed in development and in the build alike. No switch
 *   and no `.env` file is needed. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 * - **Nothing from another origin**: fonts, icons and data are bundled; the servers listen on the loopback
 *   interface only; built pages carry a Content-Security-Policy that allows the page's own origin (and
 *   inline `data:` images and fonts) and nothing else.
 */
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Read by Vite's own environment loading (process.env wins over .env files), so import.meta.env.VITE_HMS_DEMO
// is '1' in every mode.
process.env.VITE_HMS_DEMO = '1';

/** The Content-Security-Policy of built pages: the page's own origin only. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
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

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  define: {
    'import.meta.env.VITE_HMS_DEMO': JSON.stringify('1'),
  },
  server: { host: '127.0.0.1', port: 5200, strictPort: true },
  preview: { host: '127.0.0.1', port: 5201, strictPort: true },
});
