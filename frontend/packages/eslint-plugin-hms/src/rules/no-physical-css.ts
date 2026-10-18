/**
 * hms/no-physical-css: physical CSS directions are banned in style objects (BUILD-PROMPT.md §6.5 "RTL by
 * construction", §6.8 item 6). The message names the logical replacement.
 *
 * What is checked:
 * - physical longhands (marginLeft, paddingRight, borderLeft*, borderRight*, the physical corner radii,
 *   scrollMargin/scrollPadding Left and Right, insetLeft/insetRight) as keys of any object literal, in
 *   camelCase, vendor-prefixed or CSS (kebab-case) spelling;
 * - `left` and `right` as keys of style-like objects only, because they are common non-style keys
 *   (for example a binary tree node); see isStyleLikePosition for what counts as style-like;
 * - the values 'left' and 'right' of textAlign, textAlignLast, float, clear and justify*;
 * - four-value box shorthands (margin, padding, inset, scrollMargin, scrollPadding, borderWidth,
 *   borderStyle, borderColor) whose right and left values differ, and border-radius shorthands whose
 *   corners are not mirror-symmetric;
 * - DOM style writes: `element.style.marginLeft = ...` and `element.style.setProperty('margin-left', ...)`.
 */
import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import {
  checkDeclaration,
  describeFinding,
  jsToCssPropertyName,
  normaliseCssPropertyName,
  PHYSICAL_CSS_MESSAGES,
  type NameForm,
  type PhysicalCssFinding,
} from '../physical-css.ts';
import { docsUrl } from './docs-url.ts';

const createRule = ESLintUtils.RuleCreator(docsUrl);

const STYLE_NAME = /^(?:style|styles|sx|css)$|(?:Style|Styles)$/;
const STYLE_TYPE_NAME = /^(?:CSSProperties|StyleProp)$|Style$/;
const MAX_CLIMB = 32;

function isStyleName(name: string | undefined): boolean {
  return name !== undefined && STYLE_NAME.test(name);
}

/** The static name of an object-literal key or member property, if it has one. */
function staticName(key: TSESTree.Node, computed: boolean): string | undefined {
  if (!computed && key.type === AST_NODE_TYPES.Identifier) {
    return key.name;
  }
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === 'string') {
    return key.value;
  }
  if (key.type === AST_NODE_TYPES.TemplateLiteral && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

function memberName(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    return staticName(node.property, node.computed);
  }
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  return undefined;
}

function typeName(node: TSESTree.EntityName): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  if (node.type === AST_NODE_TYPES.TSQualifiedName) {
    return node.right.name;
  }
  return undefined;
}

/** True for a type annotation that names a style type (CSSProperties, StyleProp<...>, ViewStyle and so on). */
function isStyleType(node: TSESTree.TypeNode | undefined): boolean {
  if (node === undefined) {
    return false;
  }
  switch (node.type) {
    case AST_NODE_TYPES.TSTypeReference: {
      const name = typeName(node.typeName);
      return name !== undefined && STYLE_TYPE_NAME.test(name);
    }
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType:
      return node.types.some(isStyleType);
    case AST_NODE_TYPES.TSArrayType:
      return isStyleType(node.elementType);
    default:
      return false;
  }
}

function hasStyleAnnotation(annotation: TSESTree.TSTypeAnnotation | undefined): boolean {
  return isStyleType(annotation?.typeAnnotation);
}

type FunctionNode =
  TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;

function enclosingFunction(node: TSESTree.Node): FunctionNode | undefined {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (
      current.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.FunctionExpression
    ) {
      return current;
    }
  }
  return undefined;
}

/** True when a function's result is used as a style: a style return type, a style name or a style position. */
function isStyleFunction(fn: FunctionNode, depth: number): boolean {
  if (hasStyleAnnotation(fn.returnType)) {
    return true;
  }
  if (fn.type === AST_NODE_TYPES.FunctionDeclaration) {
    return isStyleName(fn.id?.name);
  }
  return isStyleLikePosition(fn, depth + 1);
}

/** `StyleSheet.create(...)`, or `Object.assign(element.style, ...)` for the arguments after the target. */
function isStyleCall(call: TSESTree.CallExpression, argument: TSESTree.Node): boolean {
  const { callee } = call;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }
  const objectName = memberName(callee.object);
  const methodName = staticName(callee.property, callee.computed);
  if (objectName === 'StyleSheet' && methodName === 'create') {
    return true;
  }
  if (objectName === 'Object' && methodName === 'assign') {
    const [target] = call.arguments;
    return target !== undefined && target !== argument && isStyleName(memberName(target));
  }
  return false;
}

/**
 * True when the value of `node` is used as a style. Style-like positions are: a JSX attribute named style
 * (or ending in Style, as in React Native's contentContainerStyle); a property, variable or assignment target
 * named style, styles, sx, css or ending in Style/Styles; a value typed or asserted as a style type; an
 * argument of StyleSheet.create or Object.assign(element.style, ...); and anything nested in, spread into,
 * chosen by a conditional for, or returned by a function in one of those positions.
 */
function isStyleLikePosition(node: TSESTree.Node, depth = 0): boolean {
  const { parent } = node;
  if (parent === undefined || depth > MAX_CLIMB) {
    return false;
  }
  switch (parent.type) {
    case AST_NODE_TYPES.JSXExpressionContainer:
      return (
        parent.parent.type === AST_NODE_TYPES.JSXAttribute &&
        parent.parent.name.type === AST_NODE_TYPES.JSXIdentifier &&
        isStyleName(parent.parent.name.name)
      );
    case AST_NODE_TYPES.Property:
      if (parent.value !== node) {
        return false;
      }
      return (
        isStyleName(staticName(parent.key, parent.computed)) || isStyleLikePosition(parent.parent, depth + 1)
      );
    case AST_NODE_TYPES.VariableDeclarator:
      return (
        parent.init === node &&
        parent.id.type === AST_NODE_TYPES.Identifier &&
        (isStyleName(parent.id.name) || hasStyleAnnotation(parent.id.typeAnnotation))
      );
    case AST_NODE_TYPES.AssignmentExpression:
      return parent.right === node && isStyleName(memberName(parent.left));
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
      return isStyleType(parent.typeAnnotation) || isStyleLikePosition(parent, depth + 1);
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.LogicalExpression:
    case AST_NODE_TYPES.ArrayExpression:
    case AST_NODE_TYPES.SpreadElement:
    case AST_NODE_TYPES.ObjectExpression:
      return isStyleLikePosition(parent, depth + 1);
    case AST_NODE_TYPES.ConditionalExpression:
      return parent.test !== node && isStyleLikePosition(parent, depth + 1);
    case AST_NODE_TYPES.ArrowFunctionExpression:
      return parent.body === node && isStyleFunction(parent, depth);
    case AST_NODE_TYPES.ReturnStatement: {
      const fn = enclosingFunction(parent);
      return fn !== undefined && isStyleFunction(fn, depth);
    }
    case AST_NODE_TYPES.CallExpression: {
      if (parent.callee === node) {
        return false;
      }
      if (isStyleCall(parent, node)) {
        return true;
      }
      // A function argument whose result becomes the call's result, as in useMemo(() => ({ ... }), []).
      return (
        (node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
          node.type === AST_NODE_TYPES.FunctionExpression) &&
        isStyleLikePosition(parent, depth + 1)
      );
    }
    default:
      return false;
  }
}

/** True for `<something>.style`, the DOM CSSStyleDeclaration. */
function isDomStyleObject(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.MemberExpression && staticName(node.property, node.computed) === 'style'
  );
}

/** The string values an expression can statically take, with the node that holds each. */
function staticStrings(node: TSESTree.Node): { node: TSESTree.Node; value: string }[] {
  switch (node.type) {
    case AST_NODE_TYPES.Literal:
      return typeof node.value === 'string' ? [{ node, value: node.value }] : [];
    case AST_NODE_TYPES.TemplateLiteral: {
      const cooked = node.expressions.length === 0 ? node.quasis[0]?.value.cooked : undefined;
      return cooked === undefined || cooked === null ? [] : [{ node, value: cooked }];
    }
    case AST_NODE_TYPES.ConditionalExpression:
      return [...staticStrings(node.consequent), ...staticStrings(node.alternate)];
    case AST_NODE_TYPES.LogicalExpression:
      return [...staticStrings(node.left), ...staticStrings(node.right)];
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
      return staticStrings(node.expression);
    default:
      return [];
  }
}

export default createRule({
  name: 'no-physical-css',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow physical CSS directions (left, right, margin-left and similar) in style objects; use logical properties so layouts mirror in RTL locales',
    },
    messages: PHYSICAL_CSS_MESSAGES,
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    /**
     * Checks one declaration: `keyNode` holds the property name `writtenAs` (`cssName` is its CSS form;
     * replacements in messages use `form`) and `valueNode` the value, if known. `inStyleContext` says whether
     * the declaration is known to be a style, which `left` and `right` need before they are reported.
     */
    function checkStyleDeclaration(
      keyNode: TSESTree.Node,
      writtenAs: string,
      cssName: string,
      form: NameForm,
      valueNode: TSESTree.Node | undefined,
      inStyleContext: boolean | (() => boolean),
    ): void {
      const needsStyleContext = cssName === 'left' || cssName === 'right';
      if (needsStyleContext && !(typeof inStyleContext === 'function' ? inStyleContext() : inStyleContext)) {
        return;
      }
      const report = (node: TSESTree.Node, finding: PhysicalCssFinding): void => {
        const { messageId, data } = describeFinding(finding, form, writtenAs);
        context.report({ node, messageId, data });
      };
      for (const finding of checkDeclaration(cssName)) {
        report(keyNode, finding);
      }
      if (valueNode === undefined) {
        return;
      }
      for (const { node, value } of staticStrings(valueNode)) {
        for (const finding of checkDeclaration(cssName, value)) {
          if (finding.kind !== 'property') {
            report(node, finding);
          }
        }
      }
    }

    return {
      Property(node) {
        if (node.parent.type !== AST_NODE_TYPES.ObjectExpression || node.kind !== 'init' || node.method) {
          return;
        }
        const name = staticName(node.key, node.computed);
        if (name === undefined || name.startsWith('--')) {
          return;
        }
        const object = node.parent;
        checkStyleDeclaration(
          node.key,
          name,
          jsToCssPropertyName(name),
          formOf(name),
          node.shorthand ? undefined : node.value,
          () => isStyleLikePosition(object),
        );
      },
      AssignmentExpression(node) {
        // element.style.marginLeft = '4px'
        const target = node.left;
        if (target.type !== AST_NODE_TYPES.MemberExpression || !isDomStyleObject(target.object)) {
          return;
        }
        const name = staticName(target.property, target.computed);
        if (name !== undefined) {
          checkStyleDeclaration(
            target.property,
            name,
            jsToCssPropertyName(name),
            formOf(name),
            node.right,
            true,
          );
        }
      },
      CallExpression(node) {
        // element.style.setProperty('margin-left', '4px')
        const { callee } = node;
        if (
          callee.type !== AST_NODE_TYPES.MemberExpression ||
          staticName(callee.property, callee.computed) !== 'setProperty' ||
          !isDomStyleObject(callee.object)
        ) {
          return;
        }
        const [nameArgument, valueArgument] = node.arguments;
        if (nameArgument === undefined) {
          return;
        }
        // setProperty takes CSS names, so messages use CSS spelling.
        for (const { node: nameNode, value: name } of staticStrings(nameArgument)) {
          checkStyleDeclaration(nameNode, name, normaliseCssPropertyName(name), 'css', valueArgument, true);
        }
      },
    };
  },
});

/** Messages use the spelling of the key: CSS form for 'margin-left', JavaScript form for marginLeft. */
function formOf(name: string): NameForm {
  return name.includes('-') ? 'css' : 'js';
}
