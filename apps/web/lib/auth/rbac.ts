/**
 * Role-Based Access Control (RBAC)
 *
 * Defines permissions for different user roles and provides
 * helper functions to check permissions.
 */

import type { UserRole } from '@nextcalc/database';

/**
 * Permission definitions
 *
 * Each permission maps to an array of roles that have access.
 */
export const PERMISSIONS = {
  // Worksheet permissions
  'worksheet:create': ['USER', 'MODERATOR', 'ADMIN'],
  'worksheet:view:own': ['USER', 'MODERATOR', 'ADMIN'],
  'worksheet:view:public': ['USER', 'MODERATOR', 'ADMIN'],
  'worksheet:edit:own': ['USER', 'MODERATOR', 'ADMIN'],
  'worksheet:delete:own': ['USER', 'MODERATOR', 'ADMIN'],
  'worksheet:delete:any': ['MODERATOR', 'ADMIN'],

  // Folder permissions
  'folder:create': ['USER', 'MODERATOR', 'ADMIN'],
  'folder:edit:own': ['USER', 'MODERATOR', 'ADMIN'],
  'folder:delete:own': ['USER', 'MODERATOR', 'ADMIN'],

  // Forum permissions
  'forum:post:create': ['USER', 'MODERATOR', 'ADMIN'],
  'forum:post:edit:own': ['USER', 'MODERATOR', 'ADMIN'],
  'forum:post:delete:own': ['USER', 'MODERATOR', 'ADMIN'],
  'forum:post:delete:any': ['MODERATOR', 'ADMIN'],
  'forum:post:pin': ['MODERATOR', 'ADMIN'],
  'forum:post:close': ['MODERATOR', 'ADMIN'],

  // Comment permissions
  'comment:create': ['USER', 'MODERATOR', 'ADMIN'],
  'comment:edit:own': ['USER', 'MODERATOR', 'ADMIN'],
  'comment:delete:own': ['USER', 'MODERATOR', 'ADMIN'],
  'comment:delete:any': ['MODERATOR', 'ADMIN'],

  // Upvote permissions
  'upvote:create': ['USER', 'MODERATOR', 'ADMIN'],
  'upvote:delete': ['USER', 'MODERATOR', 'ADMIN'],

  // User management
  'user:ban': ['ADMIN'],
  'user:unban': ['ADMIN'],
  'user:changeRole': ['ADMIN'],
  'user:viewAuditLog': ['ADMIN'],

  // Analytics
  'analytics:view': ['ADMIN'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Check if a role has a specific permission
 *
 * @param role - User role to check
 * @param permission - Permission to check
 * @returns True if role has permission
 */
export function can(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly UserRole[];
  return allowedRoles.includes(role);
}

/**
 * Check if user can perform action on their own resource
 *
 * @param userRole - User's role
 * @param userId - User's ID
 * @param resourceOwnerId - Resource owner's ID
 * @param ownPermission - Permission for own resources
 * @param anyPermission - Permission for any resources
 * @returns True if user can perform action
 */
export function canAccess(
  userRole: UserRole,
  userId: string,
  resourceOwnerId: string,
  ownPermission: Permission,
  anyPermission: Permission,
): boolean {
  // Check if user owns the resource
  const isOwner = userId === resourceOwnerId;

  // Check permissions
  if (isOwner && can(userRole, ownPermission)) {
    return true;
  }

  if (can(userRole, anyPermission)) {
    return true;
  }

  return false;
}

/**
 * Assert that user has permission
 *
 * @param role - User role to check
 * @param permission - Required permission
 * @throws Error if user doesn't have permission
 */
export function assertPermission(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden - ${permission} permission required for role ${role}`);
  }
}

/**
 * Get all permissions for a role
 *
 * @param role - User role
 * @returns Array of permissions
 */
export function getPermissions(role: UserRole): Permission[] {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => (roles as readonly UserRole[]).includes(role))
    .map(([permission]) => permission as Permission);
}
