'use client';

/**
 * React component for 3D mathematical plots
 * Lazy-loads Three.js for optimal bundle size
 * @module components/plots/Plot3D
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import type { PlotConfig, IRenderer } from '@nextcalc/plot-engine';

/** Minimal interface for OrbitControls used in this component */
interface OrbitControlsLike {
  update(): void;
  dispose(): void;
  enableDamping: boolean;
  dampingFactor: number;
  zoomSpeed: number;
  screenSpacePanning: boolean;
  minDistance: number;
  maxDistance: number;
}

export interface Plot3DProps {
  config: PlotConfig;
  width?: number;
  height?: number;
  className?: string;
  enableControls?: boolean;
  /**
   * Called once the WebGL3DRenderer has been created and initialized.
   * Receives the renderer instance so callers can invoke methods like
   * `setEnvMapEnabled()` and `setSsaoEnabled()` directly.
   */
  onRendererReady?: (renderer: RendererWithExtras) => void;
}

/**
 * Intersection type exposing the extended methods added to WebGL3DRenderer
 * (HDR env map and SSAO toggles) in addition to the base IRenderer contract.
 * Using an intersection rather than importing WebGL3DRenderer directly keeps
 * this component free of the Three.js import chain at module-evaluation time.
 */
export interface RendererWithExtras extends IRenderer {
  setEnvMapEnabled(
    enabled: boolean,
    config?: {
      envIntensity?: number;
      backgroundIntensity?: number;
      theme?: import('@nextcalc/plot-engine').SpaceTheme;
      resolution?: import('@nextcalc/plot-engine').CubemapResolution;
    },
  ): void;
  setSsaoEnabled(
    enabled: boolean,
    config?: { radius?: number; intensity?: number },
  ): void;
  readonly envMapEnabled: boolean;
  readonly ssaoEnabled: boolean;
}

/**
 * 3D Plot component with Three.js rendering (lazy-loaded)
 */
export function Plot3D({
  config,
  width = 800,
  height = 600,
  className = '',
  enableControls = true,
  onRendererReady,
}: Plot3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<IRenderer | null>(null);
  const controlsRef = useRef<OrbitControlsLike | null>(null);
  const configRef = useRef<PlotConfig>(config); // Store latest config
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const animationFrameRef = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width, height });

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initRenderer = async () => {
      try {
        // Lazy-load Three.js renderer
        const { WebGL3DRenderer } = await import('@nextcalc/plot-engine').then((m) => m.loadWebGL3DRenderer());

        const renderer = new WebGL3DRenderer(canvas);
        await renderer.initialize();

        rendererRef.current = renderer;

        // Notify the parent that the renderer is ready so it can call
        // extended methods (setEnvMapEnabled, setSsaoEnabled, etc.)
        if (onRendererReady) {
          onRendererReady(renderer as RendererWithExtras);
        }

        // Load OrbitControls if enabled
        if (enableControls) {
          const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

          const camera = renderer.getCamera();
          const threeRenderer = renderer.getThreeRenderer();

          if (camera && threeRenderer) {
            const controls = new OrbitControls(camera, threeRenderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.12;
            controls.zoomSpeed = 2.5;
            controls.screenSpacePanning = true;
            controls.minDistance = 1;
            controls.maxDistance = 400;

            controlsRef.current = controls;

            // Animation loop for controls
            const animate = () => {
              controls.update();
              renderer.render(configRef.current); // Use latest config from ref
              animationFrameRef.current = requestAnimationFrame(animate);
            };

            animate();
          }
        }

        setIsReady(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize 3D renderer');
        console.error('3D renderer initialization error:', err);
      }
    };

    initRenderer();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [enableControls, onRendererReady]);

  // Update config ref and render when config changes
  useEffect(() => {
    configRef.current = config; // Keep ref synchronized

    if (!isReady || !rendererRef.current) return;

    try {
      startTransition(() => {
        rendererRef.current?.render(config);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render 3D plot');
      console.error('3D render error:', err);
    }
  }, [isReady, config]);

  // Handle window resize with ResizeObserver
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

    // Only resize if dimensions actually changed
    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      canvas.style.width = `${canvasSize.width}px`;
      canvas.style.height = `${canvasSize.height}px`;

      rendererRef.current?.resize(renderWidth, renderHeight);

      if (isReady) {
        startTransition(() => {
          rendererRef.current?.render(config);
        });
      }
    }
  }, [canvasSize.width, canvasSize.height, isReady, config]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 w-full h-full border border-border rounded-lg shadow-[0_0_20px_rgba(168,85,247,0.15)]"
        style={{ width: '100%', height: '100%' }}
        aria-label={config.type === '3d-surface' && config.title ? config.title : '3D mathematical plot'}
        role="img"
      />

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
            <p className="text-sm text-foreground/80 mt-2">Loading 3D renderer...</p>
          </div>
        </div>
      )}

      {isPending && (
        <div className="absolute top-2 right-2 bg-blue-950/80 text-blue-300 px-2 py-1 rounded text-xs border border-blue-700">
          Rendering...
        </div>
      )}

      {enableControls && isReady && (
        <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm p-2 rounded shadow-lg text-xs text-foreground/80 border border-border">
          <p>Drag to rotate | Scroll to zoom | Right-drag to pan</p>
        </div>
      )}
    </div>
  );
}
