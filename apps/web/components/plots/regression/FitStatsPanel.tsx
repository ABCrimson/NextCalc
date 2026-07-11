'use client';

/**
 * Fit statistics panel: fitted parameters, R², RMSE, iterations, convergence
 * status and warnings — plus the residual-segment toggle.
 *
 * Dataviz fundamentals: one panel, one axis of truth, every numeral
 * tabular-nums. A non-converged or failed fit is ALWAYS visibly flagged —
 * never a silent bad fit.
 *
 * @module components/plots/regression/FitStatsPanel
 */

import type { FitResult, FitWarning } from '@nextcalc/math-engine/stats';
import { AlertTriangle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId } from 'react';
import { Badge } from '../../ui/badge';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';

export interface FitStatsPanelProps {
  fit: FitResult | null;
  showResiduals: boolean;
  onToggleResiduals: (value: boolean) => void;
}

/** Maps a fit failure status to its translation key. */
const FAILURE_KEYS = {
  'invalid-model': 'status.invalidModel',
  'insufficient-data': 'status.insufficientData',
  singular: 'status.singular',
  diverged: 'status.diverged',
} as const;

export function FitStatsPanel({ fit, showResiduals, onToggleResiduals }: FitStatsPanelProps) {
  const t = useTranslations('plots.regression');
  const format = useFormatter();
  const toggleId = useId();

  if (fit === null) return null;

  const warningText = (warning: FitWarning): string => {
    switch (warning.code) {
      case 'dropped-rows':
        return t('warnings.droppedRows', { count: warning.count });
      case 'bound-hit':
        return t('warnings.boundHit', { name: warning.name });
      case 'zero-variance':
        return t('warnings.zeroVariance');
    }
  };

  if (!fit.ok) {
    return (
      <div role="alert" className="p-4 rounded-lg border border-red-500/40 bg-red-950/40 space-y-1">
        <p className="text-sm font-semibold text-red-300 flex items-center gap-1.5">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {t(FAILURE_KEYS[fit.status])}
        </p>
        <p className="text-xs text-red-400/80">{fit.message}</p>
      </div>
    );
  }

  const number = (value: number) => format.number(value, { maximumSignificantDigits: 6 });

  return (
    <div className="p-4 rounded-lg bg-background/50 border border-border space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t('stats.title')}</h3>
        {fit.status === 'converged' ? (
          <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-500/10">
            {t('status.converged')}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10">
            {t('status.maxIterations')}
          </Badge>
        )}
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">{t('stats.parameters')}</caption>
        <tbody>
          {Object.entries(fit.parameters).map(([name, value]) => (
            <tr key={name} className="border-b border-border/40 last:border-b-0">
              <th
                scope="row"
                className="py-1.5 pr-4 text-left font-mono font-medium text-muted-foreground"
              >
                {name}
              </th>
              <td className="py-1.5 text-right font-mono tabular-nums text-foreground">
                {number(value)}
                {fit.standardErrors?.[name] !== undefined && (
                  <span className="text-muted-foreground">
                    {' '}
                    ± {format.number(fit.standardErrors[name], { maximumSignificantDigits: 3 })}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t('stats.r2')}</dt>
          <dd className="font-mono tabular-nums text-foreground">
            {format.number(fit.r2, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('stats.rmse')}</dt>
          <dd className="font-mono tabular-nums text-foreground">{number(fit.rmse)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t('stats.iterations')}</dt>
          <dd className="font-mono tabular-nums text-foreground">{fit.iterations}</dd>
        </div>
      </dl>

      {fit.warnings.length > 0 && (
        <ul className="space-y-1">
          {fit.warnings.map((warning) => (
            <li
              key={warning.code + ('name' in warning ? warning.name : '')}
              className="text-xs text-muted-foreground flex items-center gap-1.5"
            >
              <AlertTriangle className="size-3 shrink-0 text-amber-400/70" aria-hidden="true" />
              {warningText(warning)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <Switch id={toggleId} checked={showResiduals} onCheckedChange={onToggleResiduals} />
        <Label htmlFor={toggleId} className="text-xs text-muted-foreground cursor-pointer">
          {t('residualsToggle')}
        </Label>
      </div>
    </div>
  );
}
