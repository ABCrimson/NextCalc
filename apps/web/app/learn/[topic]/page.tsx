import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { BookmarkExplorerClient } from './bookmark-explorer-client';
import { getDefinitionsByTopic, MathTopic } from '@nextcalc/math-engine/knowledge';
import { getProblemsByTopic } from '@nextcalc/math-engine/problems';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen, Code, Puzzle } from 'lucide-react';

/**
 * Topic slug to MathTopic mapping
 */
const TOPIC_SLUG_MAP: Record<string, MathTopic> = {
  'calculus': MathTopic.Calculus,
  'algebra': MathTopic.Algebra,
  'linear-algebra': MathTopic.LinearAlgebra,
  'number-theory': MathTopic.NumberTheory,
  'topology': MathTopic.Topology,
  'analysis': MathTopic.Analysis,
  'geometry': MathTopic.Geometry,
  'differential-equations': MathTopic.DifferentialEquations,
  'abstract-algebra': MathTopic.AbstractAlgebra,
  'probability': MathTopic.Probability,
  'statistics': MathTopic.Statistics,
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
export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic: topicSlug } = await params;
  const topic = TOPIC_SLUG_MAP[topicSlug];

  if (!topic) {
    notFound();
  }

  const definitions = await getDefinitionsByTopic(topic);
  const problems = await getProblemsByTopic(topic);

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
      bookmarkedIds = bookmarks.map((b) => b.definitionId).filter((id): id is string => id !== null);
    }
  }

  // Calculate difficulty distribution
  const difficultyDistribution = definitions.reduce(
    (acc, def) => {
      acc[def.difficulty] = (acc[def.difficulty] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Back button */}
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/learn">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Learning Hub
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
        <p className="text-lg text-muted-foreground">
          Comprehensive knowledge base for {topic}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Definitions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{definitions.length}</div>
            <div className="mt-2 space-y-1">
              {Object.entries(difficultyDistribution).map(([level, count]) => (
                <div key={level} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Research'][Number(level) - 1]}
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
              Practice Problems
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{problems.length}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Ready to solve
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href={`/problems?topic=${encodeURIComponent(topic)}`}>
                Browse Problems
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code className="h-5 w-5 text-green-500" />
              Algorithms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {topic === MathTopic.Calculus ? '8' : topic === MathTopic.LinearAlgebra ? '12' : '6'}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              With visualizations
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href={`/algorithms?topic=${encodeURIComponent(topic)}`}>
                Explore Algorithms
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Explorer */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Definitions & Concepts</CardTitle>
          <CardDescription>
            Explore fundamental definitions and build your understanding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BookmarkExplorerClient
            definitions={definitions}
            bookmarkedIds={bookmarkedIds}
          />
        </CardContent>
      </Card>

      {/* Learning Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Learning Resources</CardTitle>
          <CardDescription>
            Additional materials to enhance your understanding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/problems?topic=${encodeURIComponent(topic)}&difficulty=1`}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold mb-2">Beginner Problems</h3>
              <p className="text-sm text-muted-foreground">
                Start with foundational problems to build your skills
              </p>
            </Link>

            <Link
              href={`/practice?topic=${encodeURIComponent(topic)}`}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold mb-2">Practice Mode</h3>
              <p className="text-sm text-muted-foreground">
                Timed practice sessions to test your knowledge
              </p>
            </Link>

            <Link
              href={`/algorithms?topic=${encodeURIComponent(topic)}`}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold mb-2">Algorithm Visualizations</h3>
              <p className="text-sm text-muted-foreground">
                Interactive visualizations of key algorithms
              </p>
            </Link>

            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">Coming Soon: Video Lectures</h3>
              <p className="text-sm text-muted-foreground">
                Step-by-step video explanations of core concepts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
