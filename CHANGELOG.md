# Changelog

All notable changes to NextCalc Pro are documented in this file.

## [1.0.0] - 2026-02-28

### 2026-02-24

#### Features
- Seed Lorenz GPU particles along the attractor trajectory (`6aa3223`)
- 5 procedural space cubemap themes with configurable resolution (`6876731`)
- Add 5 colormaps (inferno, coolwarm, cividis, magma, spectral) and fix zoom sensitivity (`5e2c498`)
- Upgrade PageRank nodes to 3D spheres with proper lighting and size cap (`998631e`)

#### Bug Fixes
- Attention matrix multi-hue OKLCH colormap for dark theme readability (`bddf9f2`)
- Add cubic, Gauss, circle maps to bifurcation WebGPU shader (`6938f89`)
- Use SVG markers for eigenvector arrowheads to fix alignment (`115b2a7`)
- Improve box plot whisker visibility with dashed strokes (`118b708`)
- Symbolic integration of x*ln(x) via integration by parts (`070818f`)
- PDE solver re-runs on all parameter changes, fixing blank heatmap (`1bb87b9`)
- Use seeded PRNG in MetaLearningPlayground to prevent hydration mismatch (`5f7e3a1`)
- Body suppressHydrationWarning, favicon metadata, temperature icon overflow (`81df29d`)

#### Maintenance
- Bump biome 2.4.4, tailwind 4.2.1, hono 4.12.2, typescript 6.0.0-dev.20260223, workers-types 4.20260302.0 (`0ac9bd8`)

### 2026-02-21

#### Features
- Add 4 PDE initial condition presets (double Gaussian, sawtooth, square pulse, sinc) (`d5659f4`)
- Add 3 graph presets and detailed proof section for algorithm results (`53396a3`)
- Detailed rule explanations for integration and derivative solver steps (`58816d2`)
- Add polar plot analysis section (symmetry, petals, area) (`f9b1c31`)

#### Bug Fixes
- Update symbolic page to reflect full integration capabilities (`1490a47`)
- ML attention matrix readability and similarity matrix OKLCH colors (`707114e`)
- Box plot whiskers, end-caps, and hover tooltips (`57878f7`)
- Complex panel Unicode subscripts and conjugate overline rendering (`d29c5ee`)
- Fourier axis labels respect zoom/pan visible window (`746ec18`)
- Bifurcation DPR scaling, Y-axis pan, add 10 presets (`f927b2f`)
- Implement proper SSAO with GTAONode instead of empty AO slot (`aa3d565`)
- Resolve stale closure in Lorenz GPU particle toggle (`a06ceff`)
- Resolve WebGPU init race condition in PDE heatmap (`24cd16d`)
- Prevent PageRank crash when clearing graph (division by zero guard) (`af9228e`)

#### Maintenance
- Bump dependencies: next, biome, three, prisma, framer-motion, hono, etc. (`0465421`)

---

## [0.1.0] - 2025-10-16

### Initial Release

#### Features
- Complete Phase 1 MVP calculator with history, keyboard shortcuts, and LaTeX rendering (`62208ef`)
- Next.js 16.0.0-beta.0 with React 19.2.0 upgrade (`e1e8ba5`)
- Next.js app with App Router and shared types package (`1a9f33f`)

#### Infrastructure
- Initial project setup with Turborepo, TypeScript 5.9.3, and ESNext (`b195e60`)

---

_This changelog is generated from the git history. Commit hashes reference the short SHA for each change._

[1.0.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v1.0.0
[0.1.0]: https://github.com/ABCrimson/NextCalc/releases/tag/v0.1.0
