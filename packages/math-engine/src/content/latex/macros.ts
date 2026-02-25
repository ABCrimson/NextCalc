/**
 * LaTeX Macros - Custom Commands and Shortcuts
 *
 * Provides common LaTeX macros for mathematical notation
 */

/**
 * Standard mathematical macros
 */
export const standardMacros: Record<string, string> = {
  // Sets
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',

  // Calculus
  '\\diff': '\\mathrm{d}',
  '\\derivative': '\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}',
  '\\pderivative': '\\frac{\\partial #1}{\\partial #2}',

  // Linear algebra
  '\\norm': '\\left\\lVert #1 \\right\\rVert',
  '\\abs': '\\left| #1 \\right|',
  '\\inner': '\\left\\langle #1, #2 \\right\\rangle',

  // Probability
  '\\Prob': '\\mathbb{P}',
  '\\Expect': '\\mathbb{E}',
  '\\Var': '\\mathrm{Var}',

  // Logic
  '\\implies': '\\Rightarrow',
  '\\iff': '\\Leftrightarrow',

  // Common functions
  '\\floor': '\\left\\lfloor #1 \\right\\rfloor',
  '\\ceil': '\\left\\lceil #1 \\right\\rceil',
};

/**
 * NextCalc-specific macros
 */
export const nextcalcMacros: Record<string, string> = {
  '\\answer': '\\boxed{#1}',
  '\\hint': '\\textit{Hint: #1}',
  '\\solution': '\\textbf{Solution:}',
  '\\step': '\\textrm{Step #1:}',
};

/**
 * All macros combined
 */
export const allMacros: Record<string, string> = {
  ...standardMacros,
  ...nextcalcMacros,
};

/**
 * Expand macros in LaTeX string
 */
export function expandMacros(latex: string, macros = allMacros): string {
  let result = latex;

  for (const [macro, expansion] of Object.entries(macros)) {
    // Handle macros with parameters
    if (expansion.includes('#')) {
      const paramCount = (expansion.match(/#\d/g) || []).length;
      const macroName = macro.replace(/^\\/, '');

      // Build regex for macro with parameters
      let pattern = `\\\\${macroName}`;
      for (let i = 1; i <= paramCount; i++) {
        pattern += '\\{([^}]+)\\}';
      }

      const regex = new RegExp(pattern, 'g');

      result = result.replace(regex, (...matches) => {
        let expanded = expansion;
        for (let i = 1; i <= paramCount; i++) {
          expanded = expanded.replace(new RegExp(`#${i}`, 'g'), matches[i]);
        }
        return expanded;
      });
    } else {
      // Simple replacement
      const regex = new RegExp(macro.replace(/\\/g, '\\\\'), 'g');
      result = result.replace(regex, expansion);
    }
  }

  return result;
}
