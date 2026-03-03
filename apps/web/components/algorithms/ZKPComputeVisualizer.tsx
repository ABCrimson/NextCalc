'use client';

/**
 * ZKPComputeVisualizer
 *
 * GPU-accelerated Zero-Knowledge Proof batch verifier visualiser.
 *
 * What it does:
 * 1. Generates N Schnorr protocol rounds (commitment → challenge → response).
 * 2. Runs EITHER the WebGPU batch_verify compute kernel OR the CPU fallback.
 * 3. Renders a live animated grid of "commitment cells" — each cell shows its
 *    state (pending → verifying → verified / failed) with OKLCH colour tokens.
 * 4. Displays a side-by-side CPU vs GPU timing comparison.
 *
 * Follows project conventions:
 * - React 19.3: no forwardRef, ref as prop, named imports only.
 * - TypeScript 6.0 strict / exactOptionalPropertyTypes.
 * - Zero `any` / `as any`.
 * - Glass-morphism card style.
 * - OKLCH colour tokens via Tailwind semantic classes.
 * - Framer Motion for all animations.
 * - ARIA labels, live regions, keyboard navigation.
 */

import { AnimatePresence, m } from 'framer-motion';
import { BarChart2, Cpu, Info, Lock, Play, RotateCcw, ShieldCheck, X, Zap } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type BatchVerifyResult,
  cpuBatchVerify,
  gpuBatchVerify,
  type SchnorrRound,
} from './webgpu-zkp';

// ─── Types ────────────────────────────────────────────────────────────────────

type CellState = 'idle' | 'verifying' | 'verified' | 'failed';

interface CommitmentCell {
  index: number;
  t: number; // commitment
  c: number; // challenge
  s: number; // response
  y: number; // public key
  state: CellState;
  isValid: boolean;
}

export interface ZKPComputeVisualizerProps {
  /** Number of Schnorr rounds to demonstrate. Default: 64. */
  roundCount?: number;
  /** Whether to inject some failing rounds. Default: true. */
  injectFailures?: boolean;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Small demo prime for visual purposes (not cryptographically secure)
const DEMO_P = 32452843;
const DEMO_G = 5;

const GLASS_CARD =
  'bg-gradient-to-br from-background/60 via-card/50 to-background/60 ' +
  'backdrop-blur-md border border-border ' +
  'shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e % 2n === 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
}

function cryptoRandomBigInt(max: number): bigint {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return BigInt(arr[0]! % max) + 1n;
}

function cryptoRandomInt(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0]! % max) + 1;
}

function safeNumber(n: bigint): number {
  // Clamp to safe u32 range for the GPU buffer (our prime is < 2^25)
  const MAX = BigInt(DEMO_P);
  return Number(n % MAX);
}

function generateRound(injectFailure: boolean): SchnorrRound {
  const p = BigInt(DEMO_P);
  const g = BigInt(DEMO_G);

  // Prover's secret x ∈ [1, p-1)
  const x = cryptoRandomBigInt(1_000_000);
  const y = safeNumber(modPow(g, x, p)); // public key y = g^x mod p

  // Commitment: random r, t = g^r mod p
  const rRand = cryptoRandomBigInt(1_000_000);
  const t = safeNumber(modPow(g, rRand, p));

  // Challenge c
  const c = cryptoRandomInt(1_000_000);
  const cBig = BigInt(c);

  // Response: s = r + c*x mod (p-1)
  const pMinus1 = p - 1n;
  let s = safeNumber((rRand + cBig * x) % pMinus1);

  if (injectFailure) {
    // Corrupt the response slightly so verification fails
    s = (s + 1) % DEMO_P;
  }

  return { t, c, s, y, g: DEMO_G, p: DEMO_P };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ZKPComputeVisualizer({
  roundCount = 64,
  injectFailures = true,
  className,
}: ZKPComputeVisualizerProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [cells, setCells] = useState<CommitmentCell[]>([]);
  const [gpuResult, setGpuResult] = useState<BatchVerifyResult | null>(null);
  const [cpuResult, setCpuResult] = useState<BatchVerifyResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'generating' | 'gpu' | 'cpu' | 'done'>('idle');
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const roundsRef = useRef<SchnorrRound[]>([]);

  // ── WebGPU detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        setWebGPUSupported(false);
        return;
      }
      const nav = navigator as Navigator & {
        gpu: { requestAdapter(): Promise<unknown | null> };
      };
      const adapter = await nav.gpu.requestAdapter();
      setWebGPUSupported(adapter !== null);
    };
    check().catch(() => setWebGPUSupported(false));
  }, []);

  // ── Build rounds + initial cells ───────────────────────────────────────────
  const buildRounds = useCallback(() => {
    const rounds: SchnorrRound[] = [];
    for (let i = 0; i < roundCount; i++) {
      // Inject ~15% failures when enabled
      const fail = injectFailures && Math.random() < 0.15;
      rounds.push(generateRound(fail));
    }
    roundsRef.current = rounds;

    const initial: CommitmentCell[] = rounds.map((r, i) => ({
      index: i,
      t: r.t,
      c: r.c,
      s: r.s,
      y: r.y,
      state: 'idle',
      isValid: false,
    }));
    setCells(initial);
    setGpuResult(null);
    setCpuResult(null);
    setSelectedCell(null);
    setPhase('generating');

    // Briefly show "generating" then transition to next phase
    setTimeout(() => setPhase('idle'), 300);
  }, [roundCount, injectFailures]);

  // Auto-build on mount
  useEffect(() => {
    buildRounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Run verification ───────────────────────────────────────────────────────
  const runVerification = useCallback(async () => {
    const rounds = roundsRef.current;
    if (rounds.length === 0 || phase === 'gpu' || phase === 'cpu') return;

    // Reset cell states to "verifying"
    setCells((prev) => prev.map((c) => ({ ...c, state: 'verifying', isValid: false })));

    // ── GPU pass ────────────────────────────────────────────────────────────
    setPhase('gpu');
    let gpuRes: BatchVerifyResult | null = null;
    try {
      gpuRes = await gpuBatchVerify(rounds);
    } catch (_) {
      gpuRes = null;
    }

    if (gpuRes) {
      setGpuResult(gpuRes);
      // Animate cells in small waves
      let waveIndex = 0;
      const WAVE_SIZE = 8;
      const WAVE_DELAY_MS = 45;

      const animateWave = () => {
        const start = waveIndex * WAVE_SIZE;
        const end = Math.min(start + WAVE_SIZE, rounds.length);
        setCells((prev) =>
          prev.map((cell, i) => {
            if (i < start || i >= end) return cell;
            const ok = gpuRes.verified[i] ?? false;
            return { ...cell, state: ok ? 'verified' : 'failed', isValid: ok };
          }),
        );
        waveIndex++;
        if (start < rounds.length) {
          animFrameRef.current = window.setTimeout(animateWave, WAVE_DELAY_MS);
        }
      };
      animateWave();
    } else {
      // GPU unavailable — mark all cells as pending CPU
      setCells((prev) => prev.map((c) => ({ ...c, state: 'verifying' })));
    }

    // ── CPU pass (for comparison timing) ────────────────────────────────────
    setPhase('cpu');
    // Small delay so the GPU animation has time to start
    await new Promise((resolve) => setTimeout(resolve, 200));
    const cpuRes = cpuBatchVerify(rounds);
    setCpuResult(cpuRes);

    if (!gpuRes) {
      // No GPU — apply CPU results to cells
      setCells((prev) =>
        prev.map((cell, i) => {
          const ok = cpuRes.verified[i] ?? false;
          return { ...cell, state: ok ? 'verified' : 'failed', isValid: ok };
        }),
      );
    }

    setPhase('done');
  }, [phase]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) clearTimeout(animFrameRef.current);
    };
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = cells.length;
    const verified = cells.filter((c) => c.state === 'verified').length;
    const failed = cells.filter((c) => c.state === 'failed').length;
    const pending = total - verified - failed;
    const speedup =
      gpuResult && cpuResult && gpuResult.gpuMs > 0 ? cpuResult.gpuMs / gpuResult.gpuMs : null;
    return { total, verified, failed, pending, speedup };
  }, [cells, gpuResult, cpuResult]);

  const selectedCellData: CommitmentCell | null =
    selectedCell !== null ? (cells[selectedCell] ?? null) : null;
  const selectedRound: SchnorrRound | null =
    selectedCell !== null ? (roundsRef.current[selectedCell] ?? null) : null;

  // ── Cell colour ────────────────────────────────────────────────────────────
  const cellColor = (state: CellState): string => {
    switch (state) {
      case 'verified':
        return 'bg-emerald-500/20 border-emerald-500/60 shadow-[0_0_10px_rgba(52,211,153,0.35)]';
      case 'failed':
        return 'bg-red-500/20 border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.35)]';
      case 'verifying':
        return 'bg-indigo-500/10 border-indigo-400/40';
      default:
        return 'bg-muted/30 border-border';
    }
  };

  const cellTextColor = (state: CellState): string => {
    switch (state) {
      case 'verified':
        return 'text-emerald-300';
      case 'failed':
        return 'text-red-400';
      case 'verifying':
        return 'text-indigo-300';
      default:
        return 'text-muted-foreground';
    }
  };

  // ── Keyboard: arrow navigation over grid ──────────────────────────────────
  const cols = 8;
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (selectedCell === null) return;
      const total = cells.length;
      let next = selectedCell;
      if (e.key === 'ArrowRight') next = Math.min(total - 1, selectedCell + 1);
      if (e.key === 'ArrowLeft') next = Math.max(0, selectedCell - 1);
      if (e.key === 'ArrowDown') next = Math.min(total - 1, selectedCell + cols);
      if (e.key === 'ArrowUp') next = Math.max(0, selectedCell - cols);
      if (e.key === 'Escape') {
        setSelectedCell(null);
        return;
      }
      if (next !== selectedCell) {
        e.preventDefault();
        setSelectedCell(next);
      }
    },
    [selectedCell, cells.length, cols],
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section
      className={`space-y-6 ${className ?? ''}`}
      aria-label="WebGPU-accelerated Zero-Knowledge Proof batch verifier"
    >
      {/* Header card */}
      <div className={`rounded-2xl p-5 ${GLASS_CARD}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25">
              <Zap className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">GPU Batch ZKP Verification</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {roundCount} Schnorr rounds parallelised via WebGPU compute
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* WebGPU support pill */}
            {webGPUSupported !== null && (
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border
                  ${
                    webGPUSupported
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                      : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                  }`}
                role="status"
                aria-label={`WebGPU ${webGPUSupported ? 'available' : 'unavailable — CPU fallback'}`}
              >
                {webGPUSupported ? <Zap className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                {webGPUSupported ? 'WebGPU available' : 'CPU fallback'}
              </span>
            )}

            <button
              type="button"
              onClick={buildRounds}
              disabled={phase === 'gpu' || phase === 'cpu'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                border border-border bg-card/50 text-muted-foreground
                hover:text-foreground hover:bg-accent hover:border-border/80
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                disabled:opacity-40 transition-colors"
              aria-label="Generate new rounds"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              New Rounds
            </button>

            <button
              type="button"
              onClick={runVerification}
              disabled={phase === 'gpu' || phase === 'cpu' || cells.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/40
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                disabled:opacity-40 transition-colors shadow-[0_4px_14px_rgba(99,102,241,0.3)]"
              aria-label="Run batch verification"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              {phase === 'gpu'
                ? 'GPU running...'
                : phase === 'cpu'
                  ? 'CPU running...'
                  : 'Run Verification'}
            </button>
          </div>
        </div>
      </div>

      {/* Main grid + detail pane */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Commitment cell grid */}
        <div
          className={`rounded-2xl p-5 ${GLASS_CARD}`}
          role="grid"
          aria-label={`${roundCount} ZKP commitment cells`}
          aria-rowcount={Math.ceil(roundCount / cols)}
          aria-colcount={cols}
          tabIndex={cells.length > 0 && selectedCell === null ? 0 : -1}
          onFocus={() => {
            if (selectedCell === null && cells.length > 0) setSelectedCell(0);
          }}
          onKeyDown={handleKeyDown}
        >
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            Commitment Cells
            <span className="ml-auto text-xs text-muted-foreground font-normal">
              Click a cell to inspect
            </span>
          </h4>

          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {cells.map((cell) => (
              <m.button
                key={cell.index}
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: cell.state === 'verifying' ? [1, 1.06, 1] : 1,
                }}
                transition={{
                  opacity: { duration: 0.2, delay: cell.index * 0.004 },
                  scale:
                    cell.state === 'verifying'
                      ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.18 },
                }}
                onClick={() => setSelectedCell((prev) => (prev === cell.index ? null : cell.index))}
                className={`relative aspect-square rounded-md border text-[9px] font-mono
                  flex flex-col items-center justify-center gap-0.5 cursor-pointer
                  transition-shadow duration-200 focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-ring
                  ${cellColor(cell.state)}
                  ${selectedCell === cell.index ? 'ring-2 ring-white/30' : ''}
                `}
                aria-label={`Round ${cell.index + 1}: ${cell.state}${cell.state === 'verified' ? ' — proof accepted' : cell.state === 'failed' ? ' — proof rejected' : ''}`}
                aria-selected={selectedCell === cell.index}
                role="gridcell"
              >
                {cell.state === 'verified' && (
                  <ShieldCheck className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                )}
                {cell.state === 'failed' && (
                  <X className="w-3 h-3 text-red-400" aria-hidden="true" />
                )}
                {(cell.state === 'idle' || cell.state === 'verifying') && (
                  <span className={`text-[8px] ${cellTextColor(cell.state)}`}>
                    {String(cell.index + 1).padStart(2, '0')}
                  </span>
                )}
              </m.button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 flex-wrap" aria-label="Cell state legend">
            {(
              [
                { state: 'idle' as CellState, label: 'Idle' },
                { state: 'verifying' as CellState, label: 'Verifying' },
                { state: 'verified' as CellState, label: 'Verified' },
                { state: 'failed' as CellState, label: 'Failed' },
              ] as const
            ).map(({ state, label }) => (
              <div key={state} className="flex items-center gap-1.5">
                <div
                  className={`w-3 h-3 rounded-sm border ${cellColor(state)}`}
                  aria-hidden="true"
                />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: stats + cell detail */}
        <div className="space-y-4">
          {/* Progress stats */}
          <div
            className={`rounded-2xl p-4 ${GLASS_CARD}`}
            aria-live="polite"
            aria-label="Verification progress"
          >
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              Progress
            </h4>
            <dl className="space-y-2">
              {(
                [
                  { label: 'Total', value: stats.total, color: 'text-foreground' },
                  { label: 'Verified', value: stats.verified, color: 'text-emerald-400' },
                  { label: 'Failed', value: stats.failed, color: 'text-red-400' },
                  { label: 'Pending', value: stats.pending, color: 'text-indigo-300' },
                ] as const
              ).map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={`text-sm font-bold font-mono ${color}`}>{value}</dd>
                </div>
              ))}
            </dl>

            {stats.total > 0 && (
              <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
                <m.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                  animate={{ width: `${((stats.verified + stats.failed) / stats.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                  aria-hidden="true"
                />
              </div>
            )}
          </div>

          {/* Timing comparison */}
          <AnimatePresence>
            {(gpuResult !== null || cpuResult !== null) && (
              <m.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-2xl p-4 ${GLASS_CARD}`}
                aria-label="Timing comparison"
              >
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  Timing
                </h4>
                <dl className="space-y-2">
                  {gpuResult && (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                        GPU
                      </dt>
                      <dd className="text-sm font-bold font-mono text-emerald-300">
                        {gpuResult.gpuMs.toFixed(2)}ms
                      </dd>
                    </div>
                  )}
                  {cpuResult && (
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-muted-foreground flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-amber-400" aria-hidden="true" />
                        CPU
                      </dt>
                      <dd className="text-sm font-bold font-mono text-amber-300">
                        {cpuResult.gpuMs.toFixed(2)}ms
                      </dd>
                    </div>
                  )}
                  {stats.speedup !== null && stats.speedup > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <dt className="text-xs text-muted-foreground">Speedup</dt>
                      <dd className="text-sm font-bold font-mono text-cyan-300">
                        {stats.speedup.toFixed(1)}x
                      </dd>
                    </div>
                  )}
                  {gpuResult === null && cpuResult !== null && (
                    <p className="text-[11px] text-amber-400 flex items-start gap-1 mt-1">
                      <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
                      WebGPU unavailable — CPU fallback used
                    </p>
                  )}
                </dl>
              </m.div>
            )}
          </AnimatePresence>

          {/* Cell detail panel */}
          <AnimatePresence mode="wait">
            {(() => {
              // Narrow to non-null inside IIFE so TypeScript is satisfied throughout
              const cell = selectedCellData;
              const round = selectedRound;
              if (cell === null || round === null) return null;
              return (
                <m.div
                  key={cell.index}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.18 }}
                  className={`rounded-2xl p-4 ${GLASS_CARD}`}
                  aria-label={`Round ${cell.index + 1} details`}
                >
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                    Round {cell.index + 1}
                    <span
                      className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full border
                        ${
                          cell.state === 'verified'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : cell.state === 'failed'
                              ? 'bg-red-500/15 border-red-500/40 text-red-300'
                              : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                        }`}
                    >
                      {cell.state}
                    </span>
                  </h4>

                  <dl className="space-y-2 text-xs">
                    {(
                      [
                        { label: 't (commitment)', value: round.t },
                        { label: 'c (challenge)', value: round.c },
                        { label: 's (response)', value: round.s },
                        { label: 'y (public key)', value: round.y },
                      ] as const
                    ).map(({ label, value }) => (
                      <div key={label} className="space-y-0.5">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd>
                          <code className="block font-mono text-[10px] bg-muted/40 px-2 py-1 rounded border border-border/50 text-foreground break-all">
                            {value.toLocaleString()}
                          </code>
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Check: g^s ≡ t·y^c (mod p)
                    </p>
                    {cell.state !== 'idle' && cell.state !== 'verifying' && (
                      <p
                        className={`text-[11px] font-semibold mt-1 ${
                          cell.state === 'verified' ? 'text-emerald-300' : 'text-red-400'
                        }`}
                      >
                        {cell.state === 'verified'
                          ? 'Equation holds — proof accepted'
                          : 'Equation failed — proof rejected'}
                      </p>
                    )}
                  </div>
                </m.div>
              );
            })()}
          </AnimatePresence>
        </div>
      </div>

      {/* Educational note */}
      <div
        className={`rounded-2xl p-4 ${GLASS_CARD} flex items-start gap-3`}
        role="note"
        aria-label="Educational note about this demo"
      >
        <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-foreground font-semibold">How the GPU kernel works: </span>
          Each workgroup invocation computes g^s mod p and t·y^c mod p independently using a
          square-and-multiply algorithm in WGSL, with a 16-bit-split 32-bit mulmod to avoid integer
          overflow. All {roundCount} rounds run simultaneously on the GPU — the CPU must evaluate
          them sequentially. This demo uses a 32-bit prime for visual clarity; production systems
          require 2048+ bit arithmetic (e.g. Barretenberg / Halo2).
        </p>
      </div>
    </section>
  );
}
