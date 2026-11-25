/* Local LLM leaderboard - shared runtime. Sections register themselves with LB.register({...}) and use these helpers. */
(function () {
  "use strict";
  const D = window.LB_DATA || { models: [], suites: [], vendors: {} };
  const SVGNS = "http://www.w3.org/2000/svg";

  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k === null || k === undefined || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }
  function setAttrs(el, attrs, isSvg) {
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.setAttribute("class", Array.isArray(v) ? v.filter(Boolean).join(" ") : v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "html") el.innerHTML = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    return el;
  }
  /** HTML element: LB.h('div', {class:'x', onclick: fn, style:{...}}, child, 'text', [more]) */
  function h(tag, attrs, ...kids) {
    if (attrs instanceof Node || typeof attrs !== "object" || Array.isArray(attrs)) { kids.unshift(attrs); attrs = {}; }
    const el = setAttrs(document.createElement(tag), attrs);
    append(el, kids);
    return el;
  }
  /** SVG element: LB.s('rect', {x:0, y:0, width:10, height:10, fill:'red'}) */
  function s(tag, attrs, ...kids) {
    if (attrs instanceof Node || typeof attrs !== "object" || Array.isArray(attrs)) { kids.unshift(attrs); attrs = {}; }
    const el = setAttrs(document.createElementNS(SVGNS, tag), attrs, true);
    append(el, kids);
    return el;
  }

  const isNum = (v) => typeof v === "number" && isFinite(v);
  const fmt = {
    num: (v, d = 1) => (isNum(v) ? v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—"),
    int: (v) => (isNum(v) ? Math.round(v).toLocaleString("en-US") : "—"),
    pct: (v, d = 1) => (isNum(v) ? v.toFixed(d) : "—"),           // scores are already 0-100
    sec: (v, d = 1) => (isNum(v) ? v.toFixed(d) + " s" : "—"),
    tps: (v) => (isNum(v) ? (v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1)) : "—"),
    gb: (v, d = 1) => (isNum(v) ? v.toFixed(d) + " GB" : "—"),
  };

  const PLACEMENTS = [
    { value: "all", label: "Compare all" },
    { value: "1gpu", label: "Single GPU" },
    { value: "2gpu", label: "Both GPUs" },
    { value: "offload", label: "GPU + RAM / SSD" },
  ];
  const PLACEMENT_LABEL = { "1gpu": "Single GPU", "2gpu": "Both GPUs", hybrid: "GPUs + RAM", stream: "GPUs + RAM + SSD", cpu: "CPU only" };
  function matchPlacement(m, f) {
    if (!f || f === "all") return true;
    if (f === "offload") return m.placement === "hybrid" || m.placement === "stream" || m.placement === "cpu";
    return m.placement === f;
  }

  function vendor(m) {
    const key = typeof m === "string" ? m : m && m.vendor;
    const v = D.vendors[key] || { name: key || "?", color: "#94a3b8", letter: "?" };
    return Object.assign({ key }, v);
  }
  /** Round vendor badge (stands in for a logo). opts.solid = filled with the vendor colour. */
  function mono(m, size = 28, opts = {}) {
    const v = vendor(m);
    const fs = Math.round(size * (v.letter.length > 1 ? 0.36 : 0.46));
    return h("span", {
      class: ["lb-mono", opts.solid && "solid"], title: v.name,
      style: { width: size + "px", height: size + "px", fontSize: fs + "px", color: v.color, background: opts.solid ? v.color : undefined },
    }, v.letter);
  }

  const byId = (id) => D.models.find((m) => m.id === id);
  const label = (m) => m.short || m.name;
  const fullName = (m) => m.name + (m.variant ? " · " + m.variant : "");
  /** Models with quality scores, best text core first. */
  function quality(filter) {
    return D.models.filter((m) => m.scores && isNum(m.scores.textCore) && matchPlacement(m, filter))
      .sort((a, b) => b.scores.textCore - a.scores.textCore);
  }
  function suite(key) { return D.suites.find((x) => x.key === key); }
  /** Score of a model on a suite key (core suites, or repo_replay / debug / long_horizon). 0-100 or null. */
  function score(m, key) {
    if (!m.scores) return null;
    if (key === "textCore" || key === "allSuites") return m.scores[key];
    if (m.scores.suites && key in m.scores.suites) return m.scores.suites[key];
    return isNum(m.scores[key]) ? m.scores[key] : null;
  }

  function seg(options, value, onChange) {
    const el = h("div", { class: "lb-seg", role: "tablist" });
    const draw = () => {
      el.textContent = "";
      for (const o of options) {
        el.appendChild(h("button", { class: o.value === value ? "on" : "", role: "tab", "aria-selected": String(o.value === value),
          onclick: () => { if (o.value !== value) { value = o.value; draw(); onChange(value); } } }, o.label));
      }
    };
    draw();
    return el;
  }
  function tabs(options, value, onChange) {
    const el = h("div", { class: "lb-tabs", role: "tablist" });
    const draw = () => {
      el.textContent = "";
      for (const o of options) {
        el.appendChild(h("button", { class: o.value === value ? "on" : "", role: "tab",
          onclick: () => { if (o.value !== value) { value = o.value; draw(); onChange(value); } } }, o.label));
      }
    };
    draw();
    return el;
  }
  function select(options, value, onChange) {
    const sel = h("select", { onchange: (e) => onChange(e.target.value) },
      options.map((o) => h("option", { value: o.value, selected: o.value === value }, o.label)));
    return h("label", { class: "lb-select" }, sel);
  }
  /** Standard section header: title, subtitle, optional controls on the right. */
  function sectionHead({ title, sub, right }) {
    return h("div", { class: "lb-sec-head" },
      h("div", {}, h("h2", {}, title), sub ? h("p", {}, sub) : null),
      right ? h("div", { class: "lb-sec-right" }, right) : null);
  }
  function card(cls, ...kids) { return h("div", { class: ["lb-card", cls] }, ...kids); }
  function rank(i) { return h("span", { class: ["lb-rank", i === 0 && "first"] }, String(i + 1).padStart(2, "0")); }
  function bar(frac, color) {
    const f = Math.max(0, Math.min(1, isNum(frac) ? frac : 0));
    return h("div", { class: "lb-bar" }, h("i", { style: { width: (f * 100).toFixed(1) + "%", background: color } }));
  }
  function chip(text, cls) { return h("span", { class: ["lb-chip", cls] }, text); }

  /** Ranked list row (rank, badge, name, value, sub line, bar) - the "Best in X" / "Fastest" pattern. */
  function rankRow(i, m, valueText, frac, sub, unit) {
    return h("div", { class: "lb-row" },
      rank(i), mono(m, 26),
      h("div", { class: "lb-row-name", title: fullName(m) }, label(m)),
      h("div", { class: "lb-row-val" }, valueText, unit ? h("small", {}, unit) : null),
      sub ? h("div", { class: "lb-row-sub" }, sub) : null,
      bar(frac, vendor(m).color));
  }

  // tooltip
  let tipEl = null;
  const tip = {
    show(evt, html) {
      tipEl = tipEl || document.getElementById("lb-tip");
      if (!tipEl) return;
      tipEl.innerHTML = html;
      tipEl.hidden = false;
      tip.move(evt);
    },
    move(evt) {
      if (!tipEl || tipEl.hidden) return;
      const pad = 14, w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
      let x = evt.clientX + pad, y = evt.clientY + pad;
      if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;
      if (y + hgt > window.innerHeight - 8) y = evt.clientY - hgt - pad;
      tipEl.style.left = x + "px";
      tipEl.style.top = y + "px";
    },
    hide() { if (tipEl) tipEl.hidden = true; },
    /** Attach show/move/hide to an element; html can be a string or () => string. */
    attach(el, html) {
      el.addEventListener("mouseenter", (e) => tip.show(e, typeof html === "function" ? html() : html));
      el.addEventListener("mousemove", tip.move);
      el.addEventListener("mouseleave", tip.hide);
      return el;
    },
  };
  /** Standard tooltip body for a model. */
  function modelTip(m, extra) {
    const s = m.scores || {};
    const ci = s.textCoreCI ? ` <span class="muted">[${fmt.pct(s.textCoreCI[0], 0)}–${fmt.pct(s.textCoreCI[1], 0)}]</span>` : "";
    return `<b>${fullName(m)}</b><br><span class="muted">${vendor(m).name} · ${m.params} · ${m.quant} · ${m.where}</span>` +
      (isNum(s.textCore) ? `<hr>Text core <b>${fmt.pct(s.textCore)}</b>${ci}` : "") +
      (m.speed && isNum(m.speed.decode) ? `<br>Decode <b>${fmt.tps(m.speed.decode)}</b> tok/s` : "") +
      (m.partial ? `<br><span class="muted">Partial run: scored on the tasks it finished.</span>` : "") +
      (extra ? `<hr>${extra}` : "");
  }

  let resizeFns = [], resizeT = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => resizeFns.forEach((f) => f()), 120); });
  function onResize(fn) { resizeFns.push(fn); }

  const sections = [];
  function register(sec) { sections.push(sec); }

  const LB = (window.LB = {
    data: D, h, s, fmt, isNum, PLACEMENTS, PLACEMENT_LABEL, matchPlacement, vendor, mono, byId, label, fullName, quality,
    suite, score, seg, tabs, select, sectionHead, card, rank, bar, chip, rankRow, tip, modelTip, onResize, register, sections,
    openCompare: function () { const el = document.getElementById("compare"); if (el) el.scrollIntoView(); },
  });

  // ---------- page chrome (announcement, header, hero, footer) ----------
  function logo() {
    return h("a", { class: "lb-logo", href: "#top" },
      h("span", { class: "lb-logo-mark" }, s("svg", { width: 18, height: 18, viewBox: "0 0 18 18" },
        s("rect", { x: 2, y: 9, width: 3.2, height: 7, rx: 1, fill: "#d6ff62" }),
        s("rect", { x: 7.4, y: 5, width: 3.2, height: 11, rx: 1, fill: "#d6ff62" }),
        s("rect", { x: 12.8, y: 2, width: 3.2, height: 14, rx: 1, fill: "#d6ff62" }))),
      "localrank", h("small", {}, "· LLMs on one workstation"));
  }
  function renderChrome(navSecs) {
    const pick = byId((D.verdict || {}).pick);
    const newest = D.models.filter((m) => !m.speedOnly).length;
    const ann = document.getElementById("lb-announce");
    if (ann) {
      const inProg = D.models.filter((m) => m.status && m.status !== "done").length;
      ann.className = "lb-announce";
      ann.append(h("b", {}, "New: "), `${newest} models benchmarked on one workstation; ${inProg} giant-model runs in progress.`,
        h("a", { href: "#in-progress" }, "See what's running ↗"));
    }
    const head = document.getElementById("lb-header");
    if (head) {
      head.className = "lb-header";
      const nav = h("nav", { class: "lb-nav", "aria-label": "Sections" }, navSecs.map((x) => h("a", { href: "#" + x.id }, x.nav)));
      const menu = h("div", { class: "lb-more-menu", role: "menu", hidden: true });
      const moreBtn = h("button", { class: "lb-more-btn", type: "button", "aria-haspopup": "true", "aria-expanded": "false" }, "More");
      const more = h("div", { class: "lb-more", hidden: true }, moreBtn, menu);
      const setOpen = (open) => { menu.hidden = !open; moreBtn.setAttribute("aria-expanded", String(open)); };
      moreBtn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(menu.hidden); });
      menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
      document.addEventListener("click", (e) => { if (!more.contains(e.target)) setOpen(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { setOpen(false); moreBtn.focus(); } });
      // Priority+ navigation: links that don't fit move into the "More" menu (all of them on phones, where the bar is hidden).
      const fitNav = () => {
        const links = [...nav.children];
        links.forEach((a) => { a.hidden = false; });
        menu.replaceChildren();
        more.hidden = true;
        const collapsed = getComputedStyle(nav).display === "none";
        if (!collapsed && nav.scrollWidth <= nav.clientWidth + 1) return;
        more.hidden = false;
        moreBtn.textContent = collapsed ? "Menu" : "More";
        const moved = [];
        for (let i = links.length - 1; i >= 0 && (collapsed || nav.scrollWidth > nav.clientWidth + 1); i--) {
          links[i].hidden = true;
          moved.unshift(links[i]);
        }
        menu.append(...moved.map((a) => h("a", { href: a.getAttribute("href"), role: "menuitem" }, a.textContent)));
      };
      head.append(h("div", { class: "lb-wrap" }, logo(), nav, more,
        h("button", { class: "lb-btn-dark", onclick: () => LB.openCompare() },
          s("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": 1.6 },
            s("path", { d: "M2 5h11M10 2l3 3-3 3M14 11H3M6 8l-3 3 3 3" })), h("span", {}, "Compare models"))));
      fitNav();
      onResize(fitNav);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNav);
    }
    const hero = h("section", { class: "lb-wrap lb-hero", id: "top" },
      h("div", {},
        h("h1", {}, "Local LLM leaderboard", h("br"), h("span", {}, "for one workstation")),
        h("p", {}, `Every model here ran on the same PC — an RTX PRO 6000 (96 GB) plus an RTX 5090 (32 GB), a Ryzen 9 9950X3D2 and ` +
          `128 GB of RAM — through the same ${D.core ? D.core.tasks : ""} tasks built from real daily work: tool calls, Chinese requests, ` +
          `statement extraction, TypeScript, finance math, vision, browser agents, repo QA, plus real-repo bug fixes, debugging and long sessions.`),
        h("div", { class: "lb-meta" },
          h("span", {}, "Updated: ", h("b", {}, new Date(D.generated || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))),
          h("span", {}, h("b", {}, String(newest)), " models scored"),
          h("span", {}, h("b", {}, fmt.int(D.core && D.core.gradedRuns)), " graded runs"),
          h("span", {}, "Engine: ", h("b", {}, "llama.cpp")))),
      pick ? card("lb-pick",
        h("span", { class: "lb-pick-tag" }, "★ Our pick"),
        h("h3", {}, mono(pick, 30), fullName(pick)),
        h("div", { class: "lb-pick-sub" }, `${pick.params} · ${pick.quant} · ${pick.where}`),
        h("div", { class: "lb-pick-stats" },
          h("div", {}, h("b", {}, fmt.pct(pick.scores.textCore)), h("span", {}, "text core")),
          h("div", {}, h("b", {}, fmt.tps(pick.speed && pick.speed.decode)), h("span", {}, "tok/s decode")),
          h("div", {}, h("b", {}, fmt.num(pick.speed && pick.speed.taskTime, 1) + " s"), h("span", {}, "per task"))),
        h("p", {}, D.verdict.en), h("p", { class: "zh", lang: "zh" }, D.verdict.zh)) : null);
    const main = document.getElementById("lb-main");
    main.before(hero);
    const foot = document.getElementById("lb-footer");
    if (foot) {
      foot.className = "lb-footer";
      const repo = (D.site || {}).repo;
      foot.append(h("div", { class: "lb-wrap" },
        h("div", { class: "lb-foot-grid" },
          h("div", {}, logo(), h("p", {}, "An independent, reproducible benchmark of open-weight LLMs on one workstation. " +
            "Scores are graded by code (tests, exact answers, JSON matching), not by a judge model.")),
          h("div", {}, h("h4", {}, "Leaderboard"), navSecs.slice(0, 5).map((x) => h("a", { href: "#" + x.id }, x.nav))),
          h("div", {}, h("h4", {}, "Explore"), navSecs.slice(5).map((x) => h("a", { href: "#" + x.id }, x.nav))),
          h("div", {}, h("h4", {}, "Data"),
            h("a", { href: "data/leaderboard.json" }, "Rankings as JSON ↗"),
            repo ? h("a", { href: repo }, "Source on GitHub ↗") : null,
            h("a", { href: "#methodology" }, "Methodology"))),
        h("div", { class: "lb-foot-bottom" },
          h("span", {}, "Hardware: ", h("b", {}, "RTX PRO 6000 + RTX 5090 · Ryzen 9 9950X3D2 · 128 GB")),
          h("span", {}, D.hardware ? D.hardware.engine : ""),
          h("span", {}, "Updated: " + (D.generated || "").replace("T", " ").replace(/Z$/, " UTC")))));
    }
  }

  function boot() {
    const only = new URLSearchParams(location.search).get("only");
    const secs = sections.slice().sort((a, b) => (a.order || 50) - (b.order || 50));
    const navSecs = secs.filter((x) => x.nav);
    if (!only) renderChrome(navSecs);
    const main = document.getElementById("lb-main");
    for (const sec of secs) {
      if (only && sec.id !== only) continue;
      const el = h("section", { class: "lb-section lb-wrap", id: sec.id });
      main.appendChild(el);
      try { sec.render(el); }
      catch (err) {
        console.error("section " + sec.id + " failed", err);
        el.appendChild(h("div", { class: "lb-card lb-empty" }, `Section "${sec.id}" failed to render: ${err.message}`));
      }
    }
    document.body.dataset.ready = "1";
  }
  LB.boot = boot;
})();
