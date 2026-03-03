/**
 * Three.js-based 3D renderer for surface and parametric plots.
 * Uses WebGPURenderer (three/webgpu) which automatically falls back to
 * WebGL 2 when WebGPU is unavailable. Post-processing uses the TSL-native
 * RenderPipeline + node-based bloom, compatible with both backends.
 *
 * MODERNIZATION FEATURES (Three.js 0.183.0):
 * - WebGPURenderer with automatic WebGL 2 fallback
 * - PBR materials (MeshStandardMaterial/MeshPhysicalMaterial)
 * - Node-based post-processing pipeline with RenderPipeline
 * - TSL bloom via BloomNode for glowing effects
 * - Shadow mapping with PCF filtering
 * - HDR tone mapping
 * - Optimized with instanced rendering where applicable
 * - Sprite-based axis labels (canvas texture, no external font loader)
 * - Wireframe overlay using LineSegments with MeshBasicMaterial (lighting-immune)
 * - Procedural HDR environment cubemap for IBL (image-based lighting)
 * - SSAO post-processing via TSL node pipeline for depth cue on surfaces
 *
 * @module renderers/webgl-3d
 */

import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js';
import { float, mix, mrt, normalView, output, pass } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { PCFSoftShadowMap, RenderPipeline, WebGPURenderer } from 'three/webgpu';
import type {
  IRenderer,
  PerformanceMetrics,
  Plot3DCurveConfig,
  Plot3DParametricCurveConfig,
  Plot3DParametricSurfaceConfig,
  Plot3DSurfaceConfig,
  PlotConfig,
  RenderBackend,
} from '../types/index';
import { getColorFromMap } from '../utils/color';
import { getJSHeapUsage } from '../utils/memory';

// ---------------------------------------------------------------------------
// Axis label sprite helpers
// ---------------------------------------------------------------------------

/**
 * Creates a canvas-based text texture for use as a sprite label.
 * The canvas is sized to the text so it looks crisp at any zoom level.
 *
 * If a `cache` map is provided the texture is memoised per text string.
 * When no cache is given the texture is always freshly created.
 */
function makeAxisLabelTexture(
  text: string,
  cache?: Map<string, THREE.CanvasTexture>,
): THREE.CanvasTexture {
  if (cache) {
    const cached = cache.get(text);
    if (cached) return cached;
  }

  if (typeof document === 'undefined') {
    throw new Error('makeAxisLabelTexture requires a browser environment');
  }

  const fontSize = 48;
  const padding = 12;

  const offscreen = document.createElement('canvas');
  // Use a single context: set the font for measurement, then resize the
  // canvas (which resets state) and redraw at full resolution.
  const ctx = offscreen.getContext('2d')!;
  ctx.font = `bold ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(text).width;

  const canvasWidth = Math.ceil(textWidth + padding * 2);
  const canvasHeight = Math.ceil(fontSize + padding * 2);
  offscreen.width = canvasWidth;
  offscreen.height = canvasHeight;

  // After resize the context state is reset — re-apply all settings.
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Soft dark pill background for legibility against any surface colour.
  ctx.fillStyle = 'rgba(10, 10, 20, 0.65)';
  ctx.beginPath();
  const r = canvasHeight * 0.35;
  ctx.roundRect(0, 0, canvasWidth, canvasHeight, r);
  ctx.fill();

  // White text
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

  const texture = new THREE.CanvasTexture(offscreen);
  texture.needsUpdate = true;
  cache?.set(text, texture);
  return texture;
}

/**
 * Creates a billboard sprite positioned at `position`.
 * `scale` controls the world-space size of the label quad.
 */
function makeAxisLabelSprite(
  text: string,
  position: THREE.Vector3,
  scale: number,
  cache?: Map<string, THREE.CanvasTexture>,
): THREE.Sprite {
  const texture = makeAxisLabelTexture(text, cache);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false, // Prevents z-fighting with the surface
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);

  // Preserve the texture's aspect ratio
  const aspect = texture.image.width / texture.image.height;
  sprite.scale.set(scale * aspect, scale, 1);
  return sprite;
}

// ---------------------------------------------------------------------------
// Procedural HDR CubeMap generation — 5 space themes at configurable resolution
// ---------------------------------------------------------------------------

export type SpaceTheme =
  | 'neutron-star-collision'
  | 'black-hole-merger'
  | 'great-attractor'
  | 'dipole-repeller'
  | 'shapley-attractor';

export type CubemapResolution = 512 | 1024 | 2048 | 4096;

export const SPACE_THEMES: ReadonlyArray<{ id: SpaceTheme; label: string }> = [
  { id: 'neutron-star-collision', label: 'Neutron Star Collision' },
  { id: 'black-hole-merger', label: 'Black Hole Merger' },
  { id: 'great-attractor', label: 'Great Attractor' },
  { id: 'dipole-repeller', label: 'Dipole Repeller' },
  { id: 'shapley-attractor', label: 'Shapley Attractor' },
];

/**
 * Generates a procedural HDR-like environment cubemap purely in JavaScript.
 * No external .hdr files are required.
 *
 * Supports 5 space themes:
 *   - neutron-star-collision: Hot-white point sources with orange/red shockwave rings
 *   - black-hole-merger: Dark voids with accretion disks and gravitational wave ripples
 *   - great-attractor: Dense warm-white cluster with galaxy smears and flow lines
 *   - dipole-repeller: Warm/cool split scene with cosmic web filaments
 *   - shapley-attractor: Massive supercluster with ICM glow and cosmic web
 *
 * Resolution is configurable from 512 to 4096 per face.
 *
 * @param theme      Space theme to render. Default: 'neutron-star-collision'
 * @param resolution Cubemap face resolution in pixels. Default: 512
 */
export function createProceduralHDRCubeMap(
  theme: SpaceTheme = 'neutron-star-collision',
  resolution: CubemapResolution = 512,
): THREE.CubeTexture {
  const SIZE = resolution;

  // Seeded PRNG for deterministic starfields
  function seededRandom(seed: number): () => number {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Shared: direction-based star hash (deterministic)
  function starHash(nx: number, ny: number, nz: number): number {
    const h = Math.abs(Math.sin(nx * 12.9898 + ny * 78.233 + nz * 45.164) * 43758.5453);
    return h - Math.floor(h);
  }

  // Shared: Gaussian blob
  function gaussian(
    nx: number,
    ny: number,
    nz: number,
    cx: number,
    cy: number,
    cz: number,
    falloff: number,
  ): number {
    return Math.exp(-falloff * ((nx - cx) ** 2 + (ny - cy) ** 2 + (nz - cz) ** 2));
  }

  // Get direction vector for cubemap face texel
  function getDirection(faceIndex: number, u: number, v: number): [number, number, number] {
    let wx = 0,
      wy = 0,
      wz = 0;
    switch (faceIndex) {
      case 0:
        wx = 1;
        wy = -v;
        wz = -u;
        break;
      case 1:
        wx = -1;
        wy = -v;
        wz = u;
        break;
      case 2:
        wx = u;
        wy = 1;
        wz = v;
        break;
      case 3:
        wx = u;
        wy = -1;
        wz = -v;
        break;
      case 4:
        wx = u;
        wy = -v;
        wz = 1;
        break;
      case 5:
        wx = -u;
        wy = -v;
        wz = -1;
        break;
    }
    const len = Math.sqrt(wx * wx + wy * wy + wz * wz);
    return [wx / len, wy / len, wz / len];
  }

  // Paint a face based on theme
  function paintFace(faceIndex: number): Uint8Array {
    const data = new Uint8Array(SIZE * SIZE * 4);
    const rng = seededRandom(faceIndex * 7919 + 42);

    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const u = (px / (SIZE - 1)) * 2.0 - 1.0;
        const v = (py / (SIZE - 1)) * 2.0 - 1.0;
        const [nx, ny, nz] = getDirection(faceIndex, u, v);

        let r = 0,
          g = 0,
          b = 0;

        switch (theme) {
          case 'neutron-star-collision':
            [r, g, b] = paintNeutronStar(nx, ny, nz, rng);
            break;
          case 'black-hole-merger':
            [r, g, b] = paintBlackHole(nx, ny, nz, rng);
            break;
          case 'great-attractor':
            [r, g, b] = paintGreatAttractor(nx, ny, nz, rng);
            break;
          case 'dipole-repeller':
            [r, g, b] = paintDipoleRepeller(nx, ny, nz, rng);
            break;
          case 'shapley-attractor':
            [r, g, b] = paintShapleyAttractor(nx, ny, nz, rng);
            break;
        }

        const idx = (py * SIZE + px) * 4;
        data[idx] = Math.min(255, Math.floor(Math.max(0, r) * 255));
        data[idx + 1] = Math.min(255, Math.floor(Math.max(0, g) * 255));
        data[idx + 2] = Math.min(255, Math.floor(Math.max(0, b) * 255));
        data[idx + 3] = 255;
      }
    }
    return data;
  }

  // --- THEME IMPLEMENTATIONS ---

  function paintNeutronStar(
    nx: number,
    ny: number,
    nz: number,
    _rng: () => number,
  ): [number, number, number] {
    // -----------------------------------------------------------------------
    // NEUTRON STAR COLLISION (kilonova)
    // Based on NASA SVS 14884 supercomputer simulation.
    // Scene: two ultra-compact stellar remnants spiraling inward, then the
    // kilonova explosion — a thick shell of r-process ejecta glowing orange-gold,
    // magnetic-field jets perpendicular to the orbital plane, and a blinding
    // blue-white flash at the merger site surrounded by a purple ionised haze.
    // -----------------------------------------------------------------------

    // --- 1. SPACE BACKGROUND ---
    // Deep indigo-purple base representing ionised ejecta nebula haze.
    // The haze is anisotropic — brighter in the equatorial belt (orbital plane).
    const equatorialBand = Math.exp(-12.0 * ny * ny); // peaks at ny=0 (equator)
    let r = 0.015 + equatorialBand * 0.06;
    let g = 0.008 + equatorialBand * 0.015;
    let b = 0.045 + equatorialBand * 0.12;

    // --- 2. BACKGROUND STARFIELD (dense, blue-white) ---
    const star = starHash(nx, ny, nz);
    if (star > 0.96) {
      const bright = (star - 0.96) * 25.0;
      r += bright * 0.7;
      g += bright * 0.82;
      b += bright * 1.0;
    }
    // Secondary star layer — different hash seed via offset
    const star2 = starHash(nx * 1.618 + 0.414, ny * 2.302 - 0.577, nz * 1.732 + 1.0);
    if (star2 > 0.983) {
      const bright2 = (star2 - 0.983) * 18.0;
      r += bright2 * 0.55;
      g += bright2 * 0.7;
      b += bright2 * 0.9;
    }

    // --- 3. TWO NEUTRON STAR CORES (ultra-bright gray/white-hot remnants) ---
    // They orbit in the equatorial plane (ny ≈ 0). The two bodies are
    // separated by ~0.45 units in the xz plane.
    const ns1x = 0.28,
      ns1y = 0.08,
      ns1z = 0.2;
    const ns2x = -0.22,
      ns2y = -0.05,
      ns2z = -0.18;

    // Each star has a pinpoint core (falloff 200 = radius ~0.07) and
    // a broad hot magnetosphere (falloff 8 = radius ~0.35).
    const core1 = gaussian(nx, ny, nz, ns1x, ns1y, ns1z, 200);
    const core2 = gaussian(nx, ny, nz, ns2x, ns2y, ns2z, 200);
    const mag1 = gaussian(nx, ny, nz, ns1x, ns1y, ns1z, 8);
    const mag2 = gaussian(nx, ny, nz, ns2x, ns2y, ns2z, 8);

    // Cores: blinding white-blue (T > 10^9 K)
    r += (core1 + core2) * 6.0;
    g += (core1 + core2) * 6.0;
    b += (core1 + core2) * 7.5;

    // Magnetospheres: hot blue-white halo
    r += (mag1 + mag2) * 0.55;
    g += (mag1 + mag2) * 0.65;
    b += (mag1 + mag2) * 1.2;

    // --- 4. MAGNETIC FIELD INTERACTION ARC between the two stars ---
    // Model as a "tube proximity" function: bright where the current point
    // is close to the line segment connecting ns1 and ns2.
    // Segment parameter t in [0,1], point closest on segment, distance to it.
    const segDx = ns2x - ns1x,
      segDy = ns2y - ns1y,
      segDz = ns2z - ns1z;
    const segLen2 = segDx * segDx + segDy * segDy + segDz * segDz;
    const toCx = nx - ns1x,
      toCy = ny - ns1y,
      toCz = nz - ns1z;
    const tParam = Math.max(0, Math.min(1, (toCx * segDx + toCy * segDy + toCz * segDz) / segLen2));
    const closestX = ns1x + tParam * segDx;
    const closestY = ns1y + tParam * segDy;
    const closestZ = ns1z + tParam * segDz;
    const arcDist2 = (nx - closestX) ** 2 + (ny - closestY) ** 2 + (nz - closestZ) ** 2;
    // Thin bright arc (falloff 280 → half-width ~0.06): hot electric-blue/white
    const arcCore = Math.exp(-280 * arcDist2) * 1.8;
    // Broad magnetic glow around the arc
    const arcGlow = Math.exp(-35 * arcDist2) * 0.4;
    r += arcCore * 1.4 + arcGlow * 0.5;
    g += arcCore * 1.6 + arcGlow * 0.7;
    b += arcCore * 2.2 + arcGlow * 1.4;

    // --- 5. KILONOVA EJECTA SHELL (the main visual centrepiece) ---
    // A thick expanding sphere of r-process material centred on the merger point.
    // The shell glows orange-gold (lanthanide-rich ejecta, T~5000 K).
    const midX = (ns1x + ns2x) * 0.5; // merger midpoint ≈ (0.03, 0.015, 0.01)
    const midY = (ns1y + ns2y) * 0.5;
    const midZ = (ns1z + ns2z) * 0.5;
    const distMid = Math.sqrt((nx - midX) ** 2 + (ny - midY) ** 2 + (nz - midZ) ** 2);

    // Inner ejecta shell: radius 0.38, thickness controlled by falloff 22
    const shellInner = Math.exp(-22 * (distMid - 0.38) ** 2) * 1.05;
    // Outer wind shell: radius 0.62, thicker and dimmer (slower wind component)
    const shellOuter = Math.exp(-14 * (distMid - 0.62) ** 2) * 0.6;
    // The innermost thermal core just outside the merger site
    const shellCore = Math.exp(-10 * (distMid - 0.18) ** 2) * 0.8;
    // Color: deep orange-gold → red at outer edge
    r += shellInner * 2.8 + shellOuter * 1.6 + shellCore * 2.2;
    g += shellInner * 0.75 + shellOuter * 0.28 + shellCore * 0.6;
    b += shellInner * 0.04 + shellOuter * 0.02 + shellCore * 0.05;

    // --- 6. CENTRAL MERGER FLASH (blue-white, very tight) ---
    // The collision site has a blinding white-blue flash brighter than both stars.
    const flashCore = gaussian(nx, ny, nz, midX, midY, midZ, 400);
    const flashHalo = gaussian(nx, ny, nz, midX, midY, midZ, 18);
    r += flashCore * 10.0 + flashHalo * 1.2;
    g += flashCore * 10.0 + flashHalo * 1.4;
    b += flashCore * 12.0 + flashHalo * 2.2;

    // --- 7. GAMMA-RAY JETS (perpendicular to orbital plane = along +/- Y axis) ---
    // Two narrow collimated beams. A jet is a cone around the ±Y axis.
    // Use the angular deviation from the Y axis to define the beam width.
    // cos(theta) = |ny| for the angle from ±Y. Beam half-angle ~8° → cos > 0.990.
    const cosFromY = Math.abs(ny); // 1.0 exactly on ±Y poles
    // Proximity to the merger axis (not too close to merger point itself to avoid double-flash)
    const axialDist = Math.sqrt((nx - midX) ** 2 + (nz - midZ) ** 2); // radial from jet axis
    const jetMask = Math.exp(-180 * axialDist ** 2); // tight beam: half-width ~0.075
    const jetEnv = Math.exp(-3.0 * Math.abs(ny - Math.sign(ny) * 0.25)); // fades with distance from merger
    const jetIntensity = (Math.max(0, cosFromY - 0.88) / 0.12) * jetMask * jetEnv;
    // Jets are intense blue-white (Lorentz-boosted gamma + X-ray)
    r += jetIntensity * 1.8;
    g += jetIntensity * 2.2;
    b += jetIntensity * 3.5;

    // --- 8. PURPLE / BLUE NEBULAR HAZE (ionised ejecta cloud) ---
    // Large diffuse region around the merger — purple (N II / O III emission lines).
    const nebulaGlow = gaussian(nx, ny, nz, midX, midY, midZ, 1.0);
    r += nebulaGlow * 0.3;
    g += nebulaGlow * 0.08;
    b += nebulaGlow * 0.55;

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  function paintBlackHole(
    nx: number,
    ny: number,
    nz: number,
    _rng: () => number,
  ): [number, number, number] {
    // -----------------------------------------------------------------------
    // BINARY BLACK HOLE MERGER
    // Based on NASA binary black hole visualisations.
    // Scene: two pitch-black event horizons with thin Interstellar-style
    // accretion disks (Doppler-brightened approaching side), an Einstein ring
    // between them, gravitational wave ripples as concentric blue-white arcs,
    // and a white merger flash.  Each disk has the characteristic "double hump"
    // lensing — a thin ring visible both above and below the shadow.
    // -----------------------------------------------------------------------

    // --- 1. ABSOLUTE SPACE BASE — near-zero (darkest theme) ---
    let r = 0.008;
    let g = 0.004;
    let b = 0.018;

    // --- 2. BACKGROUND STARFIELD (lensed — stars slightly displaced near BHs) ---
    const star = starHash(nx, ny, nz);
    if (star > 0.968) {
      const bright = (star - 0.968) * 32.0;
      r += bright * 0.85;
      g += bright * 0.93;
      b += bright * 1.0;
    }

    // --- 3. TWO BLACK HOLE EVENT HORIZONS ---
    // BH1 (primary, slightly larger): offset to the right in xz plane
    // BH2 (secondary): offset left.  Both in the equatorial plane (ny≈0).
    const bh1x = 0.38,
      bh1y = 0.1,
      bh1z = 0.05;
    const bh2x = -0.3,
      bh2y = -0.08,
      bh2z = 0.12;
    const dist1 = Math.sqrt((nx - bh1x) ** 2 + (ny - bh1y) ** 2 + (nz - bh1z) ** 2);
    const dist2 = Math.sqrt((nx - bh2x) ** 2 + (ny - bh2y) ** 2 + (nz - bh2z) ** 2);

    // Schwarzschild radius analogues in normalised space
    const SR1 = 0.13,
      SR2 = 0.11;

    // Hard void: absolute black inside the event horizon
    if (dist1 < SR1 || dist2 < SR2) {
      return [0, 0, 0];
    }

    // Lensing shadow transition: a very rapid darkening just outside the event horizon
    // models the photon capture radius (1.5× Schwarzschild) pulling light inward.
    const lensCapture1 = Math.exp(-60 * (dist1 - SR1 * 1.5) ** 2);
    const lensCapture2 = Math.exp(-60 * (dist2 - SR2 * 1.5) ** 2);
    const totalCapture = Math.min(1.0, lensCapture1 + lensCapture2) * 0.96;
    r *= 1.0 - totalCapture;
    g *= 1.0 - totalCapture;
    b *= 1.0 - totalCapture;

    // --- 4. ACCRETION DISKS — Interstellar-style thin luminous rings ---
    // Each disk lives in the equatorial plane of its BH.  We model it as a
    // narrow torus in the xz plane through the BH centre.
    // "Ring radius" in the xz plane from the BH axis (vertical = y).

    // For BH1: radial distance in the plane perpendicular to the BH spin axis (≈Y)
    const bh1PlaneDx = nx - bh1x,
      bh1PlaneDz = nz - bh1z;
    const bh1PlaneR = Math.sqrt(bh1PlaneDx ** 2 + bh1PlaneDz ** 2); // ring radius
    const bh1Height = ny - bh1y; // height above disk plane
    // Toroidal distance from the ring centreline at radius DISK_R1
    const DISK_R1 = 0.22;
    const bh1ToroidDist = Math.sqrt((bh1PlaneR - DISK_R1) ** 2 + bh1Height ** 2 * 4.0);
    // Thin primary ring + ghost ring above/below (lensing double image)
    const ring1A = Math.exp(-55 * bh1ToroidDist ** 2) * 1.4; // main ring
    const ring1B =
      Math.exp(-55 * ((bh1PlaneR - DISK_R1 * 0.88) ** 2 + (bh1Height + 0.06) ** 2 * 4.0)) * 0.5; // lensed ghost

    // Doppler brightening: approaching side (nx > bh1x) glows orange-white,
    // receding side (nx < bh1x) is dimmer and redder.
    const doppler1 = 0.5 + 0.5 * Math.tanh((nx - bh1x) * 5.0); // 0=receding,1=approaching
    const diskColor1R = ring1A * (1.6 + 1.0 * doppler1) + ring1B * 0.8;
    const diskColor1G = ring1A * (0.7 + 0.5 * doppler1) + ring1B * 0.4;
    const diskColor1B = ring1A * (0.1 + 0.1 * doppler1) + ring1B * 0.1;

    // For BH2:
    const bh2PlaneDx = nx - bh2x,
      bh2PlaneDz = nz - bh2z;
    const bh2PlaneR = Math.sqrt(bh2PlaneDx ** 2 + bh2PlaneDz ** 2);
    const bh2Height = ny - bh2y;
    const DISK_R2 = 0.19;
    const bh2ToroidDist = Math.sqrt((bh2PlaneR - DISK_R2) ** 2 + bh2Height ** 2 * 4.0);
    const ring2A = Math.exp(-55 * bh2ToroidDist ** 2) * 1.2;
    const ring2B =
      Math.exp(-55 * ((bh2PlaneR - DISK_R2 * 0.88) ** 2 + (bh2Height + 0.055) ** 2 * 4.0)) * 0.45;
    const doppler2 = 0.5 + 0.5 * Math.tanh((nx - bh2x) * 5.0);
    const diskColor2R = ring2A * (1.4 + 0.9 * doppler2) + ring2B * 0.7;
    const diskColor2G = ring2A * (0.6 + 0.4 * doppler2) + ring2B * 0.35;
    const diskColor2B = ring2A * (0.08 + 0.08 * doppler2) + ring2B * 0.08;

    r += diskColor1R + diskColor2R;
    g += diskColor1G + diskColor2G;
    b += diskColor1B + diskColor2B;

    // Outer diffuse accretion corona (broader, dimmer red-orange glow)
    const corona1 = gaussian(nx, ny, nz, bh1x, bh1y, bh1z, 5);
    const corona2 = gaussian(nx, ny, nz, bh2x, bh2y, bh2z, 5);
    r += (corona1 + corona2) * 0.4;
    g += (corona1 + corona2) * 0.1;
    b += (corona1 + corona2) * 0.02;

    // --- 5. EINSTEIN RING between the two black holes ---
    // An Einstein ring appears as a thin bright circle centred between the pair.
    // We approximate it as a toroid around the merger midpoint axis.
    const emX = (bh1x + bh2x) * 0.5,
      emY = (bh1y + bh2y) * 0.5,
      emZ = (bh1z + bh2z) * 0.5;
    const eRingPlaneR = Math.sqrt((nx - emX) ** 2 + (nz - emZ) ** 2);
    const eRingHeight = ny - emY;
    const ERING_R = 0.32;
    const eRingDist = Math.sqrt((eRingPlaneR - ERING_R) ** 2 + eRingHeight ** 2 * 2.0);
    const eRing = Math.exp(-80 * eRingDist ** 2) * 0.9;
    // Einstein ring is bright blue-white (blueshifted background light)
    r += eRing * 1.0;
    g += eRing * 1.2;
    b += eRing * 1.8;

    // --- 6. GRAVITATIONAL WAVE RIPPLES (concentric blue-white arcs) ---
    // Waves propagate spherically outward from the merger point.
    // The amplitude envelope decays with distance; phase gives alternating bands.
    const distMerger = Math.sqrt((nx - emX) ** 2 + (ny - emY) ** 2 + (nz - emZ) ** 2);
    // Envelope: bright close to merger, fades at large distance
    const rippleEnv = Math.exp(-1.8 * distMerger) * Math.max(0, distMerger - SR1 * 2.0) * 2.5;
    // Three wave crests, phase-offset to look like expanding rings at different radii
    const ripple =
      (Math.max(0, Math.sin(distMerger * 28.0 - 0.8)) +
        Math.max(0, Math.sin(distMerger * 28.0 - 0.8 - 2.1)) * 0.5) *
      rippleEnv;
    // Crests: blue-white (Cherenkov analogue)
    r += ripple * 0.28;
    g += ripple * 0.55;
    b += ripple * 1.1;

    // --- 7. MERGER POINT WHITE FLASH (brief intense central burst) ---
    const mergerFlash = gaussian(nx, ny, nz, emX, emY, emZ, 350);
    r += mergerFlash * 8.0;
    g += mergerFlash * 8.0;
    b += mergerFlash * 9.5;

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  function paintGreatAttractor(
    nx: number,
    ny: number,
    nz: number,
    _rng: () => number,
  ): [number, number, number] {
    // -----------------------------------------------------------------------
    // THE GREAT ATTRACTOR (Laniakea supercluster bulk flow convergence)
    // Based on Laniakea mapping (Tully et al., Nature 2014) and
    // Sky & Telescope supercluster visualisations.
    // Scene: thousands of galaxy blobs flowing toward a blazing warm-white
    // Norma cluster core, cosmic web filaments as bright curved threads,
    // a Zone of Avoidance dark band (Milky Way plane), and galaxy "rivers"
    // visible as elongated streamlines converging on the attractor.
    // -----------------------------------------------------------------------

    // --- 1. DEEP-SPACE BACKGROUND — dark navy with slight warm gradient ---
    // The attractor sits roughly at nz>0, nx>0, ny~0 in our space.
    // Background is darker toward the void side and warmer toward the attractor.
    const attX = 0.42,
      attY = 0.08,
      attZ = -0.22; // attractor centre direction
    const distToAtt = Math.sqrt((nx - attX) ** 2 + (ny - attY) ** 2 + (nz - attZ) ** 2);
    // Proximity weight: 0 far from attractor → 1 at centre
    const proxW = Math.exp(-1.5 * distToAtt);
    let r = 0.018 + proxW * 0.055;
    let g = 0.01 + proxW * 0.025;
    let b = 0.035 + proxW * 0.01;

    // --- 2. ZONE OF AVOIDANCE — the Milky Way galactic plane blocks the view ---
    // Our galaxy's dust cuts a dark band along ny ≈ 0 (equatorial plane).
    // Make it wide enough to be clearly visible (~±15° = ny in [-0.26, 0.26]).
    const zoaWidth = 0.24;
    const zoaBand = Math.exp(-18 * (ny / zoaWidth) ** 2); // 1 at equator, 0 away from it
    // Zone of Avoidance suppresses ALL features in this band
    const zoaSuppress = zoaBand * 0.92;

    // --- 3. STARFIELD — density tracks galaxy density (denser near attractor) ---
    const star = starHash(nx, ny, nz);
    // At the attractor: threshold 0.68 → ~32% lit.  In void: 0.975 → ~2.5% lit.
    const starThreshold = 0.975 - proxW * 0.295;
    if (star > Math.max(0, starThreshold)) {
      const range = 1.0 - Math.max(0, starThreshold);
      const bright = range > 0 ? ((star - Math.max(0, starThreshold)) / range) * 2.0 : 0;
      // Stars near attractor are warm golden-white (old elliptical galaxy populations)
      r += bright * (0.95 + 0.05 * proxW) * (1.0 - zoaSuppress);
      g += bright * (0.9 + 0.03 * proxW) * (1.0 - zoaSuppress);
      b += bright * (0.78 - 0.12 * proxW) * (1.0 - zoaSuppress);
    }

    // --- 4. NORMA CLUSTER CORE — the densest, brightest region ---
    // Extremely bright warm-white compressed core (analogous to a blazar in brightness)
    const normaBright = gaussian(nx, ny, nz, attX, attY, attZ, 30) * 1.0; // tight core
    const normaGlow = gaussian(nx, ny, nz, attX, attY, attZ, 4.0) * 0.65; // broad glow
    r += (normaBright * 3.5 + normaGlow * 1.2) * (1.0 - zoaSuppress);
    g += (normaBright * 3.0 + normaGlow * 1.0) * (1.0 - zoaSuppress);
    b += (normaBright * 2.2 + normaGlow * 0.55) * (1.0 - zoaSuppress);

    // --- 5. GALAXY CLUSTER BLOBS — distinct patches of galaxy concentration ---
    // Each is an elongated blob (higher falloff in some axes = smeared galaxy cluster).
    // Using slightly anisotropic Gaussians via pre-computed stretched coordinates.
    type GalBlob = [number, number, number, number, string]; // cx,cy,cz,falloff,type
    const galaxyBlobs: GalBlob[] = [
      [0.52, 0.05, -0.08, 20, 'warm'], // Norma cluster satellite
      [0.3, 0.15, -0.35, 18, 'warm'], // PKS 1343-601 direction
      [0.6, -0.1, -0.12, 22, 'warm'], // Centaurus cluster
      [0.38, 0.22, -0.42, 15, 'warm'], // Hydra-Centaurus filament node
      [0.2, 0.0, -0.15, 25, 'cool'], // Puppis cluster
      [0.55, 0.3, -0.3, 16, 'warm'], // Indus supercluster spur
      [0.15, 0.18, -0.45, 20, 'cool'], // More distant background cluster
      [0.65, -0.2, 0.05, 19, 'warm'], // Virgo direction inflow
    ];
    for (const [cx, cy, cz, fo, type] of galaxyBlobs) {
      const g_blob = gaussian(nx, ny, nz, cx, cy, cz, fo) * 0.45;
      const warmFactor = type === 'warm' ? 1.0 : 0.7;
      r += g_blob * (1.5 * warmFactor) * (1.0 - zoaSuppress);
      g += g_blob * (1.25 * warmFactor) * (1.0 - zoaSuppress);
      b += g_blob * (0.65 / warmFactor) * (1.0 - zoaSuppress);
    }

    // --- 6. COSMIC WEB FILAMENTS — bright curved threads connecting clusters ---
    // Each filament is modelled as a curved surface in 3D using a signed-distance
    // approach: for a given (nx,ny,nz) we compute how far it is from a parametric
    // curve and apply a Gaussian along that transverse distance.
    // Filament 1: great arc from Centaurus toward Norma (in xz plane near ny=0)
    //   Parametric: (0.60 - 0.18t, 0.10*sin(t*2.5), -0.12 - 0.30t) for t in [0,1]
    //   Approximate with 5 sample points along the curve
    const fil1Pts: [number, number, number][] = [
      [0.6, 0.03, -0.12],
      [0.55, 0.06, -0.19],
      [0.5, 0.08, -0.22],
      [0.46, 0.09, -0.24],
      [0.42, 0.08, -0.22],
    ];
    // Filament 2: flowing down from upper clusters toward Zone of Avoidance
    const fil2Pts: [number, number, number][] = [
      [0.3, 0.42, -0.35],
      [0.34, 0.28, -0.36],
      [0.37, 0.18, -0.36],
      [0.39, 0.12, -0.3],
      [0.42, 0.08, -0.22],
    ];
    // Filament 3: a long spur toward the void side
    const fil3Pts: [number, number, number][] = [
      [0.65, -0.2, 0.05],
      [0.58, -0.12, -0.05],
      [0.52, -0.04, -0.12],
      [0.47, 0.03, -0.18],
      [0.42, 0.08, -0.22],
    ];

    function filamentBrightness(pts: [number, number, number][]): number {
      let minDist2 = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const pA = pts[i]!;
        const pB = pts[i + 1]!;
        const ax = pA[0],
          ay = pA[1],
          az = pA[2];
        const bx = pB[0],
          by = pB[1],
          bz = pB[2];
        const sdx = bx - ax,
          sdy = by - ay,
          sdz = bz - az;
        const slen2 = sdx * sdx + sdy * sdy + sdz * sdz;
        const t2 = Math.max(
          0,
          Math.min(1, ((nx - ax) * sdx + (ny - ay) * sdy + (nz - az) * sdz) / slen2),
        );
        const dx = nx - ax - t2 * sdx,
          dy = ny - ay - t2 * sdy,
          dz = nz - az - t2 * sdz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < minDist2) minDist2 = d2;
      }
      return Math.exp(-90 * minDist2); // falloff 90 → half-width ~0.10 in direction space
    }

    const fil1B = filamentBrightness(fil1Pts) * 0.55 * (1.0 - zoaSuppress);
    const fil2B = filamentBrightness(fil2Pts) * 0.45 * (1.0 - zoaSuppress);
    const fil3B = filamentBrightness(fil3Pts) * 0.4 * (1.0 - zoaSuppress);
    const filTotal = fil1B + fil2B + fil3B;
    // Filaments: warm golden-yellow (old stellar populations in galaxy filaments)
    r += filTotal * 1.8;
    g += filTotal * 1.4;
    b += filTotal * 0.55;

    // --- 7. GALAXY INFLOW RIVERS — velocity streamlines pointing toward attractor ---
    // The "river" effect: lines of galaxy motion converging on the attractor.
    // We build a smooth vector field pointing toward (attX, attY, attZ) and
    // highlight the streamlines using a periodic function of the azimuthal angle
    // around the attractor axis.
    // In spherical coords centred on the attractor: azimuthal angle phi in [0, 2pi].
    const relX = nx - attX,
      relZ = nz - attZ;
    const relXZ = Math.sqrt(relX * relX + relZ * relZ) + 1e-6;
    const phi = Math.atan2(relZ, relX);
    // 8 distinct inflow rivers spaced 45° apart
    const riverPeriod = Math.max(0, Math.cos(phi * 4.0)) ** 12; // 8 peaks
    // Envelope: rivers exist at mid-distance (not too close to core, not too far)
    const riverEnv = Math.exp(-1.2 * relXZ) * (1.0 - Math.exp(-8 * relXZ));
    const riverBright = riverPeriod * riverEnv * 0.3 * (1.0 - zoaSuppress);
    r += riverBright * 1.2;
    g += riverBright * 0.9;
    b += riverBright * 0.35;

    // --- 8. ZONE OF AVOIDANCE — darken ALL content in the galactic plane band ---
    // Apply the suppression that was computed earlier to background and base
    r *= 1.0 - zoaSuppress * 0.75;
    g *= 1.0 - zoaSuppress * 0.75;
    b *= 1.0 - zoaSuppress * 0.75;
    // The ZoA itself has a slight dark-reddish dust lane colour
    r += zoaBand * 0.012;
    g += zoaBand * 0.006;
    b += zoaBand * 0.003;

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  function paintDipoleRepeller(
    nx: number,
    ny: number,
    nz: number,
    _rng: () => number,
  ): [number, number, number] {
    // -----------------------------------------------------------------------
    // DIPOLE REPELLER (Hoffman et al., Nature Astronomy, 2017)
    // Scene: a stark hemisphere split.
    //   - Positive hemisphere (nz > 0, Shapley direction): warm orange-gold,
    //     dense galaxy clusters, bright cosmic web filaments.
    //   - Negative hemisphere (nz < 0, repeller direction): a genuine
    //     HUGE VOID — pitch-black, virtually no galaxies, no filaments.
    //   - Boundary: a thin shock-heated shell where void meets filaments.
    //   - Flow streamlines (matter pushed away from void) clearly visible.
    // -----------------------------------------------------------------------

    // --- 1. BACKGROUND GRADIENT — warm amber → cold blue-black ---
    // warmCool = 1 on Shapley side, 0 on void side.
    const warmCool = Math.max(0, Math.min(1, (nz + 1.0) * 0.5));
    let r = 0.01 + warmCool * 0.055;
    let g = 0.004 + warmCool * 0.018;
    let b = 0.025 + (1.0 - warmCool) * 0.06;

    // --- 2. THE REPELLER VOID — absolute darkness, hard-edged ---
    // The void centre is at nz = -0.62 (deep into the repeller hemisphere).
    // We use a hard step inside the void radius and a steep penumbra outside.
    const vX = 0.04,
      vY = -0.06,
      vZ = -0.62;
    const voidDist = Math.sqrt((nx - vX) ** 2 + (ny - vY) ** 2 + (nz - vZ) ** 2);
    const VOID_CORE_R = 0.52; // the hard void interior
    const VOID_FRINGE_R = 0.62; // start of the boundary shell

    // Inside the hard void: return near-black immediately (with only the faintest haze)
    if (voidDist < VOID_CORE_R) {
      // Tiny amount of deep blue to show it's a different kind of black than space
      const voidDepth = voidDist / VOID_CORE_R; // 0 at centre, 1 at edge
      return [0.001 * voidDepth * voidDepth, 0.0, 0.003 * voidDepth * voidDepth];
    }

    // Fringe zone: rapid darkening just outside the hard void edge
    if (voidDist < VOID_FRINGE_R) {
      const fringeT = (voidDist - VOID_CORE_R) / (VOID_FRINGE_R - VOID_CORE_R); // 0→1
      r *= fringeT * fringeT;
      g *= fringeT * fringeT;
      b *= fringeT * fringeT * 1.1;
    }

    // --- 3. BOUNDARY SHOCK SHELL — thin glowing ring where void meets filaments ---
    // A hot shell of gas at the void-filament interface (like a Zeldovich pancake).
    const shockShell = Math.exp(-40 * (voidDist - VOID_FRINGE_R) ** 2);
    // Color: cool blue-purple (collisionally excited gas at the shock front)
    r += shockShell * 0.18;
    g += shockShell * 0.08;
    b += shockShell * 0.55;

    // --- 4. STARFIELD — dramatically asymmetric density ---
    // Shapley side: threshold drops to ~0.88 → ~12% stars lit (galaxy-dense region)
    // Void side: threshold 0.998 → ~0.2% lit (almost total void)
    const star = starHash(nx, ny, nz);
    const voidSuppression = Math.max(0, Math.min(1, (voidDist - VOID_CORE_R) / 0.45));
    const starThreshold = 0.998 - warmCool * 0.118 * voidSuppression;
    if (star > starThreshold) {
      const bright = ((star - starThreshold) / (1.0 - starThreshold + 1e-4)) * 2.2;
      r += bright * (0.45 + 0.55 * warmCool);
      g += bright * (0.65 + 0.2 * warmCool);
      b += bright * (0.95 - 0.7 * warmCool);
    }

    // --- 5. SHAPLEY ATTRACTOR (dense warm-gold galaxy clusters) ---
    // Multiple clusters on the nz>0 side, representing the attractor direction.
    const shapleyCentreW = warmCool * warmCool; // squared for steeper falloff on void side
    const shap1 = gaussian(nx, ny, nz, 0.08, 0.05, 0.68, 5.0) * 0.8 * shapleyCentreW;
    const shap2 = gaussian(nx, ny, nz, 0.2, -0.1, 0.55, 7.0) * 0.6 * shapleyCentreW;
    const shap3 = gaussian(nx, ny, nz, -0.15, 0.12, 0.72, 6.0) * 0.5 * shapleyCentreW;
    const shapTotal = shap1 + shap2 + shap3;
    r += shapTotal * 2.2;
    g += shapTotal * 1.3;
    b += shapTotal * 0.3;

    // --- 6. COSMIC WEB FILAMENTS — only on the attractor side, absent in void ---
    // Filaments are modelled as segment-based curves (same approach as Great Attractor).
    const filW = shapleyCentreW * Math.max(0, voidSuppression);

    // Filament A: connecting the main Shapley cluster to outlying groups
    const filA_pts: [number, number, number][] = [
      [0.08, 0.05, 0.68],
      [0.14, 0.08, 0.62],
      [0.2, 0.1, 0.56],
      [0.25, 0.12, 0.48],
      [0.28, 0.1, 0.4],
    ];
    // Filament B: descending from upper-attractor toward the equatorial plane
    const filB_pts: [number, number, number][] = [
      [-0.15, 0.45, 0.55],
      [-0.12, 0.3, 0.6],
      [-0.1, 0.16, 0.65],
      [0.0, 0.08, 0.68],
      [0.08, 0.05, 0.68],
    ];
    // Filament C: horizontal spur
    const filC_pts: [number, number, number][] = [
      [0.4, -0.05, 0.58],
      [0.28, -0.02, 0.62],
      [0.18, 0.02, 0.66],
      [0.08, 0.05, 0.68],
    ];

    function dipFilament(pts: [number, number, number][]): number {
      let minD2 = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const pA = pts[i]!;
        const pB = pts[i + 1]!;
        const ax = pA[0],
          ay = pA[1],
          az = pA[2];
        const bx = pB[0],
          by = pB[1],
          bz = pB[2];
        const ddx = bx - ax,
          ddy = by - ay,
          ddz = bz - az;
        const dl2 = ddx * ddx + ddy * ddy + ddz * ddz;
        const t3 = Math.max(
          0,
          Math.min(1, ((nx - ax) * ddx + (ny - ay) * ddy + (nz - az) * ddz) / dl2),
        );
        const ex = nx - ax - t3 * ddx,
          ey = ny - ay - t3 * ddy,
          ez = nz - az - t3 * ddz;
        const d2 = ex * ex + ey * ey + ez * ez;
        if (d2 < minD2) minD2 = d2;
      }
      return Math.exp(-110 * minD2); // tight filament half-width ~0.095
    }

    const filA = dipFilament(filA_pts) * 0.5 * filW;
    const filB = dipFilament(filB_pts) * 0.42 * filW;
    const filC = dipFilament(filC_pts) * 0.38 * filW;
    const filSum = filA + filB + filC;
    r += filSum * 2.0;
    g += filSum * 1.2;
    b += filSum * 0.25;

    // --- 7. FLOW STREAMLINES — visible arrows of matter pushed away from void ---
    // The dipole repeller pushes matter radially away from the void centre.
    // We visualise this as radial "spokes" emanating from the void, clearly
    // visible on the attractor side where they converge toward Shapley.
    const toVoidX = nx - vX,
      toVoidY = ny - vY,
      toVoidZ = nz - vZ;
    const toVoidLen = Math.sqrt(toVoidX ** 2 + toVoidY ** 2 + toVoidZ ** 2) + 1e-6;
    // Azimuthal angle around the Z axis (void axis)
    const psi = Math.atan2(toVoidY, toVoidX);
    // 6 flow streams
    const streamPeak = Math.max(0, Math.cos(psi * 3.0)) ** 10;
    // Only visible at intermediate distances from void (not inside, not at infinity)
    const streamEnv =
      Math.exp(-1.0 * toVoidLen) * Math.max(0, 1.0 - Math.exp(-5.0 * (toVoidLen - VOID_FRINGE_R)));
    const streamBright = streamPeak * streamEnv * 0.22 * warmCool;
    r += streamBright * 1.4;
    g += streamBright * 0.8;
    b += streamBright * 0.2;

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  function paintShapleyAttractor(
    nx: number,
    ny: number,
    nz: number,
    _rng: () => number,
  ): [number, number, number] {
    // -----------------------------------------------------------------------
    // SHAPLEY SUPERCLUSTER ATTRACTOR
    // Based on ESA/Planck + Chandra X-ray + optical observations.
    // The most massive concentration within a billion light-years: 8000+ galaxies.
    // Scene: dominant ICM (hot gas) halos in pink/purple filling ~40% of the view,
    // multiple bright cluster cores (Abell 3558, Abell 3562 analogues),
    // visible X-ray filaments of hot gas connecting clusters,
    // a dense starfield that overwhelms in the core direction,
    // and a faint cosmic web radiating outward as blue-white threads.
    // -----------------------------------------------------------------------

    // --- 1. NEAR-BLACK SPACE BASE ---
    let r = 0.008;
    let g = 0.006;
    let b = 0.022;

    // --- 2. SUPERCLUSTER CENTRE DIRECTION ---
    // The Shapley supercluster occupies a large cone in direction nz>0.
    // Centre is at (scX, scY, scZ); proximity drives all feature intensities.
    const scX = -0.18,
      scY = 0.12,
      scZ = 0.45;
    const distSC = Math.sqrt((nx - scX) ** 2 + (ny - scY) ** 2 + (nz - scZ) ** 2);
    // Angular proximity: 0 at scX,scY,scZ → 1 at opposite side
    const proxSC = Math.exp(-1.2 * distSC); // broad envelope for the whole supercluster

    // --- 3. MASSIVE ICM HALOS — dominant visual element (pink / purple) ---
    // The ICM (intracluster medium) is hot gas emitting X-rays, re-observed in
    // optical as a diffuse pink-purple glow.  These halos are LARGE — each one
    // covers a significant fraction of the sky at this scale.
    // Primary ICM: centred on the core, very broad (falloff 0.9 → radius ~1.05)
    const icmCore = gaussian(nx, ny, nz, scX, scY, scZ, 0.9) * 0.65;
    // Secondary ICM lobes (adjacent cluster mergers)
    const icmLobe1 = gaussian(nx, ny, nz, -0.05, 0.22, 0.52, 1.4) * 0.5;
    const icmLobe2 = gaussian(nx, ny, nz, -0.32, 0.0, 0.38, 1.6) * 0.42;
    const icmLobe3 = gaussian(nx, ny, nz, -0.1, -0.15, 0.5, 1.8) * 0.38;
    // Outer extended ICM — fills a large area with faint emission
    const icmOuter = gaussian(nx, ny, nz, scX, scY, scZ, 0.35) * 0.3;
    const icmTotal = icmCore + icmLobe1 + icmLobe2 + icmLobe3 + icmOuter;
    // ICM color: pinkish-purple (thermal bremsstrahlung + Fe-K emission)
    r += icmTotal * 1.45;
    g += icmTotal * 0.28;
    b += icmTotal * 1.2;

    // --- 4. INDIVIDUAL CLUSTER CORES (warm-white bright knots) ---
    // Abell 3558 analogue — the dominant cluster in the Shapley core
    const a3558 = gaussian(nx, ny, nz, -0.18, 0.12, 0.45, 35) * 0.85;
    // Abell 3562 analogue — the second brightest cluster, undergoing merger
    const a3562 = gaussian(nx, ny, nz, -0.1, 0.2, 0.52, 32) * 0.72;
    // Abell 3556 — smaller, on the outskirts
    const a3556 = gaussian(nx, ny, nz, -0.3, 0.05, 0.38, 28) * 0.58;
    // Several background clusters forming the Shapley concentration chain
    const bkg1 = gaussian(nx, ny, nz, 0.02, 0.08, 0.55, 24) * 0.48;
    const bkg2 = gaussian(nx, ny, nz, -0.25, 0.28, 0.42, 26) * 0.42;
    const bkg3 = gaussian(nx, ny, nz, -0.08, -0.08, 0.48, 30) * 0.38;
    const bkg4 = gaussian(nx, ny, nz, -0.38, 0.15, 0.35, 22) * 0.35;
    const coreSum = a3558 + a3562 + a3556 + bkg1 + bkg2 + bkg3 + bkg4;
    // Cluster cores: very bright warm-white (dominated by old red-sequence ellipticals)
    r += coreSum * 3.0;
    g += coreSum * 2.6;
    b += coreSum * 2.0;

    // Each bright cluster core also has a pink ICM halo around it
    const coreIcm = (a3558 + a3562 + a3556) * 0.6;
    r += coreIcm * 0.8;
    g += coreIcm * 0.12;
    b += coreIcm * 0.65;

    // --- 5. DENSE GALAXY STARFIELD — overwhelmingly dense near the core ---
    const star = starHash(nx, ny, nz);
    // At Shapley core: threshold → 0.58 → ~42% of pixels lit (packed galaxies)
    // At distance: threshold → 0.975 → ~2.5%
    const starThreshold = 0.975 - proxSC * 0.395;
    if (star > Math.max(0, starThreshold)) {
      const range = 1.0 - Math.max(0, starThreshold);
      const bright = range > 0 ? ((star - Math.max(0, starThreshold)) / range) * 2.5 : 0;
      // Slightly warm-white (old elliptical galaxy light dominates)
      r += bright * 1.0;
      g += bright * 0.97;
      b += bright * 0.88;
    }
    // Second star hash for even more density in the core
    const star2 = starHash(nx * 2.414 + 0.707, ny * 1.618 - 1.0, nz * 3.142 + 0.577);
    if (star2 > Math.max(0, 0.985 - proxSC * 0.35)) {
      const t2 = 1.0 - Math.max(0, 0.985 - proxSC * 0.35);
      const bright2 = t2 > 0 ? ((star2 - (0.985 - proxSC * 0.35)) / t2) * 1.8 : 0;
      r += bright2 * 1.0;
      g += bright2 * 0.95;
      b += bright2 * 0.85;
    }

    // --- 6. HOT GAS X-RAY FILAMENTS connecting clusters ---
    // Modelled as piecewise-linear curves with a Gaussian cross-section.
    // These are the hot intergalactic medium bridges seen in X-ray observations.
    const xray1_pts: [number, number, number][] = [
      [-0.18, 0.12, 0.45],
      [-0.14, 0.16, 0.49],
      [-0.1, 0.2, 0.52],
    ];
    const xray2_pts: [number, number, number][] = [
      [-0.18, 0.12, 0.45],
      [-0.24, 0.08, 0.42],
      [-0.3, 0.05, 0.38],
    ];
    const xray3_pts: [number, number, number][] = [
      [-0.1, 0.2, 0.52],
      [-0.05, 0.14, 0.54],
      [0.02, 0.08, 0.55],
    ];
    // Outer web threads radiating beyond the core
    const web1_pts: [number, number, number][] = [
      [-0.18, 0.12, 0.45],
      [-0.22, 0.18, 0.6],
      [-0.2, 0.25, 0.72],
    ];
    const web2_pts: [number, number, number][] = [
      [-0.18, 0.12, 0.45],
      [-0.08, 0.05, 0.62],
      [0.05, -0.02, 0.75],
    ];
    const web3_pts: [number, number, number][] = [
      [-0.18, 0.12, 0.45],
      [-0.35, 0.08, 0.58],
      [-0.5, 0.05, 0.68],
    ];

    function shapSegDist(pts: [number, number, number][], fo: number): number {
      let minD2 = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const pA = pts[i]!;
        const pB = pts[i + 1]!;
        const ax = pA[0],
          ay = pA[1],
          az = pA[2];
        const bx = pB[0],
          by = pB[1],
          bz = pB[2];
        const ddx = bx - ax,
          ddy = by - ay,
          ddz = bz - az;
        const dl2 = ddx * ddx + ddy * ddy + ddz * ddz;
        const t4 = Math.max(
          0,
          Math.min(1, ((nx - ax) * ddx + (ny - ay) * ddy + (nz - az) * ddz) / dl2),
        );
        const ex = nx - ax - t4 * ddx,
          ey = ny - ay - t4 * ddy,
          ez = nz - az - t4 * ddz;
        const d2 = ex * ex + ey * ey + ez * ez;
        if (d2 < minD2) minD2 = d2;
      }
      return Math.exp(-fo * minD2);
    }

    // Hot gas filaments: pink/purple (X-ray bremsstrahlung)
    const xr1 = shapSegDist(xray1_pts, 120) * 0.55;
    const xr2 = shapSegDist(xray2_pts, 120) * 0.5;
    const xr3 = shapSegDist(xray3_pts, 120) * 0.45;
    const xraySum = xr1 + xr2 + xr3;
    r += xraySum * 1.1;
    g += xraySum * 0.18;
    b += xraySum * 0.9;

    // Outer cosmic web threads: blue-white (colder gas, star-forming filaments)
    const wb1 = shapSegDist(web1_pts, 60) * 0.38;
    const wb2 = shapSegDist(web2_pts, 60) * 0.35;
    const wb3 = shapSegDist(web3_pts, 60) * 0.32;
    const webSum = wb1 + wb2 + wb3;
    r += webSum * 0.65;
    g += webSum * 0.58;
    b += webSum * 1.05;

    // --- 7. VAST OUTER ICM ENVELOPE (dominates ~40% of sky) ---
    // The Shapley supercluster is so massive its outer gas emission is visible
    // over a huge solid angle.  This very broad component anchors the scene.
    const skyEnvelope = gaussian(nx, ny, nz, scX, scY, scZ, 0.18) * 0.25;
    r += skyEnvelope * 1.0;
    g += skyEnvelope * 0.15;
    b += skyEnvelope * 0.85;

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  // Build cubemap from 6 faces
  const faceImages: HTMLCanvasElement[] = Array.from({ length: 6 }, (_, f) => {
    const pixels = paintFace(f);
    const c = document.createElement('canvas');
    c.width = SIZE;
    c.height = SIZE;
    c.getContext('2d')!.putImageData(
      new ImageData(new Uint8ClampedArray(pixels.buffer as ArrayBuffer), SIZE, SIZE),
      0,
      0,
    );
    return c;
  });

  const cubeTexture = new THREE.CubeTexture(faceImages);
  cubeTexture.colorSpace = THREE.SRGBColorSpace;
  cubeTexture.needsUpdate = true;
  return cubeTexture;
}

// ---------------------------------------------------------------------------
// Renderer factory: WebGPURenderer with built-in WebGL 2 fallback
// ---------------------------------------------------------------------------

/**
 * Detects the active backend after renderer.init().
 * WebGPURenderer exposes isWebGPURenderer; its internal backend reports
 * coordinateSystem to distinguish WebGPU from WebGL.
 */
function detectBackend(renderer: WebGPURenderer): RenderBackend {
  // THREE.WebGPUCoordinateSystem = 2 (Y-up, clip-space 0..1)
  // THREE.WebGLCoordinateSystem = 2000 (Y-up, clip-space -1..1)
  // We use the renderer's reported coordinate system as a reliable signal.
  return renderer.backend.coordinateSystem === THREE.WebGPUCoordinateSystem ? 'webgpu' : 'webgl2';
}

// ---------------------------------------------------------------------------
// SSAO configuration type
// ---------------------------------------------------------------------------

/**
 * Configuration for the SSAO (Screen Space Ambient Occlusion) effect.
 * All fields are optional; reasonable defaults are provided.
 */
export interface SSAOConfig {
  /** Sampling radius in world-space units. Default: 0.5 */
  radius?: number;
  /** Intensity multiplier for the AO contribution. Default: 1.0 */
  intensity?: number;
}

// ---------------------------------------------------------------------------
// HDR environment map configuration type
// ---------------------------------------------------------------------------

/**
 * Configuration for the procedural HDR environment map.
 */
export interface HDREnvConfig {
  /**
   * Intensity for scene.environment (IBL on PBR surfaces). Default: 0.4
   * Lower values keep the math-surface colormaps dominant.
   */
  envIntensity?: number;
  /**
   * Intensity for scene.background (visible sky).
   * Default: 0.08 — barely visible so it adds depth without distraction.
   */
  backgroundIntensity?: number;
  /** Space theme for the procedural cubemap. Default: 'neutron-star-collision' */
  theme?: SpaceTheme;
  /** Cubemap face resolution in pixels. Default: 512 */
  resolution?: CubemapResolution;
}

/**
 * Three.js 3D renderer implementation with modern PBR and node-based
 * post-processing. Targets WebGPU with automatic WebGL 2 fallback.
 */
export class WebGL3DRenderer implements IRenderer {
  readonly canvas: HTMLCanvasElement;

  // Actual backend determined after async init()
  private _backend: RenderBackend = 'webgl2';
  get backend(): RenderBackend {
    return this._backend;
  }

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: WebGPURenderer | null = null;
  private currentMesh: THREE.Mesh | THREE.Line | null = null;
  private currentWireframe: THREE.LineSegments | null = null;
  private axisLabelGroup: THREE.Group | null = null;
  private animationFrameId: number | null = null;

  // Node-based post-processing pipeline (replaces EffectComposer)
  private renderPipeline: RenderPipeline | null = null;

  // Lighting
  private directionalLight: THREE.DirectionalLight | null = null;

  // Instance-level axis label texture cache (disposed with the renderer)
  private axisLabelTextureCache = new Map<string, THREE.CanvasTexture>();

  // HDR environment map
  private envMap: THREE.CubeTexture | null = null;
  private _envMapEnabled = false;
  private _envIntensity = 0.4;
  private _backgroundIntensity = 0.08;
  private _spaceTheme: SpaceTheme = 'neutron-star-collision';
  private _cubemapResolution: CubemapResolution = 512;

  // SSAO state — when enabled the post-processing pipeline is rebuilt
  private _ssaoEnabled = false;
  private _ssaoRadius = 0.5;
  private _ssaoIntensity = 1.0;

  // Performance tracking
  private metrics: PerformanceMetrics = {
    initTime: 0,
    renderTime: 0,
    frameTime: 0,
    fps: 0,
    memoryUsage: 0,
    pointCount: 0,
    drawCalls: 0,
  };

  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsUpdateTime = 0;

  // Geometry caching to avoid regeneration
  private lastConfigHash: string | null = null;

  // Grid resolution cache: when the grid dimensions haven't changed we can
  // reuse the index buffer and just update position/color attribute data
  // instead of recreating the entire BufferGeometry.
  private lastSurfaceGridKey: string | null = null;
  private cachedIndexBuffer: THREE.BufferAttribute | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Initializes the Three.js WebGPURenderer (with automatic WebGL 2 fallback)
   * and the node-based post-processing pipeline.
   *
   * IMPORTANT: WebGPURenderer.init() is async and must complete before the
   * first render() call.
   */
  async initialize(): Promise<void> {
    const startTime = performance.now();

    try {
      // Create scene with modern settings
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0d0d1a); // Dark blue-black background
      this.scene.fog = new THREE.FogExp2(0x0d0d1a, 0.002); // Subtle depth fog

      // Create camera (adjusted for 4x larger scene)
      const aspect = this.canvas.width / this.canvas.height;
      this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
      this.camera.position.set(20, 20, 20);
      this.camera.lookAt(0, 0, 0);

      // Create WebGPURenderer — passes the existing canvas element.
      // The renderer will attempt WebGPU first; if the browser does not
      // support it, it falls back to WebGL 2 automatically without any
      // additional code path.
      this.renderer = new WebGPURenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });

      // Async initialisation is mandatory for WebGPURenderer.
      // This call requests the GPU adapter/device for the WebGPU path
      // or sets up the WebGL 2 context for the fallback path.
      await this.renderer.init();

      // Record which backend is actually in use
      this._backend = detectBackend(this.renderer);

      this.renderer.setSize(this.canvas.width, this.canvas.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Shadow mapping — API is identical to WebGLRenderer
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFSoftShadowMap;

      // HDR tone mapping
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;

      // Add modern PBR lighting
      this.setupModernLighting();

      // Setup node-based post-processing pipeline
      this.setupPostProcessing();

      // Grid helper (4x larger)
      const gridHelper = new THREE.GridHelper(40, 40, 0x66ccff, 0x334455);
      if (!Array.isArray(gridHelper.material)) {
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
      }
      this.scene.add(gridHelper);

      // Axes helper (X=red, Y=green, Z=blue) — scaled 4x
      const axesHelper = new THREE.AxesHelper(20);
      if (!Array.isArray(axesHelper.material)) {
        (axesHelper.material as THREE.LineBasicMaterial).linewidth = 2;
      }
      this.scene.add(axesHelper);

      // Sprite-based axis labels positioned just beyond each axis tip.
      // The THREE.js scene uses y-up, so our mathematical Z maps to THREE Y.
      const labelScale = 3.5;
      this.axisLabelGroup = new THREE.Group();

      const xLabel = makeAxisLabelSprite('X', new THREE.Vector3(22, 0, 0), labelScale, this.axisLabelTextureCache);
      const yLabel = makeAxisLabelSprite('Y', new THREE.Vector3(0, 0, 22), labelScale, this.axisLabelTextureCache);
      const zLabel = makeAxisLabelSprite('Z', new THREE.Vector3(0, 22, 0), labelScale, this.axisLabelTextureCache);

      this.axisLabelGroup.add(xLabel, yLabel, zLabel);
      this.scene.add(this.axisLabelGroup);

      this.metrics.initTime = performance.now() - startTime;
    } catch (error) {
      throw new Error(`Three.js 3D renderer initialization failed: ${error}`);
    }
  }

  /**
   * Sets up modern PBR lighting with shadows.
   */
  private setupModernLighting(): void {
    if (!this.scene) return;

    // Ambient light (softer for PBR)
    const ambientLight = new THREE.AmbientLight(0x404060, 0.3);
    this.scene.add(ambientLight);

    // Main directional light with shadows (sun)
    this.directionalLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    this.directionalLight.position.set(15, 25, 15);
    this.directionalLight.castShadow = true;

    // Configure shadow mapping for high quality
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 100;
    this.directionalLight.shadow.camera.left = -30;
    this.directionalLight.shadow.camera.right = 30;
    this.directionalLight.shadow.camera.top = 30;
    this.directionalLight.shadow.camera.bottom = -30;
    this.directionalLight.shadow.bias = -0.0001;
    this.directionalLight.shadow.normalBias = 0.02;

    this.scene.add(this.directionalLight);

    // Fill light (softer, from opposite side)
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.4);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    // Rim light (back light for edge highlights)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, 5, -15);
    this.scene.add(rimLight);

    // Hemisphere light for natural ambient (sky and ground)
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x543210, 0.4);
    this.scene.add(hemiLight);
  }

  /**
   * Sets up (or rebuilds) the node-based post-processing pipeline using
   * Three.js's RenderPipeline and TSL bloom node.
   *
   * When SSAO is enabled, a proper GTAO (Ground Truth Ambient Occlusion) pass
   * is used. This requires MRT (Multiple Render Targets) on the scene pass to
   * populate the 'normal' and 'depth' texture slots, which are then fed into
   * the GTAONode to compute per-pixel occlusion.
   *
   * NOTE: The previous implementation used `scenePass.getTextureNode('ao')`
   * which returns a constant 0.0 (black) because the 'ao' texture slot is NOT
   * natively populated by `pass()`. This caused `mix(1.0, 0.0, strength)` to
   * evaluate to ~0.3, darkening the entire scene to 30%.
   *
   * Pipeline composition:
   *   sceneColor  <- base render output (via MRT 'output' slot)
   *   bloomNode   <- additive bloom on bright areas (threshold 0.85)
   *   aoPass      <- GTAONode driven by depth + normal from MRT (SSAO only)
   *   outputNode  <- sceneColor * aoFactor + bloom
   */
  private setupPostProcessing(): void {
    if (!this.scene || !this.camera || !this.renderer) return;

    // Dispose the previous pipeline before rebuilding
    if (this.renderPipeline) {
      this.renderPipeline.dispose();
      this.renderPipeline = null;
    }

    // Scene pass — renders the scene to an internal render target.
    // When SSAO is enabled we configure MRT so the pass populates both the
    // color output and view-space normals into separate texture slots.
    const scenePass = pass(this.scene, this.camera);

    if (this._ssaoEnabled) {
      // MRT: write scene color to 'output' and view-space normals to 'normal'.
      // This is required by GTAONode which reads depth and normals from the
      // scene pass to compute screen-space ambient occlusion.
      scenePass.setMRT(
        mrt({
          output,
          normal: normalView,
        }),
      );
    }

    const sceneColor = scenePass.getTextureNode('output');

    // Bloom node — threshold 0.85, strength 0.6, radius 0.4
    const bloomNode = bloom(sceneColor, 0.6, 0.4, 0.85);

    // The TSL node graph is built through method chaining; the exact return
    // type is an internal ShaderNodeObject<Node> subtype. We use `Node` as
    // the declared type since RenderPipeline accepts THREE.Node.
    let outputNode: THREE.Node;

    if (this._ssaoEnabled) {
      // Use GTAONode for proper screen-space ambient occlusion.
      // GTAONode reads depth and normals from the scene pass MRT and computes
      // per-pixel occlusion using the Activision GTAO algorithm.
      const scenePassDepth = scenePass.getTextureNode('depth');
      const scenePassNormal = scenePass.getTextureNode('normal');

      const aoPass = ao(scenePassDepth, scenePassNormal, this.camera);

      // Configure GTAO parameters from our SSAO settings
      aoPass.radius.value = this._ssaoRadius;
      aoPass.scale.value = this._ssaoIntensity;

      // Get the AO texture and blend it with the scene color.
      // aoFactor is in [0, 1] where 1 = fully lit, 0 = fully occluded.
      // We mix between full brightness and the AO factor based on strength
      // to keep the effect subtle and not overpower the colormap.
      const aoTexture = aoPass.getTextureNode();
      const radiusFactor = Math.min(this._ssaoRadius / 0.5, 2.0);
      const strength = Math.min(this._ssaoIntensity * 0.4 * radiusFactor, 0.7);

      // aoMask = lerp(1.0, aoTexture, strength) = (1-strength) + strength * ao
      const aoMask = mix(float(1.0), aoTexture, float(strength));

      const aoModulated = sceneColor.mul(aoMask);
      outputNode = aoModulated.add(bloomNode);
    } else {
      // Combine scene colour with bloom additive contribution
      outputNode = sceneColor.add(bloomNode);
    }

    // RenderPipeline is the r183 replacement for PostProcessing
    this.renderPipeline = new RenderPipeline(this.renderer, outputNode);
  }

  // ---------------------------------------------------------------------------
  // Public API: HDR Environment Map toggle
  // ---------------------------------------------------------------------------

  /**
   * Enables or disables the procedural HDR environment map.
   *
   * When enabled:
   *   - A gradient cubemap is generated and applied to `scene.environment`
   *     so PBR surfaces receive image-based lighting (IBL).
   *   - The same cubemap is applied to `scene.background` at very low
   *     intensity to add spatial depth.
   *   - All PBR materials in the current mesh automatically receive IBL
   *     through `envMapIntensity` (already set per-material).
   *
   * When disabled:
   *   - `scene.environment` is set to null (pure direct-light mode).
   *   - `scene.background` reverts to the solid dark background colour.
   *   - The cubemap texture is disposed to free GPU memory.
   *
   * @param enabled   Whether to activate the environment map.
   * @param config    Optional intensity overrides.
   */
  setEnvMapEnabled(enabled: boolean, config?: HDREnvConfig): void {
    this._envMapEnabled = enabled;

    if (config?.envIntensity !== undefined) this._envIntensity = config.envIntensity;
    if (config?.backgroundIntensity !== undefined)
      this._backgroundIntensity = config.backgroundIntensity;

    const themeChanged = config?.theme !== undefined && config.theme !== this._spaceTheme;
    const resChanged =
      config?.resolution !== undefined && config.resolution !== this._cubemapResolution;

    if (config?.theme !== undefined) this._spaceTheme = config.theme;
    if (config?.resolution !== undefined) this._cubemapResolution = config.resolution;

    if (!this.scene) return;

    if (enabled) {
      if (!this.envMap || themeChanged || resChanged) {
        if (this.envMap) this.envMap.dispose();
        this.envMap = createProceduralHDRCubeMap(this._spaceTheme, this._cubemapResolution);
      }

      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = this._envIntensity;
      this.scene.background = this.envMap;
      this.scene.backgroundIntensity = this._backgroundIntensity;
      this.scene.fog = null;
    } else {
      this.scene.environment = null;
      this.scene.background = new THREE.Color(0x0d0d1a);
      this.scene.backgroundIntensity = 1.0;
      this.scene.fog = new THREE.FogExp2(0x0d0d1a, 0.002);

      if (this.envMap) {
        this.envMap.dispose();
        this.envMap = null;
      }
    }
  }

  /**
   * Returns whether the HDR environment map is currently active.
   */
  get envMapEnabled(): boolean {
    return this._envMapEnabled;
  }

  // ---------------------------------------------------------------------------
  // Public API: SSAO toggle
  // ---------------------------------------------------------------------------

  /**
   * Enables or disables Screen-Space Ambient Occlusion (SSAO).
   *
   * SSAO enhances depth perception on 3D surfaces by darkening valleys and
   * concave regions relative to exposed ridges, giving a subtle but clear
   * sense of surface curvature even in flat-lit areas.
   *
   * The effect is intentionally subtle (intensity ~1.0, radius ~0.5) to
   * avoid overwhelming the colormap-based data representation.
   *
   * Enabling or disabling SSAO rebuilds the RenderPipeline since the
   * composition graph changes.
   *
   * @param enabled   Whether to activate SSAO.
   * @param config    Optional SSAO parameter overrides.
   */
  setSsaoEnabled(enabled: boolean, config?: SSAOConfig): void {
    this._ssaoEnabled = enabled;

    if (config?.radius !== undefined) {
      this._ssaoRadius = config.radius;
    }
    if (config?.intensity !== undefined) {
      this._ssaoIntensity = config.intensity;
    }

    // Rebuild the post-processing pipeline with/without the AO node
    this.setupPostProcessing();
  }

  /**
   * Returns whether SSAO post-processing is currently active.
   */
  get ssaoEnabled(): boolean {
    return this._ssaoEnabled;
  }

  /**
   * Creates a hash of the config to detect changes.
   */
  private hashConfig(config: PlotConfig): string {
    const { type } = config;

    if (type === '3d-surface') {
      const { viewport, resolution, colorMap, wireframe } = config;
      return JSON.stringify({ type, viewport, resolution, colorMap, wireframe, fn: 'function' });
    } else if (type === '3d-parametric') {
      const { uRange, vRange, resolution, colorMap } = config;
      return JSON.stringify({ type, uRange, vRange, resolution, colorMap, functions: 'functions' });
    } else {
      const { type: _configType, ...rest } = config as
        | Plot3DCurveConfig
        | Plot3DParametricCurveConfig;
      return JSON.stringify({ type, ...rest });
    }
  }

  /**
   * Renders a plot configuration.
   * Uses caching to avoid regenerating geometry on every frame.
   */
  render(config: PlotConfig): void {
    if (!this.scene || !this.camera || !this.renderer) {
      throw new Error('Renderer not initialized');
    }

    const startTime = performance.now();

    // Check if config has changed
    const configHash = this.hashConfig(config);
    const configChanged = this.lastConfigHash !== configHash;

    if (configChanged) {
      this.lastConfigHash = configHash;

      // Remove existing mesh
      if (this.currentMesh) {
        this.scene.remove(this.currentMesh);
        this.currentMesh.geometry.dispose();
        if (Array.isArray(this.currentMesh.material)) {
          this.currentMesh.material.forEach((m) => m.dispose());
        } else {
          this.currentMesh.material.dispose();
        }
        this.currentMesh = null;
      }

      // Remove existing wireframe overlay
      if (this.currentWireframe) {
        this.scene.remove(this.currentWireframe);
        this.currentWireframe.geometry.dispose();
        if (Array.isArray(this.currentWireframe.material)) {
          this.currentWireframe.material.forEach((m) => m.dispose());
        } else {
          this.currentWireframe.material.dispose();
        }
        this.currentWireframe = null;
      }

      // Render based on plot type
      if (config.type === '3d-surface') {
        this.renderSurface(config);
      } else if (config.type === '3d-parametric') {
        this.renderParametricSurface(config);
      } else if (config.type === '3d-curve') {
        this.renderCurve(config);
      } else if (config.type === '3d-parametric-curve') {
        this.renderParametricCurve(config);
      } else {
        throw new Error(`Unsupported plot type for WebGL 3D renderer: ${config.type}`);
      }

      this.metrics.renderTime = performance.now() - startTime;
    }

    // Render through the node-based pipeline (or direct if not available)
    if (this.renderPipeline) {
      this.renderPipeline.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.updateFPS();
  }

  /**
   * Renders a 3D surface plot z = f(x, y).
   *
   * Wireframe mode uses a two-object approach:
   *   1. The solid surface mesh rendered with reduced opacity so the shape
   *      remains visible.
   *   2. A separate LineSegments overlay built from WireframeGeometry, using
   *      MeshBasicMaterial (unlit, immune to bloom darkening) so the
   *      wireframe edges are always the intended bright colour.
   */
  private renderSurface(config: Plot3DSurfaceConfig): void {
    if (!this.scene) return;

    const { fn, viewport, resolution, colorMap, wireframe } = config;

    const xRes = resolution.x;
    const yRes = resolution.y;
    const vertexCount = (xRes + 1) * (yRes + 1);

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);

    const xMin = viewport.xMin;
    const xMax = viewport.xMax;
    const yMin = viewport.yMin;
    const yMax = viewport.yMax;
    const dx = (xMax - xMin) / xRes;
    const dy = (yMax - yMin) / yRes;

    let zMin = Infinity;
    let zMax = -Infinity;

    // First pass: compute positions and find z range
    let idx = 0;
    for (let i = 0; i <= xRes; i++) {
      for (let j = 0; j <= yRes; j++) {
        const x = xMin + i * dx;
        const y = yMin + j * dy;

        let z = 0;
        try {
          z = fn(x, y);
          if (!Number.isFinite(z)) {
            z = 0;
          } else {
            zMin = Math.min(zMin, z);
            zMax = Math.max(zMax, z);
          }
        } catch {
          z = 0;
        }

        // Store position (THREE.js uses y-up; our math Z maps to THREE Y)
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = z;
        positions[idx * 3 + 2] = y;
        idx++;
      }
    }

    // Second pass: assign colors based on z range
    if (colorMap) {
      const zRange = zMax - zMin;
      for (let i = 0; i < vertexCount; i++) {
        const z = positions[i * 3 + 1] ?? 0;
        const t = zRange > 0 ? (z - zMin) / zRange : 0.5;
        const color = getColorFromMap(colorMap, t);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
    } else {
      for (let i = 0; i < vertexCount; i++) {
        colors[i * 3] = 0.4;
        colors[i * 3 + 1] = 0.6;
        colors[i * 3 + 2] = 0.9;
      }
    }

    // Reuse the index buffer when the grid resolution hasn't changed,
    // since the triangle topology is purely a function of xRes/yRes.
    const gridKey = `${xRes}x${yRes}`;
    let indexAttr: THREE.BufferAttribute;
    if (this.lastSurfaceGridKey === gridKey && this.cachedIndexBuffer) {
      indexAttr = this.cachedIndexBuffer;
    } else {
      const indices = new Uint32Array(xRes * yRes * 6);
      let idxPtr = 0;
      for (let i = 0; i < xRes; i++) {
        for (let j = 0; j < yRes; j++) {
          const a = i * (yRes + 1) + j;
          const b = a + yRes + 1;
          const c = a + 1;
          const d = b + 1;

          indices[idxPtr++] = a;
          indices[idxPtr++] = b;
          indices[idxPtr++] = c;
          indices[idxPtr++] = c;
          indices[idxPtr++] = b;
          indices[idxPtr++] = d;
        }
      }
      indexAttr = new THREE.BufferAttribute(indices, 1);
      this.cachedIndexBuffer = indexAttr;
      this.lastSurfaceGridKey = gridKey;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indexAttr);
    geometry.computeVertexNormals();

    if (wireframe) {
      // --- Wireframe mode ---
      // Keep a ghost surface (very low opacity) so the form reads spatially,
      // then overlay per-vertex-colored LineSegments driven by the same
      // colormap as the solid surface.
      const surfaceMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: false,
        metalness: 0.1,
        roughness: 0.8,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
      });

      this.currentMesh = new THREE.Mesh(geometry, surfaceMaterial);
      this.currentMesh.castShadow = false;
      this.currentMesh.receiveShadow = false;
      this.scene.add(this.currentMesh);

      // Build the wireframe geometry from the surface geometry.
      // WireframeGeometry reindexes vertices so we must re-map colors onto
      // those new positions by looking up each position's z-value (stored in
      // the y-component of THREE.js's y-up coordinate system).
      const wireGeometry = new THREE.WireframeGeometry(geometry);

      // WireframeGeometry.attributes.position mirrors the source geometry's
      // layout — we can derive z (=THREE Y) per vertex and re-color.
      const wirePosAttr = wireGeometry.attributes['position'] as THREE.BufferAttribute;
      const wireVertexCount = wirePosAttr.count;
      const wireColors = new Float32Array(wireVertexCount * 3);

      if (colorMap) {
        const zRange = zMax - zMin;
        for (let i = 0; i < wireVertexCount; i++) {
          // In our scene y-up layout, the math z maps to THREE Y
          const zVal = wirePosAttr.getY(i);
          const t = zRange > 0 ? (zVal - zMin) / zRange : 0.5;
          const c = getColorFromMap(colorMap, Math.max(0, Math.min(1, t)));
          wireColors[i * 3] = c.r;
          wireColors[i * 3 + 1] = c.g;
          wireColors[i * 3 + 2] = c.b;
        }
      } else {
        // No colormap: use a soft cyan so the wireframe is still attractive
        for (let i = 0; i < wireVertexCount; i++) {
          wireColors[i * 3] = 0.53;
          wireColors[i * 3 + 1] = 0.93;
          wireColors[i * 3 + 2] = 1.0;
        }
      }

      wireGeometry.setAttribute('color', new THREE.BufferAttribute(wireColors, 3));

      const wireMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
      });

      const wireLines = new THREE.LineSegments(wireGeometry, wireMaterial);
      this.currentWireframe = wireLines;
      this.scene.add(wireLines);
    } else {
      // --- Solid surface mode ---
      if (this.currentWireframe) {
        this.scene.remove(this.currentWireframe);
        this.currentWireframe.geometry.dispose();
        if (Array.isArray(this.currentWireframe.material)) {
          this.currentWireframe.material.forEach((m) => m.dispose());
        } else {
          this.currentWireframe.material.dispose();
        }
        this.currentWireframe = null;
      }

      const material = new THREE.MeshStandardMaterial({
        vertexColors: !!colorMap,
        side: THREE.DoubleSide,
        flatShading: false,
        metalness: 0.2,
        roughness: 0.6,
        envMapIntensity: 1.0,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
      });

      this.currentMesh = new THREE.Mesh(geometry, material);
      this.currentMesh.castShadow = true;
      this.currentMesh.receiveShadow = true;
      this.scene.add(this.currentMesh);
    }

    this.metrics.pointCount = vertexCount;
  }

  /**
   * Renders a parametric surface.
   */
  private renderParametricSurface(config: Plot3DParametricSurfaceConfig): void {
    if (!this.scene) return;

    const { functions, uRange, vRange, resolution, colorMap } = config;

    const uRes = resolution.u;
    const vRes = resolution.v;
    const vertexCount = (uRes + 1) * (vRes + 1);

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(uRes * vRes * 6);

    const du = (uRange.max - uRange.min) / uRes;
    const dv = (vRange.max - vRange.min) / vRes;

    let vIdx = 0;
    for (let i = 0; i <= uRes; i++) {
      for (let j = 0; j <= vRes; j++) {
        const u = uRange.min + i * du;
        const v = vRange.min + j * dv;

        try {
          const x = functions.x(u, v);
          const y = functions.y(u, v);
          const z = functions.z(u, v);

          if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
            positions[vIdx * 3] = x;
            positions[vIdx * 3 + 1] = z; // THREE.js y-up
            positions[vIdx * 3 + 2] = y;

            if (colorMap) {
              const t = (u - uRange.min) / (uRange.max - uRange.min);
              const color = getColorFromMap(colorMap, t);
              colors[vIdx * 3] = color.r;
              colors[vIdx * 3 + 1] = color.g;
              colors[vIdx * 3 + 2] = color.b;
            } else {
              colors[vIdx * 3] = 0.4;
              colors[vIdx * 3 + 1] = 0.6;
              colors[vIdx * 3 + 2] = 0.9;
            }
          } else {
            positions[vIdx * 3] = 0;
            positions[vIdx * 3 + 1] = 0;
            positions[vIdx * 3 + 2] = 0;
            colors[vIdx * 3] = 1;
            colors[vIdx * 3 + 1] = 0;
            colors[vIdx * 3 + 2] = 0;
          }
        } catch {
          positions[vIdx * 3] = 0;
          positions[vIdx * 3 + 1] = 0;
          positions[vIdx * 3 + 2] = 0;
          colors[vIdx * 3] = 1;
          colors[vIdx * 3 + 1] = 0;
          colors[vIdx * 3 + 2] = 0;
        }
        vIdx++;
      }
    }

    let idxPtr = 0;
    for (let i = 0; i < uRes; i++) {
      for (let j = 0; j < vRes; j++) {
        const a = i * (vRes + 1) + j;
        const b = a + vRes + 1;
        const c = a + 1;
        const d = b + 1;

        indices[idxPtr++] = a;
        indices[idxPtr++] = b;
        indices[idxPtr++] = c;
        indices[idxPtr++] = c;
        indices[idxPtr++] = b;
        indices[idxPtr++] = d;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: !!colorMap,
      side: THREE.DoubleSide,
      flatShading: false,
      metalness: 0.3,
      roughness: 0.5,
      envMapIntensity: 1.2,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0.0,
    });

    this.currentMesh = new THREE.Mesh(geometry, material);
    this.currentMesh.castShadow = true;
    this.currentMesh.receiveShadow = true;
    this.scene.add(this.currentMesh);

    this.metrics.pointCount = vertexCount;
  }

  /**
   * Renders a 3D parametric curve (legacy support).
   */
  private renderCurve(config: Plot3DCurveConfig): void {
    if (!this.scene) return;

    const { functions, tRange, style } = config;

    const samples = 1000;
    const dt = (tRange.max - tRange.min) / samples;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = tRange.min + i * dt;

      try {
        const x = functions.x(t);
        const y = functions.y(t);
        const z = functions.z(t);

        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          points.push(new THREE.Vector3(x, z, y)); // THREE.js y-up
        }
      } catch {
        // Skip invalid points
      }
    }

    if (points.length < 2) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
      color: 0x2563eb,
      linewidth: style?.line?.width ?? 2,
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    // Track the line so it gets disposed on the next config change
    this.currentMesh = line ;

    this.metrics.pointCount = points.length;
  }

  /**
   * Renders a 3D parametric curve with optional tube geometry.
   */
  private renderParametricCurve(config: Plot3DParametricCurveConfig): void {
    if (!this.scene) return;

    const { functions, tRange, samples = 1000, style } = config;

    const dt = (tRange.max - tRange.min) / samples;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = tRange.min + i * dt;

      try {
        const x = functions.x(t);
        const y = functions.y(t);
        const z = functions.z(t);

        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          points.push(new THREE.Vector3(x, z, y)); // THREE.js y-up
        }
      } catch {
        // Skip invalid points
      }
    }

    if (points.length < 2) return;

    this.metrics.pointCount = points.length;

    if (style?.tube?.enabled) {
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeRadius = style.tube.radius ?? 0.05;
      const radialSegments = style.tube.radialSegments ?? 8;

      const geometry = new THREE.TubeGeometry(curve, samples, tubeRadius, radialSegments, false);

      const color = style.line?.color ?? '#2563eb';
      const colorHex =
        typeof color === 'string' && color.startsWith('#')
          ? parseInt(color.substring(1), 16)
          : 0x2563eb;

      const material = new THREE.MeshStandardMaterial({
        color: colorHex,
        metalness: 0.1,
        roughness: 0.6,
      });

      const tube = new THREE.Mesh(geometry, material);
      this.scene.add(tube);

      if (this.currentMesh) {
        this.scene.remove(this.currentMesh);
        this.currentMesh.geometry.dispose();
        if (Array.isArray(this.currentMesh.material)) {
          this.currentMesh.material.forEach((m) => m.dispose());
        } else {
          this.currentMesh.material.dispose();
        }
      }
      this.currentMesh = tube;
    } else {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      const color = style?.line?.color ?? '#2563eb';
      const colorHex =
        typeof color === 'string' && color.startsWith('#')
          ? parseInt(color.substring(1), 16)
          : 0x2563eb;

      const material = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: style?.line?.width ?? 2,
      });

      const line = new THREE.Line(geometry, material);
      this.scene.add(line);

      if (this.currentMesh) {
        this.scene.remove(this.currentMesh);
        this.currentMesh.geometry.dispose();
        if (Array.isArray(this.currentMesh.material)) {
          this.currentMesh.material.forEach((m) => m.dispose());
        } else {
          this.currentMesh.material.dispose();
        }
      }
      // Cast to Mesh for compatibility with the tracking field type
      this.currentMesh = line ;
    }
  }

  /**
   * Updates the FPS counter.
   */
  private updateFPS(): void {
    this.frameCount++;
    const now = performance.now();

    if (now - this.fpsUpdateTime >= 1000) {
      this.metrics.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }

    if (this.lastFrameTime > 0) {
      this.metrics.frameTime = now - this.lastFrameTime;
    }
    this.lastFrameTime = now;
  }

  /**
   * Resizes the renderer.
   * Note: RenderPipeline does not expose setSize — the WebGPURenderer's
   * own setSize is sufficient as the pipeline reads the renderer's canvas size.
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Disposes the renderer and frees resources.
   */
  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.currentMesh) {
      this.scene?.remove(this.currentMesh);
      this.currentMesh.geometry.dispose();
      const mat = this.currentMesh.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else {
        mat.dispose();
      }
      this.currentMesh = null;
    }

    if (this.currentWireframe) {
      this.scene?.remove(this.currentWireframe);
      this.currentWireframe.geometry.dispose();
      if (Array.isArray(this.currentWireframe.material)) {
        this.currentWireframe.material.forEach((m) => m.dispose());
      } else {
        this.currentWireframe.material.dispose();
      }
      this.currentWireframe = null;
    }

    // Dispose axis label sprites (canvas textures need explicit disposal)
    if (this.axisLabelGroup) {
      this.scene?.remove(this.axisLabelGroup);
      this.axisLabelGroup.traverse((child) => {
        if (child instanceof THREE.Sprite) {
          child.material.map?.dispose();
          child.material.dispose();
        }
      });
      this.axisLabelGroup = null;
    }

    // Traverse the entire scene and dispose all remaining geometries,
    // materials, and textures (lights, grid helper, axes helper, etc.)
    if (this.scene) {
      this.scene.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              m.map?.dispose();
              m.dispose();
            });
          } else {
            child.material.map?.dispose();
            child.material.dispose();
          }
        } else if (child instanceof THREE.Sprite) {
          child.material.map?.dispose();
          child.material.dispose();
        }
      });

      // Remove all children from the scene
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]!);
      }
    }

    // Dispose cached axis label textures
    this.axisLabelTextureCache.forEach((tex) => tex.dispose());
    this.axisLabelTextureCache.clear();

    // Dispose procedural environment cubemap
    if (this.envMap) {
      this.envMap.dispose();
      this.envMap = null;
    }

    // Dispose node-based post-processing pipeline
    if (this.renderPipeline) {
      this.renderPipeline.dispose();
      this.renderPipeline = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.directionalLight = null;
    this.cachedIndexBuffer = null;
    this.lastSurfaceGridKey = null;
    this.lastConfigHash = null;
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  /**
   * Gets performance metrics.
   */
  getMetrics(): PerformanceMetrics {
    if (this.renderer) {
      // info.render.calls is the same API on both WebGLRenderer and
      // WebGPURenderer (inherited from the common Renderer base class)
      this.metrics.drawCalls = this.renderer.info.render.calls;
    }

    this.metrics.memoryUsage = getJSHeapUsage();

    return { ...this.metrics };
  }

  /**
   * Gets the camera for external control (e.g., OrbitControls).
   */
  getCamera(): THREE.Camera | null {
    return this.camera;
  }

  /**
   * Gets the scene for adding custom objects.
   */
  getScene(): THREE.Scene | null {
    return this.scene;
  }

  /**
   * Gets the Three.js renderer instance.
   * Returns WebGPURenderer which covers both GPU and WebGL fallback paths.
   */
  getThreeRenderer(): WebGPURenderer | null {
    return this.renderer;
  }
}
