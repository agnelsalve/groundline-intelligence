// Error handler — runs when any Groundline workflow fails outright.
// (Expected failures — an AI timeout, a dead feed — are handled inside the main
// workflow and never reach this point. This catches the unexpected ones.)
// Sends a readable email and writes an error log, so a failure is never silent.
const e = $input.first().json;
const ex = e.execution || {}, wf = e.workflow || {}, err = ex.error || e.trigger?.error || {};
const at = new Date().toISOString();
// Execution id in the name: several runs can fail in the same second (seen in the scale test).
const id = at.replace(/[-:]/g, '').slice(0, 15) + 'Z' + (ex.id ? `_exec${ex.id}` : '');
let dataDir = ''; try { dataDir = ($env.GROUNDLINE_DATA_DIR || '').split('\\').join('/').replace(/\/$/, ''); } catch (x) { /* env blocked */ }

const hint = /GROUNDLINE_|environment/i.test(err.message || '') ? 'Start n8n with scripts/start-n8n.ps1 so the environment variables are set.'
  : /credential|auth|535|EAUTH/i.test(err.message || '') ? 'Check the Gmail app password in .env and re-run scripts/setup-credentials.ps1.'
  : /No brief/i.test(err.message || '') ? 'Every source and AI provider failed — check the run summary and the quality report.'
  : 'Open the execution in n8n to see the failing node’s input.';
const rows = [['Workflow', wf.name || wf.id || 'unknown'], ['Failed node', ex.lastNodeExecuted || 'unknown'], ['Error', err.message || 'no message'],
  ['Execution', ex.id ? `#${ex.id} (${ex.mode || ''})` : 'n/a'], ['When', at], ['Suggested fix', hint]];
const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;border:1px solid #fecaca;border-top:4px solid #b91c1c;border-radius:8px;padding:18px 22px">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b91c1c;font-weight:700">Groundline · workflow failure</div>
<h2 style="margin:6px 0 12px;color:#0f172a">${String(wf.name || 'A Groundline workflow').replace(/</g, '&lt;')} stopped</h2>
<table style="border-collapse:collapse;font-size:14px;width:100%">${rows.map(([k, v]) => `<tr><td style="padding:5px 10px 5px 0;color:#64748b;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:5px 0;color:#0f172a">${String(v).replace(/</g, '&lt;')}</td></tr>`).join('')}</table>
${ex.url ? `<p style="margin:14px 0 0"><a href="${ex.url}">Open the execution in n8n</a></p>` : ''}</div>`;
const log = { id, at, workflow: wf, node: ex.lastNodeExecuted, error: { message: err.message, description: err.description, stack: String(err.stack || '').slice(0, 1500) }, execution_id: ex.id, hint };
return [{ json: { subject: `[Groundline] FAILED: ${wf.name || 'workflow'} at "${ex.lastNodeExecuted || '?'}"`, html, file_path: `${dataDir}/runs/errors/error_${id}.json` },
  binary: { data: await this.helpers.prepareBinaryData(Buffer.from(JSON.stringify(log, null, 2)), `error_${id}.json`, 'application/json') } }];
