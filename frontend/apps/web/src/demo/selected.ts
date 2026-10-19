/**
 * The demo module of this build: none. This is what every build gets unless it sets `VITE_HMS_DEMO=1`; a demo
 * build resolves this file to `./index.ts` instead (vite.config.ts, OQ-142). A mistake in that switch can only
 * leave the demo out, never put it into a production build (fail closed).
 */
import type { DemoModule } from './demo-module.ts';

export const demoModule: DemoModule | null = null;
