'use client';

/**
 * Export toolbar for mathematical plots.
 * Supports PNG (with 1x/2x/4x resolution), SVG (vector), and CSV (data points).
 *
 * PNG export: reads from the live WebGL canvas via the `canvas` prop.
 * SVG export: re-derives point series from `plotConfig` functions at the current viewport.
 * CSV export: samples each function in `plotConfig` and downloads raw x,y data.
 *
 * Accessibility: full keyboard navigation, ARIA labels, focus rings per project conventions.
 * @module components/plots/PlotExportToolbar
 */

import { useState, useCallback } from 'react';
import { Download, Image, FileText, FileCode, ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  downloadAsPNG,
  downloadAsSVG,
  exportToCSV2D,
  type ExportPNGOptions,
  type ExportSVGOptions,
  type Point2D,
  type Plot2DCartesianConfig,
  type Plot2DPolarConfig,
  type Plot2DParametricConfig,
} from '@nextcalc/plot-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The subset of PlotConfig variants that this toolbar knows how to export. */
type SupportedPlotConfig =
  | Plot2DCartesianConfig
  | Plot2DPolarConfig
  | Plot2DParametricConfig;

/** PNG scale factor (device-pixel-ratio multiplier for the export canvas). */
type PNGScale = 1 | 2 | 4;

export interface PlotExportToolbarProps {
  /**
   * The live HTMLCanvasElement rendered by Plot2D.
   * Required for PNG export. When null the PNG option is shown but disabled.
   */
  canvas: HTMLCanvasElement | null;
  /**
   * The current plot configuration.
   * Used to derive SVG paths and CSV data points from the function definitions.
   */
  plotConfig: SupportedPlotConfig;
  /**
   * Human-readable label for the plot, used in the downloaded filename.
   * Defaults to the config title or the plot type.
   */
  label?: string;
  /** Additional CSS class names for the trigger button wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Produces a datestamp string suitable for filenames: YYYY-MM-DD */
function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Converts a label to a safe filename segment. */
function toFilenameSegment(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Builds the base filename without extension. */
function buildBasename(label: string): string {
  const slug = toFilenameSegment(label) || 'plot';
  return `nextcalc-${slug}-${dateStamp()}`;
}

/**
 * Uniformly samples a 1D function over an interval.
 * Returns an array of {x, y} points with NaN values filtered out.
 */
function sampleFunction(
  fn: (x: number) => number,
  min: number,
  max: number,
  samples = 512,
): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = min + (i / samples) * (max - min);
    const y = fn(x);
    if (Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

/**
 * Samples a polar function r(theta) and converts to Cartesian coordinates.
 * Returns an array of {x, y} points.
 */
function samplePolarFunction(
  fn: (theta: number) => number,
  thetaMin: number,
  thetaMax: number,
  samples = 512,
): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i <= samples; i++) {
    const theta = thetaMin + (i / samples) * (thetaMax - thetaMin);
    const r = fn(theta);
    if (Number.isFinite(r)) {
      points.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
    }
  }
  return points;
}

/**
 * Samples a parametric function pair x(t), y(t).
 */
function sampleParametricFunction(
  xFn: (t: number) => number,
  yFn: (t: number) => number,
  tMin: number,
  tMax: number,
  samples = 512,
): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = tMin + (i / samples) * (tMax - tMin);
    const x = xFn(t);
    const y = yFn(t);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

/**
 * Derives all point series from the plot config.
 * Each element in the returned array corresponds to one function/series.
 */
function derivePointSeries(config: SupportedPlotConfig): Point2D[][] {
  if (config.type === '2d-cartesian') {
    const { viewport, functions } = config;
    return functions.map(({ fn }) =>
      sampleFunction(fn, viewport.xMin, viewport.xMax),
    );
  }

  if (config.type === '2d-polar') {
    const { thetaRange, functions } = config;
    return functions.map(({ fn }) =>
      samplePolarFunction(fn, thetaRange.min, thetaRange.max),
    );
  }

  // 2d-parametric
  const { tRange, functions } = config;
  return functions.map(({ x, y }) =>
    sampleParametricFunction(x, y, tRange.min, tRange.max),
  );
}

/**
 * Returns the viewport for SVG scaling.
 * Falls back to a bounding-box computed from sampled points for polar/parametric.
 */
function deriveViewport(
  config: SupportedPlotConfig,
  series: Point2D[][],
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (config.type === '2d-cartesian') {
    return config.viewport;
  }
  if (config.type === '2d-parametric') {
    return config.viewport;
  }

  // Polar: compute bounding box from sampled points
  const allPoints = series.flat();
  if (allPoints.length === 0) {
    return { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
  }
  let xMin = allPoints[0]!.x;
  let xMax = allPoints[0]!.x;
  let yMin = allPoints[0]!.y;
  let yMax = allPoints[0]!.y;
  for (const p of allPoints) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  // Add 10 % padding
  const padX = (xMax - xMin) * 0.1 || 0.5;
  const padY = (yMax - yMin) * 0.1 || 0.5;
  return { xMin: xMin - padX, xMax: xMax + padX, yMin: yMin - padY, yMax: yMax + padY };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Export toolbar rendered as a dropdown button.
 *
 * Keyboard shortcuts (when dropdown is open):
 *   Arrow keys - navigate menu items
 *   Enter / Space - activate focused item
 *   Escape - close dropdown
 *
 * The PNG sub-menu offers 1x, 2x, and 4x scale options.
 * SVG and CSV derive their data directly from the plotConfig functions.
 */
export function PlotExportToolbar({
  canvas,
  plotConfig,
  label,
  className = '',
}: PlotExportToolbarProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const resolvedLabel =
    label ??
    (plotConfig.type === '2d-cartesian' && plotConfig.title
      ? plotConfig.title
      : plotConfig.type === '2d-polar' && plotConfig.title
        ? plotConfig.title
        : plotConfig.type === '2d-parametric' && plotConfig.title
          ? plotConfig.title
          : plotConfig.type);

  const basename = buildBasename(resolvedLabel);

  // ------------------------------------------------------------------
  // PNG export
  // ------------------------------------------------------------------
  const handleExportPNG = useCallback(
    async (scale: PNGScale) => {
      if (!canvas) return;
      setIsExporting(true);
      setLastError(null);
      try {
        const options: ExportPNGOptions = {
          width: canvas.width,
          height: canvas.height,
          scale,
          transparent: false,
          backgroundColor: '#0a0a0f',
        };
        await downloadAsPNG(canvas, `${basename}@${scale}x.png`, options);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'PNG export failed';
        setLastError(message);
        console.error('[PlotExportToolbar] PNG export error:', err);
      } finally {
        setIsExporting(false);
      }
    },
    [canvas, basename],
  );

  // ------------------------------------------------------------------
  // SVG export
  // ------------------------------------------------------------------
  const handleExportSVG = useCallback(() => {
    setIsExporting(true);
    setLastError(null);
    try {
      const series = derivePointSeries(plotConfig);
      const viewport = deriveViewport(plotConfig, series);
      const svgWidth = 800;
      const svgHeight = 600;
      const options: ExportSVGOptions = {
        width: svgWidth,
        height: svgHeight,
        backgroundColor: '#0a0a0f',
      };
      downloadAsSVG(series, viewport, `${basename}.svg`, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SVG export failed';
      setLastError(message);
      console.error('[PlotExportToolbar] SVG export error:', err);
    } finally {
      setIsExporting(false);
    }
  }, [plotConfig, basename]);

  // ------------------------------------------------------------------
  // CSV export
  // ------------------------------------------------------------------
  const handleExportCSV = useCallback(() => {
    setIsExporting(true);
    setLastError(null);
    try {
      const series = derivePointSeries(plotConfig);

      if (series.length === 0) {
        setLastError('No data points to export');
        return;
      }

      if (series.length === 1) {
        // Single series: simple x,y CSV
        const points = series[0] ?? [];
        const csv = exportToCSV2D(points, { delimiter: ',', includeHeader: true, precision: 8 });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${basename}.csv`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // Multiple series: interleaved columns x0,y0,x1,y1,...
        const functionCount = series.length;
        const maxRows = Math.max(...series.map((s) => s.length));

        // Build header
        const headers = series
          .map((_, i) => `x${i},y${i}`)
          .join(',');

        const rows: string[] = [headers];
        for (let row = 0; row < maxRows; row++) {
          const cells: string[] = [];
          for (let col = 0; col < functionCount; col++) {
            const pt = series[col]?.[row];
            if (pt !== undefined) {
              cells.push(pt.x.toFixed(8), pt.y.toFixed(8));
            } else {
              cells.push('', '');
            }
          }
          rows.push(cells.join(','));
        }

        const csv = rows.join('\n') + '\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${basename}.csv`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CSV export failed';
      setLastError(message);
      console.error('[PlotExportToolbar] CSV export error:', err);
    } finally {
      setIsExporting(false);
    }
  }, [plotConfig, basename]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const pngDisabled = canvas === null;

  return (
    <div className={`relative inline-flex flex-col items-end gap-1 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="Export plot"
            aria-haspopup="menu"
            disabled={isExporting}
            className="
              border-border/60 bg-background/60 backdrop-blur-sm
              hover:bg-accent/80 hover:border-border
              text-foreground
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
              gap-1.5
            "
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Export</span>
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="
            min-w-[180px]
            bg-popover/95 backdrop-blur-md
            border-border/70
          "
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Export as
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* PNG sub-menu with resolution options */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              disabled={pngDisabled}
              aria-disabled={pngDisabled}
              className="gap-2"
            >
              <Image className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              <span>PNG image</span>
              {pngDisabled && (
                <span className="ml-auto text-xs text-muted-foreground/60">(loading)</span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className="
                bg-popover/95 backdrop-blur-md
                border-border/70
              "
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Resolution
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => { void handleExportPNG(1); }}
                className="gap-2 cursor-pointer"
              >
                <span className="text-xs font-mono text-muted-foreground w-6">1x</span>
                Standard
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => { void handleExportPNG(2); }}
                className="gap-2 cursor-pointer"
              >
                <span className="text-xs font-mono text-muted-foreground w-6">2x</span>
                Retina
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => { void handleExportPNG(4); }}
                className="gap-2 cursor-pointer"
              >
                <span className="text-xs font-mono text-muted-foreground w-6">4x</span>
                High-res print
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* SVG export */}
          <DropdownMenuItem
            onSelect={handleExportSVG}
            className="gap-2 cursor-pointer"
          >
            <FileCode className="h-4 w-4 text-purple-400" aria-hidden="true" />
            SVG vector
          </DropdownMenuItem>

          {/* CSV export */}
          <DropdownMenuItem
            onSelect={handleExportCSV}
            className="gap-2 cursor-pointer"
          >
            <FileText className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            CSV data points
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inline error message — announced to screen readers via role="alert" */}
      {lastError !== null && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-xs text-destructive max-w-[200px] text-right"
        >
          {lastError}
        </p>
      )}
    </div>
  );
}
