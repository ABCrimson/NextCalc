'use client';

/**
 * User Profile Card
 *
 * Large glass morphism card showing user profile header information.
 * Displays avatar, name, role badge, bio, join date, and stats.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Calendar, MessageSquare, FileText, Shield, Crown, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  type UserProfileData,
  formatDate,
  getInitials,
} from '@/components/forum/forum-shared';
import { cn } from '@/lib/utils';

interface UserProfileCardProps {
  user: UserProfileData;
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; className: string }> = {
  ADMIN: {
    label: 'Admin',
    icon: Crown,
    className: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  },
  MODERATOR: {
    label: 'Moderator',
    icon: Shield,
    className: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
  },
  USER: {
    label: 'Member',
    icon: User,
    className: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  },
};

export function UserProfileCard({ user }: UserProfileCardProps) {
  const prefersReduced = useReducedMotion();
  const roleConfig = ROLE_CONFIG[user.role] ?? ROLE_CONFIG['USER'] ?? { label: 'Member', icon: User, className: 'bg-blue-500/20 border-blue-500/40 text-blue-400' };
  const RoleIcon = roleConfig.icon;

  const totalUpvotes = user.forumPosts.reduce((sum, p) => sum + p.upvoteCount, 0);

  return (
    <motion.div
      {...(prefersReduced
        ? {}
        : {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.4 },
          })}
      className="rounded-2xl border border-border p-6 backdrop-blur-md bg-card/50"
    >
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        {/* Large avatar */}
        <div
          className={cn(
            'flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-xl font-bold',
            'bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30',
            'border-2 border-indigo-500/40',
            'shadow-[0_0_24px_oklch(0.55_0.27_264/0.2)]',
          )}
        >
          {user.image ? (
            <img
              src={user.image}
              alt={user.name ?? 'User'}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span className="text-indigo-300">{getInitials(user.name)}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2">
            <h2 className="text-2xl font-bold text-foreground">
              {user.name ?? 'Anonymous User'}
            </h2>
            <Badge
              variant="outline"
              className={cn('gap-1 text-xs', roleConfig.className)}
            >
              <RoleIcon className="h-3 w-3" />
              {roleConfig.label}
            </Badge>
          </div>

          {user.bio && (
            <p className="text-sm text-muted-foreground max-w-md">{user.bio}</p>
          )}

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Joined {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border/50">
        <div className="text-center">
          <div className="text-xl font-bold text-foreground">{user.forumPosts.length}</div>
          <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Posts
          </div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-foreground">{totalUpvotes}</div>
          <div className="text-[10px] text-muted-foreground">Reputation</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-foreground">{user.worksheetCount}</div>
          <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <FileText className="h-3 w-3" />
            Worksheets
          </div>
        </div>
      </div>
    </motion.div>
  );
}
