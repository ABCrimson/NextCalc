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
 * LearnPage — thin server component.
 *
 * Fetches topic data server-side and serializes the Map to a plain object
 * before passing it to the client component. Maps cannot cross the
 * server → client boundary in React Server Components.
 */
export default async function LearnPage() {
  const topicsReadonly = await getAllTopics();
  const definitionCountsMap = await getDefinitionCountByTopic();

  // Spread readonly array into a mutable string[] to satisfy LearnContentProps
  const topics: string[] = [...topicsReadonly];

  // Serialize Map → plain object to cross the server/client boundary
  const definitionCounts: Record<string, number> = {};
  for (const [k, v] of definitionCountsMap) {
    definitionCounts[k] = v;
  }

  return <LearnContent topics={topics} definitionCounts={definitionCounts} />;
}
