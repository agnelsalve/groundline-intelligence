// Raw snapshot — every record exactly as each source returned it (under .raw),
// saved once per run. "Collect once, reuse forever": cleaning can be re-run
// against this file without hitting any source again.
const cfg = $('Run config').first().json;
const items = $input.all().map((i) => i.json);
const snapshot = {
  run_id: cfg.run_id,
  collected_at: cfg.collected_at,
  sources: items.filter((j) => j._type === 'status'),
  records: items.filter((j) => j._type === 'record'),
};
return [{ json: { snapshot_json: JSON.stringify(snapshot, null, 2), file_name: `raw_${cfg.run_id}.json` } }];
