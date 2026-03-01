/**
 * Symbolic mathematics module
 * Provides symbolic differentiation, integration, and simplification
 */

// CAS Core
export * from './cas-core';
// Core symbolic operations
export * from './differentiate';
// Expression tree analysis
export * from './expression-tree';
export * from './integrate';
export * from './integrate-improper';
export * from './integrate-multi';

// Advanced numerical integration
export * from './integrate-numerical';
// Advanced CAS features
export * from './limits';
export * from './series';
export * from './simplify';
export * from './simplify-advanced';

// Step-by-step solver
export * from './step-solver';
