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
  const coreKeys = () => (D.core && D.core.suites) || [];
  const suiteName = (k) => (LB.suite(k) || {}).name || k;
  /** Core suites a model has no score for (usually vision): its "All suites" mean covers only the others. */
  function missingCore(m) {
    const sc = (m && m.scores && m.scores.suites) || {};
    return coreKeys().filter((k) => !isNum(sc[k]));
  }
  /** Tag for an "All suites" bar that skipped a core suite. */
  function skipTag(m) {
    const miss = missingCore(m), n = coreKeys().length;
    if (!miss.length) return null;
    return miss.length === 1 && miss[0] === "vision" ? "no vision" : `${n - miss.length}/${n} suites`;
  }
  function skipNote(m) {
    const miss = missingCore(m);
    if (!miss.length) return "";
    const same = m.scores && isNum(m.scores.allSuites) && m.scores.allSuites === m.scores.textCore;
    return `${joinAnd(miss.map(suiteName))} not run: the mean of the other ${coreKeys().length - miss.length} core suites` +
      (same ? ", same as its text core." : ".");
  }
  function metricList() {
    const core = D.core || {};
    const nText = (core.textSuites || []).length, nAll = (core.suites || []).length;
    const qs = (n) => (isNum(n) ? `the same ${n} questions` : "the same questions");
    const PARTIAL = "Partial = scored on fewer tasks.";
    const note = `Scores run 0–100; equal scores are ordered by text core. ${PARTIAL}`;
    // setups that skipped a core suite (vision, so far) get a tag in the "All suites" view
    const skips = (D.models || []).filter((m) => m && m.scores && isNum(m.scores.allSuites) && missingCore(m).length);
    const noVision = skips.every((m) => skipTag(m) === "no vision");
    const skipText = !skips.length ? " Hover a bar for details."
      : noVision && skips.every((m) => m.scores.allSuites === m.scores.textCore)
        ? " Bars tagged “no vision” skipped vision, so their score equals their text core."
        : noVision ? ` Bars tagged “no vision” skipped vision, so their score covers the other ${nAll - 1} suites.`
          : " Tagged bars skipped a suite, so their score covers fewer suites.";
    const out = [
      { value: "textCore", label: "Text core", group: "Overall", note: `Overlapping 95% intervals = statistically tied. ${PARTIAL}`,
        sub: `Text core: the mean of ${nText || "the"} text suites on ${qs(core.textTasks)}. Hover a bar for its 95% interval.` },
      { value: "allSuites", label: "All suites (incl. vision)", group: "Overall", note,
        sub: `All suites: the mean of ${nAll || "all"} core suites on ${qs(core.tasks)}, vision included.${skipText}` },
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
    const sk = mt.value === "allSuites" ? skipNote(m) : "";
    const skLine = sk ? `<br><span class="muted">${sk}</span>` : "";
    if (rows[i].ref) {
      return LB.modelTip(m, (mt.value === "textCore" ? "" : `${mt.label} <b>${fmt.num(v, 1)}</b>${skLine}<br>`) + REF_NOTE);
    }
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
      extra = `${mt.label} <b>${fmt.num(v, 1)}</b> · ${rank.toLowerCase()}` + (d ? `<br><span class="muted">${d}</span>` : "") + skLine;
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
    const tagW = (t) => Math.ceil(textW(t, fsTag, 600) + 9);
    // tags after the name: "no vision" (All suites view) and "cloud" (references), the last one closest to the bar
    const labs = rows.map((r) => ({ main: LB.label(r.m), part: r.m.partial ? " · partial" : "",
      tags: [mt.value === "allSuites" && skipTag(r.m), r.ref && "cloud"].filter(Boolean) }));
    const labW = labs.map((l) => textW(l.main, fsL, 460) + (l.part ? textW(l.part, fsL, 600) : 0) +
      l.tags.reduce((a, t) => a + tagW(t) + 4, 0));
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
          `: ${mt.label} ${fmt.num(v, 1)}` + (m.partial ? ", partial run" : "") +
          (mt.value === "allSuites" && missingCore(m).length ? `, ${joinAnd(missingCore(m).map(suiteName))} not run` : "") +
          (m.recommended ? ", our pick" : ""),
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
      // model label under the bar, then its tags ("no vision", "cloud") next to the bar
      const ax = cx + fsL * 0.3, ay = base + 14;
      const name = [labs[i].main, labs[i].part ? s("tspan", { class: "ov-xpart" }, labs[i].part) : null];
      const lab = s("g", { transform: `rotate(${-ROT} ${ax.toFixed(1)} ${ay})` });
      const mid = ay - fsL * 0.34, th = Math.round(fsL + 2);
      let tx = ax;
      for (const t of labs[i].tags.slice().reverse()) {
        const w = tagW(t), cloud = t === "cloud";
        tx -= w;
        lab.append(s("rect", { class: ["ov-tag", !cloud && "ov-tag-skip"], x: tx, y: mid - th / 2, width: w, height: th, rx: 3.5 }),
          s("text", { class: ["ov-tagtext", !cloud && "ov-tagtext-skip"], x: tx + w / 2, y: mid, dy: "0.35em", "text-anchor": "middle",
            "font-size": fsTag }, t));
        tx -= 4;
      }
      lab.prepend(s("text", { class: ["ov-xlab", m.recommended && "ov-xrec"], x: tx, y: ay, "text-anchor": "end", "font-size": fsL }, name));
      g.append(lab);

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
        h("a", { href: "#in-progress" }, "See what's running ↓")) : null));
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
    const wrap = LB.select(metrics.map((x) => ({ value: x.value, label: x.label })), value, onChange, "Metric");
    wrap.classList.add("ov-select");
    const sel = wrap.querySelector("select");
    if (sel) {
      if (!sel.hasAttribute("aria-label")) sel.setAttribute("aria-label", "Metric");
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

  // ---------- highlight tiles + verdict panel (the summary at the top of the benchmark report) ----------
  const isLocal = (m) => !!m && !m.reference;
  const hasCore = (m) => !!(m && m.scores && isNum(m.scores.textCore));
  const tc = (m) => (hasCore(m) ? m.scores.textCore : -1);
  /** Our pick: the exported verdict's pick; without one, the fastest top-tier setup (task time, then decode). */
  function pickId() {
    const p = D.verdict && D.verdict.pick;
    if (p && hasCore(LB.byId(p))) return p;
    const t = (m) => (m.speed && isNum(m.speed.taskTime) ? m.speed.taskTime : Infinity);
    const dec = (m) => (m.speed && isNum(m.speed.decode) ? m.speed.decode : 0);
    const { lead, tier } = topTier();
    const all = tier.length ? tier : lead ? [lead] : [];
    const own = all.filter((m) => !m.engineOf);           // an engine variant isn't a pick of its own
    const pool = (own.length ? own : all).slice().sort((a, b) => t(a) - t(b) || dec(b) - dec(a));
    return pool.length ? pool[0].id : null;
  }
  /** Same convention as the model table: a model opens head-to-head against our pick (the pick against the next best). */
  function compareFor(m) {
    const p = pickId();
    const other = p && p !== m.id ? p : ((LB.quality("all").find((x) => x.id !== m.id) || {}).id);
    LB.openCompare(m.id, other);
  }
  /** The local, scored model with the best value of fn (ties go to the better text core). */
  function leader(fn, lowerBetter, ok) {
    let best = null, bv = null;
    for (const m of D.models || []) {
      if (!isLocal(m) || !hasCore(m) || (ok && !ok(m))) continue;
      const v = fn(m);
      if (!isNum(v) || (lowerBetter && v <= 0)) continue;
      if (!best || (lowerBetter ? v < bv : v > bv) || (v === bv && tc(m) > tc(best))) { best = m; bv = v; }
    }
    return best ? { m: best, v: bv } : null;
  }
  /** Agent fix loop: median time to the first correct fix (solved runs only); the median wall time per task only when that is missing. */
  const agentFix = (m) => (isNum(m.agentFixS) ? m.agentFixS : m.suiteTimeS ? m.suiteTimeS.agent_e2e : null);
  const TILES = [
    // the same leader as the verdict's top tier: every local setup with a text core
    { label: "Best text core score", find: () => leader((m) => m.scores.textCore, false),
      value: (v) => fmt.pct(v), unit: "%", extra: (m) => (m.partial ? "partial" : null) },
    { label: "Fastest decode", find: () => leader((m) => m.speed && m.speed.decode, false),
      value: (v) => fmt.tps(v), unit: "tok/s" },
    { label: "Fastest core task time", find: () => leader((m) => m.speed && m.speed.taskTime, true),
      value: (v) => fmt.num(v, 1), unit: "s / task" },
    { label: "Fastest correct agent fix", note: "(≥90% solved)",
      find: () => leader(agentFix, true, (m) => isNum(LB.score(m, "agent_e2e")) && LB.score(m, "agent_e2e") >= 90),
      value: (v) => fmt.num(v, 1),
      unit: (m) => (isNum(m.agentFixS) ? "s to a correct fix" : "s per task"),
      hint: (m) => (isNum(m.agentFixS) ? "Median time to the first correct fix in the agent fix loop, solved runs only"
        : "Median wall time per task in the agent fix loop (time to a correct fix not recorded)"),
      extra: (m) => `${fmt.pct(LB.score(m, "agent_e2e"), 0)}% solved` },
  ];
  const arrowIcon = () => s("svg", { class: "ov-arrow", width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor",
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, s("path", { d: "M4.5 9.5l5-5M5.5 4.5h4v4" }));
  const subOf = (m) => [m.variant, m.where].filter(Boolean).join(" · ");
  function highlightTiles() {
    return h("div", { class: "ov-tiles", role: "group", "aria-label": "Highlights: the leaders among local setups" }, TILES.map((t) => {
      const r = t.find();
      const label = h("span", { class: "ov-tile-label" }, h("span", {}, t.label, t.note ? [" ", h("small", {}, t.note)] : null), r ? arrowIcon() : null);
      if (!r) {
        return h("div", { class: ["ov-tile", "ov-tile-empty"] }, label, h("span", { class: "ov-tile-val" }, "—"),
          h("span", { class: "ov-tile-sub" }, "Not measured yet"));
      }
      const m = r.m, val = t.value(r.v), sub = [subOf(m), t.extra ? t.extra(m) : null].filter(Boolean).join(" · ");
      const unit = typeof t.unit === "function" ? t.unit(m) : t.unit;
      const hint = t.hint ? t.hint(m) : "";
      return h("button", { type: "button", class: "ov-tile", title: (hint ? hint + ". " : "") + "Click to compare head-to-head.",
        "aria-label": `${t.label}${t.note ? " " + t.note : ""}: ${LB.fullName(m)}, ${val} ${unit}` + (hint ? ` (${hint.toLowerCase()})` : "") +
          ". Opens a head-to-head comparison.",
        onclick: () => compareFor(m) },
        label,
        h("span", { class: "ov-tile-val" }, val, h("small", {}, unit)),
        h("span", { class: "ov-tile-model" }, LB.mono(m, 24),
          h("span", { class: "ov-tile-name" }, h("b", {}, m.name), h("span", { class: "ov-tile-sub" }, sub))));
    }));
  }

  const gpuName = (g) => String((g && g.name) || "").replace(/^NVIDIA\s+/, "").replace(/^GeForce\s+/, "").replace(/\s+Blackwell$/, "");
  /** Top tier = local setups whose text core is inside the leader's 95% interval: the same rule as the verdict sentence. */
  function topTier() {
    const scored = LB.quality("all");
    const lead = scored[0];
    if (!lead) return { lead: null, ci: null, tier: [] };
    const ci = ciOf(lead);
    return { lead, ci, tier: ci ? scored.filter((m) => m.scores.textCore >= ci[0]) : [] };
  }
  const prefill32 = (m) => {
    const p = m.speed && m.speed.prefill;
    if (!p) return null;
    for (const k of ["32k", "64k", "8k"]) if (isNum(p[k])) return { v: p[k], at: k.toUpperCase() };
    return null;
  };
  /** Rank of m within list on fn (1 = best, ties share it); null when m has no value. */
  function rankIn(list, m, fn, lowerBetter) {
    const mine = fn(m);
    if (!isNum(mine)) return null;
    return 1 + list.filter((x) => x !== m && isNum(fn(x)) && (lowerBetter ? fn(x) < mine : fn(x) > mine)).length;
  }
  function joinAnd(list) {
    return list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }
  const joinZh = (list) => (list.length < 2 ? list.join("") : list.slice(0, -1).join("、") + "和" + list[list.length - 1]);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const ciNum = (v) => (v >= 99.95 ? "100" : fmt.num(v, 1));
  /** Engine of a variant that runs another setup's weights: "Q4 · Basalt engine" → "Basalt". */
  function engineName(v) {
    const seg = String(v.variant || "").split(" · ").find((x) => /\bengine$/i.test(x));
    return seg ? seg.replace(/\s*engine$/i, "") : LB.label(v);
  }
  /** The pick's own weights on other inference engines with a measured decode, fastest first. */
  function pickEngines(pick, T) {
    return (D.models || []).filter((m) => m && m.engineOf === pick.id && m.speed && isNum(m.speed.decode))
      .sort((a, b) => b.speed.decode - a.speed.decode)
      .map((m) => {
        const textOnly = /\btext[- ]only\b/i.test(m.notes || "") ||
          (hasCore(m) && !isNum(LB.score(m, "vision")) && isNum(LB.score(pick, "vision")));
        return { name: engineName(m), dec: fmt.tps(m.speed.decode), q: textOnly ? T.textOnly : m.speedOnly ? T.speedOnly : "" };
      });
  }

  /** Verdict panel copy: English, or Chinese while its 中文 toggle is on (the rest of the page stays English). */
  const VT = {
    en: {
      lang: "en", title: "Verdict & recommendations", why: "Why this pick", star: "★ Our pick", details: "Details ↓",
      compare: "Compare head-to-head", tierHead: "Top-tier quality", qualityHead: "Quality",
      tier: (n, lo, hi) => (n === 1 ? `Only the leader scores inside its 95% interval (${lo}–${hi}):`
        : `${n} local setups score inside the leader's 95% interval (${lo}–${hi}):`),
      noCI: "The leader has no 95% interval yet.",
      below: (name, v) => ` ${name} scores ${v}, below that range.`,
      fastest: "Fastest of the top tier", fastestOn: (xs) => `Fastest of the top tier on ${joinAnd(xs)}`,
      tierSpeed: "Speed inside the top tier", speed: "Speed",
      on: { decode: "decode", prefill: "prefill", task: "task time" },
      decode: "decode", prefill: (at) => (at ? `prefill @ ${at}` : "prefill"), task: "median per task", sec: "s",
      engines: (xs) => (xs.length === 1 ? `Same weights on the ${xs[0].name} engine: ${xs[0].dec} tok/s${xs[0].q ? ` (${xs[0].q})` : ""}.`
        : `Same weights on other engines: ${xs.map((e) => `${e.name} ${e.dec} tok/s${e.q ? ` (${e.q})` : ""}`).join(", ")}.`),
      textOnly: "text only", speedOnly: "speed test only",
      oneGpu: "One GPU", bothGpus: "Both GPUs", hardware: "Hardware",
      alone: (gpu, gib, free) => `Runs on the ${gpu} alone (${gib} GiB), leaving the ${joinAnd(free)} free for a second model.`,
      oneOf: (where) => `Runs on one GPU${where ? ` (${where})` : ""}, leaving the other free for a second model.`,
      split: (where) => `Splits across both GPUs${where ? ` (${where})` : ""}.`,
      agentic: "Agentic results", suite: (k) => (LB.suite(k) || {}).name || AGENTIC[k] || k,
      rr: (n, runs, tasks) => [isNum(n) ? `${n}/${runs} runs` : "", isNum(tasks) ? plural(tasks, "task") : ""],
      db: (n, runs) => [isNum(n) ? `${n}/${runs} bugs fixed` : ""],
      lh: (p, t, sess) => [isNum(p) && isNum(t) ? `${p}/${t} stages` : "", isNum(sess) ? plural(sess, "session") : ""],
      notRun: "Not run yet for this model.",
      endurance: "Endurance", min: " min", load: "continuous load", requests: "requests",
      errors: (n) => (n === 1 ? "error" : "errors"), ratio: "late vs early speed",
      steady: "No slowdown over the run", slowed: (p) => `Slowed to ${p}% of its early speed`,
      ctx: (k) => `, with context up to ${k}K tokens.`, end: ".", noEndurance: "No endurance run for this model yet.",
      keys: "Other findings", tones: { recommended: "Recommended", works: "Works", avoid: "Avoid", note: "Note" },
      newTab: "opens in a new tab",
    },
    zh: {
      lang: "zh-CN", title: "结论与建议", why: "为什么选它", star: "★ 主力", details: "详情 ↓",
      compare: "一对一对比", tierHead: "质量第一梯队", qualityHead: "质量",
      tier: (n, lo, hi) => (n === 1 ? `只有第一名自己落在这个 95% 置信区间内（${lo}–${hi}）：`
        : `有 ${n} 个本地配置落在第一名的 95% 置信区间内（${lo}–${hi}）：`),
      noCI: "第一名还没有 95% 置信区间。",
      below: (name, v) => `${name} 得分 ${v}，在这个区间以下。`,
      fastest: "第一梯队里最快", fastestOn: (xs) => `第一梯队里${joinZh(xs)}最快`,
      tierSpeed: "第一梯队里的速度", speed: "速度",
      on: { decode: "生成", prefill: "预填充", task: "单题耗时" },
      decode: "生成", prefill: (at) => (at ? `预填充 @ ${at}` : "预填充"), task: "单题中位耗时", sec: "秒",
      engines: (xs) => (xs.length === 1 ? `同一套权重换 ${xs[0].name} 引擎：${xs[0].dec} tok/s${xs[0].q ? `（${xs[0].q}）` : ""}。`
        : `同一套权重换其他引擎：${xs.map((e) => `${e.name} ${e.dec} tok/s${e.q ? `（${e.q}）` : ""}`).join("、")}。`),
      textOnly: "仅文本", speedOnly: "只测了速度",
      oneGpu: "单卡", bothGpus: "双卡", hardware: "硬件",
      alone: (gpu, gib, free) => `只占 ${gpu}（${gib} GiB），${joinZh(free)} 空出来跑第二个模型。`,
      oneOf: (where) => `单卡运行${where ? `（${where}）` : ""}，另一张卡空出来跑第二个模型。`,
      split: (where) => `分在两张卡上跑${where ? `（${where}）` : ""}。`,
      agentic: "Agent 任务",
      suite: (k) => ({ repo_replay: "真实仓库修 bug", debug: "调试", long_horizon: "长程会话" })[k] || VT.en.suite(k),
      rr: (n, runs, tasks) => [isNum(n) ? `${n}/${runs} 次通过` : "", isNum(tasks) ? `${tasks} 道题` : ""],
      db: (n, runs) => [isNum(n) ? `修好 ${n}/${runs} 个 bug` : ""],
      lh: (p, t, sess) => [isNum(p) && isNum(t) ? `${p}/${t} 个阶段` : "", isNum(sess) ? `${sess} 个会话` : ""],
      notRun: "这个模型还没跑这些测试。",
      endurance: "耐久测试", min: " 分钟", load: "连续高负载", requests: "次请求",
      errors: () => "报错", ratio: "后段 / 前段速度",
      steady: "全程没有变慢", slowed: (p) => `后段速度降到前段的 ${p}%`,
      ctx: (k) => `，上下文最长 ${k}K tokens。`, end: "。", noEndurance: "这个模型还没做耐久测试。",
      keys: "其他结论", tones: { recommended: "推荐", works: "可用", avoid: "不建议", note: "备注" },
      newTab: "在新标签页打开",
    },
  };

  /** A key finding's text in the panel's language (the exporter sends {en, zh} objects; plain strings pass through). */
  const loc = (o, lang) => (o && typeof o === "object" ? o[lang] || o.en || "" : o == null ? "" : String(o));
  const TONE_ICON = { recommended: "M3.5 8.5l3 3 6-7", works: "M4 8h8", avoid: "M4.5 4.5l7 7M11.5 4.5l-7 7" };
  /** Verdict chip in the Hardware section's look, on the shared .lb-chip colours (Recommended = lime, Avoid = warn). */
  function toneChip(tone, T) {
    const tones = T.tones || {};
    return h("span", { class: ["lb-chip", "ov-v-tone", tone === "recommended" && "lime", tone === "avoid" && "warn"] },
      TONE_ICON[tone] ? s("svg", { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": 2.2,
        "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, s("path", { d: TONE_ICON[tone] })) : null,
      tones[tone] || tones.note || String(tone || ""));
  }

  function verdictPanel() {
    const V = D.verdict || {};
    const pick = LB.byId(pickId());
    if (!pick) return null;
    // key findings from the exporter: "engine" and "second-gpu" go inside "Why this pick", the rest form one row
    const F = (Array.isArray(V.findings) ? V.findings : []).filter((f) => f && f.title && f.text);
    const fEngine = F.find((f) => f.key === "engine");
    const fGpu = F.find((f) => f.key === "second-gpu");
    const fRow = F.filter((f) => f !== fEngine && f !== fGpu).slice(0, 3);
    const { lead, ci, tier } = topTier();
    const inTier = tier.includes(pick), multi = inTier && tier.length > 1;
    const sp = pick.speed || {};
    const pf = prefill32(pick);
    // engine variants (the same weights on another inference engine) can sit in the tier but don't count as faster setups
    const rivals = tier.filter((m) => m === pick || !m.engineOf);
    const rDec = rankIn(rivals, pick, (m) => m.speed && m.speed.decode, false);
    const rTask = rankIn(rivals, pick, (m) => m.speed && m.speed.taskTime, true);
    const rPre = pf ? rankIn(rivals, pick, (m) => { const x = prefill32(m); return x && x.at === pf.at ? x.v : null; }, false) : null;
    // "fastest" as in the verdict sentence: the best decode and the best task time inside the top tier
    const fastest = multi && rDec === 1 && rTask === 1;
    const firsts = multi ? [rDec === 1 && "decode", rPre === 1 && "prefill", rTask === 1 && "task"].filter(Boolean) : [];
    const gpus = (D.hardware && D.hardware.gpus) || [];
    const vram = Array.isArray(pick.vramGiB) ? pick.vramGiB : null;
    const used = vram ? vram.map((v, i) => (isNum(v) && v > 0.5 ? i : -1)).filter((i) => i >= 0) : [];
    const ag = pick.agentic || {}, en = pick.endurance, col = LB.vendor(pick).color;

    let lang = "en";
    const title = h("h3", {});
    const body = h("div", { class: "ov-v-body" });
    const seg = LB.seg([{ value: "en", label: "EN" }, { value: "zh", label: "中文" }], lang, (v) => { lang = v; paint(); });
    seg.classList.add("ov-v-lang");
    seg.setAttribute("aria-label", "Verdict language");

    function paint() {
      const T = VT[lang] || VT.en;
      title.lang = body.lang = T.lang;
      title.textContent = T.title;
      const text = (V.headline && loc(V.headline, lang)) || (typeof V[lang] === "string" && V[lang] ? V[lang] : null);

      // why this pick: the top tier, the pick's speed inside it, and the GPU it needs
      const chip = (m) => h("button", { type: "button", class: ["ov-v-chip", m === pick && "ov-v-chip-pick"], title: T.compare,
        onclick: () => compareFor(m) }, LB.mono(m, 18), h("span", {}, LB.label(m)), h("b", {}, fmt.pct(m.scores.textCore)));
      const speedFacts = [
        { label: T.decode, val: fmt.tps(sp.decode), unit: "tok/s", r: rDec },
        { label: T.prefill(pf && pf.at), val: pf ? fmt.tps(pf.v) : "—", unit: "tok/s", r: rPre },
        { label: T.task, val: fmt.num(sp.taskTime, 1), unit: T.sec, r: rTask },
      ];
      const speedHead = !multi ? T.speed : fastest ? T.fastest : firsts.length ? T.fastestOn(firsts.map((k) => T.on[k])) : T.tierSpeed;
      // the Basalt upgrade has its own block below the stats; the plain line for other engines shows only without it
      const engines = fEngine ? [] : pickEngines(pick, T);
      const extLink = (f) => (f.link && f.link.url ? h("a", { class: "ov-v-ext", href: f.link.url, target: "_blank", rel: "noopener",
        "aria-label": `${loc(f.link.label, lang)} (${T.newTab})` }, loc(f.link.label, lang), " ↗") : null);
      /** A recommendation inside "Why this pick": title, one line of numbers, then the about line (project link and
       *  "Details ↓" to the section with the full numbers) or a trailing action. */
      const detailsOf = (f) => (typeof f.href === "string" && f.href.charAt(0) === "#" ? secLink(f.href.slice(1), T.details) : null);
      const upBlock = (f, lead, tail) => {
        const links = [extLink(f), detailsOf(f)].filter(Boolean);
        const linkRow = links.length ? h("span", { class: "ov-v-uplinks" }, links) : null;
        return h("div", { class: "ov-v-up" },
          h("div", { class: "ov-v-uphead" }, lead || null, h("b", {}, loc(f.title, lang))),
          h("p", {}, loc(f.text, lang)),
          f.about ? h("p", { class: "ov-v-about" }, loc(f.about, lang), " ", linkRow) : linkRow ? h("p", { class: "ov-v-about" }, linkRow) : null,
          tail || null);
      };
      const gm = fGpu && fGpu.model ? LB.byId(fGpu.model) : null;
      const gpuUp = fGpu ? upBlock(fGpu, null,
        gm ? h("button", { type: "button", class: "ov-v-linkbtn", onclick: () => compareFor(gm) }, T.compare + " →") : null) : null;
      let gpuHead = T.hardware, gpuText = pick.where || "—";
      if (used.length === 1 && gpus.length > 1 && gpus[used[0]]) {
        gpuHead = T.oneGpu;
        gpuText = T.alone(gpuName(gpus[used[0]]), fmt.num(vram[used[0]], 1), gpus.filter((_, i) => i !== used[0]).map(gpuName));
      } else if (pick.placement === "1gpu") {
        gpuHead = T.oneGpu;
        gpuText = T.oneOf(pick.where);
      } else if (pick.placement === "2gpu") {
        gpuHead = T.bothGpus;
        gpuText = T.split(pick.where);
      }
      const why = h("div", { class: ["ov-v-col", "ov-v-why"] },
        h("div", { class: "ov-v-whyhead" }, h("h4", {}, T.why),
          h("span", { class: "ov-v-pick" }, h("span", { class: "ov-v-star" }, T.star), LB.mono(pick, 20),
            h("b", {}, LB.fullName(pick)), pick.where ? h("span", {}, pick.where) : null)),
        h("div", { class: "ov-v-facts" },
          lead ? h("div", { class: "ov-v-item" },
            h("b", {}, inTier ? T.tierHead : T.qualityHead),
            h("p", {}, ci ? T.tier(tier.length, ciNum(ci[0]), ciNum(ci[1])) : T.noCI,
              ci && !inTier ? T.below(LB.label(pick), fmt.pct(pick.scores.textCore)) : null),
            h("div", { class: "ov-v-chips" }, (tier.length ? tier : [pick]).map(chip))) : null,
          h("div", { class: "ov-v-item" }, h("b", {}, speedHead),
            h("div", { class: "ov-v-stats" }, speedFacts.map((f) => h("span", { class: ["ov-v-stat", multi && f.r === 1 && "ov-v-first"] },
              h("b", {}, f.val, f.val !== "—" ? h("small", {}, " " + f.unit) : null), h("span", {}, f.label)))),
            fEngine ? upBlock(fEngine) : null,
            engines.length ? h("p", { class: "ov-v-engine" }, T.engines(engines)) : null),
          h("div", { class: "ov-v-item" }, h("b", {}, gpuHead), h("p", {}, gpuText), gpuUp)));

      // the pick's agentic results
      const passed = (a) => (isNum(a.runs) ? Math.round((a.rate * a.runs) / 100) : null);
      const agRows = [];
      const rr = ag.repo_replay, db = ag.debug, lh = ag.long_horizon;
      if (rr && isNum(rr.rate)) agRows.push({ key: "repo_replay", rate: rr.rate, detail: T.rr(passed(rr), rr.runs, rr.tasks) });
      if (db && isNum(db.rate)) agRows.push({ key: "debug", rate: db.rate, detail: T.db(passed(db), db.runs) });
      if (lh && isNum(lh.rate)) agRows.push({ key: "long_horizon", rate: lh.rate, detail: T.lh(lh.stagesPassed, lh.stagesTotal, lh.sessions) });
      const agentic = h("div", { class: ["ov-v-col", "ov-v-agentic"] },
        h("h4", {}, T.agentic, secLink("agentic", T.details)),
        agRows.length ? h("div", { class: "ov-v-rows" }, agRows.map((r) => h("div", { class: "ov-v-row" },
          h("span", { class: "ov-v-rtop" }, h("span", { class: "ov-v-rname" }, T.suite(r.key)), h("b", {}, fmt.pct(r.rate, 0), h("small", {}, "%"))),
          h("span", { class: "ov-v-rdetail" }, r.detail.filter(Boolean).join(" · ")), LB.bar(r.rate / 100, col))))
          : h("p", { class: "ov-v-none" }, T.notRun));

      // the pick's endurance run
      const sr = en && en.sustainRatio;
      const endurance = h("div", { class: ["ov-v-col", "ov-v-endurance"] },
        h("h4", {}, T.endurance, secLink("endurance", T.details)),
        en ? [
          h("div", { class: ["ov-v-stats", "ov-v-stats-4"] },
            h("span", { class: "ov-v-stat" }, h("b", {}, fmt.int(en.minutes), h("small", {}, T.min)), h("span", {}, T.load)),
            h("span", { class: "ov-v-stat" }, h("b", {}, fmt.int(en.requests)), h("span", {}, T.requests)),
            h("span", { class: ["ov-v-stat", en.errors === 0 && "ov-v-good"] }, h("b", {}, fmt.int(en.errors)), h("span", {}, T.errors(en.errors))),
            h("span", { class: ["ov-v-stat", isNum(sr) && sr >= 0.97 && "ov-v-good"] }, h("b", {}, isNum(sr) ? fmt.num(sr, 2) + "×" : "—"),
              h("span", {}, T.ratio))),
          isNum(sr) ? h("p", {}, (sr >= 0.97 ? T.steady : T.slowed(fmt.pct(sr * 100, 0))) +
            (isNum(en.nCtx) ? T.ctx(Math.round(en.nCtx / 1024)) : T.end)) : null,
        ] : h("p", { class: "ov-v-none" }, T.noEndurance));

      // the other key findings: one row in the same grid rhythm as "Why this pick"
      /** A second in-page link (e.g. "Frontier gap ↑" to a section above), next to "Details ↓". */
      const seeOf = (f) => (f.see && typeof f.see.href === "string" && f.see.href.charAt(0) === "#"
        ? secLink(f.see.href.slice(1), loc(f.see.label, lang)) : null);
      const keyItem = (f) => h("div", { class: "ov-v-key", role: "listitem" },
        h("div", { class: "ov-v-keytop" },
          h("span", { class: "ov-v-keyval" }, h("b", {}, String(f.value == null ? "" : f.value)),
            f.unit ? h("small", {}, " " + loc(f.unit, lang)) : null),
          toneChip(f.tone, T)),
        h("b", { class: "ov-v-keytitle" }, loc(f.title, lang)),
        h("p", {}, loc(f.text, lang)),
        seeOf(f) ? h("span", { class: "ov-v-keylinks" }, detailsOf(f), seeOf(f)) : detailsOf(f));
      const keys = fRow.length ? h("div", { class: ["ov-v-col", "ov-v-keys"] }, h("h4", {}, T.keys),
        h("div", { class: "ov-v-keygrid", role: "list" }, fRow.map(keyItem))) : null;

      body.textContent = "";
      body.append(...[text ? h("p", { class: "ov-v-headline" }, text) : null, why,
        h("div", { class: "ov-v-grid" }, agentic, endurance), keys].filter(Boolean));
    }
    paint();
    return LB.card("ov-verdict", h("div", { class: "ov-v-head", id: "verdict" }, title, seg), body);
  }
  /** Link to another section ("Details ↓"), only when that section exists on the page. */
  function secLink(id, text) {
    return (LB.sections || []).some((x) => x.id === id) ? h("a", { class: "ov-v-link", href: "#" + id }, text) : null;
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
    el.append(...[LB.sectionHead({ title: "Overall ranking and our pick",
      sub: "Every setup on the same questions from real daily work: the leaders, the full ranking, and which model to run " +
        "every day and why." }), highlightTiles(), LB.card("ov-card",
      h("div", { class: ["lb-card-head", "ov-head"] },
        h("div", { class: "ov-title" }, h("h3", {}, "Best Overall"), sub),
        h("div", { class: "ov-controls" }, h("div", { class: "ov-ctl-row" }, seg, sel), toggle)),
      chart, foot), verdictPanel()].filter(Boolean));

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
