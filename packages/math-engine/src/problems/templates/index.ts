/**
 * Problem Templates - Exportable Problem Generation System
 *
 * @module problems/templates
 */

export * from './template-engine.js';
export * from './algebra-templates.js';
export * from './calculus-templates.js';
export * from './geometry-templates.js';
export * from './number-theory-templates.js';
export * from './probability-templates.js';

import { templateEngine } from './template-engine.js';
import { algebraTemplates } from './algebra-templates.js';
import { calculusTemplates } from './calculus-templates.js';
import { geometryTemplates } from './geometry-templates.js';
import { numberTheoryTemplates } from './number-theory-templates.js';
import { probabilityTemplates } from './probability-templates.js';

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
