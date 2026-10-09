# Groundline — Data Quality Report

**Run:** `20261009T045254Z` · **Collected:** 2026-10-09 04:52 UTC · **Window:** 2026-07-11 → 2026-10-09 (45 days)

## Summary

| Metric | Value |
| --- | --- |
| Records collected (all sources) | 495 |
| Duplicates removed | 11 |
| Unique records | 484 |
| Failed a quality check | 93 |
| **Quality pass rate** (unique records passing every check) | **80.8%** |
| Trimmed for balance (passed, but over a per-feed cap) | 97 |
| **Records in final dataset** | **294** |
| Records with every optional field (summary + author) | 73 (24.8%) |
| Date range of kept records | 2025-12-02 → 2026-10-09 |

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
| `techcrunch_ai` | news_rss | 🟢 ok | 20 | 17 | 3 | 0 |  |
| `mit_tech_review_ai` | news_rss | 🟢 ok | 10 | 10 | 0 | 0 |  |
| `the_verge_ai` | news_rss | 🟢 ok | 10 | 8 | 2 | 0 |  |
| `gnews_ai_agents` | news_rss | 🟢 ok | 100 | 35 | 4 | 61 |  |
| `gnews_ai_grounding` | news_rss | 🟢 ok | 60 | 35 | 6 | 19 |  |
| `gnews_ai_customer_comms` | news_rss | 🟢 ok | 52 | 35 | 0 | 17 |  |
| `gnews_weave` | news_rss | 🟢 ok | 38 | 35 | 3 | 0 |  |
| `gnews_podium` | news_rss | 🟢 ok | 66 | 17 | 49 | 0 |  |
| `gnews_birdeye` | news_rss | 🟢 ok | 10 | 2 | 8 | 0 |  |
| `gnews_nexhealth` | news_rss | 🟢 ok | 2 | 2 | 0 | 0 |  |
| `reddit_practice_owners` | news_rss | 🟢 ok | 15 | 3 | 12 | 0 |  |
| `arxiv_grounding_agents` | research_api | 🟢 ok | 35 | 35 | 0 | 0 |  |
| `hn_ai_agents` | community_api | 🟢 ok | 20 | 20 | 0 | 0 |  |
| `hn_agentic` | community_api | 🟢 ok | 20 | 16 | 4 | 0 |  |
| `hn_evals` | community_api | 🟢 ok | 20 | 10 | 10 | 0 |  |
| `hn_ai_safety` | community_api | 🟢 ok | 14 | 12 | 2 | 0 |  |
| `hn_hallucination` | community_api | 🟢 ok | 3 | 2 | 1 | 0 |  |
| `newsapi_ai` | news_api | 🔴 unavailable | 0 | 0 | 0 | 0 | Source unavailable: 401 - "{\"status\":\"error\",\"code\":\"apiKeyInvalid\",\"message\":\"Your API key is invalid or incorrect. Check your key, or go to https://newsapi.org to create a free API key.\"}" |
| `newsapi_weave` | news_api | 🔴 unavailable | 0 | 0 | 0 | 0 | Source unavailable: 401 - "{\"status\":\"error\",\"code\":\"apiKeyInvalid\",\"message\":\"Your API key is invalid or incorrect. Check your key, or go to https://newsapi.org to create a free API key.\"}" |

## Field completeness (kept records)

| Field | Filled |
| --- | --- |
| `record_id` | 100% |
| `title` | 100% |
| `url` | 100% |
| `published_date` | 100% |
| `source_name` | 100% |
| `topic` | 100% |
| `summary` | 24.8% |
| `author` | 45.2% |

Critical fields (title, URL, date, source) are enforced at 100%. `summary` and `author` are optional: Hacker News stories have no summary, and many news feeds omit the author.

## Why records were rejected

| Reason | Count |
| --- | --- |
| `off_topic` | 93 |
| `duplicate_title` | 10 |
| `duplicate_url` | 1 |

Trimmed for balance: `feed_cap` 97.

## Dataset composition

| By focus | Records |
| --- | --- |
| AI | 235 |
| Weave | 36 |
| Competitor | 23 |

| By source type | Records |
| --- | --- |
| news_rss | 199 |
| community_api | 60 |
| research_api | 35 |

| By topic | Records |
| --- | --- |
| ai_agents | 104 |
| ai_industry | 62 |
| rag_grounding | 51 |
| weave_brand | 36 |
| competitor_brand | 23 |
| ai_trust_safety | 13 |
| ai_evaluation | 5 |

| By signal type | Records |
| --- | --- |
| news | 169 |
| community_discussion | 63 |
| research_paper | 35 |
| m_and_a | 10 |
| analyst_rating | 7 |
| financials | 6 |
| legal_notice | 3 |
| insider_trade | 1 |
