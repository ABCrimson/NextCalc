import type { Metadata } from 'next';
import { SolverPageContent } from './solver-content';

export const metadata: Metadata = {
  title: 'Equation Solver',
  description:
    'Solve linear, quadratic, and transcendental equations with step-by-step solutions',
};

export default function SolverPage() {
  return <SolverPageContent />;
}
