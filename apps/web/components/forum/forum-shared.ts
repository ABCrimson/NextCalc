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
  comments: { id: string }[];
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

/** Mock post shape for the fallback data */
export interface MockForumPost {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    avatar: string;
    reputation: number;
    tier: 'newcomer' | 'contributor' | 'expert' | 'legend';
  };
  tags: string[];
  upvotes: number;
  views: number;
  commentCount: number;
  isPinned: boolean;
  isClosed: boolean;
  createdAt: Date;
  hasUpvoted: boolean;
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
  newcomer: { label: 'Newcomer', color: 'text-zinc-400', icon: null, glow: '' },
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
  color: 'text-zinc-400',
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

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

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

// ============================================================================
// LOCAL STORAGE HELPERS (persist mock upvotes across reloads)
// ============================================================================

const UPVOTE_STORAGE_KEY = 'nextcalc-forum-upvotes';

export function getStoredUpvotes(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(UPVOTE_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setStoredUpvote(postId: string, upvoted: boolean): void {
  if (typeof window === 'undefined') return;
  const stored = getStoredUpvotes();
  if (upvoted) {
    stored[postId] = true;
  } else {
    delete stored[postId];
  }
  localStorage.setItem(UPVOTE_STORAGE_KEY, JSON.stringify(stored));
}

// ============================================================================
// MOCK USER DATA
// ============================================================================

export function getMockUserSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export interface MockUser {
  id: string;
  name: string;
  bio: string;
  reputation: number;
  tier: 'newcomer' | 'contributor' | 'expert' | 'legend';
  role: string;
  createdAt: Date;
  postIds: string[];
}

export const MOCK_USERS: Record<string, MockUser> = {
  'alice-chen': {
    id: 'alice-chen',
    name: 'Alice Chen',
    bio: 'Passionate about real analysis and topology. PhD candidate in mathematics.',
    reputation: 4280,
    tier: 'legend',
    role: 'ADMIN',
    createdAt: new Date('2024-03-15'),
    postIds: ['1'],
  },
  'marcus-liu': {
    id: 'marcus-liu',
    name: 'Marcus Liu',
    bio: 'Undergraduate math major. Loves linear algebra and its applications.',
    reputation: 890,
    tier: 'contributor',
    role: 'USER',
    createdAt: new Date('2025-01-10'),
    postIds: ['2'],
  },
  'priya-sharma': {
    id: 'priya-sharma',
    name: 'Priya Sharma',
    bio: 'Complex analysis enthusiast. Building beautiful fractals with math.',
    reputation: 2150,
    tier: 'expert',
    role: 'MODERATOR',
    createdAt: new Date('2024-06-22'),
    postIds: ['3'],
  },
  'david-kim': {
    id: 'david-kim',
    name: 'David Kim',
    bio: 'Differential equations are my jam. Teaching assistant at university.',
    reputation: 1670,
    tier: 'expert',
    role: 'MODERATOR',
    createdAt: new Date('2024-08-05'),
    postIds: ['4'],
  },
  'raj-patel': {
    id: 'raj-patel',
    name: 'Raj Patel',
    bio: 'Computational fluid dynamics researcher. New to the community!',
    reputation: 340,
    tier: 'newcomer',
    role: 'USER',
    createdAt: new Date('2025-11-20'),
    postIds: ['5'],
  },
  'sofia-rossi': {
    id: 'sofia-rossi',
    name: 'Sofia Rossi',
    bio: 'Statistics professor. I believe everyone can learn to love data.',
    reputation: 3100,
    tier: 'legend',
    role: 'ADMIN',
    createdAt: new Date('2024-04-01'),
    postIds: ['6'],
  },
  'james-wright': {
    id: 'james-wright',
    name: 'James Wright',
    bio: 'Number theory hobbyist. Always chasing primes.',
    reputation: 1200,
    tier: 'contributor',
    role: 'USER',
    createdAt: new Date('2024-11-15'),
    postIds: ['7'],
  },
};

/** Look up a mock user by their slug ID */
export function getMockUser(slug: string): MockUser | undefined {
  return MOCK_USERS[slug];
}

/** Find mock post by ID */
export function getMockPostById(id: string): MockForumPost | undefined {
  return MOCK_POSTS.find((p) => p.id === id);
}

/** Build a ForumPostDetail from a mock post (for detail page fallback) */
export function buildMockPostDetail(post: MockForumPost): ForumPostDetail {
  const userSlug = getMockUserSlug(post.author.name);
  const mockUser = MOCK_USERS[userSlug];
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    tags: post.tags,
    views: post.views,
    isPinned: post.isPinned,
    isClosed: post.isClosed,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.createdAt.toISOString(),
    upvoteCount: post.upvotes,
    hasUpvoted: post.hasUpvoted,
    user: {
      id: userSlug,
      name: post.author.name,
      image: null,
      bio: mockUser?.bio ?? null,
      role: mockUser?.role ?? 'USER',
      createdAt: (mockUser?.createdAt ?? new Date('2025-01-01')).toISOString(),
    },
    comments: [],
  };
}

/** Build a UserProfileData from a mock user (for profile page fallback) */
export function buildMockUserProfile(user: MockUser): UserProfileData {
  const posts = user.postIds
    .map((id) => MOCK_POSTS.find((p) => p.id === id))
    .filter((p): p is MockForumPost => p !== undefined);

  return {
    id: user.id,
    name: user.name,
    image: null,
    bio: user.bio,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    worksheetCount: 0,
    forumPosts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      tags: p.tags,
      createdAt: p.createdAt.toISOString(),
      upvoteCount: p.upvotes,
      views: p.views,
    })),
  };
}

// ============================================================================
// MOCK DATA (fallback when GraphQL is unavailable)
// ============================================================================

export const MOCK_POSTS: MockForumPost[] = [
  {
    id: '1',
    title: 'Elegant proof: Every continuous function on [0,1] attains its maximum',
    content:
      "I've been working through the extreme value theorem and found a particularly clean proof using sequences...",
    author: { name: 'Alice Chen', avatar: 'AC', reputation: 4280, tier: 'legend' },
    tags: ['calculus', 'discussion'],
    upvotes: 142,
    views: 2840,
    commentCount: 38,
    isPinned: true,
    isClosed: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
    hasUpvoted: false,
  },
  {
    id: '2',
    title: 'Help understanding eigenvalue decomposition for symmetric matrices',
    content:
      "I'm struggling with why the spectral theorem guarantees orthogonal eigenvectors. Can someone explain intuitively?",
    author: { name: 'Marcus Liu', avatar: 'ML', reputation: 890, tier: 'contributor' },
    tags: ['linear-algebra', 'help'],
    upvotes: 67,
    views: 1230,
    commentCount: 24,
    isPinned: false,
    isClosed: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    hasUpvoted: false,
  },
  {
    id: '3',
    title: "Visualising the Mandelbrot set with NextCalc's complex number engine",
    content:
      "Just built an amazing Mandelbrot zoom using the complex number calculator. Here's how I did it with 1000 iterations...",
    author: { name: 'Priya Sharma', avatar: 'PS', reputation: 2150, tier: 'expert' },
    tags: ['complex-analysis', 'showcase'],
    upvotes: 203,
    views: 5120,
    commentCount: 51,
    isPinned: true,
    isClosed: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    hasUpvoted: false,
  },
  {
    id: '4',
    title: "Solving a tricky ODE: y'' + 4y' + 5y = e^(-2x)cos(x)",
    content:
      'This undetermined coefficients problem has a resonance case. Let me walk through my approach...',
    author: { name: 'David Kim', avatar: 'DK', reputation: 1670, tier: 'expert' },
    tags: ['differential-eq', 'calculus'],
    upvotes: 89,
    views: 1890,
    commentCount: 16,
    isPinned: false,
    isClosed: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
    hasUpvoted: false,
  },
  {
    id: '5',
    title: 'Feature request: GPU-accelerated matrix multiplication for large systems',
    content:
      'For my fluid dynamics research, I need to multiply 10000x10000 matrices. Would love WebGPU compute shader support...',
    author: { name: 'Raj Patel', avatar: 'RP', reputation: 340, tier: 'newcomer' },
    tags: ['linear-algebra', 'discussion'],
    upvotes: 45,
    views: 780,
    commentCount: 12,
    isPinned: false,
    isClosed: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    hasUpvoted: false,
  },
  {
    id: '6',
    title: 'Central Limit Theorem: Interactive demonstration with NextCalc stats',
    content:
      'I created a demonstration showing convergence to normal distribution with sample sizes 1 to 1000...',
    author: { name: 'Sofia Rossi', avatar: 'SR', reputation: 3100, tier: 'legend' },
    tags: ['statistics', 'showcase'],
    upvotes: 178,
    views: 3420,
    commentCount: 29,
    isPinned: false,
    isClosed: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    hasUpvoted: false,
  },
  {
    id: '7',
    title: 'Goldbach conjecture: Exploring patterns with the number theory tools',
    content:
      'Ran some experiments up to 10^8 and found interesting patterns in prime pair distributions...',
    author: { name: 'James Wright', avatar: 'JW', reputation: 1200, tier: 'contributor' },
    tags: ['number-theory', 'discussion'],
    upvotes: 56,
    views: 920,
    commentCount: 8,
    isPinned: false,
    isClosed: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    hasUpvoted: false,
  },
];
