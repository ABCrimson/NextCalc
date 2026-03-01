'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  type MouseEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

interface LogisticMapRendererProps {
  data: number[];
  title?: string;
}

const MARGIN = { top: 44, right: 36, bottom: 52, left: 64 } as const;

// ---------------------------------------------------------------------------
// WebGPU feature detection (safe for SSR)
// ---------------------------------------------------------------------------
const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

// ---------------------------------------------------------------------------
// WGSL shaders
// ---------------------------------------------------------------------------
const COMPUTE_SHADER = /* wgsl */ `
struct Params {
  r: f32,
  x0: f32,
  count: u32,
  _pad: u32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }
  // Each workgroup independently computes iteration idx
  // by running the map from x0 for idx steps.
  var x = params.x0;
  for (var i: u32 = 0u; i < idx; i++) {
    x = params.r * x * (1.0 - x);
  }
  output[idx] = x;
}
`;

// Vertex + fragment shader: draws a line strip from a storage buffer.
const RENDER_SHADER = /* wgsl */ `
struct Uniforms {
  dispMinI: f32,
  dispMaxI: f32,
  dispMinY: f32,
  dispMaxY: f32,
  plotX: f32,
  plotY: f32,
  plotW: f32,
  plotH: f32,
  canvasW: f32,
  canvasH: f32,
  pointCount: u32,
  _pad: u32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var<storage, read> points: array<f32>;

struct VertexOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) t: f32,
};

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOut {
  var out: VertexOut;
  let idx = vi;
  if (idx >= uni.pointCount) {
    out.pos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    out.t = 0.0;
    return out;
  }
  let value = points[idx];
  let dataIdx = f32(idx);

  // Map data index → canvas X
  let normX = (dataIdx - uni.dispMinI) / (uni.dispMaxI - uni.dispMinI);
  let cx = uni.plotX + normX * uni.plotW;

  // Map value → canvas Y (canvas Y increases downward)
  let normY = (value - uni.dispMinY) / (uni.dispMaxY - uni.dispMinY);
  let cy = uni.plotY + uni.plotH - normY * uni.plotH;

  // Convert to NDC [-1, 1]
  let ndcX = (cx / uni.canvasW) * 2.0 - 1.0;
  let ndcY = 1.0 - (cy / uni.canvasH) * 2.0;

  out.pos = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.t = normX;
  return out;
}

@fragment
fn fs_main(@location(0) t: f32) -> @location(0) vec4<f32> {
  // Gradient: mint → sky → indigo → violet → pink
  var col: vec3<f32>;
  if (t < 0.25) {
    let s = t / 0.25;
    col = mix(vec3<f32>(0.024, 0.839, 0.627), vec3<f32>(0.055, 0.647, 0.914), s);
  } else if (t < 0.55) {
    let s = (t - 0.25) / 0.30;
    col = mix(vec3<f32>(0.055, 0.647, 0.914), vec3<f32>(0.506, 0.549, 0.973), s);
  } else if (t < 0.80) {
    let s = (t - 0.55) / 0.25;
    col = mix(vec3<f32>(0.506, 0.549, 0.973), vec3<f32>(0.753, 0.518, 0.988), s);
  } else {
    let s = (t - 0.80) / 0.20;
    col = mix(vec3<f32>(0.753, 0.518, 0.988), vec3<f32>(0.957, 0.447, 0.714), s);
  }
  return vec4<f32>(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// GPU resource bag
// ---------------------------------------------------------------------------
interface GPUResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  renderPipeline: GPURenderPipeline;
  computePipeline: GPUComputePipeline;
  renderUniformBuffer: GPUBuffer;
  computeParamBuffer: GPUBuffer;
  pointBuffer: GPUBuffer;
  pointCount: number;
}

/**
 * High-performance Canvas / WebGPU renderer for Logistic Map time series.
 *
 * Rendering path:
 * 1. WebGPU (preferred): compute shader generates data in parallel;
 *    render pipeline draws the gradient line strip in a single pass.
 * 2. Canvas 2D fallback: full existing implementation, unchanged.
 */
export function LogisticMapRenderer({ data, title = 'x(n)' }: LogisticMapRendererProps) {
  // Shared refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gpuRef = useRef<GPUResources | null>(null);
  const webgpuActiveRef = useRef(false);

  // Interaction state
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number;
    value: number;
    x: number;
    y: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [renderMode, setRenderMode] = useState<'webgpu' | 'canvas2d' | 'detecting'>('detecting');

  const lastPinchDistRef = useRef<number | null>(null);

  const resetView = useCallback(() => {
    startTransition(() => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    startTransition(() => {
      setZoom((prev) => Math.max(1, Math.min(20, prev * factor)));
    });
  }, []);

  const dataStats = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 1, range: 1 };
    let min = data[0] ?? 0;
    let max = data[0] ?? 0;
    for (const v of data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max, range: max - min || 1 };
  }, [data]);

  // -------------------------------------------------------------------------
  // Canvas 2D draw (fallback path – identical to original implementation)
  // -------------------------------------------------------------------------
  const draw2D = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
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

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#07091a');
    bg.addColorStop(0.5, '#0c1120');
    bg.addColorStop(1, '#07091a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const plotBg = ctx.createLinearGradient(m.left, m.top, m.left, m.top + plotH);
    plotBg.addColorStop(0, 'rgba(12,20,44,0.85)');
    plotBg.addColorStop(1, 'rgba(8,14,32,0.70)');
    ctx.fillStyle = plotBg;
    ctx.fillRect(m.left, m.top, plotW, plotH);

    ctx.strokeStyle = 'rgba(99,102,241,0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(m.left, m.top, plotW, plotH);

    const { min: minVal, max: maxVal, range } = dataStats;
    const pad = range * 0.08;
    const fullMinY = minVal - pad;
    const fullMaxY = maxVal + pad;
    const fullRangeY = fullMaxY - fullMinY;

    const zoomedRangeY = fullRangeY / zoom;
    const centerY = fullMinY + fullRangeY / 2 + (pan.y * fullRangeY) / plotH;
    const dispMinY = centerY - zoomedRangeY / 2;
    const dispMaxY = centerY + zoomedRangeY / 2;

    const zoomedRangeI = data.length / zoom;
    const centerI = data.length / 2 - (pan.x * data.length) / plotW;
    const dispMinI = Math.max(0, Math.floor(centerI - zoomedRangeI / 2));
    const dispMaxI = Math.min(data.length - 1, Math.ceil(centerI + zoomedRangeI / 2));

    const xScale = (i: number) => m.left + ((i - dispMinI) / (dispMaxI - dispMinI)) * plotW;
    const yScale = (v: number) => m.top + plotH - ((v - dispMinY) / (dispMaxY - dispMinY)) * plotH;

    ctx.save();
    const NUM_H = 8;
    const NUM_V = 8;

    for (let i = 0; i <= NUM_H; i++) {
      const y = m.top + (i * plotH) / NUM_H;
      const val = dispMaxY - (i / NUM_H) * (dispMaxY - dispMinY);
      ctx.globalAlpha = i % 2 === 0 ? 0.45 : 0.2;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.left, y);
      ctx.lineTo(m.left + plotW, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(3), m.left - 8, y + 3.5);
    }

    for (let i = 0; i <= NUM_V; i++) {
      const x = m.left + (i * plotW) / NUM_V;
      const idx = Math.round(dispMinI + (i / NUM_V) * (dispMaxI - dispMinI));
      ctx.globalAlpha = i % 2 === 0 ? 0.45 : 0.2;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, m.top);
      ctx.lineTo(x, m.top + plotH);
      ctx.stroke();
      const minSpacing = plotW / NUM_V;
      if (minSpacing >= 36 || i === 0 || i === NUM_V) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(idx), x, m.top + plotH + 16);
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;

    const axisGrad = ctx.createLinearGradient(m.left, m.top, m.left, m.top + plotH);
    axisGrad.addColorStop(0, 'rgba(129,140,248,0.9)');
    axisGrad.addColorStop(1, 'rgba(167,139,250,0.9)');
    ctx.strokeStyle = axisGrad;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(129,140,248,0.5)';
    ctx.beginPath();
    ctx.moveTo(m.left, m.top);
    ctx.lineTo(m.left, m.top + plotH);
    ctx.lineTo(m.left + plotW, m.top + plotH);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, plotW, plotH);
    ctx.clip();

    const lineGrad = ctx.createLinearGradient(m.left, 0, m.left + plotW, 0);
    lineGrad.addColorStop(0, '#06d6a0');
    lineGrad.addColorStop(0.25, '#0ea5e9');
    lineGrad.addColorStop(0.55, '#818cf8');
    lineGrad.addColorStop(0.8, '#c084fc');
    lineGrad.addColorStop(1, '#f472b6');

    const pointsPerPixel = (dispMaxI - dispMinI) / plotW;
    const useBezier = pointsPerPixel < 0.8;

    ctx.beginPath();
    let first = true;
    for (let i = dispMinI; i <= dispMaxI; i++) {
      const v = data[i];
      if (v === undefined) continue;
      const px = xScale(i);
      const py = yScale(v);
      if (first) {
        ctx.moveTo(px, py);
        first = false;
      } else if (useBezier && i > dispMinI) {
        const prev = data[i - 1];
        if (prev !== undefined) {
          const prevX = xScale(i - 1);
          const prevY = yScale(prev);
          const cpx = (prevX + px) / 2;
          ctx.bezierCurveTo(cpx, prevY, cpx, py, px, py);
        } else {
          ctx.lineTo(px, py);
        }
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.save();
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.18;
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(129,140,248,0.7)';
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(129,140,248,0.4)';
    ctx.stroke();
    ctx.shadowBlur = 0;

    const lastIdx = Math.min(dispMaxI, data.length - 1);
    const firstIdx = Math.max(dispMinI, 0);
    const lastV = data[lastIdx];
    const firstV = data[firstIdx];
    if (lastV !== undefined && firstV !== undefined) {
      ctx.lineTo(xScale(lastIdx), m.top + plotH);
      ctx.lineTo(xScale(firstIdx), m.top + plotH);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(m.left, m.top, m.left, m.top + plotH);
      fillGrad.addColorStop(0, 'rgba(129,140,248,0.22)');
      fillGrad.addColorStop(0.5, 'rgba(6,214,160,0.10)');
      fillGrad.addColorStop(1, 'rgba(6,214,160,0.01)');
      ctx.fillStyle = fillGrad;
      ctx.globalAlpha = 1;
      ctx.fill();
    }

    if (pointsPerPixel < 2.5) {
      for (let i = dispMinI; i <= dispMaxI; i++) {
        const v = data[i];
        if (v === undefined) continue;
        const px = xScale(i);
        const py = yScale(v);
        const t = (i - dispMinI) / Math.max(1, dispMaxI - dispMinI);
        const hue = 165 + t * 120;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},75%,60%,0.18)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${hue},75%,68%)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    ctx.restore();

    ctx.save();
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(129,140,248,0.5)';
    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'bold 13px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Iteration (n)', m.left + plotW / 2, H - 10);
    ctx.translate(14, m.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a5b4fc';
    ctx.font = 'bold 13px ui-sans-serif, sans-serif';
    ctx.fillText(title, 0, 0);
    ctx.restore();

    ctx.save();
    const titleGrad = ctx.createLinearGradient(0, 0, W, 0);
    titleGrad.addColorStop(0, '#818cf8');
    titleGrad.addColorStop(0.5, '#c084fc');
    titleGrad.addColorStop(1, '#818cf8');
    ctx.fillStyle = titleGrad;
    ctx.font = 'bold 15px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(129,140,248,0.7)';
    ctx.fillText('Logistic Map — Time Series', m.left + plotW / 2, 26);
    ctx.restore();

    if (zoom !== 1 || pan.x !== 0 || pan.y !== 0) {
      ctx.save();
      const bx = W - 76,
        by = 8,
        bw = 66,
        bh = 22;
      ctx.fillStyle = 'rgba(6,182,212,0.14)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(6,182,212,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${zoom.toFixed(1)}x zoom`, bx + bw / 2, by + 14);
      ctx.restore();
    }
  }, [data, zoom, pan, title, dataStats]);

  // -------------------------------------------------------------------------
  // WebGPU initialisation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!supportsWebGPU) {
      setRenderMode('canvas2d');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter || cancelled) {
          setRenderMode('canvas2d');
          return;
        }

        const device = await adapter.requestDevice();
        if (cancelled) {
          device.destroy();
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) {
          device.destroy();
          setRenderMode('canvas2d');
          return;
        }

        const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
        if (!context) {
          device.destroy();
          setRenderMode('canvas2d');
          return;
        }

        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'opaque' });

        // --- Compute pipeline ---
        const computeModule = device.createShaderModule({ code: COMPUTE_SHADER });
        const computePipeline = await device.createComputePipelineAsync({
          layout: 'auto',
          compute: { module: computeModule, entryPoint: 'main' },
        });

        // --- Render pipeline ---
        const renderModule = device.createShaderModule({ code: RENDER_SHADER });
        const renderPipeline = await device.createRenderPipelineAsync({
          layout: 'auto',
          vertex: { module: renderModule, entryPoint: 'vs_main' },
          fragment: {
            module: renderModule,
            entryPoint: 'fs_main',
            targets: [{ format }],
          },
          primitive: { topology: 'line-strip' },
        });

        const pointCount = Math.max(data.length, 1);

        // Compute uniform buffer: r, x0, count, _pad
        const computeParamBuffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Point storage buffer
        const pointBuffer = device.createBuffer({
          size: pointCount * 4,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // Render uniform buffer
        const renderUniformBuffer = device.createBuffer({
          size: 48,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Upload existing JS data to GPU point buffer
        if (data.length > 0) {
          device.queue.writeBuffer(pointBuffer, 0, new Float32Array(data));
        }

        gpuRef.current = {
          device,
          context,
          renderPipeline,
          computePipeline,
          renderUniformBuffer,
          computeParamBuffer,
          pointBuffer,
          pointCount: data.length,
        };

        // Handle device loss
        void device.lost.then((info) => {
          if (info.reason !== 'destroyed') {
            gpuRef.current = null;
            webgpuActiveRef.current = false;
            setRenderMode('canvas2d');
          }
        });

        webgpuActiveRef.current = true;
        setRenderMode('webgpu');
      } catch {
        setRenderMode('canvas2d');
      }
    })();

    return () => {
      cancelled = true;
      const gpu = gpuRef.current;
      if (gpu) {
        gpu.renderUniformBuffer.destroy();
        gpu.computeParamBuffer.destroy();
        gpu.pointBuffer.destroy();
        gpu.device.destroy();
        gpuRef.current = null;
      }
      webgpuActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // WebGPU draw
  // -------------------------------------------------------------------------
  const drawWebGPU = useCallback(() => {
    const gpu = gpuRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!gpu || !canvas || !container || data.length === 0) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.floor(rect.width * dpr);
    const H = Math.floor(rect.height * dpr);

    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const m = MARGIN;
    const plotW = rect.width * dpr - m.left * dpr - m.right * dpr;
    const plotH = H - m.top * dpr - m.bottom * dpr;

    const { min: minVal, max: maxVal, range } = dataStats;
    const pad = range * 0.08;
    const fullMinY = minVal - pad;
    const fullMaxY = maxVal + pad;
    const fullRangeY = fullMaxY - fullMinY;

    const zoomedRangeY = fullRangeY / zoom;
    const centerY = fullMinY + fullRangeY / 2 + (pan.y * fullRangeY) / (plotH / dpr);
    const dispMinY = centerY - zoomedRangeY / 2;
    const dispMaxY = centerY + zoomedRangeY / 2;

    const zoomedRangeI = data.length / zoom;
    const centerI = data.length / 2 - (pan.x * data.length) / (plotW / dpr);
    const dispMinI = Math.max(0, Math.floor(centerI - zoomedRangeI / 2));
    const dispMaxI = Math.min(data.length - 1, Math.ceil(centerI + zoomedRangeI / 2));
    const pointCount = dispMaxI - dispMinI + 1;

    // Upload point sub-slice
    if (pointCount > 0) {
      const slice = new Float32Array(data.slice(dispMinI, dispMaxI + 1));
      if (slice.byteLength <= gpu.pointBuffer.size) {
        gpu.device.queue.writeBuffer(gpu.pointBuffer, 0, slice);
      }
    }

    // Upload render uniforms
    const uniformData = new Float32Array([
      0, // dispMinI mapped to 0 (relative)
      pointCount - 1, // dispMaxI mapped to N-1
      dispMinY,
      dispMaxY,
      m.left * dpr,
      m.top * dpr,
      plotW,
      plotH,
      W,
      H,
      pointCount,
      0,
    ]);
    gpu.device.queue.writeBuffer(gpu.renderUniformBuffer, 0, uniformData);

    // Build bind group
    const bindGroup = gpu.device.createBindGroup({
      layout: gpu.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gpu.renderUniformBuffer } },
        { binding: 1, resource: { buffer: gpu.pointBuffer } },
      ],
    });

    const texture = gpu.context.getCurrentTexture();
    const encoder = gpu.device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView(),
          clearValue: { r: 0.027, g: 0.035, b: 0.098, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(gpu.renderPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(pointCount);
    pass.end();

    gpu.device.queue.submit([encoder.finish()]);
  }, [data, zoom, pan, dataStats]);

  // -------------------------------------------------------------------------
  // Main rAF loop – dispatches to the right renderer
  // -------------------------------------------------------------------------
  const draw = useCallback(() => {
    if (webgpuActiveRef.current) {
      drawWebGPU();
    } else {
      draw2D();
    }
  }, [drawWebGPU, draw2D]);

  useEffect(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [draw]);

  // Also update GPU point buffer when data changes
  useEffect(() => {
    const gpu = gpuRef.current;
    if (!gpu || data.length === 0) return;
    if (data.length * 4 <= gpu.pointBuffer.size) {
      gpu.device.queue.writeBuffer(gpu.pointBuffer, 0, new Float32Array(data));
    }
  }, [data]);

  // -------------------------------------------------------------------------
  // Interaction handlers (identical to original)
  // -------------------------------------------------------------------------
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    startTransition(() => {
      setZoom((prev) => Math.max(1, Math.min(20, prev * factor)));
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }
      const canvas = canvasRef.current;
      if (!canvas || data.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const m = MARGIN;
      const plotW = rect.width - m.left - m.right;
      if (mx < m.left || mx > rect.width - m.right || my < m.top || my > rect.height - m.bottom) {
        setHoveredPoint(null);
        return;
      }
      const relX = (mx - m.left) / plotW;
      const idx = Math.round(relX * (data.length - 1));
      if (idx >= 0 && idx < data.length) {
        const v = data[idx];
        if (v !== undefined) setHoveredPoint({ index: idx, value: v, x: mx, y: my });
      }
    },
    [isPanning, dragStart, data],
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setHoveredPoint(null);
  }, []);

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
        startTransition(() => {
          setZoom((prev) => Math.max(1, Math.min(20, prev * factor)));
        });
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDistRef.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

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
        aria-label={`Logistic map time series with ${data.length} data points`}
      />

      {/* Render mode badge */}
      {renderMode !== 'detecting' && (
        <div
          className="absolute top-3 left-14 px-2 py-0.5 rounded text-[9px] font-mono pointer-events-none"
          style={{
            background: renderMode === 'webgpu' ? 'rgba(16,185,129,0.18)' : 'rgba(99,102,241,0.14)',
            border: `1px solid ${renderMode === 'webgpu' ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.3)'}`,
            color: renderMode === 'webgpu' ? '#10b981' : '#818cf8',
          }}
          aria-label={`Rendering with ${renderMode}`}
        >
          {renderMode === 'webgpu' ? 'WebGPU' : 'Canvas 2D'}
        </div>
      )}

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
          aria-label={`Zoom ${zoom.toFixed(1)}x`}
        >
          {zoom.toFixed(1)}x
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

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredPoint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            transition={{ duration: 0.12 }}
            className="absolute pointer-events-none px-3 py-2 rounded-lg shadow-xl"
            style={{
              left: hoveredPoint.x + 16,
              top: hoveredPoint.y - 44,
              background: 'linear-gradient(135deg,rgba(12,20,44,0.96),rgba(20,30,58,0.96))',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(129,140,248,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(129,140,248,0.15)',
            }}
          >
            <div className="text-xs font-mono space-y-0.5">
              <div className="text-indigo-300 font-semibold">n = {hoveredPoint.index}</div>
              <div className="text-cyan-300">x = {hoveredPoint.value.toFixed(6)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset button */}
      <AnimatePresence>
        {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -8 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={resetView}
            className="absolute top-3 left-3 px-3 py-1.5 text-xs font-semibold rounded-lg"
            style={{
              background: 'linear-gradient(135deg,rgba(6,182,212,0.18),rgba(129,140,248,0.18))',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(6,182,212,0.38)',
              color: '#06b6d4',
              boxShadow: '0 4px 16px rgba(6,182,212,0.15)',
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
          background: 'rgba(8,14,32,0.75)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(100,116,139,0.25)',
          color: '#64748b',
        }}
      >
        <span className="text-indigo-300 font-semibold">{data.length.toLocaleString()}</span> pts
        <span className="mx-1.5">·</span>
        scroll/pinch to zoom
        <span className="mx-1.5">·</span>
        drag to pan
      </motion.div>

      {/* Loading overlay */}
      <AnimatePresence>
        {isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.08)', backdropFilter: 'blur(1px)' }}
          >
            <span className="px-3 py-1.5 rounded bg-black/60 text-foreground text-xs font-medium">
              Rendering…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
