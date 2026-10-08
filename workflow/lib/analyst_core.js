// ─── Groundline Analyst core ────────────────────────────────────────────────
// Agent 3 from the A2 design ("Analyst"), first half: read every record and judge it.
// Pasted (after ai_client.js) into the "AI Analyst" node of the main workflow AND
// the Analyze API webhook used for scale testing, so both run identical logic.
//
// For each record the AI decides:
//   relevance 0–3      0 = unrelated (an F1 "podium"), 3 = directly about Weave or a competitor
//   entity             which company it is about (or "Market")
//   sentiment −2…+2    tone toward that entity
//   theme / evidence   what kind of event, and whether it was announced, proven, reported or discussed
//   risk_to_weave / opportunity_for_weave   none | low | medium | high  → drives alert routing
//   archetype          which of the 12 brand archetypes the coverage casts the entity as
//   key_fact           one sentence that is stated in the source (used later for fact-checking)
const PROMPT_VERSION = 'analyst-v1';
const ENTITIES = ['Weave', 'Podium', 'Birdeye', 'NexHealth', 'Solutionreach', 'RevenueWell', 'Lighthouse 360', 'Market', 'None'];
const THEMES = ['product', 'ai_strategy', 'pricing', 'customer_experience', 'partnership', 'm_and_a', 'financials',
  'legal_regulatory', 'leadership', 'market_trend', 'other'];
const EVIDENCE = ['announced', 'proven', 'reported', 'discussed'];
const LEVELS = ['none', 'low', 'medium', 'high'];
const ARCHETYPES = ['Innocent', 'Everyman', 'Hero', 'Outlaw', 'Explorer', 'Creator', 'Ruler', 'Magician', 'Lover', 'Caregiver', 'Jester', 'Sage'];

const ANALYST_SYSTEM = `You are the brand-intelligence analyst for Weave Communications (NYSE: WEAV), a customer-communication and payments platform for ~40,000 dental, optometry and veterinary practices. Direct competitors: Podium, Birdeye, NexHealth, Solutionreach, RevenueWell, Lighthouse 360.

You receive news items, papers and community posts. Judge each one ONLY from its title and summary. Never invent facts.

Return JSON: {"items":[{...one object per input item, same order...}]} with exactly these fields:
- "id": the input id, unchanged
- "relevance": 0 = unrelated to Weave's market (e.g. a sports "podium", a fabric "weave"), 1 = general AI/tech background, 2 = adjacent market (AI agents for customer service, SMB software, healthcare practices), 3 = directly about Weave or a named competitor
- "entity": one of ${JSON.stringify(ENTITIES)}. "Market" for industry items, "None" when relevance is 0
- "sentiment": integer -2..2, the tone toward that entity (0 if neutral or relevance 0)
- "theme": one of ${JSON.stringify(THEMES)}
- "evidence": "announced" (company says it), "proven" (research/data), "reported" (journalism), "discussed" (opinion/community)
- "risk_to_weave": one of ${JSON.stringify(LEVELS)}. high = could hurt Weave's reputation, revenue or stock soon (lawsuit, outage, downgrade, a competitor winning Weave's customers)
- "opportunity_for_weave": one of ${JSON.stringify(LEVELS)}. high = a competitor stumbling or a market shift Weave can act on now
- "archetype": which of ${JSON.stringify(ARCHETYPES)} this coverage portrays the entity as, or null if it doesn't portray a brand
- "key_fact": ONE sentence stating the main fact, using only information in the title/summary
- "why": at most 20 words explaining the risk/opportunity rating`;

function validateAnalysis(ids) {
  return (data) => {
    if (!data || !Array.isArray(data.items)) return 'missing "items" array';
    const want = new Set(ids);
    for (const it of data.items) {
      if (!it || !want.has(it.id)) continue;            // unknown ids are ignored, missing ones fall back later
      it.relevance = Math.max(0, Math.min(3, Math.round(+it.relevance)));
      it.sentiment = Math.max(-2, Math.min(2, Math.round(+it.sentiment)));
      if (!Number.isFinite(it.relevance) || !Number.isFinite(it.sentiment)) return `item ${it.id}: relevance/sentiment must be numbers`;
      if (!ENTITIES.includes(it.entity)) return `item ${it.id}: entity must be one of ${ENTITIES.join(', ')}`;
      if (!THEMES.includes(it.theme)) it.theme = 'other';
      if (!EVIDENCE.includes(it.evidence)) it.evidence = 'reported';
      if (!LEVELS.includes(it.risk_to_weave) || !LEVELS.includes(it.opportunity_for_weave)) return `item ${it.id}: risk_to_weave/opportunity_for_weave must be none|low|medium|high`;
      if (it.archetype && !ARCHETYPES.includes(it.archetype)) it.archetype = null;
      if (typeof it.key_fact !== 'string' || it.key_fact.length < 8) return `item ${it.id}: key_fact must be a sentence`;
    }
    const got = data.items.filter((it) => it && want.has(it.id)).length;
    if (got < Math.ceil(ids.length / 2)) return `only ${got} of ${ids.length} ids returned`;
    return null;
  };
}

// Rule-based fallback = the A3 behaviour. Used when every AI provider is down,
// when the AI skipped an item, or when the run's AI budget is used up.
const POS = /\b(launch\w*|record|growth|grow\w*|wins?|award\w*|beat\w*|surge\w*|upgrade\w*|partner\w*|expand\w*|profit\w*|raises?)\b/i;
const NEG = /\b(lawsuit|investigat\w*|downgrade\w*|layoff\w*|breach\w*|outage|decline\w*|miss(?:es|ed)?|loss(?:es)?|fraud|cuts?|drops?|falls?|scrap\w*|shut\w*)\b/i;
function rulesAnalysis(r, reason) {
  const text = `${r.title} ${r.summary || ''}`;
  const sentiment = NEG.test(text) ? -1 : POS.test(text) ? 1 : 0;
  const entity = r.entity || (r.focus === 'AI' ? 'Market' : 'None');
  const themeBySignal = { legal_notice: 'legal_regulatory', m_and_a: 'm_and_a', analyst_rating: 'financials', insider_trade: 'financials',
    financials: 'financials', research_paper: 'market_trend', community_discussion: 'market_trend', press_release: 'product' };
  let risk = 'none';
  if (entity === 'Weave') risk = r.signal_type === 'legal_notice' || (sentiment < 0) ? 'medium' : 'low';
  return {
    relevance: r.entity ? 3 : 1, entity, sentiment,
    theme: themeBySignal[r.signal_type] || 'other',
    evidence: { research_paper: 'proven', community_discussion: 'discussed', press_release: 'announced' }[r.signal_type] || 'reported',
    risk_to_weave: risk, opportunity_for_weave: entity !== 'Weave' && r.entity && sentiment < 0 ? 'low' : 'none',
    archetype: null, key_fact: r.title, why: `keyword rules (${reason})`,
  };
}

// Decision: where does this record go?
function routeFor(a) {
  if (a.relevance >= 2 && (a.risk_to_weave === 'high' || (a.entity === 'Weave' && a.risk_to_weave === 'medium' && a.sentiment <= -2))) return 'urgent_risk';
  if (a.relevance >= 2 && a.opportunity_for_weave === 'high') return 'opportunity';
  if (a.relevance === 0) return 'discard';
  return 'digest';
}

// records: A3-shape records. cache: { [record_id]: { v, a, at } }
async function analyzeRecords(records, opts = {}) {
  const cache = opts.cache || {};
  const BATCH = opts.batchSize || +AI.env('AI_BATCH_SIZE', '10');
  const CONC = opts.concurrency || +AI.env('AI_CONCURRENCY', '3');
  const MAX_AI = opts.maxAI ?? +AI.env('AI_MAX_RECORDS', '400');
  const useCache = opts.useCache !== false;
  const BREAKER = 3;                                     // consecutive failed batches → stop calling AI this run

  const results = new Map();
  const stats = { cache_hits: 0, ai_analyzed: 0, fallback: 0, fallback_reasons: {}, batches: 0, batches_failed: 0, circuit_open: false };
  const fallback = (r, reason) => {
    results.set(r.record_id, { ...rulesAnalysis(r, reason), analysis_source: 'rules_fallback', analysis_note: reason });
    stats.fallback++; stats.fallback_reasons[reason] = (stats.fallback_reasons[reason] || 0) + 1;
  };

  const todo = [];
  for (const r of records) {
    const hit = useCache && cache[r.record_id];
    if (hit && hit.v === PROMPT_VERSION) { results.set(r.record_id, { ...hit.a, analysis_source: 'cache', analysis_note: `cached ${hit.at}` }); stats.cache_hits++; }
    else todo.push(r);
  }
  // Brand records first, then newest — if the budget runs out, background items are the ones skipped.
  todo.sort((a, b) => (b.entity ? 1 : 0) - (a.entity ? 1 : 0) || String(b.published_date).localeCompare(String(a.published_date)));
  const forAI = todo.slice(0, MAX_AI);
  todo.slice(MAX_AI).forEach((r) => fallback(r, 'ai_budget_reached'));

  const batches = [];
  for (let i = 0; i < forAI.length; i += BATCH) batches.push(forAI.slice(i, i + BATCH));
  let consecutiveFails = 0;

  await AI.pool(batches.map((batch) => async () => {
    if (stats.circuit_open) { batch.forEach((r) => fallback(r, 'circuit_open')); return; }
    stats.batches++;
    const ids = batch.map((r) => r.record_id);
    const input = batch.map((r) => ({ id: r.record_id, title: r.title, summary: (r.summary || '').slice(0, 400),
      source: r.source_name, date: r.published_date, type: r.signal_type, hint_entity: r.entity || undefined }));
    try {
      const res = await AI.complete({ name: 'analyze', system: ANALYST_SYSTEM, user: JSON.stringify({ items: input }),
        validate: validateAnalysis(ids), effort: 'low', maxTokens: 400 + 160 * batch.length, timeoutMs: 90000 });
      consecutiveFails = 0;
      const byId = Object.fromEntries(res.data.items.filter((it) => it && ids.includes(it.id)).map((it) => [it.id, it]));
      for (const r of batch) {
        const a = byId[r.record_id];
        if (!a) { fallback(r, 'ai_skipped_item'); continue; }
        const { id, ...analysis } = a;
        results.set(r.record_id, { ...analysis, analysis_source: `ai:${res.provider}`, analysis_note: res.model });
        cache[r.record_id] = { v: PROMPT_VERSION, a: analysis, at: new Date().toISOString().slice(0, 10), by: `${res.provider}:${res.model}` };
        stats.ai_analyzed++;
      }
    } catch (e) {
      stats.batches_failed++;
      consecutiveFails++;
      if (e.kind === 'no_provider' || e.kind === 'budget' || consecutiveFails >= BREAKER) stats.circuit_open = true;
      batch.forEach((r) => fallback(r, e.kind === 'no_provider' ? 'no_ai_provider' : e.kind === 'budget' ? 'ai_budget_reached' : `ai_error:${e.kind || 'unknown'}`));
    }
  }), CONC);

  const out = records.map((r) => {
    const a = results.get(r.record_id) || { ...rulesAnalysis(r, 'missing'), analysis_source: 'rules_fallback' };
    return { ...r, ...a, route: routeFor(a) };
  });
  return { records: out, stats, cache };
}
// ─── end Analyst core ───────────────────────────────────────────────────────
