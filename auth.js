/* auth.js — Google sign-in + cross-device sync via Supabase.
 *
 * Purely remote: owns the Supabase client, auth state, and CRUD against the
 * quiz_sessions / quiz_attempts tables (see supabase/schema.sql). All
 * localStorage handling and merge orchestration live in app.js.
 *
 * Degrades gracefully: if config.js has no Supabase values, or supabase-js
 * failed to load, every method is a safe no-op and the app runs anonymously.
 * No sync method ever throws — failures are logged and swallowed so the UI
 * never breaks. */

const Auth = (() => {
  let _client   = null;
  let _user     = null;          // { id, email, name, avatar } | null
  let _enabled  = false;
  const _cbs    = [];            // change subscribers

  // ── Init ───────────────────────────────────────────────────
  async function init() {
    const cfg = window.__CS_CONFIG__ || {};
    const url = (cfg.SUPABASE_URL || '').trim();
    const key = (cfg.SUPABASE_ANON_KEY || '').trim();

    if (!url || !key || !window.supabase?.createClient) {
      _enabled = false;
      return;                    // anonymous mode
    }

    try {
      _client = window.supabase.createClient(url, key, {
        auth: {
          persistSession:    true,
          autoRefreshToken:  true,
          detectSessionInUrl: true,   // completes the Google OAuth redirect
        },
      });
      _enabled = true;
    } catch (e) {
      console.warn('[auth] Supabase client init failed — anonymous mode.', e);
      _enabled = false;
      return;
    }

    // Seed current user, then subscribe to future changes.
    try {
      const { data } = await _client.auth.getSession();
      _setUser(data?.session?.user || null);
    } catch { _setUser(null); }

    _client.auth.onAuthStateChange((_event, session) => {
      _setUser(session?.user || null);
    });
  }

  function _setUser(u) {
    const next = u
      ? {
          id:     u.id,
          email:  u.email || '',
          name:   u.user_metadata?.full_name || u.user_metadata?.name || u.email || 'Account',
          avatar: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
        }
      : null;
    const changed = (next?.id || null) !== (_user?.id || null);
    _user = next;
    if (changed) _cbs.forEach(cb => { try { cb(_user); } catch { /* ignore */ } });
  }

  // ── Public auth surface ────────────────────────────────────
  function isEnabled()  { return _enabled; }
  function isSignedIn() { return !!_user; }
  function getUser()    { return _user; }
  function onChange(cb) { if (typeof cb === 'function') _cbs.push(cb); }

  async function signInWithGoogle() {
    if (!_enabled) return;
    // Return to the current page; detectSessionInUrl finishes the handshake.
    const redirectTo = window.location.origin + window.location.pathname;
    try {
      await _client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    } catch (e) { console.warn('[auth] signIn failed', e); }
  }

  async function signOut() {
    if (!_enabled) return;
    try { await _client.auth.signOut(); } catch (e) { console.warn('[auth] signOut failed', e); }
  }

  // ── Row mappers ────────────────────────────────────────────
  // Session: localStorage shape <-> quiz_sessions row.
  function _sessionToRow(s) {
    return {
      user_id:         _user.id,
      exam_code:       s.examCode,
      pool_ids:        s.poolIds || [],
      idx:             s.idx || 0,
      answers:         s.answers || {},
      settings:        s.settings || {},
      timer_remaining: s.timerRemaining ?? null,
      saved_at:        s.savedAt || Date.now(),
      updated_at:      new Date().toISOString(),
    };
  }
  function _rowToSession(r) {
    return {
      examCode:       r.exam_code,
      poolIds:        r.pool_ids || [],
      idx:            r.idx || 0,
      answers:        r.answers || {},
      settings:       r.settings || {},
      timerRemaining: r.timer_remaining ?? null,
      savedAt:        Number(r.saved_at) || 0,
    };
  }
  // Attempt: record shape <-> quiz_attempts row.
  function _attemptToRow(a) {
    return {
      id:           a.id,
      user_id:      _user.id,
      exam_code:    a.examCode,
      exam_name:    a.examName || null,
      total:        a.total,
      correct:      a.correct,
      pct:          a.pct,
      domains:      a.domains || [],
      settings:     a.settings || null,
      completed_at: a.completedAt,
    };
  }
  function _rowToAttempt(r) {
    return {
      id:          r.id,
      examCode:    r.exam_code,
      examName:    r.exam_name || '',
      total:       r.total,
      correct:     r.correct,
      pct:         r.pct,
      domains:     r.domains || [],
      settings:    r.settings || null,
      completedAt: r.completed_at,
    };
  }

  // ── Sync primitives (guarded, never throw) ─────────────────
  async function pushSession(session) {
    if (!_enabled || !_user || !session?.examCode) return;
    try {
      await _client.from('quiz_sessions').upsert(_sessionToRow(session), { onConflict: 'user_id,exam_code' });
    } catch (e) { console.warn('[auth] pushSession failed', e); }
  }

  async function deleteSession(examCode) {
    if (!_enabled || !_user || !examCode) return;
    try {
      await _client.from('quiz_sessions').delete().eq('user_id', _user.id).eq('exam_code', examCode);
    } catch (e) { console.warn('[auth] deleteSession failed', e); }
  }

  async function pullSessions() {
    if (!_enabled || !_user) return [];
    try {
      const { data, error } = await _client.from('quiz_sessions').select('*').eq('user_id', _user.id);
      if (error) throw error;
      return (data || []).map(_rowToSession);
    } catch (e) { console.warn('[auth] pullSessions failed', e); return []; }
  }

  async function saveAttempts(records) {
    if (!_enabled || !_user || !records?.length) return;
    try {
      const rows = records.map(_attemptToRow);
      // Idempotent: primary key is the client-generated id.
      await _client.from('quiz_attempts').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    } catch (e) { console.warn('[auth] saveAttempts failed', e); }
  }

  async function fetchAttempts(examCode) {
    if (!_enabled || !_user) return [];
    try {
      let q = _client.from('quiz_attempts').select('*').eq('user_id', _user.id);
      if (examCode) q = q.eq('exam_code', examCode);
      const { data, error } = await q.order('completed_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(_rowToAttempt);
    } catch (e) { console.warn('[auth] fetchAttempts failed', e); return []; }
  }

  return {
    init, isEnabled, isSignedIn, getUser, onChange,
    signInWithGoogle, signOut,
    pushSession, deleteSession, pullSessions, saveAttempts, fetchAttempts,
  };
})();
