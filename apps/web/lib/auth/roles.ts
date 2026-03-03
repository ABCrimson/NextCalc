/**
 * Shared Role Hierarchy
 *
 * Single source of truth for role ranking used by authorization checks.
 */

import type { UserRole } from '@nextcalc/database';

export const ROLE_HIERARCHY = {
  USER: 1,
  MODERATOR: 2,
  ADMIN: 3,
} as const satisfies Record<UserRole, number>;
