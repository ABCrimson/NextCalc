import { describe, expect, it } from 'vitest';
import {
  ARCHITECT_LEVEL,
  getLevelTier,
  resolveDisplayLevel,
} from '@/components/profile/level-utils';

describe('resolveDisplayLevel', () => {
  it('renders the ADMIN owner as the Architect level regardless of progress', () => {
    expect(resolveDisplayLevel(undefined, 'ADMIN')).toBe(ARCHITECT_LEVEL);
    expect(resolveDisplayLevel(null, 'ADMIN')).toBe(ARCHITECT_LEVEL);
    expect(resolveDisplayLevel(1, 'ADMIN')).toBe(ARCHITECT_LEVEL);
    expect(resolveDisplayLevel(57, 'ADMIN')).toBe(ARCHITECT_LEVEL);
  });

  it('shows the earned progress level for non-admins', () => {
    expect(resolveDisplayLevel(42, 'USER')).toBe(42);
    expect(resolveDisplayLevel(42, 'MODERATOR')).toBe(42);
    expect(resolveDisplayLevel(100, 'USER')).toBe(100);
  });

  it('defaults to level 1 with no progress row and no admin role', () => {
    expect(resolveDisplayLevel(null, 'USER')).toBe(1);
    expect(resolveDisplayLevel(undefined, 'MODERATOR')).toBe(1);
    expect(resolveDisplayLevel(undefined, undefined)).toBe(1);
    expect(resolveDisplayLevel(null, null)).toBe(1);
  });

  it('never grants Architect to non-admin roles', () => {
    expect(resolveDisplayLevel(101, 'USER')).toBe(101); // hypothetical data, not role-derived
    expect(resolveDisplayLevel(null, 'MODERATOR')).not.toBe(ARCHITECT_LEVEL);
    expect(resolveDisplayLevel(null, 'admin')).toBe(1); // exact-match role check
  });
});

describe('Architect tier mapping', () => {
  it('maps the Architect level to the admin-only tier', () => {
    const tier = getLevelTier(ARCHITECT_LEVEL);
    expect(tier.name).toBe('Architect');
    expect(tier.minLevel).toBe(101);
    expect(tier.maxLevel).toBe(101);
  });

  it('keeps level 100 in the Transcendent tier', () => {
    expect(getLevelTier(100).name).toBe('Transcendent');
  });
});
