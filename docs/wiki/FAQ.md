# FAQ

## Setup Issues

### Port 3005 is already in use

```bash
npx kill-port 3005
```

### Prisma client missing

```bash
pnpm --filter @nextcalc/database db:generate
```

### Type errors after package update

```bash
pnpm clean && pnpm install && pnpm build
```

### NextAuth `Configuration` error

Ensure OAuth provider credentials are set in `.env.local`. Only include providers whose credentials you have. Empty credentials cause this error.

### PrismaNeon adapter "No database host" error

Pass `{ connectionString }` config object to `new PrismaNeon()`, NOT a Pool instance. Prisma 7's adapter creates its own Pool internally.

---

## Development Issues

### Radix Slot expects single child

When using `asChild` with Button, `Slot.Root` expects exactly one child element. Don't wrap extra elements inside.

### Zod 4: `.errors` not found

Renamed to `.issues` on `ZodError` in Zod 4.

### `@types/three` Line.material type

Use `!Array.isArray()` guard + `as THREE.LineBasicMaterial` for linewidth.

### TypeScript `exactOptionalPropertyTypes` error

Can't assign `undefined` to optional properties. Use conditional spread:

```typescript
const obj = {
  ...(value ? { key: value } : {}),
};
```

---

## Build Issues

### Turborepo cache issues

```bash
TURBO_FORCE=true pnpm build
```

### Module not found after deploy

Check root directory setting in Vercel. Should be `apps/web`.

---

## Runtime Issues

### Database connection fails

- Check `DATABASE_URL` has `?sslmode=require`
- Wake the Neon project if it was sleeping

### OAuth redirect mismatch

Verify `NEXTAUTH_URL` matches your deployment URL exactly. Create separate OAuth apps for production vs development.

### KV/R2 not found (Workers)

Create the resources:
```bash
wrangler kv:namespace create "RATE_LIMITS"
wrangler r2 bucket create nextcalc-exports-public
```

---

## Architecture Questions

### Why Apollo over tRPC?

Schema-first API design, built-in subscription support, and DataLoader integration for N+1 prevention.

### Why OKLCH colors?

Perceptually uniform color space with P3 gamut support. Better than HSL for consistent perceived contrast across themes.

### Why Edge Workers for CAS?

Sub-50ms global latency for symbolic math operations. The CAS worker runs on Cloudflare's 300+ edge locations.

### Why Prisma in a shared package?

Single schema definition, reusable across the web app and API. Generated client is shared via `@nextcalc/database`.
