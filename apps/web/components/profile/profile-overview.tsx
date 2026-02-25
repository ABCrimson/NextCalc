'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActivityCalendar } from './activity-calendar';

interface UserData {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  createdAt: string;
}

interface ProgressData {
  problemsSolved: number;
  totalPoints: number;
  streak: number;
  longestStreak: number;
  level: number;
  experience: number;
}

interface RecentAchievement {
  id: string;
  name: string;
  icon: string;
  points: number;
  earnedAt: string;
}

interface ProfileOverviewProps {
  user: UserData;
  progress: ProgressData | null;
  worksheetCount: number;
  forumPostCount: number;
  calculationCount: number;
  recentAchievements: RecentAchievement[];
  activityData: Array<{ date: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatJoinedDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatEarnedDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// XP needed for a given level: simple quadratic formula
function xpForLevel(level: number): number {
  return level * level * 100;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  accent?: boolean;
}

function StatCard({ label, value, icon, accent = false }: StatCardProps) {
  return (
    <Card className={accent ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`truncate text-lg font-bold tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Framer Motion variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
};

const statsContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.2,
    },
  },
};

const statsItemVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProfileOverview({
  user,
  progress,
  worksheetCount,
  forumPostCount,
  calculationCount,
  recentAchievements,
  activityData,
}: ProfileOverviewProps) {
  const currentXp = progress?.experience ?? 0;
  const currentLevel = progress?.level ?? 1;
  const xpNeeded = xpForLevel(currentLevel + 1);
  const xpProgress = Math.min((currentXp / xpNeeded) * 100, 100);

  const stats: StatCardProps[] = [
    { label: 'Level', value: currentLevel, icon: '⭐', accent: true },
    { label: 'Experience', value: `${currentXp.toLocaleString()} XP`, icon: '✨' },
    { label: 'Problems Solved', value: progress?.problemsSolved ?? 0, icon: '🧩' },
    { label: 'Current Streak', value: `${progress?.streak ?? 0}d`, icon: '🔥' },
    { label: 'Longest Streak', value: `${progress?.longestStreak ?? 0}d`, icon: '🏆' },
    { label: 'Total Points', value: progress?.totalPoints ?? 0, icon: '💎' },
    { label: 'Worksheets', value: worksheetCount, icon: '📄' },
    { label: 'Forum Posts', value: forumPostCount, icon: '💬' },
    { label: 'Calculations', value: calculationCount, icon: '🔢' },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Hero: Avatar + Identity */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div
              className="relative flex-shrink-0"
              aria-hidden="true"
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name ?? 'User avatar'}
                  className="h-24 w-24 rounded-full border-2 border-border object-cover sm:h-28 sm:w-28"
                />
              ) : (
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border bg-gradient-to-br from-primary/30 to-primary/10 text-2xl font-bold text-primary sm:h-28 sm:w-28"
                  role="img"
                  aria-label={`Avatar for ${user.name ?? 'user'}`}
                >
                  {getInitials(user.name)}
                </div>
              )}
              {/* Level badge on avatar */}
              <div
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground"
                aria-label={`Level ${currentLevel}`}
              >
                {currentLevel}
              </div>
            </div>

            {/* Identity */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-foreground">
                {user.name ?? 'Anonymous User'}
              </h1>

              {user.bio && (
                <p className="mt-1.5 text-sm text-muted-foreground">{user.bio}</p>
              )}

              <p className="mt-2 text-xs text-muted-foreground">
                Joined {formatJoinedDate(user.createdAt)}
              </p>

              {/* XP Progress bar */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Level {currentLevel}</span>
                  <span>{currentXp.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(xpProgress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Level progress: ${Math.round(xpProgress)}%`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${xpProgress}%`,
                      background: 'linear-gradient(to right, oklch(0.55 0.22 264), oklch(0.65 0.28 300))',
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={itemVariants}>
        <motion.div
          variants={statsContainerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={statsItemVariants}>
              <StatCard {...stat} />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Activity Calendar */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityCalendar data={activityData} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent achievements */}
      {recentAchievements.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" aria-label="Recent achievements">
                {recentAchievements.slice(0, 5).map((achievement) => (
                  <li
                    key={achievement.id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
                  >
                    <span className="text-xl" aria-hidden="true">{achievement.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {achievement.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatEarnedDate(achievement.earnedAt)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0 tabular-nums">
                      +{achievement.points}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
