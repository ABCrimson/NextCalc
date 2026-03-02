'use client';

import { useEffect, useRef } from 'react';

interface LaTeXRendererProps {
  expression: string;
  displayMode?: boolean;
  className?: string;
}

export function LaTeXRenderer({
  expression,
  displayMode = false,
  className = '',
}: LaTeXRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !expression) return;
    let cancelled = false;

    import('katex').then((katex) => {
      if (cancelled || !containerRef.current) return;
      try {
        katex.default.render(expression, containerRef.current, {
          displayMode,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: 'warn',
          trust: false,
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [expression, displayMode]);

  return (
    <div
      ref={containerRef}
      className={`katex-container ${className}`}
      role="math"
      aria-label={`Math expression: ${expression}`}
    />
  );
}
