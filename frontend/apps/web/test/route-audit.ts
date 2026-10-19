/**
 * Walks a route tree and reports what ArchTest:banner-present-on-every-clinical-route forbids
 * (docs/specs/modules/design-system.md §4, §9; CTRL-0016-5):
 *
 * - `no-clinical-flag`: a route whose `staticData.clinical` is not a boolean;
 * - `clinical-outside-layout`: a clinical route that is neither the `_clinical` layout nor inside it;
 * - `not-clinical-inside-layout`: a route inside the `_clinical` layout that says it is not clinical;
 * - `layout-without-banner`: a `_clinical` layout whose component is not the app's ClinicalLayout (the one
 *   that renders the banner);
 * - `demo-route`: in a production tree, a route whose path starts with `/demo`.
 *
 * It reads the routes as TanStack Router holds them (each route's options and children), so a route added in
 * a way the types cannot see is still found.
 */
import type { AnyRoute } from '@tanstack/react-router';
import { CLINICAL_LAYOUT_ID, ClinicalLayout } from '../src/routing/clinical-layout.tsx';

export type RouteProblem =
  | 'no-clinical-flag'
  | 'clinical-outside-layout'
  | 'not-clinical-inside-layout'
  | 'layout-without-banner'
  | 'demo-route';

export interface RouteFinding {
  readonly route: string;
  readonly problem: RouteProblem;
}

/** A route with the routes above it, outermost first. */
export interface WalkedRoute {
  readonly route: AnyRoute;
  readonly ancestors: readonly AnyRoute[];
}

function childrenOf(route: AnyRoute): AnyRoute[] {
  const children: unknown = route.children;
  if (Array.isArray(children)) {
    return children as AnyRoute[];
  }
  if (typeof children === 'object' && children !== null) {
    return Object.values(children) as AnyRoute[];
  }
  return [];
}

/** Every route of the tree, the root included, depth first. */
export function walkRoutes(root: AnyRoute): WalkedRoute[] {
  const walked: WalkedRoute[] = [];
  const visit = (route: AnyRoute, ancestors: readonly AnyRoute[]): void => {
    walked.push({ route, ancestors });
    for (const child of childrenOf(route)) {
      visit(child, [...ancestors, route]);
    }
  };
  visit(root, []);
  return walked;
}

/** The route's own id option or path option, as written; the root has neither. */
function ownName(route: AnyRoute): string {
  const options = route.options as { readonly id?: unknown; readonly path?: unknown } | undefined;
  if (typeof options?.id === 'string') {
    return options.id;
  }
  if (typeof options?.path === 'string') {
    return options.path;
  }
  return '__root__';
}

/** The route's path from the root, joined from the path options of it and its ancestors. */
export function fullPathOf({ route, ancestors }: WalkedRoute): string {
  const parts = [...ancestors, route]
    .map((entry) => (entry.options as { readonly path?: unknown } | undefined)?.path)
    .filter((path): path is string => typeof path === 'string')
    .map((path) => path.replace(/^\/+|\/+$/g, ''))
    .filter((path) => path.length > 0);
  return `/${parts.join('/')}`;
}

function clinicalFlag(route: AnyRoute): unknown {
  const options = route.options as { readonly staticData?: { readonly clinical?: unknown } } | undefined;
  return options?.staticData?.clinical;
}

function isClinicalLayout(route: AnyRoute): boolean {
  return ownName(route) === CLINICAL_LAYOUT_ID;
}

export function auditRouteTree(
  root: AnyRoute,
  { production }: { readonly production: boolean },
): RouteFinding[] {
  const findings: RouteFinding[] = [];
  for (const walked of walkRoutes(root)) {
    const { route, ancestors } = walked;
    const name = `${fullPathOf(walked)} (${ownName(route)})`;
    const flag = clinicalFlag(route);
    if (typeof flag !== 'boolean') {
      findings.push({ route: name, problem: 'no-clinical-flag' });
    }
    const insideLayout = isClinicalLayout(route) || ancestors.some(isClinicalLayout);
    if (flag === true && !insideLayout) {
      findings.push({ route: name, problem: 'clinical-outside-layout' });
    }
    if (flag === false && insideLayout) {
      findings.push({ route: name, problem: 'not-clinical-inside-layout' });
    }
    if (
      isClinicalLayout(route) &&
      (route.options as { readonly component?: unknown }).component !== ClinicalLayout
    ) {
      findings.push({ route: name, problem: 'layout-without-banner' });
    }
    if (production && /^\/demo(?:\/|$)/.test(fullPathOf(walked))) {
      findings.push({ route: name, problem: 'demo-route' });
    }
  }
  return findings;
}
