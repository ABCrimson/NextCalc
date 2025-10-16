'use client';

import { Card } from '@/components/ui/card';
import { LaTeXRenderer } from '@/components/math/latex-renderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DisplayProps {
  expression: string;
  result: number | string | null;
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

export function Display({ expression, result }: DisplayProps) {
  const latex = convertToLatex(expression);

  return (
    <Card className="p-4 bg-calculator-display">
      <Tabs defaultValue="plain">
        <TabsList className="mb-4">
          <TabsTrigger value="plain">Plain</TabsTrigger>
          <TabsTrigger value="latex">LaTeX</TabsTrigger>
        </TabsList>

        <TabsContent value="plain">
          <div className="text-right space-y-2">
            <div className="text-sm text-muted-foreground font-mono min-h-6">
              {expression || '\u00A0'}
            </div>
            <div className="text-3xl font-bold font-mono min-h-12">
              {result !== null ? String(result) : '\u00A0'}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="latex">
          <div className="text-right space-y-2">
            {expression && (
              <LaTeXRenderer
                expression={latex}
                displayMode={true}
                className="text-sm"
              />
            )}
            {result !== null && (
              <div className="text-3xl font-bold font-mono">
                = {String(result)}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
