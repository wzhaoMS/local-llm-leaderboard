/* Speed: fastest decode, lowest latency, fastest long prompts (mirrors "Fastest and most affordable models"),
   plus a line chart of speed versus context depth. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, isNum, fmt } = LB;
  const TOP = 5;

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const models = () => (LB.data && Array.isArray(LB.data.models) ? LB.data.models : []).filter(Boolean);
  const spd = (m) => (m && m.speed && typeof m.speed === "object" ? m.speed : null);
  const num = (o, k) => (o && isNum(o[k]) ? o[k] : null);
  const join = (...parts) => parts.filter(Boolean).join(" · ");

  /** Speculative decoding (MTP) was on for the speed run. An all-null mtp object means "no draft". */
  function hasMtp(m) {
    const t = spd(m) && spd(m).mtp;
    return !!t && (isNum(t.on) || isNum(t.draft) || isNum(t.acceptance));
  }

  const CARDS = [
    {
      title: "Fastest decode", chip: "tokens/sec", caption: "Output speed · higher is better", higher: true,
      get: (m) => num(spd(m), "decode"),
      text: (v) => fmt.num(v, 1),
      sub: (m) => join(m.where, hasMtp(m) ? "MTP" : null),
    },
    {
      title: "Lowest latency", chip: "first output", caption: "Seconds to the first answer token or tool call, after any thinking · lower is better", higher: false,
      get: (m) => num(spd(m), "firstOutput"),
      text: (v) => fmt.num(v, v < 10 ? 1 : 0), unit: "s",
      sub: (m) => { const t = num(spd(m), "taskTime"); return join(m.where, t !== null ? `${fmt.num(t, 1)} s per task` : null); },
    },
    {
      title: "Fastest long prompts", chip: "tok/s @ 32K", caption: "Prefill speed at 32K tokens of context · higher is better", higher: true,
      get: (m) => num(spd(m) && spd(m).prefill, "32k"),
      text: (v) => fmt.int(v),
      sub: (m) => { const t = num(spd(m) && spd(m).ttftAt, "32k"); return join(m.where, t !== null ? `32K read in ${fmt.num(t, 1)} s` : null); },
    },
  ];

  /** Tie-break: quicker first token, then faster decode, then name. */
  function tie(a, b) {
    const ta = num(spd(a), "ttft"), tb = num(spd(b), "ttft");
    const da = num(spd(a), "decode"), db = num(spd(b), "decode");
    return (ta ?? Infinity) - (tb ?? Infinity) || (db ?? -1) - (da ?? -1) || String(LB.label(a) || "").localeCompare(String(LB.label(b) || ""));
  }

  function ranked(card, filter) {
    const out = [];
    for (const m of models()) {
      if (!LB.matchPlacement(m, filter)) continue;
      const v = card.get(m);
      if (!isNum(v) || v < 0) continue;
      out.push({ m, v });
    }
    out.sort((a, b) => (card.higher ? b.v - a.v : a.v - b.v) || tie(a.m, b.m));
    return out;
  }

  function speedTip(m) {
    const sp = spd(m) || {};
    const L = [];
    if (isNum(sp.inTaskDecode)) L.push(`Decode during tasks <b>${fmt.num(sp.inTaskDecode, 1)}</b> tok/s`);
    if (isNum(sp.firstOutput)) L.push(`First answer or tool call <b>${fmt.num(sp.firstOutput, 1)} s</b>` +
      (isNum(sp.ttft) ? ` <span class="muted">· raw TTFT ${fmt.num(sp.ttft, 2)} s</span>` : ""));
    if (isNum(sp.taskTime)) L.push(`Median task <b>${fmt.num(sp.taskTime, 1)} s</b>`);
    const p32 = num(sp.prefill, "32k");
    if (p32 !== null) L.push(`Prefill @ 32K <b>${fmt.int(p32)}</b> tok/s`);
    if (hasMtp(m)) {
      const t = sp.mtp;
      L.push("MTP" + (isNum(t.draft) ? ` draft ${t.draft}` : "") + (isNum(t.acceptance) ? ` · ${fmt.pct(t.acceptance, 0)}% accepted` : "") +
        (isNum(t.off) && isNum(t.on) ? ` · ${fmt.num(t.off, 1)} → ${fmt.num(t.on, 1)} tok/s` : ""));
    }
    if (isNum(sp.ctx)) L.push(`<span class="muted">Context window ${fmt.int(sp.ctx)} tokens</span>`);
    if (m.speedOnly) L.push(`<span class="muted">Speed-only run: not scored on quality.</span>`);
    return LB.modelTip(m, L.join("<br>"));
  }

  function speedCard(card, filter) {
    const rows = ranked(card, filter).slice(0, TOP);
    // Bars are value / max of the rows shown, as in the reference: for lower-is-better the fastest gets the shortest bar.
    const max = rows.length ? Math.max(...rows.map((r) => r.v)) : 0;
    const frac = (v) => (max > 0 ? v / max : 0);
    return LB.card("sp-card",
      h("div", { class: "sp-head" }, h("h3", {}, card.title), LB.chip(card.chip, "sp-chip")),
      h("p", { class: "sp-caption" }, card.caption),
      rows.length
        ? h("div", { class: "lb-list sp-list" }, rows.map((r, i) => {
          const sub = [card.sub(r.m), r.m.partial ? h("span", { class: "sp-partial" }, "partial") : null];
          const row = LB.rankRow(i, r.m, card.text(r.v), frac(r.v), sub, card.unit);
          LB.tip.attach(row, () => speedTip(r.m));
          return row;
        }))
        : h("div", { class: "lb-empty" }, "Not measured for this setup yet."));
  }

  // ---------- speed vs context depth ----------
  const METRICS = [
    { value: "decode", label: "Decode", field: "decodeAt", unit: "tok/s", fmt: (v) => fmt.int(v), tick: (v) => fmt.int(v),
      axis: "Decode tok/s · higher is better", caption: "Output speed as the prompt grows. One line per model and setup." },
    { value: "prefill", label: "Prefill", field: "prefill", unit: "tok/s", fmt: (v) => fmt.int(v), tick: (v) => fmt.int(v),
      axis: "Prefill tok/s · higher is better", caption: "How fast the prompt is read at each context depth." },
    { value: "ttft", label: "Time to first token", field: "ttftAt", unit: "s", fmt: (v) => fmt.num(v, 1),
      tick: (v) => (Number.isInteger(v) ? fmt.int(v) : fmt.num(v, 1)),
      axis: "Seconds to first token · lower is better", caption: "How long a prompt of that size takes before the first token." },
  ];

  /** {"8k": v, "117k": v} -> [{x: 8, y, k: "8K"}] sorted by depth; ignores keys that aren't "<n>k". */
  function depthPoints(obj) {
    const pts = [];
    if (!obj || typeof obj !== "object") return pts;
    for (const [k, v] of Object.entries(obj)) {
      const mm = /^(\d+(?:\.\d+)?)\s*k$/i.exec(k);
      if (mm && isNum(v)) pts.push({ x: parseFloat(mm[1]), y: v, k: mm[1] + "K" });
    }
    return pts.sort((a, b) => a.x - b.x);
  }

  function seriesFor(metric, filter) {
    const out = [];
    for (const m of models()) {
      if (!LB.matchPlacement(m, filter)) continue;
      const pts = depthPoints(spd(m) && spd(m)[metric.field]);
      if (pts.length >= 2) out.push({ m, pts, color: LB.vendor(m).color, name: String(LB.label(m) || m.id || "") });
    }
    return out;
  }

  function niceTicks(max, n) {
    if (!(max > 0)) max = 1;
    const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    const top = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toFixed(6));
    return { top, ticks };
  }

  let ctx2d = null;
  function textWidth(t, size, weight) {
    if (!ctx2d) { try { ctx2d = document.createElement("canvas").getContext("2d"); } catch (e) { ctx2d = null; } }
    if (!ctx2d) return String(t).length * size * 0.56;
    ctx2d.font = `${weight || 500} ${size}px Geist, "Segoe UI", system-ui, sans-serif`;
    return ctx2d.measureText(String(t)).width;
  }

  /** Spread label y positions so they keep `gap` apart, staying near their targets and inside [lo, hi]. */
  function dodge(items, gap, lo, hi) {
    items.sort((a, b) => a.y - b.y);
    let cl = items.map((it) => ({ items: [it], top: it.y }));
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < cl.length - 1; i++) {
        const a = cl[i], b = cl[i + 1];
        if (a.top + a.items.length * gap > b.top + 0.01) {
          const its = a.items.concat(b.items);
          const mean = its.reduce((sum, it) => sum + it.y, 0) / its.length;
          cl.splice(i, 2, { items: its, top: mean - ((its.length - 1) * gap) / 2 });
          merged = true;
          break;
        }
      }
    }
    for (const c of cl) {
      c.top = Math.max(lo, Math.min(c.top, hi - (c.items.length - 1) * gap));
      c.items.forEach((it, j) => (it.ly = c.top + j * gap));
    }
    for (let i = 1; i < items.length; i++) items[i].ly = Math.max(items[i].ly, items[i - 1].ly + gap);
    const n = items.length;
    if (n && items[n - 1].ly > hi) {
      items[n - 1].ly = hi;
      for (let i = n - 2; i >= 0; i--) items[i].ly = Math.min(items[i].ly, items[i + 1].ly - gap);
    }
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function lineTip(se, pi, metric) {
    const vals = se.pts.map((p, i) => (i === pi ? `<b>${p.k}: ${metric.fmt(p.y)}</b>` : `${p.k}: ${metric.fmt(p.y)}`)).join(" · ");
    return LB.modelTip(se.m, `${esc(metric.label)} (${esc(metric.unit)}) by context depth<br>${vals}`);
  }

  /** Draws the chart into `box` at its current width. Returns the number of lines drawn. */
  function drawLines(box, legend, metric, filter) {
    box.textContent = "";
    legend.textContent = "";
    const series = seriesFor(metric, filter);
    if (!series.length) {
      box.append(h("div", { class: "lb-empty" }, "No long-context measurements for this setup yet."));
      return 0;
    }
    const W = Math.max(300, Math.floor(box.clientWidth) || 900);
    const narrow = W < 640;
    const H = narrow ? 300 : 420;
    const LFS = 12.5;
    const xs = [...new Set(series.flatMap((se) => se.pts.map((p) => p.x)))].sort((a, b) => a - b);
    const x0 = xs[0], x1 = xs[xs.length - 1];
    const endLabels = !narrow;
    const atEnd = series.filter((se) => se.pts[se.pts.length - 1].x === x1);
    const labelW = endLabels && atEnd.length ? Math.max(...atEnd.map((se) => textWidth(se.name, LFS, 500))) : 0;
    const M = { t: 34, r: endLabels ? Math.ceil(labelW) + 30 : 16, b: 48, l: 52 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b, pad = 12;
    const X = (x) => M.l + pad + ((x - x0) / (x1 - x0 || 1)) * (pw - 2 * pad);
    const maxY = Math.max(...series.flatMap((se) => se.pts.map((p) => p.y)));
    const { top, ticks } = niceTicks(maxY * 1.04, narrow ? 4 : 5);
    const Y = (y) => M.t + ph - (y / top) * ph;

    const svg = s("svg", { class: "sp-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": metric.axis });
    const grid = s("g", { class: "sp-gridlines" });
    for (const t of ticks) {
      grid.append(s("line", { x1: M.l, x2: M.l + pw, y1: Y(t), y2: Y(t), class: t === 0 ? "base" : null }),
        s("text", { x: M.l - 10, y: Y(t), class: "sp-tick", "text-anchor": "end", "dominant-baseline": "middle" }, metric.tick(t)));
    }
    // depth ticks: most common depths first, skip any that would collide
    const freq = (x) => series.filter((se) => se.pts.some((p) => p.x === x)).length;
    const placed = [];
    for (const x of xs.slice().sort((a, b) => freq(b) - freq(a) || a - b)) {
      if (placed.some((p) => Math.abs(X(p) - X(x)) < 38)) continue;
      placed.push(x);
      grid.append(s("line", { x1: X(x), x2: X(x), y1: M.t, y2: M.t + ph, class: "v" }),
        s("text", { x: X(x), y: M.t + ph + 18, class: "sp-tick", "text-anchor": "middle" }, x + "K"));
    }
    svg.append(grid,
      s("text", { x: M.l - 40, y: 14, class: "sp-axis-title" }, metric.axis),
      s("text", { x: M.l + pw / 2, y: H - 6, class: "sp-axis-title", "text-anchor": "middle" }, "Context depth · tokens already in the prompt"));

    const gLines = s("g", { class: "sp-lines" });
    series.forEach((se, si) => {
      const g = s("g", { class: "sp-series" });
      g.append(s("path", { class: "sp-line", stroke: se.color,
        d: se.pts.map((p, i) => (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1)).join(" ") }));
      for (const p of se.pts) g.append(s("circle", { class: "sp-dot", cx: X(p.x).toFixed(1), cy: Y(p.y).toFixed(1), r: 3.2, stroke: se.color }));
      se.g = g;
      se.si = si;
      gLines.append(g);
    });
    svg.append(gLines);

    if (endLabels) {
      const groups = new Map();
      for (const se of series) {
        const last = se.pts[se.pts.length - 1];
        if (!groups.has(last.x)) groups.set(last.x, []);
        groups.get(last.x).push({ se, x: X(last.x), y: Y(last.y) });
      }
      const gLab = s("g", { class: "sp-labels" });
      const right = X(x1);
      for (const items of groups.values()) {
        const inside = items[0].x < right - 1; // series that stop early get a boxed tag inside the plot
        dodge(items, inside ? 21 : 15, M.t + 10, M.t + ph - 10);
        for (const it of items) {
          const lx = it.x + 12;
          const g = s("g", { class: ["sp-label", inside && "tag"], "data-si": it.se.si });
          if (Math.abs(it.ly - it.y) > 2) g.append(s("path", { class: "sp-leader", stroke: it.se.color, d: `M${(it.x + 5).toFixed(1)} ${it.y.toFixed(1)} L${(lx - 3).toFixed(1)} ${it.ly.toFixed(1)}` }));
          if (inside) {
            const w = textWidth(it.se.name, 12, 500) + 14;
            g.append(s("rect", { class: "sp-tag", x: lx - 4, y: (it.ly - 9.5).toFixed(1), width: w.toFixed(1), height: 19, rx: 6, stroke: it.se.color }));
            g.append(s("text", { x: lx + 3, y: it.ly, class: "sp-lbl", "dominant-baseline": "middle" }, it.se.name));
          } else {
            g.append(s("text", { x: lx, y: it.ly, class: "sp-lbl", "dominant-baseline": "middle" }, it.se.name));
          }
          it.se.label = g;
          gLab.append(g);
        }
      }
      svg.append(gLab);
    } else {
      legend.append(...series.map((se) => h("span", { class: "sp-leg" }, h("i", { style: { background: se.color } }), se.name)));
    }

    const focus = s("circle", { class: "sp-focus", r: 5.5, cx: -20, cy: -20 });
    svg.append(focus);
    let active = -1;
    const setActive = (si, pi) => {
      if (si !== active) {
        active = si;
        svg.classList.toggle("sp-has-active", si >= 0);
        series.forEach((se, i) => { se.g.classList.toggle("on", i === si); if (se.label) se.label.classList.toggle("on", i === si); });
      }
      if (si >= 0) {
        const p = series[si].pts[pi];
        focus.setAttribute("cx", X(p.x).toFixed(1));
        focus.setAttribute("cy", Y(p.y).toFixed(1));
        focus.setAttribute("stroke", series[si].color);
      } else { focus.setAttribute("cx", -20); focus.setAttribute("cy", -20); }
    };
    svg.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let si = -1, pi = -1;
      const lab = e.target && e.target.closest ? e.target.closest(".sp-label") : null;
      if (lab) {
        si = +lab.getAttribute("data-si");
        pi = series[si].pts.length - 1;
      } else {
        let bd = 12;
        for (const se of series) {
          se.pts.forEach((p, k) => {
            const px = X(p.x), py = Y(p.y);
            const dp = Math.hypot(mx - px, my - py) - 4; // points win over the segments next to them
            if (dp < bd) { bd = dp; si = se.si; pi = k; }
            if (k) {
              const q = se.pts[k - 1], qx = X(q.x), qy = Y(q.y);
              const d = segDist(mx, my, qx, qy, px, py);
              if (d < bd) { bd = d; si = se.si; pi = Math.abs(mx - px) < Math.abs(mx - qx) ? k : k - 1; }
            }
          });
        }
      }
      if (si < 0) { setActive(-1); LB.tip.hide(); return; }
      setActive(si, pi);
      LB.tip.show(e, lineTip(series[si], pi, metric));
    });
    svg.addEventListener("mouseleave", () => { setActive(-1); LB.tip.hide(); });
    box.append(svg);
    return series.length;
  }

  function render(el) {
    let filter = "all";
    let metric = METRICS[0];
    const cards = h("div", { class: "lb-grid-3 sp-cards" });
    const chartBox = h("div", { class: "sp-chart" });
    const legend = h("div", { class: "sp-legend" });
    const caption = h("p", { class: "sp-caption" });
    const foot = h("div", { class: "lb-card-foot sp-foot" });

    const drawCards = () => {
      cards.textContent = "";
      cards.append(...CARDS.map((c) => speedCard(c, filter)));
    };
    let lastW = 0;
    const drawChart = () => {
      lastW = chartBox.clientWidth;
      caption.textContent = metric.caption;
      const n = drawLines(chartBox, legend, metric, filter);
      foot.textContent = "";
      if (n) foot.append(h("span", {}, `${n} model${n === 1 ? "" : "s"} measured at two or more context depths`),
        h("span", {}, "Hover a line for the numbers"));
    };

    el.append(
      LB.sectionHead({
        title: "Fastest models on this PC",
        sub: "Measured locally with each model's best settings (speculative decoding on where it helps).",
        right: LB.seg(LB.PLACEMENTS, filter, (v) => { filter = v; drawCards(); drawChart(); }),
      }),
      cards,
      LB.card("sp-long",
        h("div", { class: "sp-head sp-long-head" },
          h("div", {}, h("h3", {}, "Speed at long context"), caption),
          LB.seg(METRICS, metric.value, (v) => { metric = METRICS.find((x) => x.value === v) || METRICS[0]; drawChart(); })),
        chartBox, legend, foot));

    drawCards();
    drawChart();
    LB.onResize(drawChart);
    if (window.ResizeObserver) new ResizeObserver(() => { if (Math.abs(chartBox.clientWidth - lastW) > 1) drawChart(); }).observe(chartBox);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawChart).catch(() => {});
  }

  LB.register({ id: "speed", order: 60, nav: "Speed", render });
})();
