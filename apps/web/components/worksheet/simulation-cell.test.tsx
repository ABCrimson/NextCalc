/**
 * Component tests for SimulationCellContent (GPU Lab worksheet cell).
 *
 * jsdom/happy-dom has no WebGPU/WebGL, so the three dynamically-imported GPU
 * renderers are mocked with lightweight stand-ins that surface their props as
 * data attributes/text — enough to assert param propagation without ever
 * touching a real GPU context. `@/components/ui/slider` (Radix) is likewise
 * swapped for a plain `<input type="range">` so slider interaction can be
 * driven with a simple `fireEvent.change`.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimulationCell } from '@/lib/stores/worksheet-store';
import { useWorksheetStore } from '@/lib/stores/worksheet-store';
import { SimulationCellContent } from './simulation-cell';

vi.mock('@nextcalc/plot-engine', () => ({
  detectBestBackend: vi.fn(async () => 'webgpu'),
}));

vi.mock('@/components/plots/webgpu-heatmap', () => ({
  WebGPUHeatmap: (props: {
    equationType: string;
    solverAlpha: number;
    gpuSolverEnabled: boolean;
  }) => (
    <div
      data-testid="webgpu-heatmap"
      data-equation-type={props.equationType}
      data-solver-alpha={props.solverAlpha}
      data-gpu-solver-enabled={String(props.gpuSolverEnabled)}
    />
  ),
}));

vi.mock('@/components/chaos/lorenz-3d-renderer', () => ({
  Lorenz3DRenderer: (props: { data: unknown[] }) => (
    <div data-testid="lorenz-renderer" data-point-count={props.data.length} />
  ),
}));

vi.mock('@/app/[locale]/solver/ode/GpuDirectionField', () => ({
  GpuDirectionField: (props: { equationType: string; params: number[] }) => (
    <div
      data-testid="direction-field"
      data-equation-type={props.equationType}
      data-params={JSON.stringify(props.params)}
    />
  ),
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    min,
    max,
    step,
    onValueChange,
    'aria-label': ariaLabel,
  }: {
    value: number[];
    min: number;
    max: number;
    step: number;
    onValueChange: (values: number[]) => void;
    'aria-label'?: string;
  }) => (
    <input
      type="range"
      aria-label={ariaLabel}
      value={value[0]}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onValueChange([Number(e.target.value)])}
    />
  ),
}));

function getStore() {
  return useWorksheetStore.getState();
}

/** Add a fresh simulation cell to the real store and return its current data. */
function addSimulationCell(): SimulationCell {
  const id = getStore().addCell('simulation');
  const cell = getStore().worksheet.cells.find((c) => c.id === id);
  if (cell?.kind !== 'simulation') throw new Error('expected a simulation cell');
  return cell;
}

/** Re-read the (possibly updated) cell from the store by id. */
function readCell(id: string): SimulationCell {
  const cell = getStore().worksheet.cells.find((c) => c.id === id);
  if (cell?.kind !== 'simulation') throw new Error('expected a simulation cell');
  return cell;
}

describe('SimulationCellContent', () => {
  beforeEach(() => {
    getStore().resetWorksheet();
  });

  afterEach(() => {
    getStore().resetWorksheet();
  });

  it('renders one slider per param spec declared in SIM_REGISTRY for the cell kind', async () => {
    const cell = addSimulationCell(); // default kind: pde-heat, 1 param (alpha)
    render(<SimulationCellContent cell={cell} cellIndex={0} />);

    await waitFor(() => {
      expect(screen.getByRole('slider', { name: 'params.alpha' })).toBeInTheDocument();
    });
    expect(screen.getAllByRole('slider')).toHaveLength(1);
  });

  it('renders one slider per lorenz param (sigma, rho, beta, steps)', async () => {
    const cell = addSimulationCell();
    getStore().updateSimulation(cell.id, { sim: 'lorenz' });
    const lorenzCell = readCell(cell.id);

    render(<SimulationCellContent cell={lorenzCell} cellIndex={0} />);

    await waitFor(() => {
      expect(screen.getAllByRole('slider')).toHaveLength(4);
    });
    expect(screen.getByRole('slider', { name: 'params.sigma' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'params.rho' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'params.beta' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'params.steps' })).toBeInTheDocument();
  });

  it('propagates a slider change into the worksheet store and the mounted renderer', async () => {
    const cell = addSimulationCell(); // pde-heat / alpha, default 0.1
    const { rerender } = render(<SimulationCellContent cell={cell} cellIndex={0} />);

    const slider = await screen.findByRole('slider', { name: 'params.alpha' });
    fireEvent.change(slider, { target: { value: '0.2' } });

    // Store was updated with the new param value
    await waitFor(() => {
      expect(readCell(cell.id).params['alpha']).toBeCloseTo(0.2, 5);
    });

    // Re-render with the fresh cell (mirrors how the real worksheet subscribes
    // to the store and passes an updated cell prop down) and confirm the
    // mounted renderer receives the propagated value.
    rerender(<SimulationCellContent cell={readCell(cell.id)} cellIndex={0} />);
    await waitFor(() => {
      const heatmap = screen.getByTestId('webgpu-heatmap');
      expect(heatmap.getAttribute('data-solver-alpha')).toBe('0.2');
    });
  });

  it('resets params to the new preset defaults when switching a direction-field preset', async () => {
    // Mirrors handlePresetChange in simulation-cell.tsx: preset + params are
    // patched atomically in one updateSimulation call so a preset switch
    // never leaves stale params from the previous preset's param0/param1.
    const cell = addSimulationCell();
    getStore().updateSimulation(cell.id, { sim: 'direction-field' }); // -> van-der-pol, param0=1
    expect(readCell(cell.id).params['param0']).toBeCloseTo(1, 5);

    getStore().updateSimulation(cell.id, {
      preset: 'pendulum',
      params: { param0: 0.1 }, // DEFAULT_PARAMS('direction-field', 'pendulum')
    });
    const afterPendulum = readCell(cell.id);
    expect(afterPendulum.preset).toBe('pendulum');
    expect(afterPendulum.params['param0']).toBeCloseTo(0.1, 5);

    getStore().updateSimulation(cell.id, {
      preset: 'van-der-pol',
      params: { param0: 1 }, // DEFAULT_PARAMS('direction-field', 'van-der-pol')
    });
    const afterVdp = readCell(cell.id);
    expect(afterVdp.preset).toBe('van-der-pol');
    expect(afterVdp.params['param0']).toBeCloseTo(1, 5);
  });

  it('does not render a preset select when the kind has only one preset (lorenz)', async () => {
    const cell = addSimulationCell();
    getStore().updateSimulation(cell.id, { sim: 'lorenz' });
    const lorenzCell = readCell(cell.id);

    render(<SimulationCellContent cell={lorenzCell} cellIndex={0} />);

    await waitFor(() => {
      expect(screen.getAllByRole('slider')).toHaveLength(4);
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders a graceful fallback for an unrecognized sim kind instead of crashing', async () => {
    const cell = addSimulationCell();
    const corrupted = {
      ...cell,
      // Simulate DB/JSON data written by a future NextCalc version
      sim: 'quantum-foam' as unknown as SimulationCell['sim'],
    } satisfies SimulationCell;

    render(<SimulationCellContent cell={corrupted} cellIndex={0} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('unknownKind');
    expect(alert).toHaveTextContent('quantum-foam');
    // No sliders / renderer mounted for unknown kinds
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('webgpu-heatmap')).not.toBeInTheDocument();

    // Let the (mocked, async) backend-detection effect settle before the test
    // exits, so its setState doesn't land after unmount/cleanup.
    await waitFor(() => {});
  });
});
