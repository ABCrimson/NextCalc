'use client';

import { Check, Copy } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * CodeBlock Component
 *
 * Displays syntax-highlighted code blocks with copy functionality.
 *
 * @example
 * ```tsx
 * <CodeBlock
 *   code="function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }"
 *   language="javascript"
 *   filename="fibonacci.js"
 * />
 * ```
 *
 * Features:
 * - Syntax highlighting with line numbers
 * - Copy to clipboard functionality
 * - Optional filename display
 * - Line highlighting for specific lines
 * - Accessible keyboard navigation
 * - Responsive design
 *
 * Accessibility:
 * - Proper semantic markup with <code> and <pre>
 * - Keyboard accessible copy button
 * - Screen reader announcements for copy status
 * - Correct ARIA labels
 */

export interface CodeBlockProps {
  /** Source code to display */
  code: string;

  /** Programming language for syntax highlighting */
  language?: string;

  /** Optional filename to display */
  filename?: string;

  /** Show line numbers (default: true) */
  showLineNumbers?: boolean;

  /** Enable copy button (default: true) */
  showCopyButton?: boolean;

  /** Highlight specific lines (1-indexed) */
  highlightLines?: number[];

  /** Additional CSS classes */
  className?: string;

  /** Maximum height before scrolling */
  maxHeight?: string;
}

export function CodeBlock({
  code,
  language = 'text',
  filename,
  showLineNumbers = true,
  showCopyButton = true,
  highlightLines = [],
  className,
  maxHeight = '500px',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Simple syntax highlighting using regex patterns
  const highlightCode = (code: string, _lang: string): string => {
    let highlighted = code;

    // Escape HTML
    highlighted = highlighted.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Language-specific highlighting patterns
    const patterns: Record<string, Array<{ regex: RegExp; className: string }>> = {
      javascript: [
        {
          regex:
            /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await)\b/g,
          className: 'text-purple-600 dark:text-purple-400 font-semibold',
        },
        {
          regex: /\b(true|false|null|undefined)\b/g,
          className: 'text-blue-600 dark:text-blue-400',
        },
        { regex: /(["'`])(?:(?=(\\?))\2.)*?\1/g, className: 'text-green-600 dark:text-green-400' },
        { regex: /\/\/.*/g, className: 'text-muted-foreground italic' },
        { regex: /\b(\d+)\b/g, className: 'text-orange-600 dark:text-orange-400' },
      ],
      python: [
        {
          regex:
            /\b(def|class|import|from|return|if|else|elif|for|while|try|except|with|as|lambda|yield|async|await)\b/g,
          className: 'text-purple-600 dark:text-purple-400 font-semibold',
        },
        { regex: /\b(True|False|None)\b/g, className: 'text-blue-600 dark:text-blue-400' },
        { regex: /(["'`])(?:(?=(\\?))\2.)*?\1/g, className: 'text-green-600 dark:text-green-400' },
        { regex: /#.*/g, className: 'text-muted-foreground italic' },
        { regex: /\b(\d+)\b/g, className: 'text-orange-600 dark:text-orange-400' },
      ],
      typescript: [
        {
          regex:
            /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|interface|type|enum|namespace)\b/g,
          className: 'text-purple-600 dark:text-purple-400 font-semibold',
        },
        {
          regex: /\b(string|number|boolean|any|void|never|unknown)\b/g,
          className: 'text-blue-600 dark:text-blue-400',
        },
        { regex: /(["'`])(?:(?=(\\?))\2.)*?\1/g, className: 'text-green-600 dark:text-green-400' },
        { regex: /\/\/.*/g, className: 'text-muted-foreground italic' },
        { regex: /\b(\d+)\b/g, className: 'text-orange-600 dark:text-orange-400' },
      ],
    };

    const langPatterns = patterns[language.toLowerCase()] || [];

    for (const { regex, className } of langPatterns) {
      highlighted = highlighted.replace(
        regex,
        (match) => `<span class="${className}">${match}</span>`,
      );
    }

    return highlighted;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const lines = code.split('\n');

  return (
    <div
      className={cn('relative rounded-lg border border-border bg-card overflow-hidden', className)}
    >
      {/* Header with filename and copy button */}
      {(filename || showCopyButton) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          {filename && <span className="text-sm font-mono text-muted-foreground">{filename}</span>}
          {showCopyButton && (
            <Button
              size="sm"
              variant="ghost"
              onClick={copyToClipboard}
              className="h-8 gap-2"
              aria-label={copied ? 'Code copied' : 'Copy code to clipboard'}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs">Copy</span>
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Code content */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight }}>
        <pre className="p-4 text-sm font-mono" role="region" aria-label="Code block">
          <code className="block">
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              const isHighlighted = highlightLines.includes(lineNumber);

              return (
                <div
                  key={lineNumber}
                  className={cn('flex', isHighlighted && 'bg-primary/10 -mx-4 px-4')}
                >
                  {showLineNumbers && (
                    <span
                      className="inline-block w-12 text-right pr-4 text-muted-foreground select-none"
                      aria-hidden="true"
                    >
                      {lineNumber}
                    </span>
                  )}
                  <span
                    className="flex-1"
                    dangerouslySetInnerHTML={{
                      __html: highlightCode(line, language) || '&nbsp;',
                    }}
                  />
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Language badge */}
      {language && (
        <div
          className="absolute top-2 right-2 px-2 py-1 text-xs font-mono rounded bg-muted text-muted-foreground"
          aria-label={`Language: ${language}`}
        >
          {language}
        </div>
      )}
    </div>
  );
}

/**
 * InlineCode Component
 *
 * Renders inline code snippets.
 *
 * @example
 * ```tsx
 * <InlineCode>const x = 42;</InlineCode>
 * ```
 */
export function InlineCode({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        'px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-sm',
        className,
      )}
    >
      {children}
    </code>
  );
}
