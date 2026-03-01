'use client';

import type { HistoryEntry } from '@nextcalc/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useDeferredValue, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { formatResultWithSeparators, useThousandsSeparator } from '@/lib/stores/settings-store';

interface HistoryProps {
  entries: readonly HistoryEntry[];
  onSelect?: (entry: HistoryEntry) => void;
}

// Memoize individual history items to prevent unnecessary re-renders
const HistoryItem = memo(function HistoryItem({
  entry,
  index,
  onSelect,
  thousandsSeparator,
}: {
  entry: HistoryEntry;
  index: number;
  onSelect?: (entry: HistoryEntry) => void;
  thousandsSeparator: boolean;
}) {
  const formattedResult = formatResultWithSeparators(entry.result, thousandsSeparator);

  return (
    <motion.button
      key={entry.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1],
      }}
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect?.(entry)}
      className="w-full text-left p-4 rounded-xl glass backdrop-blur-md border border-white/10 shadow-sm hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group ring-1 ring-white/5 hover:ring-white/10"
      aria-label={`Load calculation: ${entry.expression} equals ${formattedResult}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-xs text-muted-foreground/60 font-medium tracking-wide uppercase"
          suppressHydrationWarning
        >
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="text-sm font-mono text-muted-foreground mb-2 group-hover:text-foreground transition-colors duration-200">
        {entry.expression}
      </div>
      <div className="text-lg font-mono font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
        = {formattedResult}
      </div>
    </motion.button>
  );
});

export function History({ entries, onSelect }: HistoryProps) {
  // React 19: useDeferredValue keeps UI responsive during expensive history renders
  const deferredEntries = useDeferredValue(entries);
  const thousandsSeparator = useThousandsSeparator();

  // Ref for the parent scrollable element
  const parentRef = useRef<HTMLDivElement>(null);

  // Memoize animation config to prevent recreation on every render
  const containerVariants = useMemo(
    () => ({
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5, delay: 0.4, ease: [0.4, 0, 0.2, 1] as const },
    }),
    [],
  );

  // TanStack Virtual: Virtualize the list for optimal performance with 100+ items
  const virtualizer = useVirtualizer({
    count: deferredEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110, // Estimated height of each item in pixels
    overscan: 5, // Render 5 extra items above/below viewport
    // Enable smooth scrolling behavior
    scrollMargin: 0,
    gap: 8, // Gap between items
  });

  if (deferredEntries.length === 0) {
    return null;
  }

  return (
    <motion.div {...containerVariants}>
      <Card className="p-6 glass-heavy noise rounded-2xl shadow-2xl shadow-primary/10 ring-1 ring-white/5 transition-all duration-300">
        <h3 className="text-xs font-semibold mb-4 text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2">
          <span className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
          History ({deferredEntries.length})
        </h3>

        {/* Virtualized scroll container */}
        <div
          ref={parentRef}
          className="h-56 overflow-auto pr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-background"
          aria-label="Calculation history"
          role="list"
        >
          {/* Virtual list container with absolute positioning */}
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Only render visible items + overscan */}
            <AnimatePresence initial={false}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const entry = deferredEntries[virtualItem.index];
                if (!entry) return null;
                return (
                  <div
                    key={entry.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    role="listitem"
                  >
                    <HistoryItem
                      entry={entry}
                      index={virtualItem.index}
                      thousandsSeparator={thousandsSeparator}
                      {...(onSelect ? { onSelect } : {})}
                    />
                  </div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
