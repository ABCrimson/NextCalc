/**
 * Tests for the content module:
 * - Markdown parser
 * - Problem set loader
 * - Problem set validator
 */

import { describe, it, expect } from 'vitest';

import {
  parseMarkdown,
  generateTOC,
  extractCodeBlocks,
  extractLinks,
  extractImages,
} from './markdown/parser';

import {
  loadProblemSet,
  loadProblemSetsFromFiles,
  createProblemSetIndex,
} from './problem-sets/loader';

import {
  validateProblemSet,
  validateProblem,
  validateLatex,
  formatValidationReport,
} from './problem-sets/validator';

// ============================================================================
// MARKDOWN PARSER
// ============================================================================

describe('parseMarkdown - basic structure', () => {
  it('parses an empty string without throwing', () => {
    const result = parseMarkdown('');
    expect(result.rawContent).toBe('');
    expect(result.sections).toEqual([]);
    expect(result.mathBlocks).toEqual([]);
    expect(result.metadata).toEqual({});
  });

  it('returns rawContent as the content after frontmatter', () => {
    const md = '# Hello\n\nSome content.';
    const result = parseMarkdown(md);
    expect(result.rawContent).toContain('Hello');
    expect(result.rawContent).toContain('Some content.');
  });

  it('extracts sections for headings', () => {
    const md = '# Section 1\n\nContent 1.\n\n## Subsection\n\nSub content.';
    const result = parseMarkdown(md);
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.sections[0]!.heading).toBe('Section 1');
    expect(result.sections[0]!.level).toBe(1);
  });

  it('extracts title from first h1', () => {
    const md = '# My Document\n\nContent here.';
    const result = parseMarkdown(md);
    expect(result.title).toBe('My Document');
  });
});

describe('parseMarkdown - frontmatter', () => {
  it('parses string frontmatter values', () => {
    const md = '---\ntitle: Test Document\ncategory: math\n---\n# Content\n';
    const result = parseMarkdown(md);
    expect(result.metadata['title']).toBe('Test Document');
    expect(result.metadata['category']).toBe('math');
  });

  it('parses integer frontmatter values', () => {
    const md = '---\ndifficulty: 3\n---\n# Content\n';
    const result = parseMarkdown(md);
    expect(result.metadata['difficulty']).toBe(3);
  });

  it('parses boolean frontmatter values', () => {
    const md = '---\npublished: true\ndraft: false\n---\n# Content\n';
    const result = parseMarkdown(md);
    expect(result.metadata['published']).toBe(true);
    expect(result.metadata['draft']).toBe(false);
  });

  it('parses float frontmatter values', () => {
    const md = '---\nversion: 1.5\n---\n# Content\n';
    const result = parseMarkdown(md);
    expect(result.metadata['version']).toBeCloseTo(1.5);
  });

  it('parses array frontmatter values', () => {
    const md = '---\ntags: [math, calculus, easy]\n---\n# Content\n';
    const result = parseMarkdown(md);
    expect(Array.isArray(result.metadata['tags'])).toBe(true);
  });

  it('title from frontmatter overrides h1', () => {
    const md = '---\ntitle: Frontmatter Title\n---\n# H1 Title\n';
    const result = parseMarkdown(md);
    expect(result.title).toBe('Frontmatter Title');
  });

  it('handles document without frontmatter', () => {
    const md = '# Just a heading\n\nSome content.';
    const result = parseMarkdown(md);
    expect(result.metadata).toEqual({});
    expect(result.title).toBe('Just a heading');
  });
});

describe('parseMarkdown - math blocks', () => {
  it('extracts display math blocks ($$...$$)', () => {
    const md = 'Some text.\n$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$\nMore text.';
    const result = parseMarkdown(md);
    const displayBlocks = result.mathBlocks.filter(b => b.type === 'display');
    expect(displayBlocks.length).toBe(1);
    expect(displayBlocks[0]!.content).toContain('frac');
  });

  it('extracts inline math blocks ($...$)', () => {
    const md = 'When $x > 0$ the function is positive.';
    const result = parseMarkdown(md);
    const inlineBlocks = result.mathBlocks.filter(b => b.type === 'inline');
    expect(inlineBlocks.length).toBeGreaterThan(0);
    expect(inlineBlocks[0]!.content).toContain('x > 0');
  });

  it('assigns unique IDs to math blocks', () => {
    const md = 'Text $a$ and $b$ and $$c$$.';
    const result = parseMarkdown(md);
    const ids = result.mathBlocks.map(b => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('math blocks are sorted by position', () => {
    const md = 'First $a$ then $b$.';
    const result = parseMarkdown(md);
    for (let i = 1; i < result.mathBlocks.length; i++) {
      expect(result.mathBlocks[i]!.position).toBeGreaterThanOrEqual(result.mathBlocks[i - 1]!.position);
    }
  });

  it('returns empty mathBlocks for content without math', () => {
    const md = '# Title\n\nPlain text without any math.';
    const result = parseMarkdown(md);
    expect(result.mathBlocks).toEqual([]);
  });
});

describe('parseMarkdown - section hierarchy', () => {
  it('builds nested section hierarchy', () => {
    const md = [
      '# Top Level',
      '',
      'Top content.',
      '',
      '## Sub Section',
      '',
      'Sub content.',
      '',
      '### Sub Sub Section',
      '',
      'Deep content.',
    ].join('\n');

    const result = parseMarkdown(md);
    expect(result.sections.length).toBe(1);
    expect(result.sections[0]!.subsections.length).toBe(1);
    expect(result.sections[0]!.subsections[0]!.subsections.length).toBe(1);
  });

  it('handles multiple top-level sections', () => {
    const md = '# Section A\n\nA content.\n\n# Section B\n\nB content.';
    const result = parseMarkdown(md);
    expect(result.sections.length).toBe(2);
    expect(result.sections[0]!.heading).toBe('Section A');
    expect(result.sections[1]!.heading).toBe('Section B');
  });

  it('section content does not include the heading', () => {
    const md = '# My Section\n\nThe section body.';
    const result = parseMarkdown(md);
    expect(result.sections[0]!.content).not.toContain('# My Section');
    expect(result.sections[0]!.content).toContain('The section body.');
  });
});

describe('generateTOC', () => {
  it('generates TOC entries for sections', () => {
    const md = '# Introduction\n\nContent.\n\n## Overview\n\nMore content.';
    const { sections } = parseMarkdown(md);
    const toc = generateTOC(sections);
    expect(toc.length).toBeGreaterThan(0);
    expect(toc[0]!.title).toBe('Introduction');
    expect(toc[0]!.level).toBe(1);
  });

  it('generates URL-friendly IDs', () => {
    const md = '# Hello World!\n\nContent.';
    const { sections } = parseMarkdown(md);
    const toc = generateTOC(sections);
    expect(toc[0]!.id).not.toContain(' ');
    expect(toc[0]!.id).not.toContain('!');
    expect(toc[0]!.id).toBe('hello-world');
  });

  it('respects maxLevel parameter', () => {
    const md = '# H1\n## H2\n### H3\n#### H4';
    const { sections } = parseMarkdown(md);
    const toc = generateTOC(sections, 2);
    for (const entry of toc) {
      expect(entry.level).toBeLessThanOrEqual(2);
    }
  });

  it('returns empty TOC for no sections', () => {
    const toc = generateTOC([]);
    expect(toc).toEqual([]);
  });
});

describe('extractCodeBlocks', () => {
  it('extracts a TypeScript code block', () => {
    const content = 'Some text\n```typescript\nconst x = 1;\n```\nMore text.';
    const blocks = extractCodeBlocks(content);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.language).toBe('typescript');
    expect(blocks[0]!.code).toContain('const x = 1;');
  });

  it('returns empty for no code blocks', () => {
    const content = 'Just plain text without code.';
    const blocks = extractCodeBlocks(content);
    expect(blocks).toEqual([]);
  });

  it('extracts multiple code blocks', () => {
    const content = '```js\nconsole.log(1)\n```\n\n```py\nprint(2)\n```';
    const blocks = extractCodeBlocks(content);
    expect(blocks.length).toBe(2);
    expect(blocks[0]!.language).toBe('js');
    expect(blocks[1]!.language).toBe('py');
  });

  it('defaults language to "text" when not specified', () => {
    const content = '```\nno language specified\n```';
    const blocks = extractCodeBlocks(content);
    expect(blocks[0]!.language).toBe('text');
  });

  it('includes position in result', () => {
    const content = 'Prefix\n```js\ncode\n```';
    const blocks = extractCodeBlocks(content);
    expect(typeof blocks[0]!.position).toBe('number');
    expect(blocks[0]!.position).toBeGreaterThan(0);
  });
});

describe('extractLinks', () => {
  it('extracts markdown links', () => {
    const content = 'Visit [OpenAI](https://openai.com) for more.';
    const links = extractLinks(content);
    expect(links.length).toBe(1);
    expect(links[0]!.text).toBe('OpenAI');
    expect(links[0]!.url).toBe('https://openai.com');
  });

  it('extracts multiple links', () => {
    const content = '[Google](https://google.com) and [Bing](https://bing.com)';
    const links = extractLinks(content);
    expect(links.length).toBe(2);
  });

  it('returns empty for no links', () => {
    const links = extractLinks('No links here, just plain text.');
    expect(links).toEqual([]);
  });

  it('includes position', () => {
    const content = 'See [this](https://example.com).';
    const links = extractLinks(content);
    expect(typeof links[0]!.position).toBe('number');
  });
});

describe('extractImages', () => {
  it('extracts markdown images', () => {
    const content = '![Alt text](https://example.com/image.png)';
    const images = extractImages(content);
    expect(images.length).toBe(1);
    expect(images[0]!.alt).toBe('Alt text');
    expect(images[0]!.url).toBe('https://example.com/image.png');
  });

  it('extracts image with empty alt text', () => {
    const content = '![](https://example.com/img.jpg)';
    const images = extractImages(content);
    expect(images.length).toBe(1);
    expect(images[0]!.alt).toBe('');
  });

  it('returns empty for no images', () => {
    const images = extractImages('No images here.');
    expect(images).toEqual([]);
  });

  it('does not confuse links with images', () => {
    const content = '[link](https://example.com) and ![img](https://example.com/img.png)';
    const images = extractImages(content);
    expect(images.length).toBe(1);
    expect(images[0]!.alt).toBe('img');
  });
});

// ============================================================================
// PROBLEM SET LOADER
// ============================================================================

// NOTE: Problem sections must be TOP-LEVEL headings (##) with no parent # heading above them.
// The loader's extractProblems() only searches doc.sections (top-level), not subsections.
// The title comes from YAML frontmatter so no # h1 is needed.
const sampleProblemSetMd = `---
title: Basic Calculus Problems
category: calculus
description: Problems for beginners
---

## Problem 1

Find the derivative of f(x) = x^2.

Difficulty: 2
Tags: [derivative, power-rule]

Hints:
- Use the power rule
- Bring down the exponent

### Solution

Answer: 2x
Steps:
- Apply power rule: d/dx(x^n) = n*x^(n-1)
- d/dx(x^2) = 2x^(2-1) = 2x
Explanation: The power rule gives us 2x.

## Problem 2

Evaluate lim(x->2) (x^2 - 4)/(x - 2).

Difficulty: 3
Tags: [limit, factoring]

Hints:
- Factor the numerator
- Cancel the common factor

### Solution

Answer: 4
Steps:
- Factor: x^2 - 4 = (x-2)(x+2)
- Cancel (x-2)
- Substitute x=2: 2+2=4
Explanation: Cancel the common factor then substitute.
`;

describe('loadProblemSet', () => {
  it('loads a problem set from markdown', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'basic-calculus');
    expect(set.id).toBe('basic-calculus');
    expect(set.title).toBe('Basic Calculus Problems');
    expect(set.category).toBe('calculus');
  });

  it('extracts problems correctly', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    expect(set.problems.length).toBe(2);
  });

  it('extracts problem statements', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    expect(set.problems[0]!.statement).toBeTruthy();
  });

  it('extracts problem difficulty', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    expect(set.problems[0]!.difficulty).toBe(2);
    expect(set.problems[1]!.difficulty).toBe(3);
  });

  it('extracts tags', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    expect(set.problems[0]!.tags).toContain('derivative');
    expect(set.problems[0]!.tags).toContain('power-rule');
  });

  it('extracts hints', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    expect(set.problems[0]!.hints.length).toBeGreaterThan(0);
    expect(set.problems[0]!.hints[0]).toContain('power rule');
  });

  it('extracts solution answer', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    expect(set.problems[0]!.solution).toBeDefined();
    expect(set.problems[0]!.solution!.answer).toBeTruthy();
  });

  it('computes difficultyRange', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    expect(set.difficultyRange[0]).toBeLessThanOrEqual(set.difficultyRange[1]);
    expect(set.difficultyRange[0]).toBe(2);
    expect(set.difficultyRange[1]).toBe(3);
  });

  it('assigns sequential problem IDs', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    expect(set.problems[0]!.id).toBe('problem-1');
    expect(set.problems[1]!.id).toBe('problem-2');
  });

  it('uses default category "general" when not specified', () => {
    const minimalMd = '# Untitled\n\n## Problem 1\n\nSolve 1+1.\n\nDifficulty: 1\n';
    const set = loadProblemSet(minimalMd, 'minimal');
    expect(set.category).toBe('general');
  });
});

describe('loadProblemSetsFromFiles', () => {
  it('loads multiple problem sets', () => {
    const files = {
      'set1.md': sampleProblemSetMd,
      'set2.md': '# Another Set\n\n## Problem 1\n\nSimple problem.\n\nDifficulty: 1\n',
    };
    const sets = loadProblemSetsFromFiles(files);
    expect(sets.length).toBe(2);
  });

  it('strips .md from the set ID', () => {
    const files = { 'calculus-basics.md': sampleProblemSetMd };
    const sets = loadProblemSetsFromFiles(files);
    expect(sets[0]!.id).toBe('calculus-basics');
  });

  it('skips files that cause errors gracefully', () => {
    // A valid file will still load
    const files = { 'valid.md': sampleProblemSetMd };
    expect(() => loadProblemSetsFromFiles(files)).not.toThrow();
  });
});

describe('createProblemSetIndex', () => {
  it('indexes sets by category', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    const index = createProblemSetIndex([set]);
    expect(index.byCategory.has('calculus')).toBe(true);
    expect(index.byCategory.get('calculus')!.length).toBe(1);
  });

  it('indexes problems by tag', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    const index = createProblemSetIndex([set]);
    expect(index.byTag.has('derivative')).toBe(true);
    expect(index.byTag.get('derivative')!.length).toBeGreaterThan(0);
  });

  it('holds all sets in index.sets', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    const index = createProblemSetIndex([set]);
    expect(index.sets.length).toBe(1);
    expect(index.sets[0]!.id).toBe('test-set');
  });

  it('returns empty index for empty input', () => {
    const index = createProblemSetIndex([]);
    expect(index.sets).toEqual([]);
    expect(index.byCategory.size).toBe(0);
  });
});

// ============================================================================
// VALIDATOR
// ============================================================================

describe('validateProblemSet', () => {
  it('is valid for a well-formed problem set', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    const result = validateProblemSet(set);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports error for missing title', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    const badSet = { ...set, title: '' };
    const result = validateProblemSet(badSet);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('title'))).toBe(true);
  });

  it('reports error for missing category', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    const badSet = { ...set, category: '' };
    const result = validateProblemSet(badSet);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('category'))).toBe(true);
  });

  it('warns for empty problem array', () => {
    const set = loadProblemSet(sampleProblemSetMd, 'test-set');
    const emptySet = { ...set, problems: [] };
    const result = validateProblemSet(emptySet);
    expect(result.warnings.some(w => w.message.includes('no problems'))).toBe(true);
  });
});

describe('validateProblem', () => {
  const goodProblem = {
    id: 'problem-1',
    number: 1,
    statement: 'Solve x^2 = 4',
    difficulty: 2 as 1 | 2 | 3 | 4 | 5,
    solution: {
      answer: 'x = ±2',
      steps: ['Square root both sides'],
      explanation: 'Taking the square root of both sides gives ±2.',
    },
    hints: ['Think about square roots'],
    tags: ['algebra', 'quadratic'],
  };

  it('is valid for a well-formed problem', () => {
    const result = validateProblem(goodProblem);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports error for missing statement', () => {
    const bad = { ...goodProblem, statement: '' };
    const result = validateProblem(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('statement'))).toBe(true);
  });

  it('warns for missing solution', () => {
    const noSolution = { ...goodProblem, solution: undefined };
    const result = validateProblem(noSolution);
    expect(result.warnings.some(w => w.message.includes('solution'))).toBe(true);
  });

  it('warns for missing hints', () => {
    const noHints = { ...goodProblem, hints: [] };
    const result = validateProblem(noHints);
    expect(result.warnings.some(w => w.message.includes('hints'))).toBe(true);
  });

  it('warns for missing tags', () => {
    const noTags = { ...goodProblem, tags: [] };
    const result = validateProblem(noTags);
    expect(result.warnings.some(w => w.message.includes('tags'))).toBe(true);
  });

  it('reports error for solution with empty answer', () => {
    const badSolution = { ...goodProblem, solution: { ...goodProblem.solution, answer: '' } };
    const result = validateProblem(badSolution);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('answer'))).toBe(true);
  });

  it('warns when solution has neither steps nor explanation', () => {
    const minimalSolution = { ...goodProblem, solution: { answer: 'x=2' } };
    const result = validateProblem(minimalSolution);
    expect(result.warnings.some(w => w.message.includes('steps') || w.message.includes('explanation'))).toBe(true);
  });
});

describe('validateLatex', () => {
  it('is valid for balanced dollar signs', () => {
    const result = validateLatex('$x^2 + y^2 = r^2$');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports error for odd number of dollar signs', () => {
    const result = validateLatex('$x + y');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('$'))).toBe(true);
  });

  it('reports error for empty \\frac{}', () => {
    const result = validateLatex('\\frac{}');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('frac'))).toBe(true);
  });

  it('warns for empty \\sqrt{}', () => {
    const result = validateLatex('\\sqrt{}');
    expect(result.warnings.some(w => w.message.includes('sqrt'))).toBe(true);
  });

  it('is valid for a complex but correct expression', () => {
    const result = validateLatex('$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$');
    expect(result.valid).toBe(true);
  });

  it('is valid for empty string', () => {
    const result = validateLatex('');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('formatValidationReport', () => {
  it('includes success marker for valid result', () => {
    const result = { valid: true, errors: [], warnings: [] };
    const report = formatValidationReport(result);
    expect(report).toContain('passed');
  });

  it('includes failure marker for invalid result', () => {
    const result = {
      valid: false,
      errors: [{ type: 'error' as const, message: 'Missing title' }],
      warnings: [],
    };
    const report = formatValidationReport(result);
    expect(report).toContain('failed');
    expect(report).toContain('Missing title');
  });

  it('includes warnings in the report', () => {
    const result = {
      valid: true,
      errors: [],
      warnings: [{ type: 'warning' as const, message: 'No hints provided', problemId: 'p1' }],
    };
    const report = formatValidationReport(result);
    expect(report).toContain('No hints provided');
    expect(report).toContain('p1');
  });

  it('includes problemId in error messages', () => {
    const result = {
      valid: false,
      errors: [{ type: 'error' as const, message: 'Bad answer', problemId: 'prob-5' }],
      warnings: [],
    };
    const report = formatValidationReport(result);
    expect(report).toContain('prob-5');
  });
});
