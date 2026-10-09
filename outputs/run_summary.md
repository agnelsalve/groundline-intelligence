# Groundline run summary

**Run** `20261009T052422Z` · 85.7s · 294 records judged · AI cost **$0.0403**

| Step | Seconds |
|---|---|
| analyst | 1.6 |
| writer | 17.3 |
| checker | 43.8 |

| AI usage | Value |
|---|---|
| Calls | 19 |
| Retries / JSON repairs / provider fallbacks | 0 / 2 / 8 |
| Tokens in / out | 29083 / 11223 |
| Records from cache | 292 |
| Records judged by AI / by keyword fallback | 2 / 0 |
| Circuit breaker opened | no |

| Brief | Written by | Groundedness | Status |
|---|---|---|---|
| weave | gemini:gemini-3.1-flash-lite | 83% | needs_review |
| podium | gemini:gemini-3.1-flash-lite | 77% | needs_review |
| birdeye | gemini:gemini-3.1-flash-lite | 94% | verified |
| market | gemini:gemini-3.1-flash-lite | 77% | needs_review |

| Email | Status |
|---|---|
| weekly_digest | sent |
| risk_alert | nothing_to_send |
| opportunity_alert | nothing_to_send |

Routes: digest 269 · discard 13 · opportunity 11 · urgent_risk 1

## Errors handled

- `brief:birdeye` gemini-3.8-flash quota: Gemini 3.8-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
- `brief:podium` gemini-3.8-flash quota: Gemini 3.8-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
- `brief:weave` gemini-3.8-flash quota: Gemini 3.8-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
- `brief:birdeye` gemini-3.5-flash quota: Gemini 3.5-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
- `brief:weave` gemini-3.5-flash quota: Gemini 3.5-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
- `brief:podium` gemini-3.5-flash quota: Gemini 3.5-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
- `check:podium` gemini-3.5-flash quota: Gemini 3.5-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
- `check:weave` gemini-3.5-flash quota: Gemini 3.5-flash 429: {"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your curren
