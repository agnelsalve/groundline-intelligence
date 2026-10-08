# Groundline run summary

**Run** `20261008T190648Z` · 34.4s · 293 records judged · AI cost **$0.0000**

| Step | Seconds |
|---|---|
| analyst | 0 |
| writer | 0 |
| checker | 0 |

| AI usage | Value |
|---|---|
| Calls | 0 |
| Retries / JSON repairs / provider fallbacks | 0 / 0 / 0 |
| Tokens in / out | 0 / 0 |
| Records from cache | 0 |
| Records judged by AI / by keyword fallback | 0 / 293 |
| Circuit breaker opened | yes |

| Brief | Written by | Groundedness | Status |
|---|---|---|---|
| weave | rules_fallback | — | ai_offline |
| podium | rules_fallback | — | ai_offline |

| Email | Status |
|---|---|
| weekly_digest | failed — Gmail did not accept the message (credential missing or rejected; run scripts/setup-credentials.ps1) |
| risk_alert | nothing_to_send |
| opportunity_alert | nothing_to_send |

Routes: digest 293

## Errors handled

- `analyze`  : no AI provider configured (set MUSE_API_KEY or GEMINI_API_KEY in .env)
- `analyze`  : no AI provider configured (set MUSE_API_KEY or GEMINI_API_KEY in .env)
- `analyze`  : no AI provider configured (set MUSE_API_KEY or GEMINI_API_KEY in .env)
- `brief:weave`  : no AI provider configured (set MUSE_API_KEY or GEMINI_API_KEY in .env)
- `brief:podium`  : no AI provider configured (set MUSE_API_KEY or GEMINI_API_KEY in .env)
