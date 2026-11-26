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
  const noteOf = (m) => (m && typeof m.notes === "string" ? m.notes.trim() : "");
  /** Notes that several models share word for word (e.g. the cloud-reference one) are shown once under the table. */
  const SHARED_NOTES = (() => {
    const by = new Map();
    models().forEach((m) => { const t = noteOf(m); if (t) by.set(t, (by.get(t) || []).concat([m])); });
    return new Map([...by].filter(([, ms]) => ms.length > 1));
  })();

  /** Another model's weights on a different inference engine: say so, so it isn't read as a different model. */
  function engineTag(m) {
    if (!m.engineOf) return null;
    const base = LB.byId(m.engineOf);
    return h("span", { class: "mt-engine", title: base
      ? `Not a different model: the same weights as ${LB.fullName(base)}, run on a different inference engine`
      : "Not a different model: the same weights, run on a different inference engine" },
    base ? `Same weights as ${LB.label(base)}` : "Same weights, other engine");
  }

  function modelCell(m, ctx) {
    const isPick = m.id === ctx.pick;
    const note = noteOf(m);
    const kids = [LB.label(m), isPick ? [h("span", { class: "mt-star", "aria-hidden": "true" }, "★"), h("span", { class: "mt-sr" }, " (our pick)")] : null];
    const name = hasResults(m) ? h("button", { type: "button", class: "mt-name" }, kids) : h("span", { class: "mt-name" }, kids);
    const box = h("div", { class: "mt-model-in" }, LB.mono(m, 28),
      h("div", { class: "mt-model-txt" }, name, m.variant ? h("span", { class: "mt-variant" }, m.variant) : null, engineTag(m),
        note && !SHARED_NOTES.has(note) ? h("span", { class: "mt-note", title: note }, note) : null));
    LB.tip.attach(box.firstChild, () => LB.modelTip(m, note ? esc(note) : ""));
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
  const SPEED_KEYS = ["decode", "inTaskDecode", "ttft", "firstOutput", "taskTime", "prefill32k", "vram"];
  /** Speed and VRAM cells of a cloud reference: not measured on this PC, so not comparable. */
  const notComparable = () => h("span", { class: "mt-na", title: "Not comparable: cloud references run on remote hardware" }, "—");
  const numCol = (key, label, unit, get, f, dir = "desc", csvLabel) =>
    ({ key, label, unit, get, num: true, dir, cell: (m) => { const v = get(m); return v === null ? (isRef(m) && SPEED_KEYS.includes(key) ? notComparable() : na()) : f(v); }, csv: [[csvLabel || label, get]] });
  /** "Long-context repo QA" → "Long-context\nrepo QA": long header labels break at the space nearest the middle. */
  function twoLines(t) {
    const str = String(t), mid = str.length / 2;
    if (str.length < 11) return str;
    let at = -1;
    for (let i = str.indexOf(" "); i > 0; i = str.indexOf(" ", i + 1)) if (at < 0 || Math.abs(i - mid) < Math.abs(at - mid)) at = i;
    return at > 0 ? str.slice(0, at) + "\n" + str.slice(at + 1) : str;
  }
  const suiteScore = (key) => (m) => { const x = m.scores && m.scores.suites; return x && typeof x === "object" ? num(x[key]) : null; };
  /** Core tasks a model answered (exported; else counted from the core suites it has a score on) and the graded rows behind them. */
  function coreTasks(m) {
    if (isNum(m.coreTasks)) return m.coreTasks;
    let n = 0, any = false;
    coreSuiteKeys().forEach((k) => { const su = LB.suite(k); if (su && isNum(su.tasks) && suiteScore(k)(m) !== null) { n += su.tasks; any = true; } });
    return any ? n : null;
  }
  const coreRows = (m) => num(m.coreRows);
  const HAS_CORE_ROWS = models().some((m) => coreRows(m) !== null);
  const suiteCols = () => coreSuiteKeys().map((key) => {
    const su = LB.suite(key) || {}, name = su.name || key, get = suiteScore(key);
    return { key: "s_" + key, label: twoLines(name), unit: isNum(su.tasks) ? `${fmt.int(su.tasks)} tasks` : "score", get, num: true, dir: "desc",
      desc: [su.desc, key === "vision" ? "Counted in All suites, not in the text core." : ""].filter(Boolean).join(" "),
      cell: (m) => { const v = get(m); if (v !== null) return fmt.pct(v); return textCore(m) !== null ? h("span", { class: "mt-na", title: "Not run by this model" }, "—") : na(); },
      csv: [[name + " %", get]] };
  });
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
    ...suiteCols(),
    { key: "coreTasks", label: "Core\ntasks", unit: HAS_CORE_ROWS ? "(rows)" : "answered", get: coreTasks, num: true, dir: "desc",
      cell: (m) => { const t = coreTasks(m); return t === null ? na() : withCount(fmt.int(t), coreRows(m)); },
      csv: [["Core tasks", coreTasks]].concat(HAS_CORE_ROWS ? [["Core rows", coreRows]] : []) },
    numCol("repo_replay", "Repo fixes", "% solved", score("repo_replay"), (v) => fmt.pct(v), "desc", "Repo fixes %"),
    numCol("debug", "Debug", "% fixed", score("debug"), (v) => fmt.pct(v), "desc", "Debug %"),
    numCol("long_horizon", "Long sessions", "% stages passed", score("long_horizon"), (v) => fmt.pct(v), "desc", "Long sessions % stages passed"),
    numCol("decode", "Decode", "tokens / sec", decode, fmt.tps, "desc", "Decode tok/s"),
    numCol("inTaskDecode", "In-task\ndecode", "tokens / sec", speed((x) => x.inTaskDecode), fmt.tps, "desc", "In-task decode tok/s"),
    numCol("ttft", "TTFT", "s · first token", speed((x) => x.ttft), (v) => fmt.num(v, 2), "asc", "TTFT s"),
    numCol("firstOutput", "First output", "s · after thinking", speed((x) => x.firstOutput), (v) => fmt.num(v, 2), "asc", "First output s"),
    numCol("taskTime", "Time per task", "seconds · median", speed((x) => x.taskTime), (v) => fmt.num(v, 1), "asc", "Time per task s"),
    numCol("prefill32k", "Prefill @32K", "tokens / sec", speed((x) => x.prefill && x.prefill["32k"]), fmt.int, "desc", "Prefill @32K tok/s"),
    { key: "vram", label: "VRAM", unit: "GiB · both GPUs", get: vramSum, num: true, dir: "asc", cell: vramCell, csv: [["VRAM GiB", vramSum]] },
    { key: "status", label: "Status", get: statusRank, dir: "asc", cell: statusChip, csv: [["Status", (m) => statusInfo(m).text]] },
  ];

  // ---------- full suites: each model's own task set ----------
  const full = (m) => (m && m.fullSuites && typeof m.fullSuites === "object" ? m.fullSuites : null);
  const fullScore = (m) => { const f = full(m); return f ? num(f.score) : null; };
  const fullSuite = (m, key) => { const f = full(m), x = f && f.suites && f.suites[key]; return x && typeof x === "object" ? x : null; };
  /** "78.1 (20)": a score with its task count, or "126 (256)": tasks with graded rows. */
  const withCount = (main, n) => [h("span", {}, main), isNum(n) ? h("small", { class: "mt-count-n" }, `(${fmt.int(n)})`) : null];
  function coreSuiteKeys() {
    const core = D.core || {};
    if (Array.isArray(core.suites) && core.suites.length) return core.suites;
    return (Array.isArray(D.suites) ? D.suites : []).filter((x) => x && x.inCore).map((x) => x.key);
  }
  const colByKey = (k) => COLS.find((c) => c.key === k);
  const FULL_COLS = [
    colByKey("model"),
    colByKey("where"),
    { key: "fullScore", label: "Score", unit: "full suites", get: fullScore, num: true, dir: "desc",
      cell: (m) => { const v = fullScore(m); return v === null ? na() : h("span", { class: "mt-strong" }, fmt.pct(v)); },
      csv: [["Full-suite score", fullScore]] },
    ...coreSuiteKeys().map((key) => {
      const su = LB.suite(key) || {}, name = su.name || key;
      const get = (m) => { const x = fullSuite(m, key); return x ? num(x.score) : null; };
      const tasks = (m) => { const x = fullSuite(m, key); return x ? num(x.tasks) : null; };
      return { key: "full_" + key, label: twoLines(name), unit: "score (tasks)", get, num: true, dir: "desc", desc: su.desc,
        cell: (m) => { const v = get(m); return v === null ? na() : withCount(fmt.pct(v), tasks(m)); },
        csv: [[name + " %", get], [name + " tasks", tasks]] };
    }),
    { key: "fullTasks", label: "Tasks", unit: "(rows)", num: true, dir: "desc",
      get: (m) => { const f = full(m); return f ? num(f.tasks) : null; },
      cell: (m) => { const f = full(m); return f && isNum(f.tasks) ? withCount(fmt.int(f.tasks), f.rows) : na(); },
      csv: [["Tasks", (m) => { const f = full(m); return f ? num(f.tasks) : null; }], ["Rows", (m) => { const f = full(m); return f ? num(f.rows) : null; }]] },
    colByKey("status"),
  ];
  const VIEWS = [{ value: "core", label: "Core set" }, { value: "full", label: "Full suites" }];
  const CAVEAT = "Each model's own task set (more tasks / repeats where it had time) — not directly comparable across models.";

  /** Shared model notes, then D.core.notes with suite keys and model ids turned into names. */
  function notesBlock() {
    const cov = (D.core && Array.isArray(D.core.notes) ? D.core.notes : []).filter((x) => typeof x === "string" && x.trim());
    const names = (t) => String(t).replace(/[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]/g, (tok) => { const m = LB.byId(tok); return m ? LB.label(m) : tok; });
    const allRefs = models().filter(isRef).length;
    const items = [...SHARED_NOTES].map(([t, ms]) => h("li", {},
      h("b", {}, ms.every(isRef) && ms.length === allRefs ? "Cloud references" : ms.map((m) => LB.label(m)).join(", ")), ": ", t));
    cov.forEach((t) => {
      const mt = /^\s*([A-Za-z0-9_]+)\s*:\s*([\s\S]*)$/.exec(t);
      const su = mt && LB.suite(mt[1]);
      items.push(h("li", {}, su ? [h("b", {}, su.name || mt[1]), ": ", names(mt[2])] : names(t)));
    });
    if (!items.length) return null;
    return h("div", { class: "mt-cov" }, h("span", { class: "mt-cov-h" }, "Notes"), h("ul", {}, items));
  }
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
      case "coreTasks": return `Core tasks this model answered across the ${coreSuiteKeys().length} core suites; fewer when it skipped one (e.g. vision)` +
        (HAS_CORE_ROWS ? ". Graded rows, repeats included, in parentheses" : "");
      case "decode": return "Generation speed on short prompts, speculative decoding on";
      case "inTaskDecode": return "Median generation speed measured during the benchmark tasks";
      case "ttft": return "Median seconds to the first streamed token of a core task, thinking tokens included";
      case "firstOutput": return "Median seconds until the first answer token or tool call of a core task, after any thinking";
      case "taskTime": return "Median wall time per core task, thinking included";
      case "prefill32k": return "Prompt processing speed at 32K tokens of context";
      case "vram": return "GPU memory in use, both cards combined";
      case "fullScore": return "Mean over each model's own task set: more tasks and repeats where it had time";
      case "fullTasks": return "Distinct tasks, then graded rows including repeats";
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
  function downloadCsv(rows, cols, file) {
    const defs = cols.flatMap((c) => c.csv || []);
    const lines = [defs.map(([label]) => csvCell(label)).join(",")]
      .concat(rows.map((m) => defs.map(([, get]) => csvCell(get(m))).join(",")));
    const blob = new Blob(["\ufeff" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: file, style: { display: "none" } });
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
  const infoIcon = () => icon("M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM8 7.4v3.8M8 5.1v.1", 14);
  const warnIcon = () => icon("M8 2.2 14.3 13.3H1.7L8 2.2zM8 6.6v3.3M8 11.6v.1", 14);
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
    const hasFull = all.some((m) => fullScore(m) !== null);
    const sorts = { core: { key: "textCore", dir: "desc" }, full: { key: "fullScore", dir: "desc" } };
    let view = "core", query = "", scope = "all", visible = [], heads = [];
    const cols = () => (view === "full" ? FULL_COLS : COLS);

    const input = h("input", { type: "search", placeholder: "Search models…", "aria-label": "Search models, vendors, hardware or quants",
      autocomplete: "off", spellcheck: "false", oninput: (e) => { query = e.target.value; drawBody(); } });
    const search = h("label", { class: "lb-search mt-search" }, searchIcon(), input);
    const csvBtn = h("button", { type: "button", class: "lb-btn mt-csv",
      onclick: () => downloadCsv(visible, cols(), view === "full" ? "local-llm-leaderboard-full-suites.csv" : "local-llm-leaderboard.csv") },
      downloadIcon(), "Download CSV");
    // Only offer the Local / Cloud switch when the data has cloud references.
    const scopeSeg = nRef ? LB.seg(SCOPES, scope, (v) => { scope = v; drawBody(); }) : null;
    if (scopeSeg) {
      scopeSeg.classList.add("mt-scope");
      scopeSeg.setAttribute("aria-label", "Show local setups, cloud references or both");
    }

    const headRow = h("tr");
    const tbody = h("tbody");
    const table = h("table", { class: "mt-table" },
      h("caption", { class: "mt-sr" }, "Every configuration tested on this machine. Column headers sort the table."),
      h("thead", {}, headRow), tbody);
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
    const viewNote = h("p", { class: "mt-viewnote", "aria-live": "polite" });
    const viewSeg = hasFull ? LB.seg(VIEWS, view, (v) => { view = v; buildHead(); drawBody(); }) : null;
    if (viewSeg) {
      viewSeg.classList.add("mt-view");
      viewSeg.setAttribute("aria-label", "Scores on the shared core set or on each model's full suites");
    }
    const card = LB.card("mt-card", h("div", { class: "mt-bar" }, viewSeg, viewNote), frame,
      h("div", { class: "mt-foot" }, count, legend), notesBlock());
    el.append(LB.sectionHead({ title: "Model comparison", sub: "Every configuration tested on this machine. Click a column to sort.",
      right: [scopeSeg, search, csvBtn] }), card);

    function buildHead() {
      heads = cols().map((c) => {
        const btn = h("button", { type: "button", class: "mt-sort", title: columnDesc(c.key) || c.desc || null, onclick: () => setSort(c) },
          h("span", { class: "mt-th" }, h("span", { class: "mt-lbl" }, c.label), chevron(), arrow()), c.unit ? h("span", { class: "mt-unit" }, c.unit) : null);
        return h("th", { scope: "col", class: ["mt-c-" + c.key, c.num && "mt-num"] }, btn);
      });
      headRow.textContent = "";
      headRow.append(...heads);
      const core = D.core || {};
      viewNote.className = "mt-viewnote" + (view === "full" ? " mt-caveat" : "");
      viewNote.textContent = "";
      viewNote.append(view === "full" ? warnIcon() : infoIcon(), h("span", {}, view === "full" ? CAVEAT
        : `Core set: the same ${isNum(core.tasks) ? fmt.int(core.tasks) + " " : ""}questions for every model, so the scores compare directly.`));
      drawHead();
    }
    function setSort(c) {
      const st = sorts[view];
      if (st.key === c.key) st.dir = st.dir === "asc" ? "desc" : "asc";
      else { st.key = c.key; st.dir = c.dir || "asc"; }
      drawHead();
      drawBody();
    }
    function drawHead() {
      const st = sorts[view];
      cols().forEach((c, i) => {
        const on = c.key === st.key;
        heads[i].classList.toggle("mt-on", on);
        heads[i].classList.toggle("mt-asc", on && st.dir === "asc");
        if (on) heads[i].setAttribute("aria-sort", st.dir === "asc" ? "ascending" : "descending");
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
      cols().forEach((c) => {
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
      const st = sorts[view];
      const col = cols().find((c) => c.key === st.key) || cols()[0];
      const fullView = view === "full";
      const inView = all.filter((m) => inScope(m, scope) && (!fullView || fullScore(m) !== null));
      visible = inView.filter((m) => { const hay = haystack(m); return terms.every((t) => hay.includes(t)); }).sort(sorter(col, st.dir));
      tbody.textContent = "";
      visible.forEach((m) => tbody.appendChild(row(m)));
      const noun = scope === "cloud" ? "cloud references" : scope === "local" ? "local configurations" : "configurations";
      const what = noun + (fullView ? " with full-suite results" : "");
      empty.hidden = visible.length > 0;
      empty.textContent = visible.length ? "" : terms.length ? `No ${what} match “${query.trim()}”.` : `No ${what} yet.`;
      const local = all.filter((m) => !isRef(m));
      if (terms.length) count.textContent = `Showing ${visible.length} of ${inView.length} ${what}`;
      else if (fullView) {
        const nLocal = inView.filter((m) => !isRef(m)).length, nCloud = inView.length - nLocal;
        count.textContent = [nLocal ? `${nLocal} local configurations` : "", nCloud ? `${nCloud} cloud references` : "",
          "each on its own task set"].filter(Boolean).join(" · ");
      } else if (scope === "cloud") count.textContent = `${visible.length} cloud references · same tasks and graders, run through GitHub Copilot`;
      else {
        const scored = local.filter((m) => textCore(m) !== null).length;
        const pending = local.filter((m) => m.status && m.status !== "done").length;
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
    buildHead();
    drawBody();
    requestAnimationFrame(updateShade);
  }

  LB.register({ id: "models", order: 80, nav: "All models", render });
})();
