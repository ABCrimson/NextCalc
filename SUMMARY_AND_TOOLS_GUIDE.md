# 🎯 NextCalc Pro - Executive Summary & Tool Usage Guide

## 📄 Document Overview

This project has **3 key documents**:

1. **NEXT_GEN_CALCULATOR_SPEC.md** - Complete technical specification
2. **QUICK_START_GUIDE.md** - Step-by-step implementation commands
3. **This Document** - Tool usage, agents, and Ultrathink guidelines

---

## 🤖 Required AI Agents

Create **4 specialized agents** to parallelize development:

### Agent 1: Frontend UI Agent 🎨
**Prompt Template:**
```
You are the Frontend UI Agent for NextCalc Pro.

Tech Stack:
- React 19.2.0 (RSC + Client Components)
- Next.js 15.5.5 (App Router)
- TypeScript 5.9.3 (strict mode, branded types)
- Tailwind 4.1.14 + Radix UI 1.4.3
- shadcn/ui (CLI-based component library)
- Framer Motion 12.23.24

Responsibilities:
- Build accessible UI components (WCAG AAA)
- Implement keyboard-first navigation
- Create responsive layouts (mobile-first)
- Integrate i18n (next-intl)
- Design system implementation

Constraints:
- No 'any' types allowed
- Use branded types for domain concepts
- All components must pass axe-core tests
- Support RTL languages
- 60fps animations

Output Format:
- TypeScript files with full type safety
- Storybook stories for each component
- Accessibility test coverage
- Performance benchmarks
```

**When to Use:**
- Building React components
- Styling with Tailwind/Radix
- Implementing animations
- Creating responsive layouts
- i18n integration

---

### Agent 2: Math Engine Agent 🧮
**Prompt Template:**
```
You are the Math Engine Agent for NextCalc Pro.

Tech Stack:
- Math.js 15.0.0
- WASM (Emscripten + MPFR/GMP)
- TypeScript 5.9.3 (const type params, NoInfer)
- Web Workers

Responsibilities:
- Expression parsing and AST construction
- Arbitrary precision arithmetic (WASM)
- Unit-aware calculations
- Symbolic algebra
- Step-by-step solving

Constraints:
- All operations must be deterministic
- Support exact and approximate modes
- Handle edge cases (NaN, Infinity, overflow)
- Type-safe mathematical operations
- < 100ms for typical calculations

Output Format:
- Type-safe expression AST
- WASM module with TypeScript bindings
- Property-based tests (fast-check)
- Performance benchmarks
```

**When to Use:**
- Math expression parsing
- WASM engine development
- Symbolic algebra implementation
- Unit conversion system
- Numerical computation

---

### Agent 3: Visualization Agent 📊
**Prompt Template:**
```
You are the Visualization Agent for NextCalc Pro.

Tech Stack:
- Three.js 0.180.0 (WebGL/WebGPU)
- D3.js 7.9.0
- Plotly.js 3.1.1
- TypeScript 5.9.3

Responsibilities:
- GPU-accelerated rendering
- 2D/3D plot implementation
- Interactive controls (zoom, pan, rotate)
- Adaptive sampling algorithms
- Export to image formats

Constraints:
- 60fps rendering
- WebGL → WebGPU fallback
- Memory-efficient for large datasets
- Accessible plot descriptions
- < 500ms initial render

Output Format:
- WebGL/WebGPU renderer
- Type-safe plot configuration API
- Performance profiling
- Accessibility compliance report
```

**When to Use:**
- Building plot renderers
- WebGL/Three.js integration
- Adaptive sampling implementation
- Interactive visualization controls
- Performance optimization

---

### Agent 4: Backend & Infrastructure Agent 🏗️
**Prompt Template:**
```
You are the Backend & Infrastructure Agent for NextCalc Pro.

Tech Stack:
- Next.js 15.5.5 API routes
- Prisma 6.17.1 + PostgreSQL
- GraphQL (Apollo Server)
- Cloudflare Workers
- TypeScript 5.9.3

Responsibilities:
- Database schema design (Prisma)
- GraphQL API implementation
- Cloudflare Workers deployment
- Authentication & authorization
- Observability setup

Constraints:
- Type-safe database queries
- Zero-downtime deployments
- GDPR compliance
- Rate limiting and quotas
- < 200ms API p95 latency

Output Format:
- Prisma schema + migrations
- GraphQL schema + resolvers
- Cloudflare Workers code
- Observability dashboards
```

**When to Use:**
- Database schema design
- API development
- Microservices deployment
- Authentication implementation
- Infrastructure configuration

---

## 🔌 MCP Server Requirements

### 1. Vercel MCP Server (REQUIRED)

**Installation:**
```bash
# MCP servers are configured in .mcp/config.json
# No manual installation needed - Claude Code will use them
```

**Configuration:**
```json
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-vercel"],
      "env": {
        "VERCEL_TOKEN": "${VERCEL_TOKEN}"
      }
    }
  }
}
```

**Get Token:**
1. Go to https://vercel.com/account/tokens
2. Create new token
3. Add to `.env`: `VERCEL_TOKEN=your_token`

**When to Use:**
- ✅ Initial project deployment
- ✅ Deploying frontend (apps/web)
- ✅ Managing environment variables
- ✅ Checking deployment status
- ✅ Viewing build logs
- ✅ Configuring custom domains

**Example Commands:**
```typescript
// Deploy project
await vercel.deploy();

// List projects
await vercel.list_projects({ teamId: 'team_xxx' });

// Get deployment logs
await vercel.get_deployment_build_logs({
  idOrUrl: 'dpl_xxx',
  teamId: 'team_xxx'
});
```

---

### 2. Cloudflare Developer Platform MCP Server (REQUIRED)

**Configuration:**
```json
{
  "mcpServers": {
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

**Get Credentials:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create token with:
   - Workers Scripts: Edit
   - Account Settings: Read
   - D1: Edit
   - R2: Edit
   - Workers KV: Edit
3. Get Account ID from dashboard
4. Add to `.env`

**When to Use:**

#### **Workers (Microservices)**
- ✅ Deploy CAS service (SymPy wrapper)
- ✅ Deploy export service (LaTeX → PDF)
- ✅ Deploy rate limiter

**Example:**
```typescript
// List Workers
await cloudflare.workers_list();

// Get Worker code
await cloudflare.workers_get_worker_code({
  scriptName: 'cas-service'
});
```

#### **R2 (Object Storage)**
- ✅ Store exported PDFs
- ✅ Store worksheets
- ✅ Store user attachments
- ✅ Public math assets

**Example:**
```typescript
// Create bucket
await cloudflare.r2_bucket_create({
  name: 'nextcalc-exports'
});

// List buckets
await cloudflare.r2_buckets_list();
```

#### **D1 (SQLite at Edge)**
- ✅ Cache formulas
- ✅ Store calculation history
- ✅ Session state

**Example:**
```typescript
// Create database
await cloudflare.d1_database_create({
  name: 'nextcalc-cache'
});

// Query database
await cloudflare.d1_database_query({
  database_id: 'db_xxx',
  sql: 'SELECT * FROM cache WHERE key = ?',
  params: ['formula_123']
});
```

#### **KV (Key-Value Store)**
- ✅ Rate limiting
- ✅ Hot cache
- ✅ Feature flags

**Example:**
```typescript
// Create namespace
await cloudflare.kv_namespace_create({
  title: 'nextcalc-rate-limits'
});

// List namespaces
await cloudflare.kv_namespaces_list();
```

#### **Hyperdrive (Database Acceleration)**
- ✅ Connection pooling for PostgreSQL
- ✅ Edge caching

**Example:**
```typescript
// Get config
await cloudflare.hyperdrive_config_get({
  hyperdrive_id: 'hd_xxx'
});
```

---

### 3. GitHub MCP Server (OPTIONAL)

**Use Cases:**
- CI/CD workflow setup
- Branch protection rules
- GitHub Actions configuration
- Issue tracking

**Not Required for MVP** - Manual GitHub usage is fine.

---

## 🧠 When to Use Ultrathink

### ✅ ALWAYS Use Ultrathink For:

#### 1. **Architecture Decisions** (Phase 0)
**Example Prompt:**
```
[ULTRATHINK] Analyze monorepo strategy for NextCalc Pro.

Compare:
1. Turborepo + pnpm workspaces
2. Nx + npm workspaces  
3. Lerna + yarn workspaces

Consider:
- TypeScript 5.9.3 project references
- Next.js 15 build caching
- WASM module compilation
- Cloudflare Workers deployment
- CI/CD efficiency
- Team scalability (3-10 devs)

Recommend optimal setup with detailed justification.
```

**Why:** Critical foundation affects entire project.

---

#### 2. **WASM Math Engine Design** (Phase 2)
**Example Prompt:**
```
[ULTRATHINK] Design WASM math engine architecture.

Requirements:
- Arbitrary precision (1000+ digits)
- Special functions (gamma, bessel, elliptic)
- Complex numbers
- Matrix operations (100×100)
- < 2MB binary size
- < 100ms typical calculations

Analyze:
1. MPFR/GMP vs. custom implementation
2. Memory management (linear vs. bump allocator)
3. JS ↔ WASM boundary optimization
4. Error propagation strategy
5. Thread safety for Web Workers

Deliver:
- Architecture diagram
- Type-safe API design
- Build pipeline
- Performance estimates
```

**Why:** Complex low-level optimization with many trade-offs.

---

#### 3. **Performance Optimization** (Any Phase)
**Example Prompt:**
```
[ULTRATHINK] Optimize 3D plot rendering.

Current Metrics:
- 30fps at 1000 points
- 200ms initial render
- 50MB memory usage

Target:
- 60fps at 10,000 points
- < 50ms initial render
- < 20MB memory usage

Analyze:
1. Shader optimization opportunities
2. GPU instancing for point clouds
3. LOD (level of detail) strategies
4. Frustum culling implementation
5. Web Worker offloading potential

Deliver optimization plan with expected gains per technique.
```

**Why:** Performance issues require systematic analysis.

---

#### 4. **Security Architecture** (Phase 4)
**Example Prompt:**
```
[ULTRATHINK] Design secure, privacy-first architecture.

Requirements:
- GDPR compliance (EU)
- CCPA compliance (CA)
- Local-first mode option
- Secure worksheet sharing
- Academic integrity mode

Analyze:
1. Auth: Passkeys vs. OAuth vs. Email
2. Encryption: At-rest, in-transit, E2E
3. Data retention policies
4. Consent management UX
5. Audit logging for compliance

Deliver:
- Security architecture diagram
- Threat model
- Implementation checklist
```

**Why:** Legal compliance and security are critical.

---

#### 5. **Complex Algorithms** (Any Phase)
**Example Prompt:**
```
[ULTRATHINK] Implement symbolic differentiation engine.

Requirements:
- Support: trig, exp, log, power, polynomial
- Chain rule, product rule, quotient rule
- Simplification of results
- Handle edge cases (0, ∞, complex)

Analyze:
1. AST representation options
2. Differentiation rules (pattern matching)
3. Simplification heuristics
4. Edge case handling
5. Performance for nested expressions

Deliver:
- Type-safe implementation
- Comprehensive test suite
- Edge case documentation
```

**Why:** Algorithm correctness requires deep reasoning.

---

### ❌ NEVER Use Ultrathink For:

- Simple CRUD operations
- Basic UI components
- Standard configuration files
- Routine bug fixes
- Straightforward type definitions
- Simple test cases
- Package installations
- File creation/editing

**Why:** These are straightforward tasks that don't benefit from extended reasoning.

---

## 📊 MCP Server Usage Matrix

| Task | Vercel MCP | Cloudflare MCP | GitHub MCP | Ultrathink |
|------|-----------|----------------|-----------|-----------|
| Deploy frontend | ✅ | ❌ | ❌ | ❌ |
| Deploy Workers | ❌ | ✅ | ❌ | ❌ |
| Create R2 bucket | ❌ | ✅ | ❌ | ❌ |
| Setup D1 database | ❌ | ✅ | ❌ | ❌ |
| Configure KV | ❌ | ✅ | ❌ | ❌ |
| View deployment logs | ✅ | ❌ | ❌ | ❌ |
| Architecture decisions | ❌ | ❌ | ❌ | ✅ |
| WASM design | ❌ | ❌ | ❌ | ✅ |
| Performance optimization | ❌ | ❌ | ❌ | ✅ |
| Security design | ❌ | ❌ | ❌ | ✅ |
| CI/CD setup | ❌ | ❌ | ✅* | ❌ |

*Optional

---

## 🎯 Decision Tree: Which Tool to Use?

```
START
│
├─ Need to deploy?
│  ├─ Frontend? → Use Vercel MCP
│  └─ Backend microservice? → Use Cloudflare Workers MCP
│
├─ Need storage?
│  ├─ Files/objects? → Use Cloudflare R2 MCP
│  ├─ Key-value? → Use Cloudflare KV MCP
│  └─ SQL database? → Use Cloudflare D1 MCP
│
├─ Making architecture decision?
│  └─ Use Ultrathink
│
├─ Optimizing performance?
│  └─ Use Ultrathink
│
├─ Designing security?
│  └─ Use Ultrathink
│
├─ Building UI component?
│  └─ Use Frontend Agent
│
├─ Working on math engine?
│  └─ Use Math Engine Agent
│
├─ Creating visualizations?
│  └─ Use Visualization Agent
│
├─ Building API/database?
│  └─ Use Backend Agent
│
└─ Simple task (config, bug fix, etc.)?
   └─ Just do it (no special tools)
```

---

## 📈 Implementation Timeline with Tool Usage

### Week 1: Foundation
- **Day 1-2:** Project setup
  - Tools: None (manual setup)
  - Agent: None
  
- **Day 3-4:** Frontend scaffolding
  - Tools: None
  - Agent: Frontend Agent
  
- **Day 5:** Calculator UI
  - Tools: None
  - Agent: Frontend Agent
  
- **Day 6:** KaTeX integration
  - Tools: None
  - Agent: Frontend Agent
  
- **Day 7:** Deploy MVP
  - Tools: **Vercel MCP** ✅
  - Agent: None

### Week 2: Math Engine
- **Day 8:** Architecture decision
  - Tools: **Ultrathink** ✅
  - Agent: None
  
- **Day 9-11:** WASM development
  - Tools: None
  - Agent: Math Engine Agent
  
- **Day 12-14:** Integration & testing
  - Tools: None
  - Agent: Math Engine Agent + Frontend Agent

### Week 3: Visualization
- **Day 15:** Renderer architecture
  - Tools: **Ultrathink** ✅
  - Agent: None
  
- **Day 16-19:** WebGL implementation
  - Tools: None
  - Agent: Visualization Agent
  
- **Day 20-21:** Interactive controls
  - Tools: None
  - Agent: Visualization Agent + Frontend Agent

### Week 4: Backend
- **Day 22:** Database schema design
  - Tools: **Ultrathink** ✅
  - Agent: None
  
- **Day 23-25:** API development
  - Tools: None
  - Agent: Backend Agent
  
- **Day 26-28:** Deploy infrastructure
  - Tools: **Cloudflare MCP** ✅ (Workers, R2, D1, KV)
  - Agent: Backend Agent

---

## 🚀 Quick Command Reference

### Vercel MCP
```typescript
// Deploy
vercel.deploy_to_vercel()

// List deployments
vercel.list_deployments({ projectId: 'prj_xxx', teamId: 'team_xxx' })

// Get logs
vercel.get_deployment_build_logs({ idOrUrl: 'dpl_xxx', teamId: 'team_xxx' })
```

### Cloudflare MCP
```typescript
// Workers
cloudflare.workers_list()
cloudflare.workers_get_worker({ scriptName: 'cas-service' })

// R2
cloudflare.r2_bucket_create({ name: 'nextcalc-exports' })
cloudflare.r2_buckets_list()

// D1
cloudflare.d1_database_create({ name: 'nextcalc-cache' })
cloudflare.d1_database_query({ database_id: 'db_xxx', sql: 'SELECT...' })

// KV
cloudflare.kv_namespace_create({ title: 'rate-limits' })
cloudflare.kv_namespaces_list()
```

### Ultrathink
```
[ULTRATHINK] Your detailed prompt here with:
- Clear requirements
- Constraints
- Multiple options to analyze
- Specific deliverables requested
```

---

## ✅ Pre-Flight Checklist

Before starting implementation:

### Accounts & Access
- [ ] Vercel account created
- [ ] Vercel API token obtained
- [ ] Cloudflare account created
- [ ] Cloudflare API token created
- [ ] Cloudflare Account ID copied
- [ ] PostgreSQL database provisioned (Neon/Supabase)

### Environment Setup
- [ ] Node.js 20+ installed
- [ ] pnpm 9+ installed
- [ ] `.env` file created with all tokens
- [ ] MCP servers configured in `.mcp/config.json`
- [ ] Git repository initialized

### Documentation Review
- [ ] Read NEXT_GEN_CALCULATOR_SPEC.md
- [ ] Read QUICK_START_GUIDE.md
- [ ] Read this document (SUMMARY.md)
- [ ] Understand agent responsibilities
- [ ] Know when to use each MCP server
- [ ] Understand Ultrathink triggers

---

## 🎓 Learning Resources

### TypeScript 5.9.3
- [Release Notes](https://devblogs.microsoft.com/typescript/)
- [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### React 19 + Next.js 15
- [React Docs](https://react.dev)
- [Next.js Docs](https://nextjs.org/docs)

### Math & Visualization
- [Math.js Docs](https://mathjs.org)
- [KaTeX Docs](https://katex.org)
- [Three.js Examples](https://threejs.org/examples/)

### Infrastructure
- [Vercel Docs](https://vercel.com/docs)
- [Cloudflare Developers](https://developers.cloudflare.com)
- [Prisma Docs](https://www.prisma.io/docs)

---

## 📞 Support & Next Steps

### Start Implementation
1. Follow **QUICK_START_GUIDE.md** step-by-step
2. Create agents using prompts from this document
3. Configure MCP servers
4. Use Ultrathink for major decisions
5. Deploy MVP to Vercel

### Questions?
- Technical spec: See NEXT_GEN_CALCULATOR_SPEC.md
- Implementation: See QUICK_START_GUIDE.md
- Tool usage: This document

---

**Ready to build NextCalc Pro? Let's go! 🚀**

Start with: `QUICK_START_GUIDE.md` → Phase 0
