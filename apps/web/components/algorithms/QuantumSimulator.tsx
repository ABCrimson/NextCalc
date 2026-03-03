'use client';

import { type ShorResult, shorAlgorithm } from '@nextcalc/math-engine';
import { AnimatePresence, m } from 'framer-motion';
import { Activity, ChevronRight, Cpu, Info, Pause, Play, RotateCcw, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  type Amplitude,
  ANIMATION_DURATIONS,
  type AnimationSpeed,
  createAmplitude,
  type QuantumCircuit,
  type QuantumGate,
  type QuantumState,
} from './types';

export interface QuantumSimulatorProps {
  initialQubits?: number;
  showExplanations?: boolean;
  animationSpeed?: AnimationSpeed;
  onMeasurement?: (result: string, probabilities: Record<string, number>) => void;
  className?: string;
}

/**
 * Per-gate color tokens aligned with the OKLCH app palette.
 * H = primary (violet-blue), X = red, CONTROL = green, TARGET = purple.
 */
const GATE_PALETTE = {
  H: {
    bg: '#4c38c9',
    border: '#6d5ae0',
    text: '#fff',
    glow: 'rgba(76,56,201,0.45)',
    label: 'H',
    desc: 'Hadamard',
  },
  X: {
    bg: '#c93838',
    border: '#e05a5a',
    text: '#fff',
    glow: 'rgba(201,56,56,0.45)',
    label: 'X',
    desc: 'Pauli-X',
  },
  CONTROL: {
    bg: '#2d9e6e',
    border: '#3dc98a',
    text: '#fff',
    glow: 'rgba(45,158,110,0.45)',
    label: '\u25cf',
    desc: 'Control',
  },
  TARGET: {
    bg: '#8b38c9',
    border: '#b05ae0',
    text: '#fff',
    glow: 'rgba(139,56,201,0.45)',
    label: '\u2295',
    desc: 'Target',
  },
} as const;

type GatePaletteKey = keyof typeof GATE_PALETTE;

// ---------- Quantum math helpers ----------

const Complex = {
  add: (a: Amplitude, b: Amplitude): Amplitude => createAmplitude(a.real + b.real, a.imag + b.imag),
  multiply: (a: Amplitude, b: Amplitude): Amplitude =>
    createAmplitude(a.real * b.real - a.imag * b.imag, a.real * b.imag + a.imag * b.real),
  magnitude: (a: Amplitude): number => Math.sqrt(a.real * a.real + a.imag * a.imag),
  probability: (a: Amplitude): number => {
    const m = Complex.magnitude(a);
    return m * m;
  },
};

function initializeQuantumState(numQubits: number): QuantumState {
  const numStates = 2 ** numQubits;
  const amplitudes: Amplitude[] = Array.from({ length: numStates }, (_, i) =>
    i === 0 ? createAmplitude(1, 0) : createAmplitude(0, 0),
  );
  const basis = Array.from({ length: numStates }, (_, i) => i.toString(2).padStart(numQubits, '0'));
  return { numQubits, amplitudes, basis };
}

function applyHadamard(state: QuantumState, qubit: number): QuantumState {
  const newAmplitudes = [...state.amplitudes];
  const mask = 1 << (state.numQubits - 1 - qubit);
  for (let i = 0; i < state.amplitudes.length; i++) {
    if ((i & mask) === 0) {
      const j = i | mask;
      const a = state.amplitudes[i]!;
      const b = state.amplitudes[j]!;
      const f = createAmplitude(1 / Math.SQRT2, 0);
      newAmplitudes[i] = Complex.multiply(f, Complex.add(a, b));
      newAmplitudes[j] = Complex.multiply(
        f,
        Complex.add(a, Complex.multiply(b, createAmplitude(-1, 0))),
      );
    }
  }
  return { ...state, amplitudes: newAmplitudes };
}

function applyPauliX(state: QuantumState, qubit: number): QuantumState {
  const newAmplitudes = [...state.amplitudes];
  const mask = 1 << (state.numQubits - 1 - qubit);
  for (let i = 0; i < state.amplitudes.length; i++) {
    if ((i & mask) === 0) {
      const j = i | mask;
      [newAmplitudes[i], newAmplitudes[j]] = [state.amplitudes[j]!, state.amplitudes[i]!];
    }
  }
  return { ...state, amplitudes: newAmplitudes };
}

function applyCNOT(state: QuantumState, control: number, target: number): QuantumState {
  const newAmplitudes = [...state.amplitudes];
  const cMask = 1 << (state.numQubits - 1 - control);
  const tMask = 1 << (state.numQubits - 1 - target);
  for (let i = 0; i < state.amplitudes.length; i++) {
    if ((i & cMask) !== 0 && (i & tMask) === 0) {
      const j = i | tMask;
      [newAmplitudes[i], newAmplitudes[j]] = [state.amplitudes[j]!, state.amplitudes[i]!];
    }
  }
  return { ...state, amplitudes: newAmplitudes };
}

function applyGate(state: QuantumState, gate: QuantumGate): QuantumState {
  switch (gate.type) {
    case 'H':
      return applyHadamard(state, gate.qubit);
    case 'X':
      return applyPauliX(state, gate.qubit);
    case 'CNOT':
      return applyCNOT(state, gate.control, gate.target);
    default:
      return state;
  }
}

function measureState(state: QuantumState): {
  result: string;
  probabilities: Record<string, number>;
} {
  const probabilities: Record<string, number> = {};
  let totalProb = 0;
  state.basis.forEach((basis, i) => {
    const prob = Complex.probability(state.amplitudes[i]!);
    probabilities[basis] = prob;
    totalProb += prob;
  });
  Object.keys(probabilities).forEach((k) => {
    probabilities[k] = (probabilities[k] ?? 0) / totalProb;
  });
  let cumulative = 0;
  const random = Math.random();
  let result = state.basis[0] ?? '0';
  for (const [basis, prob] of Object.entries(probabilities)) {
    cumulative += prob;
    if (random <= cumulative) {
      result = basis;
      break;
    }
  }
  return { result, probabilities };
}

const PRESET_CIRCUITS: Record<string, QuantumCircuit> = {
  bellState: {
    numQubits: 2,
    name: 'Bell State',
    description: 'Maximally entangled state (|00\u27E9 + |11\u27E9)/\u221A2',
    gates: [
      { type: 'H', qubit: 0 },
      { type: 'CNOT', control: 0, target: 1 },
    ],
  },
  ghzState: {
    numQubits: 3,
    name: 'GHZ State',
    description: 'Greenberger-Horne-Zeilinger (|000\u27E9 + |111\u27E9)/\u221A2',
    gates: [
      { type: 'H', qubit: 0 },
      { type: 'CNOT', control: 0, target: 1 },
      { type: 'CNOT', control: 1, target: 2 },
    ],
  },
  superposition: {
    numQubits: 3,
    name: 'Superposition',
    description: 'Equal superposition of all basis states',
    gates: [
      { type: 'H', qubit: 0 },
      { type: 'H', qubit: 1 },
      { type: 'H', qubit: 2 },
    ],
  },
};

// ---------- Sub-components ----------

function GateBox({
  gateKey,
  isActive,
  isExecuted,
  gateIndex,
}: {
  gateKey: GatePaletteKey;
  isActive: boolean;
  isExecuted: boolean;
  gateIndex: number;
}) {
  const p = GATE_PALETTE[gateKey];
  return (
    <m.div
      className="relative flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-base font-bold select-none z-10"
      style={{
        background: isActive ? p.bg : isExecuted ? 'rgba(25,22,50,0.7)' : `${p.bg}28`,
        border: `2px solid ${isActive ? p.border : isExecuted ? '#2a2a40' : `${p.border}66`}`,
        color: isActive ? p.text : isExecuted ? '#445' : p.text,
        boxShadow: isActive ? `0 0 18px ${p.glow}, 0 4px 12px rgba(0,0,0,0.5)` : 'none',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: isExecuted ? 0.45 : 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 22,
        delay: gateIndex * 0.055,
      }}
    >
      {p.label}
      {isActive && (
        <m.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 40% 28%, rgba(255,255,255,0.22), transparent 65%)',
          }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      )}
    </m.div>
  );
}

function WireSegment({ executed, active }: { executed: boolean; active: boolean }) {
  return (
    <div
      className="h-0.5 flex-1 min-w-2 transition-all duration-300"
      style={{
        background: active ? '#6d5ae0' : executed ? '#1e1e30' : '#242238',
        boxShadow: active ? '0 0 6px rgba(109,90,224,0.65)' : 'none',
      }}
    />
  );
}

function AmplitudeBar({
  basis,
  amplitude,
  index,
}: {
  basis: string;
  amplitude: Amplitude;
  index: number;
}) {
  const prob = Complex.probability(amplitude);
  const mag = Complex.magnitude(amplitude);

  return (
    <m.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.016 }}
      className="flex items-center gap-3"
    >
      {/* Basis label */}
      <div
        className="w-16 font-mono text-sm font-semibold shrink-0"
        style={{ color: `hsl(264,${40 + prob * 40}%,${55 + prob * 20}%)` }}
      >
        |{basis}&#x27E9;
      </div>

      {/* Bar */}
      <div className="flex-1 min-w-0">
        <div
          className="relative h-8 rounded-lg overflow-hidden"
          style={{
            background: 'rgba(18,16,40,0.7)',
            border: `1px solid hsl(264,${30 + prob * 25}%,${30 + prob * 20}%,0.35)`,
          }}
        >
          <m.div
            className="absolute inset-y-0 left-0 rounded-lg"
            style={{
              background: `linear-gradient(90deg,
                hsl(264,${45 + prob * 30}%,${35 + prob * 20}%,0.7),
                hsl(264,${55 + prob * 25}%,${43 + prob * 22}%))`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${prob * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-3">
            <span
              className="text-xs font-mono font-semibold"
              style={{ color: prob > 0.35 ? '#fff' : `hsl(264,40%,65%)` }}
            >
              {mag.toFixed(3)}
            </span>
            <span
              className="text-xs font-mono"
              style={{ color: prob > 0.35 ? 'rgba(255,255,255,0.7)' : '#4a4870' }}
            >
              p={prob.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      {/* Complex badge */}
      {Math.abs(amplitude.imag) > 1e-6 && (
        <Badge variant="outline" className="text-xs shrink-0">
          {amplitude.real.toFixed(2)}
          {amplitude.imag >= 0 ? '+' : ''}
          {amplitude.imag.toFixed(2)}i
        </Badge>
      )}
    </m.div>
  );
}

// ---------- Main component ----------

export function QuantumSimulator({
  initialQubits = 3,
  showExplanations = true,
  animationSpeed = 'normal',
  onMeasurement,
  className,
}: QuantumSimulatorProps) {
  const [numQubits, setNumQubits] = useState<number>(initialQubits);
  const [quantumState, setQuantumState] = useState<QuantumState>(() =>
    initializeQuantumState(initialQubits),
  );
  const [circuit, setCircuit] = useState<ReadonlyArray<QuantumGate>>([]);
  const [currentGateIndex, setCurrentGateIdx] = useState<number>(-1);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [measurementResult, setMeasureResult] = useState<{
    result: string;
    probabilities: Record<string, number>;
  } | null>(null);

  const [shorNumber, setShorNumber] = useState<number>(15);
  const [shorResult, setShorResult] = useState<ShorResult | null>(null);
  const [shorExecuting, setShorExecuting] = useState<boolean>(false);
  const [shorCurrentStep, setShorCurrentStep] = useState<number>(-1);

  useEffect(() => {
    setQuantumState(initializeQuantumState(numQubits));
    setCircuit([]);
    setCurrentGateIdx(-1);
    setMeasureResult(null);
  }, [numQubits]);

  const addGate = useCallback((gate: QuantumGate) => {
    setCircuit((prev) => [...prev, gate]);
    setMeasureResult(null);
  }, []);

  const removeGate = useCallback((index: number) => {
    setCircuit((prev) => prev.filter((_, i) => i !== index));
    setMeasureResult(null);
  }, []);

  const executeCircuit = useCallback(() => {
    if (isExecuting) {
      setIsExecuting(false);
      return;
    }
    setIsExecuting(true);
    setCurrentGateIdx(-1);
    setQuantumState(initializeQuantumState(numQubits));

    let idx = -1;
    const interval = setInterval(() => {
      idx++;
      if (idx >= circuit.length) {
        setIsExecuting(false);
        clearInterval(interval);
        return;
      }
      const gate = circuit[idx];
      if (!gate) return;
      setQuantumState((prev) => applyGate(prev, gate));
      setCurrentGateIdx(idx);
    }, ANIMATION_DURATIONS[animationSpeed]);
  }, [isExecuting, circuit, numQubits, animationSpeed]);

  const measure = useCallback(() => {
    const result = measureState(quantumState);
    setMeasureResult(result);
    onMeasurement?.(result.result, result.probabilities);
  }, [quantumState, onMeasurement]);

  const loadPreset = useCallback((name: string) => {
    const preset = PRESET_CIRCUITS[name];
    if (!preset) return;
    setNumQubits(preset.numQubits);
    setCircuit([...preset.gates]);
    setCurrentGateIdx(-1);
    setMeasureResult(null);
  }, []);

  const reset = useCallback(() => {
    setQuantumState(initializeQuantumState(numQubits));
    setCircuit([]);
    setCurrentGateIdx(-1);
    setMeasureResult(null);
    setIsExecuting(false);
  }, [numQubits]);

  const getGateName = useCallback((gate: QuantumGate): string => {
    switch (gate.type) {
      case 'H':
        return `H(q${gate.qubit})`;
      case 'X':
        return `X(q${gate.qubit})`;
      case 'CNOT':
        return `CNOT(q${gate.control}\u2192q${gate.target})`;
      default:
        return 'Unknown';
    }
  }, []);

  const executeShorAlgorithm = useCallback(() => {
    setShorExecuting(true);
    setShorCurrentStep(-1);
    setShorResult(null);
    setTimeout(() => {
      const result = shorAlgorithm(shorNumber, 10);
      setShorResult(result);
      if (result.steps.length > 0) {
        let si = 0;
        const iv = setInterval(() => {
          setShorCurrentStep(si++);
          if (si >= result.steps.length) {
            clearInterval(iv);
            setShorExecuting(false);
          }
        }, ANIMATION_DURATIONS[animationSpeed]);
      } else {
        setShorExecuting(false);
      }
    }, 100);
  }, [shorNumber, animationSpeed]);

  const resetShorDemo = useCallback(() => {
    setShorResult(null);
    setShorCurrentStep(-1);
    setShorExecuting(false);
  }, []);

  const statistics = useMemo(() => {
    const probs = quantumState.amplitudes.map((a) => Complex.probability(a));
    const entropy = -probs.reduce((s, p) => (p > 0 ? s + p * Math.log2(p) : s), 0);
    return {
      entropy,
      maxProbability: Math.max(...probs),
      numNonZero: probs.filter((p) => p > 1e-10).length,
    };
  }, [quantumState]);

  /* Gate column width for CNOT connector estimation */
  const GW = 48;

  return (
    <div className={cn('w-full max-w-7xl mx-auto space-y-6', className)}>
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold flex items-center gap-2">
                <Cpu className="h-8 w-8 text-primary" />
                Quantum Circuit Simulator
              </CardTitle>
              <CardDescription>
                Visualize quantum states and circuit execution in real-time
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">
                {numQubits} Qubit{numQubits !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="outline">
                {circuit.length} Gate{circuit.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== Visualization panel ===== */}
        <div className="lg:col-span-2 space-y-6">
          {/* State vector */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(22,18,50,0.45), rgba(18,16,40,0.45))',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(90,70,180,0.25)',
            }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                State Vector
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72 pr-2">
                <div className="space-y-1.5">
                  {quantumState.basis.map((basis, i) => (
                    <AmplitudeBar
                      key={basis}
                      basis={basis}
                      amplitude={quantumState.amplitudes[i]!}
                      index={i}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Stat chips */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: 'Entropy', value: statistics.entropy.toFixed(3), hue: 264 },
                  { label: 'Max Prob', value: statistics.maxProbability.toFixed(3), hue: 155 },
                  {
                    label: 'Non-zero',
                    value: `${statistics.numNonZero}/${quantumState.basis.length}`,
                    hue: 300,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg p-3 space-y-1"
                    style={{
                      background: `hsl(${s.hue},40%,12%,0.5)`,
                      border: `1px solid hsl(${s.hue},50%,30%,0.4)`,
                    }}
                  >
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div
                      className="text-lg font-mono font-bold"
                      style={{ color: `hsl(${s.hue},65%,68%)` }}
                    >
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Circuit diagram */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(22,18,50,0.45), rgba(18,16,40,0.45))',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(90,70,180,0.25)',
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Circuit Diagram</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={executeCircuit}
                    disabled={circuit.length === 0}
                    aria-label={isExecuting ? 'Stop' : 'Run circuit'}
                  >
                    {isExecuting ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={measure}
                    aria-label="Measure quantum state"
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    Measure
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {circuit.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-14 rounded-xl"
                  style={{
                    background: 'rgba(18,16,42,0.5)',
                    border: '2px dashed rgba(80,60,160,0.4)',
                  }}
                >
                  <Activity className="h-12 w-12 mb-3 opacity-30 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    No gates in circuit. Add gates from the control panel.
                  </p>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  {/* Qubit rows */}
                  <div className="relative min-w-max" style={{ padding: '8px 16px 8px 4px' }}>
                    {Array.from({ length: numQubits }, (_, qi) => (
                      <div
                        key={qi}
                        className="flex items-center"
                        style={{ height: 60, marginBottom: qi < numQubits - 1 ? 4 : 0 }}
                      >
                        {/* Qubit label */}
                        <div className="shrink-0 w-16 flex flex-col items-end pr-3">
                          <span className="text-xs font-mono" style={{ color: '#6d5ae0' }}>
                            |0&#x27E9;
                          </span>
                          <span className="text-xs text-muted-foreground">q{qi}</span>
                        </div>

                        {/* Wire + gate row */}
                        <div className="flex items-center flex-1">
                          <WireSegment executed={false} active={false} />

                          {circuit.map((gate, gi) => {
                            const isActive = currentGateIndex === gi;
                            const isExecuted = currentGateIndex > gi;

                            let gk: GatePaletteKey | null = null;
                            if (gate.type === 'H' && gate.qubit === qi) gk = 'H';
                            else if (gate.type === 'X' && gate.qubit === qi) gk = 'X';
                            else if (gate.type === 'CNOT' && gate.control === qi) gk = 'CONTROL';
                            else if (gate.type === 'CNOT' && gate.target === qi) gk = 'TARGET';

                            return (
                              <div key={gi} className="flex items-center">
                                {gk ? (
                                  <GateBox
                                    gateKey={gk}
                                    isActive={isActive}
                                    isExecuted={isExecuted}
                                    gateIndex={gi}
                                  />
                                ) : (
                                  /* Wire pass-through */
                                  <div
                                    style={{
                                      width: GW,
                                      height: 2,
                                      background: isActive
                                        ? '#6d5ae0'
                                        : isExecuted
                                          ? '#1e1e30'
                                          : '#242238',
                                      transition: 'background 0.3s',
                                    }}
                                  />
                                )}
                                <WireSegment executed={isExecuted} active={isActive} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* CNOT vertical connectors */}
                    {circuit.map((gate, gi) => {
                      if (gate.type !== 'CNOT') return null;
                      const isActive = currentGateIndex === gi;
                      const isExecuted = currentGateIndex > gi;

                      // Estimate x position: label(64) + leadingWire(8) + gi*(gate+wire)
                      const xPos = 64 + 8 + gi * (GW + 8) + GW / 2;
                      const rowH = 64; // row height + margin
                      const cy = gate.control * rowH + rowH / 2;
                      const ty = gate.target * rowH + rowH / 2;
                      const minY = Math.min(cy, ty);
                      const height = Math.abs(cy - ty);

                      return (
                        <div
                          key={`cnot-v-${gi}`}
                          style={{
                            position: 'absolute',
                            left: xPos,
                            top: minY,
                            width: 2,
                            height,
                            background: isActive
                              ? '#3dc98a'
                              : isExecuted
                                ? '#1e1e30'
                                : 'rgba(80,60,160,0.4)',
                            boxShadow: isActive ? '0 0 8px rgba(61,201,138,0.65)' : 'none',
                            transition: 'background 0.3s',
                            zIndex: 0,
                          }}
                        />
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {/* Gate legend */}
              {circuit.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/20 flex flex-wrap gap-3">
                  {Object.entries(GATE_PALETTE).map(([k, p]) => (
                    <div
                      key={k}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                        style={{ background: p.bg, color: p.text }}
                      >
                        {p.label}
                      </div>
                      <span>{p.desc}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Measurement result */}
              <AnimatePresence>
                {measurementResult && (
                  <m.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4"
                  >
                    <Alert
                      style={{
                        background: 'rgba(45,158,110,0.12)',
                        border: '1px solid rgba(61,201,138,0.4)',
                      }}
                    >
                      <Zap className="h-4 w-4" style={{ color: '#3dc98a' }} />
                      <div className="ml-2">
                        <strong>Measurement Result:</strong>{' '}
                        <span className="font-mono text-base" style={{ color: '#3dc98a' }}>
                          |{measurementResult.result}&#x27E9;
                        </span>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Probability:{' '}
                          <strong>
                            {(
                              (measurementResult.probabilities[measurementResult.result] ?? 0) * 100
                            ).toFixed(2)}
                            %
                          </strong>
                        </div>
                      </div>
                    </Alert>
                  </m.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* ===== Control panel ===== */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="num-qubits">Number of Qubits</Label>
                  <span className="text-sm font-mono text-muted-foreground">{numQubits}</span>
                </div>
                <Slider
                  id="num-qubits"
                  min={1}
                  max={5}
                  step={1}
                  value={[numQubits]}
                  onValueChange={([v]) => setNumQubits(v ?? 3)}
                  disabled={isExecuting || circuit.length > 0}
                />
                <p className="text-xs text-muted-foreground">
                  States: 2^{numQubits} = {2 ** numQubits}
                </p>
              </div>
              <Separator />
              <Button variant="outline" className="w-full" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Circuit
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Gates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hadamard (H)</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: numQubits }, (_, i) => (
                    <Button
                      key={`h-${i}`}
                      variant="outline"
                      size="sm"
                      onClick={() => addGate({ type: 'H', qubit: i })}
                      disabled={isExecuting}
                      style={{ borderColor: 'rgba(109,90,224,0.5)', color: '#8b76e8' }}
                    >
                      {`H\u00b7q${i}`}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pauli-X (NOT)</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: numQubits }, (_, i) => (
                    <Button
                      key={`x-${i}`}
                      variant="outline"
                      size="sm"
                      onClick={() => addGate({ type: 'X', qubit: i })}
                      disabled={isExecuting}
                      style={{ borderColor: 'rgba(201,56,56,0.5)', color: '#e07070' }}
                    >
                      {`X\u00b7q${i}`}
                    </Button>
                  ))}
                </div>
              </div>
              {numQubits >= 2 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">CNOT Gates</Label>
                    <div className="space-y-1.5">
                      {Array.from({ length: numQubits - 1 }, (_, i) => (
                        <Button
                          key={`cnot-${i}`}
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => addGate({ type: 'CNOT', control: i, target: i + 1 })}
                          disabled={isExecuting}
                          style={{ borderColor: 'rgba(45,158,110,0.5)', color: '#4ec98e' }}
                        >
                          {`CNOT q${i}\u2192q${i + 1}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preset Circuits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(PRESET_CIRCUITS).map(([k, preset]) => (
                <Button
                  key={k}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => loadPreset(k)}
                  disabled={isExecuting}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{preset.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {preset.description}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 ml-2 shrink-0" />
                </Button>
              ))}
            </CardContent>
          </Card>

          {circuit.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Circuit Gates</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {circuit.map((gate, i) => {
                      const isActive = i === currentGateIndex;
                      const isExecuted = i < currentGateIndex;
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg text-sm"
                          style={{
                            background: isActive
                              ? 'rgba(76,56,201,0.22)'
                              : isExecuted
                                ? 'rgba(18,16,38,0.6)'
                                : 'rgba(16,14,36,0.45)',
                            border: isActive
                              ? '1px solid rgba(109,90,224,0.5)'
                              : '1px solid rgba(38,34,62,0.4)',
                          }}
                        >
                          <span
                            className="font-mono"
                            style={{
                              color: isActive ? '#8b76e8' : isExecuted ? '#2a2840' : '#6050b0',
                            }}
                          >
                            {i + 1}. {getGateName(gate)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeGate(i)}
                            disabled={isExecuting}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Educational tabs */}
      {showExplanations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Understanding Quantum Computing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="basics" suppressHydrationWarning>
              <TabsList
                className="grid w-full grid-cols-5 h-auto p-1 rounded-xl"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(10,8,28,0.55) 0%, rgba(18,14,42,0.55) 100%)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(90,70,180,0.25)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.06)',
                }}
              >
                <TabsTrigger
                  value="basics"
                  className="py-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Basics
                </TabsTrigger>
                <TabsTrigger
                  value="gates"
                  className="py-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Gates
                </TabsTrigger>
                <TabsTrigger
                  value="states"
                  className="py-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  States
                </TabsTrigger>
                <TabsTrigger
                  value="shor"
                  className="py-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Shor
                </TabsTrigger>
                <TabsTrigger
                  value="tips"
                  className="py-2 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground"
                >
                  Tips
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basics" className="space-y-3 text-sm">
                <p>
                  <strong>Quantum computing</strong> uses superposition and entanglement to perform
                  computations.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>
                    <strong>Qubit:</strong> Can be |0&#x27E9;, |1&#x27E9;, or a superposition
                  </li>
                  <li>
                    <strong>Superposition:</strong> Multiple states simultaneously
                  </li>
                  <li>
                    <strong>Entanglement:</strong> Non-classical qubit correlations
                  </li>
                  <li>
                    <strong>Measurement:</strong> Collapses to a classical outcome
                  </li>
                </ul>
              </TabsContent>

              <TabsContent value="gates" className="space-y-3 text-sm">
                <p>
                  <strong>Quantum gates</strong> are unitary operations on qubits:
                </p>
                <div className="space-y-2">
                  {Object.entries(GATE_PALETTE).map(([k, p]) => (
                    <div
                      key={k}
                      className="flex items-start gap-3 p-2 rounded-lg"
                      style={{
                        background: `${p.bg}18`,
                        border: `1px solid ${p.border}33`,
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-sm font-bold"
                        style={{ background: p.bg, color: p.text }}
                      >
                        {p.label}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {p.desc} ({k})
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {k === 'H' &&
                            'Creates superposition: |0\u27E9 \u2192 (|0\u27E9+|1\u27E9)/\u221A2'}
                          {k === 'X' && 'NOT gate: flips |0\u27E9 \u2194 |1\u27E9'}
                          {k === 'CONTROL' && 'Activates CNOT when in state |1\u27E9'}
                          {k === 'TARGET' && 'Flips when control qubit is |1\u27E9'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="states" className="space-y-3 text-sm">
                <p>
                  The <strong>state vector</strong> is a superposition of basis states:
                </p>
                <div className="bg-muted p-4 rounded-lg font-mono text-xs">
                  |&#x3C8;&#x27E9; = &#x3B1;&#x2080;|00&#x27E9; + &#x3B1;&#x2081;|01&#x27E9; +
                  &#x3B1;&#x2082;|10&#x27E9; + &#x3B1;&#x2083;|11&#x27E9;
                </div>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Each &#x3B1;&#x1D62; is a complex amplitude</li>
                  <li>P(|i&#x27E9;) = |&#x3B1;&#x1D62;|&#xB2;</li>
                  <li>&#x3A3;|&#x3B1;&#x1D62;|&#xB2; = 1 (normalization)</li>
                  <li>Entropy measures spread of the state</li>
                </ul>
              </TabsContent>

              <TabsContent value="shor" className="space-y-4">
                <div className="space-y-3 text-sm">
                  <p>
                    <strong>Shor's Algorithm</strong> (1994) factors integers exponentially faster
                    using the Quantum Fourier Transform.
                  </p>
                  <div className="bg-muted p-4 rounded-lg font-mono text-xs space-y-1">
                    <div>Classical (GNFS): ~O(exp(n^(1/3)))</div>
                    <div>Quantum (Shor): O(n&#xB3;)</div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="font-semibold text-sm">Try Shor's Algorithm:</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="shor-number">Number to Factor</Label>
                      <span className="text-sm font-mono text-muted-foreground">
                        N = {shorNumber}
                      </span>
                    </div>
                    <Slider
                      id="shor-number"
                      min={9}
                      max={99}
                      step={2}
                      value={[shorNumber]}
                      onValueChange={([v]) => {
                        setShorNumber(v ?? 15);
                        resetShorDemo();
                      }}
                      disabled={shorExecuting}
                    />
                    <p className="text-xs text-muted-foreground">
                      Choose an odd composite number (9-99)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={executeShorAlgorithm}
                      disabled={shorExecuting}
                      className="flex-1"
                    >
                      {shorExecuting ? (
                        <>
                          <Activity className="h-4 w-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Run Shor's Algorithm
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={resetShorDemo} disabled={shorExecuting}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                  {shorResult && (
                    <m.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <Alert
                        style={{
                          background: shorResult.success
                            ? 'rgba(45,158,110,0.12)'
                            : 'rgba(180,140,30,0.12)',
                          border: `1px solid ${shorResult.success ? 'rgba(61,201,138,0.45)' : 'rgba(200,160,40,0.45)'}`,
                        }}
                      >
                        <div className="space-y-1.5">
                          <div className="font-semibold">
                            {shorResult.success
                              ? 'Factorization Successful!'
                              : 'Factorization Incomplete'}
                          </div>
                          {shorResult.success && shorResult.factors.length === 2 && (
                            <div className="font-mono text-lg" style={{ color: '#3dc98a' }}>
                              {shorNumber} = {shorResult.factors[0]} &times; {shorResult.factors[1]}
                            </div>
                          )}
                        </div>
                      </Alert>
                      <Card className="bg-muted/50">
                        <CardHeader>
                          <CardTitle className="text-sm">Algorithm Steps</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-64">
                            <div className="space-y-2 pr-4">
                              {shorResult.steps.map((step, i) => (
                                <m.div
                                  key={i}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: i <= shorCurrentStep ? 1 : 0.4, x: 0 }}
                                  transition={{ delay: i * 0.05 }}
                                  className={cn(
                                    'p-2 rounded text-xs font-mono',
                                    i === shorCurrentStep && 'bg-primary/20 border border-primary',
                                    i < shorCurrentStep && 'bg-muted',
                                    i > shorCurrentStep && 'opacity-50',
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    <Badge
                                      variant={i <= shorCurrentStep ? 'default' : 'outline'}
                                      className="text-xs shrink-0"
                                    >
                                      {i + 1}
                                    </Badge>
                                    <div className="flex-1 whitespace-pre-wrap break-words">
                                      {step}
                                    </div>
                                  </div>
                                </m.div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </m.div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tips" className="space-y-3 text-sm">
                <p>
                  <strong>Try these experiments:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Load the Bell State preset to see quantum entanglement</li>
                  <li>Apply H gate to all qubits for equal superposition</li>
                  <li>Measure multiple times to see probabilistic outcomes</li>
                  <li>Watch entropy increase as you add Hadamard gates</li>
                  <li>Build custom circuits by chaining gates</li>
                </ul>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
