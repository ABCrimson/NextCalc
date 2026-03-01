'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface TimeDomainRendererProps {
  signal: number[];
  width?: number;
  height?: number;
  sampleRate?: number;
}

// ---------------------------------------------------------------------------
// WebGPU feature detection (safe for SSR)
// ---------------------------------------------------------------------------
const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

// ---------------------------------------------------------------------------
// WGSL shaders
// ---------------------------------------------------------------------------

/**
 * Vertex shader: positions each sample as a vertex along the waveform.
 * Fragment shader: colours each fragment with the emerald→teal→cyan→indigo→purple
 * gradient based on horizontal progress, modulated by amplitude.
 */
const WAVEFORM_SHADER = /* wgsl */ `
struct Uniforms {
  startSample : f32,
  endSample   : f32,
  minVal      : f32,
  maxVal      : f32,
  plotX       : f32,
  plotY       : f32,
  plotW       : f32,
  plotH       : f32,
  canvasW     : f32,
  canvasH     : f32,
  totalSamples: u32,
  _pad        : u32,
};

@group(0) @binding(0) var<uniform> uni : Uniforms;
@group(0) @binding(1) var<storage, read> signal : array<f32>;

struct VOut {
  @builtin(position) pos : vec4<f32>,
  @location(0)       t   : f32,   // horizontal progress [0,1]
  @location(1)       amp : f32,   // normalised amplitude [0,1]
};

@vertex
fn vs_main(@builtin(vertex_index) vi : u32) -> VOut {
  var out : VOut;
  let start = u32(uni.startSample);
  let end   = u32(uni.endSample);
  let idx   = start + vi;
  if (idx > end || idx >= uni.totalSamples) {
    out.pos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    out.t   = 0.0;
    out.amp = 0.0;
    return out;
  }

  let value  = signal[idx];
  let range  = uni.maxVal - uni.minVal;
  let normY  = select((value - uni.minVal) / range, 0.5, range < 1e-9);
  let normX  = f32(vi) / f32(end - start);

  let cx  = uni.plotX + normX * uni.plotW;
  let cy  = uni.plotY + uni.plotH - normY * uni.plotH;

  let ndcX = (cx / uni.canvasW) * 2.0 - 1.0;
  let ndcY = 1.0 - (cy / uni.canvasH) * 2.0;

  out.pos = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.t   = normX;
  out.amp = abs(value) / max(abs(uni.minVal), abs(uni.maxVal));
  return out;
}

@fragment
fn fs_main(@location(0) t : f32, @location(1) amp : f32) -> @location(0) vec4<f32> {
  // Gradient stops: emerald(160°) → teal(140°) → cyan(190°) → indigo(240°) → purple(280°)
  var hue : f32;
  if (t < 0.25) {
    hue = mix(160.0, 140.0, t / 0.25);
  } else if (t < 0.5) {
    hue = mix(140.0, 190.0, (t - 0.25) / 0.25);
  } else if (t < 0.75) {
    hue = mix(190.0, 240.0, (t - 0.5) / 0.25);
  } else {
    hue = mix(240.0, 280.0, (t - 0.75) / 0.25);
  }
  let lightness = 0.50 + amp * 0.15;

  // HSL → RGB inline (saturation fixed at 0.80)
  let s = 0.80;
  let l = clamp(lightness, 0.0, 1.0);
  let h = hue / 60.0;
  let c = (1.0 - abs(2.0 * l - 1.0)) * s;
  let x = c * (1.0 - abs(h % 2.0 - 1.0));
  var r = 0.0; var g = 0.0; var b = 0.0;
  if      (h < 1.0) { r = c; g = x; }
  else if (h < 2.0) { r = x; g = c; }
  else if (h < 3.0) { g = c; b = x; }
  else if (h < 4.0) { g = x; b = c; }
  else if (h < 5.0) { r = x; b = c; }
  else              { r = c; b = x; }
  let m2 = l - c / 2.0;
  return vec4<f32>(r + m2, g + m2, b + m2, 1.0);
}
`;

interface GPUResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  signalBuffer: GPUBuffer;
  maxSignalLen: number;
}

/**
 * High-Performance Time Domain Signal Renderer
 *
 * Rendering path:
 * 1. WebGPU (preferred): WGSL fragment shader handles the emerald→purple gradient
 *    colour with amplitude modulation in a single draw call (line-strip).
 * 2. Canvas 2D fallback: full existing per-segment gradient implementation.
 */
export function TimeDomainRenderer({ signal, sampleRate = 1 }: TimeDomainRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gpuRef = useRef<GPUResources | null>(null);
  const webgpuActiveRef = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [hoveredSample, setHoveredSample] = useState<{
    index: number;
    value: number;
    time: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [renderMode, setRenderMode] = useState<'webgpu' | 'canvas2d' | 'detecting'>('detecting');

  const signalStats = useMemo(() => {
    if (signal.length === 0) return { min: -1, max: 1, range: 2, rms: 0, peak: 0 };
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min || 2;
    const rms = Math.sqrt(signal.reduce((sum, v) => sum + v * v, 0) / signal.length);
    const peak = Math.max(Math.abs(min), Math.abs(max));
    return { min, max, range, rms, peak };
  }, [signal]);

  // -------------------------------------------------------------------------
  // Canvas 2D fallback – identical to original implementation
  // -------------------------------------------------------------------------
  const draw2D = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || signal.length === 0) return;

    const startTime = performance.now();
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

    const w = rect.width;
    const h = rect.height;
    const margin = { top: 40, right: 40, bottom: 50, left: 60 };
    const plotWidth = w - margin.left - margin.right;
    const plotHeight = h - margin.top - margin.bottom;

    const bgGradient = ctx.createLinearGradient(0, 0, 0, h);
    bgGradient.addColorStop(0, '#0a0f1e');
    bgGradient.addColorStop(0.5, '#0f1419');
    bgGradient.addColorStop(1, '#0a0f1e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);

    const plotGradient = ctx.createRadialGradient(
      margin.left + plotWidth / 2,
      margin.top + plotHeight / 2,
      0,
      margin.left + plotWidth / 2,
      margin.top + plotHeight / 2,
      Math.max(plotWidth, plotHeight) / 2,
    );
    plotGradient.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    plotGradient.addColorStop(1, 'rgba(15, 23, 42, 0.5)');
    ctx.fillStyle = plotGradient;
    ctx.fillRect(margin.left, margin.top, plotWidth, plotHeight);

    const borderGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + plotHeight);
    borderGradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    borderGradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.4)');
    borderGradient.addColorStop(1, 'rgba(139, 92, 246, 0.4)');
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 2;
    ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);

    // Compute visible window BEFORE drawing grid so ticks match zoomed view
    const visibleSamples = Math.floor(signal.length / zoom);
    const startSample = Math.max(0, Math.min(signal.length - visibleSamples, Math.floor(pan)));
    const endSample = Math.min(signal.length, startSample + visibleSamples);

    const visibleStartTime = startSample / sampleRate;
    const visibleEndTime = endSample / sampleRate;
    const visibleTimeRange = visibleEndTime - visibleStartTime;

    // Nice tick step helper
    const niceTickStep = (range: number, targetTicks = 6): number => {
      if (range <= 0) return 1;
      const rough = range / targetTicks;
      const mag = 10 ** Math.floor(Math.log10(rough));
      const residual = rough / mag;
      const nice = residual <= 1.5 ? 1 : residual <= 3 ? 2 : residual <= 7 ? 5 : 10;
      return nice * mag;
    };

    ctx.save();
    const centerY = margin.top + plotHeight / 2;
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin.left, centerY);
    ctx.lineTo(margin.left + plotWidth, centerY);
    ctx.stroke();

    const numHLines = 8;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= numHLines; i++) {
      const y = margin.top + (i * plotHeight) / numHLines;
      ctx.globalAlpha = i === numHLines / 2 ? 0 : 0.4;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + plotWidth, y);
      ctx.stroke();
      if (i !== numHLines / 2) {
        const value = signalStats.max - (i / numHLines) * signalStats.range;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.fillText(value.toFixed(2), margin.left - 10, y + 4);
      }
    }

    // X-axis ticks: use visible window range, not full signal range
    const xTickStep = niceTickStep(visibleTimeRange);
    const xTickStart = Math.ceil(visibleStartTime / xTickStep) * xTickStep;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.lineWidth = 1;
    for (let t = xTickStart; t <= visibleEndTime; t += xTickStep) {
      const frac = (t - visibleStartTime) / visibleTimeRange;
      const x = margin.left + frac * plotWidth;
      if (x < margin.left - 1 || x > margin.left + plotWidth + 1) continue;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + plotHeight);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.fillText(t.toFixed(2), x, margin.top + plotHeight + 20);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    const axisGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + plotHeight);
    axisGradient.addColorStop(0, 'rgba(16, 185, 129, 0.9)');
    axisGradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.9)');
    axisGradient.addColorStop(1, 'rgba(139, 92, 246, 0.9)');
    ctx.strokeStyle = axisGradient;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + plotHeight);
    ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, plotWidth, plotHeight);
    ctx.clip();

    const xScale = (index: number) => {
      const normalized = (index - startSample) / (endSample - startSample);
      return margin.left + normalized * plotWidth;
    };
    const yScale = (value: number) => {
      const normalized = (value - signalStats.min) / signalStats.range;
      return margin.top + plotHeight - normalized * plotHeight;
    };

    if (endSample - startSample > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const segments = Math.min(endSample - startSample, 1000);
      const step = (endSample - startSample) / segments;

      for (let seg = 0; seg < segments; seg++) {
        const i = Math.floor(startSample + seg * step);
        const nextI = Math.floor(startSample + (seg + 1) * step);
        if (nextI >= signal.length) break;
        const value = signal[i] ?? 0;
        const nextValue = signal[nextI] ?? 0;
        const progress = (i - startSample) / (endSample - startSample);
        const amplitude = Math.abs(value) / signalStats.peak;
        let hue: number;
        let saturation: number;
        let lightness: number;
        if (progress < 0.25) {
          const t = progress / 0.25;
          hue = 160 - t * 20;
          saturation = 70 + t * 10;
          lightness = 50 + amplitude * 15;
        } else if (progress < 0.5) {
          const t = (progress - 0.25) / 0.25;
          hue = 140 + t * 50;
          saturation = 80 + t * 5;
          lightness = 50 + amplitude * 15;
        } else if (progress < 0.75) {
          const t = (progress - 0.5) / 0.25;
          hue = 190 + t * 50;
          saturation = 85 - t * 15;
          lightness = 50 + amplitude * 15;
        } else {
          const t = (progress - 0.75) / 0.25;
          hue = 240 + t * 40;
          saturation = 70 + t * 10;
          lightness = 50 + amplitude * 15;
        }
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.beginPath();
        ctx.moveTo(xScale(i), yScale(value));
        ctx.lineTo(xScale(nextI), yScale(nextValue));
        ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.3)`;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 4;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (zoom > 2 && endSample - startSample < 200) {
        for (let i = startSample; i < endSample; i++) {
          const value = signal[i] ?? 0;
          const x = xScale(i);
          const y = yScale(value);
          const progress = (i - startSample) / (endSample - startSample);
          let hue: number;
          if (progress < 0.25) {
            hue = 160 - (progress / 0.25) * 20;
          } else if (progress < 0.5) {
            hue = 140 + ((progress - 0.25) / 0.25) * 50;
          } else if (progress < 0.75) {
            hue = 190 + ((progress - 0.5) / 0.25) * 50;
          } else {
            hue = 240 + ((progress - 0.75) / 0.25) * 40;
          }
          const color = `hsl(${hue}, 80%, 60%)`;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowBlur = 3;
          ctx.shadowColor = color;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, centerY);
          ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.3)`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    ctx.save();
    const xLabelGradient = ctx.createLinearGradient(0, 0, w, 0);
    xLabelGradient.addColorStop(0, '#10b981');
    xLabelGradient.addColorStop(0.5, '#06b6d4');
    xLabelGradient.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = xLabelGradient;
    ctx.font = 'bold 14px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(99,102,241,0.6)';
    ctx.fillText('Time (s)', margin.left + plotWidth / 2, h - 15);
    ctx.translate(20, margin.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Amplitude', 0, 0);
    ctx.restore();

    const titleGradient = ctx.createLinearGradient(0, 25, w, 25);
    titleGradient.addColorStop(0, '#a5b4fc');
    titleGradient.addColorStop(0.5, '#c4b5fd');
    titleGradient.addColorStop(1, '#a5b4fc');
    ctx.fillStyle = titleGradient;
    ctx.font = 'bold 16px ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(99,102,241,0.8)';
    ctx.fillText('Time Domain Signal', margin.left + plotWidth / 2, 25);

    const endTime = performance.now();
    const frameTime = endTime - startTime;
    ctx.shadowBlur = 0;
    const badgeX = w - 180,
      badgeY = 8,
      badgeW = 170,
      badgeH = 26;
    ctx.fillStyle = 'rgba(6,182,212,0.15)';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = 'rgba(6,182,212,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${signal.length.toLocaleString()} samples • ${frameTime.toFixed(1)}ms • ${(1000 / frameTime).toFixed(0)} fps`,
      badgeX + badgeW / 2,
      badgeY + 17,
    );
  }, [signal, zoom, pan, signalStats, sampleRate]);

  // -------------------------------------------------------------------------
  // WebGPU draw
  // -------------------------------------------------------------------------
  const drawWebGPU = useCallback(() => {
    const gpu = gpuRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!gpu || !canvas || !container || signal.length === 0) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.floor(rect.width * dpr);
    const H = Math.floor(rect.height * dpr);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const margin = { top: 40 * dpr, right: 40 * dpr, bottom: 50 * dpr, left: 60 * dpr };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const visibleSamples = Math.floor(signal.length / zoom);
    const startSample = Math.max(0, Math.min(signal.length - visibleSamples, Math.floor(pan)));
    const endSample = Math.min(signal.length - 1, startSample + visibleSamples - 1);
    const pointCount = endSample - startSample + 1;

    // Write signal slice
    const slice = new Float32Array(signal.slice(startSample, endSample + 1));
    if (slice.byteLength <= gpu.signalBuffer.size) {
      gpu.device.queue.writeBuffer(gpu.signalBuffer, 0, slice);
    }

    // Write uniforms
    const uniformData = new Float32Array([
      0,
      pointCount - 1,
      signalStats.min,
      signalStats.max,
      margin.left,
      margin.top,
      plotW,
      plotH,
      W,
      H,
    ]);
    const uniformU32 = new Uint32Array(uniformData.buffer);
    uniformU32[10] = pointCount;
    uniformU32[11] = 0;
    gpu.device.queue.writeBuffer(gpu.uniformBuffer, 0, uniformData.buffer);

    const bindGroup = gpu.device.createBindGroup({
      layout: gpu.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gpu.uniformBuffer } },
        { binding: 1, resource: { buffer: gpu.signalBuffer } },
      ],
    });

    const texture = gpu.context.getCurrentTexture();
    const encoder = gpu.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView(),
          clearValue: { r: 0.039, g: 0.059, b: 0.118, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(gpu.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(pointCount);
    pass.end();
    gpu.device.queue.submit([encoder.finish()]);
  }, [signal, zoom, pan, signalStats]);

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

        const module = device.createShaderModule({ code: WAVEFORM_SHADER });
        const pipeline = await device.createRenderPipelineAsync({
          layout: 'auto',
          vertex: { module, entryPoint: 'vs_main' },
          fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
          primitive: { topology: 'line-strip' },
        });

        const maxSignalLen = Math.max(signal.length, 65536);
        const signalBuffer = device.createBuffer({
          size: maxSignalLen * 4,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        // Uniform: 10 f32 + 2 u32 = 48 bytes
        const uniformBuffer = device.createBuffer({
          size: 48,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        if (signal.length > 0) {
          device.queue.writeBuffer(signalBuffer, 0, new Float32Array(signal));
        }

        gpuRef.current = { device, context, pipeline, uniformBuffer, signalBuffer, maxSignalLen };

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
        gpu.uniformBuffer.destroy();
        gpu.signalBuffer.destroy();
        gpu.device.destroy();
        gpuRef.current = null;
      }
      webgpuActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update signal buffer when signal changes
  useEffect(() => {
    const gpu = gpuRef.current;
    if (!gpu || signal.length === 0) return;
    if (signal.length * 4 <= gpu.signalBuffer.size) {
      gpu.device.queue.writeBuffer(gpu.signalBuffer, 0, new Float32Array(signal));
    }
  }, [signal]);

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

  // -------------------------------------------------------------------------
  // Interaction handlers
  // -------------------------------------------------------------------------
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY / 500;
    setZoom((prevZoom) => Math.max(1, Math.min(20, prevZoom * (1 + delta))));
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      setIsPanning(true);
      setDragStart(e.clientX - pan);
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning) {
        const newPan = e.clientX - dragStart;
        const maxPan = signal.length - signal.length / zoom;
        setPan(Math.max(0, Math.min(maxPan, newPan)));
      }
      const canvas = canvasRef.current;
      if (!canvas || signal.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const margin = { top: 40, right: 40, bottom: 50, left: 60 };
      if (
        mouseX < margin.left ||
        mouseX > rect.width - margin.right ||
        mouseY < margin.top ||
        mouseY > rect.height - margin.bottom
      ) {
        setHoveredSample(null);
        return;
      }
      const plotWidth = rect.width - margin.left - margin.right;
      const relativeX = (mouseX - margin.left) / plotWidth;
      const visibleSamples = Math.floor(signal.length / zoom);
      const startSample = Math.max(0, Math.min(signal.length - visibleSamples, Math.floor(pan)));
      const sampleIndex = Math.floor(startSample + relativeX * visibleSamples);
      if (sampleIndex >= 0 && sampleIndex < signal.length) {
        const value = signal[sampleIndex] ?? 0;
        setHoveredSample({
          index: sampleIndex,
          value,
          time: sampleIndex / sampleRate,
          screenX: mouseX,
          screenY: mouseY,
        });
      } else {
        setHoveredSample(null);
      }
    },
    [isPanning, dragStart, signal, zoom, pan, sampleRate],
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setHoveredSample(null);
  }, []);
  const resetView = useCallback(() => {
    setZoom(1);
    setPan(0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return (
    <div ref={containerRef} className="relative w-full h-full group">
      <canvas
        ref={canvasRef}
        className="w-full h-full transition-transform duration-200 ease-out"
        style={{ cursor: isPanning ? 'grabbing' : 'grab', willChange: 'transform' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        role="img"
        aria-label={`Time domain signal with ${signal.length} samples`}
      />

      {/* Render mode badge */}
      {renderMode !== 'detecting' && (
        <div
          className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-mono pointer-events-none"
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

      <AnimatePresence>
        {hoveredSample && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute pointer-events-none px-3 py-2 rounded-lg shadow-xl"
            style={{
              left: hoveredSample.screenX + 15,
              top: hoveredSample.screenY - 60,
              background:
                'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(99,102,241,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.2)',
            }}
          >
            <div className="text-xs font-mono space-y-0.5">
              <div className="text-emerald-300 font-semibold">Sample: {hoveredSample.index}</div>
              <div className="text-cyan-300">Time: {hoveredSample.time.toFixed(4)}s</div>
              <div className="text-purple-300">Value: {hoveredSample.value.toFixed(4)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(zoom !== 1 || pan !== 0) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetView}
            className="absolute top-2 left-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200"
            style={{
              background:
                'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(99,102,241,0.2) 100%)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(6,182,212,0.4)',
              color: '#06b6d4',
              boxShadow: '0 4px 16px rgba(6,182,212,0.2)',
            }}
            aria-label="Reset view to default zoom and pan"
          >
            Reset View
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute bottom-2 left-2 px-3 py-1.5 rounded-lg text-xs font-mono"
        style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.8) 100%)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(100,116,139,0.3)',
          color: '#94a3b8',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <span className="text-emerald-300 font-semibold">RMS: {signalStats.rms.toFixed(3)}</span>
        <span className="mx-2 text-muted-foreground">•</span>
        <span className="text-cyan-300">Peak: {signalStats.peak.toFixed(3)}</span>
        <span className="mx-2 text-muted-foreground">•</span>
        Scroll to zoom
        <span className="mx-2 text-muted-foreground">•</span>
        Drag to pan
      </motion.div>
    </div>
  );
}
