/**
 * Markdown Parser with LaTeX Support
 *
 * Parses markdown documents with:
 * - Frontmatter metadata (YAML)
 * - LaTeX math blocks ($$...$$)
 * - Inline math ($...$)
 * - Standard markdown features
 */

/**
 * Parsed markdown document
 */
export interface ParsedMarkdown {
  /** Frontmatter metadata */
  metadata: Record<string, unknown>;
  /** Document title (from h1 or frontmatter) */
  title?: string;
  /** Sections of the document */
  sections: MarkdownSection[];
  /** Raw content (without frontmatter) */
  rawContent: string;
  /** Math blocks extracted */
  mathBlocks: MathBlock[];
}

/**
 * Document section
 */
export interface MarkdownSection {
  /** Section heading */
  heading: string;
  /** Heading level (1-6) */
  level: number;
  /** Section content */
  content: string;
  /** Subsections */
  subsections: MarkdownSection[];
}

/**
 * Math block
 */
export interface MathBlock {
  /** Type of math block */
  type: 'display' | 'inline';
  /** LaTeX content */
  content: string;
  /** Position in document */
  position: number;
  /** Unique ID */
  id: string;
}

/**
 * Parse markdown with LaTeX support
 */
export function parseMarkdown(source: string): ParsedMarkdown {
  const { metadata, content } = parseFrontmatter(source);
  const mathBlocks = extractMathBlocks(content);
  const sections = parseSections(content);

  const title = (metadata['title'] as string) || extractTitle(content);
  return {
    metadata,
    ...(title && { title }),
    sections,
    rawContent: content,
    mathBlocks,
  };
}

/**
 * Parse YAML frontmatter
 */
function parseFrontmatter(source: string): { metadata: Record<string, unknown>; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = source.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content: source };
  }

  const yamlContent = match[1];
  if (!yamlContent) {
    return { metadata: {}, content: source };
  }
  const metadata = parseYAML(yamlContent);
  const content = source.slice(match[0].length);

  return { metadata, content };
}

/**
 * Simple YAML parser (supports basic key-value pairs)
 */
function parseYAML(yaml: string): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  const lines = yaml.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const rawValue = trimmed.slice(colonIndex + 1).trim();

    // Parse value types
    let value: unknown;
    if (rawValue === 'true') value = true;
    else if (rawValue === 'false') value = false;
    else if (rawValue === 'null') value = null;
    else if (/^-?\d+$/.test(rawValue)) value = parseInt(rawValue, 10);
    else if (/^-?\d+\.\d+$/.test(rawValue)) value = parseFloat(rawValue);
    else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      // Parse arrays
      value = rawValue
        .slice(1, -1)
        .split(',')
        .map((v: string) => v.trim().replace(/^['"]|['"]$/g, ''));
    } else {
      // Remove quotes
      value = rawValue.replace(/^['"]|['"]$/g, '');
    }

    metadata[key] = value;
  }

  return metadata;
}

/**
 * Extract math blocks (both display and inline)
 */
function extractMathBlocks(content: string): MathBlock[] {
  const blocks: MathBlock[] = [];
  let idCounter = 0;

  // Extract display math ($$...$$)
  const displayRegex = /\$\$([\s\S]*?)\$\$/g;
  let match: RegExpExecArray | null;

  while ((match = displayRegex.exec(content)) !== null) {
    if (match[1] !== undefined) {
      blocks.push({
        type: 'display',
        content: match[1].trim(),
        position: match.index,
        id: `math-${idCounter++}`,
      });
    }
  }

  // Extract inline math ($...$)
  const inlineRegex = /(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)/g;

  while ((match = inlineRegex.exec(content)) !== null) {
    if (match[1] !== undefined) {
      blocks.push({
        type: 'inline',
        content: match[1].trim(),
        position: match.index,
        id: `math-${idCounter++}`,
      });
    }
  }

  return blocks.sort((a, b) => a.position - b.position);
}

/**
 * Parse document into sections
 */
function parseSections(content: string): MarkdownSection[] {
  const lines = content.split('\n');
  const sections: MarkdownSection[] = [];
  let currentSection: MarkdownSection | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
      }

      // Start new section
      if (headingMatch[1] && headingMatch[2]) {
        const level = headingMatch[1].length;
        const heading = headingMatch[2];

        currentSection = {
          heading,
          level,
          content: '',
          subsections: [],
        };
      }
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    sections.push(currentSection);
  }

  return buildSectionHierarchy(sections);
}

/**
 * Build hierarchical section structure
 */
function buildSectionHierarchy(flatSections: MarkdownSection[]): MarkdownSection[] {
  const root: MarkdownSection[] = [];
  const stack: MarkdownSection[] = [];

  for (const section of flatSections) {
    // Pop sections from stack that are at same or deeper level
    const topSection = stack[stack.length - 1];
    while (stack.length > 0 && topSection && topSection.level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(section);
    } else {
      const parent = stack[stack.length - 1];
      if (parent) {
        parent.subsections.push(section);
      }
    }

    stack.push(section);
  }

  return root;
}

/**
 * Extract title from content (first h1)
 */
function extractTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1];
}

/**
 * Extract table of contents
 */
export function generateTOC(sections: MarkdownSection[], maxLevel = 3): TOCEntry[] {
  const toc: TOCEntry[] = [];

  function traverse(sections: MarkdownSection[], parentPath = ''): void {
    for (const section of sections) {
      if (section.level <= maxLevel) {
        const id = slugify(section.heading);
        const path = parentPath ? `${parentPath}/${id}` : id;

        toc.push({
          id,
          title: section.heading,
          level: section.level,
          path,
        });

        traverse(section.subsections, path);
      }
    }
  }

  traverse(sections);
  return toc;
}

/**
 * Table of contents entry
 */
export interface TOCEntry {
  id: string;
  title: string;
  level: number;
  path: string;
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

/**
 * Extract code blocks
 */
export function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const code = match[2];
    if (code !== undefined) {
      blocks.push({
        language: match[1] || 'text',
        code: code.trim(),
        position: match.index,
      });
    }
  }

  return blocks;
}

/**
 * Code block
 */
export interface CodeBlock {
  language: string;
  code: string;
  position: number;
}

/**
 * Extract links
 */
export function extractLinks(content: string): Link[] {
  const links: Link[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match[1] && match[2]) {
      links.push({
        text: match[1],
        url: match[2],
        position: match.index,
      });
    }
  }

  return links;
}

/**
 * Link
 */
export interface Link {
  text: string;
  url: string;
  position: number;
}

/**
 * Extract images
 */
export function extractImages(content: string): Image[] {
  const images: Image[] = [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const alt = match[1];
    const url = match[2];
    if (alt !== undefined && url) {
      images.push({
        alt,
        url,
        position: match.index,
      });
    }
  }

  return images;
}

/**
 * Image
 */
export interface Image {
  alt: string;
  url: string;
  position: number;
}
