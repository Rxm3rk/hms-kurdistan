import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import packageJson from '../package.json' with { type: 'json' };
import plugin from '../src/index.ts';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('@hms/eslint-plugin', () => {
  it('exposes exactly the two rules, with metadata', () => {
    expect(Object.keys(plugin.rules).sort()).toEqual(['no-jsx-literals', 'no-physical-css']);
    expect(plugin.meta).toEqual({ name: '@hms/eslint-plugin', version: packageJson.version });
    for (const rule of Object.values(plugin.rules)) {
      expect(rule.meta?.type).toBe('problem');
      expect(rule.meta?.docs?.description).toBeTruthy();
    }
  });
});

describe('the workspace eslint.config.js', () => {
  const files = [
    'apps/web/src/page.tsx',
    'packages/design-system/src/banner.tsx',
    'packages/i18n/src/index.ts',
  ];
  const rulesByFile = new Map<string, Record<string, unknown> | undefined>();

  // Loading the configuration imports typescript-eslint, which takes several seconds on a cold start.
  beforeAll(async () => {
    const eslint = new ESLint({ cwd: frontendRoot });
    for (const file of files) {
      const config = (await eslint.calculateConfigForFile(path.join(frontendRoot, file))) as {
        rules?: Record<string, unknown>;
      };
      rulesByFile.set(file, config.rules);
    }
  }, 60_000);

  const severity = (file: string, name: string): unknown => {
    const entry = rulesByFile.get(file)?.[name];
    return Array.isArray(entry) ? entry[0] : entry;
  };

  for (const file of files) {
    it(`enables the hms rules and no-explicit-any as errors for ${file}`, () => {
      expect(severity(file, 'hms/no-jsx-literals')).toBe(2);
      expect(severity(file, 'hms/no-physical-css')).toBe(2);
      expect(severity(file, '@typescript-eslint/no-explicit-any')).toBe(2);
      // A rule from the strict type-checked set, to show it is in force too.
      expect(severity(file, '@typescript-eslint/no-unsafe-assignment')).toBe(2);
    });
  }
});
