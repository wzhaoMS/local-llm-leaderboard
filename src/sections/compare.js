/* Head-to-head: suggested pairs as cards (mirrors "Model comparisons"), plus the comparison dialog behind LB.openCompare. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, fmt, isNum } = LB;
  const D = LB.data || {};
  const GROUP = { daily: "Daily work", coding: "Coding", agents: "Agents" };

  const num = (v) => (isNum(v) ? v : null);
  const score = (key) => (m) => num(LB.score(m, key));
  const speed = (fn) => (m) => (m.speed ? num(fn(m.speed)) : null);
  function vramSum(m) {
    const vals = Array.isArray(m.vramGiB) ? m.vramGiB.filter(isNum) : [];
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 10) / 10 : null;
  }
  function ciOf(m) {
    const ci = m.scores && m.scores.textCoreCI;
    return Array.isArray(ci) && isNum(ci[0]) && isNum(ci[1]) ? ci : null;
  }

  // ---------- visual atoms ----------
  /** Rounded-square vendor badge (the reference's logo tiles). */
  function badge(m, size) {
    const v = LB.vendor(m);
    const letter = String(v.letter || "?");
    return h("span", { class: "cmp-badge", "aria-hidden": "true", style: {
      width: size + "px", height: size + "px", borderRadius: Math.round(size * 0.27) + "px", color: v.color,
      fontSize: Math.round(size * (letter.length > 1 ? 0.36 : 0.44)) + "px" } }, letter);
  }
  const icon = (d, size = 16) => s("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor",
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d }));
  const arrowIcon = () => icon("M2.8 8h10.4M9.4 4.2 13.2 8l-3.8 3.8");
  const swapIcon = () => icon("M2.5 5.2h10.6M10.2 2.4l2.9 2.8-2.9 2.8M13.5 10.8H2.9M5.8 8l-2.9 2.8 2.9 2.8");
  const closeIcon = () => icon("M4 4l8 8M12 4l-8 8");

  /** Same vendor on both sides: darken B so the two bars stay distinguishable. */
  function mix(hex, to, t) {
    const rgb = (x) => {
      let v = String(x || "").replace("#", "");
      if (v.length === 3) v = v.split("").map((c) => c + c).join("");
      return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
    };
    const a = rgb(hex), b = rgb(to);
    if (a.concat(b).some((c) => !isFinite(c))) return hex;
    return "#" + a.map((c, i) => Math.round(c + (b[i] - c) * t).toString(16).padStart(2, "0")).join("");
  }
  function sideColors(A, B) {
    const ca = LB.vendor(A).color, cb = LB.vendor(B).color;
    return [ca, String(ca).toLowerCase() === String(cb).toLowerCase() ? mix(cb, "#171e29", 0.42) : cb];
  }

  function statusTag(m) {
    const st = m.status || "done";
    if (st === "running") return LB.chip("Running", "lime");
    if (st === "queued") return LB.chip("Queued");
    if (st === "waiting") return LB.chip("Scheduled");
    if (st !== "done") return LB.chip(String(st));
    if (m.partial) return LB.chip("Partial run", "warn");
    if (m.speedOnly) return LB.chip("Speed only");
    return null;
  }

  // ---------- metric rows ----------
  function metricGroups() {
    const core = D.core || {};
    const suites = Array.isArray(D.suites) ? D.suites : [];
    const coreKeys = Array.isArray(core.suites) && core.suites.length ? core.suites : suites.filter((x) => x.inCore).map((x) => x.key);
    const textKeys = Array.isArray(core.textSuites) ? core.textSuites : [];
    const pct = (v) => fmt.pct(v, 1);
    const name = (k, fallback) => (LB.suite(k) || {}).name || fallback;
    const count = (n, unit = "tasks") => (isNum(n) ? `${fmt.int(n)} ${n === 1 ? unit.replace(/s$/, "") : unit}` : "");
    const hint = (...parts) => parts.filter(Boolean).join(" · ");
    const tasksOf = (k) => (LB.suite(k) || {}).tasks;
    const scoreRow = (key, label, hintText, extra) => Object.assign({ key, label, hint: hintText, get: score(key), f: pct, scale: 100 }, extra);
    return [
      { title: "Quality", hint: "Score 0–100 · higher is better", rows: [
        scoreRow("textCore", "Text core", hint(textKeys.length ? `mean of ${textKeys.length} text suites` : "ranking score", count(core.textTasks)), { ci: true }),
        scoreRow("allSuites", "All suites", hint("text core + vision", count(core.tasks))),
        ...coreKeys.map((k) => {
          const su = LB.suite(k) || {};
          return scoreRow(k, su.name || k, hint(textKeys.length && !textKeys.includes(k) ? "not in text core" : GROUP[su.group], count(su.tasks)));
        }),
      ] },
      { title: "Agentic", hint: "Real tools in scratch clones · reported separately", rows: [
        scoreRow("repo_replay", name("repo_replay", "Real-repo bug fixes"), hint("% solved", count(tasksOf("repo_replay")))),
        scoreRow("debug", name("debug", "Debugging"), hint("% fixed", count(tasksOf("debug")))),
        scoreRow("long_horizon", name("long_horizon", "Long sessions"), hint("score", count(tasksOf("long_horizon"), "sessions"))),
      ] },
      { title: "Speed & memory", hint: "Measured on this PC", rows: [
        { key: "decode", label: "Decode", hint: "tok/s · higher is better", unit: "tok/s", get: speed((x) => x.decode), f: fmt.tps },
        { key: "firstOutput", label: "First output", hint: "after thinking · lower is better", unit: "s", low: true, get: speed((x) => x.firstOutput), f: (v) => fmt.num(v, 1) },
        { key: "taskTime", label: "Time per task", hint: "median seconds · lower is better", unit: "s", low: true, get: speed((x) => x.taskTime), f: (v) => fmt.num(v, 1) },
        { key: "prefill32k", label: "Prefill @32K", hint: "tok/s · higher is better", unit: "tok/s", get: speed((x) => x.prefill && x.prefill["32k"]), f: fmt.int },
        { key: "vram", label: "VRAM", hint: "GiB on both GPUs · lower is better", unit: "GiB", low: true, get: vramSum, f: (v) => fmt.num(v, 1) },
      ] },
    ];
  }
  function winner(r, va, vb) {
    if (va === null || vb === null || r.f(va) === r.f(vb)) return null;
    return (r.low ? va < vb : va > vb) ? "a" : "b";
  }

  // ---------- dialog ----------
  let dlg = null, ui = null, opener = null, baseUrl = null, downOnBackdrop = false, modal = false, pendingClose = false;
  const state = { a: null, b: null };

  const pickId = () => {
    const p = D.verdict && D.verdict.pick;
    if (p && LB.byId(p)) return p;
    const q = LB.quality()[0];
    return q ? q.id : null;
  };
  const bestOther = (id) => { const q = LB.quality().find((m) => m.id !== id); return q ? q.id : id; };
  function resolve(a, b) {
    a = typeof a === "string" && LB.byId(a) ? a : null;
    b = typeof b === "string" && LB.byId(b) ? b : null;
    const pick = pickId();
    if (!a && !b) { a = pick; b = a ? bestOther(a) : null; }
    else if (!b) b = pick && a !== pick ? pick : bestOther(a);
    else if (!a) a = pick && b !== pick ? pick : bestOther(b);
    else if (a === b) b = pick && a !== pick ? pick : bestOther(a);
    return [a, b];
  }
  function options() {
    const list = LB.quality();
    [state.a, state.b].forEach((id) => { const m = LB.byId(id); if (m && !list.includes(m)) list.push(m); });
    return list.map((m) => {
      const tc = m.scores && m.scores.textCore;
      const tail = isNum(tc) ? ` (${fmt.pct(tc)})` : m.speed ? " (speed only)" : " (no results yet)";
      return { value: m.id, label: LB.fullName(m) + tail };
    });
  }

  function ensure() {
    if (dlg) return;
    dlg = h("dialog", { class: "cmp-dlg", role: "dialog", "aria-modal": "true", "aria-labelledby": "cmp-dlg-title", "aria-describedby": "cmp-dlg-lede" });
    dlg.addEventListener("mousedown", (e) => { downOnBackdrop = e.target === dlg; });
    dlg.addEventListener("click", (e) => { if (e.target === dlg && downOnBackdrop) close(); downOnBackdrop = false; });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    dlg.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal) { e.preventDefault(); close(); } }); // fallback without showModal()
    dlg.addEventListener("close", onClosed);
    const pickers = h("div", { class: "cmp-pickers" });
    const body = h("div", { class: "cmp-body", tabindex: "0", role: "region", "aria-label": "Comparison details" });
    dlg.append(
      h("div", { class: "cmp-top" },
        h("div", { class: "cmp-titlebar" },
          h("div", {}, h("h2", { id: "cmp-dlg-title" }, "Compare models"),
            h("p", { id: "cmp-dlg-lede", class: "cmp-lede" }, "Same tasks, same PC. The better value in each row is highlighted.")),
          h("button", { type: "button", class: "cmp-x", "aria-label": "Close", title: "Close (Esc)", onclick: close }, closeIcon())),
        pickers),
      body);
    document.body.appendChild(dlg);
    ui = { pickers, body };
  }

  function choose(k, v) {
    const other = k === "a" ? "b" : "a";
    if (v === state[other]) state[other] = state[k]; // choosing the other side's model swaps the two
    state[k] = v;
    draw(k);
    writeHash();
  }
  function swap() {
    [state.a, state.b] = [state.b, state.a];
    draw("swap");
    writeHash();
  }

  function draw(focusKey) {
    const opts = options();
    const pick = (k, label) => {
      const el = LB.select(opts, state[k], (v) => choose(k, v));
      const sel = el.querySelector("select");
      sel.setAttribute("aria-label", label);
      sel.dataset.k = k;
      return el;
    };
    ui.pickers.textContent = "";
    ui.pickers.append(pick("a", "First model"),
      h("button", { type: "button", class: "cmp-swap", "aria-label": "Swap models", title: "Swap", "data-k": "swap", onclick: swap }, swapIcon()),
      pick("b", "Second model"));
    const top = ui.body.scrollTop;
    ui.body.textContent = "";
    ui.body.append(...content());
    ui.body.scrollTop = top;
    if (focusKey) { const el = ui.pickers.querySelector(`[data-k="${focusKey}"]`); if (el) el.focus(); }
  }

  function content() {
    const A = LB.byId(state.a), B = LB.byId(state.b);
    if (!A || !B) return [h("div", { class: "lb-empty cmp-none" }, "No models with results to compare yet.")];
    const [ca, cb] = sideColors(A, B);
    let winA = 0, winB = 0, both = 0;
    const colHeads = () => h("div", { class: "cmp-sr", role: "row" },
      h("span", { role: "columnheader" }, LB.fullName(A)), h("span", { role: "columnheader" }, "Metric"), h("span", { role: "columnheader" }, LB.fullName(B)));
    const groups = metricGroups().map((g, gi) => {
      const rows = [];
      for (const r of g.rows) {
        const va = r.get(A), vb = r.get(B), w = winner(r, va, vb);
        if (va !== null && vb !== null) { both++; if (w === "a") winA++; else if (w === "b") winB++; }
        rows.push(metricRow(r, A, B, va, vb, w, ca, cb));
        if (r.ci) {
          const x = ciOf(A), y = ciOf(B);
          if (x && y && A !== B && x[0] <= y[1] && y[0] <= x[1]) {
            rows.push(h("div", { class: "cmp-note", role: "row" }, h("span", { role: "cell" },
              "The 95% intervals overlap, so the text-core gap is within noise.")));
          }
        }
      }
      const id = "cmp-g" + gi;
      return h("section", { class: "cmp-group" },
        h("div", { class: "cmp-group-h" }, h("h3", { id }, g.title), h("span", {}, g.hint)),
        h("div", { role: "table", "aria-labelledby": id, class: "cmp-table" }, colHeads(), rows));
    });
    return [heads(A, B, ca, cb, winA, winB, both), ...groups];
  }

  function heads(A, B, ca, cb, winA, winB, both) {
    const head = (m, k, color, wins) => h("div", { class: ["cmp-head", k] },
      badge(m, 48),
      h("div", { class: "cmp-head-txt" },
        h("div", { class: "cmp-head-name" }, m.name || LB.label(m)),
        m.variant ? h("div", { class: "cmp-head-var" }, m.variant) : null,
        h("div", { class: "cmp-head-meta" }, [m.where, m.params, m.quant].filter(Boolean).join(" · ")),
        h("div", { class: "cmp-head-tags" },
          h("span", { class: "cmp-swatch", style: { background: color }, "aria-hidden": "true" }),
          both ? h("span", {}, "Better on ", h("b", {}, String(wins)), ` of ${both}`) : null,
          statusTag(m))));
    return h("div", { class: "cmp-heads" }, head(A, "a", ca, winA), h("span", { class: "cmp-vs", "aria-hidden": "true" }, "vs"), head(B, "b", cb, winB));
  }

  function metricRow(r, A, B, va, vb, w, ca, cb) {
    const max = r.scale || Math.max(va || 0, vb || 0) || 1;
    const side = (k, v, m, color) => {
      const frac = v === null ? 0 : Math.max(0, Math.min(1, v / max));
      const ci = r.ci && v !== null ? ciOf(m) : null;
      const ciPos = ci ? { [k === "a" ? "right" : "left"]: Math.max(0, ci[0]) + "%", width: Math.max(0, Math.min(100, ci[1]) - ci[0]) + "%" } : null;
      const track = h("span", { class: "cmp-track", "aria-hidden": "true" },
        v === null ? null : h("i", { style: { width: (frac * 100).toFixed(1) + "%", background: color } }),
        ciPos ? h("span", { class: "cmp-ci", style: ciPos }) : null);
      const val = h("span", { class: ["cmp-val", w === k && "win"] },
        v === null ? h("span", { class: "cmp-na" }, "—") : [h("b", {}, r.f(v)), r.unit ? h("small", {}, r.unit) : null],
        ci ? h("span", { class: "cmp-ci-t", title: "95% confidence interval" }, `${fmt.pct(ci[0], 0)}–${fmt.pct(ci[1], 0)}`) : null,
        w === k ? h("span", { class: "cmp-sr" }, " (better)") : null);
      return h("div", { class: ["cmp-side", k, w && w !== k && "lose"], role: "cell" }, k === "a" ? [val, track] : [track, val]);
    };
    return h("div", { class: "cmp-row", role: "row" },
      side("a", va, A, ca),
      h("div", { class: "cmp-label", role: "rowheader" }, h("b", {}, r.label), r.hint ? h("small", {}, r.hint) : null),
      side("b", vb, B, cb));
  }

  function writeHash() {
    if (!state.a || !state.b) return;
    const hash = "#compare=" + encodeURIComponent(state.a) + "," + encodeURIComponent(state.b);
    if (location.hash === hash) return;
    try { history.replaceState(history.state, "", location.href.split("#")[0] + hash); } catch (e) { /* history API unavailable */ }
  }

  /** LB.openCompare(idA, idB): opens (or updates) the dialog; missing ids default to our pick and the best other model. */
  function open(a, b) {
    [state.a, state.b] = resolve(a, b);
    ensure();
    if (dlg.open) { draw(); writeHash(); return; }
    const act = document.activeElement;
    opener = act && act !== document.body ? act : null;
    baseUrl = location.href.split("#")[0] + (/^#compare=/.test(location.hash) ? "" : location.hash);
    draw();
    ui.body.scrollTop = 0;
    document.documentElement.classList.add("cmp-lock");
    LB.tip.hide();
    pendingClose = true;
    modal = typeof dlg.showModal === "function";
    if (modal) dlg.showModal();
    else dlg.setAttribute("open", "");
    const first = ui.pickers.querySelector('[data-k="a"]');
    if (first) first.focus();
    writeHash();
  }
  function close() {
    if (!dlg || !dlg.hasAttribute("open")) return;
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
    onClosed();
  }
  /** Runs once per opening, from close() or from the dialog's own "close" event (whichever comes first). */
  function onClosed() {
    if (!pendingClose) return;
    pendingClose = false;
    document.documentElement.classList.remove("cmp-lock");
    if (baseUrl !== null && /#compare=/.test(location.href)) {
      try { history.replaceState(history.state, "", baseUrl); } catch (e) { /* history API unavailable */ }
    }
    baseUrl = null;
    if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    opener = null;
  }
  function fromHash() {
    const mt = /^#compare=([^,]*)(?:,(.*))?$/.exec(location.hash || "");
    if (!mt) return;
    const dec = (x) => { try { return decodeURIComponent(x || ""); } catch (e) { return ""; } };
    open(dec(mt[1]), dec(mt[2]));
  }

  // ---------- section ----------
  function cardSide(m) {
    return h("span", { class: "cmp-card-side" }, badge(m, 56),
      h("span", { class: "cmp-card-name" }, LB.label(m)),
      m.where ? h("span", { class: "cmp-card-where" }, m.where) : null);
  }
  function pairCard(A, B) {
    return h("button", { type: "button", class: "cmp-card", "aria-label": `Compare ${LB.fullName(A)} with ${LB.fullName(B)}`, onclick: () => open(A.id, B.id) },
      h("span", { class: "cmp-card-top" }, cardSide(A), h("span", { class: "cmp-card-vs", "aria-hidden": "true" }, "vs"), cardSide(B)),
      h("span", { class: "cmp-card-foot" }, h("span", {}, "Compare models"), arrowIcon()));
  }
  function render(el) {
    const pairs = (Array.isArray(D.pairs) ? D.pairs : [])
      .map((p) => (Array.isArray(p) ? [LB.byId(p[0]), LB.byId(p[1])] : []))
      .filter((p) => p[0] && p[1] && p[0] !== p[1]);
    const any = h("button", { type: "button", class: "lb-btn cmp-any", onclick: () => open() }, swapIcon(), "Pick any two");
    el.append(
      LB.sectionHead({ title: "Head-to-head", sub: "Pick two configurations and compare every task and speed metric.", right: [any] }),
      pairs.length ? h("div", { class: "cmp-grid" }, pairs.map(([a, b]) => pairCard(a, b)))
        : LB.card("cmp-empty", h("div", { class: "lb-empty" }, "No suggested pairs yet. Use “Pick any two” to build a comparison.")));
  }

  LB.openCompare = open;
  window.addEventListener("hashchange", fromHash);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fromHash);
  else setTimeout(fromHash, 0);
  LB.register({ id: "compare", order: 90, nav: "Compare", render });
})();
