# Contributing to NextCalc Pro

Thank you for your interest in contributing to NextCalc Pro! This guide will help you get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/NextCalc.git
   cd NextCalc
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feat/your-feature-name
   ```

For full setup instructions (database, OAuth, environment variables), see [docs/SETUP.md](docs/SETUP.md).

---

## Development Workflow

### Prerequisites

- **Node.js** >= 22.9.0 (recommended: 26.x)
- **pnpm** >= 10.x
- See [DEVELOPMENT.md](DEVELOPMENT.md) for the full developer guide

### Commands

```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build everything (Turborepo)
pnpm test         # Run all tests
pnpm lint         # Lint with Biome
pnpm typecheck    # TypeScript type checking
```

### Code Style

- **TypeScript strict mode** with `exactOptionalPropertyTypes`
- **Zero `as any`** in production code (only allowed in test mocks with biome-ignore)
- **React 19.3 patterns**: `ref` as a regular prop (no `forwardRef`), named imports only
- **Biome 2.4.4** for linting and formatting
- **Semantic color tokens**: `text-foreground`, `bg-background` (not `gray-*` or `slate-*`)
- **Focus rings**: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`

---

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use |
|--------|-----|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `chore:` | Maintenance, dependencies |
| `test:` | Adding or updating tests |
| `refactor:` | Code restructuring (no behavior change) |
| `perf:` | Performance improvement |
| `ci:` | CI/CD changes |

Example: `feat: add polar plot analysis section`

---

## Pull Request Process

1. Ensure your branch is up to date with `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. Run the full check suite:
   ```bash
   pnpm build && pnpm test && pnpm lint && pnpm typecheck
   ```

3. Push your branch and open a PR against `main`

4. Fill in the PR template — describe what changed and why

5. Wait for CI to pass and request a review

---

## Project Structure

| Directory | Description |
|-----------|-------------|
| `apps/web` | Next.js 16 frontend |
| `apps/api` | Apollo Server GraphQL API |
| `apps/workers/` | Cloudflare Workers (CAS, export, rate limiter) |
| `packages/math-engine` | Core math library |
| `packages/plot-engine` | GPU visualization engine |
| `packages/database` | Prisma 7 shared database package |
| `packages/types` | Shared TypeScript types |

---

## Reporting Issues

Use the [issue templates](https://github.com/ABCrimson/NextCalc/issues/new/choose) to report bugs or request features.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
