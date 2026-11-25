/* Quality vs speed: text core against median time per task (or decode speed), with a lime "Most attractive" corner. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, fmt, isNum } = LB;
  const D = LB.data || {};

  const FONT = '"Geist", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
  const DOT = 7, RING = 12.5;           // point radius; ring around our pick
  const Q_MIN = 90;                     // "Most attractive": text core at least this ...
  const MODES = {
    time: {
      label: "Time per task", thr: 6.5, lowerBetter: true,
      value: (m) => m.speed && m.speed.taskTime,
      ticks: [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600],
      tick: (v) => v + " s",
      axis: "Median time per task (s) · log scale · lower is better",
      sub: "Text core against the median time per task (thinking included). Up and to the left is better.",
      zone: `Text core ≥ ${Q_MIN} · ≤ 6.5 s per task`,
    },
    decode: {
      label: "Decode speed", thr: 120, lowerBetter: false,
      value: (m) => m.speed && m.speed.decode,
      ticks: [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 600, 1000, 2000],
      tick: (v) => String(v),
      axis: "Decode speed (tok/s, single stream) · log scale · higher is better",
      sub: "Text core against single-stream decode speed (tokens per second). Up and to the right is better.",
      zone: `Text core ≥ ${Q_MIN} · ≥ 120 tok/s`,
    },
  };

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
    try { ok = fs.check("13px Geist"); } catch (e) { ok = true; }
    if (!ok) fs.load("500 13px Geist").then(() => { widths.clear(); fn(); }, () => {});
  }

  // ---------- geometry helpers for label placement ----------
  const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  function outside(b, r) {
    return Math.max(0, r.x0 - b.x0) * (b.y1 - b.y0) + Math.max(0, b.x1 - r.x1) * (b.y1 - b.y0) +
      Math.max(0, r.y0 - b.y0) * (b.x1 - b.x0) + Math.max(0, b.y1 - r.y1) * (b.x1 - b.x0);
  }
  const DIRS = [["E", 0], ["W", 1.5], ["NE", 2], ["SE", 2.5], ["N", 3], ["S", 3.5], ["NW", 4], ["SW", 4.5]];
  const RINGS = [[0, 0], [14, 30], [28, 60], [46, 95], [68, 140]];
  /** Does box b cut the horizontal or vertical segment l? */
  const crosses = (b, l) => (l.y0 === l.y1
    ? l.y0 > b.y0 && l.y0 < b.y1 && Math.min(b.x1, l.x1) > Math.max(b.x0, l.x0)
    : l.x0 > b.x0 && l.x0 < b.x1 && Math.min(b.y1, l.y1) > Math.max(b.y0, l.y0));
  /** Would box b read as the label of point q (level with one of its ends, or right above/below its middle)? */
  function looksLike(b, q) {
    const gapX = q.x < b.x0 ? b.x0 - q.x : q.x > b.x1 ? q.x - b.x1 : 0;
    const gapY = q.y < b.y0 ? b.y0 - q.y : q.y > b.y1 ? q.y - b.y1 : 0;
    const mid = (b.x1 - b.x0) * 0.2;
    return (q.y >= b.y0 - 2 && q.y <= b.y1 + 2 && gapX < q.r + 26) ||
      (q.x >= b.x0 + mid && q.x <= b.x1 - mid && gapY < q.r + 16);
  }
  /** Leader line from a point to the nearest spot on its label box (also used when drawing). */
  function leaderOf(p, b) {
    const x2 = Math.max(b.x0, Math.min(b.x1, p.x)), y2 = Math.max(b.y0 + 2, Math.min(b.y1 - 2, p.y));
    return { x1: p.x, y1: p.y, x2, y2, len: Math.hypot(x2 - p.x, y2 - p.y) };
  }
  function segDist(px, py, l) {
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - l.x1) * dx + (py - l.y1) * dy) / len2)) : 0;
    return Math.hypot(px - (l.x1 + t * dx), py - (l.y1 + t * dy));
  }
  /** Does segment l pass through box b (Liang-Barsky clipping)? */
  function segHitsBox(l, b) {
    let t0 = 0, t1 = 1;
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
    const edges = [[-dx, l.x1 - b.x0], [dx, b.x1 - l.x1], [-dy, l.y1 - b.y0], [dy, b.y1 - l.y1]];
    for (const [p, q] of edges) {
      if (p === 0) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t1 - t0 > 0.02;
  }
  function segsCross(a, b) {
    const o = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    return o(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1) !== o(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2) &&
      o(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1) !== o(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  }
  function boxAt(p, dir, off) {
    const { x, y, w, h: hh } = p, d = off * 0.72;
    const mk = (x0, y0) => ({ x0, y0, x1: x0 + w, y1: y0 + hh });
    switch (dir) {
      case "E": return mk(x + off, y - hh / 2);
      case "W": return mk(x - off - w, y - hh / 2);
      case "N": return mk(x - w / 2, y - off - hh);
      case "S": return mk(x - w / 2, y + off);
      case "NE": return mk(x + d, y - d - hh);
      case "SE": return mk(x + d, y + d);
      case "NW": return mk(x - d - w, y - d - hh);
      default: return mk(x - d - w, y + d);
    }
  }
  /**
   * Greedy label placement: crowded points pick first; each label takes the cheapest of 40 candidate spots
   * (8 directions x 5 distances), penalising overlap with other labels, points, blockers and the plot edge,
   * spots that would read as another point's label, leader lines that cross points, labels or other leaders,
   * and (mildly) cutting through the threshold lines. Two refinement passes then re-place each label against
   * all the others, which untangles conflicts the greedy order created.
   */
  function placeLabels(items, bounds, blockers, lines) {
    const n = items.length;
    const dots = items.map((p) => ({ x0: p.x - p.r - 2, y0: p.y - p.r - 2, x1: p.x + p.r + 2, y1: p.y + p.r + 2 }));
    // candidates with their fixed cost (everything that doesn't depend on where other labels go)
    const cands = items.map((p, i) => {
      const out = [];
      for (const [ring, ringCost] of RINGS) {
        for (const [dir, dirCost] of DIRS) {
          const box = boxAt(p, dir, p.r + 5 + ring);
          const lead = ring > 0 ? leaderOf(p, box) : null;
          let fixed = ringCost + dirCost + 40 * outside(box, bounds);
          for (let j = 0; j < n; j++) {
            if (j === i) continue;
            fixed += 6 * overlap(box, dots[j]);
            if (looksLike(box, items[j])) fixed += 32;     // worse than moving out one ring with a leader line
            if (lead && segDist(items[j].x, items[j].y, lead) < items[j].r + 3) fixed += 45;
          }
          for (const o of blockers) fixed += 6 * overlap(box, o);
          for (const l of lines) if (crosses(box, l)) fixed += l.cost;
          out.push({ box, lead, fixed });
        }
      }
      return out;
    });
    const res = new Array(n);
    const cost = (i, c) => {
      let v = c.fixed;
      for (let j = 0; j < n; j++) {
        const o = res[j];
        if (j === i || !o) continue;
        v += 6 * overlap(c.box, o.box);
        if (o.lead && segHitsBox(o.lead, c.box)) v += 40;
        if (c.lead && segHitsBox(c.lead, o.box)) v += 40;
        if (c.lead && o.lead && segsCross(c.lead, o.lead)) v += 25;
      }
      return v;
    };
    const order = items.map((_, i) => i).sort((a, b) => items[b].pri - items[a].pri);
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const i of order) {
        let best = res[i], bestCost = best ? cost(i, best) - 0.5 : Infinity;   // keep the current spot on near-ties
        for (const c of cands[i]) {
          if (c.fixed >= bestCost) continue;
          const v = cost(i, c);
          if (v < bestCost) { best = c; bestCost = v; }
        }
        if (best !== res[i]) { res[i] = best; changed = true; }
      }
      if (!changed) break;
    }
    return res;
  }

  function points(mode) {
    const M = MODES[mode];
    const pts = [];
    let noX = 0;
    for (const m of D.models || []) {
      if (!m || m.speedOnly) continue;
      const q = m.scores && m.scores.textCore;
      if (!isNum(q)) continue;
      const xv = M.value(m);
      if (!isNum(xv) || xv <= 0) { noX++; continue; }
      pts.push({ m, q, xv });
    }
    return { pts, noX };
  }

  function tipHtml(p, mode) {
    const m = p.m, sp = m.speed || {};
    const t = isNum(sp.taskTime) ? `Median time per task <b>${fmt.sec(sp.taskTime)}</b>` : "";
    const first = isNum(sp.firstOutput) ? ` <span class="muted">· first answer at ${fmt.sec(sp.firstOutput)}</span>` : "";
    const inTask = isNum(sp.inTaskDecode) ? `In-task decode <b>${fmt.tps(sp.inTaskDecode)}</b> tok/s` : "";
    const lines = mode === "time" ? [t + first, inTask] : [inTask, t];
    if (p.zone) lines.push(`<span class="muted">In the most attractive corner</span>`);
    if (m.recommended) lines.push("★ Our pick");
    return LB.modelTip(m, lines.filter(Boolean).join("<br>"));
  }

  function drawPlot(host, mode) {
    host.textContent = "";
    const M = MODES[mode];
    const { pts } = points(mode);
    if (!pts.length) {
      host.append(h("div", { class: "sc-empty" }, "No model has both a quality score and speed data yet."));
      return;
    }
    const avail = Math.floor(host.clientWidth) || 960;
    const W = Math.max(avail, 580);
    const H = Math.round(Math.min(540, Math.max(500, W * 0.75)));
    const narrow = W < 700;
    const fsLab = narrow ? 12 : 13;
    const pad = { l: 50, r: 22, t: 48, b: 64 };
    const x0 = pad.l, x1 = W - pad.r, y0 = pad.t, y1 = H - pad.b;

    // y: text core, from a round number at least 2 points below the weakest model, up to 100
    const qMin = Math.min(...pts.map((p) => p.q));
    const yLo = Math.max(0, Math.min(Q_MIN - 20, Math.floor((qMin - 2) / 10) * 10));
    const Y = (v) => y1 - ((Math.min(100, Math.max(yLo, v)) - yLo) / (100 - yLo)) * (y1 - y0);
    // x: log scale with some air around the data and the threshold
    const xs = pts.map((p) => p.xv);
    const lo = Math.min(...xs, M.thr) / 1.22, hi = Math.max(...xs, M.thr) * 1.16;
    const L = Math.log, X = (v) => x0 + ((L(v) - L(lo)) / (L(hi) - L(lo))) * (x1 - x0);
    const ticks = [];
    for (const t of M.ticks) {
      if (t < lo || t > hi) continue;
      if (!ticks.length || X(t) - X(ticks[ticks.length - 1]) >= (narrow ? 40 : 46)) ticks.push(t);
    }

    const svg = s("svg", { class: ["sc-svg", `sc-${mode}`], width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "group",
      "aria-label": `Scatter plot: text core against ${M.label.toLowerCase()} for ${pts.length} models` });
    const bg = s("g", { "aria-hidden": "true" });
    svg.append(bg);

    // "Most attractive" corner (drawn first, under the grid)
    const zx = Math.max(x0, Math.min(x1, X(M.thr))), zy = Y(Q_MIN);
    const zone = M.lowerBetter ? { x0, x1: zx, y0, y1: zy } : { x0: zx, x1, y0, y1: zy };
    bg.append(s("rect", { class: "sc-zone", x: zone.x0, y: zone.y0, width: Math.max(0, zone.x1 - zone.x0), height: Math.max(0, zone.y1 - zone.y0) }));

    // grid
    for (let t = yLo; t <= 100; t += 10) {
      const y = Math.round(Y(t)) + 0.5;
      bg.append(s("line", { class: t === yLo ? "sc-axis" : "sc-grid-h", x1: x0, x2: x1, y1: y, y2: y }),
        s("text", { class: "sc-tick", x: x0 - 12, y: y + 4, "text-anchor": "end" }, String(t)));
    }
    for (const t of ticks) {
      const x = Math.round(X(t)) + 0.5;
      bg.append(s("line", { class: "sc-grid-v", x1: x, x2: x, y1: y0, y2: y1 }),
        s("text", { class: "sc-tick", x, y: y1 + 20, "text-anchor": "middle" }, M.tick(t)));
    }
    bg.append(s("line", { class: "sc-axis", x1: x0 + 0.5, x2: x0 + 0.5, y1: y0, y2: y1 }));
    // threshold lines run across the whole plot, like the reference
    bg.append(s("line", { class: "sc-thr", x1: x0, x2: x1, y1: zy, y2: zy }),
      s("line", { class: "sc-thr", x1: zx, x2: zx, y1: y0, y2: y1 }));
    // axis captions
    bg.append(s("text", { class: "sc-cap", x: x0, y: y0 - 20 }, "Text core · higher is better"),
      s("text", { class: "sc-cap", x: (x0 + x1) / 2, y: H - 14, "text-anchor": "middle" }, M.axis));

    // zone label in whichever top corner of the zone is free of points (one line if the zone is short)
    const zl1 = "Most attractive", zl2 = M.zone, zh = zone.y1 - zone.y0;
    const two = zh >= 52;
    const zw = Math.max(textW(zl1, 13, 650), two ? textW(zl2, 11.5, 500) : 0) + 4;
    const zfree = (bx) => !pts.some((p) => {
      const px = X(p.xv), py = Y(p.q);
      return px > bx.x0 - 10 && px < bx.x1 + 10 && py > bx.y0 - 10 && py < bx.y1 + 10;
    });
    const zTop = zone.y0 + (two ? 10 : Math.max(2, (zh - 18) / 2)), zBot = zTop + (two ? 34 : 18);
    const zLeft = { x0: zone.x0 + 14, y0: zTop, x1: zone.x0 + 14 + zw, y1: zBot };
    const zRight = { x0: zone.x1 - 14 - zw, y0: zTop, x1: zone.x1 - 14, y1: zBot };
    const zBox = zone.x1 - zone.x0 < zw + 28 || zh < 20 ? null : (zfree(zLeft) || !zfree(zRight) ? zLeft : zRight);
    if (zBox) {
      bg.append(s("text", { class: "sc-zone-t", x: zBox.x0, y: zBox.y0 + 13 }, zl1),
        two ? s("text", { class: "sc-zone-s", x: zBox.x0, y: zBox.y0 + 29 }, zl2) : null);
    }

    // points and labels
    const items = pts.map((p) => {
      const lab = LB.label(p.m), part = p.m.partial ? " · partial" : "";
      const x = X(p.xv), y = Y(p.q);
      p.zone = p.q >= Q_MIN && (M.lowerBetter ? p.xv <= M.thr : p.xv >= M.thr);
      const w = textW(lab, fsLab, p.m.recommended ? 650 : 480) + (part ? textW(part, fsLab, 600) : 0) + 4;
      return { p, lab, part, x, y, r: p.m.recommended ? RING : DOT, w, h: fsLab + 4, pri: 0 };
    });
    items.forEach((it) => {
      const near = items.filter((o) => o !== it && Math.hypot(o.x - it.x, o.y - it.y) < 80).length;
      it.pri = (it.p.m.recommended ? 1000 : 0) + near * 10 + it.p.q / 100;
    });
    const bounds = { x0: x0 + 4, y0: y0 - 6, x1: x1 + 4, y1: y1 - 2 };
    const lines = [
      { x0, x1, y0: zy, y1: zy, cost: 2 }, { x0: zx, x1: zx, y0, y1, cost: 2 },                 // threshold lines
      { x0: zone.x0, x1: zone.x1, y0: zy, y1: zy, cost: 3 }, { x0: zx, x1: zx, y0: zone.y0, y1: zone.y1, cost: 3 }, // zone edges
    ];
    const spots = placeLabels(items, bounds, zBox ? [{ x0: zBox.x0 - 4, y0: zBox.y0 - 2, x1: zBox.x1 + 4, y1: zBox.y1 + 2 }] : [], lines);

    const leaders = s("g", { class: "sc-leaders", "aria-hidden": "true" });
    const labels = s("g", { class: "sc-labels", "aria-hidden": "true" });
    const dots = s("g", { class: "sc-dots" });
    svg.append(leaders, labels, dots);
    const all = [];
    const clear = () => { svg.classList.remove("sc-dim"); all.forEach((x) => x.forEach((e) => e.classList.remove("sc-hot"))); LB.tip.hide(); };
    const drawOrder = items.map((_, i) => i).sort((a, b) => (items[a].p.m.recommended ? 1 : 0) - (items[b].p.m.recommended ? 1 : 0));
    for (const i of drawOrder) {
      const it = items[i], sp = spots[i], m = it.p.m, col = LB.vendor(m).color, b = sp.box;
      // leader line from the dot's edge to the nearest point of its label
      let lead = null;
      if (sp.lead && sp.lead.len > it.r + 9) {
        const l = sp.lead, ux = (l.x2 - l.x1) / l.len, uy = (l.y2 - l.y1) / l.len;
        lead = s("line", { class: "sc-leader", x1: it.x + ux * (it.r + 2), y1: it.y + uy * (it.r + 2), x2: l.x2 - ux * 2, y2: l.y2 - uy * 2 });
        leaders.append(lead);
      }
      const inZone = b.x0 >= zone.x0 - 2 && b.x1 <= zone.x1 + 2 && b.y0 >= zone.y0 - 2 && b.y1 <= zone.y1 + 2;
      const txt = s("text", { class: ["sc-label", m.recommended && "sc-label-rec", inZone && "sc-on-zone"], x: b.x0 + 2, y: b.y1 - 4.5,
        "font-size": fsLab }, it.lab, it.part ? s("tspan", { class: "sc-part" }, it.part) : null);
      labels.append(txt);
      const g = s("g", { class: ["sc-pt", m.recommended && "sc-rec", m.partial && "sc-partial"], tabindex: 0, role: "img",
        "aria-label": `${LB.fullName(m)}: text core ${fmt.pct(it.p.q)}, ${M.label.toLowerCase()} ` +
          (mode === "time" ? fmt.sec(it.p.xv) : fmt.tps(it.p.xv) + " tok/s") + (m.partial ? ", partial run" : "") +
          (m.recommended ? ", our pick" : "") },
        m.recommended ? s("circle", { class: "sc-ring", cx: it.x, cy: it.y, r: RING }) : null,
        s("circle", { class: "sc-dot", cx: it.x, cy: it.y, r: DOT, fill: m.partial ? "#fff" : col, style: m.partial ? { stroke: col } : null }),
        s("circle", { class: "sc-hit", cx: it.x, cy: it.y, r: DOT + 7 }));
      dots.append(g);
      const set = [g, txt].concat(lead ? [lead] : []);
      all.push(set);
      const show = (e) => { clear(); svg.classList.add("sc-dim"); set.forEach((x) => x.classList.add("sc-hot")); LB.tip.show(e, tipHtml(it.p, mode)); };
      g.addEventListener("mouseenter", show);
      g.addEventListener("mousemove", LB.tip.move);
      g.addEventListener("mouseleave", clear);
      g.addEventListener("focus", () => { const r = g.getBoundingClientRect(); show({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); });
      g.addEventListener("blur", clear);
    }
    host.append(svg);
  }

  function fillFoot(foot, mode) {
    foot.textContent = "";
    const { pts, noX } = points(mode);
    const count = new Map();
    for (const p of pts) count.set(p.m.vendor, (count.get(p.m.vendor) || 0) + 1);
    const vendors = Array.from(count.keys()).sort((a, b) => count.get(b) - count.get(a) || LB.vendor(a).name.localeCompare(LB.vendor(b).name));
    const hasRec = pts.some((p) => p.m.recommended);
    foot.append(
      h("span", {}, `${pts.length} model${pts.length === 1 ? "" : "s"} with a quality score and speed data`,
        noX ? ` · ${noX} without ${mode === "time" ? "a time per task" : "a decode speed"}` : ""),
      h("div", { class: "sc-legend" },
        vendors.map((k) => h("span", { class: "sc-leg" }, LB.mono(k, 20), LB.vendor(k).name)),
        hasRec ? h("span", { class: "sc-leg sc-leg-rec" }, h("i", { "aria-hidden": "true" }), "Our pick") : null));
  }

  function render(el) {
    const st = { mode: "time" };
    const seg = LB.seg(Object.keys(MODES).map((k) => ({ value: k, label: MODES[k].label })), st.mode, (v) => {
      st.mode = v;
      if (subP) subP.textContent = MODES[v].sub;
      update();
    });
    seg.setAttribute("aria-label", "Speed measure");
    const head = LB.sectionHead({ title: "Quality vs Speed: find the best model for daily use", sub: MODES[st.mode].sub, right: [seg] });
    const subP = head.querySelector("p");
    const plot = h("div", { class: "sc-plot" });
    const foot = h("div", { class: ["lb-card-foot", "sc-foot"] });
    el.append(head, LB.card("sc-card", plot, foot));

    let lastW = -1;
    function update() {
      lastW = plot.clientWidth;
      LB.tip.hide();
      drawPlot(plot, st.mode);
      fillFoot(foot, st.mode);
    }
    update();
    const relayout = () => { if (plot.clientWidth && plot.clientWidth !== lastW) update(); };
    LB.onResize(relayout);
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(relayout)).observe(plot);
    whenFontLoads(update);
  }

  LB.register({ id: "quality-vs-speed", order: 30, nav: "Quality vs speed", render });
})();
