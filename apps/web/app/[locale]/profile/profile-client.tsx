'use client';

import { useQuery } from '@apollo/client/react';
import { m } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { AchievementGrid } from '@/components/profile/achievement-grid';
import { AnalyticsCharts } from '@/components/profile/analytics-charts';
import { PracticeHistoryTable } from '@/components/profile/practice-history-table';
import { ProfileOverview } from '@/components/profile/profile-overview';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { signIn, useSession } from '@/lib/auth/hooks';
import {
  DASHBOARD_RECENT_ACTIVITY_QUERY,
  USER_ACTIVITY_QUERY,
  USER_ANALYTICS_QUERY,
  USER_PROFILE_QUERY,
} from '@/lib/graphql/operations';

// ---------------------------------------------------------------------------
// Types matching the GraphQL schema operations
// ---------------------------------------------------------------------------

interface UserProfileData {
  userProfile: {
    user: {
      id: string;
      name: string | null;
      image: string | null;
      bio: string | null;
      createdAt: string;
    };
    progress: {
      id: string;
      problemsSolved: number;
      totalPoints: number;
      streak: number;
      longestStreak: number;
      level: number;
      experience: number;
      lastActive: string;
    } | null;
    recentAchievements: Array<{
      id: string;
      name: string;
      description: string;
      type: string;
      icon: string;
      points: number;
      badgeUrl: string | null;
      earnedAt: string;
    }>;
    worksheetCount: number;
    forumPostCount: number;
    calculationCount: number;
  };
}

interface UserActivityData {
  userActivity: Array<{ date: string; count: number }>;
}

interface UserAnalyticsData {
  userAnalytics: {
    topicMastery: Array<{ topic: string; mastery: number; problemsSolved: number }>;
    accuracyTrend: Array<{ date: string; accuracy: number }>;
    practiceHistory: Array<{
      id: string;
      topic: string;
      score: number;
      accuracy: number;
      totalTime: number;
      completedAt: string | null;
    }>;
    streakHistory: Array<{ date: string; streak: number }>;
  };
}

interface DashboardRecentActivityData {
  calculationHistory: Array<{
    id: string;
    expression: string;
    result: string;
    timestamp: string;
  }>;
  worksheets: {
    nodes: Array<{
      id: string;
      title: string;
      description: string | null;
      visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
      updatedAt: string;
      createdAt: string;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      totalCount: number;
      currentPage: number;
      totalPages: number;
    };
  };
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading profile data">
      {/* Hero card skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Skeleton className="h-24 w-24 flex-shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions skeleton */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Activity feed + calendar skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <Skeleton className="h-3 w-12 flex-shrink-0" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-32 w-full rounded" />
        </div>
      </div>

      {/* Tabs list skeleton */}
      <Skeleton className="h-10 w-full max-w-lg rounded-md" />

      {/* Content area skeleton */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  const tError = useTranslations('error');
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <span className="mb-3 text-4xl" aria-hidden="true">
        ⚠️
      </span>
      <p className="text-base font-semibold text-foreground">{tError('title')}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {tError('tryAgain')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign-in prompt (for unauthenticated visitors)
// ---------------------------------------------------------------------------

function SignInPrompt() {
  const tAuth = useTranslations('auth');
  const tProfile = useTranslations('profile');
  const tError = useTranslations('error');
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-border"
          style={{
            background:
              'linear-gradient(135deg, oklch(0.55 0.27 264 / 0.15), oklch(0.58 0.22 300 / 0.15))',
          }}
          aria-hidden="true"
        >
          <span className="text-4xl">👤</span>
        </div>

        <h2 className="text-2xl font-bold text-foreground">{tProfile('signInToView')}</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {tProfile('signInToViewHint')}
        </p>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => signIn('/profile')}
            className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{
              background: 'linear-gradient(135deg, oklch(0.55 0.27 264), oklch(0.60 0.25 300))',
            }}
          >
            {tAuth('signIn')}
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {tError('goHome')}
          </Link>
        </div>
      </m.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Framer Motion variants
// ---------------------------------------------------------------------------

const fadeInVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
} as const;

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'achievements' | 'analytics' | 'history';

interface TabDef {
  id: TabId;
  labelKey: string;
  ariaLabelKey: string;
}

const TABS: readonly TabDef[] = [
  { id: 'overview', labelKey: 'tab.overview', ariaLabelKey: 'tab.overview' },
  { id: 'achievements', labelKey: 'tab.achievements', ariaLabelKey: 'tab.achievements' },
  { id: 'analytics', labelKey: 'tab.analytics', ariaLabelKey: 'tab.analytics' },
  { id: 'history', labelKey: 'tab.history', ariaLabelKey: 'tab.history' },
] as const;

// ---------------------------------------------------------------------------
// ProfileDashboard — rendered once we have a valid user ID
// ---------------------------------------------------------------------------

interface ProfileDashboardProps {
  userId: string;
}

function ProfileDashboard({ userId }: ProfileDashboardProps) {
  const tProfile = useTranslations('profile');

  const {
    data: profileData,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery<UserProfileData>(USER_PROFILE_QUERY, {
    variables: { userId },
    errorPolicy: 'all',
  });

  const {
    data: activityData,
    loading: activityLoading,
    error: activityError,
    refetch: refetchActivity,
  } = useQuery<UserActivityData>(USER_ACTIVITY_QUERY, {
    variables: { userId },
    errorPolicy: 'all',
  });

  const {
    data: analyticsData,
    loading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery<UserAnalyticsData>(USER_ANALYTICS_QUERY, {
    variables: { userId },
    errorPolicy: 'all',
  });

  const {
    data: recentData,
    loading: recentLoading,
    error: recentError,
  } = useQuery<DashboardRecentActivityData>(DASHBOARD_RECENT_ACTIVITY_QUERY, {
    variables: { userId },
    errorPolicy: 'all',
  });

  const isLoading = profileLoading || activityLoading || analyticsLoading || recentLoading;

  // Show skeleton while any required query is loading and no data yet
  if (isLoading && !profileData) {
    return <ProfileSkeleton />;
  }

  // Show error if profile query fails and we have no fallback data
  if (profileError && !profileData) {
    return (
      <ErrorState
        message={profileError.message}
        onRetry={() => {
          void refetchProfile();
          void refetchActivity();
          void refetchAnalytics();
        }}
      />
    );
  }

  const profile = profileData?.userProfile;
  if (!profile) {
    return (
      <ErrorState
        message={tProfile('profileNotLoaded')}
        onRetry={() => {
          void refetchProfile();
          void refetchActivity();
          void refetchAnalytics();
        }}
      />
    );
  }

  const activityList = activityData?.userActivity ?? [];
  const analytics = analyticsData?.userAnalytics;

  const topicMastery = analytics?.topicMastery ?? [];
  const accuracyTrend = analytics?.accuracyTrend ?? [];
  const streakHistory = analytics?.streakHistory ?? [];
  const practiceHistory = analytics?.practiceHistory ?? [];

  const recentCalculations = recentData?.calculationHistory ?? [];
  const recentWorksheets = recentData?.worksheets?.nodes ?? [];

  return (
    <m.div variants={fadeInVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Partial-data warning banners */}
      {(activityError ?? analyticsError ?? recentError) && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400"
        >
          {tProfile('partialData')}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto" aria-label="Profile sections">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} aria-label={tProfile(tab.ariaLabelKey)}>
              {tProfile(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview — the primary dashboard tab */}
        <TabsContent value="overview" className="mt-6">
          <ProfileOverview
            user={profile.user}
            progress={profile.progress}
            worksheetCount={profile.worksheetCount}
            forumPostCount={profile.forumPostCount}
            calculationCount={profile.calculationCount}
            recentAchievements={profile.recentAchievements}
            activityData={activityList}
            recentCalculations={recentCalculations}
            recentWorksheets={recentWorksheets}
          />
        </TabsContent>

        {/* Achievements */}
        <TabsContent value="achievements" className="mt-6">
          <AchievementGrid achievements={profile.recentAchievements} />
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="mt-6">
          <AnalyticsCharts
            topicMastery={topicMastery}
            accuracyTrend={accuracyTrend}
            streakHistory={streakHistory}
          />
        </TabsContent>

        {/* Practice History */}
        <TabsContent value="history" className="mt-6">
          <PracticeHistoryTable sessions={practiceHistory} />
        </TabsContent>
      </Tabs>
    </m.div>
  );
}

// ---------------------------------------------------------------------------
// ProfileClient — top-level exported component
// ---------------------------------------------------------------------------

export function ProfileClient() {
  const t = useTranslations('profile');
  const { session, status } = useSession();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      {/* Page header */}
      <m.header
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1
          className="text-3xl font-bold sm:text-4xl"
          style={{
            background: 'linear-gradient(135deg, oklch(0.75 0.18 264), oklch(0.72 0.20 300))',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {t('myProfile')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('myProfileSubtitle')}</p>
      </m.header>

      {/* Main content area */}
      {status === 'loading' && <ProfileSkeleton />}

      {status === 'unauthenticated' && <SignInPrompt />}

      {status === 'authenticated' && session && <ProfileDashboard userId={session.user.id} />}
    </div>
  );
}
