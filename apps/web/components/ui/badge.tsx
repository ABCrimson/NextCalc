import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        beginner: 'border-transparent bg-gradient-to-r from-green-500/90 to-emerald-500/90 text-white',
        intermediate: 'border-transparent bg-gradient-to-r from-blue-500/90 to-cyan-500/90 text-white',
        advanced: 'border-transparent bg-gradient-to-r from-purple-500/90 to-pink-500/90 text-white',
        expert: 'border-transparent bg-gradient-to-r from-orange-500/90 to-red-500/90 text-white',
        research: 'border-transparent bg-gradient-to-r from-red-600/90 to-rose-600/90 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
