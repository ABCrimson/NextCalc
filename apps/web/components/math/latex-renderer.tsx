'use client';

import katex from 'katex';
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
    if (containerRef.current && expression) {
      try {
        katex.render(expression, containerRef.current, {
          displayMode,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: 'warn',
          trust: false,
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
      }
    }
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
