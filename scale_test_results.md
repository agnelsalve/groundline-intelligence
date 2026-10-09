# Scale test results — Groundline v2

**Every number below comes from a real run on 2026-10-09.** The raw results are in [`data/scale/`](data/scale/) (one JSON and one Markdown file per test) and [`data/runs/`](data/runs/) (one JSON file per pipeline run). The tests were run with [`scripts/scale_test.mjs`](scripts/scale_test.mjs).

**Test machine:** a laptop with an AMD Ryzen 7 7730U (16 threads) and 31 GB of RAM, running Windows 11, n8n 2.40.7 and Node 24.

**AI:** Google Gemini on the **free tier**.
- Gemini 3.5 Flash-Lite judges the records.
- Gemini 3.8 Flash writes the briefs.
- Gemini 3.5 Flash fact-checks them.

**Cost note:** the free tier bills $0. Costs below are what the same tokens would cost at **paid list prices**, so they show what a production deployment would pay.

## How the test works

The scale test fires requests at the **Analyze API** (`POST /webhook/groundline/analyze`). This endpoint runs the exact same Analyst code as the main pipeline. One request carries one record unless the table says otherwise. "Burst" means every request in a level is sent at the same moment. A request only counts as a **success** if it returns HTTP 200 and every record in it was judged by the AI. A record judged by the keyword fallback counts as **degraded**.

I ran two separate tests:
1. **With the real AI**, to find where the AI service breaks.
2. **n8n alone, with the AI switched off** (`--no-ai`), to find the platform's own ceiling.

## 1. The full pipeline (one weekly run)

| Run | Records | Wall time | AI calls | Tokens in / out | Cost at list price | Notes |
|---|---|---|---|---|---|---|
| `20261009T044544Z` (cold cache) | 294 | **301 s** | 42 | 66,743 / 47,822 | **$0.163** | Every record judged by the AI. Gemini 3.8 Flash was overloaded (503), so 7 tasks moved to other models. |
| `20261009T045254Z` (warm cache) | 294 | **119 s** | 16 | 27,331 / 9,552 | **$0.089** | 289 of 294 records came from the cache. The AI-judging step dropped from 41.4 s to **3.9 s**. |

- A single record takes **about 1 s** through the API when it isn't throttled. One request at 10 parallel requests took 1.35 s at the median.
- The cache cut the second run's cost by **45%** and the AI-judging step's time by **91%**.

## 2. Scaling the AI requests (n8n + Gemini)

| Requests (burst) | Wall time | Req/s | p50 | p95 | Success | Retries | What happened |
|---|---|---|---|---|---|---|---|
| 1 | 14.4 s | 0.07 | 14.4 s | 14.4 s | 0% (1 degraded) | 3 | The per-minute limit was already used up by the pipeline run just before. After 3 backoff retries the record fell back to the keyword rules and was labeled. No crash. |
| 10 | 1.4 s | 7.0 | 1.35 s | 1.43 s | **100%** | 0 | Healthy. |
| 50 | 174.9 s | 0.29 | 61 s | 174 s | **70%** (15 × HTTP 500) | 36 | **The first real breaking point.** See "What breaks first" below. |
| 50, after the fix | 79.0 s | 0.63 | 14.5 s | 78.7 s | **100%** | 61 | No errors. The rate-limit retries absorbed the load. |
| 100, after the fix | 156.6 s | 0.64 | 34.5 s | 156 s | **100%** | 165 | Rate limits were hit 21 times, and each time the request moved to the next model in the chain. Every record was still judged by the AI. |
| 5 × 10 records (batch mode) | 7.8 s | — | 3.6 s | 7.8 s | **100%** | 0 | 50 records in **7.8 s**, compared with 79 s for 50 single-record requests, so **10× faster**. |

**Throughput ceiling with the AI on the free tier:** about **0.64 requests per second**, which is roughly 38 records per minute when sent one record at a time. Batching 10 records per request raises this to about 6.4 records per second.

## 3. Scaling n8n alone (AI switched off)

| Requests (burst) | Wall time | Req/s | p50 | p95 | Success | Peak n8n memory |
|---|---|---|---|---|---|---|
| 1 | 0.11 s | 8.7 | 0.11 s | 0.11 s | 100% | 415 MB |
| 10 | 0.45 s | 22.4 | 0.38 s | 0.44 s | 100% | 420 MB |
| 50 | 1.9 s | 26.4 | 1.3 s | 1.9 s | 100% | 669 MB |
| 100 | 3.5 s | 28.4 | 2.3 s | 3.4 s | 100% | 1.4 GB |
| 250 | 10.4 s | 24.1 | 5.6 s | 9.9 s | 100% | 3.0 GB |
| 500 | 17.6 s | 28.4 | 11.4 s | 17.0 s | 100% | 5.6 GB |
| 1,000 | 39.3 s | 25.4 | 24.6 s | 37.7 s | 100% | 10.5 GB |
| 2,000 | 85.0 s | 23.5 | 49.7 s | 83.8 s | **95.6%** (88 × HTTP 500) | 21.1 GB |

The memory figures are the n8n process's working set, sampled once per second with `tasklist`.

## What breaks first

1. **n8n's Code-node runner, at about 10 concurrent slow requests.** By default n8n runs only 10 Code-node tasks at a time. Any task waiting more than 60 s in the queue is dropped, and the server log shows `Task request timed out` and "Webhook execution failed before a response was sent". With 50 simultaneous AI requests, each waiting on rate-limited Gemini calls, 15 requests timed out and returned HTTP 500.
   - **Fix:** in [`scripts/env.ps1`](scripts/env.ps1) I set `N8N_RUNNERS_MAX_CONCURRENCY=50` and `N8N_RUNNERS_TASK_REQUEST_TIMEOUT=300`. After that, 50 and 100 simultaneous requests both had **0 errors**.
   - **The error workflow worked under load:** it emailed every failure. The inbox shows a row of `[Groundline] FAILED: … at "AI Analyst (API)"` emails at 1:01 AM ([screenshot](docs/img/gmail_2_inbox.png)).
   - **But it exposed a bug:** the log files were named by the second, so failures in the same second overwrote each other and only one JSON log survived. Fixed: the filename now includes the n8n execution id.
2. **The Gemini free-tier quotas.** These are the real limit on volume.
   - **Per-minute limits:** 21 hits in the 100-request test, 61 retries in the 50-request test. All of them were absorbed by backoff and switching models.
   - **Daily limits:** on the free tier, Gemini 3.8 Flash and Gemini 3.5 Flash ran out after roughly 20 requests each. The pipeline log shows `429 You exceeded your current quota`. When that happens the client switches models immediately instead of waiting. Gemini 3.1 Pro and the latest Pro model have **zero** free quota.
   - Gemini 3.8 Flash also returned **503 "high demand"** errors during the first run, and those tasks moved to other models.
3. **n8n memory, at about 10 MB per request in flight.** Memory grows linearly with the number of requests being processed at once: 5.6 GB at 500 and 21 GB at 2,000. At **2,000 simultaneous requests**, 4.4% failed with the same queue timeout. On this machine, the platform's own ceiling is about **1,000 requests in one burst**, or about **25 requests per second sustained**.
4. **Timeouts.** Before the fix, the API dropped requests after **60 s in the runner queue**. After the fix, the slowest successful request took **156 s**, during the 100-request burst. The client-side timeout was 600 s.

## Cost

AI cost is measured at paid list prices, per 1M tokens (input / output):

| Model | Input | Output | Used for |
|---|---|---|---|
| Gemini 3.5 Flash-Lite | $0.25 | $1.50 | judging records |
| Gemini 3.8 Flash | $0.75 | $3.75 | writing briefs |
| Gemini 3.5 Flash | $1.50 | $9.00 | fact-checking |

Measured cost:

| Unit | Measured cost |
|---|---|
| 100 single-record API requests | **$0.037–0.038** (two tests at 50 and 100 requests) |
| 100 records sent in batches of 10 | **$0.031** |
| One full weekly pipeline run (294 records, 4 briefs, fact-checked) | **$0.163** with a cold cache, **$0.089** with a warm cache |

## Production readiness

**Could it run 24/7?**
- **The weekly pipeline: yes, today.** It runs about 2–5 minutes a week, uses 16–42 AI calls (inside the free tier on most days), and every failure path ends in a labeled fallback or an email, never a silent stop.
- **The Analyze API at high volume: not on the free tier.** The daily quotas (about 20 requests per Flash model) would run out within minutes. It needs:
  1. a **paid Gemini tier**, for higher per-minute and per-day limits;
  2. **n8n in queue mode** (Redis plus separate worker processes) so memory doesn't sit in a single process;
  3. **batching**, which is 10× faster per record.

**Estimated monthly cost at 1,000 requests per day:**

| Mode | Per day | Per month (30 days) |
|---|---|---|
| Single-record requests at $0.00038 each | $0.38 | **≈ $11** |
| Batch mode (10 records per request) | $0.31 | **≈ $9** |
| Plus the weekly pipeline (4 runs at about $0.09–0.16) | — | **≈ $0.50** |

Hosting: n8n self-hosted is free, or n8n Cloud starts at about $20–24 a month.

**What it replaces:** a weekly competitive and reputation brief that would otherwise take an analyst about 4–6 hours to research, read, write and source-check. That work now costs about **$0.16 in AI per week**.

**What to monitor:**
- `data/runs/run_*.json`: AI cost per run, retries, provider fallbacks, `quota_exhausted`, and the fallback rate in `analysis.fallback_reasons`.
- The groundedness score of each brief. If it falls below 85%, the brief is badged **needs review**.
- Email delivery status, recorded in each run's metrics.
- n8n server log lines containing `Task request timed out`, which mean the runner queue is overloaded.
- n8n process memory (about 10 MB per request in flight).
- The Gemini quota page in Google AI Studio.

## What I did *not* test

- Sustained load over hours. Every test was a burst.
- Concurrency above 2,000 requests, and AI bursts above 100. The latter would have used up the free daily quota needed for the demo.
- n8n queue mode with Redis.
- The paid Gemini tier, which wasn't needed.
