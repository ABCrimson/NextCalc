'use client';

/**
 * Toolbar for managing plot annotations.
 *
 * Provides three modes: idle, placing a text label, and placing an arrow
 * (two-click: first click = tail, second click = head).  The toolbar also
 * shows a "Clear All" button and communicates the current placement mode so
 * the parent can style the canvas cursor accordingly.
 *
 * The component is purely controlled — all state lives in the parent.
 *
 * @module components/plots/AnnotationToolbar
 */

import { AnimatePresence, motion } from 'framer-motion';
import { MousePointerClick, MoveRight, Tag, Trash2 } from 'lucide-react';
import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnnotationMode =
  | 'idle'
  | 'placing-label'
  | 'placing-arrow-tail' // waiting for the first click (tail)
  | 'placing-arrow-head'; // waiting for the second click (head)

export interface AnnotationToolbarProps {
  mode: AnnotationMode;
  onModeChange: (mode: AnnotationMode) => void;
  onClearAll: () => void;
  /** Total number of annotations currently on the plot. */
  annotationCount: number;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const hintVariants = {
  hidden: { opacity: 0, y: -6, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
  },
  exit: { opacity: 0, y: -4, height: 0, transition: { duration: 0.15 } },
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function modeHint(mode: AnnotationMode): string | null {
  switch (mode) {
    case 'placing-label':
      return 'Click anywhere on the graph to place a text label.';
    case 'placing-arrow-tail':
      return 'Click to set the arrow start point.';
    case 'placing-arrow-head':
      return 'Click to set the arrow end point.';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// ToolbarButton — internal reusable button
// ---------------------------------------------------------------------------

interface ToolbarButtonProps {
  label: string;
  title: string;
  icon: React.ReactNode;
  isActive?: boolean;
  isDestructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({
  label,
  title,
  icon,
  isActive = false,
  isDestructive = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  const base = [
    'inline-flex items-center gap-1.5 px-2.5 py-1.5',
    'rounded-lg text-xs font-medium border',
    'transition-all duration-150 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:opacity-40 disabled:pointer-events-none',
  ];

  const style = isDestructive
    ? 'text-red-400 border-red-800/60 bg-red-950/40 hover:bg-red-900/60 hover:border-red-700'
    : isActive
      ? 'text-cyan-200 border-cyan-500/70 bg-cyan-950/60 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
      : 'text-muted-foreground border-border bg-background/50 hover:bg-background/80 hover:text-foreground hover:border-border';

  return (
    <motion.button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onClick}
      whileHover={{ scale: disabled ? 1 : 1.03 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      className={[...base, style].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnnotationToolbar({
  mode,
  onModeChange,
  onClearAll,
  annotationCount,
}: AnnotationToolbarProps) {
  // Press Escape to cancel any active placement mode.
  useEffect(() => {
    if (mode === 'idle') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onModeChange('idle');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, onModeChange]);

  const hint = modeHint(mode);
  const isPlacing = mode !== 'idle';

  return (
    <div className="flex flex-col gap-1.5" role="toolbar" aria-label="Annotation tools">
      {/* Button row */}
      <div className="flex items-center flex-wrap gap-1.5">
        {/* Add Label */}
        <ToolbarButton
          label="Add Label"
          title="Add a text label (click to place)"
          icon={<Tag className="w-3.5 h-3.5" />}
          isActive={mode === 'placing-label'}
          onClick={() => onModeChange(mode === 'placing-label' ? 'idle' : 'placing-label')}
        />

        {/* Add Arrow */}
        <ToolbarButton
          label={
            mode === 'placing-arrow-tail'
              ? 'Set start...'
              : mode === 'placing-arrow-head'
                ? 'Set end...'
                : 'Add Arrow'
          }
          title="Add an arrow annotation (click start, then end)"
          icon={<MoveRight className="w-3.5 h-3.5" />}
          isActive={mode === 'placing-arrow-tail' || mode === 'placing-arrow-head'}
          onClick={() => {
            if (mode === 'placing-arrow-tail' || mode === 'placing-arrow-head') {
              onModeChange('idle');
            } else {
              onModeChange('placing-arrow-tail');
            }
          }}
        />

        {/* Clear All */}
        <ToolbarButton
          label="Clear All"
          title="Remove all annotations"
          icon={<Trash2 className="w-3.5 h-3.5" />}
          isDestructive
          disabled={annotationCount === 0}
          onClick={onClearAll}
        />

        {/* Count badge */}
        {annotationCount > 0 && (
          <span
            className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums"
            aria-live="polite"
            aria-label={`${annotationCount} annotation${annotationCount === 1 ? '' : 's'}`}
          >
            {annotationCount} annotation{annotationCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Placement hint pill */}
      <AnimatePresence mode="wait">
        {isPlacing && hint && (
          <motion.div
            key={mode}
            variants={hintVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="
              flex items-center gap-2 px-3 py-1.5 rounded-md overflow-hidden
              text-xs text-cyan-300
              bg-cyan-950/40 border border-cyan-800/50
            "
            role="status"
            aria-live="polite"
          >
            <MousePointerClick className="w-3.5 h-3.5 shrink-0 animate-pulse" />
            <span>{hint}</span>
            <span className="ml-auto text-[10px] text-cyan-400/60 shrink-0">Esc to cancel</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
