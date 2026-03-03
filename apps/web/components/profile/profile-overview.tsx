'use client';

import { useMutation } from '@apollo/client/react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UPDATE_PROFILE_MUTATION } from '@/lib/graphql/operations';
import { ActivityCalendar } from './activity-calendar';
import { LevelIcon } from './level-icon';
import { formatXp, getLevelTier, levelProgress, xpForLevelCached } from './level-utils';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

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

export interface RecentCalculation {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
}

export interface RecentWorksheet {
  id: string;
  title: string;
  description: string | null;
  visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
  updatedAt: string;
  createdAt: string;
}

export interface ProfileOverviewProps {
  user: UserData;
  progress: ProgressData | null;
  worksheetCount: number;
  forumPostCount: number;
  calculationCount: number;
  recentAchievements: RecentAchievement[];
  activityData: Array<{ date: string; count: number }>;
  recentCalculations?: RecentCalculation[];
  recentWorksheets?: RecentWorksheet[];
  onProfileUpdated?: (updated: { name: string | null; bio: string | null }) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// xpForLevel now imported from level-utils.ts (RS3-style exponential curve)

// ---------------------------------------------------------------------------
// Framer Motion variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
} as const;

const statsContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.2 },
  },
} as const;

const statsItemVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
} as const;

const feedItemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.28,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
} as const;

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  accent?: boolean;
  description?: string;
}

function StatCard({ label, value, icon, accent = false, description }: StatCardProps) {
  return (
    <Card
      className={[
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        accent ? 'border-primary/30 bg-primary/5 hover:shadow-primary/10' : 'hover:shadow-border',
      ].join(' ')}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={[
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-lg',
            accent ? 'bg-primary/15' : 'bg-muted',
          ].join(' ')}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={[
              'truncate text-xl font-bold tabular-nums leading-tight',
              accent ? 'text-primary' : 'text-foreground',
            ].join(' ')}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// QuickActions
// ---------------------------------------------------------------------------

interface QuickAction {
  label: string;
  href: string;
  icon: string;
  description: string;
  gradient: string;
}

function QuickActions({ locale }: { locale?: string }) {
  const t = useTranslations('profile');
  const base = locale ? `/${locale}` : '';

  const actions: QuickAction[] = [
    {
      label: t('quickAction.newWorksheet'),
      href: `${base}/worksheet`,
      icon: '📄',
      description: 'Create a new math worksheet',
      gradient: 'from-blue-500/10 to-violet-500/10 hover:from-blue-500/20 hover:to-violet-500/20',
    },
    {
      label: t('quickAction.newCalculation'),
      href: `${base}/`,
      icon: '🔢',
      description: 'Open the calculator',
      gradient: 'from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20',
    },
    {
      label: t('quickAction.viewForums'),
      href: `${base}/forum`,
      icon: '💬',
      description: 'Browse community forums',
      gradient: 'from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="list" aria-label="Quick actions">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          role="listitem"
          className={[
            'flex items-center gap-3 rounded-xl border border-border bg-gradient-to-br p-4',
            'transition-all duration-200 hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            action.gradient,
          ].join(' ')}
          aria-label={action.label}
        >
          <span
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-background/70 text-xl shadow-sm"
            aria-hidden="true"
          >
            {action.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{action.label}</p>
            <p className="text-xs text-muted-foreground">{action.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecentActivityFeed
// ---------------------------------------------------------------------------

type ActivityEntry =
  | { kind: 'calculation'; id: string; label: string; sub: string; time: string }
  | {
      kind: 'worksheet';
      id: string;
      label: string;
      sub: string;
      time: string;
      visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
    };

function visibilityBadge(v: 'PRIVATE' | 'UNLISTED' | 'PUBLIC'): string {
  if (v === 'PUBLIC') return 'Public';
  if (v === 'UNLISTED') return 'Unlisted';
  return 'Private';
}

interface RecentActivityFeedProps {
  calculations: RecentCalculation[];
  worksheets: RecentWorksheet[];
  locale?: string;
}

function RecentActivityFeed({ calculations, worksheets, locale }: RecentActivityFeedProps) {
  const t = useTranslations('profile');
  const base = locale ? `/${locale}` : '';

  const entries: ActivityEntry[] = [
    ...calculations.map(
      (c): ActivityEntry => ({
        kind: 'calculation',
        id: `calc-${c.id}`,
        label: c.expression.length > 60 ? `${c.expression.slice(0, 60)}…` : c.expression,
        sub: `= ${c.result}`,
        time: c.timestamp,
      }),
    ),
    ...worksheets.map(
      (w): ActivityEntry => ({
        kind: 'worksheet',
        id: `ws-${w.id}`,
        label: w.title,
        sub: w.description
          ? w.description.length > 60
            ? `${w.description.slice(0, 60)}…`
            : w.description
          : '',
        time: w.updatedAt,
        visibility: w.visibility,
      }),
    ),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 10);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="mb-3 text-4xl" aria-hidden="true">
          📭
        </span>
        <p className="text-sm font-medium text-foreground">{t('recentActivityEmpty')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('recentActivityEmptyHint')}</p>
      </div>
    );
  }

  return (
    <motion.ul
      className="divide-y divide-border/50"
      aria-label="Recent activity feed"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {entries.map((entry) => (
        <motion.li
          key={entry.id}
          variants={feedItemVariants}
          className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
        >
          {/* Icon */}
          <div
            className={[
              'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-base',
              entry.kind === 'calculation'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
            ].join(' ')}
            aria-hidden="true"
          >
            {entry.kind === 'calculation' ? '∫' : '📄'}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-x-2 gap-y-0.5">
              {entry.kind === 'worksheet' ? (
                <Link
                  href={`${base}/worksheet?id=${entry.id.replace('ws-', '')}`}
                  className="truncate text-sm font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  {entry.label}
                </Link>
              ) : (
                <span className="truncate font-mono text-sm font-medium text-foreground">
                  {entry.label}
                </span>
              )}
              <Badge variant="outline" className="flex-shrink-0 text-xs">
                {entry.kind === 'calculation'
                  ? t('recentActivityCalculation')
                  : t('recentActivityWorksheet')}
              </Badge>
              {entry.kind === 'worksheet' && (
                <Badge
                  variant="secondary"
                  className={[
                    'flex-shrink-0 text-xs capitalize',
                    entry.visibility === 'PUBLIC' ? 'text-emerald-600 dark:text-emerald-400' : '',
                  ].join(' ')}
                >
                  {visibilityBadge(entry.visibility)}
                </Badge>
              )}
            </div>
            {entry.sub && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.sub}</p>
            )}
          </div>

          {/* Timestamp */}
          <time
            dateTime={entry.time}
            className="flex-shrink-0 text-xs text-muted-foreground"
            title={new Date(entry.time).toLocaleString()}
          >
            {formatRelativeTime(entry.time)}
          </time>
        </motion.li>
      ))}
    </motion.ul>
  );
}

// ---------------------------------------------------------------------------
// EditProfileDialog
// ---------------------------------------------------------------------------

interface UpdateProfileMutationData {
  updateProfile: {
    id: string;
    name: string | null;
    bio: string | null;
    image: string | null;
    updatedAt: string;
  };
}

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string | null;
  initialBio: string | null;
  onSuccess: (updated: { name: string | null; bio: string | null }) => void;
}

function EditProfileDialog({
  open,
  onOpenChange,
  initialName,
  initialBio,
  onSuccess,
}: EditProfileDialogProps) {
  const t = useTranslations('profile');
  const [name, setName] = useState(initialName ?? '');
  const [bio, setBio] = useState(initialBio ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [updateProfile, { loading }] =
    useMutation<UpdateProfileMutationData>(UPDATE_PROFILE_MUTATION);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaveError(null);
      setSaveSuccess(false);

      try {
        const result = await updateProfile({
          variables: {
            input: {
              ...(name.trim() ? { name: name.trim() } : {}),
              ...(bio.trim() !== (initialBio ?? '') ? { bio: bio.trim() || undefined } : {}),
            },
          },
        });
        if (result.data) {
          setSaveSuccess(true);
          onSuccess({
            name: result.data.updateProfile.name,
            bio: result.data.updateProfile.bio,
          });
          // Close after short delay so success state is visible
          setTimeout(() => {
            onOpenChange(false);
            setSaveSuccess(false);
          }, 800);
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : t('editError'));
      }
    },
    [updateProfile, name, bio, initialBio, onSuccess, onOpenChange, t],
  );

  const handleOpenChange = (next: boolean) => {
    if (!loading) {
      if (!next) {
        // Reset to current saved values on close
        setName(initialName ?? '');
        setBio(initialBio ?? '');
        setSaveError(null);
        setSaveSuccess(false);
      }
      onOpenChange(next);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
          <DialogDescription>{t('editDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name field */}
          <div className="space-y-1.5">
            <label htmlFor="edit-profile-name" className="text-sm font-medium text-foreground">
              {t('editName')}
            </label>
            <Input
              id="edit-profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('editNamePlaceholder')}
              maxLength={100}
              autoComplete="name"
              disabled={loading}
            />
          </div>

          {/* Bio field */}
          <div className="space-y-1.5">
            <label htmlFor="edit-profile-bio" className="text-sm font-medium text-foreground">
              {t('editBio')}
            </label>
            <textarea
              id="edit-profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('editBioPlaceholder')}
              maxLength={500}
              rows={3}
              disabled={loading}
              className="flex min-h-[80px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-right text-xs text-muted-foreground" aria-live="polite">
              {bio.length}/500
            </p>
          </div>

          {/* Error / success feedback */}
          <AnimatePresence>
            {saveError && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                role="alert"
                className="text-sm text-destructive"
              >
                {saveError}
              </motion.p>
            )}
            {saveSuccess && (
              <motion.p
                key="success"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                role="status"
                className="text-sm text-emerald-600 dark:text-emerald-400"
              >
                {t('editSuccess')}
              </motion.p>
            )}
          </AnimatePresence>

          <DialogFooter className="gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t('editCancel')}
            </button>
            <button
              type="submit"
              disabled={loading || saveSuccess}
              className="inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{
                background:
                  loading || saveSuccess
                    ? 'oklch(0.55 0.10 264)'
                    : 'linear-gradient(135deg, oklch(0.55 0.27 264), oklch(0.60 0.25 300))',
              }}
            >
              {loading ? t('editSaving') : t('editSave')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// HeroAvatar — image with onError fallback to initials
// ---------------------------------------------------------------------------

function HeroAvatar({ name, image, level }: { name: string | null; image: string | null; level: number }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative flex-shrink-0" aria-hidden="true">
      {image && !imgError ? (
        /* biome-ignore lint/performance/noImgElement: external OAuth avatar URL */
        <img
          src={image}
          alt={name ?? 'User avatar'}
          className="h-24 w-24 rounded-full border-2 border-border object-cover sm:h-28 sm:w-28"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border overflow-hidden sm:h-28 sm:w-28"
          role="img"
          aria-label={`Avatar for ${name ?? 'user'}`}
        >
          <LevelIcon level={level} size={112} />
        </div>
      )}
      {/* Level badge */}
      <div
        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground"
        aria-label={`Level ${level}`}
      >
        {level}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeroCard — avatar, identity, XP bar, edit button
// ---------------------------------------------------------------------------

interface HeroCardProps {
  user: UserData;
  progress: ProgressData | null;
  onEditClick: () => void;
}

function HeroCard({ user, progress, onEditClick }: HeroCardProps) {
  const t = useTranslations('profile');
  const currentXp = progress?.experience ?? 0;
  const currentLevel = progress?.level ?? 1;
  const tier = getLevelTier(currentLevel);
  const xpNeeded = xpForLevelCached(currentLevel + 1);
  const xpProgress = levelProgress(currentXp) * 100;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar */}
          <HeroAvatar name={user.name} image={user.image} level={currentLevel} />

          {/* Identity block */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-start justify-center gap-2 sm:justify-start">
              <h2 className="text-2xl font-bold text-foreground">
                {user.name ?? 'Anonymous User'}
              </h2>
              <button
                type="button"
                onClick={onEditClick}
                aria-label={t('edit')}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('edit')}
              </button>
            </div>

            {user.bio ? (
              <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{user.bio}</p>
            ) : (
              <p className="mt-1.5 text-sm italic text-muted-foreground/60">{t('noBio')}</p>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              {t('joined', { date: formatJoinedDate(user.createdAt) })}
            </p>

            {/* XP Progress bar */}
            <div className="mt-3 max-w-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t('level')} {currentLevel} — <span className={tier.textClass}>{tier.name}</span>
                </span>
                <span>
                  {formatXp(currentXp)} / {formatXp(xpNeeded)} XP
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={Math.round(xpProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('levelProgress', { percent: Math.round(xpProgress) })}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${xpProgress}%`,
                    background:
                      'linear-gradient(to right, oklch(0.55 0.22 264), oklch(0.65 0.28 300))',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main ProfileOverview component
// ---------------------------------------------------------------------------

export function ProfileOverview({
  user,
  progress,
  worksheetCount,
  forumPostCount,
  calculationCount,
  recentAchievements,
  activityData,
  recentCalculations = [],
  recentWorksheets = [],
  onProfileUpdated,
}: ProfileOverviewProps) {
  const t = useTranslations('profile');
  const [editOpen, setEditOpen] = useState(false);
  const [localUser, setLocalUser] = useState(user);

  const handleProfileUpdated = useCallback(
    (updated: { name: string | null; bio: string | null }) => {
      setLocalUser((prev) => ({ ...prev, ...updated }));
      onProfileUpdated?.(updated);
    },
    [onProfileUpdated],
  );

  const stats: StatCardProps[] = [
    {
      label: t('stats.calculations'),
      value: calculationCount,
      icon: '🔢',
      description: 'total saved',
    },
    {
      label: t('stats.streak'),
      value: `${progress?.streak ?? 0}d`,
      icon: '🔥',
      accent: (progress?.streak ?? 0) >= 3,
      description: `best: ${progress?.longestStreak ?? 0}d`,
    },
    {
      label: t('stats.worksheets'),
      value: worksheetCount,
      icon: '📄',
      description: 'created',
    },
    {
      label: t('stats.forumPosts'),
      value: forumPostCount,
      icon: '💬',
      description: 'contributed',
    },
    { label: t('level'), value: progress?.level ?? 1, icon: '⭐', accent: true },
    {
      label: t('experience'),
      value: `${(progress?.experience ?? 0).toLocaleString()} XP`,
      icon: '✨',
    },
    { label: t('problemsSolved'), value: progress?.problemsSolved ?? 0, icon: '🧩' },
    { label: t('totalPoints'), value: progress?.totalPoints ?? 0, icon: '💎' },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Hero card — avatar, name, bio, edit */}
      <motion.div variants={itemVariants}>
        <HeroCard user={localUser} progress={progress} onEditClick={() => setEditOpen(true)} />
      </motion.div>

      {/* Stats grid — 4 primary KPIs at top, rest below */}
      <motion.div variants={itemVariants}>
        <motion.div
          variants={statsContainerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {stats.slice(0, 4).map((stat) => (
            <motion.div key={stat.label} variants={statsItemVariants}>
              <StatCard {...stat} />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Secondary stats */}
      <motion.div variants={itemVariants}>
        <motion.div
          variants={statsContainerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {stats.slice(4).map((stat) => (
            <motion.div key={stat.label} variants={statsItemVariants}>
              <StatCard {...stat} />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('quickActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickActions />
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Activity Feed + Activity Calendar — side by side on large screens */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t('recentActivity')}</CardTitle>
              {recentWorksheets.length > 0 && (
                <Link
                  href="/worksheet"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t('recentActivityViewAll')}
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <RecentActivityFeed calculations={recentCalculations} worksheets={recentWorksheets} />
          </CardContent>
        </Card>

        {/* Activity Calendar */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('activity')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <ActivityCalendar data={activityData} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Achievements */}
      {recentAchievements.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t('recentAchievements')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" aria-label="Recent achievements">
                {recentAchievements.slice(0, 5).map((achievement) => (
                  <li
                    key={achievement.id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="text-xl" aria-hidden="true">
                      {achievement.icon}
                    </span>
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

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialName={localUser.name}
        initialBio={localUser.bio}
        onSuccess={handleProfileUpdated}
      />
    </motion.div>
  );
}
