# Groundline run summary

**Run** `20261009T045254Z` · 118.9s · 294 records judged · AI cost **$0.0889**

| Step | Seconds |
|---|---|
| analyst | 3.9 |
| writer | 34 |
| checker | 57.8 |

| AI usage | Value |
|---|---|
| Calls | 16 |
| Retries / JSON repairs / provider fallbacks | 2 / 2 / 3 |
| Tokens in / out | 27331 / 9552 |
| Records from cache | 289 |
| Records judged by AI / by keyword fallback | 5 / 0 |
| Circuit breaker opened | no |

| Brief | Written by | Groundedness | Status |
|---|---|---|---|
| weave | gemini:gemini-3.5-flash | 87% | verified |
| podium | gemini:gemini-3.8-flash | 97% | verified |
| birdeye | gemini:gemini-3.5-flash | 54% | failed |
| market | gemini:gemini-3.5-flash | 94% | verified |

| Email | Status |
|---|---|
| weekly_digest | sent |
| risk_alert | sent |
| opportunity_alert | sent |

Routes: digest 267 · discard 14 · opportunity 12 · urgent_risk 1

## Errors handled

- `brief:weave` gemini-3.8-flash quota: Gemini 3.8-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
- `brief:birdeye` gemini-3.8-flash quota: Gemini 3.8-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
- `check:market` gemini-3.5-flash quota: Gemini 3.5-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
