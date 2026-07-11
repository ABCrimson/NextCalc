/**
 * Tests for the draggable/keyboard-operable data points overlay.
 *
 * The global vitest.setup ResizeObserver mock is a no-op (`observe(){}`
 * never invokes its callback), so under jsdom/happy-dom the component's
 * `size` state never leaves {0,0} and it permanently takes its early-return
 * branch — a bare `<svg aria-hidden="true">` with none of the interactive
 * `<g role="button">` points. That means the a11y suite and DataRegressionTab
 * tests never actually exercise this file's headline accessibility surface
 * (keyboard-operable draggable points). This file locally stubs a
 * ResizeObserver that fires with a real size so the interactive markup
 * mounts, and asserts directly on it.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataPointsOverlay, type OverlayPoint } from './DataPointsOverlay';

const VIEWPORT = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
const POINTS: OverlayPoint[] = [
  { x: 1, y: 2, row: 0 },
  { x: -3, y: 4, row: 1 },
];

/** A ResizeObserver stub that immediately fires its callback with a fixed,
 *  non-zero content rect — unlike the global no-op mock in vitest.setup.ts. */
class FiringResizeObserver {
  #callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element) {
    this.#callback(
      [{ target, contentRect: { width: 600, height: 400 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}
  disconnect() {}
}

describe('DataPointsOverlay', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FiringResizeObserver);
    // jsdom/happy-dom never computes real layout; getBoundingClientRect
    // returns all zeros unless stubbed. Match the FiringResizeObserver size
    // so toMath()'s pixel→math conversion (which reads the live rect, not
    // React state) has a real width/height to divide by.
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 600,
      height: 400,
      top: 0,
      left: 0,
      right: 600,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a focusable, labelled button for each finite point', () => {
    render(
      <DataPointsOverlay
        points={POINTS}
        viewport={VIEWPORT}
        label="Data & fitted curve"
        color="#0891b2"
        showResiduals={false}
        onPointMove={vi.fn()}
        pointLabel={(x, y) => `Data point (${x}, ${y})`}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveAttribute('tabindex', '0');
      expect(button).toHaveAccessibleName();
    }
    expect(screen.getByRole('button', { name: 'Data point (1, 2)' })).toBeInTheDocument();
  });

  it('has no axe violations once the interactive points are mounted', async () => {
    const { container } = render(
      <DataPointsOverlay
        points={POINTS}
        viewport={VIEWPORT}
        label="Data & fitted curve"
        color="#0891b2"
        showResiduals={false}
        onPointMove={vi.fn()}
        pointLabel={(x, y) => `Data point (${x}, ${y})`}
      />,
    );

    // Sanity check: this is exercising the real interactive markup, not the
    // childless aria-hidden early-return svg.
    expect(screen.getAllByRole('button')).toHaveLength(2);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('moves a point with the arrow keys (keyboard-operable drag)', () => {
    const onPointMove = vi.fn();
    render(
      <DataPointsOverlay
        points={POINTS}
        viewport={VIEWPORT}
        label="Data & fitted curve"
        color="#0891b2"
        showResiduals={false}
        onPointMove={onPointMove}
        pointLabel={(x, y) => `Data point (${x}, ${y})`}
      />,
    );

    const point = screen.getByRole('button', { name: 'Data point (1, 2)' });
    fireEvent.keyDown(point, { key: 'ArrowRight' });

    expect(onPointMove).toHaveBeenCalledTimes(1);
    const [row, x, y] = onPointMove.mock.calls[0] as [number, number, number];
    expect(row).toBe(0);
    expect(x).toBeGreaterThan(1);
    expect(y).toBe(2);
  });

  it('drags a point by a grab offset instead of snapping to the cursor', () => {
    const onPointMove = vi.fn();
    render(
      <DataPointsOverlay
        points={POINTS}
        viewport={VIEWPORT}
        label="Data & fitted curve"
        color="#0891b2"
        showResiduals={false}
        onPointMove={onPointMove}
        pointLabel={(x, y) => `Data point (${x}, ${y})`}
      />,
    );

    // Point (1, 2) maps to pixel (330, 160) in a 600x400 viewport over
    // [-10, 10]. Grab slightly off-center (a sloppy click within the 12px
    // hit circle, not dead-center on the point) and move the cursor by a
    // tiny amount — a naive "snap to cursor" implementation would move the
    // point almost exactly onto the cursor's math position instead of by
    // the cursor's actual delta.
    const point = screen.getByRole('button', { name: 'Data point (1, 2)' });
    fireEvent.pointerDown(point, { clientX: 336, clientY: 166, pointerId: 1 });
    fireEvent.pointerMove(point, { clientX: 337, clientY: 167, pointerId: 1 });

    expect(onPointMove).toHaveBeenCalledTimes(1);
    const [row, x, y] = onPointMove.mock.calls[0] as [number, number, number];
    expect(row).toBe(0);
    // A 1px cursor move should translate the point by ~1px worth of math
    // units (20/600 ≈ 0.033), NOT snap it to the cursor's absolute position
    // (which — uncompensated for the initial grab offset — would land far
    // from (1, 2)).
    expect(x).toBeCloseTo(1 + 20 / 600, 2);
    expect(y).toBeCloseTo(2 - 20 / 400, 2);
  });
});
