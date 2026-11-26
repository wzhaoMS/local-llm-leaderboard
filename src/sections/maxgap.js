/* Max vs max: our strongest local setup against the strongest cloud reference, each at its highest reasoning effort. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, fmt, isNum } = LB;
  const D = LB.data || {};
  const GROUP = { daily: "Daily work", coding: "Coding", agents: "Agents" };
  const MINUS = "\u2212";
  const FOOT = "Max effort = the highest reasoning setting each model accepts (Qwen3.8 xhigh, Claude and GPT max, Gemini xhigh). " +
    "Same questions, same graders; cloud models via GitHub Copilot.";
  const MIXED = "Each side's best run on each suite; rows can come from different models.";

  const isRef = (m) => !!(m && m.reference);
  const num = (v) => (isNum(v) ? v : null);
  const r1 = (v) => Math.round(v * 10) / 10;
  const val = (m, key) => (m ? num(LB.score(m, key)) : null);
  const models = () => (Array.isArray(D.models) ? D.models : []).filter(Boolean);
  const scored = (m) => !!(m && m.scores && isNum(m.scores.textCore));
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function ciOf(m) {
    const ci = m && m.scores && m.scores.textCoreCI;
    return Array.isArray(ci) && isNum(ci[0]) && isNum(ci[1]) ? ci : null;
  }
  const overlap = (a, b) => !!(a && b && a[0] <= b[1] && b[0] <= a[1]);
  /** Gap in points from the values as displayed (one decimal), so the label always matches the two numbers shown. */
  const delta = (a, b) => r1(r1(a) - r1(b));
  const signed = (d) => (d < 0 ? MINUS : "+") + Math.abs(d).toFixed(1);
  const ciText = (ci) => `${fmt.pct(ci[0], 0)}–${fmt.pct(ci[1], 0)}`;

  // ---------- effort ----------
  const ME = D.maxEffort && typeof D.maxEffort === "object" ? D.maxEffort : {};
  const PENDING = ME.pending && typeof ME.pending === "object" ? ME.pending : {};
  const strs = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === "string" && v.trim()) : []);
  const maxIds = new Set(strs(ME.local).concat(strs(ME.cloud)));
  const isMax = (m) => !!(m && (m.maxEffort === true || maxIds.has(m.id)));
  const joinAnd = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  /** Reasoning effort: the explicit field, else read from the variant ("cloud · effort high") or the id ("…-medium"). */
  function effortOf(m) {
    if (!m) return null;
    if (typeof m.effort === "string" && m.effort.trim()) return m.effort.trim().toLowerCase();
    const v = /\beffort\s+([a-z-]+)/i.exec(m.variant || "");
    if (v) return v[1].toLowerCase();
    const id = /-(minimal|low|medium|high|xhigh|max)(?:-|$)/i.exec(m.id || "");
    return id ? id[1].toLowerCase() : null;
  }
  /** Short name plus effort, unless the name already says it ("Flash-Next Q4 low"). */
  function withEffort(m) {
    const name = LB.label(m), e = effortOf(m);
    return e && !new RegExp("\\b" + e.replace(/[^a-z0-9]/gi, "") + "\\b", "i").test(name) ? name + " · " + e : name;
  }
  /** Variant and location for the headline, minus what the chips already say (effort) or the location repeats ("cloud"). */
  function subLine(m) {
    const where = String(m.where || "");
    const parts = String(m.variant || "").split("·").map((x) => x.trim()).filter(Boolean)
      .filter((x) => !/^effort\b/i.test(x) && !where.toLowerCase().includes(x.toLowerCase()));
    return parts.concat(where ? [where] : []).join(" · ");
  }

  // ---------- pools & ranking ----------
  /**
   * Ours = local runs, theirs = cloud references. A side uses its max-effort list only when that list has scored runs and
   * none of that side's max-effort runs is still pending; otherwise it uses every published scored run on that side.
   */
  function pools() {
    const pick = (xs, ok) => strs(xs).map((id) => LB.byId(id)).filter((m) => m && ok(m) && scored(m));
    const localMax = pick(ME.local, (m) => !isRef(m));
    const cloudMax = pick(ME.cloud, isRef);
    const pendLocal = strs(PENDING.local), pendCloud = strs(PENDING.cloud);
    const refs = (typeof LB.references === "function" ? LB.references() : models().filter(isRef)).filter(scored);
    const useLocal = localMax.length > 0 && !pendLocal.length;
    const useCloud = cloudMax.length > 0 && !pendCloud.length;
    // Pending cloud runs listed best published score first (names match the references' names).
    const refScore = (name) => { const m = refs.find((r) => r.name === name); return m ? val(m, "textCore") : -1; };
    const cloudOrder = pendCloud.map((n, i) => ({ n, i, v: refScore(n) })).sort((a, b) => b.v - a.v || a.i - b.i).map((x) => x.n);
    return {
      ours: useLocal ? localMax : models().filter((m) => !isRef(m) && scored(m)),
      theirs: useCloud ? cloudMax : refs,
      oursFallback: !useLocal,
      theirsFallback: !useCloud,
      pending: pendLocal.concat(cloudOrder),
    };
  }
  function taskTime(m) {
    const t = isRef(m) ? (isNum(m.cloudTaskTime) ? m.cloudTaskTime : m.speed && m.speed.taskTime) : m.speed && m.speed.taskTime;
    return isNum(t) ? t : Infinity;
  }
  /** Best first; equal scores: max effort first, then the faster model. */
  function ranked(pool, key) {
    return pool.map((m) => ({ m, v: val(m, key) })).filter((x) => x.v !== null)
      .sort((a, b) => r1(b.v) - r1(a.v) || isMax(b.m) - isMax(a.m) || taskTime(a.m) - taskTime(b.m) ||
        (val(b.m, "textCore") || 0) - (val(a.m, "textCore") || 0) || LB.label(a.m).localeCompare(LB.label(b.m)));
  }
  const top = (pool, key) => { const r = ranked(pool, key)[0]; return r ? r.m : null; };

  function rowDefs() {
    const core = D.core || {};
    const suites = (Array.isArray(D.suites) ? D.suites : []).filter(Boolean);
    const nText = Array.isArray(core.textSuites) ? core.textSuites.length : null;
    const n = (x, unit = "tasks") => (isNum(x) ? `${fmt.int(x)} ${x === 1 ? unit.replace(/s$/, "") : unit}` : "");
    const hint = (...xs) => xs.filter(Boolean).join(" · ");
    return [
      { title: "Core suites", rows: [
        { key: "textCore", label: "Text core", hint: hint(nText ? `mean of ${nText} text suites` : "ranking score", n(core.textTasks)), total: true },
        { key: "allSuites", label: "All suites", hint: hint("incl. vision", n(core.tasks)), total: true },
        ...suites.filter((x) => x.inCore).map((x) => ({ key: x.key, label: x.name || x.key, hint: hint(GROUP[x.group], n(x.tasks)) })),
      ] },
      { title: "Agentic", rows: suites.filter((x) => !x.inCore).map((x) => ({ key: x.key, label: x.name || x.key,
        hint: hint(GROUP[x.group], n(x.tasks, x.key === "long_horizon" ? "sessions" : "tasks")) })) },
    ].filter((g) => g.rows.length);
  }
  /** Symmetric scale for the diverging bars: the largest gap rounded up to a readable number (at least 10 points). */
  function niceMax(v) {
    for (const step of [10, 20, 25, 50, 100]) if (v <= step) return step;
    return Math.ceil(v / 50) * 50;
  }

  // ---------- atoms ----------
  const icon = (d, size = 16) => s("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor",
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d }));
  const arrowIcon = () => icon("M2.8 8h10.4M9.4 4.2 13.2 8l-3.8 3.8", 15);
  const infoIcon = () => icon("M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM8 7.4v3.8M8 5.1v.1", 15);
  const sr = (t) => h("span", { class: "mx-sr" }, t);

  // ---------- headline ----------
  function sideCard(m, side, poolSize, fallback, domain) {
    const ours = side === "ours";
    const tag = h("span", { class: ["mx-tag", side] }, ours ? "Our max" : "Their max", h("small", {}, ours ? "local" : "cloud"));
    if (!m) {
      return LB.card("mx-side mx-side-" + side, h("div", { class: "mx-side-top" }, tag),
        h("p", { class: "mx-none" }, ours ? "No scored local runs yet." : "No cloud references yet."));
    }
    const tc = val(m, "textCore"), ci = ciOf(m), eff = effortOf(m);
    const badge = LB.mono(m, 44);
    if (!ours) badge.classList.add("mx-dash");
    const chips = h("span", { class: "mx-chips" },
      isMax(m) ? LB.chip("Max effort", "lime") : eff ? LB.chip("effort " + eff) : null,
      m.status === "running" ? LB.chip("Running", "lime") : m.partial ? LB.chip("Partial run", "warn") : null);
    const pool = poolSize > 1 ? `Best of ${poolSize} ${fallback ? (ours ? "published local runs" : "published cloud runs") : "max-effort runs"}` : "";
    const card = LB.card("mx-side mx-side-" + side,
      h("div", { class: "mx-side-top" }, tag, chips),
      h("div", { class: "mx-id" }, badge, h("div", { class: "mx-id-txt" },
        h("h3", {}, m.name || LB.label(m)),
        h("div", { class: "mx-variant", title: LB.fullName(m) }, subLine(m)))),
      h("div", { class: "mx-big" }, h("b", {}, fmt.pct(tc)), h("span", {}, "text core")),
      ciStrip(m, ci, tc, domain),
      pool ? h("div", { class: "mx-pool" }, pool) : null);
    LB.tip.attach(badge, () => LB.modelTip(m));
    return card;
  }
  function ciStrip(m, ci, v, domain) {
    if (v === null) return null;
    const [lo, hi] = domain;
    const pos = (x) => ((Math.max(lo, Math.min(hi, x)) - lo) / (hi - lo)) * 100;
    const color = LB.vendor(m).color;
    return h("div", { class: "mx-ci" },
      h("div", { class: "mx-ci-track", "aria-hidden": "true" },
        ci ? h("i", { class: "mx-ci-band", style: { left: pos(ci[0]) + "%", width: Math.max(0, pos(ci[1]) - pos(ci[0])) + "%", background: color } }) : null,
        h("i", { class: "mx-ci-dot", style: { left: pos(v) + "%", background: color } })),
      h("div", { class: "mx-ci-axis" },
        h("span", { "aria-hidden": "true" }, fmt.int(lo)),
        h("span", { class: "mx-ci-text" }, ci ? `95% CI ${ciText(ci)}` : "No interval yet"),
        h("span", { "aria-hidden": "true" }, fmt.int(hi))));
  }
  function gapBlock(o, t) {
    const vo = val(o, "textCore"), vt = val(t, "textCore");
    if (vo === null || vt === null) {
      return h("div", { class: "mx-gap" }, h("span", { class: "mx-gap-label" }, "Gap"), h("span", { class: "mx-pill na" }, "—"),
        h("span", { class: "mx-gap-sub" }, "needs a scored model on both sides"));
    }
    const d = delta(vo, vt), co = ciOf(o), ct = ciOf(t), within = overlap(co, ct);
    const chip = within ? LB.chip("within error", "mx-within") : null;
    if (chip) LB.tip.attach(chip, `The 95% intervals overlap (${ciText(co)} vs ${ciText(ct)}), so the text-core gap is within noise.`);
    return h("div", { class: "mx-gap" },
      h("span", { class: "mx-gap-label" }, "Gap"),
      h("span", { class: ["mx-pill", d < 0 ? "behind" : "ahead"] }, signed(d), h("small", {}, " pts"),
        sr(d < 0 ? " (ours behind)" : d > 0 ? " (ours ahead)" : " (tied)")),
      h("span", { class: "mx-gap-sub" }, "text core, ours " + MINUS + " theirs"),
      chip,
      h("button", { type: "button", class: "lb-btn mx-cmp", onclick: () => LB.openCompare(o.id, t.id) }, "Compare", arrowIcon()));
  }
  /** One axis for both interval strips, so they can be compared at a glance. */
  function ciDomain(ms) {
    const xs = [];
    for (const m of ms) {
      const v = val(m, "textCore"), ci = ciOf(m);
      if (v !== null) xs.push(v);
      if (ci) xs.push(ci[0]);
    }
    if (!xs.length) return [0, 100];
    const lo = Math.max(0, Math.min(90, Math.floor((Math.min(...xs) - 3) / 5) * 5));
    return [lo, 100];
  }

  // ---------- suite table ----------
  function sideCell(m, v, side, showName) {
    return h("div", { class: ["mx-val", side], role: "cell" },
      v === null ? h("span", { class: "mx-na" }, "—", sr(" no score")) : h("b", {}, fmt.pct(v)),
      showName && m && v !== null ? h("small", { title: LB.fullName(m) }, withEffort(m)) : null);
  }
  function gapCell(d, scale) {
    if (d === null) return h("div", { class: "mx-gapcell none", role: "cell" }, h("span", { class: "mx-track" }, h("i", { class: "mx-zero" })), sr("no gap: a side has no score"));
    const w = (Math.min(1, Math.abs(d) / scale) * 50).toFixed(2);
    const kind = d < 0 ? "behind" : d > 0 ? "ahead" : "tied";
    const at = `calc(50% + ${w}% + 7px)`;
    return h("div", { class: ["mx-gapcell", kind], role: "cell" },
      h("span", { class: "mx-track" },
        h("i", { class: "mx-zero", "aria-hidden": "true" }),
        d !== 0 ? h("i", { class: "mx-bar", "aria-hidden": "true", style: d < 0 ? { right: "50%", width: w + "%" } : { left: "50%", width: w + "%" } })
          : h("i", { class: "mx-even", "aria-hidden": "true" }),
        h("span", { class: "mx-delta", style: d < 0 ? { right: at } : { left: at } }, signed(d),
          sr(d < 0 ? " points, ours behind" : d > 0 ? " points, ours ahead" : " points, tied"))));
  }
  function rowTip(def, x) {
    const line = (who, m, v) => `${who}: ` + (v === null || !m ? `<span class="muted">no score</span>` :
      `<b>${fmt.pct(v)}</b> ${esc(LB.label(m))}` + (effortOf(m) ? ` <span class="muted">· effort ${esc(effortOf(m))}</span>` : ""));
    return `<b>${esc(def.label)}</b><br>${line("Ours", x.o, x.vo)}<br>${line("Theirs", x.t, x.vt)}` +
      (x.d !== null ? `<hr>Gap <b>${signed(x.d)}</b> pts` : "");
  }

  // ---------- section ----------
  /** While a side isn't on its max-effort list yet: name the pending runs and the efforts actually shown. */
  function provisionalNote(P, ourTop, theirTop) {
    if (!P.oursFallback && !P.theirsFallback) return null;
    const at = (m, fellBack) => (!fellBack || isMax(m) ? "max effort" : effortOf(m) ? "effort " + effortOf(m) : "default effort");
    const sides = [ourTop && "ours at " + at(ourTop, P.oursFallback), theirTop && "theirs at " + at(theirTop, P.theirsFallback)].filter(Boolean);
    const tail = sides.length ? ` (${sides.join(", ")})` : "";
    if (P.pending.length) return `Max-effort runs still running: ${joinAnd(P.pending)}; showing the best published run per side${tail}.`;
    const which = P.oursFallback && P.theirsFallback ? "either side" : P.oursFallback ? "our side" : "their side";
    return `No max-effort runs published yet on ${which}; showing the best published run per side${tail}.`;
  }

  function render(el) {
    const P = pools();
    const ourTop = top(P.ours, "textCore"), theirTop = top(P.theirs, "textCore");
    let mode = "h2h";

    el.append(LB.sectionHead({ title: "Our max vs their max",
      sub: "Our strongest local setup against the strongest cloud reference, each at the highest reasoning effort it accepts." }));
    if (!ourTop && !theirTop) {
      el.append(LB.card("mx-empty", h("div", { class: "lb-empty" }, "No scored runs yet. Results land here as soon as both sides have one.")));
      return;
    }
    const domain = ciDomain([ourTop, theirTop].filter(Boolean));
    el.append(h("div", { class: "mx-head" },
      sideCard(ourTop, "ours", P.ours.length, P.oursFallback, domain),
      gapBlock(ourTop, theirTop),
      sideCard(theirTop, "theirs", P.theirs.length, P.theirsFallback, domain)));
    const noteText = provisionalNote(P, ourTop, theirTop);
    if (noteText) el.append(h("p", { class: "mx-note", role: "note" }, infoIcon(), h("span", {}, h("b", {}, "Provisional. "), noteText)));

    const summary = h("p", { class: "mx-summary", "aria-live": "polite" });
    const caption = h("p", { class: "mx-caption" }, infoIcon(), h("span", {}, MIXED));
    const seg = LB.seg([{ value: "h2h", label: "Head to head" }, { value: "best", label: "Best run per suite" }], mode, (v) => { mode = v; draw(); });
    seg.classList.add("mx-seg");
    seg.setAttribute("aria-label", "Which models to compare on each suite");
    const table = h("div", { class: "mx-table", role: "table", "aria-label": "Gap by suite, ours minus theirs" });
    el.append(LB.card("mx-card",
      h("div", { class: "lb-card-head mx-card-head" }, h("div", { class: "mx-card-title" }, h("h3", {}, "Suite by suite"), summary, caption), seg),
      table,
      h("p", { class: "mx-foot" }, infoIcon(), h("span", {}, FOOT))));

    function draw() {
      const h2h = mode === "h2h";
      const groups = rowDefs().map((g) => ({ title: g.title, rows: g.rows.map((def) => {
        const o = h2h ? ourTop : top(P.ours, def.key);
        const t = h2h ? theirTop : top(P.theirs, def.key);
        const vo = val(o, def.key), vt = val(t, def.key);
        return { def, o, t, vo, vt, d: vo !== null && vt !== null ? delta(vo, vt) : null };
      }) }));
      const all = groups.flatMap((g) => g.rows);
      const scale = niceMax(Math.max(0, ...all.filter((x) => x.d !== null).map((x) => Math.abs(x.d))));
      // Head to head names the two models once, in the column headers; best-run rows name their own model.
      const colHead = (side, label) => {
        const m = side === "ours" ? ourTop : theirTop;
        return h("span", { class: ["mx-val", side], role: "columnheader" }, label,
          h("small", { title: h2h && m ? LB.fullName(m) : null }, h2h && m ? withEffort(m) : side === "ours" ? "local" : "cloud"));
      };

      table.textContent = "";
      table.append(h("div", { class: "mx-row mx-thead", role: "row" },
        h("span", { class: "mx-suite", role: "columnheader" }, "Suite"),
        colHead("ours", "Ours"),
        h("span", { class: "mx-gapcell", role: "columnheader" }, h("span", { class: "mx-sr" }, "Gap, ours minus theirs"),
          h("span", { class: "mx-scale", "aria-hidden": "true" },
            h("span", {}, MINUS + scale), h("span", {}, "0"), h("span", {}, "+" + scale))),
        colHead("theirs", "Theirs")));
      for (const g of groups) {
        table.append(h("div", { class: "mx-group", role: "row" }, h("span", { role: "cell", "aria-colspan": "4" }, g.title)));
        for (const x of g.rows) {
          const row = h("div", { class: ["mx-row", x.def.total && "mx-total"], role: "row" },
            h("div", { class: "mx-suite", role: "rowheader" }, h("b", {}, x.def.label), x.def.hint ? h("small", {}, x.def.hint) : null),
            sideCell(x.o, x.vo, "ours", !h2h),
            gapCell(x.d, scale),
            sideCell(x.t, x.vt, "theirs", !h2h));
          LB.tip.attach(row, () => rowTip(x.def, x));
          table.append(row);
        }
      }

      const suites = all.filter((x) => !x.def.total && x.d !== null);
      const ahead = suites.filter((x) => x.d > 0).length, behind = suites.filter((x) => x.d < 0).length;
      const tied = suites.length - ahead - behind;
      const counts = suites.length ? `Ours: ahead on ${ahead}, tied on ${tied}, behind on ${behind} of ${suites.length} suites.` : "";
      if (h2h) {
        summary.textContent = ourTop && theirTop ? `${LB.label(ourTop)} vs ${LB.label(theirTop)} on every suite. ${counts}`.trim()
          : "Head to head needs a scored model on both sides.";
      } else summary.textContent = counts;
      summary.hidden = !summary.textContent;
      caption.hidden = h2h;
    }
    draw();
  }

  LB.register({ id: "max-vs-max", order: 25, nav: "Max vs max", render });
})();
