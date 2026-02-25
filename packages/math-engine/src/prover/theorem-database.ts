/**
 * Theorem Database - Storage and Management of Proven Theorems
 *
 * Provides:
 * - Storage of proven theorems with metadata
 * - Theorem indexing and retrieval
 * - Dependency tracking between theorems
 * - Proof verification and validation
 * - Export to LaTeX format
 */

import type { Formula } from './logic-core.js';
import { toString } from './logic-core.js';
import type { Proof } from './proof-search.js';
import { verifyProof } from './proof-search.js';

/**
 * Stored theorem with proof and metadata
 */
export interface Theorem {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category (e.g., 'propositional', 'predicate', 'arithmetic') */
  category: string;
  /** Statement of the theorem */
  statement: Formula;
  /** Formal proof */
  proof: Proof;
  /** Tags for searching */
  tags: string[];
  /** Dependencies (other theorem IDs used in proof) */
  dependencies: string[];
  /** When the theorem was added */
  timestamp: Date;
  /** Description in natural language */
  description?: string | undefined;
  /** LaTeX representation */
  latex?: string | undefined;
}

/**
 * Theorem database
 */
export class TheoremDatabase {
  private theorems = new Map<string, Theorem>();
  private index = new Map<string, Set<string>>();
  private categoryIndex = new Map<string, Set<string>>();

  /**
 * Add a theorem to the database
   */
  add(theorem: Theorem): void {
    // Verify proof before adding
    const verification = verifyProof(theorem.proof);
    if (!verification.valid) {
      throw new Error(`Invalid proof: ${verification.errors.join(', ')}`);
    }

    // Check if ID is unique
    if (this.theorems.has(theorem.id)) {
      throw new Error(`Theorem with ID ${theorem.id} already exists`);
    }

    // Store theorem
    this.theorems.set(theorem.id, theorem);

    // Update indices
    this.updateIndices(theorem);
  }

  /**
   * Get theorem by ID
   */
  get(id: string): Theorem | undefined {
    return this.theorems.get(id);
  }

  /**
   * Find theorems by tag
   */
  findByTag(tag: string): Theorem[] {
    const ids = this.index.get(tag) || new Set();
    return Array.from(ids)
      .map(id => this.theorems.get(id))
      .filter((t): t is Theorem => t !== undefined);
  }

  /**
   * Find theorems by category
   */
  findByCategory(category: string): Theorem[] {
    const ids = this.categoryIndex.get(category) || new Set();
    return Array.from(ids)
      .map(id => this.theorems.get(id))
      .filter((t): t is Theorem => t !== undefined);
  }

  /**
   * Search theorems by name or description
   */
  search(query: string): Theorem[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.theorems.values()).filter(
      theorem =>
        theorem.name.toLowerCase().includes(lowerQuery) ||
        theorem.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get all theorems
   */
  getAll(): Theorem[] {
    return Array.from(this.theorems.values());
  }

  /**
   * Get dependency graph for a theorem
   */
  getDependencies(id: string, visited = new Set<string>()): Set<string> {
    if (visited.has(id)) {
      return visited;
    }

    visited.add(id);
    const theorem = this.theorems.get(id);

    if (theorem) {
      for (const depId of theorem.dependencies) {
        this.getDependencies(depId, visited);
      }
    }

    return visited;
  }

  /**
   * Get theorems that depend on a given theorem
   */
  getDependents(id: string): Theorem[] {
    return Array.from(this.theorems.values()).filter(theorem =>
      theorem.dependencies.includes(id)
    );
  }

  /**
   * Export theorem to LaTeX
   */
  toLatex(id: string): string {
    const theorem = this.theorems.get(id);
    if (!theorem) {
      throw new Error(`Theorem ${id} not found`);
    }

    let latex = '\\begin{theorem}';
    if (theorem.name) {
      latex += `[${theorem.name}]`;
    }
    latex += '\n';

    if (theorem.latex) {
      latex += theorem.latex;
    } else {
      latex += `$${toString(theorem.statement, true)}$`;
    }

    latex += '\n\\end{theorem}\n\n';

    // Add proof
    latex += '\\begin{proof}\n';

    for (let i = 0; i < theorem.proof.steps.length; i++) {
      const step = theorem.proof.steps[i];
      if (step) {
        latex += `\\item ${step.justification}: $${toString(step.formula, true)}$\n`;
      }
    }

    latex += '\\end{proof}';

    return latex;
  }

  /**
   * Export all theorems to LaTeX document
   */
  exportAllToLatex(): string {
    let latex = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amsthm}

\\newtheorem{theorem}{Theorem}

\\begin{document}

\\title{Theorem Database}
\\maketitle

`;

    // Group by category
    const categories = new Map<string, Theorem[]>();
    for (const theorem of Array.from(this.theorems.values())) {
      if (!categories.has(theorem.category)) {
        categories.set(theorem.category, []);
      }
      categories.get(theorem.category)!.push(theorem);
    }

    for (const [category, theorems] of Array.from(categories)) {
      latex += `\\section{${category}}\n\n`;
      for (const theorem of theorems) {
        latex += this.toLatex(theorem.id);
        latex += '\n\n';
      }
    }

    latex += '\\end{document}';

    return latex;
  }

  /**
   * Validate database integrity
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const theorem of Array.from(this.theorems.values())) {
      // Check dependencies exist
      for (const depId of theorem.dependencies) {
        if (!this.theorems.has(depId)) {
          errors.push(`Theorem ${theorem.id} depends on missing theorem ${depId}`);
        }
      }

      // Check for circular dependencies
      const deps = this.getDependencies(theorem.id);
      deps.delete(theorem.id);
      if (deps.has(theorem.id)) {
        errors.push(`Circular dependency detected for theorem ${theorem.id}`);
      }

      // Re-verify proof
      const verification = verifyProof(theorem.proof);
      if (!verification.valid) {
        errors.push(`Theorem ${theorem.id} has invalid proof: ${verification.errors.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export database to JSON
   */
  toJSON(): string {
    const data = Array.from(this.theorems.values()).map(theorem => ({
      ...theorem,
      timestamp: theorem.timestamp.toISOString(),
    }));

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import database from JSON
   */
  fromJSON(json: string): void {
    const data = JSON.parse(json);

    for (const item of data) {
      const theorem: Theorem = {
        ...item,
        timestamp: new Date(item.timestamp),
      };

      this.theorems.set(theorem.id, theorem);
      this.updateIndices(theorem);
    }
  }

  /**
   * Update search indices
   */
  private updateIndices(theorem: Theorem): void {
    // Tag index
    for (const tag of theorem.tags) {
      if (!this.index.has(tag)) {
        this.index.set(tag, new Set());
      }
      this.index.get(tag)!.add(theorem.id);
    }

    // Category index
    if (!this.categoryIndex.has(theorem.category)) {
      this.categoryIndex.set(theorem.category, new Set());
    }
    this.categoryIndex.get(theorem.category)!.add(theorem.id);
  }

  /**
   * Clear database
   */
  clear(): void {
    this.theorems.clear();
    this.index.clear();
    this.categoryIndex.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTheorems: number;
    categories: Map<string, number>;
    tags: Map<string, number>;
  } {
    const categories = new Map<string, number>();
    const tags = new Map<string, number>();

    for (const theorem of Array.from(this.theorems.values())) {
      categories.set(theorem.category, (categories.get(theorem.category) || 0) + 1);

      for (const tag of theorem.tags) {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      }
    }

    return {
      totalTheorems: this.theorems.size,
      categories,
      tags,
    };
  }
}

/**
 * Create a theorem from formula and proof
 */
export function createTheorem(
  id: string,
  name: string,
  category: string,
  statement: Formula,
  proof: Proof,
  options: {
    tags?: string[];
    description?: string;
    latex?: string;
  } = {}
): Theorem {
  // Extract dependencies from proof (simplified)
  const dependencies: string[] = [];

  return {
    id,
    name,
    category,
    statement,
    proof,
    tags: options.tags || [],
    dependencies,
    timestamp: new Date(),
    description: options.description,
    latex: options.latex,
  };
}

/**
 * Global theorem database instance
 */
export const theoremDB = new TheoremDatabase();

/**
 * Standard theorems (propositional logic)
 */
export function loadStandardTheorems(): void {
  // This would be populated with standard logical theorems
  // Examples: Law of excluded middle, De Morgan's laws, etc.
}
