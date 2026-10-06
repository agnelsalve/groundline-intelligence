// Normalize NewsAPI → common record shape.
// A missing/invalid key or a rate limit comes back as an error item;
// it is logged as "unavailable" and never stops the run.
const queries = $('NewsAPI query list').all().map((i) => i.json);

const out = [];
const stats = Object.fromEntries(queries.map((q) => [q.feed_id, { fetched: 0, error: null }]));

for (const item of $input.all()) {
  const { _feed, ...j } = item.json || {};
  const q = _feed || queries[0];
  if (!q.has_key) { stats[q.feed_id].error = 'NEWSAPI_KEY not set in .env (optional source skipped)'; continue; }
  if (j.error || j.status === 'error') {
    stats[q.feed_id].error = String(j.message || j.error?.message || j.error || 'request failed');
    continue;
  }
  for (const a of j.articles || []) {
    if (a.title === '[Removed]') continue; // NewsAPI placeholder for deleted articles
    stats[q.feed_id].fetched++;
    out.push({
      json: {
        _type: 'record',
        source_type: 'news_api',
        feed_id: q.feed_id,
        source_name: a.source?.name || 'NewsAPI',
        focus_hint: q.focus_hint,
        title: a.title,
        summary: a.description || '',
        author: a.author || '',
        url: a.url,
        published_raw: a.publishedAt || '',
        engagement_points: null,
        engagement_comments: null,
        raw: a,
      },
    });
  }
}

for (const q of queries) {
  const s = stats[q.feed_id];
  out.push({ json: {
    _type: 'status', source_type: 'news_api', feed_id: q.feed_id, fetched: s.fetched,
    status: s.error ? 'unavailable' : s.fetched ? 'ok' : 'empty',
    message: s.error ? `Source unavailable: ${s.error}` : s.fetched ? '' : 'Query returned no articles',
  }});
}
return out;
