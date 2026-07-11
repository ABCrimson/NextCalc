/**
 * Smoke tests for Plot2D's '2d-relation' plumbing: renderer initialization via
 * createAndInitBest2DRenderer, the viewport/controller branch, axis-label
 * rendering, and pan-driven viewport propagation.
 *
 * happy-dom has no WebGL2/WebGPU context, so only `createAndInitBest2DRenderer`
 * is mocked — the real `Plot2DController` (plain DOM event listeners, no GPU)
 * runs unmocked so the pan/zoom wiring is exercised for real.
 */

import type { Plot2DRelationConfig } from '@nextcalc/plot-engine';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Plot2D } from './Plot2D';

const renderMock = vi.fn();
const disposeMock = vi.fn();
const resizeMock = vi.fn();

vi.mock('@nextcalc/plot-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nextcalc/plot-engine')>();
  return {
    ...actual,
    createAndInitBest2DRenderer: vi.fn(async (canvas: HTMLCanvasElement) => ({
      backend: 'canvas2d' as const,
      canvas,
      initialize: vi.fn(async () => {}),
      render: renderMock,
      resize: resizeMock,
      dispose: disposeMock,
      getMetrics: vi.fn(() => ({ fps: 60, memoryUsage: 0, pointCount: 0, drawCalls: 0 })),
      [Symbol.dispose]: vi.fn(),
    })),
  };
});

function makeConfig(): Plot2DRelationConfig {
  return {
    type: '2d-relation',
    relations: [
      {
        field: (x: number, y: number) => x * x + y * y - 25,
        op: '=',
      },
    ],
    viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
    xAxis: {
      label: 'x',
      min: -10,
      max: 10,
      scale: 'linear',
      grid: { enabled: true, majorStep: 2, color: '#000', opacity: 0.5 },
      ticks: { enabled: true, format: (v: number) => String(v) },
    },
    yAxis: {
      label: 'y',
      min: -10,
      max: 10,
      scale: 'linear',
      grid: { enabled: true, majorStep: 2, color: '#000', opacity: 0.5 },
      ticks: { enabled: true, format: (v: number) => String(v) },
    },
    title: 'Circle',
  };
}

describe('Plot2D — 2d-relation wiring', () => {
  beforeEach(() => {
    renderMock.mockClear();
    disposeMock.mockClear();
    resizeMock.mockClear();
  });

  it('initializes via createAndInitBest2DRenderer and renders the relation config', async () => {
    render(<Plot2D config={makeConfig()} width={800} height={600} />);

    await waitFor(() => expect(renderMock).toHaveBeenCalled(), { timeout: 2000 });

    const lastConfig = renderMock.mock.calls.at(-1)?.[0] as Plot2DRelationConfig;
    expect(lastConfig.type).toBe('2d-relation');
    expect(screen.getByRole('img', { name: 'Circle' })).toBeInTheDocument();
  });

  it('renders axis labels for a 2d-relation config that supplies xAxis/yAxis', async () => {
    render(<Plot2D config={makeConfig()} width={800} height={600} />);
    await waitFor(() => expect(renderMock).toHaveBeenCalled());

    expect(screen.getByLabelText('Coordinate axis labels')).toBeInTheDocument();
    expect(screen.getByLabelText('X axis represents x')).toBeInTheDocument();
    expect(screen.getByLabelText('Y axis represents y')).toBeInTheDocument();
  });

  it('omits the named axis-label overlay when a 2d-relation config has no xAxis/yAxis', async () => {
    // Numeric tick marks always render for viewport configs (AxisLabels has its
    // own defaults); only the "X/Y axis represents <label>" overlay depends on
    // xAxis/yAxis being supplied — this is the bit Plot2D's 2d-relation branch
    // is responsible for threading through.
    const { xAxis: _xAxis, yAxis: _yAxis, ...withoutAxes } = makeConfig();
    render(<Plot2D config={withoutAxes as Plot2DRelationConfig} width={800} height={600} />);
    await waitFor(() => expect(renderMock).toHaveBeenCalled());

    expect(screen.getByLabelText('Coordinate axis labels')).toBeInTheDocument();
    expect(screen.queryByLabelText('X axis represents x')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Y axis represents y')).not.toBeInTheDocument();
  });

  it('propagates pan viewport changes through to the renderer for 2d-relation configs', async () => {
    const onViewportChange = vi.fn();
    render(
      <Plot2D config={makeConfig()} width={800} height={600} onViewportChange={onViewportChange} />,
    );
    await waitFor(() => expect(renderMock).toHaveBeenCalled());
    renderMock.mockClear();

    const canvas = screen.getByRole('img', { name: 'Circle' });
    fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.mouseMove(canvas, { clientX: 350, clientY: 300 });
    fireEvent.mouseUp(canvas);

    await waitFor(() => expect(onViewportChange).toHaveBeenCalled());
    await waitFor(() => expect(renderMock).toHaveBeenCalled());

    const lastConfig = renderMock.mock.calls.at(-1)?.[0] as Plot2DRelationConfig;
    expect(lastConfig.type).toBe('2d-relation');
    expect(lastConfig.viewport).not.toEqual({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 });

    const reportedViewport = onViewportChange.mock.calls.at(-1)?.[0];
    expect(reportedViewport).toEqual(lastConfig.viewport);
  });

  it('disposes the renderer on unmount', async () => {
    const { unmount } = render(<Plot2D config={makeConfig()} width={800} height={600} />);
    await waitFor(() => expect(renderMock).toHaveBeenCalled());

    unmount();
    expect(disposeMock).toHaveBeenCalled();
  });
});
