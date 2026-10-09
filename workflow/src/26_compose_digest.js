// Compose the weekly digest email — the Weave brief in the inbox, with the full
// HTML briefs, dashboard and scored spreadsheet attached. Also saved as a file, so
// the output exists even if email delivery fails.
const cfg = $('Run config').first().json;
const briefs = $('AI Fact-Checker').all().map((i) => i.json).filter((j) => j._type === 'brief');
const files = $('Render reports').all();
const records = $('AI Analyst').all().map((i) => i.json).filter((j) => j._type === 'record');
const weave = briefs.find((b) => b.key === 'weave') || briefs[0];
if (!weave) throw new Error('No brief was produced — nothing to email.');
const p = weave.published, fc = weave.fact_check, st = weave.stats;
const chartOk = files.length && files[0].json.chart_ok;
const chartUrl = files.length && files[0].json.chart_url;
const alerts = records.filter((r) => r.route === 'urgent_risk' || r.route === 'opportunity').length;

const statusColor = fc.status === 'verified' ? C.green : fc.status === 'needs_review' ? C.amber : C.red;
const statusBg = fc.status === 'verified' ? C.greenSoft : fc.status === 'needs_review' ? C.amberSoft : C.redSoft;
const gpct = fc.status === 'ai_offline' ? 'AI offline: source list only' : fc.groundedness === null ? 'not checked' : Math.round(fc.groundedness * 100) + '% grounded';
const keyPoints = p.sections.map((s) => s.claims[0] && `<li style="margin:0 0 6px"><b>${esc(s.title)}:</b> ${esc(s.claims[0].text)}</li>`).filter(Boolean).join('');
const actions = p.actions.map((a) => `<li style="margin:0 0 6px"><b>${esc(a.action)}</b><br><span style="color:${C.muted};font-size:13px">${esc(a.why || '')}</span></li>`).join('');
const others = briefs.filter((b) => b !== weave).map((b) => `<tr><td style="padding:6px 0;border-bottom:1px solid ${C.line}"><b>${esc(b.entity)}</b> — ${esc(b.published.headline)}
  <span style="color:${C.muted};font-size:12px">(${b.fact_check.groundedness === null ? 'unchecked' : Math.round(b.fact_check.groundedness * 100) + '% grounded'})</span></td></tr>`).join('');

const body = `
<div style="margin:0 0 12px">${pill(`${fc.status.replace('_', ' ')} · ${gpct}`, statusColor, statusBg)} ${pill(`${st.records} items · avg sentiment ${fmtSent(st.avg_sentiment)}`, C.accent, C.accentSoft)}${alerts ? ' ' + pill(`${alerts} alert${alerts > 1 ? 's' : ''} raised`, C.red, C.redSoft) : ''}</div>
<div style="font-size:19px;font-weight:700;color:${C.ink};margin:0 0 8px">${esc(p.headline)}</div>
<p style="margin:0 0 16px">${esc(p.summary)}</p>
<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${C.accent};margin:18px 0 8px">Key points</div>
<ul style="padding-left:18px;margin:0">${keyPoints}</ul>
<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${C.accent};margin:18px 0 8px">Recommended actions</div>
<ol style="padding-left:18px;margin:0">${actions}</ol>
${chartOk ? `<div style="margin:20px 0 4px"><img src="${esc(chartUrl)}" width="560" alt="Average sentiment by company" style="max-width:100%;border:1px solid ${C.line};border-radius:8px"></div>` : ''}
${others ? `<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${C.accent};margin:18px 0 8px">Competitors &amp; market</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${others}</table>` : ''}
<p style="margin:18px 0 0;font-size:13px;color:${C.muted}">Attached: the full Weave brief with every source linked, the competitor dashboard, and a spreadsheet of all ${records.length} judged records.</p>`;
const footer = `Every claim was checked against its cited sources by ${esc(fc.checker)} before sending; unsupported claims were removed.<br>
Run ${esc(cfg.run_id)} · written by ${esc(weave.written_by)} · fact-checked by ${esc(fc.checker)} · Groundline v2 · INFO 7375`;
const html = emailShell({ title: `Weave brand brief · ${cfg.run_date}`, preheader: p.headline, body, footer });

const pick = (name) => { const f = files.find((x) => x.json.file.endsWith(name)); return f && f.binary && f.binary.data; };
const binary = {};
const att = [];
for (const [key, name] of [['brief', `${cfg.run_date}_weave.html`], ['dashboard', `${cfg.run_date}_dashboard.html`], ['csv', `${cfg.run_date}_scored_records.csv`]]) {
  const b = pick(name); if (b) { binary[key] = b; att.push(key); }
}
const preview = `emails/${cfg.run_date}_weekly_digest.html`;
binary.preview = await this.helpers.prepareBinaryData(Buffer.from(html, 'utf8'), preview.split('/').pop(), 'text/html');
return [{ json: { subject: `[Groundline] Weave brand brief — ${p.headline}`, html, attachments: att.join(','), file: preview,
  file_path: `${cfg.out_dir}/${preview}`, groundedness: fc.groundedness, status: fc.status }, binary }];
