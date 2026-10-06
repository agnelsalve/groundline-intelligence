"""Build the three n8n workflow exports from the sources in workflow/src and workflow/lib.

The JavaScript for every Code node lives in its own file so it can be read, diffed
and reviewed on GitHub. Shared logic (the AI client, the Analyst, the HTML kit)
lives in workflow/lib and is pasted into each node that needs it, so the main
workflow and the scale-test API run identical code.

    python scripts/build_workflow.py

Writes:
    workflow/workflow_v2.json       main pipeline: collect → AI judge → route/alert → brief → fact-check → deliver
    workflow/error_handler.json     error workflow: emails + logs any failed execution
    workflow/analyze_api.json       POST /webhook/groundline/analyze — the Analyst as an API (scale testing)
"""
import json
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "workflow" / "src"
LIB = ROOT / "workflow" / "lib"
OUT = ROOT / "workflow"

MAIN_ID, ERROR_ID, API_ID = "GroundlineV2Main", "GroundlineErrHnd", "GroundlineApiV2x"
SMTP = {"smtp": {"id": "GroundlineSmtp01", "name": "Groundline Gmail (SMTP)"}}
DATA = "{{ $('Run config').first().json.data_dir }}"

ARXIV_URL = (
    "https://export.arxiv.org/api/query?search_query="
    "%28abs:%22retrieval-augmented%22+OR+abs:%22LLM+agents%22+OR+abs:%22AI+agents%22%29"
    "+AND+%28abs:hallucination+OR+abs:grounding+OR+abs:faithfulness+OR+abs:groundedness%29"
    "&sortBy=submittedDate&sortOrder=descending&max_results=35"
)

# Fetch nodes never stop the run: retry 3x, then emit an error item that the
# normalizer turns into a "source unavailable" status row.
RESILIENT = {"retryOnFail": True, "maxTries": 3, "waitBetweenTries": 2000, "alwaysOutputData": True, "onError": "continueRegularOutput"}
# Email never stops the run either: 3 tries, then the failure is recorded in the run metrics.
EMAIL_SAFE = {"retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000, "onError": "continueRegularOutput"}


def lib(*names):
    return "".join((LIB / f"{n}.js").read_text(encoding="utf-8") + "\n" for n in names)


class Flow:
    def __init__(self):
        self.nodes, self.connections = [], {}

    def code(self, name, file, pos, notes="", libs=(), replace=None, **extra):
        js = (SRC / file).read_text(encoding="utf-8")
        for k, v in (replace or {}).items():
            js = js.replace(k, v)
        node = {"parameters": {"jsCode": lib(*libs) + js}, "name": name, "type": "n8n-nodes-base.code",
                "typeVersion": 2, "position": pos, **extra}
        if notes:
            node["notes"], node["notesInFlow"] = notes, True
        self.nodes.append(node)

    def node(self, name, type_, version, pos, params, notes="", **extra):
        n = {"parameters": params, "name": name, "type": type_, "typeVersion": version, "position": pos, **extra}
        if notes:
            n["notes"], n["notesInFlow"] = notes, True
        self.nodes.append(n)

    def link(self, src, dst, dst_index=0, src_output=0):
        outputs = self.connections.setdefault(src, {"main": []})["main"]
        while len(outputs) <= src_output:
            outputs.append([])
        outputs[src_output].append({"node": dst, "type": "main", "index": dst_index})

    def sticky(self, name, content, pos, width, height, color):
        self.nodes.append({"parameters": {"content": content, "width": width, "height": height, "color": color},
                           "name": name, "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": pos})

    def write_items(self, name, pos, source, prop="data", notes=""):
        """Write each incoming item's binary to the path in its json.file_path."""
        self.node(name, "n8n-nodes-base.readWriteFile", 1, pos,
                  {"operation": "write", "fileName": "={{ $json.file_path }}", "dataPropertyName": prop, "options": {}}, notes)
        self.link(source, name)

    def email(self, name, pos, source, notes="", attachments=False):
        options = {"appendAttribution": False}
        if attachments:
            options["attachments"] = "={{ $json.attachments }}"
        self.node(name, "n8n-nodes-base.emailSend", 2.1, pos,
                  {"fromEmail": "={{ $env.GMAIL_ADDRESS }}", "toEmail": "={{ $env.ALERT_EMAIL_TO || $env.GMAIL_ADDRESS }}",
                   "subject": "={{ $json.subject }}", "emailFormat": "html", "html": "={{ $json.html }}", "options": options},
                  notes, credentials=SMTP, **EMAIL_SAFE)
        self.link(source, name)

    def save(self, file, wf_id, name, settings=None):
        wf = {"id": wf_id, "name": name, "nodes": self.nodes, "connections": self.connections,
              "settings": {"executionOrder": "v1", **(settings or {})}, "pinData": {}, "active": False, "tags": []}
        (OUT / file).write_text(json.dumps(wf, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        real = [n for n in self.nodes if "stickyNote" not in n["type"]]
        print(f"Wrote workflow/{file} ({len(real)} nodes)")


# =============================================================================== main
m = Flow()


def looped_fetch(prefix, list_node, fetch_name, fetch_type, fetch_version, fetch_params, normalize, x, y):
    """List -> Loop (1 at a time) -> Fetch -> Tag -> back to Loop; Loop 'done' -> Normalize."""
    loop, tag = f"Loop {prefix}", f"Tag {prefix} source"
    m.node(loop, "n8n-nodes-base.splitInBatches", 3, [x, y], {"batchSize": 1, "options": {}})
    m.node(fetch_name, fetch_type, fetch_version, [x + 220, y + 120], fetch_params, **RESILIENT)
    tag_code = (SRC / "04b_tag_with_source.js").read_text(encoding="utf-8").replace("__LIST__", list_node)
    m.nodes.append({"parameters": {"jsCode": tag_code}, "name": tag, "type": "n8n-nodes-base.code",
                    "typeVersion": 2, "position": [x + 440, y + 120]})
    m.link(list_node, loop)
    m.link(loop, normalize, src_output=0)
    m.link(loop, fetch_name, src_output=1)
    m.link(fetch_name, tag)
    m.link(tag, loop)


def to_file_and_write(prefix, pos, convert_params, path, source):
    x, y = pos
    m.node(f"{prefix} → file", "n8n-nodes-base.convertToFile", 1.1, [x, y], convert_params)
    m.node(f"Write {prefix}", "n8n-nodes-base.readWriteFile", 1, [x + 240, y], {"operation": "write", "fileName": "=" + path, "options": {}})
    m.link(source, f"{prefix} → file")
    m.link(f"{prefix} → file", f"Write {prefix}")


# ---------------------------------------------------------------- sticky notes
m.sticky("Note: title",
         "## Groundline v2 — Brand Intelligence Agent\n**INFO 7375 Branding & AI · Northeastern · Fall 2026 · Assignment 4**\n\n"
         "A3 collected the data. v2 **thinks about it**: Muse Spark judges every record, routes risks and openings to "
         "alerts, writes cited briefs on Weave and its competitors, and a second AI pass **fact-checks every claim** "
         "before anything is sent.\n\n**Run:** *Execute workflow* (or weekly, Monday 07:00). Output → `outputs/` + Gmail",
         [-460, -340], 600, 280, 7)
sticky_collect = ("### ① Collect (A3, extended)\n**News RSS** incl. Weave **competitors** (Podium, Birdeye, NexHealth…) and "
                  "**Reddit** practice owners · **arXiv** · **Hacker News** · **NewsAPI** (optional)\n\n"
                  "Every fetch retries 3× and never stops the run.")
m.sticky("Note: collect", sticky_collect, [220, -120], 1000, 1100, 5)
m.sticky("Note: clean", "### ② Validate → Dedupe (A3)\nRejects records missing title / URL / source / date, bad dates, "
         "off-topic items and duplicates. Every rejection keeps its reason.", [1250, 200], 460, 480, 4)
m.sticky("Note: save", "### ③ Save clean data (A3)\nDataset, quality report, rejects log, raw snapshot.", [1700, -120], 780, 1060, 6)
m.sticky("Note: judge", "### ④ AI judges every record — Muse Spark\nCache → batches of 10 → 3 in parallel.\n"
         "Retries with backoff, Gemini backup, JSON repair, circuit breaker; anything the AI can't judge falls back to "
         "A3's keyword rules **and is labelled**.", [2520, -340], 680, 300, 3)
m.sticky("Note: route", "### ⑤ Decide → act\nHigh risk to Weave → **risk alert email**.\nCompetitor stumble → "
         "**opportunity email**.\nEverything else → weekly brief. Repeat alerts are suppressed.", [3240, -340], 860, 300, 2)
m.sticky("Note: brief", "### ⑥ Write → fact-check → deliver\nMuse Spark writes cited briefs (numbers computed, not generated). "
         "An **independent AI fact-checker** rules on every claim against its sources; unsupported claims are removed. "
         "HTML briefs, dashboard, CSV, chart, and the weekly email.", [2520, 380], 1980, 300, 4)

# ---------------------------------------------------------------- triggers + config
m.node("Start", "n8n-nodes-base.manualTrigger", 1, [-200, 360], {})
m.node("Every Monday 07:00", "n8n-nodes-base.scheduleTrigger", 1.2, [-200, 520],
       {"rule": {"interval": [{"field": "weeks", "triggerAtDay": [1], "triggerAtHour": 7}]}})
m.code("Run config", "01_run_config.js", [20, 420], "windows · output folders")
m.link("Start", "Run config")
m.link("Every Monday 07:00", "Run config")

# ---------------------------------------------------------------- collect (A3 + v2 feeds)
m.code("RSS feed list", "02_rss_feeds.js", [260, 60], "11 feeds: AI desks, Weave, 3 competitor searches, Reddit")
m.code("Normalize RSS", "05_normalize_rss.js", [1000, 60])
looped_fetch("RSS", "RSS feed list", "Fetch RSS feed", "n8n-nodes-base.rssFeedRead", 1.2,
             {"url": "={{ $json.url }}", "options": {}}, "Normalize RSS", 480, 60)
m.link("Run config", "RSS feed list")

m.node("Fetch arXiv papers", "n8n-nodes-base.httpRequest", 4.2, [480, 340],
       {"url": ARXIV_URL, "sendHeaders": True,
        "headerParameters": {"parameters": [{"name": "User-Agent", "value": "groundline-intelligence/2.0 (INFO 7375 coursework)"}]},
        "options": {"timeout": 30000, "response": {"response": {"responseFormat": "text"}}}},
       "RAG / agents × hallucination / grounding", **{**RESILIENT, "waitBetweenTries": 5000})
m.code("Normalize arXiv", "06_normalize_arxiv.js", [1000, 340])
m.link("Run config", "Fetch arXiv papers")
m.link("Fetch arXiv papers", "Normalize arXiv")

m.code("HN query list", "03_hn_queries.js", [260, 560], "5 searches · >20 points")
m.code("Normalize HN", "07_normalize_hn.js", [1000, 560])
looped_fetch("HN", "HN query list", "Fetch Hacker News", "n8n-nodes-base.httpRequest", 4.2,
             {"url": "={{ $json.url }}", "options": {"timeout": 20000}}, "Normalize HN", 480, 560)
m.link("Run config", "HN query list")

m.code("NewsAPI query list", "04_newsapi_queries.js", [260, 820], "Optional · key from .env")
m.code("Normalize NewsAPI", "08_normalize_newsapi.js", [1000, 820])
looped_fetch("NewsAPI", "NewsAPI query list", "Fetch NewsAPI", "n8n-nodes-base.httpRequest", 4.2,
             {"url": "={{ $json.url }}", "sendHeaders": True,
              "headerParameters": {"parameters": [{"name": "X-Api-Key", "value": "={{ $env.NEWSAPI_KEY || 'not-set' }}"},
                                                  {"name": "User-Agent", "value": "groundline-intelligence/2.0"}]},
              "options": {"timeout": 20000}}, "Normalize NewsAPI", 480, 820)
m.link("Run config", "NewsAPI query list")

m.node("Merge sources", "n8n-nodes-base.merge", 3.2, [1300, 440], {"numberInputs": 4})
for i, s in enumerate(["Normalize RSS", "Normalize arXiv", "Normalize HN", "Normalize NewsAPI"]):
    m.link(s, "Merge sources", i)
m.code("Validate & clean", "09_validate_clean.js", [1520, 440], "required fields · dates · topic · dedupe")
m.link("Merge sources", "Validate & clean")

m.code("Final dataset", "10_final_dataset.js", [1760, 100], "kept records + post-checks")
m.code("Quality report", "11_quality_report.js", [1760, 400])
m.code("Rejects log", "12_rejects_log.js", [1760, 640])
m.code("Raw snapshot", "13_raw_snapshot.js", [1760, 820])
m.link("Validate & clean", "Final dataset")
m.link("Validate & clean", "Quality report")
m.link("Validate & clean", "Rejects log")
m.link("Merge sources", "Raw snapshot")

to_file_and_write("Dataset CSV", [2000, 20], {"operation": "csv", "options": {"fileName": "groundline_dataset.csv"}},
                  DATA + "/clean/groundline_dataset.csv", "Final dataset")
to_file_and_write("Dataset JSON", [2000, 180], {"operation": "toJson", "mode": "once", "options": {"format": True, "fileName": "groundline_dataset.json"}},
                  DATA + "/clean/groundline_dataset.json", "Final dataset")
to_file_and_write("Report MD", [2000, 340], {"operation": "toText", "sourceProperty": "markdown", "options": {"fileName": "quality_report.md"}},
                  DATA + "/clean/quality_report.md", "Quality report")
to_file_and_write("Report JSON", [2000, 480], {"operation": "toText", "sourceProperty": "report_json", "options": {"fileName": "quality_report.json"}},
                  DATA + "/clean/quality_report.json", "Quality report")
to_file_and_write("Rejects CSV", [2000, 640], {"operation": "csv", "options": {"fileName": "rejects_log.csv"}},
                  DATA + "/clean/rejects_log.csv", "Rejects log")
to_file_and_write("Raw JSON", [2000, 820], {"operation": "toText", "sourceProperty": "snapshot_json", "options": {"fileName": "raw.json"}},
                  DATA + "/raw/{{ $('Raw snapshot').first().json.file_name }}", "Raw snapshot")

# ---------------------------------------------------------------- ④ AI judge (v2)
m.node("Read cache file", "n8n-nodes-base.readWriteFile", 1, [2560, -180],
       {"operation": "read", "fileSelector": "=" + DATA + "/cache/analysis_cache.json", "options": {}},
       "missing cache = cold start, not an error", executeOnce=True, alwaysOutputData=True, onError="continueRegularOutput")
m.code("Load cache", "20_load_cache.js", [2780, -180])
m.code("AI Analyst", "21_ai_analyst.js", [3000, -180], "Muse Spark · relevance, sentiment, risk, archetype", libs=("ai_client", "analyst_core"))
m.link("Final dataset", "Read cache file")
m.link("Read cache file", "Load cache")
m.link("Load cache", "AI Analyst")

# ---------------------------------------------------------------- ⑤ decide → act
rule = lambda key, label: {  # noqa: E731
    "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                   "conditions": [{"id": str(uuid.uuid5(uuid.NAMESPACE_URL, key)), "leftValue": "={{ $json.route }}", "rightValue": key,
                                   "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
    "renameOutput": True, "outputKey": label}
m.node("Route by AI decision", "n8n-nodes-base.switch", 3.2, [3280, -200],
       {"rules": {"values": [rule("urgent_risk", "Urgent risk"), rule("opportunity", "Opportunity")]},
        "options": {"fallbackOutput": "extra", "renameFallbackOutput": "Weekly brief only"}},
       "urgent_risk · opportunity · digest")
m.link("AI Analyst", "Route by AI decision")
for i, (kind, label) in enumerate([("urgent_risk", "risk"), ("opportunity", "opportunity")]):
    y = -260 + i * 200
    m.code(f"Compose {label} alert", "22_compose_alert.js", [3540, y], "new items only", libs=("render_kit",), replace={"__KIND__": kind})
    m.link("Route by AI decision", f"Compose {label} alert", src_output=i)
    m.email(f"Send {label} alert", [3780, y - 60], f"Compose {label} alert", "Gmail · 3 tries")
    m.write_items(f"Save {label} alert", [3780, y + 70], f"Compose {label} alert")

# ---------------------------------------------------------------- ⑥ write → check → deliver
m.code("AI Brief Writer", "23_brief_writer.js", [2780, 480], "Muse Spark · cited briefs", libs=("ai_client", "render_kit"))
m.code("AI Fact-Checker", "24_fact_checker.js", [3000, 480], "independent check of every claim", libs=("ai_client",))
m.code("Render reports", "25_render_reports.js", [3220, 480], "HTML · dashboard · CSV · chart", libs=("render_kit",))
m.write_items("Write report files", [3440, 400], "Render reports")
m.code("Compose digest email", "26_compose_digest.js", [3660, 480], libs=("render_kit",))
m.write_items("Save email copy", [3880, 400], "Compose digest email", prop="preview")
m.email("Send weekly digest", [3880, 560], "Compose digest email", "Gmail · brief + attachments", attachments=True)
m.code("Run metrics", "27_run_metrics.js", [4100, 560], "cost · tokens · delivery · cache")
m.write_items("Write run files", [4320, 560], "Run metrics")
m.link("AI Analyst", "AI Brief Writer")
m.link("AI Brief Writer", "AI Fact-Checker")
m.link("AI Fact-Checker", "Render reports")
m.link("Write report files", "Compose digest email")
m.link("Send weekly digest", "Run metrics")

m.save("workflow_v2.json", MAIN_ID, "Groundline v2 — Brand Intelligence Agent (INFO 7375 A4)", {"errorWorkflow": ERROR_ID})

# =============================================================================== error handler
e = Flow()
e.sticky("Note", "## Groundline — error handler\nSet as the *Error workflow* of the main pipeline and the API. "
         "Any execution that fails outright sends an email and writes `data/runs/errors/error_<time>.json`.", [-40, -220], 520, 180, 3)
e.node("When a Groundline run fails", "n8n-nodes-base.errorTrigger", 1, [0, 60], {})
e.code("Format error", "30_error_format.js", [240, 60])
e.email("Email the failure", [480, -40], "Format error", "Gmail")
e.write_items("Write error log", [480, 140], "Format error")
e.link("When a Groundline run fails", "Format error")
e.save("error_handler.json", ERROR_ID, "Groundline — Error handler")

# =============================================================================== analyze API
a = Flow()
a.sticky("Note", "## Groundline — Analyze API\n`POST /webhook/groundline/analyze` with `{\"records\":[…]}` → the AI Analyst's "
         "judgement for each record. Same code as the main workflow. Used by `scripts/scale_test.mjs`.", [-40, -220], 560, 180, 5)
a.node("POST /groundline/analyze", "n8n-nodes-base.webhook", 2, [0, 60],
       {"httpMethod": "POST", "path": "groundline/analyze", "responseMode": "responseNode", "options": {}},
       webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, "groundline-analyze")))
a.code("AI Analyst (API)", "31_api_analyze.js", [240, 60], "validates input · same Analyst logic", libs=("ai_client", "analyst_core"))
a.node("Respond", "n8n-nodes-base.respondToWebhook", 1.1, [480, 60],
       {"respondWith": "json", "responseBody": "={{ JSON.stringify($json.response) }}", "options": {"responseCode": "={{ $json.status }}"}})
a.link("POST /groundline/analyze", "AI Analyst (API)")
a.link("AI Analyst (API)", "Respond")
a.save("analyze_api.json", API_ID, "Groundline — Analyze API (scale test)", {"errorWorkflow": ERROR_ID})
