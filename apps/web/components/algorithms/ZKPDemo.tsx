'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Progress } from '@/components/ui/progress'; // Unused
import {
  Check,
  X,
  Key,
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  Info,
  Play,
  RotateCcw,
  Users,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronRight,
  Zap,
  FileCheck,
  Binary,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RangeProof,
} from '@nextcalc/math-engine/algorithms';

// ============================================================================
// PROTOCOL SEQUENCE DIAGRAM
// ============================================================================

/**
 * Describes one message arrow in the sequence diagram.
 */
interface SequenceArrow {
  /** Unique key for React/Framer reconciliation */
  key: string;
  /** Arrow direction across the diagram */
  direction: 'right' | 'left';
  /** Short label rendered on the arrow shaft */
  label: string;
  /** Mathematical notation rendered beside the arrow */
  math: string;
  /** Tailwind / inline colour tokens for the arrow and band */
  color: {
    /** SVG stroke colour (oklch string or CSS var) */
    stroke: string;
    /** Background band fill (Tailwind arbitrary value) */
    band: string;
    /** Step badge background */
    badge: string;
    /** Label text colour */
    text: string;
  };
  /** Whether this message is currently visible */
  visible: boolean;
}

interface ProtocolSequenceDiagramProps {
  hasCommitment: boolean;
  hasChallenge: boolean;
  hasResponse: boolean;
  verified: boolean | undefined;
}

/**
 * SVG-based sequence diagram for the Schnorr protocol message flow.
 *
 * Renders vertical lifelines for Prover and Verifier with three animated
 * arrows that draw themselves in sequence using Framer Motion pathLength.
 * Each arrow is accompanied by a step number, math notation, and a
 * colour-coded background band.
 *
 * Respects prefers-reduced-motion: when reduced motion is set the arrows
 * appear instantly without the drawing animation.
 *
 * Keyboard: the diagram is purely informational (role="img") so no
 * interactive focus management is needed.
 */
function ProtocolSequenceDiagram({
  hasCommitment,
  hasChallenge,
  hasResponse,
  verified,
}: ProtocolSequenceDiagramProps) {
  const prefersReduced = useReducedMotion();

  // SVG layout constants
  const SVG_W = 600;
  const SVG_H = 320;
  const PROVER_X = 110;  // Centre of prover lifeline
  const VERIFIER_X = 490; // Centre of verifier lifeline
  const HEADER_Y = 56;   // Bottom of header cards
  const LIFELINE_TOP = HEADER_Y + 8;
  const LIFELINE_BOT = SVG_H - 10;

  // Y positions for each arrow row
  const ROW_Y = [120, 200, 280] as const;
  // Half-height of each colour band
  const BAND_H = 30;

  const arrows: SequenceArrow[] = [
    {
      key: 'commitment',
      direction: 'right',
      label: 't (commitment)',
      math: 't = g\u02B3 mod p',
      color: {
        stroke: 'oklch(0.65 0.22 210)',   // cyan-blue
        band:   'oklch(0.65 0.22 210 / 0.10)',
        badge:  'oklch(0.65 0.22 210)',
        text:   'oklch(0.88 0.08 210)',   // light cyan for dark bg contrast
      },
      visible: hasCommitment,
    },
    {
      key: 'challenge',
      direction: 'left',
      label: 'c (challenge)',
      math: 'c \u2208 {0,1}',
      color: {
        stroke: 'oklch(0.72 0.20 60)',    // amber-orange
        band:   'oklch(0.72 0.20 60 / 0.10)',
        badge:  'oklch(0.72 0.20 60)',
        text:   'oklch(0.90 0.08 60)',    // light amber for dark bg contrast
      },
      visible: hasChallenge,
    },
    {
      key: 'response',
      direction: 'right',
      label: 's (response)',
      math: 's = r + c\u00B7x mod q',
      color: {
        stroke: 'oklch(0.62 0.20 145)',   // green
        band:   'oklch(0.62 0.20 145 / 0.10)',
        badge:  'oklch(0.62 0.20 145)',
        text:   'oklch(0.86 0.10 145)',   // light green for dark bg contrast
      },
      visible: hasResponse,
    },
  ];

  // Arrow shaft endpoints (with small inset from lifeline centres)
  const INSET = 16;
  const arrowXRight = { x1: PROVER_X + INSET, x2: VERIFIER_X - INSET };
  const arrowXLeft  = { x1: VERIFIER_X - INSET, x2: PROVER_X + INSET };

  // Framer Motion variants — all typed as Variants to satisfy TS6 exactOptionalPropertyTypes
  const pathVariants: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: prefersReduced
        ? { duration: 0, pathLength: { duration: 0 }, opacity: { duration: 0 } }
        : { pathLength: { duration: 0.5, ease: 'easeOut' }, opacity: { duration: 0.1 } },
    },
    exit: { pathLength: 0, opacity: 0, transition: { duration: 0.2 } },
  };

  // labelVariants uses a factory function (custom prop) — cast to Variants
  const labelVariants: Variants = {
    hidden: { opacity: 0, y: 4 },
    visible: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: prefersReduced
        ? { duration: 0, delay: 0, ease: 'linear' }
        : { delay, duration: 0.3, ease: 'easeOut' },
    }),
    exit: { opacity: 0, y: 0, transition: { duration: 0.15 } },
  };

  const verifyVariants: Variants = {
    hidden: { opacity: 0, scale: 0.92 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: prefersReduced
        ? { duration: 0, ease: 'linear' }
        : { duration: 0.4, ease: 'backOut' },
    },
    exit: { opacity: 0, scale: 0.92, transition: { duration: 0.2 } },
  };

  return (
    <div
      className="relative w-full overflow-x-auto rounded-xl border border-border bg-card"
      role="img"
      aria-label="Schnorr protocol sequence diagram showing message flow between Prover and Verifier"
    >
      {/* Glass-morphism noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ minWidth: 360, maxHeight: 360 }}
        aria-hidden="true"
      >
        {/* ── Colour bands ─────────────────────────────────────────── */}
        <AnimatePresence>
          {arrows.map((arrow, i) =>
            arrow.visible ? (
              <motion.rect
                key={`band-${arrow.key}`}
                x={0}
                y={(ROW_Y[i] ?? 0) - BAND_H}
                width={SVG_W}
                height={BAND_H * 2}
                fill={arrow.color.band}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: prefersReduced ? 0 : 0.3 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              />
            ) : null,
          )}
        </AnimatePresence>

        {/* ── Dashed lifelines ─────────────────────────────────────── */}
        {[PROVER_X, VERIFIER_X].map((x) => (
          <line
            key={x}
            x1={x} y1={LIFELINE_TOP}
            x2={x} y2={LIFELINE_BOT}
            stroke="oklch(0.55 0.02 250 / 0.35)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        ))}

        {/* ── Participant header cards ──────────────────────────────── */}
        {/* Prover */}
        <rect x={PROVER_X - 52} y={4} width={104} height={52} rx={10}
          fill="oklch(0.55 0.27 264 / 0.12)"
          stroke="oklch(0.55 0.27 264 / 0.35)"
          strokeWidth={1.5}
        />
        {/* Key icon path — simplified lucide key */}
        <g transform={`translate(${PROVER_X - 9}, 14)`} fill="none" stroke="oklch(0.55 0.27 264)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={6} cy={6} r={4} />
          <path d="M10 10 L18 18 M15 15 L18 12" />
        </g>
        <text x={PROVER_X} y={44} textAnchor="middle" fontFamily="inherit"
          fontSize={12} fontWeight={600}
          fill="oklch(0.85 0.12 264)"
        >Prover (Alice)</text>

        {/* Verifier */}
        <rect x={VERIFIER_X - 60} y={4} width={120} height={52} rx={10}
          fill="oklch(0.55 0.22 300 / 0.12)"
          stroke="oklch(0.55 0.22 300 / 0.35)"
          strokeWidth={1.5}
        />
        {/* Lock icon path — simplified lucide lock */}
        <g transform={`translate(${VERIFIER_X - 9}, 14)`} fill="none" stroke="oklch(0.55 0.22 300)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x={2} y={8} width={14} height={10} rx={2} />
          <path d="M5 8 V5 A4 4 0 0 1 13 5 V8" />
          <circle cx={9} cy={13} r={1.5} fill="oklch(0.55 0.22 300)" stroke="none" />
        </g>
        <text x={VERIFIER_X} y={44} textAnchor="middle" fontFamily="inherit"
          fontSize={12} fontWeight={600}
          fill="oklch(0.85 0.12 300)"
        >Verifier (Bob)</text>

        {/* ── Step numbers on left edge ─────────────────────────────── */}
        <AnimatePresence>
          {arrows.map((arrow, i) =>
            arrow.visible ? (
              <motion.g
                key={`step-${arrow.key}`}
                variants={labelVariants}
                custom={prefersReduced ? 0 : 0.25}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <circle cx={22} cy={ROW_Y[i] ?? 0} r={14}
                  fill={arrow.color.stroke}
                  opacity={0.9}
                />
                <text x={22} y={(ROW_Y[i] ?? 0) + 4.5} textAnchor="middle"
                  fontFamily="inherit" fontSize={11} fontWeight={700}
                  fill="oklch(1 0 0)"
                >{i + 1}</text>
              </motion.g>
            ) : null,
          )}
        </AnimatePresence>

        {/* ── Arrows ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {arrows.map((arrow, i) => {
            if (!arrow.visible) return null;
            const y = ROW_Y[i] ?? 0;
            const { x1, x2 } = arrow.direction === 'right' ? arrowXRight : arrowXLeft;
            const midX = (x1 + x2) / 2;

            // Arrowhead direction
            const headX = x2;
            const headY = y;
            const headPath =
              arrow.direction === 'right'
                ? `M ${headX - 10},${headY - 5} L ${headX},${headY} L ${headX - 10},${headY + 5}`
                : `M ${headX + 10},${headY - 5} L ${headX},${headY} L ${headX + 10},${headY + 5}`;

            // Math label positioned off the arrow, above for right / below for left
            const mathY = arrow.direction === 'right' ? y - 14 : y + 22;
            // Label on the shaft
            const labelY = arrow.direction === 'right' ? y + 18 : y - 8;

            return (
              <motion.g
                key={`arrow-group-${arrow.key}`}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Shaft */}
                <motion.path
                  d={`M ${x1},${y} L ${x2},${y}`}
                  stroke={arrow.color.stroke}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  fill="none"
                  variants={pathVariants}
                  custom={i * 0.15}
                />
                {/* Arrowhead (drawn as a separate non-dashed path) */}
                <motion.path
                  d={headPath}
                  stroke={arrow.color.stroke}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  variants={labelVariants}
                  custom={prefersReduced ? 0 : 0.4 + i * 0.1}
                />

                {/* Shaft label */}
                <motion.text
                  x={midX}
                  y={labelY}
                  textAnchor="middle"
                  fontFamily="inherit"
                  fontSize={11}
                  fontWeight={600}
                  fill={arrow.color.text}
                  variants={labelVariants}
                  custom={prefersReduced ? 0 : 0.35 + i * 0.1}
                >
                  {arrow.label}
                </motion.text>

                {/* Math annotation */}
                <motion.text
                  x={midX}
                  y={mathY}
                  textAnchor="middle"
                  fontFamily="'Courier New', monospace"
                  fontSize={10}
                  fill={arrow.color.text}
                  opacity={0.75}
                  variants={labelVariants}
                  custom={prefersReduced ? 0 : 0.45 + i * 0.1}
                >
                  {arrow.math}
                </motion.text>
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* ── Idle placeholder text ─────────────────────────────────── */}
        <AnimatePresence>
          {!hasCommitment && (
            <motion.text
              key="idle-hint"
              x={SVG_W / 2}
              y={SVG_H / 2}
              textAnchor="middle"
              fontFamily="inherit"
              fontSize={12}
              fill="oklch(0.55 0.02 250 / 0.5)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Run the protocol steps above to see message flow
            </motion.text>
          )}
        </AnimatePresence>
      </svg>

      {/* ── Verification footer ───────────────────────────────────── */}
      <AnimatePresence>
        {verified !== undefined && (
          <motion.div
            key="verify-banner"
            variants={verifyVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'mx-4 mb-4 flex items-center gap-3 rounded-lg border px-4 py-3',
              verified
                ? 'border-[oklch(0.62_0.20_145/0.40)] bg-[oklch(0.62_0.20_145/0.08)]'
                : 'border-[oklch(0.58_0.22_25/0.40)] bg-[oklch(0.58_0.22_25/0.08)]',
            )}
            role="status"
            aria-live="polite"
          >
            {/* Animated checkmark / cross */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                verified
                  ? 'bg-[oklch(0.62_0.20_145/0.20)] text-[oklch(0.78_0.18_145)]'
                  : 'bg-[oklch(0.58_0.22_25/0.20)] text-[oklch(0.78_0.18_25)]',
              )}
            >
              {verified ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </motion.div>

            <div className="min-w-0">
              <p className={cn(
                'text-xs font-semibold',
                verified ? 'text-[oklch(0.82_0.12_145)]' : 'text-[oklch(0.82_0.12_25)]',
              )}>
                {verified ? 'Proof Accepted' : 'Proof Rejected'}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                Verify: g^s {verified ? '\u2261' : '\u2262'} t\u00B7y^c (mod p)
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Props for enhanced ZKP Demo component
 */
export interface ZKPDemoProps {
  /**
   * Whether to show educational explanations
   */
  showExplanations?: boolean;

  /**
   * Animation speed preset
   */
  animationSpeed?: 'slow' | 'normal' | 'fast' | 'instant';

  /**
   * Callback when proof is completed
   */
  onProofCompleted?: (verified: boolean) => void;

  /**
   * Custom CSS class name
   */
  className?: string;
}

type ProtocolType = 'schnorr' | 'pedersen' | 'range' | 'properties';
type SchnorrStep = 'setup' | 'commitment' | 'challenge' | 'response' | 'verification';
type PedersenStep = 'commit' | 'open' | 'homomorphic';
type RangeStep = 'setup' | 'decompose' | 'prove' | 'verify';

/**
 * Schnorr Protocol State
 */
interface SchnorrState {
  step: SchnorrStep;
  secret?: bigint;
  publicKey?: bigint;
  commitment?: bigint;
  randomness?: bigint;
  challenge?: bigint;
  response?: bigint;
  verified?: boolean;
}

/**
 * Pedersen Commitment State
 */
interface PedersenState {
  step: PedersenStep;
  value?: bigint;
  commitment?: bigint;
  randomness?: bigint;
  opened?: boolean;
  commitment2?: bigint;
  value2?: bigint;
  randomness2?: bigint;
  homomorphicResult?: bigint;
}

/**
 * Range Proof State
 */
interface RangeState {
  step: RangeStep;
  value: number;
  minRange: number;
  maxRange: number;
  bitLength: number;
  commitment?: number;
  proof?: ReadonlyArray<number>;
  verified?: boolean;
  bitDecomposition?: ReadonlyArray<number>;
}

/**
 * Enhanced Zero-Knowledge Proof Demonstration Component
 *
 * Demonstrates multiple ZKP protocols:
 * - Schnorr Protocol (interactive proof of discrete logarithm)
 * - Pedersen Commitment (hiding and binding commitments)
 * - Range Proof (prove value in range without revealing)
 * - ZKP Properties (completeness, soundness, zero-knowledge)
 *
 * @example
 * ```tsx
 * <ZKPDemo
 *   showExplanations={true}
 *   animationSpeed="normal"
 *   onProofCompleted={(verified) => console.log('Proof verified:', verified)}
 * />
 * ```
 */
export function ZKPDemo({
  showExplanations = true,
  onProofCompleted,
  className,
}: ZKPDemoProps) {
  // Protocol selection
  const [activeProtocol, setActiveProtocol] = useState<ProtocolType>('schnorr');

  // Schnorr state
  const [schnorrState, setSchnorrState] = useState<SchnorrState>({ step: 'setup' });

  // Pedersen state
  const [pedersenState, setPedersenState] = useState<PedersenState>({
    step: 'commit',
    value: 42n,
  });

  // Range proof state
  const [rangeState, setRangeState] = useState<RangeState>({
    step: 'setup',
    value: 25,
    minRange: 10,
    maxRange: 50,
    bitLength: 8,
  });

  // UI state
  const [roleView, setRoleView] = useState<'prover' | 'verifier' | 'both'>('both');
  const [showSecret, setShowSecret] = useState<boolean>(false);

  // Cryptographic parameters (shared across protocols)
  const cryptoParams = useMemo(() => {
    const p = 32452843n; // Safe prime for demo
    const g = 5n; // Generator
    const h = 7n; // Second generator for Pedersen
    return { p, g, h };
  }, []);

  /**
   * Format large numbers for display
   */
  const formatBigInt = useCallback((value: bigint | undefined): string => {
    if (!value) return 'N/A';
    const str = value.toString();
    if (str.length > 20) {
      return `${str.slice(0, 8)}...${str.slice(-8)}`;
    }
    return str;
  }, []);

  /**
   * Modular exponentiation helper
   */
  const modPow = useCallback((base: bigint, exp: bigint, mod: bigint): bigint => {
    let result = 1n;
    base = base % mod;

    while (exp > 0n) {
      if (exp % 2n === 1n) {
        result = (result * base) % mod;
      }
      exp = exp >> 1n;
      base = (base * base) % mod;
    }

    return result;
  }, []);

  /**
   * Generate random bigint
   */
  const randomBigInt = useCallback((max: bigint): bigint => {
    const maxNumber = Number(max);
    if (maxNumber > Number.MAX_SAFE_INTEGER) {
      return BigInt(Math.floor(Math.random() * 1000000) + 1);
    }
    return BigInt(Math.floor(Math.random() * maxNumber) + 1);
  }, []);

  // ============================================================================
  // SCHNORR PROTOCOL FUNCTIONS
  // ============================================================================

  const schnorrSetup = useCallback(() => {
    const secret = randomBigInt(cryptoParams.p - 1n);
    const publicKey = modPow(cryptoParams.g, secret, cryptoParams.p);

    setSchnorrState({
      step: 'commitment',
      secret,
      publicKey,
    });
  }, [cryptoParams, modPow, randomBigInt]);

  const schnorrCommitment = useCallback(() => {
    if (!schnorrState.secret) return;

    const randomness = randomBigInt(cryptoParams.p - 1n);
    const commitment = modPow(cryptoParams.g, randomness, cryptoParams.p);

    setSchnorrState(prev => ({
      ...prev,
      step: 'challenge',
      commitment,
      randomness,
    }));
  }, [schnorrState.secret, cryptoParams, modPow, randomBigInt]);

  const schnorrChallenge = useCallback(() => {
    const challenge = randomBigInt(BigInt(1000000));

    setSchnorrState(prev => ({
      ...prev,
      step: 'response',
      challenge,
    }));
  }, [randomBigInt]);

  const schnorrResponse = useCallback(() => {
    if (!schnorrState.secret || !schnorrState.randomness || !schnorrState.challenge) return;

    const response = (schnorrState.randomness + schnorrState.challenge * schnorrState.secret) % (cryptoParams.p - 1n);

    setSchnorrState(prev => ({
      ...prev,
      step: 'verification',
      response,
    }));
  }, [schnorrState, cryptoParams]);

  const schnorrVerify = useCallback(() => {
    if (!schnorrState.commitment || !schnorrState.publicKey || !schnorrState.challenge || !schnorrState.response) return;

    const leftSide = modPow(cryptoParams.g, schnorrState.response, cryptoParams.p);
    const rightSide = (schnorrState.commitment * modPow(schnorrState.publicKey, schnorrState.challenge, cryptoParams.p)) % cryptoParams.p;

    const verified = leftSide === rightSide;

    setSchnorrState(prev => ({
      ...prev,
      verified,
    }));

    onProofCompleted?.(verified);
  }, [schnorrState, cryptoParams, modPow, onProofCompleted]);

  const resetSchnorr = useCallback(() => {
    setSchnorrState({ step: 'setup' });
  }, []);

  // ============================================================================
  // PEDERSEN COMMITMENT FUNCTIONS
  // ============================================================================

  const pedersenCommit = useCallback(() => {
    if (!pedersenState.value) return;

    const randomness = randomBigInt(cryptoParams.p - 1n);
    const commitment = (modPow(cryptoParams.g, pedersenState.value, cryptoParams.p) *
                       modPow(cryptoParams.h, randomness, cryptoParams.p)) % cryptoParams.p;

    setPedersenState(prev => ({
      ...prev,
      step: 'open',
      commitment,
      randomness,
    }));
  }, [pedersenState.value, cryptoParams, modPow, randomBigInt]);

  const pedersenOpen = useCallback(() => {
    if (!pedersenState.commitment || !pedersenState.value || !pedersenState.randomness) return;

    const recomputed = (modPow(cryptoParams.g, pedersenState.value, cryptoParams.p) *
                       modPow(cryptoParams.h, pedersenState.randomness, cryptoParams.p)) % cryptoParams.p;

    const opened = recomputed === pedersenState.commitment;

    setPedersenState(prev => ({
      ...prev,
      opened,
    }));
  }, [pedersenState, cryptoParams, modPow]);

  const pedersenHomomorphic = useCallback(() => {
    // Demonstrate homomorphic property: C(m1 + m2) = C(m1) * C(m2)
    const value1 = 10n;
    const value2 = 15n;
    const r1 = randomBigInt(cryptoParams.p - 1n);
    const r2 = randomBigInt(cryptoParams.p - 1n);

    const c1 = (modPow(cryptoParams.g, value1, cryptoParams.p) *
               modPow(cryptoParams.h, r1, cryptoParams.p)) % cryptoParams.p;
    const c2 = (modPow(cryptoParams.g, value2, cryptoParams.p) *
               modPow(cryptoParams.h, r2, cryptoParams.p)) % cryptoParams.p;

    const cProduct = (c1 * c2) % cryptoParams.p;

    const valueSum = value1 + value2;
    const rSum = r1 + r2;
    const cSum = (modPow(cryptoParams.g, valueSum, cryptoParams.p) *
                 modPow(cryptoParams.h, rSum, cryptoParams.p)) % cryptoParams.p;

    setPedersenState(prev => ({
      ...prev,
      step: 'homomorphic',
      commitment: c1,
      value: value1,
      randomness: r1,
      commitment2: c2,
      value2,
      randomness2: r2,
      homomorphicResult: cProduct,
      opened: cProduct === cSum,
    }));
  }, [cryptoParams, modPow, randomBigInt]);

  const resetPedersen = useCallback(() => {
    setPedersenState({ step: 'commit', value: 42n });
  }, []);

  // ============================================================================
  // RANGE PROOF FUNCTIONS
  // ============================================================================

  const rangeSetup = useCallback(() => {
    setRangeState(prev => ({
      ...prev,
      step: 'decompose',
    }));
  }, []);

  const rangeDecompose = useCallback(() => {
    // Decompose value into bits
    const bits: number[] = [];
    let value = rangeState.value;

    for (let i = 0; i < rangeState.bitLength; i++) {
      bits.push(value & 1);
      value >>= 1;
    }

    setRangeState(prev => ({
      ...prev,
      step: 'prove',
      bitDecomposition: bits,
    }));
  }, [rangeState.value, rangeState.bitLength]);

  const rangeProve = useCallback(() => {
    const rangeProof = new RangeProof();
    const { commitment, proof } = rangeProof.prove(rangeState.value, rangeState.bitLength);

    setRangeState(prev => ({
      ...prev,
      step: 'verify',
      commitment,
      proof,
    }));
  }, [rangeState.value, rangeState.bitLength]);

  const rangeVerify = useCallback(() => {
    if (!rangeState.commitment || !rangeState.proof) return;

    const rangeProof = new RangeProof();
    const verified = rangeProof.verify(rangeState.commitment, rangeState.proof, rangeState.bitLength);

    setRangeState(prev => ({
      ...prev,
      verified,
    }));
  }, [rangeState]);

  const resetRange = useCallback(() => {
    setRangeState({
      step: 'setup',
      value: 25,
      minRange: 10,
      maxRange: 50,
      bitLength: 8,
    });
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderSchnorrProtocol = () => (
    <div className="space-y-6">
      {/* Two Column Layout: Prover | Verifier */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Prover Side */}
        <Card className={cn(
          'transition-all',
          (roleView === 'both' || roleView === 'prover') ? 'opacity-100' : 'opacity-50'
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Prover (Alice)
            </CardTitle>
            <CardDescription>Has secret, generates proof</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schnorrState.step === 'setup' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Generate secret x and public key y = g^x mod p
                </p>
                <Button onClick={schnorrSetup} className="w-full">
                  <Unlock className="h-4 w-4 mr-2" />
                  Generate Secret
                </Button>
              </div>
            )}

            {schnorrState.secret && (
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Secret (x)</span>
                  <Badge variant="destructive" className="text-xs">Private</Badge>
                </Label>
                <div className="relative">
                  <code className={cn(
                    'block text-xs bg-destructive/10 p-2 rounded border border-destructive/20 font-mono break-all overflow-x-auto',
                    !showSecret && 'blur-sm select-none'
                  )}>
                    {formatBigInt(schnorrState.secret)}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 right-1"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            )}

            {schnorrState.publicKey && (
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Public Key (y)</span>
                  <Badge variant="outline" className="text-xs">Public</Badge>
                </Label>
                <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                  {formatBigInt(schnorrState.publicKey)}
                </code>
              </div>
            )}

            {schnorrState.step === 'commitment' && (
              <Button onClick={schnorrCommitment} className="w-full">
                <Hash className="h-4 w-4 mr-2" />
                Create Commitment
              </Button>
            )}

            {schnorrState.commitment && (
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Commitment (t)</span>
                  <Badge variant="outline" className="text-xs">Public</Badge>
                </Label>
                <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                  {formatBigInt(schnorrState.commitment)}
                </code>
              </div>
            )}

            {schnorrState.step === 'response' && schnorrState.challenge && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Received Challenge (c)</Label>
                  <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                    {formatBigInt(schnorrState.challenge)}
                  </code>
                </div>
                <Button onClick={schnorrResponse} className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  Compute Response
                </Button>
              </div>
            )}

            {schnorrState.response && (
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Response (s)</span>
                  <Badge variant="outline" className="text-xs">Public</Badge>
                </Label>
                <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                  {formatBigInt(schnorrState.response)}
                </code>
                <p className="text-xs text-muted-foreground">
                  s = r + c·x mod (p-1)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verifier Side */}
        <Card className={cn(
          'transition-all',
          (roleView === 'both' || roleView === 'verifier') ? 'opacity-100' : 'opacity-50'
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-secondary" />
              Verifier (Bob)
            </CardTitle>
            <CardDescription>Verifies proof without learning secret</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schnorrState.publicKey && (
              <div className="space-y-2">
                <Label>Received Public Key (y)</Label>
                <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                  {formatBigInt(schnorrState.publicKey)}
                </code>
              </div>
            )}

            {schnorrState.commitment && schnorrState.step === 'challenge' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Received Commitment (t)</Label>
                  <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                    {formatBigInt(schnorrState.commitment)}
                  </code>
                </div>
                <Button onClick={schnorrChallenge} className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  Send Challenge
                </Button>
              </div>
            )}

            {schnorrState.challenge && schnorrState.step !== 'challenge' && (
              <div className="space-y-2">
                <Label>Challenge (c)</Label>
                <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                  {formatBigInt(schnorrState.challenge)}
                </code>
              </div>
            )}

            {schnorrState.step === 'verification' && schnorrState.response && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Received Response (s)</Label>
                  <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                    {formatBigInt(schnorrState.response)}
                  </code>
                </div>
                <Button onClick={schnorrVerify} className="w-full">
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Verify Proof
                </Button>
                <Alert className="text-xs">
                  <Info className="h-4 w-4" />
                  <p className="ml-2">
                    Check: g^s ≡ t·y^c (mod p)
                  </p>
                </Alert>
              </div>
            )}

            {schnorrState.verified !== undefined && (
              <Alert variant={schnorrState.verified ? 'default' : 'destructive'}>
                {schnorrState.verified ? (
                  <>
                    <Check className="h-4 w-4" />
                    <div className="ml-2">
                      <h4 className="font-semibold">Proof Verified!</h4>
                      <p className="text-sm mt-1">
                        Alice proved knowledge of x without revealing it
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    <div className="ml-2">
                      <h4 className="font-semibold">Proof Failed</h4>
                      <p className="text-sm mt-1">Invalid proof</p>
                    </div>
                  </>
                )}
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Protocol Message Flow — SVG sequence diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" aria-hidden="true" />
            Protocol Message Flow
          </CardTitle>
          <CardDescription className="text-xs">
            Animated sequence diagram — messages appear as you progress through the protocol steps
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3">
          <ProtocolSequenceDiagram
            hasCommitment={!!schnorrState.commitment}
            hasChallenge={!!schnorrState.challenge}
            hasResponse={!!schnorrState.response}
            verified={schnorrState.verified}
          />
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex gap-2">
        <Button onClick={resetSchnorr} variant="outline" className="flex-1">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );

  const renderPedersenCommitment = () => (
    <div className="space-y-6">
      <Tabs value={pedersenState.step} onValueChange={(v) => setPedersenState(prev => ({ ...prev, step: v as PedersenStep }))}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="commit">Commit</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="homomorphic">Homomorphic</TabsTrigger>
        </TabsList>

        <TabsContent value="commit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Commit to a Value</CardTitle>
              <CardDescription>
                Create a cryptographic commitment that hides the value but can be opened later
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="commit-value">Value to Commit (m)</Label>
                <Input
                  id="commit-value"
                  type="number"
                  value={Number(pedersenState.value)}
                  onChange={(e) => setPedersenState(prev => ({
                    ...prev,
                    value: BigInt(e.target.value)
                  }))}
                />
              </div>

              <Button onClick={pedersenCommit} className="w-full">
                <Lock className="h-4 w-4 mr-2" />
                Generate Commitment
              </Button>

              {pedersenState.commitment && (
                <div className="space-y-4">
                  <Separator />
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span>Commitment (C)</span>
                      <Badge variant="outline">Public</Badge>
                    </Label>
                    <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                      {formatBigInt(pedersenState.commitment)}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      C = g^m · h^r mod p
                    </p>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <p className="ml-2 text-xs">
                      The commitment reveals nothing about the value m due to random blinding factor r
                    </p>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="open" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Open Commitment</CardTitle>
              <CardDescription>
                Reveal the value and verify it matches the commitment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!pedersenState.commitment ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <p className="ml-2 text-sm">
                    Create a commitment first in the Commit tab
                  </p>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Commitment to Open</Label>
                    <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                      {formatBigInt(pedersenState.commitment)}
                    </code>
                  </div>

                  <Button onClick={pedersenOpen} className="w-full">
                    <Unlock className="h-4 w-4 mr-2" />
                    Open Commitment
                  </Button>

                  {pedersenState.opened !== undefined && (
                    <Alert variant={pedersenState.opened ? 'default' : 'destructive'}>
                      {pedersenState.opened ? (
                        <>
                          <Check className="h-4 w-4" />
                          <div className="ml-2">
                            <h4 className="font-semibold">Commitment Opened Successfully</h4>
                            <p className="text-sm mt-1">
                              Value: {pedersenState.value?.toString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Verification: C = g^{pedersenState.value?.toString()} · h^r mod p ✓
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          <div className="ml-2">
                            <h4 className="font-semibold">Invalid Opening</h4>
                            <p className="text-sm mt-1">
                              The revealed values don't match the commitment
                            </p>
                          </div>
                        </>
                      )}
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="homomorphic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Homomorphic Property</CardTitle>
              <CardDescription>
                Demonstrate that C(m1 + m2) = C(m1) · C(m2)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={pedersenHomomorphic} className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Demonstrate Homomorphic Addition
              </Button>

              {pedersenState.homomorphicResult && (
                <div className="space-y-4">
                  <Separator />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Commitment C(10)</Label>
                      <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                        {formatBigInt(pedersenState.commitment)}
                      </code>
                    </div>

                    <div className="space-y-2">
                      <Label>Commitment C(15)</Label>
                      <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                        {formatBigInt(pedersenState.commitment2)}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <ChevronRight className="h-6 w-6 text-muted-foreground" />
                  </div>

                  <div className="space-y-2">
                    <Label>C(10) · C(15) = C(25)</Label>
                    <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                      {formatBigInt(pedersenState.homomorphicResult)}
                    </code>
                  </div>

                  <Alert variant={pedersenState.opened ? 'default' : 'destructive'}>
                    {pedersenState.opened ? (
                      <>
                        <Check className="h-4 w-4" />
                        <div className="ml-2">
                          <h4 className="font-semibold">Homomorphic Property Verified</h4>
                          <p className="text-sm mt-1">
                            C(10) · C(15) = C(25) ✓
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4" />
                        <div className="ml-2">
                          <h4 className="font-semibold">Verification Failed</h4>
                        </div>
                      </>
                    )}
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={resetPedersen} variant="outline" className="w-full">
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset
      </Button>
    </div>
  );

  const renderRangeProof = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Range Proof Configuration</CardTitle>
          <CardDescription>
            Prove a value is in range [0, 2^n - 1] without revealing it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="range-value">
              Secret Value: {rangeState.value}
              <Badge variant="outline" className="ml-2 text-xs">
                Range: [0, {2 ** rangeState.bitLength - 1}]
              </Badge>
            </Label>
            <Slider
              id="range-value"
              value={[rangeState.value]}
              onValueChange={([value]) => setRangeState(prev => ({ ...prev, value: value || 0 }))}
              min={0}
              max={2 ** rangeState.bitLength - 1}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bit-length">
              Bit Length: {rangeState.bitLength}
            </Label>
            <Slider
              id="bit-length"
              value={[rangeState.bitLength]}
              onValueChange={([value]) => setRangeState(prev => ({
                ...prev,
                bitLength: value || 8,
                value: Math.min(prev.value, 2 ** (value || 8) - 1)
              }))}
              min={4}
              max={16}
              step={1}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Step-by-step execution */}
      <div className="space-y-4">
        {rangeState.step === 'setup' && (
          <Button onClick={rangeSetup} className="w-full">
            <Play className="h-4 w-4 mr-2" />
            Start Range Proof
          </Button>
        )}

        {rangeState.step === 'decompose' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Step 1: Bit Decomposition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Decompose value into binary representation
              </p>
              <Button onClick={rangeDecompose} className="w-full">
                <Binary className="h-4 w-4 mr-2" />
                Decompose into Bits
              </Button>
            </CardContent>
          </Card>
        )}

        {rangeState.bitDecomposition && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bit Decomposition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {rangeState.bitDecomposition.map((bit, i) => (
                  <Badge
                    key={i}
                    variant={bit === 1 ? 'default' : 'outline'}
                    className="font-mono"
                  >
                    {bit}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Binary: {rangeState.bitDecomposition.slice().reverse().join('')} = {rangeState.value}
              </p>
            </CardContent>
          </Card>
        )}

        {rangeState.step === 'prove' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Step 2: Generate Proof</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create cryptographic proof that value is in valid range
              </p>
              <Button onClick={rangeProve} className="w-full">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Generate Range Proof
              </Button>
            </CardContent>
          </Card>
        )}

        {rangeState.proof && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Generated Proof</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <Label>Commitment</Label>
                <code className="block text-xs bg-muted p-2 rounded font-mono break-all overflow-x-auto">
                  {rangeState.commitment}
                </code>
              </div>
              <div className="space-y-2">
                <Label>Proof Size</Label>
                <Badge variant="outline">{rangeState.proof.length} elements</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {rangeState.step === 'verify' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Step 3: Verify Proof</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Verify that the proof is valid without learning the value
              </p>
              <Button onClick={rangeVerify} className="w-full">
                <FileCheck className="h-4 w-4 mr-2" />
                Verify Range Proof
              </Button>
            </CardContent>
          </Card>
        )}

        {rangeState.verified !== undefined && (
          <Alert variant={rangeState.verified ? 'default' : 'destructive'}>
            {rangeState.verified ? (
              <>
                <Check className="h-4 w-4" />
                <div className="ml-2">
                  <h4 className="font-semibold">Range Proof Verified</h4>
                  <p className="text-sm mt-1">
                    Value is proven to be in range [0, {2 ** rangeState.bitLength - 1}]
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Actual value remains hidden: {showSecret ? rangeState.value : '***'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <X className="h-4 w-4" />
                <div className="ml-2">
                  <h4 className="font-semibold">Proof Failed</h4>
                  <p className="text-sm mt-1">Invalid range proof</p>
                </div>
              </>
            )}
          </Alert>
        )}
      </div>

      <Button onClick={resetRange} variant="outline" className="w-full">
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset
      </Button>
    </div>
  );

  const renderProperties = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Three Core Properties of ZKP</CardTitle>
          <CardDescription>
            Every zero-knowledge proof must satisfy these properties
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Completeness */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold">Completeness</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  If the statement is true, an honest verifier will be convinced by an honest prover
                </p>
                <Alert className="mt-3">
                  <Info className="h-4 w-4" />
                  <p className="ml-2 text-xs">
                    Valid proofs always verify successfully. Try the Schnorr protocol above!
                  </p>
                </Alert>
              </div>
            </div>
          </div>

          <Separator />

          {/* Soundness */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold">Soundness</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  If the statement is false, no cheating prover can convince the verifier (except with negligible probability)
                </p>
                <Alert className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="ml-2 text-xs">
                    Without the secret, verification will fail. The probability of cheating successfully is cryptographically negligible.
                  </p>
                </Alert>
              </div>
            </div>
          </div>

          <Separator />

          {/* Zero-Knowledge */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <EyeOff className="h-5 w-5 text-purple-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold">Zero-Knowledge</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The verifier learns nothing beyond the validity of the statement
                </p>
                <Alert className="mt-3">
                  <Info className="h-4 w-4" />
                  <p className="ml-2 text-xs">
                    The proof transcript (commitment, challenge, response) reveals no information about the secret value x.
                  </p>
                </Alert>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>ZKP Protocol Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Protocol</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Security</th>
                  <th className="text-left p-2">Use Case</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setActiveProtocol('schnorr')}>
                  <td className="p-2 font-semibold">Schnorr</td>
                  <td className="p-2">
                    <Badge variant="outline">Sigma Protocol</Badge>
                  </td>
                  <td className="p-2">
                    <Badge variant="outline">Discrete Log</Badge>
                  </td>
                  <td className="p-2">Authentication</td>
                </tr>
                <tr className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setActiveProtocol('pedersen')}>
                  <td className="p-2 font-semibold">Pedersen</td>
                  <td className="p-2">
                    <Badge variant="outline">Commitment</Badge>
                  </td>
                  <td className="p-2">
                    <Badge variant="outline">Binding & Hiding</Badge>
                  </td>
                  <td className="p-2">Voting, Auctions</td>
                </tr>
                <tr className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setActiveProtocol('range')}>
                  <td className="p-2 font-semibold">Range Proof</td>
                  <td className="p-2">
                    <Badge variant="outline">Non-interactive</Badge>
                  </td>
                  <td className="p-2">
                    <Badge variant="outline">Bulletproof</Badge>
                  </td>
                  <td className="p-2">Private Transactions</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={cn('w-full max-w-7xl mx-auto space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between min-w-0">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-2xl sm:text-3xl font-bold flex items-center gap-2 flex-wrap">
                <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
                <span className="break-words">Zero-Knowledge Proof Demonstrations</span>
              </CardTitle>
              <CardDescription className="break-words">
                Interactive demonstrations of cryptographic protocols that prove knowledge without revealing information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeProtocol} onValueChange={(v) => setActiveProtocol(v as ProtocolType)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="schnorr" className="text-xs sm:text-sm truncate">Schnorr</TabsTrigger>
          <TabsTrigger value="pedersen" className="text-xs sm:text-sm truncate">Pedersen</TabsTrigger>
          <TabsTrigger value="range" className="text-xs sm:text-sm truncate">Range Proof</TabsTrigger>
          <TabsTrigger value="properties" className="text-xs sm:text-sm truncate">Properties</TabsTrigger>
        </TabsList>

        <TabsContent value="schnorr" className="space-y-6">
          {/* View Mode Selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">View Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={roleView === 'both' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoleView('both')}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Both
                  </Button>
                  <Button
                    variant={roleView === 'prover' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoleView('prover')}
                  >
                    <Key className="h-4 w-4 mr-1" />
                    Prover
                  </Button>
                  <Button
                    variant={roleView === 'verifier' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoleView('verifier')}
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    Verifier
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {renderSchnorrProtocol()}
        </TabsContent>

        <TabsContent value="pedersen">
          {renderPedersenCommitment()}
        </TabsContent>

        <TabsContent value="range">
          {renderRangeProof()}
        </TabsContent>

        <TabsContent value="properties">
          {renderProperties()}
        </TabsContent>
      </Tabs>

      {/* Educational Explanation */}
      {showExplanations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Understanding Zero-Knowledge Proofs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="concept">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="concept" className="text-xs sm:text-sm truncate">Concept</TabsTrigger>
                <TabsTrigger value="math" className="text-xs sm:text-sm truncate">Mathematics</TabsTrigger>
                <TabsTrigger value="security" className="text-xs sm:text-sm truncate">Security</TabsTrigger>
                <TabsTrigger value="applications" className="text-xs sm:text-sm truncate">Applications</TabsTrigger>
              </TabsList>

              <TabsContent value="concept" className="space-y-3 text-sm">
                <p>
                  <strong>Zero-Knowledge Proofs (ZKP)</strong> allow one party (the prover) to prove to another party (the verifier) that a statement is true, without revealing any information beyond the validity of the statement itself.
                </p>
                <p>
                  Think of it like proving you know a password without typing it, or proving you're over 21 without revealing your exact age.
                </p>
                <div className="bg-muted p-4 rounded-lg mt-4">
                  <h4 className="font-semibold mb-2">Example: Ali Baba's Cave</h4>
                  <p className="text-xs text-muted-foreground">
                    Peggy wants to prove she knows the secret word to open a magic door in a circular cave, without revealing the word to Victor. She enters the cave through one path, Victor doesn't see which. Victor asks her to exit from a specific side. If Peggy knows the secret, she can always comply; if not, she has only 50% chance. After many rounds, Victor is convinced without learning the secret.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="math" className="space-y-3 text-sm font-mono">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Schnorr Protocol</h4>
                    <div className="bg-muted p-4 rounded-lg space-y-1 text-xs overflow-x-auto">
                      <div className="whitespace-nowrap">Setup: y = g^x mod p (x is secret)</div>
                      <div className="whitespace-nowrap">Commitment: t = g^r mod p (random r)</div>
                      <div className="whitespace-nowrap">Challenge: c (random)</div>
                      <div className="whitespace-nowrap">Response: s = r + c·x mod (p-1)</div>
                      <div className="whitespace-nowrap">Verify: g^s ≡ t·y^c (mod p)</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Pedersen Commitment</h4>
                    <div className="bg-muted p-4 rounded-lg space-y-1 text-xs overflow-x-auto">
                      <div className="whitespace-nowrap">Commit: C = g^m · h^r mod p</div>
                      <div className="whitespace-nowrap">Open: Reveal m, r</div>
                      <div className="whitespace-nowrap">Verify: C = g^m · h^r mod p</div>
                      <div className="whitespace-nowrap">Homomorphic: C(m1)·C(m2) = C(m1 + m2)</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Range Proof</h4>
                    <div className="bg-muted p-4 rounded-lg space-y-1 text-xs overflow-x-auto">
                      <div className="whitespace-nowrap">Decompose: v = Σ b_i·2^i (binary)</div>
                      <div className="whitespace-nowrap">Commit: C_i for each bit b_i</div>
                      <div className="whitespace-nowrap">Prove: Each b_i ∈ {'{0,1}'}</div>
                      <div className="whitespace-nowrap">Verify: Inner product argument</div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-3 text-sm">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Completeness
                    </h4>
                    <p className="text-muted-foreground mt-1">
                      If the prover knows the secret, verification always succeeds. There are no false negatives.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-500" />
                      Soundness
                    </h4>
                    <p className="text-muted-foreground mt-1">
                      Without the secret, the probability of successful cheating is negligibly small (e.g., 2^-128). Based on hardness of discrete logarithm problem.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <EyeOff className="h-4 w-4 text-purple-500" />
                      Zero-Knowledge
                    </h4>
                    <p className="text-muted-foreground mt-1">
                      The random value r masks the secret x in the response s = r + c·x. The verifier sees only random-looking values that could be simulated without knowing x.
                    </p>
                  </div>

                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="ml-2 text-xs">
                      <strong>Note:</strong> This demo uses small numbers for educational purposes. Production systems use 2048+ bit primes and additional security measures (Fiat-Shamir transform, etc.).
                    </p>
                  </Alert>
                </div>
              </TabsContent>

              <TabsContent value="applications" className="space-y-3 text-sm">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold">Cryptocurrency Privacy</h4>
                    <p className="text-muted-foreground text-xs mt-1">
                      <strong>Zcash:</strong> Uses zk-SNARKs to hide transaction amounts, sender, and receiver while proving validity.
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      <strong>Monero:</strong> Uses bulletproofs for confidential transactions with range proofs.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold">Authentication</h4>
                    <p className="text-muted-foreground text-xs mt-1">
                      Prove you know a password without transmitting it. Protects against eavesdropping and server breaches.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold">Private Voting</h4>
                    <p className="text-muted-foreground text-xs mt-1">
                      Prove your vote is valid (one vote, valid candidate) without revealing who you voted for.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold">Verifiable Computation</h4>
                    <p className="text-muted-foreground text-xs mt-1">
                      Prove a computation was executed correctly without re-running it. Used in blockchain scaling (zkRollups).
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold">Identity Verification</h4>
                    <p className="text-muted-foreground text-xs mt-1">
                      Prove you're over 18, have a valid credential, or meet requirements without revealing unnecessary personal information.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
