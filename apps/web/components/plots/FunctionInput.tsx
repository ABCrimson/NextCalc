'use client';

/**
 * Interactive function input component for plotting
 * Allows users to enter custom functions with real-time validation
 * @module components/plots/FunctionInput
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { isValidExpression, extractVariables, evaluate } from '@nextcalc/math-engine';

export interface FunctionDefinition {
  id: string;
  expression: string;
  label: string;
  color: string;
  isValid: boolean;
  error?: string;
}

export interface FunctionInputProps {
  functions: FunctionDefinition[];
  onChange: (functions: FunctionDefinition[]) => void;
  plotType?: '2d-cartesian' | '2d-polar' | '2d-parametric';
  maxFunctions?: number;
  className?: string;
}

const DEFAULT_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#059669', // emerald
  '#8b5cf6', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#be123c', // rose
  '#4f46e5', // indigo
];

/**
 * Interactive function input panel
 */
export function FunctionInput({
  functions,
  onChange,
  plotType = '2d-cartesian',
  maxFunctions = 8,
  className = '',
}: FunctionInputProps) {
  const [localFunctions, setLocalFunctions] = useState<FunctionDefinition[]>(functions);

  // Sync with parent when functions change
  useEffect(() => {
    setLocalFunctions(functions);
  }, [functions]);

  const validateFunction = useCallback((expression: string): { isValid: boolean; error?: string } => {
    if (!expression.trim()) {
      return { isValid: false, error: 'Expression cannot be empty' };
    }

    try {
      // Check syntax
      if (!isValidExpression(expression)) {
        return { isValid: false, error: 'Invalid syntax' };
      }

      // Extract variables
      const variables = extractVariables(expression);

      // For 2D Cartesian, expect 'x' variable
      if (plotType === '2d-cartesian') {
        if (!variables.has('x') && variables.size > 0) {
          return { isValid: false, error: 'Expected variable "x"' };
        }
      }

      // For 2D Polar, expect 'theta' or 'θ' variable
      if (plotType === '2d-polar') {
        const hasTheta = variables.has('theta') || variables.has('θ');
        if (!hasTheta && variables.size > 0) {
          return { isValid: false, error: 'Expected variable "theta" or "θ"' };
        }
      }

      // Test evaluation with a sample value
      const testVariable = plotType === '2d-polar' ? 'theta' : 'x';
      const result = evaluate(expression, { variables: { [testVariable]: 1 } });

      if (!result.success) {
        return { isValid: false, error: 'Evaluation error' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: error instanceof Error ? error.message : 'Validation failed' };
    }
  }, [plotType]);

  const handleExpressionChange = useCallback((id: string, expression: string) => {
    const validation = validateFunction(expression);

    const updated = localFunctions.map(fn =>
      fn.id === id
        ? { ...fn, expression, isValid: validation.isValid, ...(validation.error !== undefined ? { error: validation.error } : {}) }
        : fn
    );

    setLocalFunctions(updated);
    onChange(updated);
  }, [localFunctions, onChange, validateFunction]);

  const handleLabelChange = useCallback((id: string, label: string) => {
    const updated = localFunctions.map(fn =>
      fn.id === id ? { ...fn, label } : fn
    );

    setLocalFunctions(updated);
    onChange(updated);
  }, [localFunctions, onChange]);

  const handleColorChange = useCallback((id: string, color: string) => {
    const updated = localFunctions.map(fn =>
      fn.id === id ? { ...fn, color } : fn
    );

    setLocalFunctions(updated);
    onChange(updated);
  }, [localFunctions, onChange]);

  const handleAdd = useCallback(() => {
    if (localFunctions.length >= maxFunctions) return;

    const newId = `fn-${Date.now()}`;
    const colorIndex = localFunctions.length % DEFAULT_COLORS.length;

    const newFunction: FunctionDefinition = {
      id: newId,
      expression: '',
      label: `f${localFunctions.length + 1}(x)`,
      color: DEFAULT_COLORS[colorIndex]!,
      isValid: false,
      error: 'Expression cannot be empty',
    };

    const updated = [...localFunctions, newFunction];
    setLocalFunctions(updated);
    onChange(updated);
  }, [localFunctions, maxFunctions, onChange]);

  const handleRemove = useCallback((id: string) => {
    const updated = localFunctions.filter(fn => fn.id !== id);
    setLocalFunctions(updated);
    onChange(updated);
  }, [localFunctions, onChange]);

  const getPlaceholder = () => {
    switch (plotType) {
      case '2d-polar':
        return 'e.g., 2 + sin(5*theta)';
      case '2d-parametric':
        return 'x(t) and y(t) functions';
      default:
        return 'e.g., sin(x) or x^2';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Functions</h3>
        <Button
          onClick={handleAdd}
          size="sm"
          variant="outline"
          disabled={localFunctions.length >= maxFunctions}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Function
        </Button>
      </div>

      <div className="space-y-3">
        {localFunctions.map((fn) => (
          <div
            key={fn.id}
            className="relative p-4 rounded-lg bg-background/50 border border-border"
          >
            <div className="flex items-start gap-3">
              {/* Color picker */}
              <div className="flex-shrink-0 pt-1">
                <input
                  type="color"
                  value={fn.color}
                  onChange={(e) => handleColorChange(fn.id, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-2 border-border"
                  aria-label={`Color for ${fn.label}`}
                />
              </div>

              {/* Function inputs */}
              <div className="flex-1 space-y-2">
                {/* Label input */}
                <div>
                  <Label htmlFor={`${fn.id}-label`} className="text-xs text-muted-foreground">
                    Label
                  </Label>
                  <Input
                    id={`${fn.id}-label`}
                    value={fn.label}
                    onChange={(e) => handleLabelChange(fn.id, e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Function label"
                  />
                </div>

                {/* Expression input */}
                <div>
                  <Label htmlFor={`${fn.id}-expr`} className="text-xs text-muted-foreground">
                    Expression
                  </Label>
                  <Input
                    id={`${fn.id}-expr`}
                    value={fn.expression}
                    onChange={(e) => handleExpressionChange(fn.id, e.target.value)}
                    className={`h-8 text-sm font-mono ${
                      fn.expression && !fn.isValid ? 'border-red-500 focus:border-red-500' : ''
                    }`}
                    placeholder={getPlaceholder()}
                  />

                  {/* Validation indicator */}
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    {fn.expression && fn.isValid && (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                        <span className="text-green-400">Valid</span>
                      </>
                    )}
                    {fn.expression && !fn.isValid && fn.error && (
                      <>
                        <AlertCircle className="h-3 w-3 text-red-400" />
                        <span className="text-red-400">{fn.error}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Remove button */}
              <button
                onClick={() => handleRemove(fn.id)}
                className="flex-shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"
                aria-label={`Remove ${fn.label}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {localFunctions.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground">No functions added yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Click "Add Function" to get started</p>
        </div>
      )}

      {/* Helper text */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Supported functions: sin, cos, tan, exp, log, sqrt, abs, etc.</p>
        <p>Use standard operators: +, -, *, /, ^ (power)</p>
        <p>Constants: pi (π), e, tau (τ)</p>
      </div>
    </div>
  );
}
