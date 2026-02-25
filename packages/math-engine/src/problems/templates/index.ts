/**
 * Problem Templates - Exportable Problem Generation System
 *
 * @module problems/templates
 */

export * from './template-engine';
export * from './algebra-templates';
export * from './calculus-templates';
export * from './geometry-templates';
export * from './number-theory-templates';
export * from './probability-templates';

import { templateEngine } from './template-engine';
import { algebraTemplates } from './algebra-templates';
import { calculusTemplates } from './calculus-templates';
import { geometryTemplates } from './geometry-templates';
import { numberTheoryTemplates } from './number-theory-templates';
import { probabilityTemplates } from './probability-templates';

/**
 * Register all templates with the global engine
 */
export function registerAllTemplates(): void {
  templateEngine.registerMany([
    ...algebraTemplates,
    ...calculusTemplates,
    ...geometryTemplates,
    ...numberTheoryTemplates,
    ...probabilityTemplates,
  ]);
}

/**
 * Get all available templates
 */
export const allTemplates = [
  ...algebraTemplates,
  ...calculusTemplates,
  ...geometryTemplates,
  ...numberTheoryTemplates,
  ...probabilityTemplates,
];
