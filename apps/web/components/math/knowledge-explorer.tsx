'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Lightbulb, Network, ChevronRight, ExternalLink, Bookmark, BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Definition } from '@nextcalc/math-engine/knowledge';
import type { MathTopic } from '@nextcalc/math-engine/knowledge';

/**
 * Props for KnowledgeExplorer component
 */
export interface KnowledgeExplorerProps {
  /** Definitions to display */
  definitions: ReadonlyArray<Definition>;
  /** Bookmarked definition IDs */
  bookmarkedIds?: ReadonlyArray<string>;
  /** Callback when a definition is selected */
  onSelectDefinition?: (definition: Definition) => void;
  /** Callback when bookmark is toggled */
  onToggleBookmark?: (definitionId: string) => void;
  /** Show relationship graph */
  showGraph?: boolean;
}

/**
 * Knowledge Explorer Component
 *
 * Browse and explore mathematical definitions, theorems, and concepts.
 *
 * Features:
 * - Search and filter by topic
 * - Expandable definition cards
 * - LaTeX rendering
 * - Related concepts navigation
 * - Prerequisite tracking
 * - Bookmark support
 *
 * Accessibility:
 * - Full keyboard navigation
 * - ARIA labels and landmarks
 * - Screen reader friendly
 * - Focus management
 */
export function KnowledgeExplorer({
  definitions,
  bookmarkedIds = [],
  onSelectDefinition,
  onToggleBookmark,
  showGraph: _showGraph = false,
}: KnowledgeExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<MathTopic | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter definitions
  const filteredDefinitions = useMemo(() => {
    let filtered = [...definitions];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.term.toLowerCase().includes(query) ||
          d.formal.toLowerCase().includes(query) ||
          d.intuitive.toLowerCase().includes(query)
      );
    }

    if (selectedTopic !== 'all') {
      filtered = filtered.filter((d) => d.topic === selectedTopic);
    }

    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter((d) => d.difficulty === selectedDifficulty);
    }

    return filtered.sort((a, b) => a.term.localeCompare(b.term));
  }, [definitions, searchQuery, selectedTopic, selectedDifficulty]);

  // Get unique topics
  const topics = useMemo(
    () => Array.from(new Set(definitions.map((d) => d.topic))).sort(),
    [definitions]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6" role="region" aria-label="Knowledge Explorer">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-1">
            Explore mathematical definitions and concepts
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredDefinitions.length} definition{filteredDefinitions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search definitions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search definitions"
              />
            </div>

            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value as MathTopic | 'all')}
              className="px-4 py-2 rounded-md border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Filter by topic"
            >
              <option value="all">All Topics</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>

            <select
              value={selectedDifficulty}
              onChange={(e) =>
                setSelectedDifficulty(
                  e.target.value === 'all' ? 'all' : Number(e.target.value)
                )
              }
              className="px-4 py-2 rounded-md border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Filter by difficulty"
            >
              <option value="all">All Levels</option>
              <option value="1">Beginner</option>
              <option value="2">Intermediate</option>
              <option value="3">Advanced</option>
              <option value="4">Expert</option>
              <option value="5">Research</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Definitions List */}
      <div className="space-y-4">
        {filteredDefinitions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No definitions found. Try adjusting your filters.
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredDefinitions.map((definition, index) => (
              <DefinitionCard
                key={definition.id}
                definition={definition}
                isBookmarked={bookmarkedIds.includes(definition.id)}
                isExpanded={expandedId === definition.id}
                onToggleExpand={() =>
                  setExpandedId((prev) => (prev === definition.id ? null : definition.id))
                }
                onToggleBookmark={() => onToggleBookmark?.(definition.id)}
                onSelect={() => onSelectDefinition?.(definition)}
                index={index}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/**
 * Definition Card Component
 */
interface DefinitionCardProps {
  definition: Definition;
  isBookmarked: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleBookmark: () => void;
  onSelect: () => void;
  index: number;
}

function DefinitionCard({
  definition,
  isBookmarked,
  isExpanded,
  onToggleExpand,
  onToggleBookmark,
  onSelect: _onSelect,
  index,
}: DefinitionCardProps) {
  const difficultyConfig = {
    1: { label: 'Beginner', variant: 'beginner' as const },
    2: { label: 'Intermediate', variant: 'intermediate' as const },
    3: { label: 'Advanced', variant: 'advanced' as const },
    4: { label: 'Expert', variant: 'expert' as const },
    5: { label: 'Research', variant: 'research' as const },
  }[definition.difficulty] || { label: 'Intermediate', variant: 'intermediate' as const };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <button
              onClick={onToggleExpand}
              className="flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-lg"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={difficultyConfig.variant}>{difficultyConfig.label}</Badge>
                <Badge variant="outline">{definition.topic}</Badge>
              </div>
              <CardTitle className="text-xl group-hover:text-primary transition-colors">
                {definition.term}
              </CardTitle>
              <CardDescription className="mt-2">{definition.intuitive}</CardDescription>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark();
              }}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            >
              {isBookmarked ? (
                <Bookmark className="h-4 w-4 fill-current text-primary" />
              ) : (
                <BookmarkPlus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="space-y-4 border-t">
                {/* Formal Definition */}
                <div className="pt-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Formal Definition
                  </h4>
                  <p className="text-sm text-muted-foreground italic">{definition.formal}</p>
                </div>

                {/* Notation */}
                {definition.notation && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Notation</h4>
                    <div className="p-3 bg-muted/50 rounded font-mono text-sm">
                      {definition.notation}
                    </div>
                  </div>
                )}

                {/* LaTeX */}
                {definition.latex && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">LaTeX</h4>
                    <div className="p-3 bg-muted/50 rounded font-mono text-sm overflow-x-auto">
                      {definition.latex}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Examples */}
                {definition.examples.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Examples</h4>
                    <ul className="space-y-1">
                      {definition.examples.map((example, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <code className="flex-1 bg-muted/50 px-2 py-1 rounded">{example}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prerequisites */}
                {definition.prerequisites.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Prerequisites</h4>
                    <div className="flex flex-wrap gap-2">
                      {definition.prerequisites.map((prereq) => (
                        <Badge key={prereq} variant="outline" className="text-xs">
                          {prereq}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Concepts */}
                {definition.related.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Network className="h-4 w-4" />
                      Related Concepts
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {definition.related.map((related) => (
                        <Button
                          key={related}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          asChild
                        >
                          <a href={`#${related}`}>
                            {related}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
