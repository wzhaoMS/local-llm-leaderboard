/* Model comparison: every configuration in one sortable, searchable table with CSV export (mirrors "Model comparison"). */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, fmt, isNum } = LB;
  const D = LB.data || {};
  const models = () => (Array.isArray(D.models) ? D.models : []).filter(Boolean);

  const num = (v) => (isNum(v) ? v : null);
  const isRef = (m) => !!(m && m.reference);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const r1 = (v) => (isNum(v) ? Math.round(v * 10) / 10 : null);
  const score = (key) => (m) => num(LB.score(m, key));
  const speed = (fn) => (m) => (m.speed ? num(fn(m.speed)) : null);
  const textCore = score("textCore");
  const decode = speed((x) => x.decode);

  function vramSum(m) {
    const vals = Array.isArray(m.vramGiB) ? m.vramGiB.filter(isNum) : [];
    return vals.length ? r1(vals.reduce((a, b) => a + b, 0)) : null;
  }
  /** Total parameters in billions, parsed from strings like "125B-A6B" or "2.78T-A104B (400/896 experts)". */
  function paramsB(m) {
    const mt = /([\d.]+)\s*([TBM])/i.exec(m.params || "");
    if (!mt) return null;
    const v = parseFloat(mt[1]), u = mt[2].toUpperCase();
    return u === "T" ? v * 1000 : u === "M" ? v / 1000 : v;
  }
  function splitParams(p) {
    const str = p == null ? "" : String(p);
    const i = str.indexOf(" (");
    return i > 0 ? [str.slice(0, i), str.slice(i + 2).replace(/\)$/, "")] : [str, ""];
  }
  function ciOf(m) {
    const ci = m.scores && m.scores.textCoreCI;
    return Array.isArray(ci) && isNum(ci[0]) && isNum(ci[1]) ? ci : null;
  }
  /** Anything worth comparing: a quality score or a speed / memory measurement. */
  function hasResults(m) {
    return textCore(m) !== null || vramSum(m) !== null ||
      [decode, speed((x) => x.firstOutput), speed((x) => x.taskTime)].some((f) => f(m) !== null);
  }

  // ---------- status ----------
  const STATUS = {
    done: { text: "Done", cls: "mt-st-done" },
    cloud: { text: "Cloud reference", cls: "mt-st-cloud" },
    partial: { text: "Partial", cls: "mt-st-partial warn" },
    speed: { text: "Speed only", cls: "mt-st-speed" },
    running: { text: "Running", cls: "mt-st-running lime" },
    queued: { text: "Queued", cls: "mt-st-queued" },
    waiting: { text: "Scheduled", cls: "mt-st-waiting" },
  };
  const STATUS_ORDER = ["done", "cloud", "partial", "speed", "running", "queued", "waiting"];
  function statusKey(m) {
    if (isRef(m)) return "cloud";
    const st = m.status || "done";
    if (st !== "done") return STATUS[st] ? st : "other";
    return m.partial ? "partial" : m.speedOnly ? "speed" : "done";
  }
  function statusInfo(m) {
    return STATUS[statusKey(m)] || { text: String(m.status).replace(/^./, (c) => c.toUpperCase()), cls: "mt-st-queued" };
  }
  function statusRank(m) {
    const i = STATUS_ORDER.indexOf(statusKey(m));
    return i < 0 ? STATUS_ORDER.length : i;
  }
  function statusChip(m) {
    const st = statusInfo(m);
    return h("span", { class: ["lb-chip", "mt-st", st.cls] }, isRef(m) ? cloudIcon() : h("i", { class: "mt-dot", "aria-hidden": "true" }), st.text);
  }

  // ---------- cells ----------
  const na = () => h("span", { class: "mt-na" }, "—");
  const isBlank = (v) => v === null || v === undefined || /^\s*(|—|-|–)\s*$/.test(String(v));
  const textOr = (v) => (isBlank(v) ? na() : String(v));

  function modelCell(m, ctx) {
    const isPick = m.id === ctx.pick;
    const kids = [LB.label(m), isPick ? [h("span", { class: "mt-star", "aria-hidden": "true" }, "★"), h("span", { class: "mt-sr" }, " (our pick)")] : null];
    const name = hasResults(m) ? h("button", { type: "button", class: "mt-name" }, kids) : h("span", { class: "mt-name" }, kids);
    const box = h("div", { class: "mt-model-in" }, LB.mono(m, 28),
      h("div", { class: "mt-model-txt" }, name, m.variant ? h("span", { class: "mt-variant" }, m.variant) : null));
    LB.tip.attach(box.firstChild, () => LB.modelTip(m, m.notes ? esc(m.notes) : ""));
    return box;
  }
  function vendorCell(m) {
    const v = LB.vendor(m);
    const el = h("span", {}, v.name);
    if (v.org && v.org !== v.name) el.title = v.org;
    return el;
  }
  function paramsCell(m) {
    const [main, sub] = splitParams(m.params);
    if (!isBlank(main) && paramsB(m) === null) return h("span", { class: "mt-muted" }, main); // e.g. "undisclosed"
    return [h("span", { class: "mt-main" }, textOr(main)), sub ? h("span", { class: "mt-sub" }, sub) : null];
  }
  function textCoreCell(m) {
    const v = textCore(m);
    if (v === null) return na();
    const ci = ciOf(m);
    return [h("span", { class: "mt-strong" }, fmt.pct(v)),
      ci ? h("span", { class: "mt-ci", title: "95% confidence interval" }, `${fmt.pct(ci[0], 0)}–${fmt.pct(ci[1], 0)}`) : null,
      m.partial ? h("span", { class: "mt-partial", title: "Partial run: scored on the tasks it finished." }, "partial") : null];
  }
  function vramCell(m) {
    const v = vramSum(m);
    if (v === null) return isRef(m) ? notComparable() : na();
    const parts = (m.vramGiB || []).filter(isNum);
    const el = h("span", {}, fmt.num(v, 1));
    if (parts.length > 1) el.title = "RTX PRO 6000 " + fmt.num(parts[0], 1) + " GiB + RTX 5090 " + fmt.num(parts[1], 1) + " GiB";
    return el;
  }

  // ---------- columns ----------
  const SPEED_KEYS = ["decode", "firstOutput", "taskTime", "prefill32k", "vram"];
  /** Speed and VRAM cells of a cloud reference: not measured on this PC, so not comparable. */
  const notComparable = () => h("span", { class: "mt-na", title: "Not comparable: cloud references run on remote hardware" }, "—");
  const numCol = (key, label, unit, get, f, dir = "desc", csvLabel) =>
    ({ key, label, unit, get, num: true, dir, cell: (m) => { const v = get(m); return v === null ? (isRef(m) && SPEED_KEYS.includes(key) ? notComparable() : na()) : f(v); }, csv: [[csvLabel || label, get]] });
  const COLS = [
    { key: "model", label: "Model", get: (m) => LB.label(m), cell: modelCell, csv: [["Model", (m) => m.name], ["Variant", (m) => m.variant]] },
    { key: "vendor", label: "Vendor", get: (m) => LB.vendor(m).name, cell: vendorCell, csv: [["Vendor", (m) => LB.vendor(m).name]] },
    { key: "where", label: "Runs on", get: (m) => m.where, cell: (m) => textOr(m.where),
      csv: [["Runs on", (m) => m.where], ["Placement", (m) => LB.PLACEMENT_LABEL[m.placement] || m.placement], ["Reference", (m) => (isRef(m) ? "yes" : "no")]] },
    { key: "params", label: "Params", unit: "total · active", get: paramsB, dir: "desc", cell: paramsCell, csv: [["Params", (m) => m.params]] },
    { key: "quant", label: "Quant", unit: "weights", get: (m) => (isBlank(m.quant) ? null : m.quant), cell: (m) => textOr(m.quant), csv: [["Quant", (m) => (isBlank(m.quant) ? null : m.quant)]] },
    { key: "textCore", label: "Text core", unit: "score · 95% CI", get: textCore, num: true, dir: "desc", cell: textCoreCell,
      csv: [["Text core", textCore], ["Text core CI low", (m) => (ciOf(m) || [])[0]], ["Text core CI high", (m) => (ciOf(m) || [])[1]]] },
    numCol("allSuites", "All suites", "incl. vision", score("allSuites"), (v) => fmt.pct(v)),
    numCol("repo_replay", "Repo fixes", "% solved", score("repo_replay"), (v) => fmt.pct(v), "desc", "Repo fixes %"),
    numCol("debug", "Debug", "% fixed", score("debug"), (v) => fmt.pct(v), "desc", "Debug %"),
    numCol("long_horizon", "Long sessions", "% score", score("long_horizon"), (v) => fmt.pct(v), "desc", "Long sessions %"),
    numCol("decode", "Decode", "tokens / sec", decode, fmt.tps, "desc", "Decode tok/s"),
    numCol("firstOutput", "First output", "s · after thinking", speed((x) => x.firstOutput), (v) => fmt.num(v, 1), "asc", "First output s"),
    numCol("taskTime", "Time per task", "seconds · median", speed((x) => x.taskTime), (v) => fmt.num(v, 1), "asc", "Time per task s"),
    numCol("prefill32k", "Prefill @32K", "tokens / sec", speed((x) => x.prefill && x.prefill["32k"]), fmt.int, "desc", "Prefill @32K tok/s"),
    { key: "vram", label: "VRAM", unit: "GiB · both GPUs", get: vramSum, num: true, dir: "asc", cell: vramCell, csv: [["VRAM GiB", vramSum]] },
    { key: "status", label: "Status", get: statusRank, dir: "asc", cell: statusChip, csv: [["Status", (m) => statusInfo(m).text]] },
  ];
  /** Header tooltips: what each column measures. */
  function columnDesc(key) {
    const core = D.core || {};
    const nText = Array.isArray(core.textSuites) ? core.textSuites.length : null;
    const n = (v, unit) => (isNum(v) ? `${fmt.int(v)} ${unit}` : "");
    switch (key) {
      case "params": return "Total parameters, then parameters active per token (MoE)";
      case "textCore": return `Mean of ${nText ? "the " + nText : "the"} text suites` + (isNum(core.textTasks) ? ` on the same ${n(core.textTasks, "questions")}` : "") + ", with a 95% confidence interval";
      case "allSuites": return "Text core plus vision" + (isNum(core.tasks) ? ` (${n(core.tasks, "questions")})` : "");
      case "repo_replay": case "debug": case "long_horizon": return (LB.suite(key) || {}).desc || "";
      case "decode": return "Generation speed on short prompts, speculative decoding on";
      case "firstOutput": return "Median seconds until the first answer token or tool call of a core task, after any thinking";
      case "taskTime": return "Median wall time per core task, thinking included";
      case "prefill32k": return "Prompt processing speed at 32K tokens of context";
      case "vram": return "GPU memory in use, both cards combined";
      default: return "";
    }
  }

  // ---------- sorting & search ----------
  const isNil = (v) => v === null || v === undefined || v === "" || (typeof v === "number" && !isFinite(v));
  function tiebreak(a, b) {
    const ta = textCore(a), tb = textCore(b), da = decode(a), db = decode(b);
    return statusRank(a) - statusRank(b) ||
      (ta === null) - (tb === null) || (tb || 0) - (ta || 0) ||
      (da === null) - (db === null) || (db || 0) - (da || 0) ||
      LB.label(a).localeCompare(LB.label(b), "en", { numeric: true });
  }
  function sorter(col, dir) {
    return (a, b) => {
      const va = col.get(a), vb = col.get(b), na1 = isNil(va), nb1 = isNil(vb);
      if (na1 !== nb1) return na1 ? 1 : -1; // missing values always last
      let r = 0;
      if (!na1) r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "en", { numeric: true, sensitivity: "base" });
      if (r) return dir === "asc" ? r : -r;
      return tiebreak(a, b);
    };
  }
  function haystack(m) {
    const v = LB.vendor(m);
    return [m.name, m.short, m.variant, v.name, v.org, m.where, LB.PLACEMENT_LABEL[m.placement], m.quant, m.params]
      .filter(Boolean).join(" ").toLowerCase();
  }

  // ---------- CSV ----------
  function csvCell(v) {
    if (v === null || v === undefined || (typeof v === "number" && !isFinite(v))) return "";
    const t = typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);
    return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  function downloadCsv(rows) {
    const defs = COLS.flatMap((c) => c.csv || []);
    const lines = [defs.map(([label]) => csvCell(label)).join(",")]
      .concat(rows.map((m) => defs.map(([, get]) => csvCell(get(m))).join(",")));
    const blob = new Blob(["\ufeff" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: "local-llm-leaderboard.csv", style: { display: "none" } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ---------- icons ----------
  const icon = (d, size = 16) => s("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor",
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d }));
  const searchIcon = () => icon("M7.2 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4zM11 11l3.2 3.2");
  const downloadIcon = () => icon("M8 2.2v8.2M4.6 7.2 8 10.6l3.4-3.4M2.8 13.6h10.4");
  const chevron = () => s("svg", { class: "mt-chev", width: 10, height: 10, viewBox: "0 0 10 10", fill: "none", stroke: "currentColor",
    "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d: "M2.2 3.6 5 6.4l2.8-2.8" }));
  const arrow = () => s("svg", { class: "mt-arrow", width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor",
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d: "M6 2v8M2.8 6.8 6 10l3.2-3.2" }));
  function cloudIcon() {
    return s("svg", { class: "mt-cloud", width: 13, height: 13, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": 1.5,
      "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d: "M4.6 12.6h7.1a2.9 2.9 0 0 0 .3-5.8 4 4 0 0 0-7.7.9 2.5 2.5 0 0 0 .3 4.9z" }));
  }

  const SCOPES = [{ value: "all", label: "All" }, { value: "local", label: "Local" }, { value: "cloud", label: "Cloud" }];
  const inScope = (m, scope) => (scope === "local" ? !isRef(m) : scope === "cloud" ? isRef(m) : true);

  // ---------- section ----------
  function render(el) {
    const all = models();
    const nRef = all.filter(isRef).length;
    const ctx = { pick: D.verdict && LB.byId(D.verdict.pick) ? D.verdict.pick : null };
    let sortKey = "textCore", sortDir = "desc", query = "", scope = "all", visible = [];

    const input = h("input", { type: "search", placeholder: "Search models…", "aria-label": "Search models, vendors, hardware or quants",
      autocomplete: "off", spellcheck: "false", oninput: (e) => { query = e.target.value; drawBody(); } });
    const search = h("label", { class: "lb-search mt-search" }, searchIcon(), input);
    const csvBtn = h("button", { type: "button", class: "lb-btn mt-csv", onclick: () => downloadCsv(visible) }, downloadIcon(), "Download CSV");
    // Only offer the Local / Cloud switch when the data has cloud references.
    const scopeSeg = nRef ? LB.seg(SCOPES, scope, (v) => { scope = v; drawBody(); }) : null;
    if (scopeSeg) {
      scopeSeg.classList.add("mt-scope");
      scopeSeg.setAttribute("aria-label", "Show local setups, cloud references or both");
    }

    const heads = COLS.map((c) => {
      const btn = h("button", { type: "button", class: "mt-sort", title: columnDesc(c.key) || null, onclick: () => setSort(c) },
        h("span", { class: "mt-th" }, c.label, chevron(), arrow()), c.unit ? h("span", { class: "mt-unit" }, c.unit) : null);
      return h("th", { scope: "col", class: ["mt-c-" + c.key, c.num && "mt-num"] }, btn);
    });
    const tbody = h("tbody");
    const table = h("table", { class: "mt-table" },
      h("caption", { class: "mt-sr" }, "Every configuration tested on this machine. Column headers sort the table."),
      h("thead", {}, h("tr", {}, heads)), tbody);
    const scroller = h("div", { class: "mt-scroll", tabindex: "0", role: "region", "aria-label": "Model comparison table" }, table);
    const empty = h("div", { class: "mt-empty", hidden: true });
    scroller.appendChild(empty);
    const frame = h("div", { class: "mt-frame" }, scroller);
    const count = h("span", { class: "mt-count", "aria-live": "polite" });
    const legend = h("span", { class: "mt-legend" },
      ctx.pick ? h("span", {}, "★ Our pick") : null,
      nRef ? h("span", { title: "Same tasks and graders, run in the cloud through GitHub Copilot. Not ranked with the local setups; speed is not comparable." },
        h("i", { class: "mt-leg-ref", "aria-hidden": "true" }), "Cloud reference") : null,
      h("span", {}, "Click a row to compare it head-to-head"));
    const card = LB.card("mt-card", frame, h("div", { class: "mt-foot" }, count, legend));
    el.append(LB.sectionHead({ title: "Model comparison", sub: "Every configuration tested on this machine. Click a column to sort.",
      right: [scopeSeg, search, csvBtn] }), card);

    function setSort(c) {
      if (sortKey === c.key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else { sortKey = c.key; sortDir = c.dir || "asc"; }
      drawHead();
      drawBody();
    }
    function drawHead() {
      COLS.forEach((c, i) => {
        const on = c.key === sortKey;
        heads[i].classList.toggle("mt-on", on);
        heads[i].classList.toggle("mt-asc", on && sortDir === "asc");
        if (on) heads[i].setAttribute("aria-sort", sortDir === "asc" ? "ascending" : "descending");
        else heads[i].removeAttribute("aria-sort");
      });
    }
    function openFor(m) {
      const best = (id) => { const q = LB.quality().find((x) => x.id !== id); return q ? q.id : undefined; };
      // Cloud references go on the right, against our pick (like the suggested pairs).
      if (isRef(m)) { LB.openCompare(ctx.pick || best(m.id), m.id); return; }
      LB.openCompare(m.id, ctx.pick && ctx.pick !== m.id ? ctx.pick : best(m.id));
    }
    function row(m) {
      const color = LB.vendor(m).color;
      const live = hasResults(m), ref = isRef(m);
      const tr = h("tr", { class: [m.id === ctx.pick && "mt-pick", ref && "mt-ref", live && "mt-click"] });
      COLS.forEach((c) => {
        const kids = c.cell(m, ctx);
        if (c.key === "model") {
          const vbar = h("span", { class: ["mt-vbar", ref && "mt-vbar-ref"], style: ref ? { borderLeftColor: color } : { background: color } });
          tr.appendChild(h("th", { scope: "row", class: "mt-c-model" }, vbar, kids));
        } else tr.appendChild(h("td", { class: ["mt-c-" + c.key, c.num && "mt-num"] }, kids));
      });
      if (live) {
        tr.addEventListener("click", (e) => {
          const sel = window.getSelection && String(window.getSelection());
          if (sel) return; // the user is selecting text, not clicking
          const btn = tr.querySelector("button.mt-name");
          if (btn && !btn.contains(e.target)) btn.focus({ preventScroll: true });
          openFor(m);
        });
      }
      return tr;
    }
    function drawBody() {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const col = COLS.find((c) => c.key === sortKey) || COLS[5];
      const inView = all.filter((m) => inScope(m, scope));
      visible = inView.filter((m) => { const hay = haystack(m); return terms.every((t) => hay.includes(t)); }).sort(sorter(col, sortDir));
      tbody.textContent = "";
      visible.forEach((m) => tbody.appendChild(row(m)));
      const noun = scope === "cloud" ? "cloud references" : scope === "local" ? "local configurations" : "configurations";
      empty.hidden = visible.length > 0;
      empty.textContent = visible.length ? "" : terms.length ? `No ${noun} match “${query.trim()}”.` : `No ${noun} yet.`;
      const local = all.filter((m) => !isRef(m));
      const scored = local.filter((m) => textCore(m) !== null).length;
      const pending = local.filter((m) => m.status && m.status !== "done").length;
      if (terms.length) count.textContent = `Showing ${visible.length} of ${inView.length} ${noun}`;
      else if (scope === "cloud") count.textContent = `${visible.length} cloud references · same tasks and graders, run through GitHub Copilot`;
      else {
        count.textContent = [`${local.length} local configurations`, `${scored} with quality scores`,
          scope === "all" && nRef ? `${nRef} cloud references` : "", pending ? `${pending} in progress` : ""].filter(Boolean).join(" · ");
      }
      csvBtn.disabled = !visible.length;
      updateShade();
    }
    function updateShade() {
      const max = scroller.scrollWidth - scroller.clientWidth;
      frame.classList.toggle("mt-shade-l", scroller.scrollLeft > 1);
      frame.classList.toggle("mt-shade-r", max > 1 && scroller.scrollLeft < max - 1);
    }
    scroller.addEventListener("scroll", updateShade, { passive: true });
    LB.onResize(updateShade);
    drawHead();
    drawBody();
    requestAnimationFrame(updateShade);
  }

  LB.register({ id: "models", order: 80, nav: "All models", render });
})();
