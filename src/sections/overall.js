/* Best Overall: one vendor-coloured bar per model for the chosen metric (text core by default). */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, fmt, isNum } = LB;
  const D = LB.data || {};

  const AGENTIC = { repo_replay: "Real-repo bug fixes", debug: "Debugging", long_horizon: "Long sessions" };
  const ROT = 40;                                   // x-label rotation, degrees
  const COS = Math.cos((ROT * Math.PI) / 180), SIN = Math.sin((ROT * Math.PI) / 180);
  const FONT = '"Geist", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---------- text measuring (canvas); cleared once the web font has loaded ----------
  const widths = new Map();
  let mctx;
  function textW(text, size, weight) {
    const key = weight + "|" + size + "|" + text;
    let w = widths.get(key);
    if (w === undefined) {
      if (mctx === undefined) mctx = document.createElement("canvas").getContext("2d") || null;
      if (mctx) { mctx.font = `${weight} ${size}px ${FONT}`; w = mctx.measureText(text).width; }
      else w = text.length * size * 0.56;
      widths.set(key, w);
    }
    return w;
  }
  function whenFontLoads(fn) {
    const fs = document.fonts;
    if (!fs || !fs.load || !fs.check) return;
    let ok = true;
    try { ok = fs.check("12px Geist"); } catch (e) { ok = true; }
    if (!ok) fs.load("500 12px Geist").then(() => { widths.clear(); fn(); }, () => {});
  }

  // ---------- metrics ----------
  const sentence = (t) => (t && /^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t || "");
  function metricList() {
    const core = D.core || {};
    const nText = (core.textSuites || []).length, nAll = (core.suites || []).length;
    const qs = (n) => (isNum(n) ? `the same ${n} questions` : "the same questions");
    const PARTIAL = "Partial = scored on fewer tasks.";
    const note = `Scores run 0–100; equal scores are ordered by text core. ${PARTIAL}`;
    const out = [
      { value: "textCore", label: "Text core", group: "Overall", note: `Overlapping 95% intervals = statistically tied. ${PARTIAL}`,
        sub: `Text core: the mean of ${nText || "the"} text suites on ${qs(core.textTasks)}. Hover a bar for its 95% interval.` },
      { value: "allSuites", label: "All suites (incl. vision)", group: "Overall", note,
        sub: `All suites: the mean of ${nAll || "all"} core suites on ${qs(core.tasks)}, vision included. Hover a bar for details.` },
    ];
    for (const su of D.suites || []) {
      if (!su || !su.inCore) continue;
      const n = isNum(su.tasks) ? `, ${su.tasks} questions` : "";
      out.push({ value: su.key, label: su.name, group: "Core suites", note, tasks: su.tasks,
        sub: `${su.name}${n}: ${sentence(su.desc)}${su.desc ? " " : ""}Hover a bar for details.` });
    }
    for (const key of Object.keys(AGENTIC)) {
      const su = LB.suite(key) || {};
      const name = su.name || AGENTIC[key];
      out.push({ value: key, label: name, group: "Agentic suites (scored separately)", agentic: true,
        note: `Pass rate across all runs; not every model ran this suite. ${PARTIAL}`,
        sub: `${name}: ${sentence(su.desc)}${su.desc ? " " : ""}Scored separately from the text core.` });
    }
    return out;
  }

  /** Bars for a metric: local models matching the placement filter, plus the cloud references with "Compare all". */
  function rowsFor(metric, filter, withRefs) {
    const rows = [];
    for (const m of D.models || []) {
      if (!m) continue;
      if (m.reference ? !(withRefs && filter === "all") : !LB.matchPlacement(m, filter)) continue;
      const v = LB.score(m, metric);
      if (isNum(v)) rows.push({ m, v, ref: !!m.reference });
    }
    const tc = (m) => (m.scores && isNum(m.scores.textCore) ? m.scores.textCore : -1);
    rows.sort((a, b) => b.v - a.v || tc(b.m) - tc(a.m) || LB.label(a.m).localeCompare(LB.label(b.m)));
    let k = 0;
    for (const r of rows) if (!r.ref) r.rank = ++k;      // references are shown, never ranked
    return rows;
  }

  const ciOf = (m) => {
    const ci = m.scores && m.scores.textCoreCI;
    return ci && isNum(ci[0]) && isNum(ci[1]) ? ci : null;
  };
  /** Indices of rows whose 95% interval overlaps row i (text core only). */
  function tiedWith(rows, i) {
    const a = ciOf(rows[i].m);
    if (!a) return [];
    const out = [];
    rows.forEach((r, j) => {
      const b = j !== i && ciOf(r.m);
      if (b && a[0] <= b[1] && b[0] <= a[1]) out.push(j);
    });
    return out;
  }

  // ---------- tooltip ----------
  const secs = (v) => (isNum(v) ? fmt.sec(v, v < 10 ? 1 : 0) : "—");
  function detail(m, key, mt) {
    const a = (m.agentic || {})[key];
    if (key === "repo_replay" && a) {
      return `${fmt.int(a.runs)} runs on ${fmt.int(a.tasks)} tasks · median ${secs(a.medianWallS)} per run` +
        (isNum(a.medianTimeToCorrectS) ? `, ${secs(a.medianTimeToCorrectS)} to a correct fix` : "") +
        (isNum(a.medianSteps) ? ` · ${fmt.int(a.medianSteps)} steps` : "");
    }
    if (key === "debug" && a) {
      return `${fmt.int(a.runs)} runs on ${fmt.int(a.tasks)} bugs · median ${secs(a.medianWallS)} per run` +
        (isNum(a.medianTimeToFixS) ? `, ${secs(a.medianTimeToFixS)} to fix` : "") +
        (isNum(a.rootCauseNamed) ? ` · root cause named ${fmt.pct(a.rootCauseNamed, 0)}%` : "");
    }
    if (key === "long_horizon" && a) {
      return `${fmt.int(a.sessions)} sessions · ${fmt.int(a.stagesPassed)}/${fmt.int(a.stagesTotal)} stages passed` +
        (isNum(a.recall) ? ` · recall ${fmt.pct(a.recall, 0)}%` : "") +
        (isNum(a.medianWallMin) ? ` · median ${fmt.num(a.medianWallMin, 1)} min per session` : "");
    }
    const t = m.suiteTimeS && m.suiteTimeS[key];
    const parts = [];
    if (mt && isNum(mt.tasks)) parts.push(`${mt.tasks} questions`);
    if (isNum(t)) parts.push(`median ${secs(t)} per task`);
    const out = parts.join(" · ");
    return out ? out[0].toUpperCase() + out.slice(1) : "";
  }
  const REF_NOTE = "Cloud reference via GitHub Copilot · same tasks";
  function tipHtml(rows, i, mt) {
    const { m, v } = rows[i];
    if (rows[i].ref) return LB.modelTip(m, (mt.value === "textCore" ? "" : `${mt.label} <b>${fmt.num(v, 1)}</b><br>`) + REF_NOTE);
    const nLocal = rows.filter((r) => !r.ref).length;
    const rank = `Rank <b>#${rows[i].rank}</b> of ${nLocal}${nLocal < rows.length ? " local" : ""}`;
    let extra;
    if (mt.value === "textCore") {
      const ci = ciOf(m);
      const tied = tiedWith(rows, i).map((j) => LB.label(rows[j].m) + (rows[j].ref ? " (cloud)" : ""));
      extra = rank + (ci ? ` · 95% interval <b>${fmt.num(ci[0], 1)}–${fmt.num(ci[1], 1)}</b>` : "") +
        (tied.length ? `<br><span class="muted">Statistically tied with ${tied.join(", ")}</span>` : "");
    } else {
      const d = detail(m, mt.value, mt);
      extra = `${mt.label} <b>${fmt.num(v, 1)}</b> · ${rank.toLowerCase()}` + (d ? `<br><span class="muted">${d}</span>` : "");
    }
    if (m.recommended) extra += `<br>★ Our pick`;
    return LB.modelTip(m, extra);
  }

  // ---------- drawing ----------
  /** Bar with rounded top corners, flat bottom. */
  function barPath(x, y, w, hgt, r) {
    r = Math.max(0, Math.min(r, w / 2, hgt));
    return `M${x},${y + hgt}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + hgt}Z`;
  }

  function drawBars(chart, rows, mt) {
    chart.textContent = "";
    const avail = Math.floor(chart.clientWidth) || 960;
    const narrow = avail < 640;
    const fsL = narrow ? 11 : 11.5, fsV = narrow ? 11.5 : 12.5, fsTag = narrow ? 9 : 9.5;
    const n = rows.length, nRef = rows.filter((r) => r.ref).length;
    const tagW = Math.ceil(textW("cloud", fsTag, 600) + 9);
    const labs = rows.map((r) => ({ main: LB.label(r.m), part: r.m.partial ? " · partial" : "", tag: r.ref }));
    const labW = labs.map((l) => textW(l.main, fsL, 460) + (l.part ? textW(l.part, fsL, 600) : 0) + (l.tag ? tagW + 4 : 0));
    const top = 36, plotH = narrow ? 190 : 222, axisW = Math.ceil(textW("100%", 11, 400)) + 24;
    const bottom = Math.ceil(Math.max(40, ...labW) * SIN + fsL * COS + 14);
    const minStep = narrow ? 40 : 46, maxStep = 96;

    // long labels hang down-left from their bar: shift the plot right until the first ones fit
    let left = axisW, step = minStep;
    for (let pass = 0; pass < 4; pass++) {
      step = Math.max(minStep, Math.min(maxStep, (avail - left - 4) / n));
      let need = 0;
      labW.forEach((w, i) => { need = Math.max(need, w * COS + 6 - (left + step * (i + 0.5) + fsL * 0.3)); });
      if (need <= 0.5) break;
      left += need;
    }
    const W = Math.max(avail, Math.ceil(left + step * n + 4));
    const H = top + plotH + bottom, base = top + plotH;
    const yOf = (v) => base - (Math.max(0, Math.min(100, v)) / 100) * plotH;
    const bw = Math.min(54, Math.max(18, step * 0.66));
    const br = Math.min(7, bw * 0.15);
    const badgeR = Math.max(8, Math.min(13, bw * 0.3));
    const hasCI = mt.value === "textCore";

    const svg = s("svg", { class: "ov-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "group",
      "aria-label": `${mt.label} by model, highest first: ${n - nRef} local model${n - nRef === 1 ? "" : "s"}` +
        (nRef ? ` and ${nRef} hatched cloud reference${nRef === 1 ? "" : "s"}` : "") });
    svg.append(s("defs", {}, s("pattern", { id: "ov-hatch", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
      s("rect", { width: 3, height: 7, fill: "rgba(255,255,255,.6)" }))));

    const grid = s("g", { class: "ov-grid", "aria-hidden": "true" });
    for (let t = 0; t <= 100; t += 20) {
      const y = Math.round(yOf(t)) + 0.5;
      grid.append(s("line", { x1: left - 8, x2: W - 2, y1: y, y2: y }),
        s("text", { class: "ov-tick", x: left - 14, y: y + 3.5, "text-anchor": "end" }, t + "%"));
    }
    svg.append(grid);

    const groups = [];
    const clear = () => { svg.classList.remove("ov-dim"); groups.forEach((g) => g.classList.remove("ov-hot", "ov-tied")); LB.tip.hide(); };
    rows.forEach((r, i) => {
      const { m, v } = r;
      const ven = LB.vendor(m);
      const cx = left + step * (i + 0.5), x = cx - bw / 2, y = yOf(v), bh = base - y;
      const tint = m.partial && !r.ref;          // hatching marks cloud references, so local partial runs get a tint
      const g = s("g", {
        class: ["ov-bar", m.recommended && "ov-rec", m.partial && "ov-partial", r.ref && "ov-ref"], tabindex: 0, role: "img",
        "aria-label": (r.ref ? `${LB.fullName(m)}, cloud reference, not ranked` : `${r.rank}. ${LB.fullName(m)}`) +
          `: ${mt.label} ${fmt.num(v, 1)}` + (m.partial ? ", partial run" : "") + (m.recommended ? ", our pick" : ""),
      });
      const rise = { transitionDelay: Math.min(i * 40, 640) + "ms" };
      const fade = { transitionDelay: 520 + Math.min(i * 40, 640) + "ms" };
      const hit = s("rect", { class: "ov-hit", x: cx - step / 2 + 1, y: top - 30, width: step - 2, height: plotH + 38, rx: 8 });
      g.append(hit);
      if (bh > 0.5) {
        const d = barPath(x, y, bw, bh, br);
        g.append(s("path", { class: ["ov-rise", tint && "ov-tint"], d, fill: ven.color, stroke: tint ? ven.color : null, style: rise }));
        if (r.ref) g.append(s("path", { class: "ov-rise ov-hatch", d, fill: "url(#ov-hatch)", style: rise }));
      }
      // vendor badge: inside the top of the bar, or just above a short bar
      const inside = bh >= badgeR * 2 + 14;
      const by = inside ? y + 7 + badgeR : y - 5 - badgeR;
      const letter = String(ven.letter || "?");
      g.append(s("g", { class: ["ov-fade", "ov-badge", !inside && "ov-badge-out"], style: fade, "aria-hidden": "true" },
        s("circle", { cx, cy: by, r: badgeR }),
        s("text", { x: cx, y: by, dy: "0.35em", "text-anchor": "middle", fill: ven.color,
          "font-size": (letter.length > 1 ? badgeR * 0.78 : badgeR * 0.98).toFixed(1) }, letter)));
      // value label (lime pill for our pick), on a white knockout so gridlines never run through it
      const vy = (inside ? y : by - badgeR) - 8;
      const vtxt = (m.recommended ? "★ " : "") + fmt.num(v, 1);
      const val = s("g", { class: ["ov-val", hasCI && "ov-val-ci"] });
      if (m.recommended) {
        const pw = textW(vtxt, fsV, 700) + 14, ph = fsV + 8, py = vy - fsV - 2.5;
        val.append(s("rect", { class: "ov-knock", x: cx - pw / 2 - 2.5, y: py - 2.5, width: pw + 5, height: ph + 5, rx: 8.5 }),
          s("rect", { class: "ov-pill", x: cx - pw / 2, y: py, width: pw, height: ph, rx: 6 }));
      } else {
        const kw = textW(vtxt, fsV, 620) + 8, kt = vy - fsV * 0.8 - 3;
        val.append(s("rect", { class: "ov-knock", x: cx - kw / 2, y: kt, width: kw, height: vy + 3.5 - kt, rx: 4 }));
      }
      val.append(s("text", { class: ["ov-vtext", m.recommended && "ov-vrec"], x: cx, y: vy, "text-anchor": "middle",
        "font-size": fsV }, vtxt));
      g.append(s("g", { class: "ov-fade", style: fade, "aria-hidden": "true" }, val));
      // 95% interval whisker, shown on hover
      const ci = hasCI ? ciOf(m) : null;
      if (ci) {
        const ylo = yOf(ci[0]), yhi = yOf(ci[1]), cap = Math.min(8, bw * 0.22);
        const seg = (x1, y1, x2, y2) => [s("line", { class: "ov-ci-halo", x1, y1, x2, y2 }), s("line", { x1, y1, x2, y2 })];
        g.append(s("g", { class: "ov-ci", "aria-hidden": "true" },
          seg(cx, ylo, cx, yhi), seg(cx - cap, ylo, cx + cap, ylo), seg(cx - cap, yhi, cx + cap, yhi),
          s("text", { x: cx, y: yhi - 8, "text-anchor": "middle" }, `${fmt.num(ci[0], 1)}–${fmt.num(ci[1], 1)}`)));
      }
      // model label under the bar; references end in a small "cloud" tag next to the bar
      const ax = cx + fsL * 0.3, ay = base + 14, rot = `rotate(${-ROT} ${ax.toFixed(1)} ${ay})`;
      const name = [labs[i].main, labs[i].part ? s("tspan", { class: "ov-xpart" }, labs[i].part) : null];
      if (r.ref) {
        const tx = ax - tagW, mid = ay - fsL * 0.34, th = Math.round(fsL + 2);
        g.append(s("g", { transform: rot },
          s("text", { class: "ov-xlab", x: tx - 4, y: ay, "text-anchor": "end", "font-size": fsL }, name),
          s("rect", { class: "ov-tag", x: tx, y: mid - th / 2, width: tagW, height: th, rx: 3.5 }),
          s("text", { class: "ov-tagtext", x: tx + tagW / 2, y: mid, dy: "0.35em", "text-anchor": "middle", "font-size": fsTag }, "cloud")));
      } else {
        g.append(s("text", { class: ["ov-xlab", m.recommended && "ov-xrec"], x: ax, y: ay, "text-anchor": "end", "font-size": fsL,
          transform: rot }, name));
      }

      const show = (e) => {
        clear();
        svg.classList.add("ov-dim");
        g.classList.add("ov-hot");
        if (hasCI) tiedWith(rows, i).forEach((j) => groups[j] && groups[j].classList.add("ov-tied"));
        LB.tip.show(e, tipHtml(rows, i, mt));
      };
      g.addEventListener("mouseenter", show);
      g.addEventListener("mousemove", LB.tip.move);
      g.addEventListener("mouseleave", clear);
      g.addEventListener("focus", () => {
        const b = hit.getBoundingClientRect();
        show({ clientX: b.left + b.width / 2, clientY: b.top + 24 });
      });
      g.addEventListener("blur", clear);
      groups.push(g);
      svg.append(g);
    });
    chart.append(svg);
    return svg;
  }

  const WHERE = { "1gpu": "on a single GPU ", "2gpu": "on both GPUs ", offload: "with RAM / SSD offload " };
  function drawEmpty(chart, st, mt) {
    chart.textContent = "";
    const pl = LB.PLACEMENTS.find((p) => p.value === st.filter);
    const where = st.filter === "all" ? "" : WHERE[st.filter] || (pl ? `in “${pl.label}” ` : "");
    const pending = (D.models || []).filter((m) => m && LB.matchPlacement(m, st.filter) && m.status && m.status !== "done").length;
    chart.append(h("div", { class: "ov-empty" },
      h("b", {}, `No model ${where}has a ${mt.label} score yet.`),
      pending ? h("span", {}, `${pending} run${pending === 1 ? " is" : "s are"} queued or in progress. `,
        h("a", { href: "#in-progress" }, "See what's running ↗")) : null));
  }

  /** refsOn: references are part of this chart (toggle on, "Compare all"). */
  function fillFoot(foot, rows, st, mt, refsOn) {
    foot.textContent = "";
    const local = rows.filter((r) => !r.ref), nRef = rows.length - local.length, nLocal = local.length;
    const scored = (D.models || []).filter((m) => m && LB.matchPlacement(m, st.filter) && m.scores && isNum(m.scores.textCore)).length;
    const missing = mt.value === "textCore" ? 0 : Math.max(0, scored - nLocal);
    const swatch = () => h("i", { class: "ov-hatchkey", "aria-hidden": "true" });
    const refKey = !refsOn ? null : nRef
      ? h("span", { class: "ov-refkey" }, swatch(), "Cloud reference: same tasks via GitHub Copilot, not ranked with local setups")
      : h("span", { class: ["ov-refkey", "ov-refnone"] }, swatch(), "No cloud reference has this score yet");
    const count = nRef
      ? [h("b", {}, String(nLocal)), ` local model${nLocal === 1 ? "" : "s"} + `, h("b", {}, String(nRef)), ` cloud reference${nRef === 1 ? "" : "s"}`]
      : [h("b", {}, String(nLocal)), ` model${nLocal === 1 ? "" : "s"} shown`];
    foot.append(
      h("span", {}, mt.note),
      h("span", { class: "ov-count" }, refKey,
        rows.some((r) => r.m.recommended) ? h("span", { class: "ov-key" }, h("i", { "aria-hidden": "true" }, "★"), "Our pick") : null,
        h("span", {}, count, missing ? ` · ${missing} not run on this suite` : "")));
  }

  /** LB.select, with the options grouped (Overall / Core suites / Agentic). */
  function metricSelect(metrics, value, onChange) {
    const wrap = LB.select(metrics.map((x) => ({ value: x.value, label: x.label })), value, onChange);
    wrap.classList.add("ov-select");
    const sel = wrap.querySelector("select");
    if (sel) {
      sel.setAttribute("aria-label", "Metric");
      const groups = new Map();
      for (const opt of Array.from(sel.options)) {
        const mt = metrics.find((x) => x.value === opt.value);
        const name = (mt && mt.group) || "";
        if (!groups.has(name)) { const og = document.createElement("optgroup"); og.label = name; groups.set(name, og); }
        groups.get(name).appendChild(opt);
      }
      for (const og of groups.values()) sel.appendChild(og);
      sel.value = value;
    }
    return wrap;
  }

  function render(el) {
    const metrics = metricList();
    const st = { filter: "all", metric: "textCore", refs: true };
    const anyRefs = (D.models || []).some((m) => m && m.reference);
    const meta = (k) => metrics.find((x) => x.value === k) || metrics[0];
    const sub = h("p", { class: "ov-sub" }, meta(st.metric).sub);
    const chart = h("div", { class: "ov-chart" });
    const foot = h("div", { class: ["lb-card-foot", "ov-foot"] });
    const seg = LB.seg(LB.PLACEMENTS, st.filter, (v) => { st.filter = v; update("now"); });
    seg.setAttribute("aria-label", "Where the model runs");
    const sel = metricSelect(metrics, st.metric, (v) => { st.metric = v; sub.textContent = meta(v).sub; update("now"); });
    const toggle = anyRefs ? h("button", { class: "ov-reftoggle", type: "button", role: "switch", "aria-checked": "true",
      onclick: () => { st.refs = !st.refs; toggle.setAttribute("aria-checked", String(st.refs)); update("none"); } },
      h("span", { class: "ov-switch", "aria-hidden": "true" }), "Cloud references") : null;
    el.append(LB.card("ov-card",
      h("div", { class: ["lb-card-head", "ov-head"] },
        h("div", { class: "ov-title" }, h("h3", {}, "Best Overall"), sub),
        h("div", { class: "ov-controls" }, h("div", { class: "ov-ctl-row" }, seg, sel), toggle)),
      chart, foot));

    let played = false, io = null, lastW = -1;
    function update(anim) {
      if (io) { io.disconnect(); io = null; }
      LB.tip.hide();
      const mt = meta(st.metric);
      // cloud references join the bars only with "Compare all": the placement filters are about local setups
      const refsOn = anyRefs && st.refs && st.filter === "all";
      if (toggle) {
        toggle.disabled = st.filter !== "all";
        toggle.title = toggle.disabled ? "Cloud references appear with Compare all"
          : "Closed cloud models that took the same tasks, shown as hatched bars";
      }
      const rows = rowsFor(st.metric, st.filter, refsOn);
      lastW = chart.clientWidth;
      fillFoot(foot, rows, st, mt, refsOn);
      if (!rows.length) { drawEmpty(chart, st, mt); return; }
      const svg = drawBars(chart, rows, mt);
      if (anim === "none" || reduceMotion()) return;
      // bars grow from the baseline: on first sight (IntersectionObserver), or right away after a filter change.
      // A timer then pins the final state, so slow or throttled frame clocks (background tabs, headless) never leave bars short.
      svg.classList.add("ov-pre");
      const go = () => {
        played = true;
        requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove("ov-pre")));
        setTimeout(() => { svg.classList.add("ov-done"); svg.classList.remove("ov-pre"); }, 1900);
      };
      if (anim === "io" && "IntersectionObserver" in window) {
        io = new IntersectionObserver((ents) => {
          if (ents.some((e) => e.isIntersecting)) { io.disconnect(); io = null; go(); }
        }, { threshold: 0.2 });
        io.observe(svg);
      } else go();
    }
    update("io");
    const relayout = () => { if (chart.clientWidth && chart.clientWidth !== lastW) update(played ? "none" : "io"); };
    LB.onResize(relayout);
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(relayout)).observe(chart);
    whenFontLoads(() => update(played ? "none" : "io"));
  }

  LB.register({ id: "overall", order: 20, nav: "Overall", render });
})();
