// AI Brief Writer — Agent 3 ("Analyst"), second half: turn judged records into briefs.
// One brief for Weave, one per competitor with enough coverage, one for the market.
//
// Numbers are never left to the model: every count and average is computed here
// and handed to the AI as STATS. The AI writes the words, and every claim it makes
// must cite record ids from the evidence it was given — the Fact-Checker checks that next.
const t0 = Date.now();
const cfg = $('Run config').first().json;
const all = $('AI Analyst').all().map((i) => i.json).filter((j) => j._type === 'record');
const relevant = all.filter((r) => r.relevance >= 1 && r.route !== 'discard');

const COMPETITORS = ['Podium', 'Birdeye', 'NexHealth', 'Solutionreach', 'RevenueWell', 'Lighthouse 360'];
const LVL = { none: 0, low: 1, medium: 2, high: 3 };
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const countBy = (xs, f) => xs.reduce((m, x) => { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});
const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

function statsFor(recs) {
  const dates = recs.map((r) => r.published_date).sort();
  return {
    records: recs.length,
    sources: new Set(recs.map((r) => r.source_name)).size,
    date_range: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'n/a',
    avg_sentiment: +avg(recs.map((r) => r.sentiment)).toFixed(2),
    positive: recs.filter((r) => r.sentiment > 0).length,
    neutral: recs.filter((r) => r.sentiment === 0).length,
    negative: recs.filter((r) => r.sentiment < 0).length,
    themes: Object.fromEntries(top(countBy(recs, (r) => r.theme), 6)),
    evidence: countBy(recs, (r) => r.evidence),
    risks_high_or_medium: recs.filter((r) => LVL[r.risk_to_weave] >= 2).length,
    opportunities_high_or_medium: recs.filter((r) => LVL[r.opportunity_for_weave] >= 2).length,
    archetypes: Object.fromEntries(top(countBy(recs, (r) => r.archetype), 3)),
    ai_judged_share: recs.length ? +(recs.filter((r) => String(r.analysis_source).startsWith('ai:') || r.analysis_source === 'cache').length / recs.length).toFixed(2) : 0,
  };
}

// Evidence pack: the records most worth reading, ranked deterministically.
const score = (r) => r.relevance * 2 + Math.abs(r.sentiment) + LVL[r.risk_to_weave] * 1.5 + LVL[r.opportunity_for_weave] * 1.2
  + (Date.parse(r.published_date) > Date.now() - 21 * 864e5 ? 1 : 0) + Math.min(2, (+r.engagement_points || 0) / 200);
const pack = (recs, n) => [...recs].sort((a, b) => score(b) - score(a)).slice(0, n).map((r) => ({
  id: r.record_id, date: r.published_date, source: r.source_name, title: r.title, key_fact: r.key_fact,
  entity: r.entity, sentiment: r.sentiment, theme: r.theme, evidence: r.evidence, risk: r.risk_to_weave, opportunity: r.opportunity_for_weave,
  archetype: r.archetype, why: r.why,
}));

const subjects = [];
const weave = relevant.filter((r) => r.entity === 'Weave');
subjects.push({ key: 'weave', entity: 'Weave', title: 'Weave brand brief', recs: weave,
  focus: "Weave's reputation, brand perception, risks and what the brand team should do next. Compare with competitors where the evidence allows." });
for (const c of COMPETITORS) {
  const recs = relevant.filter((r) => r.entity === c && r.relevance >= 2);
  if (recs.length >= 3) subjects.push({ key: c.toLowerCase().replace(/\s+/g, '-'), entity: c, title: `Competitor watch: ${c}`, recs,
    focus: `What ${c} is doing, how it is perceived, and what it means for Weave (threats and openings).` });
}
const market = relevant.filter((r) => r.entity === 'Market' && r.relevance >= 2);
if (market.length >= 3) subjects.push({ key: 'market', entity: 'Market', title: 'Market landscape: AI at the front desk', recs: market,
  focus: 'Trends in AI agents and customer communication that change the market Weave competes in, and what Weave should watch.' });
// Weave's brief also sees the strongest competitor items so it can compare.
const rivalsForWeave = pack(relevant.filter((r) => COMPETITORS.includes(r.entity) && r.relevance >= 2), 8);

const WRITER_SYSTEM = `You write weekly brand-intelligence briefs for the brand and data team at Weave Communications.
Write for a busy marketing lead: plain English, specific, no hype, no filler.

HARD RULES
1. Use ONLY facts found in EVIDENCE. Never add outside knowledge, names, numbers or dates.
2. Every claim must cite at least one evidence id in "cite" (e.g. ["GL-1a2b3c4d"]). Only cite ids that appear in EVIDENCE.
3. Numbers (counts, averages, shares) may come ONLY from STATS — copy them exactly.
4. If the evidence is thin, say so plainly instead of stretching it.

Return JSON:
{"headline": "<=14 words, the single most important takeaway",
 "summary": "2-3 sentences for someone who reads nothing else",
 "sections": [{"title": "What happened", "claims": [{"text": "...", "cite": ["GL-..."]}]},
              {"title": "How the brand is perceived", "claims": [...]},
              {"title": "Risks to watch", "claims": [...]},
              {"title": "Openings for Weave", "claims": [...]}],
 "archetype_read": {"text": "1-2 sentences: which brand archetype the coverage casts this company as, and whether that helps Weave", "cite": ["GL-..."]},
 "actions": [{"action": "a concrete next step for the Weave team", "why": "one sentence", "cite": ["GL-..."]}]}
Use 2-4 claims per section (fewer if evidence is thin) and exactly 3 actions.`;

function validateBrief(ids) {
  const known = new Set(ids);
  return (b) => {
    if (!b || typeof b.headline !== 'string' || typeof b.summary !== 'string') return 'missing headline or summary';
    if (!Array.isArray(b.sections) || b.sections.length < 2) return 'need at least 2 sections';
    const claims = [...b.sections.flatMap((s) => (Array.isArray(s.claims) ? s.claims : [])), ...(Array.isArray(b.actions) ? b.actions : [])];
    if (claims.length < 4) return 'too few claims';
    for (const c of claims) {
      if (!Array.isArray(c.cite) || !c.cite.length) return `every claim needs a "cite" array — missing on: "${String(c.text || c.action).slice(0, 60)}"`;
    }
    const cited = claims.flatMap((c) => c.cite);
    if (cited.length && cited.filter((id) => known.has(id)).length / cited.length < 0.5) return 'most cited ids are not in EVIDENCE — cite only the given ids';
    if (!Array.isArray(b.actions) || !b.actions.length) return 'missing actions';
    return null;
  };
}

// Used only when every AI provider is down: a plain brief built from the top records.
function rulesBrief(s, evidence, st) {
  const neg = evidence.filter((e) => e.sentiment < 0 || e.risk !== 'none').slice(0, 3);
  const pos = evidence.filter((e) => e.sentiment > 0).slice(0, 3);
  const claim = (e) => ({ text: `${e.title} (${e.source}, ${e.date}).`, cite: [e.id] });
  return {
    headline: `${s.entity}: ${st.records} items tracked, average sentiment ${fmtSent(st.avg_sentiment)}`,
    summary: `AI writing was unavailable for this run, so this brief lists the highest-priority source items without interpretation. ${st.records} items from ${st.sources} sources were tracked between ${st.date_range}.`,
    sections: [
      { title: 'Highest-priority items', claims: evidence.slice(0, 4).map(claim) },
      { title: 'Negative or risky coverage', claims: neg.map(claim) },
      { title: 'Positive coverage', claims: pos.map(claim) },
    ].filter((x) => x.claims.length),
    archetype_read: null,
    actions: [{ action: 'Review the items above manually; the AI analysis will resume on the next run.', why: 'AI provider unavailable during this run.', cite: evidence.slice(0, 1).map((e) => e.id) }],
  };
}

const jobs = subjects.map((s) => async () => {
  const st = statsFor(s.recs);
  const evidence = pack(s.recs, 25);
  const extra = s.entity === 'Weave' ? rivalsForWeave : [];
  const allEvidence = [...evidence, ...extra.filter((e) => !evidence.some((x) => x.id === e.id))];
  const base = { key: s.key, entity: s.entity, title: s.title, stats: st, evidence: allEvidence, run_id: cfg.run_id, run_date: cfg.run_date };
  if (!evidence.length) return { ...base, brief: rulesBrief(s, evidence, st), written_by: 'rules_fallback', write_error: 'no evidence' };
  try {
    const res = await AI.complete({
      name: `brief:${s.key}`, system: WRITER_SYSTEM, effort: 'medium', maxTokens: 3500, timeoutMs: 150000, temperature: 0.3,
      user: `BRIEF: ${s.title}\nFOCUS: ${s.focus}\nPERIOD: ${st.date_range}\n\nSTATS:\n${JSON.stringify(st, null, 1)}\n\nEVIDENCE:\n${JSON.stringify(allEvidence)}`,
      validate: validateBrief(allEvidence.map((e) => e.id)),
    });
    return { ...base, brief: res.data, written_by: `${res.provider}:${res.model}`, write_ms: res.ms };
  } catch (e) {
    return { ...base, brief: rulesBrief(s, evidence, st), written_by: 'rules_fallback', write_error: `${e.kind || 'error'}: ${String(e.message).slice(0, 160)}` };
  }
});

const briefs = await AI.pool(jobs, 3);
return [
  ...briefs.map((b) => ({ json: { _type: 'brief', ...b } })),
  { json: { _type: 'ai_run', step: 'writer', briefs: briefs.length, ai: AI.summary(), duration_ms: Date.now() - t0 } },
];
