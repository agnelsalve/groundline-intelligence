// Compose __KIND__ alert — turns the Switch decision into an email a person can act on.
// Only NEW items alert: anything already alerted on a previous run (kept in the cache)
// is skipped, so a story that stays in the news doesn't page you every week.
const KIND = '__KIND__';
const cfg = $('Run config').first().json;
const run = $('AI Analyst').all().map((i) => i.json).find((j) => j._type === 'ai_run');
const alerted = (run && run.cache && run.cache.alerted) || {};
const items = $input.all().map((i) => i.json).filter((j) => j._type === 'record' && j.route === KIND);
const fresh = items.filter((r) => !alerted[r.record_id]);
if (!fresh.length) return [];

const isRisk = KIND === 'urgent_risk';
const title = isRisk
  ? `Brand risk: ${fresh.length} new item${fresh.length > 1 ? 's' : ''} need attention`
  : `Opportunity: ${fresh.length} competitor signal${fresh.length > 1 ? 's' : ''} Weave can act on`;
const rule = isRisk
  ? 'relevance ≥ 2 and risk_to_weave = high (or a very negative Weave item rated medium)'
  : 'relevance ≥ 2 and opportunity_for_weave = high';

const cards = fresh.slice(0, 12).map((r) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-left:4px solid ${isRisk ? C.red : C.green};border-radius:8px;margin:0 0 14px">
<tr><td style="padding:14px 16px">
  <div style="font-size:12px;color:${C.muted};margin-bottom:4px">${esc(r.entity)} · ${esc(r.source_name)} · ${esc(r.published_date)} · ${esc(r.theme.replace(/_/g, ' '))}</div>
  <div style="font-size:16px;font-weight:700;color:${C.ink};margin-bottom:6px"><a href="${esc(r.url)}" style="color:${C.ink};text-decoration:none">${esc(r.title)}</a></div>
  <div style="margin-bottom:8px">${levelPill('Risk', r.risk_to_weave)} ${levelPill('Opportunity', r.opportunity_for_weave)} ${sentPill(r.sentiment)} ${pill(r.evidence, C.blue, C.blueSoft)}</div>
  <div style="font-size:14px;color:${C.body}"><b>What happened:</b> ${esc(r.key_fact)}</div>
  <div style="font-size:14px;color:${C.body};margin-top:4px"><b>Why it was flagged:</b> ${esc(r.why)}</div>
  <div style="font-size:12px;color:${C.muted};margin-top:6px">Record ${esc(r.record_id)} · judged by ${esc(r.analysis_source)}</div>
</td></tr></table>`).join('');

const body = `<p style="margin:0 0 16px">${isRisk
  ? 'Groundline flagged these items as a <b>risk to Weave\'s brand</b>. Each one links to its source so you can verify before acting.'
  : 'Groundline spotted these <b>competitor moves or stumbles</b> that Weave could respond to.'}</p>${cards}
${fresh.length > 12 ? `<p style="color:${C.muted}">…and ${fresh.length - 12} more in the attached weekly brief.</p>` : ''}`;
const footer = `Decision rule: ${esc(rule)}.<br>Run ${esc(cfg.run_id)} · alerts are sent once per record (repeats are suppressed).`;
const html = emailShell({ title, preheader: fresh.map((r) => r.title).slice(0, 2).join(' · '), body, footer });

const file = `alerts/${cfg.run_date}_${KIND}.html`;
return [{
  json: { kind: KIND, subject: `[Groundline] ${title}`, html, alert_ids: fresh.map((r) => r.record_id),
    count: fresh.length, file_path: `${cfg.out_dir}/${file}`, file },
  binary: { data: await this.helpers.prepareBinaryData(Buffer.from(html, 'utf8'), file.split('/').pop(), 'text/html') },
}];
