/**
 * Worksheet page — server component for metadata.
 * The interactive editor is loaded from a client wrapper to support
 * dynamic import with ssr: false.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { WorksheetClientWrapper } from './client-wrapper';

export const metadata: Metadata = {
  title: 'Worksheet',
  description:
    'Jupyter-like mathematical notebook with math cells, markdown notes, and inline 2D plots. Variables persist across cells.',
};

export default async function WorksheetPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const t = await getTranslations('worksheet');
  const { id: worksheetId } = await searchParams;

  return (
    <main
      className="min-h-screen relative"
      aria-label={t('editorLabel')}
    >
      {/* Enhanced multi-stop radial gradient background */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(at 15% 25%, oklch(0.55 0.27 264 / 0.06) 0%, transparent 50%),
            radial-gradient(at 85% 75%, oklch(0.58 0.22 300 / 0.05) 0%, transparent 50%),
            radial-gradient(at 50% 10%, oklch(0.50 0.20 220 / 0.04) 0%, transparent 40%)
          `,
        }}
      />
      {/* Subtle dot grid overlay */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(0.80 0.10 264) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="fixed inset-0 -z-10 noise pointer-events-none" aria-hidden="true" />

      <WorksheetClientWrapper {...(worksheetId ? { worksheetId } : {})} />
    </main>
  );
}
