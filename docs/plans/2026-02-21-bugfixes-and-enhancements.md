# Bugfixes & Enhancements — 15-Item Sprint

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all reported crashes, rendering bugs, and UI issues across the NextCalc Pro monorepo, then add requested enhancements (new presets, proofs, color schemes, higher-res graphics).

**Architecture:** Each task targets a specific component/page. Most are independent and can be implemented in any order after the crash-fix tasks. The math-engine tasks (symbolic UI text fix, solver step detail) modify shared packages. All UI work is in apps/web.

**Tech Stack:** React 19.3, Next.js 16, Three.js 0.183, WebGPU/WGSL, TypeScript 6.0, OKLCH colors, KaTeX, Tailwind CSS, Vitest

---

## Task 1: Fix PageRank crash on clear graph

**Priority:** CRITICAL — page crashes and becomes unusable

**Root cause:** `reset()` sets nodes to `[]`, but the animation interval captures stale `n` (number of nodes). When `n=0`, `1/n = Infinity`, and `createPageRankScore(Infinity)` throws because the value is outside `[0,1]`. Additional issues: stale `simulationRef`, NaN in ranking table bar widths, density calc division by zero with single node.

**Files:**
- Modify: `apps/web/app/algorithms/graphs/page.tsx` (PageRankExplorer component)

**Step 1: Fix the clear-graph crash**

In the `reset()` function and related code:

1. Find the `reset` callback. Add cleanup: clear the simulation interval before resetting nodes. Set `simulationRef.current = null` and clear any `intervalRef`.
2. Guard `createPageRankScore()` calls: before calling `createPageRankScore(value)`, check `if (!Number.isFinite(value) || value < 0 || value > 1) value = 0`.
3. Guard density calculation: where density is computed as `2 * edges / (n * (n - 1))`, add `if (n <= 1) return 0`.
4. Guard ranking table bar widths: where bar width is computed as a percentage of the max score, add `if (!Number.isFinite(width)) width = 0`.

**Step 2: Test manually**

1. Navigate to `/algorithms/graphs`
2. Add several nodes and edges
3. Run PageRank simulation
4. Click "Clear Graph"
5. Verify: no crash, page resets cleanly, can add new nodes after clearing

**Step 3: Commit**

```bash
git add apps/web/app/algorithms/graphs/page.tsx
git commit -m "fix: prevent PageRank crash when clearing graph (division by zero guard)"
```

---

## Task 2: Fix PDE heatmap showing nothing (WebGPU race condition)

**Priority:** CRITICAL — feature completely non-functional

**Root cause:** WebGPU initialization is async (`requestAdapter` + `requestDevice`). The data upload effect runs synchronously and bails before init completes, so `bindGroup` stays null and the render loop skips the draw call.

**Files:**
- Modify: `apps/web/components/plots/webgpu-heatmap.tsx`

**Step 1: Fix the race condition**

1. Find the WebGPU initialization code (async function around lines 636-761) and the data upload effect (around lines 776-829).
2. Add an `initCompleteRef = useRef(false)` flag. Set it to `true` at the end of the async init function.
3. In the data upload effect, instead of bailing when resources aren't ready, queue a retry. Use a pattern like:
```tsx
useEffect(() => {
  if (!data || data.length === 0) return;
  if (!initCompleteRef.current) {
    // Retry after a short delay — init is still in progress
    const timer = setTimeout(() => setDataVersion(v => v + 1), 100);
    return () => clearTimeout(timer);
  }
  // ... existing upload logic
}, [data, dataVersion]);
```
4. Add `dataVersion` state: `const [dataVersion, setDataVersion] = useState(0)`.
5. At the end of the init function, trigger a data re-upload: `setDataVersion(v => v + 1)`.

**Step 2: Test manually**

1. Navigate to `/pde`
2. Select "Heat Equation" or "Wave Equation"
3. Click "Simulate"
4. Verify: heatmap renders with color gradient, not blank

**Step 3: Commit**

```bash
git add apps/web/components/plots/webgpu-heatmap.tsx
git commit -m "fix: resolve WebGPU init race condition in PDE heatmap"
```

---

## Task 3: Fix Lorenz particle slider (stale closure)

**Priority:** HIGH — particles disappear when toggled

**Root cause:** `setupGPUParticles` captures stale `gpuParticlesEnabled=false` in its closure, then sets `gpuMesh.visible = false` even when the user just enabled particles.

**Files:**
- Modify: `apps/web/components/chaos/lorenz-3d-renderer.tsx`

**Step 1: Fix the stale closure**

1. Find `setupGPUParticles` function. It captures `gpuParticlesEnabled` from closure scope.
2. Change mesh visibility to read from a ref instead of the closure variable. Add `const gpuEnabledRef = useRef(gpuParticlesEnabled)` near the top of the component.
3. Add a sync effect: `useEffect(() => { gpuEnabledRef.current = gpuParticlesEnabled; }, [gpuParticlesEnabled]);`
4. In `setupGPUParticles`, replace `gpuMesh.visible = gpuParticlesEnabled` with `gpuMesh.visible = gpuEnabledRef.current`.
5. Also check: wherever the particle mesh visibility is toggled in the animation loop or other callbacks, ensure it reads from `gpuEnabledRef.current` instead of the stale closure value.

**Step 2: Test manually**

1. Navigate to `/chaos`
2. Open 3D Lorenz attractor view
3. Find the GPU particles slider/toggle
4. Toggle particles ON → verify particles appear
5. Toggle OFF → verify particles disappear
6. Toggle ON again → verify particles reappear

**Step 3: Commit**

```bash
git add apps/web/components/chaos/lorenz-3d-renderer.tsx
git commit -m "fix: resolve stale closure in Lorenz GPU particle toggle"
```

---

## Task 4: Fix SSAO turning everything black

**Priority:** HIGH — 3D rendering unusable with SSAO enabled

**Root cause:** `scenePass.getTextureNode('ao')` returns a constant 0.0 (black) because the `'ao'` texture slot is NOT natively populated by `pass()`. The current code does `mix(1.0, aoTexture, strength)` which evaluates to `mix(1.0, 0.0, 0.7) = 0.3`, darkening the entire scene to 30%.

**Files:**
- Modify: `packages/plot-engine/src/renderers/webgl-3d.ts`

**Step 1: Fix SSAO implementation**

Two options — implement with GTAONode or remove the broken SSAO pass:

**Option A (Recommended — proper SSAO):**
1. Import GTAONode: `import { GTAONode } from 'three/examples/jsm/tsl/display/GTAONode.js'`
2. After creating `scenePass`, create the GTAO node:
```ts
const gtaoNode = new GTAONode(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'));
```
3. Replace the existing AO mix line with:
```ts
const aoTexture = gtaoNode;
postProcessing.outputNode = mix(scenePass.getTextureNode(), scenePass.getTextureNode().mul(aoTexture), float(strength));
```

**Option B (Simpler fallback — disable broken SSAO):**
1. Remove the `getTextureNode('ao')` call entirely.
2. Set `postProcessing.outputNode = scenePass.getTextureNode()` (no AO effect).
3. Keep the SSAO toggle in UI but show a "Coming soon" tooltip.

Try Option A first. If GTAONode import fails or doesn't exist at this Three.js version, fall back to Option B.

**Step 2: Test manually**

1. Navigate to `/plot`
2. Open 3D surface plot
3. Toggle SSAO on
4. Verify: scene has subtle ambient occlusion shadows in crevices, NOT all-black

**Step 3: Commit**

```bash
git add packages/plot-engine/src/renderers/webgl-3d.ts
git commit -m "fix: implement proper SSAO with GTAONode instead of empty AO slot"
```

---

## Task 5: Fix bifurcation diagram (DPR bug, inverted Y-axis, add 10 presets)

**Priority:** HIGH — image drawn in wrong position, broken interaction

**Root cause:** `putImageData(imageData, m.left, m.top)` uses CSS-pixel coordinates but `putImageData` operates in physical pixels (canvas is scaled by DPR). Y-axis pan is inverted (drag down scrolls up).

**Files:**
- Modify: `apps/web/components/chaos/bifurcation-diagram-renderer.tsx`

**Step 1: Fix DPR scaling for putImageData**

1. Find the `putImageData` call. Multiply the x/y offsets by `devicePixelRatio`:
```ts
ctx.putImageData(imageData, m.left * dpr, m.top * dpr);
```
2. Alternatively, if imageData is created at CSS-pixel dimensions, create it at `width * dpr` x `height * dpr` physical pixels.

**Step 2: Fix Y-axis pan inversion**

Find the pan handler (mouse drag). Where `dy` is applied to the Y range, flip the sign:
```ts
// Before: yMin += dy; yMax += dy;
// After:  yMin -= dy; yMax -= dy;
```

**Step 3: Add 10 bifurcation presets**

Add a `BIFURCATION_PRESETS` array with these 10 entries:

```ts
const BIFURCATION_PRESETS = [
  { name: 'Logistic Map (Classic)', equation: 'r*x*(1-x)', rRange: [2.5, 4.0], xRange: [0, 1] },
  { name: 'Logistic Map (Full)', equation: 'r*x*(1-x)', rRange: [0, 4.0], xRange: [0, 1] },
  { name: 'Sine Map', equation: 'r*sin(pi*x)', rRange: [0, 1], xRange: [0, 1] },
  { name: 'Tent Map', equation: 'r*min(x, 1-x)', rRange: [0, 2], xRange: [0, 1] },
  { name: 'Gauss Map', equation: 'exp(-alpha*x^2)+beta', rRange: [-1, 1], xRange: [-1, 1] },
  { name: 'Circle Map', equation: 'x+omega-(k/(2*pi))*sin(2*pi*x)', rRange: [0, 3], xRange: [0, 1] },
  { name: 'Cubic Map', equation: 'r*x-x^3', rRange: [0, 3], xRange: [-2, 2] },
  { name: 'Henon (1D slice)', equation: '1-a*x^2+0.3*y', rRange: [0, 1.4], xRange: [-2, 2] },
  { name: 'Period-Doubling Window', equation: 'r*x*(1-x)', rRange: [3.4, 3.6], xRange: [0.3, 0.9] },
  { name: 'Onset of Chaos', equation: 'r*x*(1-x)', rRange: [3.54, 3.58], xRange: [0.34, 0.9] },
];
```

Add a preset selector dropdown/button row to the UI that loads the selected preset's parameters.

**Step 4: Test manually**

1. Navigate to `/chaos`, open bifurcation diagram
2. Verify diagram renders in correct position (not offset)
3. Pan vertically — verify Y moves in intuitive direction
4. Try each preset — verify diagram loads and renders

**Step 5: Commit**

```bash
git add apps/web/components/chaos/bifurcation-diagram-renderer.tsx
git commit -m "fix: bifurcation DPR scaling, Y-axis pan, add 10 presets"
```

---

## Task 6: Fix Fourier axis labels on zoom

**Priority:** MEDIUM — axis values don't adjust when zooming

**Root cause:** Tick labels are computed from the full signal range, not the visible zoomed window.

**Files:**
- Modify: `apps/web/components/fourier/time-domain-renderer.tsx`
- Modify: `apps/web/components/fourier/frequency-spectrum-renderer.tsx`

**Step 1: Fix time-domain axis labels**

1. Find where x-axis tick labels are computed. They should use the current visible range (after zoom/pan transforms), not the full data range.
2. Replace the tick generation: instead of `for (let t = 0; t < totalDuration; t += tickStep)`, use the visible window bounds: `for (let t = visibleStart; t < visibleEnd; t += tickStep)`.
3. Recalculate `tickStep` based on visible range width, not total range. Use a helper:
```ts
function niceTickStep(range: number, targetTicks = 6): number {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / mag;
  const nice = residual <= 1.5 ? 1 : residual <= 3 ? 2 : residual <= 7 ? 5 : 10;
  return nice * mag;
}
```

**Step 2: Fix frequency-spectrum axis labels**

Apply the same fix to the frequency spectrum renderer. Tick labels should use the visible frequency range, not the full FFT range.

**Step 3: Test manually**

1. Navigate to `/fourier`
2. Load a signal, zoom into a region
3. Verify: axis labels show values for the zoomed region, not the full range
4. Pan around — labels update accordingly

**Step 4: Commit**

```bash
git add apps/web/components/fourier/time-domain-renderer.tsx apps/web/components/fourier/frequency-spectrum-renderer.tsx
git commit -m "fix: Fourier axis labels respect zoom/pan visible window"
```

---

## Task 7: Fix complex number calculator Unicode rendering

**Priority:** MEDIUM — display shows literal escape sequences

**Root cause:** `\u2081` (subscript 1) in JSX text content is NOT processed as a Unicode escape — JSX treats it as literal characters. Need template literal or direct Unicode character. Also, combining overline `\u0305` is placed before `z` instead of after.

**Files:**
- Modify: `apps/web/components/calculator/complex-panel.tsx`

**Step 1: Fix Unicode rendering**

1. Find all instances of `\u2081`, `\u2082` etc. in JSX text. Replace with either:
   - Direct Unicode character: `z₁` (copy-paste the actual subscript character)
   - Or template literal: `` {`z\u2081`} ``
2. Find the conjugate display: change `'\u0305z'` → `'z\u0305'` (combining overline goes AFTER the base character).
3. Search for any other Unicode escapes in JSX text that might have the same issue.

**Step 2: Test manually**

1. Navigate to the calculator, open Complex Number tab
2. Verify: "z₁" displays with proper subscript, not literal "\u2081"
3. Verify: conjugate z̄ shows overline centered above z

**Step 3: Commit**

```bash
git add apps/web/components/calculator/complex-panel.tsx
git commit -m "fix: complex panel Unicode subscripts and conjugate overline rendering"
```

---

## Task 8: Fix statistics box plot (whiskers, end-caps, interactivity)

**Priority:** MEDIUM — box plot missing visual elements and hover

**Root cause:** End-cap lines are drawn horizontal (same y-coordinate for both endpoints) instead of vertical T-caps. No hover/tooltip handlers.

**Files:**
- Modify: `apps/web/components/calculator/stats-panel.tsx`

**Step 1: Fix whisker end-caps**

1. Find the SVG rendering for box plot whiskers/end-caps (likely `<line>` elements).
2. End-caps should be short VERTICAL lines at min and max:
```tsx
{/* Min end-cap (vertical T-cap) */}
<line x1={minX - capWidth/2} y1={centerY} x2={minX + capWidth/2} y2={centerY}
      stroke="currentColor" strokeWidth={2} />
{/* Max end-cap (vertical T-cap) */}
<line x1={maxX - capWidth/2} y1={centerY} x2={maxX + capWidth/2} y2={centerY}
      stroke="currentColor" strokeWidth={2} />
```
Wait — if the box plot is horizontal, these are correct. If vertical, swap x/y. Check the orientation.

For a VERTICAL box plot (y-axis = values):
```tsx
{/* Min end-cap */}
<line x1={centerX - capWidth/2} y1={minY} x2={centerX + capWidth/2} y2={minY} />
{/* Max end-cap */}
<line x1={centerX - capWidth/2} y1={maxY} x2={centerX + capWidth/2} y2={maxY} />
```

3. Add whisker lines connecting the box edges to the end-caps:
```tsx
{/* Lower whisker */}
<line x1={centerX} y1={q1Y} x2={centerX} y2={minY} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 2" />
{/* Upper whisker */}
<line x1={centerX} y1={q3Y} x2={centerX} y2={maxY} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 2" />
```

**Step 2: Add hover interactivity**

Add `onMouseEnter`/`onMouseLeave` handlers to box plot elements:

```tsx
const [hoveredStat, setHoveredStat] = useState<string | null>(null);

// On each element (min cap, Q1, median, Q3, max cap):
<line ... onMouseEnter={() => setHoveredStat('min')} onMouseLeave={() => setHoveredStat(null)} />

// Tooltip:
{hoveredStat && (
  <div className="absolute bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2 text-sm shadow-lg pointer-events-none"
       style={{ left: tooltipX, top: tooltipY }}>
    <span className="font-medium">{hoveredStat}:</span> {stats[hoveredStat]}
  </div>
)}
```

**Step 3: Test manually**

1. Navigate to the calculator, Stats tab
2. Enter data, view box plot
3. Verify: whiskers extend from box to min/max, end-caps are visible T-shapes
4. Hover over elements — tooltip shows stat name and value

**Step 4: Commit**

```bash
git add apps/web/components/calculator/stats-panel.tsx
git commit -m "fix: box plot whiskers, end-caps, and hover tooltips"
```

---

## Task 9: Fix transformer attention matrix readability

**Priority:** MEDIUM — values hard to read, scrollbar on boxes

**Root cause:** `overflow-x-auto` causes horizontal scrollbar on the attention matrix. Font size is too small (0.62rem).

**Files:**
- Modify: `apps/web/app/ml-algorithms/page.tsx` (transformer attention section)

**Step 1: Fix readability**

1. Find the attention matrix grid container. Remove or replace `overflow-x-auto` with `overflow-hidden` if the matrix should not scroll.
2. Increase font size from `text-[0.62rem]` to `text-xs` (0.75rem) or `text-[0.7rem]`.
3. If the matrix is too wide for the container, consider:
   - Reducing cell padding
   - Using a responsive grid that adapts column count
   - Truncating long values to 2 decimal places

**Step 2: Test manually**

1. Navigate to `/ml-algorithms`
2. Open the Transformer/Attention section
3. Verify: values are readable, no horizontal scrollbar

**Step 3: Commit**

```bash
git add apps/web/app/ml-algorithms/page.tsx
git commit -m "fix: attention matrix readability — larger font, no scrollbar"
```

---

## Task 10: Fix ML similarity matrix colors for dark theme

**Priority:** MEDIUM — monochromatic blue with poor contrast

**Root cause:** Single blue channel `rgba(0, 0, value*255, 1)` doesn't work on dark backgrounds. Need a multi-stop colormap.

**Files:**
- Modify: `apps/web/app/ml-algorithms/page.tsx` (similarity matrix section)

**Step 1: Replace color scale**

Replace the monochromatic blue with an OKLCH-based colormap that works on dark backgrounds:

```ts
function similarityColor(value: number): string {
  // Dark-theme-friendly: deep purple (0) → teal (0.5) → bright green (1.0)
  const h = 280 - value * 160; // 280 (purple) → 120 (green)
  const c = 0.15 + value * 0.1; // increasing chroma
  const l = 0.25 + value * 0.45; // 25% → 70% lightness
  return `oklch(${l} ${c} ${h})`;
}

function textColorForValue(value: number): string {
  return value > 0.6 ? 'text-background' : 'text-foreground';
}
```

Apply the text color function to ensure labels remain readable against the cell background.

**Step 2: Test manually**

1. Navigate to `/ml-algorithms`, similarity matrix section
2. Verify: colors have clear gradient from dark purple to bright green
3. Verify: all text is readable against cell backgrounds

**Step 3: Commit**

```bash
git add apps/web/app/ml-algorithms/page.tsx
git commit -m "fix: similarity matrix OKLCH colormap for dark theme readability"
```

---

## Task 11: Fix polar plot missing analysis section

**Priority:** MEDIUM — 2D Polar tab has no analysis panel

**Root cause:** The polar tab doesn't include a `PlotAnalysisPanel` component — one was never created for polar plots.

**Files:**
- Modify: `apps/web/app/plot/page.tsx` or the polar plot component

**Step 1: Add analysis panel to polar tab**

1. Find the polar plot tab content. Look for where Cartesian/3D tabs render analysis but polar does not.
2. Add analysis output below the polar plot showing:
   - Symmetry type (symmetric about x-axis, y-axis, origin, or none)
   - Number of petals/loops (for rose curves)
   - Max radius value
   - Area enclosed (numerical integration: `A = (1/2) * integral(r^2, theta, 0, 2*pi)`)
   - Curve type classification (rose, cardioid, limacon, spiral, lemniscate, etc.)

3. Render in a Card component matching the existing analysis style:
```tsx
<Card className="bg-card/50 backdrop-blur-sm border-border">
  <CardContent className="p-4 space-y-2">
    <h3 className="text-sm font-medium text-foreground">Polar Analysis</h3>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="text-muted-foreground">Symmetry:</div>
      <div className="text-foreground">{analysis.symmetry}</div>
      {/* ... more rows */}
    </div>
  </CardContent>
</Card>
```

**Step 2: Test manually**

1. Navigate to `/plot`, select Polar tab
2. Enter `r = 2*sin(3*theta)` (3-petal rose)
3. Verify: analysis panel shows symmetry, 3 petals, max r=2, enclosed area

**Step 3: Commit**

```bash
git add apps/web/app/plot/page.tsx
git commit -m "feat: add polar plot analysis section (symmetry, petals, area)"
```

---

## Task 12: Update symbolic math UI description

**Priority:** LOW — UI says "Numerical" for integration but it's fully symbolic

**Root cause:** The page description at `apps/web/app/symbolic/page.tsx` says "Numerical" for integration, but the engine supports full symbolic integration of all functions.

**Files:**
- Modify: `apps/web/app/symbolic/page.tsx`

**Step 1: Update feature description**

1. Find the feature list around line 80-84 that says "Numerical" for integration.
2. Change to "Symbolic" and list supported function families:
   - Polynomial, exponential, logarithmic
   - Trigonometric (sin, cos, tan, sec, csc, cot)
   - Inverse trigonometric (arcsin, arccos, arctan, arcsec, arccsc, arccot)
   - Hyperbolic (sinh, cosh, tanh)
   - Integration by parts (LIATE heuristic)

**Step 2: Commit**

```bash
git add apps/web/app/symbolic/page.tsx
git commit -m "fix: update symbolic page to reflect full integration capabilities"
```

---

## Task 13: Add detailed step explanations to equation solver (integration mode)

**Priority:** MEDIUM — solver shows 3 generic steps instead of rule-specific explanations

**Root cause:** The integration mode in `solver-panel.tsx` (lines 881-926) bypasses `solveWithSteps` and hardcodes 3 generic steps. The step-solver's `identifyDerivativeRule` and `explainDerivativeRule` are also incomplete (missing tan, inverse trig, hyperbolic explanations).

**Files:**
- Modify: `apps/web/components/calculator/solver-panel.tsx` (integration mode, ~lines 881-926)
- Modify: `packages/math-engine/src/symbolic/step-solver.ts` (derivative rule explanations)

**Step 1: Enhance integration step display**

In `solver-panel.tsx`, replace the 3 hardcoded integration steps with rule-aware steps:

1. Import the integration engine's rule metadata. The `integrate()` function in `packages/math-engine/src/symbolic/integrate.ts` should expose which rule was applied.
2. If the engine doesn't expose rule names, add a `integrateWithSteps()` function that returns `{ result, steps: Array<{ rule: string, from: string, to: string }> }`.
3. Display each applied rule as a separate step with:
   - Rule name (e.g., "Power Rule", "Integration by Parts (LIATE)", "Trigonometric Identity")
   - Mathematical formula of the rule (e.g., "integral x^n dx = x^(n+1)/(n+1) + C")
   - Before/after expressions in KaTeX

**Step 2: Add missing derivative rule explanations**

In `step-solver.ts`, add entries to `explainDerivativeRule()` for:
- `tan` → "d/dx[tan(x)] = sec²(x)"
- `asin` → "d/dx[arcsin(x)] = 1/sqrt(1-x²)"
- `acos` → "d/dx[arccos(x)] = -1/sqrt(1-x²)"
- `atan` → "d/dx[arctan(x)] = 1/(1+x²)"
- `sinh` → "d/dx[sinh(x)] = cosh(x)"
- `cosh` → "d/dx[cosh(x)] = sinh(x)"
- `tanh` → "d/dx[tanh(x)] = sech²(x) = 1 - tanh²(x)"

**Step 3: Test manually**

1. Navigate to `/solver`, select Integration tab
2. Enter `integral of sin(x)^2`
3. Verify: multiple steps shown with specific rule names, not just "Apply integration rules"
4. Switch to Derivative tab, enter `d/dx tan(x)` — verify rule explanation appears

**Step 4: Commit**

```bash
git add apps/web/components/calculator/solver-panel.tsx packages/math-engine/src/symbolic/step-solver.ts
git commit -m "feat: detailed rule explanations for integration and derivative solver steps"
```

---

## Task 14: Add graph algorithm "Detailed Proof" section and 3 more presets

**Priority:** MEDIUM — user requested glassmorphic proof box and more graphs

**Files:**
- Modify: `apps/web/app/graphs-full/page.tsx`

**Step 1: Add 3 new graph presets**

Add to the `PRESETS` record (after the existing 7):

```ts
'bipartite-k33': {
  name: 'Bipartite K₃,₃',
  nodes: [
    // Left partition: 0, 1, 2 at x ~0.25
    { id: '0', x: 150, y: 100, label: 'A₁' },
    { id: '1', x: 150, y: 250, label: 'A₂' },
    { id: '2', x: 150, y: 400, label: 'A₃' },
    // Right partition: 3, 4, 5 at x ~0.75
    { id: '3', x: 450, y: 100, label: 'B₁' },
    { id: '4', x: 450, y: 250, label: 'B₂' },
    { id: '5', x: 450, y: 400, label: 'B₃' },
  ],
  edges: [
    // Every left node connects to every right node
    { from: '0', to: '3', weight: 1 }, { from: '0', to: '4', weight: 1 }, { from: '0', to: '5', weight: 1 },
    { from: '1', to: '3', weight: 1 }, { from: '1', to: '4', weight: 1 }, { from: '1', to: '5', weight: 1 },
    { from: '2', to: '3', weight: 1 }, { from: '2', to: '4', weight: 1 }, { from: '2', to: '5', weight: 1 },
  ],
},
'weighted-network': {
  name: 'Weighted Network',
  nodes: [
    { id: '0', x: 300, y: 50, label: 'S' },
    { id: '1', x: 150, y: 200, label: 'A' },
    { id: '2', x: 450, y: 200, label: 'B' },
    { id: '3', x: 100, y: 380, label: 'C' },
    { id: '4', x: 300, y: 300, label: 'D' },
    { id: '5', x: 500, y: 380, label: 'E' },
    { id: '6', x: 300, y: 480, label: 'T' },
  ],
  edges: [
    { from: '0', to: '1', weight: 4 }, { from: '0', to: '2', weight: 2 },
    { from: '1', to: '3', weight: 5 }, { from: '1', to: '4', weight: 10 },
    { from: '2', to: '4', weight: 3 }, { from: '2', to: '5', weight: 8 },
    { from: '3', to: '6', weight: 6 }, { from: '4', to: '6', weight: 1 },
    { from: '5', to: '6', weight: 7 }, { from: '3', to: '4', weight: 2 },
  ],
},
'disconnected': {
  name: 'Disconnected Components',
  nodes: [
    // Component 1: triangle
    { id: '0', x: 100, y: 150, label: 'P' },
    { id: '1', x: 200, y: 50, label: 'Q' },
    { id: '2', x: 300, y: 150, label: 'R' },
    // Component 2: square
    { id: '3', x: 400, y: 50, label: 'W' },
    { id: '4', x: 550, y: 50, label: 'X' },
    { id: '5', x: 550, y: 200, label: 'Y' },
    { id: '6', x: 400, y: 200, label: 'Z' },
  ],
  edges: [
    { from: '0', to: '1', weight: 1 }, { from: '1', to: '2', weight: 1 }, { from: '2', to: '0', weight: 1 },
    { from: '3', to: '4', weight: 1 }, { from: '4', to: '5', weight: 1 }, { from: '5', to: '6', weight: 1 }, { from: '6', to: '3', weight: 1 },
  ],
},
```

Update the `PresetId` type to include `'bipartite-k33' | 'weighted-network' | 'disconnected'`.

**Step 2: Add "Detailed Proof" glassmorphic section**

Below the existing "Algorithm Results" card (after line ~2646), add a new section that explains WHY the algorithm produced its result:

```tsx
{result && (
  <Card className="bg-card/30 backdrop-blur-xl border-border/50 shadow-2xl">
    <CardContent className="p-6 space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <span className="i-lucide-book-open" />
        Detailed Proof
      </h3>
      <div className="prose prose-sm prose-invert max-w-none">
        {getProofContent(result)}
      </div>
    </CardContent>
  </Card>
)}
```

Create `getProofContent(result)` function that returns proof explanation based on algorithm type:

- **Dijkstra/shortest-path:** "Dijkstra's algorithm maintains a priority queue of unvisited nodes. At each step, it selects the node with minimum tentative distance..." + step-by-step relaxation trace showing which edges were relaxed.
- **BFS:** "BFS explores nodes level by level. Starting from node {start}, the frontier expands..." + level-by-level trace.
- **DFS:** "DFS uses a stack (implicit via recursion). Discovery times and finish times..." + timestamps.
- **Kruskal/MST:** "Kruskal's algorithm sorts edges by weight and greedily adds edges that don't form cycles (Union-Find)..." + edge addition order.
- **Topological sort:** "A topological ordering exists iff the graph is a DAG. The algorithm performs DFS and pushes nodes to the front on finishing..."
- **Tarjan SCC:** "Tarjan's algorithm assigns each node a discovery index and lowlink value..."

Each proof should reference the actual nodes/edges from the result.

**Step 3: Test manually**

1. Navigate to `/graphs-full`
2. Load new presets (bipartite, weighted, disconnected)
3. Run algorithms, verify "Detailed Proof" section appears with algorithm-specific explanation
4. Verify glassmorphic styling matches the app's aesthetic

**Step 4: Commit**

```bash
git add apps/web/app/graphs-full/page.tsx
git commit -m "feat: add 3 graph presets and detailed proof section for algorithm results"
```

---

## Task 15: Add 4 more PDE initial condition presets

**Priority:** MEDIUM

**Files:**
- Modify: `apps/web/app/pde/page.tsx` (or wherever PDE presets are defined)

**Step 1: Find and extend presets**

Locate the initial condition presets. Add 4 new ones:

```ts
{ name: 'Double Gaussian', fn: (x) => Math.exp(-((x-0.3)**2)/0.01) + Math.exp(-((x-0.7)**2)/0.01) },
{ name: 'Sawtooth', fn: (x) => x - Math.floor(x) },
{ name: 'Square Pulse', fn: (x) => (x > 0.3 && x < 0.7) ? 1 : 0 },
{ name: 'Sinc Function', fn: (x) => { const t = (x - 0.5) * 20; return t === 0 ? 1 : Math.sin(t) / t; } },
```

**Step 2: Test manually**

1. Navigate to `/pde`
2. Select each new preset
3. Verify: initial condition renders correctly on the plot/heatmap

**Step 3: Commit**

```bash
git add apps/web/app/pde/page.tsx
git commit -m "feat: add 4 PDE initial condition presets (double Gaussian, sawtooth, square pulse, sinc)"
```

---

## Task 16: Dependency version bumps

**Priority:** LOW — maintenance task

**Files:**
- Modify: `package.json` (root)
- Modify: `apps/web/package.json`
- Modify: `apps/api/package.json`
- Modify: `packages/database/package.json`
- Modify: `apps/workers/*/package.json` (all 3)

**Step 1: Bump patch-level dependencies**

Run targeted version bumps (not `pnpm update` which may break things):

```bash
# High priority
pnpm --filter @nextcalc/web add next@16.2.0-canary.56
pnpm --filter @nextcalc/web add react@19.3.0-canary-ab18f33d-20260220 react-dom@19.3.0-canary-ab18f33d-20260220
pnpm add -D -w @biomejs/biome@2.4.4

# Medium priority
pnpm --filter @nextcalc/web add framer-motion@12.34.3
pnpm --filter @nextcalc/web add three@0.183.1
pnpm --filter @nextcalc/web add -D @types/three@0.183.1
pnpm --filter @nextcalc/plot-engine add three@0.183.1
pnpm --filter @nextcalc/plot-engine add -D @types/three@0.183.1
pnpm --filter @nextcalc/database add prisma@7.5.0-dev.15 @prisma/client@7.5.0-dev.15 @prisma/adapter-neon@7.5.0-dev.15
pnpm --filter @nextcalc/database add dotenv@17.3.1

# Workers
pnpm --filter cas-service --filter export-service --filter rate-limiter add hono@4.12.1

# Testing
pnpm --filter @nextcalc/web add -D happy-dom@20.7.0
```

**Step 2: Verify build**

```bash
pnpm install
pnpm build
```

**Step 3: Commit**

```bash
git add package.json apps/*/package.json packages/*/package.json pnpm-lock.yaml
git commit -m "chore: bump dependencies (next, biome, three, prisma, framer-motion, hono, etc.)"
```

---

## Execution Order

**Phase 1 — Critical fixes (Tasks 1-4):** PageRank crash, PDE heatmap, Lorenz particles, SSAO
**Phase 2 — High-priority fixes (Tasks 5-8):** Bifurcation, Fourier axes, Complex unicode, Box plot
**Phase 3 — Medium enhancements (Tasks 9-15):** Attention matrix, ML colors, Polar analysis, Symbolic UI, Solver steps, Graph proofs+presets, PDE presets
**Phase 4 — Maintenance (Task 16):** Dependency bumps

Items NOT included in this plan (already working or not actionable):
- **Error display widget (Item 7):** Investigation showed this was Next.js's built-in dev overlay — only visible in `next dev`, not `next start`. This is expected behavior, not a bug.
- **Symbolic integration of arcsin/arccos/arctan/tanh/sinh/cosh (Item 2):** Already fully implemented in the math engine. Only the UI description needs updating (covered in Task 12).
- **HDR cubemap resolution + exotic space themes (Item 1 partial):** Requires significant GPU-side generation architecture (8K cubemaps). Deferred to a separate plan.
- **4 more colormap options (Item 1 partial):** Deferred to a separate plan alongside HDR work.
- **5 more preset shapes (Item 1 partial):** Deferred to a separate plan.
