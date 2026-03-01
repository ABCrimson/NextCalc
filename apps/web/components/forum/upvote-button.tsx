'use client';

/**
 * Reusable Upvote Button
 *
 * Animated upvote button using Framer Motion and Apollo Client
 * optimistic mutations. Falls back gracefully when not authenticated.
 */

import { useMutation } from '@apollo/client/react';
import { motion, useReducedMotion } from 'framer-motion';
import { ThumbsUp } from 'lucide-react';
import { useCallback, useState } from 'react';
import { formatNumber } from '@/components/forum/forum-shared';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/lib/auth/hooks';
import { TOGGLE_UPVOTE_MUTATION } from '@/lib/graphql/forum-operations';
import { cn } from '@/lib/utils';

interface UpvoteButtonProps {
  targetId: string;
  targetType: 'POST' | 'COMMENT';
  initialCount: number;
  initialUpvoted: boolean;
  /** Use mock mode (no GraphQL mutation) */
  mock?: boolean;
  onMockToggle?: () => void;
}

export function UpvoteButton({
  targetId,
  targetType,
  initialCount,
  initialUpvoted,
  mock = false,
  onMockToggle,
}: UpvoteButtonProps) {
  const prefersReduced = useReducedMotion();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [localCount, setLocalCount] = useState(initialCount);
  const [localUpvoted, setLocalUpvoted] = useState(initialUpvoted);

  interface ToggleUpvoteData {
    toggleUpvote: {
      __typename: 'UpvoteResult';
      upvoted: boolean;
      upvoteCount: number;
    };
  }

  const [toggleUpvote] = useMutation<ToggleUpvoteData>(TOGGLE_UPVOTE_MUTATION, {
    optimisticResponse: {
      toggleUpvote: {
        __typename: 'UpvoteResult',
        upvoted: !localUpvoted,
        upvoteCount: localUpvoted ? localCount - 1 : localCount + 1,
      },
    },
    onCompleted(data) {
      const result = data.toggleUpvote;
      setLocalUpvoted(result.upvoted);
      setLocalCount(result.upvoteCount);
    },
    onError() {
      // Revert on error
      setLocalUpvoted(localUpvoted);
      setLocalCount(localCount);
    },
  });

  const handleToggle = useCallback(() => {
    if (mock) {
      onMockToggle?.();
      setLocalUpvoted(!localUpvoted);
      setLocalCount(localUpvoted ? localCount - 1 : localCount + 1);
      return;
    }

    if (!isAuthenticated) return;

    // Optimistic local update
    setLocalUpvoted(!localUpvoted);
    setLocalCount(localUpvoted ? localCount - 1 : localCount + 1);

    toggleUpvote({
      variables: {
        targetId,
        targetType,
      },
    });
  }, [
    mock,
    onMockToggle,
    isAuthenticated,
    localUpvoted,
    localCount,
    toggleUpvote,
    targetId,
    targetType,
  ]);

  const button = (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        handleToggle();
      }}
      className={cn(
        'flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        localUpvoted
          ? 'bg-gradient-to-b from-orange-500/20 to-orange-600/10 text-orange-400 shadow-[0_0_16px_oklch(0.72_0.20_60/0.25)]'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        !isAuthenticated && !mock && 'cursor-default opacity-80',
      )}
      {...(prefersReduced ? {} : { whileTap: { scale: 0.85 } })}
      aria-label={
        localUpvoted ? `Remove upvote (${localCount} upvotes)` : `Upvote (${localCount} upvotes)`
      }
      disabled={!isAuthenticated && !mock}
    >
      <motion.div
        {...(prefersReduced
          ? {}
          : {
              animate: localUpvoted
                ? { scale: [1, 1.3, 1], rotate: [0, -10, 0] }
                : { scale: 1, rotate: 0 },
            })}
        transition={{ duration: 0.3 }}
      >
        <ThumbsUp className={cn('h-4 w-4 transition-transform', localUpvoted && 'scale-110')} />
      </motion.div>
      <span className="text-xs font-bold tabular-nums">{formatNumber(localCount)}</span>
    </motion.button>
  );

  if (!isAuthenticated && !mock) {
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
