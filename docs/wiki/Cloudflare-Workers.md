# Cloudflare Workers

Three edge microservices deployed to Cloudflare's global network for sub-50ms response times.

## Services

| Worker | URL | Purpose | Bindings |
|:-------|:----|:--------|:---------|
| CAS Service | `cas.nextcalc.io` | Symbolic math (solve, diff, integrate) | -- |
| Export Service | `export.nextcalc.io` | LaTeX to PDF/PNG/SVG | R2 bucket |
| Rate Limiter | `ratelimit.nextcalc.io` | API quota enforcement | KV namespace |

**Tech**: Hono 4.12.3, Wrangler 4.69.0, Zod, TypeScript strict mode

---

## CAS Service

**Endpoints:**
- `POST /solve` -- Solve algebraic equations
- `POST /differentiate` -- Compute derivatives
- `POST /integrate` -- Compute integrals
- `POST /arc-length` -- Calculate curve arc length
- `GET /health` -- Health check

**Example:**
```bash
curl -X POST https://cas.nextcalc.io/solve \
  -H "Content-Type: application/json" \
  -d '{"expression": "2x + 5 = 13", "variable": "x", "precision": 10}'
```

**Performance:** Equation solving 10-50ms, differentiation 5-20ms, integration 15-100ms

---

## Export Service

**Endpoints:**
- `POST /export/pdf` -- Export to PDF
- `POST /export/png` -- Export to PNG
- `POST /export/svg` -- Export to SVG
- `GET /export/dpi/:useCase` -- Recommended DPI
- `GET /health` -- Health check

**Example:**
```bash
curl -X POST https://export.nextcalc.io/export/svg \
  -H "Content-Type: application/json" \
  -d '{"latex": "E = mc^2", "options": {"fontSize": 24}}'
```

**Performance:** SVG 20-50ms, PNG 100-500ms, PDF 200-1000ms

---

## Rate Limiter

**Endpoints:**
- `POST /check` -- Check and consume rate limit
- `GET /status/:identifier` -- Current status
- `DELETE /reset/:identifier` -- Reset (admin only)
- `GET /configs` -- Tier configurations
- `GET /health` -- Health check

**Tiers:**
| Tier | Requests/Hour | Burst |
|:-----|:-------------|:------|
| Free | 100 | 20 |
| Pro | 1000 | 50 |
| Enterprise | Unlimited | 1000 |

**Performance:** Check 1-5ms, status 1-3ms

---

## Local Development

```bash
cd apps/workers/cas-service && pnpm dev      # Port 8787
cd apps/workers/export-service && pnpm dev   # Port 8788
cd apps/workers/rate-limiter && pnpm dev     # Port 8789
```

## Deployment

**Manual:**
```bash
cd apps/workers/cas-service && pnpm run deploy
cd apps/workers/export-service && pnpm run deploy
cd apps/workers/rate-limiter && pnpm run deploy
```

**CI/CD:** Push to `apps/workers/**` or `pnpm-lock.yaml` on `main` triggers `.github/workflows/deploy-workers.yml`. Also supports `workflow_dispatch` for manual runs. Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub secrets. Each worker deploys independently (`fail-fast: false`). Uses `actions/checkout@v6` and `actions/setup-node@v6`.

> **Note:** Use `pnpm run deploy` (not `pnpm deploy`) — pnpm 11 treats `deploy` as a built-in command.

## Monitoring

All workers have OpenTelemetry observability enabled in `wrangler.toml`. Monitor via Cloudflare Dashboard > Workers & Pages.

## Security (v1.1.0+)

- **Sanitized error responses**: Workers no longer leak internal `err.message` to clients. All error responses return generic messages with appropriate HTTP status codes.
- **Timing-safe admin auth**: Admin key comparison uses timing-safe SHA-256 hashing + constant-time XOR comparison to prevent timing attacks.
- **No information disclosure**: `prettyJSON` middleware removed from all workers to prevent verbose JSON output that could reveal internal structure.
- **CORS hardening**: Origins validated against `ALLOWED_ORIGINS` environment variable. Requests from unlisted origins are rejected.

## Troubleshooting

Common issues and solutions:

- **`wrangler deploy` fails** -- Verify that `CLOUDFLARE_API_TOKEN` is set (GitHub secret or local env) and that `account_id` in `wrangler.toml` matches your Cloudflare account.
- **CORS errors in browser** -- Check that the `ALLOWED_ORIGINS` environment variable on the worker includes your frontend domain (e.g., `https://nextcalc.io`). Multiple origins can be comma-separated.
- **Rate limit false positives** -- Ensure Durable Object bindings are correctly configured in `wrangler.toml`. If bindings are missing, the rate limiter cannot track per-client state.
- **R2 upload failures (export-service)** -- Confirm the R2 bucket binding name in `wrangler.toml` matches the code. Check that the bucket exists via `wrangler r2 bucket list`.
- **KV read errors (rate-limiter)** -- Verify the KV namespace ID in `wrangler.toml`. Use `wrangler kv namespace list` to confirm.
