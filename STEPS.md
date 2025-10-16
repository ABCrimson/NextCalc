# 🪜 NextCalc Pro - Implementation Steps

> **Quick Reference:** Step-by-step checklist for building NextCalc Pro  
> **Time to MVP:** 1 week | **Full Implementation:** 4-5 weeks  
> **Companion Doc:** QUICK_START_GUIDE.md (detailed commands)

---

## 📋 Pre-Implementation Setup

### Required Accounts
- [ ] Vercel account created → https://vercel.com
- [ ] Vercel API token obtained → https://vercel.com/account/tokens
- [ ] Cloudflare account created → https://dash.cloudflare.com
- [ ] Cloudflare API token created → https://dash.cloudflare.com/profile/api-tokens
- [ ] Cloudflare Account ID copied
- [ ] PostgreSQL database provisioned (Neon or Supabase free tier)

### Required Software
- [ ] Node.js 20+ installed → `node --version`
- [ ] pnpm 9+ installed → `npm install -g pnpm`
- [ ] Git installed
- [ ] Code editor (VS Code recommended)

### Environment Variables Ready
- [ ] `.env` file created with all tokens
- [ ] Database connection string ready
- [ ] MCP server config created in `.mcp/config.json`

---

# 🏗️ Phase 0: Project Foundation (Day 1-2)

## Step 0.1: Create Project Repository

```bash
# Create directory
mkdir nextcalc-pro
cd nextcalc-pro

# Initialize git
git init
git branch -M main
```

- [ ] Project directory created
- [ ] Git initialized

---

## Step 0.2: Create .gitignore

```bash
cat > .gitignore << 'EOF'
node_modules/
.next/
.env*
.vercel/
.turbo/
dist/
build/
*.log
.DS_Store
EOF
```

- [ ] .gitignore created

---

## Step 0.3: Initialize Monorepo

```bash
# Create pnpm workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF
```

- [ ] pnpm-workspace.yaml created

---

## Step 0.4: Create Root package.json

```bash
cat > package.json << 'EOF'
{
  "name": "nextcalc-pro",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "turbo": "2.3.3",
    "typescript": "5.9.3"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
EOF

pnpm install
```

- [ ] package.json created
- [ ] Root dependencies installed

---

## Step 0.5: Configure Turborepo

```bash
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
EOF
```

- [ ] turbo.json created

---

## Step 0.6: Configure TypeScript

```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": false,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@nextcalc/types": ["./packages/types/src"],
      "@nextcalc/math-engine": ["./packages/math-engine/src"],
      "@nextcalc/plot-engine": ["./packages/plot-engine/src"],
      "@nextcalc/ui": ["./packages/ui/src"]
    }
  },
  "exclude": ["node_modules", "dist", ".next", ".turbo"]
}
EOF
```

- [ ] tsconfig.json created

---

## Step 0.7: Configure Biome (Linter)

```bash
cat > biome.json << 'EOF'
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error",
        "noImplicitAnyLet": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
EOF
```

- [ ] biome.json created

---

## Step 0.8: Create Workspace Structure

```bash
mkdir -p apps/web
mkdir -p apps/api
mkdir -p apps/workers
mkdir -p packages/types/src
mkdir -p packages/math-engine/src
mkdir -p packages/plot-engine/src
mkdir -p packages/ui/src
mkdir -p .github/workflows
mkdir -p .mcp
```

- [ ] Directory structure created

---

## Step 0.9: Configure MCP Servers

```bash
cat > .mcp/config.json << 'EOF'
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-vercel"],
      "env": {
        "VERCEL_TOKEN": "${VERCEL_TOKEN}"
      }
    },
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-cloudflare"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "${CLOUDFLARE_API_TOKEN}",
        "CLOUDFLARE_ACCOUNT_ID": "${CLOUDFLARE_ACCOUNT_ID}"
      }
    }
  }
}
EOF
```

- [ ] MCP config created

---

## Step 0.10: Create Environment Variables

```bash
cat > .env << 'EOF'
# Vercel
VERCEL_TOKEN=your_vercel_token_here

# Cloudflare
CLOUDFLARE_API_TOKEN=your_cloudflare_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# Database
DATABASE_URL=postgresql://user:pass@host:5432/nextcalc

# Redis (optional)
REDIS_URL=redis://localhost:6379

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
EOF
```

- [ ] .env file created
- [ ] Environment variables filled in

---

## Step 0.11: Commit Initial Setup

```bash
git add .
git commit -m "Initial project setup with Turborepo, TypeScript 5.9.3, and ESNext"
```

- [ ] Initial commit made

---

### ✅ Phase 0 Complete Checklist
- [ ] Monorepo initialized
- [ ] TypeScript 5.9.3 configured with ESNext
- [ ] Turbo + Biome configured
- [ ] Workspace structure created
- [ ] MCP servers configured
- [ ] Environment variables set
- [ ] Git repository initialized

---

# 🎨 Phase 1: Frontend MVP (Day 3-7)

## Step 1.1: Initialize Next.js App

```bash
cd apps/web
pnpx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --turbopack
```

- [ ] Next.js 16.0.0-beta.0 app created
- [ ] App Router enabled
- [ ] Tailwind CSS configured

---

## Step 1.2: Update package.json with Exact Versions

```bash
cd apps/web
# Edit package.json to match exact versions from QUICK_START_GUIDE.md
pnpm install
```

- [ ] Dependencies updated to exact versions
- [ ] React 19.2.0 installed
- [ ] Next.js 16.0.0-beta.0 installed
- [ ] All packages installed

---

## Step 1.3: Configure Tailwind CSS

```bash
# Update tailwind.config.ts with custom theme
# (See QUICK_START_GUIDE.md for full config)
```

- [ ] Tailwind config updated
- [ ] Custom colors added
- [ ] Custom fonts added

---

## Step 1.4: Create Global Styles

```bash
# Update app/globals.css
# (See QUICK_START_GUIDE.md for full styles)
```

- [ ] Global CSS updated
- [ ] CSS variables defined
- [ ] Dark mode styles added
- [ ] KaTeX CSS imported

---

## Step 1.5: Create Shared Types Package

```bash
cd ../../packages/types

# Create package.json, tsconfig.json
# Create src/index.ts, math.ts, calculator.ts, plot.ts, ui.ts, api.ts
# (See QUICK_START_GUIDE.md for all type definitions)

pnpm install
```

- [ ] Types package created
- [ ] Core math types defined
- [ ] Calculator types defined
- [ ] Plot types defined
- [ ] UI types defined
- [ ] API types defined

---

## Step 1.6: Initialize shadcn/ui

```bash
cd ../../apps/web

npx shadcn@latest init -y

# Add components
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add card
npx shadcn@latest add tabs
npx shadcn@latest add scroll-area
```

- [ ] shadcn/ui initialized
- [ ] Button component added
- [ ] Input component added
- [ ] Card component added
- [ ] Tabs component added
- [ ] ScrollArea component added

---

## Step 1.7: Create Calculator Store (Zustand)

```bash
mkdir -p lib/stores

# Create lib/stores/calculator-store.ts
# (See QUICK_START_GUIDE.md for implementation)
```

- [ ] Calculator store created
- [ ] State management configured
- [ ] History persistence added

---

## Step 1.8: Create Calculator Components

```bash
mkdir -p components/calculator

# Create components:
# - components/calculator/display.tsx
# - components/calculator/keyboard.tsx
# - components/calculator/history.tsx
# - components/calculator/calculator.tsx
# (See QUICK_START_GUIDE.md for all implementations)
```

- [ ] Display component created
- [ ] Keyboard component created
- [ ] History component created
- [ ] Main calculator component created

---

## Step 1.9: Create Math Rendering Component

```bash
mkdir -p components/math

# Create components/math/latex-renderer.tsx
# (See QUICK_START_GUIDE.md for implementation)
```

- [ ] LaTeX renderer created
- [ ] KaTeX integration working

---

## Step 1.10: Update Main Page

```bash
# Update app/page.tsx with Calculator component
# (See QUICK_START_GUIDE.md for implementation)
```

- [ ] Main page updated
- [ ] Calculator integrated

---

## Step 1.11: Test Development Server

```bash
cd apps/web
pnpm dev

# Open http://localhost:3000
```

- [ ] Dev server running
- [ ] Calculator displays correctly
- [ ] Keyboard input works
- [ ] Math evaluation works
- [ ] History persists

---

## Step 1.12: Add KaTeX LaTeX Rendering

```bash
# Update Display component with LaTeX tabs
# (See QUICK_START_GUIDE.md for implementation)
```

- [ ] LaTeX rendering added
- [ ] Plain/LaTeX tabs working
- [ ] Math formulas display correctly

---

## Step 1.13: Deploy MVP to Vercel

```bash
cd apps/web

# Using Vercel MCP or CLI
pnpx vercel --prod
```

- [ ] Deployed to Vercel
- [ ] Production URL working
- [ ] Environment variables set

---

### ✅ Phase 1 Complete Checklist
- [ ] Next.js 16.0.0-beta.0 app running
- [ ] Calculator UI complete
- [ ] shadcn/ui components integrated
- [ ] KaTeX rendering working
- [ ] Zustand state management
- [ ] Keyboard input functional
- [ ] Calculation history
- [ ] Dark/light theme
- [ ] Deployed to Vercel
- [ ] **MVP is live!** 🎉

---

# 🧮 Phase 2: Math Engine (Week 2)

## Step 2.1: Create Math Engine Package

```bash
cd packages/math-engine

# Create package.json, tsconfig.json
pnpm add mathjs@15.0.0
pnpm install
```

- [ ] Math engine package created
- [ ] Math.js installed

---

## Step 2.2: Run Ultrathink - WASM Architecture Decision

**Use Ultrathink to decide:**
- MPFR/GMP vs custom implementation
- Memory management strategy
- JS ↔ WASM boundary optimization
- Thread safety approach

- [ ] Ultrathink analysis complete
- [ ] Architecture decision documented

---

## Step 2.3: Create Expression Parser

```bash
mkdir -p src/parser

# Create src/parser/index.ts
# Implement Math.js wrapper
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 2)
```

- [ ] Expression parser created
- [ ] Type-safe AST defined

---

## Step 2.4: Setup Emscripten Toolchain

```bash
# macOS
brew install emscripten

# Linux
sudo apt-get install emscripten

# Verify
emcc --version
```

- [ ] Emscripten installed
- [ ] MPFR/GMP libraries available

---

## Step 2.5: Build WASM Module

```bash
mkdir -p src/wasm/native

# Create C++ wrapper (mpfr_wrapper.cpp)
# Create build script (build.sh)
# Compile to WASM
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 2)

chmod +x src/wasm/native/build.sh
./src/wasm/native/build.sh
```

- [ ] WASM module compiled
- [ ] Binary < 2MB
- [ ] Exports verified

---

## Step 2.6: Create WASM Loader

```bash
# Create src/wasm/loader.ts
# Implement module initialization
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 2)
```

- [ ] WASM loader created
- [ ] TypeScript bindings added

---

## Step 2.7: Implement Web Workers

```bash
cd ../../apps/web
mkdir -p lib/workers

# Create lib/workers/compute.worker.ts
# Implement worker message handling
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 2)
```

- [ ] Web Worker created
- [ ] WASM integration in worker
- [ ] Message protocol defined

---

## Step 2.8: Create Unit System

```bash
cd ../../packages/math-engine
mkdir -p src/units

# Create src/units/index.ts
# Implement dimensional analysis
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 2)
```

- [ ] Unit system created
- [ ] Dimensional analysis working
- [ ] Unit conversions implemented

---

## Step 2.9: Add Symbolic Differentiation

```bash
mkdir -p src/symbolic

# Create src/symbolic/differentiate.ts
# Implement differentiation rules
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 2)
```

- [ ] Symbolic differentiation working
- [ ] Chain rule implemented
- [ ] Simplification added

---

## Step 2.10: Integrate with Frontend

```bash
cd ../../apps/web

# Update calculator store to use math engine
# Add precision controls
# Add mode toggle (exact/approximate)
```

- [ ] Math engine integrated
- [ ] Arbitrary precision working
- [ ] Web Workers isolating compute

---

## Step 2.11: Write Property-Based Tests

```bash
cd ../../packages/math-engine

pnpm add -D fast-check@4.3.0

# Create tests with fast-check
# Test algebraic properties
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 2)
```

- [ ] Property tests written
- [ ] Commutativity verified
- [ ] Associativity verified
- [ ] Identity properties verified

---

### ✅ Phase 2 Complete Checklist
- [ ] Math.js parser working
- [ ] WASM arbitrary precision
- [ ] Web Workers for isolation
- [ ] Unit-aware calculations
- [ ] Symbolic differentiation
- [ ] Property-based tests passing
- [ ] < 100ms typical calculations

---

# 📊 Phase 3: Visualization (Week 3)

## Step 3.1: Create Plot Engine Package

```bash
cd packages/plot-engine

# Create package.json, tsconfig.json
pnpm add three@0.180.0 d3@7.9.0 plotly.js@3.1.1
pnpm install
```

- [ ] Plot engine package created
- [ ] Visualization libraries installed

---

## Step 3.2: Run Ultrathink - WebGL vs WebGPU

**Use Ultrathink to decide:**
- WebGL 2 vs WebGPU vs Hybrid
- Three.js abstraction layer approach
- Shader portability strategy

- [ ] Ultrathink analysis complete
- [ ] Renderer architecture decided

---

## Step 3.3: Create WebGL Renderer

```bash
mkdir -p src/webgl

# Create src/webgl/renderer.ts
# Implement Three.js renderer
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 3)
```

- [ ] WebGL renderer created
- [ ] Scene setup complete
- [ ] Camera configured

---

## Step 3.4: Implement Adaptive Sampling

```bash
mkdir -p src/sampling

# Create src/sampling/adaptive.ts
# Implement recursive subdivision
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 3)
```

- [ ] Adaptive sampling working
- [ ] Tolerance-based subdivision
- [ ] Performance optimized

---

## Step 3.5: Create 2D Plot Component

```bash
cd ../../apps/web
mkdir -p components/plots

# Create components/plots/plot-2d.tsx
# Integrate WebGL renderer
```

- [ ] 2D plot component created
- [ ] Cartesian coordinates working
- [ ] Multiple functions supported

---

## Step 3.6: Create 3D Plot Component

```bash
# Create components/plots/plot-3d.tsx
# Add orbital controls
```

- [ ] 3D plot component created
- [ ] Surface rendering working
- [ ] Camera controls added

---

## Step 3.7: Add Interactive Controls

```bash
# Create components/plots/plot-controls.tsx
# Add zoom, pan, rotate controls
```

- [ ] Interactive controls added
- [ ] Zoom working
- [ ] Pan working
- [ ] Rotate working (3D)

---

## Step 3.8: Implement Parametric Plots

```bash
# Add parametric plot support
# Create examples
```

- [ ] Parametric plots working
- [ ] 2D parametric curves
- [ ] 3D parametric curves

---

## Step 3.9: Add Polar Coordinates

```bash
# Add polar coordinate system
# Create polar plot renderer
```

- [ ] Polar plots working
- [ ] Rose curves rendering
- [ ] Spirals rendering

---

## Step 3.10: Optimize for 60fps

```bash
# Profile rendering performance
# Optimize shaders
# Implement LOD (level of detail)
```

- [ ] 60fps achieved for 10,000 points
- [ ] Memory usage < 20MB
- [ ] Initial render < 50ms

---

## Step 3.11: Add Export Functionality

```bash
# Add PNG export
# Add SVG export
# Add data export
```

- [ ] Export to PNG working
- [ ] Export to SVG working
- [ ] Export data to CSV

---

### ✅ Phase 3 Complete Checklist
- [ ] WebGL renderer working
- [ ] 2D plots (Cartesian, polar)
- [ ] 3D surface plots
- [ ] Parametric plots
- [ ] Interactive controls
- [ ] 60fps rendering
- [ ] Adaptive sampling
- [ ] Export functionality

---

# 🗄️ Phase 4: Backend & Database (Week 4, Days 22-25)

## Step 4.1: Initialize API Package

```bash
cd apps/api

# Create package.json
pnpm add prisma@6.17.1 @prisma/client@6.17.1
pnpm add @apollo/server@4.11.0 graphql@16.9.0
pnpm install
```

- [ ] API package created
- [ ] Prisma installed
- [ ] Apollo Server installed

---

## Step 4.2: Run Ultrathink - Database Schema Design

**Use Ultrathink to design:**
- Table structure
- Relationships
- Indexes
- Performance optimizations

- [ ] Ultrathink analysis complete
- [ ] Schema design finalized

---

## Step 4.3: Initialize Prisma

```bash
pnpx prisma init
```

- [ ] Prisma initialized
- [ ] Schema file created

---

## Step 4.4: Define Database Schema

```bash
# Edit prisma/schema.prisma
# Add User, Worksheet, ForumPost, Comment models
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 4)
```

- [ ] Schema defined
- [ ] Relations configured
- [ ] Indexes added

---

## Step 4.5: Create Migrations

```bash
pnpx prisma migrate dev --name init
```

- [ ] Initial migration created
- [ ] Database tables created
- [ ] Prisma Client generated

---

## Step 4.6: Create GraphQL Schema

```bash
mkdir -p src/schema

# Create src/schema/schema.graphql
# Define types, queries, mutations
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 4)
```

- [ ] GraphQL schema created
- [ ] Types defined
- [ ] Queries defined
- [ ] Mutations defined

---

## Step 4.7: Implement GraphQL Resolvers

```bash
mkdir -p src/resolvers

# Create resolvers for:
# - worksheets
# - forum posts
# - comments
# - users
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 4)
```

- [ ] Worksheet resolvers created
- [ ] Forum resolvers created
- [ ] User resolvers created

---

## Step 4.8: Setup Apollo Server

```bash
# Create src/index.ts
# Configure Apollo Server
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 4)
```

- [ ] Apollo Server configured
- [ ] GraphQL endpoint working

---

## Step 4.9: Implement Authentication

```bash
pnpm add @clerk/nextjs
# OR
pnpm add next-auth

# Configure auth in Next.js app
```

- [ ] Authentication provider added
- [ ] Login/signup working
- [ ] Protected routes configured

---

## Step 4.10: Test GraphQL API

```bash
# Start API server
pnpm dev

# Test queries with GraphQL Playground
```

- [ ] GraphQL playground accessible
- [ ] Queries working
- [ ] Mutations working
- [ ] Authentication working

---

## Step 4.11: Deploy API

```bash
# Deploy to Vercel or Railway
pnpx vercel --prod
```

- [ ] API deployed
- [ ] Database connected
- [ ] Environment variables set

---

### ✅ Phase 4 Complete Checklist
- [ ] Prisma schema deployed
- [ ] GraphQL API working
- [ ] User authentication
- [ ] Worksheet CRUD operations
- [ ] Forum system functional
- [ ] API deployed to production

---

# ☁️ Phase 5: Cloudflare Edge (Week 4, Days 26-28)

## Step 5.1: Create CAS Worker

```bash
cd apps/workers
mkdir cas-service
cd cas-service

pnpm create cloudflare@latest
```

- [ ] Worker project created
- [ ] Hono framework added

---

## Step 5.2: Implement CAS Endpoints

```bash
# Create src/index.ts
# Implement /solve, /differentiate, /integrate endpoints
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 5)
```

- [ ] Solve endpoint working
- [ ] Differentiate endpoint working
- [ ] Integrate endpoint working

---

## Step 5.3: Create R2 Bucket (Use Cloudflare MCP)

```bash
# Use Cloudflare MCP
cloudflare.r2_bucket_create({ name: 'nextcalc-exports' })
```

- [ ] R2 bucket created
- [ ] Public bucket for assets
- [ ] Private bucket for user data

---

## Step 5.4: Create D1 Database (Use Cloudflare MCP)

```bash
# Use Cloudflare MCP
cloudflare.d1_database_create({ name: 'nextcalc-cache' })
```

- [ ] D1 database created
- [ ] Schema initialized
- [ ] Cache tables created

---

## Step 5.5: Create KV Namespace (Use Cloudflare MCP)

```bash
# Use Cloudflare MCP
cloudflare.kv_namespace_create({ title: 'rate-limits' })
```

- [ ] KV namespace created
- [ ] Rate limiting configured

---

## Step 5.6: Setup Hyperdrive (Use Cloudflare MCP)

```bash
# Use Cloudflare MCP
cloudflare.hyperdrive_config_get({ hyperdrive_id: 'your_id' })
```

- [ ] Hyperdrive configured
- [ ] PostgreSQL connection pooling

---

## Step 5.7: Create Export Worker

```bash
cd ../export-service
pnpm create cloudflare@latest

# Implement LaTeX → PDF export
```

- [ ] Export Worker created
- [ ] LaTeX rendering working
- [ ] PDF generation working

---

## Step 5.8: Create Rate Limiter Worker

```bash
cd ../rate-limiter
pnpm create cloudflare@latest

# Implement rate limiting with KV
```

- [ ] Rate limiter created
- [ ] KV integration working
- [ ] Quota management implemented

---

## Step 5.9: Deploy All Workers

```bash
cd ../cas-service
pnpx wrangler deploy

cd ../export-service
pnpx wrangler deploy

cd ../rate-limiter
pnpx wrangler deploy
```

- [ ] CAS service deployed
- [ ] Export service deployed
- [ ] Rate limiter deployed

---

## Step 5.10: Test Edge Deployment

```bash
# Test all endpoints
curl https://cas.yourdomain.com/health
curl https://export.yourdomain.com/health
```

- [ ] All Workers responding
- [ ] R2 storage accessible
- [ ] D1 queries fast (< 10ms)
- [ ] KV rate limiting active

---

### ✅ Phase 5 Complete Checklist
- [ ] CAS microservice on Workers
- [ ] Export service on Workers
- [ ] Rate limiter on Workers
- [ ] R2 storage configured
- [ ] D1 cache database
- [ ] KV rate limiting
- [ ] Hyperdrive connection
- [ ] All services deployed

---

# ✅ Phase 6: Testing & QA (Week 5)

## Step 6.1: Setup Testing Infrastructure

```bash
cd packages/math-engine

pnpm add -D vitest@3.2.4
pnpm add -D @testing-library/react@16.1.0
pnpm add -D playwright@1.56.0
pnpm add -D axe-core@4.11.0
pnpm add -D fast-check@4.3.0
```

- [ ] Testing libraries installed

---

## Step 6.2: Write Unit Tests

```bash
# Create *.test.ts files for all packages
# Test parser, evaluator, renderer, etc.
```

- [ ] Parser tests written
- [ ] Evaluator tests written
- [ ] Renderer tests written
- [ ] Store tests written

---

## Step 6.3: Write Property-Based Tests

```bash
# Use fast-check for algebraic properties
# Test commutativity, associativity, etc.
```

- [ ] Property tests written
- [ ] Algebraic properties verified
- [ ] Edge cases covered

---

## Step 6.4: Write E2E Tests

```bash
cd apps/web

# Create e2e/calculator.spec.ts
# Create e2e/plots.spec.ts
# (See NEXT_GEN_CALCULATOR_SPEC.md Phase 6)
```

- [ ] Calculator E2E tests
- [ ] Plot E2E tests
- [ ] Worksheet E2E tests
- [ ] Forum E2E tests

---

## Step 6.5: Write Accessibility Tests

```bash
# Create e2e/accessibility.spec.ts
# Use axe-core for WCAG compliance
```

- [ ] Accessibility tests written
- [ ] WCAG 2.2 AAA compliance verified
- [ ] Screen reader tested

---

## Step 6.6: Run All Tests

```bash
# From root
pnpm test

# Run E2E tests
cd apps/web
pnpx playwright test
```

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] All accessibility tests passing

---

## Step 6.7: Check Test Coverage

```bash
pnpm test:coverage
```

- [ ] 80%+ code coverage achieved
- [ ] Critical paths 100% covered

---

## Step 6.8: Performance Benchmarking

```bash
# Run Lighthouse
pnpx lighthouse http://localhost:3000

# Run custom benchmarks
```

- [ ] Performance score 90+
- [ ] Accessibility score 100
- [ ] Best practices 95+
- [ ] SEO score 100

---

## Step 6.9: Load Testing

```bash
# Use Artillery or k6 for load testing
```

- [ ] API handles 1000 req/s
- [ ] p95 latency < 200ms
- [ ] No memory leaks

---

## Step 6.10: Security Audit

```bash
pnpm audit
pnpx snyk test
```

- [ ] No critical vulnerabilities
- [ ] Dependencies up to date
- [ ] Security headers configured

---

### ✅ Phase 6 Complete Checklist
- [ ] 80%+ test coverage
- [ ] Property-based tests passing
- [ ] E2E test suite complete
- [ ] Accessibility WCAG AAA
- [ ] Performance benchmarks met
- [ ] Load testing passed
- [ ] Security audit passed

---

# 🎉 Project Complete!

## Final Verification Checklist

### MVP Features
- [ ] Calculator works in browser
- [ ] Keyboard input functional
- [ ] Math.js evaluates expressions
- [ ] KaTeX renders LaTeX
- [ ] History persists locally
- [ ] Deployed to Vercel
- [ ] Load time < 3s

### Full Feature Set
- [ ] WASM arbitrary precision
- [ ] 2D/3D plotting
- [ ] User authentication
- [ ] Worksheets system
- [ ] Forum functional
- [ ] Edge deployment complete
- [ ] All microservices live

### Production Ready
- [ ] 80%+ test coverage
- [ ] WCAG AAA compliance
- [ ] API latency < 200ms
- [ ] 60fps rendering
- [ ] Security audit passed
- [ ] Performance targets met
- [ ] Documentation complete

---

## 📊 Success Metrics

### Performance
- [ ] Calculator latency < 100ms
- [ ] Plot render time < 500ms
- [ ] Page load time < 2s (3G)
- [ ] Lighthouse score 90+

### Quality
- [ ] Zero known critical bugs
- [ ] Test coverage 80%+
- [ ] Accessibility score 100
- [ ] Error rate < 0.1%

### Deployment
- [ ] Frontend on Vercel
- [ ] Workers on Cloudflare
- [ ] Database on Neon/Supabase
- [ ] 99.9% uptime

---

## 🚀 Post-Launch

### Week 6+
- [ ] Monitor analytics
- [ ] Gather user feedback
- [ ] Fix reported bugs
- [ ] Plan features for v2.0

### Future Enhancements
- [ ] Mobile apps (React Native)
- [ ] Offline mode (PWA)
- [ ] Plugin marketplace
- [ ] Advanced CAS features
- [ ] AI-powered suggestions

---

## 📚 Reference Documents

- **QUICK_START_GUIDE.md** - Detailed commands for each step
- **NEXT_GEN_CALCULATOR_SPEC.md** - Complete technical specification
- **SUMMARY_AND_TOOLS_GUIDE.md** - MCP servers and agents
- **SHADCN_CORRECTION.md** - Understanding shadcn/ui
- **SHADCN_QUICK_REFERENCE.md** - Component commands
- **ESNEXT_UPDATE.md** - TypeScript ESNext explanation

---

## 🎯 Quick Commands

```bash
# Development
pnpm dev          # Start all workspaces
pnpm build        # Build all workspaces
pnpm test         # Run all tests
pnpm lint         # Lint all code

# Deployment
pnpx vercel --prod                    # Deploy frontend
pnpx wrangler deploy                  # Deploy Workers
pnpx prisma migrate deploy            # Deploy database

# Testing
pnpm test:coverage                    # Coverage report
pnpx playwright test                  # E2E tests
pnpx lighthouse http://localhost:3000 # Performance audit
```

---

**You did it! NextCalc Pro is ready! 🎉🧮✨**
