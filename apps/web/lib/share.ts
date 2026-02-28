/**
 * Share functionality for NextCalc Pro
 *
 * Supports two URL formats:
 *   1. Readable params: /?expr=sin(pi%2F4)&result=0.7071&mode=approximate&angle=deg
 *   2. Opaque base64 payload (for complex plot configs): /?share=<base64>
 *
 * The readable format is always preferred for basic calculations.
 * The opaque format is used when a `config` object (e.g. plot config) is included.
 *
 * @module lib/share
 */

/** Canonical calculator modes that may appear in shared URLs. */
export type ShareMode = 'exact' | 'approximate';

/** Canonical angle modes that may appear in shared URLs. */
export type ShareAngleMode = 'deg' | 'rad';

/** Calculator type (determines routing). */
export type ShareType = 'basic' | 'matrix' | 'solver' | 'plot' | 'stats';

/** Full shareable calculation payload. */
export interface SharePayload {
  readonly expression: string;
  readonly result?: string;
  readonly mode?: ShareMode;
  readonly angle?: ShareAngleMode;
  readonly type?: ShareType;
  /** Optional structured config (e.g. plot settings). Triggers base64 encoding. */
  readonly config?: Record<string, unknown>;
}

/** Parsed result from reading URL search params. */
export type ParsedSharePayload =
  | { readonly format: 'readable'; readonly data: SharePayload }
  | { readonly format: 'base64'; readonly data: SharePayload }
  | { readonly format: 'none' };

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

/**
 * Encodes a SharePayload to a base64 URL-safe string (for complex payloads).
 * Uses `btoa(encodeURIComponent(json))` so the result is safe to embed in URLs.
 */
export function encodeCalculation(data: SharePayload): string {
  const json = JSON.stringify(data);
  return btoa(encodeURIComponent(json));
}

/**
 * Decodes a base64 payload produced by `encodeCalculation`.
 * Returns `null` if the string is malformed.
 */
export function decodeCalculation(encoded: string): SharePayload | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    // Runtime type guard — we only trust the shape, not cast blindly
    const obj = parsed as Record<string, unknown>;
    const expression = typeof obj['expression'] === 'string' ? obj['expression'] : '';
    return {
      expression,
      ...(typeof obj['result'] === 'string' ? { result: obj['result'] } : {}),
      ...(obj['mode'] === 'exact' || obj['mode'] === 'approximate'
        ? { mode: obj['mode'] }
        : {}),
      ...(obj['angle'] === 'deg' || obj['angle'] === 'rad'
        ? { angle: obj['angle'] }
        : {}),
      ...(obj['type'] === 'basic' ||
      obj['type'] === 'matrix' ||
      obj['type'] === 'solver' ||
      obj['type'] === 'plot' ||
      obj['type'] === 'stats'
        ? { type: obj['type'] }
        : {}),
      ...(typeof obj['config'] === 'object' && obj['config'] !== null
        ? { config: obj['config'] as Record<string, unknown> }
        : {}),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// URL building
// ---------------------------------------------------------------------------

/**
 * Returns the base URL for share links.
 * Uses `window.location.origin` in the browser, falls back to the production domain.
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://nextcalc.pro';
}

/**
 * Creates a shareable URL for the given calculation.
 *
 * - When `data.config` is present the full payload is base64-encoded into `?share=`.
 * - Otherwise individual readable params are used:
 *   `?expr=...&result=...&mode=...&angle=...`
 */
export function createShareUrl(data: SharePayload): string {
  const base = getBaseUrl();
  const route = data.type && data.type !== 'basic' ? `/${data.type}` : '/';
  const origin = `${base}${route}`;

  // If a config object is present, fall back to opaque base64 encoding so all
  // structured data round-trips faithfully.
  if (data.config !== undefined) {
    const encoded = encodeCalculation(data);
    return `${origin}?share=${encoded}`;
  }

  const params = new URLSearchParams();
  if (data.expression) params.set('expr', data.expression);
  if (data.result !== undefined) params.set('result', data.result);
  if (data.mode !== undefined) params.set('mode', data.mode);
  if (data.angle !== undefined) params.set('angle', data.angle);

  const qs = params.toString();
  return qs ? `${origin}?${qs}` : origin;
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/**
 * Parses URL search params to extract a `SharePayload`.
 *
 * Handles both readable (`?expr=...`) and opaque (`?share=...`) formats.
 * Returns `{ format: 'none' }` when no share params are present.
 */
export function parseShareParams(searchParams: URLSearchParams): ParsedSharePayload {
  // Opaque base64 format takes precedence when present
  const shareParam = searchParams.get('share');
  if (shareParam) {
    const data = decodeCalculation(shareParam);
    if (data) return { format: 'base64', data };
    // Malformed — treat as no share
    return { format: 'none' };
  }

  // Readable format
  const expr = searchParams.get('expr');
  if (!expr) return { format: 'none' };

  const result = searchParams.get('result');
  const rawMode = searchParams.get('mode');
  const rawAngle = searchParams.get('angle');

  const mode: ShareMode | undefined =
    rawMode === 'exact' || rawMode === 'approximate' ? rawMode : undefined;
  const angle: ShareAngleMode | undefined =
    rawAngle === 'deg' || rawAngle === 'rad' ? rawAngle : undefined;

  return {
    format: 'readable',
    data: {
      expression: expr,
      ...(result !== null ? { result } : {}),
      ...(mode !== undefined ? { mode } : {}),
      ...(angle !== undefined ? { angle } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Permalink URLs (backed by database via GraphQL mutation)
// ---------------------------------------------------------------------------

/**
 * Build a permalink URL from a short code.
 * Format: `{origin}/share/{shortCode}`
 */
export function createPermalinkUrl(shortCode: string): string {
  const base = getBaseUrl();
  return `${base}/share/${shortCode}`;
}

/**
 * Copy a permalink URL to the clipboard.
 * Returns `true` on success.
 */
export async function copyPermalinkUrl(shortCode: string): Promise<boolean> {
  try {
    const url = createPermalinkUrl(shortCode);
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Clipboard & Web Share API
// ---------------------------------------------------------------------------

/**
 * Copies the share URL for the given payload to the system clipboard.
 * Returns `true` on success.
 */
export async function copyShareUrl(data: SharePayload): Promise<boolean> {
  try {
    const url = createShareUrl(data);
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the native share sheet (Web Share API).
 * Returns `false` if the API is unavailable or the user cancelled.
 */
export async function shareViaWebAPI(
  data: SharePayload,
  title = 'NextCalc Pro Calculation',
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;

  try {
    const url = createShareUrl(data);
    await navigator.share({
      title,
      text: data.expression
        ? `${data.expression}${data.result ? ` = ${data.result}` : ''}`
        : 'Check out this calculation on NextCalc Pro!',
      url,
    });
    return true;
  } catch (err) {
    // AbortError means the user dismissed — not a true failure
    if (err instanceof DOMException && err.name === 'AbortError') return false;
    return false;
  }
}
