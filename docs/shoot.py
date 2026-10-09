"""Screenshots and PDFs of the generated outputs, for the gallery, Figma board and demo.

    python docs/shoot.py

Uses the installed Google Chrome through Playwright (no browser download needed).
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "img" / "gallery"
OUT.mkdir(parents=True, exist_ok=True)
D = "2026-10-09"

# (output name, source file, viewport width, full page?, max height px)
SHOTS = [
    ("01_weave_brief", f"outputs/briefs/{D}_weave.html", 1000, True, 4200),
    ("02_podium_brief", f"outputs/briefs/{D}_podium.html", 1000, True, 4200),
    ("03_market_brief", f"outputs/briefs/{D}_market.html", 1000, True, 4200),
    ("04_birdeye_brief", f"outputs/briefs/{D}_birdeye.html", 1000, True, 4200),
    ("05_dashboard", f"outputs/{D}_dashboard.html", 1000, True, 4200),
    ("06_weekly_digest_email", f"outputs/emails/{D}_weekly_digest.html", 700, True, 3000),
    ("07_risk_alert_email", f"outputs/alerts/{D}_urgent_risk.html", 700, True, 3000),
    ("08_opportunity_alert_email", f"outputs/alerts/{D}_opportunity.html", 700, True, 3000),
    ("13_ai_offline_brief", "outputs/examples/ai_offline_weave_brief.html", 1000, True, 2600),
    ("architecture", "docs/architecture.svg", 1600, False, 1000),
]
PDFS = [
    (f"outputs/briefs/{D}_weave.html", f"outputs/pdf/{D}_weave_brief.pdf"),
    (f"outputs/briefs/{D}_podium.html", f"outputs/pdf/{D}_podium_brief.pdf"),
    (f"outputs/briefs/{D}_market.html", f"outputs/pdf/{D}_market_brief.pdf"),
    (f"outputs/{D}_dashboard.html", f"outputs/pdf/{D}_dashboard.pdf"),
]

only = set(sys.argv[1:])
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    for name, src, w, full, maxh in SHOTS:
        if only and name not in only:
            continue
        f = ROOT / src
        if not f.exists():
            print("skip (missing)", src); continue
        pg = b.new_page(viewport={"width": w, "height": 900 if full else maxh}, device_scale_factor=2)
        pg.goto(f.as_uri()); pg.wait_for_timeout(600)
        h = pg.evaluate("document.documentElement.scrollHeight") if full else maxh
        pg.set_viewport_size({"width": w, "height": min(h, maxh)})
        pg.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
        print("shot", name, w, min(h, maxh)); pg.close()
    if not only:
        (ROOT / "outputs" / "pdf").mkdir(exist_ok=True)
        for src, dst in PDFS:
            pg = b.new_page(); pg.goto((ROOT / src).as_uri()); pg.wait_for_timeout(400)
            pg.pdf(path=str(ROOT / dst), format="Letter", print_background=True, margin={"top": "14mm", "bottom": "14mm", "left": "12mm", "right": "12mm"})
            print("pdf", dst); pg.close()
    b.close()
