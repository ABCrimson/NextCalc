import { describe, expect, it } from 'vitest';
import { LEVEL_ICON_FILES } from '@/lib/level-icons';
import { AVATAR_ICON_PATHS, AVATAR_ICONS, isAvatarIconPath } from './avatar-icons';

describe('avatar icon whitelist', () => {
  it('lists exactly the 103 files the icon generator writes, in order', () => {
    expect(AVATAR_ICONS).toHaveLength(103);
    expect(AVATAR_ICON_PATHS).toEqual(LEVEL_ICON_FILES.map((f) => `/icons/levels/${f.file}`));
  });

  it('labels levels by number and the Architect variants by name', () => {
    expect(AVATAR_ICONS[41]).toEqual({
      path: '/icons/levels/level-042.svg',
      level: 42,
      label: '42',
    });
    expect(AVATAR_ICONS.slice(100).map((i) => i.label)).toEqual([
      'Prismatic Crown',
      'Cosmic Nexus',
      'Phoenix Crystal',
    ]);
  });

  it('is an exact-match whitelist', () => {
    expect(isAvatarIconPath('/icons/levels/level-001.svg')).toBe(true);
    expect(isAvatarIconPath('/icons/levels/level-101-cosmic-nexus.svg')).toBe(true);
    expect(isAvatarIconPath('/icons/levels/level-1.svg')).toBe(false);
    expect(isAvatarIconPath('icons/levels/level-001.svg')).toBe(false);
    expect(isAvatarIconPath('/icons/levels/level-001.svg?x')).toBe(false);
  });
});
