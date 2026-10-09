// ─── Groundline AI client ───────────────────────────────────────────────────
// Shared by every AI node. scripts/build_workflow.py pastes this file at the top
// of each AI Code node, so the retry / fallback / cost rules live in one place.
//
// Each job has its own model, and every model has its own free-tier quota:
//   analyst  (high volume)  Gemini 3.5 Flash-Lite
//   writer   (quality)      Gemini 3.8 Flash
//   checker  (independent)  Gemini 3.5 Flash — a different model from the writer, so no model grades its own work
// If a model is down or out of quota, the job moves down a chain of other models
// (then Muse Spark, if a key is set), and finally the caller falls back to keyword rules.
// All providers speak the OpenAI Chat Completions format, so one client covers them all.
//
// What it handles:
//   429 per-minute limit      → wait (Retry-After / retryDelay, or exponential backoff + jitter), retry
//   429 daily quota used up   → don't wait; mark the model exhausted for this run, try the next model
//   5xx / overloaded / timeout / network → retry with backoff, then the next model
//   400 "unsupported parameter" → retry once without the optional params
//   401 / 403 / 404           → no retry; next model
//   reply not valid JSON, or fails the caller's schema check → one "repair" round-trip
//   run budget reached        → stop paid calls; caller falls back to rules
// Every call is metered: tokens, cost at list price, latency, retries, model used.
const __http = this.helpers.httpRequest.bind(this.helpers);

const AI = (() => {
  const env = (k, d = '') => { try { const v = $env[k]; return v === undefined || v === null || v === '' ? d : String(v); } catch (e) { return d; } };
  const real = (k) => k && !/^your_|_here$|^changeme$/i.test(k);

  // USD per 1M tokens (input, output) at PAID list prices, Oct 2026. On the free tier the real
  // bill is $0; we meter at list price so cost-per-run and the budget cap show what production would pay.
  const PRICES = {
    'gemini-3.8-flash': [0.75, 3.75], 'gemini-3.5-flash': [1.50, 9.00], 'gemini-3.5-flash-lite': [0.25, 1.50],
    'gemini-3.1-flash-lite': [0.25, 1.50], 'gemini-3-flash-preview': [0.50, 3.00], 'gemma-4-31b-it': [0, 0], 'muse-spark-1.3': [1.25, 4.25],
  };
  const price = (m) => { const p = PRICES[m] || [1.0, 5.0]; return { in: p[0], out: p[1] }; };   // unknown model: conservative guess

  const GEMINI = { base: env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'), key: env('GEMINI_API_KEY') };
  const MUSE = { base: env('MUSE_BASE_URL', 'https://api.meta.ai/v1'), key: env('MUSE_API_KEY') };
  const gm = (model) => ({ id: 'gemini', label: `Gemini ${model.replace(/^gemini-/, '')}`, model, ...GEMINI, price: price(model) });
  const ROLE_MODEL = {
    analyst: env('GEMINI_ANALYST_MODEL', 'gemini-3.5-flash-lite'),
    writer: env('GEMINI_MODEL', 'gemini-3.8-flash'),
    checker: env('GEMINI_CHECK_MODEL', 'gemini-3.5-flash'),
  };
  const FALLBACKS = env('GEMINI_FALLBACK_MODELS', 'gemini-3.1-flash-lite,gemini-3-flash-preview,gemma-4-31b-it').split(',').map((s) => s.trim()).filter(Boolean);
  const museP = real(MUSE.key) ? [{ id: 'muse', label: 'Muse Spark', model: env('MUSE_MODEL', 'muse-spark-1.3'), ...MUSE, price: price(env('MUSE_MODEL', 'muse-spark-1.3')) }] : [];

  function chain(role) {
    const g = real(GEMINI.key);
    const order = role === 'checker'
      ? [ROLE_MODEL.checker, ...FALLBACKS, ROLE_MODEL.writer]           // writer's own model only as a last resort
      : role === 'writer' ? [ROLE_MODEL.writer, ROLE_MODEL.checker, ...FALLBACKS]
        : [ROLE_MODEL.analyst, ...FALLBACKS, ROLE_MODEL.writer, ROLE_MODEL.checker];
    const models = g ? [...new Set(order)].map(gm) : [];
    return env('AI_PRIMARY') === 'muse' ? [...museP, ...models] : [...models, ...museP];
  }
  const configured = () => chain('analyst').length > 0;

  const MAX_TRIES = +env('AI_MAX_TRIES', '4');
  // Hard spending cap for one pipeline run (all AI steps together, at list price).
  const BUDGET_USD = +env('AI_BUDGET_USD', '1.00');
  let priorSpend = 0;
  const BASE_DELAY_MS = +env('AI_BASE_DELAY_MS', '2000');
  const MAX_WAIT_MS = 65000;                       // a per-minute limit resets within a minute; longer waits mean "try another model"
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const exhausted = new Set();                     // models out of daily quota for the rest of this run

  const metrics = { calls: 0, ok: 0, failed: 0, retries: 0, repairs: 0, provider_fallbacks: 0, quota_exhausted: [],
    tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: [], by_provider: {}, by_model: {}, errors: [] };

  class AIError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }

  function parseJson(text) {
    if (typeof text !== 'string') throw new AIError('empty reply', 'malformed');
    const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (e) { /* fall through */ }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* fall through */ } }
    throw new AIError('reply is not valid JSON: ' + t.slice(0, 120), 'malformed');
  }

  // Full response, never throws on HTTP status — so error bodies (quota details, retry delays) are readable.
  async function post(p, body, timeoutMs) {
    const t0 = Date.now();
    const res = await __http({
      method: 'POST', url: p.base.replace(/\/$/, '') + '/chat/completions',
      headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
      body, json: true, timeout: timeoutMs, returnFullResponse: true, ignoreHttpStatusErrors: true,
    });
    let data = res.body;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { /* keep text */ } }
    if (Array.isArray(data)) data = data[0];                      // Gemini sometimes wraps errors in an array
    return { status: res.statusCode, headers: res.headers || {}, data, ms: Date.now() - t0 };
  }

  const waitFor = (r) => {
    const h = r.headers['retry-after'];
    if (h && Number.isFinite(+h)) return +h * 1000;
    const m = JSON.stringify(r.data || '').match(/retryDelay\\?"\s*:\s*\\?"(\d+(?:\.\d+)?)s/);
    return m ? Math.ceil(+m[1] * 1000) : 0;
  };

  // One model, with retries. Returns parsed + validated JSON or throws.
  async function callProvider(p, task) {
    const messages = [{ role: 'system', content: task.system }, { role: 'user', content: task.user }];
    let optional = { response_format: { type: 'json_object' }, reasoning_effort: task.effort || 'low' };
    let repaired = false;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      metrics.calls++;
      let r;
      try {
        r = await post(p, { model: p.model, messages, max_completion_tokens: task.maxTokens || 4000, temperature: task.temperature ?? 0.2, ...optional }, task.timeoutMs || 120000);
      } catch (e) {                                              // network error or client timeout
        if (attempt === MAX_TRIES) throw new AIError(`${p.label} network: ${String(e.message).slice(0, 160)}`, 'unavailable');
        metrics.retries++; await sleep(BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 400); continue;
      }
      const errText = r.status >= 400 ? JSON.stringify((r.data && r.data.error) || r.data || '').slice(0, 600) : '';
      if (r.status >= 400) {
        const short = `${p.label} ${r.status}: ${errText.replace(/\\"/g, '"').slice(0, 220)}`;
        if (r.status === 400 && (optional.response_format || optional.reasoning_effort) && /response_format|reasoning|thinking|unsupported|unknown|invalid argument/i.test(errText)) {
          optional = {}; metrics.retries++; continue;            // model rejects an optional param → drop it
        }
        if ([401, 403, 404].includes(r.status)) throw new AIError(short, r.status === 404 ? 'model_unavailable' : 'auth');
        if (r.status === 429) {
          const wait = waitFor(r);
          if (/PerDay|per day|daily|limit:\s*0\b|"quotaValue":\s*"0"/i.test(errText) || wait > MAX_WAIT_MS) {
            exhausted.add(p.model); metrics.quota_exhausted.push(p.model);
            throw new AIError(short, 'quota');                    // daily quota gone: switch models now
          }
          if (attempt === MAX_TRIES) throw new AIError(short, 'rate_limit');
          metrics.retries++; await sleep(Math.max(wait, BASE_DELAY_MS * 2 ** (attempt - 1)) + Math.random() * 500); continue;
        }
        const retryable = r.status === 408 || r.status === 409 || r.status >= 500;
        if (!retryable || attempt === MAX_TRIES) throw new AIError(short, r.status >= 500 ? 'unavailable' : 'error');
        metrics.retries++; await sleep(BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 400); continue;
      }

      const u = (r.data && r.data.usage) || {};
      const tin = u.prompt_tokens || 0, tout = u.completion_tokens || 0;
      const cost = (tin * p.price.in + tout * p.price.out) / 1e6;
      metrics.tokens_in += tin; metrics.tokens_out += tout; metrics.cost_usd += cost; metrics.latency_ms.push(r.ms);
      for (const [bucket, key] of [[metrics.by_provider, p.id], [metrics.by_model, p.model]]) {
        const b = (bucket[key] = bucket[key] || { calls: 0, tokens_in: 0, tokens_out: 0, cost_usd: 0 });
        b.calls++; b.tokens_in += tin; b.tokens_out += tout; b.cost_usd += cost;
      }
      const text = r.data && r.data.choices && r.data.choices[0] && r.data.choices[0].message && r.data.choices[0].message.content;
      let data, problem;
      try { data = parseJson(text); problem = task.validate ? task.validate(data) : null; } catch (e) { problem = e.message; }
      if (!problem) { metrics.ok++; return { data, provider: p.id, model: p.model, ms: r.ms, tokens_in: tin, tokens_out: tout, cost_usd: cost, attempts: attempt }; }

      // Malformed or off-schema reply: show the model its own mistake once.
      if (repaired) throw new AIError(`invalid reply after repair: ${problem}`, 'malformed');
      repaired = true; metrics.repairs++;
      messages.push({ role: 'assistant', content: String(text || '').slice(0, 6000) });
      messages.push({ role: 'user', content: `Your reply was rejected: ${problem}. Reply again with ONLY the corrected JSON object, nothing else.` });
    }
    throw new AIError(`${p.label}: retries exhausted`, 'unavailable');
  }

  // Public. task = { name, role: analyst|writer|checker, system, user, validate, effort, maxTokens, timeoutMs }
  async function complete(task) {
    if (priorSpend + metrics.cost_usd >= BUDGET_USD) {
      metrics.failed++;
      metrics.errors.push({ task: task.name, kind: 'budget', error: `AI budget of $${BUDGET_USD.toFixed(2)} (list price) reached for this run` });
      throw new AIError('AI budget reached', 'budget');
    }
    const order = chain(task.role || 'analyst').filter((p) => !exhausted.has(p.model));
    if (!order.length) {
      metrics.failed++;
      const why = configured() ? 'every model is out of quota for today' : 'no AI provider configured (set GEMINI_API_KEY in .env)';
      metrics.errors.push({ task: task.name, kind: configured() ? 'quota' : 'no_provider', error: why });
      throw new AIError(why, configured() ? 'quota' : 'no_provider');
    }
    let last;
    for (let i = 0; i < order.length; i++) {
      try { return await callProvider(order[i], task); }
      catch (e) {
        last = e;
        metrics.errors.push({ task: task.name, provider: order[i].model, kind: e.kind || 'error', error: String(e.message).slice(0, 240) });
        if (e.kind === 'model_unavailable') exhausted.add(order[i].model);
        if (i < order.length - 1) metrics.provider_fallbacks++;
      }
    }
    metrics.failed++;
    throw last;
  }

  // Run async jobs with a concurrency cap (keeps us under provider rate limits).
  async function pool(jobs, limit) {
    const out = new Array(jobs.length); let next = 0;
    const worker = async () => { while (next < jobs.length) { const i = next++; out[i] = await jobs[i](); } };
    await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
    return out;
  }

  function summary() {
    const l = [...metrics.latency_ms].sort((a, b) => a - b);
    const pct = (q) => (l.length ? l[Math.min(l.length - 1, Math.floor(q * l.length))] : 0);
    return { ...metrics, latency_ms: undefined, cost_usd: +metrics.cost_usd.toFixed(6), quota_exhausted: [...new Set(metrics.quota_exhausted)],
      latency_p50_ms: pct(0.5), latency_p95_ms: pct(0.95), latency_max_ms: l[l.length - 1] || 0,
      providers_configured: configured() ? Object.entries(ROLE_MODEL).map(([r, m]) => `${r}:${m}`).concat(museP.map((p) => `muse:${p.model}`)) : [] };
  }

  // Steps after the first tell the client what earlier steps already spent this run.
  const setPriorSpend = (usd) => { priorSpend = +usd || 0; };
  return { complete, pool, summary, AIError, env, setPriorSpend, budget: BUDGET_USD,
    providers: configured() ? Object.entries(ROLE_MODEL).map(([role, model]) => ({ role, model })) : [] };
})();
// ─── end AI client ──────────────────────────────────────────────────────────
