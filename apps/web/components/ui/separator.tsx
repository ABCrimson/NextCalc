import { Separator as SeparatorPrimitive } from 'radix-ui';
import type { ComponentPropsWithoutRef, ElementRef, Ref } from 'react';
import { cn } from '@/lib/utils';

interface SeparatorProps extends ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  ref?: Ref<ElementRef<typeof SeparatorPrimitive.Root>>;
}

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ref,
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
