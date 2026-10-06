// Run config — the one place to change the collection window and output folders.
// Every downstream node reads these values via $('Run config').
const LOOKBACK_DAYS = 45;          // AI-industry sources (same as A3)
const BRAND_LOOKBACK_DAYS = 90;    // Weave + competitor sources: brand news is sparser

let dataDir, outDir;
try {
  dataDir = $env.GROUNDLINE_DATA_DIR;
  outDir = $env.GROUNDLINE_OUTPUT_DIR;
} catch (e) {
  throw new Error('n8n is blocking environment variables. Start n8n with scripts/start-n8n.ps1 (it sets N8N_BLOCK_ENV_ACCESS_IN_NODE=false).');
}
if (!dataDir || !outDir) {
  throw new Error('GROUNDLINE_DATA_DIR / GROUNDLINE_OUTPUT_DIR are not set. Start n8n with scripts/start-n8n.ps1 so the workflow knows where to save files.');
}

const now = new Date();
const since = new Date(now.getTime() - Math.max(LOOKBACK_DAYS, BRAND_LOOKBACK_DAYS) * 86400000);
const slash = (p) => p.split('\\').join('/').replace(/\/$/, '');

return [{
  json: {
    run_id: now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    run_date: now.toISOString().slice(0, 10),
    collected_at: now.toISOString(),
    lookback_days: LOOKBACK_DAYS,
    brand_lookback_days: BRAND_LOOKBACK_DAYS,
    since_iso: since.toISOString(),
    since_unix: Math.floor(new Date(now.getTime() - LOOKBACK_DAYS * 86400000).getTime() / 1000),
    data_dir: slash(dataDir),
    out_dir: slash(outDir),
  },
}];
