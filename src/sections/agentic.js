/* Agentic: real-repo bug fixes, debugging and long sessions. One sortable table each; cloud references are reference rows. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, fmt, isNum } = LB;
  const D = LB.data || {};

  const isRef = (m) => !!(m && m.reference);
  const num = (v) => (isNum(v) ? v : null);
  const r1 = (v) => Math.round(v * 10) / 10;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const models = () => (Array.isArray(D.models) ? D.models : []).filter(Boolean);
  const rec = (m, key) => { const a = m && m.agentic && m.agentic[key]; return a && typeof a === "object" ? a : null; };
  /** 100 · 92.6 · 60 (no ".0" on whole numbers). */
  const pct = (v) => { const x = r1(v); return Number.isInteger(x) ? String(x) : fmt.pct(v, 1); };

  // ---------- the three tables ----------
  /** kind: rate (headline % with a bar) · pct · frac · runs · time (s) · min · int · count · gib · tokens · ratio */
  const col = (key, label, unit, kind, dir, extra) => Object.assign({ key, label, unit, kind, dir, get: (a) => num(a[key]) }, extra);
  const TABLES = [
    {
      key: "repo_replay", title: "Real-repo bug fixes", unit: "fixes",
      intro: "Real fix commits from a private TypeScript monorepo, replayed in a scratch clone: the model explores the repo, edits it and runs " +
        "the real tests. Success means the fix's tests pass with no regression in the package's other tests; a regression scores 0.5. " +
        "Scored apart from the core, on each model's own tasks and repeats.",
      def: "Wall time includes failed runs. Time to correct = the first passing test run, solved runs only. " +
        "Min free commit = the least free system commit memory during the runs (local runs only).",
      cols: [
        col("rate", "Success", "% solved", "rate", "desc"),
        col("meanScore", "Mean\nscore", "0–1", "frac", "desc"),
        col("tasks", "Tasks", "(runs)", "runs", "desc", { runs: "runs" }),
        col("medianWallS", "Wall time", "s · median", "time", "asc"),
        col("medianTimeToCorrectS", "Time to\ncorrect", "s · median", "time", "asc"),
        col("medianSteps", "Steps", "median", "int", "asc"),
        col("regressions", "Regressions", "runs", "count", "asc"),
        col("timeouts", "Timeouts", "runs", "count", "asc"),
        col("minFreeCommitGiB", "Min free\ncommit", "GiB · local", "gib", "desc", { localOnly: true }),
      ],
    },
    {
      key: "debug", title: "Debugging", unit: "bugs",
      intro: "A bug in real code from the same private monorepo, injected or a real historical one, reported only by its symptom: wrong output, " +
        "a log line, a wrong number. The tests that catch it are hidden. The model reproduces, investigates, fixes and verifies with scripts and " +
        "tests. Success means the hidden tests pass with no regression in the package's other tests; a regression scores 0.5.",
      def: "Time to fix = the first moment the hidden tests pass (checked after every edit), solved runs only. Reproduced first = the symptom " +
        "was shown before the first edit. Root cause named = the final summary names the right file or function.",
      cols: [
        col("rate", "Success", "% fixed", "rate", "desc"),
        col("meanScore", "Mean\nscore", "0–1", "frac", "desc"),
        col("tasks", "Bugs", "(runs)", "runs", "desc", { runs: "runs" }),
        col("medianWallS", "Wall time", "s · median", "time", "asc"),
        col("medianTimeToFixS", "Time to\nfix", "s · median", "time", "asc"),
        col("reproducedFirst", "Reproduced\nfirst", "% of bugs", "pct", "desc"),
        col("rootCauseNamed", "Root cause\nnamed", "% of bugs", "pct", "desc"),
        col("medianSteps", "Steps", "median", "int", "asc"),
      ],
    },
    {
      key: "long_horizon", title: "Long sessions", unit: "sessions",
      intro: "One continuous session per task, like a day of work: 5–7 stages of a project handed over one at a time, with session rules " +
        "stated once at the start, a requirement change, a recall probe and an injected regression. Stages passed = every stage's hidden " +
        "tests re-run at the end, plus a summary check. A session scores that fraction − 0.05 per rule violation, with at most 0.25 " +
        "deducted; Mean score averages the sessions.",
      def: "Late/early decode = decode speed over the last vs the first 20% of requests (local runs only; below 1 means generation slowed " +
        "as the context grew).",
      cols: [
        col("rate", "Stages\npassed", "%", "rate", "desc",
          { sub: (a) => (isNum(a.stagesPassed) && isNum(a.stagesTotal) ? `${fmt.int(a.stagesPassed)}/${fmt.int(a.stagesTotal)}` : null) }),
        col("meanScore", "Mean\nscore", "0–1", "frac", "desc"),
        col("sessions", "Sessions", "(runs)", "runs", "desc", { runs: "runs" }),
        col("medianWallMin", "Wall time", "min · median", "min", "asc"),
        col("medianSteps", "Steps", "median", "int", "asc"),
        col("maxPromptTokens", "Max\nprompt", "tokens · local", "tokens", "desc", { localOnly: true }),
        col("violations", "Rule\nviolations", "total", "count", "asc"),
        col("recall", "Recall", "% of probes", "pct", "desc"),
        col("regressions", "Regressions", "total", "count", "asc"),
        col("stuckEvents", "Stuck\nevents", "total", "count", "asc"),
        col("lateEarlyDecode", "Late/early\ndecode", "ratio · local", "ratio", "desc", { localOnly: true }),
      ],
    },
  ];
  const MODEL = { key: "model", label: "Model", kind: "model", dir: "asc" };
  const MOBILE_UNIT = { rate: "%", pct: "%", time: "s", min: "min", gib: "GiB", runs: "runs", tokens: "tokens", ratio: "ratio" };
  /** Decimals each kind is shown with: sorting uses the shown value, so equal-looking values fall through to the tiebreak. */
  const SHOWN = { rate: 1, pct: 1, frac: 2, ratio: 2, min: 1, gib: 1 };
  const shown = (v, kind) => (typeof v !== "number" ? v : kind in SHOWN ? Number(v.toFixed(SHOWN[kind])) : Math.round(v));
  const flat = (t) => String(t).replace(/\s*\n\s*/g, " ");

  // ---------- atoms ----------
  const icon = (d, size = 16, cls) => s("svg", { class: cls, width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor",
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d }));
  const chevron = () => icon("M4.5 6.4 8 9.9l3.5-3.5", 11, "ag-chev");
  const arrow = () => icon("M8 2.5v11M3.8 9.2 8 13.4l4.2-4.2", 12, "ag-arrow");
  const infoIcon = () => icon("M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM8 7.4v3.8M8 5.1v.1", 14);
  const cloudIcon = () => s("svg", { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": 1.6,
    "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d: "M4.6 12.6h7.1a2.9 2.9 0 0 0 .3-5.8 4 4 0 0 0-7.7.9 2.5 2.5 0 0 0 .3 4.9z" }));
  const sr = (t) => h("span", { class: "ag-sr" }, t);
  const SCOPES = [{ value: "all", label: "All" }, { value: "local", label: "Local" }, { value: "cloud", label: "Cloud" }];
  const inScope = (m, scope) => (scope === "local" ? !isRef(m) : scope === "cloud" ? isRef(m) : true);

  /** Variant and location, minus what the cloud tag already says. */
  function subLine(m) {
    const where = String(m.where || "");
    const parts = String(m.variant || "").split("·").map((x) => x.trim()).filter(Boolean)
      .filter((x) => !(isRef(m) && /^cloud$/i.test(x)) && !where.toLowerCase().includes(x.toLowerCase()));
    return (isRef(m) ? parts : parts.concat(where ? [where] : [])).join(" · ");
  }
  function modelCell(m, ctx) {
    const pick = m.id === ctx.pick;
    const badge = LB.mono(m, 26);
    LB.tip.attach(badge, () => LB.modelTip(m, m.notes ? esc(m.notes) : ""));
    const sub = subLine(m);
    const cloud = isRef(m) ? h("span", { class: "ag-cloud", title: "Cloud reference: same tasks and graders, run through GitHub Copilot" }, cloudIcon(), "cloud") : null;
    return h("div", { class: "ag-model" }, badge, h("div", { class: "ag-model-txt" },
      h("button", { type: "button", class: "ag-name" }, h("span", {}, LB.label(m)),
        pick ? [h("span", { class: "ag-star", "aria-hidden": "true" }, "★"), sr(" (our pick)")] : null),
      sub || cloud ? h("span", { class: "ag-variant" }, cloud, sub) : null));
  }
  function valueOf(r, c) {
    if (c.key === "model") return LB.label(r.m);
    if (c.localOnly && isRef(r.m)) return null;
    return c.get(r.a);
  }
  const sortValue = (r, c) => shown(valueOf(r, c), c.kind);
  function valueNode(r, c, v) {
    switch (c.kind) {
      case "rate": {
        const sub = c.sub ? c.sub(r.a) : null;
        return [h("span", { class: "ag-rate" }, h("b", {}, pct(v)), sub ? h("small", {}, sub) : null),
          h("span", { class: "ag-mini", "aria-hidden": "true" },
            h("i", { style: { width: Math.max(0, Math.min(100, v)).toFixed(1) + "%", background: LB.vendor(r.m).color } }))];
      }
      case "pct": return pct(v);
      case "frac": case "ratio": return v.toFixed(2);
      case "runs": { const n = num(r.a[c.runs]); return [fmt.int(v), n !== null ? h("small", { class: "ag-runs" }, `(${fmt.int(n)})`) : null]; }
      case "min": case "gib": return fmt.num(v, 1);
      default: return fmt.int(v);
    }
  }

  // ---------- one table ----------
  function tableCard(T, ctx) {
    const su = LB.suite(T.key) || {};
    const all = models().filter((m) => rec(m, T.key)).map((m) => ({ m, a: rec(m, T.key) }));
    const chipText = isNum(su.tasks) ? `${fmt.int(su.tasks)} ${T.unit}` : null;
    const head = h("div", { class: "ag-head" },
      h("div", { class: "ag-title" }, h("h3", {}, T.title), chipText ? LB.chip(chipText, "ag-chip") : null),
      h("p", { class: "ag-intro" }, T.intro));
    if (!all.length) {
      return { el: LB.card("ag-card", head, h("div", { class: "lb-empty ag-none" }, "No results yet.")), draw() {}, fit() {} };
    }

    const cols = [MODEL].concat(T.cols);
    const main = T.cols[0], second = T.cols.find((c) => c.kind === "frac"), wall = T.cols.find((c) => c.kind === "time" || c.kind === "min");
    let sortKey = main.key, sortDir = main.dir, scope = "all";

    const heads = cols.map((c) => h("th", { scope: "col", class: ["ag-c-" + c.kind, c.localOnly && "ag-local"] },
      h("button", { type: "button", class: "ag-sort", onclick: () => setSort(c) },
        h("span", { class: "ag-th" }, c.label, chevron(), arrow()), h("span", { class: "ag-unit" }, c.unit || "\u00a0"))));
    const tbody = h("tbody");
    const table = h("table", { class: "ag-table" },
      h("caption", { class: "ag-sr" }, `${T.title}: one row per model, cloud references marked. Column headers sort the table.`),
      h("thead", {}, h("tr", {}, heads)), tbody);
    const scroller = h("div", { class: "ag-scroll", tabindex: "0", role: "region", "aria-label": T.title + " table" }, table);
    const empty = h("div", { class: "ag-none", hidden: true });
    const frame = h("div", { class: "ag-frame" }, scroller, empty);

    // Phones show each row as a card, so sorting moves to a dropdown.
    const selWrap = LB.select(cols.map((c) => ({ value: c.key, label: flat(c.label) })), sortKey, (v) => {
      const c = cols.find((x) => x.key === v);
      if (c) { sortKey = c.key; sortDir = c.dir; drawSort(); draw(); }
    }, `Sort ${T.title.toLowerCase()} by`);
    selWrap.classList.add("ag-sortsel");
    const select = selWrap.querySelector("select");
    const dirBtn = h("button", { type: "button", class: "ag-dir", "aria-label": "Reverse the order", title: "Reverse the order",
      onclick: () => { sortDir = sortDir === "asc" ? "desc" : "asc"; drawSort(); draw(); } }, arrow());
    head.append(h("div", { class: "ag-sortbar" }, h("span", { class: "ag-sortlbl" }, "Sort by"), selWrap, dirBtn));

    const count = h("span", { class: "ag-count" });
    const card = LB.card("ag-card", head, frame,
      h("div", { class: "ag-foot" }, h("p", { class: "ag-def" }, infoIcon(), h("span", {}, T.def)), count));

    function setSort(c) {
      if (sortKey === c.key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else { sortKey = c.key; sortDir = c.dir || "desc"; }
      drawSort();
      draw();
    }
    function drawSort() {
      cols.forEach((c, i) => {
        const on = c.key === sortKey;
        heads[i].classList.toggle("ag-on", on);
        heads[i].classList.toggle("ag-asc", on && sortDir === "asc");
        if (on) heads[i].setAttribute("aria-sort", sortDir === "asc" ? "ascending" : "descending");
        else heads[i].removeAttribute("aria-sort");
      });
      select.value = sortKey;
      dirBtn.classList.toggle("ag-up", sortDir === "asc");
    }
    /** Equal shown values: better headline result, then the local setup before the reference, then the faster run. */
    function tiebreak(x, y) {
      const g = (r, c) => (c ? sortValue(r, c) : null);
      const desc = (a, b) => (a === null) - (b === null) || (b || 0) - (a || 0);
      const asc = (a, b) => (a === null) - (b === null) || (a || 0) - (b || 0);
      return desc(g(x, main), g(y, main)) || desc(g(x, second), g(y, second)) || isRef(x.m) - isRef(y.m) ||
        asc(g(x, wall), g(y, wall)) || LB.label(x.m).localeCompare(LB.label(y.m), "en", { numeric: true });
    }
    function sorter(c, dir) {
      return (x, y) => {
        const a = sortValue(x, c), b = sortValue(y, c);
        if ((a === null) !== (b === null)) return a === null ? 1 : -1; // missing values always last
        let d = 0;
        if (a !== null) d = typeof a === "string" ? a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }) : a - b;
        if (d) return dir === "asc" ? d : -d;
        return tiebreak(x, y);
      };
    }
    function openFor(m) {
      const best = (id) => { const q = LB.quality().find((x) => x.id !== id); return q ? q.id : undefined; };
      if (isRef(m)) LB.openCompare(ctx.pick || best(m.id), m.id);
      else LB.openCompare(m.id, ctx.pick && ctx.pick !== m.id ? ctx.pick : best(m.id));
    }
    function row(r) {
      const m = r.m, ref = isRef(m), color = LB.vendor(m).color;
      const tr = h("tr", { class: ["ag-row", ref && "ag-ref", m.id === ctx.pick && "ag-pick"] });
      tr.appendChild(h("th", { scope: "row", class: "ag-c-model" },
        h("span", { class: ["ag-vbar", ref && "ag-vbar-ref"], style: ref ? { borderLeftColor: color } : { background: color }, "aria-hidden": "true" }),
        modelCell(m, ctx)));
      T.cols.forEach((c, i) => {
        const v = valueOf(r, c);
        const label = flat(c.label) + (MOBILE_UNIT[c.kind] ? `\u00a0(${MOBILE_UNIT[c.kind]})` : "");
        const body = v === null
          ? h("span", { class: "ag-na", title: c.localOnly && ref ? "Local runs only" : "Not measured" }, "—", sr(c.localOnly && ref ? " local runs only" : " not measured"))
          : valueNode(r, c, v);
        tr.appendChild(h("td", { class: ["ag-c-" + c.kind, i === 0 && "ag-main", c.kind === "count" && v !== null && (v > 0 ? "ag-hot" : "ag-zero")],
          "data-label": label }, body));
      });
      tr.addEventListener("click", (e) => {
        if (window.getSelection && String(window.getSelection())) return; // selecting text, not clicking
        const btn = tr.querySelector(".ag-name");
        if (btn && !btn.contains(e.target)) btn.focus({ preventScroll: true });
        openFor(m);
      });
      return tr;
    }
    /** A table that would scroll sideways first tries tighter spacing. */
    function fit() {
      table.classList.remove("ag-tight");
      if (scroller.clientWidth && getComputedStyle(table).display === "table" && scroller.scrollWidth > scroller.clientWidth + 1) {
        table.classList.add("ag-tight");
      }
      updateShade();
    }
    function updateShade() {
      const max = scroller.scrollWidth - scroller.clientWidth;
      frame.classList.toggle("ag-shade-l", scroller.scrollLeft > 1);
      frame.classList.toggle("ag-shade-r", max > 1 && scroller.scrollLeft < max - 1);
    }
    function draw(nextScope) {
      if (nextScope) scope = nextScope;
      const c = cols.find((x) => x.key === sortKey) || main;
      const rows = all.filter((r) => inScope(r.m, scope)).sort(sorter(c, sortDir));
      tbody.textContent = "";
      rows.forEach((r) => tbody.appendChild(row(r)));
      scroller.hidden = !rows.length;
      empty.hidden = !!rows.length;
      empty.textContent = rows.length ? "" : scope === "cloud" ? "No cloud reference has run this suite yet." : "No local results yet.";
      const nLocal = rows.filter((r) => !isRef(r.m)).length, nRef = rows.length - nLocal;
      count.textContent = [nLocal ? `${nLocal} local ${nLocal === 1 ? "setup" : "setups"}` : "",
        nRef ? `${nRef} cloud ${nRef === 1 ? "reference" : "references"}` : ""].filter(Boolean).join(" · ");
      fit();
    }
    scroller.addEventListener("scroll", updateShade, { passive: true });
    LB.onResize(fit);
    drawSort();
    return { el: card, draw, fit };
  }

  // ---------- section ----------
  function render(el) {
    const ctx = { pick: D.verdict && LB.byId(D.verdict.pick) ? D.verdict.pick : null };
    const withData = (m) => TABLES.some((T) => rec(m, T.key));
    const anyRows = models().some(withData);
    const nRef = models().filter((m) => isRef(m) && withData(m)).length;
    let cards = [];
    const seg = nRef && anyRows ? LB.seg(SCOPES, "all", (v) => cards.forEach((c) => c.draw(v))) : null;
    if (seg) { seg.classList.add("ag-scope"); seg.setAttribute("aria-label", "Show local setups, cloud references or both"); }
    el.append(LB.sectionHead({
      title: "Agentic coding on a real repo",
      sub: "Three suites run real tools in scratch clones of a private TypeScript monorepo and are scored apart from the core: real-repo " +
        "bug fixes, debugging and long multi-stage sessions. Cloud references took the same tasks through GitHub Copilot.",
      right: seg ? [seg] : null,
    }));
    if (!anyRows) {
      el.append(LB.card("ag-card ag-empty", h("div", { class: "lb-empty" }, "No agentic results yet. They land here as runs finish.")));
      return;
    }
    cards = TABLES.map((T) => tableCard(T, ctx));
    el.append(h("div", { class: "ag-stack" }, cards.map((c) => c.el)));
    cards.forEach((c) => c.draw("all"));
    requestAnimationFrame(() => cards.forEach((c) => c.draw()));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => cards.forEach((c) => c.fit())).catch(() => {});
  }

  LB.register({ id: "agentic", order: 55, nav: "Agentic", render });
})();
