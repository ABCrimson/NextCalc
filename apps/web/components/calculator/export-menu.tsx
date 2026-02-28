'use client';

/**
 * ExportMenu -- LaTeX expression export dropdown
 *
 * Renders a dropdown menu with PDF / PNG / SVG export options.
 * Each option calls the export-service Worker, shows a loading spinner,
 * and triggers a browser download on success.
 *
 * Accessibility:
 *   - Full keyboard navigation (Arrow keys, Enter, Escape) via Radix DropdownMenu.
 *   - Descriptive aria-labels on every interactive element.
 *   - Error state announced via `role="alert"` live region.
 *   - Focus rings per project convention.
 *
 * @module components/calculator/export-menu
 */

import { useState, useCallback } from 'react';
import { Download, FileText, Image, FileCode, ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  exportAndDownload,
  ExportError,
  type ExportFormat,
} from '@/lib/export-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportMenuProps {
  /** The LaTeX expression to export. An empty string disables the menu. */
  readonly latex: string;
  /** Additional Tailwind classes for the trigger button wrapper. */
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportMenu({ latex, className }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const isDisabled = latex.trim() === '' || isExporting;

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (latex.trim() === '') return;

      setIsExporting(true);
      setActiveFormat(format);
      setLastError(null);

      try {
        await exportAndDownload(format, latex);
      } catch (err) {
        if (err instanceof ExportError) {
          setLastError(err.message);
        } else {
          setLastError('Export failed. Please try again.');
        }
        console.error('[ExportMenu] export error:', err);
      } finally {
        setIsExporting(false);
        setActiveFormat(null);
      }
    },
    [latex],
  );

  return (
    <div className={cn('relative inline-flex flex-col items-end gap-1', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={isDisabled}
            aria-label="Export expression"
            aria-haspopup="menu"
            className={cn(
              'gap-1.5 text-muted-foreground hover:text-foreground transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
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
          className="min-w-[180px] bg-popover/95 backdrop-blur-md border-border/70"
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Export LaTeX as
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* PDF */}
          <DropdownMenuItem
            onSelect={() => { void handleExport('pdf'); }}
            disabled={isExporting}
            className="gap-2 cursor-pointer"
          >
            {activeFormat === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin text-red-400" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4 text-red-400" aria-hidden="true" />
            )}
            <span>PDF document</span>
          </DropdownMenuItem>

          {/* PNG */}
          <DropdownMenuItem
            onSelect={() => { void handleExport('png'); }}
            disabled={isExporting}
            className="gap-2 cursor-pointer"
          >
            {activeFormat === 'png' ? (
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" aria-hidden="true" />
            ) : (
              <Image className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            )}
            <span>PNG image</span>
          </DropdownMenuItem>

          {/* SVG */}
          <DropdownMenuItem
            onSelect={() => { void handleExport('svg'); }}
            disabled={isExporting}
            className="gap-2 cursor-pointer"
          >
            {activeFormat === 'svg' ? (
              <Loader2 className="h-4 w-4 animate-spin text-purple-400" aria-hidden="true" />
            ) : (
              <FileCode className="h-4 w-4 text-purple-400" aria-hidden="true" />
            )}
            <span>SVG vector</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inline error — announced to screen readers via role="alert" */}
      {lastError !== null && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-xs text-destructive max-w-[220px] text-right"
        >
          {lastError}
        </p>
      )}
    </div>
  );
}
