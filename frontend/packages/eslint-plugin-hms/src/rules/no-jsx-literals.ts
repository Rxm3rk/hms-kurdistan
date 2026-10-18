/**
 * hms/no-jsx-literals: no hard-coded user-facing strings in JSX (BUILD-PROMPT.md §6.5 "No string literals in
 * JSX", §6.8 item 6). Every user-facing string comes from the ICU MessageFormat catalogues in @hms/i18n.
 *
 * What is reported:
 * - JSX text that contains a letter or a digit in any script (Unicode \p{L} or \p{N}, so Sorani, Arabic and
 *   Eastern Arabic-Indic digits are caught as well as Latin);
 * - JSX children that are string or number literals, or template literals with literal text, including
 *   the branches of a conditional or logical expression (`{isOpen ? 'Open' : label}`);
 * - string values of the user-visible attributes listed in USER_VISIBLE_ATTRIBUTES, written directly
 *   (`title="Close"`) or as an expression (`title={'Close'}`, `title={`Close ${name}`}`).
 *
 * What is allowed: whitespace and punctuation-only text (`·`, `—`, `/`), and `alt=""`, the WCAG marker for a
 * decorative image.
 */
import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { docsUrl } from './docs-url.ts';

const createRule = ESLintUtils.RuleCreator(docsUrl);

/** Attributes whose value a user reads or hears (BUILD-PROMPT.md §6.5; WAI-ARIA). */
export const USER_VISIBLE_ATTRIBUTES: ReadonlySet<string> = new Set([
  'title',
  'alt',
  'placeholder',
  'label',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
]);

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const MAX_SHOWN = 40;

/** The text as shown in a message: whitespace collapsed, long text cut at a word boundary. */
function shown(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_SHOWN) {
    return collapsed;
  }
  const cut = collapsed.slice(0, MAX_SHOWN - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > MAX_SHOWN / 2 ? cut.slice(0, lastSpace) : cut}…`;
}

/**
 * Literal text an expression can render, with the node holding each piece. A number literal rendered as it
 * stands (`{42}`, `{n ?? 0}`) counts as text; one inside arithmetic (`{count + 1}`) does not.
 */
function literalText(node: TSESTree.Node, numbersAreText = true): { node: TSESTree.Node; text: string }[] {
  switch (node.type) {
    case AST_NODE_TYPES.Literal:
      if (typeof node.value === 'string') {
        return [{ node, text: node.value }];
      }
      if (numbersAreText && (typeof node.value === 'number' || typeof node.value === 'bigint')) {
        return [{ node, text: String(node.value) }];
      }
      return [];
    case AST_NODE_TYPES.TemplateLiteral: {
      const text = node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(' ');
      return [{ node, text }];
    }
    case AST_NODE_TYPES.ConditionalExpression:
      return [
        ...literalText(node.consequent, numbersAreText),
        ...literalText(node.alternate, numbersAreText),
      ];
    case AST_NODE_TYPES.LogicalExpression:
      return [...literalText(node.left, numbersAreText), ...literalText(node.right, numbersAreText)];
    case AST_NODE_TYPES.BinaryExpression:
      // String concatenation ('Hello ' + name); numbers inside + are arithmetic, not text.
      return node.operator === '+'
        ? [...literalText(node.left, false), ...literalText(node.right, false)]
        : [];
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
      return literalText(node.expression, numbersAreText);
    default:
      return [];
  }
}

function attributeName(node: TSESTree.JSXAttribute): string {
  return node.name.type === AST_NODE_TYPES.JSXNamespacedName
    ? `${node.name.namespace.name}:${node.name.name.name}`
    : node.name.name;
}

export default createRule({
  name: 'no-jsx-literals',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hard-coded user-facing text in JSX text, literal children and user-visible attributes; use the ICU message catalogues',
    },
    messages: {
      jsxText:
        'Hard-coded text "{{text}}" in JSX: user-facing strings must come from the ICU message catalogues (BUILD-PROMPT.md §6.5).',
      attributeLiteral:
        'Hard-coded string in the user-visible attribute "{{attribute}}": use a message from the ICU catalogues (BUILD-PROMPT.md §6.5).',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXText(node) {
        if (LETTER_OR_DIGIT.test(node.value)) {
          context.report({ node, messageId: 'jsxText', data: { text: shown(node.value) } });
        }
      },
      JSXExpressionContainer(node) {
        const { parent, expression } = node;
        if (expression.type === AST_NODE_TYPES.JSXEmptyExpression) {
          return;
        }
        if (parent.type === AST_NODE_TYPES.JSXElement || parent.type === AST_NODE_TYPES.JSXFragment) {
          for (const piece of literalText(expression)) {
            if (LETTER_OR_DIGIT.test(piece.text)) {
              context.report({ node: piece.node, messageId: 'jsxText', data: { text: shown(piece.text) } });
            }
          }
        }
      },
      JSXAttribute(node) {
        const attribute = attributeName(node);
        if (!USER_VISIBLE_ATTRIBUTES.has(attribute) || node.value === null) {
          return;
        }
        const pieces =
          node.value.type === AST_NODE_TYPES.JSXExpressionContainer
            ? node.value.expression.type === AST_NODE_TYPES.JSXEmptyExpression
              ? []
              : literalText(node.value.expression)
            : literalText(node.value);
        for (const piece of pieces) {
          // Any visible character counts here, punctuation included: a screen reader announces it.
          if (piece.text.trim() !== '') {
            context.report({ node: piece.node, messageId: 'attributeLiteral', data: { attribute } });
          }
        }
      },
    };
  },
});
