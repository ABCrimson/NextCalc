/**
 * R2 Storage utilities for file upload and signed URL generation
 * Cloudflare R2 is S3-compatible object storage on the edge
 */

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
 * Uploads a file to R2 bucket
 *
 * @param bucket - R2 bucket binding
 * @param key - Object key (file path)
 * @param content - File content
 * @param contentType - MIME type
 * @param metadata - Custom metadata
 * @returns Upload result with signed URL
 */
export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  content: ArrayBuffer | Uint8Array | string,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<UploadResult> {
  // Upload to R2
  const object = await bucket.put(key, content, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000', // 1 year
    },
    customMetadata: metadata,
  });

  if (!object) {
    throw new Error('Failed to upload to R2');
  }

  // Generate signed URL (valid for 1 hour by default)
  const expiresAt = new Date(Date.now() + 3600 * 1000);

  return {
    key: object.key,
    url: `https://exports.nextcalc.pro/${object.key}`, // Replace with actual R2 public URL
    size: object.size,
    contentType,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Generates a signed URL for accessing an R2 object
 * Note: R2 presigned URLs require the S3 API, which is not directly available in Workers
 * This is a placeholder - actual implementation requires Workers API or custom signing
 *
 * @param bucket - R2 bucket binding
 * @param key - Object key
 * @param expirySeconds - URL expiry time in seconds
 * @returns Signed URL
 */
export async function generateSignedUrl(
  bucket: R2Bucket,
  key: string,
  expirySeconds: number = 3600,
): Promise<string> {
  // Verify object exists
  const object = await bucket.head(key);

  if (!object) {
    throw new Error('Object not found');
  }

  // For now, return a public URL
  // In production, implement proper S3 presigned URL generation
  // or use Cloudflare's Access for authentication
  return `https://exports.nextcalc.pro/${key}?expires=${Date.now() + expirySeconds * 1000}`;
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
  limit: number = 100,
): Promise<R2Object[]> {
  const result = await bucket.list({
    prefix,
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
