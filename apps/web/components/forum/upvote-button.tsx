'use client';

/**
 * Reusable Upvote Button
 *
 * Animated upvote button using Framer Motion and Apollo Client
 * optimistic mutations. Falls back gracefully when not authenticated.
 */

import { useMutation } from '@apollo/client/react';
import { ThumbsUp } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useFormatter } from 'next-intl';
import { useCallback, useOptimistic, useTransition } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/lib/auth/hooks';
import { TOGGLE_UPVOTE_MUTATION } from '@/lib/graphql/forum-operations';
import { cn } from '@/lib/utils';

interface ToggleUpvoteData {
  toggleUpvote: {
    __typename: 'UpvoteResult';
    upvoted: boolean;
    upvoteCount: number;
  };
}

interface UpvoteButtonProps {
  targetId: string;
  targetType: 'POST' | 'COMMENT';
  initialCount: number;
  initialUpvoted: boolean;
}

export function UpvoteButton({
  targetId,
  targetType,
  initialCount,
  initialUpvoted,
}: UpvoteButtonProps) {
  const prefersReduced = useReducedMotion();
  const format = useFormatter();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const [, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic(
    { count: initialCount, upvoted: initialUpvoted },
    (state, newUpvoted: boolean) => ({
      count: state.count + (newUpvoted ? 1 : -1),
      upvoted: newUpvoted,
    }),
  );

  const [toggleUpvote] = useMutation<ToggleUpvoteData>(TOGGLE_UPVOTE_MUTATION);

  const handleToggle = useCallback(() => {
    if (!isAuthenticated) return;

    const newUpvoted = !optimistic.upvoted;
    startTransition(() => {
      setOptimistic(newUpvoted);
    });

    toggleUpvote({
      variables: {
        targetId,
        targetType,
      },
      optimisticResponse: {
        toggleUpvote: {
          __typename: 'UpvoteResult',
          upvoted: newUpvoted,
          upvoteCount: optimistic.count + (newUpvoted ? 1 : -1),
        },
      },
    });
  }, [isAuthenticated, optimistic, setOptimistic, toggleUpvote, targetId, targetType]);

  const button = (
    <m.button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        handleToggle();
      }}
      className={cn(
        'flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        optimistic.upvoted
          ? 'bg-linear-to-b/oklab from-orange-500/20 to-orange-600/10 text-orange-400 shadow-[0_0_16px_oklch(0.72_0.20_60/0.25)]'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        !isAuthenticated && 'cursor-default opacity-80',
      )}
      {...(prefersReduced ? {} : { whileTap: { scale: 0.85 } })}
      aria-label={
        optimistic.upvoted
          ? `Remove upvote (${optimistic.count} upvotes)`
          : `Upvote (${optimistic.count} upvotes)`
      }
      disabled={!isAuthenticated}
    >
      <m.div
        {...(prefersReduced
          ? {}
          : {
              animate: optimistic.upvoted
                ? { scale: [1, 1.3, 1], rotate: [0, -10, 0] }
                : { scale: 1, rotate: 0 },
            })}
        transition={{ duration: 0.3 }}
      >
        <ThumbsUp
          className={cn('size-4 transition-transform', optimistic.upvoted && 'scale-110')}
        />
      </m.div>
      <span className="text-xs font-bold tabular-nums">
        {format.number(optimistic.count, { notation: 'compact', maximumFractionDigits: 1 })}
      </span>
    </m.button>
  );

  if (!isAuthenticated) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>Sign in to upvote</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
