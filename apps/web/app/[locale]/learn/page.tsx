import { getAllTopics, getDefinitionCountByTopic } from '@nextcalc/math-engine/knowledge';
import type { Metadata } from 'next';
import { LearnContent } from './learn-content';

/**
 * Metadata for the Learning Hub page.
 * Exported from the server component so Next.js can statically generate it.
 */
export const metadata: Metadata = {
  title: 'Learning Hub | NextCalc Pro',
  description: 'Explore mathematical concepts, definitions, and theorems across all topics.',
  keywords: ['math learning', 'definitions', 'theorems', 'mathematics education'],
};

/**
 * Cached data loader for the learning hub.
 *
 * The topic list and definition counts come from the static knowledge base
 * in math-engine and never change at runtime. Wrapping them in `'use cache'`
 * lets Next.js memoize the result across requests and incremental builds
 * without requiring a full static page (the page itself may still have
 * dynamic siblings in the layout).
 */
async function getLearnPageData() {
  'use cache';

  const topicsReadonly = await getAllTopics();
  const definitionCountsMap = await getDefinitionCountByTopic();

  // Spread readonly array into a mutable string[] to satisfy LearnContentProps
  const topics: string[] = [...topicsReadonly];

  // Serialize Map → plain object to cross the server/client boundary
  const definitionCounts: Record<string, number> = {};
  for (const [k, v] of definitionCountsMap) {
    definitionCounts[k] = v;
  }

  return { topics, definitionCounts };
}

/**
 * LearnPage — thin server component.
 *
 * Delegates data fetching to a cached helper, then passes the serialized
 * data to the client component.
 */
export default async function LearnPage() {
  const { topics, definitionCounts } = await getLearnPageData();
  return <LearnContent topics={topics} definitionCounts={definitionCounts} />;
}
