# Algorithm Visualization Components

Comprehensive, interactive UI components for visualizing advanced algorithms in NextCalc.

## Overview

This module provides five production-ready algorithm visualization components:

1. **TransformerVisualizer** - Multi-head self-attention visualization
2. **ZKPDemo** - Zero-knowledge proof (Schnorr protocol) demonstration
3. **QuantumSimulator** - Quantum circuit simulator with state visualization
4. **PageRankExplorer** - Interactive graph builder with PageRank computation
5. **MetaLearningPlayground** - MAML algorithm visualization

## Features

### Common Features (All Components)

- **Type-Safe**: Full TypeScript support with branded types for domain concepts
- **Accessible**: WCAG 2.2 Level AAA compliant
  - Keyboard navigation (Tab, Enter, Escape, Arrow keys)
  - Screen reader support with ARIA labels
  - Focus management
  - Semantic HTML
  - Color contrast ratios: 7:1 (normal text), 4.5:1 (large text)
- **Responsive**: Mobile-first design, works on all screen sizes
- **Dark Mode**: Full theme support (light/dark/high-contrast)
- **Animated**: Smooth Framer Motion animations with `prefers-reduced-motion` support
- **Educational**: Built-in explanations and interactive learning modes
- **Performant**: Optimized rendering, lazy loading, memoization

## Components

### 1. TransformerVisualizer

Interactive visualization of transformer attention mechanism.

**Features:**
- Multi-head attention matrix heatmap
- Adjustable parameters (heads, d_model, sequence length)
- Real-time attention score computation
- Token editor with live updates
- Export attention patterns as PNG
- Educational explanations of self-attention

**Usage:**
```tsx
import { TransformerVisualizer } from '@/components/algorithms';

export default function TransformerPage() {
  return (
    <TransformerVisualizer
      initialConfig={{
        numHeads: 8,
        dModel: 512,
        sequenceLength: 16,
        tokens: ['The', 'quick', 'brown', 'fox']
      }}
      showExplanations={true}
      animationSpeed="normal"
      onAttentionComputed={(heads) => {
        console.log('Attention heads:', heads);
      }}
    />
  );
}
```

**Props:**
- `initialConfig?: Partial<TransformerConfig>` - Initial transformer configuration
- `onAttentionComputed?: (heads: ReadonlyArray<AttentionHead>) => void` - Callback when attention is computed
- `showExplanations?: boolean` - Show educational tabs (default: true)
- `animationSpeed?: AnimationSpeed` - Animation speed preset (default: 'normal')
- `className?: string` - Custom CSS class

**Keyboard Shortcuts:**
- Arrow keys: Navigate cells
- Space: Toggle animation
- R: Reset configuration

### 2. ZKPDemo

Interactive demonstration of zero-knowledge proofs using Schnorr protocol.

**Features:**
- Step-by-step protocol execution
- Prover/Verifier role-playing mode
- Real-time parameter visualization
- Success/failure feedback
- Educational explanations of ZKP concepts

**Usage:**
```tsx
import { ZKPDemo } from '@/components/algorithms';

export default function ZKPPage() {
  return (
    <ZKPDemo
      showExplanations={true}
      animationSpeed="normal"
      onProofCompleted={(verified) => {
        console.log('Proof verified:', verified);
      }}
    />
  );
}
```

**Props:**
- `showExplanations?: boolean` - Show educational tabs (default: true)
- `animationSpeed?: AnimationSpeed` - Animation speed preset (default: 'normal')
- `onProofCompleted?: (verified: boolean) => void` - Callback when proof completes
- `className?: string` - Custom CSS class

**Protocol Steps:**
1. Setup: Generate prover secret and public key
2. Commitment: Prover commits to random value
3. Challenge: Verifier sends random challenge
4. Response: Prover computes response
5. Verification: Verifier checks proof validity

### 3. QuantumSimulator

Quantum circuit simulator with visual state representation.

**Features:**
- Visual quantum state vector display
- Circuit diagram with gate visualization
- Hadamard, Pauli-X, CNOT gates
- Step-by-step circuit execution
- Measurement with probabilistic outcomes
- Preset circuits (Bell state, GHZ, superposition)

**Usage:**
```tsx
import { QuantumSimulator } from '@/components/algorithms';

export default function QuantumPage() {
  return (
    <QuantumSimulator
      initialQubits={3}
      showExplanations={true}
      animationSpeed="normal"
      onMeasurement={(result, probabilities) => {
        console.log('Measured:', result, probabilities);
      }}
    />
  );
}
```

**Props:**
- `initialQubits?: number` - Initial number of qubits (default: 3)
- `showExplanations?: boolean` - Show educational tabs (default: true)
- `animationSpeed?: AnimationSpeed` - Animation speed preset (default: 'normal')
- `onMeasurement?: (result: string, probabilities: Record<string, number>) => void` - Callback on measurement
- `className?: string` - Custom CSS class

**Available Gates:**
- **H (Hadamard)**: Creates superposition
- **X (Pauli-X)**: Quantum NOT gate
- **CNOT**: Controlled-NOT for entanglement

### 4. PageRankExplorer

Interactive graph builder with real-time PageRank computation.

**Features:**
- Drag-and-drop graph building
- Visual node size based on PageRank
- Edge creation and removal
- Preset graph templates (star, cycle, web)
- Real-time ranking table
- Graph statistics and metrics

**Usage:**
```tsx
import { PageRankExplorer } from '@/components/algorithms';

export default function PageRankPage() {
  return (
    <PageRankExplorer
      initialGraph={{
        dampingFactor: 0.85
      }}
      showExplanations={true}
      animationSpeed="normal"
      onRankComputed={(ranks) => {
        console.log('PageRank computed:', ranks);
      }}
    />
  );
}
```

**Props:**
- `initialGraph?: Partial<Graph>` - Initial graph configuration
- `showExplanations?: boolean` - Show educational tabs (default: true)
- `animationSpeed?: AnimationSpeed` - Animation speed preset (default: 'normal')
- `onRankComputed?: (ranks: Map<NodeId, PageRankScore>) => void` - Callback when ranks computed
- `className?: string` - Custom CSS class

**Preset Graphs:**
- **Linear**: Chain of nodes
- **Star**: Hub-and-spoke structure
- **Cycle**: Circular graph
- **Web**: Typical website link structure

### 5. MetaLearningPlayground

MAML (Model-Agnostic Meta-Learning) algorithm visualization.

**Features:**
- Inner/outer loop visualization
- Task-specific adaptation display
- Loss landscape plots
- Convergence tracking
- Hyperparameter tuning
- Multiple task visualization

**Usage:**
```tsx
import { MetaLearningPlayground } from '@/components/algorithms';

export default function MetaLearningPage() {
  return (
    <MetaLearningPlayground
      initialConfig={{
        innerSteps: 5,
        outerSteps: 20,
        innerLearningRate: 0.01,
        outerLearningRate: 0.01
      }}
      showExplanations={true}
      animationSpeed="normal"
      onTrainingCompleted={(state) => {
        console.log('Training completed:', state);
      }}
    />
  );
}
```

**Props:**
- `initialConfig?: Partial<MAMLState>` - Initial MAML configuration
- `showExplanations?: boolean` - Show educational tabs (default: true)
- `animationSpeed?: AnimationSpeed` - Animation speed preset (default: 'normal')
- `onTrainingCompleted?: (finalState: MAMLState) => void` - Callback when training completes
- `className?: string` - Custom CSS class

## Type System

All components use branded types for domain-specific values:

```typescript
// Branded types prevent mixing incompatible values
type AttentionScore = Brand<number, 'AttentionScore'>; // [0, 1]
type PageRankScore = Brand<number, 'PageRankScore'>; // [0, 1]
type NodeId = Brand<string, 'NodeId'>;

// Helper functions enforce constraints
const score = createAttentionScore(0.8); // ✓ Valid
const invalid = createAttentionScore(1.5); // ✗ Throws error
```

## Accessibility

All components meet WCAG 2.2 Level AAA standards:

### Keyboard Navigation
- **Tab/Shift+Tab**: Navigate interactive elements
- **Enter/Space**: Activate buttons
- **Escape**: Close modals/dialogs
- **Arrow keys**: Navigate grids/lists (where applicable)

### Screen Readers
- All interactive elements have `aria-label` or `aria-labelledby`
- Dynamic content uses `aria-live` regions
- Form controls associated with labels
- Semantic HTML (`<button>`, `<nav>`, etc.)

### Focus Management
- Visible focus indicators (2px ring)
- Focus trapped in modals
- Logical tab order
- Skip links provided

### Color & Contrast
- Minimum contrast ratios met
- Information not conveyed by color alone
- Dark mode with proper contrast
- High-contrast mode support

## Performance

Components are optimized for production use:

- **Memoization**: `useMemo` and `useCallback` prevent unnecessary re-renders
- **Lazy Loading**: Heavy computations deferred until needed
- **Debouncing**: Input handlers debounced for smooth UX
- **Virtual Scrolling**: Large lists use windowing
- **Code Splitting**: Components can be dynamically imported

## Testing

Each component includes:

- **Unit Tests**: Core logic tested with Vitest
- **Accessibility Tests**: `axe-core` integration
- **Keyboard Tests**: All interactions keyboard-testable
- **Visual Regression**: Storybook stories for all variants

## Integration

### Basic Integration

```tsx
// app/algorithms/page.tsx
import { TransformerVisualizer } from '@/components/algorithms';

export default function AlgorithmsPage() {
  return (
    <div className="container mx-auto py-12">
      <h1 className="text-4xl font-bold mb-8">Algorithm Visualizations</h1>
      <TransformerVisualizer />
    </div>
  );
}
```

### With State Management (Zustand)

```tsx
import { create } from 'zustand';
import { TransformerVisualizer } from '@/components/algorithms';
import type { AttentionHead } from '@/components/algorithms';

interface AlgorithmStore {
  attentionHeads: ReadonlyArray<AttentionHead> | null;
  setAttentionHeads: (heads: ReadonlyArray<AttentionHead>) => void;
}

const useAlgorithmStore = create<AlgorithmStore>((set) => ({
  attentionHeads: null,
  setAttentionHeads: (heads) => set({ attentionHeads: heads }),
}));

export default function Page() {
  const setAttentionHeads = useAlgorithmStore((s) => s.setAttentionHeads);

  return (
    <TransformerVisualizer
      onAttentionComputed={setAttentionHeads}
    />
  );
}
```

### With Next.js App Router

```tsx
// app/algorithms/transformer/page.tsx
import { TransformerVisualizer } from '@/components/algorithms';

export const metadata = {
  title: 'Transformer Visualizer | NextCalc',
  description: 'Interactive multi-head attention visualization',
};

export default function TransformerPage() {
  return <TransformerVisualizer showExplanations={true} />;
}
```

### Dynamic Import (Code Splitting)

```tsx
import dynamic from 'next/dynamic';

const TransformerVisualizer = dynamic(
  () => import('@/components/algorithms').then(mod => mod.TransformerVisualizer),
  { ssr: false, loading: () => <p>Loading...</p> }
);

export default function Page() {
  return <TransformerVisualizer />;
}
```

## Styling

Components use Tailwind CSS and respect the application theme:

```tsx
// Custom styling
<TransformerVisualizer className="my-custom-class" />

// With custom theme colors (globals.css)
@theme {
  --color-primary: oklch(0.62 0.22 230); /* Custom primary color */
}
```

## Dependencies

Required packages (already in package.json):

```json
{
  "dependencies": {
    "framer-motion": "12.34.2",
    "lucide-react": "0.575.0",
    "radix-ui": "1.4.4-rc.1766004502650"
  }
}
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

## License

Part of the NextCalc project. See main repository for license details.

## Contributing

See the main NextCalc CONTRIBUTING.md for guidelines.

## Examples

### Complete Example Page

```tsx
// app/algorithms/page.tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TransformerVisualizer,
  ZKPDemo,
  QuantumSimulator,
  PageRankExplorer,
  MetaLearningPlayground,
} from '@/components/algorithms';

export default function AlgorithmsPage() {
  return (
    <div className="container mx-auto py-12 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Algorithm Visualizations</h1>
        <p className="text-muted-foreground">
          Interactive demonstrations of advanced algorithms
        </p>
      </div>

      <Tabs defaultValue="transformer">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="transformer">Transformer</TabsTrigger>
          <TabsTrigger value="zkp">Zero-Knowledge</TabsTrigger>
          <TabsTrigger value="quantum">Quantum</TabsTrigger>
          <TabsTrigger value="pagerank">PageRank</TabsTrigger>
          <TabsTrigger value="maml">Meta-Learning</TabsTrigger>
        </TabsList>

        <TabsContent value="transformer">
          <TransformerVisualizer showExplanations={true} />
        </TabsContent>

        <TabsContent value="zkp">
          <ZKPDemo showExplanations={true} />
        </TabsContent>

        <TabsContent value="quantum">
          <QuantumSimulator initialQubits={3} showExplanations={true} />
        </TabsContent>

        <TabsContent value="pagerank">
          <PageRankExplorer showExplanations={true} />
        </TabsContent>

        <TabsContent value="maml">
          <MetaLearningPlayground showExplanations={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

This creates a comprehensive algorithms playground with all visualizations accessible via tabs.
