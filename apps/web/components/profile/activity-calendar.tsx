'use client';

import { useState, useMemo } from 'react';

interface ActivityCalendarProps {
  data: Array<{ date: string; count: number }>;
}

interface TooltipState {
  x: number;
  y: number;
  date: string;
  count: number;
}

const WEEKS = 52;
const DAYS_PER_WEEK = 7;
const CELL_SIZE = 12;
const CELL_GAP = 2;
const CELL_STRIDE = CELL_SIZE + CELL_GAP;
const LEFT_OFFSET = 32;
const TOP_OFFSET = 24;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function getActivityColor(count: number, max: number): string {
  if (count === 0) return 'oklch(0.25 0.01 264)';
  const ratio = Math.min(count / Math.max(max, 1), 1);
  if (ratio < 0.25) return 'oklch(0.35 0.08 264)';
  if (ratio < 0.5) return 'oklch(0.45 0.15 264)';
  if (ratio < 0.75) return 'oklch(0.55 0.20 264)';
  return 'oklch(0.65 0.25 264)';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ActivityCalendar({ data }: ActivityCalendarProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { grid, monthPositions, maxCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build a map from date string -> count
    const countMap = new Map<string, number>();
    for (const entry of data) {
      countMap.set(entry.date.slice(0, 10), entry.count);
    }

    // Calculate the start date: go back (WEEKS * 7 - 1) days from today
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (WEEKS * DAYS_PER_WEEK - 1));

    // Align to Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    // Build the grid: [week][day]
    const cells: Array<Array<{ dateStr: string; count: number; inRange: boolean }>> = [];
    let currentMax = 0;
    const monthPos: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;

    for (let w = 0; w < WEEKS; w++) {
      const week: Array<{ dateStr: string; count: number; inRange: boolean }> = [];
      for (let d = 0; d < DAYS_PER_WEEK; d++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + w * 7 + d);
        const dateStr = date.toISOString().slice(0, 10);
        const count = countMap.get(dateStr) ?? 0;
        const inRange = date <= today;
        if (count > currentMax) currentMax = count;

        const month = date.getMonth();
        if (month !== lastMonth && inRange) {
          monthPos.push({ label: MONTH_LABELS[month], weekIndex: w });
          lastMonth = month;
        }

        week.push({ dateStr, count, inRange });
      }
      cells.push(week);
    }

    return { grid: cells, monthPositions: monthPos, maxCount: currentMax };
  }, [data]);

  const svgWidth = LEFT_OFFSET + WEEKS * CELL_STRIDE;
  const svgHeight = TOP_OFFSET + DAYS_PER_WEEK * CELL_STRIDE + 8;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        width={svgWidth}
        height={svgHeight}
        aria-label="Activity calendar showing contributions over the past year"
        role="img"
      >
        {/* Month labels */}
        {monthPositions.map(({ label, weekIndex }) => (
          <text
            key={`${label}-${weekIndex}`}
            x={LEFT_OFFSET + weekIndex * CELL_STRIDE}
            y={14}
            fontSize={10}
            fill="oklch(0.55 0.01 264)"
            fontFamily="inherit"
          >
            {label}
          </text>
        ))}

        {/* Day labels */}
        {DAY_LABELS.map((label, dayIndex) =>
          label ? (
            <text
              key={`day-${dayIndex}`}
              x={LEFT_OFFSET - 4}
              y={TOP_OFFSET + dayIndex * CELL_STRIDE + CELL_SIZE - 2}
              fontSize={9}
              fill="oklch(0.55 0.01 264)"
              textAnchor="end"
              fontFamily="inherit"
            >
              {label}
            </text>
          ) : null
        )}

        {/* Contribution cells */}
        {grid.map((week, weekIndex) =>
          week.map((cell, dayIndex) => (
            <rect
              key={`${weekIndex}-${dayIndex}`}
              x={LEFT_OFFSET + weekIndex * CELL_STRIDE}
              y={TOP_OFFSET + dayIndex * CELL_STRIDE}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={2}
              ry={2}
              fill={cell.inRange ? getActivityColor(cell.count, maxCount) : 'oklch(0.18 0.005 264)'}
              opacity={cell.inRange ? 1 : 0.4}
              style={{ cursor: cell.inRange ? 'pointer' : 'default' }}
              onMouseEnter={(e) => {
                if (!cell.inRange) return;
                const rect = (e.target as SVGRectElement).getBoundingClientRect();
                setTooltip({
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8,
                  date: cell.dateStr,
                  count: cell.count,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              aria-label={cell.inRange ? `${formatDate(cell.dateStr)}: ${cell.count} contribution${cell.count !== 1 ? 's' : ''}` : undefined}
            />
          ))
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
          role="tooltip"
        >
          <span className="font-medium">{formatDate(tooltip.date)}</span>
          <span className="ml-1.5 text-muted-foreground">
            {tooltip.count} contribution{tooltip.count !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Less</span>
        {['oklch(0.25 0.01 264)', 'oklch(0.35 0.08 264)', 'oklch(0.45 0.15 264)', 'oklch(0.55 0.20 264)', 'oklch(0.65 0.25 264)'].map((color, i) => (
          <span
            key={i}
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
