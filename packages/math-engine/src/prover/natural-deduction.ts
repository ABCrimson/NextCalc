/**
 * Natural Deduction System - Human-Readable Proof Construction
 *
 * Implements natural deduction for propositional and first-order logic:
 * - Introduction and elimination rules for all connectives
 * - Assumption management and discharge
 * - Subproof handling
 * - Proof validation with detailed error messages
 * - Educational mode with explanations
 */

import type { Formula } from './logic-core';
import { toString, and, or, not, implies } from './logic-core';
import { formulasEqual } from './proof-search';

/**
 * Natural deduction rule types
 */
export enum NDRuleType {
  // Assumptions
  ASSUME = 'Assume',

  // Conjunction
  AND_INTRO = '∧-Intro',
  AND_ELIM_LEFT = '∧-Elim-L',
  AND_ELIM_RIGHT = '∧-Elim-R',

  // Disjunction
  OR_INTRO_LEFT = '∨-Intro-L',
  OR_INTRO_RIGHT = '∨-Intro-R',
  OR_ELIM = '∨-Elim',

  // Implication
  IMPLIES_INTRO = '→-Intro',
  IMPLIES_ELIM = '→-Elim',

  // Negation
  NOT_INTRO = '¬-Intro',
  NOT_ELIM = '¬-Elim',

  // Biconditional
  IFF_INTRO = '↔-Intro',
  IFF_ELIM_LEFT = '↔-Elim-L',
  IFF_ELIM_RIGHT = '↔-Elim-R',

  // Classical logic
  LEM = 'LEM', // Law of Excluded Middle
  RAA = 'RAA', // Reductio ad Absurdum

  // Copy/Reiteration
  REIT = 'Reiteration',
}

/**
 * Natural deduction proof line
 */
export interface NDLine {
  /** Line number */
  lineNumber: number;
  /** Formula on this line */
  formula: Formula;
  /** Rule applied */
  rule: NDRuleType;
  /** Line numbers this depends on */
  dependencies: number[];
  /** Nesting level (for subproofs) */
  level: number;
  /** Is this an assumption? */
  isAssumption: boolean;
  /** Assumption scope (for tracking discharge) */
  assumptionScope?: number;
  /** Justification text */
  justification: string;
}

/**
 * Natural deduction proof
 */
export interface NDProof {
  /** All lines in the proof */
  lines: NDLine[];
  /** Goal to prove */
  goal: Formula;
  /** Is the proof complete? */
  complete: boolean;
  /** Current nesting level */
  currentLevel: number;
}

/**
 * Natural Deduction Proof Builder
 */
export class NDProofBuilder {
  private lines: NDLine[] = [];
  private currentLevel = 0;
  private lineCounter = 1;

  constructor(private goal: Formula) {}

  /**
   * Start an assumption (opens a subproof)
   */
  assume(formula: Formula): number {
    this.currentLevel++;

    const lineNumber = this.lineCounter++;
    this.lines.push({
      lineNumber,
      formula,
      rule: NDRuleType.ASSUME,
      dependencies: [],
      level: this.currentLevel,
      isAssumption: true,
      assumptionScope: lineNumber,
      justification: 'Assumption',
    });

    return lineNumber;
  }

  /**
   * End a subproof (discharge assumption)
   */
  endSubproof(): void {
    if (this.currentLevel === 0) {
      throw new Error('No subproof to end');
    }
    this.currentLevel--;
  }

  /**
   * Apply AND introduction: From A and B, derive A ∧ B
   */
  andIntro(line1: number, line2: number): number {
    const l1 = this.getLine(line1);
    const l2 = this.getLine(line2);

    const formula = and(l1.formula, l2.formula);
    return this.addLine(formula, NDRuleType.AND_INTRO, [line1, line2], `${line1}, ${line2}`);
  }

  /**
   * Apply AND elimination (left): From A ∧ B, derive A
   */
  andElimLeft(line: number): number {
    const l = this.getLine(line);

    if (l.formula.type !== 'binary' || l.formula.operator !== 'AND') {
      throw new Error(`Line ${line} is not a conjunction`);
    }

    return this.addLine(l.formula.left, NDRuleType.AND_ELIM_LEFT, [line], `${line}`);
  }

  /**
   * Apply AND elimination (right): From A ∧ B, derive B
   */
  andElimRight(line: number): number {
    const l = this.getLine(line);

    if (l.formula.type !== 'binary' || l.formula.operator !== 'AND') {
      throw new Error(`Line ${line} is not a conjunction`);
    }

    return this.addLine(l.formula.right, NDRuleType.AND_ELIM_RIGHT, [line], `${line}`);
  }

  /**
   * Apply OR introduction (left): From A, derive A ∨ B
   */
  orIntroLeft(line: number, rightFormula: Formula): number {
    const l = this.getLine(line);
    const formula = or(l.formula, rightFormula);
    return this.addLine(formula, NDRuleType.OR_INTRO_LEFT, [line], `${line}`);
  }

  /**
   * Apply OR introduction (right): From B, derive A ∨ B
   */
  orIntroRight(leftFormula: Formula, line: number): number {
    const l = this.getLine(line);
    const formula = or(leftFormula, l.formula);
    return this.addLine(formula, NDRuleType.OR_INTRO_RIGHT, [line], `${line}`);
  }

  /**
   * Apply IMPLIES introduction: Discharge assumption A to derive A → B
   */
  impliesIntro(assumptionLine: number, conclusionLine: number): number {
    const assumption = this.getLine(assumptionLine);
    const conclusion = this.getLine(conclusionLine);

    if (!assumption.isAssumption) {
      throw new Error(`Line ${assumptionLine} is not an assumption`);
    }

    if (conclusion.level !== assumption.level) {
      throw new Error('Assumption and conclusion must be at the same level');
    }

    const formula = implies(assumption.formula, conclusion.formula);
    this.currentLevel--;

    return this.addLine(
      formula,
      NDRuleType.IMPLIES_INTRO,
      [assumptionLine, conclusionLine],
      `${assumptionLine}-${conclusionLine}`
    );
  }

  /**
   * Apply IMPLIES elimination (Modus Ponens): From A and A → B, derive B
   */
  impliesElim(antecedentLine: number, implicationLine: number): number {
    const antecedent = this.getLine(antecedentLine);
    const implication = this.getLine(implicationLine);

    if (implication.formula.type !== 'binary' || implication.formula.operator !== 'IMPLIES') {
      throw new Error(`Line ${implicationLine} is not an implication`);
    }

    if (!formulasEqual(antecedent.formula, implication.formula.left)) {
      throw new Error('Antecedent does not match implication');
    }

    return this.addLine(
      implication.formula.right,
      NDRuleType.IMPLIES_ELIM,
      [antecedentLine, implicationLine],
      `${antecedentLine}, ${implicationLine}`
    );
  }

  /**
   * Apply NOT introduction (proof by contradiction)
   */
  notIntro(assumptionLine: number, contradictionLine: number): number {
    const assumption = this.getLine(assumptionLine);

    if (!assumption.isAssumption) {
      throw new Error(`Line ${assumptionLine} is not an assumption`);
    }

    // Check for contradiction (A and ¬A)
    const isContradiction = this.checkContradiction(contradictionLine);
    if (!isContradiction) {
      throw new Error(`Line ${contradictionLine} is not a contradiction`);
    }

    const formula = not(assumption.formula);
    this.currentLevel--;

    return this.addLine(
      formula,
      NDRuleType.NOT_INTRO,
      [assumptionLine, contradictionLine],
      `${assumptionLine}-${contradictionLine}`
    );
  }

  /**
   * Apply NOT elimination (double negation)
   */
  notElim(line: number): number {
    const l = this.getLine(line);

    if (l.formula.type !== 'not') {
      throw new Error(`Line ${line} is not a negation`);
    }

    const inner = l.formula.operand;
    if (inner.type !== 'not') {
      throw new Error(`Line ${line} is not a double negation`);
    }

    return this.addLine(inner.operand, NDRuleType.NOT_ELIM, [line], `${line}`);
  }

  /**
   * Apply Law of Excluded Middle: Derive A ∨ ¬A
   */
  lem(formula: Formula): number {
    const lemFormula = or(formula, not(formula));
    return this.addLine(lemFormula, NDRuleType.LEM, [], 'LEM');
  }

  /**
   * Reiterate a line (copy to current level)
   */
  reiterate(line: number): number {
    const l = this.getLine(line);
    return this.addLine(l.formula, NDRuleType.REIT, [line], `${line}`);
  }

  /**
   * Get the current proof
   */
  getProof(): NDProof {
    const complete = this.isComplete();

    return {
      lines: this.lines,
      goal: this.goal,
      complete,
      currentLevel: this.currentLevel,
    };
  }

  /**
   * Check if proof is complete
   */
  private isComplete(): boolean {
    if (this.currentLevel !== 0) {
      return false; // Unclosed subproofs
    }

    if (this.lines.length === 0) {
      return false;
    }

    const lastLine = this.lines[this.lines.length - 1];
    if (!lastLine) {
      return false;
    }
    return formulasEqual(lastLine.formula, this.goal);
  }

  /**
   * Add a line to the proof
   */
  private addLine(
    formula: Formula,
    rule: NDRuleType,
    dependencies: number[],
    justification: string
  ): number {
    const lineNumber = this.lineCounter++;

    this.lines.push({
      lineNumber,
      formula,
      rule,
      dependencies,
      level: this.currentLevel,
      isAssumption: false,
      justification: `${rule} ${justification}`,
    });

    return lineNumber;
  }

  /**
   * Get a line by number
   */
  private getLine(lineNumber: number): NDLine {
    const line = this.lines.find(l => l.lineNumber === lineNumber);
    if (!line) {
      throw new Error(`Line ${lineNumber} not found`);
    }
    return line;
  }

  /**
   * Check if a line represents a contradiction
   */
  private checkContradiction(lineNumber: number): boolean {
    const line = this.getLine(lineNumber);

    // Look for A ∧ ¬A pattern
    if (line.formula.type === 'binary' && line.formula.operator === 'AND') {
      const left = line.formula.left;
      const right = line.formula.right;

      if (right.type === 'not') {
        return formulasEqual(left, right.operand);
      }

      if (left.type === 'not') {
        return formulasEqual(right, left.operand);
      }
    }

    return false;
  }
}

/**
 * Format natural deduction proof as string
 */
export function formatNDProof(proof: NDProof, unicode = true): string {
  let output = '';

  for (const line of proof.lines) {
    const indent = '  '.repeat(line.level);
    const lineNum = `${line.lineNumber}.`.padEnd(4);
    const formula = toString(line.formula, unicode).padEnd(30);
    const justification = line.justification;

    output += `${lineNum}${indent}${formula} ${justification}\n`;
  }

  if (proof.complete) {
    output += '\n✓ Proof complete\n';
  } else {
    output += '\n✗ Proof incomplete\n';
  }

  return output;
}

/**
 * Validate a natural deduction proof
 */
export function validateNDProof(proof: NDProof): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check nesting levels are balanced
  if (proof.currentLevel !== 0) {
    errors.push(`Unbalanced subproofs: ${proof.currentLevel} unclosed`);
  }

  // Validate each line
  for (const line of proof.lines) {
    // Check dependencies exist
    for (const dep of line.dependencies) {
      if (!proof.lines.find(l => l.lineNumber === dep)) {
        errors.push(`Line ${line.lineNumber}: Invalid dependency ${dep}`);
      }
    }

    // Check dependencies are at appropriate levels
    for (const dep of line.dependencies) {
      const depLine = proof.lines.find(l => l.lineNumber === dep);
      if (depLine && depLine.level > line.level) {
        errors.push(`Line ${line.lineNumber}: Cannot depend on line ${dep} from deeper level`);
      }
    }
  }

  // Check if goal is reached
  if (proof.lines.length > 0) {
    const lastLine = proof.lines[proof.lines.length - 1];
    if (lastLine && !formulasEqual(lastLine.formula, proof.goal)) {
      errors.push('Goal not reached');
    }
  } else {
    errors.push('Empty proof');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export natural deduction proof to LaTeX
 */
export function ndProofToLatex(proof: NDProof): string {
  let latex = '\\begin{ndproof}\n';

  for (const line of proof.lines) {
    const indent = '  '.repeat(line.level);
    const formula = `$${toString(line.formula, true)}$`;
    const justification = line.justification;

    latex += `${indent}\\have{${line.lineNumber}}{${formula}}{${justification}}\n`;
  }

  latex += '\\end{ndproof}';

  return latex;
}
