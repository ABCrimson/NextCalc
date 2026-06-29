'use client';

/**
 * NextCalc Pro Community Forum
 *
 * Main forum listing page with GraphQL-powered data. Shows real empty/error
 * states when the DB has no posts or the API is unreachable.
 *
 * Preserves the original glass morphism, OKLCH color system, and Framer Motion
 * animations.
 */

import { useQuery } from '@apollo/client/react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  Clock,
  Filter,
  Flame,
  Hash,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ForumBackground } from '@/components/forum/forum-background';
import { type ForumPostNode, type SortMode, TAGS } from '@/components/forum/forum-shared';
import { PostCard, TagPill } from '@/components/forum/post-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/auth/hooks';
import { FORUM_POSTS_QUERY } from '@/lib/graphql/forum-operations';
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
// TYPES
// ============================================================================

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

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ForumPage() {
  const t = useTranslations('forum');
  const tCommon = useTranslations('common');
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

  // Page size for the initial query and each "Load more" fetch
  const PAGE_SIZE = 50;

  const { data, loading, error, fetchMore } = useQuery<ForumPostsQueryData>(FORUM_POSTS_QUERY, {
    variables: {
      limit: PAGE_SIZE,
      offset: 0,
      ...(debouncedSearch.trim() ? { searchQuery: debouncedSearch.trim() } : {}),
      ...(selectedTag ? { tags: [selectedTag] } : {}),
    },
    fetchPolicy: 'cache-and-network',
  });

  const graphqlPosts: ForumPostNode[] = data?.forumPosts?.nodes ?? [];

  // "Load more" pagination — fetch the next offset window and merge via the
  // offset-pagination typePolicy in lib/graphql/client.ts.
  const [loadingMore, setLoadingMore] = useState(false);

  const hasNextPage = data?.forumPosts?.pageInfo?.hasNextPage ?? false;

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage) return;
    setLoadingMore(true);
    try {
      await fetchMore({
        variables: {
          limit: PAGE_SIZE,
          offset: graphqlPosts.length,
          ...(debouncedSearch.trim() ? { searchQuery: debouncedSearch.trim() } : {}),
          ...(selectedTag ? { tags: [selectedTag] } : {}),
        },
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasNextPage, fetchMore, graphqlPosts.length, debouncedSearch, selectedTag]);

  // Client-side sort for GraphQL data
  const sortedPosts = useMemo(() => {
    const posts = [...graphqlPosts];

    const pinned = posts.filter((p) => p.isPinned);
    const unpinned = posts.filter((p) => !p.isPinned);

    switch (sortMode) {
      case 'hot': {
        const now = Date.now();
        unpinned.sort((a, b) => {
          const hoursA = Math.max(1, (now - new Date(a.createdAt).getTime()) / 3_600_000);
          const hoursB = Math.max(1, (now - new Date(b.createdAt).getTime()) / 3_600_000);
          const scoreA = (a.upvoteCount + (a.commentCount ?? 0) * 0.5) / (hoursA + 2) ** 1.5;
          const scoreB = (b.upvoteCount + (b.commentCount ?? 0) * 0.5) / (hoursB + 2) ** 1.5;
          return scoreB - scoreA;
        });
        break;
      }
      case 'new':
        unpinned.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'top':
        unpinned.sort((a, b) => b.upvoteCount - a.upvoteCount);
        break;
    }

    return [...pinned, ...unpinned];
  }, [graphqlPosts, sortMode]);

  // Stats from real data
  const totalPosts = data?.forumPosts?.pageInfo?.totalCount ?? graphqlPosts.length;
  const totalComments = graphqlPosts.reduce(
    (sum: number, p: ForumPostNode) => sum + (p.commentCount ?? 0),
    0,
  );
  const totalContributors = new Set(graphqlPosts.map((p: ForumPostNode) => p.user.id)).size;

  const handleNewPost = useCallback(() => {
    if (authStatus !== 'authenticated') {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent('/forum/new')}`);
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
          <m.header
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
                  {t('title')}
                </h1>
                <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap gap-3 mt-5">
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-3 backdrop-blur-sm bg-muted/30 border-border text-foreground"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                {t('discussions', { count: totalPosts })}
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-3 backdrop-blur-sm bg-muted/30 border-border text-foreground"
              >
                <Users className="w-3.5 h-3.5 text-purple-400" />
                {t('contributors', { count: totalContributors })}
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-3 backdrop-blur-sm bg-muted/30 border-border text-foreground"
              >
                <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
                {t('replies', { count: totalComments })}
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-3 backdrop-blur-sm bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {tCommon('realTime')}
              </Badge>
            </div>
          </m.header>

          {/* Main layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            {/* Left: Posts */}
            <div className="space-y-4">
              {/* Search + Sort + New Post */}
              <m.div
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
                    placeholder={t('search')}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9 bg-card/50 backdrop-blur-md border-border"
                  />
                </div>

                {/* Sort tabs */}
                <div className="flex rounded-xl bg-muted/30 backdrop-blur-sm border border-border p-1 gap-1">
                  {[
                    { mode: 'hot' as const, icon: Flame, label: t('sort.hot') },
                    { mode: 'new' as const, icon: Clock, label: t('sort.new') },
                    { mode: 'top' as const, icon: TrendingUp, label: t('sort.top') },
                  ].map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      type="button"
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
                  {t('newPost')}
                </Button>
              </m.div>

              {/* Active tag filter indicator */}
              <AnimatePresence>
                {selectedTag && (
                  <m.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{tCommon('filterBy')}</span>
                    <TagPill name={selectedTag} />
                    <button
                      type="button"
                      onClick={() => setSelectedTag(null)}
                      className="text-xs text-muted-foreground hover:text-foreground underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {tCommon('clear')}
                    </button>
                  </m.div>
                )}
              </AnimatePresence>

              {/* Loading state */}
              {loading && !data && (
                <div className="space-y-3">
                  {['sk-0', 'sk-1', 'sk-2', 'sk-3'].map((k) => (
                    <PostSkeleton key={k} />
                  ))}
                </div>
              )}

              {/* Error state */}
              {error && !loading && (
                <div className="rounded-2xl border border-destructive/30 p-6 bg-destructive/10 backdrop-blur-md text-center">
                  <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
                  <p className="text-sm text-destructive">{t('loadError')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('loadErrorHint')}</p>
                </div>
              )}

              {/* Post list */}
              {(!loading || data) && !error ? (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {sortedPosts.map((post, i) => (
                      <PostCard key={post.id} post={post} index={i} />
                    ))}
                  </AnimatePresence>

                  {sortedPosts.length === 0 && !loading && (
                    <div className="text-center py-16">
                      <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">{t('noDiscussions')}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {t('noDiscussionsHint')}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Load more */}
              {!error && hasNextPage && sortedPosts.length > 0 && (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="gap-2 backdrop-blur-md bg-card/50 border-border"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {tCommon('loading')}
                      </>
                    ) : (
                      t('loadMore')
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Right: Sidebar */}
            <m.aside
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
                    {t('popularTopics')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {TAGS.map((tag) => (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() =>
                          setSelectedTag((prev) => (prev === tag.name ? null : tag.name))
                        }
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
                    {t('communityGuidelines')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {[
                    { icon: ThumbsUp, text: t('guideline.respectful') },
                    { icon: MessageSquare, text: t('guideline.showWork') },
                    { icon: Award, text: t('guideline.giveCredit') },
                    { icon: Zap, text: t('guideline.useLatex') },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-start gap-2">
                      <Icon className="h-3.5 w-3.5 mt-0.5 text-indigo-400/80 shrink-0" />
                      <span className="text-xs text-indigo-200/70">{text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top contributors — schema gap: no resolver for this aggregation */}
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-400" />
                    {t('topContributors')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">{t('noContributorsYet')}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Quick links */}
              <Card className="backdrop-blur-md bg-card/50 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t('quickLinks')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {[
                    { label: t('link.calculator'), href: '/' },
                    { label: t('link.fourier'), href: '/fourier' },
                    { label: t('link.complex'), href: '/complex' },
                    { label: t('link.pde'), href: '/pde' },
                    { label: t('link.practice'), href: '/practice' },
                  ].map((link) => (
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
            </m.aside>
          </div>
        </div>
      </div>
    </main>
  );
}
