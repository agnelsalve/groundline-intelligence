// Source 4 — NewsAPI (free tier: 100 requests/day, articles up to ~30 days old).
// The key is read from the NEWSAPI_KEY environment variable (set in .env).
// If the key is missing, the request fails cleanly and the run carries on
// with the other sources — the quality report marks NewsAPI "unavailable".
const cfg = $('Run config').first().json;
const from = new Date(Math.max(new Date(cfg.since_iso).getTime(), Date.now() - 29 * 86400000))
  .toISOString().slice(0, 10);

// Only check whether a key exists; the key itself is read by the HTTP node's
// header expression so it never lands in item data or saved files.
let hasKey = false;
try { hasKey = Boolean($env.NEWSAPI_KEY); } catch (e) { hasKey = false; }

const queries = [
  { feed_id: 'newsapi_ai',    focus_hint: 'AI',    pageSize: 40, q: '"AI agents" OR "agentic AI" OR "AI hallucination" OR "retrieval-augmented generation"' },
  { feed_id: 'newsapi_weave', focus_hint: 'Weave', pageSize: 20, q: '"Weave Communications"' },
];

return queries.map(({ feed_id, focus_hint, pageSize, q }) => ({
  json: {
    feed_id,
    focus_hint,
    has_key: hasKey,
    url:
      'https://newsapi.org/v2/everything?language=en&sortBy=relevancy' +
      `&pageSize=${pageSize}&from=${from}&q=` + encodeURIComponent(q),
  },
}));
