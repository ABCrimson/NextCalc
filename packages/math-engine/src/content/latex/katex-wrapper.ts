/**
 * KaTeX Wrapper - Enhanced LaTeX Rendering
 *
 * Provides KaTeX integration with:
 * - Custom macros
 * - Error handling
 * - Display vs inline modes
 * - Equation numbering
 */

/**
 * KaTeX render options
 */
export interface KaTeXOptions {
  /** Display mode (block) vs inline */
  displayMode?: boolean;
  /** Throw on error or recover */
  throwOnError?: boolean;
  /** Error color */
  errorColor?: string;
  /** Custom macros */
  macros?: Record<string, string>;
  /** Enable equation numbering */
  numbering?: boolean;
  /** Trust certain commands */
  trust?: boolean;
}

/**
 * Default KaTeX options
 */
export const defaultKaTeXOptions: KaTeXOptions = {
  displayMode: false,
  throwOnError: false,
  errorColor: '#cc0000',
  macros: {},
  numbering: false,
  trust: false,
};

/**
 * Render LaTeX to HTML string
 *
 * Note: In a real implementation, this would use the actual KaTeX library.
 * This is a placeholder that formats the LaTeX for client-side rendering.
 */
export function renderLaTeX(latex: string, options: KaTeXOptions = {}): string {
  const opts = { ...defaultKaTeXOptions, ...options };

  try {
    // In production, this would call katex.renderToString()
    // For now, we wrap it for client-side rendering

    if (opts.displayMode) {
      return `<span class="katex-display">\\[${latex}\\]</span>`;
    }

    return `<span class="katex">\\(${latex}\\)</span>`;
  } catch (error) {
    if (opts.throwOnError) {
      throw error;
    }

    return `<span class="katex-error" style="color: ${opts.errorColor}">${escapeHtml(latex)}</span>`;
  }
}

/**
 * Render LaTeX to DOM element
 *
 * Note: This would use katex.render() in production
 */
export function renderLaTeXToElement(
  latex: string,
  element: { innerHTML: string },
  options: KaTeXOptions = {},
): void {
  const html = renderLaTeX(latex, options);
  element.innerHTML = html;
}

/**
 * Auto-render math in text
 *
 * Replaces $...$ and $$...$$ with rendered math
 */
export function autoRenderMath(text: string, options: KaTeXOptions = {}): string {
  // Replace display math
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
    return renderLaTeX(latex, { ...options, displayMode: true });
  });

  // Replace inline math
  text = text.replace(/\$([^$]+)\$/g, (_, latex) => {
    return renderLaTeX(latex, { ...options, displayMode: false });
  });

  return text;
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

/**
 * Parse LaTeX environments
 */
export function parseLaTeXEnvironments(latex: string): LaTeXEnvironment[] {
  const environments: LaTeXEnvironment[] = [];
  const regex = /\\begin\{(\w+)\}([\s\S]*?)\\end\{\1\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(latex)) !== null) {
    if (match[1] && match[2] !== undefined) {
      environments.push({
        name: match[1],
        content: match[2].trim(),
        position: match.index,
      });
    }
  }

  return environments;
}

/**
 * LaTeX environment
 */
export interface LaTeXEnvironment {
  name: string;
  content: string;
  position: number;
}

/**
 * Extract equation references
 */
export function extractEquationRefs(latex: string): string[] {
  const refs: string[] = [];
  const regex = /\\label\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(latex)) !== null) {
    if (match[1]) {
      refs.push(match[1]);
    }
  }

  return refs;
}
