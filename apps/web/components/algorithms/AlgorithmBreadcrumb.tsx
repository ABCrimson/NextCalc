'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Link href (undefined for current page) */
  href?: string;
}

export interface AlgorithmBreadcrumbProps {
  /** Breadcrumb trail items */
  items: BreadcrumbItem[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * AlgorithmBreadcrumb Component
 *
 * Provides hierarchical navigation for algorithm pages.
 * Always starts with Home icon, follows with trail items.
 *
 * Accessibility:
 * - Semantic nav element with aria-label
 * - Ordered list structure
 * - aria-current for current page
 * - Keyboard navigable links
 * - Focus indicators
 *
 * @example
 * ```tsx
 * <AlgorithmBreadcrumb
 *   items={[
 *     { label: 'Algorithms', href: '/algorithms' },
 *     { label: 'Machine Learning', href: '/algorithms?category=machine-learning' },
 *     { label: 'Transformers' }
 *   ]}
 * />
 * ```
 */
export function AlgorithmBreadcrumb({
  items,
  className,
}: AlgorithmBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={cn('flex items-center text-sm', className)}
    >
      <ol className="flex items-center gap-2 flex-wrap">
        {/* Home link */}
        <li>
          <Link
            href="/"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm"
            aria-label="Home"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {/* Trail items */}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {/* Separator */}
              <ChevronRight
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />

              {/* Link or text */}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'font-medium',
                    isLast ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
