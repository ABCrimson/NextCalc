/**
 * GPU Lab — public gallery of worksheets containing simulation cells.
 *
 * Server component: fetches public worksheets (with content JSON) through the
 * in-process RSC Apollo client (SchemaLink — no HTTP self-fetch), filters for
 * worksheets that contain at least one simulation cell, and renders a card
 * grid with per-card simulation badges.
 *
 * Caching: no 'use cache' (cacheComponents intentionally not adopted); the
 * publicWorksheets resolver sets a 60s PUBLIC cache hint and the
 * setWorksheetVisibility action revalidates this path on publish/unpublish.
 *
 * Route: /[locale]/gpu-lab
 */

import { Eye, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { FragmentType } from '@/lib/graphql/generated';
import { useFragment } from '@/lib/graphql/generated';
import { UserSummaryFragmentDoc } from '@/lib/graphql/generated/graphql';
import { GPU_LAB_WORKSHEETS_QUERY, type USER_SUMMARY_FRAGMENT } from '@/lib/graphql/operations';
import { query } from '@/lib/graphql/rsc-client';
import { isSimulationKind, SIM_REGISTRY } from '@/lib/simulation/registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface GalleryWorksheet {
  id: string;
  title: string;
  description: string | null;
  views: number;
  updatedAt: string;
  content: unknown;
  /** Masked — unwrap with useFragment(UserSummaryFragmentDoc, user) */
  user: FragmentType<typeof USER_SUMMARY_FRAGMENT>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Narrow an unknown cell JSON blob to a simulation cell shape. */
function isSimulationCellData(cell: unknown): cell is { kind: 'simulation'; sim: string } {
  return (
    typeof cell === 'object' &&
    cell !== null &&
    'kind' in cell &&
    cell.kind === 'simulation' &&
    'sim' in cell &&
    typeof cell.sim === 'string'
  );
}

/** Unique simulation kinds present in a worksheet's content JSON. */
function simKindsOf(content: unknown): string[] {
  const cells: readonly unknown[] = Array.isArray(content) ? content : [];
  const kinds = new Set<string>();
  for (const cell of cells) {
    if (isSimulationCellData(cell)) {
      kinds.add(cell.sim);
    }
  }
  return [...kinds];
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getGalleryWorksheets(): Promise<GalleryWorksheet[]> {
  try {
    const { data } = await query({ query: GPU_LAB_WORKSHEETS_QUERY });
    return data?.publicWorksheets.nodes ?? [];
  } catch {
    // Database unreachable — render the empty state rather than erroring
    return [];
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'gpuLab' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

// ---------------------------------------------------------------------------
// Gallery card
// ---------------------------------------------------------------------------

interface GalleryCardProps {
  worksheet: GalleryWorksheet;
  badges: string[];
  byLabel: (name: string) => string;
  /** Formatted view count for display (locale number formatting) */
  viewsCount: string;
  /** Full accessible label, e.g. "12 views" with locale plural rules */
  viewsAria: string;
  updatedLabel: string;
  openLabel: string;
}

function GalleryCard({
  worksheet,
  badges,
  byLabel,
  viewsCount,
  viewsAria,
  updatedLabel,
  openLabel,
}: GalleryCardProps) {
  // Not a hook — the codegen client preset's fragment unmasking function.
  const user = useFragment(UserSummaryFragmentDoc, worksheet.user);

  return (
    <Link
      href={{ pathname: '/worksheet', query: { id: worksheet.id } }}
      aria-label={`${openLabel}: ${worksheet.title}`}
      className={[
        'group flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 backdrop-blur-md',
        'p-5 shadow-sm transition-all duration-200',
        'hover:border-cyan-500/40 hover:shadow-md hover:shadow-cyan-500/5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      ].join(' ')}
    >
      {/* Sim-kind badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {badges.map((badge) => (
          <span
            key={badge}
            className={[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
              'bg-linear-to-r/oklab from-cyan-500/15 to-blue-500/15',
              'border border-cyan-500/30 text-[11px] font-medium text-cyan-300',
            ].join(' ')}
          >
            <Zap className="size-3" aria-hidden="true" />
            {badge}
          </span>
        ))}
      </div>

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-semibold text-foreground truncate group-hover:text-cyan-300 transition-colors">
          {worksheet.title}
        </h2>
        {worksheet.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{worksheet.description}</p>
        )}
      </div>

      {/* Footer: author · views · updated */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{byLabel(user.name ?? '—')}</span>
        <span className="flex items-center gap-3 flex-shrink-0">
          <span className="flex items-center gap-1" aria-label={viewsAria} title={viewsAria}>
            <Eye className="size-3" aria-hidden="true" />
            {viewsCount}
          </span>
          <span>{updatedLabel}</span>
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function GpuLabPage({ params }: PageProps) {
  const { locale } = await params;
  const [t, tSim, format, worksheets] = await Promise.all([
    getTranslations({ locale, namespace: 'gpuLab' }),
    getTranslations({ locale, namespace: 'worksheet.simulation' }),
    getFormatter({ locale }),
    getGalleryWorksheets(),
  ]);

  // Only worksheets that actually contain a simulation cell belong here
  const galleryItems = worksheets
    .map((worksheet) => ({ worksheet, simKinds: simKindsOf(worksheet.content) }))
    .filter(({ simKinds }) => simKinds.length > 0);

  return (
    <main className="min-h-screen relative">
      {/* Ambient background */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(at 20% 20%, oklch(0.55 0.15 220 / 0.07) 0%, transparent 50%),
            radial-gradient(at 80% 70%, oklch(0.55 0.20 264 / 0.05) 0%, transparent 50%)
          `,
        }}
      />

      <div className="container mx-auto max-w-6xl px-4 py-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={[
                'flex items-center justify-center size-10 rounded-xl',
                'bg-linear-to-br/oklab from-cyan-500/20 to-blue-500/20',
                'border border-cyan-500/30',
              ].join(' ')}
              aria-hidden="true"
            >
              <Zap className="size-5 text-cyan-400" />
            </span>
            <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">{t('description')}</p>
        </header>

        {/* Gallery grid */}
        {galleryItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-card/30 backdrop-blur-md py-20 text-center">
            <Zap className="size-10 text-muted-foreground/30" aria-hidden="true" />
            <p className="text-sm text-muted-foreground max-w-sm">{t('empty')}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
            {galleryItems.map(({ worksheet, simKinds }) => (
              <li key={worksheet.id} className="flex">
                <GalleryCard
                  worksheet={worksheet}
                  badges={simKinds
                    .filter(isSimulationKind)
                    .map((kind) => tSim(SIM_REGISTRY[kind].labelKey))}
                  byLabel={(name) => t('by', { name })}
                  viewsCount={format.number(worksheet.views)}
                  viewsAria={t('views', { count: worksheet.views })}
                  updatedLabel={t('updated', {
                    time: format.relativeTime(new Date(worksheet.updatedAt)),
                  })}
                  openLabel={t('openWorksheet')}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
