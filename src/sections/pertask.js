/* Per task: "Best in X" cards with the top 5 models on each suite (mirrors "Best models per task"). */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, isNum, fmt } = LB;

  const TASKS = [
    ["ts_coding", "Coding"],
    ["repo_replay", "Real-repo bug fixes"],
    ["debug", "Debugging"],
    ["long_horizon", "Long sessions"],
    ["zh_intent", "Chinese intent"],
    ["finance_extract", "Statement extraction"],
    ["tool_calling", "Tool calling"],
    ["reasoning", "Finance math"],
    ["browser_agent", "Browser agent"],
    ["repo_qa", "Long-context repo QA"],
  ];
  const TOP = 5;
  const AGENTIC = ["repo_replay", "debug", "long_horizon"];

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const r1 = (v) => Math.round(v * 10) / 10;
  const pctText = (v) => (r1(v) === 100 ? "100" : fmt.pct(v, 1)) + "%";
  const secText = (v) => (v >= 100 ? fmt.int(v) : fmt.num(v, 1)) + " s";
  const secInt = (v) => fmt.int(v) + " s";
  const plural = (n, one, many) => `${fmt.int(n)} ${n === 1 ? one : many || one + "s"}`;
  const models = () => (LB.data && Array.isArray(LB.data.models) ? LB.data.models : []).filter(Boolean);
  const agentic = (m, key) => (m.agentic && m.agentic[key]) || null;
  // The top 5 is local-only; cloud references (m.reference) get their own footer line.
  const isRef = (m) => m.reference === true;
  const isLocal = (m) => !isRef(m) && LB.matchPlacement(m, "all");

  /** Time stat for the sub line; also breaks ties (lower = faster). */
  function timeStat(m, key) {
    const ag = agentic(m, key);
    if (key === "repo_replay") return ag && isNum(ag.medianWallS) ? { t: ag.medianWallS, text: `median ${secInt(ag.medianWallS)} per fix` } : null;
    if (key === "debug") return ag && isNum(ag.medianTimeToFixS) ? { t: ag.medianTimeToFixS, text: `median ${secInt(ag.medianTimeToFixS)} to fix` } : null;
    if (key === "long_horizon") return ag && isNum(ag.medianWallMin) ? { t: ag.medianWallMin * 60, text: `${fmt.num(ag.medianWallMin, 1)} min per session` } : null;
    const t = m.suiteTimeS && m.suiteTimeS[key];
    return isNum(t) ? { t, text: `median ${secText(t)} per task` } : null;
  }

  /** Models passing `keep` with a score on `key`, best first; equal scores: faster first. */
  function ranked(key, keep) {
    const out = [];
    for (const m of models()) {
      if (!keep(m)) continue;
      const v = LB.score(m, key);
      if (!isNum(v)) continue;
      out.push({ m, v, ts: timeStat(m, key) });
    }
    const t = (x) => (x.ts ? x.ts.t : Infinity);
    const core = (x) => (x.m.scores && isNum(x.m.scores.textCore) ? x.m.scores.textCore : -1);
    const name = (x) => String(LB.label(x.m) || "");
    out.sort((a, b) => r1(b.v) - r1(a.v) || t(a) - t(b) || core(b) - core(a) || name(a).localeCompare(name(b)));
    return out;
  }

  /** "6 tasks" from suite.tasks (sessions for long_horizon); falls back to the per-model counts if it is missing. */
  function countText(key, su) {
    const unit = key === "long_horizon" ? "session" : "task";
    if (su && isNum(su.tasks)) return plural(su.tasks, unit);
    if (AGENTIC.includes(key)) {
      let tasks = 0, sessions = 0;
      for (const m of models()) {
        const a = agentic(m, key);
        if (!a) continue;
        if (isNum(a.tasks)) tasks = Math.max(tasks, a.tasks);
        if (isNum(a.sessions)) sessions = Math.max(sessions, a.sessions);
      }
      return tasks ? plural(tasks, "task") : sessions ? plural(sessions, "session") : "";
    }
    const n = LB.data.core && LB.data.core.perSuite;
    return isNum(n) ? plural(n, "task") : "";
  }

  /** Extra tooltip lines for one model on one task. */
  function detail(m, key, v, ts) {
    const su = LB.suite(key) || { name: key };
    const a = agentic(m, key) || {};
    const lines = [`${esc(su.name)}: <b>${pctText(v)}</b>` + (ts ? ` <span class="muted">· ${esc(ts.text)}</span>` : "")];
    if (key === "repo_replay") {
      if (isNum(a.runs)) lines.push(plural(a.runs, "run") + (isNum(a.tasks) ? ` over ${plural(a.tasks, "task")}` : ""));
      if (isNum(a.medianSteps)) lines.push(`Median ${fmt.int(a.medianSteps)} tool steps per fix`);
    } else if (key === "debug") {
      if (isNum(a.rootCauseNamed)) lines.push(`Root cause named in ${fmt.pct(a.rootCauseNamed, 0)}% of bugs`);
      if (isNum(a.reproducedFirst)) lines.push(`Reproduced the bug first in ${fmt.pct(a.reproducedFirst, 0)}%`);
    } else if (key === "long_horizon") {
      if (isNum(a.stagesPassed) && isNum(a.stagesTotal)) lines.push(`${fmt.int(a.stagesPassed)} of ${fmt.int(a.stagesTotal)} stages passed`);
      if (isNum(a.recall)) lines.push(`Recall ${fmt.pct(a.recall, 0)}%` + (isNum(a.violations) ? ` · ${plural(a.violations, "rule violation")}` : ""));
    }
    return lines.join("<br>");
  }

  function subLine(m, ts) {
    const text = [m.where, ts && ts.text].filter(Boolean).join(" · ");
    return [text, m.partial ? h("span", { class: "pt-partial", title: "Partial run: scored on the tasks it finished." }, "partial") : null];
  }

  /** The best cloud reference on this suite (same tie rule as the list), or null when none has a result. */
  function refLine(key, title) {
    const refs = ranked(key, isRef);
    if (!refs.length) return null;
    const best = refs[0];
    const tied = refs.filter((x) => r1(x.v) === r1(best.v)).length - 1;
    const line = h("span", { class: "pt-ref" },
      h("span", { class: "pt-ref-k" }, "Cloud reference:"),
      LB.mono(best.m, 18),
      h("span", { class: "pt-ref-name" }, LB.label(best.m)),
      tied > 0 ? h("span", { class: "pt-ref-tied" }, `+${tied} tied`) : null,
      h("span", { class: "pt-ref-val" }, pctText(best.v)));
    LB.tip.attach(line, () => {
      const none = models().filter((m) => isRef(m) && !refs.some((x) => x.m === m)).map((m) => esc(LB.label(m)));
      return `<b>Cloud references · ${esc(title)}</b><br>` +
        refs.map((x) => `${esc(LB.label(x.m))} <b>${pctText(x.v)}</b>` + (x.ts ? ` <span class="muted">· ${esc(x.ts.text)}</span>` : "")).join("<br>") +
        (none.length ? `<br><span class="muted">No result yet: ${none.join(", ")}</span>` : "") +
        `<hr><span class="muted">Same tasks and graders, run in the cloud through GitHub Copilot. Not ranked with the local models.</span>`;
    });
    return line;
  }

  function taskCard(key, title) {
    const su = LB.suite(key) || { key, short: key, name: title };
    const rows = ranked(key, isLocal);
    if (!rows.length) return null;
    const top = rows.slice(0, TOP);
    const cut = top.length === TOP ? r1(top[TOP - 1].v) : null;
    const tied = cut === null ? [] : rows.slice(TOP).filter((x) => r1(x.v) === cut);

    const count = countText(key, su);
    const chip = LB.chip([su.short || su.name, count].filter(Boolean).join(" · "), "pt-chip");
    if (su.desc) LB.tip.attach(chip, `<b>${esc(su.name)}</b><br>${esc(su.desc)}`);

    const list = top.map((x, i) => {
      const row = LB.rankRow(i, x.m, pctText(x.v), x.v / 100, subLine(x.m, x.ts));
      LB.tip.attach(row, () => LB.modelTip(x.m, detail(x.m, key, x.v, x.ts)));
      return row;
    });

    let more = null;
    if (tied.length) {
      more = h("span", { class: "pt-more" }, `+${tied.length} more at ${pctText(cut)}`);
      LB.tip.attach(more, () => `<b>Also at ${pctText(cut)}</b><br>` +
        tied.map((x) => `${esc(LB.label(x.m))}` + (x.ts ? ` <span class="muted">· ${esc(x.ts.text)}</span>` : "")).join("<br>"));
    }
    // One muted footer line: local ties on the left, the best cloud reference on the right.
    const ref = refLine(key, title);
    const foot = more || ref ? h("div", { class: "pt-foot" }, h("div", { class: "pt-foot-in" }, more, ref)) : null;

    return LB.card("pt-card",
      h("div", { class: "pt-head" }, h("h3", {}, "Best in " + title), chip),
      h("div", { class: "lb-list pt-list" }, list),
      foot);
  }

  function render(el) {
    const cards = TASKS.map(([key, title]) => taskCard(key, title)).filter(Boolean);
    el.append(
      LB.sectionHead({ title: "Best models per task", sub: "Top 5 local models on each task. Every model answered the same questions." }),
      cards.length ? h("div", { class: "lb-grid-2 pt-grid" }, cards) : LB.card("lb-empty", "No per-task results yet."));
  }

  LB.register({ id: "per-task", order: 50, nav: "Per task", render });
})();
