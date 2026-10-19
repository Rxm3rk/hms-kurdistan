/**
 * ESLint's own RuleTester, run under Vitest: RuleTester's describe/it hooks are pointed at Vitest's, so every
 * valid and invalid case is reported as a Vitest test (and in the JUnit report).
 */
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

/** A RuleTester that parses TypeScript with JSX, as the workspace's .tsx files are parsed. */
export function tsxRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  });
}
