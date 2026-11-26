/* Methodology: how the numbers are produced, plus the task suites behind every score. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, fmt, isNum } = LB;
  const D = LB.data || {};
  const GROUP = { daily: "Daily work", coding: "Coding", agents: "Agents" };

  /** "2026-11-25T17:02-05:00" -> "Nov 25, 2026" (the date as published, independent of the reader's time zone). */
  function fmtDate(iso) {
    const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!mt) return iso ? String(iso) : "—";
    return new Date(Date.UTC(+mt[1], +mt[2] - 1, +mt[3]))
      .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;
  const list = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);

  function render(el) {
    const items = (Array.isArray(D.methodology) ? D.methodology : []).filter((x) => x && (x.title || x.body));
    const suites = (Array.isArray(D.suites) ? D.suites : []).filter(Boolean);
    const core = D.core || {};
    const textKeys = Array.isArray(core.textSuites) ? core.textSuites : suites.filter((x) => x.inCore && x.key !== "vision").map((x) => x.key);
    const role = (su) => (textKeys.includes(su.key) ? "text" : su.inCore ? "all" : "separate");

    el.append(LB.sectionHead({ title: "Methodology", sub: "How the numbers are produced." }));
    if (items.length) {
      // 12-column grid with 4 or 3 cards per row, whichever leaves the fuller last row (8 → 4 + 4, 7 → 4 + 3, 6 → 3 + 3).
      // Cards in a short last row stretch to fill it; a card alone on its row becomes a wide row card.
      const n = items.length;
      const missing = (per) => (n % per ? per - (n % per) : 0);
      const per = n <= 4 ? n : missing(4) <= missing(3) ? 4 : 3;
      const rest = n % per, lastStart = n - rest;
      el.append(h("div", { class: ["me-grid", "me-per-" + per] }, items.map((it, i) => {
        const span = 12 / (rest && i >= lastStart ? rest : per);
        const card = LB.card(["me-card", span === 12 && "me-wide", n % 2 === 1 && i === n - 1 && "me-wide2"].filter(Boolean).join(" "),
          h("span", { class: "me-num", "aria-hidden": "true" }, String(i + 1).padStart(2, "0")),
          h("h3", {}, it.title || ""), it.body ? h("p", {}, it.body) : null);
        card.style.setProperty("--me-span", String(span));
        return card;
      })));
    }

    if (suites.length) {
      const text = suites.filter((x) => role(x) === "text");
      const all = suites.filter((x) => role(x) === "all");
      const sep = suites.filter((x) => role(x) === "separate");
      const qs = (n) => (isNum(n) ? ` on the same ${fmt.int(n)} questions` : "");
      const lede = [
        text.length ? `The text core is the mean of ${plural(text.length, "text suite")}${qs(core.textTasks)}.` : "",
        all.length ? `${list(all.map((x) => x.name))} ${all.length === 1 ? "joins" : "join"} them in All suites` +
          (isNum(core.tasks) ? ` (${fmt.int(core.tasks)} questions).` : ".") : "",
        sep.length ? `The ${plural(sep.length, "agentic suite")} run real tools and are reported separately.` : "",
      ].filter(Boolean).join(" ");
      const counted = (su) => {
        const r = role(su);
        if (r === "text") return h("span", { class: "lb-chip lime me-yes" }, "✓ Yes");
        if (r === "all") return LB.chip("All suites only", "me-all");
        return LB.chip("Separate", "me-sep");
      };
      const tasks = (su) => (isNum(su.tasks) ? (su.key === "long_horizon" ? plural(su.tasks, "session") : fmt.int(su.tasks)) : "—");
      el.append(LB.card("me-suites",
        h("div", { class: "lb-card-head me-head" }, h("div", {}, h("h3", {}, "Task suites"), lede ? h("p", {}, lede) : null),
          LB.chip(plural(suites.length, "suite"), "me-count")),
        h("div", { class: "me-scroll" },
          h("table", { class: "me-table" },
            h("caption", { class: "me-sr" }, "Task suites: what each one tests, how many tasks every model answers, and whether it counts toward the text core"),
            h("thead", {}, h("tr", {},
              h("th", { scope: "col" }, "Suite"), h("th", { scope: "col" }, "Group"),
              h("th", { scope: "col", class: "me-num-col" }, "Tasks"),
              h("th", { scope: "col" }, "What it tests"), h("th", { scope: "col" }, "Counted in text core?"))),
            h("tbody", {}, suites.map((su) => h("tr", {},
              h("th", { scope: "row" }, h("span", { class: "me-name" }, su.name || su.key),
                su.short && su.short !== su.name ? h("span", { class: "me-short" }, su.short) : null),
              h("td", {}, h("span", { class: ["me-group", "me-g-" + (su.group || "x")] }, GROUP[su.group] || su.group || "—")),
              h("td", { class: "me-num-col" }, tasks(su)),
              h("td", { class: "me-desc" }, su.desc || "—"),
              h("td", {}, counted(su)))))))));
    }

    const hw = D.hardware || {};
    const meta = [
      hw.engine ? ["Engine", hw.engine] : null,
      D.generated ? ["Data generated", fmtDate(D.generated)] : null,
      isNum(core.gradedRuns) ? ["Graded runs", fmt.int(core.gradedRuns)] : null,
    ].filter(Boolean);
    if (meta.length) el.append(h("p", { class: "me-foot" }, meta.map(([k, v]) => h("span", {}, k + ": ", h("b", {}, v)))));
  }

  LB.register({ id: "methodology", order: 98, nav: "Methodology", render });
})();
