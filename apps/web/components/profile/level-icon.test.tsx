import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { levelIconSvg } from '@/lib/level-icons';
import { LevelIcon } from './level-icon';

describe('LevelIcon', () => {
  it('renders an accessible img role with the level in the label', () => {
    const { getByRole } = render(<LevelIcon level={42} />);
    const img = getByRole('img', { name: 'Level 42 icon' });
    expect(img.querySelector('svg')).not.toBeNull();
  });

  it('renders at the requested size with the shared 64×64 viewBox', () => {
    const { container } = render(<LevelIcon level={7} size={28} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('28');
    expect(svg?.getAttribute('height')).toBe('28');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 64 64');
  });

  it('renders byte-for-byte the scene the static files are generated from (only the id prefix differs)', () => {
    for (const level of [1, 35, 66, 95]) {
      const markup = renderToStaticMarkup(<LevelIcon level={level} size={64} />);
      const live = markup
        .slice(markup.indexOf('<svg'), markup.lastIndexOf('</svg>') + 6)
        .replace(' aria-hidden="true"', '');
      const prefix = /id="(li\d+-[A-Za-z0-9_-]*-)/.exec(live)?.[1] ?? '';
      expect(prefix).not.toBe('');
      // React's static renderer writes `<x></x>` where the serializer writes `<x/>`.
      const file = levelIconSvg(level, { idPrefix: prefix }).replace(
        /<([A-Za-z]+)([^<>]*?)\/>/g,
        '<$1$2></$1>',
      );
      expect(live).toBe(file);
    }
  });

  it('gives every instance its own id prefix — two icons of the SAME level never share ids', () => {
    const { container } = render(
      <>
        <LevelIcon level={42} size={28} />
        <LevelIcon level={42} size={112} />
        <LevelIcon level={95} />
        <LevelIcon level={95} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map((n) => n.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    // Animated tiers reference their ids from <style>; those selectors must be per-instance too.
    const styles = Array.from(container.querySelectorAll('style')).map((s) => s.textContent ?? '');
    expect(styles).toHaveLength(2);
    expect(styles[0]).not.toBe(styles[1]);
  });

  it('clamps out-of-range levels and exposes the clamped level', () => {
    const { getByRole } = render(<LevelIcon level={500} />);
    expect(getByRole('img', { name: 'Level 101 icon' })).toBeTruthy();
  });

  it('renders the requested level-101 variant', () => {
    const a = render(<LevelIcon level={101} variant101="cosmic-nexus" />).container.innerHTML;
    const b = render(<LevelIcon level={101} variant101="phoenix-crystal" />).container.innerHTML;
    expect(a).not.toBe(b);
  });

  it('applies className to the wrapper', () => {
    const { getByRole } = render(<LevelIcon level={3} className="shrink-0" />);
    expect(getByRole('img').className).toContain('shrink-0');
  });
});
