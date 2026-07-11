'use client';

/**
 * Data & Regression tab: columnar data table, tilde-model regression input,
 * fitted-curve plot with draggable data points, and fit statistics.
 *
 * Derived values (parse, fit, plot config) are computed in render — the React
 * Compiler memoizes them; `useDeferredValue` keeps point-dragging responsive
 * while the Levenberg-Marquardt refit trails by one deferred frame.
 *
 * @module components/plots/regression/DataRegressionTab
 */

import { type FitResult, fitModel, parseTildeModel } from '@nextcalc/math-engine/stats';
import type { Plot2DCartesianConfig } from '@nextcalc/plot-engine';
import { m } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { Plot2D } from '../Plot2D';
import { PlotContainer } from '../PlotContainer';
import { DataPointsOverlay, type OverlayPoint } from './DataPointsOverlay';
import { DataTable, type DataTableValue } from './DataTable';
import { FitStatsPanel } from './FitStatsPanel';
import { RegressionModelInput } from './RegressionModelInput';

const POINT_COLOR = '#0891b2';
const CURVE_COLOR = '#7c3aed';
const DEFAULT_VIEWPORT = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

/** Rounds a grid step to a 1/2/5 × 10ⁿ "nice" value (~8 major lines per axis). */
function niceStep(range: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / 8;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return nice * magnitude;
}

function formatTick(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 10000 || abs < 0.001) return value.toExponential(1);
  return Number(value.toPrecision(4)).toString();
}

/** Extracts finite (x, y) pairs from the first two table columns. */
function extractPoints(rows: readonly (number | null)[][]): OverlayPoint[] {
  const points: OverlayPoint[] = [];
  rows.forEach((row, index) => {
    const x = row[0];
    const y = row[1];
    if (
      typeof x === 'number' &&
      Number.isFinite(x) &&
      typeof y === 'number' &&
      Number.isFinite(y)
    ) {
      points.push({ x, y, row: index });
    }
  });
  return points;
}

/** True when `columns` contains the same name more than once. */
function hasDuplicateColumns(columns: readonly string[]): boolean {
  return columns.some((name, index) => columns.indexOf(name) !== index);
}

/** Columnar record for fitModel; rows that are entirely empty are skipped. */
function buildDataRecord(
  columns: readonly string[],
  rows: readonly (number | null)[][],
): Record<string, number[]> {
  const nonEmpty = rows.filter((row) => row.some((cell) => cell !== null));
  const record: Record<string, number[]> = {};
  columns.forEach((name, ci) => {
    record[name] = nonEmpty.map((row) => row[ci] ?? Number.NaN);
  });
  return record;
}

export function DataRegressionTab() {
  const t = useTranslations('plots.regression');
  const format = useFormatter();

  const [columns, setColumns] = useState<string[]>(['x1', 'y1']);
  const [rows, setRows] = useState<(number | null)[][]>([
    [null, null],
    [null, null],
    [null, null],
    [null, null],
  ]);
  const [model, setModel] = useState('');
  const [showResiduals, setShowResiduals] = useState(false);
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);

  // ---- Derived in render (React Compiler memoizes; no manual memo hooks) ----

  // Live parse feedback for the model input.
  const parsed = model.trim() !== '' ? parseTildeModel(model, columns) : null;
  const parseState =
    parsed === null
      ? null
      : parsed.ok
        ? ({ ok: true, parameters: parsed.parameters } as const)
        : ({ ok: false, message: parsed.message } as const);

  // The expensive LM refit trails the latest keystroke/drag by a deferred frame.
  const deferredColumns = useDeferredValue(columns);
  const deferredRows = useDeferredValue(rows);
  const deferredModel = useDeferredValue(model);

  // Duplicate column names collapse to a single key in buildDataRecord's
  // Record<string, number[]> (the later column silently wins), which would
  // otherwise let the fit run against corrupted data and report a
  // meaningless "converged" result. Gate the fit instead of ever calling it.
  const fit: FitResult | null =
    deferredModel.trim() === ''
      ? null
      : hasDuplicateColumns(deferredColumns)
        ? {
            ok: false,
            status: 'invalid-model',
            message: 'Column names must be unique — rename the duplicate column(s) before fitting',
          }
        : fitModel(buildDataRecord(deferredColumns, deferredRows), deferredModel);

  // Fitted curve — only plottable for single-regressor models.
  const regressor =
    fit?.ok && fit.model.regressors.length === 1 ? fit.model.regressors[0] : undefined;
  const curveFn =
    fit?.ok && regressor !== undefined
      ? (x: number): number => fit.predict({ [regressor]: x })
      : null;

  const points = extractPoints(rows);

  const config: Plot2DCartesianConfig = {
    type: '2d-cartesian',
    functions:
      fit?.ok && curveFn
        ? [
            {
              fn: curveFn,
              label: `${fit.model.dependent} ~ ${fit.model.rhsText}`,
              style: { line: { width: 2.5, color: CURVE_COLOR } },
            },
          ]
        : [],
    viewport,
    xAxis: {
      label: columns[0] ?? 'x',
      min: viewport.xMin,
      max: viewport.xMax,
      scale: 'linear',
      grid: {
        enabled: true,
        majorStep: niceStep(viewport.xMax - viewport.xMin),
        color: '#e5e7eb',
        opacity: 0.5,
      },
      ticks: { enabled: true, format: formatTick },
    },
    yAxis: {
      label: columns[1] ?? 'y',
      min: viewport.yMin,
      max: viewport.yMax,
      scale: 'linear',
      grid: {
        enabled: true,
        majorStep: niceStep(viewport.yMax - viewport.yMin),
        color: '#e5e7eb',
        opacity: 0.5,
      },
      ticks: { enabled: true, format: formatTick },
    },
    title: t('plotTitle'),
    legend: { enabled: Boolean(fit?.ok && curveFn), position: 'top-right' },
  };

  // ---- Handlers ----

  /** Table edits (typing, paste, add/remove) auto-fit the viewport to the data. */
  const handleTableChange = (next: DataTableValue) => {
    setColumns(next.columns);
    setRows(next.rows);
    const nextPoints = extractPoints(next.rows);
    if (nextPoints.length >= 2) {
      const xs = nextPoints.map((p) => p.x);
      const ys = nextPoints.map((p) => p.y);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      const padX = (xMax - xMin) * 0.12 || 1;
      const padY = (yMax - yMin) * 0.12 || 1;
      setViewport({
        xMin: xMin - padX,
        xMax: xMax + padX,
        yMin: yMin - padY,
        yMax: yMax + padY,
      });
    }
  };

  /** Point drags update the table without re-fitting the viewport. */
  const handlePointMove = (row: number, x: number, y: number) => {
    const rx = Number(x.toPrecision(6));
    const ry = Number(y.toPrecision(6));
    setRows((prev) =>
      prev.map((r, i) => (i === row ? r.map((c, ci) => (ci === 0 ? rx : ci === 1 ? ry : c)) : r)),
    );
  };

  const pointLabel = (x: number, y: number): string =>
    t('pointLabel', {
      x: format.number(x, { maximumSignificantDigits: 4 }),
      y: format.number(y, { maximumSignificantDigits: 4 }),
    });

  const residualPredict = showResiduals && curveFn ? { predict: curveFn } : undefined;

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {/* Sidebar: data table + model input */}
      <div className="lg:col-span-1">
        <div className="sticky top-24 space-y-4">
          <div className="relative p-5 rounded-xl bg-linear-to-br/oklab from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_oklch(0_0_0_/_0.37)]">
            <div className="absolute inset-0 rounded-xl bg-linear-to-br/oklab from-rose-500/5 to-orange-500/5 pointer-events-none" />
            <div className="relative space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('dataTitle')}</h3>
              <DataTable columns={columns} rows={rows} onChange={handleTableChange} />
            </div>
          </div>

          <div className="relative p-5 rounded-xl bg-linear-to-br/oklab from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_oklch(0_0_0_/_0.37)]">
            <div className="absolute inset-0 rounded-xl bg-linear-to-br/oklab from-rose-500/5 to-orange-500/5 pointer-events-none" />
            <div className="relative">
              <RegressionModelInput
                model={model}
                onModelChange={setModel}
                firstX={columns[0] ?? 'x1'}
                firstY={columns[1] ?? 'y1'}
                parseState={parseState}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Plot + fit statistics */}
      <div className="lg:col-span-2 space-y-4">
        <PlotContainer title={t('title')} description={t('dragHint')}>
          <div className="relative w-full aspect-[4/3]">
            <Plot2D
              config={config}
              enableInteractions={true}
              onViewportChange={setViewport}
              syncViewportToConfig={true}
            />
            <DataPointsOverlay
              points={points}
              viewport={viewport}
              label={t('plotTitle')}
              color={POINT_COLOR}
              showResiduals={showResiduals}
              onPointMove={handlePointMove}
              pointLabel={pointLabel}
              {...(residualPredict !== undefined ? { residuals: residualPredict } : {})}
            />
          </div>
        </PlotContainer>

        <FitStatsPanel
          fit={fit}
          showResiduals={showResiduals}
          onToggleResiduals={setShowResiduals}
        />
      </div>
    </m.div>
  );
}
