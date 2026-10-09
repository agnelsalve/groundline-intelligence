# Output gallery: 14 real outputs (2026-10-09)

Every item below was produced by an actual run of [`workflow/workflow_v2.json`](../workflow/workflow_v2.json). Nothing is a mock-up. The screenshots are in [`img/gallery/`](img/gallery/) and the files themselves are in [`../outputs/`](../outputs/). Everything here also appears as one image in [`figma/3_output_gallery.png`](figma/3_output_gallery.png).

---

### Example 1: Weekly digest email
**What was produced:** the Weave brand brief as an email. It has the headline, a summary, key points, 3 recommended actions, a sentiment chart, one-line summaries of each competitor, and 3 attachments: the full brief, the dashboard and the scored CSV.
**Where it went:** Gmail, to `branding.and.ai@gmail.com`. It was sent 3 times today (message ids `<b94da349…>`, `<8e393618…>`, `<f4ae78c4…>`, logged in `data/runs/run_*.json`). A copy is saved at [`outputs/emails/2026-10-09_weekly_digest.html`](../outputs/emails/2026-10-09_weekly_digest.html).
**Screenshot/File:** [`img/gallery/06_weekly_digest_email.png`](img/gallery/06_weekly_digest_email.png) · Gmail inbox screenshots in [`img/`](img/)
**Quality check:** It reads well on a phone, and the chart renders in Gmail because it's a PNG. Gmail blocks SVG. The grounding badge is honest: the latest run's Weave brief is 83% grounded and is shown as *needs review*.

### Example 2: Brand-risk alert email
**What was produced:** an immediate alert because a law firm (Halper Sadeh LLC) is investigating whether Weave's $650M take-private price is fair to shareholders. It includes the risk level, sentiment, what happened, and why it was flagged.
**Where it went:** Gmail (message id `<3e903295…>`), sent the same run the item first appeared. It is saved at [`outputs/alerts/2026-10-09_urgent_risk.html`](../outputs/alerts/2026-10-09_urgent_risk.html).
**Screenshot/File:** [`img/gallery/07_risk_alert_email.png`](img/gallery/07_risk_alert_email.png)
**Quality check:** Correct. This is a real reputational and legal risk. The next run did **not** send the same alert again, because repeats are suppressed.

### Example 3: Opportunity alert email
**What was produced:** an alert for signals Weave can act on.
**Where it went:** Gmail (message ids `<f3e97db7…>` and `<3ac65b5e…>`). It is saved at [`outputs/alerts/2026-10-09_opportunity.html`](../outputs/alerts/2026-10-09_opportunity.html).
**Screenshot/File:** [`img/gallery/08_opportunity_alert_email.png`](img/gallery/08_opportunity_alert_email.png)
**Quality check:** Mostly right. The AI routed 11 items to this alert:
- **Good:** 7 news stories of AI receptionists failing patients (for example, not understanding accents). That's a genuine market opening for Weave's human-plus-AI positioning.
- **Good:** ServiceTitan ending Podium's integration, a real competitor stumble.
- **Wrong route:** 3 items are *Weave's own* good news, such as the stock rise. They're useful for PR, but they aren't "competitor signals" as the subject line says. The saved copy is the second run's alert, which contains one of these.

Planned fix: require `entity ≠ Weave` for this route.

### Example 4: Weave brand brief (HTML + PDF)
**What was produced:** a full brief covering what happened, how the brand is perceived, risks, openings, a brand-archetype read (Ruler), 3 actions, a theme chart, the fact-check result, and an evidence table.
**Where it went:** [`outputs/briefs/2026-10-09_weave.html`](../outputs/briefs/2026-10-09_weave.html) and [`outputs/pdf/2026-10-09_weave_brief.pdf`](../outputs/pdf/2026-10-09_weave_brief.pdf). It was also attached to the digest email.
**Screenshot/File:** [`img/gallery/01_weave_brief.png`](img/gallery/01_weave_brief.png)
**Quality check:** Every claim links to its source, and every number is computed rather than generated. The latest run was written by Flash-Lite, because the Flash daily quota had run out, and scored 83% grounded: 2 claims were removed and it is badged *needs review*. The earlier run's version, written by Flash, was 96%.

### Example 5: Competitor watch: Podium
**What was produced:** a brief on Podium: the ServiceTitan split, its pivot toward AI for home services, and what that means for Weave.
**Where it went:** [`outputs/briefs/2026-10-09_podium.html`](../outputs/briefs/2026-10-09_podium.html) and [PDF](../outputs/pdf/2026-10-09_podium_brief.pdf)
**Screenshot/File:** [`img/gallery/02_podium_brief.png`](img/gallery/02_podium_brief.png)
**Quality check:** The insight is real: about 1,000 shared customers lost an integration. The latest run scored 77% (3 claims removed). The Gemini 3.8 Flash version earlier today scored 97%.

### Example 6: Market landscape brief
**What was produced:** a brief on trends in AI receptionists and AI front-desk tools, and how they change the market Weave competes in.
**Where it went:** [`outputs/briefs/2026-10-09_market.html`](../outputs/briefs/2026-10-09_market.html) and [PDF](../outputs/pdf/2026-10-09_market_brief.pdf)
**Screenshot/File:** [`img/gallery/03_market_brief.png`](img/gallery/03_market_brief.png)
**Quality check:** Claims are cited. It scored 77% in the latest run and 94% in the earlier one.

### Example 7: Competitor watch: Birdeye
**What was produced:** a brief on Birdeye's $100M ARR and its AI features.
**Where it went:** [`outputs/briefs/2026-10-09_birdeye.html`](../outputs/briefs/2026-10-09_birdeye.html)
**Screenshot/File:** [`img/gallery/04_birdeye_brief.png`](img/gallery/04_birdeye_brief.png)
**Quality check:** 94% grounded and *verified* in the latest run. The same competitor scored **54% (failed)** in the run before, because only 3 source items exist. The badge reported that failure instead of hiding it.

### Example 8: Weave vs. competitors dashboard
**What was produced:** share of voice, average sentiment, a side-by-side table, links to every brief, the alerts raised, and the noise the AI filtered out.
**Where it went:** [`outputs/2026-10-09_dashboard.html`](../outputs/2026-10-09_dashboard.html) and [PDF](../outputs/pdf/2026-10-09_dashboard.pdf). It was also attached to the digest email.
**Screenshot/File:** [`img/gallery/05_dashboard.png`](img/gallery/05_dashboard.png)
**Quality check:** The "noise filtered" list proves the relevance check works. Motorsport "podium" stories were dropped, which A3's keyword rules let through.

### Example 9: Scored records spreadsheet
**What was produced:** 294 rows, one per record, with the AI's relevance, entity, sentiment, theme, risk, opportunity, archetype, route, key fact and reason.
**Where it went:** [`outputs/data/2026-10-09_scored_records.csv`](../outputs/data/2026-10-09_scored_records.csv), attached to the digest.
**Screenshot/File:** [`img/gallery/09_scored_records_csv.png`](img/gallery/09_scored_records_csv.png)
**Quality check:** It opens in Excel (UTF-8 with BOM). Every row says whether it was judged by the AI, the cache, or the rules.

### Example 10: Sentiment chart
**What was produced:** a PNG bar chart of average sentiment per company.
**Where it went:** [`outputs/charts/2026-10-09_sentiment.png`](../outputs/charts/2026-10-09_sentiment.png), embedded in the email.
**Screenshot/File:** [`img/gallery/10_sentiment_chart.png`](img/gallery/10_sentiment_chart.png)
**Quality check:** It renders correctly. It depends on QuickChart.io; if that service is down, the email simply leaves the chart out.

### Example 11: Fact-check log
**What was produced:** every claim in every brief, with its verdict (supported, partial or unsupported), its citations and the checker's reason.
**Where it went:** [`outputs/2026-10-09_fact_check.md`](../outputs/2026-10-09_fact_check.md)
**Screenshot/File:** [`img/gallery/11_fact_check_log.png`](img/gallery/11_fact_check_log.png)
**Quality check:** It makes the AI auditable: anyone can see exactly what was removed and why.

### Example 12: Run summary and monitoring record
**What was produced:** time per step, AI calls, retries, JSON repairs, model fallbacks, tokens, cost, cache hits, groundedness per brief, email delivery and the errors handled.
**Where it went:** [`outputs/run_summary.md`](../outputs/run_summary.md), plus [`data/runs/run_*.json`](../data/runs/) for every run.
**Screenshot/File:** [`img/gallery/12_run_summary.png`](img/gallery/12_run_summary.png)
**Quality check:** Its numbers match the scale report, and they're what you'd watch in production.

### Example 13: Fallback brief (AI unavailable)
**What was produced:** the same pipeline run with no AI key. The brief becomes a labeled list of the highest-priority sources instead of failing.
**Where it went:** [`outputs/examples/ai_offline_weave_brief.html`](../outputs/examples/ai_offline_weave_brief.html)
**Screenshot/File:** [`img/gallery/13_ai_offline_brief.png`](img/gallery/13_ai_offline_brief.png)
**Quality check:** It degrades gracefully and honestly, with an "AI offline · source list only" badge and no false grounding score.

### Example 14: Error-workflow log
**What was produced:** a structured failure record (workflow, failing node, error, n8n's explanation, execution id). The same workflow also emails these details.
**Where it went:** [`data/runs/errors/error_20261009T050105Z.json`](../data/runs/errors/)
**Screenshot/File:** [`img/gallery/14_error_workflow_log.png`](img/gallery/14_error_workflow_log.png)
**Quality check:** This is a real failure, `Task request timed out`, caught during the 50-request scale test. It led to the runner fix described in [`scale_test_results.md`](../scale_test_results.md).
