'use client';

import { checkGradedAnswer } from '@nextcalc/math-engine/equivalence';
import {
  allTemplates,
  type Mistake,
  type ProblemInstance,
  type ProblemTemplate,
  randomSeedString,
  registerAllTemplates,
  templateEngine,
} from '@nextcalc/math-engine/problems/templates';
import {
  AlertCircle,
  CheckCircle2,
  Flame,
  Lightbulb,
  Link2,
  ListChecks,
  RefreshCw,
  Save,
  Target,
  Timer,
  XCircle,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { KeyboardEvent, ReactNode } from 'react';
import { useActionState, useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  completePracticeSession,
  type PracticeSessionResult,
  type StartSessionResult,
  startPracticeSession,
} from '@/app/actions/practice';
import type { ActionResult } from '@/app/actions/problems';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MathRenderer } from '@/components/ui/math-renderer';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Idempotent (Map.set) — safe on repeated module evaluation and under
// React StrictMode; generation itself is pure and seed-local.
registerAllTemplates();

export interface DrillModeProps {
  /** Template id from the URL (?template=…) */
  templateId: string;
  /** Seed from the URL (?seed=…) — same seed always reproduces the problem */
  seed: string;
  /** Called when the drill needs a new URL state (new problem / template) */
  onSeedChange: (next: { templateId: string; seed: string }) => void;
  /** Called when the user exits the drill back to session setup */
  onExit: () => void;
}

interface DrillTally {
  attempted: number;
  correct: number;
  streak: number;
  bestStreak: number;
}

const DIFFICULTY_VARIANTS = ['beginner', 'intermediate', 'advanced', 'expert', 'research'] as const;

/** "linear-equation-basic" → "Linear Equation Basic" */
function humanizeId(id: string): string {
  return id
    .split('-')
    .map((word) => (word.length > 0 ? word[0]?.toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Group registered, machine-gradable templates by category (stable
 * module-level data). Templates with no `canonical` (e.g. linear-inequality,
 * prime-factorization) are excluded: their only fallback is exact
 * case-insensitive string match against the raw LaTeX display answer, which
 * no reasonable free-form student input can satisfy — offering them in the
 * infinite-drill picker would make those drills effectively ungradeable.
 */
const TEMPLATE_GROUPS: ReadonlyArray<{ category: string; templates: ProblemTemplate[] }> = (() => {
  const groups = new Map<string, ProblemTemplate[]>();
  for (const template of allTemplates) {
    if (!template.canonical) continue;
    const list = groups.get(template.category);
    if (list) {
      list.push(template);
    } else {
      groups.set(template.category, [template]);
    }
  }
  return [...groups.entries()].map(([category, templates]) => ({ category, templates }));
})();

/**
 * Render template text with embedded $…$ / $$…$$ LaTeX via KaTeX.
 * The splitter keeps nested braces intact because the delimiter is `$`.
 */
function MathText({ text, className }: { text: string; className?: string }) {
  const segments = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$)/g);
  return (
    <span className={cn('whitespace-pre-line', className)}>
      {segments.map((segment, index) => {
        const key = `${index}-${segment}`;
        if (segment.startsWith('$$') && segment.endsWith('$$')) {
          return <MathRenderer key={key} expression={segment.slice(2, -2)} displayMode={true} />;
        }
        if (segment.startsWith('$') && segment.endsWith('$') && segment.length > 1) {
          return <MathRenderer key={key} expression={segment.slice(1, -1)} displayMode={false} />;
        }
        return <span key={key}>{segment}</span>;
      })}
    </span>
  );
}

/** Build the `completePracticeSession` FormData for one drill segment. */
function buildCompleteFormData(
  sessionId: string,
  segment: DrillTally,
  totalTimeSeconds: number,
  topicSlug: string,
): FormData {
  const attempted = Math.max(1, segment.attempted);
  const fd = new FormData();
  fd.set('sessionId', sessionId);
  fd.set('score', String(segment.correct / attempted));
  fd.set('accuracy', String(segment.correct / attempted));
  fd.set('bestStreak', String(segment.bestStreak));
  fd.set('totalTime', String(Math.round(totalTimeSeconds)));
  fd.set('pointsEarned', String(10 * segment.correct));
  fd.set('correctCount', String(segment.correct));
  fd.set('topicSlug', topicSlug.toLowerCase());
  return fd;
}

/** Small stat chip for the running tally row. */
function StatChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm font-medium text-foreground">
      {icon}
      {children}
    </span>
  );
}

// ─── Per-problem card (remounted via key on every new seed) ──────────────────

interface DrillProblemCardProps {
  instance: ProblemInstance;
  template: ProblemTemplate;
  /** Reports the FIRST check of this problem: (correct, timeSpentSeconds) */
  onAnswered: (correct: boolean, timeSpentSeconds: number) => void;
}

function DrillProblemCard({ instance, template, onAnswered }: DrillProblemCardProps) {
  const t = useTranslations('practice');
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; mistake: Mistake | null } | null>(
    null,
  );
  const [hintsShown, setHintsShown] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const recordedRef = useRef(false);

  // Tick the per-problem timer; freeze once the first answer is checked.
  const onTick = useEffectEvent(() => {
    if (!recordedRef.current) {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000));
    }
  });
  useEffect(() => {
    const id = setInterval(() => {
      onTick();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleCheck = () => {
    const trimmed = input.trim();
    if (trimmed.length === 0) return;

    const correct = instance.graded
      ? checkGradedAnswer(trimmed, instance.graded).correct
      : trimmed.toLowerCase() === instance.solution.answer.trim().toLowerCase();

    const mistake = correct
      ? null
      : (template.commonMistakes
          .map((detector) => detector(instance.parameters, trimmed))
          .find((found): found is Mistake => found !== null) ?? null);

    setFeedback({ correct, mistake });

    if (!recordedRef.current) {
      recordedRef.current = true;
      onAnswered(correct, Math.max(1, Math.round((Date.now() - startRef.current) / 1000)));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCheck();
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="size-4 text-primary" aria-hidden="true" />
            {humanizeId(template.id)}
          </CardTitle>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <Timer className="size-3.5" aria-hidden="true" />
            {elapsed}s
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statement */}
        <div className="rounded-lg bg-muted/30 border border-border p-4 text-lg leading-relaxed">
          <MathText text={instance.statement} />
        </div>

        {/* Answer input */}
        <div className="space-y-1.5">
          <Label htmlFor={`drill-answer-${instance.seed}`}>{t('drill.answerLabel')}</Label>
          <div className="flex gap-2">
            <Input
              id={`drill-answer-${instance.seed}`}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setFeedback(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('drill.answerPlaceholder')}
              className="font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <Button
              onClick={handleCheck}
              disabled={input.trim().length === 0}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <CheckCircle2 className="size-4 mr-2" aria-hidden="true" />
              {t('drill.checkAnswer')}
            </Button>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'rounded-md border p-3 flex items-start gap-2.5',
              feedback.correct
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30',
            )}
          >
            {feedback.correct ? (
              <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-green-500" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  feedback.correct
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400',
                )}
              >
                {feedback.correct ? t('drill.correct') : t('drill.incorrect')}
              </p>
              {feedback.mistake && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    <MathText text={feedback.mistake.explanation} />
                  </p>
                  <p>
                    <MathText text={feedback.mistake.correction} />
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progressive hints */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHintsShown((shown) => Math.min(shown + 1, instance.hints.length))}
              disabled={hintsShown >= instance.hints.length}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Lightbulb className="size-3.5 mr-1.5 text-yellow-500" aria-hidden="true" />
              {t('drill.showHint')}
            </Button>
            {hintsShown > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('drill.hintCost', { count: hintsShown })}
              </span>
            )}
          </div>
          {hintsShown > 0 && (
            <ol className="space-y-1.5">
              {instance.hints.slice(0, hintsShown).map((hint, index) => (
                <li
                  key={hint}
                  className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-sm text-foreground"
                >
                  <span className="font-semibold text-muted-foreground mr-1.5">{index + 1}.</span>
                  <MathText text={hint} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Drill shell (tally, session persistence, URL state) ────────────────────

/**
 * DrillMode — infinite randomized practice.
 *
 * Problems are generated deterministically from (templateId, seed); the
 * seed lives in the URL so every problem is shareable and reproducible.
 * Grading uses the CAS-backed graded answer (equivalent forms accepted).
 * Session aggregates persist via startPracticeSession /
 * completePracticeSession — per-attempt rows are intentionally NOT
 * written for generated problems (Attempt.problemId is a required FK to
 * the static Problem table).
 */
export function DrillMode({ templateId, seed, onSeedChange, onExit }: DrillModeProps) {
  const t = useTranslations('practice');
  const prefersReduced = useReducedMotion() ?? false;

  const [tally, setTally] = useState<DrillTally>({
    attempted: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
  });
  const [copied, setCopied] = useState(false);
  // Plain state (not a ref) — a ref write never triggers a re-render, so
  // reading a ref directly in the "End drill & save" button's `disabled`
  // expression would leave it stuck disabled after the session resolves.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedThisSegment, setSavedThisSegment] = useState(false);
  const totalTimeRef = useRef(0);
  const sessionRequestedRef = useRef(false);
  // Topic the *current* tally segment belongs to. Captured once, when the
  // segment's session is requested — never re-derived from the live
  // `template` prop, so switching the template mid-drill can't relabel
  // problems already answered under a different topic.
  const segmentTopicRef = useRef<string | null>(null);

  const [startState, startAction] = useActionState<ActionResult<StartSessionResult>, FormData>(
    startPracticeSession,
    { success: false },
  );
  const [completeState, completeAction] = useActionState<
    ActionResult<PracticeSessionResult>,
    FormData
  >(completePracticeSession, { success: false });

  useEffect(() => {
    if (startState.success && startState.data?.sessionId) {
      setSessionId(startState.data.sessionId);
      setSavedThisSegment(false);
    }
  }, [startState]);

  useEffect(() => {
    if (completeState.success) {
      setSavedThisSegment(true);
    }
  }, [completeState]);

  const template = templateEngine.getTemplate(templateId);
  let instance: ProblemInstance | null = null;
  if (template) {
    try {
      instance = templateEngine.generate(templateId, seed);
    } catch {
      instance = null;
    }
  }

  /** Reset all per-segment tracking so the next answer starts a fresh session. */
  const resetSegment = () => {
    setTally({ attempted: 0, correct: 0, streak: 0, bestStreak: 0 });
    setSessionId(null);
    setSavedThisSegment(false);
    sessionRequestedRef.current = false;
    segmentTopicRef.current = null;
    totalTimeRef.current = 0;
  };

  const handleAnswered = (correct: boolean, timeSpentSeconds: number) => {
    totalTimeRef.current += timeSpentSeconds;
    setTally((prev) => {
      const streak = correct ? prev.streak + 1 : 0;
      return {
        attempted: prev.attempted + 1,
        correct: prev.correct + (correct ? 1 : 0),
        streak,
        bestStreak: Math.max(prev.bestStreak, streak),
      };
    });

    // Create the practice session on the first checked answer
    if (!sessionRequestedRef.current && template) {
      sessionRequestedRef.current = true;
      segmentTopicRef.current = template.category;
      const fd = new FormData();
      fd.set('topic', template.category);
      fd.set('questionCount', '1');
      fd.set('adaptive', 'false');
      startAction(fd);
    }
  };

  const handleGenerateAnother = () => {
    onSeedChange({ templateId, seed: randomSeedString() });
  };

  const handleTemplateChange = (nextTemplateId: string) => {
    // Switching templates changes the topic — attribute everything
    // answered so far to the topic the segment actually started under,
    // then start a clean segment for the new topic. Without this, all
    // correct answers (across every topic practiced) would be attributed
    // to whichever template happens to be selected when the drill ends.
    if (sessionId && segmentTopicRef.current && tally.attempted > 0) {
      completeAction(
        buildCompleteFormData(sessionId, tally, totalTimeRef.current, segmentTopicRef.current),
      );
    }
    resetSegment();
    onSeedChange({ templateId: nextTemplateId, seed: randomSeedString() });
  };

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard permission denied — silent fail
      });
  };

  const handleEndDrill = () => {
    if (!sessionId || !segmentTopicRef.current || tally.attempted === 0) return;
    completeAction(
      buildCompleteFormData(sessionId, tally, totalTimeRef.current, segmentTopicRef.current),
    );
  };

  const sessionErrored =
    (sessionRequestedRef.current && !startState.success && Boolean(startState.error)) ||
    (!completeState.success && Boolean(completeState.error));

  return (
    <m.div
      className="max-w-3xl mx-auto space-y-6"
      {...(prefersReduced
        ? {}
        : {
            initial: { opacity: 0, y: 16 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
          })}
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">
          <span className="bg-linear-to-r/oklab from-orange-400 via-rose-400 to-pink-400 bg-clip-text text-transparent">
            {t('drill.title')}
          </span>
        </h1>
        <p className="text-muted-foreground">{t('drill.description')}</p>
      </div>

      {/* Template + seed controls */}
      <Card className="border-border">
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="drill-template">{t('drill.templateLabel')}</Label>
              <Select value={templateId} onValueChange={handleTemplateChange}>
                <SelectTrigger
                  id="drill-template"
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_GROUPS.map(({ category, templates }) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{humanizeId(category)}</SelectLabel>
                      {templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {humanizeId(tpl.id)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="drill-seed">{t('drill.seedLabel')}</Label>
              <div className="flex items-center gap-2">
                <code
                  id="drill-seed"
                  className="inline-flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 font-mono text-sm text-foreground"
                >
                  {seed}
                </code>
                {template && (
                  <Badge
                    variant={DIFFICULTY_VARIANTS[template.difficulty - 1] ?? 'intermediate'}
                    aria-label={`${template.difficulty}/5`}
                  >
                    {'★'.repeat(template.difficulty)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Tally chips */}
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <StatChip
              icon={<ListChecks className="size-3.5 text-muted-foreground" aria-hidden="true" />}
            >
              {t('drill.attempted', { count: tally.attempted })}
            </StatChip>
            <StatChip
              icon={<CheckCircle2 className="size-3.5 text-green-500" aria-hidden="true" />}
            >
              {t('drill.correctCount', { count: tally.correct })}
            </StatChip>
            <StatChip
              icon={
                <Flame
                  className={cn(
                    'size-3.5',
                    tally.streak > 0 ? 'text-orange-500' : 'text-muted-foreground',
                  )}
                  aria-hidden="true"
                />
              }
            >
              {t('drill.streak', { count: tally.streak })}
            </StatChip>
          </div>
        </CardContent>
      </Card>

      {/* Problem (remounts per template+seed, resetting per-problem state) */}
      {instance && template ? (
        <DrillProblemCard
          key={`${templateId}:${seed}`}
          instance={instance}
          template={template}
          onAnswered={handleAnswered}
        />
      ) : (
        <Card className="border-border">
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertCircle className="size-8 mx-auto mb-3 opacity-60" aria-hidden="true" />
            <p>{t('noProblemsFound')}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleGenerateAnother}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          style={{
            background: 'linear-gradient(135deg, oklch(0.60 0.22 55), oklch(0.58 0.20 25))',
          }}
        >
          <RefreshCw className="size-4 mr-2" aria-hidden="true" />
          {t('drill.generateAnother')}
        </Button>
        <Button
          variant="outline"
          onClick={handleCopyLink}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Link2 className="size-4 mr-2" aria-hidden="true" />
          {copied ? t('drill.linkCopied') : t('drill.copyLink')}
        </Button>
        <Button
          variant="outline"
          onClick={handleEndDrill}
          disabled={tally.attempted === 0 || !sessionId || savedThisSegment}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Save className="size-4 mr-2" aria-hidden="true" />
          {t('drill.endDrill')}
        </Button>
        <Button
          variant="ghost"
          onClick={onExit}
          className="ml-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t('backToConfig')}
        </Button>
      </div>

      {/* Session persistence status */}
      {savedThisSegment && (
        <p
          className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2"
          role="status"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t('drill.sessionSaved')}
        </p>
      )}
      {!savedThisSegment && sessionErrored && (
        <p className="text-sm text-muted-foreground flex items-center gap-2" role="status">
          <AlertCircle className="size-4" aria-hidden="true" />
          {t('drill.signInToSave')}
        </p>
      )}
    </m.div>
  );
}
