'use client';

/**
 * Forum Post Card
 *
 * Glassmorphic post card with per-post OKLCH hue derived from the post ID.
 * Each card gets a unique color accent for visual distinction.
 * Supports both GraphQL data and mock fallback data.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Clock, Eye, Hash, MessageSquare, Pin } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import {
  type ForumPostNode,
  formatNumber,
  getInitials,
  getMockUserSlug,
  getPostHue,
  getTagStyle,
  type MockForumPost,
  timeAgo,
} from '@/components/forum/forum-shared';
import { UpvoteButton } from '@/components/forum/upvote-button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// TAG PILL (shared small component)
// ============================================================================

export function TagPill({ name }: { name: string }) {
  const style = getTagStyle(name);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold',
        'bg-gradient-to-r border backdrop-blur-sm',
        style,
      )}
    >
      <Hash className="h-2.5 w-2.5" />
      {name}
    </span>
  );
}

// ============================================================================
// AUTHOR AVATAR
// ============================================================================

function AuthorAvatar({ name, image }: { name: string | null; image: string | null }) {
  const initials = getInitials(name);
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm',
        'bg-gradient-to-br from-muted/60 to-muted/30 border border-border',
      )}
    >
      {image ? (
        <img src={image} alt={name ?? 'User'} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="text-muted-foreground">{initials}</span>
      )}
    </div>
  );
}

// ============================================================================
// POST CARD — GraphQL data variant
// ============================================================================

interface PostCardProps {
  post: ForumPostNode;
  index: number;
}

export function PostCard({ post, index }: PostCardProps) {
  const prefersReduced = useReducedMotion();
  const router = useRouter();
  const hue = getPostHue(post.id);
  const commentCount = post.comments?.length ?? 0;

  const handleClick = useCallback(() => {
    router.push(`/forum/${post.id}`);
  }, [router, post.id]);

  return (
    <motion.article
      layout
      {...(prefersReduced
        ? {}
        : {
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -8 },
            transition: { delay: index * 0.04, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
          })}
      className="group relative flex gap-4 rounded-2xl border p-5 transition-all duration-300 cursor-pointer"
      style={{
        background: `oklch(0.20 0.02 ${hue} / 0.45)`,
        borderColor: `oklch(0.45 0.06 ${hue} / 0.3)`,
        backdropFilter: 'blur(16px)',
      }}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      role="link"
      tabIndex={0}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{ background: `oklch(0.65 0.20 ${hue})` }}
      />

      {/* Pinned indicator override */}
      {post.isPinned && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
      )}

      {/* Upvote column */}
      <div className="flex flex-col items-center pt-1">
        <UpvoteButton
          targetId={post.id}
          targetType="POST"
          initialCount={post.upvoteCount}
          initialUpvoted={post.hasUpvoted}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {post.isPinned && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] py-0 h-5 bg-amber-500/10 border-amber-500/30 text-amber-400"
                >
                  <Pin className="h-2.5 w-2.5" />
                  Pinned
                </Badge>
              )}
              <h3 className="text-base font-semibold text-foreground group-hover:text-[oklch(0.78_0.14_264)] transition-colors leading-snug">
                {post.title}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">{post.content}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <TagPill key={tag} name={tag} />
          ))}
        </div>

        {/* Footer: author + stats */}
        <div className="flex items-center justify-between pt-1">
          <Link
            href={`/forum/user/${post.user.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 rounded-lg p-0.5 -m-0.5 hover:bg-white/5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <AuthorAvatar name={post.user.name} image={post.user.image} />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-foreground hover:text-indigo-400 transition-colors truncate block">
                {post.user.name ?? 'Anonymous'}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatNumber(post.views)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(post.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

// ============================================================================
// MOCK POST CARD — fallback variant
// ============================================================================

interface MockPostCardProps {
  post: MockForumPost;
  index: number;
  onUpvote: (id: string) => void;
}

export function MockPostCard({ post, index, onUpvote }: MockPostCardProps) {
  const prefersReduced = useReducedMotion();
  const router = useRouter();
  const hue = getPostHue(post.id);

  const handleClick = useCallback(() => {
    router.push(`/forum/${post.id}`);
  }, [router, post.id]);

  return (
    <motion.article
      layout
      {...(prefersReduced
        ? {}
        : {
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -8 },
            transition: { delay: index * 0.04, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
          })}
      className="group relative flex gap-4 rounded-2xl border p-5 transition-all duration-300 cursor-pointer"
      style={{
        background: `oklch(0.20 0.02 ${hue} / 0.45)`,
        borderColor: `oklch(0.45 0.06 ${hue} / 0.3)`,
        backdropFilter: 'blur(16px)',
      }}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      role="link"
      tabIndex={0}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{ background: `oklch(0.65 0.20 ${hue})` }}
      />

      {/* Pinned indicator override */}
      {post.isPinned && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
      )}

      {/* Upvote column */}
      <div className="flex flex-col items-center pt-1">
        <UpvoteButton
          targetId={post.id}
          targetType="POST"
          initialCount={post.upvotes}
          initialUpvoted={post.hasUpvoted}
          mock
          onMockToggle={() => onUpvote(post.id)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {post.isPinned && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] py-0 h-5 bg-amber-500/10 border-amber-500/30 text-amber-400"
                >
                  <Pin className="h-2.5 w-2.5" />
                  Pinned
                </Badge>
              )}
              <h3 className="text-base font-semibold text-foreground group-hover:text-[oklch(0.78_0.14_264)] transition-colors leading-snug">
                {post.title}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">{post.content}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <TagPill key={tag} name={tag} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <Link
            href={`/forum/user/${getMockUserSlug(post.author.name)}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 rounded-lg p-0.5 -m-0.5 hover:bg-white/5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm bg-gradient-to-br from-muted/60 to-muted/30 border border-border">
              <span className="text-muted-foreground">{post.author.avatar}</span>
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-foreground hover:text-indigo-400 transition-colors truncate block">
                {post.author.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatNumber(post.author.reputation)} rep
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatNumber(post.views)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {post.commentCount}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(post.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
