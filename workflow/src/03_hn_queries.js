// Source 3 — Hacker News (Algolia search API). No key.
// Practitioner signal: what engineers are actually discussing.
// Only stories inside the window with >20 points, to skip low-signal posts.
const cfg = $('Run config').first().json;
const queries = [
  { feed_id: 'hn_ai_agents',    q: 'AI agents' },
  { feed_id: 'hn_agentic',      q: 'agentic' },
  { feed_id: 'hn_evals',        q: 'evals' },
  { feed_id: 'hn_ai_safety',    q: 'AI safety' },
  { feed_id: 'hn_hallucination', q: 'hallucination' },
];

return queries.map(({ feed_id, q }) => ({
  json: {
    feed_id,
    query: q,
    url:
      'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=20' +
      '&query=' + encodeURIComponent(q) +
      '&numericFilters=' + encodeURIComponent(`points>20,created_at_i>${cfg.since_unix}`),
  },
}));
