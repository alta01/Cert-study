import { useState, useCallback } from 'react';
import { useExamContext } from '../context/ExamContext.jsx';

/**
 * useExam
 *
 * Convenience hook that surfaces the most-used exam session actions and
 * computed values from ExamContext.
 */
export function useExam() {
  const { state, dispatch } = useExamContext();

  const selectAnswer = useCallback(
    (questionId, choiceId) => {
      const question = state.questions.find((q) => q.id === questionId);
      dispatch({
        type: 'SELECT_ANSWER',
        questionId,
        choiceId,
        multiAnswer: question?.multiAnswer ?? false,
      });
    },
    [dispatch, state.questions]
  );

  const submitAnswer = useCallback(
    (questionId) => dispatch({ type: 'SUBMIT_ANSWER', questionId }),
    [dispatch]
  );

  const nextQuestion = useCallback(
    () => dispatch({ type: 'NEXT_QUESTION' }),
    [dispatch]
  );

  const prevQuestion = useCallback(
    () => dispatch({ type: 'PREV_QUESTION' }),
    [dispatch]
  );

  const submitSession = useCallback(
    () => dispatch({ type: 'SUBMIT_SESSION' }),
    [dispatch]
  );

  const resetSession = useCallback(
    () => dispatch({ type: 'RESET_SESSION' }),
    [dispatch]
  );

  const currentQuestion = state.questions[state.currentIndex] ?? null;
  const currentAnswer = currentQuestion
    ? (state.answers[currentQuestion.id] ?? { selected: [], submitted: false })
    : null;

  return {
    exam: state.exam,
    questions: state.questions,
    currentIndex: state.currentIndex,
    currentQuestion,
    currentAnswer,
    answers: state.answers,
    feedbackMode: state.feedbackMode,
    sessionComplete: state.sessionComplete,
    selectAnswer,
    submitAnswer,
    nextQuestion,
    prevQuestion,
    submitSession,
    resetSession,
  };
}
