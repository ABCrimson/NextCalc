/**
 * Shared type definitions for algorithm visualization components
 * @module components/algorithms/types
 */

import type { ReactNode } from 'react';

// Branded types for type safety
declare const __brand: unique symbol;
type Brand<T, TBrand extends string> = T & { [__brand]: TBrand };

/**
 * Branded type for attention scores (0-1 range)
 */
export type AttentionScore = Brand<number, 'AttentionScore'>;

/**
 * Branded type for quantum state amplitudes (complex numbers)
 */
export type Amplitude = Brand<{ real: number; imag: number }, 'Amplitude'>;

/**
 * Branded type for PageRank scores (0-1 range)
 */
export type PageRankScore = Brand<number, 'PageRankScore'>;

/**
 * Branded type for node IDs
 */
export type NodeId = Brand<string, 'NodeId'>;

/**
 * Branded type for edge IDs
 */
export type EdgeId = Brand<string, 'EdgeId'>;

/**
 * Step status for educational step-by-step execution
 */
export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

/**
 * Animation speed presets
 */
export type AnimationSpeed = 'slow' | 'normal' | 'fast' | 'instant';

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'high-contrast';

/**
 * Transformer attention head configuration
 */
export interface AttentionHead {
  readonly headId: number;
  readonly scores: ReadonlyArray<ReadonlyArray<AttentionScore>>;
  readonly queryWeights: ReadonlyArray<ReadonlyArray<number>>;
  readonly keyWeights: ReadonlyArray<ReadonlyArray<number>>;
  readonly valueWeights: ReadonlyArray<ReadonlyArray<number>>;
}

/**
 * Transformer configuration parameters
 */
export interface TransformerConfig {
  readonly numHeads: number;
  readonly dModel: number;
  readonly sequenceLength: number;
  readonly tokens: ReadonlyArray<string>;
}

/**
 * Zero-Knowledge Proof state for Schnorr protocol
 */
export interface ZKPState {
  readonly step: 'setup' | 'commitment' | 'challenge' | 'response' | 'verification';
  readonly proverSecret?: bigint;
  readonly commitment?: bigint;
  readonly challenge?: bigint;
  readonly response?: bigint;
  readonly publicKey?: bigint;
  readonly generator: bigint;
  readonly modulus: bigint;
}

/**
 * Quantum gate types for circuit visualization
 */
export type QuantumGate =
  | { type: 'H'; qubit: number } // Hadamard
  | { type: 'X'; qubit: number } // Pauli-X (NOT)
  | { type: 'Y'; qubit: number } // Pauli-Y
  | { type: 'Z'; qubit: number } // Pauli-Z
  | { type: 'CNOT'; control: number; target: number } // Controlled-NOT
  | { type: 'SWAP'; qubit1: number; qubit2: number }
  | { type: 'QFT'; qubits: ReadonlyArray<number> } // Quantum Fourier Transform
  | { type: 'MEASURE'; qubit: number };

/**
 * Quantum state representation
 */
export interface QuantumState {
  readonly numQubits: number;
  readonly amplitudes: ReadonlyArray<Amplitude>;
  readonly basis: ReadonlyArray<string>;
}

/**
 * Quantum circuit definition
 */
export interface QuantumCircuit {
  readonly numQubits: number;
  readonly gates: ReadonlyArray<QuantumGate>;
  readonly name: string;
  readonly description: string;
}

/**
 * Graph node for PageRank
 */
export interface GraphNode {
  readonly id: NodeId;
  readonly label: string;
  readonly rank: PageRankScore;
  readonly position: { x: number; y: number };
}

/**
 * Graph edge for PageRank
 */
export interface GraphEdge {
  readonly id: EdgeId;
  readonly source: NodeId;
  readonly target: NodeId;
  readonly weight: number;
}

/**
 * Complete graph structure
 */
export interface Graph {
  readonly nodes: ReadonlyArray<GraphNode>;
  readonly edges: ReadonlyArray<GraphEdge>;
  readonly dampingFactor: number;
}

/**
 * MAML task definition
 */
export interface MAMLTask {
  readonly taskId: string;
  readonly name: string;
  readonly data: ReadonlyArray<{ x: number; y: number }>;
  readonly type: 'regression' | 'classification';
}

/**
 * MAML training state
 */
export interface MAMLState {
  readonly metaParameters: ReadonlyArray<number>;
  readonly tasks: ReadonlyArray<MAMLTask>;
  readonly innerSteps: number;
  readonly outerSteps: number;
  readonly innerLearningRate: number;
  readonly outerLearningRate: number;
  readonly currentTask?: MAMLTask;
  readonly adaptedParameters?: ReadonlyArray<number>;
}

/**
 * Educational step for step-by-step execution
 */
export interface EducationalStep {
  readonly stepId: string;
  readonly title: string;
  readonly description: string;
  readonly status: StepStatus;
  readonly code?: string;
  readonly visualization?: ReactNode;
}

/**
 * Performance metrics for algorithm execution
 */
export interface PerformanceMetrics {
  readonly executionTime: number; // milliseconds
  readonly iterations: number;
  readonly memoryUsage?: number; // bytes
  readonly convergenceRate?: number;
}

/**
 * Export configuration for saving visualizations
 */
export interface ExportConfig {
  readonly format: 'png' | 'svg' | 'json';
  readonly width: number;
  readonly height: number;
  readonly includeLabels: boolean;
  readonly backgroundColor?: string;
}

/**
 * Helper to create branded AttentionScore
 */
export function createAttentionScore(value: number): AttentionScore {
  if (value < 0 || value > 1) {
    throw new Error(`Attention score must be in range [0, 1], got ${value}`);
  }
  return value as AttentionScore;
}

/**
 * Helper to create branded Amplitude
 */
export function createAmplitude(real: number, imag: number): Amplitude {
  return { real, imag } as Amplitude;
}

/**
 * Helper to create branded PageRankScore
 */
export function createPageRankScore(value: number): PageRankScore {
  if (value < 0 || value > 1) {
    throw new Error(`PageRank score must be in range [0, 1], got ${value}`);
  }
  return value as PageRankScore;
}

/**
 * Helper to create branded NodeId
 */
export function createNodeId(id: string): NodeId {
  return id as NodeId;
}

/**
 * Helper to create branded EdgeId
 */
export function createEdgeId(id: string): EdgeId {
  return id as EdgeId;
}

/**
 * Animation duration in milliseconds based on speed preset
 */
export const ANIMATION_DURATIONS: Record<AnimationSpeed, number> = {
  slow: 1000,
  normal: 500,
  fast: 250,
  instant: 0,
} as const;

/**
 * Color schemes for visualizations
 */
export const VISUALIZATION_COLORS = {
  light: {
    primary: 'oklch(0.55 0.27 264)',
    secondary: 'oklch(0.58 0.22 300)',
    success: 'oklch(0.72 0.19 155)',
    warning: 'oklch(0.72 0.17 70)',
    error: 'oklch(0.58 0.22 25)',
    neutral: 'oklch(0.55 0.05 265)',
  },
  dark: {
    primary: 'oklch(0.65 0.22 264)',
    secondary: 'oklch(0.63 0.18 300)',
    success: 'oklch(0.73 0.16 155)',
    warning: 'oklch(0.74 0.15 70)',
    error: 'oklch(0.58 0.18 25)',
    neutral: 'oklch(0.62 0.04 265)',
  },
} as const;
