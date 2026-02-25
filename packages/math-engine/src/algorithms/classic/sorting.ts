/**
 * Classic Sorting Algorithms
 *
 * Educational implementations of fundamental sorting algorithms with
 * complexity analysis and step tracking.
 */

/**
 * Sorting result with step tracking
 */
export interface SortResult<T> {
  /** Sorted array */
  readonly sorted: ReadonlyArray<T>;
  /** Number of comparisons */
  readonly comparisons: number;
  /** Number of swaps */
  readonly swaps: number;
  /** Time taken in milliseconds */
  readonly timeMs: number;
}

/**
 * Comparison function type
 */
export type CompareFn<T> = (a: T, b: T) => number;

// ============================================================================
// QUICK SORT
// ============================================================================

/**
 * QuickSort - Divide and Conquer Algorithm
 *
 * Time Complexity:
 * - Best: O(n log n)
 * - Average: O(n log n)
 * - Worst: O(n²) - when pivot is always min/max
 *
 * Space Complexity: O(log n) - recursion stack
 *
 * Properties:
 * - Not stable (relative order of equal elements may change)
 * - In-place sorting
 * - Typically faster than merge sort in practice
 */
export function quickSort<T>(
  arr: ReadonlyArray<T>,
  compareFn: CompareFn<T> = (a, b) => (a as number) - (b as number)
): SortResult<T> {
  const startTime = performance.now();
  let comparisons = 0;
  let swaps = 0;

  const result = [...arr];

  function partition(low: number, high: number): number {
    const pivot = result[high]!;
    let i = low - 1;

    for (let j = low; j < high; j++) {
      comparisons++;
      if (compareFn(result[j]!, pivot) <= 0) {
        i++;
        const temp = result[i]!;
        result[i] = result[j]!;
        result[j] = temp;
        swaps++;
      }
    }

    const temp = result[i + 1]!;
    result[i + 1] = result[high]!;
    result[high] = temp;
    swaps++;
    return i + 1;
  }

  function quickSortRecursive(low: number, high: number): void {
    if (low < high) {
      const pi = partition(low, high);
      quickSortRecursive(low, pi - 1);
      quickSortRecursive(pi + 1, high);
    }
  }

  quickSortRecursive(0, result.length - 1);

  const endTime = performance.now();

  return {
    sorted: result,
    comparisons,
    swaps,
    timeMs: endTime - startTime,
  };
}

// ============================================================================
// MERGE SORT
// ============================================================================

/**
 * MergeSort - Divide and Conquer Algorithm
 *
 * Time Complexity:
 * - Best: O(n log n)
 * - Average: O(n log n)
 * - Worst: O(n log n)
 *
 * Space Complexity: O(n) - temporary arrays
 *
 * Properties:
 * - Stable (preserves relative order of equal elements)
 * - Predictable performance
 * - Good for linked lists
 */
export function mergeSort<T>(
  arr: ReadonlyArray<T>,
  compareFn: CompareFn<T> = (a, b) => (a as number) - (b as number)
): SortResult<T> {
  const startTime = performance.now();
  let comparisons = 0;
  let swaps = 0;

  function merge(left: T[], right: T[]): T[] {
    const result: T[] = [];
    let i = 0;
    let j = 0;

    while (i < left.length && j < right.length) {
      comparisons++;
      if (compareFn(left[i]!, right[j]!) <= 0) {
        result.push(left[i]!);
        i++;
      } else {
        result.push(right[j]!);
        j++;
      }
      swaps++;
    }

    return result.concat(left.slice(i)).concat(right.slice(j));
  }

  function mergeSortRecursive(arr: T[]): T[] {
    if (arr.length <= 1) {
      return arr;
    }

    const mid = Math.floor(arr.length / 2);
    const left = mergeSortRecursive(arr.slice(0, mid));
    const right = mergeSortRecursive(arr.slice(mid));

    return merge(left, right);
  }

  const sorted = mergeSortRecursive([...arr]);
  const endTime = performance.now();

  return {
    sorted,
    comparisons,
    swaps,
    timeMs: endTime - startTime,
  };
}

// ============================================================================
// HEAP SORT
// ============================================================================

/**
 * HeapSort - Heap-based Selection Sort
 *
 * Time Complexity:
 * - Best: O(n log n)
 * - Average: O(n log n)
 * - Worst: O(n log n)
 *
 * Space Complexity: O(1) - in-place
 *
 * Properties:
 * - Not stable
 * - In-place sorting
 * - Guaranteed O(n log n) performance
 */
export function heapSort<T>(
  arr: ReadonlyArray<T>,
  compareFn: CompareFn<T> = (a, b) => (a as number) - (b as number)
): SortResult<T> {
  const startTime = performance.now();
  let comparisons = 0;
  let swaps = 0;

  const result = [...arr];
  const n = result.length;

  function heapify(n: number, i: number): void {
    let largest = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;

    if (left < n) {
      comparisons++;
      if (compareFn(result[left]!, result[largest]!) > 0) {
        largest = left;
      }
    }

    if (right < n) {
      comparisons++;
      if (compareFn(result[right]!, result[largest]!) > 0) {
        largest = right;
      }
    }

    if (largest !== i) {
      const temp = result[i]!;
      result[i] = result[largest]!;
      result[largest] = temp;
      swaps++;
      heapify(n, largest);
    }
  }

  // Build max heap
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(n, i);
  }

  // Extract elements from heap
  for (let i = n - 1; i > 0; i--) {
    const temp = result[0]!;
    result[0] = result[i]!;
    result[i] = temp;
    swaps++;
    heapify(i, 0);
  }

  const endTime = performance.now();

  return {
    sorted: result,
    comparisons,
    swaps,
    timeMs: endTime - startTime,
  };
}

// ============================================================================
// COMPARISON AND BENCHMARKING
// ============================================================================

/**
 * Compare multiple sorting algorithms
 */
export function compareSortingAlgorithms<T>(
  arr: ReadonlyArray<T>,
  compareFn?: CompareFn<T>
): {
  quickSort: SortResult<T>;
  mergeSort: SortResult<T>;
  heapSort: SortResult<T>;
} {
  return {
    quickSort: quickSort(arr, compareFn),
    mergeSort: mergeSort(arr, compareFn),
    heapSort: heapSort(arr, compareFn),
  };
}

/**
 * Generate test arrays
 */
export function generateTestArray(size: number, type: 'random' | 'sorted' | 'reverse'): number[] {
  const arr = Array.from({ length: size }, (_, i) => i);

  switch (type) {
    case 'random':
      return arr.sort(() => Math.random() - 0.5);
    case 'sorted':
      return arr;
    case 'reverse':
      return arr.reverse();
    default:
      return arr;
  }
}
