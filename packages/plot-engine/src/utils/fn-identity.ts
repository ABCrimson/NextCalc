/**
 * Stable numeric identity for function closures.
 *
 * Used anywhere a plotted function needs to participate in change-detection
 * (config hashing, sampled-point caching) without resorting to `fn.toString()`:
 *
 *  - O(1) lookup instead of O(source length) stringification
 *  - captures *closure* identity, not source text — two functions created
 *    from identical source but capturing different free variables (or simply
 *    two separate arrow function literals) get distinct ids
 *  - entries are garbage-collected once the function is no longer referenced
 *    anywhere else, since the registry is a WeakMap
 *
 * @module utils/fn-identity
 */

const registry = new WeakMap<object, number>();
let nextId = 1;

/**
 * Returns a stable, process-wide unique id for a given function reference.
 * The same function object always returns the same id on every call;
 * a different function object (even with byte-identical source) always
 * gets a different id.
 */
export function getFunctionId(fn: object): number {
  let id = registry.get(fn);
  if (id === undefined) {
    id = nextId++;
    registry.set(fn, id);
  }
  return id;
}
