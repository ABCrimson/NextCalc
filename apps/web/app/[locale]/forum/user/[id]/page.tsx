import type { Metadata } from 'next';
import { UserProfileClient } from './user-profile-client';

export const metadata: Metadata = {
  title: 'User Profile',
  description: 'View community member profile and contributions',
};

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return <UserProfileClient params={params} />;
}
