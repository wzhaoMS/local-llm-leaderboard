/* In progress: giant models (bigger than VRAM) whose runs are running, queued, scheduled for later, or only partly scored. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s } = LB;
  const D = LB.data || {};

  const STATUS = {
    running: { text: "Running", cls: "pg-running lime", legend: "running now" },
    queued: { text: "Queued", cls: "pg-queued", legend: "next in line" },
    waiting: { text: "Scheduled", cls: "pg-waiting", legend: "runs when the machine is free" },
    partial: { text: "Partial results", cls: "pg-partial warn", legend: "scored on the tasks it finished" },
  };
  const ORDER = ["running", "queued", "waiting", "partial"];

  function statusKey(m) {
    const st = m.status || "done";
    if (st === "done") return "partial";
    return STATUS[st] ? st : "other";
  }
  function statusInfo(m) {
    return STATUS[statusKey(m)] || { text: String(m.status).replace(/^./, (c) => c.toUpperCase()), cls: "pg-queued" };
  }
  const dot = (k) => h("i", { class: ["pg-dot", k && "pg-dot-" + k], "aria-hidden": "true" });
  function chip(m) {
    const st = statusInfo(m);
    return h("span", { class: ["lb-chip", "pg-chip", st.cls] }, dot(), st.text);
  }
  function splitParams(p) {
    const str = p == null ? "" : String(p);
    const i = str.indexOf(" (");
    return i > 0 ? [str.slice(0, i), str.slice(i + 2).replace(/\)$/, "")] : [str, ""];
  }
  const sr = (t) => h("span", { class: "pg-sr" }, t);
  const cap = (t) => h("span", { class: "pg-cap", "aria-hidden": "true" }, t); // column name, shown when the header row is hidden

  function row(m) {
    const [pMain, pSub] = splitParams(m.params);
    const place = LB.PLACEMENT_LABEL[m.placement] || m.placement || "—";
    const pending = m.status && m.status !== "done";
    const model = h("div", { class: "pg-model" }, LB.mono(m, 34),
      h("div", { class: "pg-model-txt" },
        h("div", { class: "pg-name" }, m.name || LB.label(m)),
        h("div", { class: "pg-variant" }, m.variant || "",
          pending && m.partial ? h("span", { class: "pg-tag", title: "Partial run: scored on the tasks it finishes." }, "partial run") : null),
        m.notes ? h("div", { class: "pg-notes" }, m.notes) : null));
    LB.tip.attach(model.firstChild, () => LB.modelTip(m));
    return h("li", { class: "pg-row" },
      model,
      h("div", { class: "pg-cell" }, cap("Params"), sr("Parameters: "), h("span", { class: "pg-main" }, pMain || "—"), pSub ? h("span", { class: "pg-sub" }, pSub) : null),
      h("div", { class: "pg-cell" }, cap("Quant"), sr("Quant: "), h("span", { class: "pg-main" }, m.quant || "—")),
      h("div", { class: "pg-cell" }, cap("Runs on"), sr("Runs on: "), h("span", { class: "pg-main" }, place), m.where ? h("span", { class: "pg-sub" }, m.where) : null),
      h("div", { class: "pg-status" }, sr("Status: "), chip(m)));
  }

  function render(el) {
    const all = (Array.isArray(D.models) ? D.models : []).filter(Boolean);
    const rank = (m) => { const i = ORDER.indexOf(statusKey(m)); return i < 0 ? ORDER.length : i; };
    const list = all.filter((m) => !m.reference && ((m.status && m.status !== "done") || m.partial)).sort((a, b) => rank(a) - rank(b));
    const counts = ORDER.map((k) => [k, list.filter((m) => statusKey(m) === k).length]).filter(([, n]) => n);
    const right = counts.length ? h("div", { class: "pg-counts" },
      counts.map(([k, n]) => h("span", { class: "pg-count" }, dot(k), h("b", {}, String(n)), " " + STATUS[k].text.toLowerCase()))) : null;
    el.append(LB.sectionHead({
      title: "In progress: giant models",
      sub: "Bigger than VRAM: experts live in system RAM or stream from two NVMe drives. Results land here as runs finish.",
      right,
    }));

    if (!list.length) {
      el.append(LB.card("pg-card pg-empty",
        h("span", { class: "pg-empty-icon", "aria-hidden": "true" },
          s("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
            s("path", { d: "M5 12.5l4.2 4.2L19 7" }))),
        h("div", {}, h("b", {}, "Nothing in progress"),
          h("p", {}, "Every configuration has finished its run. New giant-model runs will show up here."))));
      return;
    }

    el.append(LB.card("pg-card",
      h("div", { class: "pg-cols", "aria-hidden": "true" },
        h("span", {}, "Model"), h("span", {}, "Params"), h("span", {}, "Quant"), h("span", {}, "Runs on"), h("span", { class: "pg-cols-st" }, "Status")),
      h("ul", { class: "pg-list", role: "list", "aria-label": "Runs in progress" }, list.map(row)),
      h("div", { class: "pg-legend" },
        ORDER.map((k) => h("span", { class: "pg-leg" }, dot(k), h("span", {}, h("b", {}, STATUS[k].text), " — " + STATUS[k].legend))))));
  }

  LB.register({ id: "in-progress", order: 95, nav: "In progress", render });
})();
