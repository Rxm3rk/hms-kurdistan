/**
 * Every route declares whether it is clinical (docs/specs/modules/design-system.md §4; CTRL-0016-5).
 *
 * TanStack Router makes a route's `staticData` option required as soon as `StaticDataRouteOption` has a
 * required member, so a route without `staticData: { clinical: … }` fails type checking. The route-tree test
 * (ArchTest:banner-present-on-every-clinical-route) checks the same at run time, for routes built in ways the
 * types cannot see.
 */
import type { MessageKey } from '@hms/i18n';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * True for a route that shows patient data. A clinical route sits under the `_clinical` layout, which
     * renders the patient banner and requires a patient context; false for every other route.
     */
    readonly clinical: boolean;
    /** The page title's catalogue key; the deepest matched route that has one names the page. */
    readonly titleKey?: MessageKey;
  }
}
