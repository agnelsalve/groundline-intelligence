// Normalize RSS → common record shape.
// Also emits one status row per feed (ok / empty / unavailable) so a dead
// feed shows up in the quality report instead of silently disappearing.
const feeds = $('RSS feed list').all().map((i) => i.json);

const out = [];
const stats = Object.fromEntries(feeds.map((f) => [f.feed_id, { fetched: 0, error: null }]));

for (const item of $input.all()) {
  const { _feed, ...j } = item.json || {};
  const feed = _feed || feeds[0];
  if (j.error) { stats[feed.feed_id].error = String(j.error.message || j.error); continue; }
  if (!j.title && !j.link) continue; // empty placeholder from alwaysOutputData
  stats[feed.feed_id].fetched++;
  out.push({
    json: {
      _type: 'record',
      source_type: 'news_rss',
      feed_id: feed.feed_id,
      source_name: feed.source_name,
      focus_hint: feed.focus_hint,
      entity_hint: feed.entity_hint || '',
      window_days: feed.window_days,
      title: j.title,
      summary: j.contentSnippet || j.content || j.summary || '',
      author: j.creator || j.author || '',
      url: j.link,
      published_raw: j.isoDate || j.pubDate || '',
      engagement_points: null,
      engagement_comments: null,
      raw: j,
    },
  });
}

for (const f of feeds) {
  const s = stats[f.feed_id];
  out.push({ json: {
    _type: 'status', source_type: 'news_rss', feed_id: f.feed_id, fetched: s.fetched,
    status: s.error ? 'unavailable' : s.fetched ? 'ok' : 'empty',
    message: s.error ? `Source unavailable: ${s.error}` : s.fetched ? '' : 'Feed returned no items',
  }});
}
return out;
