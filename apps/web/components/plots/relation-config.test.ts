/**
 * Unit tests for the RelationDefinition[] -> Plot2DRelationConfig pipeline.
 * Kept renderer-free so the parse/compile logic is verified in isolation.
 */

import { describe, expect, it } from 'vitest';
import type { RelationDefinition } from './RelationInput';
import { buildRelationConfig, buildRelationEntries } from './relation-config';

const VIEWPORT = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

function makeRelation(overrides: Partial<RelationDefinition> = {}): RelationDefinition {
  return {
    id: 'r1',
    expression: 'x^2 + y^2 = 25',
    label: 'R1',
    color: '#06b6d4',
    isValid: true,
    ...overrides,
  };
}

describe('buildRelationEntries', () => {
  it('produces one layer for a valid single relation', () => {
    const entries = buildRelationEntries([makeRelation()]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.op).toBe('=');
    expect(typeof entries[0]?.field).toBe('function');
    // F(x,y) = x^2 + y^2 - 25 -> zero on the circle, e.g. (5, 0)
    expect(entries[0]?.field(5, 0)).toBeCloseTo(0, 6);
    expect(entries[0]?.field(0, 0)).toBeCloseTo(-25, 6);
  });

  it('produces one layer per entry for a system of 2 relations (separate mode)', () => {
    const relations = [
      makeRelation({ id: 'a', expression: 'x^2 + y^2 < 25' }),
      makeRelation({ id: 'b', expression: 'y > 0', label: 'R2', color: '#a855f7' }),
    ];

    const entries = buildRelationEntries(relations);

    expect(entries).toHaveLength(2);
    expect(entries[0]?.op).toBe('<');
    expect(entries[1]?.op).toBe('>');
    // Ungrouped (each relation shades its own separate region)
    expect(entries[0]?.group).toBeUndefined();
    expect(entries[1]?.group).toBeUndefined();
  });

  it('groups a chained comparison into a shared band', () => {
    const entries = buildRelationEntries([makeRelation({ expression: '1 < x < 4' })]);

    expect(entries).toHaveLength(2);
    expect(entries[0]?.op).toBe('<');
    expect(entries[1]?.op).toBe('<');
    expect(entries[0]?.group).toBe(0);
    expect(entries[1]?.group).toBe(0);
  });

  it('skips invalid and empty entries without throwing', () => {
    const relations = [
      makeRelation({ id: 'valid', expression: 'y = x' }),
      makeRelation({ id: 'invalid', expression: 'not a relation', isValid: false }),
      makeRelation({ id: 'empty', expression: '', isValid: false }),
    ];

    const entries = buildRelationEntries(relations);

    expect(entries).toHaveLength(1);
  });

  it('defensively skips an entry marked valid whose expression no longer parses', () => {
    // isValid: true but a malformed expression — buildRelationEntries must not throw.
    const relations = [makeRelation({ expression: 'x^2 +', isValid: true })];

    expect(() => buildRelationEntries(relations)).not.toThrow();
    expect(buildRelationEntries(relations)).toHaveLength(0);
  });

  it('binds slider/parameter values into the compiled field', () => {
    const entries = buildRelationEntries([makeRelation({ expression: 'y = a * x' })], { a: 2 });

    expect(entries).toHaveLength(1);
    // compileRelationField diffs lhs - rhs, i.e. F(x,y) = y - a*x; at a=2:
    // F(3, 6) = 6 - 2*3 = 0 (on the line), F(3, 0) = 0 - 2*3 = -6 (off it).
    expect(entries[0]?.field(3, 6)).toBeCloseTo(0, 6);
    expect(entries[0]?.field(3, 0)).toBeCloseTo(-6, 6);
  });

  it('applies per-entry color to line and fill style', () => {
    const entries = buildRelationEntries([makeRelation({ color: '#ff00ff' })]);

    expect(entries[0]?.style?.line?.color).toBe('#ff00ff');
    expect(entries[0]?.style?.fill?.color).toBe('#ff00ff');
  });
});

describe('buildRelationConfig', () => {
  it('builds a complete 2d-relation PlotConfig', () => {
    const config = buildRelationConfig([makeRelation()], { viewport: VIEWPORT });

    expect(config.type).toBe('2d-relation');
    expect(config.viewport).toEqual(VIEWPORT);
    expect(config.relations).toHaveLength(1);
  });

  it('renders an empty relations array (never throws) when nothing is valid yet', () => {
    const config = buildRelationConfig([makeRelation({ expression: '', isValid: false })], {
      viewport: VIEWPORT,
    });

    expect(config.relations).toEqual([]);
  });

  it('passes through optional title/axis/resolution options', () => {
    const xAxis = {
      label: 'x',
      min: -10,
      max: 10,
      scale: 'linear' as const,
      grid: { enabled: true, majorStep: 2, color: '#000', opacity: 0.5 },
      ticks: { enabled: true, format: (v: number) => String(v) },
    };
    const config = buildRelationConfig([makeRelation()], {
      viewport: VIEWPORT,
      title: 'My Relations',
      resolution: { x: 128, y: 128 },
      xAxis,
      yAxis: xAxis,
    });

    expect(config.title).toBe('My Relations');
    expect(config.resolution).toEqual({ x: 128, y: 128 });
    expect(config.xAxis).toBe(xAxis);
    expect(config.yAxis).toBe(xAxis);
  });
});
