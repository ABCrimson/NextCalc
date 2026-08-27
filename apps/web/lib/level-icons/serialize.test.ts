import { describe, expect, it } from 'vitest';
import { el, serializeSvg } from './serialize';

describe('serializeSvg', () => {
  it('serializes a node tree to compact SVG markup with kebab-case presentation attributes', () => {
    const svg = el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 64 64' }, [
      el('polygon', { points: '0,0 1,1', fill: 'oklch(0.5 0.1 30)', strokeWidth: 1.5 }),
    ]);
    expect(serializeSvg(svg)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><polygon points="0,0 1,1" fill="oklch(0.5 0.1 30)" stroke-width="1.5"/></svg>',
    );
  });

  it('preserves camelCase for SVG attributes that are camelCase in the spec', () => {
    const svg = el('svg', {}, [
      el('radialGradient', { id: 'g', gradientUnits: 'userSpaceOnUse' }, [
        el('stop', { offset: '0%', stopColor: 'oklch(1 0 0)', stopOpacity: 0.5 }),
      ]),
      el('animate', { attributeName: 'opacity', repeatCount: 'indefinite', dur: '2s' }),
      el('feGaussianBlur', { stdDeviation: 2 }),
      el('rect', { clipPath: 'url(#c)', preserveAspectRatio: 'none' }),
    ]);
    const out = serializeSvg(svg);
    expect(out).toContain('<radialGradient id="g" gradientUnits="userSpaceOnUse">');
    expect(out).toContain('<stop offset="0%" stop-color="oklch(1 0 0)" stop-opacity="0.5"/>');
    expect(out).toContain('<animate attributeName="opacity" repeatCount="indefinite" dur="2s"/>');
    expect(out).toContain('<feGaussianBlur stdDeviation="2"/>');
    expect(out).toContain('<rect clip-path="url(#c)" preserveAspectRatio="none"/>');
  });

  it('emits text children (e.g. <style>) as escaped text content', () => {
    const svg = el('svg', {}, [el('style', {}, '@keyframes a { to { opacity: 1 } } .x > .y {}')]);
    expect(serializeSvg(svg)).toBe(
      '<svg><style>@keyframes a { to { opacity: 1 } } .x &gt; .y {}</style></svg>',
    );
  });

  it('escapes attribute values and drops undefined attributes', () => {
    const svg = el('svg', {}, [el('text', { 'aria-label': 'a "b" & <c>', opacity: undefined })]);
    expect(serializeSvg(svg)).toBe(
      '<svg><text aria-label="a &quot;b&quot; &amp; &lt;c&gt;"/></svg>',
    );
  });

  it('formats numbers compactly (max 2 decimals, no trailing zeros, no negative zero)', () => {
    const svg = el('svg', {}, [el('circle', { cx: 1 / 3, cy: 2.5, r: -0.0001, opacity: 1.0 })]);
    expect(serializeSvg(svg)).toBe('<svg><circle cx="0.33" cy="2.5" r="0" opacity="1"/></svg>');
  });
});
