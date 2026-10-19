/** Staff lookup for the shell (the data module's getStaff, without importing the whole data index). */
import { STAFF } from '../data/organisation.ts';
import type { StaffMember } from '../data/types.ts';

export function getStaffById(staffId: string): StaffMember {
  const member = STAFF.find((candidate) => candidate.id === staffId);
  if (member === undefined) {
    throw new Error(`Unknown synthetic staff member ${staffId}`);
  }
  return member;
}
