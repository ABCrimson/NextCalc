# NextCalc Pro - Cloudflare Workers Microservices

This directory contains three production-ready Cloudflare Workers providing edge computing capabilities for NextCalc Pro.

## Architecture Overview

NextCalc Pro uses a microservices architecture deployed to Cloudflare's global edge network:

```
┌─────────────────────────────────────────────────────────────┐
│                     NextCalc Pro Frontend                    │
│                   (Next.js on Vercel)                        │
└───────────┬─────────────────┬─────────────────┬─────────────┘
            │                 │                 │
            ▼                 ▼                 ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │  CAS Service  │ │Export Service │ │ Rate Limiter  │
    │               │ │               │ │               │
    │  - Solve      │ │  - PDF Export │ │  - IP Limits  │
    │  - Diff       │ │  - PNG Export │ │  - User Limits│
    │  - Integrate  │ │  - SVG Export │ │  - Quotas     │
    └───────────────┘ └───────┬───────┘ └───────┬───────┘
                              │                 │
                              ▼                 ▼
                        ┌──────────┐      ┌──────────┐
                        │ R2 Bucket│      │ KV Store │
                        │ (Files)  │      │ (Limits) │
                        └──────────┘      └──────────┘
```

## Services

### 1. CAS Service (Computer Algebra System)

**Location:** `apps/workers/cas-service/`

**Purpose:** Performs symbolic mathematics operations on the edge.

**Endpoints:**
- `POST /solve` - Solve algebraic equations
- `POST /differentiate` - Compute derivatives
- `POST /integrate` - Compute integrals
- `POST /arc-length` - Calculate curve arc length
- `GET /health` - Health check

**Technology Stack:**
- Hono web framework
- mathjs for symbolic computation
- Zod for validation
- TypeScript strict mode

**Example Usage:**
```bash
curl -X POST https://cas.nextcalc.io/solve \
  -H "Content-Type: application/json" \
  -d '{
    "expression": "2x + 5 = 13",
    "variable": "x",
    "precision": 10
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "solutions": [4],
    "expression": "2x + 5 = 13",
    "variable": "x",
    "solutionType": "numeric"
  },
  "metadata": {
    "executionTime": 12.5,
    "timestamp": "2025-10-16T10:00:00.000Z"
  }
}
```

### 2. Export Service

**Location:** `apps/workers/export-service/`

**Purpose:** Converts LaTeX expressions to downloadable formats.

**Endpoints:**
- `POST /export/pdf` - Export to PDF
- `POST /export/png` - Export to PNG
- `POST /export/svg` - Export to SVG
- `GET /export/dpi/:useCase` - Get recommended DPI
- `GET /health` - Health check

**Technology Stack:**
- Hono web framework
- Cloudflare R2 for file storage
- MathJax (placeholder for production)
- Zod for validation

**Example Usage:**
```bash
curl -X POST https://export.nextcalc.io/export/svg \
  -H "Content-Type: application/json" \
  -d '{
    "latex": "E = mc^2",
    "options": {
      "fontSize": 24,
      "color": "#2563eb",
      "inline": false
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "public/2025-10-16/abc123.svg",
    "url": "https://exports.nextcalc.io/public/2025-10-16/abc123.svg",
    "size": 2048,
    "contentType": "image/svg+xml",
    "expiresAt": "2025-10-16T11:00:00.000Z",
    "format": "svg",
    "dimensions": {
      "width": 200,
      "height": 50
    }
  }
}
```

### 3. Rate Limiter Service

**Location:** `apps/workers/rate-limiter/`

**Purpose:** Enforces API quotas using sliding window algorithm.

**Endpoints:**
- `POST /check` - Check and consume rate limit
- `GET /status/:identifier` - Get current status
- `DELETE /reset/:identifier` - Reset limits (admin)
- `GET /configs` - Get tier configurations
- `GET /recommend/:requestsPerHour` - Get tier recommendation
- `GET /health` - Health check

**Technology Stack:**
- Hono web framework
- Cloudflare KV for distributed state
- Sliding window algorithm
- Multi-tier support

**Rate Limits by Tier:**
- **Free:** 100 requests/hour, burst 20
- **Pro:** 1000 requests/hour, burst 50
- **Enterprise:** Unlimited, burst 1000

**Example Usage:**
```bash
curl -X POST https://ratelimit.nextcalc.io/check \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "user-123",
    "tier": "pro"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "remaining": 999,
    "resetAt": 1729072800000,
    "limit": 1000,
    "tier": "pro"
  }
}
```

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 2025-10-16T11:00:00.000Z
X-RateLimit-Tier: pro
```

## Installation

### Prerequisites

- Node.js 22+ (26 recommended)
- pnpm 11+
- Cloudflare account
- Wrangler CLI (4.67+)

### Setup

1. **Install dependencies for all workers:**

```bash
cd apps/workers/cas-service
pnpm install

cd ../export-service
pnpm install

cd ../rate-limiter
pnpm install
```

2. **Configure Cloudflare resources:**

See each worker's `wrangler.toml` for resource configuration. You will need to create:
- R2 buckets
- KV namespaces
- D1 databases (future)
- Hyperdrive connections (future)

3. **Update wrangler.toml files:**

Replace placeholder IDs with your actual resource IDs:
- KV namespace IDs
- R2 bucket names
- Environment variables

## Development

### Local Development

Each worker can be run locally using Wrangler:

```bash
# CAS Service
cd apps/workers/cas-service
pnpm dev
# Runs on http://localhost:8787

# Export Service
cd apps/workers/export-service
pnpm dev
# Runs on http://localhost:8788

# Rate Limiter
cd apps/workers/rate-limiter
pnpm dev
# Runs on http://localhost:8789
```

### Testing

Run tests for each worker:

```bash
# CAS Service
cd apps/workers/cas-service
pnpm test

# Export Service
cd apps/workers/export-service
pnpm test

# Rate Limiter
cd apps/workers/rate-limiter
pnpm test
```

### Type Checking

Verify TypeScript compilation:

```bash
# All workers
pnpm type-check
```

## Deployment

### Production Deployment

Deploy each worker to Cloudflare:

```bash
# CAS Service
cd apps/workers/cas-service
pnpm deploy

# Export Service
cd apps/workers/export-service
pnpm deploy

# Rate Limiter
cd apps/workers/rate-limiter
pnpm deploy
```

### Environment-Specific Deployment

Deploy to specific environments:

```bash
# Development
wrangler deploy --env development

# Production
wrangler deploy --env production
```

### Deployment Checklist

Before deploying to production:

- [ ] All tests passing (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm type-check`)
- [ ] Environment variables configured
- [ ] Cloudflare resources created (R2, KV, etc.)
- [ ] wrangler.toml updated with correct IDs
- [ ] CORS origins configured
- [ ] Rate limits tested
- [ ] Observability enabled
- [ ] Error handling tested
- [ ] Documentation updated

## Monitoring

### Health Checks

Each worker exposes a `/health` endpoint:

```bash
curl https://cas.nextcalc.io/health
curl https://export.nextcalc.io/health
curl https://ratelimit.nextcalc.io/health
```

### Cloudflare Dashboard

Monitor workers in the Cloudflare dashboard:
1. Go to Workers & Pages
2. Select your worker
3. View metrics:
   - Requests per second
   - Execution time
   - Error rate
   - CPU usage

### OpenTelemetry

All workers have observability enabled in `wrangler.toml`:

```toml
[observability]
enabled = true
```

This provides:
- Distributed tracing
- Structured logging
- Performance metrics
- Error tracking

## Troubleshooting

### Common Issues

**1. KV Namespace Not Found**
```
Error: KV namespace binding RATE_LIMITS not found
```

Solution: Create KV namespace and update `wrangler.toml`:
```bash
wrangler kv:namespace create "RATE_LIMITS"
# Copy the ID to wrangler.toml
```

**2. R2 Bucket Not Found**
```
Error: R2 bucket EXPORTS_PUBLIC not found
```

Solution: Create R2 bucket:
```bash
wrangler r2 bucket create nextcalc-exports-public
```

**3. CORS Errors**

Solution: Verify `ALLOWED_ORIGINS` in `wrangler.toml`:
```toml
[vars]
ALLOWED_ORIGINS = "http://localhost:3020,https://nextcalc.io"
```

**4. Rate Limit Always 429**

Solution: Reset rate limit:
```bash
curl -X DELETE https://ratelimit.nextcalc.io/reset/your-identifier
```

### Debug Mode

Enable debug logging:

```bash
wrangler dev --log-level debug
```

## Performance

### Benchmarks

Typical performance metrics:

**CAS Service:**
- Equation solving: 10-50ms
- Differentiation: 5-20ms
- Integration: 15-100ms

**Export Service:**
- SVG generation: 20-50ms
- PNG generation: 100-500ms (with external service)
- PDF generation: 200-1000ms (with external service)

**Rate Limiter:**
- Check operation: 1-5ms (KV read/write)
- Status check: 1-3ms (KV read only)

### Optimization Tips

1. **Use edge caching:** Add `Cache-Control` headers for cacheable responses
2. **Minimize KV operations:** Batch reads/writes when possible
3. **Use R2 effectively:** Set appropriate TTLs and cache policies
4. **Monitor cold starts:** Keep workers warm with periodic health checks
5. **Optimize bundle size:** Use tree shaking and code splitting

## Security

### Best Practices

1. **API Authentication:**
   - Use API keys in `Authorization` header
   - Validate tokens on every request
   - Rotate keys periodically

2. **Rate Limiting:**
   - Apply to all public endpoints
   - Use tiered limits based on user type
   - Monitor for abuse patterns

3. **Input Validation:**
   - All inputs validated with Zod
   - Sanitize LaTeX expressions
   - Limit expression complexity

4. **CORS Configuration:**
   - Whitelist only trusted origins
   - Use credentials: true for authenticated requests
   - Expose only necessary headers

5. **Error Handling:**
   - Never expose internal errors
   - Log errors securely
   - Return generic error messages

## Contributing

### Code Style

- TypeScript strict mode required
- Biome 2.4.4 for linting and formatting
- Single quotes, 2-space indent, trailing commas
- JSDoc comments for all public functions

### Adding New Endpoints

1. Define Zod schema for request validation
2. Implement handler function with types
3. Add route to main `index.ts`
4. Write unit tests
5. Update documentation
6. Add integration tests

### Testing Requirements

- Unit tests for all handlers
- Integration tests for endpoints
- Error case coverage
- Type safety verification

## License

MIT License - see LICENSE file

## Support

- Wiki: [github.com/ABCrimson/NextCalc/wiki](https://github.com/ABCrimson/NextCalc/wiki)
- Issues: [github.com/ABCrimson/NextCalc/issues](https://github.com/ABCrimson/NextCalc/issues)

---

Powered by Cloudflare Workers, delivering sub-50ms response times globally.
