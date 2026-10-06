// Normalize arXiv (Atom XML) → common record shape.
// Research signal: what is being published on grounding, hallucination and agents.
// The HTTP node returns the raw XML as text; each <entry> is one paper.
const out = [];
let fetched = 0, error = null;

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : '';
};

for (const item of $input.all()) {
  const j = item.json || {};
  if (j.error) { error = String(j.error.message || j.error); continue; }
  const xml = typeof j.data === 'string' ? j.data : '';
  if (!xml.includes('<feed')) { if (xml) error = 'Response was not an Atom feed'; continue; }

  for (const entry of xml.split('<entry>').slice(1)) {
    fetched++;
    const authors = [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1].trim());
    const absLink = (entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || entry.match(/<id>([^<]+)<\/id>/) || [])[1] || '';
    const categories = [...entry.matchAll(/<category[^>]*term="([^"]+)"/g)].map((m) => m[1]);
    const paper = {
      id: tag(entry, 'id'),
      title: tag(entry, 'title'),
      summary: tag(entry, 'summary'),
      published: tag(entry, 'published'),
      updated: tag(entry, 'updated'),
      authors,
      categories,
    };
    out.push({
      json: {
        _type: 'record',
        source_type: 'research_api',
        feed_id: 'arxiv_grounding_agents',
        source_name: 'arXiv',
        focus_hint: 'AI',
        title: paper.title,
        summary: paper.summary,
        author: authors.length > 3 ? `${authors.slice(0, 3).join(', ')} et al.` : authors.join(', '),
        url: absLink.replace(/^http:\/\//, 'https://'),
        published_raw: paper.published,
        engagement_points: null,
        engagement_comments: null,
        raw: paper,
      },
    });
  }
}

out.push({ json: {
  _type: 'status', source_type: 'research_api', feed_id: 'arxiv_grounding_agents', fetched,
  status: error ? 'unavailable' : fetched ? 'ok' : 'empty',
  message: error ? `Source unavailable: ${error}` : fetched ? '' : 'Query returned no papers',
}});
return out;
