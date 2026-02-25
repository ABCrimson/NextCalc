/**
 * Logic Core - Propositional and First-Order Logic Foundation
 *
 * Provides fundamental logical constructs for theorem proving:
 * - Propositional logic syntax and semantics
 * - First-order logic (FOL) with quantifiers
 * - Formula validation and normalization
 * - Truth table generation
 * - Tautology and contradiction detection
 */

/**
 * Logical operator types
 */
export enum LogicalOperator {
  /** Negation (¬, ~, NOT) */
  NOT = 'NOT',
  /** Conjunction (∧, &, AND) */
  AND = 'AND',
  /** Disjunction (∨, |, OR) */
  OR = 'OR',
  /** Implication (→, =>, IMPLIES) */
  IMPLIES = 'IMPLIES',
  /** Biconditional (↔, <=>, IFF) */
  IFF = 'IFF',
  /** Universal quantifier (∀, FORALL) */
  FORALL = 'FORALL',
  /** Existential quantifier (∃, EXISTS) */
  EXISTS = 'EXISTS',
}

/**
 * Formula node types in the Abstract Syntax Tree
 */
export type Formula =
  | AtomicFormula
  | NotFormula
  | BinaryFormula
  | QuantifiedFormula;

/**
 * Atomic proposition or predicate
 */
export interface AtomicFormula {
  type: 'atomic';
  /** Predicate symbol (e.g., 'P', 'Q', 'Loves') */
  symbol: string;
  /** Arguments for predicates (empty for propositions) */
  args: Term[];
}

/**
 * Negation formula
 */
export interface NotFormula {
  type: 'not';
  operand: Formula;
}

/**
 * Binary logical operation
 */
export interface BinaryFormula {
  type: 'binary';
  operator: LogicalOperator.AND | LogicalOperator.OR | LogicalOperator.IMPLIES | LogicalOperator.IFF;
  left: Formula;
  right: Formula;
}

/**
 * Quantified formula (∀x.P(x) or ∃x.P(x))
 */
export interface QuantifiedFormula {
  type: 'quantified';
  quantifier: LogicalOperator.FORALL | LogicalOperator.EXISTS;
  variable: string;
  scope: Formula;
}

/**
 * Terms in first-order logic
 */
export type Term = VariableTerm | ConstantTerm | FunctionTerm;

export interface VariableTerm {
  type: 'variable';
  name: string;
}

export interface ConstantTerm {
  type: 'constant';
  value: string | number;
}

export interface FunctionTerm {
  type: 'function';
  symbol: string;
  args: Term[];
}

/**
 * Variable assignment for truth evaluation
 */
export type Assignment = Map<string, boolean>;

/**
 * Creates an atomic formula (proposition)
 */
export function atom(symbol: string, ...args: Term[]): AtomicFormula {
  return { type: 'atomic', symbol, args };
}

/**
 * Creates a variable term
 */
export function variable(name: string): VariableTerm {
  return { type: 'variable', name };
}

/**
 * Creates a constant term
 */
export function constant(value: string | number): ConstantTerm {
  return { type: 'constant', value };
}

/**
 * Creates a function term
 */
export function func(symbol: string, ...args: Term[]): FunctionTerm {
  return { type: 'function', symbol, args };
}

/**
 * Creates a negation
 */
export function not(operand: Formula): NotFormula {
  return { type: 'not', operand };
}

/**
 * Creates a conjunction (AND)
 */
export function and(...formulas: Formula[]): Formula {
  if (formulas.length === 0) {
    throw new Error('AND requires at least one formula');
  }
  const first = formulas[0];
  if (!first) {
    throw new Error('AND requires at least one formula');
  }
  if (formulas.length === 1) {
    return first;
  }

  return formulas.reduce((acc, f) => ({
    type: 'binary',
    operator: LogicalOperator.AND,
    left: acc,
    right: f,
  }));
}

/**
 * Creates a disjunction (OR)
 */
export function or(...formulas: Formula[]): Formula {
  if (formulas.length === 0) {
    throw new Error('OR requires at least one formula');
  }
  const first = formulas[0];
  if (!first) {
    throw new Error('OR requires at least one formula');
  }
  if (formulas.length === 1) {
    return first;
  }

  return formulas.reduce((acc, f) => ({
    type: 'binary',
    operator: LogicalOperator.OR,
    left: acc,
    right: f,
  }));
}

/**
 * Creates an implication (A → B)
 */
export function implies(left: Formula, right: Formula): BinaryFormula {
  return { type: 'binary', operator: LogicalOperator.IMPLIES, left, right };
}

/**
 * Creates a biconditional (A ↔ B)
 */
export function iff(left: Formula, right: Formula): BinaryFormula {
  return { type: 'binary', operator: LogicalOperator.IFF, left, right };
}

/**
 * Creates a universal quantification (∀x.P(x))
 */
export function forall(variable: string, scope: Formula): QuantifiedFormula {
  return { type: 'quantified', quantifier: LogicalOperator.FORALL, variable, scope };
}

/**
 * Creates an existential quantification (∃x.P(x))
 */
export function exists(variable: string, scope: Formula): QuantifiedFormula {
  return { type: 'quantified', quantifier: LogicalOperator.EXISTS, variable, scope };
}

/**
 * Extract all atomic propositions from a formula
 */
export function getAtoms(formula: Formula): Set<string> {
  const atoms = new Set<string>();

  function traverse(f: Formula): void {
    switch (f.type) {
      case 'atomic':
        atoms.add(f.symbol);
        break;
      case 'not':
        traverse(f.operand);
        break;
      case 'binary':
        traverse(f.left);
        traverse(f.right);
        break;
      case 'quantified':
        traverse(f.scope);
        break;
    }
  }

  traverse(formula);
  return atoms;
}

/**
 * Extract all free variables from a formula
 */
export function getFreeVariables(formula: Formula, bound = new Set<string>()): Set<string> {
  const free = new Set<string>();

  function traverseTerm(term: Term): void {
    switch (term.type) {
      case 'variable':
        if (!bound.has(term.name)) {
          free.add(term.name);
        }
        break;
      case 'function':
        term.args.forEach(traverseTerm);
        break;
    }
  }

  function traverse(f: Formula, boundVars: Set<string>): void {
    switch (f.type) {
      case 'atomic':
        f.args.forEach(traverseTerm);
        break;
      case 'not':
        traverse(f.operand, boundVars);
        break;
      case 'binary':
        traverse(f.left, boundVars);
        traverse(f.right, boundVars);
        break;
      case 'quantified': {
        const newBound = new Set(boundVars);
        newBound.add(f.variable);
        traverse(f.scope, newBound);
        break;
      }
    }
  }

  traverse(formula, bound);
  return free;
}

/**
 * Evaluate a propositional formula under an assignment
 */
export function evaluate(formula: Formula, assignment: Assignment): boolean {
  switch (formula.type) {
    case 'atomic': {
      const value = assignment.get(formula.symbol);
      if (value === undefined) {
        throw new Error(`Unassigned variable: ${formula.symbol}`);
      }
      return value;
    }

    case 'not':
      return !evaluate(formula.operand, assignment);

    case 'binary': {
      const left = evaluate(formula.left, assignment);
      const right = evaluate(formula.right, assignment);

      switch (formula.operator) {
        case LogicalOperator.AND:
          return left && right;
        case LogicalOperator.OR:
          return left || right;
        case LogicalOperator.IMPLIES:
          return !left || right;
        case LogicalOperator.IFF:
          return left === right;
      }
    }

    case 'quantified':
      throw new Error('Cannot evaluate quantified formulas without a domain');
  }
}

/**
 * Truth table row
 */
export interface TruthTableRow {
  assignment: Assignment;
  result: boolean;
}

/**
 * Generate truth table for a propositional formula
 */
export function generateTruthTable(formula: Formula): TruthTableRow[] {
  const atoms = Array.from(getAtoms(formula)).sort();
  const rows: TruthTableRow[] = [];

  // Generate all possible assignments (2^n rows)
  const numRows = Math.pow(2, atoms.length);

  for (let i = 0; i < numRows; i++) {
    const assignment = new Map<string, boolean>();

    for (let j = 0; j < atoms.length; j++) {
      const bit = (i >> j) & 1;
      const atom = atoms[j];
      if (atom !== undefined) {
        assignment.set(atom, bit === 1);
      }
    }

    const result = evaluate(formula, assignment);
    rows.push({ assignment, result });
  }

  return rows;
}

/**
 * Check if a formula is a tautology (always true)
 */
export function isTautology(formula: Formula): boolean {
  const table = generateTruthTable(formula);
  return table.every(row => row.result);
}

/**
 * Check if a formula is a contradiction (always false)
 */
export function isContradiction(formula: Formula): boolean {
  const table = generateTruthTable(formula);
  return table.every(row => !row.result);
}

/**
 * Check if a formula is satisfiable (can be true)
 */
export function isSatisfiable(formula: Formula): boolean {
  const table = generateTruthTable(formula);
  return table.some(row => row.result);
}

/**
 * Check logical equivalence of two formulas
 */
export function isEquivalent(f1: Formula, f2: Formula): boolean {
  return isTautology(iff(f1, f2));
}

/**
 * Convert formula to string representation
 */
export function toString(formula: Formula, unicode = true): string {
  const symbols = unicode
    ? { not: '¬', and: '∧', or: '∨', implies: '→', iff: '↔', forall: '∀', exists: '∃' }
    : { not: '~', and: '&', or: '|', implies: '->', iff: '<->', forall: 'FORALL', exists: 'EXISTS' };

  function termToString(term: Term): string {
    switch (term.type) {
      case 'variable':
        return term.name;
      case 'constant':
        return String(term.value);
      case 'function':
        return `${term.symbol}(${term.args.map(termToString).join(', ')})`;
    }
  }

  function inner(f: Formula, parentPrecedence = 0): string {
    switch (f.type) {
      case 'atomic':
        if (f.args.length === 0) {
          return f.symbol;
        }
        return `${f.symbol}(${f.args.map(termToString).join(', ')})`;

      case 'not': {
        const precedence = 4;
        const result = `${symbols.not}${inner(f.operand, precedence)}`;
        return parentPrecedence > precedence ? `(${result})` : result;
      }

      case 'binary': {
        let precedence: number;
        let symbol: string;

        switch (f.operator) {
          case LogicalOperator.AND:
            precedence = 3;
            symbol = symbols.and;
            break;
          case LogicalOperator.OR:
            precedence = 2;
            symbol = symbols.or;
            break;
          case LogicalOperator.IMPLIES:
            precedence = 1;
            symbol = symbols.implies;
            break;
          case LogicalOperator.IFF:
            precedence = 0;
            symbol = symbols.iff;
            break;
        }

        const result = `${inner(f.left, precedence)} ${symbol} ${inner(f.right, precedence)}`;
        return parentPrecedence > precedence ? `(${result})` : result;
      }

      case 'quantified': {
        const symbol = f.quantifier === LogicalOperator.FORALL ? symbols.forall : symbols.exists;
        return `${symbol}${f.variable}. ${inner(f.scope, 0)}`;
      }
    }
  }

  return inner(formula);
}

/**
 * Parse a simple formula string (basic implementation)
 */
export function parse(input: string): Formula {
  // This is a simplified parser for demonstration
  // A full implementation would use proper lexing and parsing

  const tokens = tokenize(input);
  let position = 0;

  function current(): string | undefined {
    return tokens[position];
  }

  function consume(expected?: string): string {
    const token = tokens[position++];
    if (expected !== undefined && token !== expected) {
      throw new Error(`Expected '${expected}', got '${token}'`);
    }
    if (!token) {
      throw new Error('Unexpected end of input');
    }
    return token;
  }

  function parseExpression(): Formula {
    return parseIff();
  }

  function parseIff(): Formula {
    let left: Formula = parseImplies();

    while (current() === '<->' || current() === '↔') {
      consume();
      const right = parseImplies();
      left = iff(left, right);
    }

    return left;
  }

  function parseImplies(): Formula {
    let left: Formula = parseOr();

    while (current() === '->' || current() === '→' || current() === '=>') {
      consume();
      const right = parseOr();
      left = implies(left, right);
    }

    return left;
  }

  function parseOr(): Formula {
    let left: Formula = parseAnd();

    while (current() === '|' || current() === '∨' || current() === 'OR') {
      consume();
      const right = parseAnd();
      left = { type: 'binary', operator: LogicalOperator.OR, left, right };
    }

    return left;
  }

  function parseAnd(): Formula {
    let left: Formula = parseNot();

    while (current() === '&' || current() === '∧' || current() === 'AND') {
      consume();
      const right = parseNot();
      left = { type: 'binary', operator: LogicalOperator.AND, left, right };
    }

    return left;
  }

  function parseNot(): Formula {
    if (current() === '~' || current() === '¬' || current() === 'NOT') {
      consume();
      return not(parseNot());
    }

    return parsePrimary();
  }

  function parsePrimary(): Formula {
    if (current() === '(') {
      consume('(');
      const expr = parseExpression();
      consume(')');
      return expr;
    }

    const symbol = consume();
    if (symbol.match(/^[A-Z][a-zA-Z0-9]*$/)) {
      return atom(symbol);
    }

    throw new Error(`Invalid symbol: ${symbol}`);
  }

  return parseExpression();
}

/**
 * Tokenize input string
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    // Skip whitespace
    if (char !== undefined && /\s/.test(char)) {
      i++;
      continue;
    }

    // Multi-character operators
    if (input.slice(i, i + 3) === '<->') {
      tokens.push('<->');
      i += 3;
      continue;
    }

    if (input.slice(i, i + 2) === '->' || input.slice(i, i + 2) === '=>') {
      tokens.push(input.slice(i, i + 2));
      i += 2;
      continue;
    }

    // Keywords
    if (input.slice(i, i + 3) === 'AND') {
      tokens.push('AND');
      i += 3;
      continue;
    }

    if (input.slice(i, i + 2) === 'OR') {
      tokens.push('OR');
      i += 2;
      continue;
    }

    if (input.slice(i, i + 3) === 'NOT') {
      tokens.push('NOT');
      i += 3;
      continue;
    }

    // Identifiers
    if (char !== undefined && /[A-Za-z]/.test(char)) {
      let identifier = '';
      let currentChar = input[i];
      while (i < input.length && currentChar !== undefined && /[A-Za-z0-9]/.test(currentChar)) {
        identifier += currentChar;
        i++;
        currentChar = input[i];
      }
      tokens.push(identifier);
      continue;
    }

    // Single character tokens
    if (char !== undefined) {
      tokens.push(char);
    }
    i++;
  }

  return tokens;
}
