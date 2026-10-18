/**
 * @hms/eslint-plugin: the frontend fitness functions of BUILD-PROMPT.md §6.8 item 6 that ESLint can check.
 * The workspace eslint.config.js registers it under the prefix `hms` and enables both rules as errors.
 */
import type { ESLint, Rule } from 'eslint';
import packageJson from '../package.json' with { type: 'json' };
import noJsxLiterals from './rules/no-jsx-literals.ts';
import noPhysicalCss from './rules/no-physical-css.ts';

/**
 * The rules are written against typescript-eslint's RuleModule type, which types the rule context more
 * precisely than ESLint's core types, and the two declarations are not assignable to each other. The
 * runtime objects are ordinary ESLint rules, so this is the one place the type is converted.
 */
function asEslintRule(rule: unknown): Rule.RuleModule {
  return rule as Rule.RuleModule;
}

export const rules = {
  'no-jsx-literals': asEslintRule(noJsxLiterals),
  'no-physical-css': asEslintRule(noPhysicalCss),
} as const;

const plugin = {
  meta: { name: packageJson.name, version: packageJson.version },
  rules,
} satisfies ESLint.Plugin;

export default plugin;
