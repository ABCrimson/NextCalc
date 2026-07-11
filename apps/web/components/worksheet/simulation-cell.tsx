'use client';

/**
 * SimulationCellContent — GPU Lab worksheet cell.
 *
 * Mounts the existing GPU renderers as slider-driven, shareable worksheet
 * cells:
 *   - pde-heat / pde-wave / pde-laplace → WebGPUHeatmap (internal WebGPU
 *     compute solver, automatic WebGL fallback), fed by the shared
 *     initial-condition preset library
 *   - lorenz → Lorenz3DRenderer (three/webgpu + TSL), fed by
 *     LorenzAttractor.simulate with useDeferredValue on params so slider
 *     drags stay responsive
 *   - direction-field → GpuDirectionField with the new `params` prop binding
 *     worksheet sliders to the WGSL uniform buffer
 *
 * Serialization invariant: the cell persists ONLY `{ sim, preset, params }`
 * (plain strings/numbers) through the worksheet store → autosave → share
 * pipeline. Runtime state (running, backend, generated grids/trajectories,
 * GPU buffers) is component-local and never serialized.
 *
 * GIF/clip export — deliberately deferred follow-up (Wave 1 decision):
 * The chosen design is a zero-dependency, fully client-side recorder:
 * `canvas.captureStream(30)` on the renderer canvas piped into a
 * `MediaRecorder` with `video/webm` (VP9 where supported), producing a
 * downloadable WebM clip with NO export-service round-trip. It is deferred
 * because the record/trim/download UI plus cross-renderer canvas plumbing
 * (three's canvas vs raw WebGPU canvas vs 2D overlay composition) is its own
 * UI/QA surface, and the alternative — export-service (Cloudflare Worker)
 * frame-upload GIF encoding — is disproportionately heavy for Wave 1
 * (modern-pdf-lib WASM in workerd is already known-blocked upstream).
 */

import { LorenzAttractor } from '@nextcalc/math-engine/chaos';
import { detectBestBackend, type RenderBackend } from '@nextcalc/plot-engine';
import { AlertCircle, Info, Loader2, Pause, Play, RotateCcw, X, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useEffect, useState } from 'react';
import type { PdeEquationType } from '@/components/plots/webgpu-heatmap';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  generateInitialCondition,
  isInitialConditionType,
} from '@/lib/simulation/initial-conditions';
import {
  DEFAULT_PARAMS,
  DIRECTION_FIELD_PRESETS,
  getSimParams,
  isSimulationKind,
  SIM_REGISTRY,
  SIMULATION_KINDS,
  type SimulationKind,
} from '@/lib/simulation/registry';
import { type SimulationCell, useWorksheetActions } from '@/lib/stores/worksheet-store';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Dynamic renderer imports — keep GPU code out of the worksheet bundle until
// a simulation cell actually mounts. All three are client-only (ssr: false).
// ---------------------------------------------------------------------------

function RendererLoading() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      <Loader2 className="size-5 animate-spin mr-2" aria-hidden="true" />
      <span aria-live="polite">…</span>
    </div>
  );
}

const WebGPUHeatmap = dynamic(
  () => import('@/components/plots/webgpu-heatmap').then((m) => ({ default: m.WebGPUHeatmap })),
  { ssr: false, loading: () => <RendererLoading /> },
);

const Lorenz3DRenderer = dynamic(
  () =>
    import('@/components/chaos/lorenz-3d-renderer').then((m) => ({
      default: m.Lorenz3DRenderer,
    })),
  { ssr: false, loading: () => <RendererLoading /> },
);

const GpuDirectionField = dynamic(
  () =>
    import('@/app/[locale]/solver/ode/GpuDirectionField').then((m) => ({
      default: m.GpuDirectionField,
    })),
  { ssr: false, loading: () => <RendererLoading /> },
);

// ---------------------------------------------------------------------------
// Constants + pure helpers
// ---------------------------------------------------------------------------

/** Grid resolution for worksheet PDE sims — small enough for many cells. */
const SIM_GRID_SIZE = 96;

/** Direction-field canvas size (matches the h-[340px] mount area). */
const FIELD_SIZE = 340;

const PDE_EQUATION = {
  'pde-heat': 'heat',
  'pde-wave': 'wave',
  'pde-laplace': 'laplace',
} as const satisfies Partial<Record<SimulationKind, PdeEquationType>>;

type PdeSimKind = keyof typeof PDE_EQUATION;

function isPdeSim(sim: SimulationKind): sim is PdeSimKind {
  return sim === 'pde-heat' || sim === 'pde-wave' || sim === 'pde-laplace';
}

/** Point shape consumed by Lorenz3DRenderer (structural match). */
interface LorenzPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Compute a Lorenz trajectory from serialized cell params.
 * Pure CPU compute via math-engine — the renderer receives plain data.
 */
function computeLorenzTrajectory(params: Readonly<Record<string, number>>): LorenzPoint[] {
  const lorenz = new LorenzAttractor(
    params['sigma'] ?? 10,
    params['rho'] ?? 28,
    params['beta'] ?? 8 / 3,
  );
  const steps = Math.round(params['steps'] ?? 2000);
  return [...lorenz.simulate(steps, 0.01, { x: 1, y: 1, z: 1 })];
}

/** Generate the (static) initial-condition grid for a PDE sim cell. */
function computeIcGrid(sim: SimulationKind, preset: string): number[][] {
  if (!isPdeSim(sim)) return [];
  const ic = isInitialConditionType(preset) ? preset : 'center';
  return generateInitialCondition(ic, SIM_GRID_SIZE);
}

/** Value range for the heatmap color scale. `sinc` and wave go negative. */
function gridValueRange(grid: number[][]): { min: number; max: number } {
  let min = 0;
  let max = 100;
  for (const row of grid) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { min, max };
}

function formatParamValue(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return parseFloat(v.toPrecision(4)).toString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SimulationCellContentProps {
  cell: SimulationCell;
  cellIndex: number;
}

export function SimulationCellContent({ cell, cellIndex }: SimulationCellContentProps) {
  const t = useTranslations('worksheet.simulation');
  const { updateSimulation } = useWorksheetActions();

  // Runtime state — intentionally component-local, NEVER serialized.
  const [running, setRunning] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [backend, setBackend] = useState<RenderBackend | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ---- Capability probe (single WebGPU-first check via plot-engine) ----
  useEffect(() => {
    let cancelled = false;
    detectBestBackend().then((b) => {
      if (!cancelled) setBackend(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Initial-condition grid, regenerated when sim/preset/reset changes ----
  // "Adjust state during render" idiom: derive the grid from a key so preset
  // switches, sim switches, external hydration, and Reset (dataVersion bump)
  // all regenerate it without effects.
  const icKey = `${cell.sim}:${cell.preset}:${dataVersion}`;
  const [icState, setIcState] = useState(() => ({
    key: icKey,
    grid: computeIcGrid(cell.sim, cell.preset),
  }));
  if (icState.key !== icKey) {
    setIcState({ key: icKey, grid: computeIcGrid(cell.sim, cell.preset) });
  }

  // ---- Lorenz trajectory (deferred so slider drags stay responsive) ----
  const deferredParams = useDeferredValue(cell.params);
  const lorenzData = cell.sim === 'lorenz' ? computeLorenzTrajectory(deferredParams) : null;

  // ---- Handlers (React Compiler ON — no manual memoization) ----

  const handleSimChange = (value: string) => {
    if (!isSimulationKind(value) || value === cell.sim) return;
    setRunning(false);
    setDataVersion(0);
    updateSimulation(cell.id, { sim: value });
  };

  const handlePresetChange = (preset: string) => {
    setRunning(false);
    updateSimulation(cell.id, {
      preset,
      // Direction-field presets carry their own param specs — atomically
      // reset params to the new preset's defaults in the same patch.
      ...(cell.sim === 'direction-field' ? { params: DEFAULT_PARAMS(cell.sim, preset) } : {}),
    });
  };

  const handleParamChange = (key: string, value: number) => {
    updateSimulation(cell.id, { params: { ...cell.params, [key]: value } });
  };

  const handleReset = () => {
    setRunning(false);
    setDataVersion((v) => v + 1);
  };

  const cellLabel = `${t('label')} ${cellIndex + 1}`;

  // ---- Unknown sim kind (forward compatibility with future cell data) ----
  if (!isSimulationKind(cell.sim)) {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2"
        role="alert"
      >
        <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
        <span className="text-sm text-destructive">{t('unknownKind', { kind: cell.sim })}</span>
      </div>
    );
  }

  const registry = SIM_REGISTRY[cell.sim];
  const paramSpecs = getSimParams(cell.sim, cell.preset);
  const presets = registry.presets;
  const noGpuForLorenz = cell.sim === 'lorenz' && backend === 'canvas2d';
  const dfPreset =
    cell.sim === 'direction-field'
      ? (DIRECTION_FIELD_PRESETS[cell.preset] ?? DIRECTION_FIELD_PRESETS['van-der-pol'])
      : undefined;
  const showPlayPause = isPdeSim(cell.sim) || cell.sim === 'direction-field';
  const showReset = isPdeSim(cell.sim);
  const valueRange = isPdeSim(cell.sim) ? gridValueRange(icState.grid) : null;

  return (
    <div className="space-y-3">
      {/* (1) Sim-kind segmented control */}
      <Tabs value={cell.sim} onValueChange={handleSimChange}>
        <TabsList className="h-8 w-full sm:w-auto" aria-label={t('label')}>
          {SIMULATION_KINDS.map((kind) => (
            <TabsTrigger key={kind} value={kind} className="text-xs px-2.5">
              {t(SIM_REGISTRY[kind].labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        {/* (2) Preset select */}
        {presets.length > 1 && (
          <Select value={cell.preset} onValueChange={handlePresetChange}>
            <SelectTrigger
              className="h-8 w-44 text-xs"
              aria-label={`${t('preset')} — ${cellLabel}`}
            >
              <SelectValue placeholder={t('preset')} />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset} value={preset} className="text-xs">
                  {t(`presets.${preset}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* (4) Play/Pause + Reset — `running` is runtime-only, never saved */}
        {showPlayPause && (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setRunning((r) => !r)}
            aria-pressed={running}
            aria-label={`${running ? t('pause') : t('play')} — ${cellLabel}`}
          >
            {running ? (
              <Pause className="size-3.5" aria-hidden="true" />
            ) : (
              <Play className="size-3.5" aria-hidden="true" />
            )}
            {running ? t('pause') : t('play')}
          </Button>
        )}
        {showReset && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs"
            onClick={handleReset}
            aria-label={`${t('reset')} — ${cellLabel}`}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {t('reset')}
          </Button>
        )}
      </div>

      {/* (3) Parameter sliders — these ARE the worksheet-bound parameters */}
      <fieldset
        className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 space-y-2.5 m-0"
        aria-label={`${t('parameters')} — ${cellLabel}`}
      >
        <legend className="sr-only">{t('parameters')}</legend>
        {paramSpecs.map((spec) => {
          const value = cell.params[spec.key] ?? spec.default;
          return (
            <div key={spec.key} className="flex items-center gap-3">
              <span
                className={cn(
                  'flex-shrink-0 min-w-6 h-6 px-1 flex items-center justify-center',
                  'rounded bg-linear-to-br/oklab from-cyan-500/20 to-blue-500/20',
                  'border border-cyan-500/30 text-xs font-bold font-mono text-cyan-300',
                )}
                aria-hidden="true"
              >
                {spec.symbol}
              </span>
              <Slider
                value={[value]}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                onValueChange={(values) => {
                  const next = values[0];
                  if (next !== undefined) handleParamChange(spec.key, next);
                }}
                aria-label={t(`params.${spec.labelKey}`)}
                className="flex-1"
              />
              <span
                className="flex-shrink-0 w-16 text-right text-xs font-mono font-semibold text-foreground tabular-nums"
                aria-hidden="true"
              >
                {formatParamValue(value)}
              </span>
            </div>
          );
        })}
      </fieldset>

      {/* WebGL2 fallback info banner (dismissible) */}
      {backend === 'webgl2' && !bannerDismissed && !noGpuForLorenz && (
        <div
          className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200"
          role="status"
        >
          <Info className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1">{t('webgpuFallback')}</span>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label={t('dismiss')}
            className="shrink-0 rounded p-0.5 hover:bg-blue-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* (5) Renderer mount area */}
      <section
        className="relative h-[340px] rounded-xl overflow-hidden border border-border/40 bg-background"
        aria-label={`${cellLabel} — ${t(registry.labelKey)}`}
      >
        {isPdeSim(cell.sim) && valueRange && (
          <div className="flex h-full items-center justify-center">
            <WebGPUHeatmap
              data={icState.grid}
              minValue={valueRange.min}
              maxValue={valueRange.max}
              colorMode={cell.sim === 'pde-wave' ? 'wave' : 'heat'}
              width={340}
              height={340}
              smoothing
              gpuSolverEnabled={running}
              equationType={PDE_EQUATION[cell.sim]}
              solverAlpha={cell.params['alpha'] ?? cell.params['c'] ?? 0.1}
            />
          </div>
        )}

        {cell.sim === 'lorenz' &&
          (noGpuForLorenz ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <Zap className="size-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t('noGpu')}</p>
            </div>
          ) : lorenzData ? (
            <Lorenz3DRenderer data={lorenzData} />
          ) : (
            <RendererLoading />
          ))}

        {cell.sim === 'direction-field' &&
          dfPreset &&
          (running ? (
            <div className="relative mx-auto size-[340px]">
              <GpuDirectionField
                size={FIELD_SIZE}
                xMin={dfPreset.xMin}
                xMax={dfPreset.xMax}
                yMin={dfPreset.yMin}
                yMax={dfPreset.yMax}
                f={(x, y) => dfPreset.f(x, y, cell.params)}
                g={(x, y) => dfPreset.g(x, y, cell.params)}
                equationType={dfPreset.equationType}
                params={[
                  cell.params['param0'] ?? dfPreset.params[0]?.default ?? 0,
                  cell.params['param1'] ?? dfPreset.params[1]?.default ?? 0,
                ]}
                gridN={48}
                opacity={0.85}
                visible
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRunning(true)}
              className={cn(
                'flex h-full w-full flex-col items-center justify-center gap-2 text-center',
                'text-muted-foreground hover:text-foreground transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              )}
              aria-label={`${t('play')} — ${cellLabel}`}
            >
              <Play className="size-8 text-cyan-400/70" aria-hidden="true" />
              <span className="text-sm">{t('play')}</span>
            </button>
          ))}
      </section>
    </div>
  );
}
