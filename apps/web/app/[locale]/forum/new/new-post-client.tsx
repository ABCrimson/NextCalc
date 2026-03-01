'use client';

/**
 * New Forum Post — Client Component
 *
 * Requires authentication. Displays the post creation form
 * with the standard forum background.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, PenLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ForumBackground } from '@/components/forum/forum-background';
import { PostForm } from '@/components/forum/post-form';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/lib/auth/hooks';

export function NewPostClient() {
  const t = useTranslations('forum');
  const tAuth = useTranslations('auth');
  const prefersReduced = useReducedMotion();
  const router = useRouter();
  const user = useRequireAuth('/forum/new');

  // useRequireAuth returns null while loading/redirecting
  if (!user) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background">
        <ForumBackground />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="h-8 w-8 mx-auto border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">{tAuth('checkingAuth')}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <ForumBackground />

      <div className="relative z-10 py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          {/* Back button */}
          <motion.div
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
          </motion.div>

          {/* Header */}
          <motion.div
            className="mb-6"
            {...(prefersReduced
              ? {}
              : {
                  initial: { opacity: 0, y: -10 },
                  animate: { opacity: 1, y: 0 },
                  transition: { delay: 0.1, duration: 0.4 },
                })}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 backdrop-blur-sm">
                <PenLine className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{t('newDiscussion')}</h1>
                <p className="text-sm text-muted-foreground">{t('newDiscussionSubtitle')}</p>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <PostForm />
        </div>
      </div>
    </main>
  );
}
