// AI Analyst — the AI (Gemini 2.5 Flash; Muse Spark optional) reads every clean record and judges it
// (relevance, entity, sentiment, theme, risk, opportunity, archetype, key fact).
// Logic lives in workflow/lib/analyst_core.js (pasted above by the build script).
//
// Error handling: cache first; batches of 10; 3 batches in parallel; per-batch retries
// and provider fallback inside the AI client; a circuit breaker after 3 failed batches;
// anything the AI could not judge falls back to the A3 keyword rules and is labelled so.
const t0 = Date.now();
const records = $('Final dataset').all().map((i) => i.json);
const loaded = $('Load cache').first().json;
const cache = loaded.cache.analysis;

const { records: out, stats } = await analyzeRecords(records, { cache });

return [
  ...out.map((r) => ({ json: { _type: 'record', ...r } })),
  { json: { _type: 'ai_run', step: 'analyst', prompt_version: PROMPT_VERSION, cache_status: loaded.cache_status,
    stats, ai: AI.summary(), providers: AI.providers, duration_ms: Date.now() - t0,
    cache: { analysis: cache, alerted: loaded.cache.alerted } } },
];
