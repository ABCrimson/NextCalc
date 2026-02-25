/**
 * Problem Set Loader - Load and Parse Problem Sets from Markdown
 *
 * Loads problem sets with:
 * - Markdown format
 * - Structured problem definitions
 * - Solutions and hints
 * - Metadata
 */

import { parseMarkdown, type ParsedMarkdown, type MarkdownSection } from '../markdown/parser.js';

/**
 * Problem set structure
 */
export interface ProblemSet {
  /** Set ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description?: string;
  /** Category */
  category: string;
  /** Difficulty range */
  difficultyRange: [number, number];
  /** Problems in this set */
  problems: Problem[];
  /** Metadata */
  metadata: Record<string, unknown>;
  /** Prerequisites */
  prerequisites?: string[];
  /** Learning objectives */
  learningObjectives?: string[];
}

/**
 * Individual problem
 */
export interface Problem {
  /** Problem ID (within set) */
  id: string;
  /** Problem number */
  number: number;
  /** Problem statement */
  statement: string;
  /** Difficulty (1-5) */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Solution */
  solution?: ProblemSolution | undefined;
  /** Hints */
  hints: string[];
  /** Tags */
  tags: string[];
  /** Points/weight */
  points?: number;
}

/**
 * Problem solution
 */
export interface ProblemSolution {
  /** Final answer */
  answer: string;
  /** Step-by-step explanation */
  steps?: string[];
  /** Explanation */
  explanation?: string;
}

/**
 * Load problem set from markdown
 */
export function loadProblemSet(markdown: string, setId: string): ProblemSet {
  const parsed = parseMarkdown(markdown);

  const title = parsed.title || 'Untitled Problem Set';
  const category = (parsed.metadata['category'] as string) || 'general';
  const description = parsed.metadata['description'] as string | undefined;
  const prerequisites = (parsed.metadata['prerequisites'] as string[]) || [];
  const learningObjectives = (parsed.metadata['learningObjectives'] as string[]) || [];

  const problems = extractProblems(parsed);

  const difficulties = problems.map(p => p.difficulty);
  const difficultyRange: [number, number] = [
    Math.min(...difficulties),
    Math.max(...difficulties),
  ];

  return {
    id: setId,
    title,
    ...(description && { description }),
    category,
    difficultyRange,
    problems,
    metadata: parsed.metadata,
    prerequisites,
    learningObjectives,
  };
}

/**
 * Extract problems from parsed markdown
 */
function extractProblems(doc: ParsedMarkdown): Problem[] {
  const problems: Problem[] = [];
  let problemNumber = 1;

  for (const section of doc.sections) {
    // Look for problem sections (e.g., "Problem 1", "Question 3")
    const problemMatch = section.heading.match(/^(?:Problem|Question)\s+(\d+)/i);

    if (problemMatch) {
      const problem = parseProblemSection(section, problemNumber++);
      if (problem) {
        problems.push(problem);
      }
    }
  }

  return problems;
}

/**
 * Parse a problem section
 */
function parseProblemSection(section: MarkdownSection, number: number): Problem | null {
  const content = section.content;

  // Extract statement (first paragraph)
  const statementMatch = content.match(/^([\s\S]+?)(?:\n\n|\n##)/);
  const statement = statementMatch?.[1]?.trim() ?? content;

  // Extract difficulty from tags or metadata
  const difficultyMatch = content.match(/Difficulty:\s*(\d)/i);
  const difficulty = difficultyMatch?.[1] ? parseInt(difficultyMatch[1]!, 10) : 3;

  // Extract tags
  const tagsMatch = content.match(/Tags:\s*\[([^\]]+)\]/i);
  const tags = tagsMatch?.[1]
    ? tagsMatch[1].split(',').map((t: string) => t.trim())
    : [];

  // Extract hints
  const hints = extractListItems(content, 'Hints?');

  // Extract solution
  const solution = extractSolution(section);

  return {
    id: `problem-${number}`,
    number,
    statement,
    difficulty: Math.min(5, Math.max(1, difficulty)) as 1 | 2 | 3 | 4 | 5,
    solution: solution || undefined,
    hints,
    tags,
  };
}

/**
 * Extract solution from subsections
 */
function extractSolution(section: MarkdownSection): ProblemSolution | undefined {
  const solutionSection = section.subsections.find((s: MarkdownSection) =>
    s.heading.match(/^Solution/i)
  );

  if (!solutionSection) return undefined;

  const content = solutionSection.content;

  // Extract answer
  const answerMatch = content.match(/Answer:\s*\$?\$?([^\$\n]+)\$?\$?/i);
  const answer = answerMatch?.[1]?.trim() ?? '';

  // Extract steps
  const steps = extractListItems(content, 'Steps?');

  // Extract explanation
  const explanationMatch = content.match(/Explanation:([\s\S]+?)(?:\n\n|\n##|$)/i);
  const explanation = explanationMatch?.[1]?.trim();

  return {
    answer,
    steps: steps.length > 0 ? steps : [],
    explanation: explanation || '',
  };
}

/**
 * Extract list items under a heading
 */
function extractListItems(content: string, headingPattern: string): string[] {
  const regex = new RegExp(`${headingPattern}:?\\s*\\n((?:[-*]\\s+.+\\n?)+)`, 'i');
  const match = content.match(regex);

  if (!match) return [];

  const listText = match[1];
  if (!listText) return [];

  const items: string[] = [];

  for (const line of listText.split('\n')) {
    const itemMatch = line.match(/^[-*]\s+(.+)$/);
    if (itemMatch && itemMatch[1]) {
      items.push(itemMatch[1].trim());
    }
  }

  return items;
}

/**
 * Load multiple problem sets from directory
 */
export function loadProblemSetsFromFiles(files: Record<string, string>): ProblemSet[] {
  const sets: ProblemSet[] = [];

  for (const [filename, content] of Object.entries(files)) {
    const setId = filename.replace(/\.md$/, '');
    try {
      const set = loadProblemSet(content, setId);
      sets.push(set);
    } catch (error) {
      console.error(`Error loading problem set ${filename}:`, error);
    }
  }

  return sets;
}

/**
 * Create problem set index
 */
export function createProblemSetIndex(sets: ProblemSet[]): ProblemSetIndex {
  const byCategory = new Map<string, ProblemSet[]>();
  const byDifficulty = new Map<number, ProblemSet[]>();
  const byTag = new Map<string, Problem[]>();

  for (const set of sets) {
    // Index by category
    if (!byCategory.has(set.category)) {
      byCategory.set(set.category, []);
    }
    byCategory.get(set.category)!.push(set);

    // Index by difficulty
    const avgDifficulty = Math.round(
      (set.difficultyRange[0] + set.difficultyRange[1]) / 2
    );
    if (!byDifficulty.has(avgDifficulty)) {
      byDifficulty.set(avgDifficulty, []);
    }
    byDifficulty.get(avgDifficulty)!.push(set);

    // Index problems by tag
    for (const problem of set.problems) {
      for (const tag of problem.tags) {
        if (!byTag.has(tag)) {
          byTag.set(tag, []);
        }
        byTag.get(tag)!.push(problem);
      }
    }
  }

  return {
    sets,
    byCategory,
    byDifficulty,
    byTag,
  };
}

/**
 * Problem set index
 */
export interface ProblemSetIndex {
  sets: ProblemSet[];
  byCategory: Map<string, ProblemSet[]>;
  byDifficulty: Map<number, ProblemSet[]>;
  byTag: Map<string, Problem[]>;
}
