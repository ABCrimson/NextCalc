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

- **Node.js** >= 24.0.0 (CI runs Node 26)
- **pnpm** >= 11

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full command reference, project structure, and detailed code-style conventions (TypeScript strict mode, React 19.3 patterns, Biome 2.5.1, semantic color tokens, focus rings).

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
   pnpm build && pnpm test && pnpm lint && pnpm turbo run typecheck
   ```

3. Push your branch and open a PR against `main`

4. Fill in the PR template — describe what changed and why

5. Wait for CI to pass and request a review

---

## Project Structure

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full monorepo package map and project structure.

---

## Testing i18n Changes

When modifying user-facing text, update all 8 locale files in `apps/web/messages/`:

- `en.json`, `ru.json`, `es.json`, `uk.json`, `de.json`, `fr.json`, `ja.json`, `zh.json`

Each file contains 1200+ translation keys. The app uses next-intl path-prefix routing (configured in `apps/web/i18n/routing.ts`), so to verify your changes render correctly across locales, run the app locally and visit the locale-prefixed path (e.g., `http://localhost:3005/es` for Spanish, `http://localhost:3005/ja` for Japanese). Check that text fits within UI containers -- some languages expand significantly (German, Russian) while others may be more compact (Chinese, Japanese).

If you add new keys, add them to **all 8 files**. Missing keys will fall back to the English string, which may break the UI for non-English users.

---

## Reporting Issues

Use the [issue templates](https://github.com/ABCrimson/NextCalc/issues/new/choose) to report bugs or request features.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
