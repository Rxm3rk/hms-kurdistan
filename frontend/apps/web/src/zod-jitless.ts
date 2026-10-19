/**
 * Zod without its JIT (`jitless`). By default Zod probes `new Function` before it parses an object, to compile
 * faster parsers; the Content-Security-Policy of built pages forbids `eval` (vite.config.ts), so the probe
 * fails and the browser reports a violation on every page load. Parsing is the same either way. main.tsx
 * imports this module first, before any module that parses with Zod (the demo fixtures parse when they
 * load).
 */
import { z } from 'zod';

z.config({ jitless: true });
