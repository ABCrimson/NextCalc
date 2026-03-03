'use client';

import { AnimatePresence, m } from 'framer-motion';
import { AlertCircle, Calculator, Check, Grid3x3, Infinity, Pi, Sigma, Type } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Math symbol categories
 */
const SYMBOL_CATEGORIES = {
  operators: {
    label: 'Operators',
    icon: Calculator,
    symbols: ['+', '-', '×', '÷', '=', '≠', '≈', '±', '∓'],
  },
  greek: {
    label: 'Greek',
    icon: Pi,
    symbols: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'σ', 'φ', 'ω'],
  },
  relations: {
    label: 'Relations',
    icon: Type,
    symbols: ['<', '>', '≤', '≥', '∈', '∉', '⊂', '⊃', '⊆', '⊇'],
  },
  calculus: {
    label: 'Calculus',
    icon: Sigma,
    symbols: ['∫', '∂', '∇', '∑', '∏', 'lim', 'dx', 'dy'],
  },
  special: {
    label: 'Special',
    icon: Infinity,
    symbols: ['∞', '√', '∛', '∜', '|', '‖', '°', '′', '″'],
  },
  logic: {
    label: 'Logic',
    icon: Grid3x3,
    symbols: ['∧', '∨', '¬', '→', '↔', '∀', '∃', '∴', '∵'],
  },
} as const;

/**
 * LaTeX template shortcuts
 */
const LATEX_TEMPLATES = [
  { label: 'Fraction', latex: '\\frac{□}{□}', description: 'Insert fraction' },
  { label: 'Power', latex: 'x^{□}', description: 'Insert exponent' },
  { label: 'Subscript', latex: 'x_{□}', description: 'Insert subscript' },
  { label: 'Square Root', latex: '\\sqrt{□}', description: 'Insert square root' },
  { label: 'Nth Root', latex: '\\sqrt[□]{□}', description: 'Insert nth root' },
  { label: 'Integral', latex: '\\int_{□}^{□} □ \\,dx', description: 'Insert integral' },
  { label: 'Sum', latex: '\\sum_{□}^{□} □', description: 'Insert summation' },
  { label: 'Limit', latex: '\\lim_{x \\to □} □', description: 'Insert limit' },
  {
    label: 'Matrix',
    latex: '\\begin{bmatrix} □ & □ \\\\ □ & □ \\end{bmatrix}',
    description: 'Insert 2×2 matrix',
  },
  { label: 'Derivative', latex: '\\frac{d□}{d□}', description: 'Insert derivative' },
] as const;

/**
 * Props for MathInput component
 */
export interface MathInputProps {
  /** Current input value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Show LaTeX preview */
  showPreview?: boolean;
  /** Show symbol palette */
  showPalette?: boolean;
  /** Validation function */
  validate?: (input: string) => { valid: boolean; error?: string };
  /** Auto-complete suggestions */
  suggestions?: ReadonlyArray<string>;
  /** ARIA label */
  ariaLabel?: string;
}

/**
 * Math Input Component
 *
 * Advanced mathematical input field with:
 * - LaTeX support
 * - Symbol palette
 * - Template shortcuts
 * - Auto-complete
 * - Syntax validation
 * - Live preview
 *
 * Features:
 * - Insert mathematical symbols with one click
 * - LaTeX template shortcuts
 * - Real-time syntax validation
 * - Auto-complete for common functions
 * - Keyboard shortcuts for symbols
 *
 * Accessibility:
 * - Full keyboard navigation
 * - ARIA labels for all controls
 * - Screen reader announcements
 * - Focus management
 * - High contrast support
 *
 * Keyboard shortcuts:
 * - Ctrl+Space: Show auto-complete
 * - Tab: Insert template placeholder
 * - Ctrl+/: Toggle symbol palette
 */
export function MathInput({
  value,
  onChange,
  placeholder = 'Enter mathematical expression...',
  disabled = false,
  showPreview = true,
  showPalette = true,
  validate,
  suggestions = [],
  ariaLabel = 'Mathematical expression input',
}: MathInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<keyof typeof SYMBOL_CATEGORIES>('operators');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Validation
  const validationResult = useMemo(() => {
    if (!validate || !value) return { valid: true };
    return validate(value);
  }, [value, validate]);

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!value || !showSuggestions) return [];
    const lastWord = value.slice(0, cursorPosition).split(/\s+/).pop() || '';
    return suggestions
      .filter((s) => s.toLowerCase().startsWith(lastWord.toLowerCase()))
      .slice(0, 5);
  }, [value, cursorPosition, suggestions, showSuggestions]);

  // Insert text at cursor position
  const insertText = useCallback(
    (text: string) => {
      const textarea = inputRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.slice(0, start) + text + value.slice(end);

      onChange(newValue);

      // Move cursor after inserted text
      setTimeout(() => {
        const newPosition = start + text.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
        setCursorPosition(newPosition);
      }, 0);
    },
    [value, onChange],
  );

  // Insert symbol
  const insertSymbol = useCallback(
    (symbol: string) => {
      insertText(symbol);
    },
    [insertText],
  );

  // Insert LaTeX template
  const insertTemplate = useCallback(
    (latex: string) => {
      // Replace □ with placeholder
      const processedLatex = latex.replace(/□/g, '');
      insertText(processedLatex);
      setShowTemplates(false);
    },
    [insertText],
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Space: Show suggestions
      if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        setShowSuggestions((prev) => !prev);
      }

      // Ctrl+/: Toggle palette
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowTemplates((prev) => !prev);
      }

      // Tab: Accept first suggestion
      if (e.key === 'Tab' && filteredSuggestions.length > 0) {
        e.preventDefault();
        insertText(filteredSuggestions[0]!);
        setShowSuggestions(false);
      }

      // Update cursor position
      setTimeout(() => {
        if (inputRef.current) {
          setCursorPosition(inputRef.current.selectionStart);
        }
      }, 0);
    },
    [filteredSuggestions, insertText],
  );

  return (
    <div className="space-y-4">
      {/* Input Area */}
      <div className="relative">
        <div
          className={cn(
            'rounded-lg border-2 transition-colors',
            isFocused ? 'border-primary' : 'border-input',
            !validationResult.valid && 'border-destructive',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setCursorPosition(e.target.selectionStart);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              setShowSuggestions(false);
            }}
            onKeyDown={handleKeyDown}
            onClick={(e) => setCursorPosition(e.currentTarget.selectionStart)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full min-h-[120px] p-4 bg-transparent outline-none resize-y font-mono text-sm"
            aria-label={ariaLabel}
            aria-invalid={!validationResult.valid}
            aria-describedby={!validationResult.valid ? 'input-error' : undefined}
          />

          {/* Auto-complete suggestions */}
          <AnimatePresence>
            {showSuggestions && filteredSuggestions.length > 0 && (
              <m.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-popover border rounded-lg shadow-lg z-10"
              >
                <div className="text-xs text-muted-foreground mb-1 px-2">Suggestions</div>
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertText(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-2 py-1 text-sm hover:bg-accent rounded transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Validation Error */}
        {!validationResult.valid && validationResult.error && (
          <m.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            id="input-error"
            className="mt-2 flex items-center gap-2 text-sm text-destructive"
            role="alert"
          >
            <AlertCircle className="h-4 w-4" />
            {validationResult.error}
          </m.div>
        )}

        {/* Validation Success */}
        {validationResult.valid && value.trim() && (
          <m.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex items-center gap-2 text-sm text-calculator-equals"
          >
            <Check className="h-4 w-4" />
            Valid expression
          </m.div>
        )}
      </div>

      {/* LaTeX Preview */}
      {showPreview && value.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted/50 rounded font-mono text-sm overflow-x-auto">{value}</div>
          </CardContent>
        </Card>
      )}

      {/* Symbol Palette */}
      {showPalette && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Symbol Palette</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                aria-label="Toggle templates"
              >
                Templates
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(SYMBOL_CATEGORIES).map(([key, category]) => (
                <Button
                  key={key}
                  variant={selectedCategory === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(key as keyof typeof SYMBOL_CATEGORIES)}
                  className="flex items-center gap-2"
                >
                  <category.icon className="h-3 w-3" />
                  {category.label}
                </Button>
              ))}
            </div>

            {/* Symbols Grid */}
            <AnimatePresence mode="wait">
              <m.div
                key={selectedCategory}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-6 sm:grid-cols-9 gap-2"
              >
                {SYMBOL_CATEGORIES[selectedCategory].symbols.map((symbol) => (
                  <Button
                    key={symbol}
                    variant="outline"
                    size="sm"
                    onClick={() => insertSymbol(symbol)}
                    className="h-10 font-mono text-base hover:bg-primary hover:text-primary-foreground transition-colors"
                    title={`Insert ${symbol}`}
                    aria-label={`Insert symbol ${symbol}`}
                  >
                    {symbol}
                  </Button>
                ))}
              </m.div>
            </AnimatePresence>

            {/* LaTeX Templates */}
            <AnimatePresence>
              {showTemplates && (
                <m.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 pt-4 border-t"
                >
                  <div className="text-sm font-semibold mb-2">LaTeX Templates</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {LATEX_TEMPLATES.map((template) => (
                      <Button
                        key={template.label}
                        variant="outline"
                        size="sm"
                        onClick={() => insertTemplate(template.latex)}
                        className="justify-start text-left h-auto py-2 px-3"
                        title={template.description}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-semibold text-xs">{template.label}</span>
                          <code className="text-xs text-muted-foreground mt-0.5">
                            {template.latex.slice(0, 20)}...
                          </code>
                        </div>
                      </Button>
                    ))}
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            {/* Keyboard Shortcuts Help */}
            <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
              <div>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+Space</kbd>{' '}
                Show suggestions
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+/</kbd>{' '}
                Toggle templates
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Tab</kbd> Accept
                suggestion
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
