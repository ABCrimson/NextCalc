/**
 * Problems Browser Page — Server Component
 *
 * Fetches real problems from the database via ProblemManager.getProblems(),
 * maps the Prisma Problem shape to the UI Problem type, then delegates
 * all animated, interactive rendering to ProblemsPageClient.
 *
 * Per-user fields (status, isFavorite, successRate, averageTime) are OMITTED
 * because they require an authenticated session context not available here;
 * they remain optional on the Problem interface and are rendered as absent by
 * ProblemBrowser with appropriate fallbacks.
 */

import { unstable_cacheLife as cacheLife } from 'next/cache';
import type { DifficultyLevel } from '@/components/ui/difficulty-badge';
import type { MathTopic } from '@/components/ui/topic-tag';
import { getAllTopics } from '@/components/ui/topic-tag';
import { ProblemManager } from '@/lib/cms/problem-manager';
import type { Problem } from '@/types/problems';
import ProblemsPageClient from './problems-page-client';

// ---------------------------------------------------------------------------
// Cached data load
//
// The problems list is non-user-specific content, so it can be prerendered
// with cached data under Next.js `cacheComponents`. Wrapping the DB read in a
// `'use cache'` helper lets the page statically prerender (the per-user fields
// status/isFavorite/successRate/averageTime are intentionally omitted here).
// ---------------------------------------------------------------------------

async function getCachedProblems() {
  'use cache';
  cacheLife('hours');

  return ProblemManager.getProblems({});
}

// ---------------------------------------------------------------------------
// Difficulty enum mapping: Prisma SCREAMING_SNAKE_CASE → UI lowercase
// ---------------------------------------------------------------------------

const PRISMA_DIFFICULTY_TO_UI: Record<string, DifficultyLevel> = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  MASTER: 'master',
};

// ---------------------------------------------------------------------------
// Topic slug mapping: Prisma Category → MathTopic
//
// Strategy (slug-first):
//   1. If the topic's slug is itself a valid MathTopic key, use it directly.
//   2. Otherwise map the Prisma Category enum to the closest MathTopic.
//   3. If neither maps, the topic is omitted (honest omission).
// ---------------------------------------------------------------------------

const PRISMA_CATEGORY_TO_MATH_TOPIC: Record<string, MathTopic | undefined> = {
  CALCULUS: 'calculus',
  ALGEBRA: 'algebra',
  TOPOLOGY: 'topology',
  ANALYSIS: 'complex-analysis',
  GEOMETRY: 'geometry',
  NUMBER_THEORY: 'number-theory',
  PROBABILITY: 'probability',
  STATISTICS: 'statistics',
  // The following categories have no MathTopic counterpart and are omitted.
  // ALGORITHMS, GAME_THEORY, CHAOS_THEORY, CRYPTOGRAPHY, QUANTUM, OPTIMIZATION
};

function mapTopicsToMathTopics(
  rawTopics: ReadonlyArray<{
    topic: { id: string; name: string; slug: string; category: string };
  }>,
  validTopics: ReadonlySet<string>,
): MathTopic[] {
  const seen = new Set<string>();
  const result: MathTopic[] = [];

  for (const { topic } of rawTopics) {
    // Slug-first: database slugs like "calculus", "linear-algebra" match directly
    if (validTopics.has(topic.slug)) {
      if (!seen.has(topic.slug)) {
        seen.add(topic.slug);
        result.push(topic.slug as MathTopic);
      }
      continue;
    }

    // Category fallback
    const mapped = PRISMA_CATEGORY_TO_MATH_TOPIC[topic.category];
    if (mapped !== undefined && !seen.has(mapped)) {
      seen.add(mapped);
      result.push(mapped);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Error / empty state
// ---------------------------------------------------------------------------

function ProblemsError({ message }: { message: string }) {
  return (
    <div className="container mx-auto py-20 px-4 text-center">
      <h1 className="text-2xl font-semibold text-foreground mb-3">Unable to load problems</h1>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProblemsPage() {
  // Fetch real problems from the database (cached for prerendering)
  let result: Awaited<ReturnType<typeof getCachedProblems>>;

  try {
    result = await getCachedProblems();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred. Please try again later.';
    return <ProblemsError message={message} />;
  }

  const { problems: rawProblems, total } = result;

  // Pre-compute the valid MathTopic set once for O(1) slug lookups
  const validTopics: ReadonlySet<string> = new Set(getAllTopics());

  // Map Prisma problems → UI Problem type
  const problems: Problem[] = rawProblems.map((p) => {
    const difficulty: DifficultyLevel =
      PRISMA_DIFFICULTY_TO_UI[p.difficulty] ??
      // Belt-and-suspenders: if a new enum value appears, default to 'beginner'
      'beginner';

    const topics = mapTopicsToMathTopics(p.topics, validTopics);

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      difficulty,
      topics,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      // _count.attempts is the real attempt count from the DB.
      // We expose it as the aggregate count, not a per-user value.
      attempts: p._count.attempts,
      // status / isFavorite / successRate / averageTime are per-user fields.
      // They require an authenticated session and are intentionally omitted here.
      // ProblemBrowser renders them as absent (unattempted / not favorited).
    };
  });

  // Compute real stats from the fetched data
  const distinctTopics = new Set<string>();
  const distinctDifficulties = new Set<string>();

  for (const p of rawProblems) {
    distinctDifficulties.add(p.difficulty);
    for (const { topic } of p.topics) {
      // Count DB topic IDs, not UI MathTopic strings, for accuracy
      distinctTopics.add(topic.id);
    }
  }

  const stats = {
    problems: total,
    topics: distinctTopics.size,
    difficulties: distinctDifficulties.size,
  };

  return <ProblemsPageClient problems={problems} stats={stats} />;
}
