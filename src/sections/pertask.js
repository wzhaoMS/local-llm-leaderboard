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
  const REFS = 2;
  const AGENTIC = ["repo_replay", "debug", "long_horizon"];

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const r1 = (v) => Math.round(v * 10) / 10;
  const pctText = (v) => (r1(v) === 100 ? "100" : fmt.pct(v, 1)) + "%";
  const secText = (v) => (v >= 100 ? fmt.int(v) : fmt.num(v, 1)) + " s";
  const secInt = (v) => fmt.int(v) + " s";
  const plural = (n, one, many) => `${fmt.int(n)} ${n === 1 ? one : many || one + "s"}`;
  const models = () => (LB.data && Array.isArray(LB.data.models) ? LB.data.models : []).filter(Boolean);
  const agentic = (m, key) => (m.agentic && m.agentic[key]) || null;
  // The top 5 is local-only; cloud references (m.reference) get their own rows under a divider.
  const isRef = (m) => m.reference === true;
  const isLocal = (m) => !isRef(m) && LB.matchPlacement(m, "all");
  const localTime = (x) => (x.ts ? x.ts.t : Infinity);
  const cloudTime = (x) => (isNum(x.m.cloudTaskTime) ? x.m.cloudTaskTime : Infinity);

  /** Time stat for the sub line; also breaks ties (lower = faster). */
  function timeStat(m, key) {
    const ag = agentic(m, key);
    if (key === "repo_replay") return ag && isNum(ag.medianWallS) ? { t: ag.medianWallS, text: `median ${secInt(ag.medianWallS)} per fix` } : null;
    if (key === "debug") return ag && isNum(ag.medianTimeToFixS) ? { t: ag.medianTimeToFixS, text: `median ${secInt(ag.medianTimeToFixS)} to fix` } : null;
    if (key === "long_horizon") return ag && isNum(ag.medianWallMin) ? { t: ag.medianWallMin * 60, text: `${fmt.num(ag.medianWallMin, 1)} min per session` } : null;
    const t = m.suiteTimeS && m.suiteTimeS[key];
    return isNum(t) ? { t, text: `median ${secText(t)} per task` } : null;
  }

  /** Models passing `keep` with a score on `key`, best first; equal scores: lower `time` (faster) first. */
  function ranked(key, keep, time) {
    const out = [];
    for (const m of models()) {
      if (!keep(m)) continue;
      const v = LB.score(m, key);
      if (!isNum(v)) continue;
      out.push({ m, v, ts: timeStat(m, key) });
    }
    const core = (x) => (x.m.scores && isNum(x.m.scores.textCore) ? x.m.scores.textCore : -1);
    const name = (x) => String(LB.label(x.m) || "");
    out.sort((a, b) => r1(b.v) - r1(a.v) || time(a) - time(b) || core(b) - core(a) || name(a).localeCompare(name(b)));
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

  /** Hatched fill in the vendor colour: solid stripes over a light tint of the same colour. */
  function hatch(c) {
    const tint = /^#[0-9a-f]{6}$/i.test(c) ? c + "38" : "transparent";
    return `repeating-linear-gradient(-45deg, ${c} 0 2px, ${tint} 2px 5px)`;
  }

  function refsTip(title, refs) {
    const none = models().filter((m) => isRef(m) && !refs.some((x) => x.m === m)).map((m) => esc(LB.label(m)));
    return `<b>Cloud references · ${esc(title)}</b><br>` +
      refs.map((x) => `${esc(LB.label(x.m))} <b>${pctText(x.v)}</b>` + (x.ts ? ` <span class="muted">· ${esc(x.ts.text)}</span>` : "")).join("<br>") +
      (none.length ? `<br><span class="muted">No result yet: ${none.join(", ")}</span>` : "") +
      `<hr><span class="muted">Closed models run through GitHub Copilot on the same tasks and graders. Shown for comparison, not ranked.</span>`;
  }

  function refTip(x, title) {
    const m = x.m, core = m.scores && m.scores.textCore;
    return `<b>${esc(LB.fullName(m))}</b><br><span class="muted">${esc(LB.vendor(m).name)} · ${esc(m.where || "Cloud")}</span><hr>` +
      `${esc(title)}: <b>${pctText(x.v)}</b>` + (x.ts ? ` <span class="muted">· ${esc(x.ts.text)}</span>` : "") +
      (isNum(core) ? `<br>Text core <b>${fmt.pct(core)}</b>` : "") +
      (isNum(m.cloudTaskTime) ? `<br>Median ${fmt.num(m.cloudTaskTime, 1)} s per core task` : "") +
      (m.partial ? `<br><span class="muted">Partial run: scored on the tasks it finished.</span>` : "") +
      `<hr><span class="muted">Cloud reference: same tasks and graders, not ranked with the local models.</span>`;
  }

  /** A rank-style row for a cloud reference: "cloud" chip instead of a rank, hatched bar in the vendor colour. */
  function refRow(x, title) {
    const m = x.m, color = LB.vendor(m).color;
    const row = LB.rankRow(0, m, pctText(x.v), x.v / 100, [m.where || "Cloud (GitHub Copilot)",
      m.partial ? h("span", { class: "pt-partial", title: "Partial run: scored on the tasks it finished." }, "partial") : null]);
    row.classList.add("pt-ref-row");
    const rank = row.querySelector(".lb-rank");
    if (rank) rank.replaceWith(LB.chip("cloud", "pt-cloud"));
    const fill = row.querySelector(".lb-bar > i");
    if (fill) Object.assign(fill.style, { background: hatch(color), boxShadow: `inset 0 0 0 1px ${color}` });
    LB.tip.attach(row, () => refTip(x, title));
    return row;
  }

  /** "Cloud references" divider + the best two references (ties: faster cloudTaskTime first); null when none has a value. */
  function refBlock(key, title) {
    const refs = ranked(key, isRef, cloudTime);
    if (!refs.length) return null;
    const shown = refs.slice(0, REFS);
    const cut = shown.length === REFS ? r1(shown[REFS - 1].v) : null;
    const extra = cut === null ? [] : refs.slice(REFS).filter((x) => r1(x.v) === cut);
    const head = h("div", { class: "pt-refs-head" },
      h("span", { class: "pt-refs-k" }, "Cloud references"),
      h("span", { class: "pt-refs-line" }),
      extra.length ? h("span", { class: "pt-refs-more" }, `+${extra.length} more at ${pctText(cut)}`) : null);
    LB.tip.attach(head, () => refsTip(title, refs));
    return h("div", { class: "pt-refs" }, head, h("div", { class: "lb-list pt-refs-list" }, shown.map((x) => refRow(x, title))));
  }

  function taskCard(key, title) {
    const su = LB.suite(key) || { key, short: key, name: title };
    const rows = ranked(key, isLocal, localTime);
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
      more = h("div", { class: "pt-more" }, `+${tied.length} more at ${pctText(cut)}`);
      LB.tip.attach(more, () => `<b>Also at ${pctText(cut)}</b><br>` +
        tied.map((x) => `${esc(LB.label(x.m))}` + (x.ts ? ` <span class="muted">· ${esc(x.ts.text)}</span>` : "")).join("<br>"));
    }
    // Invisible stand-in for "+N more", shown only when the card beside it has one, so both reference dividers line up.
    const spacer = more ? null : h("div", { class: "pt-more pt-more-empty", "aria-hidden": "true", hidden: true }, "+0 more");

    const card = LB.card("pt-card",
      h("div", { class: "pt-head" }, h("h3", {}, "Best in " + title), chip),
      h("div", { class: "lb-list pt-list" }, list),
      more || spacer,
      refBlock(key, title));
    return { card, hasMore: !!more, spacer };
  }

  function render(el) {
    const cards = TASKS.map(([key, title]) => taskCard(key, title)).filter(Boolean);
    for (let i = 0; i + 1 < cards.length; i += 2) {
      const [a, b] = [cards[i], cards[i + 1]];
      if (a.hasMore !== b.hasMore) (a.spacer || b.spacer).hidden = false;
    }
    el.append(
      LB.sectionHead({ title: "Best models per task",
        sub: "Top 5 local models per task, with cloud references below. Every model answered the same questions." }),
      cards.length ? h("div", { class: "lb-grid-2 pt-grid" }, cards.map((c) => c.card)) : LB.card("lb-empty", "No per-task results yet."));
  }

  LB.register({ id: "per-task", order: 50, nav: "Per task", render });
})();
