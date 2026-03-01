/**
 * Algorithm Repository - Content Management for Algorithms
 *
 * Manages algorithms, their implementations in various languages,
 * complexity analysis, and visualization code.
 *
 * @module cms/algorithm-repository
 */

import type { Algorithm, AlgorithmCategory, Prisma, ProgrammingLanguage } from '@nextcalc/database';
import { z } from 'zod';
import { prisma } from '../prisma';

// ============================================================================
// Validation Schemas (Zod)
// ============================================================================

export const AlgorithmCreateSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(20),
  pseudocode: z.string().min(10),
  category: z.enum([
    'SORTING',
    'SEARCHING',
    'GRAPH',
    'DYNAMIC_PROGRAMMING',
    'GREEDY',
    'DIVIDE_CONQUER',
    'ML_OPTIMIZATION',
    'CRYPTOGRAPHIC',
    'QUANTUM',
    'NUMERICAL',
    'STRING',
  ]),
  timeComplexity: z.string().max(100),
  spaceComplexity: z.string().max(100),
  bestCase: z.string().max(100).optional(),
  averageCase: z.string().max(100).optional(),
  worstCase: z.string().max(100).optional(),
  visualizationCode: z.string().optional(),
});

export const ImplementationCreateSchema = z.object({
  algorithmId: z.string(),
  language: z.enum([
    'TYPESCRIPT',
    'PYTHON',
    'JAVASCRIPT',
    'RUST',
    'GO',
    'JAVA',
    'CPP',
    'C',
    'HASKELL',
    'PSEUDOCODE',
  ]),
  code: z.string().min(10),
  explanation: z.string().optional(),
});

export type AlgorithmCreateInput = z.infer<typeof AlgorithmCreateSchema>;
export type ImplementationCreateInput = z.infer<typeof ImplementationCreateSchema>;

// ============================================================================
// Algorithm Repository Class
// ============================================================================

export class AlgorithmRepository {
  /**
   * Create a new algorithm
   */
  static async createAlgorithm(data: AlgorithmCreateInput): Promise<Algorithm> {
    const validated = AlgorithmCreateSchema.parse(data);

    return await prisma.algorithm.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description,
        pseudocode: validated.pseudocode,
        category: validated.category as AlgorithmCategory,
        timeComplexity: validated.timeComplexity,
        spaceComplexity: validated.spaceComplexity,
        ...(validated.bestCase !== undefined && { bestCase: validated.bestCase }),
        ...(validated.averageCase !== undefined && { averageCase: validated.averageCase }),
        ...(validated.worstCase !== undefined && { worstCase: validated.worstCase }),
        ...(validated.visualizationCode !== undefined && {
          visualizationCode: validated.visualizationCode,
        }),
      },
      include: {
        implementations: true,
      },
    });
  }

  /**
   * Update an algorithm
   */
  static async updateAlgorithm(
    id: string,
    data: Partial<AlgorithmCreateInput>,
  ): Promise<Algorithm> {
    return await prisma.algorithm.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(data.description && { description: data.description }),
        ...(data.pseudocode && { pseudocode: data.pseudocode }),
        ...(data.category && { category: data.category as AlgorithmCategory }),
        ...(data.timeComplexity && { timeComplexity: data.timeComplexity }),
        ...(data.spaceComplexity && { spaceComplexity: data.spaceComplexity }),
        ...(data.bestCase !== undefined && { bestCase: data.bestCase }),
        ...(data.averageCase !== undefined && { averageCase: data.averageCase }),
        ...(data.worstCase !== undefined && { worstCase: data.worstCase }),
        ...(data.visualizationCode !== undefined && { visualizationCode: data.visualizationCode }),
      },
      include: {
        implementations: true,
      },
    });
  }

  /**
   * Delete an algorithm
   */
  static async deleteAlgorithm(id: string): Promise<void> {
    await prisma.algorithm.delete({
      where: { id },
    });
  }

  /**
   * Get algorithm by slug
   */
  static async getAlgorithmBySlug(slug: string) {
    return await prisma.algorithm.findUnique({
      where: { slug },
      include: {
        implementations: {
          orderBy: { language: 'asc' },
        },
      },
    });
  }

  /**
   * Get algorithm by ID
   */
  static async getAlgorithmById(id: string) {
    return await prisma.algorithm.findUnique({
      where: { id },
      include: {
        implementations: {
          orderBy: { language: 'asc' },
        },
      },
    });
  }

  /**
   * Get all algorithms by category
   */
  static async getAlgorithmsByCategory(category: AlgorithmCategory) {
    return await prisma.algorithm.findMany({
      where: { category },
      include: {
        _count: {
          select: {
            implementations: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get all algorithms with optional filtering
   */
  static async getAlgorithms(filters?: {
    category?: AlgorithmCategory;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.AlgorithmWhereInput = {
      ...(filters?.category && { category: filters.category }),
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [algorithms, total] = await Promise.all([
      prisma.algorithm.findMany({
        where,
        include: {
          _count: {
            select: {
              implementations: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.algorithm.count({ where }),
    ]);

    return {
      algorithms,
      total,
      hasMore: (filters?.offset || 0) + (filters?.limit || 50) < total,
    };
  }

  /**
   * Add an implementation to an algorithm
   */
  static async addImplementation(data: ImplementationCreateInput) {
    const validated = ImplementationCreateSchema.parse(data);

    // Verify algorithm exists
    const algorithm = await prisma.algorithm.findUnique({
      where: { id: validated.algorithmId },
    });
    if (!algorithm) {
      throw new Error('Algorithm not found');
    }

    // Check if implementation already exists for this language
    const existing = await prisma.implementation.findFirst({
      where: {
        algorithmId: validated.algorithmId,
        language: validated.language as ProgrammingLanguage,
      },
    });

    if (existing) {
      // Update existing implementation
      return await prisma.implementation.update({
        where: { id: existing.id },
        data: {
          code: validated.code,
          ...(validated.explanation !== undefined && { explanation: validated.explanation }),
        },
        include: {
          algorithm: true,
        },
      });
    }

    // Create new implementation
    return await prisma.implementation.create({
      data: {
        algorithmId: validated.algorithmId,
        language: validated.language as ProgrammingLanguage,
        code: validated.code,
        ...(validated.explanation !== undefined && { explanation: validated.explanation }),
      },
      include: {
        algorithm: true,
      },
    });
  }

  /**
   * Update an implementation
   */
  static async updateImplementation(id: string, data: { code?: string; explanation?: string }) {
    return await prisma.implementation.update({
      where: { id },
      data: {
        ...(data.code && { code: data.code }),
        ...(data.explanation !== undefined && { explanation: data.explanation }),
      },
      include: {
        algorithm: true,
      },
    });
  }

  /**
   * Delete an implementation
   */
  static async deleteImplementation(id: string): Promise<void> {
    await prisma.implementation.delete({
      where: { id },
    });
  }

  /**
   * Get implementations by language
   */
  static async getImplementationsByLanguage(language: ProgrammingLanguage) {
    return await prisma.implementation.findMany({
      where: { language },
      include: {
        algorithm: true,
      },
      orderBy: {
        algorithm: { name: 'asc' },
      },
    });
  }

  /**
   * Search algorithms
   */
  static async searchAlgorithms(query: string, limit = 20) {
    if (!query || query.length < 2) {
      return [];
    }

    return await prisma.algorithm.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { pseudocode: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      include: {
        _count: {
          select: {
            implementations: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get algorithm statistics
   */
  static async getStatistics() {
    const [totalAlgorithms, totalImplementations, algorithmsByCategory, implementationsByLanguage] =
      await Promise.all([
        prisma.algorithm.count(),
        prisma.implementation.count(),
        prisma.algorithm.groupBy({
          by: ['category'],
          _count: true,
        }),
        prisma.implementation.groupBy({
          by: ['language'],
          _count: true,
        }),
      ]);

    return {
      totalAlgorithms,
      totalImplementations,
      averageImplementationsPerAlgorithm: totalImplementations / totalAlgorithms || 0,
      byCategory: algorithmsByCategory.map((item) => ({
        category: item.category,
        count: item._count,
      })),
      byLanguage: implementationsByLanguage.map((item) => ({
        language: item.language,
        count: item._count,
      })),
    };
  }

  /**
   * Get algorithms by complexity
   */
  static async getAlgorithmsByComplexity(timeComplexity: string) {
    return await prisma.algorithm.findMany({
      where: {
        OR: [
          { timeComplexity: { contains: timeComplexity, mode: 'insensitive' } },
          { bestCase: { contains: timeComplexity, mode: 'insensitive' } },
          { averageCase: { contains: timeComplexity, mode: 'insensitive' } },
          { worstCase: { contains: timeComplexity, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Compare algorithms (for educational purposes)
   */
  static async compareAlgorithms(algorithmIds: string[]) {
    const algorithms = await prisma.algorithm.findMany({
      where: {
        id: { in: algorithmIds },
      },
      include: {
        implementations: true,
      },
    });

    return algorithms.map((algo) => ({
      id: algo.id,
      name: algo.name,
      category: algo.category,
      timeComplexity: algo.timeComplexity,
      spaceComplexity: algo.spaceComplexity,
      bestCase: algo.bestCase,
      averageCase: algo.averageCase,
      worstCase: algo.worstCase,
      implementationCount: algo.implementations.length,
      languages: algo.implementations.map((impl) => impl.language),
    }));
  }

  /**
   * Get recommended algorithms based on category
   */
  static async getRecommendedAlgorithms(
    category: AlgorithmCategory,
    excludeId?: string,
    limit = 5,
  ) {
    return await prisma.algorithm.findMany({
      where: {
        category,
        ...(excludeId && { id: { not: excludeId } }),
      },
      take: limit,
      include: {
        _count: {
          select: {
            implementations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export default AlgorithmRepository;
