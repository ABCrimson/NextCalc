import { getProblemById, getRelatedProblems } from '@nextcalc/math-engine/problems';
import { ArrowLeft, Share2 } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { ProblemSolverClient } from './problem-solver-client';

/**
 * Generate metadata for individual problem page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const problem = await getProblemById(id);

  if (!problem) {
    return {
      title: 'Problem Not Found | NextCalc Pro',
    };
  }

  return {
    title: `${problem.title} | NextCalc Pro`,
    description: problem.statement,
    keywords: [problem.topic, ...problem.tags],
  };
}

/**
 * Individual Problem Page
 *
 * Server component that displays a single problem with the interactive solver.
 */
export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations('problems');
  const { id } = await params;
  const problem = await getProblemById(id);

  if (!problem) {
    notFound();
  }

  const relatedProblems = await getRelatedProblems(problem.id);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Back button */}
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/problems">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToProblems')}
          </Link>
        </Button>
      </div>

      {/* Main content */}
      <ProblemSolverClient problem={problem} relatedProblemIds={relatedProblems.map((p) => p.id)} />

      {/* Related Problems Section */}
      {relatedProblems.length > 0 && (
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>{t('relatedProblems')}</CardTitle>
              <CardDescription>{t('relatedProblemsHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {relatedProblems.slice(0, 6).map((relatedProblem) => (
                  <Link
                    key={relatedProblem.id}
                    href={`/problems/${relatedProblem.id}`}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-semibold mb-2 line-clamp-2">{relatedProblem.title}</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {relatedProblem.topic}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {relatedProblem.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {relatedProblem.statement}
                    </p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Share Section */}
      <div className="mt-6 flex justify-center">
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          {t('shareProblem')}
        </Button>
      </div>
    </div>
  );
}
