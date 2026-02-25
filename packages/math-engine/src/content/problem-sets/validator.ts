/**
 * Problem Set Validator - Validate Problem Structure and Content
 *
 * Validates:
 * - Problem syntax
 * - Solution correctness
 * - Difficulty levels
 * - Metadata completeness
 */

import type { ProblemSet, Problem } from './loader.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  type: 'error';
  message: string;
  location?: string;
  problemId?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  type: 'warning';
  message: string;
  location?: string;
  problemId?: string;
}

/**
 * Validate a problem set
 */
export function validateProblemSet(set: ProblemSet): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate metadata
  if (!set.title || set.title.trim() === '') {
    errors.push({
      type: 'error',
      message: 'Problem set must have a title',
    });
  }

  if (!set.category || set.category.trim() === '') {
    errors.push({
      type: 'error',
      message: 'Problem set must have a category',
    });
  }

  // Validate problems
  if (set.problems.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'Problem set contains no problems',
    });
  }

  for (const problem of set.problems) {
    const problemErrors = validateProblem(problem);
    errors.push(...problemErrors.errors);
    warnings.push(...problemErrors.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a single problem
 */
export function validateProblem(problem: Problem): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate statement
  if (!problem.statement || problem.statement.trim() === '') {
    errors.push({
      type: 'error',
      message: 'Problem must have a statement',
      problemId: problem.id,
    });
  }

  // Validate difficulty
  if (problem.difficulty < 1 || problem.difficulty > 5) {
    errors.push({
      type: 'error',
      message: `Invalid difficulty level: ${problem.difficulty} (must be 1-5)`,
      problemId: problem.id,
    });
  }

  // Check for solution
  if (!problem.solution) {
    warnings.push({
      type: 'warning',
      message: 'Problem has no solution provided',
      problemId: problem.id,
    });
  } else {
    // Validate solution
    if (!problem.solution.answer || problem.solution.answer.trim() === '') {
      errors.push({
        type: 'error',
        message: 'Solution must have an answer',
        problemId: problem.id,
      });
    }

    if (!problem.solution.steps && !problem.solution.explanation) {
      warnings.push({
        type: 'warning',
        message: 'Solution should have steps or explanation',
        problemId: problem.id,
      });
    }
  }

  // Check for hints
  if (problem.hints.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'Problem has no hints',
      problemId: problem.id,
    });
  }

  // Check for tags
  if (problem.tags.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'Problem has no tags',
      problemId: problem.id,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate LaTeX in problem statement
 */
export function validateLatex(latex: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check for unmatched delimiters
  const dollarCount = (latex.match(/\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
    errors.push({
      type: 'error',
      message: 'Unmatched $ delimiters in LaTeX',
    });
  }

  // Check for common mistakes
  if (latex.includes('\\frac{}')) {
    errors.push({
      type: 'error',
      message: 'Empty \\frac command',
    });
  }

  if (latex.includes('\\sqrt{}')) {
    warnings.push({
      type: 'warning',
      message: 'Empty \\sqrt command',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation report
 */
export function formatValidationReport(result: ValidationResult): string {
  let report = '';

  if (result.valid) {
    report += '✓ Validation passed\n\n';
  } else {
    report += '✗ Validation failed\n\n';
  }

  if (result.errors.length > 0) {
    report += 'Errors:\n';
    for (const error of result.errors) {
      report += `  - ${error.message}`;
      if (error.problemId) {
        report += ` (${error.problemId})`;
      }
      report += '\n';
    }
    report += '\n';
  }

  if (result.warnings.length > 0) {
    report += 'Warnings:\n';
    for (const warning of result.warnings) {
      report += `  - ${warning.message}`;
      if (warning.problemId) {
        report += ` (${warning.problemId})`;
      }
      report += '\n';
    }
  }

  return report;
}
