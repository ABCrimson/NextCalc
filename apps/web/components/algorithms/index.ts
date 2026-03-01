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

export type { AlgorithmBreadcrumbProps, BreadcrumbItem } from './AlgorithmBreadcrumb';
export { AlgorithmBreadcrumb } from './AlgorithmBreadcrumb';
export type { AlgorithmCardProps, AlgorithmCategory, DifficultyLevel } from './AlgorithmCard';
// UI Components
export { AlgorithmCard } from './AlgorithmCard';
export type { AlgorithmMetadataProps } from './AlgorithmMetadata';
export { AlgorithmMetadata } from './AlgorithmMetadata';
export type { AlgorithmPageProps, Reference, RelatedAlgorithm } from './AlgorithmPage';
export { AlgorithmPage } from './AlgorithmPage';
export type { CategoryFilterProps } from './CategoryFilter';
export { CategoryFilter } from './CategoryFilter';
export type { MetaLearningPlaygroundProps } from './MetaLearningPlayground';
export { MetaLearningPlayground } from './MetaLearningPlayground';
export type { PageRankExplorerProps } from './PageRankExplorer';
export { PageRankExplorer } from './PageRankExplorer';
export type { QuantumSimulatorProps } from './QuantumSimulator';
export { QuantumSimulator } from './QuantumSimulator';
export type { TransformerVisualizerProps } from './TransformerVisualizer';
// Component exports
export { TransformerVisualizer } from './TransformerVisualizer';
// Type exports
export type {
  Amplitude,
  AnimationSpeed,
  // Transformer types
  AttentionHead,
  // Branded types
  AttentionScore,
  EdgeId,
  // Utility types
  EducationalStep,
  ExportConfig,
  Graph,
  GraphEdge,
  // Graph types
  GraphNode,
  MAMLState,
  // MAML types
  MAMLTask,
  NodeId,
  PageRankScore,
  PerformanceMetrics,
  QuantumCircuit,
  // Quantum types
  QuantumGate,
  QuantumState,
  // Status types
  StepStatus,
  ThemeMode,
  TransformerConfig,
  // ZKP types
  ZKPState,
} from './types';
// Helper function exports
export {
  ANIMATION_DURATIONS,
  createAmplitude,
  createAttentionScore,
  createEdgeId,
  createNodeId,
  createPageRankScore,
  VISUALIZATION_COLORS,
} from './types';
export type { ZKPComputeVisualizerProps } from './ZKPComputeVisualizer';
export { ZKPComputeVisualizer } from './ZKPComputeVisualizer';
export type { ZKPDemoProps } from './ZKPDemo';
export { ZKPDemo } from './ZKPDemo';
