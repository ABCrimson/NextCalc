# 🧮 Next-Gen Scientific Calculator - Complete Specification
## Claude Code Implementation Guide

> **Project Name:** NextCalc Pro  
> **Target:** Modern replacement for Web2.0calc  
> **Stack:** React 19.2.0 + Next.js 16.0.0-beta.0 + TypeScript 5.9.3  
> **Deployment:** Vercel + Cloudflare Workers  

---

# 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack Versions](#technology-stack-versions)
3. [MCP Server Requirements](#mcp-server-requirements)
4. [Agent Architecture](#agent-architecture)
5. [When to Use Ultrathink](#when-to-use-ultrathink)
6. [Project Structure](#project-structure)
7. [Implementation Phases](#implementation-phases)
8. [TypeScript 5.9.3 Patterns](#typescript-593-patterns)
9. [Development Guidelines](#development-guidelines)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Pipeline](#deployment-pipeline)

---

# 🎯 Project Overview

## Vision
Build a modern, accessible, high-performance scientific calculator that surpasses Web2.0calc with:
- **Precision compute** via WASM-backed engine
- **Symbolic CAS** with step-by-step solving
- **Interactive 3D graphing** with WebGL/WebGPU
- **Collaborative worksheets** with real-time sync
- **Modern UX** with full accessibility
- **Community-driven** forum and examples

## Core Principles
1. **Type Safety First:** Leverage TypeScript 5.9.3 to its fullest
2. **Performance:** WASM for compute, Web Workers for isolation, edge caching
3. **Accessibility:** WCAG 2.2 AAA compliance, keyboard-first navigation
4. **Extensibility:** Plugin architecture for custom functions/units
5. **Privacy:** Local-first mode, explicit consent, data sovereignty

---

# 🔧 Technology Stack Versions

## Core Framework
```json
{
  "typescript": "5.9.3",
  "react": "19.2.0",
  "next": "16.0.0-beta.0"
}
```

## UI & Styling
```json
{
  "tailwindcss": "4.1.14",
  "@radix-ui/react": "1.4.3",
  "framer-motion": "12.23.24",
  "shadcn-ui": "CLI (latest)",
  "@chakra-ui/react": "3.27.1"
}
```

**Note:** shadcn/ui is not an npm package. It's a CLI tool that copies pre-built components into your project using `npx shadcn@latest`.

## Math & Visualization
```json
{
  "katex": "0.16.25",
  "mathjax": "4.0.0",
  "three": "0.180.0",
  "plotly.js": "3.1.1",
  "d3": "7.9.0",
  "mathjs": "15.0.0"
}
```

## State Management
```json
{
  "zustand": "5.0.8",
  "@reduxjs/toolkit": "2.9.0",
  "@tanstack/react-query": "5.90.3"
}
```

## Backend & Data
```json
{
  "prisma": "6.17.1",
  "@apollo/server": "4.11.0",
  "@apollo/client": "3.11.8",
  "graphql": "16.9.0"
}
```

## Internationalization
```json
{
  "next-intl": "4.3.12",
  "@lingui/core": "5.5.1",
  "@lingui/react": "5.5.1"
}
```

## Search & Storage
```json
{
  "meilisearch": "0.53.0",
  "@opensearch-project/opensearch": "3.5.1"
}
```

## Testing
```json
{
  "vitest": "3.2.4",
  "jest": "30.2.0",
  "@testing-library/react": "16.1.0",
  "playwright": "1.56.0",
  "cypress": "15.4.0",
  "axe-core": "4.11.0",
  "fast-check": "4.3.0"
}
```

## Build & Dev Tools
```json
{
  "@biomejs/biome": "1.9.4",
  "turbo": "2.3.3",
  "tsx": "4.19.2",
  "wasm-pack": "0.13.1",
  "emscripten": "3.1.69"
}
```

---

# 🔌 MCP Server Requirements

## Required MCP Servers

### 1. **Vercel MCP Server** (Primary Deployment)
**Purpose:** Deploy and manage Next.js application on Vercel  
**Setup:**
```bash
npm install -g @modelcontextprotocol/server-vercel
```

**Usage:**
- Deploy frontend to Vercel edge network
- Manage environment variables
- Configure domain and SSL
- Monitor deployment status
- Access build logs

**When to Use:**
- Initial project deployment
- Production updates
- Environment configuration
- Performance monitoring

---

### 2. **Cloudflare Developer Platform MCP Server** (Edge Compute & Storage)
**Purpose:** Manage Workers, R2, D1, KV, and Hyperdrive  
**Setup:**
```bash
npm install -g @modelcontextprotocol/server-cloudflare
```

**Components to Use:**

#### **Cloudflare Workers**
- **CAS Microservice:** SymPy/symbolic algebra endpoint
- **Export Service:** LaTeX → PDF rendering
- **Rate Limiting:** Request throttling and quota management

#### **Cloudflare R2** (S3-Compatible Storage)
- Store exported PDFs, worksheets, user attachments
- Public bucket for static math assets
- Private bucket for user data

#### **Cloudflare D1** (SQLite at Edge)
- Cache frequently-used formulas
- Store calculation history
- Session state for anonymous users

#### **Cloudflare KV** (Key-Value Store)
- Hot cache for computation results
- Rate limit counters
- Feature flags

#### **Cloudflare Hyperdrive** (Database Acceleration)
- Connection pooling for Postgres
- Edge caching for database queries

**When to Use:**
- Setting up edge compute infrastructure
- Configuring storage buckets
- Managing distributed cache
- Deploying microservices

---

### 3. **GitHub MCP Server** (Optional - CI/CD)
**Purpose:** Manage repository, actions, and releases  
**Setup:**
```bash
npm install -g @modelcontextprotocol/server-github
```

**Usage:**
- Create GitHub Actions workflows
- Manage branch protection rules
- Configure deployment secrets
- Track issues and PRs

---

## MCP Server Configuration

### `.mcp/config.json`
```json
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
```

---

# 🤖 Agent Architecture

## Agent System Overview

Create **4 specialized agents** for different subsystems:

### **Agent 1: Frontend UI Agent** 🎨
**Responsibility:** React components, styling, accessibility, i18n

**Capabilities:**
- Build Radix UI + Tailwind components
- Implement Framer Motion animations
- Create accessible keyboard navigation
- Integrate i18n with next-intl
- Design responsive layouts

**TypeScript Features to Use:**
- Branded types for UI states
- Discriminated unions for component variants
- Template literal types for CSS classes
- `satisfies` for theme objects

**Example Agent Prompt:**
```
You are the Frontend UI Agent for NextCalc Pro.

Context:
- React 19.2.0 with RSC (React Server Components)
- Next.js 16.0.0-beta.0 App Router
- TypeScript 5.9.3 strict mode
- Tailwind 4.1.14 + Radix UI 1.4.3
- shadcn/ui components (CLI-based, uses Radix primitives)
- Framer Motion 12.23.24

Your responsibilities:
1. Create accessible, keyboard-first components
2. Implement WCAG 2.2 AAA standards
3. Use semantic HTML and ARIA labels
4. Build responsive, mobile-first layouts
5. Integrate dark/light/high-contrast themes
6. Ensure i18n compatibility (next-intl)

Constraints:
- All components must be type-safe (no 'any')
- Use branded types for domain concepts
- Implement proper error boundaries
- Test with axe-core for accessibility
- Support RTL languages

Deliver:
- Fully typed React components
- Storybook stories for each component
- Accessibility test coverage
- Performance benchmarks
```

---

### **Agent 2: Math Engine Agent** 🧮
**Responsibility:** Computation, parsing, evaluation, symbolic algebra

**Capabilities:**
- Integrate Math.js for expression parsing
- Build WASM numeric engine wrapper
- Implement unit-aware calculations
- Create symbolic algebra rules
- Develop step-by-step solver

**TypeScript Features to Use:**
- Tagged template literals for math expressions
- Recursive conditional types for AST
- `const` type parameters for literals
- `NoInfer` for generic constraints

**Example Agent Prompt:**
```
You are the Math Engine Agent for NextCalc Pro.

Context:
- Math.js 15.0.0 for expression parsing
- WASM engine for arbitrary precision (via Emscripten)
- TypeScript 5.9.3 for type-safe math operations
- Web Workers for isolated computation

Your responsibilities:
1. Build type-safe expression parser and evaluator
2. Implement arbitrary precision arithmetic (WASM)
3. Create unit-aware dimensional analysis
4. Develop symbolic algebra system
5. Provide step-by-step solution paths
6. Optimize for numerical stability

Constraints:
- All math operations must be deterministic
- Support exact (rational) and approximate (float) modes
- Implement interval arithmetic for uncertainty
- Handle overflow, underflow, NaN, Infinity gracefully
- Validate dimensional consistency for units

Deliver:
- Type-safe math expression AST
- WASM module bindings
- Unit conversion system
- Property-based tests (fast-check)
- Performance benchmarks
```

---

### **Agent 3: Visualization Agent** 📊
**Responsibility:** 2D/3D graphing, WebGL rendering, interactive plots

**Capabilities:**
- Build WebGL/WebGPU plot renderer
- Integrate Three.js for 3D surfaces
- Create D3.js custom visualizations
- Implement Plotly.js for scientific plots
- Develop adaptive sampling algorithms

**TypeScript Features to Use:**
- Mapped types for plot configurations
- Conditional types for dimensionality
- Type guards for WebGL/WebGPU detection

**Example Agent Prompt:**
```
You are the Visualization Agent for NextCalc Pro.

Context:
- Three.js 0.180.0 for 3D rendering
- D3.js 7.9.0 for custom visualizations
- Plotly.js 3.1.1 for scientific plots
- WebGL/WebGPU for GPU acceleration
- TypeScript 5.9.3 strict mode

Your responsibilities:
1. Build GPU-accelerated plot renderer
2. Implement 2D (Cartesian, polar, parametric)
3. Implement 3D (surfaces, parametric curves)
4. Create interactive controls (zoom, pan, rotate)
5. Support annotations, axes, legends
6. Optimize for 60fps rendering

Constraints:
- Graceful WebGL → WebGPU fallback
- Adaptive sampling for complex functions
- Memory-efficient for large datasets
- Accessible plot descriptions (ARIA)
- Export to PNG, SVG, WebP

Deliver:
- WebGL/WebGPU plot renderer
- Type-safe plot configuration API
- Interactive controls component
- Performance profiling results
- Accessibility compliance
```

---

### **Agent 4: Backend & Infrastructure Agent** 🏗️
**Responsibility:** API, database, auth, deployment, observability

**Capabilities:**
- Set up Prisma + PostgreSQL
- Build GraphQL API with Apollo
- Configure Cloudflare Workers
- Implement authentication (Clerk/NextAuth)
- Set up observability (OpenTelemetry)

**TypeScript Features to Use:**
- Prisma-generated types
- GraphQL schema types (codegen)
- Zod for runtime validation

**Example Agent Prompt:**
```
You are the Backend & Infrastructure Agent for NextCalc Pro.

Context:
- Next.js 16.0.0-beta.0 API routes + GraphQL
- Prisma 6.17.1 with PostgreSQL
- Cloudflare Workers for microservices
- TypeScript 5.9.3 strict mode
- Vercel for frontend deployment

Your responsibilities:
1. Design database schema (Prisma)
2. Build GraphQL API (Apollo Server)
3. Deploy microservices (Cloudflare Workers)
4. Implement authentication & authorization
5. Set up caching (Redis, Cloudflare KV)
6. Configure observability (OpenTelemetry)

Constraints:
- Type-safe database queries (Prisma)
- GraphQL schema matches TypeScript types
- Rate limiting and quota management
- GDPR compliance (data export, deletion)
- Zero-downtime deployments

Deliver:
- Prisma schema and migrations
- GraphQL schema and resolvers
- Cloudflare Workers setup
- Authentication flow
- Observability dashboards
```

---

## Inter-Agent Communication

### Shared Types Package
Create `@nextcalc/types` package for shared TypeScript types:

```typescript
// packages/types/src/math.ts
export type MathExpression = {
  readonly type: 'expression';
  readonly ast: ExpressionNode;
  readonly raw: string;
};

export type PlotConfig = {
  readonly type: '2d' | '3d';
  readonly functions: ReadonlyArray<PlotFunction>;
  readonly viewport: Viewport;
};

// More shared types...
```

### Agent Handoff Protocol
1. **Frontend → Math Engine:** User input → AST → Evaluation
2. **Math Engine → Visualization:** Function data → Plot config → Render
3. **Frontend → Backend:** User action → GraphQL mutation → Database
4. **Backend → Frontend:** Server state → React Query → UI update

---

# 🧠 When to Use Ultrathink

## Critical Decision Points Requiring Deep Analysis

### **Use Ultrathink For:**

#### 1. **Architecture Design** (Phase 0)
- **When:** Initial project setup, major architectural decisions
- **Why:** Need to reason through trade-offs, scalability, maintainability
- **Examples:**
  - Monorepo vs. multi-repo strategy
  - State management approach (Zustand vs. Redux vs. Jotai)
  - Database schema design
  - Caching strategy (edge vs. server vs. client)
  - API design (GraphQL vs. REST vs. tRPC)

**Prompt for Ultrathink:**
```
[ULTRATHINK] Analyze the trade-offs between:
1. Monorepo (Turborepo) vs. separate repos
2. Zustand vs. Redux Toolkit for calculator state
3. Postgres + Redis vs. Cloudflare D1 + KV

Consider:
- Development velocity
- Type safety
- Scalability (1M+ users)
- Edge deployment constraints
- Team collaboration
- Cost at scale

Recommend optimal architecture.
```

---

#### 2. **WASM Math Engine Design** (Phase 2)
- **When:** Designing arbitrary precision computation layer
- **Why:** Critical performance and correctness requirements
- **Examples:**
  - Choosing WASM library (MPFR vs. GMP vs. custom)
  - Memory management strategy
  - JavaScript ↔ WASM boundary optimization
  - Parallelization with Web Workers

**Prompt for Ultrathink:**
```
[ULTRATHINK] Design WASM math engine for:
- Arbitrary precision arithmetic (1000+ digits)
- Special functions (gamma, bessel, elliptic)
- Complex number operations
- Matrix operations (100×100)

Constraints:
- < 2MB WASM binary size
- < 100ms for typical calculations
- Thread-safe for Web Workers
- Graceful degradation without WASM

Analyze:
1. MPFR/GMP vs. custom implementation
2. Memory pooling strategies
3. JavaScript ↔ WASM data transfer
4. Error propagation and NaN handling

Deliver: Architecture diagram + type-safe API design
```

---

#### 3. **Performance Optimization** (Phase 3+)
- **When:** Profiling reveals bottlenecks
- **Why:** Need systematic analysis of optimization strategies
- **Examples:**
  - WebGL shader optimization
  - React component memoization strategy
  - GraphQL query optimization
  - Bundle size reduction

**Prompt for Ultrathink:**
```
[ULTRATHINK] Optimize 3D plot rendering performance.

Current metrics:
- 30fps for 1000 points
- 200ms initial render
- 50MB memory usage

Target:
- 60fps for 10,000 points
- < 50ms initial render
- < 20MB memory usage

Analyze:
1. Shader optimization opportunities
2. GPU instancing for point clouds
3. Level-of-detail (LOD) strategies
4. Frustum culling implementation
5. Web Worker offloading

Deliver: Optimization plan with expected gains
```

---

#### 4. **Security & Privacy Design** (Phase 4)
- **When:** Implementing authentication, data handling
- **Why:** Critical compliance and trust requirements
- **Examples:**
  - Authentication flow design
  - Data encryption strategy
  - GDPR compliance implementation
  - Rate limiting and abuse prevention

**Prompt for Ultrathink:**
```
[ULTRATHINK] Design secure, privacy-first architecture.

Requirements:
- GDPR compliance (EU users)
- CCPA compliance (CA users)
- Local-first mode (no backend)
- Secure worksheet sharing
- Academic integrity mode (no cheating)

Analyze:
1. Authentication: Passkeys vs. OAuth vs. Email
2. Encryption: At-rest, in-transit, end-to-end
3. Data retention: Policies and deletion
4. Consent management: Granular controls
5. Audit logging: Compliance trails

Deliver: Security architecture + threat model
```

---

#### 5. **Complex Algorithm Implementation** (Any Phase)
- **When:** Implementing non-trivial algorithms
- **Why:** Need to verify correctness and edge cases
- **Examples:**
  - Symbolic differentiation/integration
  - Equation solver (Newton-Raphson, bisection)
  - Adaptive plot sampling
  - Graph layout algorithms

**Prompt for Ultrathink:**
```
[ULTRATHINK] Implement symbolic differentiation engine.

Requirements:
- Support trig, exp, log, power, polynomial
- Chain rule, product rule, quotient rule
- Simplification of results
- Handle special cases (0, ∞, complex)

Analyze:
1. AST representation for expressions
2. Differentiation rules (pattern matching)
3. Simplification heuristics
4. Edge cases and error handling
5. Performance for deeply nested expressions

Deliver: Type-safe implementation + test suite
```

---

### **Do NOT Use Ultrathink For:**
- Simple CRUD operations
- Straightforward UI components
- Standard configuration files
- Routine bug fixes
- Basic type definitions
- Simple test cases

---

# 📁 Project Structure

```
nextcalc-pro/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Run tests, linting
│       ├── deploy-vercel.yml         # Deploy to Vercel
│       └── deploy-workers.yml        # Deploy Cloudflare Workers
├── apps/
│   ├── web/                          # Next.js 16 beta frontend
│   │   ├── app/
│   │   │   ├── (calculator)/         # Calculator pages
│   │   │   │   ├── page.tsx          # Main calculator UI
│   │   │   │   ├── layout.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── (graphs)/             # Graphing pages
│   │   │   │   ├── 2d/
│   │   │   │   ├── 3d/
│   │   │   │   └── parametric/
│   │   │   ├── (worksheets)/         # Collaborative worksheets
│   │   │   ├── (forum)/              # Community forum
│   │   │   ├── api/                  # API routes
│   │   │   │   ├── graphql/
│   │   │   │   └── webhooks/
│   │   │   ├── layout.tsx            # Root layout
│   │   │   └── globals.css           # Tailwind imports
│   │   ├── components/
│   │   │   ├── calculator/           # Calculator components
│   │   │   │   ├── input.tsx
│   │   │   │   ├── display.tsx
│   │   │   │   ├── keyboard.tsx
│   │   │   │   └── history.tsx
│   │   │   ├── math/                 # Math rendering
│   │   │   │   ├── latex-renderer.tsx
│   │   │   │   └── expression-editor.tsx
│   │   │   ├── plots/                # Visualization components
│   │   │   │   ├── plot-2d.tsx
│   │   │   │   ├── plot-3d.tsx
│   │   │   │   └── plot-controls.tsx
│   │   │   └── ui/                   # Shadcn components
│   │   │       ├── button.tsx
│   │   │       ├── input.tsx
│   │   │       └── ...
│   │   ├── lib/
│   │   │   ├── math-engine.ts        # Math.js wrapper
│   │   │   ├── wasm-loader.ts        # WASM module loader
│   │   │   └── workers/              # Web Workers
│   │   │       └── compute.worker.ts
│   │   ├── styles/
│   │   │   └── themes.ts             # Theme definitions
│   │   ├── public/
│   │   │   └── wasm/                 # WASM binaries
│   │   ├── messages/                 # i18n translations
│   │   │   ├── en.json
│   │   │   ├── es.json
│   │   │   └── ...
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   ├── api/                          # GraphQL API (Node.js)
│   │   ├── src/
│   │   │   ├── schema/               # GraphQL schema
│   │   │   ├── resolvers/            # GraphQL resolvers
│   │   │   ├── services/             # Business logic
│   │   │   ├── middleware/           # Auth, rate limiting
│   │   │   └── index.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── tsconfig.json
│   └── workers/                      # Cloudflare Workers
│       ├── cas-service/              # SymPy wrapper
│       ├── export-service/           # LaTeX → PDF
│       └── rate-limiter/             # Quota management
├── packages/
│   ├── types/                        # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── math.ts
│   │   │   ├── plot.ts
│   │   │   ├── user.ts
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   ├── math-engine/                  # Core math engine
│   │   ├── src/
│   │   │   ├── parser/               # Expression parser
│   │   │   ├── evaluator/            # Evaluator
│   │   │   ├── symbolic/             # Symbolic algebra
│   │   │   ├── units/                # Unit system
│   │   │   └── wasm/                 # WASM bindings
│   │   │       ├── bindings.ts
│   │   │       └── native/           # C/C++ source
│   │   │           ├── mpfr_wrapper.cpp
│   │   │           └── build.sh
│   │   └── tsconfig.json
│   ├── plot-engine/                  # Visualization engine
│   │   ├── src/
│   │   │   ├── webgl/                # WebGL renderer
│   │   │   ├── webgpu/               # WebGPU renderer
│   │   │   ├── sampling/             # Adaptive sampling
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   └── ui/                           # Shared UI components
│       ├── src/
│       │   ├── components/
│       │   └── hooks/
│       └── tsconfig.json
├── tools/
│   ├── scripts/                      # Build scripts
│   └── generators/                   # Code generators
├── .mcp/
│   └── config.json                   # MCP server config
├── biome.json                        # Biome config
├── turbo.json                        # Turborepo config
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json                     # Root tsconfig
```

---

# 🚀 Implementation Phases

## Phase 0: Project Setup (Week 1)

### **Objectives**
- Initialize monorepo with Turborepo
- Configure TypeScript 5.9.3 strict mode
- Set up Next.js 16.0.0-beta.0 with App Router
- Install all dependencies
- Configure MCP servers

### **Tasks**

#### 1. **Initialize Monorepo**
```bash
# Use Turborepo
npx create-turbo@latest nextcalc-pro
cd nextcalc-pro

# Install pnpm
npm install -g pnpm

# Initialize workspaces
pnpm init
```

#### 2. **Create Workspace Structure**
```bash
mkdir -p apps/web apps/api apps/workers
mkdir -p packages/types packages/math-engine packages/plot-engine packages/ui
```

#### 3. **Configure Root TypeScript**
`tsconfig.json`:
```json
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
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "paths": {
      "@nextcalc/types": ["./packages/types/src"],
      "@nextcalc/math-engine": ["./packages/math-engine/src"],
      "@nextcalc/plot-engine": ["./packages/plot-engine/src"],
      "@nextcalc/ui": ["./packages/ui/src"]
    }
  },
  "exclude": ["node_modules", "dist", ".next", ".turbo"]
}
```

#### 4. **Install Dependencies (Root)**
```bash
pnpm add -D typescript@5.9.3 turbo@2.3.3 @biomejs/biome@1.9.4
```

#### 5. **Configure Biome**
`biome.json`:
```json
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
      },
      "complexity": {
        "noForEach": "warn"
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
```

#### 6. **Configure MCP Servers**
`.mcp/config.json`:
```json
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
```

#### 7. **Setup Environment Variables**
`.env.example`:
```bash
# Vercel
VERCEL_TOKEN=your_vercel_token

# Cloudflare
CLOUDFLARE_API_TOKEN=your_cloudflare_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/nextcalc

# Redis
REDIS_URL=redis://localhost:6379

# Auth (Clerk/NextAuth)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret
```

#### 8. **[ULTRATHINK] Architecture Decision**
**Prompt:**
```
[ULTRATHINK] Decide on monorepo strategy for NextCalc Pro.

Options:
1. Turborepo with pnpm workspaces
2. Nx with npm workspaces
3. Lerna with yarn workspaces

Consider:
- TypeScript 5.9.3 project references
- Next.js 16.0.0-beta.0 build caching
- WASM module compilation
- Cloudflare Workers deployment
- Development experience (DX)
- CI/CD integration
- Team scalability (3-10 devs)

Recommend optimal setup with justification.
```

### **Deliverables**
- ✅ Monorepo structure initialized
- ✅ TypeScript 5.9.3 configured
- ✅ All workspaces scaffolded
- ✅ MCP servers configured
- ✅ CI/CD pipeline drafted

---

## Phase 1: Core Calculator UI (Week 2-3)

### **Objectives**
- Build main calculator interface
- Implement keyboard-first input
- Add LaTeX rendering with KaTeX
- Create calculation history
- Set up basic state management

### **Tasks**

#### 1. **Initialize Next.js App**
```bash
cd apps/web
pnpx create-next-app@latest . --typescript --app --tailwind --no-src-dir
```

#### 2. **Install Frontend Dependencies**
```bash
pnpm add react@19.2.0 react-dom@19.2.0 next@15.5.5
pnpm add tailwindcss@4.1.14 @radix-ui/react@1.4.3
pnpm add framer-motion@12.23.24 katex@0.16.25
pnpm add zustand@5.0.8 @tanstack/react-query@5.90.3
pnpm add next-intl@4.3.12
pnpm add -D @types/katex@0.16.7
```

#### 3. **Configure Tailwind 4.1.14**
`tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        calculator: {
          bg: 'var(--calc-bg)',
          display: 'var(--calc-display)',
          button: 'var(--calc-button)',
          operator: 'var(--calc-operator)',
          equals: 'var(--calc-equals)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        math: ['KaTeX_Math', 'Computer Modern', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
```

#### 4. **Create Calculator Component (Agent 1)**
**Use Frontend UI Agent for this task.**

`components/calculator/calculator.tsx`:
```typescript
'use client';

import { useCalculator } from '@/lib/hooks/use-calculator';
import { Display } from './display';
import { Keyboard } from './keyboard';
import { History } from './history';
import type { CalculatorState } from '@nextcalc/types';

export function Calculator() {
  const { state, dispatch } = useCalculator();

  return (
    <div className="flex flex-col gap-4 p-4 bg-calculator-bg rounded-lg shadow-lg">
      <Display expression={state.current} result={state.result} />
      <Keyboard onInput={dispatch} />
      <History entries={state.history} />
    </div>
  );
}
```

#### 5. **Implement State Management (Zustand)**
`lib/stores/calculator-store.ts`:
```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CalculatorState, CalculatorAction } from '@nextcalc/types';

interface CalculatorStore {
  state: CalculatorState;
  dispatch: (action: CalculatorAction) => void;
}

export const useCalculatorStore = create<CalculatorStore>()(
  devtools(
    persist(
      (set) => ({
        state: {
          current: '',
          result: null,
          history: [],
          mode: 'exact',
        },
        dispatch: (action) => {
          set((store) => ({
            state: calculateNextState(store.state, action),
          }));
        },
      }),
      {
        name: 'calculator-storage',
      },
    ),
  ),
);
```

#### 6. **Add KaTeX Rendering**
`components/math/latex-renderer.tsx`:
```typescript
'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LaTeXRendererProps {
  expression: string;
  displayMode?: boolean;
}

export function LaTeXRenderer({ expression, displayMode = false }: LaTeXRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      katex.render(expression, containerRef.current, {
        displayMode,
        throwOnError: false,
        errorColor: '#cc0000',
        strict: 'warn',
      });
    }
  }, [expression, displayMode]);

  return (
    <div
      ref={containerRef}
      className="katex-container"
      role="math"
      aria-label={`Math expression: ${expression}`}
    />
  );
}
```

#### 7. **Implement Keyboard Navigation**
`components/calculator/keyboard.tsx`:
```typescript
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { CalculatorAction } from '@nextcalc/types';

interface KeyboardProps {
  onInput: (action: CalculatorAction) => void;
}

const KEYBOARD_LAYOUT = [
  ['7', '8', '9', '/', 'sin'],
  ['4', '5', '6', '*', 'cos'],
  ['1', '2', '3', '-', 'tan'],
  ['0', '.', '=', '+', 'π'],
] as const;

export function Keyboard({ onInput }: KeyboardProps) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      event.preventDefault();
      onInput({ type: 'KEY_PRESS', payload: event.key });
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onInput]);

  return (
    <div className="grid grid-cols-5 gap-2" role="grid">
      {KEYBOARD_LAYOUT.map((row, rowIdx) => (
        <div key={rowIdx} className="contents">
          {row.map((key) => (
            <Button
              key={key}
              onClick={() => onInput({ type: 'BUTTON_CLICK', payload: key })}
              className="aspect-square"
              aria-label={`Input ${key}`}
            >
              {key}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### **Deliverables**
- ✅ Next.js 16 beta app with App Router
- ✅ Calculator UI with Radix + Tailwind
- ✅ KaTeX math rendering
- ✅ Keyboard-first navigation
- ✅ Zustand state management
- ✅ Calculation history

---

## Phase 2: Math Engine Integration (Week 4-5)

### **Objectives**
- Integrate Math.js for expression parsing
- Build WASM numeric engine
- Implement Web Worker isolation
- Add unit-aware calculations
- Create symbolic differentiation

### **Tasks**

#### 1. **Install Math Engine Dependencies**
```bash
cd packages/math-engine
pnpm add mathjs@15.0.0
pnpm add -D @types/emscripten
```

#### 2. **[ULTRATHINK] WASM Engine Design**
**Prompt:**
```
[ULTRATHINK] Design WASM math engine architecture.

Requirements:
- Arbitrary precision (1000+ digits)
- Special functions (gamma, bessel, zeta)
- Matrix operations (100×100)
- Complex numbers
- < 2MB binary size
- < 100ms typical calculations

Analyze:
1. Library choice: MPFR/GMP vs. custom
2. Memory management: Linear allocator vs. bump allocator
3. JS ↔ WASM boundary: ArrayBuffer vs. typed arrays
4. Error handling: Result types vs. exceptions
5. Thread safety: SharedArrayBuffer considerations

Deliver:
- Architecture diagram
- Type-safe API design
- Build pipeline (Emscripten)
- Performance benchmarks
```

#### 3. **Create Math.js Wrapper (Agent 2)**
**Use Math Engine Agent for this task.**

`packages/math-engine/src/parser.ts`:
```typescript
import { create, all, type MathNode } from 'mathjs';
import type { MathExpression, ExpressionNode } from '@nextcalc/types';

const math = create(all);

export function parse(input: string): MathExpression {
  try {
    const node = math.parse(input);
    return {
      type: 'expression',
      ast: convertToExpressionNode(node),
      raw: input,
    } satisfies MathExpression;
  } catch (error) {
    throw new Error(`Parse error: ${error}`);
  }
}

function convertToExpressionNode(node: MathNode): ExpressionNode {
  // Convert Math.js node to our typed AST
  // Use TypeScript 5.9.3 discriminated unions
}
```

#### 4. **Build WASM Module**
`packages/math-engine/src/wasm/native/mpfr_wrapper.cpp`:
```cpp
#include <emscripten/bind.h>
#include <mpfr.h>

class ArbitraryPrecision {
public:
  ArbitraryPrecision(int precision = 256) {
    mpfr_init2(value, precision);
  }
  
  ~ArbitraryPrecision() {
    mpfr_clear(value);
  }
  
  void set(const std::string& str) {
    mpfr_set_str(value, str.c_str(), 10, MPFR_RNDN);
  }
  
  std::string toString() const {
    char* str = mpfr_get_str(nullptr, nullptr, 10, 0, value, MPFR_RNDN);
    std::string result(str);
    mpfr_free_str(str);
    return result;
  }
  
  // Add arithmetic operations...
  
private:
  mpfr_t value;
};

EMSCRIPTEN_BINDINGS(arbitrary_precision) {
  emscripten::class_<ArbitraryPrecision>("ArbitraryPrecision")
    .constructor<int>()
    .function("set", &ArbitraryPrecision::set)
    .function("toString", &ArbitraryPrecision::toString);
}
```

#### 5. **Compile WASM**
`packages/math-engine/src/wasm/native/build.sh`:
```bash
#!/bin/bash
set -e

emcc mpfr_wrapper.cpp \
  -o ../../../public/wasm/math-engine.js \
  -I/opt/homebrew/include \
  -L/opt/homebrew/lib \
  -lmpfr -lgmp \
  -O3 \
  -s WASM=1 \
  -s EXPORTED_RUNTIME_METHODS='["cwrap"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME='createMathEngine' \
  --bind
```

#### 6. **Create WASM Loader**
`packages/math-engine/src/wasm/loader.ts`:
```typescript
import type { MathEngineModule } from '@nextcalc/types';

let wasmModule: MathEngineModule | null = null;

export async function loadMathEngine(): Promise<MathEngineModule> {
  if (wasmModule) return wasmModule;

  const createModule = await import('../../../public/wasm/math-engine.js');
  wasmModule = await createModule.default();
  
  return wasmModule;
}

export function useMathEngine(): MathEngineModule {
  if (!wasmModule) {
    throw new Error('Math engine not initialized. Call loadMathEngine() first.');
  }
  return wasmModule;
}
```

#### 7. **Implement Web Worker**
`lib/workers/compute.worker.ts`:
```typescript
import { loadMathEngine } from '@nextcalc/math-engine/wasm/loader';
import type { ComputeRequest, ComputeResponse } from '@nextcalc/types';

let engine: Awaited<ReturnType<typeof loadMathEngine>> | null = null;

self.addEventListener('message', async (event: MessageEvent<ComputeRequest>) => {
  try {
    if (!engine) {
      engine = await loadMathEngine();
    }

    const result = await compute(event.data, engine);
    
    const response: ComputeResponse = {
      type: 'success',
      result,
      id: event.data.id,
    };
    
    self.postMessage(response);
  } catch (error) {
    const response: ComputeResponse = {
      type: 'error',
      error: String(error),
      id: event.data.id,
    };
    
    self.postMessage(response);
  }
});

async function compute(request: ComputeRequest, engine: any) {
  // Use WASM engine for computation
  // Return typed result
}
```

#### 8. **Add Unit System**
`packages/math-engine/src/units/index.ts`:
```typescript
import type { Unit, Quantity } from '@nextcalc/types';

// Branded type for dimensional safety
type Meter = number & { readonly __brand: 'Meter' };
type Second = number & { readonly __brand: 'Second' };
type Velocity = number & { readonly __brand: 'Velocity' }; // m/s

export function createQuantity<T extends string>(
  value: number,
  unit: Unit<T>,
): Quantity<T> {
  return {
    value,
    unit,
    dimension: unit.dimension,
  } satisfies Quantity<T>;
}

export function convert<T extends string>(
  quantity: Quantity<T>,
  targetUnit: Unit<T>,
): Quantity<T> {
  // Dimensional analysis + conversion
}
```

### **Deliverables**
- ✅ Math.js expression parser
- ✅ WASM arbitrary precision engine
- ✅ Web Worker compute layer
- ✅ Unit-aware calculations
- ✅ Type-safe math operations

---

## Phase 3: Advanced Visualization (Week 6-7)

### **Objectives**
- Build WebGL/WebGPU plot renderer
- Implement 2D/3D graphing
- Add interactive controls (zoom, pan)
- Create adaptive sampling
- Support multiple plot types

### **Tasks**

#### 1. **Install Visualization Dependencies**
```bash
cd packages/plot-engine
pnpm add three@0.180.0 d3@7.9.0 plotly.js@3.1.1
pnpm add -D @types/three @types/d3 @types/plotly.js
```

#### 2. **[ULTRATHINK] WebGL vs WebGPU**
**Prompt:**
```
[ULTRATHINK] Decide between WebGL 2 and WebGPU for plot rendering.

Requirements:
- 60fps for 10,000 points
- Parametric surfaces (100×100 grid)
- Real-time interaction (zoom, pan, rotate)
- Browser support: Chrome, Firefox, Safari

Analyze:
1. WebGL 2: Mature, wide support, performance
2. WebGPU: Faster, modern API, limited support
3. Hybrid approach: WebGPU + WebGL fallback
4. Three.js abstraction layer

Consider:
- Development complexity
- Maintenance burden
- Progressive enhancement
- Shader portability

Recommend optimal approach.
```

#### 3. **Create WebGL Renderer (Agent 3)**
**Use Visualization Agent for this task.**

`packages/plot-engine/src/webgl/renderer.ts`:
```typescript
import * as THREE from 'three';
import type { PlotConfig, PlotData } from '@nextcalc/types';

export class WebGLPlotRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  
  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    
    this.setupLights();
    this.setupControls();
  }
  
  render(config: PlotConfig): void {
    this.scene.clear();
    
    for (const func of config.functions) {
      const geometry = this.createGeometry(func);
      const material = this.createMaterial(func);
      const mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  private createGeometry(func: PlotFunction): THREE.BufferGeometry {
    // Adaptive sampling based on function complexity
  }
  
  // More methods...
}
```

#### 4. **Implement Adaptive Sampling**
`packages/plot-engine/src/sampling/adaptive.ts`:
```typescript
import type { MathFunction, SamplingConfig, Point2D } from '@nextcalc/types';

export function adaptiveSample(
  func: MathFunction,
  config: SamplingConfig,
): Point2D[] {
  const points: Point2D[] = [];
  
  function recurse(x1: number, x2: number, depth: number): void {
    if (depth >= config.maxDepth) return;
    
    const xMid = (x1 + x2) / 2;
    const y1 = func(x1);
    const y2 = func(x2);
    const yMid = func(xMid);
    
    // Check if curve is approximately linear
    const expected = (y1 + y2) / 2;
    const error = Math.abs(yMid - expected);
    
    if (error > config.tolerance) {
      // Subdivide further
      recurse(x1, xMid, depth + 1);
      recurse(xMid, x2, depth + 1);
    } else {
      points.push({ x: x1, y: y1 }, { x: xMid, y: yMid });
    }
  }
  
  recurse(config.xMin, config.xMax, 0);
  return points;
}
```

#### 5. **Create Plot Component**
`components/plots/plot-3d.tsx`:
```typescript
'use client';

import { useEffect, useRef } from 'react';
import { WebGLPlotRenderer } from '@nextcalc/plot-engine/webgl/renderer';
import type { PlotConfig } from '@nextcalc/types';

interface Plot3DProps {
  config: PlotConfig;
}

export function Plot3D({ config }: Plot3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLPlotRenderer | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    rendererRef.current = new WebGLPlotRenderer(canvasRef.current);
    rendererRef.current.render(config);
    
    return () => {
      rendererRef.current?.dispose();
    };
  }, [config]);
  
  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      role="img"
      aria-label="3D mathematical plot"
    />
  );
}
```

### **Deliverables**
- ✅ WebGL plot renderer
- ✅ 2D/3D graphing engine
- ✅ Adaptive sampling algorithm
- ✅ Interactive controls
- ✅ Multiple plot types

---

## Phase 4: Backend & Database (Week 8-9)

### **Objectives**
- Set up Prisma + PostgreSQL
- Build GraphQL API
- Implement authentication
- Create user worksheets
- Add forum/Q&A system

### **Tasks**

#### 1. **Initialize Prisma (Agent 4)**
**Use Backend & Infrastructure Agent for this task.**

```bash
cd apps/api
pnpm add prisma@6.17.1 @prisma/client@6.17.1
pnpx prisma init
```

#### 2. **Design Database Schema**
`apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String       @id @default(cuid())
  email         String       @unique
  name          String?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  worksheets    Worksheet[]
  forumPosts    ForumPost[]
  comments      Comment[]
  
  @@map("users")
}

model Worksheet {
  id            String       @id @default(cuid())
  title         String
  description   String?
  content       Json         // Calculation steps
  isPublic      Boolean      @default(false)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  userId        String
  user          User         @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@map("worksheets")
}

model ForumPost {
  id            String       @id @default(cuid())
  title         String
  content       String
  tags          String[]
  upvotes       Int          @default(0)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  userId        String
  user          User         @relation(fields: [userId], references: [id])
  
  comments      Comment[]
  
  @@index([userId])
  @@index([createdAt])
  @@map("forum_posts")
}

model Comment {
  id            String       @id @default(cuid())
  content       String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  userId        String
  user          User         @relation(fields: [userId], references: [id])
  
  postId        String
  post          ForumPost    @relation(fields: [postId], references: [id])
  
  @@index([postId])
  @@index([userId])
  @@map("comments")
}
```

#### 3. **Create GraphQL Schema**
`apps/api/src/schema/schema.graphql`:
```graphql
type Query {
  me: User
  worksheet(id: ID!): Worksheet
  worksheets(userId: ID): [Worksheet!]!
  forumPost(id: ID!): ForumPost
  forumPosts(limit: Int, offset: Int): [ForumPost!]!
}

type Mutation {
  createWorksheet(input: CreateWorksheetInput!): Worksheet!
  updateWorksheet(id: ID!, input: UpdateWorksheetInput!): Worksheet!
  deleteWorksheet(id: ID!): Boolean!
  
  createForumPost(input: CreateForumPostInput!): ForumPost!
  createComment(postId: ID!, content: String!): Comment!
  upvotePost(postId: ID!): ForumPost!
}

type User {
  id: ID!
  email: String!
  name: String
  worksheets: [Worksheet!]!
  forumPosts: [ForumPost!]!
}

type Worksheet {
  id: ID!
  title: String!
  description: String
  content: JSON!
  isPublic: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
  user: User!
}

type ForumPost {
  id: ID!
  title: String!
  content: String!
  tags: [String!]!
  upvotes: Int!
  createdAt: DateTime!
  user: User!
  comments: [Comment!]!
}

type Comment {
  id: ID!
  content: String!
  createdAt: DateTime!
  user: User!
  post: ForumPost!
}

scalar DateTime
scalar JSON
```

#### 4. **Implement GraphQL Resolvers**
`apps/api/src/resolvers/worksheet.resolver.ts`:
```typescript
import { prisma } from '../lib/prisma';
import type { Context } from '../types';

export const worksheetResolvers = {
  Query: {
    worksheet: async (_parent: unknown, { id }: { id: string }, ctx: Context) => {
      return prisma.worksheet.findUnique({
        where: { id },
        include: { user: true },
      });
    },
    
    worksheets: async (_parent: unknown, { userId }: { userId?: string }) => {
      return prisma.worksheet.findMany({
        where: userId ? { userId } : undefined,
        include: { user: true },
        orderBy: { updatedAt: 'desc' },
      });
    },
  },
  
  Mutation: {
    createWorksheet: async (
      _parent: unknown,
      { input }: { input: CreateWorksheetInput },
      ctx: Context,
    ) => {
      if (!ctx.userId) throw new Error('Unauthorized');
      
      return prisma.worksheet.create({
        data: {
          ...input,
          userId: ctx.userId,
        },
        include: { user: true },
      });
    },
    
    // More mutations...
  },
};
```

#### 5. **Set up Apollo Server**
`apps/api/src/index.ts`:
```typescript
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'node:fs';
import { worksheetResolvers } from './resolvers/worksheet.resolver';
import { forumResolvers } from './resolvers/forum.resolver';

const typeDefs = readFileSync('./src/schema/schema.graphql', 'utf-8');

const server = new ApolloServer({
  typeDefs,
  resolvers: {
    Query: {
      ...worksheetResolvers.Query,
      ...forumResolvers.Query,
    },
    Mutation: {
      ...worksheetResolvers.Mutation,
      ...forumResolvers.Mutation,
    },
  },
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }) => {
    // Extract user from JWT token
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await verifyToken(token);
    
    return { userId };
  },
});

console.log(`🚀 GraphQL server ready at ${url}`);
```

#### 6. **Deploy to Vercel (Use Vercel MCP)**
```bash
# Use Vercel MCP to deploy
vercel --prod
```

### **Deliverables**
- ✅ Prisma schema + migrations
- ✅ GraphQL API
- ✅ User authentication
- ✅ Worksheet CRUD
- ✅ Forum system
- ✅ Deployed to Vercel

---

## Phase 5: Cloudflare Edge Integration (Week 10-11)

### **Objectives**
- Deploy CAS microservice to Workers
- Set up R2 for file storage
- Configure D1 for edge caching
- Implement KV for rate limiting
- Connect Hyperdrive to Postgres

### **Tasks**

#### 1. **Initialize Cloudflare Workers (Agent 4 + Cloudflare MCP)**
```bash
cd apps/workers/cas-service
pnpm create cloudflare@latest
```

#### 2. **Create CAS Worker**
`apps/workers/cas-service/src/index.ts`:
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/*', cors());

app.post('/solve', async (c) => {
  const { equation } = await c.req.json();
  
  // Call Python SymPy service (deployed separately)
  const result = await solveSympyEquation(equation);
  
  return c.json({ result });
});

app.post('/differentiate', async (c) => {
  const { expression, variable } = await c.req.json();
  
  const result = await differentiate(expression, variable);
  
  return c.json({ result });
});

export default app;
```

#### 3. **Configure R2 Storage (Use Cloudflare MCP)**
```typescript
// Use Cloudflare MCP to create R2 bucket
// Bucket: nextcalc-exports
```

#### 4. **Set up D1 Database (Use Cloudflare MCP)**
```typescript
// Use Cloudflare MCP to create D1 database
// Database: nextcalc-cache
```

#### 5. **Configure KV for Rate Limiting (Use Cloudflare MCP)**
```typescript
// Use Cloudflare MCP to create KV namespace
// Namespace: nextcalc-rate-limits
```

`apps/workers/rate-limiter/src/index.ts`:
```typescript
export async function rateLimit(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP');
  const key = `ratelimit:${ip}`;
  
  const count = await env.RATE_LIMITS.get(key);
  const current = count ? parseInt(count) : 0;
  
  if (current >= 100) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
  
  await env.RATE_LIMITS.put(key, String(current + 1), {
    expirationTtl: 3600, // 1 hour
  });
  
  return new Response('OK');
}
```

#### 6. **Connect Hyperdrive (Use Cloudflare MCP)**
```typescript
// Use Cloudflare MCP to create Hyperdrive config
// Config: nextcalc-postgres
```

`wrangler.toml`:
```toml
name = "nextcalc-api"
main = "src/index.ts"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "your-hyperdrive-id"
```

### **Deliverables**
- ✅ CAS microservice on Workers
- ✅ R2 storage configured
- ✅ D1 cache database
- ✅ KV rate limiting
- ✅ Hyperdrive connection

---

## Phase 6: Testing & Quality Assurance (Week 12)

### **Objectives**
- Write unit tests (Vitest)
- Property-based tests (fast-check)
- E2E tests (Playwright)
- Accessibility tests (axe-core)
- Performance benchmarks

### **Tasks**

#### 1. **Unit Tests (Vitest)**
`packages/math-engine/src/parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parse } from './parser';

describe('Math Parser', () => {
  it('should parse simple expressions', () => {
    const result = parse('2 + 3');
    expect(result.type).toBe('expression');
    expect(result.raw).toBe('2 + 3');
  });
  
  it('should handle operator precedence', () => {
    const result = parse('2 + 3 * 4');
    // Verify AST structure
  });
});
```

#### 2. **Property-Based Tests (fast-check)**
`packages/math-engine/src/evaluator.test.ts`:
```typescript
import fc from 'fast-check';
import { evaluate } from './evaluator';

describe('Math Evaluator Properties', () => {
  it('should satisfy commutativity: a + b = b + a', () => {
    fc.assert(
      fc.property(fc.float(), fc.float(), (a, b) => {
        const result1 = evaluate(`${a} + ${b}`);
        const result2 = evaluate(`${b} + ${a}`);
        return Math.abs(result1 - result2) < 1e-10;
      }),
    );
  });
  
  it('should satisfy associativity: (a + b) + c = a + (b + c)', () => {
    fc.assert(
      fc.property(fc.float(), fc.float(), fc.float(), (a, b, c) => {
        const result1 = evaluate(`(${a} + ${b}) + ${c}`);
        const result2 = evaluate(`${a} + (${b} + ${c})`);
        return Math.abs(result1 - result2) < 1e-10;
      }),
    );
  });
});
```

#### 3. **E2E Tests (Playwright)**
`apps/web/e2e/calculator.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('should perform basic calculation', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  await page.click('button:has-text("2")');
  await page.click('button:has-text("+")');
  await page.click('button:has-text("3")');
  await page.click('button:has-text("=")');
  
  await expect(page.locator('[data-testid="result"]')).toHaveText('5');
});

test('should support keyboard input', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  await page.keyboard.type('2+3');
  await page.keyboard.press('Enter');
  
  await expect(page.locator('[data-testid="result"]')).toHaveText('5');
});
```

#### 4. **Accessibility Tests (axe-core)**
`apps/web/e2e/accessibility.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should have no accessibility violations', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

### **Deliverables**
- ✅ 80%+ test coverage
- ✅ Property-based tests
- ✅ E2E test suite
- ✅ Accessibility compliance
- ✅ Performance benchmarks

---

# 🎨 TypeScript 5.9.3 Patterns

## Modern Features to Use Throughout

### 1. **Branded Types for Domain Safety**
```typescript
// Prevent mixing different numeric types
type Radians = number & { readonly __brand: 'Radians' };
type Degrees = number & { readonly __brand: 'Degrees' };
type Meters = number & { readonly __brand: 'Meters' };

function toRadians(degrees: Degrees): Radians {
  return ((degrees * Math.PI) / 180) as Radians;
}

function sin(angle: Radians): number {
  return Math.sin(angle);
}

// Type error: can't pass Degrees to sin()
const angle: Degrees = 45 as Degrees;
sin(angle); // ❌ Error
sin(toRadians(angle)); // ✅ OK
```

### 2. **`satisfies` Operator**
```typescript
const config = {
  theme: 'dark',
  precision: 256,
  locale: 'en-US',
} satisfies Config;

// config.theme is still 'dark' (not widened to string)
// But we verify it matches Config shape
```

### 3. **`const` Type Parameters**
```typescript
function createPoint<const T extends readonly [number, number]>(coords: T): T {
  return coords;
}

const p1 = createPoint([1, 2] as const);
// Type: readonly [1, 2] (not [number, number])
```

### 4. **`NoInfer` Utility Type**
```typescript
function createPair<T>(first: T, second: NoInfer<T>): [T, T] {
  return [first, second];
}

// second must match inferred type from first
createPair(1, 2); // ✅ OK
createPair(1, '2'); // ❌ Error: string not assignable to number
```

### 5. **Template Literal Types**
```typescript
type CSSUnit = 'px' | 'em' | 'rem' | '%';
type CSSValue<T extends string> = `${number}${T}`;

type Width = CSSValue<CSSUnit>;
// Type: `${number}px` | `${number}em` | `${number}rem` | `${number}%`

const width: Width = '100px'; // ✅ OK
const invalid: Width = '100vw'; // ❌ Error
```

### 6. **Discriminated Unions**
```typescript
type Result<T, E> =
  | { readonly type: 'success'; readonly value: T }
  | { readonly type: 'error'; readonly error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { type: 'error', error: 'Division by zero' };
  }
  return { type: 'success', value: a / b };
}

const result = divide(10, 2);
if (result.type === 'success') {
  console.log(result.value); // TypeScript knows value exists
} else {
  console.error(result.error); // TypeScript knows error exists
}
```

### 7. **Recursive Conditional Types**
```typescript
type Flatten<T> = T extends Array<infer U>
  ? Flatten<U>
  : T;

type Nested = number[][][];
type Flat = Flatten<Nested>; // Type: number
```

### 8. **Using Declarations (Resource Management)**
```typescript
class DatabaseConnection {
  [Symbol.dispose]() {
    this.close();
  }
  
  close() {
    console.log('Connection closed');
  }
}

function query() {
  using conn = new DatabaseConnection();
  // Use connection...
  // Automatically disposed at end of scope
}
```

---

# 📝 Development Guidelines

## Code Style

### TypeScript
- **Strict mode enabled:** No `any`, explicit types
- **Branded types:** For domain concepts (units, angles, etc.)
- **Result types:** Prefer `Result<T, E>` over exceptions
- **Immutability:** Use `readonly` extensively
- **Discriminated unions:** For state machines and variants

### React
- **Server Components by default:** Client components only when needed
- **TypeScript event handlers:** Fully typed
- **Custom hooks:** Extract reusable logic
- **Memoization:** Use `useMemo`/`useCallback` judiciously
- **Error boundaries:** Wrap potentially failing components

### Naming Conventions
- **Components:** PascalCase (`Calculator`, `PlotView`)
- **Functions:** camelCase (`evaluateExpression`, `renderPlot`)
- **Types/Interfaces:** PascalCase (`MathExpression`, `PlotConfig`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_PRECISION`, `DEFAULT_THEME`)
- **Private fields:** Prefix with `_` (`_cache`, `_renderer`)

## Performance

### Bundle Size
- **Target:** < 500KB initial bundle
- **Code splitting:** Route-based + component-based
- **Tree shaking:** Verify unused code removed
- **Dynamic imports:** For heavy libraries (Three.js, Plotly)

### Runtime Performance
- **FPS:** 60fps for animations and plots
- **TTI:** < 3s on 3G
- **Largest Contentful Paint:** < 2.5s
- **Cumulative Layout Shift:** < 0.1

### Memory
- **Heap usage:** < 100MB idle
- **WebGL contexts:** Dispose properly
- **Web Workers:** Terminate when done

## Accessibility

### WCAG 2.2 AAA Standards
- **Keyboard navigation:** All features accessible
- **Screen readers:** Proper ARIA labels
- **Color contrast:** 7:1 for normal text, 4.5:1 for large
- **Focus management:** Visible focus indicators
- **Math accessibility:** LaTeX → spoken output

## Security

### Input Validation
- **Sanitize user input:** Prevent XSS
- **Rate limiting:** API and compute endpoints
- **CORS:** Strict origin policies
- **CSP:** Content Security Policy headers

### Authentication
- **Passkeys preferred:** WebAuthn
- **JWT tokens:** Short-lived (15 min)
- **Refresh tokens:** HttpOnly cookies
- **2FA optional:** TOTP support

---

# 🧪 Testing Strategy

## Test Pyramid

### Unit Tests (70%)
- **Target:** 80%+ coverage
- **Framework:** Vitest
- **Scope:** Individual functions, components
- **Speed:** < 1s total

### Integration Tests (20%)
- **Framework:** Vitest + React Testing Library
- **Scope:** Component interactions, API calls
- **Speed:** < 10s total

### E2E Tests (10%)
- **Framework:** Playwright
- **Scope:** Critical user journeys
- **Speed:** < 5min total

## Property-Based Testing

Use `fast-check` for algebraic properties:
```typescript
import fc from 'fast-check';

fc.assert(
  fc.property(fc.float(), fc.float(), (a, b) => {
    // Test commutativity
    return evaluate(`${a} + ${b}`) === evaluate(`${b} + ${a}`);
  }),
);
```

## Visual Regression Testing

Use Playwright snapshots:
```typescript
await expect(page).toHaveScreenshot('calculator.png');
```

---

# 🚢 Deployment Pipeline

## CI/CD Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build
      
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## Deployment Targets

### Frontend (Vercel)
- **Production:** `nextcalc.app`
- **Preview:** `pr-123-nextcalc.vercel.app`
- **Edge network:** Global CDN

### API (Vercel Functions)
- **Endpoint:** `api.nextcalc.app`
- **Region:** US-East (primary)

### Workers (Cloudflare)
- **CAS service:** `cas.nextcalc.app`
- **Export service:** `export.nextcalc.app`
- **Edge locations:** Global

### Database (Vercel Postgres)
- **Provider:** Neon or Supabase
- **Region:** US-East
- **Replication:** Read replicas

---

# 🎯 Success Metrics

## User Experience
- **Calculator latency:** < 100ms for typical operations
- **Plot render time:** < 500ms for 1000 points
- **Page load time:** < 2s on 3G
- **Accessibility score:** 100 (Lighthouse)

## Performance
- **API p95 latency:** < 200ms
- **Database p95 latency:** < 50ms (via Hyperdrive)
- **Error rate:** < 0.1%
- **Uptime:** 99.9%

## Engagement
- **Daily active users:** 10,000+ (Month 6)
- **Worksheets created:** 1,000+ (Month 3)
- **Forum posts:** 500+ (Month 6)

---

# 📚 Additional Resources

## Documentation
- [React 19 Docs](https://react.dev)
- [Next.js 16 beta Docs](https://nextjs.org/docs)
- [TypeScript 5.9 Release Notes](https://devblogs.microsoft.com/typescript/)
- [Cloudflare Developers](https://developers.cloudflare.com)
- [Vercel Docs](https://vercel.com/docs)

## Learning Resources
- [Math.js Documentation](https://mathjs.org/docs/)
- [Three.js Examples](https://threejs.org/examples/)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [Emscripten Tutorial](https://emscripten.org/docs/getting_started/Tutorial.html)

---

# ✅ Final Checklist

Before considering the project complete:

## MVP Checklist
- [ ] Calculator UI with keyboard input
- [ ] Math expression parser (Math.js)
- [ ] KaTeX rendering
- [ ] Basic 2D plotting
- [ ] Calculation history
- [ ] Dark/light themes
- [ ] Responsive design
- [ ] Unit tests (60%+ coverage)
- [ ] Deployed to Vercel

## Full Feature Set
- [ ] WASM arbitrary precision
- [ ] Symbolic algebra (CAS)
- [ ] 3D plotting (WebGL)
- [ ] User accounts
- [ ] Worksheet system
- [ ] Forum/Q&A
- [ ] Cloudflare Workers integration
- [ ] E2E test suite
- [ ] WCAG AAA compliance
- [ ] i18n (5+ languages)

## Production Ready
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Documentation complete
- [ ] Monitoring/alerting setup
- [ ] Backup/disaster recovery plan
- [ ] GDPR compliance verified
- [ ] Load testing completed

---

# 🚀 Getting Started

To begin implementation:

1. **Phase 0:** Set up project structure (use this spec)
2. **Activate Agents:** Create 4 specialized agents (prompts above)
3. **Configure MCP Servers:** Vercel + Cloudflare
4. **Start with Phase 1:** Build calculator UI (Agent 1)
5. **Use Ultrathink:** For architecture decisions
6. **Iterate:** Follow phases sequentially
7. **Test continuously:** Unit tests from day 1
8. **Deploy early:** Preview deployments for each PR

---

**End of Specification**

This document should serve as the complete blueprint for Claude Code to build NextCalc Pro. Update this document as requirements evolve.
