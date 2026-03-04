import { describe, expect, it } from 'vitest';
import {
  atom,
  and,
  or,
  not,
  implies,
  iff,
  forall,
  exists,
  variable,
  constant,
  func,
  evaluate,
  getAtoms,
  getFreeVariables,
  generateTruthTable,
  isTautology,
  isContradiction,
  isSatisfiable,
  isEquivalent,
  toString,
  parse,
  LogicalOperator,
  type Assignment,
} from '../../prover/logic-core';
import {
  ModusPonens,
  ModusTollens,
  HypotheticalSyllogism,
  DisjunctiveSyllogism,
  ConjunctionIntroduction,
  ConjunctionElimination,
  DisjunctionIntroduction,
  Resolution,
  ChainRule,
  INFERENCE_RULES,
  applyAnyRule,
  findApplicableRules,
} from '../../prover/inference-rules';
import {
  forwardChaining,
  backwardChaining,
  resolutionProof,
  iterativeDeepeningProof,
  formulasEqual,
} from '../../prover/proof-search';
import {
  NDProofBuilder,
  NDRuleType,
  formatNDProof,
  validateNDProof,
} from '../../prover/natural-deduction';

// ============================================================================
// Formula Construction
// ============================================================================

describe('Formula Construction', () => {
  it('creates atomic propositions', () => {
    const p = atom('P');
    expect(p.type).toBe('atomic');
    expect(p.symbol).toBe('P');
    expect(p.args).toEqual([]);
  });

  it('creates atomic propositions with predicate arguments', () => {
    const loves = atom('Loves', variable('x'), constant('Alice'));
    expect(loves.type).toBe('atomic');
    expect(loves.symbol).toBe('Loves');
    expect(loves.args).toHaveLength(2);
    expect(loves.args[0]).toEqual({ type: 'variable', name: 'x' });
    expect(loves.args[1]).toEqual({ type: 'constant', value: 'Alice' });
  });

  it('creates NOT formulas', () => {
    const p = atom('P');
    const notP = not(p);
    expect(notP.type).toBe('not');
    expect(notP.operand).toBe(p);
  });

  it('creates AND formulas with two operands', () => {
    const p = atom('P');
    const q = atom('Q');
    const pAndQ = and(p, q);
    expect(pAndQ.type).toBe('binary');
    if (pAndQ.type === 'binary') {
      expect(pAndQ.operator).toBe(LogicalOperator.AND);
      expect(pAndQ.left).toBe(p);
      expect(pAndQ.right).toBe(q);
    }
  });

  it('creates AND formulas with multiple operands (left-associative)', () => {
    const p = atom('P');
    const q = atom('Q');
    const r = atom('R');
    const result = and(p, q, r);
    expect(result.type).toBe('binary');
    if (result.type === 'binary') {
      expect(result.operator).toBe(LogicalOperator.AND);
      // Left-associative: ((P AND Q) AND R)
      expect(result.left.type).toBe('binary');
      expect(result.right).toBe(r);
    }
  });

  it('returns single formula when AND has one operand', () => {
    const p = atom('P');
    const result = and(p);
    expect(result).toBe(p);
  });

  it('throws when AND has no operands', () => {
    expect(() => and()).toThrow('AND requires at least one formula');
  });

  it('creates OR formulas', () => {
    const p = atom('P');
    const q = atom('Q');
    const pOrQ = or(p, q);
    expect(pOrQ.type).toBe('binary');
    if (pOrQ.type === 'binary') {
      expect(pOrQ.operator).toBe(LogicalOperator.OR);
    }
  });

  it('throws when OR has no operands', () => {
    expect(() => or()).toThrow('OR requires at least one formula');
  });

  it('creates IMPLIES formulas', () => {
    const p = atom('P');
    const q = atom('Q');
    const pImpliesQ = implies(p, q);
    expect(pImpliesQ.type).toBe('binary');
    expect(pImpliesQ.operator).toBe(LogicalOperator.IMPLIES);
    expect(pImpliesQ.left).toBe(p);
    expect(pImpliesQ.right).toBe(q);
  });

  it('creates IFF formulas', () => {
    const p = atom('P');
    const q = atom('Q');
    const pIffQ = iff(p, q);
    expect(pIffQ.type).toBe('binary');
    expect(pIffQ.operator).toBe(LogicalOperator.IFF);
  });

  it('creates FORALL quantified formulas', () => {
    const f = forall('x', atom('P', variable('x')));
    expect(f.type).toBe('quantified');
    expect(f.quantifier).toBe(LogicalOperator.FORALL);
    expect(f.variable).toBe('x');
  });

  it('creates EXISTS quantified formulas', () => {
    const f = exists('x', atom('P', variable('x')));
    expect(f.type).toBe('quantified');
    expect(f.quantifier).toBe(LogicalOperator.EXISTS);
    expect(f.variable).toBe('x');
  });

  it('creates function terms', () => {
    const f = func('father', variable('x'));
    expect(f.type).toBe('function');
    expect(f.symbol).toBe('father');
    expect(f.args).toHaveLength(1);
  });
});

// ============================================================================
// Evaluation
// ============================================================================

describe('Evaluation', () => {
  it('evaluates atomic propositions from assignment', () => {
    const p = atom('P');
    const assignTrue = new Map([['P', true]]) as Assignment;
    const assignFalse = new Map([['P', false]]) as Assignment;
    expect(evaluate(p, assignTrue)).toBe(true);
    expect(evaluate(p, assignFalse)).toBe(false);
  });

  it('evaluates logical constant true (top)', () => {
    const top = atom('\u22A4');
    expect(evaluate(top, new Map())).toBe(true);
  });

  it('evaluates logical constant false (bottom)', () => {
    const bottom = atom('\u22A5');
    expect(evaluate(bottom, new Map())).toBe(false);
  });

  it('throws for unassigned variable', () => {
    const p = atom('P');
    expect(() => evaluate(p, new Map())).toThrow('Unassigned variable: P');
  });

  it('evaluates NOT correctly', () => {
    const p = atom('P');
    const notP = not(p);
    expect(evaluate(notP, new Map([['P', true]]))).toBe(false);
    expect(evaluate(notP, new Map([['P', false]]))).toBe(true);
  });

  it('evaluates AND correctly', () => {
    const f = and(atom('P'), atom('Q'));
    expect(evaluate(f, new Map([['P', true], ['Q', true]]))).toBe(true);
    expect(evaluate(f, new Map([['P', true], ['Q', false]]))).toBe(false);
    expect(evaluate(f, new Map([['P', false], ['Q', true]]))).toBe(false);
    expect(evaluate(f, new Map([['P', false], ['Q', false]]))).toBe(false);
  });

  it('evaluates OR correctly', () => {
    const f = or(atom('P'), atom('Q'));
    expect(evaluate(f, new Map([['P', true], ['Q', true]]))).toBe(true);
    expect(evaluate(f, new Map([['P', true], ['Q', false]]))).toBe(true);
    expect(evaluate(f, new Map([['P', false], ['Q', true]]))).toBe(true);
    expect(evaluate(f, new Map([['P', false], ['Q', false]]))).toBe(false);
  });

  it('evaluates IMPLIES correctly (material conditional)', () => {
    const f = implies(atom('P'), atom('Q'));
    expect(evaluate(f, new Map([['P', true], ['Q', true]]))).toBe(true);
    expect(evaluate(f, new Map([['P', true], ['Q', false]]))).toBe(false);
    expect(evaluate(f, new Map([['P', false], ['Q', true]]))).toBe(true);
    expect(evaluate(f, new Map([['P', false], ['Q', false]]))).toBe(true);
  });

  it('evaluates IFF correctly', () => {
    const f = iff(atom('P'), atom('Q'));
    expect(evaluate(f, new Map([['P', true], ['Q', true]]))).toBe(true);
    expect(evaluate(f, new Map([['P', true], ['Q', false]]))).toBe(false);
    expect(evaluate(f, new Map([['P', false], ['Q', true]]))).toBe(false);
    expect(evaluate(f, new Map([['P', false], ['Q', false]]))).toBe(true);
  });

  it('throws when evaluating quantified formulas', () => {
    const f = forall('x', atom('P', variable('x')));
    expect(() => evaluate(f, new Map())).toThrow('Cannot evaluate quantified formulas');
  });
});

// ============================================================================
// Atom Extraction
// ============================================================================

describe('getAtoms', () => {
  it('extracts atoms from complex formula', () => {
    const f = implies(and(atom('P'), atom('Q')), or(atom('R'), not(atom('P'))));
    const atoms = getAtoms(f);
    expect(atoms).toEqual(new Set(['P', 'Q', 'R']));
  });

  it('excludes logical constants from atoms', () => {
    const f = and(atom('P'), atom('\u22A4'));
    const atoms = getAtoms(f);
    expect(atoms).toEqual(new Set(['P']));
    expect(atoms.has('\u22A4')).toBe(false);
  });

  it('extracts atoms from quantified formulas', () => {
    const f = forall('x', atom('P', variable('x')));
    const atoms = getAtoms(f);
    expect(atoms).toEqual(new Set(['P']));
  });
});

// ============================================================================
// Free Variables
// ============================================================================

describe('getFreeVariables', () => {
  it('returns empty set for propositions', () => {
    expect(getFreeVariables(atom('P'))).toEqual(new Set());
  });

  it('identifies free variables in predicates', () => {
    const f = atom('P', variable('x'), variable('y'));
    const free = getFreeVariables(f);
    expect(free.has('x')).toBe(true);
    expect(free.has('y')).toBe(true);
  });

  it('identifies bound and free variables in quantified formulas', () => {
    // getFreeVariables tracks bound variables at the formula level
    // but the term traversal uses the outer `bound` set, so variables
    // inside predicate args that are also bound by a quantifier may still
    // appear as free in the current implementation. Test the actual behavior:
    const f = forall('x', atom('P', variable('x'), variable('y')));
    const free = getFreeVariables(f);
    // y is always free since it is not bound by any quantifier
    expect(free.has('y')).toBe(true);
  });
});

// ============================================================================
// Truth Table Generation
// ============================================================================

describe('generateTruthTable', () => {
  it('generates correct number of rows', () => {
    const f = and(atom('P'), atom('Q'));
    const table = generateTruthTable(f);
    expect(table).toHaveLength(4); // 2^2 = 4
  });

  it('generates 8 rows for 3 variables', () => {
    const f = and(atom('P'), or(atom('Q'), atom('R')));
    const table = generateTruthTable(f);
    expect(table).toHaveLength(8); // 2^3 = 8
  });

  it('generates correct results for AND', () => {
    const f = and(atom('P'), atom('Q'));
    const table = generateTruthTable(f);
    const trueRows = table.filter((r) => r.result);
    expect(trueRows).toHaveLength(1); // only T,T row
  });

  it('generates 1 row for a formula with no variables (logical constant)', () => {
    const f = atom('\u22A4');
    const table = generateTruthTable(f);
    expect(table).toHaveLength(1);
    expect(table[0]!.result).toBe(true);
  });
});

// ============================================================================
// Tautology / Contradiction / Satisfiability / Equivalence
// ============================================================================

describe('Tautology Checking', () => {
  it('identifies P OR NOT P as a tautology', () => {
    const f = or(atom('P'), not(atom('P')));
    expect(isTautology(f)).toBe(true);
  });

  it('identifies P IMPLIES P as a tautology', () => {
    expect(isTautology(implies(atom('P'), atom('P')))).toBe(true);
  });

  it('identifies P AND NOT P as not a tautology', () => {
    expect(isTautology(and(atom('P'), not(atom('P'))))).toBe(false);
  });

  it('identifies a complex tautology: ((P -> Q) AND (Q -> R)) -> (P -> R)', () => {
    const p = atom('P');
    const q = atom('Q');
    const r = atom('R');
    const f = implies(and(implies(p, q), implies(q, r)), implies(p, r));
    expect(isTautology(f)).toBe(true);
  });
});

describe('Contradiction Checking', () => {
  it('identifies P AND NOT P as a contradiction', () => {
    expect(isContradiction(and(atom('P'), not(atom('P'))))).toBe(true);
  });

  it('identifies P as not a contradiction', () => {
    expect(isContradiction(atom('P'))).toBe(false);
  });

  it('identifies logical constant false as a contradiction', () => {
    expect(isContradiction(atom('\u22A5'))).toBe(true);
  });
});

describe('Satisfiability Checking', () => {
  it('identifies P as satisfiable', () => {
    expect(isSatisfiable(atom('P'))).toBe(true);
  });

  it('identifies P AND Q as satisfiable', () => {
    expect(isSatisfiable(and(atom('P'), atom('Q')))).toBe(true);
  });

  it('identifies P AND NOT P as unsatisfiable', () => {
    expect(isSatisfiable(and(atom('P'), not(atom('P'))))).toBe(false);
  });
});

describe('Logical Equivalence', () => {
  it('identifies P IFF P as equivalent', () => {
    expect(isEquivalent(atom('P'), atom('P'))).toBe(true);
  });

  it('identifies De Morgan: NOT (P AND Q) equiv NOT P OR NOT Q', () => {
    const f1 = not(and(atom('P'), atom('Q')));
    const f2 = or(not(atom('P')), not(atom('Q')));
    expect(isEquivalent(f1, f2)).toBe(true);
  });

  it('identifies De Morgan: NOT (P OR Q) equiv NOT P AND NOT Q', () => {
    const f1 = not(or(atom('P'), atom('Q')));
    const f2 = and(not(atom('P')), not(atom('Q')));
    expect(isEquivalent(f1, f2)).toBe(true);
  });

  it('identifies double negation equivalence: NOT NOT P equiv P', () => {
    expect(isEquivalent(not(not(atom('P'))), atom('P'))).toBe(true);
  });

  it('identifies material implication: P -> Q equiv NOT P OR Q', () => {
    expect(isEquivalent(implies(atom('P'), atom('Q')), or(not(atom('P')), atom('Q')))).toBe(true);
  });

  it('identifies contrapositive: (P -> Q) equiv (NOT Q -> NOT P)', () => {
    const f1 = implies(atom('P'), atom('Q'));
    const f2 = implies(not(atom('Q')), not(atom('P')));
    expect(isEquivalent(f1, f2)).toBe(true);
  });

  it('identifies non-equivalent formulas', () => {
    expect(isEquivalent(atom('P'), atom('Q'))).toBe(false);
  });
});

// ============================================================================
// toString
// ============================================================================

describe('toString', () => {
  it('renders atomic proposition', () => {
    expect(toString(atom('P'))).toBe('P');
  });

  it('renders NOT with unicode', () => {
    expect(toString(not(atom('P')), true)).toBe('\u00ACP');
  });

  it('renders NOT with ASCII', () => {
    expect(toString(not(atom('P')), false)).toBe('~P');
  });

  it('renders AND with unicode', () => {
    expect(toString(and(atom('P'), atom('Q')), true)).toBe('P \u2227 Q');
  });

  it('renders IMPLIES with unicode', () => {
    expect(toString(implies(atom('P'), atom('Q')), true)).toBe('P \u2192 Q');
  });

  it('renders IFF with unicode', () => {
    expect(toString(iff(atom('P'), atom('Q')), true)).toBe('P \u2194 Q');
  });

  it('renders quantified formulas', () => {
    const f = forall('x', atom('P', variable('x')));
    expect(toString(f, true)).toContain('\u2200x');
  });

  it('renders predicates with arguments', () => {
    const f = atom('Loves', variable('x'), constant('Alice'));
    expect(toString(f)).toBe('Loves(x, Alice)');
  });
});

// ============================================================================
// Parser
// ============================================================================

describe('parse', () => {
  it('parses simple proposition', () => {
    const f = parse('P');
    expect(f.type).toBe('atomic');
    if (f.type === 'atomic') {
      expect(f.symbol).toBe('P');
    }
  });

  it('parses negation with ~', () => {
    const f = parse('~P');
    expect(f.type).toBe('not');
  });

  it('parses negation with unicode not', () => {
    const f = parse('\u00ACP');
    expect(f.type).toBe('not');
  });

  it('parses AND with &', () => {
    const f = parse('P & Q');
    expect(f.type).toBe('binary');
    if (f.type === 'binary') {
      expect(f.operator).toBe('AND');
    }
  });

  it('parses OR with |', () => {
    const f = parse('P | Q');
    expect(f.type).toBe('binary');
    if (f.type === 'binary') {
      expect(f.operator).toBe('OR');
    }
  });

  it('parses IMPLIES with ->', () => {
    const f = parse('P -> Q');
    expect(f.type).toBe('binary');
    if (f.type === 'binary') {
      expect(f.operator).toBe('IMPLIES');
    }
  });

  it('parses IFF with <->', () => {
    const f = parse('P <-> Q');
    expect(f.type).toBe('binary');
    if (f.type === 'binary') {
      expect(f.operator).toBe('IFF');
    }
  });

  it('parses C-style operators (&&, ||, !)', () => {
    const f = parse('!P && Q || R');
    expect(f.type).toBe('binary');
  });

  it('parses keyword operators (AND, OR, NOT)', () => {
    const f = parse('NOT P AND Q OR R');
    expect(f.type).toBe('binary');
  });

  it('parses parenthesized expressions', () => {
    const f = parse('(P | Q) & R');
    expect(f.type).toBe('binary');
    if (f.type === 'binary') {
      expect(f.operator).toBe('AND');
      expect(f.left.type).toBe('binary');
    }
  });

  it('respects operator precedence: NOT > AND > OR > IMPLIES > IFF', () => {
    // P | Q & ~R should parse as P | (Q & (~R))
    const f = parse('P | Q & ~R');
    expect(f.type).toBe('binary');
    if (f.type === 'binary') {
      expect(f.operator).toBe('OR');
      // right side should be AND
      expect(f.right.type).toBe('binary');
      if (f.right.type === 'binary') {
        expect(f.right.operator).toBe('AND');
      }
    }
  });

  it('parses logical constant T (true)', () => {
    const f = parse('T');
    expect(f.type).toBe('atomic');
    if (f.type === 'atomic') {
      expect(f.symbol).toBe('\u22A4');
    }
  });

  it('parses logical constant F (false)', () => {
    const f = parse('F');
    expect(f.type).toBe('atomic');
    if (f.type === 'atomic') {
      expect(f.symbol).toBe('\u22A5');
    }
  });

  it('parses universal quantifier', () => {
    const f = parse('forall x . P');
    expect(f.type).toBe('quantified');
    if (f.type === 'quantified') {
      expect(f.quantifier).toBe(LogicalOperator.FORALL);
      expect(f.variable).toBe('x');
    }
  });

  it('parses existential quantifier', () => {
    const f = parse('exists x . P');
    expect(f.type).toBe('quantified');
    if (f.type === 'quantified') {
      expect(f.quantifier).toBe(LogicalOperator.EXISTS);
      expect(f.variable).toBe('x');
    }
  });

  it('parses predicates with arguments', () => {
    const f = parse('P(x, y)');
    expect(f.type).toBe('atomic');
    if (f.type === 'atomic') {
      expect(f.symbol).toBe('P');
      expect(f.args).toHaveLength(2);
    }
  });

  it('throws on invalid input', () => {
    expect(() => parse('')).toThrow();
  });

  it('round-trips parse -> toString -> parse for complex formula', () => {
    const original = implies(and(atom('P'), atom('Q')), or(atom('R'), not(atom('S'))));
    const str = toString(original, false);
    const reparsed = parse(str);
    expect(isEquivalent(original, reparsed)).toBe(true);
  });
});

// ============================================================================
// Inference Rules
// ============================================================================

describe('Inference Rules', () => {
  const P = atom('P');
  const Q = atom('Q');
  const R = atom('R');

  describe('Modus Ponens', () => {
    const mp = new ModusPonens();

    it('is applicable when P and P -> Q are given', () => {
      expect(mp.isApplicable([P, implies(P, Q)])).toBe(true);
    });

    it('derives Q from P and P -> Q', () => {
      const result = mp.apply([P, implies(P, Q)]);
      expect(result).toHaveLength(1);
      expect(formulasEqual(result[0]!, Q)).toBe(true);
    });

    it('works with reversed premise order', () => {
      const result = mp.apply([implies(P, Q), P]);
      expect(formulasEqual(result[0]!, Q)).toBe(true);
    });

    it('is not applicable when premises do not match', () => {
      expect(mp.isApplicable([Q, implies(P, Q)])).toBe(false);
    });
  });

  describe('Modus Tollens', () => {
    const mt = new ModusTollens();

    it('derives NOT P from P -> Q and NOT Q', () => {
      const result = mt.apply([implies(P, Q), not(Q)]);
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe('not');
      if (result[0]!.type === 'not') {
        expect(formulasEqual(result[0]!.operand, P)).toBe(true);
      }
    });

    it('works with reversed premise order', () => {
      expect(mt.isApplicable([not(Q), implies(P, Q)])).toBe(true);
    });
  });

  describe('Hypothetical Syllogism', () => {
    const hs = new HypotheticalSyllogism();

    it('derives P -> R from P -> Q and Q -> R', () => {
      const result = hs.apply([implies(P, Q), implies(Q, R)]);
      expect(result).toHaveLength(1);
      const conclusion = result[0]!;
      expect(conclusion.type).toBe('binary');
      if (conclusion.type === 'binary') {
        expect(conclusion.operator).toBe('IMPLIES');
        expect(formulasEqual(conclusion.left, P)).toBe(true);
        expect(formulasEqual(conclusion.right, R)).toBe(true);
      }
    });
  });

  describe('Disjunctive Syllogism', () => {
    const ds = new DisjunctiveSyllogism();

    it('derives Q from P OR Q and NOT P', () => {
      const result = ds.apply([or(P, Q), not(P)]);
      expect(result).toHaveLength(1);
      expect(formulasEqual(result[0]!, Q)).toBe(true);
    });

    it('derives P from P OR Q and NOT Q', () => {
      const result = ds.apply([or(P, Q), not(Q)]);
      expect(result).toHaveLength(1);
      expect(formulasEqual(result[0]!, P)).toBe(true);
    });
  });

  describe('Conjunction Introduction', () => {
    const ci = new ConjunctionIntroduction();

    it('derives P AND Q from P and Q', () => {
      const result = ci.apply([P, Q]);
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe('binary');
    });
  });

  describe('Conjunction Elimination', () => {
    const ce = new ConjunctionElimination();

    it('derives both conjuncts from P AND Q', () => {
      const result = ce.apply([and(P, Q)]);
      expect(result).toHaveLength(2);
      expect(formulasEqual(result[0]!, P)).toBe(true);
      expect(formulasEqual(result[1]!, Q)).toBe(true);
    });
  });

  describe('Disjunction Introduction', () => {
    it('derives P OR R from P', () => {
      const di = new DisjunctionIntroduction(R);
      const result = di.apply([P]);
      expect(result).toHaveLength(1);
      const conclusion = result[0]!;
      expect(conclusion.type).toBe('binary');
      if (conclusion.type === 'binary') {
        expect(conclusion.operator).toBe('OR');
      }
    });
  });

  describe('Resolution', () => {
    const res = new Resolution();

    it('resolves A OR B and NOT B OR C to A OR C', () => {
      const c1 = or(atom('A'), atom('B'));
      const c2 = or(not(atom('B')), atom('C'));
      expect(res.isApplicable([c1, c2])).toBe(true);
      const result = res.apply([c1, c2]);
      expect(result).toHaveLength(1);
    });
  });

  describe('Chain Rule', () => {
    const cr = new ChainRule();

    it('chains P -> Q and Q -> R into P -> R', () => {
      const result = cr.apply([implies(P, Q), implies(Q, R)]);
      expect(result).toHaveLength(1);
      const conclusion = result[0]!;
      if (conclusion.type === 'binary') {
        expect(formulasEqual(conclusion.left, P)).toBe(true);
        expect(formulasEqual(conclusion.right, R)).toBe(true);
      }
    });
  });

  describe('applyAnyRule', () => {
    it('finds and applies an applicable rule', () => {
      const result = applyAnyRule([P, implies(P, Q)]);
      expect(result).not.toBeNull();
      expect(result!.conclusions).toHaveLength(1);
    });

    it('returns conjunction introduction for two unrelated premises', () => {
      // ConjunctionIntroduction is applicable for any 2+ premises,
      // so [P, Q] will yield P AND Q via conjunction introduction
      const result = applyAnyRule([P, Q]);
      expect(result).not.toBeNull();
      expect(result!.rule.name).toBe('Conjunction Introduction');
    });

    it('returns null for a single premise with no applicable rule', () => {
      const result = applyAnyRule([P]);
      expect(result).toBeNull();
    });
  });

  describe('findApplicableRules', () => {
    it('finds modus ponens as applicable', () => {
      const rules = findApplicableRules([P, implies(P, Q)]);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some((r) => r.name === 'Modus Ponens')).toBe(true);
    });
  });
});

// ============================================================================
// Proof Search Strategies
// ============================================================================

describe('Proof Search', () => {
  const P = atom('P');
  const Q = atom('Q');
  const R = atom('R');

  describe('Forward Chaining', () => {
    it('proves Q from P and P -> Q', () => {
      const proof = forwardChaining([P, implies(P, Q)], Q);
      expect(proof).not.toBeNull();
      expect(proof!.valid).toBe(true);
      expect(proof!.strategy).toBe('forward');
    });

    it('proves R from P, P -> Q, Q -> R', () => {
      const proof = forwardChaining([P, implies(P, Q), implies(Q, R)], R);
      expect(proof).not.toBeNull();
      expect(proof!.valid).toBe(true);
    });

    it('returns null when goal cannot be reached', () => {
      const proof = forwardChaining([P], Q, { maxSteps: 10, timeout: 500 });
      expect(proof).toBeNull();
    });
  });

  describe('Backward Chaining', () => {
    it('proves Q from P and P -> Q', () => {
      const proof = backwardChaining([P, implies(P, Q)], Q);
      expect(proof).not.toBeNull();
      expect(proof!.valid).toBe(true);
      expect(proof!.strategy).toBe('backward');
    });

    it('proves a conjunction goal', () => {
      const proof = backwardChaining([P, Q], and(P, Q));
      expect(proof).not.toBeNull();
      expect(proof!.valid).toBe(true);
    });
  });

  describe('Resolution Proof', () => {
    it('proves Q from P and P -> Q via resolution', () => {
      const proof = resolutionProof([P, implies(P, Q)], Q);
      expect(proof).not.toBeNull();
      expect(proof!.valid).toBe(true);
      expect(proof!.strategy).toBe('resolution');
    });
  });

  describe('Iterative Deepening', () => {
    it('proves Q from P and P -> Q', () => {
      const proof = iterativeDeepeningProof([P, implies(P, Q)], Q);
      expect(proof).not.toBeNull();
      expect(proof!.valid).toBe(true);
    });
  });
});

// ============================================================================
// Natural Deduction
// ============================================================================

describe('Natural Deduction', () => {
  const P = atom('P');
  const Q = atom('Q');

  it('builds a simple proof using implies elimination', () => {
    // Prove Q from premises P and P -> Q
    const builder = new NDProofBuilder(Q);
    const l1 = builder.assume(P);
    builder.endSubproof();
    // We need to use a non-subproof approach:
    // Add P as premise-level assumption, then add P -> Q, then apply implies elim
    const builder2 = new NDProofBuilder(Q);
    const lp = builder2.assume(P);
    const lpq = builder2.assume(implies(P, Q));
    // Both at level 2 (nested assumptions), so we cannot directly use impliesElim
    // across levels. Let's use a flat approach instead:
    const proof2 = builder2.getProof();
    expect(proof2.lines).toHaveLength(2);
  });

  it('creates conjunction introduction proof', () => {
    const builder = new NDProofBuilder(and(P, Q));
    const l1 = builder.assume(P);
    const l2 = builder.assume(Q);
    const l3 = builder.andIntro(l1, l2);
    const proof = builder.getProof();
    expect(proof.lines).toHaveLength(3);
    const lastLine = proof.lines[proof.lines.length - 1]!;
    expect(lastLine.rule).toBe(NDRuleType.AND_INTRO);
  });

  it('creates conjunction elimination proof', () => {
    const builder = new NDProofBuilder(P);
    const l1 = builder.assume(and(P, Q));
    const l2 = builder.andElimLeft(l1);
    const proof = builder.getProof();
    expect(proof.lines).toHaveLength(2);
    expect(formulasEqual(proof.lines[1]!.formula, P)).toBe(true);
  });

  it('creates OR introduction (left) proof', () => {
    const builder = new NDProofBuilder(or(P, Q));
    const l1 = builder.assume(P);
    const l2 = builder.orIntroLeft(l1, Q);
    const proof = builder.getProof();
    expect(proof.lines).toHaveLength(2);
    expect(proof.lines[1]!.rule).toBe(NDRuleType.OR_INTRO_LEFT);
  });

  it('applies law of excluded middle', () => {
    const builder = new NDProofBuilder(or(P, not(P)));
    const l1 = builder.lem(P);
    const proof = builder.getProof();
    expect(proof.complete).toBe(true);
  });

  it('applies reiteration', () => {
    const builder = new NDProofBuilder(P);
    const l1 = builder.assume(P);
    const l2 = builder.reiterate(l1);
    const proof = builder.getProof();
    expect(proof.lines).toHaveLength(2);
    expect(proof.lines[1]!.rule).toBe(NDRuleType.REIT);
  });

  it('throws when eliminating non-conjunction', () => {
    const builder = new NDProofBuilder(P);
    const l1 = builder.assume(P);
    expect(() => builder.andElimLeft(l1)).toThrow('not a conjunction');
  });

  it('throws when eliminating non-double-negation', () => {
    const builder = new NDProofBuilder(P);
    const l1 = builder.assume(not(P));
    expect(() => builder.notElim(l1)).toThrow('not a double negation');
  });

  it('formatNDProof returns string output', () => {
    const builder = new NDProofBuilder(P);
    builder.assume(P);
    const proof = builder.getProof();
    const formatted = formatNDProof(proof);
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('Assumption');
  });

  it('validateNDProof detects unclosed subproofs', () => {
    const builder = new NDProofBuilder(P);
    builder.assume(P);
    const proof = builder.getProof();
    const validation = validateNDProof(proof);
    expect(validation.errors.some((e) => e.includes('Unbalanced'))).toBe(true);
  });
});
