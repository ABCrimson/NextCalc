'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { LaTeXRenderer } from '@/components/math/latex-renderer';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ShareAngleMode, ShareMode } from '@/lib/share';
import { formatResultWithSeparators, useThousandsSeparator } from '@/lib/stores/settings-store';
import { ExportMenu } from './export-menu';
import { ShareButton } from './share-button';

interface DisplayProps {
  expression: string;
  result: number | string | null;
  isPending?: boolean;
  /** Current calculator mode — forwarded to the share payload. */
  mode?: ShareMode;
  /** Current angle mode — forwarded to the share payload. */
  angle?: ShareAngleMode;
}

function convertToLatex(expr: string): string {
  // Simple conversions
  return expr
    .replace(/\*/g, '\\cdot ')
    .replace(/\^/g, '^')
    .replace(/sqrt\((.*?)\)/g, '\\sqrt{$1}')
    .replace(/pi/g, '\\pi')
    .replace(/sin\((.*?)\)/g, '\\sin($1)')
    .replace(/cos\((.*?)\)/g, '\\cos($1)')
    .replace(/tan\((.*?)\)/g, '\\tan($1)');
}

export function Display({ expression, result, isPending = false, mode, angle }: DisplayProps) {
  const latex = convertToLatex(expression);
  const thousandsSeparator = useThousandsSeparator();

  // Show loading indicator when pending
  const displayResult = isPending && result !== 'Calculating...' ? 'Calculating...' : result;

  // Format the display result with thousands separators when enabled
  const formattedResult = useMemo(
    () => formatResultWithSeparators(displayResult, thousandsSeparator),
    [displayResult, thousandsSeparator],
  );

  // Determine aria-live announcement
  const liveAnnouncement =
    displayResult !== null
      ? `Result: ${formattedResult}`
      : expression
        ? `Expression: ${expression}`
        : 'Calculator ready';

  // Stringify result for share payload (share only actual computed results)
  const shareResult = useMemo<string | undefined>(() => {
    if (result === null || result === 'Calculating...' || result === 'Error') {
      return undefined;
    }
    return String(result);
  }, [result]);

  // Memoize animation variants to prevent re-creation on every render
  const containerVariants = useMemo(
    () => ({
      initial: { opacity: 0, y: -20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
    }),
    [],
  );

  const contentVariants = useMemo(
    () => ({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.3 },
    }),
    [],
  );

  const resultVariants = useMemo(
    () => ({
      initial: { scale: 0.95, opacity: 0 },
      animate: { scale: 1, opacity: isPending ? 0.7 : 1 },
      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
    }),
    [isPending],
  );

  return (
    <motion.div {...containerVariants}>
      {/* ARIA live region for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      <Card
        className="p-6 glass-heavy noise rounded-2xl shadow-2xl shadow-primary/10 ring-1 ring-white/5 transition-all duration-300"
        role="region"
        aria-label="Calculator display"
      >
        {/* Top bar: tab switcher on the left, share button on the right */}
        <div className="flex items-start justify-between mb-6 gap-3 min-w-0">
          <Tabs defaultValue="plain" className="flex-1 min-w-0">
            <TabsList className="bg-black/20 backdrop-blur-md p-1.5 rounded-xl border border-white/5">
              <TabsTrigger
                value="plain"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-calculator-special data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 data-[state=active]:text-white rounded-lg transition-all duration-200 font-medium text-muted-foreground hover:text-foreground px-4 py-2"
              >
                Plain
              </TabsTrigger>
              <TabsTrigger
                value="latex"
                className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-calculator-special data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 data-[state=active]:text-white rounded-lg transition-all duration-200 font-medium text-muted-foreground hover:text-foreground px-4 py-2"
              >
                LaTeX
              </TabsTrigger>
            </TabsList>

            <TabsContent value="plain">
              <motion.div {...contentVariants} className="text-right space-y-3 min-w-0">
                <div
                  className="text-base text-muted-foreground font-mono min-h-[1.75rem] tracking-wider overflow-x-auto whitespace-nowrap scrollbar-none"
                  role="status"
                  aria-label="Current expression"
                >
                  {expression || '\u00A0'}
                </div>
                <motion.div
                  key={String(displayResult)}
                  {...resultVariants}
                  className="text-5xl font-bold font-mono min-h-[3.5rem] bg-gradient-to-br from-sky-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent overflow-x-auto whitespace-nowrap scrollbar-none"
                  role="status"
                  aria-label={displayResult !== null ? `Result: ${formattedResult}` : 'No result'}
                  aria-busy={isPending}
                >
                  {displayResult !== null ? formattedResult : '\u00A0'}
                </motion.div>
              </motion.div>
            </TabsContent>

            <TabsContent value="latex">
              <motion.div {...contentVariants} className="text-right space-y-3 min-w-0">
                {expression && (
                  <div
                    className="min-h-[1.75rem] text-foreground/80 overflow-x-auto"
                    role="status"
                    aria-label={`LaTeX expression: ${expression}`}
                  >
                    <LaTeXRenderer expression={latex} displayMode={true} className="text-base" />
                  </div>
                )}
                {displayResult !== null && (
                  <motion.div
                    key={String(displayResult)}
                    {...resultVariants}
                    className="text-5xl font-bold font-mono bg-gradient-to-br from-sky-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent overflow-x-auto whitespace-nowrap scrollbar-none"
                    role="status"
                    aria-label={`Result: ${formattedResult}`}
                    aria-busy={isPending}
                  >
                    = {formattedResult}
                  </motion.div>
                )}
              </motion.div>
            </TabsContent>
          </Tabs>

          {/* Share + Export buttons — floated to the top-right of the display card.
              exactOptionalPropertyTypes: use conditional spread so we never
              pass `undefined` to an optional prop typed without `undefined`. */}
          <div className="flex-shrink-0 self-start flex items-center gap-1">
            <ExportMenu latex={latex} />
            <ShareButton
              expression={expression}
              {...(shareResult !== undefined ? { result: shareResult } : {})}
              {...(mode !== undefined ? { mode } : {})}
              {...(angle !== undefined ? { angle } : {})}
            />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
