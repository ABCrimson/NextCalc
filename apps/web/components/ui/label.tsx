import type { LabelHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  ref?: Ref<HTMLLabelElement>;
}

function Label({ className, ref, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: generic primitive; htmlFor/content supplied by callers via ...props
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
