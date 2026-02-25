import type { Metadata } from 'next';
import { PostDetailClient } from './post-detail-client';

export const metadata: Metadata = {
  title: 'Forum Post',
  description: 'View and discuss this forum post',
};

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <PostDetailClient params={params} />;
}
