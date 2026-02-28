/**
 * Shared Calculation Page
 *
 * Displays a shared calculation loaded by its short code.
 * Server component for OG meta tag generation.
 * Route: /[locale]/share/[code]
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { query } from '@/lib/graphql/rsc-client';
import { SHARED_CALCULATION_QUERY } from '@/lib/graphql/operations';
import { SharedCalculationView } from './shared-calculation-view';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SharedCalculationData {
  id: string;
  shortCode: string;
  latex: string;
  expression: string;
  title: string | null;
  description: string | null;
  result: string | null;
  createdAt: string;
  expiresAt: string | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface PageProps {
  params: Promise<{ code: string; locale: string }>;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getSharedCalculation(
  shortCode: string,
): Promise<SharedCalculationData | null> {
  try {
    const { data } = await query({
      query: SHARED_CALCULATION_QUERY,
      variables: { shortCode },
    });

    const result = data as { sharedCalculation: SharedCalculationData | null } | undefined;
    return result?.sharedCalculation ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Metadata (OG tags for social preview)
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  const shared = await getSharedCalculation(code);

  if (!shared) {
    return {
      title: 'Shared Calculation Not Found | NextCalc Pro',
      description: 'This shared calculation could not be found or has expired.',
    };
  }

  const title = shared.title || `${shared.expression}${shared.result ? ` = ${shared.result}` : ''}`;
  const description =
    shared.description ||
    `View this calculation on NextCalc Pro: ${shared.expression}${shared.result ? ` = ${shared.result}` : ''}`;

  return {
    title: `${title} | NextCalc Pro`,
    description,
    openGraph: {
      title: `${title} | NextCalc Pro`,
      description,
      type: 'article',
      siteName: 'NextCalc Pro',
    },
    twitter: {
      card: 'summary',
      title: `${title} | NextCalc Pro`,
      description,
    },
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function SharedCalculationPage({ params }: PageProps) {
  const { code } = await params;
  const shared = await getSharedCalculation(code);

  if (!shared) {
    notFound();
  }

  return <SharedCalculationView shared={shared} />;
}
