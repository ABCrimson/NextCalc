'use client';

import type { EquivalenceResult } from '@nextcalc/math-engine/equivalence';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';
import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface CheckWorkPanelProps {
  /** Canonical parseable expression the student's input is verified against */
  canonical: string;
  /** Optional heading override (defaults to the checkWork.title message) */
  label?: string;
  /**
   * Allow a trailing "+ C" / "+ c" to be stripped from the student's input
   * before comparison. Valid ONLY when `canonical` is an indefinite-integral
   * antiderivative — passing this for any other mode (equation, simplify,
   * derivative) would forgive a spurious constant the student shouldn't
   * have added. Defaults to false.
   */
  allowConstantOfIntegration?: boolean;
}

/** Visual state derived from an equivalence result */
type PanelStatus = 'equivalent' | 'not-equivalent' | 'parse-error' | 'inconclusive';

function statusFor(result: EquivalenceResult): PanelStatus {
  if (result.equivalent) return 'equivalent';
  if (result.reason === 'parse-error') return 'parse-error';
  if (result.reason === 'inconclusive') return 'inconclusive';
  return 'not-equivalent';
}

const STATUS_STYLES: Record<PanelStatus, string> = {
  equivalent: 'bg-green-500/10 border-green-500/30',
  'not-equivalent': 'bg-red-500/10 border-red-500/30',
  'parse-error': 'bg-amber-500/10 border-amber-500/30',
  inconclusive: 'bg-amber-500/10 border-amber-500/30',
};

/**
 * CheckWorkPanel — "Check my work" self-verification widget.
 *
 * The student enters their own form of an answer and the panel verifies
 * mathematical equivalence against the canonical expression via the
 * math-engine equivalence checker (symbolic diff-is-zero with a
 * deterministic seeded numeric-probing fallback). This is a study aid,
 * separate from graded submission — it never records an attempt.
 */
export function CheckWorkPanel({
  canonical,
  label,
  allowConstantOfIntegration = false,
}: CheckWorkPanelProps) {
  const t = useTranslations('checkWork');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<EquivalenceResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();
  const statusId = useId();

  const handleCheck = () => {
    const candidate = input.trim();
    if (candidate.length === 0) return;
    startTransition(async () => {
      // Dynamic import keeps the CAS out of the initial bundle
      const { checkEquivalence, normalizeAnswerExpression } = await import(
        '@nextcalc/math-engine/equivalence'
      );
      setResult(
        checkEquivalence(
          normalizeAnswerExpression(candidate, allowConstantOfIntegration),
          canonical,
        ),
      );
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isPending) {
      event.preventDefault();
      handleCheck();
    }
  };

  const status = result ? statusFor(result) : null;

  return (
    <section
      className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
      aria-label={label ?? t('title')}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-foreground">{label ?? t('title')}</h4>
      </div>
      <p className="text-xs text-muted-foreground">{t('description')}</p>

      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t('inputLabel')}
        </label>
        <Input
          id={inputId}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setResult(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('inputPlaceholder')}
          className="font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-describedby={result ? statusId : undefined}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={input.trim().length === 0 || isPending}
          aria-busy={isPending}
          className="h-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : t('check')}
        </Button>
      </div>

      {result && status && (
        <div
          id={statusId}
          role="status"
          aria-live="polite"
          className={cn('rounded-md border p-3 flex items-start gap-2.5', STATUS_STYLES[status])}
        >
          {status === 'equivalent' && (
            <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-green-500" aria-hidden="true" />
          )}
          {status === 'not-equivalent' && (
            <XCircle className="size-4 mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
          )}
          {(status === 'parse-error' || status === 'inconclusive') && (
            <AlertCircle className="size-4 mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-medium',
                status === 'equivalent' && 'text-green-700 dark:text-green-400',
                status === 'not-equivalent' && 'text-red-700 dark:text-red-400',
                (status === 'parse-error' || status === 'inconclusive') &&
                  'text-amber-700 dark:text-amber-400',
              )}
            >
              {status === 'equivalent' && t('equivalent')}
              {status === 'not-equivalent' && t('notEquivalent')}
              {status === 'parse-error' && t('parseError')}
              {status === 'inconclusive' && t('inconclusive')}
            </p>
            {result.equivalent && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.method === 'symbolic'
                  ? t('verifiedSymbolically')
                  : t('verifiedNumerically')}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
