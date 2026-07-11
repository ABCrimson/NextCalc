/**
 * Builds a {@link Plot2DRelationConfig} from a list of user-entered
 * {@link RelationDefinition}s.
 *
 * Kept separate from RelationInput/the plot page so the parsing → compiled
 * scalar-field pipeline is unit-testable without rendering React.
 * @module components/plots/relation-config
 */

import { compileRelationField, parseRelationSystem } from '@nextcalc/math-engine';
import type {
  AxisConfig,
  Plot2DRelationConfig,
  Plot2DRelationEntry,
  Viewport,
} from '@nextcalc/plot-engine';
import type { RelationDefinition } from './RelationInput';

export interface BuildRelationConfigOptions {
  viewport: Omit<Viewport, 'zMin' | 'zMax'>;
  resolution?: { x: number; y: number };
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  title?: string;
  /** Fixed slider/parameter values (e.g. `a`, `k`) bound into each field closure. */
  sliderValues?: Record<string, number>;
}

/**
 * Converts valid relation definitions into {@link Plot2DRelationEntry} layers.
 * Invalid/empty entries are silently skipped (their errors are already
 * surfaced inline by {@link RelationInput}). Chained comparisons (a single
 * expression that decomposes into 2+ {@link RelationalNode}s, e.g.
 * `1 < x < 4`) share a `group` so the renderer intersects them into one band
 * instead of shading each half-plane separately.
 */
export function buildRelationEntries(
  relations: RelationDefinition[],
  sliderValues?: Record<string, number>,
): Plot2DRelationEntry[] {
  const entries: Plot2DRelationEntry[] = [];
  let nextGroup = 0;

  for (const rel of relations) {
    if (!rel.isValid || !rel.expression.trim()) continue;

    let nodes: ReturnType<typeof parseRelationSystem>;
    try {
      nodes = parseRelationSystem(rel.expression);
    } catch {
      // Already surfaced as an inline validation error; skip defensively.
      continue;
    }

    const group = nodes.length > 1 ? nextGroup++ : undefined;

    for (const node of nodes) {
      entries.push({
        field: compileRelationField(node, sliderValues),
        op: node.op,
        label: rel.label,
        ...(group !== undefined ? { group } : {}),
        style: {
          line: { width: 2, color: rel.color },
          fill: { color: rel.color, opacity: 0.18 },
        },
      });
    }
  }

  return entries;
}

/** Builds a full {@link Plot2DRelationConfig} ready to hand to `<Plot2D />`. */
export function buildRelationConfig(
  relations: RelationDefinition[],
  options: BuildRelationConfigOptions,
): Plot2DRelationConfig {
  return {
    type: '2d-relation',
    relations: buildRelationEntries(relations, options.sliderValues),
    viewport: options.viewport,
    ...(options.resolution ? { resolution: options.resolution } : {}),
    ...(options.xAxis ? { xAxis: options.xAxis } : {}),
    ...(options.yAxis ? { yAxis: options.yAxis } : {}),
    ...(options.title ? { title: options.title } : {}),
  };
}
