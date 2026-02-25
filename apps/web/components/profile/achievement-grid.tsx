'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Achievement {
  id: string;
  name: string;
  description: string;
  type: string;
  icon: string;
  points: number;
  badgeUrl: string | null;
  earnedAt: string;
}

interface AchievementGridProps {
  achievements: Achievement[];
}

function formatEarnedDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getTypeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' | 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'research' {
  const map: Record<string, 'default' | 'secondary' | 'outline' | 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'research'> = {
    beginner: 'beginner',
    intermediate: 'intermediate',
    advanced: 'advanced',
    expert: 'expert',
    research: 'research',
  };
  return map[type.toLowerCase()] ?? 'secondary';
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.88, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
};

export function AchievementGrid({ achievements }: AchievementGridProps) {
  if (achievements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="mb-3 text-5xl" aria-hidden="true">🏅</span>
        <p className="text-base font-medium text-foreground">No achievements yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Solve problems and complete challenges to earn badges.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      aria-label={`${achievements.length} achievement${achievements.length !== 1 ? 's' : ''} earned`}
    >
      {achievements.map((achievement) => (
        <motion.div key={achievement.id} variants={itemVariants}>
          <Card className="group relative flex h-full flex-col items-center overflow-hidden p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/10">
            {/* Badge image or icon fallback */}
            <div
              className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-muted text-3xl"
              aria-hidden="true"
            >
              {achievement.badgeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={achievement.badgeUrl}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <span>{achievement.icon}</span>
              )}
            </div>

            {/* Name */}
            <p className="mb-1 text-sm font-semibold leading-snug text-foreground">
              {achievement.name}
            </p>

            {/* Description */}
            <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
              {achievement.description}
            </p>

            {/* Type badge */}
            <Badge
              variant={getTypeBadgeVariant(achievement.type)}
              className="mb-2 capitalize"
            >
              {achievement.type}
            </Badge>

            {/* Points */}
            <p className="text-xs font-medium text-primary">
              +{achievement.points} pts
            </p>

            {/* Earned date */}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatEarnedDate(achievement.earnedAt)}
            </p>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
