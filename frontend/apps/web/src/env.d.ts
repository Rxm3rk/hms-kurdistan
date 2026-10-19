/**
 * Build-time values the web app reads (docs/specs/modules/design-system.md §5, §8): `VITE_HMS_DEMO` is '1' in
 * demo builds only, never in production builds (OQ-142). The app does not branch on it at run time: the
 * build swaps the demo module in (vite.config.ts), and the simulated sign-in checks it on its own.
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HMS_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
