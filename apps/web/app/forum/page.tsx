'use client';

/**
 * NextCalc Pro Community Forum
 *
 * Main forum listing page with GraphQL-powered data (falls back to
 * mock data when the API is unavailable). Preserves the original
 * glass morphism, OKLCH color system, and Framer Motion animations.
 *
 * Now wired to Apollo Client for real CRUD + upvotes.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useQuery } from '@apollo/client/react';
import {
  MessageSquare,
  TrendingUp,
  Clock,
  Flame,
  ThumbsUp,
  Search,
  Plus,
  Hash,
  Filter,
  ArrowUpRight,
  Sparkles,
  Users,
  Award,
  Zap,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PostCard, MockPostCard, TagPill } from '@/components/forum/post-card';
import { ForumBackground } from '@/components/forum/forum-background';
import { FORUM_POSTS_QUERY } from '@/lib/graphql/forum-operations';
import { useSession } from '@/lib/auth/hooks';
import {
  type ForumPostNode,
  type MockForumPost,
  type SortMode,
  TAGS,
  TIER_CONFIG,
  MOCK_POSTS,
  formatNumber,
} from '@/components/forum/forum-shared';
import { cn } from '@/lib/utils';

// ============================================================================
// LOADING SKELETON
// ============================================================================

function PostSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border border-border p-5 backdrop-blur-md bg-card/30">
      <div className="flex flex-col items-center gap-2 pt-1">
        <Skeleton className="h-10 w-8 rounded-xl" />
      </div>
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ForumPage() {
  const prefersReduced = useReducedMotion();
  const router = useRouter();
  const { status: authStatus } = useSession();

  // Search & filter state
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Debounce search for GraphQL query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Mock data state (fallback)
  const [mockPosts, setMockPosts] = useState<MockForumPost[]>(MOCK_POSTS);

  // GraphQL query
  interface ForumPostsQueryData {
    forumPosts: {
      nodes: ForumPostNode[];
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        totalCount: number;
        currentPage: number;
        totalPages: number;
      };
    };
  }

  const { data, loading, error } = useQuery<ForumPostsQueryData>(FORUM_POSTS_QUERY, {
    variables: {
      limit: 50,
      offset: 0,
      ...(debouncedSearch.trim() ? { searchQuery: debouncedSearch.trim() } : {}),
      ...(selectedTag ? { tags: [selectedTag] } : {}),
    },
    fetchPolicy: 'cache-and-network',
  });

  // Determine data source
  const useGraphQL = !error && data?.forumPosts?.nodes && data.forumPosts.nodes.length > 0;
  const graphqlPosts: ForumPostNode[] = useGraphQL ? data.forumPosts.nodes : [];

  // Client-side sort for GraphQL data
  const sortedGraphqlPosts = useMemo(() => {
    if (!useGraphQL) return [];
    const posts = [...graphqlPosts];

    const pinned = posts.filter(p => p.isPinned);
    const unpinned = posts.filter(p => !p.isPinned);

    switch (sortMode) {
      case 'hot':
        unpinned.sort((a, b) => {
          const scoreA = a.upvoteCount * 2 + (a.comments?.length ?? 0) * 3 + a.views * 0.1;
          const scoreB = b.upvoteCount * 2 + (b.comments?.length ?? 0) * 3 + b.views * 0.1;
          return scoreB - scoreA;
        });
        break;
      case 'new':
        unpinned.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'top':
        unpinned.sort((a, b) => b.upvoteCount - a.upvoteCount);
        break;
    }

    return [...pinned, ...unpinned];
  }, [useGraphQL, graphqlPosts, sortMode]);

  // Client-side sort/filter for mock data (when GraphQL is unavailable)
  const toggleMockUpvote = useCallback((postId: string) => {
    setMockPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? { ...p, hasUpvoted: !p.hasUpvoted, upvotes: p.hasUpvoted ? p.upvotes - 1 : p.upvotes + 1 }
          : p,
      ),
    );
  }, []);

  const sortedMockPosts = useMemo(() => {
    let filtered = mockPosts;

    if (searchInput.trim()) {
      const q = searchInput.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some(t => t.includes(q)),
      );
    }

    if (selectedTag) {
      filtered = filtered.filter(p => p.tags.includes(selectedTag));
    }

    const pinned = filtered.filter(p => p.isPinned);
    const unpinned = filtered.filter(p => !p.isPinned);

    switch (sortMode) {
      case 'hot':
        unpinned.sort((a, b) => {
          const scoreA = a.upvotes * 2 + a.commentCount * 3 + a.views * 0.1;
          const scoreB = b.upvotes * 2 + b.commentCount * 3 + b.views * 0.1;
          return scoreB - scoreA;
        });
        break;
      case 'new':
        unpinned.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'top':
        unpinned.sort((a, b) => b.upvotes - a.upvotes);
        break;
    }

    return [...pinned, ...unpinned];
  }, [mockPosts, sortMode, searchInput, selectedTag]);

  // Stats
  const totalPosts = useGraphQL
    ? (data.forumPosts.pageInfo?.totalCount ?? graphqlPosts.length)
    : mockPosts.length;
  const totalComments = useGraphQL
    ? graphqlPosts.reduce((sum: number, p: ForumPostNode) => sum + (p.comments?.length ?? 0), 0)
    : mockPosts.reduce((sum, p) => sum + p.commentCount, 0);
  const totalContributors = useGraphQL
    ? new Set(graphqlPosts.map((p: ForumPostNode) => p.user.id)).size
    : new Set(mockPosts.map(p => p.author.name)).size;

  const handleNewPost = useCallback(() => {
    if (authStatus !== 'authenticated') {
      window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent('/forum/new')}`;
      return;
    }
    router.push('/forum/new');
  }, [authStatus, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <ForumBackground />

      {/* Content */}
      <div className="relative z-10 py-12 px-4">
        <div className="container mx-auto max-w-5xl">

          {/* Hero Header */}
          <motion.header
            className="mb-10"
            {...(prefersReduced
              ? {}
              : {
                  initial: { opacity: 0, y: -20 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.5 },
                })}
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 backdrop-blur-sm">
                  <MessageSquare className="w-9 h-9 text-indigo-400" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-pink-500/10 blur-xl animate-pulse" />
              </div>
              <div>
                <h1 className="text-5xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
                  Community
                </h1>
                <p className="text-muted-foreground mt-1">
                  Share ideas, ask questions, and explore mathematics together
                </p>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap gap-3 mt-5">
              <Badge variant="outline" className="gap-1.5 py-1 px-3 backdrop-blur-sm bg-muted/30 border-border text-foreground">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                {totalPosts} discussions
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1 px-3 backdrop-blur-sm bg-muted/30 border-border text-foreground">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                {totalContributors} contributors
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1 px-3 backdrop-blur-sm bg-muted/30 border-border text-foreground">
                <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
                {totalComments} replies
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1 px-3 backdrop-blur-sm bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                Real-time
              </Badge>
            </div>
          </motion.header>

          {/* Main layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

            {/* Left: Posts */}
            <div className="space-y-4">

              {/* Search + Sort + New Post */}
              <motion.div
                className="flex flex-col sm:flex-row gap-3"
                {...(prefersReduced
                  ? {}
                  : {
                      initial: { opacity: 0, y: 10 },
                      animate: { opacity: 1, y: 0 },
                      transition: { delay: 0.15, duration: 0.4 },
                    })}
              >
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search discussions..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    className="pl-9 bg-card/50 backdrop-blur-md border-border"
                  />
                </div>

                {/* Sort tabs */}
                <div className="flex rounded-xl bg-muted/30 backdrop-blur-sm border border-border p-1 gap-1">
                  {([
                    { mode: 'hot' as const, icon: Flame, label: 'Hot' },
                    { mode: 'new' as const, icon: Clock, label: 'New' },
                    { mode: 'top' as const, icon: TrendingUp, label: 'Top' },
                  ]).map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => setSortMode(mode)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        sortMode === mode
                          ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-foreground shadow-sm border border-indigo-500/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* New Post */}
                <Button
                  onClick={handleNewPost}
                  className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_4px_24px_oklch(0.55_0.27_264/0.3)] hover:shadow-[0_6px_32px_oklch(0.55_0.27_264/0.45)] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  New Post
                </Button>
              </motion.div>

              {/* Active tag filter indicator */}
              <AnimatePresence>
                {selectedTag && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Filtering by:</span>
                    <TagPill name={selectedTag} />
                    <button
                      onClick={() => setSelectedTag(null)}
                      className="text-xs text-muted-foreground hover:text-foreground underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      Clear
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading state */}
              {loading && !data && (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <PostSkeleton key={i} />
                  ))}
                </div>
              )}

              {/* Post list — GraphQL or Mock */}
              {!loading || data ? (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {useGraphQL
                      ? sortedGraphqlPosts.map((post, i) => (
                          <PostCard key={post.id} post={post} index={i} />
                        ))
                      : sortedMockPosts.map((post, i) => (
                          <MockPostCard
                            key={post.id}
                            post={post}
                            index={i}
                            onUpvote={toggleMockUpvote}
                          />
                        ))}
                  </AnimatePresence>

                  {(useGraphQL ? sortedGraphqlPosts : sortedMockPosts).length === 0 && !loading && (
                    <div className="text-center py-16">
                      <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No discussions found</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Try adjusting your search or filter
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Load more (GraphQL only) */}
              {useGraphQL && data.forumPosts.pageInfo?.hasNextPage && (
                <div className="text-center pt-4">
                  <Button variant="outline" className="backdrop-blur-sm bg-card/50">
                    <Loader2 className="h-4 w-4 mr-2" />
                    Load more
                  </Button>
                </div>
              )}
            </div>

            {/* Right: Sidebar */}
            <motion.aside
              className="space-y-4"
              {...(prefersReduced
                ? {}
                : {
                    initial: { opacity: 0, x: 20 },
                    animate: { opacity: 1, x: 0 },
                    transition: { delay: 0.3, duration: 0.4 },
                  })}
            >
              {/* Tags cloud */}
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hash className="h-4 w-4 text-indigo-400" />
                    Popular Topics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {TAGS.map(tag => (
                      <button
                        key={tag.name}
                        onClick={() => setSelectedTag(prev => prev === tag.name ? null : tag.name)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                          'border backdrop-blur-sm bg-gradient-to-r',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          tag.color,
                          selectedTag === tag.name && 'ring-2 ring-white/20 scale-105',
                        )}
                      >
                        #{tag.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Community guidelines */}
              <Card className="backdrop-blur-md bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border-indigo-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-indigo-300">
                    <Sparkles className="h-4 w-4" />
                    Community Guidelines
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {[
                    { icon: ThumbsUp, text: 'Be respectful and constructive' },
                    { icon: MessageSquare, text: 'Show your work and reasoning' },
                    { icon: Award, text: 'Give credit for solutions' },
                    { icon: Zap, text: 'Use LaTeX for math notation' },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-start gap-2">
                      <Icon className="h-3.5 w-3.5 mt-0.5 text-indigo-400/80 shrink-0" />
                      <span className="text-xs text-indigo-200/70">{text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top contributors */}
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-400" />
                    Top Contributors
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: 'Alice Chen', rep: 4280, tier: 'legend' },
                    { name: 'Sofia Rossi', rep: 3100, tier: 'legend' },
                    { name: 'Priya Sharma', rep: 2150, tier: 'expert' },
                    { name: 'David Kim', rep: 1670, tier: 'expert' },
                    { name: 'James Wright', rep: 1200, tier: 'contributor' },
                  ].map((user, i) => {
                    const tier = TIER_CONFIG[user.tier] ?? TIER_CONFIG['newcomer'] ?? { label: 'Newcomer', color: 'text-zinc-400', icon: null, glow: '' };
                    const TIcon = tier.icon;
                    return (
                      <div key={user.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4 text-right">
                          {i + 1}
                        </span>
                        <div
                          className={cn(
                            'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold',
                            'bg-gradient-to-br from-muted/60 to-muted/30 border border-border',
                            tier.glow,
                          )}
                        >
                          <span className={tier.color}>
                            {user.name
                              .split(' ')
                              .map(n => n[0])
                              .join('')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold truncate">{user.name}</span>
                            {TIcon && <TIcon className={cn('h-3 w-3', tier.color)} />}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {formatNumber(user.rep)}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Quick links */}
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {[
                    { label: 'Calculator', href: '/' },
                    { label: 'Fourier Analysis', href: '/fourier' },
                    { label: 'Complex Numbers', href: '/complex' },
                    { label: 'PDE Solver', href: '/pde' },
                    { label: 'Practice Problems', href: '/practice' },
                  ].map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {link.label}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.aside>
          </div>
        </div>
      </div>
    </main>
  );
}
