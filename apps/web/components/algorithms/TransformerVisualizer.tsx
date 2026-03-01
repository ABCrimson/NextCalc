'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Download, Info, Pause, Play, RotateCcw, Send } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ANIMATION_DURATIONS,
  type AnimationSpeed,
  type AttentionHead,
  type AttentionScore,
  createAttentionScore,
  type TransformerConfig,
} from './types';

/**
 * Props for TransformerVisualizer component
 */
export interface TransformerVisualizerProps {
  /**
   * Initial configuration for the transformer
   */
  initialConfig?: Partial<TransformerConfig>;

  /**
   * Callback when attention scores are computed
   */
  onAttentionComputed?: (heads: ReadonlyArray<AttentionHead>) => void;

  /**
   * Whether to show educational explanations
   */
  showExplanations?: boolean;

  /**
   * Animation speed preset
   */
  animationSpeed?: AnimationSpeed;

  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Default transformer configuration
 */
const DEFAULT_CONFIG: TransformerConfig = {
  numHeads: 4,
  dModel: 64,
  sequenceLength: 8,
  tokens: ['The', 'cat', 'sat', 'on', 'the', 'mat', '.', '[PAD]'],
} as const;

/**
 * Compute attention scores using scaled dot-product attention
 * @param queries - Query matrix
 * @param keys - Key matrix
 * @param dK - Dimension of key vectors
 * @returns Attention scores matrix
 */
function computeAttentionScores(
  queries: ReadonlyArray<ReadonlyArray<number>>,
  keys: ReadonlyArray<ReadonlyArray<number>>,
  dK: number,
): ReadonlyArray<ReadonlyArray<AttentionScore>> {
  const seqLen = queries.length;
  const scores: number[][] = Array.from({ length: seqLen }, () => Array(seqLen).fill(0));

  // Compute Q * K^T / sqrt(d_k)
  for (let i = 0; i < seqLen; i++) {
    for (let j = 0; j < seqLen; j++) {
      let dotProduct = 0;
      for (let k = 0; k < dK; k++) {
        dotProduct += (queries[i]?.[k] ?? 0) * (keys[j]?.[k] ?? 0);
      }
      scores[i]![j] = dotProduct / Math.sqrt(dK);
    }
  }

  // Apply softmax row-wise
  const attentionScores: AttentionScore[][] = scores.map((row) => {
    const maxScore = Math.max(...row);
    const expScores = row.map((s) => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    return expScores.map((s) => createAttentionScore(s / sumExp));
  });

  return attentionScores;
}

/**
 * Seeded pseudorandom number generator (PRNG)
 * Uses a simple Linear Congruential Generator (LCG) algorithm
 * This ensures deterministic output for the same seed across server and client
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    // LCG parameters from Numerical Recipes
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Generate deterministic weight matrix using seeded random number generator
 * This prevents hydration mismatches between server and client
 */
function generateRandomWeights(
  rows: number,
  cols: number,
  seed: number,
): ReadonlyArray<ReadonlyArray<number>> {
  const random = seededRandom(seed);
  // Xavier-like initialization: scale by sqrt(2 / (rows + cols))
  // Larger weights produce meaningful dot-product variance so softmax
  // outputs show clear attention patterns instead of a uniform 1/N.
  const scale = Math.sqrt(2.0 / (rows + cols));
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (random() - 0.5) * 2 * scale),
  );
}

/**
 * Initialize attention heads with deterministic random weights
 * Uses a fixed seed to ensure consistent results across server and client (prevents hydration errors)
 */
function initializeAttentionHeads(config: TransformerConfig): ReadonlyArray<AttentionHead> {
  const dK = Math.floor(config.dModel / config.numHeads);

  // Fixed seed ensures deterministic results - critical for SSR hydration
  const SEED_BASE = 42;

  return Array.from({ length: config.numHeads }, (_, headId) => {
    // Use different seeds for each head and weight type to ensure variety
    const queryWeights = generateRandomWeights(config.sequenceLength, dK, SEED_BASE + headId * 3);
    const keyWeights = generateRandomWeights(config.sequenceLength, dK, SEED_BASE + headId * 3 + 1);
    const valueWeights = generateRandomWeights(
      config.sequenceLength,
      dK,
      SEED_BASE + headId * 3 + 2,
    );

    const scores = computeAttentionScores(queryWeights, keyWeights, dK);

    return {
      headId,
      scores,
      queryWeights,
      keyWeights,
      valueWeights,
    };
  });
}

/**
 * Map an attention intensity (0..1) to an OKLCH color string.
 * Low intensity  → dim slate-blue  (hue ~250, low chroma)
 * High intensity → vivid violet-rose (hue ~310, high chroma)
 */
function intensityToOklch(intensity: number): {
  bg: string;
  bgGrad: string;
  border: string;
  glow: string;
} {
  // Wide sweep from cool indigo (low attention) to hot amber (high attention)
  // Uses cubic easing to stretch the mid-range where most values cluster
  const t = intensity * intensity; // emphasise differences in high-attention range
  const hue = 270 - t * 200; // 270 (violet) → 70 (amber)
  const chroma = 0.04 + t * 0.28; // 0.04 → 0.32
  const lightness = 0.92 - t * 0.5; // 0.92 → 0.42

  const lInner = Math.max(lightness - 0.1, 0.1);
  const cInner = Math.min(chroma * 1.3, 0.36);

  return {
    bg: `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`,
    bgGrad: `linear-gradient(135deg, oklch(${lInner.toFixed(3)} ${cInner.toFixed(3)} ${hue.toFixed(1)}) 0%, oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)}) 100%)`,
    border: `oklch(${Math.min(lightness + 0.14, 0.95).toFixed(3)} ${Math.min(chroma * 1.1, 0.32).toFixed(3)} ${hue.toFixed(1)} / ${(0.3 + intensity * 0.7).toFixed(2)})`,
    glow: `oklch(0.55 ${Math.min(chroma * 1.2, 0.3).toFixed(3)} ${hue.toFixed(1)} / ${(intensity * 0.65).toFixed(2)})`,
  };
}

/**
 * Parse a plain-text sentence into a token array (whitespace splitting + punctuation separation).
 * Returns at most `maxTokens` entries, padding with [PAD] if shorter.
 */
function parseSentenceIntoTokens(sentence: string, maxTokens: number): string[] {
  // Split on whitespace, also split off leading/trailing punctuation
  const raw = sentence
    .trim()
    .split(/\s+/)
    .flatMap((word) => {
      const m = word.match(/^([^\w]*)(\w+(?:'\w+)*)([^\w]*)$/);
      if (!m) return [word];
      const parts: string[] = [];
      if (m[1]) parts.push(m[1]);
      if (m[2]) parts.push(m[2]);
      if (m[3]) parts.push(m[3]);
      return parts;
    })
    .filter((t) => t.length > 0);

  const trimmed = raw.slice(0, maxTokens);
  while (trimmed.length < maxTokens) trimmed.push('[PAD]');
  return trimmed;
}

/**
 * Interactive Transformer Attention Visualizer Component
 *
 * Provides real-time visualization of multi-head self-attention mechanism
 * with educational explanations and exportable attention patterns.
 *
 * @example
 * ```tsx
 * <TransformerVisualizer
 *   initialConfig={{ numHeads: 8, dModel: 512 }}
 *   showExplanations={true}
 *   animationSpeed="normal"
 * />
 * ```
 */
export function TransformerVisualizer({
  initialConfig,
  onAttentionComputed,
  showExplanations = true,
  animationSpeed = 'normal',
  className,
}: TransformerVisualizerProps) {
  // State management
  const [config, setConfig] = useState<TransformerConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  const [attentionHeads, setAttentionHeads] = useState<ReadonlyArray<AttentionHead>>(() =>
    initializeAttentionHeads(config),
  );

  const [selectedHead, setSelectedHead] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [tokens, setTokens] = useState<string[]>([...config.tokens]);

  // Custom sentence input state
  const [sentenceInput, setSentenceInput] = useState<string>('The cat sat on the mat . [PAD]');
  const [sentenceError, setSentenceError] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flowCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const flowAnimationTimeRef = useRef<number>(0);

  // Recompute attention when config changes
  useEffect(() => {
    const newHeads = initializeAttentionHeads(config);
    setAttentionHeads(newHeads);
    onAttentionComputed?.(newHeads);
  }, [config, onAttentionComputed]);

  // Get current attention head
  const currentHead = useMemo(
    () => attentionHeads[selectedHead] ?? attentionHeads[0],
    [attentionHeads, selectedHead],
  );

  // Handle configuration updates
  const updateConfig = useCallback((updates: Partial<TransformerConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...updates,
      tokens: updates.tokens ?? prev.tokens,
    }));
  }, []);

  // Handle token updates (individual token editor)
  const updateToken = useCallback((index: number, value: string) => {
    setTokens((prev) => {
      const newTokens = [...prev];
      newTokens[index] = value;
      return newTokens;
    });
  }, []);

  const applyTokens = useCallback(() => {
    updateConfig({ tokens });
  }, [tokens, updateConfig]);

  // Handle sentence input → tokenize → update
  const applySentence = useCallback(() => {
    const trimmed = sentenceInput.trim();
    if (!trimmed) {
      setSentenceError('Please enter a sentence.');
      return;
    }
    setSentenceError('');
    const parsed = parseSentenceIntoTokens(trimmed, config.sequenceLength);
    setTokens(parsed);
    updateConfig({ tokens: parsed });
  }, [sentenceInput, config.sequenceLength, updateConfig]);

  // Render animated attention flow lines (bipartite layout: left=query, right=key)
  const renderAttentionFlows = useCallback(() => {
    const canvas = flowCanvasRef.current;
    if (!canvas || !currentHead) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const displayW = canvas.clientWidth || 600;
    const displayH = canvas.clientHeight || 320;

    if (
      canvas.width !== Math.round(displayW * dpr) ||
      canvas.height !== Math.round(displayH * dpr)
    ) {
      canvas.width = Math.round(displayW * dpr);
      canvas.height = Math.round(displayH * dpr);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Animate flow lines with time-based offset
    flowAnimationTimeRef.current += 0.018;
    const time = flowAnimationTimeRef.current;

    const seqLen = config.sequenceLength;
    const paddingV = 28;
    const rowH = (displayH - paddingV * 2) / seqLen;

    // Bipartite layout: query tokens on left (x=leftX), key tokens on right (x=rightX)
    const leftX = displayW * 0.2;
    const rightX = displayW * 0.8;

    // Draw node labels on both sides
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < seqLen; i++) {
      const y = paddingV + i * rowH + rowH / 2;
      const tok = tokens[i] ?? '';
      const truncated = tok.length > 7 ? tok.slice(0, 6) + '…' : tok;

      // Query side (left)
      ctx.fillStyle = 'rgba(160,140,255,0.85)';
      ctx.textAlign = 'right';
      ctx.fillText(truncated, leftX - 10, y);

      // Query node dot
      ctx.beginPath();
      ctx.arc(leftX, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'oklch(0.65 0.22 264)';
      ctx.fill();

      // Key side (right)
      ctx.fillStyle = 'rgba(255,160,200,0.85)';
      ctx.textAlign = 'left';
      ctx.fillText(truncated, rightX + 10, y);

      // Key node dot
      ctx.beginPath();
      ctx.arc(rightX, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'oklch(0.65 0.22 320)';
      ctx.fill();
    }

    // Draw attention arcs from each query (left) to each key (right)
    // Only for selectedHead row (focused on query token = hoveredCell.row, else show all)
    const focusRow = hoveredCell?.row ?? null;

    for (let i = 0; i < seqLen; i++) {
      // If a cell is hovered, only show that query row's flows
      if (focusRow !== null && i !== focusRow) continue;

      const y1 = paddingV + i * rowH + rowH / 2;

      for (let j = 0; j < seqLen; j++) {
        const intensity = (currentHead.scores[i]?.[j] as number) ?? 0;
        if (intensity < 0.08) continue;

        const y2 = paddingV + j * rowH + rowH / 2;

        // Animated phase along the arc
        const phase = (((time * 0.6 + i * 0.4 + j * 0.25) % 1) + 1) % 1;

        // OKLCH hue sweep: indigo (264) → violet (290) → rose (330)
        const hue = 264 + intensity * 66;
        const chromaVal = (0.1 + intensity * 0.2).toFixed(3);

        const grad = ctx.createLinearGradient(leftX, y1, rightX, y2);
        grad.addColorStop(0, `oklch(0.60 ${chromaVal} 264 / ${(intensity * 0.25).toFixed(2)})`);
        grad.addColorStop(
          Math.max(0, phase - 0.15),
          `oklch(0.60 ${chromaVal} ${hue.toFixed(1)} / ${(intensity * 0.18).toFixed(2)})`,
        );
        grad.addColorStop(
          phase,
          `oklch(0.80 ${chromaVal} ${hue.toFixed(1)} / ${Math.min(intensity * 1.1, 1.0).toFixed(2)})`,
        );
        grad.addColorStop(
          Math.min(1, phase + 0.15),
          `oklch(0.60 ${chromaVal} ${hue.toFixed(1)} / ${(intensity * 0.18).toFixed(2)})`,
        );
        grad.addColorStop(1, `oklch(0.60 ${chromaVal} 330 / ${(intensity * 0.2).toFixed(2)})`);

        const lineW = Math.max(0.8, intensity * 3.5);

        // Cubic bezier arc: control points fan out vertically
        const dx = rightX - leftX;
        const cp1x = leftX + dx * 0.35;
        const cp1y = y1 + (y2 - y1) * 0.1;
        const cp2x = leftX + dx * 0.65;
        const cp2y = y1 + (y2 - y1) * 0.9;

        ctx.save();
        if (intensity > 0.45) {
          ctx.shadowBlur = 10 * intensity;
          ctx.shadowColor = `oklch(0.70 0.22 ${hue.toFixed(1)} / 0.70)`;
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = lineW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(leftX, y1);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, rightX, y2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(renderAttentionFlows);
  }, [currentHead, config.sequenceLength, tokens, hoveredCell]);

  // Start/stop attention flow animation
  useEffect(() => {
    renderAttentionFlows();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderAttentionFlows]);

  // Export attention pattern as image
  const exportAttentionPattern = useCallback(
    (format: 'png' | 'svg' = 'png') => {
      if (!canvasRef.current || !currentHead) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const cellSize = 44;
      const padding = 64;
      const width = config.sequenceLength * cellSize + padding * 2;
      const height = config.sequenceLength * cellSize + padding * 2;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);

      // Draw background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#0a0c1e');
      bgGradient.addColorStop(1, '#12102e');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw labels
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';

      tokens.forEach((token, i) => {
        const display = token.length > 7 ? token.slice(0, 6) + '…' : token;
        ctx.fillStyle = 'rgba(190,180,255,0.90)';
        ctx.fillText(display, padding + i * cellSize + cellSize / 2, padding - 12);
        ctx.save();
        ctx.translate(padding - 12, padding + i * cellSize + cellSize / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(display, 0, 0);
        ctx.restore();
      });

      // Draw attention heatmap cells
      currentHead.scores.forEach((row, i) => {
        row.forEach((score, j) => {
          const x = padding + j * cellSize;
          const y = padding + i * cellSize;
          const intensity = score as number;
          const colors = intensityToOklch(intensity);

          // Cell background (gradient approximated with two stops in Canvas 2d using HSL)
          const hue = 250 + intensity * 80;
          const sat = Math.round(40 + intensity * 55);
          const lgt = Math.round(88 - intensity * 48);
          const lgtInner = Math.max(lgt - 12, 20);

          const cellGrad = ctx.createRadialGradient(
            x + cellSize / 2,
            y + cellSize / 2,
            0,
            x + cellSize / 2,
            y + cellSize / 2,
            cellSize * 0.7,
          );
          cellGrad.addColorStop(0, `hsl(${hue}, ${sat}%, ${lgtInner}%)`);
          cellGrad.addColorStop(1, `hsl(${hue}, ${sat}%, ${lgt}%)`);

          ctx.fillStyle = cellGrad;
          ctx.beginPath();
          ctx.roundRect(x + 1, y + 1, cellSize - 3, cellSize - 3, 5);
          ctx.fill();

          if (intensity > 0.45) {
            ctx.strokeStyle = `hsla(${hue}, ${sat + 20}%, ${lgt + 15}%, ${intensity * 0.85})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Score text
          ctx.fillStyle = intensity > 0.52 ? '#ffffff' : `hsl(${hue}, 30%, 72%)`;
          ctx.font = `bold ${intensity > 0.5 ? 10 : 9}px system-ui`;
          ctx.textAlign = 'center';
          ctx.shadowBlur = intensity > 0.5 ? 4 : 0;
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.fillText(intensity.toFixed(2), x + cellSize / 2, y + cellSize / 2 + 4);
          ctx.shadowBlur = 0;

          // Suppress unused variable warning
          void colors;
        });
      });

      // Export
      if (format === 'png') {
        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `attention-head-${selectedHead}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
          },
          'image/png',
          1.0,
        );
      }
    },
    [currentHead, config.sequenceLength, selectedHead, tokens],
  );

  // Animate through all heads
  const animateThroughHeads = useCallback(() => {
    if (isAnimating) {
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % config.numHeads;
      setSelectedHead(currentIndex);

      if (currentIndex === 0) {
        setIsAnimating(false);
        clearInterval(interval);
      }
    }, ANIMATION_DURATIONS[animationSpeed]);
  }, [isAnimating, config.numHeads, animationSpeed]);

  // Reset to default configuration
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setTokens([...DEFAULT_CONFIG.tokens]);
    setSentenceInput('The cat sat on the mat . [PAD]');
    setSentenceError('');
    setSelectedHead(0);
  }, []);

  return (
    <div className={cn('w-full mx-auto space-y-4 sm:space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-2xl sm:text-3xl font-bold break-words">
                Transformer Attention Visualizer
              </CardTitle>
              <CardDescription className="text-sm sm:text-base break-words">
                Explore multi-head self-attention mechanism with interactive visualization
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm shrink-0 whitespace-nowrap">
              Head {selectedHead + 1}/{config.numHeads}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Custom Sentence Input */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Send className="h-4 w-4 shrink-0" />
            Custom Sentence Input
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Type a sentence to tokenize it and update the attention visualization. The first{' '}
            {config.sequenceLength} tokens will be used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0 space-y-1">
              <Input
                id="sentence-input"
                value={sentenceInput}
                onChange={(e) => {
                  setSentenceInput(e.target.value);
                  setSentenceError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySentence();
                }}
                placeholder="e.g. The quick brown fox jumps over the lazy dog"
                aria-label="Input sentence for tokenization"
                aria-describedby={sentenceError ? 'sentence-error' : undefined}
                className="w-full"
                maxLength={200}
              />
              {sentenceError && (
                <p id="sentence-error" className="text-xs text-destructive" role="alert">
                  {sentenceError}
                </p>
              )}
            </div>
            <Button
              onClick={applySentence}
              disabled={isAnimating}
              aria-label="Apply sentence as tokens"
              className="shrink-0"
            >
              <Send className="h-4 w-4 mr-2" />
              Tokenize
            </Button>
          </div>
          {/* Token preview chips */}
          <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Current tokens" role="list">
            {tokens.map((token, i) => (
              <span
                key={i}
                role="listitem"
                className="px-2 py-0.5 text-xs font-mono rounded-full border border-border/50 bg-muted/40 text-muted-foreground max-w-[6rem] truncate"
                title={token}
              >
                {token}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Visualization Panel */}
        <div className="xl:col-span-2 order-2 xl:order-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg sm:text-xl">Attention Matrix</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={animateThroughHeads}
                    aria-label={isAnimating ? 'Pause animation' : 'Play animation'}
                  >
                    {isAnimating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAttentionPattern('png')}
                    aria-label="Export attention pattern as PNG"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

              <div className="space-y-4">
                {/* Head Selector */}
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: config.numHeads }, (_, i) => (
                    <Button
                      key={i}
                      variant={selectedHead === i ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedHead(i)}
                      disabled={isAnimating}
                      aria-pressed={selectedHead === i}
                      aria-label={`Select attention head ${i + 1}`}
                    >
                      Head {i + 1}
                    </Button>
                  ))}
                </div>

                {/* Attention Flow Canvas — bipartite arc diagram */}
                <div
                  className="relative rounded-xl overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(10,10,28,0.72) 0%, rgba(18,14,42,0.72) 100%)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(100,80,200,0.20)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.38)',
                  }}
                >
                  <canvas
                    ref={flowCanvasRef}
                    className="w-full h-56 sm:h-72 lg:h-80 block"
                    aria-hidden="true"
                  />
                  <div
                    className="absolute top-2.5 right-2.5 px-2.5 py-1 text-[0.68rem] font-semibold rounded-full"
                    style={{
                      background: 'rgba(20,14,50,0.65)',
                      backdropFilter: 'blur(6px)',
                      border: '1px solid rgba(120,90,220,0.30)',
                      color: 'oklch(0.78 0.12 270)',
                    }}
                  >
                    Attention Flow — Head {selectedHead + 1}
                  </div>
                  {hoveredCell !== null && (
                    <div
                      className="absolute bottom-2.5 left-2.5 px-2.5 py-1 text-[0.68rem] rounded-full"
                      style={{
                        background: 'rgba(20,14,50,0.65)',
                        backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(120,90,220,0.30)',
                        color: 'oklch(0.82 0.08 300)',
                      }}
                    >
                      Showing flows from "{tokens[hoveredCell.row]}"
                    </div>
                  )}
                </div>

                {/* Heatmap Display */}
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <div
                    className="inline-grid gap-0.5 sm:gap-1 p-3 sm:p-4 rounded-xl relative"
                    style={{
                      gridTemplateColumns: `6rem repeat(${config.sequenceLength}, minmax(3.5rem, 4.5rem))`,
                      background:
                        'linear-gradient(135deg, rgba(10,8,28,0.60) 0%, rgba(18,14,42,0.60) 100%)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(90,70,180,0.18)',
                      boxShadow:
                        '0 8px 32px rgba(0,0,0,0.32), inset 0 1px 1px rgba(255,255,255,0.06)',
                    }}
                    role="table"
                    aria-label="Attention scores heatmap"
                  >
                    {/* Column headers */}
                    <div className="shrink-0" style={{ minWidth: '6rem' }} />
                    {tokens.map((token, i) => (
                      <motion.div
                        key={`col-${i}`}
                        className="text-[0.65rem] sm:text-xs font-bold text-center px-1 py-2"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(99,80,230,0.18) 0%, transparent 100%)',
                          borderRadius: '0.375rem 0.375rem 0 0',
                          minWidth: '3.5rem',
                        }}
                        role="columnheader"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <span
                          className="block text-center leading-tight"
                          style={{
                            color: 'oklch(0.72 0.14 270)',
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                          }}
                          title={token}
                        >
                          {token}
                        </span>
                      </motion.div>
                    ))}

                    {/* Attention scores */}
                    {currentHead?.scores.map((row, i) => (
                      <Fragment key={`row-${i}`}>
                        {/* Row header */}
                        <motion.div
                          className="text-[0.65rem] sm:text-xs font-bold flex items-center justify-end pr-2"
                          style={{
                            background:
                              'linear-gradient(90deg, rgba(99,80,230,0.18) 0%, transparent 100%)',
                            borderRadius: '0.375rem 0 0 0.375rem',
                            minHeight: '3rem',
                            minWidth: '6rem',
                            maxWidth: '6rem',
                          }}
                          role="rowheader"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <span
                            className="text-right leading-tight"
                            style={{
                              color: 'oklch(0.72 0.14 270)',
                              wordBreak: 'break-all',
                              overflowWrap: 'anywhere',
                              display: 'block',
                              maxWidth: '5.5rem',
                            }}
                            title={tokens[i]}
                          >
                            {tokens[i] ?? ''}
                          </span>
                        </motion.div>

                        {/* Score cells */}
                        {row.map((score, j) => {
                          const intensity = score as number;
                          const isHovered = hoveredCell?.row === i && hoveredCell?.col === j;
                          const colors = intensityToOklch(intensity);

                          return (
                            <motion.div
                              key={`cell-${i}-${j}`}
                              className={cn(
                                'relative flex items-center justify-center',
                                'text-[0.62rem] sm:text-[0.68rem] font-bold',
                                'rounded-md cursor-pointer select-none overflow-hidden',
                                'transition-[box-shadow,border-color] duration-200 ease-out',
                                isHovered && 'z-10',
                              )}
                              style={{
                                minWidth: '3.5rem',
                                minHeight: '3rem',
                                aspectRatio: 'auto',
                                background: showHeatmap
                                  ? colors.bgGrad
                                  : 'oklch(0.20 0.02 260 / 0.30)',
                                color: intensity > 0.52 ? '#ffffff' : 'oklch(0.72 0.06 260)',
                                boxShadow: isHovered
                                  ? `0 8px 24px ${colors.glow}, 0 0 0 2px ${colors.border}`
                                  : intensity > 0.58
                                    ? `0 3px 10px ${colors.glow}`
                                    : 'none',
                                border: `1px solid ${colors.border}`,
                                textShadow: intensity > 0.52 ? '0 1px 6px rgba(0,0,0,0.9)' : 'none',
                                willChange: 'transform',
                              }}
                              onMouseEnter={() => setHoveredCell({ row: i, col: j })}
                              onMouseLeave={() => setHoveredCell(null)}
                              initial={{ opacity: 0, scale: 0.75 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.12 }}
                              transition={{
                                type: 'spring',
                                stiffness: 240,
                                damping: 22,
                                delay: (i * config.sequenceLength + j) * 0.008,
                              }}
                              role="cell"
                              aria-label={`Attention from "${tokens[i]}" to "${tokens[j]}": ${intensity.toFixed(3)}`}
                            >
                              {/* Pulsing glow overlay for high attention */}
                              {intensity > 0.68 && (
                                <motion.div
                                  className="absolute inset-0 rounded-md pointer-events-none"
                                  style={{
                                    background: `radial-gradient(circle at 50% 40%, ${colors.border} 0%, transparent 68%)`,
                                  }}
                                  animate={{
                                    opacity: [0.35, 0.72, 0.35],
                                  }}
                                  transition={{
                                    duration: 2.2,
                                    repeat: Number.POSITIVE_INFINITY,
                                    ease: 'easeInOut',
                                    delay: (i + j) * 0.15,
                                  }}
                                />
                              )}
                              <span className="relative z-10 tabular-nums">
                                {intensity.toFixed(2)}
                              </span>
                            </motion.div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>

                {/* Color scale legend */}
                <div className="flex items-center gap-3 px-1">
                  <span className="text-[0.65rem] text-muted-foreground shrink-0">Low</span>
                  <div
                    className="flex-1 h-2.5 rounded-full"
                    style={{
                      background:
                        'linear-gradient(to right, oklch(0.88 0.04 250), oklch(0.65 0.18 280), oklch(0.45 0.28 320))',
                    }}
                    aria-label="Attention intensity color scale from low to high"
                    role="img"
                  />
                  <span className="text-[0.65rem] text-muted-foreground shrink-0">High</span>
                </div>

                {/* Hovered cell info */}
                <AnimatePresence>
                  {hoveredCell && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <Alert>
                        <Info className="h-4 w-4 shrink-0" />
                        <div className="ml-2 min-w-0 overflow-hidden">
                          <strong>Attention Flow:</strong>{' '}
                          <span className="font-mono text-xs break-all">
                            &ldquo;{tokens[hoveredCell.row]}&rdquo; &rarr; &ldquo;
                            {tokens[hoveredCell.col]}&rdquo;
                          </span>{' '}
                          with score{' '}
                          <code className="font-mono text-xs">
                            {currentHead &&
                              (
                                currentHead.scores[hoveredCell.row]?.[hoveredCell.col] as number
                              )?.toFixed(4)}
                          </code>
                        </div>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls Panel */}
        <div className="space-y-4 sm:space-y-6 order-1 xl:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* Number of Heads */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="num-heads" className="text-sm">
                    Number of Heads
                  </Label>
                  <span className="text-sm font-mono text-muted-foreground shrink-0">
                    {config.numHeads}
                  </span>
                </div>
                <Slider
                  id="num-heads"
                  min={1}
                  max={16}
                  step={1}
                  value={[config.numHeads]}
                  onValueChange={([value]) =>
                    updateConfig({ numHeads: value ?? DEFAULT_CONFIG.numHeads })
                  }
                  disabled={isAnimating}
                  aria-label="Number of attention heads"
                />
              </div>

              {/* Model Dimension */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="d-model" className="text-sm">
                    Model Dimension (d_model)
                  </Label>
                  <span className="text-sm font-mono text-muted-foreground shrink-0">
                    {config.dModel}
                  </span>
                </div>
                <Slider
                  id="d-model"
                  min={32}
                  max={512}
                  step={32}
                  value={[config.dModel]}
                  onValueChange={([value]) =>
                    updateConfig({ dModel: value ?? DEFAULT_CONFIG.dModel })
                  }
                  disabled={isAnimating}
                  aria-label="Model dimension"
                />
              </div>

              {/* Sequence Length */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="seq-length" className="text-sm">
                    Sequence Length
                  </Label>
                  <span className="text-sm font-mono text-muted-foreground shrink-0">
                    {config.sequenceLength}
                  </span>
                </div>
                <Slider
                  id="seq-length"
                  min={4}
                  max={16}
                  step={1}
                  value={[config.sequenceLength]}
                  onValueChange={([value]) => {
                    const newLength = value ?? DEFAULT_CONFIG.sequenceLength;
                    const newTokens = [...tokens];
                    if (newLength > tokens.length) {
                      newTokens.push(
                        ...Array.from({ length: newLength - tokens.length }, () => '[PAD]'),
                      );
                    } else {
                      newTokens.splice(newLength);
                    }
                    setTokens(newTokens);
                    updateConfig({ sequenceLength: newLength });
                  }}
                  disabled={isAnimating}
                  aria-label="Sequence length"
                />
              </div>

              <Separator />

              {/* Visualization Options */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="show-heatmap" className="text-sm">
                    Show Heatmap Colors
                  </Label>
                  <Switch
                    id="show-heatmap"
                    checked={showHeatmap}
                    onCheckedChange={setShowHeatmap}
                    aria-label="Toggle heatmap visualization"
                  />
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={resetConfig}
                  disabled={isAnimating}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Token Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Edit Tokens</CardTitle>
              <CardDescription className="text-xs break-words">
                Edit individual tokens or use the sentence input above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 sm:h-64">
                <div className="space-y-2 pr-2">
                  {tokens.map((token, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Label
                        htmlFor={`token-${i}`}
                        className="w-8 text-xs text-muted-foreground shrink-0"
                      >
                        {i + 1}.
                      </Label>
                      <Input
                        id={`token-${i}`}
                        value={token}
                        onChange={(e) => updateToken(i, e.target.value)}
                        className="flex-1 min-w-0 font-mono text-sm"
                        maxLength={20}
                        aria-label={`Token ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Button className="w-full mt-4" onClick={applyTokens} disabled={isAnimating}>
                Apply Token Edits
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Educational Explanation */}
      {showExplanations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Info className="h-5 w-5 shrink-0" />
              <span>How Self-Attention Works</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList
                className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 rounded-xl"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(10,8,28,0.55) 0%, rgba(18,14,42,0.55) 100%)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(90,70,180,0.25)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.06)',
                }}
              >
                <TabsTrigger
                  value="overview"
                  className="text-xs sm:text-sm py-2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="math"
                  className="text-xs sm:text-sm py-2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Mathematics
                </TabsTrigger>
                <TabsTrigger
                  value="multihead"
                  className="text-xs sm:text-sm py-2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Multi-Head
                </TabsTrigger>
                <TabsTrigger
                  value="tips"
                  className="text-xs sm:text-sm py-2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Tips
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3 text-sm mt-4">
                <p>
                  <strong>Self-attention</strong> allows each token in a sequence to attend to all
                  other tokens, learning contextual relationships.
                </p>
                <p>
                  Each cell in the matrix shows how much attention token (row) pays to token
                  (column). Higher values (vivid violet/rose) indicate stronger attention.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Diagonal cells show self-attention (token attending to itself)</li>
                  <li>Off-diagonal cells show cross-attention between different tokens</li>
                  <li>Each row sums to 1.0 (softmax normalization)</li>
                </ul>
              </TabsContent>

              <TabsContent value="math" className="space-y-3 text-sm mt-4">
                <p>
                  <strong>Scaled Dot-Product Attention:</strong>
                </p>
                <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                  <code className="text-xs sm:text-sm whitespace-nowrap font-mono">
                    Attention(Q, K, V) = softmax(Q·K^T / √d_k)·V
                  </code>
                </div>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Q = Queries (what we&apos;re looking for)</li>
                  <li>K = Keys (what we&apos;re looking at)</li>
                  <li>V = Values (what we retrieve)</li>
                  <li>d_k = dimension of key vectors (prevents gradient saturation)</li>
                </ul>
              </TabsContent>

              <TabsContent value="multihead" className="space-y-3 text-sm mt-4">
                <p>
                  <strong>Multi-head attention</strong> runs multiple attention mechanisms in
                  parallel, allowing the model to attend to different aspects simultaneously.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Each head learns different attention patterns</li>
                  <li>
                    Head dimension: d_k = d_model / num_heads (currently{' '}
                    {Math.floor(config.dModel / config.numHeads)})
                  </li>
                  <li>Outputs are concatenated and linearly transformed</li>
                  <li>More heads = more diverse attention patterns</li>
                </ul>
              </TabsContent>

              <TabsContent value="tips" className="space-y-3 text-sm mt-4">
                <p>
                  <strong>Try these experiments:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    Type a sentence above and click &ldquo;Tokenize&rdquo; to use your own words
                  </li>
                  <li>Increase heads to see how attention patterns diversify</li>
                  <li>Hover over cells to see exact attention scores and flow arcs</li>
                  <li>Use animation to compare all heads quickly</li>
                  <li>Export the pattern to PNG for offline analysis</li>
                </ul>
                <Alert className="mt-4">
                  <Info className="h-4 w-4 shrink-0" />
                  <p className="ml-2 text-xs break-words min-w-0">
                    <strong>Keyboard shortcut:</strong> Press Enter in the sentence field to
                    tokenize. Hover any heatmap cell to highlight that query&apos;s attention arcs
                    in the flow diagram.
                  </p>
                </Alert>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
