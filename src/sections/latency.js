/* Latency & memory (#latency): where a core task's median time goes (first token, thinking, the rest of the task)
   and how much VRAM and RAM each setup holds at its context size. Mirrors the latency-breakdown and memory-footprint
   charts of the benchmark's own report, in the site's chart style. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, isNum, fmt } = LB;
  const D = LB.data || {};

  const num = (v) => (isNum(v) ? v : null);
  const nameOf = (m) => String(LB.label(m) || m.name || m.id || "?");
  const fullOf = (m) => (m.name ? LB.fullName(m) : nameOf(m));
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const secs = (v) => (v < 1 ? v.toFixed(2) : v.toFixed(1));
  const ctxText = (n) => (n >= 1024 ? Math.round(n / 1024) + "K" : String(n));
  /** Local setups under the placement filter. Cloud references have no speed or memory data and stay out. */
  const locals = (filter) => (Array.isArray(D.models) ? D.models : [])
    .filter((m) => m && typeof m === "object" && !m.reference && LB.matchPlacement(m, filter));

  function niceTicks(max, n) {
    if (!(max > 0)) max = 1;
    const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    const top = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toFixed(6));
    return { top, ticks };
  }
  /** The tick set (4-7 intervals) whose top sits closest above max. */
  function snugTicks(max) {
    let best = null;
    for (let n = 4; n <= 7; n++) { const t = niceTicks(max, n); if (!best || t.top < best.top - 1e-9) best = t; }
    return best;
  }

  /** Hover tooltip that also opens on keyboard focus, anchored under the element. */
  function tipOn(el, html) {
    LB.tip.attach(el, html);
    el.addEventListener("focus", () => {
      const r = el.getBoundingClientRect();
      LB.tip.show({ clientX: r.left + 24, clientY: r.bottom - 8 }, html());
    });
    el.addEventListener("blur", () => LB.tip.hide());
    return el;
  }

  /** Vendor badge, short name (plus flags), and a sub line of parts joined by " · ". */
  function nameBlock(m, parts, flags, size) {
    const sub = parts.filter(Boolean).join(" · ");
    return h("div", { class: "lat-name" }, LB.mono(m, size || 24),
      h("div", { class: "lat-name-txt" },
        h("span", { class: "lat-name-top" }, h("b", { title: fullOf(m) }, nameOf(m)), (flags || []).filter(Boolean)),
        sub ? h("small", {}, sub) : null));
  }
  const flag = (text) => h("span", { class: "lat-flag" }, text);
  const cardHead = (title, chip, caption) => [
    h("div", { class: "lat-head" }, h("h3", {}, title), LB.chip(chip, "lat-chip")),
    h("p", { class: "lat-caption" }, caption)];

  // ---------- latency breakdown ----------
  const PHASES = [
    { key: "ttft", label: "Time to first token" },
    { key: "think", label: "Thinking" },
    { key: "rest", label: "Rest of the task", hint: "answer, tool calls and later turns" },
    { key: "open", label: "Not split", hint: "no first-output time", optional: true },
  ];

  /** Median task time split at the median first token and the median first answer or tool call. The three are
     separate medians, so the split points are clamped into order and every part is at least 0; a thinking part
     shorter than the chart's precision counts as none. Without a first-output time the part after the first token
     stays unsplit ("open"). */
  const NO_TIME = 0.05;
  function split(m) {
    const sp = m.speed && typeof m.speed === "object" ? m.speed : {};
    const total = num(sp.taskTime);
    if (total === null || total <= 0) return null;
    const ttft = num(sp.ttft), first = num(sp.firstOutput);
    const a = ttft === null ? 0 : Math.min(Math.max(ttft, 0), total);
    if (first === null) return { m, total, ttft, first, part: { ttft: a, think: 0, rest: 0, open: Math.max(0, total - a) } };
    let b = Math.min(Math.max(first, a), total);
    if (b - a < NO_TIME) b = a;
    return { m, total, ttft, first, part: { ttft: a, think: Math.max(0, b - a), rest: Math.max(0, total - b), open: 0 } };
  }

  function latencyTip(r) {
    const key = (k) => `<i class="lat-tip-key lat-${k}"></i>`;
    const firstAt = r.first === null ? "" : ` <span class="muted">· first answer or tool call at ${secs(r.first)} s</span>`;
    const lines = [`Median task <b>${secs(r.total)} s</b>`,
      `${key("ttft")}First token <b>${r.ttft === null ? "—" : secs(r.ttft) + " s"}</b>` + (r.part.think > 0 ? "" : firstAt)];
    if (r.first === null) {
      lines.push(`${key("open")}Thinking and the rest <b>${secs(r.part.open)} s</b> <span class="muted">· not split, no first-output time</span>`);
    } else {
      if (r.part.think > 0) lines.push(`${key("think")}Thinking <b>≈ ${secs(r.part.think)} s</b>${firstAt}`);
      if (r.part.rest > 0) lines.push(`${key("rest")}Rest of the task <b>≈ ${secs(r.part.rest)} s</b>`);
    }
    lines.push(`<span class="muted">Medians over the core tasks, so the split is approximate.</span>`);
    return LB.modelTip(r.m, lines.join("<br>"));
  }
  function latencyAria(r) {
    const said = [`First token ${r.ttft === null ? "not measured" : secs(r.ttft) + " s"}`];
    if (r.first === null) said.push("first answer or tool call not measured");
    else {
      if (r.part.think > 0) said.push(`thinking about ${secs(r.part.think)} s`);
      said.push(`first answer or tool call at ${secs(r.first)} s`);
      if (r.part.rest > 0) said.push(`rest of the task about ${secs(r.part.rest)} s`);
    }
    return `${fullOf(r.m)}${r.m.where ? ", " + r.m.where : ""}: median task ${secs(r.total)} seconds. ${said.join(", ")}.`;
  }

  function latencyBody(filter) {
    const rows = locals(filter).map(split).filter(Boolean)
      .sort((a, b) => a.total - b.total || nameOf(a.m).localeCompare(nameOf(b.m)));
    if (!rows.length) return { node: h("div", { class: "lb-empty" }, "No task timings for this setup yet."), n: 0 };
    const { top, ticks } = niceTicks(Math.max(...rows.map((r) => r.total)) * 1.06, 5);
    const pct = (v) => ((v / top) * 100).toFixed(3) + "%";
    const tick = (t) => (Number.isInteger(t) ? String(t) : t.toFixed(1));
    const list = h("div", { class: "lat-rows", role: "list", "aria-label": "Median seconds per core task, fastest first" },
      h("div", { class: "lat-grid", "aria-hidden": "true" }, ticks.map((t, i) => h("i", { class: i ? null : "base", style: { left: pct(t) } }))),
      rows.map((r) => tipOn(h("div", { class: "lat-row", role: "listitem", tabindex: "0", "aria-label": latencyAria(r) },
        nameBlock(r.m, [r.m.where], [r.m.partial ? flag("partial") : null]),
        h("div", { class: "lat-track" },
          h("div", { class: "lat-bar", style: { width: pct(r.total) } }, PHASES.map((p) => (r.part[p.key] > 0
            ? h("i", { class: ["lat-seg", "lat-" + p.key], style: { width: ((r.part[p.key] / r.total) * 100).toFixed(3) + "%" } },
              p.key === "think" ? h("span", {}, fmt.num(r.part.think, 1)) : null)
            : null))),
          h("span", { class: "lat-total", style: { left: pct(r.total) } }, secs(r.total), h("small", {}, "s")))),
      () => latencyTip(r))));
    const axis = h("div", { class: "lat-axis", "aria-hidden": "true" },
      h("span"), h("div", { class: "lat-ticks" }, ticks.map((t) => h("span", { style: { left: pct(t) } }, tick(t)))),
      h("span"), h("div", { class: "lat-axis-title" }, "Seconds per core task (median) · lower is better"));
    return { node: h("div", { class: "lat-plot" }, list, axis), n: rows.length, open: rows.some((r) => r.part.open > 0) };
  }

  /** Thinking labels only where they fit; a total that would run off the track moves inside its bar. */
  function fitLabels(root) {
    for (const sp of root.querySelectorAll(".lat-seg > span")) {
      sp.hidden = false;
      sp.hidden = sp.offsetWidth + 6 > sp.parentNode.clientWidth;
    }
    for (const t of root.querySelectorAll(".lat-total")) {
      t.classList.remove("in");
      if (t.offsetLeft + t.offsetWidth > t.parentNode.clientWidth + 1) t.classList.add("in");
    }
  }

  // ---------- agent fix: median time to a correct fix ----------
  /** Local setups with a median time to the first correct fix in the agent fix suite, fastest first. Cloud
     references take 30-200 s here and are compared in their own section. */
  function fixRows(filter) {
    return locals(filter).map((m) => ({ m, v: num(m.agentFixS), solved: num(LB.score(m, "agent_e2e")) }))
      .filter((r) => r.v !== null && r.v > 0)
      .sort((a, b) => a.v - b.v || nameOf(a.m).localeCompare(nameOf(b.m)));
  }
  const solvedPct = (s) => fmt.pct(s, 0) + "%";
  function fixTip(r, suiteName) {
    const lines = [`Median time to a correct fix <b>${secs(r.v)} s</b> <span class="muted">· solved runs only</span>`];
    if (r.solved !== null) lines.push(`${esc(suiteName)}: <b>${solvedPct(r.solved)}</b> of tasks solved`);
    return LB.modelTip(r.m, lines.join("<br>"));
  }
  const fixAria = (r, suiteName) => `${fullOf(r.m)}${r.m.where ? ", " + r.m.where : ""}: median ${secs(r.v)} seconds to a correct fix` +
    (r.solved !== null ? `, ${solvedPct(r.solved)} of ${suiteName} tasks solved.` : ".");

  function fixBody(filter) {
    const rows = fixRows(filter);
    const su = LB.suite("agent_e2e") || {};
    const suiteName = su.name || "Agent fix loop";
    if (!rows.length) return { node: h("div", { class: "lb-empty" }, "No agent fix timings for this setup yet."), n: 0, suiteName };
    const { top, ticks } = snugTicks(Math.max(...rows.map((r) => r.v)) * 1.02);
    const pct = (v) => ((v / top) * 100).toFixed(3) + "%";
    const tick = (t) => (Number.isInteger(t) ? String(t) : t.toFixed(1));
    const list = h("div", { class: "lat-rows", role: "list", "aria-label": "Median seconds to a correct agent fix, fastest first" },
      h("div", { class: "lat-grid", "aria-hidden": "true" }, ticks.map((t, i) => h("i", { class: i ? null : "base", style: { left: pct(t) } }))),
      rows.map((r) => tipOn(h("div", { class: "lat-row", role: "listitem", tabindex: "0", "aria-label": fixAria(r, suiteName) },
        nameBlock(r.m, [r.m.where], [r.m.partial ? flag("partial") : null], 20),
        h("div", { class: "lat-track" }, h("div", { class: "lat-fixbar", style: { width: pct(r.v), background: LB.vendor(r.m).color } })),
        h("span", { class: "lat-fixval" }, h("b", {}, secs(r.v)), h("small", {}, "s"),
          r.solved !== null ? h("span", { class: "lat-solved" }, ` · ${solvedPct(r.solved)} solved`) : null)),
      () => fixTip(r, suiteName))));
    const axis = h("div", { class: "lat-axis", "aria-hidden": "true" },
      h("span"), h("div", { class: "lat-ticks" }, ticks.map((t) => h("span", { style: { left: pct(t) } }, tick(t)))), h("span"),
      h("span"), h("div", { class: "lat-axis-title" }, "Seconds to the first correct fix (median) · lower is better"), h("span"));
    return { node: h("div", { class: "lat-plot lat-fix" }, list, axis), n: rows.length, suiteName };
  }

  // ---------- memory footprint ----------
  /** One lane per GPU (in vramGiB order) plus system RAM; capacities from D.hardware. */
  function lanes() {
    const hw = D.hardware && typeof D.hardware === "object" ? D.hardware : {};
    const gpus = Array.isArray(hw.gpus) ? hw.gpus : [];
    let n = gpus.length;
    for (const m of Array.isArray(D.models) ? D.models : []) if (m && Array.isArray(m.vramGiB)) n = Math.max(n, m.vramGiB.length);
    const out = [];
    for (let i = 0; i < Math.min(n, 4); i++) {
      const g = gpus[i] && typeof gpus[i] === "object" ? gpus[i] : {};
      const name = String(g.name || `GPU ${i + 1}`).replace(/^NVIDIA\s+/i, "").replace(/\bGeForce\s+/i, "").replace(/\s+Blackwell\b/i, "").trim();
      out.push({ name, short: name.replace(/^RTX\s+/i, ""), cap: num(g.vramGB), vram: true,
        get: (m) => (Array.isArray(m.vramGiB) ? num(m.vramGiB[i]) : null) });
    }
    out.push({ name: "System RAM", short: "RAM", cap: num(hw.ramGB), vram: false, get: (m) => num(m.ramGiB) });
    return out;
  }

  function memRows(filter, L) {
    const out = [];
    for (const m of locals(filter)) {
      const vals = L.map((ln) => ln.get(m));
      if (vals.every((v) => v === null)) continue;
      out.push({ m, vals, total: vals.reduce((s, v) => s + (v || 0), 0), ctx: num(m.speed && m.speed.ctx) });
    }
    return out.sort((a, b) => a.total - b.total || nameOf(a.m).localeCompare(nameOf(b.m)));
  }

  /** Why a device has no number: a single-GPU setup leaves the other GPU null (not used), CPU-only uses no VRAM. */
  function noValue(r, ln) {
    if (ln.vram && r.m.placement === "cpu") return "not used (CPU only)";
    if (ln.vram && Array.isArray(r.m.vramGiB) && r.m.vramGiB.some(isNum)) return "not used by this setup";
    return "not measured";
  }
  function memTip(r, L) {
    const lines = L.map((ln, i) => {
      const x = r.vals[i];
      if (x === null) return `${esc(ln.name)} <span class="muted">${noValue(r, ln)}</span>`;
      return `${esc(ln.name)} <b>${fmt.num(x, 1)} GiB</b>` +
        (ln.cap > 0 ? ` <span class="muted">of ${fmt.int(ln.cap)} GB · ${Math.round((x / ln.cap) * 100)}%${x > ln.cap ? ", over capacity" : ""}</span>` : "");
    });
    lines.push(`Total <b>${fmt.num(r.total, 1)} GiB</b>` + (r.ctx !== null ? ` <span class="muted">· context ${fmt.int(r.ctx)} tokens</span>` : ""));
    if (r.m.speedOnly) lines.push(`<span class="muted">Speed-only run: not scored on quality.</span>`);
    return LB.modelTip(r.m, lines.join("<br>"));
  }
  const memAria = (r, L) => `${fullOf(r.m)}${r.m.where ? ", " + r.m.where : ""}` + (r.ctx !== null ? `, ${ctxText(r.ctx)} context` : "") +
    ": " + L.map((ln, i) => `${ln.name} ${r.vals[i] === null ? noValue(r, ln) : fmt.num(r.vals[i], 1) + " GiB" +
      (ln.cap > 0 ? ` of ${fmt.int(ln.cap)} GB` : "")}`).join(", ") + `; total ${fmt.num(r.total, 1)} GiB.`;

  function memoryBody(filter) {
    const L = lanes();
    const rows = memRows(filter, L);
    if (!rows.length) return { node: h("div", { class: "lb-empty" }, "No memory measurements for this setup yet."), n: 0 };
    // each track runs from 0 to the device's capacity, so the end of the track is the capacity line
    L.forEach((ln, i) => { ln.scale = ln.cap > 0 ? ln.cap : niceTicks(Math.max(1, ...rows.map((r) => r.vals[i] || 0)) * 1.1, 4).top; });
    const table = h("div", { class: "lat-mtable" },
      h("div", { class: "lat-mrow lat-mhead", "aria-hidden": "true" },
        h("span", { class: "lat-mh-name" }, "Setup · context"),
        L.map((ln) => h("div", { class: "lat-cell" },
          h("span", { class: "lat-hdev" }, h("b", {}, h("span", { class: "lat-full" }, ln.name), h("span", { class: "lat-short" }, ln.short)),
            h("small", {}, ln.cap > 0 ? fmt.int(ln.cap) + " GB" : "no capacity data")),
          h("span", { class: "lat-hpad" }))),
        h("span", { class: "lat-sum" }, "Total")),
      h("div", { class: "lat-mlist", role: "list", "aria-label": "Memory per device, smallest total first" },
        rows.map((r) => {
          const color = LB.vendor(r.m).color;
          return tipOn(h("div", { class: "lat-mrow", role: "listitem", tabindex: "0", "aria-label": memAria(r, L) },
            nameBlock(r.m, [r.m.where, r.ctx !== null ? ctxText(r.ctx) + " context" : null],
              [r.m.speedOnly ? flag("speed only") : null, r.m.partial ? flag("partial") : null]),
            L.map((ln, i) => {
              const x = r.vals[i];
              const frac = x === null ? 0 : Math.min(1, Math.max(0, x / ln.scale));
              const why = x === null ? noValue(r, ln) : null;
              return h("div", { class: ["lat-cell", why && why.startsWith("not used") && "unused"] },
                h("div", { class: ["lat-gauge", !(ln.cap > 0) && "nocap", ln.cap > 0 && x > ln.cap && "over"] },
                  frac > 0 ? h("i", { style: { width: Math.max(frac * 100, 1.2).toFixed(2) + "%", background: color } }) : null),
                h("span", { class: ["lat-v", (x === null || x === 0) && "na"], title: why }, x === null ? "—" : fmt.num(x, 1)));
            }),
            h("span", { class: "lat-sum" }, h("b", {}, fmt.num(r.total, 1)), h("small", {}, "GiB"))), () => memTip(r, L));
        })));
    table.style.setProperty("--lat-lanes", String(L.length));
    return { node: table, n: rows.length, speedOnly: rows.filter((r) => r.m.speedOnly).length, allCaps: L.every((ln) => ln.cap > 0) };
  }

  // ---------- section ----------
  function render(el) {
    let filter = "all";
    const timeBody = h("div", { class: "lat-body" }), timeFoot = h("div", { class: "lb-card-foot lat-foot" });
    const fixBodyEl = h("div", { class: "lat-body" }), fixFoot = h("div", { class: "lb-card-foot lat-foot" });
    const fixCaption = h("p", { class: "lat-caption" });
    const memBody = h("div", { class: "lat-body" }), memFoot = h("div", { class: "lb-card-foot lat-foot" });
    const legend = h("div", { class: "lat-legend" });
    const memCaption = h("p", { class: "lat-caption" });
    const fit = () => fitLabels(timeBody);

    const draw = () => {
      LB.tip.hide();
      const t = latencyBody(filter), fx = fixBody(filter), mm = memoryBody(filter);
      legend.replaceChildren(...PHASES.filter((p) => !p.optional || (p.key === "open" && t.open)).map((p) =>
        h("span", { class: "lat-leg" }, h("i", { class: "lat-" + p.key }), p.label, p.hint ? h("small", {}, ` (${p.hint})`) : null)));
      timeBody.replaceChildren(t.node);
      fixBodyEl.replaceChildren(fx.node);
      memBody.replaceChildren(mm.node);
      fixCaption.textContent = `Median seconds to the first fix that passes the hidden tests in the ${fx.suiteName} suite ` +
        "(solved runs only), with the share of its tasks solved · lower is better";
      memCaption.textContent = "VRAM per GPU and RAM of the llama.cpp server process at its configured context size. " +
        (mm.allCaps === false ? "Tracks without a known capacity scale to the largest value." : "Each track ends at the device's capacity.");
      timeFoot.replaceChildren(
        h("span", {}, "Each split point is a median of its own, so the parts are approximate; the whole bar is the median task time."),
        h("span", {}, t.n ? plural(t.n, "setup") : ""));
      const maxSec = document.getElementById("max-vs-max");
      const cloud = (Array.isArray(D.models) ? D.models : []).filter((m) => m && m.reference && isNum(m.agentFixS) && m.agentFixS > 0)
        .map((m) => m.agentFixS);
      const range = cloud.length ? ` (${fmt.int(Math.min(...cloud))}–${fmt.int(Math.max(...cloud))} s per fix, run remotely)` : "";
      fixFoot.replaceChildren(
        h("span", {}, `Local setups only. Cloud references${range} are compared in `,
          maxSec ? h("a", { class: "lat-link", href: "#max-vs-max" }, "Max vs max") : "the max-vs-max section", "."),
        h("span", {}, fx.n ? plural(fx.n, "setup") : ""));
      memFoot.replaceChildren(
        h("span", {}, "Weights plus KV cache while serving. Speed-only runs are included."),
        h("span", {}, mm.n ? plural(mm.n, "setup") + (mm.speedOnly ? ` · ${mm.speedOnly} speed-only` : "") : ""));
      fit();
    };

    el.append(
      LB.sectionHead({
        title: "Latency and memory",
        sub: "Where a core task's time goes, how fast a correct agent fix lands, and the VRAM and RAM each setup holds at its context size.",
        right: LB.seg(LB.PLACEMENTS, filter, (v) => { filter = v; draw(); }),
      }),
      LB.card("lat-card",
        ...cardHead("Latency breakdown", "median seconds",
          "Median time per core task, split at the first streamed token and at the first answer or tool call · lower is better"),
        legend, timeBody, timeFoot),
      LB.card("lat-card lat-fixcard",
        h("div", { class: "lat-head" }, h("h3", {}, "Agent fix: median time to a correct fix"), LB.chip("seconds", "lat-chip")), fixCaption,
        fixBodyEl, fixFoot),
      LB.card("lat-card lat-mem",
        h("div", { class: "lat-head" }, h("h3", {}, "Memory footprint"), LB.chip("GiB", "lat-chip")), memCaption,
        memBody, memFoot));

    draw();
    LB.onResize(fit);
    if (window.ResizeObserver) {
      let lastW = 0;
      new ResizeObserver(() => { const w = timeBody.clientWidth; if (Math.abs(w - lastW) > 1) { lastW = w; fit(); } }).observe(timeBody);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit).catch(() => {});
  }

  LB.register({ id: "latency", order: 63, nav: "Latency & memory", render });
})();

