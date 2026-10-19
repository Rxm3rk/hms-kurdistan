/**
 * `@hms/design-system/testing`: what tests need and an application must never use (docs/specs/modules/
 * design-system.md §2.8). A test creates its own modal stack guard, in either refusal mode, and renders it
 * with `ModalStackTestProvider`. Both throw in production builds, so a second guard can never ship: in a
 * running application every modal and every HAL capture goes through the window's one guard.
 */
import type { ReactNode } from 'react';
import {
  createModalStackGuard as createGuard,
  type ModalRefusalMode,
  type ModalStackGuard,
} from './modal/modal-stack.ts';
import { ModalStackGuardProvider } from './modal/modal-stack-provider.tsx';

function refuseInProduction(what: string): void {
  if (import.meta.env.PROD) {
    throw new Error(
      `${what} is for tests only and fails in production builds (one modal stack guard per window)`,
    );
  }
}

/** A guard of its own for one test. The default mode is the build's ('throw' under Vitest). */
export function createModalStackGuard(refusalMode?: ModalRefusalMode): ModalStackGuard {
  refuseInProduction('createModalStackGuard');
  return createGuard(refusalMode);
}

export interface ModalStackTestProviderProps {
  readonly guard: ModalStackGuard;
  readonly children?: ReactNode;
}

/** `ModalStackProvider` with the test's own guard. Inside a provider of another guard it throws. */
export function ModalStackTestProvider({ guard, children }: ModalStackTestProviderProps): ReactNode {
  refuseInProduction('ModalStackTestProvider');
  return <ModalStackGuardProvider guard={guard}>{children}</ModalStackGuardProvider>;
}
