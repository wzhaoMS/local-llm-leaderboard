/* Endurance: a cold long-context ladder and a sustained agent-style session with GPU telemetry (m.endurance). */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, isNum, fmt } = LB;

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const num = (o, k) => (o && isNum(o[k]) ? o[k] : null);
  const join = (...p) => p.filter(Boolean).join(" · ");
  const models = () => (LB.data && Array.isArray(LB.data.models) ? LB.data.models : []).filter(Boolean);
  const GPU_INK = ["#344054", "#8c95a3", "#0f766e", "#b45309"];
  const ERR = "#dc2626";

  const kTok = (v) => (v >= 1e6 ? fmt.num(v / 1048576, 0) + "M" : v >= 1000 ? fmt.num(v / 1024, 0) + "K" : fmt.int(v));
  const depthLabel = (l) => String(l == null ? "" : l).replace(/(\d)\s*([km])\b/gi, (x, d, u) => d + u.toUpperCase());
  const bucketLabel = (b) => depthLabel(String(b == null ? "" : b).replace(/\s*-\s*/g, "–"));
  const minText = (v) => (Number.isInteger(v) ? fmt.int(v) : fmt.num(v, 1));
  const signed = (v, d) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt.num(Math.abs(v), d);

  /** The export keeps only the GPUs the model runs on, so every GPU in gpus / gpuSeries belongs to this run. */
  function gpuInfo(m, e) {
    const list = arr(e.gpus);
    const hw = arr(LB.data && LB.data.hardware && LB.data.hardware.gpus);
    const byIdx = new Map(list.map((g, k) => [isNum(g.index) ? g.index : k, g]));
    const idx = new Set(byIdx.keys());
    for (const sm of arr(e.gpuSeries)) for (const g of arr(sm.gpus)) if (isNum(g.i)) idx.add(g.i);
    return [...idx].sort((a, b) => a - b).map((i, k) => {
      const g = byIdx.get(i) || {};
      const hwName = hw[i] && hw[i].name ? String(hw[i].name).replace(/^NVIDIA\s+(GeForce\s+)?/i, "").replace(/\s+Blackwell$/i, "") : "";
      return { i, name: g.name || hwName || `GPU ${i}`, color: GPU_INK[k % GPU_INK.length], stats: g };
    });
  }

  /** Keyboard-reachable tooltip target: same tooltip on hover and on focus (anchored under the element). */
  function tipOn(el, html) {
    LB.tip.attach(el, html);
    el.setAttribute("tabindex", "0");
    el.addEventListener("focus", () => {
      const r = el.getBoundingClientRect();
      LB.tip.show({ clientX: r.left + Math.min(24, r.width / 2), clientY: r.bottom - Math.min(8, r.height / 2) }, typeof html === "function" ? html() : html);
    });
    el.addEventListener("blur", () => LB.tip.hide());
    return el;
  }

  function niceTicks(max, n) {
    if (!(max > 0)) max = 1;
    const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    const top = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toFixed(6));
    return { lo: 0, top, ticks };
  }
  function niceRange(lo, hi, n) {
    if (!(hi > lo)) hi = lo + 1;
    const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = a; v <= b + step / 2; v += step) ticks.push(+v.toFixed(6));
    return { lo: a, top: b, ticks };
  }
  /** Index of the item whose `t` is closest to `t` (items sorted by t). */
  function nearest(items, t) {
    let lo = 0, hi = items.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (items[mid].t < t) lo = mid; else hi = mid; }
    return Math.abs(items[lo].t - t) <= Math.abs(items[hi].t - t) ? lo : hi;
  }

  // ---------- summary ----------
  function stat(label, value, unit, subs, tip, cls) {
    const el = h("div", { class: ["lb-card", "en-stat", cls] },
      h("div", { class: "en-stat-k" }, label),
      h("div", { class: "en-stat-v" }, value, unit ? h("small", {}, unit) : null),
      subs.filter(Boolean).map((t) => h("div", { class: "en-stat-d" }, t)));
    if (tip) { el.classList.add("en-help"); tipOn(el, tip); }
    return el;
  }

  function summary(m, e) {
    const st = obj(e.sustained), mem = obj(e.serverMem);
    const ratio = num(st, "ratio") ?? num(e, "sustainRatio");
    const win = isNum(st.windowS) ? `${minText(st.windowS / 60)} min` : "minutes";
    const errs = [num(e, "errors"), num(e, "ladderErrors")];
    const errTotal = errs.some(isNum) ? errs.filter(isNum).reduce((a, b) => a + b, 0) : null;
    const cards = [
      stat("Session", isNum(e.minutes) ? minText(e.minutes) : "—", "min", [
        join(isNum(e.requests) && `${fmt.int(e.requests)} requests`, isNum(e.restarts) && `${fmt.int(e.restarts)} restarts`),
        join(isNum(e.sessionRequests) && `${fmt.int(e.sessionRequests)} turns`, isNum(e.sideRequests) && `${fmt.int(e.sideRequests)} side`,
          isNum(e.nCtx) && `${kTok(e.nCtx)} context`)],
      `<b>Agent-style session</b><br>Session turns grow the conversation; side requests are short and unrelated.` +
        (isNum(e.nCtx) ? `<br>Context window ${fmt.int(e.nCtx)} tokens` : "") + (e.thinking ? `<br>Thinking: ${esc(e.thinking === "server" ? "server default" : e.thinking)}` : "")),
      stat("Sustained", isNum(ratio) ? fmt.num(ratio, 2) : "—", isNum(ratio) ? "×" : "", [
        isNum(st.first) && isNum(st.last) ? `${fmt.num(st.first, 0)} → ${fmt.num(st.last, 0)} tok/s, first vs last ${win}` : `last ÷ first ${win}`,
        join(isNum(st.probeRatio) && `probe ${fmt.num(st.probeRatio, 2)}`, isNum(st.depthAdjustedRatio) && `depth-adjusted ${fmt.num(st.depthAdjustedRatio, 2)}`)],
      `<b>Sustained ratio</b><br>Median decode in the last ÷ first ${esc(win)} of the session; 1.00 = no slowdown. It falls partly because the context grows.` +
        `<br>The probe ratio uses only the short side requests, so it isolates thermal and clock drift; depth-adjusted accounts for prompt length.`,
      ratio !== null && ratio >= 0.97 ? "en-good" : null),
      stat("Decode", isNum(e.decodeMedian) ? fmt.num(e.decodeMedian, 1) : "—", "tok/s", ["median per request",
        isNum(e.decodeP10) && isNum(e.decodeP90) ? `p10–p90: ${fmt.num(e.decodeP10, 0)}–${fmt.num(e.decodeP90, 0)} tok/s` : null]),
      stat("Time to first token", isNum(e.ttftMedian) ? fmt.num(e.ttftMedian, 2) : "—", "s", ["median per request",
        isNum(e.cacheHit) ? "with the prompt cache on" : null]),
      stat("Prompt cache hit", isNum(e.cacheHit) ? fmt.num(e.cacheHit, 1) : "—", "%", ["over the whole session",
        isNum(e.sideRequests) ? "side requests miss the cache" : null]),
      stat("MTP acceptance", isNum(e.acceptRate) ? fmt.num(e.acceptRate, 1) : "—", "%", ["draft tokens accepted",
        isNum(m.speed && m.speed.mtp && m.speed.mtp.draft) ? `draft length ${m.speed.mtp.draft}` : null]),
      stat("Server memory", isNum(mem.growthGiB) ? signed(mem.growthGiB, 1) : "—", "GiB", [
        isNum(mem.startGiB) && isNum(mem.endGiB) ? `${fmt.num(mem.startGiB, 1)} → ${fmt.num(mem.endGiB, 1)} GiB` + (isNum(mem.maxGiB) ? ` · peak ${fmt.num(mem.maxGiB, 1)}` : "") :
          isNum(mem.growthGiB) ? "change over the run" : null,
        isNum(e.commitFreeMinGiB) ? `min free commit ${fmt.num(e.commitFreeMinGiB, 1)} GiB` : null],
      `<b>Server memory</b><br>Memory of the model server at the start and end of the run; a falling or flat line means no leak.` +
        (isNum(e.commitFreeMinGiB) ? `<br>Min free commit = the least free Windows commit charge seen during the run.` : "") +
        (isNum(e.serverCpuPct) ? `<br>Server CPU: ${fmt.int(e.serverCpuPct)}% (100% = one core)` : "")),
      stat("Errors", errTotal === null ? "—" : fmt.int(errTotal), "", [
        join(isNum(errs[0]) && `${fmt.int(errs[0])} session`, isNum(errs[1]) && `${fmt.int(errs[1])} ladder`),
        isNum(e.restarts) ? "restarts are part of the test" : null], null, errTotal === 0 ? "en-good" : errTotal > 0 ? "en-bad" : null),
    ];
    return h("div", { class: "en-stats" }, cards);
  }

  // ---------- chart A: cold ladder ----------
  const LADDER = [
    { key: "ttft", title: "Time to first token", unit: "s", say: "seconds", note: "lower is better", fmt: (v) => fmt.num(v, v < 10 ? 2 : 1), tick: (v) => fmt.num(v, Number.isInteger(v) ? 0 : 1) },
    { key: "prefill", title: "Prefill", unit: "tok/s", say: "tokens per second", note: "higher is better", fmt: (v) => fmt.int(v), tick: (v) => fmt.int(v) },
    { key: "decode", title: "Decode", unit: "tok/s", say: "tokens per second", note: "higher is better", fmt: (v) => fmt.num(v, 1), tick: (v) => fmt.int(v) },
  ];

  function ladderTip(d, e) {
    return `<b>${esc(depthLabel(d.label))}${d.clamped ? "*" : ""}</b> <span class="muted">· ${fmt.int(d.promptTokens)} prompt tokens</span>` +
      `<br>TTFT <b>${isNum(d.ttft) ? fmt.num(d.ttft, 2) + " s" : "—"}</b>` +
      `<br>Prefill <b>${isNum(d.prefill) ? fmt.int(d.prefill) : "—"}</b> tok/s` +
      `<br>Decode <b>${isNum(d.decode) ? fmt.num(d.decode, 1) : "—"}</b> tok/s` +
      (d.clamped ? `<hr><span class="muted">* clamped to fit the ${isNum(e.nCtx) ? fmt.int(e.nCtx) + "-token " : ""}context</span>` : "");
  }

  function drawLadderPanel(box, pts, p, color, e) {
    box.textContent = "";
    const data = pts.filter((d) => isNum(d[p.key]));
    if (!data.length) { box.append(h("div", { class: "lb-empty" }, "Not measured.")); return; }
    const W = Math.max(220, Math.floor(box.clientWidth) || 320), H = 196;
    const M = { t: 22, r: 22, b: 28, l: 46 };
    const lx = data.map((d) => Math.log2(d.promptTokens));
    const lo = Math.min(...lx), hi = Math.max(...lx), span = Math.max(hi - lo, 1), pad = 0.16 * span;
    const X = (v) => M.l + ((Math.log2(v) - (lo - pad)) / (span + 2 * pad)) * (W - M.l - M.r);
    const { top, ticks } = niceTicks(Math.max(...data.map((d) => d[p.key])) * 1.2, 4);
    const Y = (v) => M.t + (1 - v / top) * (H - M.t - M.b);
    const svg = s("svg", { class: "en-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": `${p.title} by prompt length` });
    for (const t of ticks) {
      svg.append(s("line", { x1: M.l, x2: W - M.r, y1: Y(t), y2: Y(t), class: t === 0 ? "en-base" : "en-grid", "aria-hidden": "true" }),
        s("text", { x: M.l - 8, y: Y(t), class: "en-tick", "text-anchor": "end", "dominant-baseline": "middle", "aria-hidden": "true" }, p.tick(t)));
    }
    for (const d of data) {
      svg.append(s("line", { x1: X(d.promptTokens), x2: X(d.promptTokens), y1: M.t, y2: H - M.b, class: "en-vgrid", "aria-hidden": "true" }),
        s("text", { x: X(d.promptTokens), y: H - M.b + 17, class: ["en-tick", "en-xl", d.clamped && "en-clamped"], "text-anchor": "middle", "aria-hidden": "true" },
          depthLabel(d.label) + (d.clamped ? "*" : "")));
    }
    svg.append(s("path", { class: "en-lline", stroke: color, "aria-hidden": "true",
      d: data.map((d, i) => `${i ? "L" : "M"}${X(d.promptTokens).toFixed(1)} ${Y(d[p.key]).toFixed(1)}`).join(" ") }));
    data.forEach((d, i) => {
      const cx = X(d.promptTokens), cy = Y(d[p.key]);
      const anchor = data.length > 1 && i === data.length - 1 && cx > W - M.r - 30 ? "end" : data.length > 1 && i === 0 && cx < M.l + 30 ? "start" : "middle";
      svg.append(s("circle", { class: ["en-ldot", d.clamped && "en-ldot-c"], cx, cy, r: 4.2, stroke: color, fill: d.clamped ? "#fff" : color, "aria-hidden": "true" }),
        s("text", { x: cx, y: cy - 10, class: "en-lval", "text-anchor": anchor, "aria-hidden": "true" }, p.fmt(d[p.key])));
      const hit = s("circle", { class: "en-hit", cx, cy, r: 14, role: "img",
        "aria-label": `${p.title} at ${depthLabel(d.label)}${d.clamped ? " (clamped)" : ""}, ${fmt.int(d.promptTokens)} prompt tokens: ${p.fmt(d[p.key])} ${p.say}` });
      svg.append(tipOn(hit, () => ladderTip(d, e)));
    });
    box.append(svg);
  }

  function ladderCard(m, e, redraws) {
    const all = arr(e.ladder);
    const pts = all.filter((d) => !d.skipped && isNum(d.promptTokens) && d.promptTokens > 0).sort((a, b) => a.promptTokens - b.promptTokens);
    const skipped = all.filter((d) => d.skipped).map((d) => depthLabel(d.label)).filter(Boolean);
    if (!pts.length && !skipped.length) return null;
    const color = LB.vendor(m).color;
    const grid = h("div", { class: "en-ladder" });
    for (const p of LADDER) {
      const box = h("div", { class: "en-plot" });
      grid.append(h("div", { class: "en-panel" },
        h("div", { class: "en-panel-title" }, p.title, h("span", {}, ` ${p.unit} · ${p.note}`)), box));
      redraws.push({ box, draw: () => drawLadderPanel(box, pts, p, color, e) });
    }
    const notes = pts.filter((d) => d.clamped).map((d) =>
      `* ${depthLabel(d.label)} was clamped to ${fmt.int(d.promptTokens)} tokens to fit the ${isNum(e.nCtx) ? fmt.int(e.nCtx) + "-token " : ""}context.`);
    if (skipped.length) notes.push(`Skipped, above the context limit: ${skipped.join(", ")}.`);
    if (num(e, "ladderErrors")) notes.push(`${fmt.int(e.ladderErrors)} ladder request${e.ladderErrors === 1 ? "" : "s"} failed.`);
    return LB.card("en-card",
      h("div", { class: "en-head" },
        h("div", {}, h("h3", {}, "Cold long-context ladder"),
          h("p", { class: "en-caption" }, "One cold request per prompt length (prompt cache off, real repository text), then about 300 decoded tokens.")),
        LB.chip(`${pts.length} depth${pts.length === 1 ? "" : "s"}`, "en-chip")),
      pts.length ? grid : h("div", { class: "lb-empty" }, "Every depth was above the context limit."),
      notes.length ? h("div", { class: "en-notes" }, notes.map((n) => h("div", {}, n))) : null);
  }

  // ---------- chart B: sustained session ----------
  function rollingMedian(vals, w) {
    const half = Math.floor(w / 2);
    return vals.map((_, i) => {
      const win = vals.slice(Math.max(0, i - half), i + half + 1).slice().sort((a, b) => a - b);
      return win[Math.floor(win.length / 2)];
    });
  }

  function sessionTip(rq, sample, gpus) {
    const kind = rq.error ? "Failed request" : rq.side ? "Side request" : "Session turn";
    let html = `<b>${kind}</b> <span class="muted">· ${fmt.num(rq.t, 2)} min</span>` +
      (isNum(rq.decode) ? `<br>Decode <b>${fmt.num(rq.decode, 1)}</b> tok/s` : "") +
      (isNum(rq.prompt) ? `<br>Prompt <b>${fmt.int(rq.prompt)}</b> tokens` : "");
    if (sample) {
      const lines = gpus.map((g) => {
        const x = arr(sample.gpus).find((v) => v.i === g.i);
        if (!x || (!isNum(x.temp) && !isNum(x.power))) return null;
        return `${esc(g.name)}: ${isNum(x.temp) ? fmt.int(x.temp) + " °C" : "—"} · ${isNum(x.power) ? fmt.int(x.power) + " W" : "—"}`;
      }).filter(Boolean);
      if (lines.length) html += `<hr>${lines.join("<br>")}`;
    }
    return html;
  }

  function drawTimeline(box, m, e, reqs, gpus) {
    box.textContent = "";
    const series = arr(e.gpuSeries).filter((x) => isNum(x.t)).sort((a, b) => a.t - b.t);
    const restarts = (Array.isArray(e.restartsAt) ? e.restartsAt : []).filter(isNum);
    const color = LB.vendor(m).color;
    const W = Math.max(300, Math.floor(box.clientWidth) || 900);
    const narrow = W < 640;
    const temps = series.flatMap((x) => arr(x.gpus).map((g) => g.temp)).filter(isNum);
    const powers = series.flatMap((x) => arr(x.gpus).map((g) => g.power)).filter(isNum);
    const right = temps.length || powers.length;
    const M = { l: narrow ? 38 : 50, r: right ? (narrow ? 34 : 50) : 14, t: 22 };
    const H1 = narrow ? 200 : 280, GAP = narrow ? 40 : 44, H2 = narrow ? 104 : 136, XB = 40;
    const U0 = M.t, U1 = U0 + H1, L0 = U1 + GAP, L1 = L0 + H2, H = L1 + XB;
    const tMax = Math.max(isNum(e.minutes) ? e.minutes : 0, reqs[reqs.length - 1].t, series.length ? series[series.length - 1].t : 0, 1e-6);
    const X = (t) => M.l + (t / tMax) * (W - M.l - M.r);
    const decs = reqs.map((r) => r.decode).filter(isNum);
    const dAx = niceTicks((decs.length ? Math.max(...decs) : 1) * 1.06, narrow ? 4 : 5);
    const Yd = (v) => U0 + (1 - v / dAx.top) * H1;
    const tAx = temps.length ? niceRange(Math.min(...temps) - 4, Math.max(...temps) + 4, narrow ? 4 : 5) : null;
    const Yt = (v) => U0 + (1 - (v - tAx.lo) / (tAx.top - tAx.lo)) * H1;
    const prom = reqs.map((r) => r.prompt).filter(isNum);
    const pAx = niceTicks((prom.length ? Math.max(...prom) / 1000 : 1) * 1.04, 3);
    const Yp = (v) => L0 + (1 - v / 1000 / pAx.top) * H2;
    const wAx = powers.length ? niceTicks(Math.max(...powers) * 1.04, 3) : null;
    const Yw = (v) => L0 + (1 - v / wAx.top) * H2;

    const svg = s("svg", { class: "en-svg en-tl-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": "Decode speed per request, GPU temperature, prompt length and GPU power over the session" });
    const grid = s("g");
    for (const t of dAx.ticks) grid.append(s("line", { x1: M.l, x2: W - M.r, y1: Yd(t), y2: Yd(t), class: t === 0 ? "en-base" : "en-grid" }),
      s("text", { x: M.l - 8, y: Yd(t), class: "en-tick", "text-anchor": "end", "dominant-baseline": "middle" }, fmt.int(t)));
    if (tAx) for (const t of tAx.ticks) grid.append(s("text", { x: W - M.r + 8, y: Yt(t), class: "en-tick", "dominant-baseline": "middle" }, fmt.int(t)));
    for (const t of pAx.ticks) grid.append(s("line", { x1: M.l, x2: W - M.r, y1: Yp(t * 1000), y2: Yp(t * 1000), class: t === 0 ? "en-base" : "en-grid" }),
      s("text", { x: M.l - 8, y: Yp(t * 1000), class: "en-tick", "text-anchor": "end", "dominant-baseline": "middle" }, fmt.int(t) + (t ? "K" : "")));
    if (wAx) for (const t of wAx.ticks) grid.append(s("text", { x: W - M.r + 8, y: Yw(t), class: "en-tick", "dominant-baseline": "middle" }, fmt.int(t)));
    const step = tMax > 30 ? 10 : tMax > 12 ? 5 : tMax > 4 ? 2 : 1;
    for (let t = 0; t <= tMax + 1e-9; t += step) {
      grid.append(s("text", { x: X(t), y: L1 + 18, class: "en-tick", "text-anchor": "middle" }, fmt.int(t)));
      grid.append(s("line", { x1: X(t), x2: X(t), y1: L1, y2: L1 + 4, class: "en-base" }));
    }
    grid.append(
      s("text", { x: M.l - (narrow ? 34 : 46), y: U0 - 10, class: "en-axis" }, "Decode tok/s"),
      tAx ? s("text", { x: W, y: U0 - 10, class: "en-axis", "text-anchor": "end" }, "GPU °C") : null,
      s("text", { x: M.l - (narrow ? 34 : 46), y: L0 - 10, class: "en-axis" }, "Prompt tokens"),
      wAx ? s("text", { x: W, y: L0 - 10, class: "en-axis", "text-anchor": "end" }, "GPU W") : null,
      s("text", { x: M.l + (W - M.l - M.r) / 2, y: H - 4, class: "en-axis", "text-anchor": "middle" }, "Minutes into the session"));
    svg.append(grid);

    const gR = s("g", { class: "en-restarts" });
    for (const t of restarts) if (t >= 0 && t <= tMax) gR.append(s("line", { x1: X(t), x2: X(t), y1: U0, y2: L1, class: "en-restart" }));
    svg.append(gR);

    // lower panel: prompt length bars, GPU power
    const bw = Math.max(1, Math.min(4, ((W - M.l - M.r) / Math.max(reqs.length, 1)) * 0.7));
    const gBars = s("g", { class: "en-bars", fill: color });
    for (const r of reqs) if (isNum(r.prompt) && r.prompt > 0) {
      const y = Yp(r.prompt);
      gBars.append(s("rect", { x: (X(r.t) - bw / 2).toFixed(1), y: y.toFixed(1), width: bw.toFixed(1), height: Math.max(0.5, L1 - y).toFixed(1) }));
    }
    svg.append(gBars);
    const line = (pts, Yf, k) => pts.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)} ${Yf(p[k]).toFixed(1)}`).join(" ");
    for (const g of gpus) {
      const pts = series.map((x) => { const v = arr(x.gpus).find((q) => q.i === g.i); return v ? { t: x.t, temp: v.temp, power: v.power } : null; }).filter(Boolean);
      const pw = pts.filter((p) => isNum(p.power)), tp = pts.filter((p) => isNum(p.temp));
      if (wAx && pw.length > 1) svg.append(s("path", { class: "en-power", stroke: g.color, d: line(pw, Yw, "power") }));
      if (tAx && tp.length > 1) svg.append(s("path", { class: "en-temp", stroke: g.color, d: line(tp, Yt, "temp") }));
    }

    // upper panel: rolling median of session turns, side requests (hollow), session turns (filled), failures
    const turns = reqs.filter((r) => !r.side && !r.error && isNum(r.decode));
    if (turns.length > 2) {
      const med = rollingMedian(turns.map((r) => r.decode), 7);
      svg.append(s("path", { class: "en-median", stroke: color, d: turns.map((r, i) => `${i ? "L" : "M"}${X(r.t).toFixed(1)} ${Yd(med[i]).toFixed(1)}`).join(" ") }));
    }
    const rr = narrow ? 2.3 : 2.9;
    const gSide = s("g", { class: "en-side" }), gTurn = s("g", { class: "en-turn", fill: color }), gErr = s("g", { class: "en-err" });
    for (const r of reqs) {
      if (r.error || !isNum(r.decode)) {
        const x = X(r.t), y = U1 - 6;
        gErr.append(s("path", { d: `M${x - 4} ${y - 4}L${x + 4} ${y + 4}M${x + 4} ${y - 4}L${x - 4} ${y + 4}`, stroke: ERR }));
      } else if (r.side) gSide.append(s("circle", { cx: X(r.t).toFixed(1), cy: Yd(r.decode).toFixed(1), r: rr + 0.5 }));
      else gTurn.append(s("circle", { cx: X(r.t).toFixed(1), cy: Yd(r.decode).toFixed(1), r: rr }));
    }
    svg.append(gSide, gTurn, gErr);

    // hover: nearest request in time, plus the GPU sample closest to it
    const guide = s("line", { class: "en-guide", y1: U0, y2: L1, x1: 0, x2: 0 });
    const ring = s("circle", { class: "en-ring", r: rr + 3.5, cx: 0, cy: 0, stroke: color });
    const hover = s("g", { class: "en-hover" }, guide, ring);
    svg.append(hover);
    const hide = () => { svg.classList.remove("en-hovering"); LB.tip.hide(); };
    svg.addEventListener("mousemove", (ev) => {
      const b = svg.getBoundingClientRect();
      const mx = ev.clientX - b.left;
      if (mx < M.l - 6 || mx > W - M.r + 6) { hide(); return; }
      const t = ((mx - M.l) / (W - M.l - M.r)) * tMax;
      const rq = reqs[nearest(reqs, t)];
      const sample = series.length ? series[nearest(series, rq.t)] : null;
      guide.setAttribute("x1", X(rq.t)); guide.setAttribute("x2", X(rq.t));
      ring.setAttribute("cx", X(rq.t)); ring.setAttribute("cy", isNum(rq.decode) ? Yd(rq.decode) : U1 - 6);
      svg.classList.add("en-hovering");
      LB.tip.show(ev, sessionTip(rq, sample, gpus));
    });
    svg.addEventListener("mouseleave", hide);
    box.append(svg);
  }

  function legendItem(swatch, text, cls) { return h("span", { class: ["en-leg", cls] }, swatch, text); }
  function swatch(kind, color) {
    const sv = s("svg", { width: 22, height: 12, viewBox: "0 0 22 12", "aria-hidden": "true" });
    if (kind === "dot") sv.append(s("circle", { cx: 11, cy: 6, r: 3.6, fill: color }));
    else if (kind === "ring") sv.append(s("circle", { cx: 11, cy: 6, r: 3.6, fill: "#fff", stroke: "#344054", "stroke-width": 1.4 }));
    else if (kind === "bar") sv.append(s("rect", { x: 7, y: 1, width: 8, height: 10, rx: 1, fill: color, opacity: 0.32 }));
    else sv.append(s("line", { x1: 1, x2: 21, y1: 6, y2: 6, stroke: color, "stroke-width": kind === "median" ? 2 : 1.6,
      "stroke-dasharray": kind === "dash" ? "4 3" : kind === "dot-line" ? "1.5 3" : null, opacity: kind === "median" ? 0.6 : 1 }));
    return sv;
  }

  function timelineCard(m, e, redraws) {
    const reqs = arr(e.timeline).filter((r) => isNum(r.t)).sort((a, b) => a.t - b.t);
    if (!reqs.length) return null;
    const gpus = gpuInfo(m, e);
    const color = LB.vendor(m).color;
    // GPUs with at least two temperature or power samples get a line (and a legend entry)
    const drawn = gpus.filter((g) => ["temp", "power"].some((k) =>
      arr(e.gpuSeries).filter((x) => isNum(x.t) && arr(x.gpus).some((v) => v.i === g.i && isNum(v[k]))).length > 1));
    const hasSeries = drawn.length > 0;
    const box = h("div", { class: "en-tl" });
    redraws.push({ box, draw: () => drawTimeline(box, m, e, reqs, gpus) });
    const restarts = (Array.isArray(e.restartsAt) ? e.restartsAt : []).filter(isNum).length;
    const legend = h("div", { class: "en-legend" },
      h("div", { class: "en-leg-row" },
        legendItem(swatch("dot", color), "Session turn"),
        legendItem(swatch("ring"), "Side request"),
        legendItem(swatch("median", color), "Rolling median (7 turns)"),
        restarts ? legendItem(swatch("dot-line", "#8c95a3"), "Session restart") : null,
        reqs.some((r) => r.error || !isNum(r.decode)) ? legendItem(h("b", { class: "en-x" }, "×"), "Failed request") : null),
      h("div", { class: "en-leg-row" },
        legendItem(swatch("bar", color), "Prompt length"),
        hasSeries ? drawn.map((g) => legendItem(h("span", { class: "en-gpu-sw" }, swatch("dash", g.color), swatch("line", g.color)), g.name)) : null),
      hasSeries ? h("div", { class: "en-leg-note" }, "GPU lines: dashed = temperature (°C, top), solid = power (W, bottom)") : null);
    return LB.card("en-card",
      h("div", { class: "en-head" },
        h("div", {}, h("h3", {}, "Sustained session"),
          h("p", { class: "en-caption" }, "Decode speed of every request with GPU temperature (top); prompt length per request and GPU power (bottom).")),
        LB.chip(join(isNum(e.minutes) && `${minText(e.minutes)} min`, `${fmt.int(reqs.length)} requests`), "en-chip")),
      legend, box,
      h("div", { class: "en-notes" },
        h("div", {}, "Filled dots are session turns: the conversation grows by 2–6K tokens per turn and restarts near the context limit (dotted lines). " +
          "Hollow dots are short side requests, a context-independent probe of thermal and clock drift.")));
  }

  // ---------- tables ----------
  function table(cls, head, rows) {
    return h("div", { class: "en-scroll" }, h("table", { class: ["en-table", cls] },
      h("thead", {}, h("tr", {}, head.map((c) => h("th", { class: c.num ? "en-num" : null }, c.label, c.unit ? h("small", {}, c.unit) : null)))),
      h("tbody", {}, rows)));
  }

  function depthCard(m, e) {
    const rows = arr(e.byDepth);
    if (!rows.length) return null;
    const max = Math.max(0, ...rows.map((r) => r.decode).filter(isNum));
    const color = LB.vendor(m).color;
    return LB.card("en-card en-tcard",
      h("div", { class: "en-head" }, h("div", {}, h("h3", {}, "Decode by prompt length"),
        h("p", { class: "en-caption" }, "Session requests grouped by how long the prompt was."))),
      table("en-depth", [{ label: "Prompt length" }, { label: "Requests", num: true }, { label: "Decode", unit: "tok/s" },
        { label: "TTFT", unit: "s", num: true }, { label: "Prefill", unit: "tok/s", num: true }],
      rows.map((r) => h("tr", {},
        h("th", { scope: "row" }, bucketLabel(r.bucket)),
        h("td", { class: "en-num" }, isNum(r.n) ? fmt.int(r.n) : "—"),
        h("td", { class: "en-barcell" }, h("span", { class: "en-num" }, isNum(r.decode) ? fmt.num(r.decode, 1) : "—"),
          isNum(r.decode) && max > 0 ? LB.bar(r.decode / max, color) : null),
        h("td", { class: "en-num" }, isNum(r.ttft) ? fmt.num(r.ttft, 2) : "—"),
        h("td", { class: "en-num" }, isNum(r.prefill) ? fmt.int(r.prefill) : "—")))));
  }

  /** Metrics as rows and one column per GPU the model ran on, so a single-GPU run gives a compact two-column table. */
  const GPU_ROWS = [
    { label: "Temperature", unit: "°C · max (mean)", max: "tempMax", mean: "tempMean", d: 1 },
    { label: "Power", unit: "W · max (mean)", max: "powerMax", mean: "powerMean", d: 0 },
    { label: "SM clock", unit: "MHz · median", max: "smClockMedian" },
    { label: "Utilisation", unit: "% · mean", max: "utilMean" },
    { label: "Throttled", unit: "% of samples · power / thermal", pair: ["powerCappedPct", "thermalPct"] },
  ];
  function gpuCard(m, e) {
    const gpus = gpuInfo(m, e).filter((g) => Object.keys(g.stats).length);
    if (!gpus.length) return null;
    const n = (v, d) => (isNum(v) ? (d ? fmt.num(v, d) : fmt.int(v)) : "—");
    const rows = GPU_ROWS.filter((r) => gpus.some((g) => [r.max, r.mean, ...(r.pair || [])].some((k) => k && isNum(g.stats[k]))));
    if (!rows.length) return null;
    const cell = (r, st) => {
      if (r.pair) return `${n(st[r.pair[0]], 1)} / ${n(st[r.pair[1]], 1)}`;
      return [n(st[r.max]), r.mean && isNum(st[r.mean]) ? h("small", {}, ` (${n(st[r.mean], r.d)})`) : null];
    };
    return LB.card("en-card en-tcard",
      h("div", { class: "en-head" }, h("div", {}, h("h3", {}, "GPU telemetry"),
        h("p", { class: "en-caption" }, `Sampled every 2 s over the run on the GPU${gpus.length === 1 ? "" : "s"} the model ran on. ` +
          "Throttled = share of samples with a power or thermal limit active."))),
      h("div", { class: "en-scroll" }, h("table", { class: "en-table en-gpus" },
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Metric"),
          gpus.map((g) => h("th", { scope: "col", class: "en-num" }, h("span", { class: "en-gpu" }, h("i", { style: { background: g.color } }), g.name))))),
        h("tbody", {}, rows.map((r) => h("tr", {},
          h("th", { scope: "row" }, r.label, h("small", { class: "en-unit" }, r.unit)),
          gpus.map((g) => h("td", { class: "en-num" }, cell(r, g.stats)))))))));
  }

  // ---------- section ----------
  function modelTag(m) {
    return h("div", { class: "en-model", title: LB.fullName(m) }, LB.mono(m, 26),
      h("div", {}, h("b", {}, LB.fullName(m)), h("span", {}, m.where || "")));
  }

  /** Section subtitle for the selected run (session length comes from the data). */
  function introText(m) {
    const e = m && m.endurance ? m.endurance : {};
    const session = isNum(e.minutes) ? `a ${minText(e.minutes)}-minute agent-style session` : "an agent-style session";
    return `A cold long-context ladder, then ${session}: each turn appends 2–6K tokens of real repository text ` +
      "and asks for a 200–600-token answer, the session restarts near the context limit, and about every 5th request is a short " +
      "unrelated side request. GPU telemetry every 2 s.";
  }

  function render(el) {
    const list = models().filter((m) => !m.reference && m.endurance && typeof m.endurance === "object")
      .sort((a, b) => (b.recommended === true) - (a.recommended === true) || String(LB.label(a)).localeCompare(String(LB.label(b))));
    const pick = (LB.data.verdict || {}).pick;
    let cur = list.find((m) => m.id === pick) || list[0] || null;
    const body = h("div", { class: "en-body" });
    const sub = h("span", { class: "en-intro" });
    let redraws = [];
    const right = list.length > 1
      ? LB.select(list.map((m) => ({ value: m.id, label: LB.fullName(m) })), cur.id, (v) => { cur = list.find((m) => m.id === v) || cur; draw(); },
        "Model for the endurance run")
      : cur ? modelTag(cur) : null;
    el.append(LB.sectionHead({ title: "Endurance under sustained load", sub, right }), body);

    const drawOne = (r) => { r.w = r.box.clientWidth; r.draw(); };
    const ro = window.ResizeObserver ? new ResizeObserver(() => redraws.forEach((r) => { if (Math.abs(r.box.clientWidth - r.w) > 1) drawOne(r); })) : null;
    function draw() {
      body.textContent = "";
      sub.textContent = introText(cur);
      if (ro) ro.disconnect();
      redraws = [];
      if (!cur) { body.append(LB.card("lb-empty", "No endurance runs yet.")); return; }
      const e = cur.endurance;
      const tables = [depthCard(cur, e), gpuCard(cur, e)].filter(Boolean);
      body.append(summary(cur, e), ladderCard(cur, e, redraws), timelineCard(cur, e, redraws),
        tables.length ? h("div", { class: ["en-tables", tables.length > 1 && "en-tables-2"] }, tables) : null);
      redraws.forEach((r) => { drawOne(r); if (ro) ro.observe(r.box); });
    }
    draw();
    LB.onResize(() => redraws.forEach(drawOne));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => redraws.forEach(drawOne)).catch(() => {});
  }

  LB.register({ id: "endurance", order: 65, nav: "Endurance", render });
})();
