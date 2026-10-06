// Load the analysis cache written by the previous run.
// Records the AI has already judged (same record_id, same prompt version) are
// reused instead of paid for again. A missing or corrupt cache is not an error:
// the run simply starts cold and says so in the run metrics.
let cache = { analysis: {}, alerted: {} };
let status = 'cold_start: no cache file yet';
const item = $input.first();
try {
  if (item && item.binary && item.binary.data) {
    const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
    const parsed = JSON.parse(buf.toString('utf8'));
    cache = { analysis: parsed.analysis || {}, alerted: parsed.alerted || {} };
    status = `loaded: ${Object.keys(cache.analysis).length} analyses, ${Object.keys(cache.alerted).length} alerted records`;
  } else if (item && item.json && item.json.error) {
    status = 'cold_start: ' + String(item.json.error.message || item.json.error).slice(0, 120);
  }
} catch (e) {
  status = 'cold_start: cache unreadable (' + e.message.slice(0, 80) + ') — it will be rebuilt';
}
return [{ json: { cache, cache_status: status } }];
