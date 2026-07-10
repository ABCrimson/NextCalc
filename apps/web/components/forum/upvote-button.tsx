'use client';

/**
 * Reusable Upvote Button
 *
 * Animated upvote button using Framer Motion and an Apollo Client mutation.
 * The flip is optimistic via React's useOptimistic: the async transition keeps
 * the optimistic state alive until the mutation settles. On success the
 * server-confirmed {upvoted, upvoteCount} is written onto the normalized
 * ForumPost/Comment cache entity (the UpvoteResult payload itself carries no
 * id, so it is never normalized), which re-renders every watching query with
 * the confirmed values. On failure the optimistic flip reverts and the error
 * is surfaced inline. Falls back gracefully when not authenticated.
 */

import { useMutation } from '@apollo/client/react';
import { ThumbsUp } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useFormatter } from 'next-intl';
import { useCallback, useOptimistic, useState, useTransition } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/lib/auth/hooks';
import { TOGGLE_UPVOTE_MUTATION } from '@/lib/graphql/forum-operations';
import { cn } from '@/lib/utils';

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
  const [failed, setFailed] = useState(false);

  const [optimistic, setOptimistic] = useOptimistic(
    { count: initialCount, upvoted: initialUpvoted },
    (state, newUpvoted: boolean) => ({
      count: state.count + (newUpvoted ? 1 : -1),
      upvoted: newUpvoted,
    }),
  );

  const [toggleUpvote] = useMutation(TOGGLE_UPVOTE_MUTATION);

  const handleToggle = useCallback(() => {
    if (!isAuthenticated) return;

    const newUpvoted = !optimistic.upvoted;
    setFailed(false);
    // The mutation promise must be part of the transition — otherwise React
    // considers the transition finished immediately and reverts the optimistic
    // flip before the server responds.
    startTransition(async () => {
      setOptimistic(newUpvoted);
      try {
        const { data, error } = await toggleUpvote({
          variables: { targetId, targetType },
          update(cache, result) {
            const confirmed = result.data?.toggleUpvote;
            if (!confirmed) return;
            const cacheId = cache.identify({
              __typename: targetType === 'POST' ? 'ForumPost' : 'Comment',
              id: targetId,
            });
            if (!cacheId) return;
            cache.modify({
              id: cacheId,
              fields: {
                upvoteCount: () => confirmed.upvoteCount,
                hasUpvoted: () => confirmed.upvoted,
              },
            });
          },
        });
        // errorPolicy 'all' (client default) resolves with `error` set instead
        // of rejecting — treat both shapes as a failure.
        if (error || !data?.toggleUpvote) {
          throw error ?? new Error('toggleUpvote returned no data');
        }
      } catch (err) {
        // Transition end reverts the optimistic flip back to the props.
        console.error(`[ToggleUpvote] ${targetType} ${targetId}:`, err);
        setFailed(true);
      }
    });
  }, [isAuthenticated, optimistic.upvoted, setOptimistic, toggleUpvote, targetId, targetType]);

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

  return (
    <div className="flex flex-col items-center gap-1">
      {button}
      {failed && (
        <span role="alert" className="text-[10px] font-medium text-destructive">
          Upvote failed
        </span>
      )}
    </div>
  );
}
