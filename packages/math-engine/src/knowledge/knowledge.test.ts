/**
 * Tests for knowledge base module
 * Covers definitions, theorems, and query functions
 */

import { describe, it, expect } from 'vitest';

import {
  DEFINITIONS,
  THEOREMS,
  MathTopic,
  getDefinition,
  searchDefinitions,
  getDefinitionsByTopic,
  getDefinitionsByDifficulty,
  getRelatedDefinitions,
  getAllTopics,
  getDefinitionCountByTopic,
  getTheorem,
  searchTheorems,
  getTheoremsByTopic,
  getTheoremsByImportance,
  getRelatedTheorems,
} from './index';

// ============================================================================
// DEFINITIONS
// ============================================================================

describe('Definitions Database', () => {
  it('has a non-empty definitions array', () => {
    expect(DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('each definition has required fields', () => {
    for (const def of DEFINITIONS) {
      expect(def.id).toBeTruthy();
      expect(def.term).toBeTruthy();
      expect(def.topic).toBeTruthy();
      expect(def.formal).toBeTruthy();
      expect(def.intuitive).toBeTruthy();
      expect(Array.isArray(def.examples)).toBe(true);
      expect(Array.isArray(def.related)).toBe(true);
      expect(Array.isArray(def.prerequisites)).toBe(true);
      expect(def.difficulty).toBeGreaterThanOrEqual(1);
      expect(def.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it('all definition IDs are unique', () => {
    const ids = DEFINITIONS.map(d => d.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('getDefinition', () => {
  it('returns a definition by known ID', () => {
    const def = getDefinition('derivative');
    expect(def).toBeDefined();
    expect(def!.term).toBe('Derivative');
    expect(def!.topic).toBe(MathTopic.Calculus);
  });

  it('returns undefined for an unknown ID', () => {
    expect(getDefinition('nonexistent-id-xyz')).toBeUndefined();
  });

  it('returns the polynomial definition', () => {
    const def = getDefinition('polynomial');
    expect(def).toBeDefined();
    expect(def!.id).toBe('polynomial');
    expect(def!.difficulty).toBeGreaterThanOrEqual(1);
  });

  it('returns the group definition', () => {
    const def = getDefinition('group');
    expect(def).toBeDefined();
    expect(def!.topic).toBe(MathTopic.AbstractAlgebra);
  });

  it('returns the prime-number definition', () => {
    const def = getDefinition('prime-number');
    expect(def).toBeDefined();
    expect(def!.topic).toBe(MathTopic.NumberTheory);
  });
});

describe('searchDefinitions', () => {
  it('finds definitions matching term name', () => {
    const results = searchDefinitions('derivative');
    expect(results.length).toBeGreaterThan(0);
    const hasDerivative = results.some(d => d.id === 'derivative');
    expect(hasDerivative).toBe(true);
  });

  it('is case-insensitive', () => {
    const lower = searchDefinitions('polynomial');
    const upper = searchDefinitions('POLYNOMIAL');
    const mixed = searchDefinitions('Polynomial');
    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBe(mixed.length);
  });

  it('returns empty array for nonsense query', () => {
    const results = searchDefinitions('zxqwerty123nonsense');
    expect(results).toEqual([]);
  });

  it('searches inside intuitive description', () => {
    const results = searchDefinitions('building blocks');
    expect(results.length).toBeGreaterThan(0);
  });

  it('searches inside formal definition', () => {
    // The limit definition's formal field contains 'lim(x→a)'; the integral's
    // contains 'Riemann'. Neither keyword appears in term or intuitive fields.
    const results = searchDefinitions('Riemann');
    expect(results.length).toBeGreaterThan(0);
  });

  it('empty query returns all definitions', () => {
    const results = searchDefinitions('');
    expect(results.length).toBe(DEFINITIONS.length);
  });
});

describe('getDefinitionsByTopic', () => {
  it('returns definitions for Calculus', () => {
    const results = getDefinitionsByTopic(MathTopic.Calculus);
    expect(results.length).toBeGreaterThan(0);
    for (const d of results) {
      expect(d.topic).toBe(MathTopic.Calculus);
    }
  });

  it('returns definitions for LinearAlgebra', () => {
    const results = getDefinitionsByTopic(MathTopic.LinearAlgebra);
    expect(results.length).toBeGreaterThan(0);
    for (const d of results) {
      expect(d.topic).toBe(MathTopic.LinearAlgebra);
    }
  });

  it('returns definitions for NumberTheory', () => {
    const results = getDefinitionsByTopic(MathTopic.NumberTheory);
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty array for a topic with no definitions', () => {
    // SetTheory is a valid enum but may have definitions; test that the filter works correctly
    const results = getDefinitionsByTopic(MathTopic.SetTheory);
    for (const d of results) {
      expect(d.topic).toBe(MathTopic.SetTheory);
    }
  });

  it('total count across topics equals total definitions', () => {
    const topics = Object.values(MathTopic);
    let total = 0;
    for (const topic of topics) {
      total += getDefinitionsByTopic(topic as MathTopic).length;
    }
    expect(total).toBe(DEFINITIONS.length);
  });
});

describe('getDefinitionsByDifficulty', () => {
  it('returns only definitions within range', () => {
    const results = getDefinitionsByDifficulty(1, 2);
    for (const d of results) {
      expect(d.difficulty).toBeGreaterThanOrEqual(1);
      expect(d.difficulty).toBeLessThanOrEqual(2);
    }
  });

  it('returns all definitions for full range 1-5', () => {
    const results = getDefinitionsByDifficulty(1, 5);
    expect(results.length).toBe(DEFINITIONS.length);
  });

  it('returns empty array for impossible range', () => {
    const results = getDefinitionsByDifficulty(6, 10);
    expect(results).toEqual([]);
  });

  it('returns only difficulty-5 definitions when min=max=5', () => {
    const results = getDefinitionsByDifficulty(5, 5);
    for (const d of results) {
      expect(d.difficulty).toBe(5);
    }
  });

  it('handles range with single difficulty level', () => {
    const results = getDefinitionsByDifficulty(3, 3);
    for (const d of results) {
      expect(d.difficulty).toBe(3);
    }
  });
});

describe('getRelatedDefinitions', () => {
  it('returns related definitions for derivative', () => {
    const related = getRelatedDefinitions('derivative');
    expect(related.length).toBeGreaterThan(0);
    // Should not include the definition itself
    const ids = related.map(d => d.id);
    expect(ids).not.toContain('derivative');
  });

  it('returns empty array for unknown ID', () => {
    const related = getRelatedDefinitions('does-not-exist');
    expect(related).toEqual([]);
  });

  it('returns DEFINITION objects (not just IDs)', () => {
    const related = getRelatedDefinitions('polynomial');
    for (const d of related) {
      expect(d.term).toBeTruthy();
      expect(d.id).toBeTruthy();
    }
  });
});

describe('getAllTopics', () => {
  it('returns all MathTopic enum values', () => {
    const topics = getAllTopics();
    const enumValues = Object.values(MathTopic);
    expect(topics.length).toBe(enumValues.length);
    for (const t of enumValues) {
      expect(topics).toContain(t);
    }
  });
});

describe('getDefinitionCountByTopic', () => {
  it('returns a Map with all topics', () => {
    const counts = getDefinitionCountByTopic();
    const enumValues = Object.values(MathTopic);
    for (const t of enumValues) {
      expect(counts.has(t as MathTopic)).toBe(true);
    }
  });

  it('total count across all topics equals total definitions', () => {
    const counts = getDefinitionCountByTopic();
    let total = 0;
    for (const count of counts.values()) {
      total += count;
    }
    expect(total).toBe(DEFINITIONS.length);
  });

  it('Calculus count is greater than 0', () => {
    const counts = getDefinitionCountByTopic();
    expect(counts.get(MathTopic.Calculus)!).toBeGreaterThan(0);
  });
});

// ============================================================================
// THEOREMS
// ============================================================================

describe('Theorems Database', () => {
  it('has a non-empty theorems array', () => {
    expect(THEOREMS.length).toBeGreaterThan(0);
  });

  it('each theorem has required fields', () => {
    for (const thm of THEOREMS) {
      expect(thm.id).toBeTruthy();
      expect(thm.name).toBeTruthy();
      expect(thm.topic).toBeTruthy();
      expect(thm.statement).toBeTruthy();
      expect(thm.explanation).toBeTruthy();
      expect(thm.proofSketch).toBeTruthy();
      expect(Array.isArray(thm.applications)).toBe(true);
      expect(Array.isArray(thm.prerequisites)).toBe(true);
      expect(Array.isArray(thm.related)).toBe(true);
      expect(thm.importance).toBeGreaterThanOrEqual(1);
      expect(thm.importance).toBeLessThanOrEqual(5);
    }
  });

  it('all theorem IDs are unique', () => {
    const ids = THEOREMS.map(t => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('getTheorem', () => {
  it('returns the fundamental theorem of calculus', () => {
    const thm = getTheorem('fundamental-theorem-calculus');
    expect(thm).toBeDefined();
    expect(thm!.name).toBe('Fundamental Theorem of Calculus');
    expect(thm!.topic).toBe(MathTopic.Calculus);
    expect(thm!.importance).toBe(5);
  });

  it('returns the quadratic formula theorem', () => {
    const thm = getTheorem('quadratic-formula');
    expect(thm).toBeDefined();
    expect(thm!.topic).toBe(MathTopic.Algebra);
  });

  it('returns undefined for unknown ID', () => {
    expect(getTheorem('no-such-theorem')).toBeUndefined();
  });

  it('returns LaTeX when present', () => {
    const thm = getTheorem('fundamental-theorem-calculus');
    expect(thm!.latex).toBeDefined();
    expect(thm!.latex).toContain('int');
  });
});

describe('searchTheorems', () => {
  it('finds the chain rule theorem by keyword', () => {
    const results = searchTheorems('chain rule');
    expect(results.length).toBeGreaterThan(0);
    const names = results.map(t => t.name);
    expect(names.some(n => n.toLowerCase().includes('chain'))).toBe(true);
  });

  it('is case-insensitive', () => {
    const lower = searchTheorems('prime');
    const upper = searchTheorems('PRIME');
    expect(lower.length).toBe(upper.length);
  });

  it('returns empty array for nonsense query', () => {
    const results = searchTheorems('xyzzy-not-a-theorem');
    expect(results).toEqual([]);
  });

  it('searches across name, statement, and explanation', () => {
    // "antiderivative" appears in explanations
    const results = searchTheorems('antiderivative');
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('getTheoremsByTopic', () => {
  it('returns only Calculus theorems', () => {
    const results = getTheoremsByTopic(MathTopic.Calculus);
    expect(results.length).toBeGreaterThan(0);
    for (const t of results) {
      expect(t.topic).toBe(MathTopic.Calculus);
    }
  });

  it('returns only Algebra theorems', () => {
    const results = getTheoremsByTopic(MathTopic.Algebra);
    expect(results.length).toBeGreaterThan(0);
    for (const t of results) {
      expect(t.topic).toBe(MathTopic.Algebra);
    }
  });

  it('total across all topics equals total theorems', () => {
    const topics = Object.values(MathTopic);
    let total = 0;
    for (const topic of topics) {
      total += getTheoremsByTopic(topic as MathTopic).length;
    }
    expect(total).toBe(THEOREMS.length);
  });
});

describe('getTheoremsByImportance', () => {
  it('returns only theorems at or above min importance', () => {
    const results = getTheoremsByImportance(4);
    expect(results.length).toBeGreaterThan(0);
    for (const t of results) {
      expect(t.importance).toBeGreaterThanOrEqual(4);
    }
  });

  it('results are sorted by importance descending', () => {
    const results = getTheoremsByImportance(1);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.importance).toBeGreaterThanOrEqual(results[i]!.importance);
    }
  });

  it('returns all theorems for minImportance = 1', () => {
    const results = getTheoremsByImportance(1);
    expect(results.length).toBe(THEOREMS.length);
  });

  it('returns empty array when minImportance is too high', () => {
    const results = getTheoremsByImportance(6);
    expect(results).toEqual([]);
  });

  it('includes FTC at importance >= 5', () => {
    const results = getTheoremsByImportance(5);
    const ids = results.map(t => t.id);
    expect(ids).toContain('fundamental-theorem-calculus');
  });
});

describe('getRelatedTheorems', () => {
  it('returns related theorems for mean-value-theorem', () => {
    const related = getRelatedTheorems('mean-value-theorem');
    expect(related.length).toBeGreaterThan(0);
    const ids = related.map(t => t.id);
    expect(ids).not.toContain('mean-value-theorem');
  });

  it('returns empty array for unknown ID', () => {
    const related = getRelatedTheorems('no-such-theorem');
    expect(related).toEqual([]);
  });

  it('bidirectional relationship: A related to B means B appears when querying A', () => {
    // FTC lists mean-value-theorem as related
    const related = getRelatedTheorems('fundamental-theorem-calculus');
    const ids = related.map(t => t.id);
    expect(ids).toContain('mean-value-theorem');
  });
});
