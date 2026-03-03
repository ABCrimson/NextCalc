/**
 * Convert a plain math expression string to LaTeX notation.
 *
 * Handles common functions (sqrt, sin, cos, tan), operators (* → \cdot),
 * and constants (pi → \pi).
 */
export function convertToLatex(expr: string): string {
  return expr
    .replace(/\*/g, '\\cdot ')
    .replace(/\^/g, '^')
    .replace(/sqrt\((.*?)\)/g, '\\sqrt{$1}')
    .replace(/pi/g, '\\pi')
    .replace(/sin\((.*?)\)/g, '\\sin($1)')
    .replace(/cos\((.*?)\)/g, '\\cos($1)')
    .replace(/tan\((.*?)\)/g, '\\tan($1)');
}
