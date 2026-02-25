'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';
import { PlotAnalysisPanel } from '@/components/plots/PlotAnalysisPanel';
import type { AnalysisFunction } from '@/components/plots/PlotAnalysisPanel';
import { evaluate } from '@nextcalc/math-engine';

/**
 * Symbolic Mathematics Panel
 *
 * Provides UI for symbolic differentiation and integration.
 * After a successful differentiation, shows an "Analysis: Intercepts &
 * Critical Points" panel for both the original function and its derivative.
 *
 * Accessibility:
 * - ARIA labels for all inputs
 * - Keyboard navigable
 * - Screen reader friendly with aria-live regions
 * - Error announcements via aria-live="assertive"
 *
 * @example
 * <SymbolicPanel />
 */

export function SymbolicPanel() {
  const [expression, setExpression] = useState('x^2 + sin(x)');
  const [variable, setVariable] = useState('x');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeOperation, setActiveOperation] = useState<'differentiate' | 'integrate' | null>(null);

  const handleDifferentiate = async () => {
    setIsCalculating(true);
    setError(null);
    setResult(null);
    setActiveOperation(null);

    try {
      const { differentiate, astToString } = await import('@nextcalc/math-engine/symbolic');
      const { parse } = await import('@nextcalc/math-engine/parser');

      const ast = parse(expression);
      const derivative = differentiate(ast, variable);
      setResult(astToString(derivative));
      setActiveOperation('differentiate');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to differentiate expression');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleIntegrate = async () => {
    setIsCalculating(true);
    setError(null);
    setResult(null);
    setActiveOperation(null);

    try {
      const { integrate, astToString } = await import('@nextcalc/math-engine/symbolic');
      const { parse } = await import('@nextcalc/math-engine/parser');

      const ast = parse(expression);
      const integral = integrate(ast, variable);
      setResult(astToString(integral) + ' + C');
      setActiveOperation('integrate');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to integrate expression');
    } finally {
      setIsCalculating(false);
    }
  };

  const diffExamples = [
    { expr: 'x^2', label: 'Polynomial' },
    { expr: 'sin(x)', label: 'Trigonometric' },
    { expr: 'exp(x)', label: 'Exponential' },
    { expr: 'ln(x)', label: 'Logarithmic' },
    { expr: 'x^2 * sin(x)', label: 'Product rule' },
    { expr: 'sin(x) / x', label: 'Quotient rule' },
    { expr: 'atan(x^2)', label: 'Chain rule' },
    { expr: 'x^3 * exp(x)', label: 'Poly × Exp' },
    { expr: 'ln(x) * cos(x)', label: 'Log × Trig' },
    { expr: 'sqrt(x^2 + 1)', label: 'Radical chain' },
  ];

  const intExamples = [
    { expr: 'x^2', label: 'Power rule' },
    { expr: 'sin(x)', label: 'Trigonometric' },
    { expr: 'exp(x)', label: 'Exponential' },
    { expr: 'ln(x)', label: 'Logarithmic' },
    { expr: 'x * sin(x)', label: 'IBP: x·sin' },
    { expr: 'sin(x) / x', label: 'Sine Integral' },
    { expr: 'cos(x) / x', label: 'Cosine Integral' },
    { expr: 'x^2 * exp(x)', label: 'IBP: x²·eˣ' },
    { expr: 'x * ln(x)', label: 'IBP: x·ln' },
    { expr: 'asin(x)', label: 'Inverse trig' },
  ];

  // ---------------------------------------------------------------------------
  // Analysis panel — build AnalysisFunction array for the original function and
  // its derivative when differentiation has been performed.
  // ---------------------------------------------------------------------------

  const analysisFunctions = useMemo<AnalysisFunction[]>(() => {
    if (activeOperation !== 'differentiate' || !result || variable !== 'x') return [];

    const fns: AnalysisFunction[] = [];

    // Original function
    const origExpr = expression.trim();
    if (origExpr) {
      fns.push({
        fn: (x: number) => {
          const r = evaluate(origExpr, { variables: { x } });
          return r.success ? Number(r.value) : NaN;
        },
        label: `f(x) = ${origExpr}`,
        color: '#60a5fa', // blue-400
      });
    }

    // Derivative
    const derivExpr = result.trim();
    if (derivExpr) {
      fns.push({
        fn: (x: number) => {
          const r = evaluate(derivExpr, { variables: { x } });
          return r.success ? Number(r.value) : NaN;
        },
        label: `f'(x) = ${derivExpr}`,
        color: '#f472b6', // pink-400
      });
    }

    return fns;
  }, [activeOperation, result, expression, variable]);

  // Fixed symmetric viewport covering a useful range for most school functions
  const analysisViewport = { xMin: -6, xMax: 6, yMin: -10, yMax: 10 };

  return (
    <Card className="p-6">
      <Tabs defaultValue="differentiate" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="differentiate">
            Differentiate (d/d{variable})
          </TabsTrigger>
          <TabsTrigger value="integrate">
            Integrate (&int;d{variable})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="differentiate" className="space-y-6">
          {/* Info banner */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Symbolic differentiation with chain, product, and quotient rules.
              After computing, the analysis panel below will show intercepts and critical points.
            </AlertDescription>
          </Alert>

          {/* Input section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="expression" className="text-base">
                Function f({variable})
              </Label>
              <Input
                id="expression"
                value={expression}
                onChange={(e) => { setExpression(e.target.value); setActiveOperation(null); }}
                placeholder="x^2 + sin(x)"
                className="font-mono mt-2"
                aria-describedby="expression-help"
              />
              <p id="expression-help" className="text-xs text-muted-foreground mt-1">
                Enter a mathematical expression using x, +, -, *, /, ^, sin, cos, tan, exp, ln, sqrt
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="variable" className="text-base">
                With respect to
              </Label>
              <Input
                id="variable"
                value={variable}
                onChange={(e) => { setVariable(e.target.value); setActiveOperation(null); }}
                placeholder="x"
                className="w-20 font-mono"
                maxLength={1}
              />
            </div>

            <Button
              onClick={handleDifferentiate}
              className="w-full"
              disabled={isCalculating || !expression.trim()}
              aria-label={`Calculate derivative of ${expression} with respect to ${variable}`}
            >
              {isCalculating ? 'Calculating...' : `Calculate d/d${variable}`}
            </Button>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive" role="alert" aria-live="assertive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Result display */}
          {result && !error && (
            <div className="p-6 bg-muted rounded-lg space-y-3" role="region" aria-label="Calculation result">
              <div className="text-sm text-muted-foreground font-semibold">
                Result:
              </div>
              <div className="text-xl font-mono break-all">
                {result}
              </div>
              <div className="text-xs text-muted-foreground pt-2 border-t">
                d/d{variable} [{expression}] = {result}
              </div>
            </div>
          )}

          {/* Critical points analysis — shown after successful differentiation with variable=x */}
          {analysisFunctions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Analysis computed over x &isin; [&minus;6, 6]. Scroll into range and re-compute if your function lives on a different domain.
              </p>
              <PlotAnalysisPanel
                functions={analysisFunctions}
                viewport={analysisViewport}
                samples={500}
              />
            </div>
          )}

          {/* Example expressions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Example Expressions:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {diffExamples.map((example) => (
                <Button
                  key={example.expr}
                  variant="outline"
                  size="sm"
                  onClick={() => { setExpression(example.expr); setActiveOperation(null); }}
                  className="justify-start font-mono text-xs"
                  title={example.label}
                >
                  <span className="truncate">{example.expr}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Help section */}
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold hover:text-primary">
              Supported Functions
            </summary>
            <div className="mt-2 space-y-2 text-muted-foreground">
              <p><strong>Trigonometric:</strong> sin(x), cos(x), tan(x), sec(x), csc(x), cot(x)</p>
              <p><strong>Inverse Trig:</strong> asin(x), acos(x), atan(x), asec(x), acsc(x), acot(x)</p>
              <p><strong>Hyperbolic:</strong> sinh(x), cosh(x), tanh(x)</p>
              <p><strong>Exponential:</strong> exp(x), 2^x, 10^x</p>
              <p><strong>Logarithmic:</strong> ln(x), log(x), log10(x)</p>
              <p><strong>Other:</strong> sqrt(x), abs(x), x^n</p>
              <p><strong>Operations:</strong> +, -, *, /, ^, ()</p>
            </div>
          </details>
        </TabsContent>

        <TabsContent value="integrate" className="space-y-6">
          {/* Info banner */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Symbolic integration supports power rule, exponential, logarithmic, trigonometric, and
              integration by parts. Special functions Si(x) and Ci(x) are returned for sin(x)/x and
              cos(x)/x respectively. Complex expressions will suggest numerical integration.
            </AlertDescription>
          </Alert>

          {/* Input section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="expression-int" className="text-base">
                Integrand f({variable})
              </Label>
              <Input
                id="expression-int"
                value={expression}
                onChange={(e) => { setExpression(e.target.value); setActiveOperation(null); }}
                placeholder="x^2 + sin(x)"
                className="font-mono mt-2"
                aria-describedby="expression-int-help"
              />
              <p id="expression-int-help" className="text-xs text-muted-foreground mt-1">
                Enter a mathematical expression to integrate
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="variable-int" className="text-base">
                With respect to
              </Label>
              <Input
                id="variable-int"
                value={variable}
                onChange={(e) => { setVariable(e.target.value); setActiveOperation(null); }}
                placeholder="x"
                className="w-20 font-mono"
                maxLength={1}
              />
            </div>

            <Button
              onClick={handleIntegrate}
              className="w-full"
              disabled={isCalculating || !expression.trim()}
              aria-label={`Calculate integral of ${expression} with respect to ${variable}`}
            >
              {isCalculating ? 'Calculating...' : `Calculate \u222b d${variable}`}
            </Button>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive" role="alert" aria-live="assertive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Result display */}
          {result && !error && (
            <div className="p-6 bg-muted rounded-lg space-y-3" role="region" aria-label="Integration result">
              <div className="text-sm text-muted-foreground font-semibold">
                Result:
              </div>
              <div className="text-xl font-mono break-all">
                {result}
              </div>
              <div className="text-xs text-muted-foreground pt-2 border-t">
                &int; [{expression}] d{variable} = {result}
              </div>
            </div>
          )}

          {/* Example expressions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Example Integrands:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {intExamples.map((example) => (
                <Button
                  key={example.expr}
                  variant="outline"
                  size="sm"
                  onClick={() => { setExpression(example.expr); setActiveOperation(null); }}
                  className="justify-start font-mono text-xs"
                  title={example.label}
                >
                  <span className="truncate">{example.expr}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Help section */}
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold hover:text-primary">
              Supported Functions
            </summary>
            <div className="mt-2 space-y-2 text-muted-foreground">
              <p><strong>Trigonometric:</strong> sin(x), cos(x), tan(x), sec(x), csc(x), cot(x)</p>
              <p><strong>Inverse Trig:</strong> asin(x), acos(x), atan(x), asec(x), acsc(x), acot(x)</p>
              <p><strong>Hyperbolic:</strong> sinh(x), cosh(x), tanh(x)</p>
              <p><strong>Exponential:</strong> exp(x), 2^x, 10^x, a^x</p>
              <p><strong>Logarithmic:</strong> ln(x), log(x), log10(x), log2(x)</p>
              <p><strong>Power:</strong> x^n (n &ne; -1)</p>
              <p className="text-xs italic pt-2 border-t">
                Note: Complex expressions may suggest numerical integration. Division and chain rule patterns have limited support.
              </p>
            </div>
          </details>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
