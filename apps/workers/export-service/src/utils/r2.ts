/**
 * R2 Storage utilities for file upload and presigned URL generation.
 *
 * Private exports (keys under `users/...`) stored in the EXPORTS_PRIVATE
 * bucket are served via cryptographically signed S3 presigned GET URLs
 * (AWS SigV4 via aws4fetch).  Cloudflare R2 exposes an S3-compatible API
 * at `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>/<key>`.
 *
 * Public exports (no userId, EXPORTS_PUBLIC bucket) use a plain public-domain
 * URL — the bucket is intentionally world-readable, so no signing is needed.
 *
 * Required secrets for private exports (provision via `wrangler secret put`):
 *   R2_ACCOUNT_ID         - Cloudflare account ID (found in dashboard)
 *   R2_ACCESS_KEY_ID      - R2 S3-compatible API token Access Key ID
 *   R2_SECRET_ACCESS_KEY  - R2 S3-compatible API token Secret Access Key
 *   R2_PRIVATE_BUCKET     - Name of the private R2 bucket (e.g. nextcalc-exports-private)
 *   R2_PUBLIC_BASE_URL    - Public domain for the public bucket (e.g. https://exports.nextcalc.pro)
 */

import { AwsClient } from 'aws4fetch';

/**
 * R2 bucket binding type from Cloudflare Workers
 */
export interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | Uint8Array | string,
    options?: R2PutOptions,
  ): Promise<R2Object | null>;
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
  head(key: string): Promise<R2Object | null>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  };
  customMetadata?: Record<string, string>;
}

export interface R2GetOptions {
  range?: {
    offset?: number;
    length?: number;
  };
  onlyIf?: {
    etagMatches?: string;
    etagDoesNotMatch?: string;
    uploadedBefore?: Date;
    uploadedAfter?: Date;
  };
}

export interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  startAfter?: string;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: {
    contentType?: string;
  };
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

/**
 * S3-compatible credentials for R2 presigned URL generation.
 * Provision all fields via `wrangler secret put` before deploying.
 */
export interface R2S3Config {
  /** Cloudflare account ID — used to build the R2 S3 endpoint. */
  accountId: string;
  /** R2 API token Access Key ID. */
  accessKeyId: string;
  /** R2 API token Secret Access Key. */
  secretAccessKey: string;
  /** Name of the private R2 bucket (e.g. "nextcalc-exports-private"). */
  privateBucketName: string;
  /** Public base URL for the public bucket (e.g. "https://exports.nextcalc.pro"). */
  publicBaseUrl: string;
}

/**
 * Upload result with metadata
 */
export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
  expiresAt: string;
}

/**
 * Builds a real S3 presigned GET URL for a private R2 object using SigV4
 * (aws4fetch `signQuery: true`).
 *
 * The URL is valid for `expirySeconds` seconds from the time of signing.
 * Cloudflare R2 enforces the `X-Amz-Expires` parameter server-side, so the
 * link becomes invalid after the window closes — no server-side session needed.
 *
 * @param config        - R2 S3 credentials and bucket name
 * @param key           - Object key inside the private bucket
 * @param expirySeconds - Presigned URL lifetime (default: 3600)
 * @returns Presigned URL string containing X-Amz-Signature, X-Amz-Expires,
 *          and X-Amz-Credential query parameters
 */
async function buildPresignedGetUrl(
  config: R2S3Config,
  key: string,
  expirySeconds: number,
): Promise<string> {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const objectUrl = new URL(`${endpoint}/${config.privateBucketName}/${key}`);
  // aws4fetch reads X-Amz-Expires from the URL query when signing an S3 presigned
  // URL (it otherwise defaults to 24h). Set the requested lifetime explicitly so the
  // link's expiry matches `expirySeconds` and is enforced server-side by R2.
  objectUrl.searchParams.set('X-Amz-Expires', String(expirySeconds));

  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    // R2's S3-compatible API uses the "auto" region
    region: 'auto',
    service: 's3',
  });

  // aws4fetch signs the URL query string when signQuery is true, embedding
  // X-Amz-Algorithm, X-Amz-Credential, X-Amz-Date, X-Amz-Expires, and
  // X-Amz-Signature directly in the URL — no Authorization header needed.
  const signed = await client.sign(new Request(objectUrl, { method: 'GET' }), {
    aws: { signQuery: true },
  });

  return signed.url;
}

/**
 * Uploads a file to an R2 bucket.
 *
 * For private exports (isPrivate = true), a real SigV4-presigned GET URL is
 * returned.  The caller MUST supply `r2Config`; missing credentials throw an
 * error rather than falling back to an unsigned URL.
 *
 * For public exports (isPrivate = false), a plain public-domain URL is
 * returned — no signing is needed because the bucket is world-readable.
 *
 * @param bucket      - R2 bucket binding (Workers runtime)
 * @param key         - Object key (file path)
 * @param content     - File content
 * @param contentType - MIME type
 * @param isPrivate   - True for user-scoped private exports
 * @param r2Config    - S3 credentials; required when isPrivate is true
 * @param metadata    - Optional custom metadata
 * @param expirySeconds - Presigned URL lifetime for private exports (default: 3600)
 * @returns Upload result with a correctly signed (private) or public URL
 */
export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  content: ArrayBuffer | Uint8Array | string,
  contentType: string,
  isPrivate: boolean,
  r2Config: R2S3Config | undefined,
  metadata?: Record<string, string>,
  expirySeconds = 3600,
): Promise<UploadResult> {
  if (isPrivate && !r2Config) {
    throw new Error(
      'R2 S3 credentials are required for private exports but were not provided. ' +
        'Provision R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, ' +
        'R2_PRIVATE_BUCKET, and R2_PUBLIC_BASE_URL via `wrangler secret put`.',
    );
  }

  // Upload to R2
  const object = await bucket.put(key, content, {
    httpMetadata: {
      contentType,
      // Short-lived cache — private exports are user-specific
      cacheControl: isPrivate ? 'private, max-age=3600' : 'public, max-age=86400',
    },
    ...(metadata ? { customMetadata: metadata } : {}),
  });

  if (!object) {
    throw new Error('Failed to upload to R2');
  }

  const expiresAt = new Date(Date.now() + expirySeconds * 1000);

  let url: string;

  if (isPrivate && r2Config) {
    url = await buildPresignedGetUrl(r2Config, object.key, expirySeconds);
  } else {
    // Public bucket — plain URL, no signing needed
    const publicBase = r2Config?.publicBaseUrl ?? 'https://exports.nextcalc.pro';
    url = `${publicBase}/${object.key}`;
  }

  return {
    key: object.key,
    url,
    size: object.size,
    contentType,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Generates a presigned (private) or plain-public URL for an R2 object.
 *
 * For private keys the function signs a GET request against the R2 S3
 * endpoint using SigV4 (aws4fetch).  The URL contains X-Amz-Signature,
 * X-Amz-Expires, and X-Amz-Credential — Cloudflare enforces expiry
 * server-side.
 *
 * For public keys a plain `${publicBaseUrl}/${key}` URL is returned.
 *
 * Missing S3 credentials for a private request throw immediately — there is
 * no silent fallback to an unsigned URL.
 *
 * @param bucket        - R2 bucket binding (used to verify object existence)
 * @param key           - Object key
 * @param isPrivate     - True for private user-scoped objects
 * @param r2Config      - S3 credentials; required when isPrivate is true
 * @param expirySeconds - URL lifetime in seconds (default: 3600)
 * @returns Presigned or public URL string
 */
export async function generateExportUrl(
  bucket: R2Bucket,
  key: string,
  isPrivate: boolean,
  r2Config: R2S3Config | undefined,
  expirySeconds = 3600,
): Promise<string> {
  if (isPrivate && !r2Config) {
    throw new Error(
      'R2 S3 credentials are required to generate a presigned URL for a private export ' +
        'but were not provided. Provision R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
        'R2_SECRET_ACCESS_KEY, R2_PRIVATE_BUCKET, and R2_PUBLIC_BASE_URL ' +
        'via `wrangler secret put`.',
    );
  }

  // Verify object exists
  const object = await bucket.head(key);

  if (!object) {
    throw new Error('Object not found');
  }

  if (isPrivate && r2Config) {
    return buildPresignedGetUrl(r2Config, key, expirySeconds);
  }

  // Public export — plain URL
  const publicBase = r2Config?.publicBaseUrl ?? 'https://exports.nextcalc.pro';
  return `${publicBase}/${key}`;
}

/**
 * Deletes a file from R2
 *
 * @param bucket - R2 bucket binding
 * @param key - Object key to delete
 */
export async function deleteFromR2(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

/**
 * Lists objects in R2 bucket with optional prefix
 *
 * @param bucket - R2 bucket binding
 * @param prefix - Key prefix to filter by
 * @param limit - Maximum number of results
 * @returns List of objects
 */
export async function listR2Objects(
  bucket: R2Bucket,
  prefix?: string,
  limit = 100,
): Promise<R2Object[]> {
  const result = await bucket.list({
    ...(prefix ? { prefix } : {}),
    limit,
  });

  return result.objects;
}

/**
 * Generates a unique key for storing exports
 *
 * @param userId - User ID (for private exports)
 * @param format - File format (pdf, png, svg)
 * @param timestamp - Optional timestamp
 * @returns Unique object key
 */
export function generateExportKey(
  userId: string | undefined,
  format: 'pdf' | 'png' | 'svg',
  timestamp: number = Date.now(),
): string {
  const randomId = crypto.randomUUID();
  const userPrefix = userId ? `users/${userId}` : 'public';
  const datePath = new Date(timestamp).toISOString().split('T')[0];

  return `${userPrefix}/${datePath}/${randomId}.${format}`;
}

/**
 * Validates file size against limits
 *
 * @param size - File size in bytes
 * @param maxSize - Maximum allowed size in bytes
 * @throws Error if file exceeds size limit
 */
export function validateFileSize(size: number, maxSize: number): void {
  if (size > maxSize) {
    throw new Error(`File size ${size} bytes exceeds maximum allowed size of ${maxSize} bytes`);
  }
}

/**
 * Gets MIME type for export format
 *
 * @param format - Export format
 * @returns MIME type string
 */
export function getMimeType(format: 'pdf' | 'png' | 'svg'): string {
  const mimeTypes = {
    pdf: 'application/pdf',
    png: 'image/png',
    svg: 'image/svg+xml',
  };

  return mimeTypes[format];
}

/**
 * Reads R2 S3 config from the Worker environment bindings.
 * Returns undefined if the S3 credentials are not configured (public-only mode).
 *
 * @param env - Worker environment with optional R2 secrets
 */
export function r2ConfigFromEnv(env: {
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_PRIVATE_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;
}): R2S3Config | undefined {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_PRIVATE_BUCKET,
    R2_PUBLIC_BASE_URL,
  } = env;

  if (
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_PRIVATE_BUCKET &&
    R2_PUBLIC_BASE_URL
  ) {
    return {
      accountId: R2_ACCOUNT_ID,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      privateBucketName: R2_PRIVATE_BUCKET,
      publicBaseUrl: R2_PUBLIC_BASE_URL,
    };
  }

  return undefined;
}
