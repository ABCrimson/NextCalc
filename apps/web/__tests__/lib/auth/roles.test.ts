import { describe, expect, it } from 'vitest';
import { ROLE_HIERARCHY } from '@/lib/auth/roles';

describe('ROLE_HIERARCHY', () => {
  it('defines USER as lowest rank', () => {
    expect(ROLE_HIERARCHY.USER).toBe(1);
  });

  it('defines MODERATOR above USER', () => {
    expect(ROLE_HIERARCHY.MODERATOR).toBeGreaterThan(ROLE_HIERARCHY.USER);
  });

  it('defines ADMIN as highest rank', () => {
    expect(ROLE_HIERARCHY.ADMIN).toBeGreaterThan(ROLE_HIERARCHY.MODERATOR);
    expect(ROLE_HIERARCHY.ADMIN).toBe(3);
  });

  it('has exactly 3 roles', () => {
    expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(3);
  });

  it('all values are unique', () => {
    const values = Object.values(ROLE_HIERARCHY);
    expect(new Set(values).size).toBe(values.length);
  });
});
