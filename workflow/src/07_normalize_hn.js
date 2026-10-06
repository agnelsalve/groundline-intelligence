// Normalize Hacker News (Algolia JSON) → common record shape.
// Each input item is one query's response; the stories are in .hits.
const queries = $('HN query list').all().map((i) => i.json);

const out = [];
const stats = Object.fromEntries(queries.map((q) => [q.feed_id, { fetched: 0, error: null }]));

for (const item of $input.all()) {
  const { _feed, ...j } = item.json || {};
  const q = _feed || queries[0];
  if (j.error) { stats[q.feed_id].error = String(j.error.message || j.error); continue; }
  for (const h of j.hits || []) {
    stats[q.feed_id].fetched++;
    const discussion = `https://news.ycombinator.com/item?id=${h.objectID}`;
    out.push({
      json: {
        _type: 'record',
        source_type: 'community_api',
        feed_id: q.feed_id,
        source_name: 'Hacker News',
        focus_hint: 'AI',
        title: h.title,
        summary: '',
        author: h.author || '',
        url: h.url || discussion,
        discussion_url: discussion,
        published_raw: h.created_at || '',
        engagement_points: h.points ?? null,
        engagement_comments: h.num_comments ?? null,
        raw: h,
      },
    });
  }
}

for (const q of queries) {
  const s = stats[q.feed_id];
  out.push({ json: {
    _type: 'status', source_type: 'community_api', feed_id: q.feed_id, fetched: s.fetched,
    status: s.error ? 'unavailable' : s.fetched ? 'ok' : 'empty',
    message: s.error ? `Source unavailable: ${s.error}` : s.fetched ? '' : 'Query returned no stories',
  }});
}
return out;
