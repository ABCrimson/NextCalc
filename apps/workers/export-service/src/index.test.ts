/**
 * Export Service - Vitest Unit Tests
 *
 * Tests every public route of the Export Service Hono application.
 * Uses Hono's `app.request()` helper which skips network I/O entirely.
 *
 * Mocking strategy:
 * - The R2 bucket methods (put, get, head, list, delete) are mocked with
 *   vi.fn() so tests never touch actual Cloudflare infrastructure.
 * - The SVG handler's internal MathJax rendering (`generateSvgFromLatex`)
 *   is vi.mock()ed because MathJax 4.x uses a Windows-incompatible absolute
 *   path loader at test time (c:/ protocol not supported by Node ESM).
 *   The mock returns a minimal but structurally valid SVG string.
 * - `@cf-wasm/resvg/workerd` is mocked because the WASM binary cannot be
 *   instantiated inside a vitest environment.  The mock's `Resvg.async()`
 *   returns a renderer whose `.render()` yields realistic width/height and
 *   a minimal PNG-like Uint8Array.
 * - `modern-pdf-lib` is mocked because it must interoperate with the resvg mock
 *   (embedPng receives the mock PNG buffer).  The mock's createPdf
 *   returns a document supporting setTitle/addPage/embedPng/save.
 * - All validation and routing logic is exercised with the real handler code.
 */

import { describe, expect, it, type Mock, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock MathJax internals BEFORE importing app so the module graph resolves
// with the stub already in place.  The svg-internal module is the only one
// that calls MathJax; by replacing generateSvgFromLatex with a stub we avoid
// the Windows ESM path protocol error while still exercising the full Hono
// routing, Zod validation, R2 upload and response-shaping code paths.
// ---------------------------------------------------------------------------
vi.mock('./handlers/svg-internal.js', () => ({
  generateSvgFromLatex: vi
    .fn()
    .mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><text>mock</text></svg>',
    ),
  generateRasterSvgFromLatex: vi
    .fn()
    .mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><text>mock</text></svg>',
    ),
}));

// ---------------------------------------------------------------------------
// Mock @cf-wasm/resvg/workerd — WASM cannot be instantiated in vitest.
// Resvg.async() returns an object whose .render() produces a minimal
// result with width, height, and asPng() returning a Uint8Array.
// ---------------------------------------------------------------------------
vi.mock('@cf-wasm/resvg/workerd', () => {
  const pngBytes = new Uint8Array(100);
  return {
    Resvg: {
      async: vi.fn().mockResolvedValue({
        render: vi.fn().mockReturnValue({
          width: 200,
          height: 50,
          asPng: () => pngBytes,
        }),
      }),
    },
  };
});

// ---------------------------------------------------------------------------
// Mock modern-pdf-lib — createPdf() returns a lightweight document mock
// that supports the methods used by the PDF handler (setTitle, setAuthor,
// setSubject, setCreator, setProducer, setCreationDate, addPage, embedPng,
// save).
// ---------------------------------------------------------------------------
vi.mock('modern-pdf-lib', () => {
  const mockPage = {
    drawImage: vi.fn(),
  };

  const mockImage = {
    width: 200,
    height: 50,
  };

  const mockDoc = {
    setTitle: vi.fn(),
    setAuthor: vi.fn(),
    setSubject: vi.fn(),
    setCreator: vi.fn(),
    setProducer: vi.fn(),
    setCreationDate: vi.fn(),
    addPage: vi.fn().mockReturnValue(mockPage),
    embedPng: vi.fn().mockReturnValue(mockImage),
    save: vi.fn().mockResolvedValue(new Uint8Array(512)),
  };

  return {
    createPdf: vi.fn().mockReturnValue(mockDoc),
    PageSizes: {
      A4: [595.28, 841.89],
      Letter: [612, 792],
      Legal: [612, 1008],
    },
  };
});

import app from './index.js';

// ---------------------------------------------------------------------------
// R2 mock factory
// ---------------------------------------------------------------------------

interface MockR2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

function createMockR2Bucket(
  overrides: Partial<{
    putResult: MockR2Object | null;
  }> = {},
) {
  const defaultPutResult: MockR2Object = {
    key: 'public/2026-02-18/mock-uuid.svg',
    version: '1',
    size: 1024,
    etag: 'abc123',
    httpEtag: '"abc123"',
    uploaded: new Date(),
    httpMetadata: { contentType: 'image/svg+xml' },
    customMetadata: {},
  };

  return {
    put: vi.fn().mockResolvedValue(overrides.putResult ?? defaultPutResult),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    head: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false, delimitedPrefixes: [] }),
  };
}

// ---------------------------------------------------------------------------
// Environment binding factory
// ---------------------------------------------------------------------------

function createTestEnv(overrides: Record<string, unknown> = {}) {
  return {
    ALLOWED_ORIGINS: 'http://localhost:3005',
    EXPORTS_PUBLIC: createMockR2Bucket(),
    EXPORTS_PRIVATE: createMockR2Bucket(),
    SIGNED_URL_EXPIRY: '3600',
    MAX_FILE_SIZE: '5242880',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  options: RequestInit = {},
  env = createTestEnv(),
): Promise<Response> {
  return app.request(url, options, env);
}

function postJson(url: string, body: unknown, env = createTestEnv()): Promise<Response> {
  return makeRequest(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
  );
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with healthy status and export-service name', async () => {
    const res = await makeRequest('/health');
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, unknown>;
    expect(json.status).toBe('healthy');
    expect(json.service).toBe('export-service');
    expect(json.version).toBe('1.0.0');
  });

  it('includes a valid ISO 8601 timestamp', async () => {
    const res = await makeRequest('/health');
    const json = (await res.json()) as Record<string, unknown>;
    expect(Number.isNaN(Date.parse(json.timestamp as string))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

describe('GET /', () => {
  it('returns 200 with service metadata and endpoints map', async () => {
    const res = await makeRequest('/');
    expect(res.status).toBe(200);

    const json = (await res.json()) as Record<string, unknown>;
    expect(json.name).toContain('Export Service');
    expect(json.version).toBe('1.0.0');

    const endpoints = json.endpoints as Record<string, string>;
    expect(endpoints).toHaveProperty('pdf');
    expect(endpoints).toHaveProperty('png');
    expect(endpoints).toHaveProperty('svg');
    expect(endpoints).toHaveProperty('health');
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

describe('Unknown routes', () => {
  it('returns 404 with NOT_FOUND code for an unknown path', async () => {
    const res = await makeRequest('/unknown/route');
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

describe('CORS middleware', () => {
  it('echoes the allowed origin back in ACAO header', async () => {
    const env = createTestEnv({ ALLOWED_ORIGINS: 'http://localhost:3005' });
    const res = await makeRequest(
      '/health',
      {
        headers: { Origin: 'http://localhost:3005' },
      },
      env,
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3005');
  });

  it('responds to OPTIONS preflight with a 2xx status', async () => {
    const res = await makeRequest('/export/svg', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3005',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect([200, 204]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// POST /export/svg
// ---------------------------------------------------------------------------

describe('POST /export/svg', () => {
  it('returns 200 with success:true and data when given valid LaTeX', async () => {
    const res = await postJson('/export/svg', {
      latex: 'E = mc^2',
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
  });

  it('uses EXPORTS_PRIVATE bucket when userId is provided', async () => {
    const env = createTestEnv();
    const privateBucket = env.EXPORTS_PRIVATE as ReturnType<typeof createMockR2Bucket>;

    await postJson(
      '/export/svg',
      { latex: 'x^2', userId: '550e8400-e29b-41d4-a716-446655440000' },
      env,
    );

    expect((privateBucket.put as Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('uses EXPORTS_PUBLIC bucket when no userId is provided', async () => {
    const env = createTestEnv();
    const publicBucket = env.EXPORTS_PUBLIC as ReturnType<typeof createMockR2Bucket>;

    await postJson('/export/svg', { latex: 'x^2' }, env);

    expect((publicBucket.put as Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('returns 400 VALIDATION_ERROR when latex is missing', async () => {
    const res = await postJson('/export/svg', { options: {} });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when latex is an empty string', async () => {
    const res = await postJson('/export/svg', { latex: '' });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 INVALID_LATEX for an expression with unbalanced braces', async () => {
    // missing closing brace — validateLatexSyntax returns false
    const res = await postJson('/export/svg', { latex: 'x^{2' });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_LATEX');
  });

  it('accepts optional fontSize and color options', async () => {
    const res = await postJson('/export/svg', {
      latex: '\\alpha + \\beta',
      options: {
        fontSize: 24,
        color: '#2563eb',
        inline: true,
      },
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('returns 400 VALIDATION_ERROR when color has invalid hex format', async () => {
    const res = await postJson('/export/svg', {
      latex: 'x^2',
      options: {
        color: 'blue', // not a #RRGGBB hex string
      },
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('response data includes a key, url, and format:svg', async () => {
    const res = await postJson('/export/svg', { latex: 'x^2 + y^2 = r^2' });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: { key: string; url: string; format: string };
    };
    expect(json.success).toBe(true);
    expect(typeof json.data.key).toBe('string');
    expect(typeof json.data.url).toBe('string');
    expect(json.data.format).toBe('svg');
  });

  it('returns 400 VALIDATION_ERROR when fontSize is above maximum of 72', async () => {
    const res = await postJson('/export/svg', {
      latex: 'x',
      options: { fontSize: 100 },
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /export/png
// ---------------------------------------------------------------------------

describe('POST /export/png', () => {
  it('returns 200 with success:true and data when given valid LaTeX', async () => {
    const res = await postJson('/export/png', {
      latex: 'E = mc^2',
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
  });

  it('response data includes a key, url, format:png, dimensions and dpi', async () => {
    const res = await postJson('/export/png', { latex: 'x^2 + y^2 = r^2' });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: {
        key: string;
        url: string;
        format: string;
        dimensions: { width: number; height: number };
        dpi: number;
      };
    };
    expect(json.success).toBe(true);
    expect(typeof json.data.key).toBe('string');
    expect(typeof json.data.url).toBe('string');
    expect(json.data.format).toBe('png');
    expect(json.data.dimensions.width).toBe(200);
    expect(json.data.dimensions.height).toBe(50);
    expect(typeof json.data.dpi).toBe('number');
  });

  it('uses EXPORTS_PRIVATE bucket when userId is provided', async () => {
    const env = createTestEnv();
    const privateBucket = env.EXPORTS_PRIVATE as ReturnType<typeof createMockR2Bucket>;

    await postJson(
      '/export/png',
      { latex: 'x^2', userId: '550e8400-e29b-41d4-a716-446655440000' },
      env,
    );

    expect((privateBucket.put as Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('uses EXPORTS_PUBLIC bucket when no userId is provided', async () => {
    const env = createTestEnv();
    const publicBucket = env.EXPORTS_PUBLIC as ReturnType<typeof createMockR2Bucket>;

    await postJson('/export/png', { latex: 'x^2' }, env);

    expect((publicBucket.put as Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('returns 400 VALIDATION_ERROR when latex field is missing', async () => {
    const res = await postJson('/export/png', {
      options: { dpi: 144 },
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when dpi is below minimum of 72', async () => {
    const res = await postJson('/export/png', {
      latex: 'x^2',
      options: { dpi: 10 },
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when dpi exceeds maximum of 600', async () => {
    const res = await postJson('/export/png', {
      latex: 'x^2',
      options: { dpi: 1200 },
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 INVALID_LATEX when LaTeX has unbalanced dollar signs', async () => {
    const res = await postJson('/export/png', {
      latex: '$x^2', // odd number of $ signs
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_LATEX');
  });

  it('returns 400 VALIDATION_ERROR when width is below minimum of 100', async () => {
    const res = await postJson('/export/png', {
      latex: 'x',
      options: { width: 50 },
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /export/pdf
// ---------------------------------------------------------------------------

describe('POST /export/pdf', () => {
  it('returns 200 with success:true when given valid LaTeX', async () => {
    const res = await postJson('/export/pdf', {
      latex: 'E = mc^2',
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; data: Record<string, unknown> };
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
  });

  it('response data contains format:pdf, pages, and pageSize fields', async () => {
    const res = await postJson('/export/pdf', {
      latex: 'x^2',
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: { format: string; pages: number; pageSize: string };
    };
    expect(json.data.format).toBe('pdf');
    expect(json.data.pages).toBe(1);
    expect(['a4', 'letter', 'legal']).toContain(json.data.pageSize);
  });

  it('uses custom pageSize from options', async () => {
    const res = await postJson('/export/pdf', {
      latex: 'x^2',
      options: { pageSize: 'letter' },
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: { pageSize: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.pageSize).toBe('letter');
  });

  it('uses EXPORTS_PRIVATE bucket when userId is provided', async () => {
    const env = createTestEnv();
    const privateBucket = env.EXPORTS_PRIVATE as ReturnType<typeof createMockR2Bucket>;

    await postJson(
      '/export/pdf',
      { latex: 'x^2', userId: '550e8400-e29b-41d4-a716-446655440000' },
      env,
    );

    expect((privateBucket.put as Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('returns 400 VALIDATION_ERROR when latex is missing', async () => {
    const res = await postJson('/export/pdf', { options: { pageSize: 'a4' } });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when latex is empty', async () => {
    const res = await postJson('/export/pdf', { latex: '' });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 INVALID_LATEX for unbalanced braces in LaTeX', async () => {
    // missing closing brace — validateLatexSyntax returns false
    const res = await postJson('/export/pdf', { latex: '\\frac{x}{y' });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_LATEX');
  });

  it('returns 400 VALIDATION_ERROR when pageSize is not a valid enum value', async () => {
    const res = await postJson('/export/pdf', {
      latex: 'x',
      options: { pageSize: 'tabloid' }, // not allowed
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when fontSize is below minimum of 8', async () => {
    const res = await postJson('/export/pdf', {
      latex: 'x',
      options: { fontSize: 4 },
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when title exceeds 200 characters', async () => {
    const res = await postJson('/export/pdf', {
      latex: 'x',
      options: { title: 'a'.repeat(201) },
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /export/dpi/:useCase
// ---------------------------------------------------------------------------

describe('GET /export/dpi/:useCase', () => {
  const cases: Array<{ useCase: string; expectedDpi: number }> = [
    { useCase: 'web', expectedDpi: 72 },
    { useCase: 'retina', expectedDpi: 144 },
    { useCase: 'presentation', expectedDpi: 150 },
    { useCase: 'print', expectedDpi: 300 },
  ];

  for (const { useCase, expectedDpi } of cases) {
    it(`returns ${expectedDpi} DPI for useCase="${useCase}"`, async () => {
      const res = await makeRequest(`/export/dpi/${useCase}`);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        success: boolean;
        data: { useCase: string; recommendedDpi: number };
      };
      expect(json.success).toBe(true);
      expect(json.data.useCase).toBe(useCase);
      expect(json.data.recommendedDpi).toBe(expectedDpi);
    });
  }

  it('returns 400 INVALID_USE_CASE for an unrecognised use case', async () => {
    const res = await makeRequest('/export/dpi/mobile');
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('INVALID_USE_CASE');
  });

  it('returns 400 for an unknown use case segment', async () => {
    const res = await makeRequest('/export/dpi/UNKNOWN_CASE');
    expect(res.status).toBe(400);
  });
});
