import { createContext, useContext, useReducer } from 'react';

/**
 * ExamContext
 *
 * Holds global state for the active exam session:
 *   - exam metadata (slug, title, domains)
 *   - user settings (feedbackMode, etc.)
 *   - current question index and answers
 *   - session results
 */

const ExamContext = createContext(null);

const initialState = {
  /** The loaded exam manifest object */
  exam: null,
  /** Flat array of question objects for the current session */
  questions: [],
  /** Index of the currently displayed question */
  currentIndex: 0,
  /**
   * Map of questionId → { selected: string[], submitted: boolean }
   * Tracks per-question answer state.
   */
  answers: {},
  /**
   * 'immediate' – show correct answer + explanation right after answering
   * 'end'       – hold all feedback until the session is submitted
   */
  feedbackMode: 'end',
  /** Whether the session has been fully submitted */
  sessionComplete: false,
};

function examReducer(state, action) {
  switch (action.type) {
    case 'LOAD_EXAM':
      return {
        ...initialState,
        exam: action.exam,
        questions: action.questions,
        feedbackMode: state.feedbackMode,
      };

    case 'SET_FEEDBACK_MODE':
      return { ...state, feedbackMode: action.mode };

    case 'SELECT_ANSWER': {
      const { questionId, choiceId, multiAnswer } = action;
      const existing = state.answers[questionId] ?? { selected: [], submitted: false };
      let selected;
      if (multiAnswer) {
        selected = existing.selected.includes(choiceId)
          ? existing.selected.filter((id) => id !== choiceId)
          : [...existing.selected, choiceId];
      } else {
        selected = [choiceId];
      }
      return {
        ...state,
        answers: {
          ...state.answers,
          [questionId]: { ...existing, selected },
        },
      };
    }

    case 'SUBMIT_ANSWER': {
      const { questionId } = action;
      const existing = state.answers[questionId] ?? { selected: [], submitted: false };
      return {
        ...state,
        answers: {
          ...state.answers,
          [questionId]: { ...existing, submitted: true },
        },
      };
    }

    case 'NEXT_QUESTION':
      return {
        ...state,
        currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1),
      };

    case 'PREV_QUESTION':
      return {
        ...state,
        currentIndex: Math.max(state.currentIndex - 1, 0),
      };

    case 'JUMP_TO_QUESTION':
      return { ...state, currentIndex: action.index };

    case 'SUBMIT_SESSION':
      return { ...state, sessionComplete: true };

    case 'RESET_SESSION':
      return { ...initialState, exam: state.exam };

    default:
      return state;
  }
}

export function ExamProvider({ children }) {
  const [state, dispatch] = useReducer(examReducer, initialState);
  return (
    <ExamContext.Provider value={{ state, dispatch }}>
      {children}
    </ExamContext.Provider>
  );
}

export function useExamContext() {
  const ctx = useContext(ExamContext);
  if (!ctx) throw new Error('useExamContext must be used inside <ExamProvider>');
  return ctx;
}
