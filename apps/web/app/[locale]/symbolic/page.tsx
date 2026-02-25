import type { Metadata } from 'next';
import { SymbolicPageClient } from './symbolic-page-client';

export const metadata: Metadata = {
  title: 'Symbolic Mathematics',
  description: 'Symbolic differentiation and calculus operations with NextCalc Pro',
};

export default function SymbolicPage() {
  return <SymbolicPageClient />;
}
