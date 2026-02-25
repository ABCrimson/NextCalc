import type { Metadata } from 'next';
import { NewPostClient } from './new-post-client';

export const metadata: Metadata = {
  title: 'New Post',
  description: 'Create a new forum post',
};

export default function NewPostPage() {
  return <NewPostClient />;
}
