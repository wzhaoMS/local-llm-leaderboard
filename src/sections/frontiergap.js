/* Frontier gap (data: D.frontierGap): our private suites are saturated, so the cloud references and our local setups also
   take two public hard benchmarks on the same harness, ARC-AGI-2 and AA-Omniscience. One card per benchmark: a bar per run
   (score with its 95% interval), partial runs lighter, queued runs as placeholders, and the gap between the best complete
   cloud run and the best complete local run. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, fmt, isNum } = LB;
  const D = LB.data || {};
  const MINUS = "\u2212";
  const KNOWN = { arc_agi2: "ARC-AGI-2", omniscience: "AA-Omniscience" };
  // Disclosures required by the plan review: they stay visible under the results.
  const NOTES = [
    "Public sets: the tasks and questions are online, so a model may have seen them in training.",
    "AA-Omniscience here is a code-graded short-answer subset (100 questions, 5 per prompt), not the official " +
      "300-question run graded by an LLM judge.",
    "Cloud models ran at effort high (the Copilot CLI drops replies after about 10 minutes); local models at xhigh on " +
      "ARC-AGI-2 (65,536-token budget; tasks that hit it may be rerun with a larger one, listed under the model's bar) " +
      "and medium on AA-Omniscience.",
    "Timeouts, errors and cut-off replies count as wrong, and each model lists its own under its bar.",
  ];

  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
  const objs = (v) => (Array.isArray(v) ? v.filter((x) => obj(x)) : []);
  const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : []);
  const num = (v) => (isNum(v) ? v : null);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const at = (v) => Math.max(0, Math.min(100, v)).toFixed(2) + "%";
  /** Whole number with a real minus sign. */
  const int = (v) => { const r = Math.round(v); return (r < 0 ? MINUS : "") + Math.abs(r); };
  const pct = (v) => (isNum(v) ? int(v) + "%" : "—");
  const amount = (v) => (Number.isInteger(v) ? fmt.int(v) : fmt.num(v, 1));
  const plural = (n, one, many) => `${amount(n)} ${n === 1 ? one : many || one + "s"}`;
  const secs = (v) => (v >= 100 ? fmt.int(v) : fmt.num(v, 1)) + " s";
  const linkOf = (u) => (/^https?:\/\/\S+$/i.test(str(u)) ? str(u) : null);
  const byId = (id) => (id && Array.isArray(D.models) ? LB.byId(id) || null : null);
  const join = (parts, sep) => parts.flatMap((p, i) => (i ? [sep, p] : [p]));
  const icon = (d, size = 14) => s("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor",
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d }));
  const infoIcon = () => icon("M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM8 7.4v3.8M8 5.1v.1");
  const clockIcon = () => icon("M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM8 4.7V8l2.3 1.5", 13);
  const sr = (t) => h("span", { class: "fg-sr" }, t);
  const pulse = () => h("i", { class: "fg-pulse", "aria-hidden": "true" });
  const ext = (url, text) => h("a", { class: "fg-link", href: url, target: "_blank", rel: "noopener" }, text, sr(" (opens in a new tab)"));

  // ---------- data ----------
  function benchList(FG, runs, queued) {
    const seen = new Set();
    const listed = objs(FG.benchmarks).map((b) => ({
      key: str(b.key), name: str(b.name) || KNOWN[str(b.key)] || str(b.key),
      items: isNum(b.items) && b.items > 0 ? b.items : null, unit: str(b.unit), about: str(b.about), url: linkOf(b.url), source: str(b.source),
    })).filter((b) => b.key && !seen.has(b.key) && seen.add(b.key));
    if (listed.length) return listed;
    // no benchmark list: one card per benchmark the runs have results for or are queued on
    const keys = [];
    for (const x of runs) for (const k of Object.keys(x.results)) if (!keys.includes(k)) keys.push(k);
    for (const q of queued) if (q.benchmark && !keys.includes(q.benchmark)) keys.push(q.benchmark);
    return keys.map((k) => ({ key: k, name: KNOWN[k] || k, items: null, unit: "", about: "", url: null, source: "" }));
  }
  function runOf(r) {
    const bm = byId(str(r.model));
    return {
      id: str(r.id),
      board: r.onBoard === true ? bm : null,
      name: str(r.name) || (bm && bm.name) || str(r.model) || "Unnamed model",
      variant: str(r.variant),
      vendor: str(r.vendor) || (bm && bm.vendor) || "",
      local: typeof r.local === "boolean" ? r.local : !(bm && bm.reference),
      where: str(r.where) || (bm && str(bm.where)) || "",
      running: r.running === true,
      results: obj(r.results) || {},
    };
  }
  /** One benchmark a run still has to do (`benchmark` missing = every card); what it lacks comes from the run with its id. */
  function queuedOf(q, runs) {
    const id = str(q.id);
    const run = id ? runs.find((x) => x.id === id) || null : null;
    const bm = byId(str(q.model));
    return {
      id, benchmark: str(q.benchmark),
      board: q.onBoard === false ? null : run ? run.board : bm,
      name: str(q.name) || (run && run.name) || (bm && bm.name) || str(q.model) || "Unnamed model",
      variant: str(q.variant) || (run && run.variant) || "",
      vendor: str(q.vendor) || (run && run.vendor) || (bm && bm.vendor) || "",
      local: typeof q.local === "boolean" ? q.local : run ? run.local : !(bm && bm.reference),
      where: str(q.where) || (run && run.where) || (bm && str(bm.where)) || "",
      running: q.status === "running",
      queued: true,
      results: {},
    };
  }
  function resultOf(x, b) {
    const r = obj(x.results[b.key]);
    if (!r) return null;
    const n = num(r.n);
    const ci = Array.isArray(r.ci) && isNum(r.ci[0]) && isNum(r.ci[1]) ? [Math.min(r.ci[0], r.ci[1]), Math.max(r.ci[0], r.ci[1])] : null;
    return {
      n, score: num(r.score), ci,
      complete: typeof r.complete === "boolean" ? r.complete : n !== null && b.items !== null && n >= b.items,
      solved: num(r.solved), correct: num(r.correct), incorrect: num(r.incorrect), idk: num(r.idk), index: num(r.index),
      effort: str(r.effort), other: num(r.otherEffort), errors: num(r.errors), truncated: num(r.truncated),
      rerun: obj(r.rerunBudget) && num(r.rerunBudget.n) && num(r.rerunBudget.tokens)
        ? { n: num(r.rerunBudget.n), tokens: num(r.rerunBudget.tokens) } : null,
      seconds: num(r.medianSeconds), tokens: num(r.medianTokens),
    };
  }
  /** Published numbers for a benchmark (e.g. the ARC Prize leaderboard), matched to runs by model name. */
  function refOf(FG, b) {
    const R = obj(FG.reference) && obj(FG.reference[b.key]);
    const scores = R && obj(R.scores);
    if (!scores) return null;
    const map = new Map();
    for (const [k, v] of Object.entries(scores)) if (str(k) && isNum(v)) map.set(str(k).toLowerCase(), v);
    return map.size ? { label: str(R.label) || "Published leaderboard", url: linkOf(R.url), of: (name) => num(map.get(name.toLowerCase())) } : null;
  }
  /** Best text core per side, from the same pools as Max vs max (max-effort runs once none is pending), so the numbers match. */
  function saturation() {
    const ME = obj(D.maxEffort) || {};
    const pend = obj(ME.pending) || {};
    const ms = (Array.isArray(D.models) ? D.models : []).filter((m) => m && m.scores && isNum(m.scores.textCore));
    const best = (cloud) => {
      const side = ms.filter((m) => !!m.reference === cloud);
      const ids = new Set(strs(cloud ? ME.cloud : ME.local));
      const maxed = side.filter((m) => ids.has(m.id));
      const pool = maxed.length && !strs(cloud ? pend.cloud : pend.local).length ? maxed : side;
      return { v: pool.length ? Math.max(...pool.map((m) => m.scores.textCore)) : null, maxed: pool === maxed };
    };
    const l = best(false), c = best(true);
    return { local: l.v, cloud: c.v, maxed: l.maxed && c.maxed };
  }

  // ---------- atoms ----------
  const fullName = (x) => x.name + (x.variant ? " · " + x.variant : "");
  function vendorOf(x) {
    try { return LB.vendor(x.vendor); } catch (err) { return { name: "", color: "#94a3b8" }; }
  }
  /** Vendor badge; cloud runs get the dashed outline they have elsewhere on the page. */
  function badgeOf(x, size) {
    let b;
    try { b = LB.mono(x.vendor, size); } catch (err) {
      b = h("span", { class: "lb-mono", style: { width: size + "px", height: size + "px", fontSize: Math.round(size * 0.46) + "px" } }, "?");
    }
    if (!x.local) b.classList.add("fg-dash");
    return b;
  }
  function nameOf(x) {
    return h("span", { class: "fg-name" }, h("b", {}, x.name), x.variant ? h("span", { class: "fg-variant" }, x.variant) : null,
      h("span", { class: ["fg-tag", x.local ? "fg-tag-local" : "fg-tag-cloud"] }, x.local ? "this PC" : "cloud"));
  }
  const whoLine = (x) => [x.vendor ? vendorOf(x).name : "", x.where || (x.local ? "This PC" : "Cloud (GitHub Copilot)")].filter(Boolean).join(" · ");
  const progress = (b, r) => (r.n === null ? "partial run" : `${amount(r.n)}${b.items ? " of " + amount(b.items) : ""} so far`);
  /** One tooltip per row; the content follows the element under the pointer (the reference tick has its own). */
  function hover(el, html) {
    el.addEventListener("mouseover", (e) => LB.tip.show(e, html(e.target)));
    el.addEventListener("mousemove", LB.tip.move);
    el.addEventListener("mouseleave", LB.tip.hide);
  }
  function issuesOf(r) {
    return [r.errors ? plural(r.errors, "error") : null, r.truncated ? amount(r.truncated) + " cut off" : null,
      r.other ? amount(r.other) + " retried at another effort" : null,
      r.rerun ? `${amount(r.rerun.n)} rerun at ${amount(r.rerun.tokens)} tokens` : null].filter(Boolean);
  }
  function rowTip(b, x, r, ref, refV) {
    const ci = r.ci ? ` <span class="muted">[95% CI ${Math.round(r.ci[0])}–${Math.round(r.ci[1])}]</span>` : "";
    let body = `${esc(b.name)} <b>${pct(r.score)}</b>${ci}` + (isNum(r.index) ? ` · index <b>${int(r.index)}</b>` : "");
    const counts = r.correct !== null
      ? [`${amount(r.correct)} right`, r.incorrect !== null ? `${amount(r.incorrect)} wrong` : null,
        r.idk !== null ? `${amount(r.idk)} “I don't know”` : null].filter(Boolean).join(" · ")
      : r.solved !== null && r.n !== null ? `${amount(r.solved)} of ${amount(r.n)} solved` : "";
    if (counts) body += "<br>" + counts;
    if (!r.complete) body += `<br><span class="muted">Partial run: ${progress(b, r)}${x.running ? ", running now" : ""}.</span>`;
    if (refV !== null) body += `<br><span class="muted">${esc(ref.label)}: ${fmt.num(refV, 1)}%</span>`;
    const how = [r.effort ? "effort " + esc(r.effort) : null,
      r.seconds !== null ? `median ${secs(r.seconds)}${x.local ? "" : " via Copilot"}` : null,
      r.tokens !== null ? `${fmt.int(r.tokens)} output tokens` : null].filter(Boolean);
    if (how.length) body += `<hr>${how.join(" · ")}${r.seconds !== null || r.tokens !== null ? " <span class=\"muted\">per reply</span>" : ""}`;
    const issues = issuesOf(r);
    if (issues.length) body += `<br>${issues.join(" · ")} <span class="muted">(counted as wrong)</span>`;
    return x.board ? LB.modelTip(x.board, body) : `<b>${esc(fullName(x))}</b><br><span class="muted">${esc(whoLine(x))}</span><hr>${body}`;
  }

  // ---------- rows ----------
  /**
   * 95% interval whisker. Over a full-colour bar the stretch inside the fill is drawn white (an ink line would vanish on dark
   * vendor colours) and the rest in ink; partial bars are pale, so their whisker is ink throughout.
   */
  function whisker(ci, score, pale) {
    const lo = Math.max(0, Math.min(100, ci[0])), hi = Math.max(0, Math.min(100, ci[1])), v = Math.max(0, Math.min(100, score));
    const seg = (a, b, on, capL, capR) => h("i", { class: ["fg-ci", on && "fg-ci-on", capL && "fg-cap-l", capR && "fg-cap-r"],
      style: { left: a.toFixed(2) + "%", width: Math.max(0, b - a).toFixed(2) + "%" } });
    if (pale || lo >= v) return [seg(lo, hi, false, true, true)];
    if (hi <= v) return [seg(lo, hi, true, true, true)];
    return [seg(lo, v, true, true, false), seg(v, hi, false, false, true)];
  }
  const drawn = (r) => !!(r.ci && r.ci[1] > r.ci[0]);
  function scoredRow(b, x, r, ref) {
    const refV = ref ? ref.of(x.name) : null;
    const color = vendorOf(x).color || "#94a3b8";
    const meta = [];
    if (!r.complete) meta.push(h("span", { class: "fg-prog" }, x.running ? pulse() : null, progress(b, r), x.running ? sr(", running now") : null));
    // right / wrong / "I don't know" counts explain the Omniscience index
    if (r.correct !== null) meta.push(amount(r.correct) + " right");
    if (r.incorrect !== null) meta.push(amount(r.incorrect) + " wrong");
    if (r.idk !== null) meta.push(h("span", {}, amount(r.idk) + " ", h("span", { "aria-hidden": "true" }, "IDK"), sr("“I don't know”")));
    if (r.effort) meta.push("effort " + r.effort);
    for (const t of issuesOf(r)) meta.push(h("span", { class: "fg-issue" }, t));
    const li = h("li", { class: ["fg-row", !r.complete && "fg-partial"] },
      badgeOf(x, 24),
      nameOf(x),
      h("span", { class: "fg-val" }, h("b", {}, pct(r.score)), isNum(r.index) ? h("small", {}, "index " + int(r.index)) : null),
      h("span", { class: "fg-track", "aria-hidden": "true" },
        h("i", { class: "fg-fill", style: { width: at(r.score), background: color } }),
        drawn(r) ? whisker(r.ci, r.score, !r.complete) : null,
        refV !== null ? h("i", { class: "fg-ref", style: { left: at(refV) } }) : null),
      r.ci ? sr(`, 95% interval ${Math.round(r.ci[0])} to ${Math.round(r.ci[1])}`) : null,
      refV !== null ? sr(`, ${ref.label}: ${fmt.num(refV, 1)}%`) : null,
      meta.length ? h("span", { class: "fg-meta" }, join(meta, " · ")) : null);
    hover(li, (t) => (refV !== null && t.closest && t.closest(".fg-ref") ? `${esc(ref.label)}: <b>${fmt.num(refV, 1)}%</b>`
      : rowTip(b, x, r, ref, refV)));
    return li;
  }
  function waitRow(x) {
    const status = x.queued
      ? x.running ? (x.local ? "running now" : "running in the cloud") : x.local ? "queued on this PC" : "queued"
      : x.running ? "running, nothing graded yet" : "nothing graded yet";
    const li = h("li", { class: ["fg-row", "fg-wait"] },
      badgeOf(x, 24), nameOf(x), h("span", { class: "fg-status" }, x.running ? pulse() : clockIcon(), status));
    const text = status.charAt(0).toUpperCase() + status.slice(1) + ".";
    hover(li, () => (x.board ? LB.modelTip(x.board, esc(text))
      : `<b>${esc(fullName(x))}</b><br><span class="muted">${esc(whoLine(x))}</span><hr>${esc(text)}`));
    return li;
  }

  // ---------- card ----------
  /** "Best cloud X% vs best local Y% → gap Z pts", from complete runs only, the gap from the numbers as shown. */
  function gapBox(done) {
    const best = (local) => done.filter((e) => e.x.local === local).sort((p, q) => q.r.score - p.r.score)[0] || null;
    const c = best(false), l = best(true);
    const d = c && l ? Math.round(c.r.score) - Math.round(l.r.score) : null;
    const val = (e) => h("b", {}, e ? pct(e.r.score) : ["—", sr(" (no complete run yet)")]);
    const pill = d === null ? h("span", { class: "fg-pill na" }, "—")
      : h("span", { class: ["fg-pill", d > 0 ? "behind" : d < 0 ? "ahead" : "even"] }, int(d), h("small", {}, " pts"),
        sr(d > 0 ? " (cloud ahead)" : d < 0 ? " (local ahead)" : " (tied)"));
    const sub = c && l ? [`${fullName(c.x)} vs ${fullName(l.x)} · `, h("span", { class: "fg-nowrap" }, "complete runs only")]
      : c ? `${fullName(c.x)} · no complete local run yet` : l ? `${fullName(l.x)} · no complete cloud run yet`
      : "Shown once a cloud run and a local run have both finished.";
    return h("div", { class: "fg-gap" },
      h("p", { class: "fg-gap-line" },
        h("span", { class: "fg-gap-g" }, "Best cloud", val(c)),
        h("span", { class: "fg-gap-g" }, h("span", { class: "fg-gap-vs" }, "vs"), "best local", val(l)),
        h("span", { class: "fg-gap-g" }, h("span", { class: "fg-gap-arrow", "aria-hidden": "true" }, "→"), sr(", "), "gap", pill)),
      h("p", { class: "fg-gap-sub" }, sub));
  }
  function nounOf(b) {
    const m = /\b(tasks|questions|puzzles|problems|items)\b/i.exec(b.unit) || /\b(tasks|questions|puzzles|problems)\b/i.exec(b.about);
    return m ? m[1].toLowerCase() : "items";
  }
  function benchCard(FG, b, runs, queued, fits) {
    const ref = refOf(FG, b);
    const entries = runs.map((x) => ({ x, r: resultOf(x, b) })).filter((e) => e.r);
    const byScore = (p, q) => q.r.score - p.r.score || (q.r.n || 0) - (p.r.n || 0) || p.x.name.localeCompare(q.x.name);
    const scored = entries.filter((e) => e.r.score !== null);
    // complete runs first, then partial ones, each best first; then what is still to come on this benchmark
    const done = scored.filter((e) => e.r.complete).sort(byScore);
    const partial = scored.filter((e) => !e.r.complete).sort(byScore);
    const started = new Set(entries.map((e) => e.x.id).filter(Boolean));
    const idle = entries.filter((e) => e.r.score === null).map((e) => e.x)
      .concat(queued.filter((q) => (!q.benchmark || q.benchmark === b.key) && !(q.id && started.has(q.id))))
      .sort((p, q) => q.running - p.running);

    const id = "fg-about-" + b.key.replace(/[^a-z0-9_-]/gi, "");
    const about = b.about ? h("p", { class: "fg-about", id }, b.about) : null;
    let more = null;
    if (about) {
      const word = h("span", {}, "More");
      more = h("button", { type: "button", class: "fg-more", "aria-expanded": "false", "aria-controls": id }, word, sr(` about ${b.name}`));
      more.addEventListener("click", () => {
        const open = more.getAttribute("aria-expanded") !== "true";
        more.setAttribute("aria-expanded", String(open));
        about.classList.toggle("fg-open", open);
        word.textContent = open ? "Less" : "More";
      });
      // the toggle only shows while the clamped description is cut short
      fits.push(() => { if (!about.classList.contains("fg-open")) more.hidden = about.scrollHeight <= about.clientHeight + 1; });
    }

    const rows = done.concat(partial).map((e) => scoredRow(b, e.x, e.r, ref)).concat(idle.map((x) => waitRow(x)));
    // one dashed line between the finished results and what is still running or queued
    const split = done.length || (partial.length && idle.length ? partial.length : 0);
    if (split && rows[split]) rows[split].classList.add("fg-split");
    const list = rows.length
      ? h("ol", { class: "fg-list", "aria-label": `${b.name}: complete runs first, then runs in progress, best score first` }, rows)
      : h("p", { class: "lb-empty" }, "No runs yet.");

    const axis = b.items && b.unit ? `% of ${amount(b.items)} ${b.unit}` : b.unit ? "% " + b.unit : "score, %";
    const keys = [h("span", { class: "fg-key" }, h("i", { class: "fg-key-bar", "aria-hidden": "true" }), axis)];
    if (scored.some((e) => drawn(e.r))) keys.push(h("span", { class: "fg-key" }, h("i", { class: "fg-key-ci", "aria-hidden": "true" }), "95% CI"));
    if (partial.length) keys.push(h("span", { class: "fg-key" }, h("i", { class: "fg-key-bar fg-key-part", "aria-hidden": "true" }), "partial run"));
    if (ref) keys.push(h("span", { class: "fg-key" }, h("i", { class: "fg-key-ref", "aria-hidden": "true" }), ref.url ? ext(ref.url, ref.label + " ↗") : ref.label));
    const src = b.url || b.source ? h("span", { class: "fg-src" }, "Source: ", b.url ? ext(b.url, (b.source || b.name) + " ↗") : b.source) : null;

    return LB.card("fg-card",
      h("div", { class: "fg-head" },
        h("div", { class: "fg-title" }, h("h3", {}, b.name), b.items ? LB.chip(`${amount(b.items)} ${nounOf(b)}`, "fg-chip") : null),
        about ? h("div", { class: "fg-desc" }, about, more) : null),
      gapBox(done),
      list,
      h("div", { class: "fg-foot" }, h("div", { class: "fg-keys" }, keys), src));
  }

  // ---------- section ----------
  function render(el) {
    const FG = obj(D.frontierGap);
    const S = saturation();
    // the page's first section: open from what the private tasks show (Max vs max, further down), then why these benchmarks
    const mx = h("a", { class: "fg-link", href: "#max-vs-max" }, "Max vs max ↓");
    const both = S.local !== null && S.cloud !== null;
    const eff = S.maxed ? ", each at its highest reasoning effort" : "";
    const own = !both ? ["Our own tasks from daily work are compared in ", mx, "."]
      : Math.abs(S.local - S.cloud) <= 2
        ? [`On our own tasks from daily work the best local and cloud models are nearly tied: ${fmt.pct(S.local)} vs ` +
           `${fmt.pct(S.cloud)} text core${eff} (`, mx, ")."]
        : [`On our own tasks from daily work the best local model scores ${fmt.pct(S.local)} text core and the best cloud ` +
           `model ${fmt.pct(S.cloud)}${eff} (`, mx, ")."];
    el.append(LB.sectionHead({ title: "Frontier gap: public hard benchmarks",
      sub: [...own, " These two public hard benchmarks, run on the same harness, show where the cloud models still pull ahead."] }));
    const runs = FG ? objs(FG.runs).map(runOf) : [];
    const queued = FG ? objs(FG.queued).map((q) => queuedOf(q, runs)) : [];
    const benches = FG ? benchList(FG, runs, queued) : [];
    if (!benches.length || (!runs.length && !queued.length)) {
      el.append(LB.card("fg-card fg-empty", h("div", { class: "lb-empty" }, "No public-benchmark results yet. They land here as runs finish.")));
      return;
    }
    const fits = [];
    const cards = benches.map((b) => benchCard(FG, b, runs, queued, fits));
    el.append(h("div", { class: ["fg-grid", cards.length > 1 && "lb-grid-2"] }, cards),
      h("div", { class: "fg-notes", role: "note", "aria-label": "About these results" }, infoIcon(),
        h("ul", {}, NOTES.map((t) => h("li", {}, t)))));
    const refit = () => fits.forEach((f) => f());
    refit();
    LB.onResize(refit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
  }

  LB.register({ id: "frontier-gap", order: 10, nav: "Frontier gap", render });
})();
