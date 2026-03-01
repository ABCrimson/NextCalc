/**
 * Tests for the Plot2DController interaction controller
 * @module controls/interactions.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ControlEvent, Viewport } from '../types/index';
import { Plot2DController } from './interactions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_VIEWPORT: Viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

/**
 * Creates a minimal HTMLCanvasElement stub. The canvas is 400×300 pixels;
 * getBoundingClientRect returns a rect anchored at the origin.
 */
function makeCanvas(width = 400, height = 300): HTMLCanvasElement {
  const canvas = {
    width,
    height,
    style: { cursor: '' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })),
  } as unknown as HTMLCanvasElement;
  return canvas;
}

/**
 * Returns a fresh controller, canvas, and initial viewport for each test.
 */
function makeController(
  viewportOverride?: Partial<Viewport>,
  canvasWidth = 400,
  canvasHeight = 300,
) {
  const viewport: Viewport = { ...DEFAULT_VIEWPORT, ...viewportOverride };
  const canvas = makeCanvas(canvasWidth, canvasHeight);
  const controller = new Plot2DController(canvas, viewport);
  return { controller, canvas, viewport };
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe('Plot2DController construction', () => {
  it('should initialise with the provided viewport', () => {
    const { controller } = makeController();
    const vp = controller.getViewport();
    expect(vp).toEqual(DEFAULT_VIEWPORT);
  });

  it('should make a deep copy of the initial viewport', () => {
    const initial: Viewport = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    const canvas = makeCanvas();
    const controller = new Plot2DController(canvas, initial);

    // Mutate the original object
    initial.xMin = -999;

    // Controller should retain its own copy
    expect(controller.getViewport().xMin).toBe(-5);
  });

  it('should start in the disabled state (no listeners registered)', () => {
    const { canvas } = makeController();
    expect(canvas.addEventListener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// enable / disable
// ---------------------------------------------------------------------------

describe('enable()', () => {
  it('should register event listeners on the canvas and window', () => {
    const { controller, canvas } = makeController();
    const windowAddSpy = vi.spyOn(window, 'addEventListener');

    controller.enable();

    expect(canvas.addEventListener).toHaveBeenCalled();
    expect(windowAddSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    windowAddSpy.mockRestore();
  });

  it('should set canvas cursor to "crosshair"', () => {
    const { controller, canvas } = makeController();
    controller.enable();
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('should be idempotent — calling enable twice does not double-register listeners', () => {
    const { controller, canvas } = makeController();
    controller.enable();
    const callCount = (canvas.addEventListener as ReturnType<typeof vi.fn>).mock.calls.length;

    controller.enable(); // second call should be a no-op

    expect((canvas.addEventListener as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });
});

describe('disable()', () => {
  it('should remove event listeners from the canvas and window', () => {
    const { controller, canvas } = makeController();
    const windowRemoveSpy = vi.spyOn(window, 'removeEventListener');

    controller.enable();
    controller.disable();

    expect(canvas.removeEventListener).toHaveBeenCalled();
    expect(windowRemoveSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    windowRemoveSpy.mockRestore();
  });

  it('should set canvas cursor to "default"', () => {
    const { controller, canvas } = makeController();
    controller.enable();
    controller.disable();
    expect(canvas.style.cursor).toBe('default');
  });

  it('should be idempotent — calling disable when already disabled is a no-op', () => {
    const { controller, canvas } = makeController();
    // Never enabled — disable should do nothing
    controller.disable();
    expect(canvas.removeEventListener).not.toHaveBeenCalled();
  });

  it('should allow re-enabling after disable', () => {
    const { controller, canvas } = makeController();
    controller.enable();
    controller.disable();
    controller.enable();
    expect(canvas.style.cursor).toBe('crosshair');
  });
});

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('reset()', () => {
  it('should restore the viewport to the initial values', () => {
    const { controller } = makeController();

    controller.setViewport({ xMin: -99, xMax: 99, yMin: -99, yMax: 99 });
    controller.reset();

    expect(controller.getViewport()).toEqual(DEFAULT_VIEWPORT);
  });

  it('should emit a "reset" event with the restored viewport', () => {
    const { controller } = makeController();
    const handler = vi.fn();
    controller.addEventListener('reset', handler);

    controller.reset();

    expect(handler).toHaveBeenCalledOnce();
    const event: ControlEvent = handler.mock.calls[0][0];
    expect(event.type).toBe('reset');
    expect((event.data as { viewport: Viewport }).viewport).toEqual(DEFAULT_VIEWPORT);
  });
});

// ---------------------------------------------------------------------------
// getViewport / setViewport
// ---------------------------------------------------------------------------

describe('getViewport()', () => {
  it('should return a copy of the current viewport', () => {
    const { controller } = makeController();
    const vp = controller.getViewport();

    // Mutating the returned copy should not affect the controller's state
    vp.xMin = -999;
    expect(controller.getViewport().xMin).toBe(-10);
  });
});

describe('setViewport()', () => {
  it('should update the viewport to the provided values', () => {
    const { controller } = makeController();
    const newVp: Viewport = { xMin: 0, xMax: 5, yMin: 0, yMax: 5 };

    controller.setViewport(newVp);

    expect(controller.getViewport()).toEqual(newVp);
  });

  it('should emit a "pan" event when the viewport is set', () => {
    const { controller } = makeController();
    const handler = vi.fn();
    controller.addEventListener('pan', handler);

    controller.setViewport({ xMin: 1, xMax: 2, yMin: 1, yMax: 2 });

    expect(handler).toHaveBeenCalledOnce();
    const event: ControlEvent = handler.mock.calls[0][0];
    expect(event.type).toBe('pan');
  });

  it('should make a deep copy of the supplied viewport', () => {
    const { controller } = makeController();
    const newVp: Viewport = { xMin: 0, xMax: 5, yMin: 0, yMax: 5 };

    controller.setViewport(newVp);
    newVp.xMin = -999;

    expect(controller.getViewport().xMin).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// addEventListener / removeEventListener
// ---------------------------------------------------------------------------

describe('addEventListener / removeEventListener', () => {
  it('should call a registered handler when the matching event is emitted', () => {
    const { controller } = makeController();
    const handler = vi.fn();
    controller.addEventListener('reset', handler);

    controller.reset();

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should support multiple handlers for the same event type', () => {
    const { controller } = makeController();
    const h1 = vi.fn();
    const h2 = vi.fn();
    controller.addEventListener('reset', h1);
    controller.addEventListener('reset', h2);

    controller.reset();

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('should support handlers for different event types independently', () => {
    const { controller } = makeController();
    const panHandler = vi.fn();
    const resetHandler = vi.fn();
    controller.addEventListener('pan', panHandler);
    controller.addEventListener('reset', resetHandler);

    controller.reset();

    expect(resetHandler).toHaveBeenCalledOnce();
    expect(panHandler).not.toHaveBeenCalled();
  });

  it('should not call a handler after it has been removed', () => {
    const { controller } = makeController();
    const handler = vi.fn();
    controller.addEventListener('reset', handler);
    controller.removeEventListener('reset', handler);

    controller.reset();

    expect(handler).not.toHaveBeenCalled();
  });

  it('should silently ignore removing a handler that was never added', () => {
    const { controller } = makeController();
    const handler = vi.fn();

    // Should not throw
    expect(() => controller.removeEventListener('reset', handler)).not.toThrow();
  });

  it('should not affect other handlers when one is removed', () => {
    const { controller } = makeController();
    const h1 = vi.fn();
    const h2 = vi.fn();
    controller.addEventListener('reset', h1);
    controller.addEventListener('reset', h2);

    controller.removeEventListener('reset', h1);
    controller.reset();

    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Viewport zoom calculation (zoomViewport, exposed via setViewport + reset)
// ---------------------------------------------------------------------------

/**
 * zoomViewport logic tests.
 *
 * The wheel event handler internally calls getBoundingClientRect() to compute
 * normalized mouse coordinates.  happy-dom does not perform layout, so that
 * method always returns { width: 0, height: 0 }, making the mouse-coordinate
 * calculation produce NaN.  We therefore test zoom behaviour through the
 * keyboard handler ("+"/"-" keys), which calls zoomViewport(0.5, 0.5, factor)
 * directly — no DOM layout required.
 *
 * For the wheel-event contract (correct factor, correct event emission) we rely
 * on the event-emission test, which only checks the emitted factor value and
 * is not affected by the NaN viewport coordinates.
 */
describe('zoomViewport calculations (via keyboard zoom)', () => {
  let canvas: HTMLCanvasElement;
  let controller: Plot2DController;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    canvas.setAttribute('tabindex', '0');
    document.body.appendChild(canvas);
    canvas.focus();

    controller = new Plot2DController(canvas, { ...DEFAULT_VIEWPORT });
    controller.enable();
  });

  afterEach(() => {
    controller.disable();
    document.body.removeChild(canvas);
  });

  // Keyboard "+" → zoomViewport(0.5, 0.5, 0.9) — zooms in
  it('should zoom in (reduce extent) when "+" is pressed', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));

    const after = controller.getViewport();
    const afterWidth = after.xMax - after.xMin;
    expect(afterWidth).toBeLessThan(beforeWidth);
  });

  // Keyboard "-" → zoomViewport(0.5, 0.5, 1.1) — zooms out
  it('should zoom out (increase extent) when "-" is pressed', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));

    const after = controller.getViewport();
    const afterWidth = after.xMax - after.xMin;
    expect(afterWidth).toBeGreaterThan(beforeWidth);
  });

  it('should apply the exact zoom factor of 0.9 for "+" key', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));

    const after = controller.getViewport();
    const afterWidth = after.xMax - after.xMin;
    expect(afterWidth).toBeCloseTo(beforeWidth * 0.9, 8);
  });

  it('should apply the exact zoom factor of 1.1 for "-" key', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));

    const after = controller.getViewport();
    const afterWidth = after.xMax - after.xMin;
    expect(afterWidth).toBeCloseTo(beforeWidth * 1.1, 8);
  });

  it('should zoom towards the viewport centre (anchor point preserved)', () => {
    // The keyboard handler always zooms toward normalizedX=0.5, normalizedY=0.5.
    // For the symmetric viewport [-10,10]x[-10,10], the world anchor is (0,0).
    // After zooming, (0,0) should still be the midpoint.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));

    const vp = controller.getViewport();
    const midX = (vp.xMin + vp.xMax) / 2;
    const midY = (vp.yMin + vp.yMax) / 2;
    expect(midX).toBeCloseTo(0, 5);
    expect(midY).toBeCloseTo(0, 5);
  });

  it('should preserve viewport aspect ratio after zoom', () => {
    const before = controller.getViewport();
    const beforeRatio = (before.xMax - before.xMin) / (before.yMax - before.yMin);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));

    const after = controller.getViewport();
    const afterRatio = (after.xMax - after.xMin) / (after.yMax - after.yMin);
    expect(afterRatio).toBeCloseTo(beforeRatio, 10);
  });
});

/**
 * Wheel event contract tests — verify factor and event emission only.
 * The viewport values after a wheel event may be NaN in happy-dom due to
 * getBoundingClientRect returning zero dimensions (no layout engine).
 * We therefore only assert on the emitted event payload.
 */
describe('wheel event contract', () => {
  let canvas: HTMLCanvasElement;
  let controller: Plot2DController;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    document.body.appendChild(canvas);

    controller = new Plot2DController(canvas, { ...DEFAULT_VIEWPORT });
    controller.enable();
  });

  afterEach(() => {
    controller.disable();
    document.body.removeChild(canvas);
  });

  it('should emit a "zoom" event with factor 0.9 on scroll-up (deltaY < 0)', () => {
    const handler = vi.fn();
    controller.addEventListener('zoom', handler);

    canvas.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -1, clientX: 0, clientY: 0, bubbles: true }),
    );

    expect(handler).toHaveBeenCalledOnce();
    const event: ControlEvent = handler.mock.calls[0][0];
    expect(event.type).toBe('zoom');
    expect((event.data as { factor: number }).factor).toBe(0.9);
  });

  it('should emit a "zoom" event with factor 1.1 on scroll-down (deltaY > 0)', () => {
    const handler = vi.fn();
    controller.addEventListener('zoom', handler);

    canvas.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 1, clientX: 0, clientY: 0, bubbles: true }),
    );

    expect(handler).toHaveBeenCalledOnce();
    const event: ControlEvent = handler.mock.calls[0][0];
    expect(event.type).toBe('zoom');
    expect((event.data as { factor: number }).factor).toBe(1.1);
  });
});

// ---------------------------------------------------------------------------
// Pan calculations (via mouse events)
// ---------------------------------------------------------------------------

describe('pan calculations (via mouse events)', () => {
  let canvas: HTMLCanvasElement;
  let controller: Plot2DController;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    document.body.appendChild(canvas);

    controller = new Plot2DController(canvas, { ...DEFAULT_VIEWPORT });
    controller.enable();
  });

  afterEach(() => {
    controller.disable();
    document.body.removeChild(canvas);
  });

  it('should emit a "pan" event during mouse move while panning', () => {
    const handler = vi.fn();
    controller.addEventListener('pan', handler);

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 100 }));

    expect(handler).toHaveBeenCalled();
    const event: ControlEvent = handler.mock.calls[0][0];
    expect(event.type).toBe('pan');
  });

  it('should shift the viewport left when dragging right', () => {
    // Dragging right means the world moves left (xMin/xMax decrease)
    const before = controller.getViewport();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 200, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 150 })); // +50px right

    const after = controller.getViewport();
    // worldDx = -(50/400)*20 = -2.5  → xMin goes down
    expect(after.xMin).toBeLessThan(before.xMin);
    expect(after.xMax).toBeLessThan(before.xMax);
  });

  it('should shift the viewport right when dragging left', () => {
    const before = controller.getViewport();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 200, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150 })); // -50px left

    const after = controller.getViewport();
    expect(after.xMin).toBeGreaterThan(before.xMin);
    expect(after.xMax).toBeGreaterThan(before.xMax);
  });

  it('should preserve the viewport width during a pan', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));

    const after = controller.getViewport();
    const afterWidth = after.xMax - after.xMin;
    expect(afterWidth).toBeCloseTo(beforeWidth, 10);
  });

  it('should not pan when right-click is held (button !== 0)', () => {
    const before = controller.getViewport();

    // Right-click drag
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 100 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));

    const after = controller.getViewport();
    expect(after).toEqual(before);
  });

  it('should stop panning on mouseup', () => {
    const handler = vi.fn();
    controller.addEventListener('pan', handler);

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100 }));
    canvas.dispatchEvent(new MouseEvent('mouseup'));

    // Move after mouseup should produce no pan events
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('should stop panning on mouseleave', () => {
    const handler = vi.fn();
    controller.addEventListener('pan', handler);

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100 }));
    canvas.dispatchEvent(new MouseEvent('mouseleave'));

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('should set cursor to "grabbing" while panning', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100 }));
    expect(canvas.style.cursor).toBe('grabbing');
  });

  it('should restore cursor to "crosshair" after mouseup', () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100 }));
    canvas.dispatchEvent(new MouseEvent('mouseup'));
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('should compute pan delta correctly for a full-width drag', () => {
    // Dragging exactly canvas.width pixels to the right moves the world by
    // one full viewport width to the left.
    const before = controller.getViewport();
    const worldWidth = before.xMax - before.xMin; // 20

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 150 }));
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 150 }));

    const after = controller.getViewport();
    expect(after.xMin).toBeCloseTo(before.xMin - worldWidth, 8);
    expect(after.xMax).toBeCloseTo(before.xMax - worldWidth, 8);
  });
});

// ---------------------------------------------------------------------------
// Keyboard navigation
// ---------------------------------------------------------------------------

describe('keyboard navigation', () => {
  let canvas: HTMLCanvasElement;
  let controller: Plot2DController;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    document.body.appendChild(canvas);

    // The keyboard handler only fires when the canvas is or contains the
    // activeElement. We set the canvas as active element by appending it to
    // the document and focusing it.
    canvas.setAttribute('tabindex', '0');
    canvas.focus();

    controller = new Plot2DController(canvas, { ...DEFAULT_VIEWPORT });
    controller.enable();
  });

  afterEach(() => {
    controller.disable();
    document.body.removeChild(canvas);
  });

  it('should pan left when ArrowLeft is pressed', () => {
    const before = controller.getViewport();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const after = controller.getViewport();
    expect(after.xMin).toBeLessThan(before.xMin);
    expect(after.xMax).toBeLessThan(before.xMax);
  });

  it('should pan right when ArrowRight is pressed', () => {
    const before = controller.getViewport();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const after = controller.getViewport();
    expect(after.xMin).toBeGreaterThan(before.xMin);
    expect(after.xMax).toBeGreaterThan(before.xMax);
  });

  it('should pan up when ArrowUp is pressed', () => {
    const before = controller.getViewport();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    const after = controller.getViewport();
    expect(after.yMin).toBeGreaterThan(before.yMin);
    expect(after.yMax).toBeGreaterThan(before.yMax);
  });

  it('should pan down when ArrowDown is pressed', () => {
    const before = controller.getViewport();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const after = controller.getViewport();
    expect(after.yMin).toBeLessThan(before.yMin);
    expect(after.yMax).toBeLessThan(before.yMax);
  });

  it('should zoom in when "+" is pressed', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    const after = controller.getViewport();
    const afterWidth = after.xMax - after.xMin;
    expect(afterWidth).toBeLessThan(beforeWidth);
  });

  it('should zoom in when "=" is pressed (same key, no shift)', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', bubbles: true }));
    const after = controller.getViewport();
    expect(after.xMax - after.xMin).toBeLessThan(beforeWidth);
  });

  it('should zoom out when "-" is pressed', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
    const after = controller.getViewport();
    const afterWidth = after.xMax - after.xMin;
    expect(afterWidth).toBeGreaterThan(beforeWidth);
  });

  it('should zoom out when "_" is pressed', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '_', bubbles: true }));
    const after = controller.getViewport();
    expect(after.xMax - after.xMin).toBeGreaterThan(beforeWidth);
  });

  it('should reset when "r" is pressed', () => {
    controller.setViewport({ xMin: -99, xMax: 99, yMin: -99, yMax: 99 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    expect(controller.getViewport()).toEqual(DEFAULT_VIEWPORT);
  });

  it('should reset when "R" is pressed', () => {
    controller.setViewport({ xMin: -99, xMax: 99, yMin: -99, yMax: 99 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', bubbles: true }));
    expect(controller.getViewport()).toEqual(DEFAULT_VIEWPORT);
  });

  it('should shift exactly 10% of the viewport width for ArrowLeft', () => {
    const before = controller.getViewport();
    const panAmount = (before.xMax - before.xMin) * 0.1;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const after = controller.getViewport();
    expect(after.xMin).toBeCloseTo(before.xMin - panAmount, 10);
    expect(after.xMax).toBeCloseTo(before.xMax - panAmount, 10);
  });

  it('should emit a "pan" event on arrow key presses', () => {
    const handler = vi.fn();
    controller.addEventListener('pan', handler);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].type).toBe('pan');
  });

  it('should emit a "zoom" event on +/- key presses', () => {
    const handler = vi.fn();
    controller.addEventListener('zoom', handler);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].type).toBe('zoom');
  });

  it('should emit a "reset" event on "r" key press', () => {
    const handler = vi.fn();
    controller.addEventListener('reset', handler);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].type).toBe('reset');
  });

  it('should preserve the viewport width when panning with arrow keys', () => {
    const before = controller.getViewport();
    const beforeWidth = before.xMax - before.xMin;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    const after = controller.getViewport();
    expect(after.xMax - after.xMin).toBeCloseTo(beforeWidth, 10);
  });
});

// ---------------------------------------------------------------------------
// Context menu suppression
// ---------------------------------------------------------------------------

describe('context menu', () => {
  let canvas: HTMLCanvasElement;
  let controller: Plot2DController;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    controller = new Plot2DController(canvas, { ...DEFAULT_VIEWPORT });
    controller.enable();
  });

  afterEach(() => {
    controller.disable();
    document.body.removeChild(canvas);
  });

  it('should call preventDefault on the contextmenu event', () => {
    const event = new MouseEvent('contextmenu', { bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    canvas.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
  });
});
