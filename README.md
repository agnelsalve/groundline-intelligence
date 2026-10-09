# Groundline v2: Brand Intelligence Agent

> **Every agent answer, traceable to a source.**

Groundline v2 is an [n8n](https://n8n.io) + **Google Gemini** agent. It reads everything published about **Weave Communications (NYSE: WEAV)** and its competitors, and judges every item. It alerts the team the moment something risky or useful appears, and writes a weekly brand brief in which **every claim cites its source and has been checked by a second AI model** before it reaches the inbox.

| | |
|---|---|
| **Course** | INFO 7375 Branding & AI, Northeastern University, Fall 2026 |
| **Assignment** | 4: "Scale Your Thing & Add Intelligence" (builds on [A3: Groundline data pipeline](https://github.com/agnelsalve/groundline-data-pipeline)) |
| **Author** | Agnel Salve |
| **Built with** | n8n 2.40 · Gemini 3.5 Flash-Lite (judging) · Gemini 3.8 Flash (writing) · Gemini 3.5 Flash (fact-checking) · Gmail · Muse Spark supported as an optional provider |

## Submission files

| Required | Where |
|---|---|
| `workflow_v2.json`, the enhanced n8n export | [`workflow/workflow_v2.json`](workflow/workflow_v2.json), plus [`error_handler.json`](workflow/error_handler.json) and [`analyze_api.json`](workflow/analyze_api.json) |
| `scale_test_results.md`, real numbers | [`scale_test_results.md`](scale_test_results.md); raw data in [`data/scale/`](data/scale/) |
| `outputs/`, sample output files | [`outputs/`](outputs/): briefs (HTML and PDF), dashboard, alerts, emails, CSV, chart, fact-check log |
| Output gallery (15 examples) | [`docs/output_gallery.md`](docs/output_gallery.md) · panel [`docs/figma/3_output_gallery.png`](docs/figma/3_output_gallery.png) |
| Executive summary | [`docs/executive_summary.pdf`](docs/executive_summary.pdf) · panel [`docs/figma/1_executive_summary.png`](docs/figma/1_executive_summary.png) |
| Technical architecture | [`docs/architecture.svg`](docs/architecture.svg) / [`.png`](docs/architecture.png) / [`.pdf`](docs/architecture.pdf) |
| Demo walkthrough | [`docs/demo_walkthrough.pdf`](docs/demo_walkthrough.pdf) |
| Figma board assembly | [`docs/FIGMA-BUILD.md`](docs/FIGMA-BUILD.md) and the panels in [`docs/figma/`](docs/figma/) |

## What changed from A3

A3 **collected** about 220 cited records. v2 **thinks about them**:

| | A3 | A4 (v2) |
|---|---|---|
| AI | none (keyword rules) | 3 Gemini models with separate jobs: judge, write, check |
| Decisions | none | A Switch node routes each record: high risk triggers a risk alert email, a competitor stumble triggers an opportunity alert, everything else goes into the weekly brief |
| Output | a CSV dataset | Gmail digest and alerts, cited HTML/PDF briefs, dashboard, scored CSV, chart |
| Brand focus | 9% Weave, no competitors | Weave plus Podium, Birdeye, NexHealth, Solutionreach and RevenueWell: share of voice, sentiment, brand archetype |
| Trust | each record cited | each **claim** cited, checked by a different model, unsupported claims removed, groundedness score |
| Scale | untested | tested from 1 to 2,000 requests; breaking points found and one fixed |

## How it works

```
Collect (A3 + competitors + Reddit) → Validate & dedupe → [cache] → AI Analyst (Gemini 3.5 Flash-Lite)
   → Switch ─┬─ urgent_risk  → risk alert email (new items only)
             ├─ opportunity  → opportunity alert email
             └─ digest       → AI Brief Writer (Gemini 3.8 Flash) → AI Fact-Checker (different model)
                                 → HTML briefs · dashboard · CSV · chart → weekly Gmail digest → run metrics
```

- **The AI Analyst** judges each record and returns:
  - **relevance** from 0 to 3 (an F1 "podium" scores 0 and is filtered out);
  - which company the record is **about**, and the **sentiment** toward it, from −2 to +2;
  - **theme** and **evidence type** (announced, proven, reported, or discussed);
  - **risk to Weave** and **opportunity for Weave**, each none, low, medium or high;
  - which of the 12 **brand archetypes** the coverage casts the company as;
  - a one-sentence **key fact** and a **reason** for its ratings.
- **The Brief Writer** writes one brief for Weave, one per competitor with enough coverage, and one on the market. Every number in a brief is **computed in code** and given to the model, never generated. Every claim must cite record ids from the evidence it was handed.
- **The Fact-Checker** runs on a **different model from the writer**, so no model grades its own work. Any citation to an id that isn't in the evidence is caught by a rule. The AI then rules each claim *supported*, *partial* or *unsupported* against its cited sources. Unsupported claims are removed and listed in the fact-check log. A brief scoring below 85% grounded is badged **needs review**.

The full diagram, with failure paths, is in [`docs/architecture.png`](docs/architecture.png).

## Complete workflow run

**Run `20261009T045254Z`** (2026-10-09, the full log is in [`data/runs/`](data/runs/))

**Input data**
- 496 items from 17 feeds: TechCrunch, MIT Technology Review, The Verge, Google News for Weave and for Podium/Birdeye/NexHealth, Reddit (practice owners), arXiv, Hacker News.
- After validation and de-duplication, **294 records** remained, 36 of them about Weave and 13 about competitors. See [`data/clean/quality_report.md`](data/clean/quality_report.md).

**AI processing**
- **Judging:** 294 records were judged (289 came from the cache of the previous run). The AI filtered out **14 off-topic items**, such as motorsport "podium" stories and unrelated politics.
- **Decisions:** 1 **urgent risk** (a law firm investigating whether the $650M take-private price is fair to shareholders) and 12 **opportunities** (for example, ServiceTitan ending its Podium integration).
- **Writing and checking:** 4 briefs were written (Weave, Podium, Birdeye, market) and **15 + 15 + 13 + 17 claims** were fact-checked. The writers were Gemini 3.5 and 3.8 Flash, and the checker was Gemini 3.5 Flash.
- **A flaw this run exposed:** Gemini 3.8 Flash ran out of quota, so for 3 of the 4 briefs the same model both wrote and checked. I fixed it straight afterwards: the checker now always skips the model that wrote the brief. The next run, `20261009T052422Z`, used a different checker on every brief.

**Final output**
- **3 real emails** delivered to `branding.and.ai@gmail.com`. Gmail accepted each one, and the message ids are logged:
  - the weekly digest (`<8e393618…@gmail.com>`)
  - the brand-risk alert (`<3e903295…>`)
  - the opportunity alert (`<3ac65b5e…>`)
- Files in `outputs/`: [Weave brief](outputs/briefs/2026-10-09_weave.html) ([PDF](outputs/pdf/2026-10-09_weave_brief.pdf)), [Podium](outputs/briefs/2026-10-09_podium.html), [Birdeye](outputs/briefs/2026-10-09_birdeye.html), [market](outputs/briefs/2026-10-09_market.html), [dashboard](outputs/2026-10-09_dashboard.html), [scored CSV](outputs/data/2026-10-09_scored_records.csv), [chart](outputs/charts/2026-10-09_sentiment.png), [fact-check log](outputs/2026-10-09_fact_check.md).
- **Time and cost:** the run took 119 s and cost $0.089 at paid list prices. The cold-cache run before it took 301 s and $0.163. The free tier billed $0.

**Proof that the output exists**
- [`docs/output_gallery.md`](docs/output_gallery.md) and [`docs/figma/3_output_gallery.png`](docs/figma/3_output_gallery.png): 15 outputs with a quality check for each.
- Gmail screenshots: [weekly digest](docs/img/gmail_1_weekly_digest.png), [inbox](docs/img/gmail_2_inbox.png), [opportunity alert](docs/img/gmail_3_opportunity_alert.png).
- The `email` block in each [`data/runs/run_*.json`](data/runs/) records the SMTP acceptance and message id.

**Today's three real runs:** 6 emails delivered, 12 briefs fact-checked, median groundedness 87% (range 54–97%).
- The lowest score was an honest failure. The 54% Birdeye brief had thin evidence, and it was badged **failed** instead of being sent as if it were true.
- In the last run, Gemini's daily free quota for the two Flash writer models had run out. The writer fell back to Flash-Lite and groundedness dropped to 77–83%, so the fact-checker badged those briefs **needs review**. The safety net worked as designed.

## Error handling

**What could go wrong, and how each case is handled:**

| What could go wrong | How it's handled | Where |
|---|---|---|
| A news source is down, blocked or slow | It's retried 3 times, then recorded as a "source unavailable" row in the quality report. The run continues with the other sources. | A3 fetch nodes |
| AI rate limit (429, per minute) | The client waits for Gemini's `retryDelay` or `Retry-After`, otherwise uses exponential backoff with jitter, and retries up to 4 times | [`ai_client.js`](workflow/lib/ai_client.js) |
| AI daily quota used up (429 per-day) | It doesn't wait. The model is marked exhausted for the run and the task **moves to the next model in the chain** | `ai_client.js` |
| AI overloaded, timed out, or network error (503, timeout) | It retries with backoff, then moves to the next model | `ai_client.js` |
| The model rejects a parameter (400) | It retries once without the optional parameters | `ai_client.js` |
| The AI returns malformed JSON or misses fields | It gets one repair round-trip ("your reply was rejected because…"). If it's still wrong, the record uses the **keyword-rule fallback**, labeled `rules_fallback` on that record | `ai_client.js`, [`analyst_core.js`](workflow/lib/analyst_core.js) |
| The AI keeps failing | After 3 failed batches the **circuit breaker** opens: the rest of the run uses the rules, and the dashboard says so | `analyst_core.js` |
| Spending runs away | A **hard $ budget per run** (`AI_BUDGET_USD`, default $1 at list price). When it's reached, paid calls stop and the run falls back to rules. The scale test has its own `--budget` | `ai_client.js`, `scale_test.mjs` |
| The AI writes something untrue | Fabricated citations are caught by a rule. Unsupported claims are removed by the fact-checker running on a different model. Briefs below 85% grounded are badged | [`24_fact_checker.js`](workflow/src/24_fact_checker.js) |
| No AI key configured at all | The whole pipeline still runs. The briefs become labeled source lists ("AI offline"). Example: [`outputs/examples/`](outputs/examples/) | all AI nodes |
| Missing or invalid input (API) | `400` / `413` / `422` with a reason, never a crash | [`31_api_analyze.js`](workflow/src/31_api_analyze.js) |
| Missing or corrupt cache file | A "cold start" is noted in the metrics and the cache is rebuilt | [`20_load_cache.js`](workflow/src/20_load_cache.js) |
| Email fails | 3 tries, then the failure is recorded in the run metrics. A copy of every email is always saved to `outputs/` | Send Email nodes |
| Anything else crashes | The **Error workflow** emails the failing node, error and suggested fix, and writes `data/runs/errors/*.json` ([real example from the scale test](data/runs/errors/)) | [`error_handler.json`](workflow/error_handler.json) |
| n8n overloaded (found in scale testing) | Runner concurrency raised from 10 to 50, and the queue timeout from 60 to 300 s | [`scripts/env.ps1`](scripts/env.ps1) |

## Scale

See [`scale_test_results.md`](scale_test_results.md):
- **n8n alone:** 1,000 requests in a burst at 100% success, about 25 requests per second.
- **With the AI:** 100 concurrent requests at 100% success, after fixing the runner limit that broke at 50.
- **Cost:** about $0.038 per 100 requests, or roughly $9–11 a month at 1,000 requests a day.

## Run it yourself (Windows)

1. Install Node.js 20+ and n8n: `npm install -g n8n`
2. `copy .env.example .env`. Add a free Gemini key from <https://aistudio.google.com/apikey>. For email, add a Gmail address and an [App password](https://myaccount.google.com/apppasswords).
3. Check the keys without printing them: `node scripts/check-setup.mjs`
4. Load the Gmail credential into n8n: `powershell -ExecutionPolicy Bypass -File scripts\setup-credentials.ps1`
5. Run once, headless: `powershell -ExecutionPolicy Bypass -File scripts\run-pipeline.ps1`. Or start the editor with `scripts\start-n8n.ps1` and open <http://localhost:5678>.
6. Load test (with the editor running): `node scripts/scale_test.mjs --levels 1,10,50`. Add `--no-ai` to test n8n alone.

The Code-node JavaScript lives in [`workflow/src/`](workflow/src/) and [`workflow/lib/`](workflow/lib/). After editing, run `python scripts/build_workflow.py` to rebuild the three workflow JSON files.

## License

The code is released under the MIT License. The collected data remains subject to each source's terms, and every record links back to its source.
