'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Users, Target, TrendingUp, ChevronRight } from 'lucide-react';
import { NormalFormGame } from '@nextcalc/math-engine/game-theory/game-theory';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameResult {
  nashEquilibria: Array<{ player1: number; player2: number }>;
  dominatedStrategies: {
    player1: number[];
    player2: number[];
  };
}

type PresetKey2x2 =
  | 'prisoners-dilemma'
  | 'battle-of-sexes'
  | 'chicken-game'
  | 'stag-hunt'
  | 'matching-pennies'
  | 'hawk-dove'
  | 'coordination'
  | 'deadlock'
  | 'hero-game'
  | 'assurance-game';

type PresetKey3x3 =
  | 'rock-paper-scissors'
  | 'extended-matching-pennies'
  | 'three-player-coordination'
  | 'voting-game'
  | 'market-entry'
  | 'traffic-light'
  | 'resource-allocation'
  | 'auction'
  | 'signaling'
  | 'election';

type PresetKey = PresetKey2x2 | PresetKey3x3;

interface Preset {
  key: PresetKey;
  label: string;
  description: string;
  matrix: number[][][];
  size: 2 | 3;
}

// ─── Preset Definitions ───────────────────────────────────────────────────────

const PRESETS_2x2: Preset[] = [
  {
    key: 'prisoners-dilemma',
    label: "Prisoner's Dilemma",
    description: 'Each player tempted to defect despite mutual cooperation being optimal',
    matrix: [
      [[3, 3], [0, 5]],
      [[5, 0], [1, 1]],
    ],
    size: 2,
  },
  {
    key: 'battle-of-sexes',
    label: 'Battle of the Sexes',
    description: 'Two players prefer to coordinate but disagree on which equilibrium',
    matrix: [
      [[2, 1], [0, 0]],
      [[0, 0], [1, 2]],
    ],
    size: 2,
  },
  {
    key: 'chicken-game',
    label: 'Chicken Game',
    description: 'Anti-coordination game where yielding is rational to avoid mutual disaster',
    matrix: [
      [[0, 0], [3, 1]],
      [[1, 3], [2, 2]],
    ],
    size: 2,
  },
  {
    key: 'stag-hunt',
    label: 'Stag Hunt',
    description: 'Coordination game with a payoff-dominant and a risk-dominant equilibrium',
    matrix: [
      [[4, 4], [0, 3]],
      [[3, 0], [3, 3]],
    ],
    size: 2,
  },
  {
    key: 'matching-pennies',
    label: 'Matching Pennies',
    description: 'Pure zero-sum game with no pure strategy Nash equilibrium',
    matrix: [
      [[1, -1], [-1, 1]],
      [[-1, 1], [1, -1]],
    ],
    size: 2,
  },
  {
    key: 'hawk-dove',
    label: 'Hawk-Dove',
    description: 'Evolutionary game modeling aggressive vs. passive conflict strategies',
    matrix: [
      [[-1, -1], [4, 0]],
      [[0, 4], [2, 2]],
    ],
    size: 2,
  },
  {
    key: 'coordination',
    label: 'Pure Coordination',
    description: 'Players benefit only when they choose the same strategy',
    matrix: [
      [[2, 2], [0, 0]],
      [[0, 0], [2, 2]],
    ],
    size: 2,
  },
  {
    key: 'deadlock',
    label: 'Deadlock',
    description: 'Mutual defection is the dominant equilibrium for both players',
    matrix: [
      [[1, 1], [3, 0]],
      [[0, 3], [2, 2]],
    ],
    size: 2,
  },
  {
    key: 'hero-game',
    label: 'Hero Game',
    description: 'One player must volunteer to sacrifice while the other free-rides',
    matrix: [
      [[3, 3], [1, 4]],
      [[4, 1], [0, 0]],
    ],
    size: 2,
  },
  {
    key: 'assurance-game',
    label: 'Assurance Game',
    description: 'Cooperation is payoff-dominant but only rational if the other cooperates',
    matrix: [
      [[4, 4], [1, 2]],
      [[2, 1], [3, 3]],
    ],
    size: 2,
  },
];

const PRESETS_3x3: Preset[] = [
  {
    key: 'rock-paper-scissors',
    label: 'Rock-Paper-Scissors',
    description: 'Classic zero-sum cyclic game with no pure strategy equilibrium',
    matrix: [
      [[0, 0], [-1, 1], [1, -1]],
      [[1, -1], [0, 0], [-1, 1]],
      [[-1, 1], [1, -1], [0, 0]],
    ],
    size: 3,
  },
  {
    key: 'extended-matching-pennies',
    label: 'Extended Matching Pennies',
    description: 'Three-strategy zero-sum game generalising matching pennies',
    matrix: [
      [[0, 0], [1, -1], [-1, 1]],
      [[-1, 1], [0, 0], [1, -1]],
      [[1, -1], [-1, 1], [0, 0]],
    ],
    size: 3,
  },
  {
    key: 'three-player-coordination',
    label: 'Three-Strategy Coordination',
    description: 'Players choose among three technologies; alignment maximises payoffs',
    matrix: [
      [[4, 4], [0, 0], [0, 0]],
      [[0, 0], [3, 3], [0, 0]],
      [[0, 0], [0, 0], [2, 2]],
    ],
    size: 3,
  },
  {
    key: 'voting-game',
    label: 'Voting Game',
    description: 'Three candidates; voters balance sincerity against strategic voting',
    matrix: [
      [[3, 3], [1, 2], [0, 1]],
      [[2, 1], [3, 3], [1, 2]],
      [[1, 0], [2, 1], [3, 3]],
    ],
    size: 3,
  },
  {
    key: 'market-entry',
    label: 'Market Entry',
    description: 'Firms decide whether to enter a market at high, medium, or low scale',
    matrix: [
      [[-2, -2], [2, 1], [3, 0]],
      [[1, 2], [1, 1], [2, 0]],
      [[0, 3], [0, 2], [2, 2]],
    ],
    size: 3,
  },
  {
    key: 'traffic-light',
    label: 'Traffic Light',
    description: 'Drivers choose speed; coordination at intersections avoids collisions',
    matrix: [
      [[2, 2], [0, 3], [0, 1]],
      [[3, 0], [-1, -1], [1, 0]],
      [[1, 0], [0, 1], [1, 1]],
    ],
    size: 3,
  },
  {
    key: 'resource-allocation',
    label: 'Resource Allocation',
    description: 'Players allocate effort across three projects with spillover effects',
    matrix: [
      [[3, 2], [1, 3], [0, 1]],
      [[2, 1], [3, 3], [1, 2]],
      [[1, 0], [2, 1], [2, 2]],
    ],
    size: 3,
  },
  {
    key: 'auction',
    label: 'First-Price Auction',
    description: 'Bidders choose low, medium, or high bids; winner pays their bid',
    matrix: [
      [[2, 0], [0, 3], [0, 2]],
      [[3, 0], [1, 1], [0, 2]],
      [[2, 0], [2, 0], [0, 0]],
    ],
    size: 3,
  },
  {
    key: 'signaling',
    label: 'Signaling Game',
    description: 'Informed sender signals type; receiver chooses to trust or ignore',
    matrix: [
      [[3, 3], [1, 1], [0, 2]],
      [[2, 1], [2, 2], [1, 1]],
      [[1, 0], [1, 1], [3, 3]],
    ],
    size: 3,
  },
  {
    key: 'election',
    label: 'Election Game',
    description: 'Three parties choose policy positions; voters reward centrist convergence',
    matrix: [
      [[2, 1], [1, 2], [0, 1]],
      [[2, 0], [2, 2], [2, 0]],
      [[1, 0], [2, 1], [1, 2]],
    ],
    size: 3,
  },
];

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const cardHover = {
  rest: { scale: 1 },
  hover: { scale: 1.01, transition: { type: 'spring' as const, stiffness: 400, damping: 25 } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface PresetButtonProps {
  preset: Preset;
  isActive: boolean;
  onClick: () => void;
}

function PresetButton({ preset, isActive, onClick }: PresetButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      aria-pressed={isActive}
      className={[
        'w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'group flex items-start gap-2',
        isActive
          ? 'bg-primary/15 border-primary/50 text-foreground'
          : 'bg-background/40 border-border/60 text-foreground/80 hover:bg-primary/8 hover:border-primary/30 hover:text-foreground',
      ].join(' ')}
    >
      <ChevronRight
        className={[
          'w-3.5 h-3.5 mt-0.5 shrink-0 transition-transform duration-200',
          isActive ? 'text-primary rotate-90' : 'text-muted-foreground group-hover:text-primary',
        ].join(' ')}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight">{preset.label}</span>
        <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
          {preset.description}
        </span>
      </span>
    </motion.button>
  );
}

interface MatrixCellProps {
  row: number;
  col: number;
  payoffs: [number, number];
  isNashEquilibrium: boolean;
  onUpdate: (row: number, col: number, player: 0 | 1, value: string) => void;
}

function MatrixCell({ row, col, payoffs, isNashEquilibrium, onUpdate }: MatrixCellProps) {
  return (
    <motion.div
      layout
      className={[
        'relative rounded-lg border p-2.5 transition-all duration-200',
        isNashEquilibrium
          ? 'bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/50 shadow-[0_0_12px_0_oklch(0.65_0.22_264_/_0.25)]'
          : 'bg-gradient-to-br from-background/80 to-card/60 border-border/70 hover:border-border',
      ].join(' ')}
      aria-label={`Cell row ${row + 1} column ${col + 1}${isNashEquilibrium ? ', Nash equilibrium' : ''}`}
    >
      {isNashEquilibrium && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full border-2 border-background shadow-sm"
          aria-hidden="true"
        />
      )}
      <div className="flex gap-1 items-center">
        <span className="text-[10px] font-medium text-primary/80 w-4 shrink-0">P1</span>
        <Input
          type="number"
          value={payoffs[0]}
          onChange={(e) => onUpdate(row, col, 0, e.target.value)}
          className="h-6 text-xs px-1.5 bg-background/60 border-border/50 focus-visible:border-primary/60"
          aria-label={`Player 1 payoff, row ${row + 1} column ${col + 1}`}
        />
      </div>
      <div className="flex gap-1 items-center mt-1">
        <span className="text-[10px] font-medium text-[oklch(0.63_0.20_300)]/80 w-4 shrink-0">P2</span>
        <Input
          type="number"
          value={payoffs[1]}
          onChange={(e) => onUpdate(row, col, 1, e.target.value)}
          className="h-6 text-xs px-1.5 bg-background/60 border-border/50 focus-visible:border-[oklch(0.63_0.20_300)]/60"
          aria-label={`Player 2 payoff, row ${row + 1} column ${col + 1}`}
        />
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GameTheoryPage() {
  const [gridSize, setGridSize] = useState<2 | 3>(2);
  const [payoffMatrix, setPayoffMatrix] = useState<number[][][]>([
    [[3, 3], [0, 5]],
    [[5, 0], [1, 1]],
  ]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey>('prisoners-dilemma');

  const activePresets = gridSize === 2 ? PRESETS_2x2 : PRESETS_3x3;

  const analyzeGame = () => {
    try {
      const player1Payoffs = payoffMatrix.map(row => row.map(cell => cell[0] ?? 0));
      const player2Payoffs = payoffMatrix.map(row => row.map(cell => cell[1] ?? 0));

      const game = new NormalFormGame(player1Payoffs, player2Payoffs);
      const nashEq = game.findPureNashEquilibria();

      const transformedNashEq = nashEq.map(eq => ({
        player1: typeof eq.strategies[0] === 'number' ? eq.strategies[0] : 0,
        player2: typeof eq.strategies[1] === 'number' ? eq.strategies[1] : 0,
      }));

      setResult({
        nashEquilibria: transformedNashEq,
        dominatedStrategies: { player1: [], player2: [] },
      });
    } catch (error) {
      console.error('Game theory analysis error:', error);
    }
  };

  const loadPreset = (preset: Preset) => {
    setActivePreset(preset.key);
    setGridSize(preset.size);
    setPayoffMatrix(preset.matrix);
    setResult(null);
  };

  const updatePayoff = (row: number, col: number, player: 0 | 1, value: string) => {
    const newMatrix = payoffMatrix.map(r => r.map(c => [...c] as [number, number]));
    const numValue = parseFloat(value) || 0;
    const cell = newMatrix[row]?.[col];
    if (cell) {
      cell[player] = numValue;
    }
    setPayoffMatrix(newMatrix);
    setResult(null);
  };

  const changeGridSize = (newSize: 2 | 3) => {
    setGridSize(newSize);
    setActivePreset(newSize === 2 ? 'prisoners-dilemma' : 'rock-paper-scissors');
    const defaultPreset = newSize === 2 ? PRESETS_2x2[0] : PRESETS_3x3[0];
    if (defaultPreset) {
      setPayoffMatrix(defaultPreset.matrix);
    } else {
      const newMatrix: number[][][] = Array.from({ length: newSize }, () =>
        Array.from({ length: newSize }, () => [0, 0])
      );
      setPayoffMatrix(newMatrix);
    }
    setResult(null);
  };

  const isNashEquilibrium = (row: number, col: number): boolean => {
    if (!result) return false;
    return result.nashEquilibria.some(eq => eq.player1 === row && eq.player2 === col);
  };

  const rowLabels2x2 = ['Cooperate', 'Defect'];
  const colLabels2x2 = ['Cooperate', 'Defect'];
  const rowLabels3x3 = ['Strategy A', 'Strategy B', 'Strategy C'];
  const colLabels3x3 = ['Strategy A', 'Strategy B', 'Strategy C'];
  const rowLabels = gridSize === 2 ? rowLabels2x2 : rowLabels3x3;
  const colLabels = gridSize === 2 ? colLabels2x2 : colLabels3x3;

  // Find active preset object for dynamic label display
  const activePresetObj =
    (gridSize === 2 ? PRESETS_2x2 : PRESETS_3x3).find(p => p.key === activePreset) ?? null;
  const useCustomRowLabels =
    activePreset === 'rock-paper-scissors'
      ? ['Rock', 'Paper', 'Scissors']
      : activePreset === 'hawk-dove' || activePreset === 'chicken-game'
        ? ['Hawk / Swerve', 'Dove / Straight']
        : rowLabels;
  const useCustomColLabels =
    activePreset === 'rock-paper-scissors'
      ? ['Rock', 'Paper', 'Scissors']
      : activePreset === 'hawk-dove' || activePreset === 'chicken-game'
        ? ['Hawk / Swerve', 'Dove / Straight']
        : colLabels;

  return (
    <main className="min-h-screen py-12 px-4 bg-gradient-to-br from-background via-background/95 to-background">
      {/* Background texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
        aria-hidden="true"
      />

      <div className="container mx-auto max-w-6xl relative">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.header
          className="mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-[oklch(0.63_0.20_300)]/20 border border-primary/30 shadow-[0_0_20px_0_oklch(0.55_0.27_264_/_0.2)]">
              <Brain className="w-8 h-8 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-[oklch(0.65_0.22_200)] to-[oklch(0.63_0.20_300)] bg-clip-text text-transparent leading-tight">
                Game Theory
              </h1>
              <p className="text-base text-muted-foreground mt-0.5">
                Analyze strategic interactions and find Nash equilibria
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="border-primary/40 text-primary bg-primary/8 text-xs"
            >
              <Target className="w-3 h-3 mr-1.5" aria-hidden="true" />
              Nash Equilibrium
            </Badge>
            <Badge
              variant="outline"
              className="border-[oklch(0.65_0.20_155)]/40 text-[oklch(0.65_0.20_155)] bg-[oklch(0.65_0.20_155)]/8 text-xs"
            >
              <TrendingUp className="w-3 h-3 mr-1.5" aria-hidden="true" />
              Dominated Strategies
            </Badge>
            <Badge
              variant="outline"
              className="border-[oklch(0.63_0.20_300)]/40 text-[oklch(0.63_0.20_300)] bg-[oklch(0.63_0.20_300)]/8 text-xs"
            >
              <Users className="w-3 h-3 mr-1.5" aria-hidden="true" />
              2-Player Normal Form
            </Badge>
          </div>
        </motion.header>

        {/* ── Main Grid ──────────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">

          {/* ── Control Panel ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] h-full">
              <CardHeader className="pb-4">
                <CardTitle className="text-foreground text-lg">Game Setup</CardTitle>
                <CardDescription>Select a preset or configure your own matrix</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Matrix size tabs */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Matrix Size
                  </Label>
                  <Tabs
                    value={gridSize.toString()}
                    onValueChange={(v) => changeGridSize(Number(v) as 2 | 3)}
                  >
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50 border border-border">
                      <TabsTrigger value="2" className="text-sm">2×2 Game</TabsTrigger>
                      <TabsTrigger value="3" className="text-sm">3×3 Game</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Preset list */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Classic Games
                  </Label>
                  <motion.div
                    key={gridSize}
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                    className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5 scrollbar-thin"
                  >
                    <AnimatePresence mode="wait">
                      {activePresets.map((preset) => (
                        <motion.div key={preset.key} variants={fadeInUp}>
                          <PresetButton
                            preset={preset}
                            isActive={activePreset === preset.key}
                            onClick={() => loadPreset(preset)}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </div>

                {/* Analyze button */}
                <Button
                  onClick={analyzeGame}
                  className="w-full bg-gradient-to-r from-primary to-[oklch(0.63_0.20_300)] hover:from-primary/90 hover:to-[oklch(0.63_0.20_300)]/90 text-primary-foreground shadow-[0_4px_16px_0_oklch(0.55_0.27_264_/_0.35)] hover:shadow-[0_6px_20px_0_oklch(0.55_0.27_264_/_0.45)] transition-all duration-200"
                  size="lg"
                >
                  <Target className="w-4 h-4 mr-2" aria-hidden="true" />
                  Find Nash Equilibrium
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Payoff Matrix ──────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.15 }}
          >
            <Card className="bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                      <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      Payoff Matrix
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Each cell shows{' '}
                      <span className="text-primary font-medium">Player 1</span>
                      {' / '}
                      <span className="text-[oklch(0.63_0.20_300)] font-medium">Player 2</span>
                      {' '}payoffs
                      {result && result.nashEquilibria.length > 0 && (
                        <span className="ml-2 text-primary">
                          — highlighted cells are Nash equilibria
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  {activePresetObj && (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-primary/30 text-primary bg-primary/8 text-xs"
                    >
                      {activePresetObj.label}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Legend */}
                <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/70 inline-block" aria-hidden="true" />
                    Player 1 (rows)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.63_0.20_300)]/70 inline-block" aria-hidden="true" />
                    Player 2 (columns)
                  </span>
                  {result && result.nashEquilibria.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block ring-2 ring-background" aria-hidden="true" />
                      Nash equilibrium
                    </span>
                  )}
                </div>

                {/* Matrix grid */}
                <div
                  className="overflow-auto"
                  role="table"
                  aria-label="Payoff matrix"
                >
                  <div
                    className="grid gap-2 min-w-0"
                    style={{
                      gridTemplateColumns: `minmax(80px,auto) repeat(${gridSize}, minmax(90px, 1fr))`,
                    }}
                    role="rowgroup"
                  >
                    {/* Column headers */}
                    <div role="row" className="contents">
                      <div className="pb-1" role="columnheader" />
                      {Array.from({ length: gridSize }, (_, i) => (
                        <div
                          key={i}
                          role="columnheader"
                          className="text-center pb-1"
                          aria-label={`Player 2 ${useCustomColLabels[i] ?? `Column ${i + 1}`}`}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.63_0.20_300)]/80 block">
                            P2
                          </span>
                          <span className="text-xs font-medium text-foreground/70">
                            {useCustomColLabels[i] ?? `Col ${i + 1}`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Matrix rows */}
                    {Array.from({ length: gridSize }, (_, row) => (
                      <div key={row} role="row" className="contents">
                        <div
                          role="rowheader"
                          className="flex flex-col justify-center pr-2"
                          aria-label={`Player 1 ${useCustomRowLabels[row] ?? `Row ${row + 1}`}`}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">
                            P1
                          </span>
                          <span className="text-xs font-medium text-foreground/70 leading-tight">
                            {useCustomRowLabels[row] ?? `Row ${row + 1}`}
                          </span>
                        </div>
                        {Array.from({ length: gridSize }, (_, col) => {
                          const payoffs = payoffMatrix[row]?.[col] ?? [0, 0];
                          return (
                            <MatrixCell
                              key={col}
                              row={row}
                              col={col}
                              payoffs={[payoffs[0] ?? 0, payoffs[1] ?? 0]}
                              isNashEquilibrium={isNashEquilibrium(row, col)}
                              onUpdate={updatePayoff}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── Results ────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="grid gap-6 lg:grid-cols-2 mt-6"
            >
              {/* Nash Equilibria */}
              <Card className="bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                    Nash Equilibria
                  </CardTitle>
                  <CardDescription>
                    Strategy profiles where no player can benefit by unilaterally deviating
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {result.nashEquilibria.length > 0 ? (
                    <motion.div
                      className="space-y-3"
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      {result.nashEquilibria.map((eq, index) => {
                        const p1Payoff = payoffMatrix[eq.player1]?.[eq.player2]?.[0] ?? 0;
                        const p2Payoff = payoffMatrix[eq.player1]?.[eq.player2]?.[1] ?? 0;
                        const rowLabel = useCustomRowLabels[eq.player1] ?? `Strategy ${eq.player1 + 1}`;
                        const colLabel = useCustomColLabels[eq.player2] ?? `Strategy ${eq.player2 + 1}`;
                        return (
                          <motion.div
                            key={index}
                            variants={fadeInUp}
                            className="p-4 rounded-xl bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border border-primary/30 shadow-[inset_0_1px_0_0_oklch(1_0_0_/_0.08)]"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-semibold text-foreground">
                                Equilibrium {index + 1}
                              </span>
                              <Badge
                                variant="outline"
                                className="border-primary/40 text-primary bg-primary/10 text-xs font-mono"
                              >
                                ({p1Payoff}, {p2Payoff})
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-2.5 rounded-lg bg-background/50 border border-border/60">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-1">
                                  Player 1
                                </div>
                                <div className="text-sm font-medium text-foreground">{rowLabel}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Payoff:{' '}
                                  <span className="font-mono text-primary">{p1Payoff}</span>
                                </div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-background/50 border border-border/60">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.63_0.20_300)]/70 mb-1">
                                  Player 2
                                </div>
                                <div className="text-sm font-medium text-foreground">{colLabel}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Payoff:{' '}
                                  <span className="font-mono text-[oklch(0.63_0.20_300)]">
                                    {p2Payoff}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-10 text-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-full bg-muted/60 border border-border flex items-center justify-center">
                        <Target className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          No pure strategy Nash equilibrium
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 max-w-xs">
                          This game may have a mixed strategy equilibrium not shown here
                        </div>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              {/* Dominated Strategies */}
              <Card className="bg-gradient-to-br from-background/60 via-card/50 to-background/60 backdrop-blur-md border border-border shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-2 h-2 rounded-full bg-destructive shrink-0" aria-hidden="true" />
                    Dominated Strategies
                  </CardTitle>
                  <CardDescription>
                    Strategies always worse than alternatives regardless of opponent play
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      {
                        label: 'Player 1',
                        strategies: result.dominatedStrategies.player1,
                        colorClass: 'text-primary',
                        accentStyle: 'border-primary/30 text-primary bg-primary/8',
                      },
                      {
                        label: 'Player 2',
                        strategies: result.dominatedStrategies.player2,
                        colorClass: 'text-[oklch(0.63_0.20_300)]',
                        accentStyle:
                          'border-[oklch(0.63_0.20_300)]/30 text-[oklch(0.63_0.20_300)] bg-[oklch(0.63_0.20_300)]/8',
                      },
                    ].map(({ label, strategies, colorClass, accentStyle }) => (
                      <div
                        key={label}
                        className="p-3.5 rounded-xl bg-background/40 border border-border/60"
                      >
                        <div className={`text-xs font-semibold uppercase tracking-wider mb-2.5 ${colorClass}`}>
                          {label}
                        </div>
                        {strategies.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {strategies.map((strategy) => (
                              <Badge
                                key={strategy}
                                variant="outline"
                                className={`text-xs ${accentStyle}`}
                              >
                                {label === 'Player 1'
                                  ? (useCustomRowLabels[strategy] ?? `Strategy ${strategy + 1}`)
                                  : (useCustomColLabels[strategy] ?? `Strategy ${strategy + 1}`)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No dominated strategies found
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Summary insight */}
                    <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 mt-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Iterative elimination of dominated strategies (IESDS) simplifies the game
                        and narrows down likely equilibrium outcomes.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Educational Content ────────────────────────────────────────── */}
        <motion.section
          className="mt-12 space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 28, delay: 0.3 }}
          aria-labelledby="about-heading"
        >
          <h2 id="about-heading" className="text-2xl font-semibold text-foreground">
            About Game Theory
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: 'Nash Equilibrium',
                body: 'Named after John Nash, a Nash equilibrium is a strategy profile where no player can unilaterally improve their payoff. It is the cornerstone of modern game theory, underpinning auction design, pricing strategy, and international relations.',
                accentFrom: 'from-primary/15',
                accentTo: 'to-primary/5',
                borderColor: 'border-primary/25',
                hoverBorder: 'hover:border-primary/50',
                titleColor: 'text-primary',
              },
              {
                title: "Prisoner's Dilemma",
                body: "The archetypal example of how individual rationality produces collectively suboptimal outcomes. Both players have a dominant strategy to defect, yet mutual defection (1,1) is worse than mutual cooperation (3,3) — the defining tension of social dilemmas.",
                accentFrom: 'from-[oklch(0.63_0.20_300)]/15',
                accentTo: 'to-[oklch(0.63_0.20_300)]/5',
                borderColor: 'border-[oklch(0.63_0.20_300)]/25',
                hoverBorder: 'hover:border-[oklch(0.63_0.20_300)]/50',
                titleColor: 'text-[oklch(0.63_0.20_300)]',
              },
              {
                title: 'Applications',
                body: 'Game theory informs economics, political science, evolutionary biology, computer science, and military strategy. Key applications include mechanism design for auctions, voting system analysis, firm pricing decisions, and modelling arms races.',
                accentFrom: 'from-[oklch(0.65_0.20_155)]/15',
                accentTo: 'to-[oklch(0.65_0.20_155)]/5',
                borderColor: 'border-[oklch(0.65_0.20_155)]/25',
                hoverBorder: 'hover:border-[oklch(0.65_0.20_155)]/50',
                titleColor: 'text-[oklch(0.65_0.20_155)]',
              },
              {
                title: 'Dominated Strategies',
                body: 'A strategy is strictly dominated if another strategy always yields a higher payoff regardless of what opponents do. Rational players never play dominated strategies, and iterative elimination (IESDS) often uniquely solves the game.',
                accentFrom: 'from-destructive/12',
                accentTo: 'to-destructive/4',
                borderColor: 'border-destructive/25',
                hoverBorder: 'hover:border-destructive/50',
                titleColor: 'text-destructive',
              },
            ].map(({ title, body, accentFrom, accentTo, borderColor, hoverBorder, titleColor }) => (
              <motion.div
                key={title}
                variants={cardHover}
                initial="rest"
                whileHover="hover"
                className={[
                  'group p-5 rounded-xl border transition-all duration-300',
                  'bg-gradient-to-br',
                  accentFrom,
                  accentTo,
                  borderColor,
                  hoverBorder,
                  'backdrop-blur-sm shadow-[0_4px_16px_0_rgba(0,0,0,0.12)]',
                  'hover:shadow-[0_8px_24px_0_rgba(0,0,0,0.2)]',
                ].join(' ')}
              >
                <h3 className={`text-base font-semibold mb-2 ${titleColor}`}>{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </main>
  );
}
