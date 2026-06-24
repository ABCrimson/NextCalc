/**
 * Node-environment mock for the `cloudflare:workers` virtual module.
 *
 * This file is only used by Vitest (node environment). The real
 * `cloudflare:workers` module is provided by the Cloudflare runtime and
 * is not available in Node. We expose a minimal DurableObject base class
 * so that tests can import modules that extend it without crashing.
 *
 * The DO class itself is never instantiated during node-based tests — only
 * the pure helper functions and the Hono routes are exercised.
 */

export class DurableObject<Env = unknown> {
  ctx: DurableObjectState;
  env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
