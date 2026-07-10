import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { PostDetailClient } from './post-detail-client';

/**
 * Generate dynamic metadata for forum post pages.
 *
 * Reads the post directly via Prisma (not through the GraphQL forumPost
 * resolver) so metadata generation doesn't double-fire the resolver's
 * view-count increment on every page view. Falls back to the generic
 * translated title when the post is missing/deleted or the DB read fails —
 * metadata must degrade gracefully rather than 500 the page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('forum');

  const post = await prisma.forumPost
    .findUnique({
      where: { id },
      select: { title: true, content: true, deletedAt: true },
    })
    .catch(() => null);

  // Bare titles only — the root layout applies the `%s | NextCalc Pro`
  // title template (app/layout.tsx), so a manual suffix would double it.
  if (!post || post.deletedAt) {
    return {
      title: t('postTitle', { id }),
      description: t('postDescription'),
    };
  }

  const excerpt = post.content.replace(/\s+/g, ' ').trim().slice(0, 160);

  return {
    title: post.title,
    description: excerpt || t('postDescription'),
  };
}

/**
 * Forum Post Detail Page
 *
 * Server component that awaits params and passes the resolved id
 * to the client component.
 */
export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostDetailClient id={id} />;
}
