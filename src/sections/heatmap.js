/* Task heatmap (#heatmap): a squarified treemap of which model leads each suite or speed metric, after the
   "LLM heatmap" on llmleaderboard.com. Tile colour = the leader's vendor, split diagonally when tied leaders come
   from two vendors. Click a tile for its full ranking. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, isNum, fmt } = LB;
  const D = LB.data || {};
  const MODELS = (D.models || []).filter((m) => m && typeof m === "object");

  const GAP = 6;            // px between tiles
  const EPS = 0.05 + 1e-9;  // values this close count as a tie
  const STACK_BELOW = 560;  // map width (px) under which the tiles become a stacked list
  const TARGET_L = 0.18;    // max relative luminance of a tile colour, so white text stays readable
  const DESAT = 0.18;       // pull tile colours slightly toward grey, for the reference's muted look

  const TABS = [
    { value: "daily", label: "Daily work" },
    { value: "coding", label: "Coding agents" },
    { value: "agents", label: "Agents & sessions" },
    { value: "all", label: "All tasks" },
    { value: "speed", label: "Speed" },
  ];

  // ---------- tile specs ----------
  /** Number at a path inside an object, or null. */
  function num(o, ...path) {
    for (const p of path) { if (o === null || o === undefined) return null; o = o[p]; }
    return isNum(o) ? o : null;
  }
  const secs = (v) => (isNum(v) ? v.toFixed(1) : "—");
  const SPEED = [
    { key: "speed:decode", name: "Decode speed", higher: true, unit: "tok/s", fmt: fmt.tps,
      desc: "Tokens per second on short prompts, with the model's speculative decoding on.", val: (m) => num(m, "speed", "decode") },
    { key: "speed:taskTime", name: "Time per task", higher: false, unit: "s", fmt: secs,
      desc: "Median wall time per core task, thinking included.", val: (m) => num(m, "speed", "taskTime") },
    { key: "speed:firstOutput", name: "First output", higher: false, unit: "s", fmt: secs,
      desc: "Time until a task's first visible output, after any thinking.", val: (m) => num(m, "speed", "firstOutput") },
    { key: "speed:prefill32k", name: "Prefill at 32K", higher: true, unit: "tok/s", fmt: fmt.tps,
      desc: "Prompt processing speed on a 32K-token prompt.", val: (m) => num(m, "speed", "prefill", "32k") },
    { key: "speed:decode117k", name: "Decode at 117K context", higher: true, unit: "tok/s", fmt: fmt.tps,
      desc: "Generation speed with 117K tokens already in context.", val: (m) => num(m, "speed", "decodeAt", "117k") },
  ];

  // Tile area follows suite.tasks, square-root dampened so no tile gets tiny. Only when a suite has no count: agentic
  // suites use the task / session counts in the models' agentic blocks, core suites core.perSuite.
  const AGENTIC_UNIT = { repo_replay: "tasks", debug: "tasks", long_horizon: "sessions" };
  const TASKS_FALLBACK = { repo_replay: 9, debug: 10, long_horizon: 3 };
  function taskCount(su) {
    const own = num(su, "tasks");
    if (own !== null && own > 0) return own;
    const unit = AGENTIC_UNIT[su.key];
    if (unit) {
      let n = 0;
      for (const m of MODELS) { const v = num(m, "agentic", su.key, unit); if (v !== null) n = Math.max(n, v); }
      if (n > 0) return n;
    }
    if (TASKS_FALLBACK[su.key]) return TASKS_FALLBACK[su.key];
    const per = num(D, "core", "perSuite");
    return per && per > 0 ? per : 6;
  }
  const pctShort = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
  function suiteSpec(su) {
    return { key: su.key, name: su.name || su.short || su.key, desc: su.desc || "", higher: true, unit: "%",
      weight: Math.sqrt(taskCount(su)), fmt: (v) => fmt.pct(v), short: pctShort, val: (m) => LB.score(m, su.key) };
  }
  /** Tile specs for a tab, biggest first (stable, so equal tiles keep the data order). */
  function specsFor(tab) {
    if (tab === "speed") return SPEED.map((x) => Object.assign({ weight: 1, short: x.fmt }, x));
    return (D.suites || []).filter((su) => su && su.key && (tab === "all" || su.group === tab)).map(suiteSpec)
      .sort((a, b) => b.weight - a.weight);
  }
  const withUnit = (t, txt) => (t.unit === "%" ? txt + "%" : txt + " " + t.unit);

  // ---------- ranking ----------
  const tcOf = (m) => num(m, "scores", "textCore") ?? -1;
  const nameOf = (m) => LB.label(m) || m.name || m.id || "?";
  /** Models with a value for this tile (placement filter applied), best first; ties broken by text core. */
  function rankTile(spec, filter) {
    const rows = [];
    for (const m of MODELS) {
      if (!LB.matchPlacement(m, filter)) continue;
      let v = null;
      try { v = spec.val(m); } catch (e) { v = null; }
      if (isNum(v)) rows.push({ m, v });
    }
    rows.sort((a, b) => (Math.abs(a.v - b.v) > EPS ? (spec.higher ? b.v - a.v : a.v - b.v)
      : tcOf(b.m) - tcOf(a.m) || nameOf(a.m).localeCompare(nameOf(b.m))));
    let start = 0;
    rows.forEach((r, i) => { if (Math.abs(r.v - rows[start].v) > EPS) start = i; r.rank = start; });
    const leaders = rows.filter((r) => r.rank === 0);
    const vendors = [];
    for (const r of leaders) if (!vendors.includes(r.m.vendor)) vendors.push(r.m.vendor);
    return Object.assign({}, spec, { rows, leaders, vendors });
  }

  // ---------- treemap layout ----------
  /** Classic squarify (Bruls et al.): fill strips along the shorter side while the worst aspect ratio improves. */
  function squarify(areas, W, H) {
    const out = new Array(areas.length);
    const worst = (sum, mx, mn, side) => Math.max((side * side * mx) / (sum * sum), (sum * sum) / (side * side * mn));
    let x = 0, y = 0, w = W, hh = H, i = 0;
    while (i < areas.length) {
      const side = Math.min(w, hh);
      let j = i, sum = 0, mx = 0, mn = Infinity, prev = Infinity;
      while (j < areas.length) {
        const ns = sum + areas[j], nmx = Math.max(mx, areas[j]), nmn = Math.min(mn, areas[j]);
        const r = worst(ns, nmx, nmn, side);
        if (j > i && r > prev) break;
        sum = ns; mx = nmx; mn = nmn; prev = r; j++;
      }
      const col = w >= hh;
      const t = placeStrip(out, areas, i, j - 1, x, y, w, hh, col, j >= areas.length);
      if (col) { x += t; w -= t; } else { y += t; hh -= t; }
      i = j;
    }
    return out;
  }
  /** Lay items i..j as a column on the left (col) or a row on top of the rect; returns the strip thickness. */
  function placeStrip(out, areas, i, j, x, y, w, hh, col, last) {
    let sum = 0;
    for (let k = i; k <= j; k++) sum += areas[k];
    if (col) {
      const cw = last ? w : sum / hh;
      let yy = y;
      for (let k = i; k <= j; k++) { const th = k === j ? y + hh - yy : areas[k] / cw; out[k] = { x, y: yy, w: cw, h: th }; yy += th; }
      return cw;
    }
    const rh = last ? hh : sum / w;
    let xx = x;
    for (let k = i; k <= j; k++) { const tw = k === j ? x + w - xx : areas[k] / rh; out[k] = { x: xx, y, w: tw, h: rh }; xx += tw; }
    return rh;
  }
  /** Penalty for a tile shape: squarer is better; tiles too small for a title and a name cost extra. The first
     (biggest, default-selected) tile counts a bit more, which also settles ties between mirror-image layouts. */
  function tileCost(w, hh, k) {
    const tw = w - GAP, th = hh - GAP;
    if (tw < 2 || th < 2) return 1e6;
    const r = tw > th ? tw / th : th / tw;
    return ((r - 1) * (r - 1) + (tw < 128 || th < 96 ? 8 : 0)) * (k === 0 ? 1.5 : 1);
  }
  const layoutCost = (rects) => rects.reduce((c, r, k) => c + tileCost(r.w, r.h, k), 0);
  /** Squarified strips, refined: with few tiles, try every split into ordered strips (column or row, either side) and
     keep the squarest. Biggest tiles stay at the top left. Starts from the squarify layout, so it never does worse. */
  function stripSearch(areas, W, H, seed) {
    const n = areas.length;
    let best = seed, bestCost = layoutCost(seed), budget = 250000;
    const cur = new Array(n), tmp = new Array(n);
    (function rec(i, x, y, w, hh, cost) {
      if (i === n) { if (cost < bestCost) { bestCost = cost; best = cur.slice(); } return; }
      let sum = 0;
      for (let j = i; j < n; j++) {
        sum += areas[j];
        const last = j === n - 1;
        for (let o = 0; o < 2; o++) {
          if (--budget < 0) return;
          const col = o === 0;
          const t = placeStrip(tmp, areas, i, j, x, y, w, hh, col, last);
          let c = cost;
          for (let k = i; k <= j && c < bestCost; k++) c += tileCost(tmp[k].w, tmp[k].h, k);
          if (c >= bestCost) continue;
          for (let k = i; k <= j; k++) cur[k] = tmp[k];
          if (col) rec(j + 1, x + t, y, w - t, hh, c);
          else rec(j + 1, x, y + t, w, hh - t, c);
        }
      }
    })(0, 0, 0, W, H, 0);
    return best;
  }
  /** Pixel rects (left, top, width, height) for tiles of these weights in a W x H box with GAP px between tiles. */
  function treemap(weights, W, H) {
    const n = weights.length;
    if (!n) return [];
    const tot = weights.reduce((a, b) => a + (b > 0 ? b : 0), 0) || 1;
    const OW = W + GAP, OH = H + GAP; // lay out on a box one gap larger, then trim one gap off every tile
    const areas = weights.map((wt) => ((wt > 0 ? wt : 0) / tot) * OW * OH || 1);
    let rects = squarify(areas, OW, OH);
    if (n <= 14) rects = stripSearch(areas, OW, OH, rects);
    return rects.map((r) => {
      const x0 = Math.round(r.x), y0 = Math.round(r.y), x1 = Math.round(r.x + r.w), y1 = Math.round(r.y + r.h);
      return { x: x0, y: y0, w: Math.max(0, x1 - x0 - GAP), h: Math.max(0, y1 - y0 - GAP) };
    });
  }
  const mapHeight = (W) => (W >= 900 ? 620 : Math.round(Math.max(460, Math.min(620, W * 0.8))));
  const sizeOf = (r) => (!r ? "st" : r.w >= 220 && r.h >= 170 ? "l" : r.w >= 150 && r.h >= 120 ? "m" : "s");
  const NARROW = 190;       // tiles narrower than this put the badges above the leader's name

  // ---------- colours ----------
  function rgbOf(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return [100, 116, 139];
    const x = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  }
  const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const toSrgb = (l) => { const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); };
  const toneCache = {};
  /** [top-left, bottom-right] tile colours for a vendor colour: dimmed in linear light until white text reads well and
     slightly muted, then a 12% darker shade for the soft diagonal gradient. */
  function tone(hex) {
    if (toneCache[hex]) return toneCache[hex];
    const l = rgbOf(hex).map(toLin);
    const L = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    const f = L > TARGET_L ? TARGET_L / L : 1;
    const Y = L * f;
    const a = l.map((c) => toSrgb(c * f + (Y - c * f) * DESAT));
    const b = a.map((c) => Math.round(c * 0.88));
    return (toneCache[hex] = [`rgb(${a.join(",")})`, `rgb(${b.join(",")})`]);
  }
  function tileBackground(t) {
    const a = tone(LB.vendor(t.vendors[0]).color);
    if (t.vendors.length < 2) return `linear-gradient(160deg, ${a[0]}, ${a[1]})`;
    const b = tone(LB.vendor(t.vendors[1]).color);
    // "to bottom right" puts the 50% line exactly on the top-right / bottom-left diagonal
    return `linear-gradient(to bottom right, ${a[0]} 0%, ${a[1]} calc(50% - .5px), ${b[0]} calc(50% + .5px), ${b[1]} 100%)`;
  }

  // ---------- small builders ----------
  const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const arrow = () => s("svg", { class: "hm-arrow", width: 10, height: 10, viewBox: "0 0 10 10", "aria-hidden": "true" },
    s("path", { d: "M2.5 7.5l5-5M3.6 2.5h3.9v3.9", fill: "none", stroke: "currentColor", "stroke-width": 1.3, "stroke-linecap": "round", "stroke-linejoin": "round" }));
  function badge(vk) {
    const v = LB.vendor(vk);
    const letter = String(v.letter || "?");
    return h("span", { class: ["hm-badge", letter.length > 1 && "hm-badge-2"], style: { color: v.color }, title: v.name }, letter);
  }
  function leadSub(t) {
    const lead = t.leaders[0], tied = t.leaders.length - 1;
    return [withUnit(t, t.short(lead.v)), tied > 0 ? `+${tied} tied` : null, lead.m.partial ? "partial" : null].filter(Boolean).join(" · ");
  }
  function ariaLabel(t) {
    if (!t.rows.length) return `${t.name}: no runs yet. Select for details.`;
    const lead = t.leaders[0], tied = t.leaders.length - 1;
    return `${t.name}: led by ${lead.m.name ? LB.fullName(lead.m) : nameOf(lead.m)}, ${withUnit(t, t.short(lead.v))}` +
      (tied > 0 ? `, tied with ${tied} more` : "") + ". Select for the full ranking.";
  }
  function tipHtml(t) {
    const dir = t.higher ? "Higher is better" : "Lower is better";
    if (!t.rows.length) return `<b>${esc(t.name)}</b><br><span class="muted">No runs yet under this filter.</span>`;
    const top = t.rows.slice(0, 3).map((r) =>
      `<div class="hm-tip-row"><span class="hm-tip-rk${r.rank === 0 ? " first" : ""}">${String(r.rank + 1).padStart(2, "0")}</span>` +
      `<i style="background:${esc(LB.vendor(r.m).color)}"></i><span class="hm-tip-nm">${esc(nameOf(r.m))}` +
      `${r.m.partial ? ' <span class="muted">partial</span>' : ""}</span><b>${esc(withUnit(t, t.fmt(r.v)))}</b></div>`).join("");
    const n = t.rows.length;
    return `<b>${esc(t.name)}</b><hr>${top}<hr><span class="muted">${n} model${n === 1 ? "" : "s"} · ${dir}` +
      `${n > 3 ? " · click for all" : ""}</span>`;
  }

  // ---------- section ----------
  function render(el) {
    const state = { filter: "all", tab: TABS[0].value, sel: null, all: false };
    let tiles = [], lastW = -1, stacked = false;

    const map = h("div", { class: "hm-map", role: "group", "aria-label": "Task heatmap: one tile per task suite" });
    const count = h("span", { class: "hm-count" });
    const detail = h("div", { class: "hm-detail" });
    const live = h("div", { class: "hm-sr", "aria-live": "polite" });
    const seg = LB.seg(LB.PLACEMENTS, state.filter, (v) => { state.filter = v; refresh(); });
    const tabs = LB.tabs(TABS, state.tab, (v) => { state.tab = v; state.sel = null; refresh(); });

    const head = LB.sectionHead({ title: "Task heatmap", sub: "See which model leads each task on this machine.", right: [seg] });
    el.append(head, LB.card("hm-card", h("div", { class: "hm-bar" }, tabs, count), map, detail, live));

    function refresh() {
      tiles = specsFor(state.tab).map((sp) => rankTile(sp, state.filter));
      if (!tiles.some((t) => t.key === state.sel)) state.sel = tiles.length ? tiles[0].key : null;
      state.all = false;
      count.textContent = `${tiles.length} ${state.tab === "speed" ? "metric" : "suite"}${tiles.length === 1 ? "" : "s"}`;
      layout(true);
    }

    function select(key) {
      if (key === state.sel) {
        if (!stacked) return;
        state.sel = null; // in the stacked list a second tap folds the ranking away
      } else state.sel = key;
      state.all = false;
      for (const b of map.querySelectorAll(".hm-tile")) {
        const on = b.dataset.key === state.sel;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      }
      renderDetail();
      const t = tiles.find((x) => x.key === state.sel);
      live.textContent = t ? ariaLabel(t).replace(/ Select.*$/, "") : "";
    }

    function tileEl(t, r) {
      const size = sizeOf(r);
      const empty = !t.rows.length;
      const on = t.key === state.sel;
      const style = r ? { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" } : {};
      if (!empty) style.background = tileBackground(t);
      const lead = empty ? null : t.leaders[0];
      const btn = h("button", {
        type: "button", class: ["hm-tile", "hm-" + size, r && r.w < NARROW && "hm-narrow", empty && "hm-empty", on && "on"], style,
        "data-key": t.key, "aria-pressed": String(on), "aria-label": ariaLabel(t), onclick: () => select(t.key),
      },
      h("span", { class: "hm-tile-top" }, h("span", { class: "hm-tile-name" }, t.name), arrow()),
      empty ? h("span", { class: "hm-lead" }, h("span", { class: "hm-none" }, "No runs yet"))
        : h("span", { class: "hm-lead" },
          h("span", { class: "hm-badges" }, t.vendors.slice(0, 2).map(badge)),
          h("span", { class: "hm-lead-txt" },
            h("span", { class: "hm-lead-name" }, nameOf(lead.m)),
            h("span", { class: "hm-lead-sub" }, leadSub(t)))));
      return LB.tip.attach(btn, () => tipHtml(t));
    }

    function layout(force) {
      const W = Math.floor(map.clientWidth);
      if (!force && W === lastW) return;
      lastW = W;
      LB.tip.hide();
      map.textContent = "";
      stacked = W > 0 && W < STACK_BELOW;
      map.classList.toggle("hm-stack", stacked);
      if (!stacked && !state.sel && tiles.length) state.sel = tiles[0].key;
      if (stacked) {
        map.style.height = "";
        for (const t of tiles) map.appendChild(tileEl(t, null));
      } else {
        const width = W > 0 ? W : 1080, height = tiles.length ? mapHeight(width) : 0;
        map.style.height = height + "px";
        const rects = treemap(tiles.map((t) => t.weight), width, height);
        tiles.forEach((t, i) => map.appendChild(tileEl(t, rects[i])));
      }
      renderDetail();
    }

    /** Desktop: the detail sits under the treemap. Stacked list: it opens right under the selected tile. */
    function renderDetail() {
      detail.textContent = "";
      const t = tiles.find((x) => x.key === state.sel);
      if (!t) {
        if (stacked) { detail.remove(); return; }
        detail.appendChild(h("div", { class: "lb-empty" }, "No tasks in this view yet."));
      } else {
        const lead = t.leaders[0], tied = t.leaders.length - 1, n = t.rows.length;
        const leadLink = lead ? h("a", { class: "hm-dlink", href: "#models" }, nameOf(lead.m)) : null;
        if (leadLink) LB.tip.attach(leadLink, () => LB.modelTip(lead.m));
        detail.append(
          h("div", { class: "hm-dhead" },
            h("div", { class: "hm-dl" }, h("div", { class: "hm-dname" }, t.name), t.desc ? h("div", { class: "hm-ddesc" }, t.desc) : null),
            h("div", { class: "hm-dr" },
              h("div", { class: "hm-dlead" }, lead ? [leadLink, tied > 0 ? h("span", { class: "hm-dtied" }, `+${tied} tied`) : null]
                : h("span", { class: "hm-dnone" }, "No runs yet")),
              h("div", { class: "hm-dmeta" }, `${n} model${n === 1 ? "" : "s"} · ${t.higher ? "Higher" : "Lower"} is better`))),
          ...ranking(t).filter(Boolean));
      }
      const tile = stacked && t ? [...map.querySelectorAll(".hm-tile")].find((b) => b.dataset.key === t.key) : null;
      if (tile) tile.after(detail);
      else if (detail.previousElementSibling !== map) map.after(detail);
    }

    function ranking(t) {
      if (!t.rows.length) return [h("div", { class: "lb-empty hm-noruns" }, "No model in this placement has a result here yet.")];
      // bar = value / largest ranked value in both directions, so for lower-is-better the fastest gets the shortest bar
      const max = Math.max(...t.rows.map((r) => r.v));
      const shown = stacked && !state.all ? t.rows.slice(0, 5) : t.rows;
      const rows = shown.map((r) => {
        const frac = max > 0 ? r.v / max : 0;
        const sub = [r.m.where, r.m.partial ? "partial" : null].filter(Boolean).join(" · ");
        return LB.tip.attach(LB.rankRow(r.rank, r.m, t.fmt(r.v), frac, sub, t.unit), () => LB.modelTip(r.m));
      });
      const half = stacked ? rows.length : Math.ceil(rows.length / 2);
      return [
        h("div", { class: "hm-rank" },
          h("div", { class: "lb-list" }, rows.slice(0, half)),
          rows.length > half ? h("div", { class: "lb-list" }, rows.slice(half)) : null),
        stacked && t.rows.length > 5 ? h("button", { type: "button", class: "hm-more", "aria-expanded": String(state.all),
          onclick: () => { state.all = !state.all; renderDetail(); const b = detail.querySelector(".hm-more"); if (b) b.focus(); } },
        state.all ? "Show top 5" : `Show all ${t.rows.length} models`) : null,
      ];
    }

    refresh();
    LB.onResize(() => layout());
    if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(map);
  }

  LB.register({ id: "heatmap", order: 40, nav: "Heatmap", render });
})();
