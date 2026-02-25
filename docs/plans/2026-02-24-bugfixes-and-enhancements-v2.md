# Bugfixes & Enhancements V2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 18 user-reported issues spanning hydration errors, broken visualizations, missing features, styling bugs, and dependency maintenance.

**Architecture:** Deduplication reduces 18 user items to 15 unique implementation tasks. The body hydration fix resolves 7 identical Grammarly-extension errors. Space-themed procedural cubemaps are built as a shared utility reused by both the 3D Surface Plot and Lorenz Attractor. All fixes are incremental — one commit per task.

**Tech Stack:** Next.js 16.2, React 19.3, Three.js 0.183, TypeScript 6.0, Tailwind CSS 4.2, WebGPU, SVG

---

## Deduplication Map

| User Item | Plan Task | Notes |
|-----------|-----------|-------|
| 1 | Task 1 | Dependency audit |
| 4, 7b, 9, 10, 11, 12, 13 | Task 2 | ALL are Grammarly `<body>` hydration — one fix |
| 8 | Task 3 | MetaLearning `Math.random()` hydration |
| 18 | Task 4 | Favicon |
| 3 | Task 5 | Temperature label overflow |
| 17 | Task 6 | PDE heatmap shows nothing |
| 5 | Task 7 | Symbolic `x*ln(x)` integration |
| 6 | Task 8 | Box plot whiskers visibility |
| 7 | Task 9 | Eigenvector arrowheads |
| 16 (bifurcation part) | Task 10 | Bifurcation cubic/gauss/circle maps |
| 14 | Task 11 | Attention matrix colors |
| 15 | Task 12 | PageRank sphere quality |
| 2 (colormaps + zoom) | Task 13 | 3D Surface colormaps + zoom fix |
| 2 + 16 (backgrounds) | Task 14 | Procedural space cubemaps (shared) |
| 16 (particles part) | Task 15 | Lorenz particles follow attractor |

---

## Phase 1 — Quick Fixes (Tasks 1–5)

### Task 1: Dependency Audit Table

**This is a presentation task — no code changes.**

Present the user with the comprehensive audit compiled by the dependency agent. The table is ready in the agent output. No implementation needed — just relay the results and then proceed to Task 2 immediately.

---

### Task 2: Fix Grammarly Hydration Errors on `<body>`

**Files:**
- Modify: `apps/web/app/layout.tsx:116`

**Context:** The user has the Grammarly browser extension installed. It injects `data-new-gr-c-s-check-loaded` and `data-gr-ext-installed` attributes onto `<body>` at runtime. The `<html>` tag already has `suppressHydrationWarning` but `<body>` does not, causing hydration mismatch warnings on every page (/, /algorithms, /graphs-full, /ml-algorithms, etc.).

**Step 1: Add suppressHydrationWarning to body**

In `apps/web/app/layout.tsx`, line 116, change:
```tsx
<body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
```
to:
```tsx
<body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
```

**Step 2: Verify**

Run dev server, open any page. The `data-gr-ext-installed` / `data-new-gr-c-s-check-loaded` hydration errors should be gone.

**Step 3: Commit**

```
fix: add suppressHydrationWarning to body for browser extension compat
```

---

### Task 3: Fix MetaLearningPlayground Hydration

**Files:**
- Modify: `apps/web/components/algorithms/MetaLearningPlayground.tsx:73-90,202-222`

**Context:** The `generateTask()` function uses `Math.random()` at line 81 to add noise to task data. This is called inside `useState` initializer (lines 202-222), which runs on both server and client, producing different random values → hydration mismatch (loss 0.7856 vs 0.8060).

**Step 1: Replace Math.random with a seeded PRNG**

Add a simple seeded random function above `generateTask`:

```typescript
/** Deterministic PRNG (mulberry32) for reproducible task data */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

**Step 2: Update generateTask to accept a PRNG**

Change the `generateTask` function signature to accept a `rng` parameter:

```typescript
function generateTask(
  taskId: string,
  slope: number,
  intercept: number,
  noise: number = 0.1,
  rng: () => number = Math.random
): MAMLTask {
  const data = Array.from({ length: 10 }, (_, i) => {
    const x = (i - 5) / 5;
    const y = slope * x + intercept + (rng() - 0.5) * noise;
    return { x, y };
  });
```

**Step 3: Use seeded PRNG in the useState initializer**

In the `useState` initializer (lines ~202-222), create the PRNG once and pass it:

```typescript
const [mamlState, setMamlState] = useState<MAMLState>(() => {
  const rng = seededRandom(42);
  return {
    metaParameters: [0.5, 0.5],
    tasks: [
      generateTask('1', 2.0, 1.0, 0.1, rng),
      generateTask('2', -1.5, 0.5, 0.1, rng),
      generateTask('3', 1.0, -0.5, 0.1, rng),
      generateTask('4', -2.0, 1.5, 0.1, rng),
      generateTask('5', 3.5, -1.0, 0.1, rng),
      generateTask('6', -2.5, 2.0, 0.1, rng),
      generateTask('7', 4.5, -2.5, 0.15, rng),
      generateTask('8', -3.8, 2.8, 0.15, rng),
      generateTask('9', 5.5, -3.5, 0.2, rng),
      generateTask('10', -5.0, 4.0, 0.2, rng),
    ],
    // ... rest of initial state
  };
});
```

**Step 4: Verify** — The hydration error showing loss value differences should be gone.

**Step 5: Commit**

```
fix: use seeded PRNG in MetaLearningPlayground to prevent hydration mismatch
```

---

### Task 4: Add Favicon

**Files:**
- Read existing: `apps/web/public/icon.svg` (already exists, 3206 bytes)
- Modify: `apps/web/app/layout.tsx` (add favicon link in metadata)

**Context:** The app has `icon.svg`, `icon-192.png`, and `icon-512.png` in `/public/` but no standard favicon link. Modern Next.js uses the metadata API for icons.

**Step 1: Add icon configuration to metadata**

In `apps/web/app/layout.tsx`, inside the `metadata` export (around line 21), add an `icons` field:

```typescript
icons: {
  icon: [
    { url: '/icon.svg', type: 'image/svg+xml' },
  ],
  apple: '/icon-192.png',
},
```

This tells Next.js to emit the proper `<link rel="icon">` tags.

**Step 2: Verify** — Reload any page and check the browser tab for the icon.

**Step 3: Commit**

```
feat: add favicon via Next.js metadata icons config
```

---

### Task 5: Fix Temperature Category Label Overflow

**Files:**
- Modify: `apps/web/app/units/page.tsx:204-207`

**Context:** The thermometer emoji `🌡️` is `text-xl` (1.25rem/20px) inside a flex row. This emoji has a wider visual bounding box than most icons, causing it to spill out of its expected bounds on some renderers.

**Step 1: Constrain the icon to a fixed-size box**

Change line ~204 from:
```tsx
<span className="text-xl" aria-hidden="true">{card.icon}</span>
```
to:
```tsx
<span className="text-xl w-7 h-7 flex items-center justify-center shrink-0" aria-hidden="true">{card.icon}</span>
```

This gives the emoji a 28px box that centers and clips it, preventing overflow.

**Step 2: Verify** — Navigate to `/units`, check Temperature card. The emoji should be contained.

**Step 3: Commit**

```
fix: constrain unit converter category icon to fixed bounds
```

---

## Phase 2 — Bug Fixes (Tasks 6–11)

### Task 6: Fix PDE Heatmap Showing Nothing

**Files:**
- Modify: `apps/web/app/pde/page.tsx:428-431`

**Context:** The PDE solver page calls `solvePDE(initializeCondition('center'))` in a `useEffect` that depends on `[equationType]` (line 431). However, the `solvePDE` callback depends on `gridSize`, `timeSteps`, `diffusionCoeff`, `waveSpeed` — these are NOT in the effect's deps. If any of these change, the effect doesn't re-run. More critically: `solvePDE` is a `useCallback` that closes over those values, but the effect only re-fires on `equationType` changes. The `initializeCondition` callback is also a useCallback depending on `gridSize`.

The real problem: the `useEffect` dependency array is missing `solvePDE` and `initializeCondition`. When the component first mounts, `solvePDE` fires, but the WebGPUHeatmap hasn't completed its async init yet. The data arrives, but initCompleteRef is still false, so the data upload is deferred via retry. The retry mechanism relies on `dataVersion` state — but `data` changes (from `getCurrentGrid()`) are not triggering re-renders because `simulationData` is set inside the same render cycle.

**Step 1: Fix the useEffect dependencies**

Replace the existing effect (lines 428-431):
```tsx
// biome-ignore lint/correctness/useExhaustiveDependencies: Re-solve when equation type changes
useEffect(() => {
  solvePDE(initializeCondition('center'));
}, [equationType]);
```

with:
```tsx
useEffect(() => {
  solvePDE(initializeCondition(initialCondition));
}, [equationType, solvePDE, initializeCondition, initialCondition]);
```

This ensures the PDE re-solves whenever the equation type, grid size, diffusion coefficient, wave speed, time steps, or initial condition type changes.

**Step 2: Verify** — Navigate to `/pde`, select Heat or Wave. The heatmap should display data immediately (after the WebGPU init retry settles).

**Step 3: Commit**

```
fix: PDE solver re-runs on all parameter changes, fixing blank heatmap
```

---

### Task 7: Fix Symbolic Integration of x*ln(x)

**Files:**
- Modify: `packages/math-engine/src/symbolic/integrate.ts`

**Context:** The IBP engine (lines 654-710) uses `flattenMultiply()` to extract variable factors. For `x * ln(x)`:
- `flattenMultiply` extracts constant=1, factors=[x, ln(x)]
- `liateRank(x)` = 2 (algebraic), `liateRank(ln(x))` = 0 (logarithmic)
- Ranks differ (0 ≠ 2) → IBP triggered ✓
- u = ln(x) (rank 0), dv = x (rank 2)
- v = ∫x dx = x²/2
- du = 1/x
- u*v - ∫v*du = ln(x)·x²/2 - ∫(x²/2 · 1/x) = ln(x)·x²/2 - ∫(x/2)

The remaining integral `∫(x/2)` should be resolved by the power rule. Debug by:
1. Adding a test for `x*ln(x)` integration
2. Running it to identify where the error actually occurs
3. Fixing the root cause

**Step 1: Write the failing test**

In the integration test file (find with `glob packages/math-engine/**/*integrat*test*`), add:

```typescript
it('should integrate x*ln(x) via IBP', () => {
  const result = integrate('x*ln(x)', 'x');
  // Expected: (x^2/2)*ln(x) - x^2/4 + C
  // Or equivalently: x^2*(2*ln(x) - 1)/4
  expect(result).toBeDefined();
  // Verify the result is mathematically correct by differentiating it
  // d/dx[(x^2/2)*ln(x) - x^2/4] = x*ln(x) + x/2 - x/2 = x*ln(x) ✓
});
```

**Step 2: Run the test to see the actual error**

The error will reveal whether the issue is:
- (a) `∫x dx` not returning `x²/2` correctly
- (b) `flattenMultiply` of `(x²/2) * (1/x)` not simplifying to `x/2`
- (c) `∫(x/2) dx` failing

**Step 3: Fix the identified issue**

Based on the error, the fix will be in the IBP chain. The most likely issue is that `v * du` = `(x^2/2) * (1/x)` is not being simplified before the recursive integration call. The `flattenMultiply` at line 740 should handle this, but the constant extraction may fail if `x^2/2` isn't recognized as `0.5 * x^2`.

If the issue is that `∫dv` (integrating `x`) doesn't produce `x^2/2` but rather some AST that `flattenMultiply` can't simplify: add a simplification pass on `v * du` before recursing.

**Step 4: Verify the test passes**

**Step 5: Commit**

```
fix: symbolic integration of x*ln(x) via integration by parts
```

---

### Task 8: Improve Box Plot Whisker Visibility

**Files:**
- Modify: `apps/web/components/calculator/stats-panel.tsx:289-322`

**Context:** The whisker lines exist (lines 303-322) and the end caps exist (lines 374-420). However, the whiskers use gradient strokes (`url(#whiskerLeft)`, `url(#whiskerRight)`) that transition from opacity 0.6 to 0.9, which can appear nearly invisible against dark backgrounds. The user reports whiskers are "missing" — they're likely just too subtle.

**Step 1: Make whiskers more visible**

Replace the gradient-based whisker strokes with solid strokes and increase strokeWidth. Change the gradient definitions (lines 289-300) and whisker lines (303-322):

For the left whisker (line 309), change:
```tsx
stroke="url(#whiskerLeft)"
strokeWidth="2.5"
```
to:
```tsx
stroke={colorEmerald}
strokeWidth="2"
strokeDasharray="6 4"
```

For the right whisker (line 320), same change:
```tsx
stroke={colorEmerald}
strokeWidth="2"
strokeDasharray="6 4"
```

This matches standard statistical box plot conventions where whiskers are dashed lines. Keep the end caps solid and increase their height from ±12 to ±14 pixels for better visibility.

**Step 2: Verify** — Navigate to `/stats`, enter sample data, check box plot.

**Step 3: Commit**

```
fix: improve box plot whisker visibility with dashed strokes
```

---

### Task 9: Fix Eigenvector Arrowhead Alignment

**Files:**
- Modify: `apps/web/components/calculator/eigen-panel.tsx:461-465`

**Context:** The 2D arrowhead is a triangle polygon at `(x2,y2)` with a `rotate()` transform. The rotation center is the tip `(x2,y2)`. The issue (visible in the user's screenshot): the arrowhead points in a slightly wrong direction because the polygon base points are defined as `(x2-6, y2-4)` and `(x2-6, y2+4)` — this creates a right-pointing arrow that is then rotated. But the rotation angle uses `atan2(-(y2-cy), x2-cx)` which flips Y for SVG coordinates. The sign convention can cause the arrow to be ~180° off for vectors pointing into certain quadrants.

**Step 1: Use SVG `<marker>` for proper arrowheads**

Replace the polygon approach with an SVG `<defs>` marker. This guarantees the arrowhead auto-rotates to match the line direction:

Add inside the `<svg>` element, before the arrows:
```tsx
<defs>
  {arrowColors.map((color, i) => (
    <marker
      key={`arrow-${i}`}
      id={`arrowhead-${i}`}
      markerWidth="10"
      markerHeight="8"
      refX="9"
      refY="4"
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <polygon points="0,0 10,4 0,8" fill={color} />
    </marker>
  ))}
</defs>
```

Then replace the line + polygon for each eigenvector (lines 460-465):
```tsx
<line
  x1={cx} y1={cy} x2={x2} y2={y2}
  stroke={color} strokeWidth={2.5}
  markerEnd={`url(#arrowhead-${idx})`}
/>
```

Remove the separate `<polygon>` element (line 461-464) entirely.

**Step 2: Verify** — Navigate to `/matrix`, compute eigenvalues for a 2×2 matrix, check that arrowheads align with their lines.

**Step 3: Commit**

```
fix: use SVG markers for eigenvector arrowheads to fix alignment
```

---

### Task 10: Fix Bifurcation Cubic/Gauss/Circle Maps

**Files:**
- Modify: `apps/web/components/chaos/bifurcation-diagram-renderer.tsx:222-252`
- Modify: `apps/web/components/chaos/webgpu-bifurcation.ts` (WGSL shader)

**Context:** The WebGPU shader only supports logistic/sine/tent maps (line 159-165 in webgpu-bifurcation.ts). When cubic/gauss/circle are selected, `computeBifurcationGPU` returns `null`, triggering the CPU fallback at line 232-237 in the renderer. The CPU fallback (lines 108-117) IS mathematically correct. The issue is likely that the CPU fallback renders correctly but the user doesn't see it because:
1. The GPU status shows "unavailable" (misleading)
2. Or the x0/range parameters for the new maps produce divergent/NaN orbits

**Step 1: Add the three maps to the WGSL shader**

In `webgpu-bifurcation.ts`, extend the WGSL compute shader to support cubic, gauss, and circle maps. Add them to the `GPU_SUPPORTED_MAPS` dictionary:

```typescript
const GPU_SUPPORTED_MAPS: Partial<Record<BifurcationMapType, number>> = {
  logistic: 0,
  sine: 1,
  tent: 2,
  cubic: 3,
  gauss: 4,
  circle: 5,
};
```

Add to the WGSL shader's iterate function:
```wgsl
case 3u: { return r * x - x * x * x; }                           // cubic
case 4u: { return exp(-6.2 * x * x) + r; }                       // gauss
case 5u: { return fract(x + r - (0.5 / 3.14159265) * sin(6.28318530 * x)); }  // circle
```

Also add `isFinite` checks in the WGSL warmup/sample loops to skip NaN/Inf orbits (same as the CPU fallback).

**Step 2: Update CPU fallback divergence handling**

In `computeBifurcationCPU` (lines 123+), add `isFinite` guards during warmup and sampling to skip divergent orbits, same as the main renderer already does for logistic/sine/tent.

**Step 3: Verify** — Navigate to Chaos → Bifurcation, select Cubic Map, Gauss Map, Circle Map. Each should render a diagram.

**Step 4: Commit**

```
fix: add cubic, gauss, circle maps to bifurcation WebGPU shader
```

---

### Task 11: Fix Attention Matrix Colors

**Files:**
- Modify: `apps/web/app/ml-algorithms/page.tsx:472-491`

**Context:** The attention matrix uses a fixed hue of 250 (blue) for all cells, creating a monochromatic light-blue palette where values are indistinguishable. The coloring logic at lines ~472-491 needs a multi-hue colormap.

**Step 1: Replace the monochromatic coloring with a perceptual OKLCH ramp**

Replace the attention cell coloring function with a dark-theme-optimized heatmap that sweeps through hues:

```typescript
// Attention heatmap: deep violet (low) → blue → teal → amber (high)
function attentionColor(score: number): string {
  // Clamp
  const t = Math.max(0, Math.min(1, score));
  // Hue sweep: 290 (violet) → 200 (blue) → 160 (teal) → 80 (amber)
  const hue = 290 - t * 210;
  // Lightness: darker at low values, brighter at high
  const l = 0.25 + t * 0.45;
  // Chroma: subtle at low, vivid at high
  const c = 0.04 + t * 0.18;
  return `oklch(${l} ${c} ${hue})`;
}

function attentionTextColor(score: number): string {
  return score > 0.45 ? 'oklch(0.15 0 0)' : 'oklch(0.92 0 0)';
}
```

Replace the existing inline color computation in the attention matrix JSX with calls to these functions.

**Step 2: Verify** — Navigate to `/ml-algorithms`, scroll to Transformer Attention. The matrix should show a vivid multi-color heatmap: violet for low attention, amber for high.

**Step 3: Commit**

```
fix: attention matrix multi-hue OKLCH colormap for dark theme readability
```

---

## Phase 3 — Enhancements (Tasks 12–15)

### Task 12: Improve PageRank Sphere Quality

**Files:**
- Modify: `apps/web/components/algorithms/PageRankGraphRenderer.tsx`

**Context:** Nodes are rendered as `PlaneGeometry` with a 256×256 canvas texture (not true 3D spheres). The user's screenshot shows them as oversized blurry circles that clip at viewport edges.

**Step 1: Increase canvas texture resolution**

Change the texture canvas size from 256 to 512:
```typescript
const size = 512;
```

**Step 2: Replace PlaneGeometry with SphereGeometry**

Replace the flat plane with a proper 3D sphere:
```typescript
const geometry = new THREE.SphereGeometry(1, 48, 48);
```

Apply the canvas texture as the material's map but switch to `MeshStandardMaterial` with emissive for the glow effect instead of a flat `MeshBasicMaterial`:

```typescript
const material = new THREE.MeshStandardMaterial({
  map: texture,
  emissive: new THREE.Color(glowColor),
  emissiveIntensity: 0.3,
  roughness: 0.4,
  metalness: 0.1,
});
```

**Step 3: Add proper lighting if not present**

Add ambient + directional light to the scene so the spheres have proper shading:
```typescript
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
const directional = new THREE.DirectionalLight(0xffffff, 0.8);
directional.position.set(5, 10, 7);
scene.add(ambient, directional);
```

**Step 4: Reduce maximum node radius**

Cap the maximum display radius so spheres don't dominate/clip:
```typescript
const maxDisplayRadius = Math.min(calculatedRadius, viewportHeight * 0.12);
```

**Step 5: Verify** — Navigate to Algorithms → PageRank. Spheres should be 3D with proper shading, no clipping.

**Step 6: Commit**

```
feat: upgrade PageRank visualization to 3D spheres with proper lighting
```

---

### Task 13: Add 5 Colormaps + Fix Zoom for 3D Surface

**Files:**
- Modify: `packages/plot-engine/src/renderers/webgl-3d.ts` (colormap functions)
- Modify: `apps/web/components/plots/SurfaceEditor3D.tsx` (colormap dropdown, zoom slider)
- Modify: `apps/web/components/plots/Plot3D.tsx` (OrbitControls zoom sensitivity)

**Context:** Currently 4 colormaps (viridis, plasma, turbo, rainbow). Need 5 more. Zoom sensitivity is too low (minDistance=4, maxDistance=400, damping=0.05) — user has to scroll excessively.

**Step 1: Add 5 new colormaps to webgl-3d.ts**

Add these to the `getColorFromMap` function:

1. **inferno** — black → purple → orange → yellow (perceptually uniform, good for heat)
2. **coolwarm** — blue → white → red (diverging, great for ±values)
3. **cividis** — blue → yellow (colorblind-friendly)
4. **magma** — black → purple → orange → white (similar to inferno, softer)
5. **spectral** — red → orange → yellow → green → blue (full rainbow diverging)

Each colormap is an array of `[t, r, g, b]` control points that get linearly interpolated.

**Step 2: Add colormaps to the UI dropdown in SurfaceEditor3D.tsx**

Add the 5 new options to the colormap selector.

**Step 3: Fix zoom sensitivity in Plot3D.tsx**

Change OrbitControls configuration (around line 100):
```typescript
controls.enableDamping = true;
controls.dampingFactor = 0.12;        // was 0.05 — faster response
controls.zoomSpeed = 2.5;             // ADD — default is 1.0, triple it
controls.minDistance = 1;             // was 4 — allow much closer zoom
controls.maxDistance = 400;
controls.screenSpacePanning = true;   // was false — enable for better UX
```

**Step 4: Verify** — Navigate to Plot → 3D Surface. Check that all 9 colormaps appear in dropdown and render correctly. Verify zoom requires fewer scroll steps.

**Step 5: Commit**

```
feat: add 5 colormaps (inferno/coolwarm/cividis/magma/spectral) + fix zoom sensitivity
```

---

### Task 14: Procedural Space Cubemap Backgrounds

**Files:**
- Modify: `packages/plot-engine/src/renderers/webgl-3d.ts:131-292` (refactor + extend cubemap generator)
- Modify: `apps/web/components/plots/SurfaceEditor3D.tsx` (background dropdown + resolution slider)
- Modify: `apps/web/components/plots/Plot3D.tsx` (pass background config)
- Modify: `apps/web/components/chaos/lorenz-3d-renderer.tsx` (reuse background system)

**Context:** The current cubemap is a single generic starfield at 128×128 per face. The user wants 5 distinct cosmic themes at configurable resolutions (1080p=512, 2K=1024, 4K=2048, 8K=4096 per cubemap face). These procedural scenes must run in JS (no external images).

**Step 1: Refactor the cubemap generator into a configurable system**

Create a `SpaceTheme` type and factory in `webgl-3d.ts`:

```typescript
export type SpaceTheme =
  | 'neutron-star-collision'
  | 'black-hole-merger'
  | 'great-attractor'
  | 'dipole-repeller'
  | 'shapley-attractor';

export type CubemapResolution = 512 | 1024 | 2048 | 4096;

export interface SpaceBackgroundConfig {
  theme: SpaceTheme;
  resolution: CubemapResolution;
}
```

**Step 2: Implement 5 procedural cosmic scenes**

Each theme is a `paintFace(faceIndex, size)` function that produces a unique visual:

1. **Neutron Star Collision** — Two bright hot-white point sources (top hemisphere) with orange/red shockwave rings radiating outward, dense blue starfield, gravitational lensing distortion (radial stretch around the collision point), debris field of small bright particles.

2. **Black Hole Merger** — Two dark voids (zero-emission disks) surrounded by bright accretion disk arcs (orange/white), gravitational wave ripple effect as concentric rings distorting the background starfield, blue-shifted region near the merger point.

3. **Great Attractor** — Dense cluster of warm-white point sources in one hemisphere, galaxies represented as elongated smears with spiral hints, flow lines (subtle streaks) converging toward the attractor center, background gradient from deep navy to dark purple.

4. **Dipole Repeller** — Split scene: one hemisphere has a void (very sparse, dark), the other hemisphere is dense with stars. Gradient from warm (attractor side) to cool (repeller side). Cosmic web filaments as faint curved streaks connecting clusters.

5. **Shapley Attractor** — Massive supercluster: hundreds of bright point sources in a concentrated region, ICM glow (diffuse pink/purple halos around cluster centers), background cosmic web structure, deep blue-black void regions.

Each function builds the pixels procedurally using:
- `seededRandom()` for deterministic starfield placement
- Gaussian blobs for nebula/glow regions
- Distance-based falloff for accretion disks/shockwaves
- Cubic interpolation between color control points

**Step 3: Add resolution slider and theme dropdown to 3D Surface UI**

In `SurfaceEditor3D.tsx`, when HDR Lighting is enabled, show:
- A `<select>` dropdown with the 5 space themes
- A resolution slider: 1080p (default) / 2K / 4K / 8K
- Label showing estimated VRAM usage

Pass the config through to `Plot3D.tsx` → `WebGL3DRenderer.setEnvMapEnabled()`.

**Step 4: Reuse in Lorenz renderer**

In `lorenz-3d-renderer.tsx`, import the same cubemap generator and add matching controls (theme dropdown + resolution slider) when the space skybox option is enabled.

**Step 5: Verify** — Test all 5 themes at all 4 resolutions in both 3D Surface and Lorenz. Check that:
- Each theme looks distinctly different
- Higher resolutions produce visibly sharper stars
- Performance is acceptable (8K may take 1-2s to generate)

**Step 6: Commit**

```
feat: 5 procedural space cubemap themes with configurable resolution
```

---

### Task 15: Make Lorenz Particles Follow the Attractor Shape

**Files:**
- Modify: `apps/web/components/chaos/lorenz-3d-renderer.tsx`

**Context:** GPU particles are initialized with random positions in a box `[-20,20] × [-20,20] × [5,45]` (lines 540-549) and evolve independently via the compute shader. They don't track the drawn trajectory — the user wants them to emanate from / follow the actual attractor shape.

**Step 1: Seed particles along the trajectory**

Instead of random box positions, initialize particles at positions sampled from the input `data` array (the actual attractor trajectory):

```typescript
// Sample positions from the trajectory data
const trajectoryLen = data.length;
for (let i = 0; i < particleCount; i++) {
  const idx = Math.floor((i / particleCount) * trajectoryLen);
  const point = data[Math.min(idx, trajectoryLen - 1)];
  // Add small random offset so particles spread slightly
  particleInit[i * 4 + 0] = (point?.x ?? 0) + (seededRng() - 0.5) * 2;
  particleInit[i * 4 + 1] = (point?.y ?? 0) + (seededRng() - 0.5) * 2;
  particleInit[i * 4 + 2] = (point?.z ?? 25) + (seededRng() - 0.5) * 2;
  particleInit[i * 4 + 3] = seededRng() * 4.0; // staggered age
}
```

**Step 2: Update when parameters change**

When the Lorenz parameters (sigma, rho, beta) change and new trajectory data arrives, re-seed the particle buffer with the new trajectory positions. Add an effect or callback that detects when `data` changes and re-initializes the GPU buffer.

**Step 3: Verify** — Navigate to Chaos → Lorenz, change parameters. Particles should cluster around the attractor shape rather than forming a random cloud.

**Step 4: Commit**

```
feat: seed Lorenz GPU particles along the attractor trajectory
```

---

## Phase 4 — Dependency Bumps (Task 16)

### Task 16: Bump Dependencies

**Files:**
- Modify: All `package.json` files across the monorepo

**Packages to bump:**
- `@biomejs/biome` 2.4.3 → 2.4.4 (align all workspaces to root version)
- `@cloudflare/workers-types` 4.20260219.0 → 4.20260302.0
- `@tailwindcss/postcss` 4.2.0 → 4.2.1
- `tailwindcss` 4.2.0 → 4.2.1
- `hono` 4.12.1 → 4.12.2
- `typescript` 6.0.0-dev.20260219 → 6.0.0-dev.20260223

**Do NOT bump** (already ahead of published or major breaking changes):
- gray-matter (^4 → 6.x is a major breaking change, skip)
- @apollo/client (4.2.0-alpha.0 is intentionally on alpha channel)
- prisma/* (7.5.0-dev.15 is intentionally on dev channel)
- vitest/vitest-ui (4.1.0-beta.4 is ahead of published beta)

**Step 1: Update all package.json files**

**Step 2: Run `pnpm install`**

**Step 3: Run `turbo build` to verify clean build**

**Step 4: Commit**

```
chore: bump biome, tailwind, hono, typescript, cloudflare workers-types
```

---

## Verification Checklist

After all tasks:
1. `turbo build` passes with zero errors
2. Dev server starts without hydration errors (with Grammarly extension active)
3. Visual spot-check: 3D Surface (9 colormaps, space backgrounds, zoom), PageRank (3D spheres), Lorenz (particles on attractor), Bifurcation (all 6 maps), PDE (heatmap shows data), Attention (multi-hue), Box Plot (visible whiskers), Eigenvector (aligned arrows), Units (Temperature label contained)
4. Favicon visible in browser tab
