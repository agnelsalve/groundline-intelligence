// Checks that the keys in .env work — without ever printing them.
//   node scripts/check-setup.mjs
// Sends one tiny request to each configured AI provider (costs a fraction of a cent).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(ROOT, '.env');
if (!fs.existsSync(envFile)) { console.log('✗ No .env file — copy .env.example to .env first.'); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, '')]));
const real = (v) => v && !/^your_|_here$/i.test(v);
const mask = (v) => (real(v) ? `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} chars)` : 'not set');

async function ping(label, base, key, model) {
  if (!real(key)) { console.log(`– ${label}: not set (skipped)`); return; }
  try {
    const t0 = Date.now();
    const res = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with the single word: ready' }], max_completion_tokens: 200 }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { console.log(`✗ ${label} (${mask(key)}): HTTP ${res.status} — ${JSON.stringify(body.error || body).slice(0, 200)}`); return; }
    const text = body.choices?.[0]?.message?.content?.trim() || '(empty)';
    console.log(`✓ ${label} works — model ${model}, replied "${text.slice(0, 30)}" in ${Date.now() - t0} ms, tokens ${body.usage?.prompt_tokens ?? '?'}/${body.usage?.completion_tokens ?? '?'}`);
  } catch (e) { console.log(`✗ ${label}: ${e.message}`); }
}

const G = env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
await ping('Gemini analyst', G, env.GEMINI_API_KEY, env.GEMINI_ANALYST_MODEL || 'gemini-3.5-flash-lite');
await ping('Gemini writer', G, env.GEMINI_API_KEY, env.GEMINI_MODEL || 'gemini-3.8-flash');
await ping('Gemini fact-checker', G, env.GEMINI_API_KEY, env.GEMINI_CHECK_MODEL || 'gemini-3.5-flash');
await ping('Muse Spark (optional)', env.MUSE_BASE_URL || 'https://api.meta.ai/v1', env.MUSE_API_KEY, env.MUSE_MODEL || 'muse-spark-1.3');
const gm = env.GMAIL_ADDRESS, gp = (env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
console.log(real(gm) && /@gmail\.com$/i.test(gm) ? `✓ Gmail address set: ${gm}` : '✗ GMAIL_ADDRESS not set (must end in @gmail.com)');
console.log(real(env.GMAIL_APP_PASSWORD) ? (gp.length === 16 ? '✓ Gmail app password looks right (16 letters)' : `✗ Gmail app password should be 16 letters, found ${gp.length}`) : '✗ GMAIL_APP_PASSWORD not set');
