'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Cpu, Zap } from 'lucide-react';
import {
  type MouseEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type BifurcationGPUParams,
  type BifurcationMapType,
  type BifurcationPoint,
  computeBifurcationGPU,
} from './webgpu-bifurcation';

export type { BifurcationPoint, BifurcationMapType };

interface BifurcationDiagramRendererProps {
  data: BifurcationPoint[];
  /**
   * When true the component manages its own GPU-accelerated data generation
   * and ignores the `data` prop (the chaos page passes an initial CPU dataset;
   * we supersede it once the GPU result arrives).
   */
  enableGPU?: boolean;
  /** GPU params used when enableGPU=true. Defaults to the standard full diagram. */
  gpuParams?: BifurcationGPUParams;
}

const MARGIN = { top: 50, right: 48, bottom: 62, left: 72 } as const;

/**
 * High-performance Bifurcation Diagram Renderer.
 *
 * Rendering stack (in priority order):
 *
 * 1. **WebGPU compute** (when `enableGPU` is true and the browser supports it):
 *    A WGSL compute shader runs ALL r-values simultaneously on the GPU,
 *    achieving 100-1000x speedup versus the CPU loop.  The GPU result
 *    completely replaces the `data` prop once available.
 *
 * 2. **Canvas 2D ImageData** (CPU fallback):
 *    Pixel-level writes to a Uint8ClampedArray, flushed with a single
 *    putImageData() call — typically 20-50x faster than arc() per point.
 *
 * Visual:
 * - Multi-stop hue gradient: emerald → cyan → indigo → violet
 * - Soft 3×3 additive-blend glow per point for natural bloom.
 * - Zoom + pan via scroll wheel / pinch / drag.
 * - GPU/CPU backend badge in the top-right corner.
 */
// ── Map metadata ─────────────────────────────────────────────────────────────

interface MapMeta {
  label: string;
  defaultRMin: number;
  defaultRMax: number;
  description: string;
}

const MAP_META: Record<BifurcationMapType, MapMeta> = {
  logistic: {
    label: 'Logistic Map',
    defaultRMin: 2.5,
    defaultRMax: 4.0,
    description: 'x_{n+1} = r·x·(1−x)',
  },
  sine: {
    label: 'Sine Map',
    defaultRMin: 0.0,
    defaultRMax: 1.0,
    description: 'x_{n+1} = r·sin(π·x)',
  },
  tent: {
    label: 'Tent Map',
    defaultRMin: 0.0,
    defaultRMax: 2.0,
    description: 'x_{n+1} = r·min(x, 1−x)',
  },
  cubic: {
    label: 'Cubic Map',
    defaultRMin: 0.0,
    defaultRMax: 3.0,
    description: 'x_{n+1} = r·x − x³',
  },
  gauss: {
    label: 'Gauss Map',
    defaultRMin: -1,
    defaultRMax: 1.0,
    description: 'x_{n+1} = exp(−αx²) + β',
  },
  circle: {
    label: 'Circle Map',
    defaultRMin: 0.0,
    defaultRMax: 3.0,
    description: 'x_{n+1} = x + Ω − k/(2π)·sin(2πx)',
  },
};

const MAP_TYPES: BifurcationMapType[] = ['logistic', 'sine', 'tent', 'cubic', 'gauss', 'circle'];

// ── Presets ──────────────────────────────────────────────────────────────────

interface BifurcationPreset {
  name: string;
  rMin: number;
  rMax: number;
  xMin: number;
  xMax: number;
  equation: string;
  mapType: BifurcationMapType;
  x0: number;
}

const BIFURCATION_PRESETS: readonly BifurcationPreset[] = [
  {
    name: 'Logistic Map (Classic)',
    rMin: 2.5,
    rMax: 4.0,
    xMin: 0,
    xMax: 1,
    equation: 'r*x*(1-x)',
    mapType: 'logistic',
    x0: 0.5,
  },
  {
    name: 'Logistic Map (Full Range)',
    rMin: 0,
    rMax: 4.0,
    xMin: 0,
    xMax: 1,
    equation: 'r*x*(1-x)',
    mapType: 'logistic',
    x0: 0.5,
  },
  {
    name: 'Period-Doubling Cascade',
    rMin: 3.4,
    rMax: 3.6,
    xMin: 0.3,
    xMax: 0.9,
    equation: 'r*x*(1-x)',
    mapType: 'logistic',
    x0: 0.5,
  },
  {
    name: 'Onset of Chaos',
    rMin: 3.54,
    rMax: 3.58,
    xMin: 0.34,
    xMax: 0.9,
    equation: 'r*x*(1-x)',
    mapType: 'logistic',
    x0: 0.5,
  },
  {
    name: 'Band-Merging Region',
    rMin: 3.57,
    rMax: 3.83,
    xMin: 0.1,
    xMax: 0.95,
    equation: 'r*x*(1-x)',
    mapType: 'logistic',
    x0: 0.5,
  },
  {
    name: 'Sine Map',
    rMin: 0,
    rMax: 1,
    xMin: 0,
    xMax: 1,
    equation: 'r*sin(pi*x)',
    mapType: 'sine',
    x0: 0.5,
  },
  {
    name: 'Cubic Map',
    rMin: 0,
    rMax: 3,
    xMin: -2,
    xMax: 2,
    equation: 'r*x-x^3',
    mapType: 'cubic',
    x0: 0.5,
  },
  {
    name: 'Tent Map',
    rMin: 0,
    rMax: 2,
    xMin: 0,
    xMax: 1,
    equation: 'r*min(x,1-x)',
    mapType: 'tent',
    x0: 0.5,
  },
  {
    name: 'Gauss Iterated Map',
    rMin: -1,
    rMax: 1,
    xMin: -1,
    xMax: 1,
    equation: 'exp(-alpha*x^2)+beta',
    mapType: 'gauss',
    x0: 0.5,
  },
  {
    name: 'Circle Map',
    rMin: 0,
    rMax: 3,
    xMin: 0,
    xMax: 1,
    equation: 'x+omega-k/(2*pi)*sin(2*pi*x)',
    mapType: 'circle',
    x0: 0.5,
  },
];

/**
 * CPU fallback that evaluates a single iteration of the chosen map.
 * Used to re-generate data when the user changes parameters and WebGPU
 * is unavailable.
 */
function cpuIterateMap(mapType: BifurcationMapType, r: number, x: number): number {
  switch (mapType) {
    case 'logistic':
      return r * x * (1 - x);
    case 'sine':
      return r * Math.sin(Math.PI * x);
    case 'tent':
      return r * Math.min(x, 1 - x);
    case 'cubic':
      return r * x - x * x * x;
    case 'gauss':
      return Math.exp(-6.2 * x * x) + r; // alpha=6.2, beta=r
    case 'circle':
      return (x + r - (0.5 / Math.PI) * Math.sin(2 * Math.PI * x)) % 1;
  }
}

/**
 * Synchronous CPU bifurcation computation (fallback path).
 * Runs in the same budget as the original chaos-page generator.
 */
function computeBifurcationCPU(
  mapType: BifurcationMapType,
  rMin: number,
  rMax: number,
  x0: number,
  rSteps = 500,
  warmup = 500,
  plotPoints = 150,
): BifurcationPoint[] {
  const points: BifurcationPoint[] = [];
  for (let i = 0; i <= rSteps; i++) {
    const r = rMin + (i / rSteps) * (rMax - rMin);
    let x = x0;
    for (let j = 0; j < warmup; j++) {
      x = cpuIterateMap(mapType, r, x);
      if (!Number.isFinite(x) || Math.abs(x) > 1e6) break;
    }
    if (!Number.isFinite(x) || Math.abs(x) > 1e6) continue;
    for (let j = 0; j < plotPoints; j++) {
      x = cpuIterateMap(mapType, r, x);
      if (!Number.isFinite(x) || Math.abs(x) > 1e6) break;
      points.push({ r, x });
    }
  }
  return points;
}

export function BifurcationDiagramRenderer({
  data: propData,
  enableGPU = true,
  gpuParams,
}: BifurcationDiagramRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ── Map/parameter controls ──────────────────────────────────────────────────
  const [mapType, setMapType] = useState<BifurcationMapType>('logistic');
  const [rMin, setRMin] = useState(2.5);
  const [rMax, setRMax] = useState(4.0);
  const [x0, setX0] = useState(0.5);
  // String buffers for the numeric inputs (validated on blur/enter)
  const [rMinStr, setRMinStr] = useState('2.5');
  const [rMaxStr, setRMaxStr] = useState('4.0');
  const [x0Str, setX0Str] = useState('0.5');
  const [showControls, setShowControls] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  // Active dataset: starts as propData, replaced by GPU result when ready
  const [activeData, setActiveData] = useState<BifurcationPoint[]>(propData);
  const [gpuStatus, setGpuStatus] = useState<'idle' | 'loading' | 'done' | 'unavailable'>('idle');
  const [gpuMs, setGpuMs] = useState<number | null>(null);
  const [cpuMs, setCpuMs] = useState<number | null>(null);

  const [zoom, setZoom] = useState({ x: 1, y: 1 });
  // Pan stored in data-space units (r-units, x-units) so zoom changes don't
  // corrupt the pan offset.  Positive panR shifts the view window right
  // (shows lower r-values), positive panX shifts up (shows lower x-values).
  const [pan, setPan] = useState({ r: 0, x: 0 });
  const [isPanning, setIsPanning] = useState(false);
  // dragStart stores the data-space pan value at the moment the drag began,
  // plus the client coordinates so we can compute the delta.
  const [dragStart, setDragStart] = useState({ clientX: 0, clientY: 0, panR: 0, panX: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<{
    r: number;
    x: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [renderTime, setRenderTime] = useState(0);

  const lastPinchDistRef = useRef<number | null>(null);

  // Keep activeData in sync with propData when GPU is not in use
  useEffect(() => {
    if (gpuStatus === 'idle' || gpuStatus === 'unavailable') {
      setActiveData(propData);
    }
  }, [propData, gpuStatus]);

  // ── GPU compute trigger — re-runs when map params change ────────────────────
  useEffect(() => {
    // Merge prop params (lowest priority) with local state (highest priority).
    const params: BifurcationGPUParams = {
      rMin,
      rMax,
      rSteps: gpuParams?.rSteps ?? 512,
      warmup: gpuParams?.warmup ?? 500,
      plotPoints: gpuParams?.plotPoints ?? 200,
      x0,
      mapType,
    };

    if (!enableGPU) {
      // Pure CPU path — run synchronously and update data
      const cpuData = computeBifurcationCPU(mapType, rMin, rMax, x0);
      setActiveData(cpuData);
      return;
    }

    setGpuStatus('loading');
    let cancelled = false;

    (async () => {
      try {
        const t0 = performance.now();
        const result = await computeBifurcationGPU(params);
        if (cancelled) return;

        if (result === null) {
          // WebGPU unavailable — run CPU fallback
          setGpuStatus('unavailable');
          const cpuData = computeBifurcationCPU(mapType, rMin, rMax, x0);
          setActiveData(cpuData);
          return;
        }

        const elapsed = performance.now() - t0;
        setGpuMs(result.gpuMs);
        setCpuMs(elapsed);
        setActiveData(result.points);
        setGpuStatus('done');
      } catch (_err) {
        if (!cancelled) {
          setGpuStatus('unavailable');
          const cpuData = computeBifurcationCPU(mapType, rMin, rMax, x0);
          setActiveData(cpuData);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enableGPU,
    mapType,
    rMin,
    rMax,
    x0,
    gpuParams?.rSteps,
    gpuParams?.warmup,
    gpuParams?.plotPoints,
  ]);

  // ── Bounds ──────────────────────────────────────────────────────────────────
  const bounds = useMemo(() => {
    if (activeData.length === 0) {
      return { minR: 2.5, maxR: 4.0, minX: 0, maxX: 1, rangeR: 1.5, rangeX: 1 };
    }
    let minR = activeData[0]?.r ?? 2.5;
    let maxR = minR;
    let minX = activeData[0]?.x ?? 0;
    let maxX = minX;
    for (const p of activeData) {
      if (p.r < minR) minR = p.r;
      if (p.r > maxR) maxR = p.r;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
    return { minR, maxR, minX, maxX, rangeR: maxR - minR || 1, rangeX: maxX - minX || 1 };
  }, [activeData]);

  /**
   * Emerald → cyan → indigo → violet palette.
   * Canvas renderers may use dynamic HSL (acceptable per project conventions).
   */
  const progressToRGBA = useCallback((progress: number): [number, number, number] => {
    let hue: number;
    let sat: number;
    let lit: number;

    if (progress < 0.25) {
      const t = progress / 0.25;
      hue = 160 + t * 26;
      sat = 72 + t * 10;
      lit = 56;
    } else if (progress < 0.5) {
      const t = (progress - 0.25) / 0.25;
      hue = 186 + t * 18;
      sat = 82;
      lit = 58 + t * 4;
    } else if (progress < 0.75) {
      const t = (progress - 0.5) / 0.25;
      hue = 204 + t * 35;
      sat = 82 - t * 14;
      lit = 62 - t * 4;
    } else {
      const t = (progress - 0.75) / 0.25;
      hue = 239 + t * 33;
      sat = 68 + t * 14;
      lit = 58 + t * 6;
    }

    const h = hue / 360;
    const s = sat / 100;
    const l = lit / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (tt: number) => {
      let t = tt;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [
      Math.round(hue2rgb(h + 1 / 3) * 255),
      Math.round(hue2rgb(h) * 255),
      Math.round(hue2rgb(h - 1 / 3) * 255),
    ];
  }, []);

  // ── Helpers to commit string inputs to numeric state ────────────────────────
  const commitRMin = useCallback(() => {
    const v = parseFloat(rMinStr);
    if (!Number.isNaN(v) && v < rMax) {
      setRMin(v);
      setZoom({ x: 1, y: 1 });
      setPan({ r: 0, x: 0 });
    } else {
      setRMinStr(String(rMin));
    }
  }, [rMinStr, rMax, rMin]);

  const commitRMax = useCallback(() => {
    const v = parseFloat(rMaxStr);
    if (!Number.isNaN(v) && v > rMin) {
      setRMax(v);
      setZoom({ x: 1, y: 1 });
      setPan({ r: 0, x: 0 });
    } else {
      setRMaxStr(String(rMax));
    }
  }, [rMaxStr, rMin, rMax]);

  const commitX0 = useCallback(() => {
    const v = parseFloat(x0Str);
    if (!Number.isNaN(v) && v > 0 && v < 1) {
      setX0(v);
    } else {
      setX0Str(String(x0));
    }
  }, [x0Str, x0]);

  const handleMapChange = useCallback((m: BifurcationMapType) => {
    const meta = MAP_META[m];
    setMapType(m);
    setRMin(meta.defaultRMin);
    setRMax(meta.defaultRMax);
    setRMinStr(String(meta.defaultRMin));
    setRMaxStr(String(meta.defaultRMax));
    setX0(0.5);
    setX0Str('0.5');
    setZoom({ x: 1, y: 1 });
    setPan({ r: 0, x: 0 });
  }, []);

  const handlePresetChange = useCallback((preset: BifurcationPreset) => {
    setMapType(preset.mapType);
    setRMin(preset.rMin);
    setRMax(preset.rMax);
    setRMinStr(String(preset.rMin));
    setRMaxStr(String(preset.rMax));
    setX0(preset.x0);
    setX0Str(String(preset.x0));
    setZoom({ x: 1, y: 1 });
    setPan({ r: 0, x: 0 });
    setShowPresets(false);
  }, []);

  // ── Canvas draw ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || activeData.length === 0) return;

    const t0 = performance.now();
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    });
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const m = MARGIN;
    const plotW = W - m.left - m.right;
    const plotH = H - m.top - m.bottom;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#060a18');
    bg.addColorStop(0.5, '#0a1020');
    bg.addColorStop(1, '#060a18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const plotBg = ctx.createLinearGradient(m.left, m.top, m.left, m.top + plotH);
    plotBg.addColorStop(0, 'rgba(10,18,40,0.90)');
    plotBg.addColorStop(1, 'rgba(6,12,28,0.75)');
    ctx.fillStyle = plotBg;
    ctx.fillRect(m.left, m.top, plotW, plotH);

    ctx.strokeStyle = 'rgba(99,102,241,0.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(m.left, m.top, plotW, plotH);

    // Display bounds from zoom + data-space pan.
    // The visible r-range at the current zoom level is bounds.rangeR / zoom.x.
    // pan.r shifts the window centre in r-units (positive = moved right → lower
    // r values are visible, i.e. window shifts left).
    const visibleRangeR = bounds.rangeR / zoom.x;
    const visibleRangeX = bounds.rangeX / zoom.y;
    const dispMinR = bounds.minR + (bounds.rangeR - visibleRangeR) / 2 - pan.r;
    const dispMaxR = dispMinR + visibleRangeR;
    const dispMinX = bounds.minX + (bounds.rangeX - visibleRangeX) / 2 - pan.x;
    const dispMaxX = dispMinX + visibleRangeX;

    const rToScreenX = (rv: number) => m.left + ((rv - dispMinR) / (dispMaxR - dispMinR)) * plotW;
    const xToScreenY = (xv: number) =>
      m.top + plotH - ((xv - dispMinX) / (dispMaxX - dispMinX)) * plotH;

    // Grid
    ctx.save();
    const NUM_H = 8;
    const NUM_V = 10;
    for (let i = 0; i <= NUM_H; i++) {
      const y = m.top + (i * plotH) / NUM_H;
      const val = dispMaxX - (i / NUM_H) * (dispMaxX - dispMinX);
      ctx.globalAlpha = i % 2 === 0 ? 0.4 : 0.18;
      ctx.strokeStyle = '#1e2d45';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.left, y);
      ctx.lineTo(m.left + plotW, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(2), m.left - 8, y + 3.5);
    }
    for (let i = 0; i <= NUM_V; i++) {
      const x = m.left + (i * plotW) / NUM_V;
      const rVal = dispMinR + (i / NUM_V) * (dispMaxR - dispMinR);
      ctx.globalAlpha = i % 2 === 0 ? 0.4 : 0.18;
      ctx.strokeStyle = '#1e2d45';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, m.top);
      ctx.lineTo(x, m.top + plotH);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#475569';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(rVal.toFixed(2), x, m.top + plotH + 18);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Axes
    const axisGrad = ctx.createLinearGradient(m.left, m.top, m.left, m.top + plotH);
    axisGrad.addColorStop(0, 'rgba(52,211,153,0.9)');
    axisGrad.addColorStop(0.5, 'rgba(129,140,248,0.9)');
    axisGrad.addColorStop(1, 'rgba(167,139,250,0.9)');
    ctx.strokeStyle = axisGrad;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(129,140,248,0.4)';
    ctx.beginPath();
    ctx.moveTo(m.left, m.top);
    ctx.lineTo(m.left, m.top + plotH);
    ctx.lineTo(m.left + plotW, m.top + plotH);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── ImageData pixel scatter ──────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, plotW, plotH);
    ctx.clip();

    const bufW = Math.ceil(plotW * dpr);
    const bufH = Math.ceil(plotH * dpr);
    const imageData = ctx.createImageData(bufW, bufH);
    const pixels = imageData.data;

    // Fill plot background
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 8;
      pixels[i + 1] = 14;
      pixels[i + 2] = 30;
      pixels[i + 3] = 255;
    }

    /**
     * 3×3 soft-glow neighbourhood (additive blend).
     * Centre pixel gets full brightness; diagonals get 70/255, ortho 140/255.
     */
    const OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
      [0, 0, 255],
      [-1, 0, 140],
      [1, 0, 140],
      [0, -1, 140],
      [0, 1, 140],
      [-1, -1, 70],
      [1, -1, 70],
      [-1, 1, 70],
      [1, 1, 70],
    ];

    const paintPixel = (px: number, py: number, cr: number, cg: number, cb: number) => {
      const ix = Math.round(px);
      const iy = Math.round(py);
      for (const [dx, dy, alpha] of OFFSETS) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx < 0 || ny < 0 || nx >= bufW || ny >= bufH) continue;
        const idx = (ny * bufW + nx) * 4;
        pixels[idx] = Math.min(255, (pixels[idx] ?? 0) + Math.round((cr * alpha) / 255));
        pixels[idx + 1] = Math.min(255, (pixels[idx + 1] ?? 0) + Math.round((cg * alpha) / 255));
        pixels[idx + 2] = Math.min(255, (pixels[idx + 2] ?? 0) + Math.round((cb * alpha) / 255));
      }
    };

    let visibleCount = 0;
    for (const point of activeData) {
      if (point.r < dispMinR || point.r > dispMaxR || point.x < dispMinX || point.x > dispMaxX)
        continue;

      const sx = (rToScreenX(point.r) - m.left) * dpr;
      const sy = (xToScreenY(point.x) - m.top) * dpr;
      if (sx < 0 || sy < 0 || sx >= bufW || sy >= bufH) continue;

      const progress = (point.r - bounds.minR) / bounds.rangeR;
      const [pr, pg, pb] = progressToRGBA(progress);
      paintPixel(sx, sy, pr, pg, pb);
      visibleCount++;
    }

    ctx.putImageData(imageData, m.left * dpr, m.top * dpr);
    ctx.restore();

    // Axis labels
    ctx.save();
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(52,211,153,0.4)';
    const xAxisGrad = ctx.createLinearGradient(m.left, 0, m.left + plotW, 0);
    xAxisGrad.addColorStop(0, '#34d399');
    xAxisGrad.addColorStop(0.5, '#38bdf8');
    xAxisGrad.addColorStop(1, '#a78bfa');
    ctx.fillStyle = xAxisGrad;
    ctx.font = 'bold 13px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Growth Rate (r)', m.left + plotW / 2, H - 12);
    ctx.translate(16, m.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Population (x)', 0, 0);
    ctx.restore();

    // Title
    ctx.save();
    const titleGrad = ctx.createLinearGradient(m.left, 0, m.left + plotW, 0);
    titleGrad.addColorStop(0, '#a5b4fc');
    titleGrad.addColorStop(0.5, '#c4b5fd');
    titleGrad.addColorStop(1, '#a5b4fc');
    ctx.fillStyle = titleGrad;
    ctx.font = 'bold 16px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(129,140,248,0.7)';
    ctx.fillText(`Bifurcation — ${MAP_META[mapType].label}`, m.left + plotW / 2, 30);
    ctx.restore();

    // Performance badge
    const elapsed = performance.now() - t0;
    setRenderTime(elapsed);

    ctx.save();
    ctx.shadowBlur = 0;
    const bx = W - 148,
      by = 8,
      bw = 138,
      bh = 24;
    ctx.fillStyle = 'rgba(6,182,212,0.12)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(6,182,212,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${visibleCount.toLocaleString()} pts · ${elapsed.toFixed(1)}ms`,
      bx + bw / 2,
      by + 15,
    );
    ctx.restore();
  }, [activeData, zoom, pan, bounds, progressToRGBA, mapType]);

  // Redraw on data/view change
  useEffect(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [draw]);

  // Wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom((prev) => ({
      x: Math.max(1, Math.min(12, prev.x * factor)),
      y: Math.max(1, Math.min(12, prev.y * factor)),
    }));
  }, []);

  // Mouse pan — store the data-space pan at drag start plus the client
  // coordinates so we can compute the displacement in data units on move.
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      setIsPanning(true);
      setDragStart({ clientX: e.clientX, clientY: e.clientY, panR: pan.r, panX: pan.x });
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning) {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (canvas && container) {
          const rect = container.getBoundingClientRect();
          const plotW = rect.width - MARGIN.left - MARGIN.right;
          const plotH = rect.height - MARGIN.top - MARGIN.bottom;
          // Convert screen-space drag delta to data-space delta.
          // Dragging right (positive dClientX) moves the window left in data
          // space, so dispMinR decreases → pan.r increases.
          const dClientX = e.clientX - dragStart.clientX;
          const dClientY = e.clientY - dragStart.clientY;
          const drPerPx = bounds.rangeR / (zoom.x * plotW);
          const dxPerPx = bounds.rangeX / (zoom.y * plotH);
          setPan({
            r: dragStart.panR + dClientX * drPerPx,
            x: dragStart.panX - dClientY * dxPerPx,
          });
        }
      }

      const canvas = canvasRef.current;
      if (!canvas || activeData.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const m = MARGIN;
      if (mx < m.left || mx > rect.width - m.right || my < m.top || my > rect.height - m.bottom) {
        setHoveredPoint(null);
        return;
      }
      const plotW = rect.width - m.left - m.right;
      const visibleRangeR = bounds.rangeR / zoom.x;
      const dispMinR = bounds.minR + (bounds.rangeR - visibleRangeR) / 2 - pan.r;
      const dispMaxR = dispMinR + visibleRangeR;
      const relX = (mx - m.left) / plotW;
      const rVal = dispMinR + relX * (dispMaxR - dispMinR);
      const tolerance = bounds.rangeR / (zoom.x * 80);
      const near = activeData.filter((p) => Math.abs(p.r - rVal) < tolerance);
      if (near.length > 0) {
        const pt = near[Math.floor(near.length / 2)];
        if (pt) setHoveredPoint({ r: pt.r, x: pt.x, screenX: mx, screenY: my });
        else setHoveredPoint(null);
      } else {
        setHoveredPoint(null);
      }
    },
    [isPanning, dragStart, activeData, bounds, pan, zoom],
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setHoveredPoint(null);
  }, []);

  // Pinch-to-zoom
  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      if (t0 && t1) {
        const dx = t0.clientX - t1.clientX;
        const dy = t0.clientY - t1.clientY;
        lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      }
    }
  }, []);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      if (t0 && t1 && lastPinchDistRef.current !== null) {
        const dx = t0.clientX - t1.clientX;
        const dy = t0.clientY - t1.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const factor = dist / lastPinchDistRef.current;
        lastPinchDistRef.current = dist;
        setZoom((prev) => ({
          x: Math.max(1, Math.min(12, prev.x * factor)),
          y: Math.max(1, Math.min(12, prev.y * factor)),
        }));
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDistRef.current = null;
  }, []);

  const resetView = useCallback(() => {
    setZoom({ x: 1, y: 1 });
    setPan({ r: 0, x: 0 });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setZoom((prev) => ({
      x: Math.max(1, Math.min(12, prev.x * factor)),
      y: Math.max(1, Math.min(12, prev.y * factor)),
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const isZoomed = zoom.x !== 1 || zoom.y !== 1 || pan.r !== 0 || pan.x !== 0;

  // ── GPU status badge label ───────────────────────────────────────────────
  const gpuBadgeLabel: string = (() => {
    switch (gpuStatus) {
      case 'loading':
        return 'GPU computing...';
      case 'done':
        return `WebGPU ${gpuMs !== null ? `${gpuMs.toFixed(0)}ms` : ''}`;
      case 'unavailable':
        return 'CPU fallback';
      default:
        return enableGPU ? 'WebGPU ready' : 'CPU mode';
    }
  })();

  const gpuBadgeColor: string =
    gpuStatus === 'done'
      ? 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/40 text-emerald-300'
      : gpuStatus === 'unavailable'
        ? 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-300'
        : 'from-indigo-500/20 to-violet-500/20 border-indigo-500/40 text-indigo-300';

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="img"
        aria-label={`Bifurcation diagram (${MAP_META[mapType].label}) with ${activeData.length.toLocaleString()} data points. ${gpuStatus === 'done' ? 'Rendered using WebGPU compute acceleration.' : 'Rendered using CPU.'}`}
      />

      {/* ── Presets dropdown ─────────────────────────────────────────── */}
      <div className="absolute bottom-14 left-3">
        <button
          type="button"
          onClick={() => setShowPresets((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold
            bg-black/60 backdrop-blur-sm border border-white/10 text-white/70
            hover:border-white/30 hover:text-white transition-colors duration-150
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-expanded={showPresets}
          aria-haspopup="listbox"
          aria-label="Select bifurcation preset"
        >
          Presets
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-150 ${showPresets ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence>
          {showPresets && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 w-64 max-h-72 overflow-y-auto rounded-xl
                bg-black/85 backdrop-blur-md border border-white/10
                shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
              role="listbox"
              aria-label="Bifurcation presets"
            >
              <div className="px-3 py-2 border-b border-white/8">
                <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">
                  Presets
                </p>
              </div>
              <div className="py-1">
                {BIFURCATION_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    role="option"
                    aria-selected={
                      mapType === preset.mapType && rMin === preset.rMin && rMax === preset.rMax
                    }
                    onClick={() => handlePresetChange(preset)}
                    className="w-full text-left px-3 py-2 hover:bg-white/8 transition-colors duration-100
                      focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                  >
                    <div className="text-[11px] font-mono font-semibold text-white/85">
                      {preset.name}
                    </div>
                    <div className="text-[9px] font-mono text-white/35 mt-0.5">
                      {preset.equation} | r: [{preset.rMin}, {preset.rMax}]
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Parameter controls panel ────────────────────────────────────── */}
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setShowControls((v) => !v)}
        className="absolute bottom-14 right-3 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold
          bg-black/60 backdrop-blur-sm border border-white/10 text-white/70
          hover:border-white/30 hover:text-white transition-colors duration-150
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-expanded={showControls}
        aria-label="Toggle parameter controls"
      >
        {showControls ? 'Hide Controls' : 'Map Controls'}
      </button>

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-24 right-3 w-72 rounded-xl overflow-hidden
              bg-black/80 backdrop-blur-md border border-white/10
              shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            role="region"
            aria-label="Bifurcation diagram controls"
          >
            <div className="px-4 py-3 border-b border-white/8">
              <p className="text-[11px] font-semibold text-white/80 uppercase tracking-widest">
                Diagram Parameters
              </p>
            </div>
            <div className="px-4 py-3 space-y-4">
              {/* Map type selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
                  Map Function
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {MAP_TYPES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMapChange(m)}
                      className={[
                        'px-2.5 py-1 rounded text-[11px] font-mono transition-colors duration-150',
                        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                        mapType === m
                          ? 'bg-indigo-500/30 border border-indigo-400/60 text-indigo-200'
                          : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10',
                      ].join(' ')}
                      aria-pressed={mapType === m}
                    >
                      {MAP_META[m].label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-mono text-white/35 italic">
                  {MAP_META[mapType].description}
                </p>
              </div>

              {/* r range */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label
                    htmlFor="bifurcation-rmin"
                    className="text-[10px] font-mono text-white/50 uppercase tracking-wider"
                  >
                    r min
                  </label>
                  <input
                    id="bifurcation-rmin"
                    type="number"
                    step="0.1"
                    value={rMinStr}
                    onChange={(e) => setRMinStr(e.target.value)}
                    onBlur={commitRMin}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRMin();
                    }}
                    className="w-full px-2 py-1 rounded bg-white/5 border border-white/10
                      text-[11px] font-mono text-white/80
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="bifurcation-rmax"
                    className="text-[10px] font-mono text-white/50 uppercase tracking-wider"
                  >
                    r max
                  </label>
                  <input
                    id="bifurcation-rmax"
                    type="number"
                    step="0.1"
                    value={rMaxStr}
                    onChange={(e) => setRMaxStr(e.target.value)}
                    onBlur={commitRMax}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRMax();
                    }}
                    className="w-full px-2 py-1 rounded bg-white/5 border border-white/10
                      text-[11px] font-mono text-white/80
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                </div>
              </div>

              {/* Initial condition x₀ */}
              <div className="space-y-1">
                <label
                  htmlFor="bifurcation-x0"
                  className="text-[10px] font-mono text-white/50 uppercase tracking-wider"
                >
                  Initial condition x₀ (0 &lt; x₀ &lt; 1)
                </label>
                <input
                  id="bifurcation-x0"
                  type="number"
                  step="0.05"
                  min="0.01"
                  max="0.99"
                  value={x0Str}
                  onChange={(e) => setX0Str(e.target.value)}
                  onBlur={commitX0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitX0();
                  }}
                  className="w-full px-2 py-1 rounded bg-white/5 border border-white/10
                    text-[11px] font-mono text-white/80
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
              </div>

              <p className="text-[9px] text-white/25 font-mono leading-relaxed">
                Press Enter or click outside an input to apply. Map change resets range to defaults.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GPU/CPU backend badge */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg
          text-[11px] font-mono font-semibold border bg-gradient-to-r ${gpuBadgeColor}
          backdrop-blur-sm pointer-events-none`}
        aria-live="polite"
        aria-label={`Rendering backend: ${gpuBadgeLabel}`}
      >
        {gpuStatus === 'done' ? (
          <Zap className="w-3 h-3" aria-hidden="true" />
        ) : (
          <Cpu className="w-3 h-3" aria-hidden="true" />
        )}
        {gpuBadgeLabel}
      </motion.div>

      {/* GPU timing detail — shown after compute finishes */}
      <AnimatePresence>
        {gpuStatus === 'done' && gpuMs !== null && cpuMs !== null && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-10 left-3 px-2.5 py-1.5 rounded-lg pointer-events-none
              bg-black/60 backdrop-blur-sm border border-white/10"
          >
            <div className="text-[10px] font-mono space-y-0.5">
              <div className="text-emerald-300">
                GPU compute: <span className="font-bold">{gpuMs.toFixed(1)}ms</span>
              </div>
              <div className="text-muted-foreground">
                {activeData.length.toLocaleString()} attractor pts
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GPU loading overlay */}
      <AnimatePresence>
        {gpuStatus === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl
              bg-black/70 backdrop-blur-md border border-indigo-500/30"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="w-7 h-7 rounded-full border-2 border-indigo-400 border-t-transparent"
                aria-hidden="true"
              />
              <div className="text-sm font-semibold text-indigo-300">WebGPU Compute Running...</div>
              <div className="text-xs text-muted-foreground font-mono">
                Parallelising {(gpuParams?.rSteps ?? 512).toLocaleString()} r-values
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1" aria-label="Zoom controls">
        <button
          type="button"
          onClick={() => zoomBy(1.3)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold
            bg-black/60 backdrop-blur-sm border border-white/10 text-white/80
            hover:bg-white/10 hover:text-white hover:border-white/25
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            transition-colors duration-150"
          aria-label="Zoom in"
        >
          +
        </button>
        <div
          className="w-8 h-6 flex items-center justify-center rounded text-[10px]
            font-mono text-white/50 bg-black/40 border border-white/5"
          aria-live="polite"
          aria-label={`Zoom ${zoom.x.toFixed(1)}x`}
        >
          {zoom.x.toFixed(1)}x
        </div>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.3)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold
            bg-black/60 backdrop-blur-sm border border-white/10 text-white/80
            hover:bg-white/10 hover:text-white hover:border-white/25
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            transition-colors duration-150"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredPoint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            transition={{ duration: 0.12 }}
            className="absolute pointer-events-none px-3 py-2 rounded-lg shadow-xl"
            style={{
              left: hoveredPoint.screenX + 16,
              top: hoveredPoint.screenY - 48,
              background: 'linear-gradient(135deg,rgba(10,18,40,0.97),rgba(16,26,50,0.97))',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(52,211,153,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(52,211,153,0.12)',
            }}
          >
            <div className="text-xs font-mono space-y-0.5">
              <div className="text-emerald-300 font-semibold">r = {hoveredPoint.r.toFixed(4)}</div>
              <div className="text-cyan-300">x = {hoveredPoint.x.toFixed(6)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset button */}
      <AnimatePresence>
        {isZoomed && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -8 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={resetView}
            className="absolute bottom-14 left-3 px-3 py-1.5 text-xs font-semibold rounded-lg"
            style={{
              background: 'linear-gradient(135deg,rgba(52,211,153,0.16),rgba(129,140,248,0.16))',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(52,211,153,0.35)',
              color: '#34d399',
              boxShadow: '0 4px 16px rgba(52,211,153,0.12)',
            }}
            aria-label="Reset view"
          >
            Reset
          </motion.button>
        )}
      </AnimatePresence>

      {/* Info bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute bottom-3 left-3 px-2.5 py-1.5 rounded-lg text-[10px] font-mono pointer-events-none"
        style={{
          background: 'rgba(6,10,24,0.78)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(100,116,139,0.22)',
          color: '#475569',
        }}
      >
        <span className="text-emerald-300 font-semibold">{activeData.length.toLocaleString()}</span>{' '}
        pts
        <span className="mx-1.5">·</span>
        scroll/pinch to zoom
        <span className="mx-1.5">·</span>
        drag to pan
        <span className="mx-1.5">·</span>
        <span className="text-cyan-400">{renderTime.toFixed(1)}ms draw</span>
      </motion.div>
    </div>
  );
}
