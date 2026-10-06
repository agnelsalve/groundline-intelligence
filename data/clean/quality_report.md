# Groundline — Data Quality Report

**Run:** `20261006T223810Z` · **Collected:** 2026-10-06 22:38 UTC · **Window:** 2026-07-08 → 2026-10-06 (45 days)

## Summary

| Metric | Value |
| --- | --- |
| Records collected (all sources) | 497 |
| Duplicates removed | 7 |
| Unique records | 490 |
| Failed a quality check | 94 |
| **Quality pass rate** (unique records passing every check) | **80.8%** |
| Trimmed for balance (passed, but over a per-feed cap) | 107 |
| **Records in final dataset** | **289** |
| Records with every optional field (summary + author) | 70 (24.2%) |
| Date range of kept records | 2025-12-02 → 2026-10-06 |

## Automated checks

| Check | Result |
| --- | --- |
| Every kept record has title, URL, source and date | ✅ pass |
| Every date is YYYY-MM-DD | ✅ pass |
| No date in the future | ✅ pass |
| No duplicate record IDs | ✅ pass |
| No duplicate URLs | ✅ pass |
| Every record has a topic | ✅ pass |
| At least 3 source systems contributed | ✅ pass |
| Record count within 50–400 target | ✅ pass |

## Sources

| Feed | Type | Status | Fetched | Kept | Rejected | Trimmed | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `techcrunch_ai` | news_rss | 🟢 ok | 18 | 16 | 2 | 0 |  |
| `mit_tech_review_ai` | news_rss | 🟢 ok | 10 | 9 | 1 | 0 |  |
| `the_verge_ai` | news_rss | 🟢 ok | 10 | 9 | 1 | 0 |  |
| `gnews_ai_agents` | news_rss | 🟢 ok | 100 | 35 | 3 | 62 |  |
| `gnews_ai_grounding` | news_rss | 🟢 ok | 67 | 35 | 6 | 26 |  |
| `gnews_ai_customer_comms` | news_rss | 🟢 ok | 54 | 35 | 0 | 19 |  |
| `gnews_weave` | news_rss | 🟢 ok | 34 | 32 | 2 | 0 |  |
| `gnews_podium` | news_rss | 🟢 ok | 66 | 17 | 49 | 0 |  |
| `gnews_birdeye` | news_rss | 🟢 ok | 10 | 3 | 7 | 0 |  |
| `gnews_nexhealth` | news_rss | 🟢 ok | 1 | 1 | 0 | 0 |  |
| `reddit_practice_owners` | news_rss | 🟢 ok | 15 | 3 | 12 | 0 |  |
| `arxiv_grounding_agents` | research_api | 🟢 ok | 35 | 33 | 2 | 0 |  |
| `hn_ai_agents` | community_api | 🟢 ok | 20 | 20 | 0 | 0 |  |
| `hn_agentic` | community_api | 🟢 ok | 20 | 17 | 3 | 0 |  |
| `hn_evals` | community_api | 🟢 ok | 20 | 10 | 10 | 0 |  |
| `hn_ai_safety` | community_api | 🟢 ok | 14 | 12 | 2 | 0 |  |
| `hn_hallucination` | community_api | 🟢 ok | 3 | 2 | 1 | 0 |  |
| `newsapi_ai` | news_api | 🔴 unavailable | 0 | 0 | 0 | 0 | Source unavailable: NEWSAPI_KEY not set in .env (optional source skipped) |
| `newsapi_weave` | news_api | 🔴 unavailable | 0 | 0 | 0 | 0 | Source unavailable: NEWSAPI_KEY not set in .env (optional source skipped) |

## Field completeness (kept records)

| Field | Filled |
| --- | --- |
| `record_id` | 100% |
| `title` | 100% |
| `url` | 100% |
| `published_date` | 100% |
| `source_name` | 100% |
| `topic` | 100% |
| `summary` | 24.2% |
| `author` | 45.3% |

Critical fields (title, URL, date, source) are enforced at 100%. `summary` and `author` are optional: Hacker News stories have no summary, and many news feeds omit the author.

## Why records were rejected

| Reason | Count |
| --- | --- |
| `off_topic` | 94 |
| `duplicate_title` | 6 |
| `duplicate_url` | 1 |

Trimmed for balance: `feed_cap` 107.

## Dataset composition

| By focus | Records |
| --- | --- |
| AI | 233 |
| Weave | 33 |
| Competitor | 23 |

| By source type | Records |
| --- | --- |
| news_rss | 195 |
| community_api | 61 |
| research_api | 33 |

| By topic | Records |
| --- | --- |
| ai_agents | 100 |
| ai_industry | 67 |
| rag_grounding | 46 |
| weave_brand | 33 |
| competitor_brand | 23 |
| ai_trust_safety | 13 |
| ai_evaluation | 6 |
| ai_data_analytics | 1 |

| By signal type | Records |
| --- | --- |
| news | 168 |
| community_discussion | 64 |
| research_paper | 33 |
| m_and_a | 9 |
| analyst_rating | 7 |
| financials | 4 |
| legal_notice | 3 |
| insider_trade | 1 |
