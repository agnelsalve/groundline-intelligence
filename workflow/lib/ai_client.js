// ─── Groundline AI client ───────────────────────────────────────────────────
// Shared by every AI node. scripts/build_workflow.py pastes this file at the top
// of each AI Code node, so the retry / fallback / cost rules live in one place.
//
// Provider chain: Muse Spark (Meta Model API) → Gemini (backup) → caller's rule fallback.
// Both providers speak the OpenAI Chat Completions format, so one client covers both.
//
// What it handles:
//   429 / 5xx / timeout / network  → retry with exponential backoff + jitter (honours Retry-After)
//   400 "unsupported parameter"    → retry once without the optional params
//   401 / 403 / 404                → don't retry; move to the next provider
//   reply is not valid JSON, or fails the caller's schema check → one "repair" round-trip
//   every provider failed          → throws AIError; the caller falls back to rules
// Every call is metered: tokens, cost, latency, retries, provider used.
const __http = this.helpers.httpRequest.bind(this.helpers);

const AI = (() => {
  const env = (k, d = '') => { try { const v = $env[k]; return v === undefined || v === null || v === '' ? d : String(v); } catch (e) { return d; } };
  const real = (k) => k && !/^your_|_here$|^changeme$/i.test(k);

  // USD per 1M tokens. Muse: Meta Model API list price. Gemini: free tier = $0.
  const PROVIDERS = [
    { id: 'muse', label: 'Muse Spark', base: env('MUSE_BASE_URL', 'https://api.meta.ai/v1'), key: env('MUSE_API_KEY'),
      model: env('MUSE_MODEL', 'muse-spark-1.3'), price: { in: +env('MUSE_PRICE_IN', '1.25'), out: +env('MUSE_PRICE_OUT', '4.25') } },
    { id: 'gemini', label: 'Gemini', base: env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'), key: env('GEMINI_API_KEY'),
      model: env('GEMINI_MODEL', 'gemini-2.5-flash'), price: { in: +env('GEMINI_PRICE_IN', '0'), out: +env('GEMINI_PRICE_OUT', '0') } },
  ].filter((p) => real(p.key));

  const MAX_TRIES = +env('AI_MAX_TRIES', '4');
  const BASE_DELAY_MS = +env('AI_BASE_DELAY_MS', '1500');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const metrics = { calls: 0, ok: 0, failed: 0, retries: 0, repairs: 0, provider_fallbacks: 0,
    tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: [], by_provider: {}, errors: [] };

  class AIError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }

  function parseJson(text) {
    if (typeof text !== 'string') throw new AIError('empty reply', 'malformed');
    let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (e) { /* fall through */ }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* fall through */ } }
    throw new AIError('reply is not valid JSON: ' + t.slice(0, 120), 'malformed');
  }

  const statusOf = (e) => e.status || e.httpCode || e.statusCode || (e.response && e.response.status) || 0;
  const retryAfterMs = (e) => {
    const h = (e.response && e.response.headers) || {};
    const v = h['retry-after'] || h['Retry-After'];
    return v && Number.isFinite(+v) ? Math.min(+v * 1000, 30000) : 0;
  };

  async function post(p, body, timeoutMs) {
    const t0 = Date.now();
    const res = await __http({
      method: 'POST', url: p.base.replace(/\/$/, '') + '/chat/completions',
      headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
      body, json: true, timeout: timeoutMs,
    });
    return { res, ms: Date.now() - t0 };
  }

  // One provider, with retries. Returns parsed + validated JSON or throws.
  async function callProvider(p, task) {
    const messages = [{ role: 'system', content: task.system }, { role: 'user', content: task.user }];
    let optional = { response_format: { type: 'json_object' }, reasoning_effort: task.effort || 'low' };
    let repaired = false;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      metrics.calls++;
      try {
        const body = { model: p.model, messages, max_completion_tokens: task.maxTokens || 4000, temperature: task.temperature ?? 0.2, ...optional };
        const { res, ms } = await post(p, body, task.timeoutMs || 90000);
        const u = res.usage || {};
        const tin = u.prompt_tokens || 0, tout = u.completion_tokens || 0;
        const cost = (tin * p.price.in + tout * p.price.out) / 1e6;
        metrics.tokens_in += tin; metrics.tokens_out += tout; metrics.cost_usd += cost; metrics.latency_ms.push(ms);
        const bp = (metrics.by_provider[p.id] = metrics.by_provider[p.id] || { calls: 0, tokens_in: 0, tokens_out: 0, cost_usd: 0 });
        bp.calls++; bp.tokens_in += tin; bp.tokens_out += tout; bp.cost_usd += cost;

        const text = res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
        let data, problem;
        try { data = parseJson(text); problem = task.validate ? task.validate(data) : null; }
        catch (e) { problem = e.message; }
        if (!problem) { metrics.ok++; return { data, provider: p.id, model: p.model, ms, tokens_in: tin, tokens_out: tout, cost_usd: cost, attempts: attempt }; }

        // Malformed or off-schema reply: show the model its own mistake once.
        if (repaired) throw new AIError(`invalid reply after repair: ${problem}`, 'malformed');
        repaired = true; metrics.repairs++;
        messages.push({ role: 'assistant', content: String(text || '').slice(0, 6000) });
        messages.push({ role: 'user', content: `Your reply was rejected: ${problem}. Reply again with ONLY the corrected JSON object, nothing else.` });
        continue;
      } catch (e) {
        if (e instanceof AIError) throw e;
        const st = statusOf(e);
        const msg = String(e.message || e).slice(0, 200);
        if (st === 400 && optional.response_format && /response_format|reasoning|unsupported|unknown/i.test(JSON.stringify((e.response && e.response.data) || msg))) {
          optional = {}; metrics.retries++; continue;          // provider rejects an optional param → drop it
        }
        if ([401, 403, 404].includes(st)) throw new AIError(`${p.label} ${st}: ${msg}`, 'auth');
        const retryable = !st || st === 408 || st === 409 || st === 429 || st >= 500;
        if (!retryable || attempt === MAX_TRIES) throw new AIError(`${p.label} ${st || 'network'}: ${msg}`, st === 429 ? 'rate_limit' : 'unavailable');
        metrics.retries++;
        const backoff = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 400);
        await sleep(Math.max(backoff, retryAfterMs(e)));
      }
    }
    throw new AIError(`${p.label}: retries exhausted`, 'unavailable');
  }

  // Public: try each provider in order. task = { name, system, user, validate, effort, maxTokens, timeoutMs }
  async function complete(task) {
    if (!PROVIDERS.length) {
      metrics.failed++;
      metrics.errors.push({ task: task.name, error: 'no AI provider configured (set MUSE_API_KEY or GEMINI_API_KEY in .env)' });
      throw new AIError('no AI provider configured', 'no_provider');
    }
    // task.prefer lets a caller pick a different model first — the fact-checker uses this
    // so that, when both keys exist, a second model checks the first one's work.
    const order = task.prefer ? [...PROVIDERS].sort((a, b) => (b.id === task.prefer) - (a.id === task.prefer)) : PROVIDERS;
    let last;
    for (let i = 0; i < order.length; i++) {
      try { return await callProvider(order[i], task); }
      catch (e) {
        last = e;
        metrics.errors.push({ task: task.name, provider: order[i].id, kind: e.kind || 'error', error: String(e.message).slice(0, 240) });
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
    return { ...metrics, latency_ms: undefined, cost_usd: +metrics.cost_usd.toFixed(6),
      latency_p50_ms: pct(0.5), latency_p95_ms: pct(0.95), latency_max_ms: l[l.length - 1] || 0,
      providers_configured: PROVIDERS.map((p) => `${p.id}:${p.model}`) };
  }

  return { complete, pool, summary, AIError, env, providers: PROVIDERS.map((p) => ({ id: p.id, label: p.label, model: p.model })) };
})();
// ─── end AI client ──────────────────────────────────────────────────────────
