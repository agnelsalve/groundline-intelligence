// Scale test — fires real requests at the Analyze API (n8n webhook → Gemini) and records
// what happens at each volume. Nothing is simulated: every number comes from a response.
//
//   node scripts/scale_test.mjs                              # default levels 1,10,50,100,200
//   node scripts/scale_test.mjs --levels 1,10,50 --conc 10   # cap parallel requests at 10
//   node scripts/scale_test.mjs --per-request 10             # 10 records per request (batch mode)
//   node scripts/scale_test.mjs --pid 1234                   # also sample the n8n process's memory
//
// Needs `scripts/start-n8n.ps1` running (it publishes the Analyze API).
// Writes data/scale/scale_<time>.json and .md
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg('url', 'http://localhost:5678/webhook/groundline/analyze');
const LEVELS = arg('levels', '1,10,50,100,200').split(',').map(Number);
const MAX_CONC = +arg('conc', '0');                 // 0 = fire every request of a level at once (burst)
const PER_REQ = +arg('per-request', '1');
const TIMEOUT_MS = +arg('timeout', '180000');
const PID = arg('pid', '');
const LABEL = arg('label', '');
const BUDGET = +arg('budget', '5');               // stop the test once this many dollars have been spent

const dataset = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/clean/groundline_dataset.json'), 'utf8'));
const records = Array.isArray(dataset) ? dataset : dataset.data || Object.values(dataset);
let cursor = 0;
const take = (n) => Array.from({ length: n }, () => { const r = records[cursor++ % records.length];
  return { record_id: `${r.record_id}-${cursor}`, title: r.title, summary: r.summary, source_name: r.source_name,
    published_date: r.published_date, signal_type: r.signal_type, entity: r.entity, focus: r.focus }; });

const memMB = () => { if (!PID) return null; try {
  const out = execFileSync('tasklist', ['/FI', `PID eq ${PID}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  const m = out.match(/"([\d,.]+) K"/); return m ? Math.round(+m[1].replace(/[,.]/g, '') / 1024) : null; } catch { return null; } };

async function one(i) {
  const t0 = performance.now();
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ records: take(PER_REQ) }), signal: ctl.signal });
    const ms = performance.now() - t0;
    let body = null; try { body = await res.json(); } catch { /* non-JSON error page */ }
    const results = (body && body.results) || [];
    const degraded = results.filter((r) => !String(r.analysis_source).startsWith('ai:')).length;
    return { i, ms, http: res.status, ok: res.status === 200 && results.length === PER_REQ && degraded === 0,
      degraded, records: results.length, m: (body && body.metrics) || {}, err: res.status !== 200 ? (body && body.error) || res.statusText : null };
  } catch (e) {
    return { i, ms: performance.now() - t0, http: 0, ok: false, degraded: PER_REQ, records: 0, m: {}, err: e.name === 'AbortError' ? 'client timeout' : e.message };
  } finally { clearTimeout(timer); }
}

async function level(n) {
  const conc = MAX_CONC > 0 ? Math.min(MAX_CONC, n) : n;
  const out = []; let next = 0; let peak = memMB();
  const sampler = PID ? setInterval(() => { const v = memMB(); if (v && v > (peak || 0)) peak = v; }, 1000) : null;
  const t0 = performance.now();
  await Promise.all(Array.from({ length: conc }, async () => { while (next < n) { const i = next++; out.push(await one(i)); } }));
  const wall = (performance.now() - t0) / 1000;
  if (sampler) clearInterval(sampler);
  const lat = out.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (q) => Math.round(lat[Math.min(lat.length - 1, Math.floor(q * lat.length))]);
  const sum = (f) => out.reduce((s, r) => s + (f(r) || 0), 0);
  const codes = out.reduce((m, r) => { if (r.http !== 200) m[r.http || 'network'] = (m[r.http || 'network'] || 0) + 1; return m; }, {});
  const errKinds = {};
  out.forEach((r) => (r.m.errors || []).forEach((e) => { errKinds[e.kind || 'error'] = (errKinds[e.kind || 'error'] || 0) + 1; }));
  const cost = sum((r) => r.m.cost_usd);
  return { requests: n, records: n * PER_REQ, concurrency: conc, wall_s: +wall.toFixed(2), throughput_rps: +(n / wall).toFixed(2),
    p50_ms: pct(0.5), p95_ms: pct(0.95), max_ms: Math.round(lat[lat.length - 1]),
    success: out.filter((r) => r.ok).length, success_pct: +(100 * out.filter((r) => r.ok).length / n).toFixed(1),
    degraded_records: sum((r) => r.degraded), http_errors: codes, ai_error_kinds: errKinds,
    ai_calls: sum((r) => r.m.ai_calls), retries: sum((r) => r.m.retries), repairs: sum((r) => r.m.repairs), provider_fallbacks: sum((r) => r.m.provider_fallbacks),
    tokens_in: sum((r) => r.m.tokens_in), tokens_out: sum((r) => r.m.tokens_out), cost_usd: +cost.toFixed(5),
    cost_per_100_requests: +(cost / n * 100).toFixed(4), peak_n8n_mem_mb: peak,
    sample_errors: [...new Set(out.filter((r) => r.err).map((r) => String(r.err).slice(0, 120)))].slice(0, 5) };
}

const started = new Date().toISOString();
console.log(`Scale test → ${URL_}  levels=${LEVELS}  per-request=${PER_REQ}  conc=${MAX_CONC || 'burst'}`);
const results = [];
for (const n of LEVELS) {
  process.stdout.write(`  ${String(n).padStart(4)} requests … `);
  const r = await level(n); results.push(r);
  console.log(`${r.wall_s}s · ${r.success_pct}% ok · p95 ${r.p95_ms}ms · $${r.cost_usd} · errors ${JSON.stringify(r.http_errors)} ${JSON.stringify(r.ai_error_kinds)}`);
  const spent = results.reduce((t, x) => t + x.cost_usd, 0);
  if (spent >= BUDGET) { console.log(`  stopping: $${spent.toFixed(2)} spent, budget is $${BUDGET}`); break; }
  await new Promise((s) => setTimeout(s, 3000));        // let rate-limit windows reset between levels
}

const stamp = started.replace(/[-:]/g, '').slice(0, 15) + 'Z';
const dir = path.join(ROOT, 'data/scale'); fs.mkdirSync(dir, { recursive: true });
const meta = { started, url: URL_, per_request: PER_REQ, concurrency_cap: MAX_CONC || 'burst', label: LABEL, node: process.version };
fs.writeFileSync(path.join(dir, `scale_${stamp}.json`), JSON.stringify({ meta, results }, null, 2));
const md = [`# Scale test ${stamp}${LABEL ? ' — ' + LABEL : ''}`, '', `Endpoint \`${URL_}\` · ${PER_REQ} record(s) per request · concurrency ${MAX_CONC || 'all at once'}`, '',
  '| Requests | Concurrency | Wall time | Req/s | p50 | p95 | Max | Success | Degraded records | HTTP errors | AI errors | Retries | Cost | Cost / 100 req | Peak n8n MB |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...results.map((r) => `| ${r.requests} | ${r.concurrency} | ${r.wall_s}s | ${r.throughput_rps} | ${r.p50_ms}ms | ${r.p95_ms}ms | ${r.max_ms}ms | ${r.success_pct}% | ${r.degraded_records} | ${JSON.stringify(r.http_errors)} | ${JSON.stringify(r.ai_error_kinds)} | ${r.retries} | $${r.cost_usd} | $${r.cost_per_100_requests} | ${r.peak_n8n_mem_mb ?? '—'} |`)].join('\n');
fs.writeFileSync(path.join(dir, `scale_${stamp}.md`), md + '\n');
console.log(`\nSaved data/scale/scale_${stamp}.json and .md`);
