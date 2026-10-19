/**
 * The role switcher's state: which synthetic staff member the demo is "signed in" as. Physician
 * (Dr. Shilan Kareem), nurse (Rawa Hassan), cashier (Dlshad Omer) or administrator (Hemin Aziz). Kept in
 * React context and remembered on the device (localStorage) across reloads.
 *
 *   const { roleId, user, setRole } = useRole();
 *   if (roleId === 'nurse') { … }
 *
 * Changing the role changes what screens emphasise; it does not change the window's patient context or
 * the simulated sign-in.
 */
import { createContext, use, useState, type ReactNode } from 'react';
import { getStaffById } from './staff-lookup.ts';
import { DEMO_USERS } from '../data/organisation.ts';
import type { RoleId, StaffMember } from '../data/types.ts';

export const ROLE_IDS: readonly RoleId[] = ['physician', 'nurse', 'cashier', 'admin'];

const STORAGE_KEY = 'hms-proto.role';

export interface RoleContextValue {
  readonly roleId: RoleId;
  /** The staff member of the role. */
  readonly user: StaffMember;
  readonly setRole: (roleId: RoleId) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function isRoleId(value: unknown): value is RoleId {
  return typeof value === 'string' && (ROLE_IDS as readonly string[]).includes(value);
}

function storedRole(): RoleId {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isRoleId(value) ? value : 'physician';
  } catch {
    return 'physician';
  }
}

export function RoleProvider({ children }: { readonly children?: ReactNode }): ReactNode {
  const [roleId, setRoleId] = useState<RoleId>(storedRole);
  const setRole = (next: RoleId): void => {
    setRoleId(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies in this window.
    }
  };
  return <RoleContext value={{ roleId, user: getStaffById(DEMO_USERS[roleId]), setRole }}>{children}</RoleContext>;
}

/** The current role and its staff member. Throws outside the prototype frame. */
export function useRole(): RoleContextValue {
  const value = use(RoleContext);
  if (value === null) {
    throw new Error('useRole: render inside the prototype frame (RoleProvider)');
  }
  return value;
}
