'use client';

/**
 * Forum Post Detail — Client Component
 *
 * Displays a full forum post with comments, upvotes, and reply form.
 * Uses Apollo Client for data fetching and mutations.
 */

import { useMutation, useSuspenseQuery } from '@apollo/client/react';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Eye,
  Loader2,
  Lock,
  MessageSquare,
  Pin,
  Send,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { Suspense, useCallback, useState } from 'react';
import { CommentThread } from '@/components/forum/comment-thread';
import { ForumBackground } from '@/components/forum/forum-background';
import {
  type ForumPostDetail,
  getInitials,
  getPostHue,
  getTierFromRole,
} from '@/components/forum/forum-shared';
import { TagPill } from '@/components/forum/post-card';
import { UpvoteButton } from '@/components/forum/upvote-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Link, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/auth/hooks';
import { CREATE_COMMENT_MUTATION, FORUM_POST_QUERY } from '@/lib/graphql/forum-operations';
import { useFragment } from '@/lib/graphql/generated';
import { UserSummaryFragmentDoc } from '@/lib/graphql/generated/graphql';
import { cn } from '@/lib/utils';

// ============================================================================
// LOADING SKELETON
// ============================================================================

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border p-6 backdrop-blur-md bg-card/30 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center gap-3 pt-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {(['sk-c-0', 'sk-c-1', 'sk-c-2'] as const).map((k) => (
          <div key={k} className="flex gap-3 py-3">
            <Skeleton className="size-8 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// POST DETAIL
// ============================================================================

interface PostDetailClientProps {
  id: string;
}

export function PostDetailClient({ id }: PostDetailClientProps) {
  const t = useTranslations('forum');
  const prefersReduced = useReducedMotion();
  const router = useRouter();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <ForumBackground />

      <div className="relative z-10 py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          {/* Back button */}
          <m.div
            className="mb-6"
            {...(prefersReduced
              ? {}
              : {
                  initial: { opacity: 0, x: -10 },
                  animate: { opacity: 1, x: 0 },
                  transition: { duration: 0.3 },
                })}
          >
            <Button
              variant="ghost"
              onClick={() => router.push('/forum')}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {t('backToForum')}
            </Button>
          </m.div>

          <Suspense fallback={<DetailSkeleton />}>
            <PostDetailContent id={id} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

function PostDetailContent({ id }: PostDetailClientProps) {
  const t = useTranslations('forum');
  const tAuth = useTranslations('auth');
  const format = useFormatter();
  const prefersReduced = useReducedMotion();
  const router = useRouter();
  const { status: authStatus } = useSession();

  const { data, error, refetch } = useSuspenseQuery<{ forumPost: ForumPostDetail | null }>(
    FORUM_POST_QUERY,
    {
      variables: { id },
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
  );

  const post: ForumPostDetail | null = data?.forumPost ?? null;
  const postAuthor = useFragment(UserSummaryFragmentDoc, post?.user);

  // New comment form state
  const [commentContent, setCommentContent] = useState('');
  const [createComment, { loading: submitting }] = useMutation(CREATE_COMMENT_MUTATION, {
    onCompleted() {
      setCommentContent('');
      refetch();
    },
  });

  const handleSubmitComment = useCallback(() => {
    if (!commentContent.trim()) return;
    createComment({
      variables: {
        input: {
          postId: id,
          content: commentContent.trim(),
        },
      },
    });
  }, [createComment, id, commentContent]);

  const handleCommentAdded = useCallback(() => {
    refetch();
  }, [refetch]);

  // Hue for this post
  const hue = getPostHue(id);

  return (
    <>
      {/* Post not found (loaded but null) */}
      {!error && !post && (
        <div className="rounded-2xl border border-destructive/30 p-6 bg-destructive/10 backdrop-blur-md text-center">
          <AlertCircle className="size-10 mx-auto text-destructive mb-3" />
          <p className="text-sm text-destructive">{t('postNotFound')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('postNotFoundHint')}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/forum')}>
            {t('backToForum')}
          </Button>
        </div>
      )}

      {/* Network / GraphQL error */}
      {error && !post && (
        <div className="rounded-2xl border border-destructive/30 p-6 bg-destructive/10 backdrop-blur-md text-center">
          <AlertCircle className="size-10 mx-auto text-destructive mb-3" />
          <p className="text-sm text-destructive">{t('postNotFound')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('postNotFoundHint')}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/forum')}>
            {t('backToForum')}
          </Button>
        </div>
      )}

      {/* Post content */}
      {post && (
        <m.div
          className="space-y-6"
          {...(prefersReduced
            ? {}
            : {
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.4 },
              })}
        >
          {/* Main post card */}
          <article
            className="relative rounded-2xl border p-6 space-y-4"
            style={{
              background: `oklch(0.20 0.02 ${hue} / 0.45)`,
              borderColor: `oklch(0.45 0.06 ${hue} / 0.3)`,
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Left accent */}
            <div
              className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
              style={{ background: `oklch(0.65 0.20 ${hue})` }}
            />

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {post.isPinned && (
                    <Badge
                      variant="outline"
                      className="gap-1 text-[10px] py-0 h-5 bg-amber-500/10 border-amber-500/30 text-amber-400"
                    >
                      <Pin className="size-2.5" />
                      {t('pinned')}
                    </Badge>
                  )}
                  {post.isClosed && (
                    <Badge
                      variant="outline"
                      className="gap-1 text-[10px] py-0 h-5 bg-red-500/10 border-red-500/30 text-red-400"
                    >
                      <Lock className="size-2.5" />
                      {t('closed')}
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-foreground leading-tight">{post.title}</h1>
              </div>

              <div className="shrink-0">
                <UpvoteButton
                  targetId={post.id}
                  targetType="POST"
                  initialCount={post.upvoteCount}
                  initialUpvoted={post.hasUpvoted}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <TagPill key={tag} name={tag} />
              ))}
            </div>

            {/* Meta stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="size-3" />
                {t('viewsCount', {
                  count: format.number(post.views, {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }),
                })}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="size-3" />
                {t('commentsCount', {
                  count: post.commentCount ?? post.comments.length,
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {format.relativeTime(new Date(post.createdAt), { style: 'narrow' })}
              </span>
            </div>

            {/* Content */}
            <div className="pt-2 border-t border-border/30">
              <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {post.content}
              </div>
            </div>

            {/* Author section */}
            <div className="pt-4 border-t border-border/30">
              <Link
                href={`/forum/user/${postAuthor?.id ?? ''}`}
                className="inline-flex items-center gap-3 group/author focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-lg p-1 -m-1"
              >
                <div
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-full font-bold text-sm',
                    'bg-linear-to-br/oklab from-indigo-500/30 to-purple-500/30 border border-indigo-500/30',
                  )}
                >
                  {postAuthor?.image ? (
                    /* biome-ignore lint/performance/noImgElement: external OAuth avatar URL with unpredictable domain */
                    <img
                      src={postAuthor.image}
                      alt={postAuthor?.name ?? t('anonymous')}
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-indigo-300">{getInitials(postAuthor?.name)}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground group-hover/author:text-indigo-400 transition-colors">
                      {postAuthor?.name ?? t('anonymous')}
                    </span>
                    {(() => {
                      const tier = getTierFromRole(post.user.role);
                      const TIcon = tier.icon;
                      return TIcon ? <TIcon className={cn('size-3.5', tier.color)} /> : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {post.user.bio && <span className="truncate max-w-48">{post.user.bio}</span>}
                    <span>
                      {t('joined', {
                        date: format.dateTime(new Date(post.user.createdAt), {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }),
                      })}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </article>

          {/* Comments section */}
          <div className="rounded-2xl border border-border p-6 backdrop-blur-md bg-card/50 space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="size-5 text-indigo-400" />
              {t('commentsCount', {
                count: post.commentCount ?? post.comments.length,
              })}
            </h2>

            {post.comments.length > 0 && (
              <CommentThread
                comments={post.comments}
                postId={post.id}
                onCommentAdded={handleCommentAdded}
              />
            )}

            {post.comments.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="size-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{t('noCommentsYet')}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{t('beFirstComment')}</p>
              </div>
            )}

            {/* Add comment form */}
            {!post.isClosed && (
              <div className="pt-4 border-t border-border/30 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t('addComment')}</h3>
                {authStatus === 'authenticated' ? (
                  <>
                    <Textarea
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      placeholder={t('commentPlaceholder')}
                      className="bg-card/50 backdrop-blur-md border-border min-h-[80px]"
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSubmitComment}
                        disabled={!commentContent.trim() || submitting}
                        className="gap-2 bg-linear-to-r/oklab from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
                      >
                        {submitting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        {t('comment')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => {
                          router.push(
                            `/auth/signin?callbackUrl=${encodeURIComponent(`/forum/${id}`)}`,
                          );
                        }}
                        className="text-indigo-400 hover:text-indigo-300 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {tAuth('signIn')}
                      </button>{' '}
                      {t('signInToDiscuss')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {post.isClosed && (
              <div className="text-center py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Lock className="size-4" />
                {t('discussionClosed')}
              </div>
            )}
          </div>
        </m.div>
      )}
    </>
  );
}
