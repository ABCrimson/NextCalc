import { type ComponentPropsWithoutRef, type ElementRef, type Ref } from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

interface ProgressProps extends ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  ref?: Ref<ElementRef<typeof ProgressPrimitive.Root>>;
  /**
   * The progress value (0-100)
   */
  value?: number;
  /**
   * Custom indicator class name
   */
  indicatorClassName?: string;
}

/**
 * Progress component
 *
 * Displays a progress bar indicating completion percentage.
 * Built on Radix UI Progress primitive for accessibility.
 *
 * @example
 * ```tsx
 * <Progress value={60} className="w-full" />
 * ```
 *
 * Accessibility:
 * - Uses ARIA progressbar role
 * - Announces current value to screen readers
 * - Supports aria-label and aria-labelledby
 * - Keyboard accessible (inherits from container focus)
 */
function Progress({ className, value, indicatorClassName, ref, ...props }: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative h-4 w-full overflow-hidden rounded-full bg-secondary',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 bg-primary transition-all',
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
