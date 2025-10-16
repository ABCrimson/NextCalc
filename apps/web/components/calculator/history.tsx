'use client';

import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { HistoryEntry } from '@nextcalc/types';

interface HistoryProps {
  entries: readonly HistoryEntry[];
  onSelect?: (entry: HistoryEntry) => void;
}

export function History({ entries, onSelect }: HistoryProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-2">History</h3>
      <ScrollArea className="h-48">
        <div className="space-y-2">
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect?.(entry)}
              className="w-full text-left p-2 rounded hover:bg-accent transition-colors"
            >
              <div className="text-sm font-mono text-muted-foreground">
                {entry.expression}
              </div>
              <div className="text-base font-mono font-semibold">
                = {entry.result}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
