'use client';

import { AnimatePresence, m } from 'framer-motion';
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface FrequencySpectrumRendererProps {
  frequencies: number[];
  magnitudes: number[];
  phases?: number[];
  sampleRate?: number;
  showPhase?: boolean;
}

// ---------------------------------------------------------------------------
// WebGPU feature detection (safe for SSR)
// ---------------------------------------------------------------------------
const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

// ---------------------------------------------------------------------------
// WGSL shaders
// ---------------------------------------------------------------------------

/**
 * Instanced rendering: each bar is a rectangle drawn with 2 triangles (6 verts).
 * Per-instance data: barIndex packed into instance_index.
 * The fragment shader computes vertical gradient + horizontal hue shift.
 */
const BAR_SHADER = /* wgsl */ `
struct Uniforms {
  startBin     : u32,
  endBin       : u32,
  maxMagnitude : f32,
  plotX        : f32,
  plotY        : f32,
  plotW        : f32,
  plotH        : f32,
  canvasW      : f32,
  canvasH      : f32,
  _pad0        : u32,
  _pad1        : u32,
  _pad2        : u32,
};

@group(0) @binding(0) var<uniform> uni : Uniforms;
@group(0) @binding(1) var<storage, read> magnitudes : array<f32>;

struct VOut {
  @builtin(position) pos       : vec4<f32>,
  @location(0)       progress  : f32,  // horizontal [0,1]
  @location(1)       normHeight: f32,  // bar normalised height [0,1]
  @location(2)       vFrac     : f32,  // vertical fraction within bar [0=bottom,1=top]
};

// Local quad vertices in bar-local space ([0,1]×[0,1])
const QUAD = array<vec2<f32>, 6>(
  vec2<f32>(0.0, 0.0),
  vec2<f32>(1.0, 0.0),
  vec2<f32>(0.0, 1.0),
  vec2<f32>(1.0, 0.0),
  vec2<f32>(1.0, 1.0),
  vec2<f32>(0.0, 1.0),
);

@vertex
fn vs_main(
  @builtin(vertex_index)   vi  : u32,
  @builtin(instance_index) inst: u32,
) -> VOut {
  var out : VOut;

  let binIdx    = uni.startBin + inst;
  let barCount  = uni.endBin - uni.startBin;
  if (binIdx >= uni.endBin || barCount == 0u) {
    out.pos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    out.progress = 0.0; out.normHeight = 0.0; out.vFrac = 0.0;
    return out;
  }

  let magnitude  = magnitudes[binIdx];
  let normHeight = clamp(magnitude / max(uni.maxMagnitude, 1e-9), 0.0, 1.0);
  let progress   = f32(inst) / f32(barCount);

  // Bar layout
  let barW  = uni.plotW / f32(barCount);
  let gap   = max(0.5, min(2.0, barW * 0.1));
  let barX  = uni.plotX + f32(inst) * barW;
  let barH  = normHeight * uni.plotH;
  let barY  = uni.plotY + uni.plotH - barH;

  let local  = QUAD[vi];
  let cx     = barX + local.x * (barW - gap);
  let cy     = barY + (1.0 - local.y) * barH;

  let ndcX = (cx / uni.canvasW) * 2.0 - 1.0;
  let ndcY = 1.0 - (cy / uni.canvasH) * 2.0;

  out.pos        = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.progress   = progress;
  out.normHeight = normHeight;
  out.vFrac      = local.y;  // 0 = bottom of bar, 1 = top
  return out;
}

// HSL → RGB helper
fn hsl2rgb(h: f32, s: f32, l: f32) -> vec3<f32> {
  let c = (1.0 - abs(2.0 * l - 1.0)) * s;
  let hp = h / 60.0;
  let x = c * (1.0 - abs(hp % 2.0 - 1.0));
  var r = 0.0; var g = 0.0; var b = 0.0;
  if      (hp < 1.0) { r = c; g = x; }
  else if (hp < 2.0) { r = x; g = c; }
  else if (hp < 3.0) { g = c; b = x; }
  else if (hp < 4.0) { g = x; b = c; }
  else if (hp < 5.0) { r = x; b = c; }
  else               { r = c; b = x; }
  let m2 = l - c / 2.0;
  return vec3<f32>(r + m2, g + m2, b + m2);
}

@fragment
fn fs_main(
  @location(0) progress  : f32,
  @location(1) normHeight: f32,
  @location(2) vFrac     : f32,
) -> @location(0) vec4<f32> {
  // Horizontal hue gradient: emerald→teal→cyan→indigo→purple
  var hue: f32;
  if      (progress < 0.25) { hue = mix(160.0, 140.0, progress / 0.25); }
  else if (progress < 0.5)  { hue = mix(140.0, 190.0, (progress - 0.25) / 0.25); }
  else if (progress < 0.75) { hue = mix(190.0, 240.0, (progress - 0.50) / 0.25); }
  else                      { hue = mix(240.0, 280.0, (progress - 0.75) / 0.25); }

  // Vertical brightness: darker at bottom, brighter at top
  let lightness = mix(0.35, 0.65 + normHeight * 0.15, vFrac);
  let saturation = 0.80;

  var col = hsl2rgb(hue, saturation, clamp(lightness, 0.0, 1.0));

  // Top highlight on uppermost pixels
  if (vFrac > 0.92) {
    col = mix(col, vec3<f32>(1.0), (vFrac - 0.92) / 0.08 * 0.5);
  }

  return vec4<f32>(col, 0.85);
}
`;

interface GPUResources {
  device: GPUDevice;
  context: GPUCanvasContext;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  magnitudeBuffer: GPUBuffer;
  maxMagnitudeLen: number;
}

/**
 * High-Performance Frequency Spectrum Renderer
 *
 * Rendering path:
 * 1. WebGPU (preferred): instanced bar rendering – each bar is a quad instance;
 *    the fragment shader handles per-bar vertical gradient and horizontal hue.
 * 2. Canvas 2D fallback: full existing per-bar gradient implementation.
 */
export function FrequencySpectrumRenderer({
  frequencies,
  magnitudes,
  phases,
  sampleRate = 1,
  showPhase = false,
}: FrequencySpectrumRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gpuRef = useRef<GPUResources | null>(null);
  const webgpuActiveRef = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [hoveredBin, setHoveredBin] = useState<{
    index: number;
    frequency: number;
    magnitude: number;
    phase?: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [renderMode, setRenderMode] = useState<'webgpu' | 'canvas2d' | 'detecting'>('detecting');

  const spectrumStats = useMemo(() => {
    if (magnitudes.length === 0)
      return { maxMagnitude: 1, totalEnergy: 0, dominantFrequency: 0, dominantMagnitude: 0 };
    const maxMagnitude = Math.max(...magnitudes);
    const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    const dominantIndex = magnitudes.indexOf(maxMagnitude);
    const dominantFrequency = frequencies[dominantIndex] ?? 0;
    return { maxMagnitude, totalEnergy, dominantFrequency, dominantMagnitude: maxMagnitude };
  }, [magnitudes, frequencies]);

  // -------------------------------------------------------------------------
  // Canvas 2D fallback – identical to original implementation
  // -------------------------------------------------------------------------
  const draw2D = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || magnitudes.length === 0) return;

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
    const margin = { top: 40, right: 40, bottom: 60, left: 70 };
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
    plotGradient.addColorStop(0, 'rgba(15,23,42,0.9)');
    plotGradient.addColorStop(1, 'rgba(15,23,42,0.5)');
    ctx.fillStyle = plotGradient;
    ctx.fillRect(margin.left, margin.top, plotWidth, plotHeight);

    const borderGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + plotHeight);
    borderGradient.addColorStop(0, 'rgba(16,185,129,0.4)');
    borderGradient.addColorStop(0.5, 'rgba(99,102,241,0.4)');
    borderGradient.addColorStop(1, 'rgba(139,92,246,0.4)');
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 2;
    ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);

    if (sampleRate > 1) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.font = 'bold 11px ui-sans-serif, sans-serif';
      ctx.textAlign = 'center';
      const bassEnd = Math.min(250, sampleRate / 2);
      const bassX = margin.left + ((bassEnd / (sampleRate / 2)) * plotWidth) / 2;
      ctx.fillStyle = '#10b981';
      ctx.fillText('BASS', bassX / 2 + margin.left / 2, margin.top + 20);
      const midEnd = Math.min(4000, sampleRate / 2);
      const midX = margin.left + (midEnd / (sampleRate / 2)) * plotWidth;
      ctx.fillStyle = '#06b6d4';
      ctx.fillText('MID', (bassX + midX) / 2, margin.top + 20);
      ctx.fillStyle = '#8b5cf6';
      ctx.fillText('TREBLE', (midX + margin.left + plotWidth) / 2, margin.top + 20);
      ctx.restore();
    }

    // Compute visible window BEFORE drawing grid so ticks match zoomed view
    const visibleBins = Math.min(magnitudes.length, Math.floor(magnitudes.length / zoom));
    const startBin = Math.max(0, Math.min(magnitudes.length - visibleBins, Math.floor(pan)));
    const endBin = Math.min(magnitudes.length, startBin + visibleBins);

    const maxFreq =
      sampleRate > 1 ? sampleRate / 2 : (frequencies[frequencies.length - 1] ?? magnitudes.length);
    const visibleStartFreq = (startBin / magnitudes.length) * maxFreq;
    const visibleEndFreq = (endBin / magnitudes.length) * maxFreq;
    const visibleFreqRange = visibleEndFreq - visibleStartFreq;

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
    ctx.strokeStyle = 'rgba(30,41,59,0.6)';
    ctx.lineWidth = 1;
    const numHLines = 8;
    for (let i = 0; i <= numHLines; i++) {
      const y = margin.top + (i * plotHeight) / numHLines;
      ctx.globalAlpha = i % 2 === 0 ? 0.7 : 0.3;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + plotWidth, y);
      ctx.stroke();
      const value = spectrumStats.maxMagnitude * (1 - i / numHLines);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.fillText(value.toFixed(1), margin.left - 10, y + 4);
    }

    // X-axis ticks: use visible window range, not full frequency range
    const xTickStep = niceTickStep(visibleFreqRange);
    const xTickStart = Math.ceil(visibleStartFreq / xTickStep) * xTickStep;
    ctx.strokeStyle = 'rgba(30,41,59,0.6)';
    ctx.lineWidth = 1;
    for (let f = xTickStart; f <= visibleEndFreq; f += xTickStep) {
      const frac = (f - visibleStartFreq) / visibleFreqRange;
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
      const label = f >= 1000 ? `${(f / 1000).toFixed(1)}k` : f.toFixed(0);
      ctx.fillText(label, x, margin.top + plotHeight + 20);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    const axisGradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + plotHeight);
    axisGradient.addColorStop(0, 'rgba(16,185,129,0.9)');
    axisGradient.addColorStop(0.5, 'rgba(99,102,241,0.9)');
    axisGradient.addColorStop(1, 'rgba(139,92,246,0.9)');
    ctx.strokeStyle = axisGradient;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(99,102,241,0.5)';
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
    const barCount = endBin - startBin;
    const barWidth = plotWidth / barCount;
    const barGap = Math.max(0.5, Math.min(2, barWidth * 0.1));

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (let i = startBin; i < endBin; i++) {
      const magnitude = magnitudes[i] ?? 0;
      if (magnitude <= 0) continue;
      const x = margin.left + ((i - startBin) / barCount) * plotWidth;
      const barHeight = (magnitude / spectrumStats.maxMagnitude) * plotHeight;
      const y = margin.top + plotHeight - barHeight;
      const progress = (i - startBin) / barCount;
      let hue: number;
      let saturation: number;
      let lightness: number;
      if (progress < 0.25) {
        const t = progress / 0.25;
        hue = 160 - t * 20;
        saturation = 70 + t * 10;
        lightness = 50 + (magnitude / spectrumStats.maxMagnitude) * 15;
      } else if (progress < 0.5) {
        const t = (progress - 0.25) / 0.25;
        hue = 140 + t * 50;
        saturation = 80 + t * 5;
        lightness = 50 + (magnitude / spectrumStats.maxMagnitude) * 15;
      } else if (progress < 0.75) {
        const t = (progress - 0.5) / 0.25;
        hue = 190 + t * 50;
        saturation = 85 - t * 15;
        lightness = 50 + (magnitude / spectrumStats.maxMagnitude) * 15;
      } else {
        const t = (progress - 0.75) / 0.25;
        hue = 240 + t * 40;
        saturation = 70 + t * 10;
        lightness = 50 + (magnitude / spectrumStats.maxMagnitude) * 15;
      }
      const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      const barGradient = ctx.createLinearGradient(x, y + barHeight, x, y);
      barGradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness - 10}%, 0.8)`);
      barGradient.addColorStop(0.5, color);
      barGradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness + 10}%, 0.9)`);
      ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.3)`;
      ctx.fillRect(x - 1, y - 2, barWidth - barGap + 2, barHeight + 2);
      ctx.fillStyle = barGradient;
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.fillRect(x, y, barWidth - barGap, barHeight);
      ctx.shadowBlur = 0;
      if (barHeight > 5) {
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness + 20}%, 0.6)`;
        ctx.fillRect(x, y, barWidth - barGap, 2);
      }
      if (magnitude === spectrumStats.maxMagnitude && spectrumStats.maxMagnitude > 0) {
        ctx.save();
        ctx.strokeStyle = `hsla(${hue}, 100%, 80%, 0.9)`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.strokeRect(x - 2, y - 2, barWidth - barGap + 4, barHeight + 4);
        ctx.restore();
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
    ctx.fillText('Frequency (Hz)', margin.left + plotWidth / 2, h - 15);
    ctx.translate(20, margin.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Magnitude', 0, 0);
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
    ctx.fillText(
      showPhase ? 'Phase Spectrum' : 'Magnitude Spectrum',
      margin.left + plotWidth / 2,
      25,
    );

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
      `${magnitudes.length} bins • ${frameTime.toFixed(1)}ms • ${(1000 / frameTime).toFixed(0)} fps`,
      badgeX + badgeW / 2,
      badgeY + 17,
    );
  }, [magnitudes, frequencies, zoom, pan, spectrumStats, sampleRate, showPhase]);

  // -------------------------------------------------------------------------
  // WebGPU draw
  // -------------------------------------------------------------------------
  const drawWebGPU = useCallback(() => {
    const gpu = gpuRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!gpu || !canvas || !container || magnitudes.length === 0) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.floor(rect.width * dpr);
    const H = Math.floor(rect.height * dpr);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const margin = { top: 40 * dpr, right: 40 * dpr, bottom: 60 * dpr, left: 70 * dpr };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const visibleBins = Math.min(magnitudes.length, Math.floor(magnitudes.length / zoom));
    const startBin = Math.max(0, Math.min(magnitudes.length - visibleBins, Math.floor(pan)));
    const endBin = Math.min(magnitudes.length, startBin + visibleBins);
    const instanceCount = endBin - startBin;

    // Upload magnitude slice
    const slice = new Float32Array(magnitudes.slice(startBin, endBin));
    if (slice.byteLength <= gpu.magnitudeBuffer.size) {
      gpu.device.queue.writeBuffer(gpu.magnitudeBuffer, 0, slice);
    }

    // Write uniforms (48 bytes: 3 u32 + 9 f32 + 3 u32 pad)
    const uniformData = new ArrayBuffer(48);
    const f32View = new Float32Array(uniformData);
    const u32View = new Uint32Array(uniformData);
    u32View[0] = 0; // startBin (relative to slice = 0)
    u32View[1] = instanceCount; // endBin
    f32View[2] = spectrumStats.maxMagnitude;
    f32View[3] = margin.left;
    f32View[4] = margin.top;
    f32View[5] = plotW;
    f32View[6] = plotH;
    f32View[7] = W;
    f32View[8] = H;
    u32View[9] = 0;
    u32View[10] = 0;
    u32View[11] = 0;
    gpu.device.queue.writeBuffer(gpu.uniformBuffer, 0, uniformData);

    const bindGroup = gpu.device.createBindGroup({
      layout: gpu.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gpu.uniformBuffer } },
        { binding: 1, resource: { buffer: gpu.magnitudeBuffer } },
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
    // 6 vertices per instance (2 triangles), instanceCount bars
    pass.draw(6, instanceCount);
    pass.end();
    gpu.device.queue.submit([encoder.finish()]);
  }, [magnitudes, zoom, pan, spectrumStats]);

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

        const module = device.createShaderModule({ code: BAR_SHADER });
        const pipeline = await device.createRenderPipelineAsync({
          layout: 'auto',
          vertex: { module, entryPoint: 'vs_main' },
          fragment: {
            module,
            entryPoint: 'fs_main',
            targets: [
              {
                format,
                blend: {
                  color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
                  alpha: { srcFactor: 'one', dstFactor: 'zero' },
                },
              },
            ],
          },
          primitive: { topology: 'triangle-list' },
        });

        const maxMagnitudeLen = Math.max(magnitudes.length, 4096);
        const magnitudeBuffer = device.createBuffer({
          size: maxMagnitudeLen * 4,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const uniformBuffer = device.createBuffer({
          size: 48,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        if (magnitudes.length > 0) {
          device.queue.writeBuffer(magnitudeBuffer, 0, new Float32Array(magnitudes));
        }

        gpuRef.current = {
          device,
          context,
          pipeline,
          uniformBuffer,
          magnitudeBuffer,
          maxMagnitudeLen,
        };

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
        gpu.magnitudeBuffer.destroy();
        gpu.device.destroy();
        gpuRef.current = null;
      }
      webgpuActiveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update magnitude buffer when data changes
  useEffect(() => {
    const gpu = gpuRef.current;
    if (!gpu || magnitudes.length === 0) return;
    if (magnitudes.length * 4 <= gpu.magnitudeBuffer.size) {
      gpu.device.queue.writeBuffer(gpu.magnitudeBuffer, 0, new Float32Array(magnitudes));
    }
  }, [magnitudes]);

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
  // Interaction handlers (identical to original)
  // -------------------------------------------------------------------------
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY / 500;
    setZoom((prevZoom) => Math.max(1, Math.min(10, prevZoom * (1 + delta))));
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
        const maxPan = magnitudes.length - magnitudes.length / zoom;
        setPan(Math.max(0, Math.min(maxPan, newPan)));
      }
      const canvas = canvasRef.current;
      if (!canvas || magnitudes.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const margin = { top: 40, right: 40, bottom: 60, left: 70 };
      if (
        mouseX < margin.left ||
        mouseX > rect.width - margin.right ||
        mouseY < margin.top ||
        mouseY > rect.height - margin.bottom
      ) {
        setHoveredBin(null);
        return;
      }
      const plotWidth = rect.width - margin.left - margin.right;
      const relativeX = (mouseX - margin.left) / plotWidth;
      const visibleBins = Math.min(magnitudes.length, Math.floor(magnitudes.length / zoom));
      const startBin = Math.max(0, Math.min(magnitudes.length - visibleBins, Math.floor(pan)));
      const binIndex = Math.floor(startBin + relativeX * visibleBins);
      if (binIndex >= 0 && binIndex < magnitudes.length) {
        const magnitude = magnitudes[binIndex] ?? 0;
        const frequency =
          frequencies[binIndex] ?? (binIndex * sampleRate) / (2 * magnitudes.length);
        const phase = phases?.[binIndex];
        setHoveredBin({
          index: binIndex,
          frequency,
          magnitude,
          ...(phase !== undefined && { phase }),
          screenX: mouseX,
          screenY: mouseY,
        });
      } else {
        setHoveredBin(null);
      }
    },
    [isPanning, dragStart, magnitudes, frequencies, phases, zoom, pan, sampleRate],
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setHoveredBin(null);
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
        aria-label={`Frequency spectrum with ${magnitudes.length} frequency bins`}
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
        {hoveredBin && (
          <m.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute pointer-events-none px-3 py-2 rounded-lg shadow-xl"
            style={{
              left: hoveredBin.screenX + 15,
              top: hoveredBin.screenY - 70,
              background:
                'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(99,102,241,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.2)',
            }}
          >
            <div className="text-xs font-mono space-y-0.5">
              <div className="text-emerald-300 font-semibold">
                {hoveredBin.frequency >= 1000
                  ? `${(hoveredBin.frequency / 1000).toFixed(2)} kHz`
                  : `${hoveredBin.frequency.toFixed(1)} Hz`}
              </div>
              <div className="text-cyan-300">Magnitude: {hoveredBin.magnitude.toFixed(3)}</div>
              {hoveredBin.phase !== undefined && (
                <div className="text-purple-300">Phase: {hoveredBin.phase.toFixed(3)} rad</div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(zoom !== 1 || pan !== 0) && (
          <m.button
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
          </m.button>
        )}
      </AnimatePresence>

      <m.div
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
        <span className="text-emerald-300 font-semibold">
          Peak:{' '}
          {spectrumStats.dominantFrequency >= 1000
            ? `${(spectrumStats.dominantFrequency / 1000).toFixed(2)} kHz`
            : `${spectrumStats.dominantFrequency.toFixed(1)} Hz`}
        </span>
        <span className="mx-2 text-muted-foreground">•</span>
        <span className="text-cyan-300">Energy: {spectrumStats.totalEnergy.toFixed(1)}</span>
        <span className="mx-2 text-muted-foreground">•</span>
        Scroll to zoom
        <span className="mx-2 text-muted-foreground">•</span>
        Drag to pan
      </m.div>
    </div>
  );
}
