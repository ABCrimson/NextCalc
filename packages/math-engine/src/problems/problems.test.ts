/**
 * Tests for problem generation and database
 */

import { describe, expect, it } from 'vitest';
import { MathTopic } from '../knowledge/definitions';
import {
  getAllProblems,
  getProblem,
  getProblemById,
  getProblemsByDifficulty,
  getProblemsByTopic,
  getRelatedProblems,
  PROBLEMS,
  searchProblems,
} from './problem-database';
import { DifficultyLevel, ProblemType } from './types';

// ============================================================================
// DATABASE INTEGRITY
// ============================================================================

describe('PROBLEMS database', () => {
  it('contains a non-empty array of problems', () => {
    expect(PROBLEMS.length).toBeGreaterThan(0);
  });

  it('each problem has required fields', () => {
    for (const p of PROBLEMS) {
      expect(p.id).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.topic).toBeTruthy();
      expect(typeof p.difficulty).toBe('number');
      expect(p.type).toBeTruthy();
      expect(p.statement).toBeTruthy();
      expect(p.solution).toBeDefined();
      expect(Array.isArray(p.hints)).toBe(true);
      expect(Array.isArray(p.prerequisites)).toBe(true);
      expect(Array.isArray(p.related)).toBe(true);
      expect(Array.isArray(p.tags)).toBe(true);
      expect(p.estimatedTime).toBeGreaterThan(0);
      expect(p.points).toBeGreaterThan(0);
    }
  });

  it('all problem IDs are unique', () => {
    const ids = PROBLEMS.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('difficulty is within valid range (1-5)', () => {
    for (const p of PROBLEMS) {
      expect(p.difficulty).toBeGreaterThanOrEqual(1);
      expect(p.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it('each solution has an answer', () => {
    for (const p of PROBLEMS) {
      expect(p.solution.answer !== undefined && p.solution.answer !== null).toBe(true);
      expect(p.solution.explanation).toBeTruthy();
      expect(Array.isArray(p.solution.steps)).toBe(true);
      expect(p.solution.steps.length).toBeGreaterThan(0);
      expect(Array.isArray(p.solution.insights)).toBe(true);
    }
  });

  it('hints have required fields', () => {
    for (const p of PROBLEMS) {
      for (const h of p.hints) {
        expect(h.order).toBeGreaterThan(0);
        expect(h.text).toBeTruthy();
        expect(['approach', 'technique', 'formula', 'partial-solution']).toContain(h.reveals);
        expect(h.cost).toBeGreaterThan(0);
      }
    }
  });

  it('solution steps are correctly numbered', () => {
    for (const p of PROBLEMS) {
      for (let i = 0; i < p.solution.steps.length; i++) {
        const step = p.solution.steps[i]!;
        expect(step.stepNumber).toBe(i + 1);
        expect(step.description).toBeTruthy();
      }
    }
  });
});

// ============================================================================
// getProblem / getProblemById
// ============================================================================

describe('getProblem', () => {
  it('returns a known problem by ID', () => {
    const p = getProblem('calc-deriv-001');
    expect(p).toBeDefined();
    expect(p!.title).toBe('Basic Derivative');
    expect(p!.topic).toBe(MathTopic.Calculus);
    expect(p!.difficulty).toBe(DifficultyLevel.Beginner);
  });

  it('returns undefined for unknown ID', () => {
    expect(getProblem('not-a-real-id')).toBeUndefined();
  });

  it('returns the quadratic problem', () => {
    const p = getProblem('alg-quad-001');
    expect(p).toBeDefined();
    expect(p!.topic).toBe(MathTopic.Algebra);
  });

  it('returns a problem with an array answer', () => {
    const p = getProblem('alg-quad-001');
    expect(Array.isArray(p!.solution.answer)).toBe(true);
    const ans = p!.solution.answer as number[];
    expect(ans).toContain(2);
    expect(ans).toContain(3);
  });
});

describe('getProblemById', () => {
  it('is an alias for getProblem and returns the same result', () => {
    const p1 = getProblem('calc-deriv-001');
    const p2 = getProblemById('calc-deriv-001');
    expect(p1).toStrictEqual(p2);
  });

  it('returns undefined for unknown ID', () => {
    expect(getProblemById('unknown')).toBeUndefined();
  });
});

// ============================================================================
// getProblemsByTopic
// ============================================================================

describe('getProblemsByTopic', () => {
  it('returns only Calculus problems', () => {
    const results = getProblemsByTopic(MathTopic.Calculus);
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.topic).toBe(MathTopic.Calculus);
    }
  });

  it('returns only Algebra problems', () => {
    const results = getProblemsByTopic(MathTopic.Algebra);
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.topic).toBe(MathTopic.Algebra);
    }
  });

  it('returns only Geometry problems', () => {
    const results = getProblemsByTopic(MathTopic.Geometry);
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.topic).toBe(MathTopic.Geometry);
    }
  });

  it('returns only NumberTheory problems', () => {
    const results = getProblemsByTopic(MathTopic.NumberTheory);
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.topic).toBe(MathTopic.NumberTheory);
    }
  });

  it('returns empty array for a topic with no problems', () => {
    const results = getProblemsByTopic(MathTopic.Topology);
    expect(results).toEqual([]);
  });

  it('total across all used topics equals total problems', () => {
    const usedTopics = [...new Set(PROBLEMS.map((p) => p.topic))];
    let total = 0;
    for (const topic of usedTopics) {
      total += getProblemsByTopic(topic).length;
    }
    expect(total).toBe(PROBLEMS.length);
  });
});

// ============================================================================
// getProblemsByDifficulty
// ============================================================================

describe('getProblemsByDifficulty', () => {
  it('returns only Beginner problems', () => {
    const results = getProblemsByDifficulty(DifficultyLevel.Beginner);
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.difficulty).toBe(DifficultyLevel.Beginner);
    }
  });

  it('returns only Intermediate problems', () => {
    const results = getProblemsByDifficulty(DifficultyLevel.Intermediate);
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.difficulty).toBe(DifficultyLevel.Intermediate);
    }
  });

  it('returns only Advanced problems', () => {
    const results = getProblemsByDifficulty(DifficultyLevel.Advanced);
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.difficulty).toBe(DifficultyLevel.Advanced);
    }
  });

  it('returns empty array for Expert difficulty if none exist', () => {
    const results = getProblemsByDifficulty(DifficultyLevel.Expert);
    for (const p of results) {
      expect(p.difficulty).toBe(DifficultyLevel.Expert);
    }
  });

  it('total across all difficulty levels equals total problems', () => {
    const levels = Object.values(DifficultyLevel).filter(
      (v) => typeof v === 'number',
    ) as DifficultyLevel[];
    let total = 0;
    for (const level of levels) {
      total += getProblemsByDifficulty(level).length;
    }
    expect(total).toBe(PROBLEMS.length);
  });
});

// ============================================================================
// searchProblems
// ============================================================================

describe('searchProblems', () => {
  it('finds problems by title keyword', () => {
    const results = searchProblems('derivative');
    expect(results.length).toBeGreaterThan(0);
    const hasDeriv = results.some((p) => p.title.toLowerCase().includes('derivative'));
    expect(hasDeriv).toBe(true);
  });

  it('finds problems by statement keyword', () => {
    const results = searchProblems('quadratic');
    expect(results.length).toBeGreaterThan(0);
  });

  it('finds problems by tag', () => {
    const results = searchProblems('power-rule');
    expect(results.length).toBeGreaterThan(0);
  });

  it('is case-insensitive for title', () => {
    const lower = searchProblems('limit');
    const upper = searchProblems('LIMIT');
    expect(lower.length).toBe(upper.length);
  });

  it('returns empty for unknown search term', () => {
    const results = searchProblems('zxqwerty123notexist');
    expect(results).toEqual([]);
  });

  it('empty string returns all problems', () => {
    const results = searchProblems('');
    expect(results.length).toBe(PROBLEMS.length);
  });
});

// ============================================================================
// getAllProblems
// ============================================================================

describe('getAllProblems', () => {
  it('returns all problems', () => {
    const all = getAllProblems();
    expect(all.length).toBe(PROBLEMS.length);
  });

  it('returns the same reference as PROBLEMS', () => {
    expect(getAllProblems()).toEqual(PROBLEMS);
  });
});

// ============================================================================
// getRelatedProblems
// ============================================================================

describe('getRelatedProblems', () => {
  it('returns related problems for calc-deriv-001', () => {
    const related = getRelatedProblems('calc-deriv-001');
    expect(related.length).toBeGreaterThan(0);
    // Should not contain the problem itself
    const ids = related.map((p) => p.id);
    expect(ids).not.toContain('calc-deriv-001');
  });

  it('returns problem objects (not just IDs)', () => {
    const related = getRelatedProblems('calc-deriv-001');
    for (const p of related) {
      expect(p.id).toBeTruthy();
      expect(p.title).toBeTruthy();
    }
  });

  it('returns empty array for unknown ID', () => {
    const related = getRelatedProblems('no-such-id');
    expect(related).toEqual([]);
  });

  it('related IDs match actual problems in database', () => {
    const related = getRelatedProblems('alg-quad-001');
    for (const p of related) {
      const found = getProblem(p.id);
      expect(found).toBeDefined();
    }
  });
});

// ============================================================================
// SPECIFIC PROBLEM CONTENT
// ============================================================================

describe('calc-deriv-001 content', () => {
  it('has the correct number of solution steps', () => {
    const p = getProblem('calc-deriv-001')!;
    expect(p.solution.steps.length).toBe(4);
  });

  it('has the correct answer', () => {
    const p = getProblem('calc-deriv-001')!;
    expect(p.solution.answer).toBe('2x + 3');
  });

  it('has three hints', () => {
    const p = getProblem('calc-deriv-001')!;
    expect(p.hints.length).toBe(3);
  });

  it('hints are ordered 1, 2, 3', () => {
    const p = getProblem('calc-deriv-001')!;
    expect(p.hints[0]!.order).toBe(1);
    expect(p.hints[1]!.order).toBe(2);
    expect(p.hints[2]!.order).toBe(3);
  });
});

describe('numth-prime-001 content', () => {
  it('has prime factorization answer', () => {
    const p = getProblem('numth-prime-001')!;
    expect(p.solution.answer).toBe('2³ × 3² × 7');
  });

  it('is at Advanced difficulty', () => {
    const p = getProblem('numth-prime-001')!;
    expect(p.difficulty).toBe(DifficultyLevel.Advanced);
  });
});

describe('geom-triangle-001 content', () => {
  it('has Pythagorean theorem problem', () => {
    const p = getProblem('geom-triangle-001')!;
    expect(p.topic).toBe(MathTopic.Geometry);
    expect(p.solution.answer).toBe('5');
    expect(p.difficulty).toBe(DifficultyLevel.Beginner);
  });
});

describe('ProblemType enum', () => {
  it('has all expected types', () => {
    expect(ProblemType.Computation).toBe('Computation');
    expect(ProblemType.Proof).toBe('Proof');
    expect(ProblemType.Application).toBe('Application');
    expect(ProblemType.Conceptual).toBe('Conceptual');
    expect(ProblemType.MultiStep).toBe('Multi-Step');
  });
});

describe('DifficultyLevel enum', () => {
  it('has correct numeric values', () => {
    expect(DifficultyLevel.Beginner).toBe(1);
    expect(DifficultyLevel.Intermediate).toBe(2);
    expect(DifficultyLevel.Advanced).toBe(3);
    expect(DifficultyLevel.Expert).toBe(4);
    expect(DifficultyLevel.Research).toBe(5);
  });
});
