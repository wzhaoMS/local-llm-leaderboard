/* Hardware: the machine's spec strip, what worked (findings), MTP draft-length sweep and NVMe read speed. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, isNum, fmt } = LB;

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const data = () => LB.data || {};
  const LIME = "#d6ff62", LIME_EDGE = "#b4e03a", GRAY = "#d3d8de";
  const DRIVE_GRAYS = ["#475467", "#a4adb9", "#cfd5dc"];

  const VERDICT = {
    recommended: { label: "Recommended", cls: "lime", order: 0 },
    works: { label: "Works", cls: "", order: 1 },
    avoid: { label: "Avoid", cls: "warn", order: 2 },
  };
  const ICON = {
    recommended: "M3.5 8.5l3 3 6-7",
    works: "M4 8h8",
    avoid: "M4.5 4.5l7 7M11.5 4.5l-7 7",
  };

  // ---------- spec strip ----------
  function specItems() {
    const hw = data().hardware || {};
    const nvme = Array.isArray(data().nvme) ? data().nvme : [];
    const items = [];
    (Array.isArray(hw.gpus) ? hw.gpus : []).forEach((g, i) => {
      if (!g || (!g.name && !isNum(g.vramGB))) return;
      items.push(isNum(g.vramGB) ? { k: `GPU ${i + 1}`, v: `${fmt.int(g.vramGB)} GB`, u: "VRAM", d: g.name } : { k: `GPU ${i + 1}`, v: g.name });
    });
    if (hw.cpu) {
      const mm = /^(.*?)\s*\((.+)\)\s*$/.exec(hw.cpu);
      const parts = mm ? mm[2].split(/\s*\/\s*/) : [];
      if (mm && /\d/.test(parts[0])) items.push({ k: "CPU", v: parts[0], d: [mm[1], ...parts.slice(1)].join(" · ") });
      else items.push({ k: "CPU", v: hw.cpu });
    }
    if (isNum(hw.ramGB)) items.push({ k: "RAM", v: `${fmt.int(hw.ramGB)} GB`, d: "System memory" });
    (Array.isArray(hw.storage) ? hw.storage : []).forEach((st, i) => {
      if (!st) return;
      const base = String(st).replace(/\s*NVMe\s*$/i, "").trim();
      if (!base) return;
      const hit = nvme.find((d) => d && d.drive && String(d.drive).toLowerCase().includes(base.toLowerCase()));
      const read = hit && isNum(hit.seq) ? `${hit.seq.toFixed(2)} GB/s sequential read` : null;
      const sz = /(\d+(?:\.\d+)?)\s*(TB|GB)\b/i.exec(base);
      const name = sz ? (base.slice(0, sz.index) + base.slice(sz.index + sz[0].length)).replace(/\s{2,}/g, " ").trim() : base;
      items.push(sz ? { k: `NVMe ${i + 1}`, v: `${sz[1]} ${sz[2].toUpperCase()}`, d: name, d2: read }
        : { k: `NVMe ${i + 1}`, v: base, d: read });
    });
    if (hw.os) items.push({ k: "OS", v: hw.os });
    if (hw.engine) {
      const e = String(hw.engine).trim(), sp = e.indexOf(" ");
      items.push(sp > 0 ? { k: "Engine", v: e.slice(0, sp), d: e.slice(sp + 1) } : { k: "Engine", v: e });
    }
    return items;
  }

  function specStrip() {
    const items = specItems();
    if (!items.length) return null;
    return LB.card("hw-spec", h("div", { class: "hw-spec-grid" }, items.map((it) => h("div", { class: "hw-spec-item" },
      h("div", { class: "hw-spec-k" }, it.k),
      h("div", { class: "hw-spec-v" }, it.v, it.u ? h("small", {}, it.u) : null),
      it.d ? h("div", { class: "hw-spec-d" }, it.d) : null,
      it.d2 ? h("div", { class: "hw-spec-d" }, it.d2) : null))));
  }

  // ---------- findings ----------
  function metricEl(metric) {
    const t = String(metric == null ? "" : metric).trim();
    if (!t) return null;
    const mm = /^([x×]?\s*[\d.,]+(?:\s*[-–]\s*[\d.,]+)?)\s*(.*)$/i.exec(t);
    if (!mm) return h("div", { class: "hw-metric word" }, h("b", {}, t));
    const n = mm[1].replace(/^x\s*/i, "×").replace(/\s*[-–]\s*/, "–");
    return h("div", { class: "hw-metric" }, h("b", {}, n), mm[2] ? h("span", {}, mm[2]) : null);
  }

  function verdictChip(verdict) {
    const vd = VERDICT[verdict] || { label: verdict ? String(verdict) : "Note", cls: "" };
    return h("span", { class: ["lb-chip", "hw-verdict", vd.cls] },
      ICON[verdict] ? s("svg", { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": 2.2,
        "stroke-linecap": "round", "stroke-linejoin": "round" }, s("path", { d: ICON[verdict] })) : null,
      vd.label);
  }

  function findingCard(f) {
    return LB.card(["hw-find", "hw-" + (VERDICT[f.verdict] ? f.verdict : "note")],
      h("div", { class: "hw-find-top" }, verdictChip(f.verdict)),
      metricEl(f.metric),
      f.title ? h("h3", { class: "hw-find-title" }, f.title) : null,
      f.body ? h("p", { class: "hw-find-body" }, f.body) : null);
  }

  function summaryTile(list) {
    const n = list.length;
    const span3 = n % 3 === 0 ? 3 : 3 - (n % 3);
    const span2 = n % 2 === 0 ? 2 : 1;
    const counts = {};
    for (const f of list) if (VERDICT[f.verdict]) counts[f.verdict] = (counts[f.verdict] || 0) + 1;
    return h("div", { class: ["lb-card", "hw-sum", `hw-s3-${span3}`, `hw-s2-${span2}`] },
      h("div", { class: "hw-sum-k" }, "Findings"),
      h("div", { class: "hw-sum-n" }, String(n)),
      h("div", { class: "hw-sum-list" }, Object.keys(VERDICT).filter((k) => counts[k]).map((k) =>
        h("div", { class: ["hw-sum-item", "hw-" + k] }, h("i"), h("b", {}, String(counts[k])), VERDICT[k].label))));
  }

  function findingsGrid() {
    const list = (Array.isArray(data().hardwareFindings) ? data().hardwareFindings : []).filter((f) => f && (f.title || f.metric || f.body));
    if (!list.length) return null;
    const ord = (f) => (VERDICT[f.verdict] ? VERDICT[f.verdict].order : 9);
    const sorted = list.map((f, i) => ({ f, i })).sort((a, b) => ord(a.f) - ord(b.f) || a.i - b.i).map((x) => x.f);
    return h("div", { class: "hw-grid" }, sorted.map(findingCard), summaryTile(list));
  }

  // ---------- bar charts ----------
  function niceTicks(max, n) {
    if (!(max > 0)) max = 1;
    const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    const top = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toFixed(6));
    return { top, ticks };
  }
  function roundTop(x, y, w, hh, r) {
    r = Math.max(0, Math.min(r, w / 2, hh));
    return `M${x},${y + hh}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh}Z`;
  }

  /** Vertical (grouped) bar chart. groups: [{label: [line1, line2?], bars: [{v, text, fill, stroke, strong, tip}]}] */
  function drawBars(box, cfg) {
    box.textContent = "";
    const groups = cfg.groups.filter((g) => g.bars.length);
    if (!groups.length) { box.append(h("div", { class: "lb-empty" }, "Not measured yet.")); return; }
    const W = Math.max(260, Math.floor(box.clientWidth) || 480);
    const H = cfg.height || 250;
    const lines = Math.max(...groups.map((g) => [].concat(g.label).length));
    const M = { t: 28, r: 4, b: 26 + lines * 14 + (cfg.xTitle ? 20 : 0), l: 38 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const { top, ticks } = niceTicks(Math.max(...groups.flatMap((g) => g.bars.map((b) => b.v))) * 1.1, 4);
    const Y = (v) => M.t + ph - (Math.max(0, v) / top) * ph;
    const svg = s("svg", { class: "hw-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": cfg.aria || "" });
    for (const t of ticks) {
      svg.append(s("line", { x1: M.l, x2: M.l + pw, y1: Y(t), y2: Y(t), class: t === 0 ? "hw-base" : "hw-gridline" }),
        s("text", { x: M.l - 8, y: Y(t), class: "hw-tick", "text-anchor": "end", "dominant-baseline": "middle" }, cfg.tick ? cfg.tick(t) : String(t)));
    }
    const gw = pw / groups.length, gap = 5;
    groups.forEach((g, gi) => {
      const n = g.bars.length;
      const inner = Math.min(gw * 0.78, n * (cfg.maxBar || 54) + (n - 1) * gap);
      const bw = (inner - (n - 1) * gap) / n;
      const gx = M.l + gi * gw + (gw - inner) / 2;
      g.bars.forEach((b, bi) => {
        const x = gx + bi * (bw + gap), y = Y(b.v), hh = M.t + ph - y;
        const bar = s("path", { class: ["hw-bar", b.strong && "best"], d: roundTop(x, y, bw, hh, Math.min(6, bw / 3)), fill: b.fill,
          stroke: b.stroke || "none" });
        if (b.tip) LB.tip.attach(bar, b.tip);
        const label = b.short && bw < (cfg.shortBelow || 0) ? b.short : b.text;
        svg.append(bar, s("text", { x: x + bw / 2, y: y - 7, class: ["hw-val", b.strong && "best", n > 2 && bw < 34 && "small"], "text-anchor": "middle" }, label));
      });
      [].concat(g.label).forEach((ln, li) => svg.append(s("text", { x: M.l + gi * gw + gw / 2, y: M.t + ph + 18 + li * 14,
        class: ["hw-xlab", li > 0 && "sub", g.strong && "strong"], "text-anchor": "middle" }, ln)));
    });
    if (cfg.xTitle) svg.append(s("text", { x: M.l + pw / 2, y: H - 4, class: "hw-axis-title", "text-anchor": "middle" }, cfg.xTitle));
    if (cfg.yTitle) svg.append(s("text", { x: 0, y: 10, class: "hw-axis-title" }, cfg.yTitle));
    box.append(svg);
  }

  function chartCard(title, chip, caption, body, foot) {
    return LB.card("hw-chart",
      h("div", { class: "hw-chart-head" }, h("h3", {}, title), chip ? LB.chip(chip, "hw-chip") : null),
      caption ? h("p", { class: "hw-caption" }, caption) : null,
      body,
      foot ? h("div", { class: "hw-chart-foot" }, foot) : null);
  }

  function mtpChart(redraws) {
    const sw = data().mtpSweep;
    const pts = (sw && Array.isArray(sw.points) ? sw.points : []).filter((p) => p && isNum(p.draft) && isNum(p.tps))
      .sort((a, b) => a.draft - b.draft);
    if (!pts.length) return null;
    const best = Math.max(...pts.map((p) => p.tps));
    const bestPt = pts.find((p) => p.tps === best);
    const off = pts.find((p) => p.draft === 0);
    const name = (p) => (p.draft === 0 ? "MTP off" : `Draft length ${p.draft}`);
    const box = h("div", { class: "hw-plot" });
    const draw = () => drawBars(box, {
      aria: "Decode speed by MTP draft length", height: 248, maxBar: 64, yTitle: "tok/s", xTitle: "Draft length (tokens)",
      tick: (t) => fmt.int(t),
      groups: pts.map((p) => ({
        label: p.draft === 0 ? "off" : String(p.draft),
        strong: p.tps === best,
        bars: [{ v: p.tps, text: fmt.num(p.tps, 1), fill: p.tps === best ? LIME : GRAY, stroke: p.tps === best ? LIME_EDGE : null, strong: p.tps === best,
          tip: `<b>${name(p)}</b><br>${fmt.num(p.tps, 1)} tok/s` + (off && p !== off && off.tps > 0 ? ` <span class="muted">· ×${(p.tps / off.tps).toFixed(2)} vs off</span>` : "") }],
      })),
    });
    redraws.push({ box, draw });
    const foot = off && bestPt && bestPt !== off && off.tps > 0
      ? [`Best: draft ${bestPt.draft}, `, h("b", {}, `${fmt.num(best, 1)} tok/s`), ` (×${(best / off.tps).toFixed(2)} vs off)`]
      : null;
    return chartCard("MTP speculative decoding", "tok/s",
      sw.model ? `${sw.model} · decode speed by draft length` : "Decode speed by draft length", box, foot);
  }

  const PATTERNS = [
    ["seq", ["Sequential", "read"], "sequential reads"],
    ["rand2m", ["2 MB", "random"], "2 MB random reads"],
    ["rand256k", ["256 KB", "random"], "256 KB random reads"],
    ["rand64k", ["64 KB", "random"], "64 KB random reads"],
  ];

  function nvmeChart(redraws) {
    const drives = (Array.isArray(data().nvme) ? data().nvme : []).filter((d) => d && d.drive);
    if (!drives.length) return null;
    const maxOf = (d) => Math.max(-1, ...PATTERNS.map(([k]) => (isNum(d[k]) ? d[k] : -1)));
    let hi = drives.findIndex((d) => /\b(both|all|together|parallel|raid|striped)\b/i.test(d.drive));
    if (hi < 0) hi = drives.reduce((bi, d, i) => (maxOf(d) > maxOf(drives[bi]) ? i : bi), 0);
    let gi = 0;
    const colors = drives.map((d, i) => (i === hi ? LIME : DRIVE_GRAYS[Math.min(gi++, DRIVE_GRAYS.length - 1)]));
    const box = h("div", { class: "hw-plot" });
    const draw = () => drawBars(box, {
      aria: "NVMe read speed by drive and access pattern", height: 248, maxBar: 30, yTitle: "GB/s", shortBelow: 24,
      tick: (t) => String(t),
      groups: PATTERNS.map(([k, label]) => ({
        label,
        bars: drives.map((d, i) => (isNum(d[k]) ? {
          v: d[k], text: d[k].toFixed(2), short: d[k].toFixed(1), fill: colors[i], stroke: i === hi ? LIME_EDGE : null, strong: i === hi,
          tip: `<b>${esc(d.drive)}</b><br>${label.join(" ")}: ${d[k].toFixed(2)} GB/s`,
        } : null)).filter(Boolean),
      })),
    });
    redraws.push({ box, draw });
    // best single result for the caption foot
    let top = null;
    drives.forEach((d) => PATTERNS.forEach(([k, , phrase]) => { if (isNum(d[k]) && (!top || d[k] > top.v)) top = { v: d[k], d, phrase }; }));
    const legend = h("div", { class: "hw-legend" }, drives.map((d, i) =>
      h("span", { class: ["hw-leg", i === hi && "on"] }, h("i", { style: { background: colors[i], borderColor: i === hi ? LIME_EDGE : colors[i] } }), d.drive)));
    const foot = top ? [`${top.d.drive}: `, h("b", {}, `${top.v.toFixed(2)} GB/s`), ` on ${top.phrase}, the fastest result`] : null;
    return chartCard("NVMe read speed", "GB/s", "Each drive alone and both read in parallel · higher is better", [legend, box], foot);
  }

  function render(el) {
    const redraws = [];
    const charts = [mtpChart(redraws), nvmeChart(redraws)].filter(Boolean);
    el.append(
      LB.sectionHead({ title: "Two GPUs, 128 GB of RAM and a fast CPU: what worked", sub: "Findings from running every model on this machine." }),
      specStrip(),
      findingsGrid(),
      charts.length ? h("div", { class: ["hw-charts", charts.length > 1 && "lb-grid-2"] }, charts) : null);
    const drawOne = (r) => { r.w = r.box.clientWidth; r.draw(); };
    const drawAll = () => redraws.forEach(drawOne);
    drawAll();
    LB.onResize(drawAll);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => redraws.forEach((r) => { if (Math.abs(r.box.clientWidth - r.w) > 1) drawOne(r); }));
      redraws.forEach((r) => ro.observe(r.box));
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll).catch(() => {});
  }

  LB.register({ id: "hardware", order: 70, nav: "Hardware", render });
})();
