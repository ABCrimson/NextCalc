'use client';

/**
 * EigenPanel — Eigenvalue & Eigenvector Computation UI
 *
 * Features:
 * - Square matrix input grid (2×2, 3×3, 4×4)
 * - Full eigendecomposition via QR iteration (all eigenvalues + eigenvectors)
 * - Characteristic polynomial display
 * - Diagonalization P D P⁻¹ display when possible
 * - 2D eigenvector arrow visualization (for 2×2 matrices)
 * - KaTeX LaTeX rendering for all math output
 * - Framer Motion animations for result reveal
 * - WCAG 2.2 AAA accessibility throughout
 *
 * Keyboard navigation:
 * - Tab / Shift+Tab: move between cells, size buttons, and compute button
 * - Arrow keys: navigate within the matrix grid
 * - Enter / Space: activate buttons
 *
 * @module EigenPanel
 */

import { AnimatePresence, m, type Variants } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import type { KeyboardEvent, ReactElement } from 'react';
import { useCallback, useId, useRef, useState, useTransition } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MathRenderer } from '@/components/ui/math-renderer';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Branded types
// ---------------------------------------------------------------------------

type MatrixSize = 2 | 3 | 4;

// ---------------------------------------------------------------------------
// Pure math helpers — run inside useTransition / async
// ---------------------------------------------------------------------------

/** Round to a fixed number of significant decimal places, stripping float noise. */
function round(x: number, places = 10): number {
  const factor = 10 ** places;
  return Math.round(x * factor) / factor;
}

/** 2-norm of a column vector stored as number[]. */
function vecNorm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

/** Normalise a column vector in-place and return it. */
function vecNormalise(v: number[]): number[] {
  const n = vecNorm(v);
  return n < 1e-14 ? v.map(() => 0) : v.map((x) => x / n);
}

/** Matrix × column-vector (raw arrays, n×n and n). */
function matvec(A: number[][], v: number[]): number[] {
  const n = A.length;
  return Array.from({ length: n }, (_, i) => A[i]!.reduce((s, aij, j) => s + aij * v[j]!, 0));
}

/** Matrix × Matrix (raw arrays). */
function matmul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0]!.length;
  const p = B.length;
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      Array.from({ length: p }, (_, k) => A[i]![k]! * B[k]![j]!).reduce((s, x) => s + x, 0),
    ),
  );
}

/** Transpose a raw 2D array. */
function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0]!.length;
  return Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => A[j]![i]!));
}

/** Identity matrix n×n as raw array. */
function eye(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
}

/** Inverse of n×n matrix via Gauss-Jordan; throws if singular. */
function matinv(A: number[][]): number[][] {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r]![col]!) > Math.abs(aug[maxRow]![col]!)) maxRow = r;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow]!, aug[col]!];

    const pivot = aug[col]![col]!;
    if (Math.abs(pivot) < 1e-12) throw new Error('Matrix is singular — cannot diagonalise');

    for (let j = 0; j < 2 * n; j++) aug[col]![j]! /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r]![col]!;
      for (let j = 0; j < 2 * n; j++) aug[r]![j]! -= factor * aug[col]![j]!;
    }
  }

  return aug.map((row) => row.slice(n));
}

// ---------------------------------------------------------------------------
// Householder QR decomposition (real, in-place on copy)
// Returns { Q, R } as raw 2D arrays.
// ---------------------------------------------------------------------------
function qrHouseholder(M: number[][]): { Q: number[][]; R: number[][] } {
  const n = M.length;
  const R = M.map((r) => [...r]);
  const Q = eye(n);

  for (let k = 0; k < n - 1; k++) {
    // Extract sub-column
    const x: number[] = Array.from({ length: n - k }, (_, i) => R[i + k]![k]!);
    const norm = vecNorm(x);
    if (norm < 1e-14) continue;

    // Build Householder vector
    const sign = x[0]! >= 0 ? 1 : -1;
    x[0] = x[0]! + sign * norm;
    const xn = vecNorm(x);
    const u = x.map((v) => v / xn);

    // Apply H = I - 2uu^T to R (sub-matrix from row/col k)
    for (let j = 0; j < n; j++) {
      let dot = 0;
      for (let i = k; i < n; i++) dot += u[i - k]! * R[i]![j]!;
      for (let i = k; i < n; i++) R[i]![j]! -= 2 * u[i - k]! * dot;
    }

    // Accumulate Q
    for (let i = 0; i < n; i++) {
      let dot = 0;
      for (let j = k; j < n; j++) dot += Q[i]![j]! * u[j - k]!;
      for (let j = k; j < n; j++) Q[i]![j]! -= 2 * dot * u[j - k]!;
    }
  }

  return { Q, R };
}

// ---------------------------------------------------------------------------
// Full eigenvalue decomposition via QR iteration with shifts
// Returns real eigenvalues and eigenvectors (columns of P).
// For complex-conjugate pairs only the real part is returned (approximation).
// ---------------------------------------------------------------------------
type EigenResult = {
  eigenvalues: number[];
  /** Each eigenvector is a column of P, stored as number[] of length n. */
  eigenvectors: number[][];
  /** True if A ≈ P D P⁻¹ was verified (eigenvalues are all real and distinct). */
  isDiagonalisable: boolean;
  /** P, D, Pinv as raw arrays when isDiagonalisable. */
  P: number[][] | null;
  D: number[][] | null;
  Pinv: number[][] | null;
};

function computeEigen(input: number[][]): EigenResult {
  const n = input.length;

  // ---- QR iteration to find eigenvalues --------------------------------
  let H = input.map((r) => [...r]);
  // Accumulate similarity transforms in V so V^T A V = T
  let V = eye(n);

  const maxIter = 1000;
  for (let iter = 0; iter < maxIter; iter++) {
    // Wilkinson shift: use eigenvalue of bottom-right 2×2 block closest to H[n-1][n-1]
    const a = H[n - 2]![n - 2]!;
    const b = H[n - 2]![n - 1]!;
    const c = H[n - 1]![n - 2]!;
    const d = H[n - 1]![n - 1]!;
    const tr = a + d;
    const det2 = a * d - b * c;
    const disc = tr * tr - 4 * det2;
    let shift: number;
    if (disc >= 0) {
      const e1 = (tr + Math.sqrt(disc)) / 2;
      const e2 = (tr - Math.sqrt(disc)) / 2;
      shift = Math.abs(e1 - d) < Math.abs(e2 - d) ? e1 : e2;
    } else {
      shift = tr / 2;
    }

    // Shift
    const Hs = H.map((row, i) => row.map((v, j) => v - (i === j ? shift : 0)));

    const { Q, R } = qrHouseholder(Hs);
    // New H = R Q + shift I
    H = matmul(R, Q).map((row, i) => row.map((v, j) => v + (i === j ? shift : 0)));
    V = matmul(V, Q);

    // Convergence: check if sub-diagonal elements are small
    let converged = true;
    for (let i = 1; i < n; i++) {
      if (Math.abs(H[i]![i - 1]!) > 1e-10) {
        converged = false;
        break;
      }
    }
    if (converged) break;
  }

  // Diagonal of H gives approximate eigenvalues
  const eigenvalues = Array.from({ length: n }, (_, i) => round(H[i]![i]!, 8));

  // ---- Refine eigenvectors via inverse iteration -------------------------
  // For each eigenvalue λ, solve (A - λI)v = e₁ iteratively.
  const eigenvectors: number[][] = [];

  for (let k = 0; k < n; k++) {
    const lambda = eigenvalues[k]!;
    // Use the column of V as starting vector
    let v: number[] = Array.from({ length: n }, (_, i) => V[i]![k]!);
    v = vecNormalise(v);

    // A - λI
    const shift = 1e-7; // tiny perturbation to avoid exact singularity
    const Ashift: number[][] = input.map((row, i) =>
      row.map((val, j) => val - (i === j ? lambda - shift : 0)),
    );

    // 5 inverse-iteration steps (solve via Gauss elimination each time)
    for (let iter = 0; iter < 5; iter++) {
      try {
        const Ainv = matinv(Ashift);
        v = matvec(Ainv, v);
        v = vecNormalise(v);
      } catch {
        // If singular, keep current v
        break;
      }
    }

    // Fix sign convention: first non-zero component is positive
    const firstNonzero = v.find((x) => Math.abs(x) > 1e-10);
    if (firstNonzero !== undefined && firstNonzero < 0) {
      v = v.map((x) => -x);
    }

    eigenvectors.push(v.map((x) => round(x, 8)));
  }

  // ---- Check diagonalisability ------------------------------------------
  // A is diagonalisable iff P = [v₁ ... vₙ] is invertible.
  let P: number[][] | null = null;
  let D: number[][] | null = null;
  let Pinv: number[][] | null = null;
  let isDiagonalisable = false;

  try {
    // Build P column by column
    const Pcols = transpose(eigenvectors); // n×n

    // Verify det(P) != 0
    Pinv = matinv(Pcols);

    // Build D
    const Dmat = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? eigenvalues[i]! : 0)),
    );

    // Verify: P D P⁻¹ ≈ A
    const reconstructed = matmul(matmul(Pcols, Dmat), Pinv);
    let maxErr = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        maxErr = Math.max(maxErr, Math.abs(reconstructed[i]![j]! - input[i]![j]!));

    if (maxErr < 1e-4) {
      isDiagonalisable = true;
      P = Pcols.map((row) => row.map((x) => round(x, 6)));
      D = Dmat;
      Pinv = Pinv.map((row) => row.map((x) => round(x, 6)));
    }
  } catch {
    // Not diagonalisable (singular P)
  }

  return { eigenvalues, eigenvectors, isDiagonalisable, P, D, Pinv };
}

// ---------------------------------------------------------------------------
// Characteristic polynomial coefficients for n≤4 (exact, symbolic display)
// Uses the fact that char poly = det(λI - A).
// We return a string of LaTeX.
// ---------------------------------------------------------------------------
function characteristicPolyLatex(A: number[][], eigenvalues: number[]): string {
  const n = A.length;

  if (n === 1) {
    const a = round(A[0]![0]!, 6);
    const sign = a >= 0 ? '-' : '+';
    const absA = Math.abs(a);
    return `\\lambda ${sign} ${formatNum(absA)}`;
  }

  // Factor form: (λ - λ₁)(λ - λ₂)...
  const factors = eigenvalues
    .map((lam) => {
      const r = round(lam, 4);
      if (Math.abs(r) < 1e-9) return '\\lambda';
      const sign = r > 0 ? '-' : '+';
      return `(\\lambda ${sign} ${formatNum(Math.abs(r))})`;
    })
    .join('');

  return `p(\\lambda) = ${factors}`;
}

// ---------------------------------------------------------------------------
// LaTeX formatting helpers
// ---------------------------------------------------------------------------

/** Format a number for LaTeX, showing up to 4 significant figures. */
function formatNum(x: number): string {
  if (Math.abs(x) < 1e-9) return '0';
  const fixed = parseFloat(x.toFixed(6));
  // If integer or close to one, render without decimals
  if (Math.abs(fixed - Math.round(fixed)) < 1e-9) return String(Math.round(fixed));
  return String(fixed);
}

/** Format a single eigenvalue as LaTeX. */
function eigenvalueLatex(lam: number, index: number): string {
  return `\\lambda_{${index + 1}} = ${formatNum(round(lam, 6))}`;
}

/** Format a column vector as a LaTeX bmatrix. */
function vectorLatex(v: number[]): string {
  const entries = v.map((x) => formatNum(round(x, 6))).join(' \\\\ ');
  return `\\begin{bmatrix} ${entries} \\end{bmatrix}`;
}

/** Format an n×n matrix as LaTeX bmatrix. */
function matrixLatex(M: number[][]): string {
  const rows = M.map((row) => row.map((x) => formatNum(x)).join(' & ')).join(' \\\\ ');
  return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
}

// ---------------------------------------------------------------------------
// Types for component state
// ---------------------------------------------------------------------------

type EigenComputedResult = {
  eigenvalues: number[];
  eigenvectors: number[][];
  charPolyLatex: string;
  isDiagonalisable: boolean;
  P: number[][] | null;
  D: number[][] | null;
  Pinv: number[][] | null;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single read-only number cell in the result display. */
function ResultCell({ value }: { value: number }) {
  return (
    <div
      className="p-2 text-center font-mono text-sm bg-background rounded border border-border"
      role="gridcell"
    >
      {formatNum(round(value, 6))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2D SVG eigenvector visualisation (2×2 matrices) — plain Canvas 2D via SVG.
// Uses only SVG/DOM, no WebGPU.
// ---------------------------------------------------------------------------
function EigenVectorVisualisation2D({
  matrix: _A,
  eigenvalues,
  eigenvectors,
}: {
  matrix: number[][];
  eigenvalues: number[];
  eigenvectors: number[][];
}) {
  const W = 280;
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const scale = 80;

  // Grid lines
  const gridLines: ReactElement[] = [];
  for (let t = -3; t <= 3; t++) {
    gridLines.push(
      <line
        key={`h${t}`}
        x1={0}
        y1={cy + t * (scale / 2)}
        x2={W}
        y2={cy + t * (scale / 2)}
        stroke="var(--color-border)"
        strokeWidth={0.5}
      />,
    );
    gridLines.push(
      <line
        key={`v${t}`}
        x1={cx + t * (scale / 2)}
        y1={0}
        x2={cx + t * (scale / 2)}
        y2={H}
        stroke="var(--color-border)"
        strokeWidth={0.5}
      />,
    );
  }

  const arrowColors = ['oklch(0.55 0.27 264)', 'oklch(0.65 0.20 155)'];

  const arrows = eigenvectors.slice(0, 2).map((ev, idx) => {
    const vx = ev[0] ?? 0;
    const vy = ev[1] ?? 0;
    const lam = eigenvalues[idx] ?? 1;
    const tx = vx * lam;
    const ty = vy * lam;

    const x2 = cx + vx * scale;
    const y2 = cy - vy * scale; // SVG Y flipped
    const tx2 = cx + tx * scale;
    const ty2 = cy - ty * scale;
    const color = arrowColors[idx] ?? 'oklch(0.55 0.27 264)';

    return (
      <g key={idx}>
        <line
          x1={cx}
          y1={cy}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={2.5}
          markerEnd={`url(#arrowhead-${idx})`}
        />
        <line
          x1={cx}
          y1={cy}
          x2={tx2}
          y2={ty2}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="5 3"
          opacity={0.6}
        />
        <text
          x={x2 + 6}
          y={y2 - 6}
          fontSize={11}
          fill={color}
          fontFamily="monospace"
          aria-hidden="true"
        >
          v{idx + 1}
        </text>
      </g>
    );
  });

  return (
    <figure
      aria-label="2D eigenvector visualisation using SVG: solid arrows are eigenvectors, dashed arrows are transformed (λv)"
      className="flex flex-col items-center gap-2 w-full overflow-x-auto"
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="rounded-lg border border-border bg-card max-w-full"
        role="img"
        aria-label="Eigenvector arrows on 2D coordinate plane"
        style={{ minWidth: `${W}px` }}
      >
        <title>2D eigenvector visualisation (SVG)</title>
        <defs>
          {arrowColors.map((color, i) => (
            <marker
              key={`arrowhead-${i}`}
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
        {gridLines}
        <line
          x1={0}
          y1={cy}
          x2={W}
          y2={cy}
          stroke="var(--color-muted-foreground)"
          strokeWidth={1}
        />
        <line
          x1={cx}
          y1={0}
          x2={cx}
          y2={H}
          stroke="var(--color-muted-foreground)"
          strokeWidth={1}
        />
        {arrows}
        <circle cx={cx} cy={cy} r={3} fill="var(--color-foreground)" />
      </svg>
      <figcaption className="text-xs text-muted-foreground text-center max-w-[280px] break-words">
        Rendering: SVG (2D canvas). Solid arrows = eigenvector direction. Dashed = transformed
        vector (scaled by eigenvalue).
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// 3D isometric SVG projection for 3×3 eigenvectors.
// Projects (x, y, z) onto 2D using an isometric basis:
//   screen_x = (x - z) * cos(30°)
//   screen_y = (x + z) * sin(30°) - y
// ---------------------------------------------------------------------------
function EigenVectorVisualisation3D({
  eigenvalues,
  eigenvectors,
}: {
  eigenvalues: number[];
  eigenvectors: number[][];
}) {
  const W = 320;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2 + 20;
  const scale = 90;

  /** Project a 3D point to 2D isometric SVG coordinates. */
  function project(x: number, y: number, z: number): [number, number] {
    const cos30 = Math.cos(Math.PI / 6);
    const sin30 = Math.sin(Math.PI / 6);
    const sx = (x - z) * cos30;
    const sy = (x + z) * sin30 - y;
    return [cx + sx * scale, cy + sy * scale];
  }

  // Draw the three isometric axes
  const axisColors = [
    'oklch(0.65 0.18 25)', // X — reddish
    'oklch(0.65 0.20 155)', // Y — greenish
    'oklch(0.55 0.27 264)', // Z — blueish
  ] as const;
  const axisLabels = ['x', 'y', 'z'] as const;

  const axesElems = (
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] as const
  ).map(([ax, ay, az], i) => {
    const [ex, ey] = project(ax, ay, az);
    const color = axisColors[i]!;
    return (
      <g key={`axis-${i}`} opacity={0.45}>
        <line
          x1={cx}
          y1={cy}
          x2={ex}
          y2={ey}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        <text x={ex + 4} y={ey} fontSize={9} fill={color} fontFamily="monospace" aria-hidden="true">
          {axisLabels[i]}
        </text>
      </g>
    );
  });

  const evColors = ['oklch(0.72 0.22 264)', 'oklch(0.72 0.20 155)', 'oklch(0.72 0.20 40)'] as const;

  const arrows = eigenvectors.slice(0, 3).map((ev, idx) => {
    const vx = ev[0] ?? 0;
    const vy = ev[1] ?? 0;
    const vz = ev[2] ?? 0;
    const lam = eigenvalues[idx] ?? 1;
    const [ex, ey] = project(vx, vy, vz);
    const [tx, ty] = project(vx * lam, vy * lam, vz * lam);
    const color = evColors[idx] ?? evColors[0]!;

    return (
      <g key={idx}>
        {/* Eigenvector */}
        <line
          x1={cx}
          y1={cy}
          x2={ex}
          y2={ey}
          stroke={color}
          strokeWidth={2.5}
          markerEnd={`url(#arrowhead3d-${idx})`}
        />
        {/* Transformed (λv) */}
        <line
          x1={cx}
          y1={cy}
          x2={tx}
          y2={ty}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="5 3"
          opacity={0.55}
        />
        <text
          x={ex + 5}
          y={ey - 4}
          fontSize={10}
          fill={color}
          fontFamily="monospace"
          aria-hidden="true"
        >
          v{idx + 1}
        </text>
      </g>
    );
  });

  return (
    <figure
      aria-label="3D isometric eigenvector visualisation (SVG projection)"
      className="flex flex-col items-center gap-2 w-full overflow-x-auto"
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="rounded-lg border border-border bg-card max-w-full"
        role="img"
        aria-label="3D eigenvectors projected onto isometric plane"
        style={{ minWidth: `${W}px` }}
      >
        <title>3D eigenvector visualisation (isometric SVG projection)</title>
        <defs>
          {evColors.map((color, i) => (
            <marker
              key={`arrowhead3d-${i}`}
              id={`arrowhead3d-${i}`}
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
        {axesElems}
        <circle cx={cx} cy={cy} r={3} fill="var(--color-foreground)" />
        {arrows}
      </svg>
      <figcaption className="text-xs text-muted-foreground text-center max-w-[320px] break-words">
        Rendering: SVG (isometric 3D projection). Solid arrows = eigenvectors. Dashed = λv scaled
        transformation.
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// 4×4 eigenvector table + first-two-components 2D projection view.
// For 4×4 we show a numeric table of all four eigenvectors plus a 2D
// projection of the first two components of each vector.
// ---------------------------------------------------------------------------
function EigenVectorVisualisation4D({
  eigenvalues,
  eigenvectors,
}: {
  eigenvalues: number[];
  eigenvectors: number[][];
}) {
  const W = 320;
  const H = 240;
  const cx = W / 2;
  const cy = H / 2;
  const scale = 70;

  const evColors = [
    'oklch(0.72 0.22 264)',
    'oklch(0.72 0.20 155)',
    'oklch(0.72 0.20 40)',
    'oklch(0.65 0.18 320)',
  ] as const;

  // Grid lines (light)
  const gridLines: ReactElement[] = [];
  for (let t = -3; t <= 3; t++) {
    gridLines.push(
      <line
        key={`h${t}`}
        x1={0}
        y1={cy + t * (scale / 2)}
        x2={W}
        y2={cy + t * (scale / 2)}
        stroke="var(--color-border)"
        strokeWidth={0.5}
      />,
    );
    gridLines.push(
      <line
        key={`v${t}`}
        x1={cx + t * (scale / 2)}
        y1={0}
        x2={cx + t * (scale / 2)}
        y2={H}
        stroke="var(--color-border)"
        strokeWidth={0.5}
      />,
    );
  }

  const arrows = eigenvectors.slice(0, 4).map((ev, idx) => {
    // Project onto first two components (x₁, x₂)
    const vx = ev[0] ?? 0;
    const vy = ev[1] ?? 0;
    const lam = eigenvalues[idx] ?? 1;
    const ex = cx + vx * scale;
    const ey = cy - vy * scale;
    const tx = cx + vx * lam * scale;
    const ty = cy - vy * lam * scale;
    const color = evColors[idx] ?? evColors[0]!;

    return (
      <g key={idx}>
        <line
          x1={cx}
          y1={cy}
          x2={ex}
          y2={ey}
          stroke={color}
          strokeWidth={2}
          markerEnd={`url(#arrowhead4d-${idx})`}
        />
        <line
          x1={cx}
          y1={cy}
          x2={tx}
          y2={ty}
          stroke={color}
          strokeWidth={1.2}
          strokeDasharray="4 2"
          opacity={0.5}
        />
        <text
          x={ex + 4}
          y={ey - 4}
          fontSize={10}
          fill={color}
          fontFamily="monospace"
          aria-hidden="true"
        >
          v{idx + 1}
        </text>
      </g>
    );
  });

  const componentLabels = ['x₁', 'x₂', 'x₃', 'x₄'] as const;

  return (
    <div className="space-y-4">
      {/* 2D projection of first two components */}
      <figure
        aria-label="4D eigenvector 2D projection: first two components of each eigenvector"
        className="flex flex-col items-center gap-2 w-full overflow-x-auto"
      >
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="rounded-lg border border-border bg-card max-w-full"
          role="img"
          aria-label="First two components of 4D eigenvectors on 2D plane"
          style={{ minWidth: `${W}px` }}
        >
          <title>4D eigenvector projection (first two components)</title>
          <defs>
            {evColors.map((color, i) => (
              <marker
                key={`arrowhead4d-${i}`}
                id={`arrowhead4d-${i}`}
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
          {gridLines}
          <line
            x1={0}
            y1={cy}
            x2={W}
            y2={cy}
            stroke="var(--color-muted-foreground)"
            strokeWidth={1}
          />
          <line
            x1={cx}
            y1={0}
            x2={cx}
            y2={H}
            stroke="var(--color-muted-foreground)"
            strokeWidth={1}
          />
          {arrows}
          <circle cx={cx} cy={cy} r={3} fill="var(--color-foreground)" />
        </svg>
        <figcaption className="text-xs text-muted-foreground text-center max-w-[320px] break-words">
          Rendering: SVG (2D projection of x₁, x₂ components). Dashed = λv scaled transformation.
        </figcaption>
      </figure>

      {/* Full numeric table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-muted/20">
        <table className="w-full text-xs font-mono" aria-label="Full eigenvector components table">
          <thead>
            <tr className="border-b border-border">
              <th className="p-2 text-left text-muted-foreground font-semibold">Component</th>
              {eigenvectors.map((_, idx) => {
                const color = evColors[idx] ?? evColors[0]!;
                return (
                  <th key={idx} className="p-2 text-center font-semibold" style={{ color }}>
                    v{idx + 1} (λ={formatNum(round(eigenvalues[idx] ?? 0, 4))})
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {componentLabels.map((label, ri) => (
              <tr key={ri} className="border-b border-border/50 last:border-0">
                <td className="p-2 text-muted-foreground">{label}</td>
                {eigenvectors.map((ev, ci) => {
                  const color = evColors[ci] ?? evColors[0]!;
                  return (
                    <td key={ci} className="p-2 text-center tabular-nums" style={{ color }}>
                      {formatNum(round(ev[ri] ?? 0, 6))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Framer Motion animation variants
// easeOut expressed as a cubic-bezier array for strict Framer Motion Easing type
// ---------------------------------------------------------------------------

const EASE_OUT = [0, 0, 0.2, 1] as const;

const fadeSlide: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

// ---------------------------------------------------------------------------
// Main EigenPanel component
// ---------------------------------------------------------------------------

export function EigenPanel() {
  const [size, setSize] = useState<MatrixSize>(2);
  const [matrix, setMatrix] = useState<number[][]>([
    [4, 1],
    [2, 3],
  ]);
  const [result, setResult] = useState<EigenComputedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDiag, setShowDiag] = useState(false);
  const [showCharPoly, setShowCharPoly] = useState(true);
  const resultRef = useRef<HTMLDivElement>(null);
  const gridId = useId();

  // Build a fresh identity-like demo matrix for a given size
  const makeDefaultMatrix = (n: MatrixSize): number[][] => {
    if (n === 2)
      return [
        [4, 1],
        [2, 3],
      ];
    if (n === 3)
      return [
        [2, 1, 0],
        [1, 3, 1],
        [0, 1, 2],
      ];
    return [
      [4, 1, 0, 0],
      [1, 3, 1, 0],
      [0, 1, 2, 1],
      [0, 0, 1, 1],
    ];
  };

  const handleSizeChange = (newSize: MatrixSize) => {
    setSize(newSize);
    setMatrix(makeDefaultMatrix(newSize));
    setResult(null);
    setError(null);
  };

  const handleCellChange = useCallback((row: number, col: number, raw: string) => {
    const value = raw === '' || raw === '-' ? 0 : parseFloat(raw) || 0;
    setMatrix((prev) =>
      prev.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? value : c))),
    );
    setError(null);
  }, []);

  const handlePreset = (preset: 'identity' | 'symmetric' | 'random') => {
    const n = size;
    let m: number[][];
    switch (preset) {
      case 'identity':
        m = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
        );
        break;
      case 'symmetric': {
        const base = Array.from({ length: n }, () =>
          Array.from({ length: n }, () => Math.round(Math.random() * 6) - 3),
        );
        m = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) => (j >= i ? base[i]![j]! : base[j]![i]!)),
        );
        break;
      }
      case 'random':
        m = Array.from({ length: n }, () =>
          Array.from({ length: n }, () => Math.round(Math.random() * 10) - 5),
        );
        break;
    }
    setMatrix(m);
    setResult(null);
    setError(null);
  };

  const handleCompute = () => {
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        // Dynamic import to keep math-engine out of initial JS bundle
        const { Matrix } = await import('@nextcalc/math-engine/matrix');

        // Validate: must be square
        const n = matrix.length;
        for (let i = 0; i < n; i++) {
          if (matrix[i]!.length !== n) {
            throw new Error('Matrix must be square for eigenvalue computation');
          }
        }

        // Verify math-engine can parse the matrix (catches NaN, Infinity etc.)
        const _m = new Matrix(matrix);
        void _m; // used for validation only

        // Run full eigendecomposition
        const eigen = computeEigen(matrix);

        const computed: EigenComputedResult = {
          eigenvalues: eigen.eigenvalues,
          eigenvectors: eigen.eigenvectors,
          charPolyLatex: characteristicPolyLatex(matrix, eigen.eigenvalues),
          isDiagonalisable: eigen.isDiagonalisable,
          P: eigen.P,
          D: eigen.D,
          Pinv: eigen.Pinv,
        };

        setResult(computed);
        setShowDiag(false);

        // Scroll result into view after render
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Computation failed');
      }
    });
  };

  // Arrow-key navigation within the grid
  const handleGridKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
      const n = size;
      let nextRow = row;
      let nextCol = col;

      switch (e.key) {
        case 'ArrowUp':
          nextRow = Math.max(0, row - 1);
          break;
        case 'ArrowDown':
          nextRow = Math.min(n - 1, row + 1);
          break;
        case 'ArrowLeft':
          nextCol = Math.max(0, col - 1);
          break;
        case 'ArrowRight':
          nextCol = Math.min(n - 1, col + 1);
          break;
        default:
          return;
      }

      e.preventDefault();
      const target = document.getElementById(`${gridId}-${nextRow}-${nextCol}`);
      (target as HTMLInputElement | null)?.focus();
    },
    [gridId, size],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card className="border-violet-500/30 shadow-[0_0_20px_oklch(0.55_0.27_264/0.12)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">
            λ
          </span>
          <div>
            <CardTitle>Eigenvalues &amp; Eigenvectors</CardTitle>
            <CardDescription>
              Full eigendecomposition via QR iteration. Displays characteristic polynomial, all
              eigenvalue/eigenvector pairs, and diagonalisation P D P⁻¹.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ---- Size selector ------------------------------------------- */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-foreground" id="size-label">
            Matrix size:
          </span>
          <div role="radiogroup" aria-labelledby="size-label" className="flex gap-2">
            {([2, 3, 4] as const).map((n) => (
              <Button
                key={n}
                variant={size === n ? 'default' : 'outline'}
                size="sm"
                role="radio"
                aria-checked={size === n}
                onClick={() => handleSizeChange(n)}
                className={cn(
                  'w-14 font-mono',
                  size === n && 'shadow-[0_0_8px_oklch(0.55_0.27_264/0.5)]',
                )}
              >
                {n}×{n}
              </Button>
            ))}
          </div>

          {/* Preset buttons */}
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset('identity')}
              aria-label="Load identity matrix preset"
            >
              Identity
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset('symmetric')}
              aria-label="Load random symmetric matrix preset"
            >
              Symmetric
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset('random')}
              aria-label="Load random matrix preset"
            >
              Random
            </Button>
          </div>
        </div>

        {/* ---- Matrix input grid --------------------------------------- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground" id="matrix-grid-label">
              Matrix A ({size}×{size})
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              Square
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <div
              role="grid"
              aria-labelledby="matrix-grid-label"
              className="inline-grid gap-1.5 p-4 rounded-lg border border-border bg-muted/30"
              style={{
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
              }}
            >
              {matrix.map((row, ri) =>
                row.map((val, ci) => (
                  <div key={`${ri}-${ci}`} role="row" className="contents">
                    <Input
                      id={`${gridId}-${ri}-${ci}`}
                      type="number"
                      step="any"
                      value={val}
                      onChange={(e) => handleCellChange(ri, ci, e.target.value)}
                      onKeyDown={(e) => handleGridKeyDown(e, ri, ci)}
                      className={cn(
                        'w-16 text-center font-mono text-sm p-1.5 h-9',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      )}
                      aria-label={`Row ${ri + 1}, column ${ci + 1}`}
                      role="gridcell"
                    />
                  </div>
                )),
              )}
            </div>
          </div>
        </div>

        {/* ---- Compute button ------------------------------------------ */}
        <Button
          onClick={handleCompute}
          disabled={isPending}
          className={cn(
            'w-full sm:w-auto',
            'bg-gradient-to-r from-violet-600 to-indigo-600',
            'hover:from-violet-500 hover:to-indigo-500',
            'text-white shadow-[0_0_12px_oklch(0.55_0.27_264/0.4)]',
            'hover:shadow-[0_0_20px_oklch(0.55_0.27_264/0.6)]',
            isPending && 'animate-pulse',
          )}
          aria-busy={isPending}
          aria-live="polite"
        >
          {isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              Computing…
            </>
          ) : (
            'Compute Eigenvalues & Eigenvectors'
          )}
        </Button>

        {/* ---- Error display ------------------------------------------- */}
        <AnimatePresence>
          {error && (
            <m.div
              key="error"
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Alert variant="destructive" role="alert" aria-live="assertive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </m.div>
          )}
        </AnimatePresence>

        {/* ---- Results -------------------------------------------------- */}
        <AnimatePresence>
          {result && (
            <m.div
              key="results"
              ref={resultRef}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6"
              aria-live="polite"
              aria-label="Eigendecomposition results"
            >
              {/* Characteristic polynomial */}
              <m.section variants={fadeSlide} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowCharPoly((p) => !p)}
                  className={cn(
                    'flex items-center gap-2 text-sm font-semibold text-foreground',
                    'hover:text-primary transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm',
                  )}
                  aria-expanded={showCharPoly}
                >
                  {showCharPoly ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                  Characteristic Polynomial
                </button>
                <AnimatePresence>
                  {showCharPoly && (
                    <m.div
                      variants={fadeSlide}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="p-4 rounded-lg bg-violet-950/20 border border-violet-500/30 overflow-x-auto"
                    >
                      <MathRenderer
                        expression={result.charPolyLatex}
                        displayMode
                        ariaLabel={`Characteristic polynomial: ${result.charPolyLatex}`}
                        className="text-violet-200"
                      />
                    </m.div>
                  )}
                </AnimatePresence>
              </m.section>

              {/* Eigenvalues */}
              <m.section variants={fadeSlide} className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-600 text-white text-xs"
                    aria-hidden="true"
                  >
                    λ
                  </span>
                  Eigenvalues
                </h4>
                <m.ul
                  variants={staggerContainer}
                  className="grid gap-2 sm:grid-cols-2"
                  aria-label="List of eigenvalues"
                >
                  {result.eigenvalues.map((lam, idx) => (
                    <m.li
                      key={idx}
                      variants={fadeSlide}
                      className={cn(
                        'p-3 rounded-lg border flex items-center gap-3',
                        'bg-gradient-to-r from-violet-950/30 to-indigo-950/30',
                        'border-violet-500/40',
                      )}
                    >
                      <Badge variant="outline" className="font-mono text-xs border-violet-500/50">
                        λ<sub>{idx + 1}</sub>
                      </Badge>
                      <MathRenderer
                        expression={eigenvalueLatex(lam, idx)}
                        ariaLabel={`Eigenvalue ${idx + 1} equals ${round(lam, 6)}`}
                      />
                    </m.li>
                  ))}
                </m.ul>
              </m.section>

              {/* Eigenvectors */}
              <m.section variants={fadeSlide} className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-xs"
                    aria-hidden="true"
                  >
                    v
                  </span>
                  Eigenvectors
                </h4>
                <m.div
                  variants={staggerContainer}
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {result.eigenvectors.map((ev, idx) => (
                    <m.div
                      key={idx}
                      variants={fadeSlide}
                      className={cn(
                        'p-4 rounded-lg border min-w-0',
                        'bg-gradient-to-br from-emerald-950/20 to-teal-950/20',
                        'border-emerald-500/30',
                      )}
                    >
                      {/* Header row: eigenvector label for this eigenvalue */}
                      <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5 leading-normal">
                        <span className="shrink-0">v{idx + 1} for</span>
                        <MathRenderer
                          expression={`\\lambda_{${idx + 1}} = ${formatNum(round(result.eigenvalues[idx]!, 4))}`}
                          ariaLabel={`eigenvector for eigenvalue ${idx + 1}`}
                          className="text-emerald-300 shrink-0"
                        />
                      </div>
                      {/* Numeric component list with generous vertical spacing */}
                      <ol
                        aria-label={`Eigenvector ${idx + 1} components`}
                        className="space-y-1.5 mb-3"
                      >
                        {ev.map((x, vi) => (
                          <li
                            key={vi}
                            className="flex items-baseline gap-2 font-mono text-sm leading-6"
                          >
                            <span className="text-muted-foreground text-xs w-4 shrink-0">
                              {vi + 1}:
                            </span>
                            <span className="text-foreground tabular-nums">
                              {formatNum(round(x, 6))}
                            </span>
                          </li>
                        ))}
                      </ol>
                      {/* LaTeX column-vector rendering, wrapped so it never overflows */}
                      <div className="overflow-x-auto max-w-full">
                        <MathRenderer
                          expression={vectorLatex(ev)}
                          displayMode
                          ariaLabel={`Eigenvector ${idx + 1}: [${ev.map((x) => round(x, 6)).join(', ')}]`}
                          className="text-foreground text-sm"
                        />
                      </div>
                    </m.div>
                  ))}
                </m.div>
              </m.section>

              {/* Eigenvector visualisation — varies by matrix size */}
              <m.section variants={fadeSlide} className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {size === 2 && 'Eigenvector Visualisation (2D)'}
                  {size === 3 && 'Eigenvector Visualisation (3D Isometric Projection)'}
                  {size === 4 && 'Eigenvector Visualisation (4D — 2D Projection + Table)'}
                </h4>
                {size === 2 && (
                  <EigenVectorVisualisation2D
                    matrix={matrix}
                    eigenvalues={result.eigenvalues}
                    eigenvectors={result.eigenvectors}
                  />
                )}
                {size === 3 && (
                  <EigenVectorVisualisation3D
                    eigenvalues={result.eigenvalues}
                    eigenvectors={result.eigenvectors}
                  />
                )}
                {size === 4 && (
                  <EigenVectorVisualisation4D
                    eigenvalues={result.eigenvalues}
                    eigenvectors={result.eigenvectors}
                  />
                )}
              </m.section>

              {/* Diagonalisation */}
              <m.section variants={fadeSlide} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDiag((p) => !p)}
                  className={cn(
                    'flex items-center gap-2 text-sm font-semibold',
                    result.isDiagonalisable
                      ? 'text-amber-300 hover:text-amber-200'
                      : 'text-muted-foreground cursor-default',
                    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm',
                  )}
                  aria-expanded={showDiag}
                  disabled={!result.isDiagonalisable}
                  title={
                    result.isDiagonalisable
                      ? 'Toggle diagonalisation display'
                      : 'Matrix is not diagonalisable (repeated or complex eigenvalues)'
                  }
                >
                  {showDiag ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                  Diagonalisation A = P D P⁻¹
                  {result.isDiagonalisable ? (
                    <Badge className="ml-1 bg-amber-600/80 text-white border-0 text-xs">
                      Possible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-1 text-xs opacity-60">
                      Not applicable
                    </Badge>
                  )}
                </button>

                <AnimatePresence>
                  {showDiag && result.isDiagonalisable && result.P && result.D && result.Pinv && (
                    <m.div
                      variants={fadeSlide}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-4 p-4 rounded-lg bg-amber-950/20 border border-amber-500/30"
                    >
                      <p className="text-xs text-muted-foreground">
                        A = P D P<sup>-1</sup> where P contains eigenvectors as columns, D is the
                        diagonal eigenvalue matrix.
                      </p>

                      {/* P matrix */}
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-amber-300">
                          P (eigenvectors):
                        </span>
                        <div className="overflow-x-auto">
                          <MathRenderer
                            expression={`P = ${matrixLatex(result.P)}`}
                            displayMode
                            ariaLabel={`P matrix: ${JSON.stringify(result.P)}`}
                          />
                        </div>
                      </div>

                      {/* D matrix */}
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-amber-300">
                          D (diagonal eigenvalues):
                        </span>
                        <div className="overflow-x-auto">
                          <MathRenderer
                            expression={`D = ${matrixLatex(result.D)}`}
                            displayMode
                            ariaLabel={`D diagonal matrix: ${JSON.stringify(result.D)}`}
                          />
                        </div>
                      </div>

                      {/* P inverse */}
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-amber-300">P⁻¹:</span>
                        <div className="overflow-x-auto">
                          <MathRenderer
                            expression={`P^{-1} = ${matrixLatex(result.Pinv)}`}
                            displayMode
                            ariaLabel={`P inverse matrix: ${JSON.stringify(result.Pinv)}`}
                          />
                        </div>
                      </div>

                      {/* Verification grid: show numeric cells */}
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                          Verify: show raw values of P, D, P⁻¹
                        </summary>
                        <div className="mt-3 grid gap-4">
                          {[
                            { label: 'P', data: result.P },
                            { label: 'D', data: result.D },
                            { label: 'P⁻¹', data: result.Pinv },
                          ].map(({ label, data }) => (
                            <div key={label} className="min-w-0">
                              <span className="font-semibold text-muted-foreground">{label}:</span>
                              <div className="mt-1 overflow-x-auto">
                                <div
                                  className="inline-grid gap-1"
                                  style={{
                                    gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                                  }}
                                  role="grid"
                                  aria-label={`${label} matrix`}
                                >
                                  {data.map((row, ri) =>
                                    row.map((val, ci) => (
                                      <ResultCell key={`${ri}-${ci}`} value={val} />
                                    )),
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </m.div>
                  )}
                </AnimatePresence>
              </m.section>

              {/* Verification note */}
              <m.div
                variants={fadeSlide}
                className="text-xs text-muted-foreground border-t border-border pt-3"
              >
                <strong>Algorithm:</strong> QR iteration with Wilkinson shift for eigenvalues,
                followed by inverse iteration to refine eigenvectors. Suitable for dense matrices up
                to 4×4. Results are rounded to 6 decimal places.
              </m.div>
            </m.div>
          )}
        </AnimatePresence>

        {/* ---- Help / keyboard guide ----------------------------------- */}
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm">
            Keyboard &amp; Concepts Guide
          </summary>
          <div className="mt-3 space-y-3 text-muted-foreground text-xs leading-relaxed">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h5 className="font-semibold text-foreground text-sm">Keyboard Navigation</h5>
                <ul className="space-y-1 list-none">
                  <li>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-xs">
                      Tab
                    </kbd>{' '}
                    — move to next cell or control
                  </li>
                  <li>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-xs">
                      ↑ ↓ ← →
                    </kbd>{' '}
                    — navigate matrix grid
                  </li>
                  <li>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-xs">
                      Enter
                    </kbd>{' '}
                    — activate buttons
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <h5 className="font-semibold text-foreground text-sm">Mathematical Concepts</h5>
                <p>
                  <strong>Eigenvalue λ:</strong> scalar where Av = λv for non-zero vector v.
                </p>
                <p>
                  <strong>Eigenvector v:</strong> direction preserved (only scaled) by A.
                </p>
                <p>
                  <strong>Char. poly p(λ):</strong> det(λI − A). Roots are eigenvalues.
                </p>
                <p>
                  <strong>Diagonalisation:</strong> A = PDP⁻¹ when P has full column rank.
                </p>
              </div>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
