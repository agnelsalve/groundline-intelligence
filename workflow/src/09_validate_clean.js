// Validate & Clean — every record either passes every check or is rejected
// with a written reason. Nothing is dropped silently.
//
// Output: one item per candidate record with _status = kept | rejected | trimmed,
// plus the source status rows passed through for the quality report.
//   rejected = failed a quality check (missing field, bad date, duplicate, off-topic)
//   trimmed  = passed every check but cut to keep the dataset balanced (per-feed cap)

const cfg = $('Run config').first().json;
const NOW = new Date(cfg.collected_at).getTime();
const DAY = 86400000;
const sinceFor = (r) => NOW - (r.window_days || cfg.lookback_days) * DAY; // brand feeds look back further
const MAX_PER_FEED = 35;        // no single feed may dominate the dataset
const MAX_LEGAL_NOTICES = 5;    // law-firm "shareholder alert" boilerplate adds little new signal
const SUMMARY_MAX = 400;

// ---------- text helpers ----------
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const clean = (s) => decode(decode(String(s ?? '')).replace(/<[^>]*>/g, ' '))
  .replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
const truncate = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:.\s]+$/, '') + '…');
const fingerprint = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// FNV-1a → stable 8-char id, so the same article gets the same id on every run
const hash8 = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
};

// Same article, different URL spellings → one key. (No URL class: the n8n
// Code sandbox doesn't provide it, so this is plain string handling.)
const canonicalUrl = (u) => {
  const m = String(u || '').trim().match(/^https?:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i);
  if (!m) return null;
  const host = m[1].toLowerCase().replace(/^www\./, '');
  const path = m[2].replace(/\/+$/, '');
  const query = (m[3] || '').slice(1).split('&')
    .filter((p) => p && !/^(utm_|fbclid|gclid|mc_|ref=|cmpid|oc=)/i.test(p)).join('&');
  const arxiv = (host + path).match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/);
  if (arxiv) return `arxiv.org/abs/${arxiv[1]}`;   // v1/v2 of the same paper are one record
  return host + path + (query ? `?${query}` : '');
};

// ---------- topic rules (transparent: matched words are saved on the record) ----------
const TOPICS = [
  ['rag_grounding',   /retrieval[- ]augmented|\bRAG\b|grounding|grounded|hallucinat\w*|faithful\w*|fact[- ]check\w*|citations?\b/gi],
  ['ai_agents',       /\bagent(?:s|ic)?\b|multi-agent|autonomous|copilot/gi],
  ['ai_evaluation',   /\bevals?\b|evaluation|benchmark\w*|accuracy|reliab\w*/gi],
  ['ai_trust_safety', /safety|\btrust\w*|governance|regulat\w*|security|privacy|\bbias\b|rogue|lawsuit|copyright/gi],
  ['ai_data_analytics', /analytics|data (?:quality|engineering|warehouse|pipeline)s?|business intelligence|snowflake|databricks/gi],
  ['ai_industry',     /\bA\.?I\.?\b|artificial intelligence|\bLLMs?\b|machine learning|language models?|OpenAI|Anthropic|Gemini|\bGPT|ChatGPT|Claude|Copilot|DeepMind|Grok|Llama|Mistral|Perplexity|Nvidia|chatbots?/gi],
];
const WEAVE = /Weave Communications|\bWEAV\b|getweave|\bWeave\b/gi;
// v2: Weave's direct competitors. Case-sensitive on purpose ("Podium" the company, not an F1 podium);
// whatever still slips through is caught by the AI relevance check downstream.
const COMPETITORS = [
  ['Podium', /\bPodium\b/], ['Birdeye', /\bBirdeye\b/], ['NexHealth', /\bNexHealth\b/],
  ['Solutionreach', /\bSolution[Rr]each\b/], ['RevenueWell', /\bRevenueWell\b/], ['Lighthouse 360', /\bLighthouse 360\b/],
];
const LEGAL = /shareholder alert|investigat\w* whether|fair price|\bLLP\b|law firm|class action|Halper Sadeh|Brodsky|Ademi|Monteverde|Kahn Swick/i;

function classify(r, text) {
  const matched = new Set();
  let topic = null;
  const isWeave = (r.focus_hint === 'Weave' && /weave/i.test(text)) || /Weave Communications|\bWEAV\b|getweave/i.test(text);
  if (isWeave) { topic = 'weave_brand'; (text.match(WEAVE) || []).forEach((m) => matched.add(m)); }
  const rival = isWeave ? null : COMPETITORS.find(([, re]) => re.test(text));
  if (rival) { topic = 'competitor_brand'; matched.add(rival[0]); }
  if (!isWeave && !rival && r.focus_hint === 'Competitor') return { topic: null, focus: 'Competitor', entity: '', signal: 'news', matched: [] };
  for (const [name, re] of TOPICS) {
    const m = text.match(re);
    if (m) { if (!topic) topic = name; m.forEach((w) => matched.add(w.toLowerCase())); }
  }
  let signal = { news_rss: 'news', news_api: 'news', research_api: 'research_paper', community_api: 'community_discussion' }[r.source_type];
  if (isWeave) {
    // Brand events: what kind of thing happened to Weave (for reputation monitoring)
    if (LEGAL.test(text)) signal = 'legal_notice';
    else if (/acqui\w*|merger|antitrust|buyout|takeover|to be acquired/i.test(text)) signal = 'm_and_a';
    else if (/downgrade\w*|upgrade\w*|price target|rating|analyst\w*|fair value/i.test(text)) signal = 'analyst_rating';
    else if (/shares withheld|stock sale|insider|RSU|Form 4/i.test(text)) signal = 'insider_trade';
    else if (/earnings|revenue|EPS|income|guidance|quarter/i.test(text)) signal = 'financials';
  }
  if (r.feed_id.startsWith('reddit_')) signal = 'community_discussion';
  if (signal === 'news' && /businesswire|prnewswire|globenewswire|accesswire/i.test(r.source_name + ' ' + r.url)) signal = 'press_release';
  const entity = isWeave ? 'Weave' : rival ? rival[0] : '';
  return { topic, focus: isWeave ? 'Weave' : rival ? 'Competitor' : 'AI', entity, signal, matched: [...matched].slice(0, 6) };
}

// ---------- process ----------
const items = $input.all().map((i) => i.json);
const statusRows = items.filter((j) => j._type === 'status');
const records = items.filter((j) => j._type === 'record');

// Priority: primary publishers and APIs first, aggregators last, so when the
// same story appears twice the better-attributed copy is the one kept.
const PRIORITY = { news_rss: 1, research_api: 1, community_api: 2, news_api: 3 };
const prio = (r) => (r.feed_id.startsWith('gnews_') ? 4 : r.feed_id.startsWith('reddit_') ? 2 : PRIORITY[r.source_type] || 5);

const candidates = records.map((r) => {
  let title = clean(r.title);
  let sourceName = clean(r.source_name);
  let aggregator = '';
  // Google News titles look like "Headline - Publisher": split them.
  if (r.feed_id.startsWith('gnews_')) {
    aggregator = 'Google News';
    const cut = title.lastIndexOf(' - ');
    if (cut > 0) { sourceName = title.slice(cut + 3).trim(); title = title.slice(0, cut).trim(); }
  }
  let summary = clean(r.summary);
  if (fingerprint(summary).startsWith(fingerprint(title)) || summary.length < 25) summary = '';
  const t = Date.parse(r.published_raw);
  return {
    r, title, sourceName, aggregator,
    summary: summary ? truncate(summary, SUMMARY_MAX) : '',
    author: clean(Array.isArray(r.author) ? r.author.join(', ') : r.author),
    url: String(r.url || '').trim(),
    ts: Number.isFinite(t) ? t : NaN,
  };
}).sort((a, b) => prio(a.r) - prio(b.r) || b.ts - a.ts);

const seenUrl = new Map();
const seenTitle = new Map();
const perFeed = {};
let legalCount = 0;
const out = [];

for (const c of candidates) {
  const r = c.r;
  const reasons = [];
  if (!c.title || c.title.length < 8) reasons.push('missing_title');
  if (!/^https?:\/\/\S+\.\S+/.test(c.url)) reasons.push('invalid_url');
  if (!c.sourceName) reasons.push('missing_source');
  if (!Number.isFinite(c.ts)) reasons.push('invalid_date');
  else if (c.ts > NOW + 86400000) reasons.push('future_date');
  else if (c.ts < sinceFor(r)) reasons.push('outside_window');

  const text = `${c.title} ${c.summary}`;
  const cls = classify(r, text);
  if (!reasons.length && !cls.topic) reasons.push('off_topic');

  const canon = canonicalUrl(c.url);
  const fp = fingerprint(c.title);
  if (!reasons.length) {
    if (seenUrl.has(canon)) reasons.push(`duplicate_url_of_${seenUrl.get(canon)}`);
    else if (seenTitle.has(fp)) reasons.push(`duplicate_title_of_${seenTitle.get(fp)}`);
  }

  const record_id = 'GL-' + hash8(canon || c.url || c.title);
  let status = reasons.length ? 'rejected' : 'kept';
  let reason = reasons.map((x) => x.replace(/_of_GL-\w+$/, '')).join('|');
  let reasonDetail = reasons.join('|');

  if (status === 'kept') {
    seenUrl.set(canon, record_id);
    seenTitle.set(fp, record_id);
    perFeed[r.feed_id] = (perFeed[r.feed_id] || 0) + 1;
    if (perFeed[r.feed_id] > MAX_PER_FEED) { status = 'trimmed'; reason = reasonDetail = 'feed_cap'; }
    else if (cls.signal === 'legal_notice' && ++legalCount > MAX_LEGAL_NOTICES) { status = 'trimmed'; reason = reasonDetail = 'legal_notice_cap'; }
  }

  const iso = Number.isFinite(c.ts) ? new Date(c.ts).toISOString() : '';
  const filled = [c.title, c.url, iso, c.sourceName, c.summary, c.author, cls.topic].filter(Boolean).length;

  out.push({ json: {
    _type: 'record',
    _status: status,
    _reason: reason,
    _reason_detail: reasonDetail,
    record_id,
    published_date: iso.slice(0, 10),
    title: c.title,
    summary: c.summary,
    topic: cls.topic || '',
    focus: cls.focus,
    entity: cls.entity,
    signal_type: cls.signal,
    source_name: c.sourceName,
    source_type: r.source_type,
    collected_via: r.feed_id,
    aggregator: c.aggregator,
    author: c.author,
    url: c.url,
    discussion_url: r.discussion_url || '',
    engagement_points: r.engagement_points ?? '',
    engagement_comments: r.engagement_comments ?? '',
    matched_keywords: cls.matched.join('; '),
    completeness_pct: Math.round((filled / 7) * 100),
    published_at_utc: iso,
    collected_at: cfg.collected_at,
    run_id: cfg.run_id,
  }});
}

return [...out, ...statusRows.map((s) => ({ json: s }))];
