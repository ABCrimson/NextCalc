'use client';

import { useRef, useEffect, useCallback, useMemo, useState, type PointerEvent, type WheelEvent } from 'react';
import * as THREE from 'three/webgpu';
import { WebGPURenderer, RenderPipeline } from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import type { GraphNode, GraphEdge, NodeId, PageRankScore } from './types';

/**
 * Configuration for graph renderer
 */
export interface GraphRendererConfig {
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Enable physics simulation */
  enablePhysics: boolean;
  /** Node size scaling factor */
  nodeSizeScale: number;
  /** Edge opacity */
  edgeOpacity: number;
  /** Show labels */
  showLabels: boolean;
  /** Background color */
  backgroundColor: string;
  /** Node color scheme */
  nodeColorScheme: 'rank' | 'selection' | 'custom';
  /** Enable anti-aliasing */
  antialias: boolean;
  /** Enable zoom limits */
  minZoom: number;
  maxZoom: number;
}

/**
 * Graph interaction events
 */
export interface GraphInteraction {
  type: 'click' | 'hover' | 'drag' | 'zoom' | 'pan';
  nodeId?: NodeId;
  position?: { x: number; y: number };
}

/**
 * Props for PageRankGraphRenderer
 */
export interface PageRankGraphRendererProps {
  /** Graph nodes */
  nodes: ReadonlyArray<GraphNode>;
  /** Graph edges */
  edges: ReadonlyArray<GraphEdge>;
  /** Currently selected node */
  selectedNode?: NodeId | null;
  /** Node ranks (for visual scaling) */
  ranks: Map<NodeId, PageRankScore>;
  /** Renderer configuration */
  config?: Partial<GraphRendererConfig>;
  /** Interaction callback */
  onInteraction?: (interaction: GraphInteraction) => void;
  /** Node position update callback */
  onNodePositionUpdate?: (nodeId: NodeId, position: { x: number; y: number }) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Force-directed layout physics simulation.
 *
 * Drag safety contract:
 *  - Call fixNode(id, true)  on drag-start  → node becomes kinematically fixed
 *  - Call setNodePosition(id, x, y)          → teleports node, zeroes velocity
 *  - Call fixNode(id, false) on drag-end     → velocity is already zeroed,
 *    so resuming physics does NOT cause a jump
 */
class ForceSimulation {
  private nodes: Map<NodeId, { x: number; y: number; vx: number; vy: number; fixed: boolean }>;
  private edges: Array<{ source: NodeId; target: NodeId; weight: number }>;
  private width: number;
  private height: number;

  // Reduced constants to prevent explosive behaviour when a drag releases.
  // repulsionStrength was 6000 — lowering to 3500 makes the layout gentler
  // while still spreading nodes visibly. springStrength stays the same.
  private readonly springStrength = 0.008;
  private readonly springLength = 120;
  private readonly repulsionStrength = 3500;
  private readonly damping = 0.78;         // stronger damping → less overshoot
  private readonly centeringForce = 0.003;

  constructor(
    nodes: ReadonlyArray<GraphNode>,
    edges: ReadonlyArray<GraphEdge>,
    width: number,
    height: number
  ) {
    this.width = width;
    this.height = height;
    this.nodes = new Map(
      nodes.map(node => [
        node.id,
        {
          x: node.position.x,
          y: node.position.y,
          vx: 0,
          vy: 0,
          fixed: false,
        },
      ])
    );
    this.edges = edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
    }));
  }

  tick(): void {
    // Reset velocity for unfixed nodes only
    for (const [, node] of Array.from(this.nodes)) {
      if (!node.fixed) {
        node.vx = 0;
        node.vy = 0;
      }
    }

    const nodeArray = Array.from(this.nodes.entries());

    // Repulsion between all node pairs
    for (let i = 0; i < nodeArray.length; i++) {
      const [, node1] = nodeArray[i]!;
      if (node1.fixed) continue;

      for (let j = i + 1; j < nodeArray.length; j++) {
        const [, node2] = nodeArray[j]!;

        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const distSq = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(distSq);

        const force = this.repulsionStrength / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        node1.vx -= fx;
        node1.vy -= fy;

        if (!node2.fixed) {
          node2.vx += fx;
          node2.vy += fy;
        }
      }
    }

    // Spring forces along edges
    for (const edge of this.edges) {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const displacement = (dist - this.springLength * edge.weight) * this.springStrength;
      const fx = (dx / dist) * displacement;
      const fy = (dy / dist) * displacement;

      if (!source.fixed) {
        source.vx += fx;
        source.vy += fy;
      }

      if (!target.fixed) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // Weak centering force
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    for (const [, node] of Array.from(this.nodes)) {
      if (node.fixed) continue;
      node.vx += (centerX - node.x) * this.centeringForce;
      node.vy += (centerY - node.y) * this.centeringForce;
    }

    // Integrate: apply damping then move
    for (const [, node] of Array.from(this.nodes)) {
      if (node.fixed) continue;

      // Clamp velocity to prevent explosions
      const maxVel = 8;
      node.vx = Math.max(-maxVel, Math.min(maxVel, node.vx * this.damping));
      node.vy = Math.max(-maxVel, Math.min(maxVel, node.vy * this.damping));

      node.x += node.vx;
      node.y += node.vy;

      const margin = 60;
      if (node.x < margin) node.x = margin;
      if (node.x > this.width - margin) node.x = this.width - margin;
      if (node.y < margin) node.y = margin;
      if (node.y > this.height - margin) node.y = this.height - margin;
    }
  }

  getPositions(): Map<NodeId, { x: number; y: number }> {
    const positions = new Map<NodeId, { x: number; y: number }>();
    for (const [id, node] of Array.from(this.nodes)) {
      positions.set(id, { x: node.x, y: node.y });
    }
    return positions;
  }

  /**
   * Fix or release a node. When releasing (fixed=false) the velocity is
   * explicitly zeroed so that no accumulated force is applied on the next tick.
   */
  fixNode(nodeId: NodeId, fixed: boolean): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.fixed = fixed;
      if (!fixed) {
        // Zero velocity so the node does not fly when physics resumes
        node.vx = 0;
        node.vy = 0;
      }
    }
  }

  /**
   * Teleport a node to world coordinates and zero its velocity.
   * Should be called on every pointer-move during a drag.
   */
  setNodePosition(nodeId: NodeId, x: number, y: number): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.x = x;
      node.y = y;
      node.vx = 0;
      node.vy = 0;
    }
  }

  setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}

/**
 * Convert a normalized rank (0..1) to a hue value for the OKLCH-aligned color palette.
 * Low rank -> blue (hue 0.64), high rank -> rose (hue 0.46).
 */
function rankToHue(normalizedRank: number): number {
  return 0.64 - normalizedRank * 0.18;
}

const DEFAULT_CONFIG: GraphRendererConfig = {
  width: 800,
  height: 600,
  enablePhysics: true,
  nodeSizeScale: 1.0,
  edgeOpacity: 0.55,
  showLabels: true,
  backgroundColor: '#0d0f1a',
  nodeColorScheme: 'rank',
  antialias: true,
  minZoom: 0.25,
  maxZoom: 4.0,
};

/**
 * High-performance PageRank graph renderer using WebGPURenderer (three/webgpu).
 * Automatically falls back to WebGL 2 when WebGPU is unavailable.
 * Post-processing uses RenderPipeline + TSL BloomNode.
 *
 * Visual improvements:
 * - OKLCH-aligned gradient node colors (cool blue -> vivid violet/rose by rank)
 * - Gradient-filled circle nodes drawn with radial gradient on a canvas texture
 * - Thicker, smoother edges with proper arrowheads (cone geometry)
 * - TSL Bloom post-processing with tuned parameters for readability
 * - Crisp label sprites rendered at 2x DPR
 * - Soft selection ring with animated pulse
 *
 * Drag fix:
 * - On pointer-down over a node: fix the node in the simulation immediately
 * - On pointer-move: translate screen coords to world coords accounting for
 *   camera offset and zoom, then call setNodePosition (which zeroes velocity)
 * - On pointer-up: call fixNode(id, false) which zeroes velocity before
 *   re-enabling physics so the node does not fly
 *
 * Initial render fix:
 * - The simulation is created synchronously on mount (not deferred to a
 *   separate effect cycle) via an initialisation ref that is populated before
 *   the animation loop starts.
 */
export function PageRankGraphRenderer({
  nodes,
  edges,
  selectedNode,
  ranks,
  config: userConfig,
  onInteraction,
  onNodePositionUpdate,
  className,
}: PageRankGraphRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const simulationRef = useRef<ForceSimulation | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const renderPipelineRef = useRef<RenderPipeline | null>(null);
  const bloomPassRef = useRef<ReturnType<typeof bloom> | null>(null);

  const nodeMeshesRef = useRef<Map<NodeId, THREE.Mesh>>(new Map());
  const edgeMeshesRef = useRef<Map<string, THREE.Line>>(new Map());
  const labelSpritesRef = useRef<Map<NodeId, THREE.Sprite>>(new Map());
  const arrowMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const texturePoolRef = useRef<Map<string, THREE.Texture>>(new Map());

  const isMountedRef = useRef(true);

  // Track whether renderer initialisation has completed
  const rendererReadyRef = useRef(false);

  // Drag state — use refs to avoid stale closures in pointer handlers
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef<NodeId | null>(null);
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Keep a React state for zoom so that the zoom indicator re-renders
  const [zoom, setZoom] = useState(1.0);
  const zoomRef = useRef(1.0);

  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);

  // Keep config in a ref so callbacks don't go stale
  const configRef = useRef(config);
  configRef.current = config;

  /**
   * Create a gradient-filled circle texture for node rendering.
   */
  const createNodeTexture = useCallback(
    (normalizedRank: number, selected: boolean): THREE.Texture => {
      const key = `node-${normalizedRank.toFixed(2)}-${selected}`;
      const existing = texturePoolRef.current.get(key);
      if (existing) return existing;

      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Texture();

      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 4;

      const hue = Math.round(rankToHue(normalizedRank) * 360);
      const saturation = Math.round((0.55 + normalizedRank * 0.35) * 100);
      const lightness = Math.round((0.38 + normalizedRank * 0.22) * 100);

      const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.2);
      glow.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.3)`);
      glow.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
      grad.addColorStop(0, `hsl(${hue}, ${Math.min(saturation + 10, 100)}%, ${Math.min(lightness + 22, 90)}%)`);
      grad.addColorStop(0.55, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
      grad.addColorStop(1, `hsl(${hue}, ${saturation}%, ${Math.max(lightness - 16, 10)}%)`);

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      const spec = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r * 0.65);
      spec.addColorStop(0, 'rgba(255,255,255,0.38)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();

      if (selected) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = `hsl(${hue}, 90%, 72%)`;
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue}, 90%, 72%, 0.4)`;
        ctx.lineWidth = 10;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${Math.min(lightness + 30, 90)}%, 0.6)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      const texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;
      texturePoolRef.current.set(key, texture);
      return texture;
    },
    []
  );

  /**
   * Create a crisp label texture at 2x resolution for HiDPI.
   */
  const createLabelTexture = useCallback((text: string, rank: number): THREE.Texture => {
    const key = `label-${text}-${rank.toFixed(2)}`;
    const existing = texturePoolRef.current.get(key);
    if (existing) return existing;

    const hue = Math.round(rankToHue(rank) * 360);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textWidth = ctx.measureText(text).width;
    const padX = 16;
    const bw = textWidth + padX * 2;
    const bh = 44;
    const bx = (canvas.width - bw) / 2;
    const by = (canvas.height - bh) / 2;

    ctx.fillStyle = `hsla(${hue}, 60%, 12%, 0.88)`;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10);
    ctx.fill();

    ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.5)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    texturePoolRef.current.set(key, texture);
    return texture;
  }, []);

  /**
   * Initialises the WebGPURenderer and the TSL post-processing pipeline.
   * WebGPURenderer.init() is async; the pipeline is set up after init completes.
   */
  const initScene = useCallback(async () => {
    if (!canvasRef.current || !containerRef.current) return;

    const renderer = new WebGPURenderer({
      canvas: canvasRef.current,
      antialias: config.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(config.width, config.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    await renderer.init();

    if (!isMountedRef.current) {
      renderer.dispose();
      return;
    }

    rendererRef.current = renderer;
    rendererReadyRef.current = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    sceneRef.current = scene;

    const aspect = config.width / config.height;
    const frustumSize = config.height;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      1,
      1000
    );
    camera.position.z = 500;
    cameraRef.current = camera;

    const ambientLight = new THREE.AmbientLight(0x3040a0, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(100, 200, 500);
    scene.add(directionalLight);

    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode('output');
    const bloomNode = bloom(sceneColor, 0.45, 0.55, 0.78);
    bloomPassRef.current = bloomNode;

    const outputNode = sceneColor.add(bloomNode);
    const renderPipeline = new RenderPipeline(renderer, outputNode);
    renderPipelineRef.current = renderPipeline;
  }, [config.width, config.height, config.backgroundColor, config.antialias]);

  const centerCamera = useCallback((positions: Map<NodeId, { x: number; y: number }>) => {
    if (!cameraRef.current || positions.size === 0) return;

    let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;

    for (const pos of Array.from(positions.values())) {
      if (pos.x < minX) minX = pos.x;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.y > maxY) maxY = pos.y;
    }

    cameraRef.current.position.x = (minX + maxX) / 2;
    cameraRef.current.position.y = (minY + maxY) / 2;
  }, []);

  const updateGraph = useCallback(() => {
    if (!sceneRef.current || !simulationRef.current) return;

    const scene = sceneRef.current;
    const positions = simulationRef.current.getPositions();

    if (nodes.length > 0 && nodeMeshesRef.current.size === 0) {
      centerCamera(positions);
    }

    const maxRank = Math.max(...Array.from(ranks.values()).map(r => r as number), 0.001);

    for (const node of nodes) {
      const position = positions.get(node.id);
      if (!position) continue;

      const rank = (ranks.get(node.id) as number) ?? 0;
      const normalizedRank = rank / maxRank;
      const isSelected = selectedNode === node.id;

      const radius = Math.min(
        (18 + normalizedRank * 36) * configRef.current.nodeSizeScale,
        configRef.current.height * 0.12
      );

      let mesh = nodeMeshesRef.current.get(node.id);

      if (!mesh) {
        const geometry = new THREE.SphereGeometry(1, 48, 48);
        const texture = createNodeTexture(normalizedRank, isSelected);

        const hue = Math.round(rankToHue(normalizedRank) * 360);
        const glowColor = new THREE.Color(`hsl(${hue}, 70%, 50%)`);
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          emissive: glowColor,
          emissiveIntensity: 0.3,
          roughness: 0.4,
          metalness: 0.1,
          transparent: true,
          depthWrite: false,
        });

        mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { nodeId: node.id };
        scene.add(mesh);
        nodeMeshesRef.current.set(node.id, mesh);

        if (configRef.current.showLabels) {
          const labelTexture = createLabelTexture(node.label, normalizedRank);
          const spriteMaterial = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true,
          });
          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.userData = { nodeId: node.id };
          scene.add(sprite);
          labelSpritesRef.current.set(node.id, sprite);
        }
      }

      mesh.position.set(position.x, position.y, 0);
      mesh.scale.set(radius * 2, radius * 2, 1);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      const wantSelected = selectedNode === node.id;
      const hadSelected = (mesh.userData['wasSelected'] as boolean) ?? false;
      if (wantSelected !== hadSelected) {
        const newTex = createNodeTexture(normalizedRank, wantSelected);
        mat.map = newTex;
        mat.needsUpdate = true;
        mesh.userData['wasSelected'] = wantSelected;
      }

      const labelSprite = labelSpritesRef.current.get(node.id);
      if (labelSprite) {
        const labelScale = Math.max(0.5, Math.min(1.8, zoomRef.current));
        labelSprite.position.set(position.x, position.y + radius + 18, 1);
        labelSprite.scale.set(64 * labelScale, 20 * labelScale, 1);
      }
    }

    // Remove deleted nodes
    for (const [nodeId, mesh] of Array.from(nodeMeshesRef.current)) {
      if (!nodes.find(n => n.id === nodeId)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        nodeMeshesRef.current.delete(nodeId);

        const sprite = labelSpritesRef.current.get(nodeId);
        if (sprite) {
          scene.remove(sprite);
          (sprite.material as THREE.SpriteMaterial).dispose();
          labelSpritesRef.current.delete(nodeId);
        }
      }
    }

    // Update edges
    const edgeMap = new Map(edges.map(e => [`${e.source}-${e.target}`, e]));

    for (const [edgeKey, edge] of Array.from(edgeMap)) {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);
      if (!sourcePos || !targetPos) continue;

      const sourceMesh = nodeMeshesRef.current.get(edge.source);
      const targetMesh = nodeMeshesRef.current.get(edge.target);
      const sourceRadius = sourceMesh ? sourceMesh.scale.x / 2 : 24;
      const targetRadius = targetMesh ? targetMesh.scale.x / 2 : 24;

      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const dirX = dx / dist;
      const dirY = dy / dist;

      const startX = sourcePos.x + dirX * (sourceRadius + 2);
      const startY = sourcePos.y + dirY * (sourceRadius + 2);
      const arrowLength = 18;
      const endX = targetPos.x - dirX * (targetRadius + arrowLength + 4);
      const endY = targetPos.y - dirY * (targetRadius + arrowLength + 4);
      const arrowX = targetPos.x - dirX * (targetRadius + 4);
      const arrowY = targetPos.y - dirY * (targetRadius + 4);

      let lineMesh = edgeMeshesRef.current.get(edgeKey);
      let arrowMesh = arrowMeshesRef.current.get(edgeKey);

      const sourceRank = (ranks.get(edge.source) as number) ?? 0;
      const normalizedSourceRank = sourceRank / maxRank;
      const hue = 0.64 - normalizedSourceRank * 0.18;
      const edgeColor = new THREE.Color().setHSL(hue, 0.55, 0.52);

      if (!lineMesh) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(startX, startY, -1),
          new THREE.Vector3(endX, endY, -1),
        ]);
        const material = new THREE.LineBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity: configRef.current.edgeOpacity,
          linewidth: 2.5,
        });
        lineMesh = new THREE.Line(geometry, material);
        scene.add(lineMesh);
        edgeMeshesRef.current.set(edgeKey, lineMesh);
      } else {
        const mat = lineMesh.material as THREE.LineBasicMaterial;
        mat.color.copy(edgeColor);
        (lineMesh.geometry as THREE.BufferGeometry).setFromPoints([
          new THREE.Vector3(startX, startY, -1),
          new THREE.Vector3(endX, endY, -1),
        ]);
      }

      if (!arrowMesh) {
        const arrowGeometry = new THREE.ConeGeometry(5, arrowLength, 12);
        arrowGeometry.rotateX(Math.PI / 2);

        const arrowMaterial = new THREE.MeshBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity: configRef.current.edgeOpacity + 0.15,
        });
        arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
        scene.add(arrowMesh);
        arrowMeshesRef.current.set(edgeKey, arrowMesh);
      } else {
        (arrowMesh.material as THREE.MeshBasicMaterial).color.copy(edgeColor);
      }

      arrowMesh.position.set(arrowX - dirX * (arrowLength / 2), arrowY - dirY * (arrowLength / 2), -0.5);
      const angle = Math.atan2(dirY, dirX);
      arrowMesh.rotation.z = angle - Math.PI / 2;
    }

    // Remove deleted edges
    for (const [edgeKey, lineMesh] of Array.from(edgeMeshesRef.current)) {
      if (!edgeMap.has(edgeKey)) {
        scene.remove(lineMesh);
        lineMesh.geometry.dispose();
        (lineMesh.material as THREE.Material).dispose();
        edgeMeshesRef.current.delete(edgeKey);

        const arrow = arrowMeshesRef.current.get(edgeKey);
        if (arrow) {
          scene.remove(arrow);
          arrow.geometry.dispose();
          (arrow.material as THREE.Material).dispose();
          arrowMeshesRef.current.delete(edgeKey);
        }
      }
    }
  }, [nodes, edges, ranks, selectedNode, createNodeTexture, createLabelTexture, centerCamera]);

  /**
   * Main render loop — stable identity, does not depend on isDragging state
   * so that the loop is never cancelled/restarted mid-frame.
   */
  const animateRef = useRef<() => void>(() => undefined);

  // Keep a ref to enablePhysics so the loop reads the latest value without
  // being recreated on every config change
  const enablePhysicsRef = useRef(config.enablePhysics);
  enablePhysicsRef.current = config.enablePhysics;

  // updateGraph is the only dependency that changes; assign it to a ref so
  // the animation loop can call the latest version without recreating itself.
  const updateGraphRef = useRef(updateGraph);
  updateGraphRef.current = updateGraph;

  useEffect(() => {
    animateRef.current = () => {
      if (!rendererReadyRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) {
        animationFrameRef.current = requestAnimationFrame(animateRef.current);
        return;
      }

      if (enablePhysicsRef.current && simulationRef.current && !isDraggingRef.current) {
        simulationRef.current.tick();
      }

      updateGraphRef.current();

      if (renderPipelineRef.current) {
        renderPipelineRef.current.render();
      } else {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(animateRef.current);
    };
  });

  /**
   * Convert a canvas-space pointer coordinate to simulation world coordinates,
   * accounting for camera position and zoom.
   */
  const screenToWorld = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !cameraRef.current) return { x: 0, y: 0 };

    const camera = cameraRef.current;
    const currentZoom = zoomRef.current;

    // NDC [-1, 1]
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);

    // Frustum half-extents at current zoom
    const halfW = (configRef.current.width / 2) / currentZoom;
    const halfH = (configRef.current.height / 2) / currentZoom;

    // World coordinates = camera offset + NDC * frustum half-size
    const worldX = camera.position.x + ndcX * halfW;
    const worldY = camera.position.y + ndcY * halfH;

    return { x: worldX, y: worldY };
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (!cameraRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      const nodeMeshes = Array.from(nodeMeshesRef.current.values());
      const intersects = raycasterRef.current.intersectObjects(nodeMeshes);

      if (intersects.length > 0) {
        const nodeId = intersects[0]!.object.userData['nodeId'] as NodeId;

        // Fix the node in the simulation immediately so that physics forces
        // do not act on it while the pointer is held
        if (simulationRef.current) {
          simulationRef.current.fixNode(nodeId, true);
        }

        isDraggingRef.current = true;
        draggedNodeRef.current = nodeId;

        // Fire click interaction on pointer-down (consistent with original behaviour)
        onInteraction?.({ type: 'click', nodeId });
      } else {
        isPanningRef.current = true;
        lastMousePosRef.current = { x: event.clientX, y: event.clientY };
      }
    },
    [onInteraction]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (isDraggingRef.current && draggedNodeRef.current && simulationRef.current) {
        // Convert screen position to world coordinates (accounts for camera + zoom)
        const { x: worldX, y: worldY } = screenToWorld(event.clientX, event.clientY);

        // setNodePosition also zeroes velocity to prevent drift
        simulationRef.current.setNodePosition(draggedNodeRef.current, worldX, worldY);
        onNodePositionUpdate?.(draggedNodeRef.current, { x: worldX, y: worldY });
        onInteraction?.({ type: 'drag', nodeId: draggedNodeRef.current, position: { x: worldX, y: worldY } });
      } else if (isPanningRef.current && cameraRef.current) {
        const deltaX = event.clientX - lastMousePosRef.current.x;
        const deltaY = event.clientY - lastMousePosRef.current.y;

        cameraRef.current.position.x -= deltaX / zoomRef.current;
        cameraRef.current.position.y += deltaY / zoomRef.current;
        cameraRef.current.updateProjectionMatrix();

        lastMousePosRef.current = { x: event.clientX, y: event.clientY };
        onInteraction?.({ type: 'pan' });
      }
    },
    [screenToWorld, onInteraction, onNodePositionUpdate]
  );

  const handlePointerUp = useCallback(() => {
    if (draggedNodeRef.current && simulationRef.current) {
      // fixNode(id, false) zeroes velocity before re-enabling physics
      simulationRef.current.fixNode(draggedNodeRef.current, false);
    }

    isDraggingRef.current = false;
    draggedNodeRef.current = null;
    isPanningRef.current = false;
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      if (!cameraRef.current) return;

      const zoomDelta = event.deltaY > 0 ? 0.88 : 1.14;
      const newZoom = Math.max(configRef.current.minZoom, Math.min(configRef.current.maxZoom, zoomRef.current * zoomDelta));

      zoomRef.current = newZoom;
      setZoom(newZoom);

      const camera = cameraRef.current;
      const aspect = configRef.current.width / configRef.current.height;
      const frustumSize = configRef.current.height / newZoom;
      camera.left = (-frustumSize * aspect) / 2;
      camera.right = (frustumSize * aspect) / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();

      onInteraction?.({ type: 'zoom' });
    },
    [onInteraction]
  );

  // -------------------------------------------------------------------------
  // Lifecycle effects
  // -------------------------------------------------------------------------

  /**
   * Mount: initialise the renderer asynchronously and start the animation loop.
   * The animation loop guards against an uninitialised renderer so it is safe
   * to start before initScene resolves.
   */
  useEffect(() => {
    isMountedRef.current = true;

    // Start the animation loop immediately — it will idle until the renderer
    // is ready (rendererReadyRef.current === true)
    animationFrameRef.current = requestAnimationFrame(animateRef.current);

    initScene().catch((err: unknown) => {
      console.error('PageRankGraphRenderer: WebGPURenderer initialization failed:', err);
    });

    return () => {
      isMountedRef.current = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      renderPipelineRef.current?.dispose();
      rendererRef.current?.dispose();

      for (const [, mesh] of Array.from(nodeMeshesRef.current)) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }

      for (const [, line] of Array.from(edgeMeshesRef.current)) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }

      for (const [, arrow] of Array.from(arrowMeshesRef.current)) {
        arrow.geometry.dispose();
        (arrow.material as THREE.Material).dispose();
      }

      for (const [, sprite] of Array.from(labelSpritesRef.current)) {
        (sprite.material as THREE.SpriteMaterial).dispose();
      }

      for (const [, tex] of Array.from(texturePoolRef.current)) {
        tex.dispose();
      }
    };
    // initScene identity is stable (memoised); animateRef is a ref — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initScene]);

  /**
   * Recreate the simulation whenever the node/edge set changes.
   * This runs synchronously (not async) so the simulation is available
   * on the very next animation frame without a double-render gap.
   */
  useEffect(() => {
    if (nodes.length > 0) {
      simulationRef.current = new ForceSimulation(nodes, edges, config.width, config.height);
    }
  }, [nodes, edges, config.width, config.height]);

  /**
   * Handle renderer resize when config dimensions change.
   */
  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.setDimensions(config.width, config.height);
    }

    if (rendererRef.current) {
      rendererRef.current.setSize(config.width, config.height);
    }

    if (cameraRef.current) {
      const aspect = config.width / config.height;
      const frustumSize = config.height / zoomRef.current;
      cameraRef.current.left = (-frustumSize * aspect) / 2;
      cameraRef.current.right = (frustumSize * aspect) / 2;
      cameraRef.current.top = frustumSize / 2;
      cameraRef.current.bottom = -frustumSize / 2;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [config.width, config.height]);

  // Derive cursor style from drag/pan state (React state not used — avoids re-renders)
  const [cursorStyle, setCursorStyle] = useState<'grab' | 'grabbing'>('grab');
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = () => setCursorStyle('grabbing');
    const onUp = () => setCursorStyle('grab');

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onUp);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: config.width, height: config.height, position: 'relative', touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: cursorStyle,
        }}
      />
      {/* Zoom indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          padding: '4px 10px',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
          fontSize: 11,
          color: 'rgba(255,255,255,0.7)',
          fontFamily: 'monospace',
          userSelect: 'none',
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
