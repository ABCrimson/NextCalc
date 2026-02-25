'use client';

import { useQuery } from '@apollo/client/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProfileOverview } from '@/components/profile/profile-overview';
import { AchievementGrid } from '@/components/profile/achievement-grid';
import { AnalyticsCharts } from '@/components/profile/analytics-charts';
import { PracticeHistoryTable } from '@/components/profile/practice-history-table';
import {
  USER_PROFILE_QUERY,
  USER_ACTIVITY_QUERY,
  USER_ANALYTICS_QUERY,
} from '@/lib/graphql/operations';
import { useSession, signIn } from '@/lib/auth/hooks';

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          </div>
        ))}
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
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <span className="mb-3 text-4xl" aria-hidden="true">⚠️</span>
      <p className="text-base font-semibold text-foreground">Failed to load profile</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign-in prompt (for unauthenticated visitors)
// ---------------------------------------------------------------------------

function SignInPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <motion.div
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

        <h2 className="text-2xl font-bold text-foreground">Sign in to view your profile</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Track your progress, achievements, and analytics by signing in to your account.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => signIn('/profile')}
            className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{
              background:
                'linear-gradient(135deg, oklch(0.55 0.27 264), oklch(0.60 0.25 300))',
            }}
          >
            Sign in
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Go home
          </Link>
        </div>
      </motion.div>
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
  label: string;
  ariaLabel: string;
}

const TABS: readonly TabDef[] = [
  { id: 'overview', label: 'Overview', ariaLabel: 'Overview tab' },
  { id: 'achievements', label: 'Achievements', ariaLabel: 'Achievements tab' },
  { id: 'analytics', label: 'Analytics', ariaLabel: 'Analytics tab' },
  { id: 'history', label: 'Practice History', ariaLabel: 'Practice history tab' },
] as const;

// ---------------------------------------------------------------------------
// ProfileDashboard — rendered once we have a valid user ID
// ---------------------------------------------------------------------------

interface ProfileDashboardProps {
  userId: string;
}

function ProfileDashboard({ userId }: ProfileDashboardProps) {
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

  const isLoading = profileLoading || activityLoading || analyticsLoading;

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
        message="Profile data could not be loaded. Please try again."
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

  return (
    <motion.div
      variants={fadeInVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Activity or analytics error banner */}
      {(activityError ?? analyticsError) && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400"
        >
          Some analytics data could not be loaded. Partial data is shown.
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto" aria-label="Profile sections">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              aria-label={tab.ariaLabel}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-6">
          <ProfileOverview
            user={profile.user}
            progress={profile.progress}
            worksheetCount={profile.worksheetCount}
            forumPostCount={profile.forumPostCount}
            calculationCount={profile.calculationCount}
            recentAchievements={profile.recentAchievements}
            activityData={activityList}
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
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ProfileClient — top-level exported component
// ---------------------------------------------------------------------------

export function ProfileClient() {
  const { session, status } = useSession();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      {/* Page header */}
      <motion.header
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1
          className="text-3xl font-bold sm:text-4xl"
          style={{
            background:
              'linear-gradient(135deg, oklch(0.75 0.18 264), oklch(0.72 0.20 300))',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          My Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your stats, achievements, and learning analytics
        </p>
      </motion.header>

      {/* Main content area */}
      {status === 'loading' && (
        <ProfileSkeleton />
      )}

      {status === 'unauthenticated' && (
        <SignInPrompt />
      )}

      {status === 'authenticated' && session && (
        <ProfileDashboard userId={session.user.id} />
      )}
    </div>
  );
}
