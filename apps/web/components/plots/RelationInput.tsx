'use client';

/**
 * Interactive relation/inequality input component for plotting.
 * Lets users enter one or more relations (equations and inequalities) that
 * together form a system: `x^2 + y^2 = 25`, `y > x^2`, chained comparisons
 * like `1 < x < 4`, and multi-line systems (each entry shades its own
 * region, following {@link Plot2DRelationConfig}'s 'separate' combine mode).
 * @module components/plots/RelationInput
 */

import { isRelationalExpression, parseRelationSystem } from '@nextcalc/math-engine';
import { AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/** A single relation/inequality entry in a (possibly multi-relation) system. */
export interface RelationDefinition {
  id: string;
  expression: string;
  label: string;
  color: string;
  isValid: boolean;
  error?: string;
  /**
   * Number of {@link RelationalNode}s this expression decomposes into.
   * Always 1, except for chained comparisons (`1 < x < 4`) which decompose
   * into 2+ relations that together describe a single shaded band.
   * `undefined` until the expression has been validated.
   */
  relationCount?: number;
}

export interface RelationInputProps {
  relations: RelationDefinition[];
  onChange: (relations: RelationDefinition[]) => void;
  maxRelations?: number;
  className?: string;
}

/** Swatch palette for relation entries — mirrors plot-engine's own fallback colors. */
export const RELATION_COLORS = [
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#38bdf8', // sky
  '#f472b6', // pink
  '#34d399', // teal
] as const;

/**
 * Validates a relation expression, returning a localized error message on
 * failure. Never throws — parse failures from {@link parseRelationSystem}
 * are caught and mapped to a generic, translated message.
 */
function validateRelation(
  expression: string,
  t: ReturnType<typeof useTranslations>,
): { isValid: boolean; error?: string; relationCount?: number } {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { isValid: false, error: t('relation.errorEmpty') };
  }

  if (!isRelationalExpression(trimmed)) {
    return { isValid: false, error: t('relation.errorNotRelation') };
  }

  try {
    const parsed = parseRelationSystem(trimmed);
    return { isValid: true, relationCount: parsed.length };
  } catch {
    return { isValid: false, error: t('relation.errorInvalid') };
  }
}

/**
 * Interactive relation/inequality system input panel.
 * Each entry is validated on change via {@link parseRelationSystem}; parse
 * errors surface inline per-entry and never crash the panel.
 */
export function RelationInput({
  relations,
  onChange,
  maxRelations = 8,
  className = '',
}: RelationInputProps) {
  const t = useTranslations('plots');
  const [localRelations, setLocalRelations] = useState<RelationDefinition[]>(relations);

  // Sync with parent when relations change externally (e.g. preset load)
  useEffect(() => {
    setLocalRelations(relations);
  }, [relations]);

  const handleExpressionChange = useCallback(
    (id: string, expression: string) => {
      const validation = validateRelation(expression, t);

      const updated = localRelations.map(
        (rel): RelationDefinition =>
          rel.id === id
            ? {
                id: rel.id,
                label: rel.label,
                color: rel.color,
                expression,
                isValid: validation.isValid,
                ...(validation.error !== undefined ? { error: validation.error } : {}),
                ...(validation.relationCount !== undefined
                  ? { relationCount: validation.relationCount }
                  : {}),
              }
            : rel,
      );

      setLocalRelations(updated);
      onChange(updated);
    },
    [localRelations, onChange, t],
  );

  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      const updated = localRelations.map((rel) => (rel.id === id ? { ...rel, label } : rel));
      setLocalRelations(updated);
      onChange(updated);
    },
    [localRelations, onChange],
  );

  const handleColorChange = useCallback(
    (id: string, color: string) => {
      const updated = localRelations.map((rel) => (rel.id === id ? { ...rel, color } : rel));
      setLocalRelations(updated);
      onChange(updated);
    },
    [localRelations, onChange],
  );

  const handleAdd = useCallback(() => {
    if (localRelations.length >= maxRelations) return;

    const newId = `rel-${Date.now()}`;
    const colorIndex = localRelations.length % RELATION_COLORS.length;

    const newRelation: RelationDefinition = {
      id: newId,
      expression: '',
      label: `R${localRelations.length + 1}`,
      color: RELATION_COLORS[colorIndex] ?? '#06b6d4',
      isValid: false,
      error: t('relation.errorEmpty'),
    };

    const updated = [...localRelations, newRelation];
    setLocalRelations(updated);
    onChange(updated);
  }, [localRelations, maxRelations, onChange, t]);

  const handleRemove = useCallback(
    (id: string) => {
      const updated = localRelations.filter((rel) => rel.id !== id);
      setLocalRelations(updated);
      onChange(updated);
    },
    [localRelations, onChange],
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t('relation.inputTitle')}</h3>
        <Button
          onClick={handleAdd}
          size="sm"
          variant="outline"
          disabled={localRelations.length >= maxRelations}
          className="text-xs"
        >
          <Plus className="size-3 mr-1" />
          {t('relation.addButton')}
        </Button>
      </div>

      <div className="space-y-3">
        {localRelations.map((rel) => (
          <div
            key={rel.id}
            className="relative p-4 rounded-lg bg-background/50 border border-border"
          >
            <div className="flex items-start gap-3">
              {/* Color picker */}
              <div className="flex-shrink-0 pt-1">
                <input
                  type="color"
                  value={rel.color}
                  onChange={(e) => handleColorChange(rel.id, e.target.value)}
                  className="size-8 rounded cursor-pointer border-2 border-border"
                  aria-label={t('relation.colorLabel', { label: rel.label })}
                />
              </div>

              {/* Relation inputs */}
              <div className="flex-1 space-y-2">
                {/* Label input */}
                <div>
                  <Label htmlFor={`${rel.id}-label`} className="text-xs text-muted-foreground">
                    {t('relation.labelField')}
                  </Label>
                  <Input
                    id={`${rel.id}-label`}
                    value={rel.label}
                    onChange={(e) => handleLabelChange(rel.id, e.target.value)}
                    className="h-8 text-sm"
                    placeholder={t('relation.labelField')}
                  />
                </div>

                {/* Expression input */}
                <div>
                  <Label htmlFor={`${rel.id}-expr`} className="text-xs text-muted-foreground">
                    {t('relation.expressionField')}
                  </Label>
                  <Input
                    id={`${rel.id}-expr`}
                    value={rel.expression}
                    onChange={(e) => handleExpressionChange(rel.id, e.target.value)}
                    className={`h-8 text-sm font-mono ${
                      rel.expression && !rel.isValid ? 'border-red-500 focus:border-red-500' : ''
                    }`}
                    placeholder={t('relation.placeholder')}
                    aria-invalid={Boolean(rel.expression && !rel.isValid)}
                  />

                  {/* Validation indicator */}
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    {rel.expression && rel.isValid && (
                      <>
                        <CheckCircle2 className="size-3 text-green-400" />
                        <span className="text-green-400">
                          {rel.relationCount && rel.relationCount > 1
                            ? t('relation.validChained')
                            : t('relation.validSingle')}
                        </span>
                      </>
                    )}
                    {rel.expression && !rel.isValid && rel.error && (
                      <>
                        <AlertCircle className="size-3 text-red-400" />
                        <span className="text-red-400">{rel.error}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(rel.id)}
                className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"
                aria-label={t('relation.removeLabel', { label: rel.label })}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {localRelations.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground">{t('relation.emptyTitle')}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{t('relation.emptyHint')}</p>
        </div>
      )}

      {/* Helper text */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>{t('relation.helperOperators')}</p>
        <p>{t('relation.helperChained')}</p>
        <p>{t('relation.helperSystem')}</p>
      </div>
    </div>
  );
}
