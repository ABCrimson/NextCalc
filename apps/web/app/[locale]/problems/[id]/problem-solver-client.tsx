'use client';

import { useActionState, useState, useCallback, useRef, useEffect } from 'react';
import { InteractiveSolver } from '@/components/math/interactive-solver';
import { submitAnswer, requestHint } from '@/app/actions/problems';
import type { ActionResult, SubmitAnswerResult, RequestHintResult } from '@/app/actions/problems';
import type { Problem } from '@nextcalc/math-engine/problems';

interface ProblemSolverClientProps {
  problem: Problem;
  relatedProblemIds: ReadonlyArray<string>;
}

const initialAnswerState: ActionResult<SubmitAnswerResult> = { success: false };
const initialHintState: ActionResult<RequestHintResult> = { success: false };

export function ProblemSolverClient({ problem, relatedProblemIds }: ProblemSolverClientProps) {
  const [answerState, submitAnswerAction, answerPending] = useActionState(submitAnswer, initialAnswerState);
  const [hintState, requestHintAction, hintPending] = useActionState(requestHint, initialHintState);
  void answerPending; // Available for loading UI in future enhancement
  void hintPending;
  void hintState;

  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    const id = setInterval(() => setTimeSpent((t) => t + 1), 1000);
    timerRef.current = id;
    return () => clearInterval(id);
  }, []);

  const handleSubmitAnswer = useCallback(
    (answer: string) => {
      const fd = new FormData();
      fd.set('problemId', problem.id);
      fd.set('answer', answer);
      fd.set('timeSpent', timeSpent.toString());
      fd.set('hintsUsed', revealedHints.length.toString());
      submitAnswerAction(fd);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    [problem.id, timeSpent, revealedHints.length, submitAnswerAction],
  );

  const handleRequestHint = useCallback(
    (hintIndex: number) => {
      const fd = new FormData();
      fd.set('problemId', problem.id);
      fd.set('hintOrder', (hintIndex + 1).toString());
      requestHintAction(fd);
      setRevealedHints((prev) => [...prev, hintIndex]);
    },
    [problem.id, requestHintAction],
  );

  const answerChecked = answerState.success && answerState.data !== undefined;
  const isCorrect = answerState.data?.correct ?? false;
  const currentScore = answerState.data?.pointsEarned ?? 0;

  return (
    <InteractiveSolver
      problem={problem}
      userAnswer=""
      onSubmitAnswer={handleSubmitAnswer}
      onRequestHint={handleRequestHint}
      revealedHints={revealedHints}
      answerChecked={answerChecked}
      isCorrect={isCorrect}
      currentScore={currentScore}
      timeSpent={timeSpent}
      {...(relatedProblemIds.length > 0 ? {
        onNextProblem: () => {
          window.location.href = `/problems/${relatedProblemIds[0]}`;
        },
      } : {})}
    />
  );
}
