'use client';

import dynamic from 'next/dynamic';

/**
 * Client-side lazy loader for the TransformerVisualizer.
 *
 * `ssr: false` is only allowed inside Client Components, so this thin wrapper
 * keeps the heavy visualizer out of the server bundle while the page itself
 * stays a Server Component.
 */
export const TransformerVisualizerLazy = dynamic(
  () =>
    import('@/components/algorithms/TransformerVisualizer').then((m) => ({
      default: m.TransformerVisualizer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded-lg w-48" />
        <div className="h-80 bg-muted rounded-xl" />
      </div>
    ),
  },
);
