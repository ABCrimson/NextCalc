'use client';

import { Share2 } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { AlgorithmBreadcrumb, type BreadcrumbItem } from './AlgorithmBreadcrumb';
import type { AlgorithmCategory, DifficultyLevel } from './AlgorithmCard';
import { AlgorithmMetadata, categoryKeyMap, difficultyKeyMap } from './AlgorithmMetadata';

export interface Reference {
  title: string;
  authors?: string;
  year?: number;
  url: string;
}

export interface RelatedAlgorithm {
  title: string;
  href: string;
}

export interface AlgorithmPageProps {
  /** Algorithm title */
  title: string;
  /**
   * Icon element (e.g. `<Compass />`). Accepts a rendered node rather than a
   * component so Server Component pages can pass it across the RSC boundary.
   * Sizing/color is applied by the header's icon container.
   */
  icon: ReactNode;
  /** Category */
  category: AlgorithmCategory;
  /** Difficulty level */
  difficulty: DifficultyLevel;
  /** Time complexity */
  timeComplexity: string;
  /** Space complexity */
  spaceComplexity: string;
  /** Year introduced */
  yearIntroduced?: number;
  /** Tags */
  tags?: string[];
  /** Breadcrumb trail */
  breadcrumbs: BreadcrumbItem[];
  /** Description paragraph */
  description: string;
  /** Real-world applications */
  applications: string[];
  /** References and links */
  references?: Reference[];
  /** Related algorithms */
  relatedAlgorithms?: RelatedAlgorithm[];
  /** Interactive component (visualizer) */
  children: ReactNode;
}

/**
 * AlgorithmPage Component
 *
 * Wrapper component for individual algorithm pages.
 * Provides consistent layout, metadata display, and navigation.
 *
 * Layout Structure:
 * - Breadcrumb navigation
 * - Title and metadata
 * - Description
 * - Interactive visualizer (children)
 * - Applications section
 * - References
 * - Related algorithms
 *
 * Accessibility:
 * - Semantic HTML structure
 * - Proper heading hierarchy
 * - ARIA landmarks
 * - Keyboard navigation
 * - Focus management
 */
export function AlgorithmPage({
  title,
  icon,
  category,
  difficulty,
  timeComplexity,
  spaceComplexity,
  yearIntroduced,
  tags,
  breadcrumbs,
  description,
  applications,
  references,
  relatedAlgorithms,
  children,
}: AlgorithmPageProps) {
  const t = useTranslations('algorithms');
  const prefersReducedMotion = useReducedMotion();

  const enterAnim = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  const inViewAnim = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 } };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} | NextCalc Pro`,
          text: description,
          url: window.location.href,
        });
      } catch (_err) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href);
      // Could show a toast here
    }
  };

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
      {/* Breadcrumb navigation */}
      <div className="mb-4 sm:mb-6">
        <AlgorithmBreadcrumb items={breadcrumbs} homeLabel={t('page.breadcrumbHome')} />
      </div>

      {/* Header */}
      <m.header {...enterAnim} transition={{ duration: 0.5 }} className="mb-8 sm:mb-10 lg:mb-12">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 w-full min-w-0">
            <div
              className="p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/20 shrink-0 *:size-6 sm:*:size-8 *:text-primary"
              aria-hidden="true"
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-4 break-words">
                {title}
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed break-words">
                {description}
              </p>
            </div>
          </div>

          {/* Share button */}
          <button
            type="button"
            onClick={handleShare}
            className="p-2.5 sm:p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring shrink-0"
            aria-label={t('page.shareAlgorithm')}
          >
            <Share2 className="size-4 sm:size-5" aria-hidden="true" />
          </button>
        </div>
      </m.header>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 mb-8 sm:mb-10 lg:mb-12 min-w-0">
        {/* Sidebar with metadata */}
        <aside className="lg:col-span-1 order-2 lg:order-1 min-w-0">
          <div className="lg:sticky lg:top-24 space-y-4 sm:space-y-6">
            <AlgorithmMetadata
              categoryLabel={t(`category.${categoryKeyMap[category]}`)}
              difficulty={difficulty}
              difficultyLabel={t(`difficulty.${difficultyKeyMap[difficulty]}`)}
              timeComplexity={timeComplexity}
              spaceComplexity={spaceComplexity}
              {...(yearIntroduced !== undefined && { yearIntroduced })}
              {...(tags !== undefined && { tags })}
              labels={{
                algorithmInfo: t('page.algorithmInfo'),
                category: t('page.category'),
                difficulty: t('page.difficulty'),
                timeComplexity: t('page.timeComplexity'),
                spaceComplexity: t('page.spaceComplexity'),
                yearIntroduced: t('page.yearIntroduced'),
                tags: t('page.tags'),
              }}
            />

            {/* Related algorithms */}
            {relatedAlgorithms && relatedAlgorithms.length > 0 && (
              <div className="p-4 sm:p-6 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                  {t('page.relatedAlgorithms')}
                </h3>
                <ul className="space-y-2">
                  {relatedAlgorithms.map((algo) => (
                    <li key={algo.href}>
                      <Link
                        href={algo.href}
                        className="text-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm inline-block"
                      >
                        {algo.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="lg:col-span-3 space-y-6 sm:space-y-8 lg:space-y-12 order-1 lg:order-2 min-w-0">
          {/* Interactive visualizer */}
          <m.section
            {...enterAnim}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-4 sm:p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden"
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
              {t('page.tryItYourself')}
            </h2>
            <div className="min-w-0 overflow-x-auto">{children}</div>
          </m.section>

          {/* Applications */}
          <m.section
            {...inViewAnim}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-4 sm:p-6 rounded-lg border border-border bg-card/50 backdrop-blur-sm"
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
              {t('page.realWorldApplications')}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
              {applications.map((app) => (
                <li
                  key={app}
                  className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground min-w-0"
                >
                  <span className="text-primary mt-1 shrink-0">•</span>
                  <span className="break-words min-w-0">{app}</span>
                </li>
              ))}
            </ul>
          </m.section>

          {/* References */}
          {references && references.length > 0 && (
            <m.section
              {...inViewAnim}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="p-4 sm:p-6 rounded-lg border border-border bg-card/50 backdrop-blur-sm"
            >
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">{t('page.references')}</h2>
              <ul className="space-y-2 sm:space-y-3">
                {references.map((ref) => (
                  <li key={ref.url} className="text-xs sm:text-sm">
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm inline-block"
                    >
                      {ref.title}
                    </a>
                    {ref.authors && <span className="text-muted-foreground"> — {ref.authors}</span>}
                    {ref.year && <span className="text-muted-foreground"> ({ref.year})</span>}
                  </li>
                ))}
              </ul>
            </m.section>
          )}
        </main>
      </div>
    </div>
  );
}
