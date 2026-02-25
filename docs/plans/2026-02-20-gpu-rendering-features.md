# GPU Rendering Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 4 new GPU rendering features (nebula skybox, Lorenz particle field, graph edge flow particles, bind group optimization) and enhance the existing procedural HDR cubemap with starfield visuals.

**Architecture:** Each feature is self-contained and can be implemented independently. The Lorenz GPU particle field is the largest effort, requiring a new WGSL compute shader + storage buffer pipeline. The bind group optimization restructures the WebGPU 2D renderer's per-draw bind group creation into a cached 2-tier system.

**Tech Stack:** Three.js 0.183.0 (WebGPURenderer/TSL), native WebGPU (GPUDevice, WGSL compute shaders), TypeScript 6.0 strict mode, React 19.3

---

## Already-Implemented Features (No Work Needed)

The following 5 features from the spec **already exist** in the codebase:

| Feature | Location | Status |
|---------|----------|--------|
| HDR Environment Map (3D Surface) | `packages/plot-engine/src/renderers/webgl-3d.ts:128-265` | Procedural 64×64 cubemap, `setEnvMapEnabled()` toggle, IBL + background |
| SSAO Post-Processing (3D Surface) | `packages/plot-engine/src/renderers/webgl-3d.ts:529-587` | TSL `scenePass.getTextureNode('ao')`, configurable radius/intensity |
| GPU Compute PDE Solver | `apps/web/components/plots/pde-compute-shaders.ts` | Heat/Wave/Laplace FTCS stencils, ping-pong buffers, gradient compute, particle advection |
| GPU Direction Field (ODE) | `apps/web/app/solver/ode/GpuDirectionField.tsx` | WebGPU compute + instanced arrows, 5 equation types, Canvas 2D fallback |
| GPU Sieve Compute (Number Theory) | `apps/web/app/problems/number-theory/page.tsx:438-573` | Compute shader marks multiples, instanced cell rendering, CPU readback |

---

## Features To Implement

### Task 1: Enhanced Procedural Cubemap with Starfield

**Files:**
- Modify: `packages/plot-engine/src/renderers/webgl-3d.ts` (the `createProceduralHDRCubeMap()` function, lines ~128-265)

**Context:** The existing procedural cubemap generates a smooth gradient with two specular highlights. The user wants a "dark, starfield/nebula-themed HDR" that evokes cosmic imagery. We'll add scattered star points and a subtle nebula color wash to the existing generation code.

**Step 1: Read current cubemap generation code**

Read `webgl-3d.ts` lines 128-265 to understand the exact per-texel generation loop.

**Step 2: Add starfield + nebula to procedural generation**

Inside the per-texel loop of `createProceduralHDRCubeMap()`, after the existing gradient + specular calculation, add:

```typescript
// --- Starfield ---
// Deterministic pseudo-random based on direction hash
const dirHash = Math.abs(
  Math.sin(nx * 12.9898 + ny * 78.233 + nz * 45.164) * 43758.5453
);
const starRand = dirHash - Math.floor(dirHash);
// ~2% of texels become stars
if (starRand > 0.98) {
  const starBrightness = (starRand - 0.98) * 50; // 0..1 range
  const starTemp = Math.sin(nx * 37.0) * 0.5 + 0.5; // color temperature
  // Cool stars: blue-white, warm stars: amber-white
  r += starBrightness * (0.8 + 0.2 * starTemp);
  g += starBrightness * (0.85 + 0.1 * (1 - starTemp));
  b += starBrightness * (0.8 + 0.2 * (1 - starTemp));
}

// --- Nebula wash ---
// Subtle colored regions based on direction
const nebula1 = Math.exp(-8 * ((nx - 0.5) ** 2 + (ny - 0.3) ** 2 + (nz + 0.2) ** 2));
const nebula2 = Math.exp(-6 * ((nx + 0.3) ** 2 + (ny + 0.5) ** 2 + (nz - 0.4) ** 2));
r += nebula1 * 0.06 + nebula2 * 0.02; // warm reddish nebula
g += nebula1 * 0.01 + nebula2 * 0.04; // cool teal nebula
b += nebula1 * 0.04 + nebula2 * 0.08;
```

**Step 3: Increase cubemap resolution for starfield detail**

Change resolution from 64 to 128 (still tiny — 128×128×6 faces × 4 bytes = 384KB):
```typescript
const size = 128; // was 64
```

**Step 4: Build and verify visually**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/plot-engine build 2>&1"`

**Step 5: Commit**

```bash
git add packages/plot-engine/src/renderers/webgl-3d.ts
git commit -m "feat(plot-engine): add starfield + nebula to procedural HDR cubemap"
```

---

### Task 2: Lorenz Attractor Nebula Skybox

**Files:**
- Modify: `apps/web/components/chaos/lorenz-3d-renderer.tsx`

**Context:** The Lorenz 3D renderer uses `WebGPURenderer` (three/webgpu) with a flat `0x050912` background. We'll add a procedural nebula cubemap as an optional background, reusing the same generation technique as the 3D surface plot's cubemap but with even lower intensity to not compete with the bloom post-processing.

**Step 1: Read the full Lorenz renderer**

Read `lorenz-3d-renderer.tsx` to understand the exact scene setup and imports.

**Step 2: Add procedural cubemap generation**

Add a helper function (adapted from webgl-3d.ts but standalone since this is in apps/web, not plot-engine) to generate a space-themed cubemap. Import `CubeTexture`, `DataTexture` from `three/webgpu`.

The cubemap should be darker than the 3D surface plot version:
- Base gradient: very dark navy → near-black
- Starfield density: ~3% of texels (more stars)
- Two nebula regions: purple/blue tones matching the Lorenz color scheme (cyan → violet → rose)
- Resolution: 64×64 (don't need detail since it's very dim)

**Step 3: Add UI toggle**

Add a checkbox to the control panel (near existing "Show Bounding Box" checkbox):
```tsx
<label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
  <input
    type="checkbox"
    checked={showSkybox}
    onChange={(e) => setShowSkybox(e.target.checked)}
    className="..."
  />
  Space Background
</label>
```

**Step 4: Apply cubemap when enabled**

When `showSkybox` becomes true:
```typescript
scene.background = cubemap;
scene.backgroundIntensity = 0.1; // very subtle
```

When disabled:
```typescript
scene.background = new THREE.Color(0x050912);
cubemap.dispose();
```

Key: the bloom post-processing (strength=0.8, threshold=0.2) will naturally cause bright stars to glow, creating a beautiful interaction.

**Step 5: Build and verify**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter web build 2>&1"`

**Step 6: Commit**

```bash
git add apps/web/components/chaos/lorenz-3d-renderer.tsx
git commit -m "feat(chaos): add optional space/nebula skybox to Lorenz 3D renderer"
```

---

### Task 3: Lorenz GPU Particle Field (WGSL Compute)

**Files:**
- Create: `apps/web/components/chaos/lorenz-compute-shaders.ts` (WGSL source)
- Modify: `apps/web/components/chaos/lorenz-3d-renderer.tsx` (integrate GPU particles)

**Context:** The current Lorenz renderer shows ONE pre-computed trajectory. A GPU particle field runs the Lorenz ODE for 100,000+ particles simultaneously on the GPU, revealing the attractor's flow structure. Each particle starts near the attractor basin and is stepped forward every frame via compute shader. Color encodes velocity magnitude (fast=hot, slow=cool).

**Step 1: Create WGSL compute shader for Lorenz ODE**

Create `lorenz-compute-shaders.ts` with a compute shader that implements RK4 integration of the Lorenz system:

```wgsl
// Lorenz system: dx/dt = σ(y-x), dy/dt = x(ρ-z)-y, dz/dt = xy-βz
// σ=10, ρ=28, β=8/3

struct Params {
  particleCount : u32,
  dt            : f32,
  sigma         : f32,
  rho           : f32,
  beta          : f32,
  time          : f32,
  _pad0         : u32,
  _pad1         : u32,
}

// Particle layout: [x, y, z, speed] per particle (4 floats, 16 bytes)
@group(0) @binding(0) var<uniform>            params : Params;
@group(0) @binding(1) var<storage, read_write> particles : array<f32>;

fn lorenz(p: vec3<f32>, s: f32, r: f32, b: f32) -> vec3<f32> {
  return vec3<f32>(
    s * (p.y - p.x),
    p.x * (r - p.z) - p.y,
    p.x * p.y - b * p.z
  );
}

@compute @workgroup_size(256)
fn cs_lorenz(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if idx >= params.particleCount { return; }

  let base = idx * 4u;
  var p = vec3<f32>(particles[base], particles[base+1u], particles[base+2u]);

  // RK4 integration
  let dt = params.dt;
  let k1 = lorenz(p, params.sigma, params.rho, params.beta);
  let k2 = lorenz(p + 0.5*dt*k1, params.sigma, params.rho, params.beta);
  let k3 = lorenz(p + 0.5*dt*k2, params.sigma, params.rho, params.beta);
  let k4 = lorenz(p + dt*k3, params.sigma, params.rho, params.beta);
  p += (dt/6.0) * (k1 + 2.0*k2 + 2.0*k3 + k4);

  // Velocity magnitude for coloring
  let vel = length(k1);

  // Respawn if diverged (escaped attractor basin)
  if any(abs(p) > vec3<f32>(100.0)) {
    let seed = idx * 1664525u + u32(params.time * 1000.0);
    let rx = f32((seed >> 0u) & 0xFFu) / 255.0 - 0.5;
    let ry = f32((seed >> 8u) & 0xFFu) / 255.0 - 0.5;
    let rz = f32((seed >> 16u) & 0xFFu) / 255.0;
    p = vec3<f32>(rx * 40.0, ry * 40.0, rz * 50.0 + 10.0);
  }

  particles[base]      = p.x;
  particles[base + 1u] = p.y;
  particles[base + 2u] = p.z;
  particles[base + 3u] = vel;
}
```

**Step 2: Create particle render material**

In the renderer, create a `THREE.Points` mesh with a `PointsMaterial` that reads from the compute buffer. Since Three.js WebGPURenderer doesn't directly expose raw storage buffers to Points, we'll use a hybrid approach:

- Run the compute shader via raw WebGPU (`renderer.backend` to get the device)
- After each compute dispatch, copy the storage buffer data into a `THREE.BufferAttribute` via `device.queue.readBuffer` (or use a mapped staging buffer)
- The Points geometry updates its position attribute each frame

Alternative (zero-copy): Use TSL `storageObject()` node to create a storage buffer that's both writable by compute and readable by the vertex shader. This avoids readback entirely.

**Step 3: Initialize particle positions**

Generate initial positions on CPU (Float32Array of 100K × 4 floats):
```typescript
const PARTICLE_COUNT = 100_000;
const initData = new Float32Array(PARTICLE_COUNT * 4);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  // Random positions near attractor basin: x,y ∈ [-20,20], z ∈ [5,45]
  initData[i*4]   = (Math.random() - 0.5) * 40;
  initData[i*4+1] = (Math.random() - 0.5) * 40;
  initData[i*4+2] = Math.random() * 40 + 5;
  initData[i*4+3] = 0; // speed (computed by shader)
}
```

Upload to GPU storage buffer. Create compute pipeline and bind group.

**Step 4: Integrate into render loop**

Each frame:
1. Update `params.time` and `params.dt` uniforms
2. Dispatch compute: `ceil(PARTICLE_COUNT / 256)` workgroups
3. Read back positions (or use zero-copy TSL path)
4. Update Points geometry
5. Color particles by velocity: speed → t ∈ [0,1] → HSL(240-0, 100%, 50-100%)
   - Slow (low speed): blue/cool
   - Fast (high speed): red/hot

**Step 5: Add UI controls**

Add toggle + particle count slider to the Lorenz control panel:
```tsx
<label>GPU Particle Cloud</label>
<input type="checkbox" checked={showParticles} onChange={...} />
<label>Particle Count: {particleCount.toLocaleString()}</label>
<input type="range" min={10000} max={200000} step={10000} value={particleCount} />
```

**Step 6: Handle WebGPU fallback**

If WebGPU is unavailable (WebGL 2 backend), disable the GPU particles toggle and show a tooltip: "Requires WebGPU". The existing trajectory + point cloud remain as fallback.

**Step 7: Build and verify**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter web build 2>&1"`

**Step 8: Commit**

```bash
git add apps/web/components/chaos/lorenz-compute-shaders.ts apps/web/components/chaos/lorenz-3d-renderer.tsx
git commit -m "feat(chaos): GPU compute particle field for Lorenz attractor (100K particles)"
```

---

### Task 4: Graph Edge Flow Particles (WebGPU Compute)

**Files:**
- Modify: `apps/web/components/algorithms/UnifiedGraphRenderer.tsx`

**Context:** The graph renderer already has a Canvas 2D particle overlay (lines 858-1058) that spawns particles along edges during algorithm execution. The existing system uses:
- Canvas 2D bezier interpolation for particle trails
- Ripple effects on node state transitions
- Mix-blend-mode: screen overlay

The upgrade migrates particle simulation to a WebGPU compute shader while keeping the Canvas 2D rendering (the particle count is small enough that Canvas 2D rendering is fine — the bottleneck is the per-particle physics, not drawing).

**Step 1: Read the existing particle system in detail**

Read lines 858-1058 of `UnifiedGraphRenderer.tsx` to understand particle spawning, lifecycle, and rendering.

**Step 2: Create WGSL compute shader for edge particles**

Add a compute shader that advances particles along edges:

```wgsl
struct Particle {
  edgeIdx : u32,     // which edge this particle is on
  t       : f32,     // position along edge [0, 1]
  speed   : f32,     // travel speed
  age     : f32,     // lifetime counter
}

struct Edge {
  srcX : f32, srcY : f32,
  dstX : f32, dstY : f32,
  active : u32,      // 0=inactive, 1=current, 2=path
  _pad : u32, _pad1: u32, _pad2: u32,
}

@group(0) @binding(0) var<uniform> params : Params; // dt, particleCount
@group(0) @binding(1) var<storage, read_write> particles : array<Particle>;
@group(0) @binding(2) var<storage, read> edges : array<Edge>;

@compute @workgroup_size(64)
fn cs_edge_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if idx >= params.particleCount { return; }

  var p = particles[idx];
  p.t += p.speed * params.dt;
  p.age += params.dt;

  // Wrap around or deactivate
  if p.t >= 1.0 {
    p.t = 0.0; // loop
  }

  particles[idx] = p;
}
```

**Step 3: Integrate compute dispatch into the existing WebGPU render loop**

In the existing `runFrame()` function (which already does compute + render passes), add the particle compute dispatch after the physics compute pass.

**Step 4: Read back particle positions for Canvas 2D overlay**

Since particle count is small (hundreds, not thousands), a staging buffer readback is acceptable. Map the positions, then draw on the overlay canvas using the existing trail rendering code.

**Step 5: Add ripple burst compute**

When a node transitions to 'current' or 'visited', spawn N particles on all connected edges. This replaces the CPU-based spawning in the existing `spawnEdgeParticles()` function.

**Step 6: Build and verify**

**Step 7: Commit**

```bash
git add apps/web/components/algorithms/UnifiedGraphRenderer.tsx
git commit -m "feat(algorithms): GPU compute edge flow particles for graph traversal"
```

---

### Task 5: Bind Group Optimization (WebGPU 2D Renderer)

**Files:**
- Modify: `packages/plot-engine/src/renderers/webgpu-2d.ts`
- Modify: `packages/plot-engine/src/renderers/wgsl-shaders.ts` (if bind group layout changes)

**Context:** The WebGPU 2D renderer creates a new bind group for EVERY draw call (lines 954-960, 1008-1014), even though the scene uniforms (MVP matrix, resolution, time) are identical across all draw calls in a frame. The draw uniforms (color, lineWidth, etc.) change per-draw-call.

Current bind group layout (all shaders):
```
@group(0) @binding(0) SceneUniforms  ← same for all draws in a frame
@group(0) @binding(1) DrawUniforms   ← changes per draw call
```

Optimization: Split into two bind groups:
```
@group(0) @binding(0) SceneUniforms  ← created once per frame, bound once
@group(1) @binding(0) DrawUniforms   ← created per draw call (or cached)
```

**Step 1: Update WGSL shader bind group declarations**

In `wgsl-shaders.ts`, change all 12 shaders:
- `SceneUniforms` stays at `@group(0) @binding(0)`
- `DrawUniforms` moves from `@group(0) @binding(1)` to `@group(1) @binding(0)`
- Texture/sampler bindings (where present) move from `@group(0) @binding(2-3)` to `@group(1) @binding(1-2)`

**Step 2: Update pipeline creation in webgpu-2d.ts**

Change `compilePipeline()` to create two separate bind group layouts:
```typescript
const sceneBindGroupLayout = device.createBindGroupLayout({
  entries: [{
    binding: 0,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    buffer: { type: 'uniform' },
  }],
});

const drawBindGroupLayout = device.createBindGroupLayout({
  entries: [{
    binding: 0,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    buffer: { type: 'uniform' },
  }],
  // + optional sampler/texture entries for shaders that need them
});

const pipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [sceneBindGroupLayout, drawBindGroupLayout],
});
```

**Step 3: Cache the scene bind group per frame**

In the render method, create the scene bind group ONCE at the start of the frame:
```typescript
this.frameSceneBindGroup = this.device.createBindGroup({
  layout: this.sceneBindGroupLayout,
  entries: [{ binding: 0, resource: { buffer: this.sceneUniformBuffer } }],
});
```

Then in each draw call, only create the draw bind group:
```typescript
const drawBindGroup = this.device.createBindGroup({
  layout: compiled.drawBindGroupLayout,
  entries: [{ binding: 0, resource: { buffer: this.drawUniformBuffer } }],
});
pass.setBindGroup(0, this.frameSceneBindGroup); // same for all draws
pass.setBindGroup(1, drawBindGroup);             // unique per draw
```

**Step 4: Update all shader uniform references**

In each WGSL shader, update the `@group` annotation for DrawUniforms:
```wgsl
// Before:
@group(0) @binding(1) var<uniform> draw : DrawUniforms;
// After:
@group(1) @binding(0) var<uniform> draw : DrawUniforms;
```

**Step 5: Build and verify**

Run: `powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/plot-engine build 2>&1"`

Verify 2D plots still render correctly (no visual regressions).

**Step 6: Commit**

```bash
git add packages/plot-engine/src/renderers/webgpu-2d.ts packages/plot-engine/src/renderers/wgsl-shaders.ts
git commit -m "perf(plot-engine): 2-tier bind group optimization for WebGPU 2D renderer"
```

---

## Implementation Order

1. **Task 1** (Enhanced Cubemap) → standalone, affects only plot-engine
2. **Task 2** (Lorenz Skybox) → depends on understanding Task 1's approach
3. **Task 5** (Bind Groups) → standalone, affects only plot-engine
4. **Task 3** (Lorenz GPU Particles) → largest task, most complex
5. **Task 4** (Graph Edge Particles) → requires understanding existing compute pipeline

Tasks 1, 2, and 5 can run in parallel (independent files). Task 3 is the critical path.

---

## Key Technical Notes

- **SSR Safety**: All WebGPU code must avoid browser globals at module scope. Use numeric constants for `GPUShaderStage` (VERTEX=0x1, FRAGMENT=0x2, COMPUTE=0x4).
- **TypeScript 6.0 strict**: Zero `any`/`as any`. Use `exactOptionalPropertyTypes` spread pattern.
- **React 19.3**: No forwardRef, no displayName. `ref` as regular prop.
- **Three.js 0.183.0**: `WebGPURenderer` from `three/webgpu`. `Line.material` is `Material | Material[]`.
- **Semantic colors**: Use `text-muted-foreground`, `bg-background`, etc. in UI. No `gray-*`/`slate-*`.
- **Focus rings**: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`.
