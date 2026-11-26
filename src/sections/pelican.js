/* Pelican on a bicycle (data: D.pelican): every model got the same prompt for an animated SVG and three tries, and every
   try is shown. Model-made SVG only ever goes on the page through <img src>, where it can't run scripts or load anything. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, fmt, isNum } = LB;
  const D = LB.data || {};
  const CREDIT_URL = "https://simonwillison.net/tags/pelican-riding-a-bicycle/";
  const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  let per = 3, promptText = ""; // tries per model and the prompt, set by render()

  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const objs = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
  const num = (v) => (isNum(v) ? v : null);
  const say = (n) => WORDS[n] || String(n);
  const count = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;
  const secs = (v) => (v >= 100 ? fmt.int(v) : fmt.num(v, 1)) + " s";
  const icon = (d, size = 16) => s("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor",
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d }));
  const infoIcon = () => icon("M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM8 7.4v3.8M8 5.1v.1", 14);
  const closeIcon = () => icon("M4 4l8 8M12 4l-8 8");
  const zoomIcon = () => icon("M9.6 2.6h3.8v3.8M13.2 2.8 9.4 6.6M6.4 13.4H2.6V9.6M2.8 13.2l3.8-3.8", 14);
  const noneIcon = () => icon("M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM3.7 3.7l8.6 8.6", 20);
  const clockIcon = () => icon("M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM8 4.7V8l2.3 1.5", 20);
  const pulse = () => h("i", { class: "pel-pulse", "aria-hidden": "true" });

  /** A drawing's path, kept only when it is a site-relative .svg (no scheme, no leading slash, no ".."). */
  function srcOf(file) {
    const f = str(file);
    if (!f || /^[a-z][a-z0-9+.-]*:/i.test(f) || /^[\\/]/.test(f) || f.includes("..")) return null;
    return /\.svg(?:[?#]\S*)?$/i.test(f) ? f : null;
  }

  // ---------- data ----------
  function entryOf(e, i) {
    const bm = str(e.model) ? LB.byId(str(e.model)) : null;
    const board = e.onBoard === true && bm ? bm : null;
    const tries = objs(e.attempts).map((a, k) => ({
      n: isNum(a.n) ? a.n : k + 1, src: srcOf(a.file), ok: a.ok === true, animated: a.animated, problem: str(a.problem),
      seconds: num(a.seconds), tokens: num(a.tokens), tps: num(a.tps),
    }));
    const x = {
      key: str(e.id) || "entry-" + i, board, tries, paint: null,
      // first attempt that drew something; the pills still offer (and mark) every attempt
      cur: Math.max(0, tries.findIndex((a) => a.src && a.ok)),
      local: typeof e.local === "boolean" ? e.local : !(bm && bm.reference),
      name: str(e.name) || (board && board.name) || str(e.model) || "Unnamed model",
      variant: str(e.variant) || (board && str(board.variant)) || "",
      vendor: str(e.vendor) || (board && board.vendor) || "",
      where: str(e.where) || (board && str(board.where)) || "",
      effort: str(e.effort),
      complete: typeof e.complete === "boolean" ? e.complete : tries.length >= per,
      running: e.running === true,
    };
    x.sub = subLine(x);
    return x;
  }
  function waitingOf(q, i) {
    const board = str(q.model) ? LB.byId(str(q.model)) || null : null;
    const x = {
      key: str(q.id) || "queued-" + i, board, tries: [], cur: 0, waiting: true,
      local: q.local !== false,
      name: str(q.name) || (board && board.name) || str(q.model) || "Unnamed model",
      variant: str(q.variant) || (board && str(board.variant)) || "",
      vendor: str(q.vendor) || (board && board.vendor) || "",
      where: str(q.where) || (board && str(board.where)) || "",
      effort: str(q.effort),
      running: q.status === "running",
    };
    x.sub = subLine(x);
    return x;
  }
  /** Name plus the card's variant line, for accessible names (two entries can share a model name). */
  const who = (x) => x.name + (x.sub ? ` (${x.sub})` : "");

  /** Variant, effort (unless the variant says it) and where it ran; cards in the cloud group leave out what its label says. */
  function subLine(x, full) {
    const where = x.local || full ? x.where : "";
    const low = where.toLowerCase();
    const parts = x.variant.split("·").map((p) => p.trim()).filter(Boolean)
      .filter((p) => !(low && low.includes(p.toLowerCase())) && !(!x.local && /^cloud$/i.test(p)));
    if (x.effort && !/\beffort\b/i.test(x.variant)) parts.push("effort " + x.effort);
    if (where) parts.push(where);
    return parts.join(" · ") || (x.local ? "" : "Cloud reference");
  }
  function metaOf(x, a) {
    if (!a) return "—";
    const tokens = a.tokens !== null ? fmt.int(a.tokens) + " tokens" : null;
    if (!x.local) return [(a.seconds !== null ? secs(a.seconds) + " " : "") + "via Copilot", tokens].filter(Boolean).join(" · ");
    return [a.seconds !== null ? secs(a.seconds) : null, tokens, a.tps !== null ? fmt.tps(a.tps) + " tok/s" : null]
      .filter(Boolean).join(" · ") || "—";
  }
  const metaTitle = (x) => (x.local ? "Wall time of this reply · output tokens, thinking included · decode speed"
    : "Wall time through the GitHub Copilot CLI (not comparable with runs on this PC) · output tokens");
  const failed = (a) => !a.src || !a.ok;

  // ---------- atoms ----------
  function holder(kind, title, text) {
    const glyph = kind === "run" ? pulse() : kind === "wait" ? clockIcon() : noneIcon();
    return h("span", { class: ["pel-ph", "pel-ph-" + kind] }, glyph, h("b", {}, title),
      text ? h("span", { class: "pel-ph-t", title: text }, text) : null);
  }
  /** The drawing of one attempt (an <img>, never inline SVG) or a placeholder saying why there is none. */
  function art(x, a, big) {
    if (!a) return x.running ? holder("run", "Running now") : holder("none", "No tries yet");
    if (!a.src) return holder("bad", "No usable SVG", a.problem || "The reply had no drawing.");
    // loading/decoding go before src, so the lazy hint applies before the browser starts the request
    const img = h("img", { class: "pel-img", loading: big ? "eager" : "lazy", decoding: "async",
      alt: `Pelican riding a bicycle drawn by ${x.name} (attempt ${a.n})`, src: a.src });
    img.addEventListener("error", () => img.replaceWith(holder("bad", "Couldn't show this drawing", a.problem || null)), { once: true });
    return [img, !a.ok && a.problem ? h("span", { class: "pel-flag", title: a.problem }, a.problem) : null];
  }
  function staticChip(a) {
    return a && a.src && a.ok && a.animated === false
      ? h("span", { class: "lb-chip pel-static", title: "This drawing doesn't move" }, "static") : null;
  }
  function triesGroup(x, pick, arrows) {
    const g = h("div", { class: "pel-tries", role: "group", "aria-label": `Attempts by ${who(x)}` });
    x.tries.forEach((a, i) => {
      const bad = failed(a);
      g.append(h("button", { type: "button", class: ["pel-try", bad && "pel-try-bad"], "aria-pressed": String(i === x.cur),
        "aria-label": `Attempt ${a.n}${bad ? ", failed" : ""}`, title: `Attempt ${a.n}` + (bad ? ": " + (a.problem || "no usable SVG") : ""),
        onclick: () => pick(i) }, String(a.n)));
    });
    if (arrows) {
      g.addEventListener("keydown", (e) => {
        const n = x.tries.length;
        if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || n < 2) return;
        e.preventDefault();
        const i = (x.cur + (e.key === "ArrowRight" ? 1 : n - 1)) % n;
        pick(i);
        if (g.children[i]) g.children[i].focus();
      });
    }
    return g;
  }
  function paintTries(g, x) {
    [...g.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === x.cur)));
  }
  function progress(x) {
    if (x.complete) return null;
    return h("span", { class: "pel-prog" }, x.running ? pulse() : null, `${x.tries.length} of ${per} so far`,
      x.running ? h("span", { class: "pel-sr" }, ", running now") : null);
  }
  /** Vendor badge; cloud references get the dashed outline they have elsewhere on the page. */
  function badgeOf(x, size) {
    let b;
    try { b = LB.mono(x.vendor, size); } catch (err) { b = LB.mono("", size); }
    if (!x.local) b.classList.add("pel-dash");
    return b;
  }
  function identity(x, meta) {
    const badge = badgeOf(x, 22);
    const name = h("span", { class: "pel-name" }, x.name);
    if (x.board) {
      LB.tip.attach(badge, () => LB.modelTip(x.board));
      LB.tip.attach(name, () => LB.modelTip(x.board));
    }
    const sub = x.sub;
    return h("div", { class: "pel-id" }, badge, name, sub ? h("div", { class: "pel-sub" }, sub) : null, meta);
  }

  // ---------- cards ----------
  function card(x) {
    if (x.waiting || !x.tries.length) {
      const what = x.running ? holder("run", "Running now") : x.waiting ? holder("wait", x.local ? "Queued on this PC" : "Queued")
        : holder("none", "No tries yet");
      return h("li", { class: ["pel-card", "pel-card-wait"] },
        h("div", { class: "pel-frame pel-frame-wait" }, what),
        h("div", { class: "pel-bar" }, x.waiting ? null : progress(x)),
        identity(x, null));
    }
    const frame = h("button", { type: "button", class: "pel-frame", "aria-haspopup": "dialog" });
    const tries = triesGroup(x, (i) => { x.cur = i; paint(); }, true);
    const chip = h("span", { class: "pel-chipbox" });
    const meta = h("div", { class: "pel-meta", title: metaTitle(x) });
    frame.addEventListener("click", () => view(x, frame));
    function paint() {
      const a = x.tries[x.cur] || null;
      frame.replaceChildren(...[art(x, a, false)].flat().filter(Boolean), h("span", { class: "pel-zoom", "aria-hidden": "true" }, zoomIcon()));
      frame.setAttribute("aria-label", a ? `Enlarge attempt ${a.n}${failed(a) ? ", failed," : ""} by ${who(x)}` : `Enlarge ${who(x)}`);
      paintTries(tries, x);
      chip.replaceChildren(...[staticChip(a)].filter(Boolean));
      meta.textContent = metaOf(x, a);
    }
    x.paint = paint;
    paint();
    return h("li", { class: "pel-card" },
      frame, h("div", { class: "pel-bar" }, tries, chip, progress(x)), identity(x, meta));
  }
  function block(kind, items) {
    const running = items.filter((x) => x.running).length, queued = items.filter((x) => x.waiting && !x.running).length;
    const id = "pel-g-" + kind;
    const facts = (kind === "local" ? [] : ["GitHub Copilot"]).concat([count(items.length, "model"),
      running ? `${running} running` : null, queued ? `${queued} queued` : null]).filter(Boolean);
    return h("div", { class: "pel-block", "data-kind": kind },
      h("div", { class: "pel-group" }, h("h3", { id }, kind === "local" ? "On this PC" : "Cloud references"), h("span", {}, facts.join(" · "))),
      h("ul", { class: "pel-grid", role: "list", "aria-labelledby": id }, items.map(card)));
  }

  // ---------- larger view ----------
  let dlg = null, ui = null, cur = null, opener = null, modal = false, downOnBackdrop = false, pendingClose = false;

  function ensure() {
    if (dlg) return;
    // a native <dialog> already has the dialog role
    dlg = h("dialog", { class: "pel-dlg", "aria-labelledby": "pel-dlg-title" });
    dlg.addEventListener("mousedown", (e) => { downOnBackdrop = e.target === dlg; });
    dlg.addEventListener("click", (e) => { if (e.target === dlg && downOnBackdrop) close(); downOnBackdrop = false; });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    dlg.addEventListener("keydown", onKey);
    dlg.addEventListener("close", onClosed);
    const id = h("div", { class: "pel-dlg-id" });
    const x = h("button", { type: "button", class: "pel-x", "aria-label": "Close", title: "Close (Esc)", onclick: close }, closeIcon());
    const frame = h("div", { class: "pel-dlg-frame" });
    const bar = h("div", { class: "pel-dlg-bar" });
    const meta = h("div", { class: "pel-dlg-meta" });
    dlg.append(
      h("div", { class: "pel-dlg-top" }, id, x),
      h("div", { class: "pel-dlg-body" }, frame, h("div", { class: "pel-dlg-foot" }, bar, meta),
        promptText ? h("p", { class: "pel-dlg-prompt" }, h("span", { class: "pel-prompt-k" }, "Prompt"), h("q", {}, promptText)) : null));
    document.body.appendChild(dlg);
    ui = { id, x, frame, bar, meta };
  }
  function pickInView(i, focusPill) {
    if (!cur || !cur.tries[i]) return;
    cur.cur = i;
    paintView();
    if (cur.paint) cur.paint();
    if (focusPill && ui.tries && ui.tries.children[i]) ui.tries.children[i].focus();
  }
  function onKey(e) {
    if (e.key === "Escape" && !modal) { e.preventDefault(); close(); return; }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && cur && cur.tries.length > 1) {
      e.preventDefault();
      const n = cur.tries.length;
      pickInView((cur.cur + (e.key === "ArrowRight" ? 1 : n - 1)) % n, !!(ui.tries && ui.tries.contains(document.activeElement)));
    }
  }
  function paintView() {
    const x = cur, a = x.tries[x.cur] || null;
    ui.frame.replaceChildren(...[art(x, a, true)].flat().filter(Boolean));
    if (ui.tries) paintTries(ui.tries, x);
    ui.chip.replaceChildren(...[staticChip(a)].filter(Boolean));
    ui.meta.textContent = metaOf(x, a);
    ui.meta.title = metaTitle(x);
  }
  function view(x, from) {
    ensure();
    cur = x;
    opener = from || (document.activeElement !== document.body ? document.activeElement : null);
    const sub = subLine(x, true);
    ui.id.replaceChildren(badgeOf(x, 30), h("div", { class: "pel-dlg-txt" },
      h("h2", { id: "pel-dlg-title" }, h("span", { class: "pel-sr" }, "Pelican by "), x.name),
      sub ? h("div", { class: "pel-dlg-sub" }, sub) : null));
    ui.tries = triesGroup(x, (i) => pickInView(i, false), false);
    ui.chip = h("span", { class: "pel-chipbox" });
    ui.bar.replaceChildren(...[ui.tries, ui.chip, progress(x)].filter(Boolean));
    paintView();
    document.documentElement.classList.add("pel-lock");
    LB.tip.hide();
    pendingClose = true;
    modal = typeof dlg.showModal === "function";
    if (modal) dlg.showModal();
    else dlg.setAttribute("open", "");
    const on = ui.tries && ui.tries.querySelector('[aria-pressed="true"]');
    (on || ui.x).focus();
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
    document.documentElement.classList.remove("pel-lock");
    if (ui) ui.frame.replaceChildren();
    if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    opener = null;
  }

  // ---------- section ----------
  function subOf(P) {
    const c = P && P.credit && typeof P.credit === "object" ? P.credit : {};
    const name = str(c.name) || "Simon Willison";
    const url = /^https?:\/\//i.test(str(c.url)) ? str(c.url) : CREDIT_URL;
    return [`Every model got the same prompt and ${say(per)} ${per === 1 ? "try" : "tries"}, and every try is shown, failures included. ` +
      "The test comes from ", h("a", { class: "pel-credit", href: url, target: "_blank", rel: "noopener",
      "aria-label": `${name}'s pelican test (opens in a new tab)` }, name + " ↗"), "."];
  }
  function promptOf(P) {
    if (!promptText) return null;
    const sys = P && str(P.system);
    // the system prompt opens under the prompt line (a grid row of the header), so the filter on the right stays put
    const box = sys ? h("div", { class: "pel-sys", id: "pel-sys", hidden: true }, h("b", {}, "System prompt"), h("div", {}, sys)) : null;
    const btn = sys ? h("button", { type: "button", class: "pel-sys-btn", "aria-expanded": "false", "aria-controls": "pel-sys" },
      infoIcon(), "System prompt") : null;
    if (btn) btn.addEventListener("click", () => { box.hidden = !box.hidden; btn.setAttribute("aria-expanded", String(!box.hidden)); });
    return { row: h("div", { class: "pel-prompt" }, h("span", { class: "pel-prompt-k" }, "Prompt"), h("q", {}, promptText), btn), box };
  }

  function render(el) {
    const P = D.pelican && typeof D.pelican === "object" ? D.pelican : null;
    per = P && isNum(P.perModel) && P.perModel >= 1 ? Math.round(P.perModel) : 3;
    promptText = P ? str(P.prompt) : "";
    const entries = P ? objs(P.entries).map(entryOf) : [];
    const waiting = P ? objs(P.queued).map(waitingOf) : [];
    const local = entries.filter((x) => x.local).concat(waiting.filter((x) => x.local));
    const cloud = entries.filter((x) => !x.local).concat(waiting.filter((x) => !x.local));
    const blocks = [];
    let seg = null;
    if (local.length && cloud.length) {
      seg = LB.seg([{ value: "all", label: "All" }, { value: "local", label: "This PC" }, { value: "cloud", label: "Cloud" }], "all",
        (v) => blocks.forEach((b) => { b.hidden = v !== "all" && b.dataset.kind !== v; }));
      seg.setAttribute("aria-label", "Which drawings to show");
    }
    const head = LB.sectionHead({ title: "Pelican on a bicycle", sub: subOf(P), right: seg ? [seg] : null });
    const prompt = promptOf(P);
    head.classList.add("pel-head");
    if (prompt) {
      (head.querySelector("h2") ? head.querySelector("h2").parentNode : head).append(prompt.row);
      if (prompt.box) head.append(prompt.box);
    }
    el.append(head);
    if (!local.length && !cloud.length) {
      el.append(LB.card("pel-empty", h("div", { class: "lb-empty" }, "No pelicans yet. Drawings land here as models finish.")));
      return;
    }
    if (local.length) blocks.push(block("local", local));
    if (cloud.length) blocks.push(block("cloud", cloud));
    // local comes first, unless none of its models has drawn anything yet while the cloud references have
    const drawn = (xs) => xs.some((x) => x.tries.length);
    if (blocks.length > 1 && !drawn(local) && drawn(cloud)) blocks.reverse();
    el.append(...blocks);
  }

  LB.register({ id: "pelican", order: 35, nav: "Pelican", render });
})();
