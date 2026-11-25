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

  function rowsFor(metric, filter) {
    const rows = [];
    for (const m of D.models || []) {
      if (!m || !LB.matchPlacement(m, filter)) continue;
      const v = LB.score(m, metric);
      if (isNum(v)) rows.push({ m, v });
    }
    const tc = (m) => (m.scores && isNum(m.scores.textCore) ? m.scores.textCore : -1);
    return rows.sort((a, b) => b.v - a.v || tc(b.m) - tc(a.m) || LB.label(a.m).localeCompare(LB.label(b.m)));
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
  function tipHtml(rows, i, mt) {
    const { m, v } = rows[i];
    const rank = `Rank <b>#${i + 1}</b> of ${rows.length}`;
    let extra;
    if (mt.value === "textCore") {
      const ci = ciOf(m);
      const tied = tiedWith(rows, i).map((j) => LB.label(rows[j].m));
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

  // ---------- cloud references: closed models run on the same tasks, drawn as benchmark lines and never ranked ----------
  const REF_NOTE = "Cloud reference via GitHub Copilot · same tasks, not ranked";
  function refsFor(metric) {
    const out = [];
    for (const m of D.models || []) {
      if (!m || !m.reference) continue;
      const v = LB.score(m, metric);
      if (isNum(v)) out.push({ m, v });
    }
    return out.sort((a, b) => b.v - a.v || LB.label(a.m).localeCompare(LB.label(b.m)));
  }
  function refTipHtml(r, mt) {
    return LB.modelTip(r.m, (mt.value === "textCore" ? "" : `${mt.label} <b>${fmt.num(r.v, 1)}</b><br>`) + REF_NOTE);
  }
  /** Centres for labels of height `size` wanted at `ys` (ascending): at least `gap` apart, each as close to its own line
   *  as possible (overlapping runs are centred on their mean), and kept within [lo, hi]. */
  function spread(ys, size, gap, lo, hi) {
    const pitch = size + gap;
    const topOf = (c) => Math.max(lo, Math.min(hi - c.n * pitch + gap, c.sum / c.n - size / 2 - ((c.n - 1) / 2) * pitch));
    const runs = ys.map((y) => ({ n: 1, sum: y }));
    for (let k = 0; k + 1 < runs.length; ) {
      if (topOf(runs[k]) + runs[k].n * pitch > topOf(runs[k + 1]) + 0.01) {
        runs.splice(k, 2, { n: runs[k].n + runs[k + 1].n, sum: runs[k].sum + runs[k + 1].sum });
        k = Math.max(0, k - 1);
      } else k++;
    }
    const out = [];
    for (const c of runs) { const t = topOf(c); for (let j = 0; j < c.n; j++) out.push(t + size / 2 + j * pitch); }
    return out;
  }
  function dashSwatch() {
    return s("svg", { class: "ov-dash", width: 24, height: 6, viewBox: "0 0 24 6", "aria-hidden": "true" },
      s("line", { x1: 0, x2: 24, y1: 3, y2: 3 }));
  }

  function drawBars(chart, rows, mt, refs) {
    chart.textContent = "";
    const avail = Math.floor(chart.clientWidth) || 960;
    const narrow = avail < 640;
    const fsL = narrow ? 11 : 11.5, fsV = narrow ? 11.5 : 12.5;
    const n = rows.length;
    const labs = rows.map((r) => ({ main: LB.label(r.m), part: r.m.partial ? " · partial" : "" }));
    const labW = labs.map((l) => textW(l.main, fsL, 460) + (l.part ? textW(l.part, fsL, 600) : 0));
    const top = 36, plotH = narrow ? 190 : 222, axisW = Math.ceil(textW("100%", 11, 400)) + 24;
    const bottom = Math.ceil(Math.max(40, ...labW) * SIN + fsL * COS + 14);
    const minStep = narrow ? 40 : 46, maxStep = 96;

    // reference label pills sit in a gutter at the right edge
    const fsP = narrow ? 10.5 : 11.5, pillH = narrow ? 19 : 21, rb = narrow ? 5.5 : 6.5, LEAD = 16;
    const pills = refs.map((r) => {
      const name = LB.label(r.m) + (r.m.partial ? " (partial)" : ""), val = fmt.num(r.v, 1);
      const tw = textW(name, fsP, 500) + textW(" · ", fsP, 500) + textW(val, fsP, 650);
      return { name, val, w: Math.ceil(pillH / 2 + rb + 6 + tw + 10) };
    });
    const gutter = pills.length ? LEAD + Math.max(...pills.map((p) => p.w)) + 4 : 0;

    // long labels hang down-left from their bar: shift the plot right until the first ones fit
    let left = axisW, step = minStep;
    for (let pass = 0; pass < 4; pass++) {
      step = Math.max(minStep, Math.min(maxStep, (avail - left - 4 - gutter) / n));
      let need = 0;
      labW.forEach((w, i) => { need = Math.max(need, w * COS + 6 - (left + step * (i + 0.5) + fsL * 0.3)); });
      if (need <= 0.5) break;
      left += need;
    }
    const W = Math.max(avail, Math.ceil(left + step * n + 4 + gutter));
    const gx = W - gutter;                        // reference lines end here; their pills start LEAD px further right
    const H = top + plotH + bottom, base = top + plotH;
    const yOf = (v) => base - (Math.max(0, Math.min(100, v)) / 100) * plotH;
    const bw = Math.min(54, Math.max(18, step * 0.66));
    const br = Math.min(7, bw * 0.15);
    const badgeR = Math.max(8, Math.min(13, bw * 0.3));
    const hasCI = mt.value === "textCore";

    const svg = s("svg", { class: "ov-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "group",
      "aria-label": `${mt.label} by model, ${n} model${n === 1 ? "" : "s"}, highest first` +
        (refs.length ? `; dashed lines mark ${refs.length} cloud reference${refs.length === 1 ? "" : "s"}` : "") });
    svg.append(s("defs", {}, s("pattern", { id: "ov-hatch", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
      s("rect", { width: 3, height: 7, fill: "rgba(255,255,255,.6)" }))));

    const grid = s("g", { class: "ov-grid", "aria-hidden": "true" });
    for (let t = 0; t <= 100; t += 20) {
      const y = Math.round(yOf(t)) + 0.5;
      grid.append(s("line", { x1: left - 8, x2: gutter ? gx + 4 : W - 2, y1: y, y2: y }),
        s("text", { class: "ov-tick", x: left - 14, y: y + 3.5, "text-anchor": "end" }, t + "%"));
    }
    svg.append(grid);
    const refLines = s("g", { class: ["ov-refs", "ov-fade"], "aria-hidden": "true" });   // behind the bars
    svg.append(refLines);

    const groups = [], refHot = [], zoneTop = [];
    const clear = () => {
      svg.classList.remove("ov-dim", "ov-refdim");
      groups.forEach((g) => g.classList.remove("ov-hot", "ov-tied"));
      refHot.forEach((x) => x.classList.remove("ov-ref-hot"));
      LB.tip.hide();
    };
    rows.forEach((r, i) => {
      const { m, v } = r;
      const ven = LB.vendor(m);
      const cx = left + step * (i + 0.5), x = cx - bw / 2, y = yOf(v), bh = base - y;
      const g = s("g", {
        class: ["ov-bar", m.recommended && "ov-rec", m.partial && "ov-partial"], tabindex: 0, role: "img",
        "aria-label": `${i + 1}. ${LB.fullName(m)}: ${mt.label} ${fmt.num(v, 1)}` +
          (m.partial ? ", partial run" : "") + (m.recommended ? ", our pick" : ""),
      });
      const rise = { transitionDelay: Math.min(i * 40, 640) + "ms" };
      const fade = { transitionDelay: 520 + Math.min(i * 40, 640) + "ms" };
      const hit = s("rect", { class: "ov-hit", x: cx - step / 2 + 1, y: top - 30, width: step - 2, height: plotH + 38, rx: 8 });
      g.append(hit);
      if (bh > 0.5) {
        const d = barPath(x, y, bw, bh, br);
        g.append(s("path", { class: "ov-rise", d, fill: ven.color, style: rise }));
        if (m.partial) g.append(s("path", { class: "ov-rise ov-hatch", d, fill: "url(#ov-hatch)", style: rise }));
      }
      // vendor badge: inside the top of the bar, or just above a short bar
      const inside = bh >= badgeR * 2 + 14;
      const by = inside ? y + 7 + badgeR : y - 5 - badgeR;
      const letter = String(ven.letter || "?");
      g.append(s("g", { class: ["ov-fade", "ov-badge", !inside && "ov-badge-out"], style: fade, "aria-hidden": "true" },
        s("circle", { cx, cy: by, r: badgeR }),
        s("text", { x: cx, y: by, dy: "0.35em", "text-anchor": "middle", fill: ven.color,
          "font-size": (letter.length > 1 ? badgeR * 0.78 : badgeR * 0.98).toFixed(1) }, letter)));
      // value label (lime pill for our pick)
      const vy = (inside ? y : by - badgeR) - 8;
      zoneTop[i] = vy - fsV - 4;
      const vtxt = (m.recommended ? "★ " : "") + fmt.num(v, 1);
      const val = s("g", { class: ["ov-val", hasCI && "ov-val-ci"] });
      if (m.recommended) {
        const pw = textW(vtxt, fsV, 700) + 14;
        val.append(s("rect", { class: "ov-pill", x: cx - pw / 2, y: vy - fsV - 2.5, width: pw, height: fsV + 8, rx: 6 }));
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
      // model label under the bar
      const ax = cx + fsL * 0.3, ay = base + 14;
      g.append(s("text", { class: ["ov-xlab", m.recommended && "ov-xrec"], x: ax, y: ay, "text-anchor": "end", "font-size": fsL,
        transform: `rotate(${-ROT} ${ax.toFixed(1)} ${ay})` },
        labs[i].main, labs[i].part ? s("tspan", { class: "ov-xpart" }, labs[i].part) : null));

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

    /** Dashed benchmark line per reference (behind the bars), with a pill in the gutter; stacked pills get a leader. */
    function drawRefs() {
      const px = gx + LEAD;
      const ys = refs.map((r) => Math.round(yOf(r.v)));       // refs come highest first, so ys ascend
      const centres = spread(ys, pillH, 4, 2, base + pillH / 2);
      // lines closer than 2.5 px share one dash pattern, each colour taking its turn, so none hides another
      const dash = ys.map(() => ({ arr: "6 4", off: 0 }));
      for (let i = 0; i < ys.length;) {
        let j = i + 1;
        while (j < ys.length && ys[j] - ys[j - 1] < 2.5) j++;
        for (let q = i; j - i > 1 && q < j; q++) dash[q] = { arr: `6 ${6 * (j - i - 1) + 4}`, off: -6 * (q - i) };
        i = j;
      }
      const front = s("g", { class: ["ov-refpills", "ov-fade"] });
      const fade = { transitionDelay: 640 + Math.min(n * 40, 640) + "ms" };
      refLines.style.transitionDelay = fade.transitionDelay;
      Object.assign(front.style, fade);
      refs.forEach((r, i) => {
        const m = r.m, col = LB.vendor(m).color, yl = ys[i], yp = centres[i], moved = Math.abs(yp - yl) > 0.75;
        const line = s("line", { class: "ov-refline", x1: left - 4, x2: moved ? gx : px + 1, y1: yl, y2: yl, stroke: col,
          "stroke-dasharray": dash[i].arr, "stroke-dashoffset": dash[i].off });
        refLines.append(line);
        // hover the line only where it crosses empty space, so the bars keep their own hover
        const free = [];
        const add = (a, b) => {
          const last = free[free.length - 1];
          if (last && a - last[1] < 1) last[1] = b; else if (b - a >= 1) free.push([a, b]);
        };
        rows.forEach((_, j) => { if (yl < zoneTop[j] - 6) add(left + step * j, left + step * (j + 1)); });
        add(left + step * n, gx);
        const hit = free.length ? s("path", { class: "ov-refhit", d: free.map(([a, b]) => `M${a},${yl}H${b}`).join("") }) : null;
        // the pill: vendor badge, name and value
        const p = pills[i], letter = String(LB.vendor(m).letter || "?"), bx = px + pillH / 2;
        const pill = s("g", { class: "ov-refpill", tabindex: 0, role: "img",
          "aria-label": `Cloud reference ${LB.fullName(m)}: ${mt.label} ${fmt.num(r.v, 1)}, not ranked` },
          moved ? s("path", { class: "ov-refleader", d: `M${gx},${yl}H${gx + 4}L${px},${yp}`, stroke: col }) : null,
          s("rect", { x: px, y: yp - pillH / 2, width: p.w, height: pillH, rx: pillH / 2, stroke: col }),
          s("circle", { cx: bx, cy: yp, r: rb, fill: col }),
          s("text", { class: "ov-refletter", x: bx, y: yp, dy: "0.35em", "text-anchor": "middle",
            "font-size": (letter.length > 1 ? rb * 1.05 : rb * 1.3).toFixed(1) }, letter),
          s("text", { x: bx + rb + 6, y: yp, dy: "0.35em", "font-size": fsP },
            s("tspan", { class: "ov-refname" }, p.name), s("tspan", { class: "ov-refsep" }, " · "),
            s("tspan", { class: "ov-refval" }, p.val)));
        front.append(pill);
        refHot.push(line, pill);
        const show = (e) => {
          clear();
          svg.classList.add("ov-refdim");
          line.classList.add("ov-ref-hot");
          pill.classList.add("ov-ref-hot");
          LB.tip.show(e, refTipHtml(r, mt));
        };
        for (const el of hit ? [hit, pill] : [pill]) {
          el.addEventListener("mouseenter", show);
          el.addEventListener("mousemove", LB.tip.move);
          el.addEventListener("mouseleave", clear);
        }
        pill.addEventListener("focus", () => {
          const b = pill.getBoundingClientRect();
          show({ clientX: b.left + 12, clientY: b.bottom });
        });
        pill.addEventListener("blur", clear);
        if (hit) svg.append(hit);
      });
      svg.append(front);
    }
    if (refs.length) drawRefs();
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

  /** nRefs: reference lines drawn (0 = none has this metric); null = references hidden or absent. */
  function fillFoot(foot, rows, st, mt, nRefs) {
    foot.textContent = "";
    const scored = (D.models || []).filter((m) => m && LB.matchPlacement(m, st.filter) && m.scores && isNum(m.scores.textCore)).length;
    const missing = mt.value === "textCore" ? 0 : Math.max(0, scored - rows.length);
    const refKey = nRefs === null ? null : nRefs > 0
      ? h("span", { class: "ov-refkey" }, dashSwatch(), "Cloud reference (same tasks via GitHub Copilot, not ranked)")
      : h("span", { class: ["ov-refkey", "ov-refnone"] }, dashSwatch(), "No cloud reference has this score yet");
    foot.append(
      h("span", {}, mt.note),
      h("span", { class: "ov-count" }, refKey,
        rows.some((r) => r.m.recommended) ? h("span", { class: "ov-key" }, h("i", { "aria-hidden": "true" }, "★"), "Our pick") : null,
        h("span", {}, h("b", {}, String(rows.length)), ` model${rows.length === 1 ? "" : "s"} shown`,
          missing ? ` · ${missing} not run on this suite` : "")));
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
      title: "Closed cloud models that took the same tasks, drawn as dashed lines",
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
      const rows = rowsFor(st.metric, st.filter);
      const refs = anyRefs && st.refs && rows.length ? refsFor(st.metric) : [];
      lastW = chart.clientWidth;
      fillFoot(foot, rows, st, mt, anyRefs && st.refs && rows.length ? refs.length : null);
      if (!rows.length) { drawEmpty(chart, st, mt); return; }
      const svg = drawBars(chart, rows, mt, refs);
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
