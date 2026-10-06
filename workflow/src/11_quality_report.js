// Quality report — the run's numbers, as JSON (for machines) and Markdown (for people).
const cfg = $('Run config').first().json;
const all = $input.all().map((i) => i.json);
const status = all.filter((j) => j._type === 'status');
const recs = all.filter((j) => j._type === 'record');
const kept = recs.filter((r) => r._status === 'kept');
const rejected = recs.filter((r) => r._status === 'rejected');
const trimmed = recs.filter((r) => r._status === 'trimmed');

const count = (arr, key) => arr.reduce((m, r) => ((m[r[key]] = (m[r[key]] || 0) + 1), m), {});
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

const collected = recs.length;
const duplicates = rejected.filter((r) => r._reason.startsWith('duplicate')).length;
const qualityFails = rejected.length - duplicates;
const unique = collected - duplicates;

const ENRICH = ['summary', 'author'];
const fieldFill = Object.fromEntries(
  ['record_id', 'title', 'url', 'published_date', 'source_name', 'topic', 'summary', 'author']
    .map((f) => [f, pct(kept.filter((r) => r[f] !== '' && r[f] != null).length, kept.length)])
);
const fullyComplete = kept.filter((r) => ENRICH.every((f) => r[f])).length;

// Per-source table: what each feed returned and what survived
const perFeed = {};
for (const s of status) perFeed[s.feed_id] = { source_type: s.source_type, status: s.status, message: s.message, fetched: s.fetched, kept: 0, rejected: 0, trimmed: 0 };
for (const r of recs) {
  const f = perFeed[r.collected_via] || (perFeed[r.collected_via] = { source_type: r.source_type, status: 'ok', message: '', fetched: 0, kept: 0, rejected: 0, trimmed: 0 });
  f[r._status]++;
}

const dates = kept.map((r) => r.published_date).sort();
const checks = [
  ['Every kept record has title, URL, source and date', kept.every((r) => r.title && r.url && r.source_name && r.published_date)],
  ['Every date is YYYY-MM-DD', kept.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.published_date))],
  ['No date in the future', kept.every((r) => Date.parse(r.published_at_utc) <= Date.parse(cfg.collected_at) + 86400000)],
  ['No duplicate record IDs', new Set(kept.map((r) => r.record_id)).size === kept.length],
  ['No duplicate URLs', new Set(kept.map((r) => r.url)).size === kept.length],
  ['Every record has a topic', kept.every((r) => r.topic)],
  ['At least 3 source systems contributed', new Set(kept.map((r) => r.source_type)).size >= 3],
  ['Record count within 50–400 target', kept.length >= 50 && kept.length <= 400],
].map(([check, pass]) => ({ check, pass }));

const report = {
  run_id: cfg.run_id,
  collected_at: cfg.collected_at,
  window: { lookback_days: cfg.lookback_days, since: cfg.since_iso.slice(0, 10), until: cfg.run_date },
  totals: {
    collected, duplicates_removed: duplicates, failed_quality_checks: qualityFails,
    unique_records: unique, trimmed_for_balance: trimmed.length, kept: kept.length,
    quality_pass_rate_pct: pct(unique - qualityFails, unique),
    fully_complete_records: fullyComplete, fully_complete_pct: pct(fullyComplete, kept.length),
  },
  kept_by: {
    source_type: count(kept, 'source_type'), focus: count(kept, 'focus'),
    topic: count(kept, 'topic'), signal_type: count(kept, 'signal_type'),
  },
  field_completeness_pct: fieldFill,
  date_range: { earliest: dates[0] || null, latest: dates[dates.length - 1] || null },
  rejects_by_reason: count(rejected, '_reason'),
  trimmed_by_reason: count(trimmed, '_reason'),
  sources: perFeed,
  checks,
  all_checks_passed: checks.every((c) => c.pass),
};

// ---------- Markdown ----------
const t = report.totals;
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');
const obj = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);

const md = `# Groundline — Data Quality Report

**Run:** \`${cfg.run_id}\` · **Collected:** ${cfg.collected_at.slice(0, 16).replace('T', ' ')} UTC · **Window:** ${report.window.since} → ${report.window.until} (${cfg.lookback_days} days)

## Summary

${table(['Metric', 'Value'], [
  ['Records collected (all sources)', t.collected],
  ['Duplicates removed', t.duplicates_removed],
  ['Unique records', t.unique_records],
  ['Failed a quality check', t.failed_quality_checks],
  ['**Quality pass rate** (unique records passing every check)', `**${t.quality_pass_rate_pct}%**`],
  ['Trimmed for balance (passed, but over a per-feed cap)', t.trimmed_for_balance],
  ['**Records in final dataset**', `**${t.kept}**`],
  ['Records with every optional field (summary + author)', `${t.fully_complete_records} (${t.fully_complete_pct}%)`],
  ['Date range of kept records', `${report.date_range.earliest} → ${report.date_range.latest}`],
])}

## Automated checks

${table(['Check', 'Result'], checks.map((c) => [c.check, c.pass ? '✅ pass' : '❌ fail']))}

## Sources

${table(['Feed', 'Type', 'Status', 'Fetched', 'Kept', 'Rejected', 'Trimmed', 'Note'],
  Object.entries(perFeed).map(([k, v]) => [`\`${k}\``, v.source_type, v.status === 'ok' ? '🟢 ok' : v.status === 'empty' ? '🟡 empty' : '🔴 unavailable', v.fetched, v.kept, v.rejected, v.trimmed, v.message || '']))}

## Field completeness (kept records)

${table(['Field', 'Filled'], Object.entries(fieldFill).map(([k, v]) => [`\`${k}\``, `${v}%`]))}

Critical fields (title, URL, date, source) are enforced at 100%. \`summary\` and \`author\` are optional: Hacker News stories have no summary, and many news feeds omit the author.

## Why records were rejected

${table(['Reason', 'Count'], obj(report.rejects_by_reason).map(([k, v]) => [`\`${k}\``, v]))}

${trimmed.length ? `Trimmed for balance: ${obj(report.trimmed_by_reason).map(([k, v]) => `\`${k}\` ${v}`).join(', ')}.` : ''}

## Dataset composition

${table(['By focus', 'Records'], obj(report.kept_by.focus))}

${table(['By source type', 'Records'], obj(report.kept_by.source_type))}

${table(['By topic', 'Records'], obj(report.kept_by.topic))}

${table(['By signal type', 'Records'], obj(report.kept_by.signal_type))}
`;

return [{ json: { report_json: JSON.stringify(report, null, 2), markdown: md, all_checks_passed: report.all_checks_passed, kept: kept.length } }];
