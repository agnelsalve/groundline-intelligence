// AI Fact-Checker — Agent 4 from the A2 design ("Scorekeeper").
// A second, independent AI pass reads each claim next to the exact source records it
// cites and rules: supported / partial / unsupported. When a Gemini key is set, the
// checker runs on Gemini so a different model checks Muse Spark's writing.
//
// Two layers:
//   1. Deterministic: a claim citing an id that isn't in the evidence is a fabricated
//      citation → unsupported, no AI needed.
//   2. AI: does the cited evidence actually say this?
// Unsupported claims are removed from the published brief and listed in its
// fact-check log. Groundedness = (supported + ½·partial) / claims checked.
const t0 = Date.now();
const briefs = $input.all().map((i) => i.json).filter((j) => j._type === 'brief');
const VERDICTS = ['supported', 'partial', 'unsupported'];

const CHECKER_SYSTEM = `You are a strict, independent fact-checker. You did NOT write these claims.
For each claim you get the claim text and the source records it cites (title + key fact + source + date).
Rule on what the cited records say — not on what is true in the world:
- "supported": the cited records clearly state or directly imply the claim
- "partial": some of the claim is supported, but part is overstated, generalized, or adds detail not in the records
- "unsupported": the cited records do not back the claim
Recommendations ("Weave should...") are "supported" when the situation they respond to is supported.
Return JSON: {"checks":[{"n": <claim number>, "verdict": "supported|partial|unsupported", "reason": "<=20 words"}]}`;

function claimsOf(b) {
  const out = [];
  (b.sections || []).forEach((s, si) => (s.claims || []).forEach((c, ci) => out.push({ where: `s${si}.${ci}`, section: s.title, text: c.text, cite: c.cite || [] })));
  if (b.archetype_read && b.archetype_read.text) out.push({ where: 'archetype', section: 'Archetype read', text: b.archetype_read.text, cite: b.archetype_read.cite || [] });
  (b.actions || []).forEach((a, ai) => out.push({ where: `a${ai}`, section: 'Actions', text: `${a.action} — ${a.why || ''}`, cite: a.cite || [] }));
  return out;
}

const jobs = briefs.map((b) => async () => {
  const ev = Object.fromEntries(b.evidence.map((e) => [e.id, e]));
  const claims = claimsOf(b.brief);
  for (const c of claims) {
    const known = c.cite.filter((id) => ev[id]);
    c.fabricated_cites = c.cite.filter((id) => !ev[id]);
    if (!known.length) { c.verdict = 'unsupported'; c.reason = 'cites no record from the evidence (fabricated or missing citation)'; c.checked_by = 'rule'; }
  }
  const toCheck = claims.filter((c) => !c.verdict);
  let checker = 'none', check_error = null;
  if (toCheck.length && b.written_by !== 'rules_fallback') {
    const payload = toCheck.map((c, n) => ({ n, claim: c.text,
      cited: c.cite.filter((id) => ev[id]).map((id) => ({ id, title: ev[id].title, key_fact: ev[id].key_fact, source: ev[id].source, date: ev[id].date })) }));
    try {
      const res = await AI.complete({ name: `check:${b.key}`, system: CHECKER_SYSTEM, user: JSON.stringify({ claims: payload }),
        prefer: 'gemini', effort: 'low', maxTokens: 300 + 60 * toCheck.length, timeoutMs: 120000, temperature: 0,
        validate: (d) => (!d || !Array.isArray(d.checks) ? 'missing "checks" array'
          : d.checks.filter((x) => x && VERDICTS.includes(x.verdict)).length < Math.ceil(toCheck.length * 0.8) ? 'a verdict is needed for every claim' : null) });
      checker = `${res.provider}:${res.model}`;
      for (const x of res.data.checks) {
        const c = toCheck[x.n];
        if (c && VERDICTS.includes(x.verdict)) { c.verdict = x.verdict; c.reason = String(x.reason || '').slice(0, 200); c.checked_by = checker; }
      }
    } catch (e) { check_error = `${e.kind || 'error'}: ${String(e.message).slice(0, 160)}`; }
  }
  // Rules-written briefs quote their sources verbatim, so they are supported by construction.
  for (const c of claims) if (!c.verdict) {
    if (b.written_by === 'rules_fallback') { c.verdict = 'supported'; c.reason = 'verbatim source title'; c.checked_by = 'rule'; }
    else { c.verdict = 'unverified'; c.reason = 'fact-checker unavailable'; c.checked_by = 'none'; }
  }
  const checked = claims.filter((c) => c.verdict !== 'unverified');
  const sup = checked.filter((c) => c.verdict === 'supported').length, part = checked.filter((c) => c.verdict === 'partial').length;
  const groundedness = b.written_by === 'rules_fallback' ? null : checked.length ? +((sup + 0.5 * part) / checked.length).toFixed(3) : null;
  // A rules-only brief just lists source titles: nothing to fact-check, and we say so rather than claim 100%.
  const status = b.written_by === 'rules_fallback' ? 'ai_offline'
    : groundedness === null ? 'unverified' : groundedness >= 0.85 ? 'verified' : groundedness >= 0.6 ? 'needs_review' : 'failed';

  // Publish only what survived: drop unsupported claims (kept in the log).
  const keep = new Set(claims.filter((c) => c.verdict !== 'unsupported').map((c) => c.where));
  const verdictOf = Object.fromEntries(claims.map((c) => [c.where, c.verdict]));
  const published = { ...b.brief,
    sections: (b.brief.sections || []).map((s, si) => ({ ...s, claims: (s.claims || []).map((c, ci) => ({ ...c, verdict: verdictOf[`s${si}.${ci}`] }))
      .filter((c, ci) => keep.has(`s${si}.${ci}`)) })).filter((s) => s.claims.length),
    archetype_read: b.brief.archetype_read && keep.has('archetype') ? { ...b.brief.archetype_read, verdict: verdictOf.archetype } : null,
    actions: (b.brief.actions || []).map((a, ai) => ({ ...a, verdict: verdictOf[`a${ai}`] })).filter((a, ai) => keep.has(`a${ai}`)),
  };
  return { ...b, published, fact_check: { checker, check_error, status, groundedness, claims_total: claims.length,
    supported: sup, partial: part, unsupported: claims.filter((c) => c.verdict === 'unsupported').length,
    unverified: claims.length - checked.length, fabricated_citations: claims.reduce((n, c) => n + c.fabricated_cites.length, 0), log: claims } };
});

const out = await AI.pool(jobs, 3);
return [
  ...out.map((b) => ({ json: { _type: 'brief', ...b } })),
  { json: { _type: 'ai_run', step: 'fact_checker', ai: AI.summary(), duration_ms: Date.now() - t0 } },
];
