// Final dataset — kept records only, internal fields removed, newest first.
// Runs post-condition checks: if any fail, the run stops with a clear error
// instead of writing a bad file.
const rows = $input.all()
  .map((i) => i.json)
  .filter((j) => j._type === 'record' && j._status === 'kept')
  .sort((a, b) => b.published_at_utc.localeCompare(a.published_at_utc))
  .map(({ _type, _status, _reason, _reason_detail, ...rest }) => rest);

const problems = [];
const ids = new Set(), urls = new Set();
for (const r of rows) {
  if (!r.title || !r.url || !r.source_name || !r.published_date) problems.push(`${r.record_id}: missing critical field`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.published_date)) problems.push(`${r.record_id}: date not YYYY-MM-DD`);
  if (ids.has(r.record_id)) problems.push(`${r.record_id}: duplicate record_id`);
  if (urls.has(r.url)) problems.push(`${r.record_id}: duplicate url`);
  ids.add(r.record_id); urls.add(r.url);
}
if (problems.length) throw new Error('Post-condition checks failed:\n' + problems.slice(0, 20).join('\n'));
if (rows.length === 0) throw new Error('No records passed validation — check the source status rows in the quality report.');

return rows.map((json) => ({ json }));
