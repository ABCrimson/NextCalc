'use client';

/**
 * User Profile — Client Component
 *
 * Displays a user's profile with their forum posts and activity.
 * Uses Apollo Client for data fetching.
 */

import { useQuery } from '@apollo/client/react';
import { m, useReducedMotion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Clock, Eye, MessageSquare, ThumbsUp } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ForumBackground } from '@/components/forum/forum-background';
import {
  buildMockUserProfile,
  formatNumber,
  getMockUser,
  getPostHue,
  timeAgo,
  type UserProfileData,
} from '@/components/forum/forum-shared';
import { TagPill } from '@/components/forum/post-card';
import { UserProfileCard } from '@/components/forum/user-profile-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { USER_PROFILE_QUERY } from '@/lib/graphql/forum-operations';

// ============================================================================
// LOADING SKELETON
// ============================================================================

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border p-6 backdrop-blur-md bg-card/30">
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={`skeleton-post-${idx}`} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// USER PROFILE
// ============================================================================

interface UserProfileClientProps {
  id: string;
}

export function UserProfileClient({ id }: UserProfileClientProps) {
  const t = useTranslations('forum');
  const prefersReduced = useReducedMotion();
  const router = useRouter();

  const { data, loading, error } = useQuery<{ user: UserProfileData | null }>(USER_PROFILE_QUERY, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });

  // Fall back to mock data when GraphQL is unavailable
  const user: UserProfileData | null = (() => {
    if (data?.user) return data.user;
    if (error || (!loading && !data?.user)) {
      const mockUser = getMockUser(id);
      if (mockUser) return buildMockUserProfile(mockUser);
    }
    return null;
  })();

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
              <ArrowLeft className="h-4 w-4" />
              {t('backToForum')}
            </Button>
          </m.div>

          {/* Loading */}
          {loading && !user && <ProfileSkeleton />}

          {/* Error — only show when no mock fallback */}
          {error && !user && !getMockUser(id) && (
            <div className="rounded-2xl border border-destructive/30 p-6 bg-destructive/10 backdrop-blur-md text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
              <p className="text-sm text-destructive">{t('userNotFound')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('userNotFoundHint')}</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push('/forum')}>
                {t('backToForum')}
              </Button>
            </div>
          )}

          {/* Profile */}
          {user && (
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
              {/* Profile card */}
              <UserProfileCard user={user} />

              {/* Tabs */}
              <Tabs defaultValue="posts" className="w-full">
                <TabsList className="backdrop-blur-sm bg-muted/30 border border-border w-full justify-start">
                  <TabsTrigger value="posts" className="gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {t('postsCount', { count: user.forumPosts.length })}
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {t('activityTab')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="posts" className="space-y-3 mt-4">
                  {user.forumPosts.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">{t('noPostsYet')}</p>
                    </div>
                  ) : (
                    user.forumPosts.map((post, i) => {
                      const hue = getPostHue(post.id);
                      return (
                        <m.div
                          key={post.id}
                          {...(prefersReduced
                            ? {}
                            : {
                                initial: { opacity: 0, y: 8 },
                                animate: { opacity: 1, y: 0 },
                                transition: { delay: i * 0.04, duration: 0.3 },
                              })}
                        >
                          <Link
                            href={`/forum/${post.id}`}
                            className="block group rounded-xl border p-4 transition-all duration-200 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            style={{
                              background: `oklch(0.20 0.02 ${hue} / 0.35)`,
                              borderColor: `oklch(0.45 0.06 ${hue} / 0.25)`,
                              backdropFilter: 'blur(12px)',
                            }}
                          >
                            <div
                              className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
                              style={{ background: `oklch(0.65 0.20 ${hue})` }}
                            />

                            <h3 className="text-sm font-semibold text-foreground group-hover:text-indigo-400 transition-colors mb-2 ml-2">
                              {post.title}
                            </h3>

                            <div className="flex items-center gap-3 ml-2">
                              <div className="flex flex-wrap gap-1.5">
                                {post.tags.map((tag) => (
                                  <TagPill key={tag} name={tag} />
                                ))}
                              </div>

                              <div className="flex items-center gap-3 ml-auto text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <ThumbsUp className="h-3 w-3" />
                                  {formatNumber(post.upvoteCount)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {formatNumber(post.views)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {timeAgo(post.createdAt)}
                                </span>
                              </div>
                            </div>
                          </Link>
                        </m.div>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <div className="rounded-2xl border border-border p-6 backdrop-blur-md bg-card/50 text-center">
                    <Clock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">{t('activityComingSoon')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {t('activityComingSoonHint')}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </m.div>
          )}
        </div>
      </div>
    </main>
  );
}
