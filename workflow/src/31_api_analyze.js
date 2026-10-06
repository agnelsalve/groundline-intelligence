// Analyze API — POST /webhook/groundline/analyze  {"records":[{record_id,title,summary,source_name,published_date,...}], "use_cache": false}
// Same Analyst logic as the main workflow, exposed as an endpoint so it can be
// load-tested (scripts/scale_test.mjs) and called by other Madison agents.
// Bad input gets a 400 with a reason instead of a crash.
const t0 = Date.now();
const body = $input.first().json.body || {};
const recs = Array.isArray(body.records) ? body.records : body.record ? [body.record] : null;
if (!recs || !recs.length) return [{ json: { status: 400, response: { error: 'Send {"records":[...]} with at least one record.' } } }];
if (recs.length > 100) return [{ json: { status: 413, response: { error: `Too many records (${recs.length}); the limit is 100 per request.` } } }];
const bad = [];
const clean = recs.map((r, i) => {
  if (!r || typeof r.title !== 'string' || r.title.trim().length < 5) { bad.push({ index: i, error: 'title is required (≥5 characters)' }); return null; }
  return { record_id: String(r.record_id || `REQ-${i}`), title: r.title.trim(), summary: String(r.summary || ''), source_name: String(r.source_name || 'unknown'),
    published_date: String(r.published_date || ''), signal_type: r.signal_type || 'news', entity: r.entity || '', focus: r.focus || '' };
}).filter(Boolean);
if (!clean.length) return [{ json: { status: 422, response: { error: 'No valid records.', invalid: bad } } }];

const { records, stats } = await analyzeRecords(clean, { useCache: body.use_cache === true, cache: {}, batchSize: Math.min(10, clean.length), maxAI: 100 });
const ai = AI.summary();
return [{ json: { status: 200, response: {
  results: records.map((r) => ({ record_id: r.record_id, relevance: r.relevance, entity: r.entity, sentiment: r.sentiment, theme: r.theme,
    risk_to_weave: r.risk_to_weave, opportunity_for_weave: r.opportunity_for_weave, archetype: r.archetype, route: r.route,
    key_fact: r.key_fact, why: r.why, analysis_source: r.analysis_source })),
  invalid: bad, stats,
  metrics: { server_ms: Date.now() - t0, ai_calls: ai.calls, retries: ai.retries, repairs: ai.repairs, provider_fallbacks: ai.provider_fallbacks,
    tokens_in: ai.tokens_in, tokens_out: ai.tokens_out, cost_usd: ai.cost_usd, errors: ai.errors.slice(0, 5) } } } }];
