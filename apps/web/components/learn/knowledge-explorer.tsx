'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Book, Bookmark, ChevronRight, ExternalLink, Lightbulb, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DisplayMath } from '@/components/ui/math-renderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type MathTopic, TopicTag } from '@/components/ui/topic-tag';
import { cn, fuzzyMatch } from '@/lib/utils';

/**
 * Knowledge item types
 */
export type KnowledgeItemType = 'definition' | 'theorem' | 'proof' | 'example' | 'concept';

export interface KnowledgeItem {
  id: string;
  type: KnowledgeItemType;
  title: string;
  content: string;
  mathExpression?: string;
  topic: MathTopic;
  relatedItems?: string[];
  tags?: string[];
  examples?: Array<{
    title: string;
    content: string;
    mathExpression?: string;
  }>;
  references?: Array<{
    title: string;
    url: string;
  }>;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
}

/**
 * KnowledgeExplorer Component
 *
 * Interactive knowledge base explorer with definitions, theorems, and proofs.
 *
 * @example
 * ```tsx
 * <KnowledgeExplorer
 *   items={knowledgeBase}
 *   onItemSelect={(item) => console.log('Selected:', item)}
 * />
 * ```
 *
 * Features:
 * - Topic tree navigation
 * - Definition and theorem cards
 * - Proof displays with LaTeX
 * - Related concepts linking
 * - Search functionality
 * - Bookmark/favorites system
 * - Interactive examples
 *
 * Accessibility:
 * - Keyboard navigation
 * - ARIA landmarks
 * - Screen reader friendly
 */

export interface KnowledgeExplorerProps {
  /** Knowledge base items */
  items: KnowledgeItem[];

  /** Callback when item is selected */
  onItemSelect?: (item: KnowledgeItem) => void;

  /** Callback when item is bookmarked */
  onToggleBookmark?: (itemId: string) => void;

  /** Bookmarked item IDs */
  bookmarkedIds?: Set<string>;

  /** Additional CSS classes */
  className?: string;
}

export function KnowledgeExplorer({
  items,
  onItemSelect,
  onToggleBookmark,
  bookmarkedIds = new Set(),
  className,
}: KnowledgeExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic] = useState<MathTopic | null>(null);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [activeTab, setActiveTab] = useState<KnowledgeItemType | 'all'>('all');

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (
        searchQuery &&
        !fuzzyMatch(item.title, searchQuery) &&
        !fuzzyMatch(item.content, searchQuery)
      ) {
        return false;
      }
      if (selectedTopic && item.topic !== selectedTopic) {
        return false;
      }
      if (activeTab !== 'all' && item.type !== activeTab) {
        return false;
      }
      return true;
    });
  }, [items, searchQuery, selectedTopic, activeTab]);

  // Get related items
  const relatedItems = useMemo(() => {
    if (!selectedItem?.relatedItems) return [];
    return items.filter((item) => selectedItem.relatedItems?.includes(item.id));
  }, [selectedItem, items]);

  const handleItemSelect = (item: KnowledgeItem) => {
    setSelectedItem(item);
    onItemSelect?.(item);
  };

  const typeColors: Record<KnowledgeItemType, string> = {
    definition: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    theorem: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    proof: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    example: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    concept: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return (
    <div className={cn('grid gap-6 lg:grid-cols-3', className)}>
      {/* Sidebar - Item List */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Base</CardTitle>
            <CardDescription>Explore mathematical concepts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search knowledge base"
              />
            </div>

            {/* Type Filter Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as KnowledgeItemType | 'all')}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="definition">Def</TabsTrigger>
                <TabsTrigger value="theorem">Thm</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Item List */}
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-md',
                        selectedItem?.id === item.id && 'border-primary',
                      )}
                      onClick={() => handleItemSelect(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleItemSelect(item);
                        }
                      }}
                    >
                      <CardHeader className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Badge className={cn('mb-2', typeColors[item.type])}>{item.type}</Badge>
                            <CardTitle className="text-sm">{item.title}</CardTitle>
                          </div>
                          {onToggleBookmark && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleBookmark(item.id);
                              }}
                              aria-label={
                                bookmarkedIds.has(item.id) ? 'Remove bookmark' : 'Add bookmark'
                              }
                            >
                              <Bookmark
                                className={cn(
                                  'h-4 w-4',
                                  bookmarkedIds.has(item.id) && 'fill-primary text-primary',
                                )}
                                aria-hidden="true"
                              />
                            </Button>
                          )}
                        </div>
                        <TopicTag topic={item.topic} size="sm" />
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}

                {filteredItems.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No items found</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Item Detail */}
      <div className="lg:col-span-2">
        <AnimatePresence mode="wait">
          {selectedItem ? (
            <motion.div
              key={selectedItem.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Badge className={cn('mb-2', typeColors[selectedItem.type])}>
                        {selectedItem.type.toUpperCase()}
                      </Badge>
                      <CardTitle className="text-2xl">{selectedItem.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <TopicTag topic={selectedItem.topic} />
                        {selectedItem.difficulty && (
                          <Badge variant="outline">{selectedItem.difficulty}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Main Content */}
                  <div className="prose dark:prose-invert max-w-none">
                    <p>{selectedItem.content}</p>
                  </div>

                  {/* Math Expression */}
                  {selectedItem.mathExpression && (
                    <div className="p-6 bg-muted/50 rounded-lg">
                      <DisplayMath expression={selectedItem.mathExpression} />
                    </div>
                  )}

                  {/* Examples */}
                  {selectedItem.examples && selectedItem.examples.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <Lightbulb className="h-5 w-5 text-yellow-500" aria-hidden="true" />
                          <span>Examples</span>
                        </div>
                        {selectedItem.examples.map((example, index) => (
                          <Card key={index} className="bg-muted/50">
                            <CardHeader>
                              <CardTitle className="text-base">{example.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <p className="text-sm">{example.content}</p>
                              {example.mathExpression && (
                                <div className="p-4 bg-background rounded-lg">
                                  <DisplayMath expression={example.mathExpression} />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Related Items */}
                  {relatedItems.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="text-lg font-semibold">Related Concepts</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {relatedItems.map((item) => (
                            <Button
                              key={item.id}
                              variant="outline"
                              className="justify-start h-auto p-3"
                              onClick={() => handleItemSelect(item)}
                            >
                              <ChevronRight
                                className="h-4 w-4 mr-2 flex-shrink-0"
                                aria-hidden="true"
                              />
                              <div className="text-left">
                                <div className="font-medium text-sm">{item.title}</div>
                                <div className="text-xs text-muted-foreground">{item.type}</div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* References */}
                  {selectedItem.references && selectedItem.references.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="text-lg font-semibold">References</div>
                        <div className="space-y-2">
                          {selectedItem.references.map((ref, index) => (
                            <a
                              key={index}
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />
                              {ref.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-[600px] text-center">
                <Book className="h-16 w-16 text-muted-foreground mb-4" aria-hidden="true" />
                <CardTitle className="mb-2">Select an Item</CardTitle>
                <CardDescription>
                  Choose a definition, theorem, or concept to explore
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
