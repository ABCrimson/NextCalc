'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TopicMastery {
  topic: string;
  mastery: number;
  problemsSolved: number;
}

interface TrendPoint {
  date: string;
  accuracy: number;
}

interface StreakPoint {
  date: string;
  streak: number;
}

interface AnalyticsChartsProps {
  topicMastery: TopicMastery[];
  accuracyTrend: TrendPoint[];
  streakHistory: StreakPoint[];
}

// ---------------------------------------------------------------------------
// TopicMasteryChart
// ---------------------------------------------------------------------------

function getMasteryColor(mastery: number): string {
  if (mastery >= 80) return 'oklch(0.65 0.25 145)';
  if (mastery >= 60) return 'oklch(0.65 0.20 200)';
  if (mastery >= 40) return 'oklch(0.65 0.20 264)';
  return 'oklch(0.60 0.15 30)';
}

function TopicMasteryChart({ data }: { data: TopicMastery[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No topic data available yet.
      </p>
    );
  }

  const sorted = [...data].sort((a, b) => b.mastery - a.mastery);

  return (
    <div
      className="space-y-3"
      role="list"
      aria-label="Topic mastery levels"
    >
      {sorted.map((item) => (
        <div key={item.topic} role="listitem" className="group">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{item.topic}</span>
            <span className="tabular-nums text-muted-foreground">
              {item.mastery}% · {item.problemsSolved} solved
            </span>
          </div>
          <div
            className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={item.mastery}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${item.topic} mastery: ${item.mastery}%`}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${item.mastery}%`,
                background: `linear-gradient(to right, ${getMasteryColor(item.mastery)}, ${getMasteryColor(Math.min(item.mastery + 15, 100))})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccuracyTrendChart
// ---------------------------------------------------------------------------

const CHART_WIDTH = 560;
const CHART_HEIGHT = 160;
const PADDING = { top: 12, right: 16, bottom: 32, left: 36 };

function AccuracyTrendChart({ data }: { data: TrendPoint[] }) {
  const { points, pathD, fillD, xLabels, yTicks } = useMemo(() => {
    if (data.length < 2) return { points: [], pathD: '', fillD: '', xLabels: [], yTicks: [] };

    const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
    const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const pts = data.map((d, i) => ({
      x: PADDING.left + (i / (data.length - 1)) * plotW,
      y: PADDING.top + plotH - (Math.min(d.accuracy, 100) / 100) * plotH,
      label: d.date,
      accuracy: d.accuracy,
    }));

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    const bottom = PADDING.top + plotH;
    const fillPath = [
      `M ${pts[0].x.toFixed(1)} ${bottom}`,
      ...pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
      `L ${pts[pts.length - 1].x.toFixed(1)} ${bottom}`,
      'Z',
    ].join(' ');

    // Every 5th label on x-axis
    const xl = pts
      .filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1)
      .map((p) => ({
        x: p.x,
        label: new Date(p.label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }));

    const yt = [0, 25, 50, 75, 100].map((v) => ({
      y: PADDING.top + plotH - (v / 100) * plotH,
      label: `${v}%`,
    }));

    return { points: pts, pathD: linePath, fillD: fillPath, xLabels: xl, yTicks: yt };
  }, [data]);

  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Not enough data for accuracy trend.
      </p>
    );
  }

  const gradId = 'accuracy-fill-gradient';

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      width="100%"
      height={CHART_HEIGHT}
      aria-label="Accuracy trend over time"
      role="img"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.65 0.25 264)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.65 0.25 264)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y-axis grid lines and labels */}
      {yTicks.map(({ y, label }) => (
        <g key={label}>
          <line
            x1={PADDING.left}
            y1={y}
            x2={CHART_WIDTH - PADDING.right}
            y2={y}
            stroke="oklch(0.35 0.01 264)"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
          <text
            x={PADDING.left - 6}
            y={y + 4}
            fontSize={9}
            fill="oklch(0.55 0.01 264)"
            textAnchor="end"
            fontFamily="inherit"
          >
            {label}
          </text>
        </g>
      ))}

      {/* Fill area */}
      <path d={fillD} fill={`url(#${gradId})`} />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="oklch(0.65 0.25 264)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="oklch(0.65 0.25 264)"
          stroke="oklch(0.12 0.01 264)"
          strokeWidth={1.5}
          aria-label={`${p.label}: ${p.accuracy.toFixed(1)}%`}
        />
      ))}

      {/* X-axis labels */}
      {xLabels.map(({ x, label }) => (
        <text
          key={label}
          x={x}
          y={CHART_HEIGHT - 6}
          fontSize={9}
          fill="oklch(0.55 0.01 264)"
          textAnchor="middle"
          fontFamily="inherit"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// StreakHistoryChart
// ---------------------------------------------------------------------------

const STREAK_HEIGHT = 120;
const STREAK_PADDING = { top: 12, right: 8, bottom: 28, left: 36 };

function StreakHistoryChart({ data }: { data: StreakPoint[] }) {
  const { bars, yTicks, maxStreak } = useMemo(() => {
    if (data.length === 0) return { bars: [], yTicks: [], maxStreak: 0 };

    const MAX_BARS = 60;
    const visible = data.slice(-MAX_BARS);
    const mx = Math.max(...visible.map((d) => d.streak), 1);

    const plotW = CHART_WIDTH - STREAK_PADDING.left - STREAK_PADDING.right;
    const plotH = STREAK_HEIGHT - STREAK_PADDING.top - STREAK_PADDING.bottom;
    const barW = Math.max(2, (plotW / visible.length) - 1);
    const bottom = STREAK_PADDING.top + plotH;

    const b = visible.map((d, i) => {
      const barH = (d.streak / mx) * plotH;
      return {
        x: STREAK_PADDING.left + i * (plotW / visible.length),
        y: bottom - barH,
        width: barW,
        height: barH,
        streak: d.streak,
        date: d.date,
      };
    });

    const tickCount = 4;
    const yt = Array.from({ length: tickCount + 1 }, (_, i) => {
      const v = Math.round((i / tickCount) * mx);
      return {
        y: STREAK_PADDING.top + plotH - (v / mx) * plotH,
        label: String(v),
      };
    });

    return { bars: b, yTicks: yt, maxStreak: mx };
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No streak data available.
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${STREAK_HEIGHT}`}
      width="100%"
      height={STREAK_HEIGHT}
      aria-label="Streak history chart"
      role="img"
      className="overflow-visible"
    >
      {/* Y-axis grid + labels */}
      {yTicks.map(({ y, label }) => (
        <g key={label}>
          <line
            x1={STREAK_PADDING.left}
            y1={y}
            x2={CHART_WIDTH - STREAK_PADDING.right}
            y2={y}
            stroke="oklch(0.35 0.01 264)"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
          <text
            x={STREAK_PADDING.left - 6}
            y={y + 4}
            fontSize={9}
            fill="oklch(0.55 0.01 264)"
            textAnchor="end"
            fontFamily="inherit"
          >
            {label}
          </text>
        </g>
      ))}

      {/* Bars */}
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={Math.max(bar.height, 1)}
          rx={1}
          fill={bar.streak >= maxStreak * 0.8 ? 'oklch(0.65 0.25 30)' : 'oklch(0.55 0.18 264)'}
          opacity={0.85}
          aria-label={`${bar.date}: ${bar.streak} day streak`}
        />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function AnalyticsCharts({ topicMastery, accuracyTrend, streakHistory }: AnalyticsChartsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Topic Mastery</CardTitle>
        </CardHeader>
        <CardContent>
          <TopicMasteryChart data={topicMastery} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Accuracy Trend</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <AccuracyTrendChart data={accuracyTrend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Streak History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <StreakHistoryChart data={streakHistory} />
        </CardContent>
      </Card>
    </div>
  );
}
