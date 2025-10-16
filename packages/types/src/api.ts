/**
 * API and backend types
 */

// User
export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly createdAt: Date;
}

// Worksheet
export interface Worksheet {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly content: WorksheetContent;
  readonly isPublic: boolean;
  readonly userId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WorksheetContent {
  readonly cells: readonly WorksheetCell[];
}

export interface WorksheetCell {
  readonly id: string;
  readonly type: 'expression' | 'markdown' | 'plot';
  readonly content: string;
  readonly result?: string;
}

// Forum
export interface ForumPost {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly upvotes: number;
  readonly userId: string;
  readonly createdAt: Date;
}
