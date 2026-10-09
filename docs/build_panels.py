"""Builds the Figma-ready panels and the executive summary from the real run data.

    python docs/shoot.py          # first: screenshots of the outputs
    python docs/build_panels.py   # then: panels (PNG for Figma) + PDFs

Writes docs/figma/*.png (import into Figma), docs/*.pdf, and docs/img/gallery/* previews.
"""
import csv, glob, html, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DOCS, FIG, GAL = ROOT / "docs", ROOT / "docs" / "figma", ROOT / "docs" / "img" / "gallery"
FIG.mkdir(parents=True, exist_ok=True)
D = "2026-10-09"
esc = html.escape

runs = sorted(glob.glob(str(ROOT / "data/runs/run_2026100*.json")))
real_runs = [json.load(open(f, encoding="utf-8")) for f in runs]
real_runs = [r for r in real_runs if r["ai"]["calls"] > 0]
cold = next(r for r in real_runs if r["run_id"] == "20261009T044544Z")
latest = real_runs[-1]
scale = {Path(f).stem: json.load(open(f, encoding="utf-8")) for f in glob.glob(str(ROOT / "data/scale/*.json"))}

CSS = """
*{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Inter,Helvetica,Arial,sans-serif;color:#334155;background:#fff}
.p{width:1600px;padding:48px 56px;position:relative}
.k{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#0f766e;font-weight:800}
h1{font-size:40px;line-height:1.1;color:#0f172a;margin:8px 0 6px}h2{font-size:20px;color:#0f172a;margin:0 0 10px}
.sub{font-size:17px;color:#475569}.badge{position:absolute;right:56px;top:48px;background:#0f766e;color:#fff;font-weight:800;border-radius:999px;padding:10px 22px;font-size:15px}
.card{border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;background:#fff}.soft{background:#f8fafc}
ul{margin:6px 0 0;padding-left:20px}li{margin:5px 0;line-height:1.45}
.tile{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;background:#f8fafc}.tile .v{font-size:30px;font-weight:800;color:#0f172a;line-height:1.1}
.tile .l{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-top:4px}
table{border-collapse:collapse;width:100%;font-size:14px}th{text-align:left;color:#64748b;font-weight:700;border-bottom:2px solid #e2e8f0;padding:8px 10px;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
td{border-bottom:1px solid #e2e8f0;padding:9px 10px;vertical-align:top}.ok{color:#15803d;font-weight:700}.bad{color:#b91c1c;font-weight:700}.warn{color:#b45309;font-weight:700}
.thumb{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#f8fafc}.thumb img{width:100%;display:block;object-fit:cover;object-position:top}
.foot{font-size:12px;color:#94a3b8;margin-top:18px}
"""


def page(body, w=1600):
    return f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="p" style="width:{w}px">{body}</div></body></html>'


def img(name):
    return (GAL / f"{name}.png").as_uri()


# ---------------------------------------------------------------- tiny Markdown → HTML (for previews)
def md_to_html(md):
    out, rows, inlist = [], [], False
    def inline(s):
        s = esc(s); s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s); s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
        return re.sub(r"_(.+?)_", r"<i>\1</i>", s)
    def flush():
        nonlocal rows
        if rows:
            body = [r for r in rows if not re.match(r"^\|[-\s|]+\|$", r)]
            cells = [[c.strip() for c in r.strip("|").split("|")] for r in body]
            out.append("<table>" + "".join("<tr>" + "".join(f"<{'th' if i == 0 else 'td'}>{inline(c)}</{'th' if i == 0 else 'td'}>" for c in r) + "</tr>" for i, r in enumerate(cells)) + "</table>")
            rows = []
    for line in md.splitlines():
        if line.startswith("|"): rows.append(line); continue
        flush()
        if line.startswith("- "):
            if not inlist: out.append("<ul>"); inlist = True
            out.append(f"<li>{inline(line[2:])}</li>"); continue
        if inlist and not line.startswith("  "): out.append("</ul>"); inlist = False
        if line.startswith("# "): out.append(f"<h1 style='font-size:26px'>{inline(line[2:])}</h1>")
        elif line.startswith("## "): out.append(f"<h2>{inline(line[3:])}</h2>")
        elif line.strip(): out.append(f"<p>{inline(line.strip())}</p>")
    flush()
    return "\n".join(out)


def preview_pages():
    """Small rendered previews of files that aren't HTML (CSV, Markdown, JSON log)."""
    p = {}
    rows = list(csv.DictReader(open(ROOT / f"outputs/data/{D}_scored_records.csv", encoding="utf-8-sig")))
    cols = ["entity", "relevance", "sentiment", "theme", "risk_to_weave", "opportunity_for_weave", "archetype", "route", "title"]
    sample = sorted(rows, key=lambda r: (-int(r["relevance"]), r["entity"] != "Weave"))[:14]
    p["09_scored_records_csv"] = page(f"<div class='k'>outputs/data/{D}_scored_records.csv · {len(rows)} rows · opens in Excel</div><h2 style='margin-top:10px'>Every record with the AI's judgement</h2>"
        + "<table><tr>" + "".join(f"<th>{c.replace('_', ' ')}</th>" for c in cols) + "</tr>"
        + "".join("<tr>" + "".join(f"<td>{esc(r[c][:70])}</td>" for c in cols) + "</tr>" for r in sample) + "</table>", 1400)
    p["11_fact_check_log"] = page("<div class='k'>outputs/" + D + "_fact_check.md</div>" + md_to_html((ROOT / f"outputs/{D}_fact_check.md").read_text(encoding="utf-8")[:6000]), 1200)
    p["12_run_summary"] = page("<div class='k'>outputs/run_summary.md · monitoring record of the run</div>" + md_to_html((ROOT / "outputs/run_summary.md").read_text(encoding="utf-8")), 1100)
    err = json.load(open(sorted(glob.glob(str(ROOT / "data/runs/errors/*.json")))[0], encoding="utf-8"))
    p["14_error_workflow_log"] = page(f"""<div class='k'>data/runs/errors/error_{err['id']}.json · written by the Error-handler workflow</div>
<div class='card' style='margin-top:14px;border-top:4px solid #b91c1c'><h2>{esc(err['workflow']['name'])} stopped</h2><table>
<tr><td>Failed node</td><td><b>{esc(err['node'])}</b></td></tr><tr><td>Error</td><td class='bad'>{esc(err['error']['message'])}</td></tr>
<tr><td>Detail</td><td>{esc(re.sub('<[^>]+>', ' ', err['error']['description'])[:420])}</td></tr><tr><td>When</td><td>{esc(err['at'])}</td></tr>
<tr><td>Execution</td><td>#{esc(str(err['execution_id']))}</td></tr></table></div>
<p class='foot'>Triggered during the 50-request scale test, before the runner fix. The same workflow also emails these details to the Groundline inbox.</p>""", 1100)
    return p


def shoot(pw, name, html_text, w, out_dir=FIG, pdf=None):
    f = out_dir / f"{name}.html"; f.write_text(html_text, encoding="utf-8")
    pg = pw.new_page(viewport={"width": w, "height": 800}, device_scale_factor=2)
    pg.goto(f.as_uri()); pg.wait_for_timeout(500)
    h = pg.evaluate("document.documentElement.scrollHeight"); pg.set_viewport_size({"width": w, "height": h})
    pg.screenshot(path=str(out_dir / f"{name}.png"))
    if pdf:
        pg.pdf(path=str(pdf), width=f"{w}px", height=f"{h + 4}px", print_background=True, page_ranges="1")
    pg.close(); f.unlink()
    print("panel", name, w, h)


# ---------------------------------------------------------------- numbers used on the panels
briefs = latest["briefs"]
verified = [b for b in briefs if b["status"] == "verified"]
g_lo = min(b["groundedness"] for b in verified) if verified else 0
g_hi = max(b["groundedness"] for b in verified) if verified else 0
sent = sorted({k for r in real_runs for k, v in r["email"].items() if v["status"] == "sent"})
emails_sent = sum(1 for r in real_runs for v in r["email"].values() if v["status"] == "sent")
all_g = sorted(b["groundedness"] for r in real_runs for b in r["briefs"] if b["groundedness"] is not None)
g_med = all_g[len(all_g) // 2] if all_g else 0
discard = latest["routes"].get("discard", 0)
ai_after = scale.get("scale_20261009T051532Z", {}).get("results", [{}])[0]
n8n_1000 = scale.get("scale_20261009T050335Z", {}).get("results", [{}])[0]


def exec_summary():
    m = [("294", "records judged per run"), (f"{cold['duration_s']:.0f}s → {latest['duration_s']:.0f}s", "cold → cached run"),
         (f"${cold['ai']['cost_usd']:.2f}", "AI cost per run at list price ($0 on free tier)"),
         (f"{round(g_med*100)}%", f"median groundedness, {len(all_g)} briefs fact-checked ({round(all_g[0]*100)}–{round(all_g[-1]*100)}%)"),
         (str(discard), "noise items the AI filtered out"), (str(emails_sent), f"real emails delivered to Gmail ({len(sent)} of 3 types)"),
         (f"{ai_after.get('success_pct', 0):.0f}%", "success at 100 concurrent AI requests"), ("1,000", "request burst n8n handles (100%)")]
    tiles = "".join(f"<div class='tile'><div class='v'>{esc(v)}</div><div class='l'>{esc(l)}</div></div>" for v, l in m)
    return page(f"""
<div class='badge'>Built with n8n + Google Gemini</div>
<div class='k'>Groundline v2 · Executive summary · INFO 7375 Assignment 4</div>
<h1>An AI brand-intelligence analyst that shows its sources</h1>
<div class='sub'>Every agent answer, traceable to a source. Agnel Salve · Northeastern University · Fall 2026</div>
<div style='display:grid;grid-template-columns:1.05fr 1fr;gap:26px;margin-top:28px'>
 <div style='display:grid;gap:18px'>
  <div class='card'><h2>Problem</h2><p style='margin:0;line-height:1.55'>Weave's brand and data teams track reputation and competitors by hand across news, analyst notes, legal notices and practitioner chatter — slow, and easy to miss the story that matters. AI summaries could do it faster, but nobody can trust them, because nothing ties a claim back to a source.</p></div>
  <div class='card'><h2>Solution approach</h2><ul>
   <li><b>Collect</b> ~500 items a run from 17 public feeds — Weave, 5 competitors, AI-market news, research, Reddit, Hacker News (A3 pipeline, extended).</li>
   <li><b>Judge</b> every item with Gemini 3.5 Flash-Lite: relevance, sentiment, risk, opportunity, brand archetype, key fact.</li>
   <li><b>Decide &amp; act:</b> high risk → instant Gmail alert; competitor stumble → opportunity alert; repeats suppressed.</li>
   <li><b>Write</b> cited briefs with Gemini 3.8 Flash — numbers computed in code, never generated.</li>
   <li><b>Fact-check</b> every claim with a <i>different</i> model; unsupported claims are removed and the brief is scored.</li>
   <li><b>Survive failure:</b> retries, model chain on quota, JSON repair, circuit breaker, budget cap, error workflow.</li></ul></div>
  <div class='card soft'><h2>Business value</h2><ul>
   <li>Replaces an estimated <b>4–6 analyst hours a week</b> of reading, writing and source-checking for about <b>$0.16 of AI per run</b>.</li>
   <li>Risks reach the inbox the run they appear — e.g. the shareholder-investigation alert on the $650M take-private.</li>
   <li>Every sentence links to its source and carries a groundedness score, so the team can act on it.</li>
   <li>At 1,000 API requests/day: <b>≈ $9–11 a month</b> in AI (measured per-request cost).</li></ul></div>
 </div>
 <div style='display:grid;gap:18px;align-content:start'>
  <div class='card'><h2>Current performance (measured {esc(latest['run_id'][:8])})</h2><div style='display:grid;grid-template-columns:repeat(4,1fr);gap:10px'>{tiles}</div></div>
  <div class='card'><h2>Sample outputs</h2><div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px'>
   <div><div class='thumb' style='height:260px'><img src='{img("06_weekly_digest_email")}' style='height:260px'></div><div class='foot' style='margin-top:6px'>Weekly digest in Gmail</div></div>
   <div><div class='thumb' style='height:260px'><img src='{img("01_weave_brief")}' style='height:260px'></div><div class='foot' style='margin-top:6px'>Cited Weave brief (HTML/PDF)</div></div>
   <div><div class='thumb' style='height:260px'><img src='{img("05_dashboard")}' style='height:260px'></div><div class='foot' style='margin-top:6px'>Weave vs. competitors dashboard</div></div></div></div>
 </div>
</div>
<div class='foot'>All numbers from real runs on 2026-10-09 — see scale_test_results.md and data/runs/. Costs at paid Gemini list prices; the free tier billed $0. "Analyst hours" is an estimate.</div>""")


def before_after():
    rows = [
        ("What it does", "Collects, validates and de-duplicates data", "Judges every record, decides, alerts, writes briefs, fact-checks them, delivers"),
        ("AI", "None — keyword rules only", "3 Gemini models with separate jobs (judge · write · check), Muse Spark optional"),
        ("Output", "CSV / JSON dataset + quality report", "Gmail digest + risk & opportunity alerts, cited HTML/PDF briefs, dashboard, scored CSV, chart"),
        ("Brand focus", "9% of records about Weave; no competitors", "Weave + Podium, Birdeye, NexHealth…: share of voice, sentiment, archetype"),
        ("Relevance", "Keyword match — an F1 race 'podium' counts as Podium", f"AI relevance check removed {discard} off-topic items"),
        ("Trust", "Every record cited", "Every claim cited, fact-checked by a second model, unsupported claims removed, groundedness score"),
        ("Error handling", "Retry each source 3×", "+ backoff, quota-aware model switching, JSON repair, rule fallback, circuit breaker, $ cap, error workflow"),
        ("Scale", "Not tested", "Tested 1 → 2,000 requests; breaking points found and one fixed"),
        ("Cost tracking", "—", "Tokens, cost, retries and fallbacks recorded for every run"),
    ]
    t = "".join(f"<tr><td><b>{esc(a)}</b></td><td>{esc(b)}</td><td style='color:#0f172a'>{esc(c)}</td></tr>" for a, b, c in rows)
    return page(f"""<div class='k'>Before / after</div><h1>Assignment 3 collected the data. Assignment 4 thinks about it.</h1>
<div class='sub'>Same pipeline underneath — v2 adds the intelligence layer on top.</div>
<div class='card' style='margin-top:24px'><table><tr><th style='width:16%'></th><th style='width:34%'>A3 · Groundline data pipeline</th><th>A4 · Groundline v2 brand-intelligence agent</th></tr>{t}</table></div>""")


BF = {b["key"]: b for b in latest["briefs"]}
def fc(key, good):
    b = BF.get(key, {}); g = b.get("groundedness")
    if g is None: return ("not fact-checked", "warn")
    pct = f"{round(g * 100)}% grounded ({b['supported']} supported / {b['partial']} partial / {b['unsupported']} removed)"
    return (f"{pct} — {good}", "ok") if b["status"] == "verified" else (f"{pct} — badged '{b['status'].replace('_', ' ')}', shown not hidden", "warn")

GALLERY = [
    ("06_weekly_digest_email", "Weekly digest email", "Gmail → branding.and.ai@gmail.com (accepted by SMTP, message id logged)", f"Readable on a phone; chart via QuickChart; Weave brief {fc('weave', '')[0].split(' (')[0]}", "ok"),
    ("07_risk_alert_email", "Brand-risk alert", "Gmail, sent the same run the item appeared", "Correct: law-firm investigation of the take-private price", "ok"),
    ("08_opportunity_alert_email", "Opportunity alert", "Gmail", "Competitor stumble surfaced; repeat alerts suppressed next run", "ok"),
    ("01_weave_brief", "Weave brand brief", f"outputs/briefs/{D}_weave.html + PDF", *fc("weave", "every claim links to its source")),
    ("02_podium_brief", "Competitor watch: Podium", f"outputs/briefs/{D}_podium.html + PDF", *fc("podium", "ServiceTitan split framed as an opening")),
    ("03_market_brief", "Market landscape brief", f"outputs/briefs/{D}_market.html + PDF", *fc("market", "AI-receptionist trends, cited")),
    ("04_birdeye_brief", "Competitor watch: Birdeye", f"outputs/briefs/{D}_birdeye.html", *fc("birdeye", "thin evidence, stated plainly")),
    ("05_dashboard", "Weave vs. competitors dashboard", f"outputs/{D}_dashboard.html + PDF", "Share of voice, sentiment, archetypes, filtered noise", "ok"),
    ("09_scored_records_csv", "Scored records spreadsheet", f"outputs/data/{D}_scored_records.csv (294 rows)", "Opens in Excel; AI judgement + reason per record", "ok"),
    ("10_sentiment_chart", "Sentiment chart", f"outputs/charts/{D}_sentiment.png", "Rendered for email (Gmail blocks SVG)", "ok"),
    ("11_fact_check_log", "Fact-check log", f"outputs/{D}_fact_check.md", "Every claim, verdict and reason — auditable", "ok"),
    ("12_run_summary", "Run summary / monitoring", "outputs/run_summary.md + data/runs/*.json", "Cost, tokens, retries, fallbacks, delivery status", "ok"),
    ("13_ai_offline_brief", "Fallback brief (AI unavailable)", "outputs/examples/ai_offline_weave_brief.html", "Degrades to a labelled source list instead of failing", "warn"),
    ("14_error_workflow_log", "Error workflow: log + emails", "data/runs/errors/*.json + a FAILED email per run", "Real failure caught during the 50-request scale test", "warn"),
    ("15_gmail_inbox", "Gmail inbox: proof of delivery", "branding.and.ai@gmail.com", "Digest with 3 attachments, alerts and failure emails all arrived", "ok"),
]


def gallery_panel():
    cards = "".join(f"""<div class='card' style='padding:12px'><div class='thumb' style='height:250px'><img src='{img(n)}' style='height:250px;{"object-fit:contain;background:#fff" if "chart" in n else ""}'></div>
<div style='font-weight:800;color:#0f172a;margin-top:10px'>{i}. {esc(t)}</div><div class='foot' style='margin:3px 0 4px'>{esc(w)}</div>
<div style='font-size:13px' class='{c}'>{'✓' if c == 'ok' else '!'} <span style='color:#334155;font-weight:400'>{esc(q)}</span></div></div>"""
                    for i, (n, t, w, q, c) in enumerate(GALLERY, 1))
    return page(f"""<div class='k'>Output gallery · {len(GALLERY)} real outputs from the 2026-10-09 runs</div><h1>What a person actually receives</h1>
<div class='sub'>Emails in a real inbox, files anyone can open. Raw JSON is never the output.</div>
<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:22px'>{cards}</div>""")


def scale_panel():
    def rows_of(key, label):
        d = scale.get(key)
        return [] if not d else [(label, r) for r in d["results"]]
    rows = rows_of("scale_20261009T045843Z", "AI, before fix") + rows_of("scale_20261009T051149Z", "AI, after fix") + \
        rows_of("scale_20261009T051532Z", "AI, after fix") + rows_of("scale_20261009T051421Z", "AI, batch ×10") + \
        rows_of("scale_20261009T050235Z", "n8n only") + rows_of("scale_20261009T050335Z", "n8n only")
    t = "".join(f"<tr><td>{esc(l)}</td><td><b>{r['requests']}</b>{' ×10' if 'batch' in l else ''}</td><td>{r['wall_s']}s</td><td>{r['p50_ms']/1000:.1f}s</td><td>{r['p95_ms']/1000:.1f}s</td>"
                f"<td class='{'ok' if r['success_pct'] == 100 else 'bad'}'>{r['success_pct']}%</td><td>{r['retries']}</td><td>{', '.join(f'{k}×{v}' for k, v in r['http_errors'].items()) or '—'}</td>"
                f"<td>${r['cost_usd']:.3f}</td><td>{(r['peak_n8n_mem_mb'] or 0)/1024:.1f} GB</td></tr>" for l, r in rows)
    return page(f"""<div class='k'>Scale testing · real runs, 2026-10-09</div><h1>What happens at 10× and 100× the volume</h1>
<div style='display:grid;grid-template-columns:1.6fr 1fr;gap:22px;margin-top:22px'>
<div class='card'><table><tr><th>Mode</th><th>Requests</th><th>Wall</th><th>p50</th><th>p95</th><th>Success</th><th>Retries</th><th>HTTP errors</th><th>Cost</th><th>Peak n8n</th></tr>{t}</table></div>
<div style='display:grid;gap:14px;align-content:start'>
<div class='card' style='border-left:4px solid #b91c1c'><h2>Breaks first: n8n's Code runner</h2>10 tasks at a time by default; a task waiting &gt;60 s is dropped → 15 × HTTP 500 at 50 concurrent AI requests.<br><b>Fix:</b> runner concurrency 50, queue timeout 300 s → <span class='ok'>0 errors at 50 and 100</span>.</div>
<div class='card' style='border-left:4px solid #b45309'><h2>Then: Gemini free-tier quota</h2>Per-minute limits absorbed by 61–165 retries; daily quota (~20 req/model on Flash) → automatic model switch. Pro models: 0 free quota.</div>
<div class='card' style='border-left:4px solid #1d4ed8'><h2>Then: memory</h2>~10 MB per in-flight request; 2,000 burst → 21 GB and 4.4% failures. Platform ceiling here ≈ 1,000 burst / 25 req/s.</div>
<div class='card soft'><h2>Production</h2>Weekly pipeline: 24/7-ready today. High-volume API: paid Gemini tier + n8n queue mode + batching (10× faster per record). ≈ $9–11/month at 1,000 requests/day.</div>
</div></div>""")


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for name, h in preview_pages().items():
        shoot(b, name, h, 1400 if "csv" in name else 1100 if name != "11_fact_check_log" else 1200, out_dir=GAL)
    # chart thumbnail = the real PNG
    (GAL / "10_sentiment_chart.png").write_bytes((ROOT / f"outputs/charts/{D}_sentiment.png").read_bytes())
    shoot(b, "1_executive_summary", exec_summary(), 1600, pdf=DOCS / "executive_summary.pdf")
    shoot(b, "2_before_after", before_after(), 1600)
    shoot(b, "3_output_gallery", gallery_panel(), 1600)
    shoot(b, "4_scale_testing", scale_panel(), 1600)
    b.close()
(FIG / "5_architecture.png").write_bytes((DOCS / "architecture.png").read_bytes())
print("done")
