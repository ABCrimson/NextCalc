/**
 * Configurable Auth Module
 *
 * Provides a swappable auth() function. The real implementation is injected
 * at runtime via setAuthFunction() when the API runs inside the Next.js process.
 * Falls back to a stub returning null when no auth function is configured
 * (e.g., during testing or standalone use).
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

type AuthFunction = () => Promise<Session | null>;

let authFn: AuthFunction = async () => null;

/**
 * Inject the real auth function at runtime.
 * Called from createHandler() in index.ts when the web app provides auth.
 */
export function setAuthFunction(fn: AuthFunction): void {
  authFn = fn;
}

/**
 * Get the current session. Delegates to the injected auth function
 * or returns null if none is configured.
 */
export async function auth(): Promise<Session | null> {
  return authFn();
}
