import type { MetadataRoute } from 'next';

/**
 * Dynamic sitemap generator for NextCalc Pro.
 *
 * Generates sitemap entries for all static routes across all 8 supported locales.
 * Dynamic routes (forum posts, shared calculations, learn topics, problem IDs)
 * are excluded here — they should be served from a database-backed dynamic
 * sitemap segment in production.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nextcalc.dev';

const locales = ['en', 'ru', 'es', 'uk', 'de', 'fr', 'ja', 'zh'] as const;

type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

interface RouteConfig {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/**
 * All static routes in the application, organized by category.
 * Dynamic routes ([id], [topic], [code]) are excluded.
 */
const staticRoutes: RouteConfig[] = [
  // ─── Homepage ───────────────────────────────────────────────────────
  { path: '', changeFrequency: 'daily', priority: 1.0 },

  // ─── Core Calculator Tools ──────────────────────────────────────────
  { path: '/plot', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/solver', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/solver/ode', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/symbolic', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/symbolic/taylor', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/matrix', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/stats', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/complex', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/units', changeFrequency: 'weekly', priority: 0.8 },

  // ─── Visualization & Simulation ─────────────────────────────────────
  { path: '/graphs-full', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/chaos', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/fourier', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/game-theory', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/pde', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/pde/3d', changeFrequency: 'weekly', priority: 0.7 },

  // ─── Algorithms ─────────────────────────────────────────────────────
  { path: '/algorithms', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/algorithms/astar', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/crypto', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/dijkstra', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/graph-traversal', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/graphs', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/meta-learning', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/mst', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/pagerank', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/quantum', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/transformers', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/algorithms/zero-knowledge', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/ml-algorithms', changeFrequency: 'weekly', priority: 0.7 },

  // ─── Learning & Practice ────────────────────────────────────────────
  { path: '/learn', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/practice', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/problems', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/problems/number-theory', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/formulas', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/templates', changeFrequency: 'monthly', priority: 0.6 },

  // ─── Community ──────────────────────────────────────────────────────
  { path: '/forum', changeFrequency: 'daily', priority: 0.7 },
  { path: '/forum/new', changeFrequency: 'monthly', priority: 0.3 },

  // ─── User ───────────────────────────────────────────────────────────
  { path: '/worksheet', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/worksheets', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/auth/signin', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/profile', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/settings', changeFrequency: 'yearly', priority: 0.2 },
];

/**
 * Build alternates map for hreflang tags across all locales.
 */
function buildAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = `${BASE_URL}/${locale}${path}`;
  }
  // x-default points to English
  languages['x-default'] = `${BASE_URL}/en${path}`;
  return languages;
}

/**
 * Routes that receive frequent user-generated content and benefit
 * from a `lastModified` timestamp so crawlers re-visit them sooner.
 */
const dynamicContentPaths = new Set(['', '/forum']);

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  for (const route of staticRoutes) {
    for (const locale of locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${route.path}`,
        ...(dynamicContentPaths.has(route.path) ? { lastModified: now } : {}),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: buildAlternates(route.path),
        },
      });
    }
  }

  return entries;
}
