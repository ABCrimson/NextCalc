/**
 * Knowledge Base Manager - Content Management for Topics & Theorems
 *
 * Manages the hierarchical knowledge base including topics, theorems,
 * definitions, examples, and educational resources.
 *
 * @module cms/knowledge-base
 */

import type { Category, Prisma, Theorem, Topic } from '@nextcalc/database';
import { z } from 'zod';
import { prisma } from '../prisma';

// ============================================================================
// Validation Schemas (Zod)
// ============================================================================

export const TopicCreateSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  category: z.enum([
    'CALCULUS',
    'ALGEBRA',
    'TOPOLOGY',
    'ANALYSIS',
    'GEOMETRY',
    'NUMBER_THEORY',
    'ALGORITHMS',
    'GAME_THEORY',
    'CHAOS_THEORY',
    'CRYPTOGRAPHY',
    'QUANTUM',
    'OPTIMIZATION',
    'PROBABILITY',
    'STATISTICS',
  ]),
  description: z.string().optional(),
  definition: z.string().optional(), // LaTeX/Markdown
  parentId: z.string().optional(),
});

export const TheoremCreateSchema = z.object({
  name: z.string().min(2).max(255),
  statement: z.string().min(10), // LaTeX
  proof: z.string().min(20), // Markdown/LaTeX
  intuition: z.string().optional(),
  applications: z.string().optional(),
  topicId: z.string(),
  prerequisiteIds: z.array(z.string()).optional(),
});

export const ResourceCreateSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().optional(),
  url: z.string().url(),
  type: z.enum(['VIDEO', 'ARTICLE', 'BOOK', 'PAPER', 'INTERACTIVE', 'COURSE']),
  topicId: z.string(),
});

export const ExampleCreateSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string(),
  code: z.string().optional(),
  explanation: z.string(),
  topicId: z.string().optional(),
  problemId: z.string().optional(),
  order: z.number().int().default(0),
});

export type TopicCreateInput = z.infer<typeof TopicCreateSchema>;
export type TheoremCreateInput = z.infer<typeof TheoremCreateSchema>;
export type ResourceCreateInput = z.infer<typeof ResourceCreateSchema>;
export type ExampleCreateInput = z.infer<typeof ExampleCreateSchema>;

// ============================================================================
// Topic Tree Types
// ============================================================================

export interface TopicNode {
  id: string;
  name: string;
  slug: string;
  category: Category;
  description: string | null;
  parentId: string | null;
  children: TopicNode[];
  _count?: {
    problems: number;
    theorems: number;
    examples: number;
  };
}

export interface SearchResult {
  type: 'topic' | 'theorem' | 'problem' | 'example';
  id: string;
  title: string;
  description: string;
  category?: string;
  slug?: string;
  relevance?: number;
}

// ============================================================================
// Knowledge Base Manager Class
// ============================================================================

export class KnowledgeBaseManager {
  /**
   * Create a new topic
   */
  static async createTopic(data: TopicCreateInput): Promise<Topic> {
    const validated = TopicCreateSchema.parse(data);

    // Verify parent exists if provided
    if (validated.parentId) {
      const parent = await prisma.topic.findUnique({
        where: { id: validated.parentId },
      });
      if (!parent) {
        throw new Error('Parent topic not found');
      }
    }

    return await prisma.topic.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        category: validated.category as Category,
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.definition !== undefined && { definition: validated.definition }),
        ...(validated.parentId !== undefined && { parentId: validated.parentId }),
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            problems: true,
            theorems: true,
            examples: true,
          },
        },
      },
    });
  }

  /**
   * Update a topic
   */
  static async updateTopic(id: string, data: Partial<TopicCreateInput>): Promise<Topic> {
    return await prisma.topic.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(data.category && { category: data.category as Category }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.definition !== undefined && { definition: data.definition }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  /**
   * Delete a topic (only if no problems/theorems attached)
   */
  static async deleteTopic(id: string): Promise<void> {
    // Check if topic has content
    const topic = await prisma.topic.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            problems: true,
            theorems: true,
            children: true,
          },
        },
      },
    });

    if (!topic) {
      throw new Error('Topic not found');
    }

    if (topic._count.problems > 0 || topic._count.theorems > 0 || topic._count.children > 0) {
      throw new Error('Cannot delete topic with associated content or children');
    }

    await prisma.topic.delete({
      where: { id },
    });
  }

  /**
   * Get complete topic tree (hierarchical structure)
   */
  static async getTopicTree(category?: Category): Promise<TopicNode[]> {
    const where: Prisma.TopicWhereInput = {
      ...(category ? { category } : {}),
    };

    // Fetch ALL topics in a single query, then build the tree in memory
    const allTopics = await prisma.topic.findMany({
      where,
      include: {
        _count: {
          select: {
            problems: true,
            theorems: true,
            examples: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const buildTree = (parentId: string | null): TopicNode[] =>
      allTopics
        .filter((t) => t.parentId === parentId)
        .map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          category: t.category,
          description: t.description,
          parentId: t.parentId,
          _count: t._count,
          children: buildTree(t.id),
        }));

    return buildTree(null);
  }

  /**
   * Get topic by slug with full details
   */
  static async getTopicBySlug(slug: string) {
    return await prisma.topic.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: {
          orderBy: { name: 'asc' },
        },
        theorems: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        examples: {
          orderBy: { order: 'asc' },
          take: 10,
        },
        resources: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            problems: true,
            theorems: true,
            examples: true,
            resources: true,
          },
        },
      },
    });
  }

  /**
   * Get topic by ID
   */
  static async getTopicById(id: string) {
    return await prisma.topic.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        theorems: true,
        examples: true,
        resources: true,
      },
    });
  }

  /**
   * Get all topics in a category
   */
  static async getTopicsByCategory(category: Category) {
    return await prisma.topic.findMany({
      where: { category },
      include: {
        parent: true,
        _count: {
          select: {
            problems: true,
            theorems: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Add a theorem to a topic
   */
  static async addTheorem(data: TheoremCreateInput): Promise<Theorem> {
    const validated = TheoremCreateSchema.parse(data);

    // Verify topic exists
    const topic = await prisma.topic.findUnique({
      where: { id: validated.topicId },
    });
    if (!topic) {
      throw new Error('Topic not found');
    }

    return await prisma.theorem.create({
      data: {
        name: validated.name,
        statement: validated.statement,
        proof: validated.proof,
        ...(validated.intuition !== undefined && { intuition: validated.intuition }),
        ...(validated.applications !== undefined && { applications: validated.applications }),
        topicId: validated.topicId,
        ...(validated.prerequisiteIds && {
          prerequisites: {
            connect: validated.prerequisiteIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        topic: true,
        prerequisites: true,
        dependents: true,
      },
    });
  }

  /**
   * Update a theorem
   */
  static async updateTheorem(id: string, data: Partial<TheoremCreateInput>): Promise<Theorem> {
    return await prisma.theorem.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.statement && { statement: data.statement }),
        ...(data.proof && { proof: data.proof }),
        ...(data.intuition !== undefined && { intuition: data.intuition }),
        ...(data.applications !== undefined && { applications: data.applications }),
      },
      include: {
        topic: true,
        prerequisites: true,
      },
    });
  }

  /**
   * Delete a theorem
   */
  static async deleteTheorem(id: string): Promise<void> {
    await prisma.theorem.delete({
      where: { id },
    });
  }

  /**
   * Add a definition to a topic
   */
  static async addDefinition(topicId: string, definition: string): Promise<Topic> {
    return await prisma.topic.update({
      where: { id: topicId },
      data: { definition },
    });
  }

  /**
   * Add a resource to a topic
   */
  static async addResource(data: ResourceCreateInput) {
    const validated = ResourceCreateSchema.parse(data);

    return await prisma.resource.create({
      data: {
        title: validated.title,
        ...(validated.description !== undefined && { description: validated.description }),
        url: validated.url,
        type: validated.type,
        topicId: validated.topicId,
      },
      include: {
        topic: true,
      },
    });
  }

  /**
   * Add an example to a topic or problem
   */
  static async addExample(data: ExampleCreateInput) {
    const validated = ExampleCreateSchema.parse(data);

    if (!validated.topicId && !validated.problemId) {
      throw new Error('Either topicId or problemId must be provided');
    }

    return await prisma.example.create({
      data: {
        title: validated.title,
        description: validated.description,
        ...(validated.code !== undefined && { code: validated.code }),
        explanation: validated.explanation,
        order: validated.order,
        ...(validated.topicId !== undefined && { topicId: validated.topicId }),
        ...(validated.problemId !== undefined && { problemId: validated.problemId }),
      },
      include: {
        topic: true,
        problem: true,
      },
    });
  }

  /**
   * Search knowledge base (topics, theorems, problems)
   */
  static async searchKnowledgeBase(query: string, limit = 20): Promise<SearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const searchTerm = query.toLowerCase();

    const [topics, theorems, problems] = await Promise.all([
      // Search topics
      prisma.topic.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { definition: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          category: true,
        },
      }),

      // Search theorems
      prisma.theorem.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { statement: { contains: searchTerm, mode: 'insensitive' } },
            { intuition: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          statement: true,
          topic: {
            select: { category: true },
          },
        },
      }),

      // Search problems
      prisma.problem.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
        },
      }),
    ]);

    const results: SearchResult[] = [
      ...topics.map((t) => ({
        type: 'topic' as const,
        id: t.id,
        title: t.name,
        description: t.description || '',
        category: t.category,
        slug: t.slug,
      })),
      ...theorems.map((t) => ({
        type: 'theorem' as const,
        id: t.id,
        title: t.name,
        description: t.statement.substring(0, 200),
        category: t.topic.category,
      })),
      ...problems.map((p) => ({
        type: 'problem' as const,
        id: p.id,
        title: p.title,
        description: p.description.substring(0, 200),
        slug: p.slug,
      })),
    ];

    return results.slice(0, limit);
  }

  /**
   * Get topic path (breadcrumbs) from root to given topic
   */
  static async getTopicPath(topicId: string): Promise<Topic[]> {
    const path: Topic[] = [];
    let currentId: string | null = topicId;
    const visited = new Set<string>();
    const MAX_DEPTH = 20;

    while (currentId && path.length < MAX_DEPTH) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const foundTopic: Awaited<ReturnType<typeof prisma.topic.findUnique>> =
        await prisma.topic.findUnique({
          where: { id: currentId },
          include: { parent: true },
        });

      if (!foundTopic) break;

      path.unshift(foundTopic);
      currentId = foundTopic.parentId;
    }

    return path;
  }

  /**
   * Get prerequisites for a theorem (recursive)
   */
  static async getTheoremPrerequisites(theoremId: string): Promise<Theorem[]> {
    const theorem = await prisma.theorem.findUnique({
      where: { id: theoremId },
      include: {
        prerequisites: {
          include: {
            topic: true,
            prerequisites: true,
          },
        },
      },
    });

    if (!theorem) {
      throw new Error('Theorem not found');
    }

    const visitedIds = new Set<string>();
    const allPrerequisites: Theorem[] = [];

    const collectPrerequisites = async (thm: Theorem & { prerequisites?: Theorem[] }) => {
      for (const prereq of thm.prerequisites ?? []) {
        if (!visitedIds.has(prereq.id)) {
          visitedIds.add(prereq.id);
          allPrerequisites.push(prereq);
          await collectPrerequisites(prereq);
        }
      }
    };

    await collectPrerequisites(theorem);

    return allPrerequisites;
  }

  /**
   * Get recommended topics based on user's current progress
   */
  static async getRecommendedTopics(userId: string, limit = 5) {
    // Get user's topic progress
    const userProgress = await prisma.userProgress.findUnique({
      where: { userId },
      include: {
        topicProgress: {
          include: {
            topic: true,
          },
          orderBy: {
            masteryLevel: 'desc',
          },
        },
      },
    });

    if (!userProgress || userProgress.topicProgress.length === 0) {
      // New user - recommend beginner topics
      return await prisma.topic.findMany({
        where: {
          parentId: null,
        },
        take: limit,
        include: {
          _count: {
            select: { problems: true },
          },
        },
      });
    }

    // Recommend topics in same category or adjacent categories
    const masteredCategories = new Set(
      userProgress.topicProgress
        .filter((tp) => tp.masteryLevel > 0.7)
        .map((tp) => tp.topic.category),
    );

    return await prisma.topic.findMany({
      where: {
        category: { in: Array.from(masteredCategories) },
        NOT: {
          id: {
            in: userProgress.topicProgress.map((tp) => tp.topicId),
          },
        },
      },
      take: limit,
      include: {
        _count: {
          select: { problems: true },
        },
      },
    });
  }
}

export default KnowledgeBaseManager;
