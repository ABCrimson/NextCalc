'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const WorksheetEditor = dynamic(
  () =>
    import('@/components/worksheet/worksheet-editor').then((m) => ({
      default: m.WorksheetEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-muted-foreground rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md px-10 py-8 shadow-sm">
          <Loader2
            className="h-8 w-8 animate-spin"
            aria-label="Loading worksheet editor"
          />
          <p className="text-sm">Loading worksheet editor...</p>
        </div>
      </div>
    ),
  }
);

export function WorksheetClientWrapper() {
  return <WorksheetEditor />;
}
