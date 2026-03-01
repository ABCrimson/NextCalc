'use client';

/**
 * React component for 2D mathematical plots
 * Supports Cartesian, polar, and parametric coordinates
 * Fix 1: Debounced auto-refresh when config (function expressions) changes
 * Fix 2: Axis labels receive live viewport state so they rescale on zoom/pan
 * Fix 3: Polar wheel zoom via rRange scaling
 * Fix 4: Annotation system — text labels and arrows via HTML overlay + toolbar
 * @module components/plots/Plot2D
 */

import {
  type ControlEvent,
  type Plot2DCartesianConfig,
  Plot2DController,
  type Plot2DParametricConfig,
  type Plot2DPolarConfig,
  type PlotConfig,
  WebGL2DRenderer,
} from '@nextcalc/plot-engine';
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { type Annotation, Annotations, type Viewport } from './Annotations';
import { type AnnotationMode, AnnotationToolbar } from './AnnotationToolbar';
import { AxisLabels } from './AxisLabels';
import { PolarAxisLabels } from './PolarAxisLabels';

export interface Plot2DProps {
  config: PlotConfig;
  width?: number;
  height?: number;
  className?: string;
  enableInteractions?: boolean;
  onViewportChange?: (viewport: { xMin: number; xMax: number; yMin: number; yMax: number }) => void;
  /** Callback fired when the canvas element is ready. Use this to access the canvas for export. */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  /** When true, renders the annotation toolbar and overlay. Defaults to false. */
  enableAnnotations?: boolean;
}

/**
 * 2D Plot component with WebGL rendering
 */
export function Plot2D({
  config,
  width = 800,
  height = 600,
  className = '',
  enableInteractions = true,
  onViewportChange,
  onCanvasReady,
  enableAnnotations = false,
}: Plot2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGL2DRenderer | null>(null);
  const controllerRef = useRef<Plot2DController | null>(null);

  // Stable ref so the initialization effect can call the latest callback
  // without the effect needing to re-run when the callback identity changes.
  const onCanvasReadyRef = useRef(onCanvasReady);
  onCanvasReadyRef.current = onCanvasReady;

  // Keep a stable ref to onViewportChange so the controller effect does not
  // have to restart every time the parent re-renders.
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [canvasSize, setCanvasSize] = useState({ width, height });

  // --- Annotation system state ---
  const annotationIdCounter = useRef(0);
  const instanceId = useId();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('idle');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  // For arrow placement: stores the tail point (math-space) after first click.
  const arrowTailRef = useRef<{ x: number; y: number } | null>(null);

  // --- Fix 2: live viewport state drives AxisLabels so ticks update on zoom/pan ---
  const initialCartesianViewport =
    config.type === '2d-cartesian' || config.type === '2d-parametric'
      ? (config as Plot2DCartesianConfig | Plot2DParametricConfig).viewport
      : { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

  const [liveViewport, setLiveViewport] = useState(initialCartesianViewport);

  // --- Fix 3: live polar rRange state so zoom works on polar plots ---
  const initialRRange =
    config.type === '2d-polar'
      ? ((config as Plot2DPolarConfig).rRange ?? { min: 0, max: 5 })
      : { min: 0, max: 5 };

  const [liveRRange, setLiveRRange] = useState(initialRRange);

  // When the config itself changes externally (e.g. preset switch) reset live
  // viewport to whatever the new config specifies.
  useEffect(() => {
    if (config.type === '2d-cartesian' || config.type === '2d-parametric') {
      setLiveViewport((config as Plot2DCartesianConfig | Plot2DParametricConfig).viewport);
    }
    if (config.type === '2d-polar') {
      setLiveRRange((config as Plot2DPolarConfig).rRange ?? { min: 0, max: 5 });
    }
  }, [config]);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initRenderer = async () => {
      try {
        const renderer = new WebGL2DRenderer(canvas);
        await renderer.initialize();

        rendererRef.current = renderer;
        setIsReady(true);
        setError(null);
        onCanvasReadyRef.current?.(canvas);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize renderer');
        console.error('Renderer initialization error:', err);
      }
    };

    initRenderer();

    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  // Stable render helper used by all re-render paths
  const renderWithConfig = useCallback((cfg: PlotConfig) => {
    if (!rendererRef.current) return;
    startTransition(() => {
      rendererRef.current!.render(cfg);
    });
  }, []);

  // --- Fix 3: polar wheel zoom ---
  // We attach a wheel listener directly on the canvas for polar plots.
  // rRange is kept in state; on each wheel event we scale rRange and re-render.
  const liveRRangeRef = useRef(liveRRange);
  liveRRangeRef.current = liveRRange;

  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!isReady || !enableInteractions || config.type !== '2d-polar') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePolarWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      const current = liveRRangeRef.current;
      const newMax = Math.max(0.5, current.max * factor);
      const newRRange = { min: current.min, max: newMax };
      setLiveRRange(newRRange);

      const updatedConfig: Plot2DPolarConfig = {
        ...(configRef.current as Plot2DPolarConfig),
        rRange: newRRange,
      };
      renderWithConfig(updatedConfig);
    };

    canvas.addEventListener('wheel', handlePolarWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handlePolarWheel);
    };
  }, [isReady, enableInteractions, config.type, renderWithConfig]);

  // --- Annotation click handler ---
  // Converts a canvas click to math-space coordinates and creates the
  // appropriate annotation or advances the arrow-placement state machine.
  // We keep liveViewport in a ref to avoid recreating the listener every frame.
  const liveViewportRef = useRef(liveViewport);
  liveViewportRef.current = liveViewport;

  const annotationModeRef = useRef(annotationMode);
  annotationModeRef.current = annotationMode;

  const handleCanvasAnnotationClick = useCallback(
    (e: MouseEvent) => {
      const currentMode = annotationModeRef.current;
      if (currentMode === 'idle') return;
      if (e.button !== 0) return; // left-click only

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const vp = liveViewportRef.current;

      // Convert pixel -> math-space (Y is inverted).
      const mx = vp.xMin + (px / rect.width) * (vp.xMax - vp.xMin);
      const my = vp.yMax - (py / rect.height) * (vp.yMax - vp.yMin);

      if (currentMode === 'placing-label') {
        const newId = `${instanceId}-ann-${++annotationIdCounter.current}`;
        const defaultText = `(${mx.toFixed(2)}, ${my.toFixed(2)})`;
        const newAnnotation: Annotation = {
          kind: 'text',
          id: newId,
          x: mx,
          y: my,
          text: defaultText,
          color: '#06b6d4',
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
        setSelectedAnnotationId(newId);
        setAnnotationMode('idle');
        return;
      }

      if (currentMode === 'placing-arrow-tail') {
        // Store the tail and wait for the head click.
        arrowTailRef.current = { x: mx, y: my };
        setAnnotationMode('placing-arrow-head');
        return;
      }

      if (currentMode === 'placing-arrow-head') {
        const tail = arrowTailRef.current;
        if (!tail) {
          setAnnotationMode('idle');
          return;
        }
        const newId = `${instanceId}-ann-${++annotationIdCounter.current}`;
        const newAnnotation: Annotation = {
          kind: 'arrow',
          id: newId,
          x1: tail.x,
          y1: tail.y,
          x2: mx,
          y2: my,
          color: '#a78bfa',
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
        setSelectedAnnotationId(newId);
        arrowTailRef.current = null;
        setAnnotationMode('idle');
        return;
      }
    },
    [instanceId],
  );

  // Attach / detach the annotation click listener on the canvas.
  useEffect(() => {
    if (!isReady || !enableAnnotations) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', handleCanvasAnnotationClick);
    return () => {
      canvas.removeEventListener('click', handleCanvasAnnotationClick);
    };
  }, [isReady, enableAnnotations, handleCanvasAnnotationClick]);

  // Delete the selected annotation when the Delete / Backspace key is pressed
  // and no text input is focused.
  useEffect(() => {
    if (!enableAnnotations) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!selectedAnnotationId) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [enableAnnotations, selectedAnnotationId]);

  // Annotation management callbacks
  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedAnnotationId((prev) => (prev === id ? null : prev));
  }, []);

  const handleClearAllAnnotations = useCallback(() => {
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setAnnotationMode('idle');
  }, []);

  // Initialize Cartesian/Parametric interaction controller
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isReady || !enableInteractions) return;
    // Polar mode uses its own wheel handler above; no controller needed
    if (config.type === '2d-polar') return;

    const viewport =
      config.type === '2d-cartesian'
        ? config.viewport
        : config.type === '2d-parametric'
          ? config.viewport
          : {
              xMin: -10,
              xMax: 10,
              yMin: -10,
              yMax: 10,
            };

    const controller = new Plot2DController(canvas, viewport);
    controller.enable();

    // Listen for viewport changes from pan/zoom/reset
    const handleViewportChange = (event: ControlEvent) => {
      const { viewport: newVp } = event.data as {
        viewport: { xMin: number; xMax: number; yMin: number; yMax: number };
      };

      // --- Fix 2: update live viewport so AxisLabels immediately re-render ---
      setLiveViewport(newVp);

      onViewportChangeRef.current?.(newVp);

      if (rendererRef.current) {
        startTransition(() => {
          const updatedConfig = { ...configRef.current, viewport: newVp } as PlotConfig;
          rendererRef.current!.render(updatedConfig);
        });
      }
    };

    controller.addEventListener('pan', handleViewportChange);
    controller.addEventListener('zoom', handleViewportChange);
    controller.addEventListener('reset', handleViewportChange);

    controllerRef.current = controller;

    return () => {
      controller.disable();
      controllerRef.current = null;
    };
    // We intentionally omit `config` from deps here: we want to create the
    // controller once per isReady/enableInteractions change (not on every
    // config re-render) and read config via the stable ref inside the handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, enableInteractions, config.type]);

  // --- Fix 1: Debounced auto-refresh when config changes ---
  // Use a ref to hold the pending timer so we can clear it on cleanup.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isReady || !rendererRef.current) return;

    // Clear any pending debounce
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      try {
        startTransition(() => {
          rendererRef.current!.render(config);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render plot');
        console.error('Render error:', err);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [isReady, config]);

  // Handle window resize with ResizeObserver for better performance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: containerWidth, height: containerHeight } = entry.contentRect;

        // Ensure minimum size
        const newWidth = Math.max(containerWidth, 320);
        const newHeight = Math.max(containerHeight, 240);

        setCanvasSize({ width: newWidth, height: newHeight });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Handle canvas resize and re-render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const dpr = window.devicePixelRatio || 1;
    const renderWidth = canvasSize.width * dpr;
    const renderHeight = canvasSize.height * dpr;

    // Only resize if dimensions actually changed to avoid unnecessary work
    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      canvas.style.width = `${canvasSize.width}px`;
      canvas.style.height = `${canvasSize.height}px`;

      rendererRef.current.resize(renderWidth, renderHeight);

      if (isReady) {
        startTransition(() => {
          rendererRef.current!.render(config);
        });
      }
    }
  }, [canvasSize.width, canvasSize.height, isReady, config]);

  // Derive the canvas cursor style based on annotation mode.
  const canvasCursor =
    annotationMode === 'placing-label'
      ? 'crosshair'
      : annotationMode === 'placing-arrow-tail' || annotationMode === 'placing-arrow-head'
        ? 'cell'
        : undefined;

  // The annotation overlay needs the live Cartesian/Parametric viewport.
  // For polar plots annotations use a synthetic ±rMax viewport so the math
  // coordinates still map sensibly onto screen pixels.
  const annotationViewport: Viewport =
    config.type === '2d-cartesian' || config.type === '2d-parametric'
      ? liveViewport
      : {
          xMin: -liveRRange.max,
          xMax: liveRRange.max,
          yMin: -liveRRange.max,
          yMax: liveRRange.max,
        };

  return (
    <div ref={containerRef} className={`relative w-full h-full min-h-[400px] ${className}`}>
      {/* ------------------------------------------------------------------ */}
      {/* Annotation toolbar — rendered above the canvas, inside the wrapper  */}
      {/* ------------------------------------------------------------------ */}
      {enableAnnotations && isReady && !error && (
        <div className="absolute top-2 left-2 right-2 z-30 pointer-events-none">
          <div className="pointer-events-auto">
            <div
              className="
              px-3 py-2 rounded-xl
              bg-background/80 backdrop-blur-md
              border border-border
              shadow-[0_4px_16px_rgba(0,0,0,0.4)]
            "
            >
              <AnnotationToolbar
                mode={annotationMode}
                onModeChange={setAnnotationMode}
                onClearAll={handleClearAllAnnotations}
                annotationCount={annotations.length}
              />
            </div>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 w-full h-full border border-border rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.15)]"
        style={{
          width: '100%',
          height: '100%',
          ...(canvasCursor ? { cursor: canvasCursor } : {}),
        }}
        aria-label={
          config.type === '2d-cartesian' && config.title ? config.title : '2D mathematical plot'
        }
        role="img"
      />

      {/* Axis labels overlay - Cartesian/Parametric */}
      {/* Fix 2: pass liveViewport instead of config.viewport so labels update on pan/zoom */}
      {isReady && !error && (config.type === '2d-cartesian' || config.type === '2d-parametric') && (
        <AxisLabels
          viewport={liveViewport}
          width={canvasSize.width}
          height={canvasSize.height}
          {...(config.type === '2d-cartesian' && {
            xAxisConfig: (config as Plot2DCartesianConfig).xAxis,
            yAxisConfig: (config as Plot2DCartesianConfig).yAxis,
          })}
        />
      )}

      {/* Polar axis labels overlay */}
      {/* Fix 3: pass liveRRange so labels update on zoom */}
      {isReady && !error && config.type === '2d-polar' && (
        <PolarAxisLabels
          rRange={liveRRange}
          width={canvasSize.width}
          height={canvasSize.height}
          showDegrees={false}
          radialSteps={4}
          angularSteps={12}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Annotation overlay — Fix 4                                          */}
      {/* ------------------------------------------------------------------ */}
      {enableAnnotations && isReady && !error && annotations.length > 0 && (
        <Annotations
          annotations={annotations}
          viewport={annotationViewport}
          width={canvasSize.width}
          height={canvasSize.height}
          selectedId={selectedAnnotationId}
          onSelect={setSelectedAnnotationId}
          onDelete={handleDeleteAnnotation}
        />
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/90 rounded-lg border border-red-800">
          <div className="text-center p-4">
            <p className="text-red-300 font-semibold">Rendering Error</p>
            <p className="text-sm text-red-400 mt-2">{error}</p>
          </div>
        </div>
      )}

      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg border border-border">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto" />
            <p className="text-sm text-foreground/80 mt-2">Initializing renderer...</p>
          </div>
        </div>
      )}

      {isPending && (
        <div className="absolute top-2 right-2 bg-blue-950/80 text-blue-300 px-2 py-1 rounded text-xs border border-blue-700">
          Rendering...
        </div>
      )}

      {enableInteractions && isReady && (
        <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm p-2 rounded shadow-lg text-xs text-foreground/80 border border-border">
          {config.type === '2d-polar'
            ? 'Scroll to zoom | Drag to pan | R to reset'
            : 'Drag to pan | Scroll to zoom | R to reset'}
        </div>
      )}
    </div>
  );
}
