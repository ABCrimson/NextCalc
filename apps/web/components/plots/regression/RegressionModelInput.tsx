'use client';

/**
 * Tilde-syntax regression model input with canned-model chips.
 *
 * Deliberately NOT built on FunctionInput: its expression validator rejects
 * the `~` separator. Validation feedback mirrors FunctionInput's visual
 * language (CheckCircle2 / AlertCircle + text, aria-live).
 *
 * @module components/plots/regression/RegressionModelInput
 */

import { buildCannedModel, type CannedModelKind } from '@nextcalc/math-engine/stats';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

const CANNED_KINDS: readonly CannedModelKind[] = [
  'linear',
  'quadratic',
  'exponential',
  'logarithmic',
  'logistic',
  'sinusoidal',
];

export type ModelParseState =
  | { ok: true; parameters: readonly string[] }
  | { ok: false; message: string };

export interface RegressionModelInputProps {
  model: string;
  onModelChange: (value: string) => void;
  /** First (x) and second (y) data columns used by the canned-model chips. */
  firstX: string;
  firstY: string;
  /** Live parse feedback; null when the input is empty. */
  parseState: ModelParseState | null;
}

export function RegressionModelInput({
  model,
  onModelChange,
  firstX,
  firstY,
  parseState,
}: RegressionModelInputProps) {
  const t = useTranslations('plots.regression');
  const inputId = useId();

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={inputId} className="text-xs text-muted-foreground">
          {t('modelLabel')}
        </Label>
        <Input
          id={inputId}
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder={t('modelPlaceholder')}
          className={`h-9 text-sm font-mono ${
            model.trim() && parseState && !parseState.ok
              ? 'border-red-500 focus:border-red-500'
              : ''
          }`}
        />
        {/* Live validation feedback (same visual language as FunctionInput). */}
        <div className="mt-1 flex items-center gap-1 text-xs" aria-live="polite">
          {model.trim() !== '' && parseState?.ok === true && (
            <>
              <CheckCircle2 className="size-3 text-green-400" aria-hidden="true" />
              <span className="text-green-400 font-mono">
                {t('modelValid', { parameters: parseState.parameters.join(', ') })}
              </span>
            </>
          )}
          {model.trim() !== '' && parseState?.ok === false && (
            <>
              <AlertCircle className="size-3 text-red-400" aria-hidden="true" />
              <span className="text-red-400">{parseState.message}</span>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          {t('cannedTitle')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CANNED_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onModelChange(buildCannedModel(kind, firstX, firstY))}
              className="relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-out text-muted-foreground hover:text-foreground bg-background/40 hover:bg-background/70 border border-border hover:border-transparent hover:shadow-[0_0_0_1.5px_oklch(0.645_0.246_16.44_/_0.5),0_0_12px_oklch(0.645_0.246_16.44_/_0.15)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t(`canned.${kind}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
