/**
 * Markdown Renderer with LaTeX Support
 *
 * Renders parsed markdown to HTML with:
 * - KaTeX integration for math
 * - Syntax highlighting for code
 * - Responsive images
 * - Table of contents
 */

import type { MarkdownSection, MathBlock, ParsedMarkdown } from './parser';

/**
 * Render options
 */
export interface RenderOptions {
  /** Include table of contents */
  includeTOC?: boolean;
  /** Maximum TOC depth */
  maxTOCDepth?: number;
  /** Syntax highlighting theme */
  syntaxTheme?: string;
  /** Add line numbers to code blocks */
  lineNumbers?: boolean;
  /** Custom CSS classes */
  classes?: {
    container?: string;
    heading?: string;
    paragraph?: string;
    code?: string;
    math?: string;
  };
}

/**
 * Render markdown to HTML
 */
export function renderMarkdown(doc: ParsedMarkdown, options: RenderOptions = {}): string {
  let html = '';

  // Add container
  html += `<div class="${options.classes?.container || 'markdown-content'}">\n`;

  // Add title
  if (doc.title) {
    html += `<h1>${escapeHtml(doc.title)}</h1>\n`;
  }

  // Add metadata
  if (Object.keys(doc.metadata).length > 0) {
    html += renderMetadata(doc.metadata);
  }

  // Add table of contents
  if (options.includeTOC) {
    html += renderTOC(doc.sections, options.maxTOCDepth);
  }

  // Render sections
  for (const section of doc.sections) {
    html += renderSection(section, doc.mathBlocks, options);
  }

  html += '</div>\n';

  return html;
}

/**
 * Render metadata block
 */
function renderMetadata(metadata: Record<string, unknown>): string {
  let html = '<div class="metadata">\n';

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'title') continue; // Already rendered as h1

    html += `<div class="meta-item">`;
    html += `<span class="meta-key">${escapeHtml(key)}:</span> `;
    html += `<span class="meta-value">${escapeHtml(String(value))}</span>`;
    html += `</div>\n`;
  }

  html += '</div>\n';
  return html;
}

/**
 * Render table of contents
 */
function renderTOC(sections: MarkdownSection[], maxDepth = 3): string {
  let html = '<nav class="table-of-contents">\n';
  html += '<h2>Table of Contents</h2>\n';
  html += '<ul>\n';

  function renderTOCList(sections: MarkdownSection[], currentDepth = 1): string {
    let html = '';

    for (const section of sections) {
      if (currentDepth > maxDepth) break;

      const id = slugify(section.heading);
      html += `<li><a href="#${id}">${escapeHtml(section.heading)}</a>`;

      if (section.subsections.length > 0 && currentDepth < maxDepth) {
        html += '\n<ul>\n';
        html += renderTOCList(section.subsections, currentDepth + 1);
        html += '</ul>\n';
      }

      html += '</li>\n';
    }

    return html;
  }

  html += renderTOCList(sections);
  html += '</ul>\n</nav>\n';

  return html;
}

/**
 * Render a section
 */
function renderSection(
  section: MarkdownSection,
  mathBlocks: MathBlock[],
  options: RenderOptions,
): string {
  const id = slugify(section.heading);
  let html = '';

  html += `<section id="${id}">\n`;
  html += `<h${section.level} class="${options.classes?.heading || ''}">${escapeHtml(section.heading)}</h${section.level}>\n`;

  // Render content
  html += renderContent(section.content, mathBlocks, options);

  // Render subsections
  for (const subsection of section.subsections) {
    html += renderSection(subsection, mathBlocks, options);
  }

  html += '</section>\n';

  return html;
}

/**
 * Render content with inline markdown
 */
function renderContent(content: string, _mathBlocks: MathBlock[], options: RenderOptions): string {
  let html = '';

  // Split into paragraphs
  const paragraphs = content.split(/\n\n+/);

  for (const para of paragraphs) {
    if (!para.trim()) continue;

    // Check if it's a code block
    if (para.startsWith('```')) {
      html += renderCodeBlock(para, options);
      continue;
    }

    // Check if it's a list
    if (para.match(/^[-*+]\s/m)) {
      html += renderList(para);
      continue;
    }

    // Regular paragraph
    html += `<p class="${options.classes?.paragraph || ''}">${renderInline(para)}</p>\n`;
  }

  return html;
}

/**
 * Render inline markdown (bold, italic, links, inline math)
 */
function renderInline(text: string): string {
  // Inline math ($...$)
  text = text.replace(/\$([^$]+)\$/g, (_, math) => {
    return `<span class="math inline">\\(${math}\\)</span>`;
  });

  // Display math ($$...$$)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    return `<div class="math display">\\[${math}\\]</div>`;
  });

  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  return text;
}

/**
 * Render code block
 */
function renderCodeBlock(block: string, options: RenderOptions): string {
  const match = block.match(/```(\w+)?\n([\s\S]*?)```/);
  if (!match) return '';

  const language = match[1] || 'text';
  const code = match[2];

  let html = `<pre class="${options.classes?.code || ''}"><code class="language-${language}">`;
  html += escapeHtml(code || '');
  html += '</code></pre>\n';

  return html;
}

/**
 * Render list
 */
function renderList(text: string): string {
  const lines = text.split('\n');
  let html = '<ul>\n';

  for (const line of lines) {
    const match = line.match(/^[-*+]\s+(.+)$/);
    if (match && match[1]) {
      html += `<li>${renderInline(match[1])}</li>\n`;
    }
  }

  html += '</ul>\n';
  return html;
}

/**
 * Escape HTML special characters
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
 * Convert heading to URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
