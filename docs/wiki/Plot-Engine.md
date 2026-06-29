# Plot Engine

`@nextcalc/plot-engine` is a GPU-accelerated mathematical visualization engine.

## Renderer Pipeline

The engine automatically selects the best available renderer:

| Priority | Backend | Use Case |
|:---------|:--------|:---------|
| 1 | WebGPU | Primary GPU-accelerated 2D rendering (cartesian/polar/parametric/implicit/vector-field) via WGSL shaders |
| 2 | WebGL 2 | 2D rendering with GLSL shaders (universal fallback for modern browsers) |
| 3 | Canvas 2D | Software fallback for legacy browsers |

```typescript
import { createBest2DRenderer } from '@nextcalc/plot-engine';

const renderer = await createBest2DRenderer(canvas);
// Automatically picks best available backend
```

## Features

- **WebGPU 2D Renderer** -- Priority backend; WGSL shaders for cartesian/polar/parametric/implicit/vector-field plots
- **WebGL 2D Renderer** -- Lightweight (~15KB target), GLSL shaders
- **Three.js 0.184 3D Renderer** -- Surface plots, parametric curves (lazy-loaded, ~563KB target)
- **Canvas 2D Fallback** -- Cartesian, polar, parametric for legacy browsers
- **Adaptive Sampling** -- Recursive subdivision for smooth curves
- **Interactive Controls** -- 2D: pan, zoom (mouse, touch, keyboard); 3D: orbit/rotate camera
- **Export** -- PNG, SVG, CSV formats

## Colormaps

9 built-in colormaps for 3D surfaces:

| Colormap | Description |
|:---------|:------------|
| `viridis` | Perceptually uniform, blue-green-yellow |
| `inferno` | Black-red-yellow-white |
| `coolwarm` | Diverging blue-white-red |
| `cividis` | Colorblind-friendly blue-yellow |
| `magma` | Black-purple-orange-yellow |
| `plasma` | Purple-pink-yellow |
| `spectral` | Full rainbow spectrum |
| `turbo` | High-contrast rainbow (improved jet) |
| `rainbow` | Classic rainbow spectrum |

## HDR Cubemap Themes

5 procedural space cubemap backgrounds for 3D plots with configurable resolution.

## SSAO Post-Processing

Screen-space ambient occlusion via GTAONode for enhanced 3D depth perception.

## Architecture

```
@nextcalc/plot-engine
+-- types/           TypeScript type definitions
+-- renderers/       WebGPU 2D, WebGL 2D, Three.js 3D, Canvas 2D fallback
+-- sampling/        Adaptive sampling algorithms
+-- controls/        Interactive 2D controls (pan, zoom, keyboard)
+-- export/          PNG, SVG, CSV export
+-- utils/           Utilities (colors, matrices, buffers, shaders)
```

## Performance Targets

| Metric | Target |
|:-------|:-------|
| 2D Init Time | <50ms |
| 2D Render (10k points) | 60fps |
| 3D Init Time | <100ms |
| 3D Render | 45fps |
| Memory (2D) | <20MB |
| Memory (3D) | <100MB |

## Browser Support

- **WebGL 2**: 96%+ of browsers
- **WebGPU**: Progressive enhancement (37%+ in 2026)
- **Canvas 2D**: Universal fallback
