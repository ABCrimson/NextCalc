'use client';

/**
 * Comment Thread Component
 *
 * Displays a nested, threaded comment list with inline reply forms.
 * Supports upvoting and collapsing long threads.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useMutation } from '@apollo/client/react';
import {
  MessageSquare,
  Reply,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UpvoteButton } from '@/components/forum/upvote-button';
import {
  type CommentNode,
  type CommentReply,
  timeAgo,
  getInitials,
} from '@/components/forum/forum-shared';
import {
  CREATE_COMMENT_MUTATION,
  DELETE_COMMENT_MUTATION,
} from '@/lib/graphql/forum-operations';
import { useSession } from '@/lib/auth/hooks';
import { cn } from '@/lib/utils';

// ============================================================================
// SINGLE COMMENT
// ============================================================================

interface SingleCommentProps {
  comment: CommentNode | CommentReply;
  postId: string;
  isReply?: boolean;
  currentUserId: string | null;
  onCommentAdded: () => void;
}

function SingleComment({
  comment,
  postId,
  isReply = false,
  currentUserId,
  onCommentAdded,
}: SingleCommentProps) {
  const prefersReduced = useReducedMotion();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const [createComment, { loading: submitting }] = useMutation(CREATE_COMMENT_MUTATION, {
    onCompleted() {
      setReplyContent('');
      setShowReplyForm(false);
      onCommentAdded();
    },
  });

  const [deleteComment, { loading: deleting }] = useMutation(DELETE_COMMENT_MUTATION, {
    onCompleted() {
      onCommentAdded();
    },
  });

  const handleSubmitReply = useCallback(() => {
    if (!replyContent.trim()) return;
    createComment({
      variables: {
        input: {
          postId,
          content: replyContent.trim(),
          parentId: comment.id,
        },
      },
    });
  }, [createComment, postId, comment.id, replyContent]);

  const handleDelete = useCallback(() => {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    deleteComment({ variables: { id: comment.id } });
  }, [deleteComment, comment.id]);

  const isOwner = currentUserId === comment.user.id;

  return (
    <motion.div
      {...(prefersReduced
        ? {}
        : {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.25 },
          })}
      className={cn(
        'relative',
        isReply && 'ml-8 pl-4 border-l-2 border-border/50',
      )}
    >
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-gradient-to-br from-muted/60 to-muted/30 border border-border">
          {comment.user.image ? (
            <img
              src={comment.user.image}
              alt={comment.user.name ?? 'User'}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span className="text-muted-foreground">
              {getInitials(comment.user.name)}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-foreground">
              {comment.user.name ?? 'Anonymous'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Actions row */}
          <div className="flex items-center gap-3 mt-2">
            <UpvoteButton
              targetId={comment.id}
              targetType="COMMENT"
              initialCount={comment.upvoteCount}
              initialUpvoted={comment.hasUpvoted}
            />

            {!isReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded px-1"
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
            )}

            {isOwner && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded px-1"
              >
                {deleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Delete
              </button>
            )}
          </div>

          {/* Inline reply form */}
          <AnimatePresence>
            {showReplyForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2 overflow-hidden"
              >
                <Textarea
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="bg-card/50 backdrop-blur-md border-border text-sm min-h-[60px]"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSubmitReply}
                    disabled={!replyContent.trim() || submitting}
                    className="gap-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
                  >
                    {submitting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Reply className="h-3 w-3" />
                    )}
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyContent('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// COMMENT THREAD (top-level comments with nested replies)
// ============================================================================

interface CommentThreadProps {
  comments: CommentNode[];
  postId: string;
  onCommentAdded: () => void;
}

export function CommentThread({ comments, postId, onCommentAdded }: CommentThreadProps) {
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? null;

  // Separate top-level from replies (top-level has no parent)
  const topLevel = comments.filter(c => c.parent === null);

  if (topLevel.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to share your thoughts!</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 divide-y divide-border/30">
      {topLevel.map(comment => (
        <CommentWithReplies
          key={comment.id}
          comment={comment}
          postId={postId}
          currentUserId={currentUserId}
          onCommentAdded={onCommentAdded}
        />
      ))}
    </div>
  );
}

// ============================================================================
// COMMENT WITH COLLAPSIBLE REPLIES
// ============================================================================

interface CommentWithRepliesProps {
  comment: CommentNode;
  postId: string;
  currentUserId: string | null;
  onCommentAdded: () => void;
}

function CommentWithReplies({
  comment,
  postId,
  currentUserId,
  onCommentAdded,
}: CommentWithRepliesProps) {
  const COLLAPSE_THRESHOLD = 3;
  const [expanded, setExpanded] = useState(false);
  const replies = comment.replies ?? [];
  const hasMany = replies.length > COLLAPSE_THRESHOLD;
  const visibleReplies = expanded || !hasMany ? replies : replies.slice(0, COLLAPSE_THRESHOLD);

  return (
    <div>
      <SingleComment
        comment={comment}
        postId={postId}
        currentUserId={currentUserId}
        onCommentAdded={onCommentAdded}
      />

      {visibleReplies.map(reply => (
        <SingleComment
          key={reply.id}
          comment={reply}
          postId={postId}
          isReply
          currentUserId={currentUserId}
          onCommentAdded={onCommentAdded}
        />
      ))}

      {hasMany && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-12 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Hide {replies.length - COLLAPSE_THRESHOLD} replies
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show {replies.length - COLLAPSE_THRESHOLD} more replies
            </>
          )}
        </button>
      )}
    </div>
  );
}
