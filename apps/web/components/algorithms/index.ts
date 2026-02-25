/**
 * Algorithm Visualization Components
 * @module components/algorithms
 *
 * This module provides comprehensive, interactive UI components for
 * visualizing and exploring advanced algorithms in NextCalc.
 *
 * All components are built with:
 * - Full TypeScript type safety with branded types
 * - WCAG 2.2 Level AAA accessibility compliance
 * - Responsive design (mobile-first)
 * - Dark mode support
 * - Framer Motion animations
 * - Educational explanations
 *
 * @example
 * ```tsx
 * import {
 *   TransformerVisualizer,
 *   ZKPDemo,
 *   QuantumSimulator,
 *   PageRankExplorer,
 *   MetaLearningPlayground
 * } from '@/components/algorithms';
 *
 * export default function AlgorithmsPage() {
 *   return (
 *     <div>
 *       <TransformerVisualizer showExplanations={true} />
 *       <ZKPDemo animationSpeed="normal" />
 *     </div>
 *   );
 * }
 * ```
 */

// Component exports
export { TransformerVisualizer } from './TransformerVisualizer';
export type { TransformerVisualizerProps } from './TransformerVisualizer';

export { ZKPDemo } from './ZKPDemo';
export type { ZKPDemoProps } from './ZKPDemo';

export { ZKPComputeVisualizer } from './ZKPComputeVisualizer';
export type { ZKPComputeVisualizerProps } from './ZKPComputeVisualizer';

export { QuantumSimulator } from './QuantumSimulator';
export type { QuantumSimulatorProps } from './QuantumSimulator';

export { PageRankExplorer } from './PageRankExplorer';
export type { PageRankExplorerProps } from './PageRankExplorer';

export { MetaLearningPlayground } from './MetaLearningPlayground';
export type { MetaLearningPlaygroundProps } from './MetaLearningPlayground';

// UI Components
export { AlgorithmCard } from './AlgorithmCard';
export type { AlgorithmCardProps, DifficultyLevel, AlgorithmCategory } from './AlgorithmCard';

export { AlgorithmBreadcrumb } from './AlgorithmBreadcrumb';
export type { AlgorithmBreadcrumbProps, BreadcrumbItem } from './AlgorithmBreadcrumb';

export { AlgorithmMetadata } from './AlgorithmMetadata';
export type { AlgorithmMetadataProps } from './AlgorithmMetadata';

export { CategoryFilter } from './CategoryFilter';
export type { CategoryFilterProps } from './CategoryFilter';

export { AlgorithmPage } from './AlgorithmPage';
export type { AlgorithmPageProps, Reference, RelatedAlgorithm } from './AlgorithmPage';

// Type exports
export type {
  // Branded types
  AttentionScore,
  Amplitude,
  PageRankScore,
  NodeId,
  EdgeId,
  // Status types
  StepStatus,
  AnimationSpeed,
  ThemeMode,
  // Transformer types
  AttentionHead,
  TransformerConfig,
  // ZKP types
  ZKPState,
  // Quantum types
  QuantumGate,
  QuantumState,
  QuantumCircuit,
  // Graph types
  GraphNode,
  GraphEdge,
  Graph,
  // MAML types
  MAMLTask,
  MAMLState,
  // Utility types
  EducationalStep,
  PerformanceMetrics,
  ExportConfig,
} from './types';

// Helper function exports
export {
  createAttentionScore,
  createAmplitude,
  createPageRankScore,
  createNodeId,
  createEdgeId,
  ANIMATION_DURATIONS,
  VISUALIZATION_COLORS,
} from './types';
