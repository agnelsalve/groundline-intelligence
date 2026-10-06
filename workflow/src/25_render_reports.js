// Render reports — the human-readable output. One item per file; "Write report files" saves them.
//   outputs/briefs/<date>_<entity>.html     one verified brief per company (+ market)
//   outputs/<date>_dashboard.html           Weave vs competitors at a glance
//   outputs/data/<date>_scored_records.csv  every record with the AI's judgement (opens in Excel)
//   outputs/<date>_fact_check.md            every claim, its verdict and the reason
//   outputs/charts/<date>_sentiment.png     chart image (also used in the email)
const cfg = $('Run config').first().json;
const briefs = $input.all().map((i) => i.json).filter((j) => j._type === 'brief');
const records = $('AI Analyst').all().map((i) => i.json).filter((j) => j._type === 'record');
const runs = ['AI Analyst', 'AI Brief Writer', 'AI Fact-Checker'].map((n) => $(n).all().map((i) => i.json).find((j) => j._type === 'ai_run'));
const analyst = runs[0];
const aiCost = runs.reduce((s, r) => s + ((r && r.ai && r.ai.cost_usd) || 0), 0);
const models = [...new Set(runs.flatMap((r) => (r && r.ai ? Object.keys(r.ai.by_provider) : [])))];
const recById = Object.fromEntries(records.map((r) => [r.record_id, r]));
const out = [];
const file = async (rel, content, mime) => out.push({ json: { file: rel, file_path: `${cfg.out_dir}/${rel}`, bytes: Buffer.byteLength(content) },
  binary: { data: await this.helpers.prepareBinaryData(Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'), rel.split('/').pop(), mime) } });

const badge = (fc) => {
  const pct = fc.groundedness === null ? '—' : Math.round(fc.groundedness * 100) + '%';
  const cls = fc.status === 'verified' ? 'ok' : fc.status === 'needs_review' ? 'warn' : 'bad';
  if (fc.status === 'ai_offline') return '<span class="badge warn">AI offline · source list only</span>';
  const word = { verified: 'Fact-checked', needs_review: 'Needs review', failed: 'Failed fact-check', unverified: 'Not fact-checked' }[fc.status];
  return `<span class="badge ${cls}">${word} · ${pct} grounded</span>`;
};
const cites = (ids) => (ids || []).map((id) => recById[id]
  ? `<a class="cite" href="${esc(recById[id].url)}" title="${esc(recById[id].title)} — ${esc(recById[id].source_name)}, ${esc(recById[id].published_date)}">${esc(id.replace('GL-', ''))}</a>`
  : `<span class="cite" style="background:#fee2e2;color:#b91c1c">${esc(id)}?</span>`).join('');
const verdictMark = (v) => (v === 'partial' ? ' <span class="small" title="Partly supported by its sources">◐ partial</span>' : '');
const sourceLabel = (s) => (s === 'cache' ? 'AI (cached)' : s.startsWith('ai:') ? 'AI · ' + s.slice(3) : 'keyword rules');

// ---------------------------------------------------------------- briefs
for (const b of briefs) {
  const p = b.published, st = b.stats, fc = b.fact_check;
  const sections = p.sections.map((s) => `<div class="card"><h3>${esc(s.title)}</h3><ul class="claims">${s.claims
    .map((c) => `<li>${esc(c.text)}${cites(c.cite)}${verdictMark(c.verdict)}</li>`).join('')}</ul></div>`).join('');
  const actions = p.actions.map((a, i) => `<tr><td><b>${i + 1}.</b></td><td><b>${esc(a.action)}</b><br><span class="small">${esc(a.why || '')}</span> ${cites(a.cite)}</td></tr>`).join('');
  const themes = Object.entries(st.themes).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v }));
  const removed = fc.log.filter((c) => c.verdict === 'unsupported');
  const evidenceRows = b.evidence.map((e) => { const r = recById[e.id] || {}; return `<tr><td>${esc(e.id.replace('GL-', ''))}</td><td><a href="${esc(r.url)}">${esc(e.title)}</a><br><span class="small">${esc(e.key_fact)}</span></td><td>${esc(e.source)}</td><td>${esc(e.date)}</td><td>${sentPill(e.sentiment)}</td></tr>`; }).join('');
  const html = pageShell(`${b.title} — ${cfg.run_date}`, `
<header class="top"><div class="kicker">Groundline brand intelligence · week of ${esc(cfg.run_date)}</div>
<h1>${esc(p.headline)}</h1><div class="meta">${esc(b.title)} · ${st.records} items from ${st.sources} sources · ${esc(st.date_range)}</div>
<p style="margin:12px 0 0">${badge(fc)}</p></header>
<p class="lede">${esc(p.summary)}</p>
<div class="grid">
 <div class="tile"><div class="l">Items tracked</div><div class="v">${st.records}</div></div>
 <div class="tile"><div class="l">Avg. sentiment (−2…+2)</div><div class="v">${fmtSent(st.avg_sentiment)}</div></div>
 <div class="tile"><div class="l">Positive / neutral / negative</div><div class="v">${st.positive} / ${st.neutral} / ${st.negative}</div></div>
 <div class="tile"><div class="l">Risks · openings flagged</div><div class="v">${st.risks_high_or_medium} · ${st.opportunities_high_or_medium}</div></div>
</div>
${sections}
${p.archetype_read ? `<div class="card"><h3>Brand archetype read</h3><p style="margin:0">${esc(p.archetype_read.text)}${cites(p.archetype_read.cite)}</p>
<p class="small" style="margin:6px 0 0">Archetype votes across items: ${Object.entries(st.archetypes).map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || 'none'}</p></div>` : ''}
<h2>Recommended actions</h2><div class="card"><table class="t">${actions}</table></div>
<h2>What the coverage is about</h2><div class="card">${themes.length ? svgBars(themes, { unit: '' }) : '<p class="small">No themes.</p>'}</div>
<h2>Fact-check</h2><div class="card"><p style="margin:0 0 8px">${fc.claims_total} claims checked by <b>${esc(fc.checker === 'none' ? 'rules only' : fc.checker)}</b>:
${fc.supported} supported, ${fc.partial} partial, ${fc.unsupported} unsupported${fc.unverified ? `, ${fc.unverified} unverified` : ''}.
${fc.fabricated_citations ? `${fc.fabricated_citations} fabricated citation(s) caught.` : 'No fabricated citations.'}</p>
${removed.length ? `<p class="small" style="margin:0 0 4px">Removed before publishing:</p><ul class="claims">${removed.map((c) => `<li class="strike">${esc(c.text)}</li><li style="list-style:none" class="small">↳ ${esc(c.reason)}</li>`).join('')}</ul>` : '<p class="small" style="margin:0">Nothing had to be removed.</p>'}
${fc.check_error ? `<p class="small">Checker error: ${esc(fc.check_error)}</p>` : ''}</div>
<h2>Evidence used</h2><div class="card" style="overflow-x:auto"><table class="t"><tr><th>ID</th><th>Item</th><th>Source</th><th>Date</th><th>Tone</th></tr>${evidenceRows}</table></div>
<footer>Written by ${esc(b.written_by)} · fact-checked by ${esc(fc.checker)} · run ${esc(cfg.run_id)} · every number on this page is computed from the records, not generated.<br>
Built with n8n + Muse Spark · Groundline v2 · INFO 7375 Branding &amp; AI · Agnel Salve</footer>`);
  await file(`briefs/${cfg.run_date}_${b.key}.html`, html, 'text/html');
}

// ---------------------------------------------------------------- dashboard
const ENT = ['Weave', 'Podium', 'Birdeye', 'NexHealth', 'Solutionreach', 'RevenueWell', 'Lighthouse 360'];
const brandRecs = records.filter((r) => r.relevance >= 2 && ENT.includes(r.entity));
const rows = ENT.map((e) => { const rs = brandRecs.filter((r) => r.entity === e);
  if (!rs.length) return null;
  const arch = Object.entries(rs.reduce((m, r) => (r.archetype ? ((m[r.archetype] = (m[r.archetype] || 0) + 1), m) : m), {})).sort((a, b) => b[1] - a[1])[0];
  return { e, n: rs.length, s: +(rs.reduce((a, r) => a + r.sentiment, 0) / rs.length).toFixed(2), neg: rs.filter((r) => r.sentiment < 0).length,
    risk: rs.filter((r) => ['medium', 'high'].includes(r.risk_to_weave)).length, opp: rs.filter((r) => ['medium', 'high'].includes(r.opportunity_for_weave)).length, arch: arch ? arch[0] : '—' };
}).filter(Boolean);
const totalBrand = rows.reduce((a, r) => a + r.n, 0) || 1;
const alertRows = records.filter((r) => r.route === 'urgent_risk' || r.route === 'opportunity');
const discarded = records.filter((r) => r.route === 'discard');
const src = analyst.stats;
const dash = pageShell(`Groundline dashboard — ${cfg.run_date}`, `
<header class="top"><div class="kicker">Groundline brand intelligence · ${esc(cfg.run_date)}</div><h1>Weave vs. the market, this week</h1>
<div class="meta">${records.length} records judged · ${brandRecs.length} about Weave or a competitor · run ${esc(cfg.run_id)}</div></header>
<div class="grid">
 <div class="tile"><div class="l">Records judged</div><div class="v">${records.length}</div></div>
 <div class="tile"><div class="l">Judged by AI</div><div class="v">${src.ai_analyzed + src.cache_hits}</div></div>
 <div class="tile"><div class="l">Filtered as irrelevant</div><div class="v">${discarded.length}</div></div>
 <div class="tile"><div class="l">Alerts raised</div><div class="v">${alertRows.length}</div></div>
 <div class="tile"><div class="l">AI cost this run</div><div class="v">${fmtUsd(aiCost)}</div></div>
</div>
<h2>Share of voice (brand items)</h2><div class="card">${svgBars(rows.map((r) => ({ label: r.e, value: Math.round((r.n / totalBrand) * 100), color: r.e === 'Weave' ? C.accent : '#94a3b8' })), { unit: '%' })}</div>
<h2>Average sentiment (−2 … +2)</h2><div class="card">${svgBars(rows.map((r) => ({ label: r.e, value: r.s, color: r.s < 0 ? C.red : C.green })), { signed: true, max: 2 })}</div>
<h2>Side by side</h2><div class="card" style="overflow-x:auto"><table class="t"><tr><th>Company</th><th>Items</th><th>Avg. sentiment</th><th>Negative</th><th>Risks to Weave</th><th>Openings for Weave</th><th>Cast as</th></tr>
${rows.map((r) => `<tr><td><b>${esc(r.e)}</b></td><td>${r.n}</td><td>${fmtSent(r.s)}</td><td>${r.neg}</td><td>${r.risk}</td><td>${r.opp}</td><td>${esc(r.arch)}</td></tr>`).join('')}</table></div>
<h2>Briefs</h2>${briefs.map((b) => `<div class="card"><h3><a href="briefs/${cfg.run_date}_${b.key}.html">${esc(b.title)}</a></h3><p style="margin:0 0 6px">${esc(b.published.headline)}</p>${badge(b.fact_check)} <span class="small">· written by ${esc(b.written_by)}</span></div>`).join('')}
<h2>Alerts raised</h2><div class="card">${alertRows.length ? `<table class="t"><tr><th>Type</th><th>Item</th><th>Why</th></tr>${alertRows.map((r) => `<tr><td>${r.route === 'urgent_risk' ? levelPill('Risk', r.risk_to_weave) : levelPill('Opening', r.opportunity_for_weave)}</td><td><a href="${esc(r.url)}">${esc(r.title)}</a><br><span class="small">${esc(r.entity)} · ${esc(r.source_name)} · ${esc(r.published_date)}</span></td><td class="small">${esc(r.why)}</td></tr>`).join('')}</table>` : '<p class="small" style="margin:0">No item crossed the alert threshold this run.</p>'}</div>
<h2>Noise the AI filtered out</h2><div class="card"><p class="small" style="margin:0 0 6px">Items the keyword rules kept but the AI judged unrelated (relevance 0) — e.g. a sports "podium":</p>
<ul class="claims">${discarded.slice(0, 8).map((r) => `<li>${esc(r.title)} <span class="small">— ${esc(r.why)}</span></li>`).join('') || '<li class="small">none</li>'}</ul></div>
<h2>How each record was judged</h2><div class="card"><p style="margin:0">AI: ${src.ai_analyzed} · from cache: ${src.cache_hits} · keyword fallback: ${src.fallback}${Object.keys(src.fallback_reasons).length ? ` (${Object.entries(src.fallback_reasons).map(([k, v]) => `${esc(k)} ${v}`).join(', ')})` : ''}${src.circuit_open ? ' · <b>circuit breaker opened</b>' : ''}</p></div>
<footer>Models used: ${esc(models.join(', ') || 'none (rules only)')} · Built with n8n + Muse Spark · Groundline v2 · INFO 7375 · Agnel Salve</footer>`);
await file(`${cfg.run_date}_dashboard.html`, dash, 'text/html');

// ---------------------------------------------------------------- scored CSV
const COLS = ['record_id', 'published_date', 'entity', 'relevance', 'sentiment', 'theme', 'evidence', 'risk_to_weave', 'opportunity_for_weave',
  'archetype', 'route', 'key_fact', 'why', 'analysis_source', 'title', 'source_name', 'url'];
const cell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = '﻿' + [COLS.join(','), ...[...records].sort((a, b) => b.relevance - a.relevance || b.published_date.localeCompare(a.published_date))
  .map((r) => COLS.map((c) => cell(r[c])).join(','))].join('\r\n');
await file(`data/${cfg.run_date}_scored_records.csv`, csv, 'text/csv');

// ---------------------------------------------------------------- fact-check log
const md = [`# Fact-check log — run ${cfg.run_id}`, '',
  '| Brief | Checker | Claims | Supported | Partial | Unsupported | Groundedness | Status |', '|---|---|---|---|---|---|---|---|',
  ...briefs.map((b) => { const f = b.fact_check; return `| ${b.title} | ${f.checker} | ${f.claims_total} | ${f.supported} | ${f.partial} | ${f.unsupported} | ${f.groundedness === null ? '—' : Math.round(f.groundedness * 100) + '%'} | ${f.status} |`; }), '',
  ...briefs.flatMap((b) => [`## ${b.title}`, '', ...b.fact_check.log.map((c) => `- **${c.verdict}** — ${c.text.replace(/\|/g, '/')}  \n  _cites ${c.cite.join(', ') || 'nothing'} · ${c.reason || ''}_`), ''])].join('\n');
await file(`${cfg.run_date}_fact_check.md`, md, 'text/markdown');

// ---------------------------------------------------------------- chart PNG (optional: QuickChart may be unreachable)
const chartCfg = { type: 'bar', data: { labels: rows.map((r) => r.e), datasets: [
  { label: 'Avg. sentiment (−2…+2)', data: rows.map((r) => r.s), backgroundColor: rows.map((r) => (r.e === 'Weave' ? '#0f766e' : '#94a3b8')) }] },
  options: { plugins: { legend: { display: false }, title: { display: true, text: `Brand sentiment, week of ${cfg.run_date}` } }, scales: { y: { min: -2, max: 2 } } } };
const chartUrl = quickChartUrl(chartCfg);
let chartOk = false;
try {
  const png = await this.helpers.httpRequest({ method: 'GET', url: chartUrl, encoding: 'arraybuffer', timeout: 20000 });
  await file(`charts/${cfg.run_date}_sentiment.png`, Buffer.from(png), 'image/png'); chartOk = true;
} catch (e) { /* the email falls back to the table; noted in metrics */ }

out.forEach((o) => { o.json.chart_url = chartUrl; o.json.chart_ok = chartOk; });
return out;
