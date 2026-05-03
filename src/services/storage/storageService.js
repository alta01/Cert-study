/**
 * storageService.js
 *
 * Persists exam session data (answers, history, settings) to localStorage.
 * Designed to be replaced by an IndexedDB or remote API layer in the future.
 */

const KEYS = {
  SESSION: 'certstudy_session',
  HISTORY: 'certstudy_history',
  SETTINGS: 'certstudy_settings',
};

/** Saves the current exam session state. */
export function saveSession(state) {
  try {
    localStorage.setItem(KEYS.SESSION, JSON.stringify(state));
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

/** Loads the saved session state, or returns null. */
export function loadSession() {
  try {
    const raw = localStorage.getItem(KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Clears the saved session. */
export function clearSession() {
  localStorage.removeItem(KEYS.SESSION);
}

/** Appends a completed session summary to the history log. */
export function saveSessionToHistory(summary) {
  try {
    const history = loadHistory();
    history.unshift({ ...summary, completedAt: new Date().toISOString() });
    // Keep last 50 sessions
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(history.slice(0, 50)));
  } catch {
    // ignore
  }
}

/** Returns the full history log array. */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Saves user-level settings (e.g. preferred feedbackMode). */
export function saveSettings(settings) {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/** Loads user-level settings, or returns defaults. */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : { feedbackMode: 'end' };
  } catch {
    return { feedbackMode: 'end' };
  }
}
