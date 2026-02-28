# @nextcalc/plot-engine

GPU-accelerated mathematical visualization engine for NextCalc Pro.

## Features

- **Custom WebGL 2D Renderer**: Lightweight (<15KB) renderer optimized for mathematical functions
- **Three.js 3D Renderer**: Full-featured 3D surface and parametric plot rendering (lazy-loaded)
- **Canvas 2D Fallback**: Software renderer for browsers without WebGL/WebGPU support
- **Adaptive Sampling**: Intelligent function sampling with recursive subdivision
- **Web Worker Support**: Non-blocking sampling for complex functions
- **Interactive Controls**: Pan, zoom, and rotate with mouse, touch, and keyboard
- **6 Colormaps**: viridis, inferno, coolwarm, cividis, magma, spectral
- **HDR Cubemap Themes**: 5 procedural space cubemap backgrounds with configurable resolution
- **SSAO Post-Processing**: Screen-space ambient occlusion via GTAONode for 3D plots
- **Multiple Export Formats**: PNG, SVG, and CSV export capabilities
- **TypeScript-first**: Full type safety with strict mode

## Installation

This package is part of the NextCalc Pro monorepo. It's not published to npm separately.

```bash
# Install dependencies from root
pnpm install
```

## Usage

### 2D Cartesian Plot

```typescript
import { WebGL2DRenderer, type Plot2DCartesianConfig } from '@nextcalc/plot-engine';

const canvas = document.getElementById('plot-canvas') as HTMLCanvasElement;
const renderer = new WebGL2DRenderer(canvas);

await renderer.initialize();

const config: Plot2DCartesianConfig = {
  type: '2d-cartesian',
  functions: [
    {
      fn: (x) => Math.sin(x),
      label: 'sin(x)',
      style: {
        line: { width: 2, color: '#2563eb' },
      },
    },
  ],
  viewport: {
    xMin: -10,
    xMax: 10,
    yMin: -2,
    yMax: 2,
  },
  xAxis: {
    label: 'x',
    min: -10,
    max: 10,
    scale: 'linear',
    grid: {
      enabled: true,
      majorStep: 1,
      color: '#e5e7eb',
      opacity: 0.5,
    },
    ticks: {
      enabled: true,
      format: (v) => v.toFixed(1),
    },
  },
  yAxis: {
    label: 'y',
    min: -2,
    max: 2,
    scale: 'linear',
    grid: {
      enabled: true,
      majorStep: 0.5,
      color: '#e5e7eb',
      opacity: 0.5,
    },
    ticks: {
      enabled: true,
      format: (v) => v.toFixed(1),
    },
  },
};

renderer.render(config);
```

### 2D Polar Plot

```typescript
import { WebGL2DRenderer, type Plot2DPolarConfig } from '@nextcalc/plot-engine';

const config: Plot2DPolarConfig = {
  type: '2d-polar',
  functions: [
    {
      fn: (theta) => 2 + Math.sin(5 * theta),
      label: 'Rose curve',
      style: {
        line: { width: 2, color: '#dc2626' },
      },
    },
  ],
  thetaRange: { min: 0, max: 2 * Math.PI },
  rRange: { min: 0, max: 3 },
};

renderer.render(config);
```

### 3D Surface Plot

```typescript
import { loadWebGL3DRenderer, type Plot3DSurfaceConfig } from '@nextcalc/plot-engine';

const canvas = document.getElementById('plot-canvas') as HTMLCanvasElement;

// Lazy-load Three.js renderer
const { WebGL3DRenderer } = await loadWebGL3DRenderer();
const renderer = new WebGL3DRenderer(canvas);

await renderer.initialize();

const config: Plot3DSurfaceConfig = {
  type: '3d-surface',
  fn: (x, y) => Math.sin(Math.sqrt(x * x + y * y)),
  viewport: {
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    zMin: -1,
    zMax: 1,
  },
  resolution: { x: 50, y: 50 },
  colorMap: 'viridis',
  wireframe: false,
  title: 'Sinc function',
};

renderer.render(config);
```

### Adaptive Sampling

```typescript
import { adaptiveSample1D, defaultSamplingConfig } from '@nextcalc/plot-engine';

const result = adaptiveSample1D(
  (x) => Math.sin(10 * x) / x,
  -5,
  5,
  {
    ...defaultSamplingConfig,
    initialSamples: 100,
    maxDepth: 5,
    angleTolerance: 0.1,
  }
);

console.log(`Sampled ${result.sampleCount} points in ${result.elapsedTime}ms`);
```

### Interactive Controls

```typescript
import { Plot2DController } from '@nextcalc/plot-engine';

const controller = new Plot2DController(canvas, {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
});

controller.enable();

controller.addEventListener('pan', (event) => {
  console.log('Viewport panned:', event.data.viewport);
  // Re-render with new viewport
  renderer.render({ ...config, viewport: event.data.viewport });
});

controller.addEventListener('zoom', (event) => {
  console.log('Viewport zoomed:', event.data.viewport);
  // Re-render with new viewport
  renderer.render({ ...config, viewport: event.data.viewport });
});

// Reset to initial viewport
controller.addEventListener('reset', (event) => {
  console.log('Viewport reset');
  renderer.render({ ...config, viewport: event.data.viewport });
});
```

### Export Functionality

```typescript
import { downloadAsPNG, downloadAsSVG, downloadAsCSV2D } from '@nextcalc/plot-engine';

// Export as PNG
await downloadAsPNG(canvas, 'plot.png', {
  width: 1920,
  height: 1080,
  scale: 2,
  backgroundColor: '#ffffff',
});

// Export as SVG (2D only)
await downloadAsSVG([points], viewport, 'plot.svg', {
  width: 800,
  height: 600,
  backgroundColor: '#ffffff',
});

// Export as CSV (2D only)
await downloadAsCSV2D(points, 'plot-data.csv', {
  delimiter: ',',
  includeHeader: true,
  precision: 6,
});
```

## React Integration

```tsx
import { Plot2D, Plot3D, PlotContainer, PlotControls } from '@nextcalc/web/components/plots';

function MyPlot() {
  const config: Plot2DCartesianConfig = {
    type: '2d-cartesian',
    functions: [
      { fn: (x) => x * x, label: 'y = x²' },
    ],
    viewport: { xMin: -5, xMax: 5, yMin: 0, yMax: 25 },
    // ... axis config
  };

  return (
    <PlotContainer title="Quadratic Function" description="y = x²">
      <Plot2D config={config} width={800} height={600} enableInteractions={true} />
    </PlotContainer>
  );
}
```

## Performance Targets

- **2D Init Time**: <50ms
- **2D Render (10k points)**: 60fps sustained
- **3D Init Time**: <100ms
- **3D Render**: 45fps sustained
- **Memory Usage**: <20MB per 2D plot, <100MB per 3D plot
- **Bundle Size**: 15KB (2D), 563KB (3D with Three.js lazy-loaded)

## Renderer Selection

The engine automatically selects the best available renderer:

| Priority | Backend | Use Case |
|----------|---------|----------|
| 1 | WebGPU | PDE/ODE compute shaders, bifurcation diagrams |
| 2 | WebGL 2 | Primary 2D rendering with GLSL shaders |
| 3 | Canvas 2D | Software fallback for legacy browsers |

```typescript
import { createBest2DRenderer } from '@nextcalc/plot-engine';

const renderer = await createBest2DRenderer(canvas);
// Automatically picks WebGPU > WebGL2 > Canvas2D
```

## Architecture

```
@nextcalc/plot-engine
├── types/           # TypeScript type definitions
├── renderers/       # WebGL 2D, Three.js 3D, Canvas 2D fallback
├── sampling/        # Adaptive sampling algorithms
├── controls/        # Interactive controls (pan, zoom, rotate)
├── export/          # PNG, SVG, CSV export
└── utils/           # Utilities (colors, matrices, buffers, shaders)
```

## Browser Support

- **WebGL 2**: 96%+ of browsers
- **WebGPU**: Progressive enhancement (37%+ of browsers in 2025)
- **Fallback**: Canvas 2D for environments without WebGL

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## License

MIT License - Part of NextCalc Pro
