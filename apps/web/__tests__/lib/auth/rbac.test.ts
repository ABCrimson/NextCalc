import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  assertPermission,
  can,
  canAccess,
  getPermissions,
  type Permission,
} from '@/lib/auth/rbac';

describe('RBAC', () => {
  describe('PERMISSIONS', () => {
    it('has worksheet permissions', () => {
      expect(PERMISSIONS['worksheet:create']).toBeDefined();
      expect(PERMISSIONS['worksheet:delete:any']).toBeDefined();
    });

    it('has forum permissions', () => {
      expect(PERMISSIONS['forum:post:create']).toBeDefined();
      expect(PERMISSIONS['forum:post:pin']).toBeDefined();
    });

    it('has admin-only permissions', () => {
      expect(PERMISSIONS['user:ban']).toEqual(['ADMIN']);
      expect(PERMISSIONS['user:changeRole']).toEqual(['ADMIN']);
      expect(PERMISSIONS['analytics:view']).toEqual(['ADMIN']);
    });

    it('grants all users basic permissions', () => {
      expect(PERMISSIONS['worksheet:create']).toContain('USER');
      expect(PERMISSIONS['forum:post:create']).toContain('USER');
      expect(PERMISSIONS['comment:create']).toContain('USER');
      expect(PERMISSIONS['upvote:create']).toContain('USER');
    });

    it('grants moderators moderation permissions', () => {
      expect(PERMISSIONS['forum:post:delete:any']).toContain('MODERATOR');
      expect(PERMISSIONS['comment:delete:any']).toContain('MODERATOR');
      expect(PERMISSIONS['forum:post:pin']).toContain('MODERATOR');
      expect(PERMISSIONS['forum:post:close']).toContain('MODERATOR');
    });
  });

  describe('can', () => {
    it('allows USER to create worksheets', () => {
      expect(can('USER', 'worksheet:create')).toBe(true);
    });

    it('allows USER to create forum posts', () => {
      expect(can('USER', 'forum:post:create')).toBe(true);
    });

    it('denies USER admin permissions', () => {
      expect(can('USER', 'user:ban')).toBe(false);
      expect(can('USER', 'analytics:view')).toBe(false);
    });

    it('denies USER moderation permissions', () => {
      expect(can('USER', 'forum:post:delete:any')).toBe(false);
      expect(can('USER', 'worksheet:delete:any')).toBe(false);
    });

    it('allows MODERATOR to delete any posts', () => {
      expect(can('MODERATOR', 'forum:post:delete:any')).toBe(true);
      expect(can('MODERATOR', 'comment:delete:any')).toBe(true);
    });

    it('denies MODERATOR admin-only permissions', () => {
      expect(can('MODERATOR', 'user:ban')).toBe(false);
      expect(can('MODERATOR', 'analytics:view')).toBe(false);
    });

    it('allows ADMIN all permissions', () => {
      for (const permission of Object.keys(PERMISSIONS) as Permission[]) {
        expect(can('ADMIN', permission)).toBe(true);
      }
    });
  });

  describe('canAccess', () => {
    it('allows owner with own permission', () => {
      expect(
        canAccess('USER', 'user-1', 'user-1', 'worksheet:delete:own', 'worksheet:delete:any'),
      ).toBe(true);
    });

    it('denies non-owner with only own permission', () => {
      expect(
        canAccess('USER', 'user-1', 'user-2', 'worksheet:delete:own', 'worksheet:delete:any'),
      ).toBe(false);
    });

    it('allows moderator to access any resource via any permission', () => {
      expect(
        canAccess(
          'MODERATOR',
          'mod-1',
          'user-2',
          'forum:post:delete:own',
          'forum:post:delete:any',
        ),
      ).toBe(true);
    });

    it('allows admin to access any resource', () => {
      expect(
        canAccess('ADMIN', 'admin-1', 'user-2', 'worksheet:delete:own', 'worksheet:delete:any'),
      ).toBe(true);
    });
  });

  describe('assertPermission', () => {
    it('does not throw for allowed permission', () => {
      expect(() => assertPermission('USER', 'worksheet:create')).not.toThrow();
    });

    it('throws for denied permission', () => {
      expect(() => assertPermission('USER', 'user:ban')).toThrow('Forbidden');
    });

    it('includes permission name in error', () => {
      expect(() => assertPermission('USER', 'analytics:view')).toThrow('analytics:view');
    });

    it('includes role in error', () => {
      expect(() => assertPermission('MODERATOR', 'user:ban')).toThrow('MODERATOR');
    });
  });

  describe('getPermissions', () => {
    it('returns permissions for USER', () => {
      const perms = getPermissions('USER');
      expect(perms).toContain('worksheet:create');
      expect(perms).toContain('forum:post:create');
      expect(perms).not.toContain('user:ban');
    });

    it('returns more permissions for MODERATOR than USER', () => {
      const userPerms = getPermissions('USER');
      const modPerms = getPermissions('MODERATOR');
      expect(modPerms.length).toBeGreaterThan(userPerms.length);
    });

    it('returns all permissions for ADMIN', () => {
      const adminPerms = getPermissions('ADMIN');
      expect(adminPerms.length).toBe(Object.keys(PERMISSIONS).length);
    });

    it('includes moderation permissions for MODERATOR', () => {
      const perms = getPermissions('MODERATOR');
      expect(perms).toContain('forum:post:delete:any');
      expect(perms).toContain('comment:delete:any');
      expect(perms).toContain('forum:post:pin');
    });
  });
});
