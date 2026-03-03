'use client';

/**
 * Modernized control panel for plot interactions and exports
 * Features: Glass-morphism UI, tooltips, keyboard shortcuts, Framer Motion animations
 * Accessibility: WCAG 2.2 AAA compliant with full keyboard navigation
 * @module components/plots/PlotControls
 */

import { downloadAsCSV2D, downloadAsPNG, downloadAsSVG, type Point2D } from '@nextcalc/plot-engine';
import { AnimatePresence, m } from 'framer-motion';
import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Keyboard,
  Loader2,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { type RefObject, useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Progress } from '../ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Branded type for export format to ensure type safety
type ExportFormat = 'png' | 'svg' | 'csv';
type ExportState = {
  isExporting: boolean;
  format: ExportFormat | null;
  progress: number;
} & { readonly __brand: 'ExportState' };

export interface PlotControlsProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  plotData?: Point2D[];
  viewport?: { xMin: number; xMax: number; yMin: number; yMax: number };
  plotType?: '2d' | '3d';
  className?: string;
}

// Animation configurations using spring physics for natural motion
const buttonVariants = {
  initial: { scale: 1 },
  hover: { scale: 1.05, transition: { type: 'spring' as const, stiffness: 400, damping: 20 } },
  tap: { scale: 0.95, transition: { duration: 0.1 } },
};

const progressVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.2 } },
};

/**
 * Modernized Plot Control Panel Component
 * Implements glass-morphism design with smooth animations and full accessibility
 */
export function PlotControls({
  canvasRef,
  onZoomIn,
  onZoomOut,
  onReset,
  plotData,
  viewport,
  plotType = '2d',
  className = '',
}: PlotControlsProps) {
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    format: null,
    progress: 0,
  } as ExportState);

  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + Plus: Zoom In
      if ((e.ctrlKey || e.metaKey) && e.key === '+') {
        e.preventDefault();
        onZoomIn?.();
      }
      // Ctrl/Cmd + Minus: Zoom Out
      else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        onZoomOut?.();
      }
      // Ctrl/Cmd + 0: Reset View
      else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        onReset?.();
      }
      // ? key: Show keyboard hints
      else if (e.key === '?') {
        setShowKeyboardHints((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onZoomIn, onZoomOut, onReset]);

  const handleExportPNG = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setExportError(null);

    try {
      setExportState({ isExporting: true, format: 'png', progress: 0 } as ExportState);

      // Simulate progress for better UX (real export is fast)
      const progressInterval = setInterval(() => {
        setExportState(
          (prev) =>
            ({
              ...prev,
              progress: Math.min(prev.progress + 10, 90),
            }) as ExportState,
        );
      }, 50);

      await downloadAsPNG(canvas, 'plot', {
        width: canvas.width,
        height: canvas.height,
        scale: 2,
        backgroundColor: '#ffffff',
        transparent: false,
      });

      clearInterval(progressInterval);
      setExportState((prev) => ({ ...prev, progress: 100 }) as ExportState);

      // Reset after showing 100%
      setTimeout(() => {
        setExportState({ isExporting: false, format: null, progress: 0 } as ExportState);
      }, 500);
    } catch (error) {
      console.debug('PNG export failed:', error);
      setExportError('Failed to export PNG. Please try again.');
      setExportState({ isExporting: false, format: null, progress: 0 } as ExportState);
    }
  }, [canvasRef]);

  const handleExportSVG = useCallback(async () => {
    setExportError(null);
    if (!plotData || !viewport || plotType !== '2d') {
      setExportError('SVG export is only available for 2D plots.');
      return;
    }

    try {
      setExportState({ isExporting: true, format: 'svg', progress: 0 } as ExportState);

      const progressInterval = setInterval(() => {
        setExportState(
          (prev) =>
            ({
              ...prev,
              progress: Math.min(prev.progress + 10, 90),
            }) as ExportState,
        );
      }, 50);

      await downloadAsSVG([plotData], viewport, 'plot', {
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
      });

      clearInterval(progressInterval);
      setExportState((prev) => ({ ...prev, progress: 100 }) as ExportState);

      setTimeout(() => {
        setExportState({ isExporting: false, format: null, progress: 0 } as ExportState);
      }, 500);
    } catch (error) {
      console.debug('SVG export failed:', error);
      setExportError('Failed to export SVG. Please try again.');
      setExportState({ isExporting: false, format: null, progress: 0 } as ExportState);
    }
  }, [plotData, viewport, plotType]);

  const handleExportCSV = useCallback(async () => {
    setExportError(null);
    if (!plotData || plotType !== '2d') {
      setExportError('CSV export is only available for 2D plots.');
      return;
    }

    try {
      setExportState({ isExporting: true, format: 'csv', progress: 0 } as ExportState);

      const progressInterval = setInterval(() => {
        setExportState(
          (prev) =>
            ({
              ...prev,
              progress: Math.min(prev.progress + 10, 90),
            }) as ExportState,
        );
      }, 50);

      await downloadAsCSV2D(plotData, 'plot-data', {
        delimiter: ',',
        includeHeader: true,
        precision: 6,
      });

      clearInterval(progressInterval);
      setExportState((prev) => ({ ...prev, progress: 100 }) as ExportState);

      setTimeout(() => {
        setExportState({ isExporting: false, format: null, progress: 0 } as ExportState);
      }, 500);
    } catch (error) {
      console.debug('CSV export failed:', error);
      setExportError('Failed to export CSV. Please try again.');
      setExportState({ isExporting: false, format: null, progress: 0 } as ExportState);
    }
  }, [plotData, plotType]);

  return (
    <TooltipProvider delayDuration={300}>
      {/* Glass-morphism container with gradient border */}
      <m.div
        className={`
          relative flex items-center gap-2 p-2 rounded-xl
          bg-gradient-to-br from-background/60 via-card/50 to-background/60
          backdrop-blur-md border border-border
          shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
          ${className}
        `}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as const }}
      >
        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/5 to-purple-500/5 pointer-events-none" />

        <div className="relative flex items-center gap-2">
          {/* Zoom controls - only for 2D plots */}
          {plotType === '2d' && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <m.div
                    variants={buttonVariants}
                    initial="initial"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Button
                      onClick={onZoomIn}
                      variant="outline"
                      size="sm"
                      disabled={!onZoomIn}
                      aria-label="Zoom in (Ctrl/Cmd + Plus)"
                      className="
                        bg-muted/50 border-border hover:bg-muted/70
                        hover:border-cyan-500/50 hover:text-cyan-300
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500
                        transition-colors duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                      "
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </m.div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-card/95 border-border text-foreground backdrop-blur-sm"
                >
                  <p className="font-semibold">Zoom In</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-cyan-400">Ctrl/Cmd</kbd> +
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-cyan-400 ml-1">+</kbd>
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <m.div
                    variants={buttonVariants}
                    initial="initial"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Button
                      onClick={onZoomOut}
                      variant="outline"
                      size="sm"
                      disabled={!onZoomOut}
                      aria-label="Zoom out (Ctrl/Cmd + Minus)"
                      className="
                        bg-muted/50 border-border hover:bg-muted/70
                        hover:border-cyan-500/50 hover:text-cyan-300
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500
                        transition-colors duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                      "
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </m.div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="bg-card/95 border-border text-foreground backdrop-blur-sm"
                >
                  <p className="font-semibold">Zoom Out</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-cyan-400">Ctrl/Cmd</kbd> +
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-cyan-400 ml-1">-</kbd>
                  </p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Reset view button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <m.div
                variants={buttonVariants}
                initial="initial"
                whileHover="hover"
                whileTap="tap"
              >
                <Button
                  onClick={onReset}
                  variant="outline"
                  size="sm"
                  disabled={!onReset}
                  aria-label="Reset view (Ctrl/Cmd + 0)"
                  className="
                    bg-muted/50 border-border hover:bg-muted/70
                    hover:border-purple-500/50 hover:text-purple-300
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500
                    transition-colors duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </m.div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="bg-card/95 border-border text-foreground backdrop-blur-sm"
            >
              <p className="font-semibold">Reset View</p>
              <p className="text-xs text-muted-foreground mt-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-purple-400">Ctrl/Cmd</kbd> +
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-purple-400 ml-1">0</kbd>
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="h-6 w-px bg-border" />

          {/* Export dropdown with animated progress */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <m.div
                    variants={buttonVariants}
                    initial="initial"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exportState.isExporting}
                      aria-label="Export plot"
                      className="
                        bg-gradient-to-br from-blue-900/30 to-purple-900/30
                        border-blue-500/40 hover:border-blue-400/60
                        hover:from-blue-800/40 hover:to-purple-800/40
                        text-blue-200 hover:text-blue-100
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                        transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        min-w-[100px]
                      "
                    >
                      {exportState.isExporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          <span className="text-xs">{exportState.progress}%</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </>
                      )}
                    </Button>
                  </m.div>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-card/95 border-border text-foreground backdrop-blur-sm"
              >
                <p className="font-semibold">Export Plot</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, SVG, or CSV format</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenuContent
              align="end"
              className="
                bg-card/95 border-border backdrop-blur-md
                shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
              "
            >
              <DropdownMenuItem
                onClick={handleExportPNG}
                className="
                  focus:bg-muted/80 focus:text-cyan-200
                  cursor-pointer
                "
              >
                <FileImage className="h-4 w-4 mr-2 text-cyan-400" />
                <span>Export as PNG</span>
                <span className="ml-auto text-xs text-muted-foreground/70">High quality</span>
              </DropdownMenuItem>

              {plotType === '2d' && (
                <>
                  <DropdownMenuItem
                    onClick={handleExportSVG}
                    disabled={!plotData || !viewport}
                    className="
                      focus:bg-muted/80 focus:text-purple-200
                      cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    <FileText className="h-4 w-4 mr-2 text-purple-400" />
                    <span>Export as SVG</span>
                    <span className="ml-auto text-xs text-muted-foreground/70">Vector</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-border/50" />

                  <DropdownMenuItem
                    onClick={handleExportCSV}
                    disabled={!plotData}
                    className="
                      focus:bg-muted/80 focus:text-green-200
                      cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-400" />
                    <span>Export as CSV</span>
                    <span className="ml-auto text-xs text-muted-foreground/70">Data only</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Keyboard hints toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <m.div
                variants={buttonVariants}
                initial="initial"
                whileHover="hover"
                whileTap="tap"
              >
                <Button
                  onClick={() => setShowKeyboardHints((prev) => !prev)}
                  variant="ghost"
                  size="sm"
                  aria-label="Toggle keyboard shortcuts (Press ?)"
                  className="
                    text-muted-foreground hover:text-foreground
                    hover:bg-muted/40
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                  "
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </m.div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="bg-card/95 border-border text-foreground backdrop-blur-sm"
            >
              <p className="font-semibold">Keyboard Shortcuts</p>
              <p className="text-xs text-muted-foreground mt-1">
                Press <kbd className="px-1.5 py-0.5 bg-muted rounded">?</kbd> to toggle
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Export progress indicator */}
        <AnimatePresence>
          {exportState.isExporting && (
            <m.div
              variants={progressVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="absolute -bottom-2 left-0 right-0 px-2"
            >
              <Progress
                value={exportState.progress}
                className="h-1 bg-muted/80"
                aria-label={`Export progress: ${exportState.progress}%`}
              />
            </m.div>
          )}
        </AnimatePresence>

        {/* Export error message */}
        <AnimatePresence>
          {exportError && (
            <m.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 right-0 mt-1 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20"
              role="alert"
            >
              <div className="flex items-center justify-between gap-2">
                <span>{exportError}</span>
                <button
                  onClick={() => setExportError(null)}
                  className="text-destructive hover:text-destructive/80 font-medium shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Keyboard shortcuts overlay */}
        <AnimatePresence>
          {showKeyboardHints && (
            <m.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.2 }}
              className="
                absolute top-full right-0 mt-2 p-3 rounded-lg
                bg-card/95 border border-border backdrop-blur-md
                shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
                min-w-[250px] z-50
              "
              role="dialog"
              aria-label="Keyboard shortcuts"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h4>
                <button
                  onClick={() => setShowKeyboardHints(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close shortcuts"
                >
                  ×
                </button>
              </div>
              <div className="space-y-1.5 text-xs">
                {plotType === '2d' && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-foreground/80">Zoom In</span>
                      <div className="flex gap-1">
                        <kbd className="px-1.5 py-0.5 bg-muted rounded text-cyan-400">Ctrl/Cmd</kbd>
                        <kbd className="px-1.5 py-0.5 bg-muted rounded text-cyan-400">+</kbd>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-foreground/80">Zoom Out</span>
                      <div className="flex gap-1">
                        <kbd className="px-1.5 py-0.5 bg-muted rounded text-cyan-400">Ctrl/Cmd</kbd>
                        <kbd className="px-1.5 py-0.5 bg-muted rounded text-cyan-400">-</kbd>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-foreground/80">Reset View</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-purple-400">Ctrl/Cmd</kbd>
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-purple-400">0</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground/80">Toggle Shortcuts</span>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground">?</kbd>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </TooltipProvider>
  );
}
