import type { RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';
import { rules } from '../src/index.ts';
import { USER_VISIBLE_ATTRIBUTES } from '../src/rules/no-jsx-literals.ts';
import { tsxRuleTester } from './rule-tester.ts';

/** The attribute list from the WP-0.1 brief and BUILD-PROMPT.md §6.5, written out as the test oracle. */
const EXPECTED_ATTRIBUTES = [
  'title',
  'alt',
  'placeholder',
  'label',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
];

const jsxText = (text: string): RuleTester.TestCaseError => ({ messageId: 'jsxText', data: { text } });
const attributeLiteral = (attribute: string): RuleTester.TestCaseError => ({
  messageId: 'attributeLiteral',
  data: { attribute },
});

describe('hms/no-jsx-literals attribute list', () => {
  it('covers exactly the user-visible attributes of the brief', () => {
    expect([...USER_VISIBLE_ATTRIBUTES].sort()).toEqual([...EXPECTED_ATTRIBUTES].sort());
  });
});

const attributeValid: string[] = EXPECTED_ATTRIBUTES.flatMap((attribute) => [
  `<Field ${attribute}={t('field.${attribute}')} />`,
  `<Field ${attribute}={value} />`,
  `<Field ${attribute}={\`\${first}\${last}\`} />`,
]);

const attributeInvalid: RuleTester.InvalidTestCase[] = EXPECTED_ATTRIBUTES.flatMap((attribute) => [
  { code: `<Field ${attribute}="Close" />`, errors: [attributeLiteral(attribute)] },
  { code: `<Field ${attribute}={'Close'} />`, errors: [attributeLiteral(attribute)] },
  { code: `<Field ${attribute}={\`Close \${name}\`} />`, errors: [attributeLiteral(attribute)] },
  { code: `<Field ${attribute}={open ? 'Yes' : t('no')} />`, errors: [attributeLiteral(attribute)] },
  { code: `<Field ${attribute}={label ?? 'Unknown'} />`, errors: [attributeLiteral(attribute)] },
  { code: `<Field ${attribute}={'Dr ' + name} />`, errors: [attributeLiteral(attribute)] },
]);

tsxRuleTester().run('hms/no-jsx-literals', rules['no-jsx-literals'], {
  valid: [
    // Text from the catalogues, and expressions that are not literals.
    "<p>{t('app.name')}</p>",
    '<p>{name}</p>',
    '<p>{count}</p>',
    '<p>{count + 1}</p>',
    '<p>{items.length > 0 ? items.length : none}</p>',
    '<p>{/* a comment */}</p>',
    // Whitespace and punctuation carry no language.
    '<p>   </p>',
    "<p>{' '}</p>",
    '<p>·</p>',
    '<p>— / : ( )</p>',
    '<p>&nbsp;</p>',
    // The WCAG marker for a decorative image.
    '<img alt="" src={logo} />',
    "<img alt={''} src={logo} />",
    // Attributes a user never reads.
    '<div className="banner" data-testid="banner" id="main" role="region" />',
    '<input type="text" name="q" autoComplete="off" inputMode="numeric" />',
    // Plain strings outside JSX are not this rule's concern.
    "const key = 'app.name';",
    ...attributeValid,
  ],
  invalid: [
    { code: '<p>Hello</p>', errors: [jsxText('Hello')] },
    { code: '<p>  Save   changes  </p>', errors: [jsxText('Save changes')] },
    // Letters and digits in every script count, not only Latin.
    { code: '<p>کوردی</p>', errors: [jsxText('کوردی')] },
    { code: '<p>العربية</p>', errors: [jsxText('العربية')] },
    { code: '<span>42</span>', errors: [jsxText('42')] },
    { code: '<span>٤٢</span>', errors: [jsxText('٤٢')] },
    // Literal children written as expressions.
    { code: "<p>{'Hello'}</p>", errors: [jsxText('Hello')] },
    { code: '<p>{`Hello`}</p>', errors: [jsxText('Hello')] },
    { code: '<p>{`Hello ${name}`}</p>', errors: [jsxText('Hello')] },
    { code: '<p>{42}</p>', errors: [jsxText('42')] },
    { code: '<p>{count ?? 0}</p>', errors: [jsxText('0')] },
    { code: "<p>{isOpen ? 'Open' : label}</p>", errors: [jsxText('Open')] },
    { code: "<p>{label || 'Unknown'}</p>", errors: [jsxText('Unknown')] },
    { code: "<p>{'Dr ' + name}</p>", errors: [jsxText('Dr')] },
    { code: "<p>{('Hello' as string)}</p>", errors: [jsxText('Hello')] },
    { code: '<><b>Bold</b> text</>', errors: [jsxText('Bold'), jsxText('text')] },
    {
      code: '<p>This sentence is far too long to be shown in full in the lint message</p>',
      errors: [jsxText('This sentence is far too long to be…')],
    },
    // Attribute values: any visible character counts, punctuation included, because it is announced.
    { code: '<img alt="Logo" src={logo} />', errors: [attributeLiteral('alt')] },
    { code: '<button aria-label="—" />', errors: [attributeLiteral('aria-label')] },
    ...attributeInvalid,
  ],
});
