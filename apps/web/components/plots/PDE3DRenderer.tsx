'use client';

/**
 * PDE3DRenderer
 *
 * Three.js-based 3D renderer for PDE scalar fields. Supports three
 * render modes:
 *
 * 1. Isosurface  - Marching Cubes mesh with MeshPhysicalMaterial
 * 2. Slice Planes - Three orthogonal planes with DataTexture colormaps
 * 3. Point Cloud  - Per-point colored points with size attenuation
 *
 * Uses standard WebGLRenderer for maximum browser compatibility.
 *
 * @module components/plots/PDE3DRenderer
 */

import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type ColormapName, getColor } from '@/lib/solvers/colormaps';
import { marchingCubes } from '@/lib/solvers/marching-cubes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RenderMode = 'isosurface' | 'slices' | 'pointcloud';

export interface PDE3DRendererProps {
  /** Flat scalar field of size gridSize^3 */
  scalarField: Float32Array;
  /** Number of grid points per dimension */
  gridSize: number;
  /** Visualization mode */
  renderMode: RenderMode;
  /** Isovalue for Marching Cubes (used only in isosurface mode) */
  isovalue: number;
  /** Slice positions [x, y, z] normalized to [0, 1] (used only in slices mode) */
  slicePositions: [number, number, number];
  /** Colormap name */
  colormap: ColormapName;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the min and max values in the scalar field */
function fieldRange(field: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < field.length; i++) {
    const v = field[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  return { min, max };
}

/** Flat index into NxNxN grid */
function idx(i: number, j: number, k: number, N: number): number {
  return i * N * N + j * N + k;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PDE3DRenderer({
  scalarField,
  gridSize,
  renderMode,
  isovalue,
  slicePositions,
  colormap,
}: PDE3DRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  // -------------------------------------------------------------------
  // Scene initialization (runs once)
  // -------------------------------------------------------------------
  const initScene = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(gridSize * 1.2, gridSize * 1.0, gridSize * 1.2);
    camera.lookAt(gridSize / 2, gridSize / 2, gridSize / 2);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(gridSize / 2, gridSize / 2, gridSize / 2);
    controls.minDistance = gridSize * 0.3;
    controls.maxDistance = gridSize * 4;
    controls.update();
    controlsRef.current = controls;

    // Lights
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);

    const warmLight = new THREE.DirectionalLight(0xffe0c0, 1.0);
    warmLight.position.set(gridSize * 2, gridSize * 3, gridSize * 2);
    scene.add(warmLight);

    const coolLight = new THREE.DirectionalLight(0xc0e0ff, 0.6);
    coolLight.position.set(-gridSize, gridSize * 2, -gridSize);
    scene.add(coolLight);

    // Grid + axes helpers
    const gridHelper = new THREE.GridHelper(gridSize, 8, 0x333355, 0x222244);
    gridHelper.position.set(gridSize / 2, 0, gridSize / 2);
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(gridSize * 0.4);
    scene.add(axesHelper);

    // Mesh group (will be rebuilt on data changes)
    const group = new THREE.Group();
    scene.add(group);
    meshGroupRef.current = group;

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }
      }
    });
    resizeObserver.observe(container);

    // Cleanup reference for later
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [gridSize]);

  // -------------------------------------------------------------------
  // Initialize scene on mount, cleanup on unmount
  // -------------------------------------------------------------------
  useEffect(() => {
    const cleanup = initScene();
    return () => {
      cleanup?.();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      meshGroupRef.current = null;
    };
  }, [initScene]);

  // -------------------------------------------------------------------
  // Rebuild mesh when data / mode / parameters change
  // -------------------------------------------------------------------
  useEffect(() => {
    const group = meshGroupRef.current;
    if (!group) return;

    // Dispose old children
    while (group.children.length > 0) {
      const child = group.children[0]!;
      group.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose();
            m.dispose();
          });
        } else {
          if ('map' in mat && mat.map instanceof THREE.Texture) mat.map.dispose();
          mat.dispose();
        }
      }
    }

    if (scalarField.length === 0) return;

    const N = gridSize;
    const range = fieldRange(scalarField);

    if (renderMode === 'isosurface') {
      buildIsosurface(group, scalarField, N, isovalue, range);
    } else if (renderMode === 'slices') {
      buildSlicePlanes(group, scalarField, N, slicePositions, range, colormap);
    } else {
      buildPointCloud(group, scalarField, N, range, colormap);
    }
  }, [scalarField, gridSize, renderMode, isovalue, slicePositions, colormap]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
      style={{ touchAction: 'none' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Isosurface builder
// ---------------------------------------------------------------------------

function buildIsosurface(
  group: THREE.Group,
  field: Float32Array,
  N: number,
  isovalue: number,
  range: { min: number; max: number },
): void {
  // Map the user's 0-1 isovalue to the actual field range
  const mappedIso = range.min + isovalue * (range.max - range.min);
  const result = marchingCubes(field, N, mappedIso);

  if (result.vertexCount === 0) return;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(result.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(result.normals, 3));

  const material = new THREE.MeshPhysicalMaterial({
    color: 0x6688ff,
    transmission: 0.3,
    ior: 1.5,
    iridescence: 0.3,
    iridescenceIOR: 1.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    metalness: 0.1,
    roughness: 0.15,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });

  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
}

// ---------------------------------------------------------------------------
// Slice planes builder
// ---------------------------------------------------------------------------

function buildSlicePlanes(
  group: THREE.Group,
  field: Float32Array,
  N: number,
  positions: [number, number, number],
  range: { min: number; max: number },
  colormap: ColormapName,
): void {
  const [sx, sy, sz] = positions;

  // XY slice (constant Z)
  const kSlice = Math.max(0, Math.min(N - 1, Math.round(sz * (N - 1))));
  createSliceMesh(group, field, N, range, colormap, 'xy', kSlice);

  // XZ slice (constant Y)
  const jSlice = Math.max(0, Math.min(N - 1, Math.round(sy * (N - 1))));
  createSliceMesh(group, field, N, range, colormap, 'xz', jSlice);

  // YZ slice (constant X)
  const iSlice = Math.max(0, Math.min(N - 1, Math.round(sx * (N - 1))));
  createSliceMesh(group, field, N, range, colormap, 'yz', iSlice);
}

function createSliceMesh(
  group: THREE.Group,
  field: Float32Array,
  N: number,
  range: { min: number; max: number },
  colormap: ColormapName,
  plane: 'xy' | 'xz' | 'yz',
  sliceIdx: number,
): void {
  const texSize = N;
  const data = new Uint8Array(texSize * texSize * 4);

  for (let a = 0; a < texSize; a++) {
    for (let b = 0; b < texSize; b++) {
      let value: number;
      if (plane === 'xy') {
        value = field[idx(a, b, sliceIdx, N)]!;
      } else if (plane === 'xz') {
        value = field[idx(a, sliceIdx, b, N)]!;
      } else {
        value = field[idx(sliceIdx, a, b, N)]!;
      }

      const t = range.max !== range.min ? (value - range.min) / (range.max - range.min) : 0.5;
      const [r, g, bl] = getColor(t, colormap);
      const pixelIdx = (b * texSize + a) * 4;
      data[pixelIdx] = Math.round(r * 255);
      data[pixelIdx + 1] = Math.round(g * 255);
      data[pixelIdx + 2] = Math.round(bl * 255);
      data[pixelIdx + 3] = 200; // Slightly transparent
    }
  }

  const texture = new THREE.DataTexture(data, texSize, texSize);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const geometry = new THREE.PlaneGeometry(N, N);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });

  const mesh = new THREE.Mesh(geometry, material);

  const center = N / 2;
  if (plane === 'xy') {
    mesh.position.set(center, center, sliceIdx);
  } else if (plane === 'xz') {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center, sliceIdx, center);
  } else {
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(sliceIdx, center, center);
  }

  group.add(mesh);
}

// ---------------------------------------------------------------------------
// Point cloud builder
// ---------------------------------------------------------------------------

function buildPointCloud(
  group: THREE.Group,
  field: Float32Array,
  N: number,
  range: { min: number; max: number },
  colormap: ColormapName,
): void {
  // For performance, subsample large grids
  const step = N > 64 ? 2 : 1;
  const positions: number[] = [];
  const colors: number[] = [];

  for (let i = 0; i < N; i += step) {
    for (let j = 0; j < N; j += step) {
      for (let k = 0; k < N; k += step) {
        const value = field[idx(i, j, k, N)]!;
        const t = range.max !== range.min ? (value - range.min) / (range.max - range.min) : 0.5;

        // Skip very low values for visual clarity
        if (t < 0.05) continue;

        positions.push(i, j, k);
        const [r, g, b] = getColor(t, colormap);
        colors.push(r, g, b);
      }
    }
  }

  if (positions.length === 0) return;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: step > 1 ? 1.5 : 0.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  group.add(points);
}
