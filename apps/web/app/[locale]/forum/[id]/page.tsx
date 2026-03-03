import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PostDetailClient } from './post-detail-client';

/**
 * Generate dynamic metadata for forum post pages.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('forum');

  return {
    title: `${t('postTitle', { id })} | NextCalc Pro`,
    description: t('postDescription'),
  };
}

/**
 * Forum Post Detail Page
 *
 * Server component that awaits params and passes the resolved id
 * to the client component.
 */
export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostDetailClient id={id} />;
}
