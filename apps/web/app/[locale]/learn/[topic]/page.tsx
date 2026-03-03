import { getDefinitionsByTopic, MathTopic } from '@nextcalc/math-engine/knowledge';
import { getProblemsByTopic } from '@nextcalc/math-engine/problems';
import { ArrowLeft, BookOpen, Code, Puzzle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/prisma';
import { BookmarkExplorerClient } from './bookmark-explorer-client';

/**
 * Topic slug to MathTopic mapping
 */
const TOPIC_SLUG_MAP: Record<string, MathTopic> = {
  calculus: MathTopic.Calculus,
  algebra: MathTopic.Algebra,
  'linear-algebra': MathTopic.LinearAlgebra,
  'number-theory': MathTopic.NumberTheory,
  topology: MathTopic.Topology,
  analysis: MathTopic.Analysis,
  geometry: MathTopic.Geometry,
  'differential-equations': MathTopic.DifferentialEquations,
  'abstract-algebra': MathTopic.AbstractAlgebra,
  probability: MathTopic.Probability,
  statistics: MathTopic.Statistics,
};

/**
 * Generate metadata for topic page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic: topicSlug } = await params;
  const topic = TOPIC_SLUG_MAP[topicSlug];

  if (!topic) {
    return {
      title: 'Topic Not Found | NextCalc Pro',
    };
  }

  return {
    title: `${topic} | Learning Hub | NextCalc Pro`,
    description: `Learn ${topic} through comprehensive definitions, theorems, and practice problems.`,
    keywords: [topic, 'mathematics', 'learning', 'definitions'],
  };
}

/**
 * Topic-Specific Learning Page
 *
 * Server component that displays definitions and resources for a specific topic.
 */
export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const t = await getTranslations('learn');
  const { topic: topicSlug } = await params;
  const topic = TOPIC_SLUG_MAP[topicSlug];

  if (!topic) {
    notFound();
  }

  const [definitions, problems] = await Promise.all([
    getDefinitionsByTopic(topic),
    getProblemsByTopic(topic),
  ]);

  // Fetch user's bookmarked definition IDs
  let bookmarkedIds: string[] = [];
  const session = await auth();
  if (session?.user?.id) {
    const userProgress = await prisma.userProgress.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (userProgress) {
      const bookmarks = await prisma.favorite.findMany({
        where: {
          userProgressId: userProgress.id,
          resourceType: 'DEFINITION',
          definitionId: { not: null },
        },
        select: { definitionId: true },
      });
      bookmarkedIds = bookmarks
        .map((b) => b.definitionId)
        .filter((id): id is string => id !== null);
    }
  }

  // Calculate difficulty distribution
  const difficultyDistribution = definitions.reduce(
    (acc, def) => {
      acc[def.difficulty] = (acc[def.difficulty] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Back button */}
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/learn">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToLearningHub')}
          </Link>
        </Button>
      </div>

      {/* Topic Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {topic}
          </span>
        </h1>
        <p className="text-lg text-muted-foreground">{t('knowledgeBase', { topic })}</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              {t('definitions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{definitions.length}</div>
            <div className="mt-2 space-y-1">
              {Object.entries(difficultyDistribution).map(([level, count]) => (
                <div key={level} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {
                      ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Research'][
                        Number(level) - 1
                      ]
                    }
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-purple-500" />
              {t('practiceProblems')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{problems.length}</div>
            <p className="text-sm text-muted-foreground mt-2">{t('readyToSolve')}</p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href={`/problems?topic=${encodeURIComponent(topic)}`}>
                {t('browseProblems')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="h-5 w-5 text-green-500" />
              {t('algorithms')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {topic === MathTopic.Calculus ? '8' : topic === MathTopic.LinearAlgebra ? '12' : '6'}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{t('withVisualizations')}</p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href={`/algorithms?topic=${encodeURIComponent(topic)}`}>
                {t('exploreAlgorithms')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Explorer */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('definitionsAndConcepts')}</CardTitle>
          <CardDescription>{t('definitionsAndConceptsHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <BookmarkExplorerClient definitions={definitions} bookmarkedIds={bookmarkedIds} />
        </CardContent>
      </Card>

      {/* Learning Resources */}
      <Card>
        <CardHeader>
          <CardTitle>{t('learningResources')}</CardTitle>
          <CardDescription>{t('learningResourcesHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/problems?topic=${encodeURIComponent(topic)}&difficulty=1`}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold mb-2">{t('beginnerProblems')}</h3>
              <p className="text-sm text-muted-foreground">{t('beginnerProblemsHint')}</p>
            </Link>

            <Link
              href={`/practice?topic=${encodeURIComponent(topic)}`}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold mb-2">{t('practiceMode')}</h3>
              <p className="text-sm text-muted-foreground">{t('practiceModeHint')}</p>
            </Link>

            <Link
              href={`/algorithms?topic=${encodeURIComponent(topic)}`}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold mb-2">{t('algorithmVisualizations')}</h3>
              <p className="text-sm text-muted-foreground">{t('algorithmVisualizationsHint')}</p>
            </Link>

            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">{t('videoLectures')}</h3>
              <p className="text-sm text-muted-foreground">{t('videoLecturesHint')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
