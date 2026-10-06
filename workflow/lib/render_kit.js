// ─── Groundline render kit ──────────────────────────────────────────────────
// Small HTML helpers shared by the report, alert and email nodes.
// Emails use inline styles and tables (Gmail strips <style> blocks and SVG);
// report pages use a stylesheet and print cleanly to PDF.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const C = { ink: '#0f172a', body: '#334155', muted: '#64748b', line: '#e2e8f0', bg: '#f8fafc', card: '#ffffff',
  accent: '#0f766e', accentSoft: '#ccfbf1', red: '#b91c1c', redSoft: '#fee2e2', amber: '#b45309', amberSoft: '#fef3c7',
  green: '#15803d', greenSoft: '#dcfce7', blue: '#1d4ed8', blueSoft: '#dbeafe' };
const SENT = { '-2': ['Very negative', C.red, C.redSoft], '-1': ['Negative', C.red, C.redSoft], '0': ['Neutral', C.muted, C.bg],
  '1': ['Positive', C.green, C.greenSoft], '2': ['Very positive', C.green, C.greenSoft] };
const LEVEL = { high: [C.red, C.redSoft], medium: [C.amber, C.amberSoft], low: [C.blue, C.blueSoft], none: [C.muted, C.bg] };
const sentWord = (s) => (SENT[String(Math.round(s))] || SENT['0'])[0];
const fmtSent = (avg) => (avg > 0 ? '+' : '') + (+avg).toFixed(2);
const pill = (text, fg, bg) => `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:600;line-height:18px;white-space:nowrap">${esc(text)}</span>`;
const sentPill = (s) => { const [t, fg, bg] = SENT[String(Math.round(s))] || SENT['0']; return pill(t, fg, bg); };
const levelPill = (label, lvl) => { const [fg, bg] = LEVEL[lvl] || LEVEL.none; return pill(`${label}: ${lvl}`, fg, bg); };
const fmtUsd = (x) => (x < 0.01 ? '$' + x.toFixed(4) : '$' + x.toFixed(2));

// QuickChart renders Chart.js configs to PNG — free, no key. Used where SVG can't go (email).
const quickChartUrl = (config, w = 560, h = 260) =>
  'https://quickchart.io/chart?bkg=white&w=' + w + '&h=' + h + '&c=' + encodeURIComponent(JSON.stringify(config));

function emailShell({ title, preheader, body, footer }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${C.body}">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:${C.card};border:1px solid ${C.line};border-radius:12px">
<tr><td style="padding:20px 28px;border-bottom:3px solid ${C.accent}">
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.accent};font-weight:700">Groundline · Brand Intelligence</div>
  <div style="font-size:22px;font-weight:700;color:${C.ink};margin-top:4px">${esc(title)}</div>
</td></tr>
<tr><td style="padding:20px 28px;font-size:15px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid ${C.line};font-size:12px;color:${C.muted};line-height:1.5">${footer || ''}</td></tr>
</table></td></tr></table></body></html>`;
}

const PAGE_CSS = `
:root{--ink:${C.ink};--body:${C.body};--muted:${C.muted};--line:${C.line};--bg:${C.bg};--card:#fff;--accent:${C.accent};--accent-soft:${C.accentSoft}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--body);font:15px/1.6 "Segoe UI",Inter,Helvetica,Arial,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:32px 20px 64px}
header.top{border-bottom:3px solid var(--accent);padding-bottom:16px;margin-bottom:24px}
.kicker{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);font-weight:700}
h1{font-size:30px;line-height:1.2;color:var(--ink);margin:6px 0 8px}h2{font-size:19px;color:var(--ink);margin:28px 0 10px}
h3{font-size:15px;color:var(--ink);margin:0 0 6px}
.meta{color:var(--muted);font-size:13px}.lede{font-size:17px;color:var(--ink)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.tile .v{font-size:26px;font-weight:700;color:var(--ink);line-height:1.1}.tile .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin:12px 0}
ul.claims{margin:0;padding-left:18px}ul.claims li{margin:6px 0}
.cite{display:inline-block;font-size:11px;font-weight:600;color:var(--accent);background:var(--accent-soft);border-radius:4px;padding:0 5px;margin-left:3px;text-decoration:none;vertical-align:1px}
.badge{display:inline-flex;gap:8px;align-items:center;border-radius:999px;padding:4px 12px;font-weight:700;font-size:13px}
.ok{background:#dcfce7;color:#15803d}.warn{background:#fef3c7;color:#b45309}.bad{background:#fee2e2;color:#b91c1c}
table.t{width:100%;border-collapse:collapse;font-size:13px}table.t th{text-align:left;color:var(--muted);font-weight:600;border-bottom:1px solid var(--line);padding:6px 8px}
table.t td{border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:top}
.small{font-size:12px;color:var(--muted)}a{color:var(--accent)}
.strike{text-decoration:line-through;color:var(--muted)}
footer{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;font-size:12px;color:var(--muted)}
@media print{body{background:#fff}.wrap{padding:0}.card,.tile{break-inside:avoid}a{color:inherit}}
@media (max-width:600px){h1{font-size:24px}.wrap{padding:20px 16px}}`;

const pageShell = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body><div class="wrap">${body}</div></body></html>`;

// Horizontal bar chart as inline SVG (report pages). rows: [{label, value, color}]
function svgBars(rows, { max, width = 560, unit = '', signed = false } = {}) {
  const h = 26, pad = 150, w = width - pad - 50;
  const m = max || Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const zero = signed ? pad + w / 2 : pad;
  const scale = signed ? w / 2 / m : w / m;
  const bars = rows.map((r, i) => {
    const len = Math.abs(r.value) * scale, x = r.value < 0 ? zero - len : zero, y = i * h + 4;
    return `<text x="${pad - 8}" y="${y + 13}" text-anchor="end" font-size="12" fill="${C.body}">${esc(r.label)}</text>
<rect x="${x}" y="${y}" width="${Math.max(len, 1)}" height="16" rx="3" fill="${r.color || C.accent}"/>
<text x="${r.value < 0 ? x - 4 : x + len + 4}" y="${y + 13}" text-anchor="${r.value < 0 ? 'end' : 'start'}" font-size="12" fill="${C.muted}">${signed && r.value > 0 ? '+' : ''}${r.value}${unit}</text>`;
  }).join('');
  const axis = signed ? `<line x1="${zero}" y1="0" x2="${zero}" y2="${rows.length * h}" stroke="${C.line}"/>` : '';
  return `<svg viewBox="0 0 ${width} ${rows.length * h + 6}" width="100%" role="img" xmlns="http://www.w3.org/2000/svg">${axis}${bars}</svg>`;
}
// ─── end render kit ─────────────────────────────────────────────────────────
