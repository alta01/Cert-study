import { useState, useEffect, useCallback } from 'react';
import { loadExamQuestions } from '../services/questions/questionService.js';
import { normalizeQuestion } from '../utils/questionParser.js';

/**
 * useQuestions
 *
 * Loads and manages question data for a given exam slug.
 * Optionally shuffles questions and can accept externally loaded data.
 *
 * @param {string} examSlug
 * @param {object} [options]
 * @param {boolean} [options.shuffle=false]
 */
export function useQuestions(examSlug, { shuffle = false } = {}) {
  const [questions, setQuestions] = useState([]);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!examSlug) return;
    setLoading(true);
    setError(null);
    try {
      const { exam, questions: raw } = await loadExamQuestions(examSlug);
      const parsedQuestions = raw.map((q, idx) => normalizeQuestion(q, idx));
      setExam(exam);
      setQuestions(shuffle ? shuffleArray(parsedQuestions) : parsedQuestions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [examSlug, shuffle]);

  useEffect(() => {
    load();
  }, [load]);

  return { exam, questions, loading, error, reload: load };
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
