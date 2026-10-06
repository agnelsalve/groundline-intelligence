// Source 1 — News RSS feeds. No key, no rate limit.
// A3: three AI desks + Google News searches for agents, grounding and Weave.
// v2: adds Weave's direct competitors and practice-owner discussion on Reddit,
// so the agent can compare Weave against the market instead of seeing it alone.
// Brand feeds use a longer window (90 days) because brand news is sparser.
const cfg = $('Run config').first().json;
const gnews = (q, days) =>
  'https://news.google.com/rss/search?q=' + encodeURIComponent(`${q} when:${days}d`) +
  '&hl=en-US&gl=US&ceid=US:en';
const A = cfg.lookback_days;
const B = cfg.brand_lookback_days;

const feeds = [
  // --- AI market context (unchanged from A3)
  { feed_id: 'techcrunch_ai',          source_name: 'TechCrunch',            focus_hint: 'AI',    window_days: A, url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { feed_id: 'mit_tech_review_ai',     source_name: 'MIT Technology Review', focus_hint: 'AI',    window_days: A, url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { feed_id: 'the_verge_ai',           source_name: 'The Verge',             focus_hint: 'AI',    window_days: A, url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { feed_id: 'gnews_ai_agents',        source_name: 'Google News',           focus_hint: 'AI',    window_days: A, url: gnews('"AI agents" (analytics OR enterprise OR data)', A) },
  { feed_id: 'gnews_ai_grounding',     source_name: 'Google News',           focus_hint: 'AI',    window_days: A, url: gnews('"AI hallucinations" OR "retrieval-augmented generation" OR "AI grounding"', A) },
  { feed_id: 'gnews_ai_customer_comms', source_name: 'Google News',          focus_hint: 'AI',    window_days: B, url: gnews('"AI receptionist" OR "AI front desk" OR "patient communication" AI', B) },
  // --- The brand
  { feed_id: 'gnews_weave',            source_name: 'Google News',           focus_hint: 'Weave', window_days: B, url: gnews('"Weave Communications" OR "getweave" OR "NYSE: WEAV"', B) },
  // --- Competitors (v2). Deliberately broad: "Podium" also matches F1 race results,
  // and telling those apart is a job for the AI relevance check, not a keyword list.
  { feed_id: 'gnews_podium',           source_name: 'Google News',           focus_hint: 'Competitor', entity_hint: 'Podium',        window_days: B, url: gnews('"Podium" (software OR ServiceTitan OR "text marketing" OR reviews OR "local business" OR AI)', B) },
  { feed_id: 'gnews_birdeye',          source_name: 'Google News',           focus_hint: 'Competitor', entity_hint: 'Birdeye',       window_days: B, url: gnews('"Birdeye"', B) },
  { feed_id: 'gnews_nexhealth',        source_name: 'Google News',           focus_hint: 'Competitor', entity_hint: 'NexHealth',     window_days: B, url: gnews('"NexHealth" OR "Solutionreach" OR "RevenueWell" OR "Lighthouse 360"', B) },
  // --- Practice owners talking (v2, optional: Reddit often throttles anonymous readers)
  { feed_id: 'reddit_practice_owners', source_name: 'Reddit',                focus_hint: 'Competitor', window_days: 365,
    url: 'https://www.reddit.com/r/Dentistry+Optometry+veterinaryprofession+smallbusiness/search.rss?q=' +
         encodeURIComponent('weave OR podium OR nexhealth OR birdeye OR solutionreach') + '&restrict_sr=1&sort=new&t=year' },
];

return feeds.map((f) => ({ json: f }));
