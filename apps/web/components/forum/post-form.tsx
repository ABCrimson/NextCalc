'use client';

/**
 * Forum Post Creation Form
 *
 * Glass morphism form for creating new forum posts.
 * Uses Apollo Client mutation with redirect on success.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useMutation } from '@apollo/client/react';
import {
  Send,
  Loader2,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TAGS, getTagStyle } from '@/components/forum/forum-shared';
import { CREATE_FORUM_POST_MUTATION, FORUM_POSTS_QUERY } from '@/lib/graphql/forum-operations';
import { cn } from '@/lib/utils';

export function PostForm() {
  const prefersReduced = useReducedMotion();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  interface CreateForumPostData {
    createForumPost: { id: string };
  }

  const [createPost, { loading }] = useMutation<CreateForumPostData>(CREATE_FORUM_POST_MUTATION, {
    refetchQueries: [{ query: FORUM_POSTS_QUERY }],
    onCompleted(data) {
      const postId = data.createForumPost.id;
      router.push(`/forum/${postId}`);
    },
    onError(error) {
      // Friendly message when API is unavailable (demo mode)
      if (error.message.includes('500') || error.message.includes('Failed to fetch') || error.message.includes('not successful')) {
        setValidationError('The forum is running in demo mode — posts cannot be saved without a database connection.');
      } else {
        setValidationError(error.message);
      }
    },
  });

  const toggleTag = useCallback((tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName],
    );
  }, []);

  const handleSubmit = useCallback(() => {
    setValidationError(null);

    if (!title.trim()) {
      setValidationError('Title is required');
      return;
    }
    if (title.trim().length < 5) {
      setValidationError('Title must be at least 5 characters');
      return;
    }
    if (!content.trim()) {
      setValidationError('Content is required');
      return;
    }
    if (content.trim().length < 10) {
      setValidationError('Content must be at least 10 characters');
      return;
    }
    if (selectedTags.length === 0) {
      setValidationError('Select at least one tag');
      return;
    }

    createPost({
      variables: {
        input: {
          title: title.trim(),
          content: content.trim(),
          tags: selectedTags,
        },
      },
    });
  }, [title, content, selectedTags, createPost]);

  return (
    <motion.div
      {...(prefersReduced
        ? {}
        : {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.4 },
          })}
      className="rounded-2xl border border-border p-6 backdrop-blur-md bg-card/50 space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="post-title" className="text-foreground">
          Title
        </Label>
        <Input
          id="post-title"
          placeholder="What's on your mind?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="bg-card/50 backdrop-blur-md border-border"
          maxLength={200}
        />
        <p className="text-[10px] text-muted-foreground text-right">
          {title.length}/200
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-content" className="text-foreground">
          Content
        </Label>
        <Textarea
          id="post-content"
          placeholder="Share your question, idea, or discovery. You can use markdown for formatting."
          value={content}
          onChange={e => setContent(e.target.value)}
          className="bg-card/50 backdrop-blur-md border-border min-h-[160px]"
          rows={6}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-foreground flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5 text-indigo-400" />
          Tags
        </Label>
        <div className="flex flex-wrap gap-2">
          {TAGS.map(tag => {
            const isSelected = selectedTags.includes(tag.name);
            return (
              <button
                key={tag.name}
                type="button"
                onClick={() => toggleTag(tag.name)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                  'border backdrop-blur-sm bg-gradient-to-r',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  getTagStyle(tag.name),
                  isSelected && 'ring-2 ring-white/20 scale-105',
                )}
              >
                #{tag.name}
              </button>
            );
          })}
        </div>
        {selectedTags.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Selected: {selectedTags.join(', ')}
          </p>
        )}
      </div>

      {validationError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {validationError}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_4px_24px_oklch(0.55_0.27_264/0.3)]"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Publish Post
        </Button>
      </div>
    </motion.div>
  );
}
