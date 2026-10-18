// @ts-check
/**
 * ESLint for the whole frontend workspace (BUILD-PROMPT.md §6.5, §6.8 item 6, §19.1 fast tier).
 * typescript-eslint's strict type-checked rules apply to every TypeScript and JavaScript file, with type
 * information from the nearest tsconfig.json; the local hms rules enforce catalogue-only UI strings and
 * logical CSS. Run with `pnpm run lint:es`; warnings fail the run (--max-warnings 0).
 */
import js from '@eslint/js';
import hms from '@hms/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/dist/', '**/build/', '**/coverage/', 'reports/'], 'hms/ignores'),
  {
    name: 'hms/files',
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    name: 'hms/type-information',
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  {
    name: 'hms/rules',
    plugins: { hms },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'hms/no-jsx-literals': 'error',
      'hms/no-physical-css': 'error',
    },
  },
);
