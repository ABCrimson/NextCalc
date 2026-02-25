'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

interface PracticeSession {
  id: string;
  topic: string;
  score: number;
  accuracy: number;
  totalTime: number;
  completedAt: string | null;
}

interface PracticeHistoryTableProps {
  sessions: PracticeSession[];
}

const PAGE_SIZE = 10;

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 90) return 'text-[oklch(0.65_0.22_145)]';
  if (accuracy >= 70) return 'text-[oklch(0.65_0.20_200)]';
  if (accuracy >= 50) return 'text-[oklch(0.65_0.20_60)]';
  return 'text-[oklch(0.60_0.20_15)]';
}

export function PracticeHistoryTable({ sessions }: PracticeHistoryTableProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const pageSlice = sessions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const handlePrev = () => setPage((p) => Math.max(0, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Practice History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-base font-medium text-foreground">No practice sessions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete a practice session to see your history here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-semibold text-muted-foreground"
                  >
                    Topic
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-muted-foreground"
                  >
                    Score
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-muted-foreground"
                  >
                    Accuracy
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-muted-foreground"
                  >
                    Time
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-muted-foreground"
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageSlice.map((session, idx) => (
                  <tr
                    key={session.id}
                    className={[
                      'border-b border-border/50 transition-colors hover:bg-muted/30',
                      idx % 2 === 0 ? '' : 'bg-muted/10',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {session.topic}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {session.score.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${getAccuracyColor(session.accuracy)}`}>
                      {session.accuracy.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatTime(session.totalTime)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatDate(session.completedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {sessions.length > PAGE_SIZE && (
        <CardFooter className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sessions.length)} of{' '}
            {sessions.length} sessions
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={page === 0}
              className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={page >= totalPages - 1}
              className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
