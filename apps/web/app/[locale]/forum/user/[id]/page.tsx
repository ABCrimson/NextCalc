import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { UserProfileClient } from './user-profile-client';

/**
 * Generate dynamic metadata for user profile pages.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('forum');

  return {
    title: `${t('userProfileTitle', { id })} | NextCalc Pro`,
    description: t('userProfileDescription'),
  };
}

/**
 * User Profile Page
 *
 * Server component that awaits params and passes the resolved id
 * to the client component.
 */
export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserProfileClient id={id} />;
}
