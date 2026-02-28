'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Shield,
  Atom,
  Network,
  Sparkles,
  BookOpen,
  TrendingUp,
  Activity,
  Trophy,
  Wind,
  Flame,
  Box,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AlgorithmCard, type AlgorithmCategory, type DifficultyLevel } from '@/components/algorithms/AlgorithmCard';
import { CategoryFilter } from '@/components/algorithms/CategoryFilter';

/**
 * Algorithm definition for the landing page
 */
interface Algorithm {
  id: string;
  /** Translation key under algorithms.landing.* */
  translationKey: string;
  category: AlgorithmCategory;
  difficulty: DifficultyLevel;
  href: string;
  icon: LucideIcon;
  timeComplexity?: string;
  disabled?: boolean;
}

/**
 * All available algorithms (static metadata only; titles and descriptions come from translations)
 */
const algorithmDefs: Algorithm[] = [
  {
    id: 'transformers',
    translationKey: 'transformers',
    category: 'machine-learning',
    difficulty: 'intermediate',
    href: '/algorithms/transformers',
    icon: Brain,
    timeComplexity: 'O(n²d)',
  },
  {
    id: 'meta-learning',
    translationKey: 'metaLearning',
    category: 'machine-learning',
    difficulty: 'advanced',
    href: '/algorithms/meta-learning',
    icon: Sparkles,
    timeComplexity: 'O(kT)',
  },
  {
    id: 'zkp',
    translationKey: 'zkp',
    category: 'cryptography',
    difficulty: 'advanced',
    href: '/algorithms/crypto',
    icon: Shield,
    timeComplexity: 'O(1)',
  },
  {
    id: 'quantum',
    translationKey: 'quantum',
    category: 'quantum',
    difficulty: 'expert',
    href: '/algorithms/quantum',
    icon: Atom,
    timeComplexity: 'O(2ⁿ)',
  },
  {
    id: 'pagerank',
    translationKey: 'pagerank',
    category: 'graph-theory',
    difficulty: 'intermediate',
    href: '/algorithms/graphs',
    icon: Network,
    timeComplexity: 'O(kn)',
  },
  {
    id: 'fourier',
    translationKey: 'fourier',
    category: 'signal-processing',
    difficulty: 'intermediate',
    href: '/fourier',
    icon: Activity,
    timeComplexity: 'O(n log n)',
  },
  {
    id: 'game-theory',
    translationKey: 'gameTheory',
    category: 'game-theory',
    difficulty: 'intermediate',
    href: '/game-theory',
    icon: Trophy,
    timeComplexity: 'O(n²)',
  },
  {
    id: 'chaos',
    translationKey: 'chaos',
    category: 'dynamical-systems',
    difficulty: 'advanced',
    href: '/chaos',
    icon: Wind,
    timeComplexity: 'O(kn)',
  },
  {
    id: 'pde',
    translationKey: 'pde',
    category: 'numerical-analysis',
    difficulty: 'advanced',
    href: '/pde',
    icon: Flame,
    timeComplexity: 'O(n²t)',
  },
  {
    id: 'pde-3d',
    translationKey: 'pde3d',
    category: 'numerical-analysis',
    difficulty: 'expert',
    href: '/pde/3d',
    icon: Box,
    timeComplexity: 'O(n³t)',
  },
  {
    id: 'graphs-full',
    translationKey: 'graphsFull',
    category: 'graph-theory',
    difficulty: 'intermediate',
    href: '/graphs-full',
    icon: Network,
    timeComplexity: 'O(E log V)',
  },
  {
    id: 'ml-algorithms',
    translationKey: 'mlAlgorithms',
    category: 'machine-learning',
    difficulty: 'intermediate',
    href: '/ml-algorithms',
    icon: Brain,
    timeComplexity: 'O(n²)',
  },
];

/**
 * Algorithms Landing Page
 *
 * Main entry point for algorithm visualizations.
 * Displays all algorithms with filtering, search, and categorization.
 *
 * Features:
 * - Interactive filtering by category and difficulty
 * - Full-text search
 * - Responsive grid layout
 * - Animated card entries
 * - Accessible keyboard navigation
 * - Dark mode support
 *
 * Accessibility:
 * - Semantic HTML structure
 * - ARIA labels for dynamic content
 * - Keyboard navigation
 * - Focus management
 * - Screen reader announcements
 */
export default function AlgorithmsPage() {
  const t = useTranslations('algorithms');
  const [selectedCategories, setSelectedCategories] = useState<AlgorithmCategory[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<DifficultyLevel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const tl = useTranslations('algorithms.landing');

  // Filter algorithms based on selection
  const filteredAlgorithms = useMemo(() => {
    return algorithmDefs.filter((algorithm) => {
      // Category filter
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(algorithm.category)
      ) {
        return false;
      }

      // Difficulty filter
      if (
        selectedDifficulties.length > 0 &&
        !selectedDifficulties.includes(algorithm.difficulty)
      ) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const title = tl(`${algorithm.translationKey}.title`);
        const description = tl(`${algorithm.translationKey}.description`);
        const matchesTitle = title.toLowerCase().includes(query);
        const matchesDescription = description.toLowerCase().includes(query);
        return matchesTitle || matchesDescription;
      }

      return true;
    });
  }, [selectedCategories, selectedDifficulties, searchQuery, tl]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 px-4">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-6">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">{t('interactiveLearning')}</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              {t('heroTitle')}
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
              {t('heroDescription')}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                <Brain className="h-4 w-4" aria-hidden="true" />
                <span>{t('category.machineLearning')}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                <Shield className="h-4 w-4" aria-hidden="true" />
                <span>{t('category.cryptography')}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <Atom className="h-4 w-4" aria-hidden="true" />
                <span>{t('category.quantumComputing')}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Network className="h-4 w-4" aria-hidden="true" />
                <span>{t('category.graphTheory')}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24">
              <CategoryFilter
                selectedCategories={selectedCategories}
                selectedDifficulties={selectedDifficulties}
                searchQuery={searchQuery}
                onCategoriesChange={setSelectedCategories}
                onDifficultiesChange={setSelectedDifficulties}
                onSearchChange={setSearchQuery}
              />
            </div>
          </aside>

          {/* Algorithms Grid */}
          <div className="lg:col-span-3">
            {/* Results count */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">
                {filteredAlgorithms.length === algorithmDefs.length
                  ? t('allAlgorithms')
                  : t('filteredResults')}
              </h2>
              <p className="text-muted-foreground">
                {filteredAlgorithms.length !== 1
                  ? t('algorithmCountPlural', { count: filteredAlgorithms.length })
                  : t('algorithmCount', { count: filteredAlgorithms.length })}
              </p>
            </div>

            {/* Grid */}
            {filteredAlgorithms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredAlgorithms.map((algorithm, index) => (
                  <motion.div
                    key={algorithm.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <AlgorithmCard
                      title={tl(`${algorithm.translationKey}.title`)}
                      description={tl(`${algorithm.translationKey}.description`)}
                      category={algorithm.category}
                      difficulty={algorithm.difficulty}
                      href={algorithm.href}
                      icon={algorithm.icon}
                      {...(algorithm.timeComplexity ? { timeComplexity: algorithm.timeComplexity } : {})}
                      {...(algorithm.disabled ? { disabled: algorithm.disabled } : {})}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              // Empty state
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <TrendingUp className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" aria-hidden="true" />
                <h3 className="text-xl font-semibold mb-2">{t('noAlgorithmsFound')}</h3>
                <p className="text-muted-foreground mb-6">
                  {t('noAlgorithmsHint')}
                </p>
                <button
                  onClick={() => {
                    setSelectedCategories([]);
                    setSelectedDifficulties([]);
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t('clearAllFilters')}
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Educational callout */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="p-8 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/20">
              <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">
                {t('learningTitle')}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('learningDescription')}
              </p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
