/**
 * Interactive controls for 2D plots
 * Handles zoom, pan, and touch interactions
 * @module controls/interactions
 */

import type { ControlEvent, IInteractionController, Viewport } from '../types/index';

export interface InteractionState {
  viewport: Viewport;
  isPanning: boolean;
  isZooming: boolean;
  lastMouseX: number;
  lastMouseY: number;
  lastTouchDistance: number;
}

/**
 * 2D plot interaction controller
 */
export class Plot2DController implements IInteractionController {
  private canvas: HTMLCanvasElement;
  private state: InteractionState;
  private initialViewport: Viewport;
  private eventListeners: Map<string, Set<(event: ControlEvent) => void>> = new Map();
  private enabled = false;

  // Bound event handlers for proper cleanup
  private boundHandlers = {
    mouseDown: this.handleMouseDown.bind(this),
    mouseMove: this.handleMouseMove.bind(this),
    mouseUp: this.handleMouseUp.bind(this),
    wheel: this.handleWheel.bind(this),
    touchStart: this.handleTouchStart.bind(this),
    touchMove: this.handleTouchMove.bind(this),
    touchEnd: this.handleTouchEnd.bind(this),
    keyDown: this.handleKeyDown.bind(this),
    contextMenu: this.handleContextMenu.bind(this),
  };

  constructor(canvas: HTMLCanvasElement, initialViewport: Viewport) {
    this.canvas = canvas;
    this.initialViewport = { ...initialViewport };
    this.state = {
      viewport: { ...initialViewport },
      isPanning: false,
      isZooming: false,
      lastMouseX: 0,
      lastMouseY: 0,
      lastTouchDistance: 0,
    };
  }

  /**
   * Enables interaction controls
   */
  enable(): void {
    if (this.enabled) return;

    this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
    this.canvas.addEventListener('mousemove', this.boundHandlers.mouseMove);
    this.canvas.addEventListener('mouseup', this.boundHandlers.mouseUp);
    this.canvas.addEventListener('mouseleave', this.boundHandlers.mouseUp);
    this.canvas.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
    this.canvas.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundHandlers.touchEnd);
    this.canvas.addEventListener('contextmenu', this.boundHandlers.contextMenu);
    window.addEventListener('keydown', this.boundHandlers.keyDown);

    this.canvas.style.cursor = 'crosshair';
    this.enabled = true;
  }

  /**
   * Disables interaction controls
   */
  disable(): void {
    if (!this.enabled) return;

    this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
    this.canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove);
    this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp);
    this.canvas.removeEventListener('mouseleave', this.boundHandlers.mouseUp);
    this.canvas.removeEventListener('wheel', this.boundHandlers.wheel);
    this.canvas.removeEventListener('touchstart', this.boundHandlers.touchStart);
    this.canvas.removeEventListener('touchmove', this.boundHandlers.touchMove);
    this.canvas.removeEventListener('touchend', this.boundHandlers.touchEnd);
    this.canvas.removeEventListener('contextmenu', this.boundHandlers.contextMenu);
    window.removeEventListener('keydown', this.boundHandlers.keyDown);

    this.canvas.style.cursor = 'default';
    this.enabled = false;
  }

  /**
   * Resets viewport to initial state
   */
  reset(): void {
    this.state.viewport = { ...this.initialViewport };
    this.emit('reset', { viewport: this.state.viewport });
  }

  /**
   * Adds an event listener
   */
  addEventListener(type: string, handler: (event: ControlEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(handler);
  }

  /**
   * Removes an event listener
   */
  removeEventListener(type: string, handler: (event: ControlEvent) => void): void {
    const handlers = this.eventListeners.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emits an event to all listeners
   */
  private emit(type: string, data: unknown): void {
    const handlers = this.eventListeners.get(type);
    if (handlers) {
      const event: ControlEvent = { type: type as ControlEvent['type'], data };
      handlers.forEach((handler) => handler(event));
    }
  }

  /**
   * Handles mouse down event (start panning)
   */
  private handleMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      // Left click
      this.state.isPanning = true;
      this.state.lastMouseX = e.clientX;
      this.state.lastMouseY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  /**
   * Handles mouse move event (pan)
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.state.isPanning) return;

    const dx = e.clientX - this.state.lastMouseX;
    const dy = e.clientY - this.state.lastMouseY;

    // Convert pixel delta to world coordinates
    const worldWidth = this.state.viewport.xMax - this.state.viewport.xMin;
    const worldHeight = this.state.viewport.yMax - this.state.viewport.yMin;
    const worldDx = -(dx / this.canvas.width) * worldWidth;
    const worldDy = (dy / this.canvas.height) * worldHeight;

    // Update viewport
    this.state.viewport.xMin += worldDx;
    this.state.viewport.xMax += worldDx;
    this.state.viewport.yMin += worldDy;
    this.state.viewport.yMax += worldDy;

    this.state.lastMouseX = e.clientX;
    this.state.lastMouseY = e.clientY;

    this.emit('pan', { viewport: this.state.viewport, dx: worldDx, dy: worldDy });
  }

  /**
   * Handles mouse up event (stop panning)
   */
  private handleMouseUp(): void {
    if (this.state.isPanning) {
      this.state.isPanning = false;
      this.canvas.style.cursor = 'crosshair';
    }
  }

  /**
   * Handles mouse wheel event (zoom)
   */
  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    // Get mouse position relative to canvas
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width;
    const mouseY = 1 - (e.clientY - rect.top) / rect.height; // Flip y

    // Calculate zoom factor
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

    // Zoom towards mouse position
    this.zoomViewport(mouseX, mouseY, zoomFactor);

    this.emit('zoom', { viewport: this.state.viewport, factor: zoomFactor });
  }

  /**
   * Handles touch start event
   */
  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    if (e.touches.length === 1) {
      // Single touch: start panning
      this.state.isPanning = true;
      this.state.lastMouseX = e.touches[0]!.clientX;
      this.state.lastMouseY = e.touches[0]!.clientY;
    } else if (e.touches.length === 2) {
      // Two touches: start pinch zoom
      this.state.isZooming = true;
      this.state.lastTouchDistance = this.getTouchDistance(e.touches);
    }
  }

  /**
   * Handles touch move event
   */
  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    if (e.touches.length === 1 && this.state.isPanning) {
      // Pan
      const dx = e.touches[0]!.clientX - this.state.lastMouseX;
      const dy = e.touches[0]!.clientY - this.state.lastMouseY;

      const worldWidth = this.state.viewport.xMax - this.state.viewport.xMin;
      const worldHeight = this.state.viewport.yMax - this.state.viewport.yMin;
      const worldDx = -(dx / this.canvas.width) * worldWidth;
      const worldDy = (dy / this.canvas.height) * worldHeight;

      this.state.viewport.xMin += worldDx;
      this.state.viewport.xMax += worldDx;
      this.state.viewport.yMin += worldDy;
      this.state.viewport.yMax += worldDy;

      this.state.lastMouseX = e.touches[0]!.clientX;
      this.state.lastMouseY = e.touches[0]!.clientY;

      this.emit('pan', { viewport: this.state.viewport, dx: worldDx, dy: worldDy });
    } else if (e.touches.length === 2 && this.state.isZooming) {
      // Pinch zoom
      const currentDistance = this.getTouchDistance(e.touches);
      const zoomFactor = this.state.lastTouchDistance / currentDistance;

      // Zoom towards center of touches
      const centerX =
        ((e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 -
          this.canvas.getBoundingClientRect().left) /
        this.canvas.width;
      const centerY =
        1 -
        ((e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 -
          this.canvas.getBoundingClientRect().top) /
          this.canvas.height;

      this.zoomViewport(centerX, centerY, zoomFactor);

      this.state.lastTouchDistance = currentDistance;

      this.emit('zoom', { viewport: this.state.viewport, factor: zoomFactor });
    }
  }

  /**
   * Handles touch end event
   */
  private handleTouchEnd(): void {
    this.state.isPanning = false;
    this.state.isZooming = false;
  }

  /**
   * Handles keyboard events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Only handle if canvas is focused or in document
    if (!document.activeElement?.contains(this.canvas) && document.activeElement !== this.canvas) {
      return;
    }

    const panAmount = 0.1; // 10% of viewport
    const worldWidth = this.state.viewport.xMax - this.state.viewport.xMin;
    const worldHeight = this.state.viewport.yMax - this.state.viewport.yMin;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.state.viewport.xMin -= worldWidth * panAmount;
        this.state.viewport.xMax -= worldWidth * panAmount;
        this.emit('pan', { viewport: this.state.viewport });
        break;

      case 'ArrowRight':
        e.preventDefault();
        this.state.viewport.xMin += worldWidth * panAmount;
        this.state.viewport.xMax += worldWidth * panAmount;
        this.emit('pan', { viewport: this.state.viewport });
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.state.viewport.yMin += worldHeight * panAmount;
        this.state.viewport.yMax += worldHeight * panAmount;
        this.emit('pan', { viewport: this.state.viewport });
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.state.viewport.yMin -= worldHeight * panAmount;
        this.state.viewport.yMax -= worldHeight * panAmount;
        this.emit('pan', { viewport: this.state.viewport });
        break;

      case '+':
      case '=':
        e.preventDefault();
        this.zoomViewport(0.5, 0.5, 0.9);
        this.emit('zoom', { viewport: this.state.viewport, factor: 0.9 });
        break;

      case '-':
      case '_':
        e.preventDefault();
        this.zoomViewport(0.5, 0.5, 1.1);
        this.emit('zoom', { viewport: this.state.viewport, factor: 1.1 });
        break;

      case 'r':
      case 'R':
        e.preventDefault();
        this.reset();
        break;
    }
  }

  /**
   * Prevents context menu
   */
  private handleContextMenu(e: Event): void {
    e.preventDefault();
  }

  /**
   * Zooms viewport towards a point
   */
  private zoomViewport(normalizedX: number, normalizedY: number, factor: number): void {
    const worldX =
      this.state.viewport.xMin +
      normalizedX * (this.state.viewport.xMax - this.state.viewport.xMin);
    const worldY =
      this.state.viewport.yMin +
      normalizedY * (this.state.viewport.yMax - this.state.viewport.yMin);

    const newWidth = (this.state.viewport.xMax - this.state.viewport.xMin) * factor;
    const newHeight = (this.state.viewport.yMax - this.state.viewport.yMin) * factor;

    this.state.viewport.xMin = worldX - normalizedX * newWidth;
    this.state.viewport.xMax = worldX + (1 - normalizedX) * newWidth;
    this.state.viewport.yMin = worldY - normalizedY * newHeight;
    this.state.viewport.yMax = worldY + (1 - normalizedY) * newHeight;
  }

  /**
   * Gets distance between two touch points
   */
  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0]!.clientX - touches[1]!.clientX;
    const dy = touches[0]!.clientY - touches[1]!.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Disposes the controller, removing all event listeners and clearing handlers.
   */
  dispose(): void {
    this.disable();
    this.eventListeners.clear();
  }

  /**
   * TC39 Explicit Resource Management — enables `using controller = ...`
   */
  [Symbol.dispose](): void {
    this.dispose();
  }

  /**
   * Gets current viewport
   */
  getViewport(): Viewport {
    return { ...this.state.viewport };
  }

  /**
   * Sets viewport
   */
  setViewport(viewport: Viewport): void {
    this.state.viewport = { ...viewport };
    this.emit('pan', { viewport: this.state.viewport });
  }
}
