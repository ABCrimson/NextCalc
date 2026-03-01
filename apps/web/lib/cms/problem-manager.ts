/**
 * Problem Manager - Content Management System for Problems
 *
 * Handles CRUD operations for problems, hints, test cases, and examples.
 * Provides type-safe interfaces for problem creation and management.
 *
 * @module cms/problem-manager
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Difficulty, Prisma, Problem } from '@nextcalc/database';
import matter from 'gray-matter';
import { z } from 'zod';
import { prisma } from '../prisma';

// ============================================================================
// Validation Schemas (Zod)
// ============================================================================

export const ProblemCreateSchema = z.object({
  title: z.string().min(5).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(10),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MASTER']),
  content: z.string().min(50), // Markdown problem statement
  solution: z.string().min(50), // Markdown solution
  solutionCode: z.string().optional(),
  estimatedTime: z.number().int().min(1).max(300).default(15),
  points: z.number().int().min(1).max(1000).default(10),
  topics: z.array(z.string()).min(1), // Topic IDs
  hints: z
    .array(
      z.object({
        content: z.string(),
        order: z.number().int().default(0),
        pointCost: z.number().int().default(5),
      }),
    )
    .optional(),
  testCases: z
    .array(
      z.object({
        input: z.string(),
        expected: z.string(),
        isHidden: z.boolean().default(false),
        order: z.number().int().default(0),
      }),
    )
    .optional(),
});

export const ProblemUpdateSchema = ProblemCreateSchema.partial();

export const ProblemFilterSchema = z.object({
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MASTER']).optional(),
  topicIds: z.array(z.string()).optional(),
  search: z.string().optional(),
  minPoints: z.number().int().optional(),
  maxPoints: z.number().int().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['popularity', 'difficulty', 'createdAt', 'points']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ProblemCreateInput = z.infer<typeof ProblemCreateSchema>;
export type ProblemUpdateInput = z.infer<typeof ProblemUpdateSchema>;
export type ProblemFilters = z.infer<typeof ProblemFilterSchema>;

// ============================================================================
// Problem Manager Class
// ============================================================================

export class ProblemManager {
  /**
   * Create a new problem with hints and test cases
   */
  static async createProblem(data: ProblemCreateInput): Promise<Problem> {
    const validated = ProblemCreateSchema.parse(data);

    const problem = await prisma.problem.create({
      data: {
        title: validated.title,
        slug: validated.slug,
        description: validated.description,
        difficulty: validated.difficulty as Difficulty,
        content: validated.content,
        solution: validated.solution,
        ...(validated.solutionCode !== undefined && { solutionCode: validated.solutionCode }),
        estimatedTime: validated.estimatedTime,
        points: validated.points,

        // Create relationships
        topics: {
          create: validated.topics.map((topicId) => ({
            topicId,
          })),
        },

        ...(validated.hints && {
          hints: {
            create: validated.hints.map((hint, idx) => ({
              content: hint.content,
              order: hint.order ?? idx,
              pointCost: hint.pointCost,
            })),
          },
        }),

        ...(validated.testCases && {
          testCases: {
            create: validated.testCases.map((tc, idx) => ({
              input: tc.input,
              expected: tc.expected,
              isHidden: tc.isHidden,
              order: tc.order ?? idx,
            })),
          },
        }),
      },
      include: {
        topics: { include: { topic: true } },
        hints: { orderBy: { order: 'asc' } },
        testCases: { orderBy: { order: 'asc' } },
      },
    });

    return problem;
  }

  /**
   * Update an existing problem
   */
  static async updateProblem(id: string, data: ProblemUpdateInput): Promise<Problem> {
    const validated = ProblemUpdateSchema.parse(data);

    const updateData: Prisma.ProblemUpdateInput = {
      ...(validated.title && { title: validated.title }),
      ...(validated.slug && { slug: validated.slug }),
      ...(validated.description && { description: validated.description }),
      ...(validated.difficulty && { difficulty: validated.difficulty as Difficulty }),
      ...(validated.content && { content: validated.content }),
      ...(validated.solution && { solution: validated.solution }),
      ...(validated.solutionCode !== undefined && { solutionCode: validated.solutionCode }),
      ...(validated.estimatedTime && { estimatedTime: validated.estimatedTime }),
      ...(validated.points && { points: validated.points }),
    };

    // Update topic relationships if provided
    if (validated.topics) {
      updateData.topics = {
        deleteMany: {},
        create: validated.topics.map((topicId) => ({ topicId })),
      };
    }

    return await prisma.problem.update({
      where: { id },
      data: updateData,
      include: {
        topics: { include: { topic: true } },
        hints: { orderBy: { order: 'asc' } },
        testCases: { orderBy: { order: 'asc' } },
      },
    });
  }

  /**
   * Soft delete a problem
   */
  static async deleteProblem(id: string): Promise<void> {
    await prisma.problem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Hard delete a problem (admin only)
   */
  static async hardDeleteProblem(id: string): Promise<void> {
    await prisma.problem.delete({
      where: { id },
    });
  }

  /**
   * Get problems with filtering, pagination, and sorting
   */
  static async getProblems(filters: Partial<ProblemFilters> = {}) {
    const validated = ProblemFilterSchema.parse(filters);

    const where: Prisma.ProblemWhereInput = {
      deletedAt: null,
      ...(validated.difficulty && { difficulty: validated.difficulty as Difficulty }),
      ...(validated.topicIds &&
        validated.topicIds.length > 0 && {
          topics: {
            some: {
              topicId: { in: validated.topicIds },
            },
          },
        }),
      ...(validated.minPoints && { points: { gte: validated.minPoints } }),
      ...(validated.maxPoints && { points: { lte: validated.maxPoints } }),
      ...(validated.search && {
        OR: [
          { title: { contains: validated.search, mode: 'insensitive' } },
          { description: { contains: validated.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.ProblemOrderByWithRelationInput =
      validated.sortBy === 'popularity'
        ? { popularity: validated.sortOrder }
        : validated.sortBy === 'difficulty'
          ? { difficulty: validated.sortOrder }
          : validated.sortBy === 'points'
            ? { points: validated.sortOrder }
            : { createdAt: validated.sortOrder };

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        include: {
          topics: {
            include: {
              topic: {
                select: { id: true, name: true, slug: true, category: true },
              },
            },
          },
          _count: {
            select: {
              attempts: true,
              favorites: true,
            },
          },
        },
        orderBy,
        take: validated.limit,
        skip: validated.offset,
      }),
      prisma.problem.count({ where }),
    ]);

    return {
      problems,
      total,
      hasMore: validated.offset + validated.limit < total,
      page: Math.floor(validated.offset / validated.limit) + 1,
      totalPages: Math.ceil(total / validated.limit),
    };
  }

  /**
   * Get a single problem by slug
   */
  static async getProblemBySlug(slug: string, includeHidden = false) {
    const problem = await prisma.problem.findUnique({
      where: { slug },
      include: {
        topics: {
          include: {
            topic: true,
          },
        },
        hints: {
          orderBy: { order: 'asc' },
        },
        testCases: {
          where: includeHidden ? {} : { isHidden: false },
          orderBy: { order: 'asc' },
        },
        examples: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            attempts: true,
            favorites: true,
          },
        },
      },
    });

    if (!problem || problem.deletedAt) {
      return null;
    }

    // Increment popularity counter
    await prisma.problem.update({
      where: { id: problem.id },
      data: { popularity: { increment: 1 } },
    });

    return problem;
  }

  /**
   * Get a problem by ID
   */
  static async getProblemById(id: string, includeHidden = false) {
    const problem = await prisma.problem.findUnique({
      where: { id },
      include: {
        topics: {
          include: {
            topic: true,
          },
        },
        hints: {
          orderBy: { order: 'asc' },
        },
        testCases: {
          where: includeHidden ? {} : { isHidden: false },
          orderBy: { order: 'asc' },
        },
        examples: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!problem || problem.deletedAt) {
      return null;
    }

    return problem;
  }

  /**
   * Import problems from markdown files
   * Expected format:
   * ---
   * title: Problem Title
   * slug: problem-slug
   * difficulty: INTERMEDIATE
   * topics: [topic-id-1, topic-id-2]
   * points: 20
   * estimatedTime: 30
   * ---
   *
   * ## Problem
   * Problem content here...
   *
   * ## Solution
   * Solution content here...
   *
   * ## Hints
   * - Hint 1
   * - Hint 2
   *
   * ## Test Cases
   * ```json
   * [
   *   {"input": "...", "expected": "...", "isHidden": false}
   * ]
   * ```
   */
  static async importProblemsFromMarkdown(directory: string): Promise<Problem[]> {
    const files = await fs.readdir(directory);
    const markdownFiles = files.filter((f) => f.endsWith('.md'));

    const problems: Problem[] = [];

    for (const file of markdownFiles) {
      try {
        const filePath = path.join(directory, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const { data: frontmatter, content } = matter(fileContent);

        // Parse markdown sections
        const sections = ProblemManager.parseMarkdownSections(content);

        const problemData: ProblemCreateInput = {
          title: frontmatter['title'] as string,
          slug: (frontmatter['slug'] as string | undefined) || file.replace('.md', ''),
          description:
            (frontmatter['description'] as string | undefined) ||
            sections.problem?.substring(0, 200) ||
            '',
          difficulty: frontmatter['difficulty'] as Difficulty,
          topics: (frontmatter['topics'] as string[]) || [],
          content: sections.problem || content,
          solution: sections.solution || '',
          solutionCode: sections.code,
          estimatedTime: (frontmatter['estimatedTime'] as number | undefined) || 15,
          points: (frontmatter['points'] as number | undefined) || 10,
          hints: sections.hints?.map((hint, idx) => ({
            content: hint,
            order: idx,
            pointCost: 5,
          })),
          testCases: sections.testCases,
        };

        const problem = await ProblemManager.createProblem(problemData);
        problems.push(problem);
      } catch (error) {
        console.error(`Failed to import ${file}:`, error);
      }
    }

    return problems;
  }

  /**
   * Parse markdown sections
   */
  private static parseMarkdownSections(markdown: string) {
    const sections: {
      problem?: string;
      solution?: string;
      code?: string;
      hints?: string[];
      testCases?: Array<{ input: string; expected: string; isHidden: boolean; order: number }>;
    } = {};

    const problemMatch = markdown.match(/##\s*Problem\s*\n([\s\S]*?)(?=##|$)/i);
    if (problemMatch?.[1]) sections.problem = problemMatch[1].trim();

    const solutionMatch = markdown.match(/##\s*Solution\s*\n([\s\S]*?)(?=##|$)/i);
    if (solutionMatch?.[1]) sections.solution = solutionMatch[1].trim();

    const codeMatch = markdown.match(/##\s*Code\s*\n```[\s\S]*?\n([\s\S]*?)```/i);
    if (codeMatch?.[1]) sections.code = codeMatch[1].trim();

    const hintsMatch = markdown.match(/##\s*Hints\s*\n([\s\S]*?)(?=##|$)/i);
    if (hintsMatch?.[1]) {
      sections.hints = hintsMatch[1]
        .split('\n')
        .filter((line) => line.trim().startsWith('-'))
        .map((line) => line.replace(/^-\s*/, '').trim());
    }

    const testCasesMatch = markdown.match(/##\s*Test Cases\s*\n```json\s*\n([\s\S]*?)```/i);
    if (testCasesMatch?.[1]) {
      try {
        sections.testCases = JSON.parse(testCasesMatch[1]);
      } catch (_e) {
        console.error('Failed to parse test cases JSON');
      }
    }

    return sections;
  }

  /**
   * Calculate success rate for a problem
   */
  static async calculateSuccessRate(problemId: string): Promise<number> {
    const attempts = await prisma.attempt.findMany({
      where: { problemId },
      select: { correct: true },
    });

    if (attempts.length === 0) return 0;

    const successful = attempts.filter((a) => a.correct).length;
    return (successful / attempts.length) * 100;
  }

  /**
   * Update success rate for all problems
   */
  static async updateAllSuccessRates(): Promise<void> {
    const problems = await prisma.problem.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const problem of problems) {
      const successRate = await ProblemManager.calculateSuccessRate(problem.id);
      await prisma.problem.update({
        where: { id: problem.id },
        data: { successRate },
      });
    }
  }
}

export default ProblemManager;
