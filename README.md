# 📚 NextCalc Pro - Master Documentation Index

## 🗂️ Documentation Structure

This project has **8 comprehensive documents** to guide you through building NextCalc Pro:

### 1. **THIS FILE** - Master Index
**Purpose:** Navigation and quick reference  
**Read:** First (you're here!)

### 2. **STEPS.md** ⭐ QUICK START
**Purpose:** Step-by-step checklist for implementation  
**Read:** Second (actionable steps)  
**Contains:**
- Phase-by-phase checklist (0-6)
- Copy-paste ready commands
- Completion checkboxes
- Quick reference commands
- Time estimates for each phase

### 3. **SHADCN_CORRECTION.md** ⚠️ IMPORTANT
**Purpose:** Explains shadcn/ui correctly (it's NOT a package!)  
**Read:** Third (critical clarification)  
**Contains:**
- What shadcn/ui actually is (CLI tool, not npm package)
- How it works (copies components to your project)
- Correct vs incorrect usage
- Why "0.9.5" vs "3.4.0" doesn't apply

### 4. **ESNEXT_UPDATE.md** ✅ UPDATE
**Purpose:** Explains TypeScript target change (ES2023 → ESNext)  
**Read:** Optional (good to know)  
**Contains:**
- Why ESNext is better (future-proof)
- What features are included
- Browser compatibility notes
- No breaking changes

### 5. **SHADCN_QUICK_REFERENCE.md**
**Purpose:** Quick reference card for shadcn/ui  
**Read:** Keep handy during development  
**Contains:**
- Copy-paste commands
- Component checklist for NextCalc Pro
- Troubleshooting guide
- Official links

### 6. **NEXT_GEN_CALCULATOR_SPEC.md**
**Purpose:** Complete technical specification  
**Size:** ~50,000 words  
**Read:** Fourth (deep technical dive)  
**Contains:**
- Full tech stack with exact versions
- Complete project structure
- All 6 implementation phases (detailed)
- TypeScript 5.9.3 advanced patterns (with ESNext)
- Testing strategy
- Deployment pipeline
- Performance targets

### 7. **QUICK_START_GUIDE.md**
**Purpose:** Detailed step-by-step implementation  
**Size:** ~15,000 words  
**Read:** Fifth (detailed commands)  
**Contains:**
- Complete commands for each phase
- Full code examples
- Configuration file templates
- Troubleshooting guide
- Component implementations

### 8. **SUMMARY_AND_TOOLS_GUIDE.md**
**Purpose:** Agent setup and tool usage  
**Size:** ~8,000 words  
**Read:** Sixth (reference during dev)  
**Contains:**
- 4 AI agent configurations
- MCP server usage guide
- Ultrathink decision framework
- Tool selection decision tree
- Timeline with tool usage

---

## 🎯 How to Use This Documentation

### For Complete Beginners
```
1. Read THIS FILE (Master Index) ← You are here
2. Read STEPS.md ⭐ (step-by-step checklist)
3. Read SHADCN_CORRECTION.md ⚠️ CRITICAL
4. Read SUMMARY_AND_TOOLS_GUIDE.md
5. Follow STEPS.md → Check off each item
6. Reference QUICK_START_GUIDE.md for detailed commands
7. Reference SPEC.md as needed
8. Keep SHADCN_QUICK_REFERENCE.md handy
```

### For Experienced Developers
```
1. Skim THIS FILE
2. Jump to STEPS.md ⭐ (start checking boxes)
3. Read SHADCN_CORRECTION.md ⚠️ (avoid confusion)
4. Use QUICK_START_GUIDE.md for detailed commands
5. Use SUMMARY_AND_TOOLS_GUIDE.md for MCP/Agent setup
6. Reference SPEC.md for architecture decisions
7. Use SHADCN_QUICK_REFERENCE.md for component commands
```

### For Claude Code
```
1. Load all 8 documents into context
2. Follow STEPS.md sequentially (checklist approach)
3. Read SHADCN_CORRECTION.md to understand component setup
4. Use QUICK_START_GUIDE.md for detailed implementations
5. Use SUMMARY for agent prompts
6. Use SPEC for detailed architecture
7. Ask Ultrathink questions when needed
8. Reference SHADCN_QUICK_REFERENCE for component commands
```

---

## 📋 Master Checklist

### ✅ Phase 0: Setup (Week 1 - Days 1-2)
- [ ] Read all documentation
- [ ] Get Vercel account & API token
- [ ] Get Cloudflare account & API token
- [ ] Install Node.js 20+, pnpm 9+
- [ ] Create `.env` file with tokens
- [ ] Initialize monorepo
- [ ] Configure TypeScript 5.9.3
- [ ] Configure Turborepo
- [ ] Configure Biome
- [ ] Setup MCP servers
- [ ] Create workspace structure
- [ ] **Run Ultrathink:** Architecture decision

**Success Criteria:**
```bash
pnpm --version  # 9.x
node --version  # 20.x
ls -la          # See: apps/, packages/, turbo.json, .mcp/
```

---

### ✅ Phase 1: Frontend MVP (Week 1 - Days 3-7)
- [ ] Initialize Next.js 16.0.0-beta.0 app
- [ ] Install React 19.2.0
- [ ] Setup Tailwind 4.1.14
- [ ] Install Radix UI 1.4.3
- [ ] Create calculator store (Zustand)
- [ ] Build Display component
- [ ] Build Keyboard component
- [ ] Build History component
- [ ] Add KaTeX rendering
- [ ] Implement keyboard shortcuts
- [ ] Add dark/light theme
- [ ] **Deploy with Vercel MCP**

**Success Criteria:**
```bash
cd apps/web
pnpm dev
# Open http://localhost:3000
# Calculator works ✅
# Keyboard input works ✅
# History persists ✅
```

**Deploy:**
```typescript
// Use Vercel MCP
vercel.deploy_to_vercel()
```

---

### ✅ Phase 2: Math Engine (Week 2)
- [ ] **Run Ultrathink:** WASM architecture
- [ ] Install Math.js 15.0.0
- [ ] Create expression parser
- [ ] Build type-safe AST
- [ ] Setup Emscripten toolchain
- [ ] Compile MPFR/GMP to WASM
- [ ] Create TypeScript bindings
- [ ] Implement Web Workers
- [ ] Add arbitrary precision support
- [ ] Build unit conversion system
- [ ] Write property-based tests

**Success Criteria:**
```typescript
// Arbitrary precision works
evaluate('2^1000') // Returns exact value
evaluate('sin(pi/2)') // Returns 1.0
evaluate('10 meters to feet') // Unit conversion
```

---

### ✅ Phase 3: Visualization (Week 3)
- [ ] **Run Ultrathink:** WebGL vs WebGPU
- [ ] Install Three.js 0.180.0
- [ ] Install D3.js 7.9.0
- [ ] Install Plotly.js 3.1.1
- [ ] Create WebGL renderer
- [ ] Implement 2D plotting
- [ ] Implement 3D plotting
- [ ] Add interactive controls
- [ ] Build adaptive sampling
- [ ] Optimize for 60fps
- [ ] Add export functionality

**Success Criteria:**
```typescript
// 2D plot renders
plot('sin(x)', { xMin: 0, xMax: 2*Math.PI })

// 3D plot renders
plot3d('sin(x) * cos(y)', { xRange: [-5, 5], yRange: [-5, 5] })

// 60fps confirmed
// Lighthouse performance: 90+
```

---

### ✅ Phase 4: Backend (Week 4 - Days 22-25)
- [ ] **Run Ultrathink:** Database schema
- [ ] Setup PostgreSQL (Neon/Supabase)
- [ ] Install Prisma 6.17.1
- [ ] Design database schema
- [ ] Create migrations
- [ ] Build GraphQL API (Apollo)
- [ ] Implement authentication
- [ ] Create worksheet CRUD
- [ ] Build forum system
- [ ] Add search (Meilisearch)

**Success Criteria:**
```typescript
// API works
query { me { id email name } }

// Worksheets save
mutation { createWorksheet(input: {...}) { id } }

// Forum posts work
mutation { createForumPost(input: {...}) { id } }
```

---

### ✅ Phase 5: Cloudflare Edge (Week 4 - Days 26-28)
- [ ] **Use Cloudflare MCP** for all tasks
- [ ] Create Workers: CAS service
- [ ] Create Workers: Export service
- [ ] Create Workers: Rate limiter
- [ ] Create R2 bucket: nextcalc-exports
- [ ] Create D1 database: nextcalc-cache
- [ ] Create KV namespace: rate-limits
- [ ] Setup Hyperdrive: postgres connection
- [ ] Deploy all Workers
- [ ] Test edge caching

**Cloudflare MCP Commands:**
```typescript
// Create R2 bucket
cloudflare.r2_bucket_create({ name: 'nextcalc-exports' })

// Create D1 database
cloudflare.d1_database_create({ name: 'nextcalc-cache' })

// Create KV namespace
cloudflare.kv_namespace_create({ title: 'rate-limits' })

// Deploy Worker
// (Use wrangler CLI or Cloudflare dashboard)
```

**Success Criteria:**
```bash
# Workers deployed
curl https://cas.nextcalc.app/health # 200 OK

# R2 storage works
# D1 queries fast (< 10ms)
# KV rate limiting active
```

---

### ✅ Phase 6: Testing & Quality (Week 5)
- [ ] Write unit tests (Vitest)
- [ ] 80%+ test coverage
- [ ] Property-based tests (fast-check)
- [ ] E2E tests (Playwright)
- [ ] Accessibility tests (axe-core)
- [ ] Performance benchmarks
- [ ] Load testing
- [ ] Security audit

**Success Criteria:**
```bash
pnpm test              # All pass
pnpm test:coverage     # 80%+ coverage
pnpm test:e2e          # Playwright passes
pnpm test:a11y         # Axe-core: 0 violations

# Lighthouse scores:
# Performance: 90+
# Accessibility: 100
# Best Practices: 95+
# SEO: 100
```

---

## 🤖 Agent Quick Reference

### When to Use Each Agent

| Task Type | Agent | Example |
|-----------|-------|---------|
| React component | Frontend Agent | Build calculator display |
| Styling/layout | Frontend Agent | Implement responsive grid |
| Math parsing | Math Engine Agent | Expression to AST |
| WASM bindings | Math Engine Agent | TypeScript ↔ WASM |
| 2D/3D plots | Visualization Agent | WebGL renderer |
| Shaders | Visualization Agent | Optimize vertex shaders |
| Database schema | Backend Agent | Prisma schema design |
| GraphQL API | Backend Agent | Resolvers implementation |
| Cloudflare setup | Backend Agent | Workers deployment |

### Agent Prompt Templates

**Find in:** `SUMMARY_AND_TOOLS_GUIDE.md` → "Required AI Agents" section

Each agent has a complete prompt template with:
- Tech stack
- Responsibilities
- Constraints
- Output format requirements

---

## 🔌 MCP Server Quick Reference

### Vercel MCP
**Use For:**
- Deploying frontend (apps/web)
- Managing deployments
- Viewing build logs
- Configuring domains

**Key Commands:**
```typescript
vercel.deploy_to_vercel()
vercel.list_deployments({ projectId, teamId })
vercel.get_deployment_build_logs({ idOrUrl, teamId })
```

### Cloudflare MCP
**Use For:**
- Deploying Workers (microservices)
- Creating R2 buckets (storage)
- Creating D1 databases (edge SQL)
- Creating KV namespaces (cache)
- Managing Hyperdrive (DB pooling)

**Key Commands:**
```typescript
cloudflare.workers_list()
cloudflare.r2_bucket_create({ name })
cloudflare.d1_database_create({ name })
cloudflare.kv_namespace_create({ title })
```

**Full Reference:** `SUMMARY_AND_TOOLS_GUIDE.md` → "MCP Server Requirements"

---

## 🧠 Ultrathink Quick Reference

### When to Use
✅ **Use Ultrathink for:**
- Architecture decisions
- WASM engine design
- Performance optimization
- Security architecture
- Complex algorithms
- Trade-off analysis

❌ **Don't use for:**
- Simple CRUD operations
- Basic UI components
- Configuration files
- Bug fixes
- Package installations

### Example Prompts
**Find in:** `SUMMARY_AND_TOOLS_GUIDE.md` → "When to Use Ultrathink"

---

## 📈 Project Timeline Overview

```
Week 1: Foundation + MVP
├─ Day 1-2: Setup (Phase 0)
├─ Day 3-4: Frontend scaffolding
├─ Day 5: Calculator UI
├─ Day 6: KaTeX integration
└─ Day 7: Deploy MVP → Vercel MCP

Week 2: Math Engine
├─ Day 8: Architecture → Ultrathink
├─ Day 9-11: WASM development → Math Engine Agent
└─ Day 12-14: Integration → Math Engine + Frontend Agents

Week 3: Visualization
├─ Day 15: Renderer design → Ultrathink
├─ Day 16-19: WebGL implementation → Visualization Agent
└─ Day 20-21: Interactive controls → Visualization + Frontend Agents

Week 4: Backend + Edge
├─ Day 22: Database schema → Ultrathink
├─ Day 23-25: API development → Backend Agent
└─ Day 26-28: Cloudflare deployment → Backend Agent + Cloudflare MCP

Week 5: Testing & Polish
├─ Day 29-31: Testing → All Agents
└─ Day 32-35: Performance & Security → Ultrathink + All Agents
```

---

## 📦 Technology Stack Summary

### Versions (Exact)
```json
{
  "core": {
    "typescript": "5.9.3",
    "react": "19.2.0",
    "next": "16.0.0-beta.0"
  },
  "ui": {
    "tailwindcss": "4.1.14",
    "@radix-ui/react": "1.4.3",
    "framer-motion": "12.23.24",
    "shadcn-ui": "CLI (latest - not a package)"
  },
  "math": {
    "katex": "0.16.25",
    "mathjs": "15.0.0"
  },
  "visualization": {
    "three": "0.180.0",
    "d3": "7.9.0",
    "plotly.js": "3.1.1"
  },
  "state": {
    "zustand": "5.0.8",
    "@tanstack/react-query": "5.90.3"
  },
  "backend": {
    "prisma": "6.17.1"
  },
  "testing": {
    "vitest": "3.2.4",
    "playwright": "1.56.0",
    "fast-check": "4.3.0"
  }
}
```

---

## 🎯 Success Metrics

### MVP (Week 1)
- [ ] Calculator works in browser
- [ ] Keyboard input functional
- [ ] LaTeX rendering
- [ ] History persists
- [ ] Deployed to Vercel
- [ ] < 3s load time

### Full Feature (Week 4)
- [ ] WASM arbitrary precision
- [ ] 2D/3D plotting
- [ ] User authentication
- [ ] Worksheets system
- [ ] Forum functional
- [ ] Edge deployment complete

### Production Ready (Week 5)
- [ ] 80%+ test coverage
- [ ] WCAG AAA compliance
- [ ] < 200ms API latency
- [ ] 60fps rendering
- [ ] Security audit passed
- [ ] Performance benchmarks met

---

## 📞 Need Help?

### During Setup
→ Read: `QUICK_START_GUIDE.md` → Phase 0

### During Development
→ Reference: `NEXT_GEN_CALCULATOR_SPEC.md` for details

### For Tool Usage
→ Check: `SUMMARY_AND_TOOLS_GUIDE.md`

### Making Decisions
→ Use: Ultrathink (see decision criteria)

---

## 🚀 Ready to Start?

### Step 1: Read Documents (1 hour)
1. ✅ This file (Master Index) - Done!
2. ⏭️ `SUMMARY_AND_TOOLS_GUIDE.md` - Read next
3. ⏭️ `QUICK_START_GUIDE.md` - Then this
4. 📚 `NEXT_GEN_CALCULATOR_SPEC.md` - Reference

### Step 2: Setup Environment (30 min)
- Get Vercel token
- Get Cloudflare credentials
- Install Node.js 20+, pnpm 9+
- Create `.env` file

### Step 3: Start Building! (2-5 weeks)
```bash
# Follow QUICK_START_GUIDE.md
cd ~/projects
mkdir nextcalc-pro
cd nextcalc-pro

# Initialize project (copy commands from QUICK_START_GUIDE.md)
# ... let's build something amazing!
```

---

## 📄 Document Locations

All documents are in the same directory:

```
/home/claude/
├── README.md (this file - start here)
├── STEPS.md (⭐ step-by-step checklist - use this!)
├── SHADCN_CORRECTION.md (⚠️ read second - critical)
├── ESNEXT_UPDATE.md (✅ TypeScript target change)
├── SHADCN_QUICK_REFERENCE.md (keep handy)
├── NEXT_GEN_CALCULATOR_SPEC.md (complete spec)
├── QUICK_START_GUIDE.md (detailed commands)
└── SUMMARY_AND_TOOLS_GUIDE.md (agents & tools)
```

---

**⭐ Ready to build? Start with `STEPS.md` for your implementation checklist!**

**⚠️ Before coding: Read `SHADCN_CORRECTION.md` to understand how shadcn/ui works!**

**✅ TypeScript now uses ESNext (see `ESNEXT_UPDATE.md` for details)**

**You're all set! Follow `STEPS.md` step-by-step →**

**Good luck building NextCalc Pro! 🚀**
