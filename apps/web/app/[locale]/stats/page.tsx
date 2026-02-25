import { StatsPanel } from '@/components/calculator/stats-panel';
import { BarChart3 } from 'lucide-react';

export const metadata = {
  title: 'Statistical Analysis - NextCalc Pro',
  description:
    'Comprehensive descriptive statistics and regression analysis for data insights',
};

/**
 * Statistics Page
 *
 * Provides comprehensive statistical analysis including:
 * - Descriptive statistics (mean, median, mode, std dev, quartiles)
 * - Regression analysis (linear, polynomial, exponential)
 * - Data visualization (box plots)
 * - Prediction tools
 *
 * Fully accessible with WCAG 2.2 AAA compliance.
 */
export default function StatsPage() {
  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient mesh gradient background — matches the app-wide design language */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(at 15% 25%, oklch(0.65 0.22 264 / 0.07) 0%, transparent 55%),
            radial-gradient(at 85% 75%, oklch(0.63 0.20 300 / 0.06) 0%, transparent 55%),
            radial-gradient(at 50% 10%, oklch(0.65 0.18 155 / 0.05) 0%, transparent 50%),
            radial-gradient(at 70% 40%, oklch(0.78 0.18 80 / 0.04) 0%, transparent 45%)
          `,
        }}
        aria-hidden="true"
      />
      {/* Noise texture for depth */}
      <div
        className="fixed inset-0 -z-10 noise pointer-events-none"
        aria-hidden="true"
      />

      <div className="container mx-auto py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Page Hero */}
          <header className="text-center space-y-3">
            {/* Icon badge */}
            <div className="inline-flex items-center justify-center mb-1">
              <div
                className="p-3.5 rounded-2xl"
                style={{
                  background: 'oklch(0.65 0.22 264 / 0.10)',
                  border: '1px solid oklch(0.65 0.22 264 / 0.22)',
                  boxShadow: '0 0 24px oklch(0.65 0.22 264 / 0.15)',
                }}
                aria-hidden="true"
              >
                <BarChart3
                  className="h-8 w-8"
                  style={{ color: 'oklch(0.65 0.22 264)' }}
                />
              </div>
            </div>

            <h1
              className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, oklch(0.65 0.22 264) 0%, oklch(0.63 0.20 300) 50%, oklch(0.65 0.18 155) 100%)',
              }}
            >
              Statistical Analysis
            </h1>

            {/* Gradient underline accent */}
            <div
              className="h-1 w-32 mx-auto rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, oklch(0.65 0.22 264), oklch(0.63 0.20 300), oklch(0.65 0.18 155))',
              }}
              aria-hidden="true"
            />

            <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
              Compute descriptive statistics, run regression analysis, visualize
              distributions, and generate predictions from your data.
            </p>

            {/* Feature pill badges */}
            <div
              className="flex flex-wrap items-center justify-center gap-2 pt-1"
              aria-label="Available features"
            >
              {(
                [
                  { label: 'Descriptive Stats', color: 'oklch(0.65 0.22 264)' },
                  { label: 'Regression Analysis', color: 'oklch(0.63 0.20 300)' },
                  { label: 'Box Plot', color: 'oklch(0.65 0.18 155)' },
                  { label: 'Predictions', color: 'oklch(0.78 0.18 80)' },
                ] as const
              ).map(({ label, color }) => (
                <span
                  key={label}
                  className="text-xs font-medium px-3 py-1 rounded-full border"
                  style={{
                    background: `${color.replace(')', ' / 0.10)')}`,
                    borderColor: `${color.replace(')', ' / 0.25)')}`,
                    color,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </header>

          {/* Gradient separator */}
          <div
            className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
            aria-hidden="true"
          />

          {/* Stats Panel */}
          <StatsPanel />

          {/* Footer note */}
          <footer>
            <div
              className="h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent mb-5"
              aria-hidden="true"
            />
            <p className="text-center text-xs text-muted-foreground">
              All calculations run client-side for instant, private analysis
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
