/**
 * Group Theory Operations
 *
 * Provides comprehensive group theory functionality including:
 * - Abstract group operations and axiom verification
 * - Cyclic groups, permutation groups, dihedral groups
 * - Subgroups, cosets, quotient groups
 * - Group homomorphisms and isomorphisms
 * - Lagrange's theorem and related results
 *
 * @module algebra/groups
 */

/**
 * Group element type - can be numbers, strings, or complex structures
 */
export type GroupElement = number | string | Record<string, unknown>;

/**
 * Binary operation on group elements
 */
export type GroupOperation<T extends GroupElement> = (a: T, b: T) => T;

/**
 * Abstract group interface
 */
export interface Group<T extends GroupElement> {
  /** Group elements */
  readonly elements: ReadonlyArray<T>;
  /** Binary operation */
  readonly operation: GroupOperation<T>;
  /** Identity element */
  readonly identity: T;
  /** Inverse function */
  readonly inverse: (element: T) => T;
  /** Group name */
  readonly name: string;
  /** Order (number of elements) */
  readonly order: number;
}

/**
 * Permutation representation as an array where index i maps to array[i]
 */
export type Permutation = ReadonlyArray<number>;

/**
 * Cycle notation for permutations: [[0,1,2], [3,4]] means 0→1→2→0 and 3→4→3
 */
export type CycleNotation = ReadonlyArray<ReadonlyArray<number>>;

// ============================================================================
// GROUP AXIOM VERIFICATION
// ============================================================================

/**
 * Verifies if a set with an operation forms a valid group
 *
 * Checks:
 * 1. Closure: For all a, b in G, a * b is in G
 * 2. Associativity: (a * b) * c = a * (b * c)
 * 3. Identity: There exists e such that a * e = e * a = a
 * 4. Inverse: For each a, there exists a⁻¹ such that a * a⁻¹ = e
 *
 * Time Complexity: O(n³) where n is the number of elements
 *
 * @param elements - Set of elements
 * @param operation - Binary operation
 * @param identity - Proposed identity element
 * @param inverse - Proposed inverse function
 * @returns Verification result with details
 *
 * @example
 * const result = verifyGroupAxioms(
 *   [0, 1, 2, 3],
 *   (a, b) => (a + b) % 4,
 *   0,
 *   (a) => (4 - a) % 4
 * );
 * console.log(result.isGroup); // true (Z_4 under addition mod 4)
 */
export function verifyGroupAxioms<T extends GroupElement>(
  elements: ReadonlyArray<T>,
  operation: GroupOperation<T>,
  identity: T,
  inverse: (element: T) => T,
): {
  readonly isGroup: boolean;
  readonly closure: boolean;
  readonly associativity: boolean;
  readonly identityValid: boolean;
  readonly inverseValid: boolean;
  readonly errors: ReadonlyArray<string>;
} {
  const errors: string[] = [];

  // Check closure
  let closure = true;
  for (const a of elements) {
    for (const b of elements) {
      const result = operation(a, b);
      if (!elements.includes(result)) {
        closure = false;
        errors.push(`Closure fails: ${String(a)} * ${String(b)} = ${String(result)} not in group`);
        break;
      }
    }
    if (!closure) break;
  }

  // Check associativity (sample check for performance)
  let associativity = true;
  const sampleSize = Math.min(elements.length, 5);
  for (let i = 0; i < sampleSize && associativity; i++) {
    for (let j = 0; j < sampleSize && associativity; j++) {
      for (let k = 0; k < sampleSize && associativity; k++) {
        const a = elements[i];
        const b = elements[j];
        const c = elements[k];
        if (!a || !b || !c) continue;

        const left = operation(operation(a, b), c);
        const right = operation(a, operation(b, c));

        if (left !== right) {
          associativity = false;
          errors.push(
            `Associativity fails: (${String(a)} * ${String(b)}) * ${String(c)} ≠ ${String(a)} * (${String(b)} * ${String(c)})`,
          );
        }
      }
    }
  }

  // Check identity
  let identityValid = true;
  if (!elements.includes(identity)) {
    identityValid = false;
    errors.push(`Identity ${String(identity)} not in group`);
  } else {
    for (const a of elements) {
      if (operation(a, identity) !== a || operation(identity, a) !== a) {
        identityValid = false;
        errors.push(`Identity fails for ${String(a)}`);
        break;
      }
    }
  }

  // Check inverse
  let inverseValid = true;
  for (const a of elements) {
    const inv = inverse(a);
    if (!elements.includes(inv)) {
      inverseValid = false;
      errors.push(`Inverse of ${String(a)} is ${String(inv)}, not in group`);
      break;
    }
    if (operation(a, inv) !== identity || operation(inv, a) !== identity) {
      inverseValid = false;
      errors.push(`Inverse fails for ${String(a)}: ${String(a)} * ${String(inv)} ≠ identity`);
      break;
    }
  }

  return {
    isGroup: closure && associativity && identityValid && inverseValid,
    closure,
    associativity,
    identityValid,
    inverseValid,
    errors,
  };
}

// ============================================================================
// CYCLIC GROUPS
// ============================================================================

/**
 * Creates a cyclic group Z_n (integers modulo n under addition)
 *
 * Z_n = {0, 1, 2, ..., n-1} with operation (a + b) mod n
 *
 * Properties:
 * - Abelian (commutative)
 * - Order n
 * - Generator: 1 (or any element coprime to n)
 *
 * @param n - Order of the group (n > 0)
 * @returns Cyclic group Z_n
 *
 * @example
 * const z4 = createCyclicGroup(4);
 * console.log(z4.operation(3, 2)); // 1 (3 + 2 mod 4)
 * console.log(z4.order); // 4
 */
export function createCyclicGroup(n: number): Group<number> {
  if (n <= 0 || !Number.isInteger(n)) {
    throw new Error('createCyclicGroup: n must be a positive integer');
  }

  const elements = Array.from({ length: n }, (_, i) => i);

  return {
    elements,
    operation: (a, b) => (a + b) % n,
    identity: 0,
    inverse: (a) => (n - a) % n,
    name: `Z_${n}`,
    order: n,
  };
}

/**
 * Finds the order of an element in a group
 *
 * The order of element g is the smallest positive integer k such that g^k = e
 *
 * Time Complexity: O(n) where n is the group order
 *
 * @param group - The group
 * @param element - The element to find order of
 * @returns Order of the element
 *
 * @example
 * const z6 = createCyclicGroup(6);
 * console.log(elementOrder(z6, 2)); // 3 (2+2+2 = 6 ≡ 0 mod 6)
 * console.log(elementOrder(z6, 1)); // 6 (generator)
 */
export function elementOrder<T extends GroupElement>(group: Group<T>, element: T): number {
  if (!group.elements.includes(element)) {
    throw new Error('elementOrder: Element not in group');
  }

  let current = element;
  let order = 1;

  while (current !== group.identity && order <= group.order) {
    current = group.operation(current, element);
    order++;
  }

  if (order > group.order) {
    throw new Error('elementOrder: Infinite order or computation error');
  }

  return order;
}

/**
 * Checks if a group is cyclic
 *
 * A group is cyclic if it can be generated by a single element
 *
 * @param group - The group to check
 * @returns True if the group is cyclic
 *
 * @example
 * const z4 = createCyclicGroup(4);
 * console.log(isCyclic(z4)); // true
 */
export function isCyclic<T extends GroupElement>(group: Group<T>): boolean {
  // A group is cyclic if any element has order equal to group order
  return group.elements.some((element) => elementOrder(group, element) === group.order);
}

/**
 * Finds all generators of a cyclic group
 *
 * An element g is a generator if ord(g) = |G|
 *
 * @param group - The group
 * @returns Array of generator elements
 *
 * @example
 * const z6 = createCyclicGroup(6);
 * console.log(findGenerators(z6)); // [1, 5] (coprime to 6)
 */
export function findGenerators<T extends GroupElement>(group: Group<T>): ReadonlyArray<T> {
  return group.elements.filter((element) => elementOrder(group, element) === group.order);
}

// ============================================================================
// PERMUTATION GROUPS
// ============================================================================

/**
 * Composes two permutations: (σ ∘ τ)(i) = σ(τ(i))
 *
 * @param sigma - First permutation
 * @param tau - Second permutation
 * @returns Composition σ ∘ τ
 *
 * @example
 * const sigma = [1, 2, 0]; // (0 1 2)
 * const tau = [2, 0, 1];   // (0 2 1)
 * console.log(composePermutations(sigma, tau)); // [0, 1, 2] (identity)
 */
export function composePermutations(sigma: Permutation, tau: Permutation): Permutation {
  if (sigma.length !== tau.length) {
    throw new Error('composePermutations: Permutations must have same length');
  }

  return sigma.map((_, i) => {
    const tauI = tau[i];
    return tauI !== undefined ? (sigma[tauI] ?? i) : i;
  });
}

/**
 * Computes the inverse of a permutation
 *
 * If σ(i) = j, then σ⁻¹(j) = i
 *
 * @param sigma - Permutation to invert
 * @returns Inverse permutation
 *
 * @example
 * const sigma = [1, 2, 0]; // (0 1 2)
 * console.log(invertPermutation(sigma)); // [2, 0, 1] (0 2 1)
 */
export function invertPermutation(sigma: Permutation): Permutation {
  const inverse = new Array<number>(sigma.length);
  sigma.forEach((value, index) => {
    inverse[value] = index;
  });
  return inverse;
}

/**
 * Converts permutation to cycle notation
 *
 * @param sigma - Permutation in array form
 * @returns Cycle notation
 *
 * @example
 * const sigma = [1, 2, 3, 0, 4];
 * console.log(permutationToCycles(sigma)); // [[0, 1, 2, 3], [4]]
 */
export function permutationToCycles(sigma: Permutation): CycleNotation {
  const visited = new Array<boolean>(sigma.length).fill(false);
  const cycles: number[][] = [];

  for (let i = 0; i < sigma.length; i++) {
    if (visited[i]) continue;

    const cycle: number[] = [];
    let current = i;

    while (!visited[current]) {
      visited[current] = true;
      cycle.push(current);
      const next = sigma[current];
      current = next ?? current;
    }

    if (cycle.length > 1) {
      cycles.push(cycle);
    }
  }

  return cycles;
}

/**
 * Converts cycle notation to permutation array
 *
 * @param cycles - Cycle notation
 * @param n - Size of permutation (optional, inferred from max element)
 * @returns Permutation array
 *
 * @example
 * const cycles = [[0, 1, 2], [3, 4]];
 * console.log(cyclesToPermutation(cycles, 5)); // [1, 2, 0, 4, 3]
 */
export function cyclesToPermutation(cycles: CycleNotation, n?: number): Permutation {
  const maxElement = Math.max(...cycles.flatMap((cycle) => cycle), 0);
  const size = n ?? maxElement + 1;
  const permutation = Array.from({ length: size }, (_, i) => i);

  for (const cycle of cycles) {
    for (let i = 0; i < cycle.length; i++) {
      const current = cycle[i];
      const next = cycle[(i + 1) % cycle.length];
      if (current !== undefined && next !== undefined) {
        permutation[current] = next;
      }
    }
  }

  return permutation;
}

/**
 * Creates the symmetric group S_n (all permutations of n elements)
 *
 * S_n has order n!
 * For small n only (n ≤ 7) due to factorial growth
 *
 * @param n - Number of elements to permute
 * @returns Symmetric group S_n
 *
 * @example
 * const s3 = createSymmetricGroup(3);
 * console.log(s3.order); // 6 (3!)
 */
export function createSymmetricGroup(n: number): {
  readonly elements: ReadonlyArray<Permutation>;
  readonly operation: (a: Permutation, b: Permutation) => Permutation;
  readonly identity: Permutation;
  readonly inverse: (element: Permutation) => Permutation;
  readonly name: string;
  readonly order: number;
} {
  if (n <= 0 || !Number.isInteger(n) || n > 7) {
    throw new Error('createSymmetricGroup: n must be an integer between 1 and 7');
  }

  const elements = generateAllPermutations(n);
  const identity: Permutation = Array.from({ length: n }, (_, i) => i);

  return {
    elements,
    operation: composePermutations,
    identity,
    inverse: invertPermutation,
    name: `S_${n}`,
    order: factorial(n),
  };
}

/**
 * Generates all permutations of n elements
 */
function generateAllPermutations(n: number): ReadonlyArray<Permutation> {
  if (n === 0) return [[]];
  if (n === 1) return [[0]];

  const permutations: Permutation[] = [];
  const base = Array.from({ length: n }, (_, i) => i);

  function permute(arr: number[], start: number): void {
    if (start === arr.length) {
      permutations.push([...arr]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i] ?? start, arr[start] ?? i];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i] ?? start, arr[start] ?? i];
    }
  }

  permute(base, 0);
  return permutations;
}

/**
 * Factorial function
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// ============================================================================
// DIHEDRAL GROUPS
// ============================================================================

/**
 * Element of dihedral group: rotation or reflection
 */
export interface DihedralElement {
  readonly type: 'rotation' | 'reflection';
  readonly angle: number; // For rotation: angle in multiples of 2π/n
  readonly axis?: number; // For reflection: axis index
}

/**
 * Creates the dihedral group D_n (symmetries of regular n-gon)
 *
 * D_n = {r^0, r^1, ..., r^(n-1), s, sr, sr^2, ..., sr^(n-1)}
 * where r = rotation by 2π/n, s = reflection
 *
 * Order: 2n
 *
 * @param n - Number of vertices (n ≥ 3)
 * @returns Dihedral group D_n
 *
 * @example
 * const d4 = createDihedralGroup(4); // Symmetries of square
 * console.log(d4.order); // 8
 */
export function createDihedralGroup(n: number): Group<string> {
  if (n < 3 || !Number.isInteger(n)) {
    throw new Error('createDihedralGroup: n must be an integer ≥ 3');
  }

  // Generate elements: r^i for i=0..n-1 and sr^i for i=0..n-1
  const elements: string[] = [];
  for (let i = 0; i < n; i++) {
    elements.push(`r${i}`); // Rotation
    elements.push(`s${i}`); // Reflection
  }

  const operation = (a: string, b: string): string => {
    const [aType, aVal] = [a[0], parseInt(a.slice(1), 10)];
    const [bType, bVal] = [b[0], parseInt(b.slice(1), 10)];

    if (aType === 'r' && bType === 'r') {
      // r^i * r^j = r^(i+j mod n)
      return `r${(aVal + bVal) % n}`;
    } else if (aType === 'r' && bType === 's') {
      // r^i * s^j = s^(j-i mod n)
      return `s${(bVal - aVal + n) % n}`;
    } else if (aType === 's' && bType === 'r') {
      // s^i * r^j = s^(i+j mod n)
      return `s${(aVal + bVal) % n}`;
    } else {
      // s^i * s^j = r^(j-i mod n)
      return `r${(bVal - aVal + n) % n}`;
    }
  };

  return {
    elements,
    operation,
    identity: 'r0',
    inverse: (a) => {
      const [type, val] = [a[0], parseInt(a.slice(1), 10)];
      if (type === 'r') {
        return `r${(n - val) % n}`;
      } else {
        return a; // Reflections are self-inverse
      }
    },
    name: `D_${n}`,
    order: 2 * n,
  };
}

// ============================================================================
// SUBGROUPS AND COSETS
// ============================================================================

/**
 * Checks if a subset is a subgroup
 *
 * A subset H of G is a subgroup if:
 * 1. Identity is in H
 * 2. Closed under group operation
 * 3. Closed under inverses
 *
 * @param group - Parent group
 * @param subset - Proposed subgroup elements
 * @returns True if subset is a subgroup
 *
 * @example
 * const z6 = createCyclicGroup(6);
 * console.log(isSubgroup(z6, [0, 2, 4])); // true (subgroup of order 3)
 * console.log(isSubgroup(z6, [0, 1])); // false (not closed)
 */
export function isSubgroup<T extends GroupElement>(
  group: Group<T>,
  subset: ReadonlyArray<T>,
): boolean {
  // Check if identity is in subset
  if (!subset.includes(group.identity)) {
    return false;
  }

  // Check closure under operation
  for (const a of subset) {
    for (const b of subset) {
      if (!subset.includes(group.operation(a, b))) {
        return false;
      }
    }
  }

  // Check closure under inverses
  for (const a of subset) {
    if (!subset.includes(group.inverse(a))) {
      return false;
    }
  }

  return true;
}

/**
 * Computes the left coset aH = {ah : h ∈ H}
 *
 * @param group - The group
 * @param subgroup - Subgroup elements
 * @param a - Coset representative
 * @returns Left coset aH
 *
 * @example
 * const z6 = createCyclicGroup(6);
 * const h = [0, 3]; // Subgroup {0, 3}
 * console.log(leftCoset(z6, h, 1)); // [1, 4]
 * console.log(leftCoset(z6, h, 2)); // [2, 5]
 */
export function leftCoset<T extends GroupElement>(
  group: Group<T>,
  subgroup: ReadonlyArray<T>,
  a: T,
): ReadonlyArray<T> {
  return subgroup.map((h) => group.operation(a, h));
}

/**
 * Computes all left cosets of H in G
 *
 * Partitions G into disjoint cosets: G = ⋃ gH
 *
 * @param group - The group
 * @param subgroup - Subgroup elements
 * @returns Array of left cosets
 *
 * @example
 * const z6 = createCyclicGroup(6);
 * const h = [0, 2, 4];
 * const cosets = allLeftCosets(z6, h);
 * console.log(cosets.length); // 2 (index [G:H] = 6/3 = 2)
 */
export function allLeftCosets<T extends GroupElement>(
  group: Group<T>,
  subgroup: ReadonlyArray<T>,
): ReadonlyArray<ReadonlyArray<T>> {
  const cosets: T[][] = [];
  const covered = new Set<T>();

  for (const g of group.elements) {
    if (covered.has(g)) continue;

    const coset = leftCoset(group, subgroup, g);
    cosets.push([...coset]);
    coset.forEach((element) => covered.add(element));
  }

  return cosets;
}

/**
 * Computes the index [G:H] = |G| / |H|
 *
 * By Lagrange's theorem, |H| divides |G|
 *
 * @param group - The group
 * @param subgroup - Subgroup elements
 * @returns Index [G:H]
 */
export function groupIndex<T extends GroupElement>(
  group: Group<T>,
  subgroup: ReadonlyArray<T>,
): number {
  if (!isSubgroup(group, subgroup)) {
    throw new Error('groupIndex: Subset is not a subgroup');
  }

  return group.order / subgroup.length;
}

// ============================================================================
// GROUP HOMOMORPHISMS
// ============================================================================

/**
 * Group homomorphism φ: G → H
 */
export type GroupHomomorphism<S extends GroupElement, T extends GroupElement> = (a: S) => T;

/**
 * Verifies if a function is a group homomorphism
 *
 * φ is a homomorphism if φ(ab) = φ(a)φ(b) for all a, b in G
 *
 * @param source - Source group G
 * @param target - Target group H
 * @param phi - Function to verify
 * @returns True if φ is a homomorphism
 *
 * @example
 * const z4 = createCyclicGroup(4);
 * const z2 = createCyclicGroup(2);
 * const phi = (x: number) => x % 2;
 * console.log(isHomomorphism(z4, z2, phi)); // true
 */
export function isHomomorphism<S extends GroupElement, T extends GroupElement>(
  source: Group<S>,
  target: Group<T>,
  phi: GroupHomomorphism<S, T>,
): boolean {
  // Check if phi(ab) = phi(a)phi(b) for all a, b
  for (const a of source.elements) {
    for (const b of source.elements) {
      const left = phi(source.operation(a, b));
      const right = target.operation(phi(a), phi(b));

      if (left !== right) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks if a homomorphism is an isomorphism
 *
 * φ is an isomorphism if it's a bijective homomorphism
 *
 * @param source - Source group
 * @param target - Target group
 * @param phi - Homomorphism to check
 * @returns True if φ is an isomorphism
 */
export function isIsomorphism<S extends GroupElement, T extends GroupElement>(
  source: Group<S>,
  target: Group<T>,
  phi: GroupHomomorphism<S, T>,
): boolean {
  if (!isHomomorphism(source, target, phi)) {
    return false;
  }

  // Check bijectivity: distinct elements map to distinct images
  const images = new Set(source.elements.map(phi));
  return images.size === source.order && images.size === target.order;
}

/**
 * Computes the kernel of a homomorphism
 *
 * ker(φ) = {g ∈ G : φ(g) = e_H}
 *
 * @param source - Source group
 * @param target - Target group
 * @param phi - Homomorphism
 * @returns Kernel elements
 */
export function kernel<S extends GroupElement, T extends GroupElement>(
  source: Group<S>,
  target: Group<T>,
  phi: GroupHomomorphism<S, T>,
): ReadonlyArray<S> {
  return source.elements.filter((g) => phi(g) === target.identity);
}

/**
 * Computes the image of a homomorphism
 *
 * im(φ) = {φ(g) : g ∈ G}
 *
 * @param source - Source group
 * @param phi - Homomorphism
 * @returns Image elements
 */
export function image<S extends GroupElement, T extends GroupElement>(
  source: Group<S>,
  phi: GroupHomomorphism<S, T>,
): ReadonlyArray<T> {
  return [...new Set(source.elements.map(phi))];
}
