/**
 * Shared Session type for the API's auth injection point.
 *
 * `createHandler()` (see index.ts) takes an `auth` function matching this
 * shape and closes over it per-handler — there is no shared mutable module
 * state. Each Next.js route that calls `createHandler({ auth })` gets its
 * own handler bound to its own auth function.
 */
export interface Session {
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
  expires?: string;
}
