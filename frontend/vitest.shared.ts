/**
 * Shared Vitest settings for every frontend package (BUILD-PROMPT.md §19.1 fast tier). Each package's
 * vitest.config.ts calls hmsVitestConfig with its directory name; results go to the console and to
 * frontend/reports/junit/<package>.xml, which the CI runner reads (tools/ci/run).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type ViteUserConfig } from 'vitest/config';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

/** The JUnit XML report path for one package. */
export function junitReportPath(packageName: string): string {
  return path.join(frontendRoot, 'reports', 'junit', `${packageName}.xml`);
}

export function hmsVitestConfig(packageName: string): ViteUserConfig {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(packageName)) {
    throw new Error(`hmsVitestConfig: "${packageName}" is not a package directory name`);
  }
  return defineConfig({
    test: {
      include: ['test/**/*.test.ts'],
      environment: 'node',
      // A package that runs tests must have some: an empty run fails instead of passing.
      passWithNoTests: false,
      reporters: ['default', ['junit', { suiteName: packageName }]],
      outputFile: { junit: junitReportPath(packageName) },
    },
  });
}
