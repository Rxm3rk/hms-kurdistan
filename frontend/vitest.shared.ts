/**
 * Shared Vitest settings for every frontend package (BUILD-PROMPT.md §19.1 fast tier). Each package's
 * vitest.config.ts calls hmsVitestConfig with its directory name; results go to the console and to
 * frontend/reports/junit/<package>.xml, which the CI runner reads (tools/ci/run).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type ViteUserConfig } from 'vitest/config';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

/** How a package's tests run. The defaults suit DOM-free packages. */
export interface HmsVitestOptions {
  /**
   * 'node' (the default) for DOM-free code; 'jsdom' for React components and anything else that needs
   * a DOM. Browser behaviour that jsdom does not model (layout, fonts, computed direction) is tested
   * with Playwright, not here.
   */
  readonly environment?: 'node' | 'jsdom';
  /**
   * Setup files, relative to the package directory, run before each test file (for example one that
   * registers @testing-library/jest-dom's matchers and React Testing Library's cleanup). They are the
   * package's own, so their imports resolve against the package's dependencies.
   */
  readonly setupFiles?: readonly string[];
}

/** The JUnit XML report path for one package. */
export function junitReportPath(packageName: string): string {
  return path.join(frontendRoot, 'reports', 'junit', `${packageName}.xml`);
}

export function hmsVitestConfig(packageName: string, options: HmsVitestOptions = {}): ViteUserConfig {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(packageName)) {
    throw new Error(`hmsVitestConfig: "${packageName}" is not a package directory name`);
  }
  return defineConfig({
    test: {
      // .test.tsx for component tests; both kinds live under test/.
      include: ['test/**/*.test.{ts,tsx}'],
      environment: options.environment ?? 'node',
      setupFiles: [...(options.setupFiles ?? [])],
      // A package that runs tests must have some: an empty run fails instead of passing.
      passWithNoTests: false,
      reporters: ['default', ['junit', { suiteName: packageName }]],
      outputFile: { junit: junitReportPath(packageName) },
    },
  });
}
