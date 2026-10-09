"""Builds docs/demo_walkthrough.pdf — a 3–5 minute screenshot walkthrough with a talk track.

    python docs/shoot.py && python docs/build_panels.py && python docs/build_demo.py

Slides are 16:9 (1600×900). Every image is a real output or a render of the real workflow file.
"""
import glob, html, json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DOCS, GAL, FIG, IMG = ROOT / "docs", ROOT / "docs/img/gallery", ROOT / "docs/figma", ROOT / "docs/img"
esc = html.escape
uri = lambda p: Path(p).as_uri()


# ---------------------------------------------------------------- workflow canvas, drawn from workflow_v2.json
def canvas_svg():
    wf = json.load(open(ROOT / "workflow/workflow_v2.json", encoding="utf-8"))
    nodes = {n["name"]: n for n in wf["nodes"]}
    xs = [n["position"][0] for n in wf["nodes"]]; ys = [n["position"][1] for n in wf["nodes"]]
    x0, y0 = min(xs) - 40, min(ys) - 40
    W, H = max(xs) - x0 + 260, max(ys) - y0 + 160
    def color(n):
        t, nm = n["type"], n["name"]
        if "stickyNote" in t: return None
        if nm.startswith("AI "): return ("#ccfbf1", "#0f766e")
        if "emailSend" in t: return ("#dbeafe", "#1d4ed8")
        if "switch" in t: return ("#ffedd5", "#c2410c")
        if "Trigger" in t or "trigger" in t: return ("#dcfce7", "#15803d")
        if "readWriteFile" in t or "convertToFile" in t: return ("#f1f5f9", "#64748b")
        if "rssFeedRead" in t or "httpRequest" in t: return ("#fef9c3", "#a16207")
        return ("#ffffff", "#475569")
    out = []
    for n in wf["nodes"]:
        if "stickyNote" in n["type"]:
            p = n["parameters"]; x, y = n["position"][0] - x0, n["position"][1] - y0
            title = p["content"].split("\n")[0].lstrip("#").strip()
            out.append(f'<rect x="{x}" y="{y}" width="{p["width"]}" height="{p["height"]}" rx="14" fill="#f8fafc" stroke="#e2e8f0"/>'
                       f'<text x="{x+16}" y="{y+30}" font-size="22" font-weight="700" fill="#0f766e">{esc(title[:60])}</text>')
    for src, c in wf["connections"].items():
        for outs in c["main"]:
            for e in outs:
                a, b = nodes[src]["position"], nodes[e["node"]]["position"]
                ax, ay, bx, by = a[0] - x0 + 180, a[1] - y0 + 40, b[0] - x0, b[1] - y0 + 40
                mx = (ax + bx) / 2
                out.append(f'<path d="M{ax} {ay} C{mx} {ay} {mx} {by} {bx} {by}" stroke="#94a3b8" stroke-width="3" fill="none"/>')
    for n in wf["nodes"]:
        col = color(n)
        if not col: continue
        x, y = n["position"][0] - x0, n["position"][1] - y0
        out.append(f'<rect x="{x}" y="{y}" width="180" height="80" rx="12" fill="{col[0]}" stroke="{col[1]}" stroke-width="3"/>'
                   f'<text x="{x+90}" y="{y+47}" text-anchor="middle" font-size="19" font-weight="700" fill="#0f172a">{esc(n["name"][:18])}</text>')
    body = "".join(out); split = 2480 - x0                        # A3 collection | v2 AI layer
    mk = lambda vx, vw: f'<svg viewBox="{vx} 0 {vw} {H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial">{body}</svg>'
    return (mk(0, split), mk(split, W - split)), len([n for n in wf["nodes"] if "stickyNote" not in n["type"]])


runs = [json.load(open(f, encoding="utf-8")) for f in sorted(glob.glob(str(ROOT / "data/runs/run_20261009*.json")))]
runs = [r for r in runs if r["ai"]["calls"] > 0]
cold, warm, last = runs[0], runs[1], runs[-1]
q = (ROOT / "data/clean/quality_report.md").read_text(encoding="utf-8")
svg, n_nodes = canvas_svg()
n8n_shots = sorted(glob.glob(str(IMG / "n8n_*.png")))
gmail_shots = sorted(glob.glob(str(IMG / "gmail_*.png")))

CSS = """*{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Inter,Arial,sans-serif;color:#334155}
.s{width:1600px;height:900px;padding:44px 56px;position:relative;overflow:hidden;page-break-after:always;background:#fff}
.k{font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#0f766e;font-weight:800}
h1{font-size:40px;color:#0f172a;margin:6px 0 4px;line-height:1.12}h2{font-size:22px;color:#0f172a;margin:0 0 8px}
.g{display:grid;grid-template-columns:1.55fr 1fr;gap:28px;margin-top:20px;height:690px}
.shot{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#f8fafc;height:100%}.shot img{width:100%;height:100%;object-fit:cover;object-position:top}
.pts li{margin:9px 0;line-height:1.45;font-size:17px}.pts{padding-left:20px;margin:0}
.say{margin-top:14px;background:#f0fdfa;border-left:4px solid #0f766e;border-radius:8px;padding:12px 14px;font-size:15.5px;color:#134e4a;line-height:1.45}
.t{position:absolute;right:56px;top:44px;font-size:14px;color:#94a3b8;font-weight:700}.foot{position:absolute;left:56px;bottom:22px;font-size:12px;color:#94a3b8}
.n{font-size:13px;color:#64748b}"""

slides = []
def slide(k, title, img, points, say, t, contain=False, extra=""):
    im = f"<div class='shot'><img src='{uri(img)}' style='{'object-fit:contain;background:#fff' if contain else ''}'></div>" if not str(img).startswith('<') else img
    slides.append(f"""<div class='s'><div class='t'>{esc(t)}</div><div class='k'>{esc(k)}</div><h1>{esc(title)}</h1>
<div class='g'>{im}<div><ul class='pts'>{''.join(f'<li>{p}</li>' for p in points)}</ul><div class='say'><b>Say:</b> {say}</div>{extra}</div></div>
<div class='foot'>Groundline v2 · INFO 7375 A4 · Agnel Salve · github.com/agnelsalve/groundline-intelligence</div></div>""")

# 1 title
slides.append(f"""<div class='s' style='background:#0f172a;color:#e2e8f0'><div class='k' style='color:#5eead4'>INFO 7375 Branding &amp; AI · Assignment 4 · demo walkthrough</div>
<h1 style='color:#fff;font-size:64px;margin-top:150px'>Groundline v2</h1><div style='font-size:30px;color:#cbd5e1'>An AI brand-intelligence analyst that shows its sources</div>
<div style='margin-top:40px;font-size:20px;color:#94a3b8;line-height:1.6'>Reads everything said about Weave and its competitors · alerts on risk · writes cited briefs · a second model fact-checks every claim</div>
<div style='position:absolute;left:56px;bottom:60px;font-size:18px;color:#94a3b8'>Agnel Salve · Northeastern University · Fall 2026 &nbsp;·&nbsp; 3–5 minute walkthrough &nbsp;·&nbsp; all screens are real outputs from 2026-10-09</div>
<div style='position:absolute;right:56px;bottom:52px;background:#0f766e;color:#fff;font-weight:800;border-radius:999px;padding:12px 24px;font-size:18px'>Built with n8n + Google Gemini</div></div>""")

slide("0:00 – 0:30 · Why", "A3 collected the data. A4 thinks about it.", FIG / "2_before_after.png",
      ["A3: 220 cited records, keyword rules, no output a person reads.", "A4: three Gemini models with separate jobs — <b>judge, write, check</b>.",
       "Outputs land in a real Gmail inbox: digest, risk alerts, opportunity alerts.", "Built for Weave's brand / data team (my Madison Intelligence-Agent project)."],
      "“Last time I built the pipe. This time the pipe reads, decides and writes — and it has to prove every sentence.”", "slide 2", contain=True)
slide("0:30 – 1:00 · How", "Architecture: five lanes, every failure has a path", DOCS / "architecture.png",
      ["Collect → validate (A3) → <b>AI Analyst</b> → <b>Switch</b> decision → alerts.", "<b>Brief Writer</b> → <b>Fact-Checker</b> on a different model → render → Gmail.",
       "Red boxes: what happens when sources, the AI, the email or n8n itself fail.", "Integrations: RSS/HTTP · Gemini API · Gmail SMTP · webhook API."],
      "“The important box is the third AI — a different model that checks the writer's claims against the sources before anything is sent.”", "slide 3", contain=True)
if n8n_shots:
    canvas = f"<div class='shot' style='background:#1f1f1f'><img src='{uri(n8n_shots[0])}' style='object-fit:contain'></div>"
else:
    canvas = None
    slides.append(f"""<div class='s'><div class='t'>slide 4</div><div class='k'>1:00 – 1:20 · The workflow</div><h1>{n_nodes} n8n nodes, one importable file</h1>
<div style='display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px;height:520px'>
<div class='shot' style='background:#fff;padding:8px'><div class='n' style='padding:4px 8px'>A3 · collect, validate, save</div>{svg[0]}</div>
<div class='shot' style='background:#fff;padding:8px'><div class='n' style='padding:4px 8px'>A4 · judge → decide → alert · write → fact-check → deliver</div>{svg[1]}</div></div>
<div style='display:grid;grid-template-columns:1.3fr 1fr;gap:28px;margin-top:16px'><ul class='pts'>
<li>Teal: the three AI Code nodes · orange: the Switch decision · blue: Gmail · yellow: source fetches.</li>
<li>Two more workflows: an <b>Error handler</b> and the <b>Analyze API</b> webhook used for load tests.</li>
<li>Code lives in <code>workflow/src</code> + <code>workflow/lib</code>; one build script makes the JSON.</li></ul>
<div class='say'><b>Say:</b> “Everything is in workflow_v2.json — import it and press Execute.” <span class='n'>(Canvas drawn from the real workflow file.)</span></div></div>
<div class='foot'>Groundline v2 · INFO 7375 A4 · Agnel Salve · github.com/agnelsalve/groundline-intelligence</div></div>""")
if canvas: slide("1:00 – 1:20 · The workflow", f"{n_nodes} n8n nodes, one importable file", canvas,
      ["Blue: A3's collection (RSS incl. competitors, arXiv, Hacker News, NewsAPI) · green: validate · purple: save.", "Red: the AI Analyst · orange: the Switch decision and alert emails · dark green: write → fact-check → deliver.",
       "Two more workflows: an <b>Error handler</b> and the <b>Analyze API</b> webhook used for load tests.", "Code lives in <code>workflow/src</code>; one build script makes the JSON."],
      "“Everything is in workflow_v2.json — import it and press Execute.”", "slide 4",
      extra="" if n8n_shots else "<p class='n' style='margin-top:12px'>Canvas drawn from workflow_v2.json (real node positions and connections).</p>")
if (IMG / "n8n_3_execution_succeeded.png").exists():
    slide("1:20 · Proof it ran", "Every run succeeded — even when the AI didn't", IMG / "n8n_3_execution_succeeded.png",
          ["n8n's execution history for the main workflow: <b>7 runs, all Succeeded</b>.",
           "Oct 9 runs used Gemini (e.g. 01:23 — 1 min 53 s with a warm cache). Oct 6 and 8 runs were the no-AI-key and plumbing tests.",
           "“Succeeded” even on quota errors: failures are handled inside the flow and reported, not thrown.",
           "Each run also writes <code>data/runs/run_*.json</code> with cost, tokens and delivery status."],
          "“Seven executions, zero crashes — the bad days are in the logs, not in red nodes.”", "slide 5", contain=True)
slide("1:20 – 1:45 · Judge", "Gemini judges every record — and throws out the noise", GAL / "09_scored_records_csv.png",
      [f"{cold['records_judged']} records: relevance 0–3, entity, sentiment −2…+2, risk, opportunity, archetype, key fact, reason.",
       f"<b>{cold['routes'].get('discard', 0)} off-topic items removed</b> — F1 and endurance-racing “podium” stories that A3's keyword rules kept.",
       f"Cache: second run judged {warm['analysis']['cache_hits']} of {warm['records_judged']} from cache — step time 41 s → 4 s.",
       "Exported as a spreadsheet anyone can open."],
      "“The AI isn't summarising — it's making 294 small judgements, each with a stated reason.”", "slide 5", contain=True)
slide("1:45 – 2:10 · Decide & act", "High risk → an email the same run", GAL / "07_risk_alert_email.png",
      ["Switch rule: relevance ≥ 2 and risk_to_weave = high → <b>risk alert</b>.", "Real catch: a law firm investigating the $650M take-private price.",
       "Competitor stumble or market shift → <b>opportunity alert</b> (e.g. ServiceTitan dropping Podium; AI receptionists failing patients).",
       "Already-alerted items are remembered — no repeat pages."],
      "“This is the decision step: it doesn't just label things, it routes them and acts.”", "slide 6", contain=True)
slide("2:10 – 2:45 · Write & check", "Every claim cited — and checked by another model", GAL / "01_weave_brief.png",
      ["Brief Writer gets computed STATS + evidence; it must cite record ids for every claim.", "Fact-Checker (different model) rules supported / partial / unsupported.",
       "Fabricated citations are caught by rule; unsupported claims are <b>removed</b> and listed.",
       f"Today: 12 briefs checked, groundedness 54–97%; below 85% = “needs review” badge."],
      "“If the model makes something up, it doesn't reach the inbox — and the brief tells you how much of it was verified.”", "slide 7")
slide("2:45 – 3:05 · Deliver", "What lands in the inbox", GAL / "06_weekly_digest_email.png" if not gmail_shots else gmail_shots[0],
      ["Weekly digest: headline, key points, 3 actions, chart, competitor one-liners.", "Attached: full brief, dashboard, 294-row spreadsheet.",
       "6 real emails delivered today — Gmail message ids in <code>data/runs/</code>.", "Copies of every email are also saved to <code>outputs/</code>."],
      "“A non-technical marketer gets this on Monday morning — no n8n, no JSON.”", "slide 8", contain=bool(gmail_shots))
slide("3:05 – 3:30 · Failure", "When things go wrong, it says so", (IMG / "gmail_2_inbox.png") if (IMG / "gmail_2_inbox.png").exists() else GAL / "12_run_summary.png",
      ["Real today: Gemini 3.8 Flash <b>503 overloaded</b> and <b>daily quota</b> exhausted → automatic switch to the next model.",
       "Broken JSON → one repair round-trip → keyword-rule fallback, labelled per record.", "Error workflow: <b>a FAILED email for every crashed run</b> (inbox row from the scale test) + JSON log; circuit breaker and $1/run cap.",
       "No AI key at all → the run still finishes, briefs say “AI offline”."],
      "“I didn't simulate these errors — the free tier produced them, and the log shows each one handled.”", "slide 9", contain=True)
slide("3:30 – 4:00 · Scale", "Real load tests: what broke, and the fix", FIG / "4_scale_testing.png",
      ["50 concurrent AI requests → 15 × HTTP 500: n8n runs 10 Code tasks at a time.", "Fix: runner concurrency 50, queue timeout 300 s → <b>0 errors at 50 and 100</b>.",
       "n8n alone: 1,000-request burst 100%; 2,000 → 4.4% fail, 21 GB.", "≈ $0.038 per 100 requests → ≈ $9–11/month at 1,000/day."],
      "“The first thing to break wasn't the AI — it was n8n's code runner. Finding that is the point of testing.”", "slide 10", contain=True)
slide("4:00 – 4:30 · Value", "Business value and what's next", FIG / "1_executive_summary.png",
      ["Replaces an estimated 4–6 analyst hours a week for ≈ $0.16 of AI per run.", "Every sentence traceable to a source → a team can act on it.",
       "Next: paid Gemini tier + n8n queue mode for the API; route fix (entity ≠ Weave for opportunities).", "Then: feed the cited records into Madison's Intelligence Agent."],
      "“That's Groundline: cheaper than an analyst's afternoon, and it shows its work.”", "slide 11", contain=True)

# backup plan
slides.append(f"""<div class='s'><div class='k'>If the live demo fails</div><h1>Backup plan</h1>
<div style='display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:24px'>
<div><h2>Before presenting</h2><ul class='pts'><li>Run <code>node scripts/check-setup.mjs</code> — confirms each Gemini model answers.</li>
<li>Run once the night before; the cache makes the live run ~1–2 min.</li><li>Keep <code>outputs/</code> open in a browser tab: briefs, dashboard, alerts.</li><li>Keep this PDF and the Figma board open.</li></ul></div>
<div><h2>If something breaks live</h2><ul class='pts'><li><b>Gemini quota / 503</b> — that is the demo: show the model switch in <code>outputs/run_summary.md</code>.</li>
<li><b>No internet</b> — show yesterday's real outputs and the Gmail inbox screenshots.</li><li><b>n8n won't start</b> — open <code>workflow_v2.json</code> in the repo and walk this PDF.</li>
<li><b>Email delayed</b> — open the saved copy in <code>outputs/emails/</code>.</li></ul></div></div>
<div class='say' style='margin-top:30px'><b>Key points to land:</b> (1) three models with separate jobs, (2) every claim cited and independently checked, (3) real decisions → real emails, (4) honest scale limits with a fix, (5) ≈ $0.16 a run.</div>
<div class='foot'>Groundline v2 · INFO 7375 A4 · Agnel Salve</div></div>""")

import re
slides = [re.sub(r"<div class='t'>slide \d+</div>", f"<div class='t'>slide {i + 1} / {len(slides)}</div>", sl) for i, sl in enumerate(slides)]
doc = f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}@page{{size:1600px 900px;margin:0}}</style></head><body>{''.join(slides)}</body></html>"
f = DOCS / "_demo.html"; f.write_text(doc, encoding="utf-8")
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome"); pg = b.new_page(viewport={"width": 1600, "height": 900})
    pg.goto(f.as_uri()); pg.wait_for_timeout(1200)
    pg.pdf(path=str(DOCS / "demo_walkthrough.pdf"), width="1600px", height="900px", print_background=True)
    for i in range(len(slides)):
        pg.evaluate(f"window.scrollTo(0, {i * 900})"); pg.wait_for_timeout(150)
        if i in (3, 4, 8):
            pg.screenshot(path=str(DOCS / f"_demo_check_{i + 1}.png"))
    b.close()
f.unlink()
print("wrote docs/demo_walkthrough.pdf with", len(slides), "slides;", "n8n screenshots" if n8n_shots else "canvas drawn from JSON", "; gmail shots:", len(gmail_shots))
