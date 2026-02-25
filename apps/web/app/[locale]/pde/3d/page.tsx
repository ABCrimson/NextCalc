import type { Metadata } from 'next';
import { PDE3DClient } from './pde-3d-client';

export const metadata: Metadata = {
  title: 'PDE Solver 3D',
  description:
    'Three-dimensional partial differential equation solver with isosurface, slice plane, and point cloud visualization',
};

export default function PDE3DPage() {
  return <PDE3DClient />;
}
