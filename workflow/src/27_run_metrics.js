// Run metrics + cache save — the monitoring record for this run.
//   data/cache/analysis_cache.json   AI judgements reused next run + ids already alerted
//   data/runs/run_<id>.json          timings, tokens, cost, fallbacks, delivery status
//   outputs/run_summary.md           the same, readable (latest run)
const cfg = $('Run config').first().json;
const safe = (name) => { try { return $(name).all().map((i) => i.json); } catch (e) { return null; } }; // node may not have run
const aiRun = (name) => (safe(name) || []).find((j) => j._type === 'ai_run') || null;
const analyst = aiRun('AI Analyst'), writer = aiRun('AI Brief Writer'), checker = aiRun('AI Fact-Checker');
const briefs = (safe('AI Fact-Checker') || []).filter((j) => j._type === 'brief');
const records = (safe('AI Analyst') || []).filter((j) => j._type === 'record');

const delivery = (send, compose) => {
  const c = safe(compose); const s = safe(send);
  if (!c || !c.length) return { status: 'nothing_to_send' };
  if (!s || !s.length) return { status: 'not_attempted', count: c[0].count };
  // Only an SMTP acceptance counts as sent; anything else (error item, empty item) is a failure.
  const ok = s[0].messageId || (Array.isArray(s[0].accepted) && s[0].accepted.length);
  if (!ok) {
    const err = s[0].error;
    const why = err ? String(err.message || err) : 'Gmail did not accept the message (credential missing or rejected; run scripts/setup-credentials.ps1)';
    return { status: 'failed', error: why.slice(0, 200), saved_to: c[0].file };
  }
  return { status: 'sent', message_id: s[0].messageId || '', accepted: s[0].accepted || [], count: c[0].count, saved_to: c[0].file };
};
const email = {
  weekly_digest: delivery('Send weekly digest', 'Compose digest email'),
  risk_alert: delivery('Send risk alert', 'Compose risk alert'),
  opportunity_alert: delivery('Send opportunity alert', 'Compose opportunity alert'),
};

// Remember alerted ids so the same story never alerts twice.
const cache = (analyst && analyst.cache) || { analysis: {}, alerted: {} };
for (const n of ['Compose risk alert', 'Compose opportunity alert']) {
  for (const a of safe(n) || []) for (const id of a.alert_ids || []) cache.alerted[id] = cfg.run_date;
}

const steps = { analyst, writer, checker };
const sum = (f) => Object.values(steps).reduce((s, x) => s + ((x && x.ai && f(x.ai)) || 0), 0);
const metrics = {
  run_id: cfg.run_id, started_at: cfg.collected_at, finished_at: new Date().toISOString(),
  duration_s: +((Date.now() - Date.parse(cfg.collected_at)) / 1000).toFixed(1),
  records_judged: records.length,
  routes: records.reduce((m, r) => ((m[r.route] = (m[r.route] || 0) + 1), m), {}),
  analysis: analyst ? analyst.stats : null, cache_status: analyst ? analyst.cache_status : null,
  ai: { calls: sum((a) => a.calls), retries: sum((a) => a.retries), repairs: sum((a) => a.repairs), provider_fallbacks: sum((a) => a.provider_fallbacks),
    failed_tasks: sum((a) => a.failed), tokens_in: sum((a) => a.tokens_in), tokens_out: sum((a) => a.tokens_out), cost_usd: +sum((a) => a.cost_usd).toFixed(5),
    providers: analyst ? analyst.ai.providers_configured : [],
    step_seconds: Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v ? +(v.duration_ms / 1000).toFixed(1) : null])),
    latency_p50_ms: analyst ? analyst.ai.latency_p50_ms : null, latency_p95_ms: analyst ? analyst.ai.latency_p95_ms : null,
    errors: Object.values(steps).flatMap((x) => (x && x.ai ? x.ai.errors : [])).slice(0, 25) },
  briefs: briefs.map((b) => ({ key: b.key, written_by: b.written_by, write_error: b.write_error || null, ...b.fact_check, log: undefined })),
  email,
};

const md = `# Groundline run summary

**Run** \`${cfg.run_id}\` · ${metrics.duration_s}s · ${metrics.records_judged} records judged · AI cost **$${metrics.ai.cost_usd.toFixed(4)}**

| Step | Seconds |
|---|---|
${Object.entries(metrics.ai.step_seconds).map(([k, v]) => `| ${k} | ${v ?? '—'} |`).join('\n')}

| AI usage | Value |
|---|---|
| Calls | ${metrics.ai.calls} |
| Retries / JSON repairs / provider fallbacks | ${metrics.ai.retries} / ${metrics.ai.repairs} / ${metrics.ai.provider_fallbacks} |
| Tokens in / out | ${metrics.ai.tokens_in} / ${metrics.ai.tokens_out} |
| Records from cache | ${metrics.analysis ? metrics.analysis.cache_hits : 0} |
| Records judged by AI / by keyword fallback | ${metrics.analysis ? metrics.analysis.ai_analyzed : 0} / ${metrics.analysis ? metrics.analysis.fallback : 0} |
| Circuit breaker opened | ${metrics.analysis && metrics.analysis.circuit_open ? 'yes' : 'no'} |

| Brief | Written by | Groundedness | Status |
|---|---|---|---|
${metrics.briefs.map((b) => `| ${b.key} | ${b.written_by} | ${b.groundedness === null ? '—' : Math.round(b.groundedness * 100) + '%'} | ${b.status} |`).join('\n')}

| Email | Status |
|---|---|
${Object.entries(email).map(([k, v]) => `| ${k} | ${v.status}${v.error ? ' — ' + v.error : ''} |`).join('\n')}

Routes: ${Object.entries(metrics.routes).map(([k, v]) => `${k} ${v}`).join(' · ')}
${metrics.ai.errors.length ? '\n## Errors handled\n\n' + metrics.ai.errors.map((e) => `- \`${e.task}\` ${e.provider || ''} ${e.kind || ''}: ${e.error}`).join('\n') : ''}
`;

const bin = async (s, name, mime) => this.helpers.prepareBinaryData(Buffer.from(s, 'utf8'), name, mime);
return [
  { json: { file_path: `${cfg.data_dir}/cache/analysis_cache.json` }, binary: { data: await bin(JSON.stringify(cache), 'analysis_cache.json', 'application/json') } },
  { json: { file_path: `${cfg.data_dir}/runs/run_${cfg.run_id}.json`, metrics }, binary: { data: await bin(JSON.stringify(metrics, null, 2), `run_${cfg.run_id}.json`, 'application/json') } },
  { json: { file_path: `${cfg.out_dir}/run_summary.md` }, binary: { data: await bin(md, 'run_summary.md', 'text/markdown') } },
];
