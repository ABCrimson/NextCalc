# Plot Engine

`@nextcalc/plot-engine` is a GPU-accelerated mathematical visualization engine.

## Renderer Pipeline

The engine automatically selects the best available renderer:

| Priority | Backend | Use Case |
|:---------|:--------|:---------|
| 1 | WebGPU | PDE/ODE compute shaders, bifurcation diagrams |
| 2 | WebGL 2 | Primary 2D rendering with GLSL shaders |
| 3 | Canvas 2D | Software fallback for legacy browsers |

```typescript
import { createBest2DRenderer } from '@nextcalc/plot-engine';

const renderer = await createBest2DRenderer(canvas);
// Automatically picks best available backend
```

## Features

- **WebGL 2D Renderer** -- Lightweight (<15KB), GLSL shaders
- **Three.js 3D Renderer** -- Surface plots, parametric curves (lazy-loaded, 563KB)
- **Canvas 2D Fallback** -- Cartesian, polar, parametric for legacy browsers
- **Adaptive Sampling** -- Recursive subdivision for smooth curves
- **Interactive Controls** -- Pan, zoom, rotate (mouse, touch, keyboard)
- **Export** -- PNG, SVG, CSV formats

## Colormaps

6 built-in colormaps for 3D surfaces:

| Colormap | Description |
|:---------|:------------|
| `viridis` | Perceptually uniform, blue-green-yellow |
| `inferno` | Black-red-yellow-white |
| `coolwarm` | Diverging blue-white-red |
| `cividis` | Colorblind-friendly blue-yellow |
| `magma` | Black-purple-orange-yellow |
| `spectral` | Full rainbow spectrum |

## HDR Cubemap Themes

5 procedural space cubemap backgrounds for 3D plots with configurable resolution.

## SSAO Post-Processing

Screen-space ambient occlusion via GTAONode for enhanced 3D depth perception.

## Architecture

```
@nextcalc/plot-engine
+-- types/           TypeScript type definitions
+-- renderers/       WebGL 2D, Three.js 3D, Canvas 2D fallback
+-- sampling/        Adaptive sampling algorithms
+-- controls/        Interactive controls (pan, zoom, rotate)
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
