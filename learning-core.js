/* Pure learning rules. No storage, network, or UI dependencies. */
globalThis.LearningCore = (() => {
  const confidenceValues = ['guess', 'unsure', 'confident'];
  function revision(q) {
    const input = JSON.stringify([q.type || 'choice', q.question, q.options || null, q.answer || null, q.hotspots || null, q.image || null, q.tolerance ?? null]);
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16);
  }
  function concept(q) { return { id: q.conceptId || `d${q.domain}:topic:${q.topic || 'unclassified'}`, name: q.conceptName || q.topic || 'Unclassified topic' }; }
  function priority(e) {
    if (!e) return 0;
    if (!e.correct) return e.confidence === 'confident' ? 4 : 3;
    return e.confidence === 'guess' ? 2 : e.confidence === 'unsure' ? 1 : 0;
  }
  function evidence(questions, events) {
    const byId = new Map(questions.map(q => [q.id, q])), histories = new Map();
    for (const e of events) {
      const q = byId.get(e.questionId);
      if (!q || e.revision !== revision(q)) continue;
      if (!histories.has(q.id)) histories.set(q.id, []);
      histories.get(q.id).push(e);
    }
    const states = new Map();
    for (const q of questions) {
      const history = (histories.get(q.id) || []).sort((a, b) => a.answeredAt - b.answeredAt || a.id.localeCompare(b.id));
      // Immediate retries after feedback are practice, not independent evidence.
      const independent = history.filter(e => e.mode !== 'retry');
      const latest = independent.at(-1) || history.at(-1) || null;
      const lastMiss = independent.filter(e => !e.correct).at(-1)?.answeredAt || 0;
      const dates = new Set(independent.filter(e => e.correct && e.confidence === 'confident' && e.answeredAt >= lastMiss).map(e => new Date(e.answeredAt).toISOString().slice(0, 10)));
      const confirmed = !!latest && priority(latest) === 0 && dates.size >= 2;
      states.set(q.id, { question: q, latest, history, priority: priority(latest), confirmed });
    }
    return states;
  }
  function summarize(questions, events) {
    const states = evidence(questions, events), groups = new Map();
    for (const q of questions) {
      const c = concept(q), key = `${q.domain}:${c.id}`;
      if (!groups.has(key)) groups.set(key, { key, conceptId: c.id, name: c.name, domain: q.domain, domainName: q.domainName, available: 0, tested: 0, correct: 0, misses: 0, confidentErrors: 0, uncertain: 0, confirmed: 0, priority: 0, lastPracticed: 0 });
      const g = groups.get(key), s = states.get(q.id); g.available++;
      if (!s.latest) continue;
      g.tested++; g.correct += s.latest.correct ? 1 : 0; g.misses += s.latest.correct ? 0 : 1;
      g.confidentErrors += !s.latest.correct && s.latest.confidence === 'confident' ? 1 : 0;
      g.uncertain += s.latest.correct && s.priority > 0 ? 1 : 0;
      g.confirmed += s.confirmed ? 1 : 0; g.priority = Math.max(g.priority, s.priority);
      g.lastPracticed = Math.max(g.lastPracticed, s.history.at(-1).answeredAt);
    }
    return [...groups.values()].map(g => ({ ...g,
      status: !g.tested ? 'Not assessed' : g.priority >= 3 ? 'Needs review' : g.priority > 0 ? 'Needs confirmation' : g.tested < 3 ? 'Limited evidence' : g.confirmed >= 3 && g.confirmed === g.tested && g.tested === g.available ? 'Retained in practice' : 'Developing',
      limited: g.tested > 0 && g.tested < 3,
    })).sort((a, b) => b.priority - a.priority || a.tested - b.tested || a.lastPracticed - b.lastPracticed || a.name.localeCompare(b.name));
  }
  function selectFocus(questions, events, { count = 10, conceptKey = null } = {}) {
    const states = evidence(questions, events), summaries = summarize(questions, events);
    const target = new Set(conceptKey ? [conceptKey] : summaries.filter(g => g.priority > 0).slice(0, 3).map(g => g.key));
    if (!target.size) {
      // With no known weakness, assess broadly across domains and distinct concepts.
      const domains = [...new Set(questions.map(q => q.domain))].sort((a, b) => a - b);
      const buckets = domains.map(domain => questions.filter(q => q.domain === domain).sort((a, b) => {
        const sa = states.get(a.id), sb = states.get(b.id);
        return Number(!!sa.latest) - Number(!!sb.latest) || (sa.latest?.answeredAt || 0) - (sb.latest?.answeredAt || 0);
      }));
      const seenConcepts = new Set(), chosen = [];
      while (chosen.length < count && buckets.some(b => b.length)) {
        for (const bucket of buckets) {
          let index = bucket.findIndex(q => !seenConcepts.has(`${q.domain}:${concept(q).id}`));
          if (index < 0) index = 0;
          if (!bucket.length) continue;
          const q = bucket.splice(index, 1)[0]; chosen.push(q); seenConcepts.add(`${q.domain}:${concept(q).id}`);
          if (chosen.length === count) break;
        }
      }
      return chosen;
    }
    const pool = questions.filter(q => target.has(`${q.domain}:${concept(q).id}`));
    pool.sort((a, b) => {
      const sa = states.get(a.id), sb = states.get(b.id);
      const score = s => s.priority >= 3 ? s.priority : !s.latest ? 2.5 : s.priority;
      return score(sb) - score(sa) || (sa.latest?.answeredAt || 0) - (sb.latest?.answeredAt || 0) || a.id - b.id;
    });
    return pool.slice(0, Math.max(1, count));
  }
  function validEvent(e) {
    return !!e && typeof e.id === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(e.id) && typeof e.examCode === 'string' && e.examCode.length > 0 && e.examCode.length <= 100 && Number.isInteger(e.questionId) && e.questionId > 0 && typeof e.revision === 'string' && /^[a-f0-9]{1,16}$/.test(e.revision) && Number.isInteger(e.domain) && e.domain > 0 && typeof e.correct === 'boolean' && confidenceValues.includes(e.confidence) && Number.isFinite(e.answeredAt) && e.answeredAt > 0 && typeof e.sessionId === 'string' && e.sessionId.length <= 100 && ['regular', 'focus', 'retry'].includes(e.mode) && (typeof e.selected === 'string' && e.selected.length <= 100 || e.selected && Number.isFinite(e.selected.x) && Number.isFinite(e.selected.y) && e.selected.x >= 0 && e.selected.x <= 100 && e.selected.y >= 0 && e.selected.y <= 100);
  }
  return { confidenceValues, revision, concept, priority, evidence, summarize, selectFocus, validEvent };
})();
