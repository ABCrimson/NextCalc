'use client';

/**
 * Next.js 16 App Router Not Found Page
 *
 * Custom 404 page shown when a route doesn't exist.
 * Features beautiful dark theme consistent with NextCalc Pro design.
 *
 * Features:
 * - Animated 404 text
 * - Helpful navigation links
 * - Gradient accents
 * - Full accessibility support
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/not-found
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Home, Calculator, TrendingUp, Variable } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background via-background/95 to-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-calculator-operator/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <Card className="max-w-2xl w-full p-8 md:p-12 bg-card/95 backdrop-blur-md border-border shadow-2xl">
        <div className="text-center space-y-8">
          {/* Large 404 */}
          <div className="space-y-4">
            <h1 className="text-9xl font-bold bg-gradient-to-r from-primary via-calculator-operator to-calculator-equals bg-clip-text text-transparent">
              404
            </h1>
            <div className="h-1 w-32 mx-auto bg-gradient-to-r from-primary via-calculator-operator to-calculator-equals rounded-full" />
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">
              Page Not Found
            </h2>
            <p className="text-muted-foreground text-lg">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Suggested Actions */}
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground/70 font-medium">
              Here are some helpful links:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/" className="group">
                <Button
                  variant="outline"
                  className="w-full bg-gradient-to-br from-blue-900/30 to-blue-800/30 border-blue-500/40 hover:border-blue-400/70 hover:bg-blue-900/50 transition-all"
                  size="lg"
                >
                  <Home className="h-5 w-5 mr-2" />
                  <span>Home</span>
                </Button>
              </Link>

              <Link href="/plot" className="group">
                <Button
                  variant="outline"
                  className="w-full bg-gradient-to-br from-purple-900/30 to-purple-800/30 border-purple-500/40 hover:border-purple-400/70 hover:bg-purple-900/50 transition-all"
                  size="lg"
                >
                  <TrendingUp className="h-5 w-5 mr-2" />
                  <span>Plot Functions</span>
                </Button>
              </Link>

              <Link href="/symbolic" className="group">
                <Button
                  variant="outline"
                  className="w-full bg-gradient-to-br from-emerald-900/30 to-emerald-800/30 border-emerald-500/40 hover:border-emerald-400/70 hover:bg-emerald-900/50 transition-all"
                  size="lg"
                >
                  <Variable className="h-5 w-5 mr-2" />
                  <span>Symbolic Math</span>
                </Button>
              </Link>

              <Link href="/" className="group">
                <Button
                  variant="outline"
                  className="w-full bg-gradient-to-br from-rose-900/30 to-rose-800/30 border-rose-500/40 hover:border-rose-400/70 hover:bg-rose-900/50 transition-all"
                  size="lg"
                >
                  <Calculator className="h-5 w-5 mr-2" />
                  <span>Calculator</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Back Button */}
          <div className="pt-4">
            <Button
              onClick={() => window.history.back()}
              className="bg-gradient-to-r from-primary via-calculator-operator to-calculator-equals hover:opacity-90 transition-opacity"
              size="lg"
            >
              Go Back
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
