'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { type LucideIcon, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { AlgorithmBreadcrumb, type BreadcrumbItem } from './AlgorithmBreadcrumb';
import type { AlgorithmCategory, DifficultyLevel } from './AlgorithmCard';
import { AlgorithmMetadata } from './AlgorithmMetadata';

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
  /** Icon component */
  icon: LucideIcon;
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
  icon: Icon,
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
  const t = useTranslations('algorithms.page');
  const prefersReducedMotion = useReducedMotion();

  const motionProps = prefersReducedMotion
    ? { initial: undefined, animate: undefined, whileInView: undefined }
    : {};

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
        <AlgorithmBreadcrumb items={breadcrumbs} />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 sm:mb-10 lg:mb-12"
        {...motionProps}
      >
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 w-full min-w-0">
            <div className="p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" aria-hidden="true" />
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
            onClick={handleShare}
            className="p-2.5 sm:p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring shrink-0"
            aria-label={t('shareAlgorithm')}
          >
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </button>
        </div>
      </motion.header>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 mb-8 sm:mb-10 lg:mb-12 min-w-0">
        {/* Sidebar with metadata */}
        <aside className="lg:col-span-1 order-2 lg:order-1 min-w-0">
          <div className="lg:sticky lg:top-24 space-y-4 sm:space-y-6">
            <AlgorithmMetadata
              category={category}
              difficulty={difficulty}
              timeComplexity={timeComplexity}
              spaceComplexity={spaceComplexity}
              {...(yearIntroduced !== undefined && { yearIntroduced })}
              {...(tags !== undefined && { tags })}
            />

            {/* Related algorithms */}
            {relatedAlgorithms && relatedAlgorithms.length > 0 && (
              <div className="p-4 sm:p-6 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                  {t('relatedAlgorithms')}
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
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-4 sm:p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden"
            {...motionProps}
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{t('tryItYourself')}</h2>
            <div className="min-w-0 overflow-x-auto">{children}</div>
          </motion.section>

          {/* Applications */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-4 sm:p-6 rounded-lg border border-border bg-card/50 backdrop-blur-sm"
            {...motionProps}
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
              {t('realWorldApplications')}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
              {applications.map((app, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground min-w-0"
                >
                  <span className="text-primary mt-1 shrink-0">•</span>
                  <span className="break-words min-w-0">{app}</span>
                </li>
              ))}
            </ul>
          </motion.section>

          {/* References */}
          {references && references.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="p-4 sm:p-6 rounded-lg border border-border bg-card/50 backdrop-blur-sm"
              {...motionProps}
            >
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">{t('references')}</h2>
              <ul className="space-y-2 sm:space-y-3">
                {references.map((ref, index) => (
                  <li key={index} className="text-xs sm:text-sm">
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
            </motion.section>
          )}
        </main>
      </div>
    </div>
  );
}
