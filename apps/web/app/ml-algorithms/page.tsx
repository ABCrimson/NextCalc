'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Zap, Eye } from 'lucide-react';
// Mock ML algorithms since they're not exported yet
// import { simclrLoss, alibiAttention } from '@nextcalc/math-engine/algorithms';

/** OKLCH colormap for similarity values: deep purple (0) -> teal (0.5) -> bright green (1.0) */
function similarityColor(value: number): string {
  const h = 280 - value * 160; // 280 (purple) -> 120 (green)
  const c = 0.15 + value * 0.1; // increasing chroma
  const l = 0.25 + value * 0.45; // 25% -> 70% lightness
  return `oklch(${l} ${c} ${h})`;
}

/** Adaptive text color: dark text on light cells, light text on dark cells */
function textColorForValue(value: number): string {
  return value > 0.6 ? 'oklch(0.15 0 0)' : 'oklch(0.95 0 0)';
}

interface ContrastiveResult {
  loss: number;
  similarities: number[][];
}

interface AttentionResult {
  scores: number[][];
  output: number[][];
}

function attentionColor(score: number): string {
  const t = Math.max(0, Math.min(1, score));
  const hue = 290 - t * 210;
  const l = 0.25 + t * 0.45;
  const c = 0.04 + t * 0.18;
  return `oklch(${l} ${c} ${hue})`;
}

function attentionTextColor(score: number): string {
  return score > 0.45 ? 'oklch(0.15 0 0)' : 'oklch(0.92 0 0)';
}

export default function MLAlgorithmsPage() {
  const [temperature, setTemperature] = useState(0.5);
  const [batchSize, setBatchSize] = useState(4);
  const [embeddingDim, setEmbeddingDim] = useState(8);
  const [contrastiveResult, setContrastiveResult] = useState<ContrastiveResult | null>(null);

  const [seqLength, setSeqLength] = useState(8);
  const [numHeads, setNumHeads] = useState(4);
  const [attentionResult, setAttentionResult] = useState<AttentionResult | null>(null);

  // Generate random embeddings
  const generateEmbeddings = (batch: number, dim: number): number[][] => {
    const embeddings: number[][] = [];
    for (let i = 0; i < batch; i++) {
      const embedding: number[] = [];
      for (let j = 0; j < dim; j++) {
        embedding.push((Math.random() - 0.5) * 2); // Range: -1 to 1
      }
      // Normalize
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      embeddings.push(embedding.map(val => val / norm));
    }
    return embeddings;
  };

  // Run SimCLR contrastive learning
  const runSimCLR = () => {
    try {
      // Generate augmented views
      const embeddings1 = generateEmbeddings(batchSize, embeddingDim);
      const embeddings2 = generateEmbeddings(batchSize, embeddingDim);

      // Compute similarities
      const similarities: number[][] = [];
      for (let i = 0; i < batchSize; i++) {
        similarities[i] = [];
        for (let j = 0; j < batchSize; j++) {
          // Cosine similarity
          let sim = 0;
          for (let k = 0; k < embeddingDim; k++) {
            sim += (embeddings1[i]?.[k] ?? 0) * (embeddings2[j]?.[k] ?? 0);
          }
          similarities[i]![j] = sim;
        }
      }

      // Compute contrastive loss (mock implementation)
      let loss = 0;
      for (let i = 0; i < batchSize; i++) {
        const positiveSim = (similarities[i]?.[i] ?? 0) / temperature;
        let negativeSum = 0;
        for (let j = 0; j < batchSize; j++) {
          negativeSum += Math.exp((similarities[i]?.[j] ?? 0) / temperature);
        }
        loss -= Math.log(Math.exp(positiveSim) / negativeSum);
      }
      loss /= batchSize;

      setContrastiveResult({ loss, similarities });
    } catch (error) {
      console.error('SimCLR error:', error);
    }
  };

  // Generate random query/key/value matrices
  const generateQKV = (seqLen: number, dim: number): { Q: number[][]; K: number[][]; V: number[][] } => {
    const Q: number[][] = [];
    const K: number[][] = [];
    const V: number[][] = [];

    for (let i = 0; i < seqLen; i++) {
      Q[i] = [];
      K[i] = [];
      V[i] = [];
      for (let j = 0; j < dim; j++) {
        Q[i]![j] = Math.random();
        K[i]![j] = Math.random();
        V[i]![j] = Math.random();
      }
    }

    return { Q, K, V };
  };

  // Run AliBI attention (mock implementation)
  const runAliBI = () => {
    try {
      const dim = 16;
      const { Q, K, V } = generateQKV(seqLength, dim);

      // Compute attention scores (simplified)
      const scores: number[][] = [];
      for (let i = 0; i < seqLength; i++) {
        scores[i] = [];
        for (let j = 0; j < seqLength; j++) {
          // Causal mask
          if (j > i) {
            scores[i]![j] = 0;
            continue;
          }
          // Dot product attention with AliBI bias
          let score = 0;
          for (let k = 0; k < dim; k++) {
            score += (Q[i]?.[k] ?? 0) * (K[j]?.[k] ?? 0);
          }
          // Add distance bias (AliBI)
          const bias = -Math.abs(i - j) * 0.5;
          scores[i]![j] = Math.exp((score / Math.sqrt(dim)) + bias);
        }
        // Normalize
        const sum = scores[i]?.reduce((a, b) => a + b, 0) ?? 1;
        scores[i] = scores[i]?.map(s => s / sum) ?? [];
      }

      // Compute output (simplified)
      const output: number[][] = [];
      for (let i = 0; i < seqLength; i++) {
        output[i] = Array(dim).fill(0);
        for (let j = 0; j < seqLength; j++) {
          for (let k = 0; k < dim; k++) {
            const currentRow = output[i];
            if (currentRow) {
              currentRow[k] = (currentRow[k] ?? 0) + (scores[i]?.[j] ?? 0) * (V[j]?.[k] ?? 0);
            }
          }
        }
      }

      setAttentionResult({ scores, output });
    } catch (error) {
      console.error('AliBI error:', error);
    }
  };

  return (
    <main className="relative min-h-screen py-12 px-4">
      {/* ── Animated background layer ── */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background" />

        {/* Noise texture overlay via SVG feTurbulence */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="ml-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#ml-noise)" />
        </svg>

        {/* Orb 1 — top-right: blue (real-axis hue 264) */}
        <motion.div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.65 0.22 264 / 0.14) 0%, oklch(0.55 0.27 264 / 0.07) 60%, transparent 100%)',
          }}
          animate={{ y: [0, -40, 0], x: [0, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Orb 2 — bottom-left: purple/pink (hue 300-320) */}
        <motion.div
          className="absolute -bottom-40 -left-40 w-[700px] h-[700px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.63 0.20 310 / 0.14) 0%, oklch(0.58 0.22 310 / 0.07) 60%, transparent 100%)',
          }}
          animate={{ y: [0, 50, 0], x: [0, -30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />

        {/* Orb 3 — center: rose/pink (hue 355) */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle, oklch(0.65 0.18 355 / 0.08) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        />

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, oklch(0.55 0.02 290 / 0.15) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="container mx-auto max-w-6xl relative">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2 min-w-0">
            {/* Icon badge */}
            <div
              className="p-3 rounded-2xl border shrink-0"
              style={{
                background: 'linear-gradient(135deg, oklch(0.65 0.22 264 / 0.18), oklch(0.63 0.20 310 / 0.18))',
                borderColor: 'oklch(0.65 0.20 290 / 0.35)',
              }}
            >
              <Brain className="w-8 h-8" style={{ color: 'oklch(0.75 0.20 290)' }} />
            </div>
            <h1 className="text-4xl font-bold min-w-0 break-words bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Modern ML Algorithms
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Explore contrastive learning and advanced attention mechanisms
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge
              variant="outline"
              className="border-blue-500/50 text-blue-400 bg-blue-500/10"
            >
              <Zap className="w-3 h-3 mr-1" />
              SimCLR
            </Badge>
            <Badge
              variant="outline"
              className="border-purple-500/50 text-purple-400 bg-purple-500/10"
            >
              AliBI Attention
            </Badge>
            <Badge
              variant="outline"
              className="border-pink-500/50 text-pink-400 bg-pink-500/10"
            >
              Self-Supervised
            </Badge>
          </div>
        </header>

        <Tabs defaultValue="simclr" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-card/50 backdrop-blur-md border border-border">
            <TabsTrigger
              value="simclr"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/20 data-[state=active]:to-purple-500/20 data-[state=active]:text-foreground data-[state=active]:border-blue-500/30"
            >
              <Zap className="w-4 h-4 mr-2" />
              SimCLR
            </TabsTrigger>
            <TabsTrigger
              value="alibi"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/20 data-[state=active]:to-pink-500/20 data-[state=active]:text-foreground data-[state=active]:border-purple-500/30"
            >
              <Eye className="w-4 h-4 mr-2" />
              AliBI Attention
            </TabsTrigger>
          </TabsList>

          {/* SimCLR Tab */}
          <TabsContent value="simclr" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* SimCLR Controls */}
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader>
                  <CardTitle className="text-blue-400">SimCLR Parameters</CardTitle>
                  <CardDescription>
                    Contrastive learning configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Temperature */}
                  <div className="space-y-2">
                    <Label htmlFor="temperature">
                      Temperature:{' '}
                      <span className="text-blue-400 font-mono">{temperature.toFixed(2)}</span>
                    </Label>
                    <Slider
                      id="temperature"
                      min={0.1}
                      max={2.0}
                      step={0.1}
                      value={[temperature]}
                      onValueChange={([value]) => setTemperature(value ?? 0.5)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower temperature = harder negatives, sharper distribution
                    </p>
                  </div>

                  {/* Batch Size */}
                  <div className="space-y-2">
                    <Label htmlFor="batch-size">
                      Batch Size:{' '}
                      <span className="text-blue-400 font-mono">{batchSize}</span>
                    </Label>
                    <Slider
                      id="batch-size"
                      min={2}
                      max={16}
                      step={2}
                      value={[batchSize]}
                      onValueChange={([value]) => setBatchSize(value ?? 4)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Larger batches provide more negative samples
                    </p>
                  </div>

                  {/* Embedding Dimension */}
                  <div className="space-y-2">
                    <Label htmlFor="embedding-dim">
                      Embedding Dimension:{' '}
                      <span className="text-blue-400 font-mono">{embeddingDim}</span>
                    </Label>
                    <Slider
                      id="embedding-dim"
                      min={4}
                      max={32}
                      step={4}
                      value={[embeddingDim]}
                      onValueChange={([value]) => setEmbeddingDim(value ?? 8)}
                    />
                  </div>

                  <Button
                    onClick={runSimCLR}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0"
                    size="lg"
                  >
                    Compute Contrastive Loss
                  </Button>

                  {contrastiveResult && (
                    <div className="p-4 bg-gradient-to-br from-blue-950/40 to-purple-900/40 border border-blue-500/40 rounded-lg backdrop-blur-sm">
                      <div className="font-semibold text-blue-300 mb-2">Loss Value</div>
                      <div className="text-3xl font-mono font-bold text-purple-200">
                        {contrastiveResult.loss.toFixed(4)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Lower loss indicates better learned representations
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SimCLR Visualization */}
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader>
                  <CardTitle className="text-purple-400">Similarity Matrix</CardTitle>
                  <CardDescription>
                    Cosine similarity between augmented views
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {contrastiveResult ? (
                    <div className="space-y-4">
                      <div className="overflow-hidden">
                        <div
                          className="grid gap-1"
                          style={{
                            gridTemplateColumns: `repeat(${batchSize}, minmax(2rem, 1fr))`,
                          }}
                        >
                          {contrastiveResult.similarities.map((row, i) =>
                            row.map((sim, j) => {
                              // Map similarity from [-1, 1] to [0, 1]
                              const intensity = (sim + 1) / 2;
                              // OKLCH colormap: deep purple (0) -> teal (0.5) -> bright green (1.0)
                              const bgColor = i === j
                                ? 'oklch(0.65 0.2 155)' // Bright green for positive pairs
                                : similarityColor(intensity);
                              const fgColor = i === j
                                ? 'oklch(0.15 0 0)' // Dark text on green
                                : textColorForValue(intensity);

                              return (
                                <div
                                  key={`${i}-${j}`}
                                  style={{
                                    backgroundColor: bgColor,
                                    color: fgColor,
                                    aspectRatio: '1/1',
                                  }}
                                  className="rounded flex items-center justify-center text-[0.7rem] font-mono p-0.5"
                                  title={`Sim(${i}, ${j}): ${sim.toFixed(3)}`}
                                >
                                  {sim.toFixed(2)}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-emerald-500 rounded" />
                          <span className="text-muted-foreground">Positive Pairs (diagonal)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-muted rounded" />
                          <span className="text-muted-foreground">Negative Pairs</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Run SimCLR to see similarity matrix
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* SimCLR Info */}
            <Card className="backdrop-blur-md bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-foreground">About SimCLR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">SimCLR</strong> (Simple Framework for Contrastive Learning of Visual Representations)
                  is a self-supervised learning method that learns representations by maximizing agreement between
                  differently augmented views of the same image.
                </p>
                <p>
                  The contrastive loss pulls positive pairs (augmented views of the same image) together
                  in the embedding space while pushing negative pairs (different images) apart. The temperature
                  parameter controls the concentration of the distribution.
                </p>
                <div className="overflow-x-auto">
                  <p className="font-mono text-xs bg-background/50 p-2 rounded whitespace-nowrap border border-border/50">
                    Loss = -log[exp(sim(z_i, z_j)/τ) / Σ exp(sim(z_i, z_k)/τ)]
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AliBI Attention Tab */}
          <TabsContent value="alibi" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* AliBI Controls */}
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader>
                  <CardTitle className="text-purple-400">AliBI Parameters</CardTitle>
                  <CardDescription>
                    Attention with Linear Biases configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Sequence Length */}
                  <div className="space-y-2">
                    <Label htmlFor="seq-length">
                      Sequence Length:{' '}
                      <span className="text-purple-400 font-mono">{seqLength}</span>
                    </Label>
                    <Slider
                      id="seq-length"
                      min={4}
                      max={32}
                      step={4}
                      value={[seqLength]}
                      onValueChange={([value]) => setSeqLength(value ?? 8)}
                    />
                    <p className="text-xs text-muted-foreground">
                      AliBI enables length extrapolation beyond training sequences
                    </p>
                  </div>

                  {/* Number of Heads */}
                  <div className="space-y-2">
                    <Label htmlFor="num-heads">
                      Number of Heads:{' '}
                      <span className="text-purple-400 font-mono">{numHeads}</span>
                    </Label>
                    <Slider
                      id="num-heads"
                      min={1}
                      max={8}
                      step={1}
                      value={[numHeads]}
                      onValueChange={([value]) => setNumHeads(value ?? 4)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Multi-head attention learns different representation subspaces
                    </p>
                  </div>

                  <Button
                    onClick={runAliBI}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
                    size="lg"
                  >
                    Compute Attention
                  </Button>

                  {attentionResult && (
                    <div className="space-y-3">
                      <div className="p-4 bg-gradient-to-br from-purple-950/40 to-pink-900/40 border border-purple-500/40 rounded-lg backdrop-blur-sm">
                        <div className="font-semibold text-purple-300 mb-2">Attention Statistics</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max Score:</span>
                            <span className="font-mono text-pink-300">
                              {Math.max(...attentionResult.scores.flat()).toFixed(3)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Min Score:</span>
                            <span className="font-mono text-pink-300">
                              {Math.min(...attentionResult.scores.flat()).toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AliBI Visualization */}
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader>
                  <CardTitle className="text-pink-400">Attention Heatmap</CardTitle>
                  <CardDescription>
                    Causal attention scores (head 0)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {attentionResult ? (
                    <div className="space-y-4">
                      <div className="overflow-hidden">
                        <div
                          className="grid gap-0.5"
                          style={{
                            gridTemplateColumns: `repeat(${seqLength}, minmax(1.5rem, 1fr))`,
                          }}
                        >
                          {attentionResult.scores.slice(0, seqLength).map((row, i) =>
                            row.slice(0, seqLength).map((score, j) => {
                              // Causal mask: only attend to previous positions
                              if (j > i) {
                                return (
                                  <div
                                    key={`${i}-${j}`}
                                    className="bg-muted opacity-30 rounded"
                                    style={{ aspectRatio: '1/1' }}
                                  />
                                );
                              }

                              const color = attentionColor(score);
                              const textColor = attentionTextColor(score);

                              return (
                                <div
                                  key={`${i}-${j}`}
                                  style={{
                                    backgroundColor: color,
                                    color: textColor,
                                    aspectRatio: '1/1',
                                  }}
                                  className="rounded flex items-center justify-center text-[0.7rem] font-mono p-0.5"
                                  title={`Attention(${i}, ${j}): ${score.toFixed(3)}`}
                                >
                                  {score.toFixed(2)}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <p>Rows: Query positions | Columns: Key positions</p>
                        <p className="mt-1">Violet = Low attention | Amber = High attention</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      Run AliBI to see attention heatmap
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* AliBI Info */}
            <Card className="backdrop-blur-md bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-foreground">About AliBI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">AliBI</strong> (Attention with Linear Biases) is a simple,
                  efficient alternative to positional embeddings in Transformers. Instead of adding positional
                  encodings to word embeddings, AliBI adds a static, non-learned bias to attention scores.
                </p>
                <p>
                  The bias is proportional to the distance between query and key positions, penalizing
                  attention to distant tokens. This encourages the model to focus on nearby context and
                  remarkably enables length extrapolation - the model can process sequences longer than
                  those seen during training.
                </p>
                <div className="overflow-x-auto">
                  <p className="font-mono text-xs bg-background/50 p-2 rounded whitespace-nowrap border border-border/50">
                    Attention(Q, K, V) = softmax(QK^T / √d_k - m·|i-j|) V
                  </p>
                </div>
                <p>
                  where m is a head-specific slope. Each attention head gets a different slope, allowing
                  different heads to focus on different distance ranges.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Educational Content */}
        <section className="mt-12 space-y-6" aria-labelledby="ml-innovations-heading">
          <h2
            id="ml-innovations-heading"
            className="text-2xl font-semibold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
          >
            Modern ML Innovations
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div
              className="group relative p-6 rounded-xl overflow-hidden border backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, oklch(0.18 0.03 264 / 0.5), oklch(0.16 0.025 264 / 0.4))',
                borderColor: 'oklch(0.65 0.22 264 / 0.4)',
                boxShadow: '0 0 20px oklch(0.55 0.27 264 / 0.12)',
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                style={{ background: 'linear-gradient(135deg, oklch(0.65 0.22 264 / 0.06), transparent)' }}
              />
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
                style={{ background: 'radial-gradient(circle at top right, oklch(0.65 0.22 264 / 0.4), transparent)' }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'oklch(0.65 0.22 264)', boxShadow: '0 0 8px oklch(0.65 0.22 264 / 0.8)' }}
                  />
                  <h3 className="text-lg font-semibold min-w-0 break-words" style={{ color: 'oklch(0.78 0.18 264)' }}>
                    Contrastive Learning
                  </h3>
                </div>
                <p className="text-sm" style={{ color: 'oklch(0.75 0.08 264)' }}>
                  Self-supervised learning paradigm that learns representations by contrasting positive
                  and negative examples. Powers models like CLIP, SimCLR, and MoCo. Achieves impressive
                  results without labeled data by learning invariances through data augmentation.
                </p>
              </div>
            </div>

            <div
              className="group relative p-6 rounded-xl overflow-hidden border backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, oklch(0.18 0.03 300 / 0.5), oklch(0.16 0.025 300 / 0.4))',
                borderColor: 'oklch(0.63 0.20 300 / 0.4)',
                boxShadow: '0 0 20px oklch(0.58 0.22 300 / 0.12)',
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                style={{ background: 'linear-gradient(135deg, oklch(0.63 0.20 300 / 0.06), transparent)' }}
              />
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
                style={{ background: 'radial-gradient(circle at top right, oklch(0.63 0.20 300 / 0.4), transparent)' }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'oklch(0.63 0.20 300)', boxShadow: '0 0 8px oklch(0.63 0.20 300 / 0.8)' }}
                  />
                  <h3 className="text-lg font-semibold min-w-0 break-words" style={{ color: 'oklch(0.78 0.16 300)' }}>
                    Efficient Transformers
                  </h3>
                </div>
                <p className="text-sm" style={{ color: 'oklch(0.75 0.08 300)' }}>
                  AliBI is one of many innovations making Transformers more efficient. Others include
                  Flash Attention (memory optimization), Linformer (linear attention), and Reformer
                  (locality-sensitive hashing). These enable processing longer sequences.
                </p>
              </div>
            </div>

            <div
              className="group relative p-6 rounded-xl overflow-hidden border backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, oklch(0.18 0.03 155 / 0.5), oklch(0.16 0.025 155 / 0.4))',
                borderColor: 'oklch(0.65 0.18 155 / 0.4)',
                boxShadow: '0 0 20px oklch(0.65 0.18 155 / 0.12)',
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                style={{ background: 'linear-gradient(135deg, oklch(0.65 0.18 155 / 0.06), transparent)' }}
              />
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
                style={{ background: 'radial-gradient(circle at top right, oklch(0.65 0.18 155 / 0.4), transparent)' }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'oklch(0.65 0.18 155)', boxShadow: '0 0 8px oklch(0.65 0.18 155 / 0.8)' }}
                  />
                  <h3 className="text-lg font-semibold min-w-0 break-words" style={{ color: 'oklch(0.78 0.15 155)' }}>
                    Applications
                  </h3>
                </div>
                <p className="text-sm" style={{ color: 'oklch(0.75 0.07 155)' }}>
                  Contrastive learning: Image retrieval, few-shot learning, representation learning.
                  AliBI: Language models (BLOOM), long-document understanding, efficient inference.
                  Both techniques are foundational to modern foundation models.
                </p>
              </div>
            </div>

            <div
              className="group relative p-6 rounded-xl overflow-hidden border backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, oklch(0.18 0.03 25 / 0.5), oklch(0.16 0.025 25 / 0.4))',
                borderColor: 'oklch(0.65 0.20 355 / 0.4)',
                boxShadow: '0 0 20px oklch(0.65 0.20 355 / 0.12)',
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                style={{ background: 'linear-gradient(135deg, oklch(0.65 0.20 355 / 0.06), transparent)' }}
              />
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-20"
                style={{ background: 'radial-gradient(circle at top right, oklch(0.65 0.20 355 / 0.4), transparent)' }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'oklch(0.65 0.20 355)', boxShadow: '0 0 8px oklch(0.65 0.20 355 / 0.8)' }}
                  />
                  <h3 className="text-lg font-semibold min-w-0 break-words" style={{ color: 'oklch(0.78 0.16 355)' }}>
                    Why It Matters
                  </h3>
                </div>
                <p className="text-sm" style={{ color: 'oklch(0.75 0.07 355)' }}>
                  These algorithms represent the cutting edge of ML research. Contrastive learning
                  reduces reliance on labeled data. Efficient attention mechanisms make large models
                  practical. Together, they're democratizing access to powerful AI.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
