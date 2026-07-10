/**
 * Comprehensive unit tests for R2 storage utilities
 *
 * Tests cover:
 * - Object upload/download via uploadToR2 (public and private paths)
 * - Presigned URL generation via generateExportUrl (private = SigV4, public = plain)
 * - Error on missing credentials for private exports (no silent fallback)
 * - Object deletion via deleteFromR2
 * - Object listing via listR2Objects
 * - Key generation via generateExportKey
 * - File size validation via validateFileSize
 * - MIME type resolution via getMimeType
 * - Error handling for missing objects and failed uploads
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteFromR2,
  generateExportKey,
  generateExportUrl,
  getMimeType,
  listR2Objects,
  type R2S3Config,
  uploadToR2,
  validateFileSize,
} from '../utils/r2.js';

// R2Bucket / R2Object / R2ObjectBody are ambient globals from
// @cloudflare/workers-types (see tsconfig.json "types") — no import needed.

// ---------------------------------------------------------------------------
// aws4fetch mock — keeps tests offline; records the URL that would be signed.
// The real AwsClient.sign() returns a signed Request; we return a fake signed
// URL that contains the standard SigV4 presign query parameters so the tests
// can assert on their presence.
// ---------------------------------------------------------------------------
vi.mock('aws4fetch', () => {
  class AwsClient {
    async sign(
      request: Request,
      _opts?: { aws?: { signQuery?: boolean; expiresIn?: number } },
    ): Promise<Request> {
      // Build a realistic-looking presigned URL with the expected SigV4 params
      const url = new URL(request.url);
      url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
      url.searchParams.set(
        'X-Amz-Credential',
        'AKIAIOSFODNN7EXAMPLE/20260624/auto/s3/aws4_request',
      );
      url.searchParams.set('X-Amz-Date', '20260624T000000Z');
      url.searchParams.set('X-Amz-Expires', '3600');
      url.searchParams.set('X-Amz-Signature', 'mock-signature-hex-string');
      return new Request(url.toString(), { method: 'GET' });
    }
  }

  return { AwsClient };
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_R2_CONFIG: R2S3Config = {
  accountId: 'test-account-id',
  accessKeyId: 'test-access-key-id',
  secretAccessKey: 'test-secret-access-key',
  privateBucketName: 'nextcalc-exports-private',
  publicBaseUrl: 'https://exports.nextcalc.pro',
};

// ---------------------------------------------------------------------------
// R2 mock factory
// ---------------------------------------------------------------------------

function createMockR2Object(overrides: Partial<R2Object> = {}): R2Object {
  return {
    key: 'test/file.pdf',
    version: 'v1',
    size: 1024,
    etag: '"abc123"',
    httpEtag: '"abc123"',
    checksums: { toJSON: () => ({}) },
    uploaded: new Date('2026-03-01T00:00:00Z'),
    httpMetadata: { contentType: 'application/pdf' },
    storageClass: 'Standard',
    writeHttpMetadata: vi.fn(),
    ...overrides,
  } as R2Object;
}

function createMockR2ObjectBody(overrides: Partial<R2Object> = {}): R2ObjectBody {
  const obj = createMockR2Object(overrides);
  return {
    ...obj,
    body: new ReadableStream(),
    bodyUsed: false,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    bytes: vi.fn().mockResolvedValue(new Uint8Array(1024)),
    text: vi.fn().mockResolvedValue('file content'),
    json: vi.fn().mockResolvedValue({ data: 'test' }),
    blob: vi.fn().mockResolvedValue(new Blob(['test'])),
  };
}

function createMockBucket(overrides: Partial<R2Bucket> = {}): R2Bucket {
  return {
    put: vi.fn().mockResolvedValue(createMockR2Object()),
    get: vi.fn().mockResolvedValue(createMockR2ObjectBody()),
    delete: vi.fn().mockResolvedValue(undefined),
    head: vi.fn().mockResolvedValue(createMockR2Object()),
    list: vi.fn().mockResolvedValue({
      objects: [],
      truncated: false,
      delimitedPrefixes: [],
    }),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
    ...overrides,
  } as R2Bucket;
}

// ---------------------------------------------------------------------------
// uploadToR2 — public exports
// ---------------------------------------------------------------------------

describe('uploadToR2 (public exports)', () => {
  let bucket: R2Bucket;

  beforeEach(() => {
    bucket = createMockBucket();
  });

  it('uploads content and returns a valid UploadResult', async () => {
    const result = await uploadToR2(
      bucket,
      'test/file.pdf',
      'pdf content',
      'application/pdf',
      false,
      MOCK_R2_CONFIG,
    );

    expect(result.key).toBe('test/file.pdf');
    expect(result.url).toContain('test/file.pdf');
    expect(result.size).toBe(1024);
    expect(result.contentType).toBe('application/pdf');
    expect(result.expiresAt).toBeDefined();
  });

  it('calls bucket.put with the correct key and content', async () => {
    const content = new Uint8Array([1, 2, 3]);
    await uploadToR2(bucket, 'my/key.png', content, 'image/png', false, MOCK_R2_CONFIG);

    expect(bucket.put).toHaveBeenCalledTimes(1);
    const args = (bucket.put as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args?.[0]).toBe('my/key.png');
    expect(args?.[1]).toBe(content);
  });

  it('sets httpMetadata with contentType and public cacheControl', async () => {
    await uploadToR2(bucket, 'key.svg', '<svg/>', 'image/svg+xml', false, MOCK_R2_CONFIG);

    const args = (bucket.put as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = args?.[2] as { httpMetadata?: { contentType?: string; cacheControl?: string } };
    expect(options?.httpMetadata?.contentType).toBe('image/svg+xml');
    expect(options?.httpMetadata?.cacheControl).toBe('public, max-age=86400');
  });

  it('sets httpMetadata with private cacheControl for private exports', async () => {
    await uploadToR2(bucket, 'users/u1/key.svg', '<svg/>', 'image/svg+xml', true, MOCK_R2_CONFIG);

    const args = (bucket.put as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = args?.[2] as { httpMetadata?: { contentType?: string; cacheControl?: string } };
    expect(options?.httpMetadata?.cacheControl).toBe('private, max-age=3600');
  });

  it('passes custom metadata when provided', async () => {
    const metadata = { userId: 'u123', format: 'pdf' };
    await uploadToR2(
      bucket,
      'key.pdf',
      'content',
      'application/pdf',
      false,
      MOCK_R2_CONFIG,
      metadata,
    );

    const args = (bucket.put as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = args?.[2] as { customMetadata?: Record<string, string> };
    expect(options?.customMetadata).toEqual(metadata);
  });

  it('does not include customMetadata when not provided', async () => {
    await uploadToR2(bucket, 'key.pdf', 'content', 'application/pdf', false, MOCK_R2_CONFIG);

    const args = (bucket.put as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = args?.[2] as { customMetadata?: Record<string, string> };
    expect(options?.customMetadata).toBeUndefined();
  });

  it('throws when bucket.put returns null', async () => {
    const failBucket = createMockBucket({
      put: vi.fn().mockResolvedValue(null),
    });

    await expect(
      uploadToR2(failBucket, 'key.pdf', 'content', 'application/pdf', false, MOCK_R2_CONFIG),
    ).rejects.toThrow('Failed to upload to R2');
  });

  it('returns a public URL using publicBaseUrl for public exports', async () => {
    const customBucket = createMockBucket({
      put: vi
        .fn()
        .mockResolvedValue(createMockR2Object({ key: 'public/2026-01-01/file.pdf', size: 512 })),
    });

    const result = await uploadToR2(
      customBucket,
      'public/2026-01-01/file.pdf',
      'data',
      'application/pdf',
      false,
      MOCK_R2_CONFIG,
    );

    expect(result.url).toBe('https://exports.nextcalc.pro/public/2026-01-01/file.pdf');
    // Must NOT contain SigV4 params — public URLs are plain
    expect(result.url).not.toContain('X-Amz-Signature');
    expect(result.url).not.toContain('X-Amz-Expires');
  });

  it('sets expiresAt to approximately 1 hour in the future', async () => {
    const before = Date.now();
    const result = await uploadToR2(
      bucket,
      'key.pdf',
      'data',
      'application/pdf',
      false,
      MOCK_R2_CONFIG,
    );
    const after = Date.now();

    const expiresMs = new Date(result.expiresAt).getTime();
    const oneHour = 3600 * 1000;
    expect(expiresMs).toBeGreaterThanOrEqual(before + oneHour);
    expect(expiresMs).toBeLessThanOrEqual(after + oneHour);
  });

  it('handles ArrayBuffer content', async () => {
    const buffer = new ArrayBuffer(16);
    const result = await uploadToR2(
      bucket,
      'key.bin',
      buffer,
      'application/octet-stream',
      false,
      MOCK_R2_CONFIG,
    );

    expect(result.key).toBe('test/file.pdf'); // from mock
    expect(bucket.put).toHaveBeenCalledTimes(1);
  });

  it('handles string content', async () => {
    const result = await uploadToR2(
      bucket,
      'key.svg',
      '<svg></svg>',
      'image/svg+xml',
      false,
      MOCK_R2_CONFIG,
    );

    expect(result).toBeDefined();
    expect(bucket.put).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// uploadToR2 — private exports (presigned URL path)
// ---------------------------------------------------------------------------

describe('uploadToR2 (private exports)', () => {
  it('returns a presigned URL with X-Amz-Signature for private exports', async () => {
    const bucket = createMockBucket({
      put: vi.fn().mockResolvedValue(createMockR2Object({ key: 'users/u1/2026-06-24/file.pdf' })),
    });

    const result = await uploadToR2(
      bucket,
      'users/u1/2026-06-24/file.pdf',
      'data',
      'application/pdf',
      true,
      MOCK_R2_CONFIG,
    );

    expect(result.url).toContain('X-Amz-Signature');
    expect(result.url).toContain('X-Amz-Expires');
    expect(result.url).toContain('X-Amz-Credential');
    // URL must be rooted at the R2 S3 endpoint, not the public base
    expect(result.url).toContain(`${MOCK_R2_CONFIG.accountId}.r2.cloudflarestorage.com`);
  });

  it('throws with a clear error when isPrivate=true but r2Config is undefined', async () => {
    const bucket = createMockBucket();

    await expect(
      uploadToR2(bucket, 'users/u1/key.pdf', 'data', 'application/pdf', true, undefined),
    ).rejects.toThrow('R2 S3 credentials are required for private exports');
  });

  it('does NOT fall back to an unsigned URL when credentials are missing', async () => {
    const bucket = createMockBucket();

    const promise = uploadToR2(
      bucket,
      'users/u1/key.pdf',
      'data',
      'application/pdf',
      true,
      undefined,
    );

    // Must throw, never resolve
    await expect(promise).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// generateExportUrl — public
// ---------------------------------------------------------------------------

describe('generateExportUrl (public)', () => {
  it('returns a plain public URL for public objects', async () => {
    const bucket = createMockBucket();

    const url = await generateExportUrl(bucket, 'public/file.pdf', false, MOCK_R2_CONFIG);

    expect(url).toBe('https://exports.nextcalc.pro/public/file.pdf');
    expect(url).not.toContain('X-Amz-Signature');
  });

  it('throws when object does not exist', async () => {
    const emptyBucket = createMockBucket({
      head: vi.fn().mockResolvedValue(null),
    });

    await expect(
      generateExportUrl(emptyBucket, 'missing/file.pdf', false, MOCK_R2_CONFIG),
    ).rejects.toThrow('Object not found');
  });

  it('calls bucket.head to verify existence', async () => {
    const bucket = createMockBucket();

    await generateExportUrl(bucket, 'check/key.pdf', false, MOCK_R2_CONFIG);

    expect(bucket.head).toHaveBeenCalledWith('check/key.pdf');
  });
});

// ---------------------------------------------------------------------------
// generateExportUrl — private (presigned SigV4)
// ---------------------------------------------------------------------------

describe('generateExportUrl (private presigned)', () => {
  it('returns a presigned URL with X-Amz-Signature for private objects', async () => {
    const bucket = createMockBucket();

    const url = await generateExportUrl(bucket, 'users/u1/file.pdf', true, MOCK_R2_CONFIG);

    expect(url).toContain('X-Amz-Signature');
    expect(url).toContain('X-Amz-Expires');
    expect(url).toContain('X-Amz-Credential');
  });

  it('presigned URL is rooted at the R2 S3 endpoint', async () => {
    const bucket = createMockBucket();

    const url = await generateExportUrl(bucket, 'users/u1/file.pdf', true, MOCK_R2_CONFIG);

    expect(url).toContain(`${MOCK_R2_CONFIG.accountId}.r2.cloudflarestorage.com`);
    expect(url).toContain(MOCK_R2_CONFIG.privateBucketName);
    expect(url).toContain('users/u1/file.pdf');
  });

  it('presigned URL contains X-Amz-Expires param', async () => {
    const bucket = createMockBucket();

    const url = await generateExportUrl(bucket, 'users/u1/file.pdf', true, MOCK_R2_CONFIG, 7200);

    // The mock always sets X-Amz-Expires to 3600 in URL params;
    // the important check is that the parameter is present and not 0.
    expect(url).toContain('X-Amz-Expires=');
  });

  it('throws with a clear error when isPrivate=true but r2Config is undefined', async () => {
    const bucket = createMockBucket();

    await expect(generateExportUrl(bucket, 'users/u1/file.pdf', true, undefined)).rejects.toThrow(
      'R2 S3 credentials are required to generate a presigned URL',
    );
  });

  it('does NOT fall back to an unsigned URL when credentials are missing for private objects', async () => {
    const bucket = createMockBucket();

    const promise = generateExportUrl(bucket, 'users/u1/file.pdf', true, undefined);

    // Must throw before reaching bucket.head — credentials gate comes first
    await expect(promise).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// deleteFromR2
// ---------------------------------------------------------------------------

describe('deleteFromR2', () => {
  it('calls bucket.delete with the correct key', async () => {
    const bucket = createMockBucket();

    await deleteFromR2(bucket, 'to-delete/file.pdf');

    expect(bucket.delete).toHaveBeenCalledWith('to-delete/file.pdf');
  });

  it('resolves without error', async () => {
    const bucket = createMockBucket();

    await expect(deleteFromR2(bucket, 'any-key')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listR2Objects
// ---------------------------------------------------------------------------

describe('listR2Objects', () => {
  it('returns objects from the bucket', async () => {
    const objects = [createMockR2Object({ key: 'a.pdf' }), createMockR2Object({ key: 'b.png' })];
    const bucket = createMockBucket({
      list: vi.fn().mockResolvedValue({
        objects,
        truncated: false,
        delimitedPrefixes: [],
      }),
    });

    const result = await listR2Objects(bucket);

    expect(result).toHaveLength(2);
    expect(result[0]?.key).toBe('a.pdf');
    expect(result[1]?.key).toBe('b.png');
  });

  it('passes prefix to bucket.list when provided', async () => {
    const bucket = createMockBucket();

    await listR2Objects(bucket, 'users/123/');

    const args = (bucket.list as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args?.[0]).toEqual({ prefix: 'users/123/', limit: 100 });
  });

  it('does not include prefix when not provided', async () => {
    const bucket = createMockBucket();

    await listR2Objects(bucket);

    const args = (bucket.list as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args?.[0]).toEqual({ limit: 100 });
  });

  it('uses default limit of 100', async () => {
    const bucket = createMockBucket();

    await listR2Objects(bucket);

    const args = (bucket.list as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args?.[0]).toHaveProperty('limit', 100);
  });

  it('respects custom limit', async () => {
    const bucket = createMockBucket();

    await listR2Objects(bucket, undefined, 50);

    const args = (bucket.list as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args?.[0]).toEqual({ limit: 50 });
  });

  it('returns empty array when no objects exist', async () => {
    const bucket = createMockBucket();

    const result = await listR2Objects(bucket);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateExportKey
// ---------------------------------------------------------------------------

describe('generateExportKey', () => {
  it('includes user prefix for authenticated users', () => {
    const key = generateExportKey('user-42', 'pdf');

    expect(key).toMatch(/^users\/user-42\//);
    expect(key).toMatch(/\.pdf$/);
  });

  it('uses "public" prefix for unauthenticated users', () => {
    const key = generateExportKey(undefined, 'png');

    expect(key).toMatch(/^public\//);
    expect(key).toMatch(/\.png$/);
  });

  it('includes a date path in YYYY-MM-DD format', () => {
    const timestamp = new Date('2026-03-04T12:00:00Z').getTime();
    const key = generateExportKey('user-1', 'svg', timestamp);

    expect(key).toContain('2026-03-04');
  });

  it('includes a UUID segment', () => {
    const key = generateExportKey('user-1', 'pdf');

    // UUID v4 pattern: 8-4-4-4-12 hex characters
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    expect(key).toMatch(uuidRegex);
  });

  it('produces the correct file extension for each format', () => {
    expect(generateExportKey('u', 'pdf')).toMatch(/\.pdf$/);
    expect(generateExportKey('u', 'png')).toMatch(/\.png$/);
    expect(generateExportKey('u', 'svg')).toMatch(/\.svg$/);
  });

  it('generates unique keys on repeated calls', () => {
    const key1 = generateExportKey('user-1', 'pdf');
    const key2 = generateExportKey('user-1', 'pdf');

    expect(key1).not.toBe(key2);
  });

  it('uses current timestamp by default', () => {
    const today = new Date().toISOString().split('T')[0];
    const key = generateExportKey('user-1', 'pdf');

    expect(key).toContain(today);
  });

  it('produces the expected key structure: prefix/date/uuid.ext', () => {
    const timestamp = new Date('2026-01-15T00:00:00Z').getTime();
    const key = generateExportKey('u99', 'png', timestamp);

    const parts = key.split('/');
    expect(parts).toHaveLength(4); // users, u99, 2026-01-15, uuid.png
    expect(parts[0]).toBe('users');
    expect(parts[1]).toBe('u99');
    expect(parts[2]).toBe('2026-01-15');
    expect(parts[3]).toMatch(/^[0-9a-f-]+\.png$/);
  });
});

// ---------------------------------------------------------------------------
// validateFileSize
// ---------------------------------------------------------------------------

describe('validateFileSize', () => {
  it('does not throw when size is under the limit', () => {
    expect(() => validateFileSize(500, 1024)).not.toThrow();
  });

  it('does not throw when size equals the limit', () => {
    expect(() => validateFileSize(1024, 1024)).not.toThrow();
  });

  it('throws when size exceeds the limit', () => {
    expect(() => validateFileSize(2048, 1024)).toThrow(
      'File size 2048 bytes exceeds maximum allowed size of 1024 bytes',
    );
  });

  it('throws with a message containing the actual and max sizes', () => {
    expect(() => validateFileSize(5000, 3000)).toThrow(/5000.*3000/);
  });

  it('does not throw for zero-size files', () => {
    expect(() => validateFileSize(0, 1024)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getMimeType
// ---------------------------------------------------------------------------

describe('getMimeType', () => {
  it('returns application/pdf for pdf format', () => {
    expect(getMimeType('pdf')).toBe('application/pdf');
  });

  it('returns image/png for png format', () => {
    expect(getMimeType('png')).toBe('image/png');
  });

  it('returns image/svg+xml for svg format', () => {
    expect(getMimeType('svg')).toBe('image/svg+xml');
  });

  it('returns a non-empty string for all supported formats', () => {
    const formats: Array<'pdf' | 'png' | 'svg'> = ['pdf', 'png', 'svg'];
    for (const format of formats) {
      const mime = getMimeType(format);
      expect(mime).toBeTruthy();
      expect(typeof mime).toBe('string');
    }
  });
});
