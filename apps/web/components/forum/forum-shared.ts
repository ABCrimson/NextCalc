/**
 * Forum Shared Constants, Types, and Utilities
 *
 * Centralizes the OKLCH hue generation, tag styling, tier config,
 * and formatting helpers used across all forum components.
 */

import { Award, type LucideIcon, Sparkles, Zap } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

/** GraphQL ForumPost node shape from FORUM_POSTS_QUERY */
export interface ForumPostNode {
  id: string;
  title: string;
  content: string;
  tags: string[];
  views: number;
  isPinned: boolean;
  isClosed: boolean;
  createdAt: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  commentCount: number;
  comments?: { id: string }[];
}

/** GraphQL Comment shape from FORUM_POST_QUERY */
export interface CommentNode {
  id: string;
  content: string;
  createdAt: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  parent: { id: string } | null;
  replies: CommentReply[];
}

/** Reply shape within a comment */
export interface CommentReply {
  id: string;
  content: string;
  createdAt: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

/** Full post detail shape from FORUM_POST_QUERY */
export interface ForumPostDetail {
  id: string;
  title: string;
  content: string;
  tags: string[];
  views: number;
  isPinned: boolean;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  commentCount?: number;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    bio: string | null;
    role: string;
    createdAt: string;
  };
  comments: CommentNode[];
}

/** User profile shape from USER_PROFILE_QUERY */
export interface UserProfileData {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  role: string;
  createdAt: string;
  worksheetCount: number;
  forumPosts: {
    id: string;
    title: string;
    tags: string[];
    createdAt: string;
    upvoteCount: number;
    views: number;
  }[];
}

export type SortMode = 'hot' | 'new' | 'top';

// ============================================================================
// TAG SYSTEM
// ============================================================================

export const TAGS = [
  { name: 'calculus', color: 'from-blue-500/20 to-blue-600/20 text-blue-300 border-blue-500/30' },
  {
    name: 'linear-algebra',
    color: 'from-purple-500/20 to-purple-600/20 text-purple-300 border-purple-500/30',
  },
  {
    name: 'statistics',
    color: 'from-emerald-500/20 to-emerald-600/20 text-emerald-300 border-emerald-500/30',
  },
  {
    name: 'differential-eq',
    color: 'from-orange-500/20 to-orange-600/20 text-orange-300 border-orange-500/30',
  },
  {
    name: 'number-theory',
    color: 'from-rose-500/20 to-rose-600/20 text-rose-300 border-rose-500/30',
  },
  {
    name: 'complex-analysis',
    color: 'from-cyan-500/20 to-cyan-600/20 text-cyan-300 border-cyan-500/30',
  },
  {
    name: 'help',
    color: 'from-yellow-500/20 to-yellow-600/20 text-yellow-300 border-yellow-500/30',
  },
  {
    name: 'discussion',
    color: 'from-indigo-500/20 to-indigo-600/20 text-indigo-300 border-indigo-500/30',
  },
  { name: 'showcase', color: 'from-pink-500/20 to-pink-600/20 text-pink-300 border-pink-500/30' },
  { name: 'bug-report', color: 'from-red-500/20 to-red-600/20 text-red-300 border-red-500/30' },
] as const;

export function getTagStyle(tagName: string): string {
  const tag = TAGS.find((t) => t.name === tagName);
  return tag?.color ?? 'from-muted/30 to-muted/20 text-muted-foreground border-border';
}

// ============================================================================
// TIER SYSTEM
// ============================================================================

export interface TierConfig {
  label: string;
  color: string;
  icon: LucideIcon | null;
  glow: string;
}

export const TIER_CONFIG: Record<string, TierConfig> = {
  newcomer: { label: 'Newcomer', color: 'text-muted-foreground', icon: null, glow: '' },
  contributor: {
    label: 'Contributor',
    color: 'text-blue-400',
    icon: Zap,
    glow: 'shadow-[0_0_8px_oklch(0.65_0.22_264/0.3)]',
  },
  expert: {
    label: 'Expert',
    color: 'text-purple-400',
    icon: Award,
    glow: 'shadow-[0_0_12px_oklch(0.63_0.20_300/0.4)]',
  },
  legend: {
    label: 'Legend',
    color: 'text-amber-400',
    icon: Sparkles,
    glow: 'shadow-[0_0_16px_oklch(0.75_0.18_70/0.5)]',
  },
} as const;

const DEFAULT_TIER: TierConfig = {
  label: 'Newcomer',
  color: 'text-muted-foreground',
  icon: null,
  glow: '',
};

export function getTierFromRole(role: string): TierConfig {
  if (role === 'ADMIN') return TIER_CONFIG['legend'] ?? DEFAULT_TIER;
  if (role === 'MODERATOR') return TIER_CONFIG['expert'] ?? DEFAULT_TIER;
  return TIER_CONFIG['contributor'] ?? DEFAULT_TIER;
}

// ============================================================================
// OKLCH HUE SYSTEM
// ============================================================================

/** Deterministic hue from a post ID for per-card OKLCH coloring */
export function getPostHue(postId: string): number {
  let hash = 0;
  for (const char of postId) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return ((hash % 360) + 360) % 360;
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

// Locale-aware date / number / relative-time formatting is handled directly in
// the forum client components via next-intl's `useFormatter()`, which binds the
// active request locale automatically — see post-card, comment-thread,
// user-profile-card and the *-client views. Hand-rolling `Intl.*` here invited
// callers to forget the locale argument (rendering in the runtime default), so
// those helpers were removed in favour of the framework formatter.

/** Get initials from a name string */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
