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
import { AlgorithmCard, type AlgorithmCategory, type DifficultyLevel } from '@/components/algorithms/AlgorithmCard';
import { CategoryFilter } from '@/components/algorithms/CategoryFilter';

/**
 * Algorithm definition for the landing page
 */
interface Algorithm {
  id: string;
  title: string;
  description: string;
  category: AlgorithmCategory;
  difficulty: DifficultyLevel;
  href: string;
  icon: LucideIcon;
  timeComplexity?: string;
  disabled?: boolean;
}

/**
 * All available algorithms
 */
const algorithms: Algorithm[] = [
  {
    id: 'transformers',
    title: 'Transformer Attention',
    description:
      'Explore how transformers process sequences with self-attention mechanisms. Visualize query, key, and value matrices in real-time.',
    category: 'machine-learning',
    difficulty: 'intermediate',
    href: '/algorithms/transformers',
    icon: Brain,
    timeComplexity: 'O(n²d)',
  },
  {
    id: 'meta-learning',
    title: 'Meta-Learning (MAML)',
    description:
      'Discover Model-Agnostic Meta-Learning and how models learn to learn. Train on tasks and adapt to new ones quickly.',
    category: 'machine-learning',
    difficulty: 'advanced',
    href: '/algorithms/meta-learning',
    icon: Sparkles,
    timeComplexity: 'O(kT)',
  },
  {
    id: 'zkp',
    title: 'Zero-Knowledge Proofs',
    description:
      'Understand cryptographic protocols that prove knowledge without revealing information. Interactive Schnorr protocol demonstration.',
    category: 'cryptography',
    difficulty: 'advanced',
    href: '/algorithms/crypto',
    icon: Shield,
    timeComplexity: 'O(1)',
  },
  {
    id: 'quantum',
    title: "Quantum Simulation",
    description:
      "Build quantum circuits with gates like Hadamard, CNOT, and Toffoli. Visualize superposition and entanglement.",
    category: 'quantum',
    difficulty: 'expert',
    href: '/algorithms/quantum',
    icon: Atom,
    timeComplexity: 'O(2ⁿ)',
  },
  {
    id: 'pagerank',
    title: 'PageRank Algorithm',
    description:
      "Explore Google's original ranking algorithm. Build graphs, adjust damping, and watch scores converge iteratively.",
    category: 'graph-theory',
    difficulty: 'intermediate',
    href: '/algorithms/graphs',
    icon: Network,
    timeComplexity: 'O(kn)',
  },
  {
    id: 'fourier',
    title: 'Fourier Analysis',
    description:
      'Transform time-domain signals to frequency domain using FFT and DFT. Visualize magnitude and phase spectrums.',
    category: 'signal-processing',
    difficulty: 'intermediate',
    href: '/fourier',
    icon: Activity,
    timeComplexity: 'O(n log n)',
  },
  {
    id: 'game-theory',
    title: 'Game Theory',
    description:
      'Analyze strategic interactions using Nash equilibrium. Explore classic games like Prisoner\'s Dilemma and Battle of the Sexes.',
    category: 'game-theory',
    difficulty: 'intermediate',
    href: '/game-theory',
    icon: Trophy,
    timeComplexity: 'O(n²)',
  },
  {
    id: 'chaos',
    title: 'Chaos Theory',
    description:
      'Visualize chaotic systems including Lorenz attractors and logistic maps. Explore strange attractors and bifurcation diagrams.',
    category: 'dynamical-systems',
    difficulty: 'advanced',
    href: '/chaos',
    icon: Wind,
    timeComplexity: 'O(kn)',
  },
  {
    id: 'pde',
    title: 'PDE Solver',
    description:
      'Solve partial differential equations numerically. Simulate heat diffusion and wave propagation with finite difference methods.',
    category: 'numerical-analysis',
    difficulty: 'advanced',
    href: '/pde',
    icon: Flame,
    timeComplexity: 'O(n²t)',
  },
  {
    id: 'pde-3d',
    title: 'PDE Solver 3D',
    description:
      'Three-dimensional PDE visualization with isosurface rendering, slice planes, and point clouds. Solve Heat and Wave equations on voxel grids.',
    category: 'numerical-analysis',
    difficulty: 'expert',
    href: '/pde/3d',
    icon: Box,
    timeComplexity: 'O(n³t)',
  },
  {
    id: 'graphs-full',
    title: 'Graph Algorithms',
    description:
      'Explore graph traversal and shortest path algorithms. Visualize BFS, DFS, Dijkstra, and A* on custom graphs.',
    category: 'graph-theory',
    difficulty: 'intermediate',
    href: '/graphs-full',
    icon: Network,
    timeComplexity: 'O(E log V)',
  },
  {
    id: 'ml-algorithms',
    title: 'ML Algorithms',
    description:
      'Interactive visualizations of machine learning algorithms including neural networks, decision trees, and clustering.',
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
  const [selectedCategories, setSelectedCategories] = useState<AlgorithmCategory[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<DifficultyLevel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter algorithms based on selection
  const filteredAlgorithms = useMemo(() => {
    return algorithms.filter((algorithm) => {
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
        const matchesTitle = algorithm.title.toLowerCase().includes(query);
        const matchesDescription = algorithm.description.toLowerCase().includes(query);
        return matchesTitle || matchesDescription;
      }

      return true;
    });
  }, [selectedCategories, selectedDifficulties, searchQuery]);

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
              <span className="text-sm font-medium">Interactive Learning</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              Algorithm Visualizations
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
              Explore cutting-edge algorithms through interactive visualizations.
              From machine learning transformers to quantum circuits, understand
              complex concepts with hands-on experimentation.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                <Brain className="h-4 w-4" aria-hidden="true" />
                <span>Machine Learning</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                <Shield className="h-4 w-4" aria-hidden="true" />
                <span>Cryptography</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <Atom className="h-4 w-4" aria-hidden="true" />
                <span>Quantum Computing</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Network className="h-4 w-4" aria-hidden="true" />
                <span>Graph Theory</span>
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
                {filteredAlgorithms.length === algorithms.length
                  ? 'All Algorithms'
                  : 'Filtered Results'}
              </h2>
              <p className="text-muted-foreground">
                {filteredAlgorithms.length} algorithm
                {filteredAlgorithms.length !== 1 ? 's' : ''} found
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
                      title={algorithm.title}
                      description={algorithm.description}
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
                <h3 className="text-xl font-semibold mb-2">No algorithms found</h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your filters or search query
                </p>
                <button
                  onClick={() => {
                    setSelectedCategories([]);
                    setSelectedDifficulties([]);
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Clear all filters
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
                Learning Through Interaction
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Each algorithm visualization includes step-by-step explanations,
                adjustable parameters, and real-time feedback. Experiment with
                different inputs to develop intuition for how these algorithms work.
                All visualizations are built with modern web technologies and are
                fully accessible.
              </p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
