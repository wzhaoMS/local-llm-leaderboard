/* Long context: how much of a prompt of up to 1M tokens each setup really uses (data: D.longContext, from the long_ctx
   suite). One table (a row per run, a column per context size) and, for the selected run, accuracy by depth and speed by
   size. */
(function () {
  "use strict";
  const LB = window.LB;
  if (!LB) return;
  const { h, s, fmt, isNum } = LB;
  const D = LB.data || {};

  const r0 = (v) => (isNum(v) ? String(Math.round(v)) : "—");
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const en = (v) => (v && typeof v === "object" ? v.en || "" : String(v || ""));
  const icon = (d, size = 14) => s("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor",
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" }, s("path", { d }));
  const infoIcon = () => icon("M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM8 7.4v3.8M8 5.1v.1");
  const sr = (t) => h("span", { class: "lc-sr" }, t);
  const secs = (v) => (!isNum(v) ? "—" : v >= 100 ? fmt.int(v) : fmt.num(v, 1));

  /** The site model a run belongs to (badge, vendor colour); a stand-in when that model isn't on the board. */
  function modelOf(r) {
    return LB.byId(r.model) || { id: r.model, name: r.name, variant: r.variant || "", vendor: r.vendor || "qwen", params: "", quant: "", where: "" };
  }
  /** Pale red at 0% through amber to pale green at 100% (cell backgrounds of the depth grid). */
  function heat(v) {
    if (!isNum(v)) return null;
    const t = Math.max(0, Math.min(1, v / 100));
    const hue = t < 0.5 ? t * 80 : 40 + (t - 0.5) * 170;
    return `hsl(${hue.toFixed(0)} 75% ${(95 - t * 6).toFixed(0)}%)`;
  }
  const largest = (r, sizes) => [...sizes].reverse().find((z) => r.bySize[z.key]) || null;

  function tipHtml(r, size, d) {
    const ci = d.ci && isNum(d.ci[0]) ? ` <span class="muted">[${r0(d.ci[0])}–${r0(d.ci[1])}]</span>` : "";
    const kinds = [["look-ups", d.single], ["chains", d.chain], ["lists", d.list]].filter((k) => isNum(k[1]))
      .map((k) => `${k[0]} ${r0(k[1])}`).join(" · ");
    const lost = isNum(d.lost) ? `<br>vs 32K: ${d.lost} lost, ${d.gained || 0} gained` : "";
    return `<b>${esc(LB.label(modelOf(r)))} · ${esc(size.label)}</b><br><span class="muted">${esc(en(r.setup))}</span>` +
      (isNum(d.promptTokens) ? `<br><span class="muted">${fmt.int(d.promptTokens)} prompt tokens · ${d.n} questions</span>` : "") +
      `<hr>Accuracy <b>${r0(d.acc)}%</b>${ci}<br>${kinds}${lost}` +
      `<hr>Cold prefill <b>${secs(d.coldTtft)} s</b>${isNum(d.prefill) ? ` (${fmt.int(d.prefill)} tok/s)` : ""}` +
      `<br>Follow-up first token ${secs(d.warmTtft)} s · decode ${isNum(d.decode) ? fmt.num(d.decode, 0) : "—"} tok/s` +
      (d.formatMisses ? `<br><span class="muted">${d.formatMisses} right answer${d.formatMisses > 1 ? "s" : ""} without the required ANSWER: line (counted wrong)</span>` : "") +
      (d.errors ? `<br><span class="muted">${d.errors} request error${d.errors > 1 ? "s" : ""}</span>` : "") +
      (d.complete === false ? `<br><span class="muted">Partial: ${d.n} of the questions so far.</span>` : "");
  }

  function render(el) {
    const LC = D.longContext;
    const runs = LC && Array.isArray(LC.runs) ? LC.runs.filter((r) => r && r.bySize) : [];
    const sizes = LC && Array.isArray(LC.sizes) ? LC.sizes : [];
    el.append(LB.sectionHead({
      title: "Long context, up to 1M tokens",
      sub: "How much of a very long prompt each setup really uses: one dump of real code, the same questions at every size.",
    }));
    if (!runs.length || !sizes.length) {
      el.append(LB.card("lc-card lc-empty", h("div", { class: "lb-empty" }, "No long-context results yet. They land here as runs finish.")));
      return;
    }
    const pickId = D.verdict && D.verdict.pick;
    const nq = LC.questions || 20;
    const head = h("div", { class: "lc-head" },
      h("div", { class: "lc-title" }, h("h3", {}, "Recall across the whole window"),
        LB.chip(`${nq} questions × ${sizes.length} sizes`, "lc-chip")),
      h("p", { class: "lc-intro" }, `Each size is one dump of real code from a private TypeScript monorepo (${sizes.map((z) => z.label).join(", ")}), ` +
        `followed by a question. Every size asks the same ${nq} questions, with the evidence at the same relative positions, so a drop ` +
        "comes from the length, not from harder questions: 14 look-ups in the real code, 4 chains of constants planted in files far " +
        "apart, and 2 lists of every file carrying a tagged TODO. Closed book asks the same questions with no files."));

    // ---------- table ----------
    const cols = [{ key: "closed", label: "Closed\nbook", unit: "guessing" }]
      .concat(sizes.map((z) => ({ key: z.key, label: z.label, unit: isNum(z.tokens) ? `${fmt.int(Math.round(z.tokens / 1000))}K tokens` : "" })))
      .concat([{ key: "prefill", label: "Prefill at\nlargest", unit: "s · cold" }, { key: "decode", label: "Decode at\nlargest", unit: "tok/s" }]);
    const heads = [h("th", { scope: "col", class: "lc-c-model" }, h("span", { class: "lc-th" }, "Setup"), h("span", { class: "lc-unit" }, "model · how it ran"))]
      .concat(cols.map((c) => h("th", { scope: "col", class: "lc-c-" + (c.key === "prefill" || c.key === "decode" ? "num" : "size") },
        h("span", { class: "lc-th" }, c.label), h("span", { class: "lc-unit" }, c.unit || "\u00a0"))));
    const tbody = h("tbody");
    const table = h("table", { class: "lc-table" },
      h("caption", { class: "lc-sr" }, "Long-context accuracy: one row per setup, one column per context size. Select a row for accuracy by depth and speed by size."),
      h("thead", {}, h("tr", {}, heads)), tbody);
    const scroller = h("div", { class: "lc-scroll", tabindex: "0", role: "region", "aria-label": "Long-context table" }, table);
    const detail = h("div", { class: "lc-detail" });
    let sel = (runs.find((r) => r.model === pickId) || runs[0]).id;

    function row(r) {
      const m = modelOf(r), color = LB.vendor(m).color, big = largest(r, sizes);
      const bd = big ? r.bySize[big.key] : null;
      const badge = LB.mono(m, 26);
      LB.tip.attach(badge, () => LB.modelTip(m));
      const tr = h("tr", { class: ["lc-row", r.id === sel && "lc-on", r.model === pickId && r.engine === "llama.cpp" && "lc-pick"], "aria-selected": String(r.id === sel) },
        h("th", { scope: "row", class: "lc-c-model" },
          h("span", { class: "lc-vbar", style: { background: color }, "aria-hidden": "true" }),
          h("div", { class: "lc-model" }, badge, h("div", { class: "lc-model-txt" },
            h("button", { type: "button", class: "lc-name", onclick: () => select(r.id) }, h("span", {}, LB.label(m)),
              r.model === pickId && r.engine === "llama.cpp" ? [h("span", { class: "lc-star", "aria-hidden": "true" }, "★"), sr(" (our pick)")] : null),
            h("span", { class: "lc-setup" }, en(r.setup), r.running ? h("span", { class: "lc-live" }, " · running") : null)))));
      const cb = r.closedBook;
      tr.append(h("td", { class: "lc-c-size lc-closed", "data-label": "Closed book" },
        cb ? h("span", { class: "lc-acc lc-muted" }, h("b", {}, r0(cb.acc)), h("small", {}, "%")) : h("span", { class: "lc-na" }, "—")));
      for (const z of sizes) {
        const d = r.bySize[z.key];
        if (!d) {
          const skip = r.skipped && r.skipped[z.key];
          tr.append(h("td", { class: "lc-c-size", "data-label": z.label },
            h("span", { class: "lc-na", title: skip ? "Doesn't fit this setup's context" : r.running ? "Running" : "Not run" },
              r.running && !skip ? "…" : "—", sr(skip ? " does not fit" : r.running ? " running" : " not run"))));
          continue;
        }
        const td = h("td", { class: "lc-c-size", "data-label": z.label },
          h("span", { class: "lc-acc" }, h("b", {}, r0(d.acc)), d.lost ? h("small", { class: "lc-lost", title: `${d.lost} question${d.lost > 1 ? "s" : ""} answered at 32K but missed here` }, "−" + d.lost) : null),
          h("span", { class: "lc-mini", "aria-hidden": "true" }, h("i", { style: { width: Math.max(0, Math.min(100, d.acc || 0)).toFixed(1) + "%", background: color } })));
        LB.tip.attach(td, () => tipHtml(r, z, d));
        tr.append(td);
      }
      tr.append(h("td", { class: "lc-c-num", "data-label": `Prefill at ${big ? big.label : "largest"}` },
        bd && isNum(bd.coldTtft) ? [h("b", {}, secs(bd.coldTtft)), h("small", {}, ` s${isNum(bd.prefill) ? ` · ${fmt.int(bd.prefill)} tok/s` : ""}`)] : "—"));
      tr.append(h("td", { class: "lc-c-num", "data-label": `Decode at ${big ? big.label : "largest"}` },
        bd && isNum(bd.decode) ? h("b", {}, fmt.num(bd.decode, 0)) : "—"));
      tr.addEventListener("click", (e) => { if (!e.target.closest("button")) select(r.id); });
      return tr;
    }

    function drawDetail() {
      const r = runs.find((x) => x.id === sel) || runs[0];
      const m = modelOf(r);
      const bins = LC.depthBins || ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"];
      const shown = sizes.filter((z) => r.depth && r.depth[z.key]);
      const grid = h("table", { class: "lc-grid" },
        h("caption", { class: "lc-sr" }, "Look-up accuracy by where the answer sits in the dump, per context size"),
        h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Size"), bins.map((b) => h("th", { scope: "col" }, b.replace("-", "–"))))),
        h("tbody", {}, shown.map((z) => h("tr", {}, h("th", { scope: "row" }, z.label),
          r.depth[z.key].map((v) => h("td", { style: v === null ? null : { background: heat(v) } }, v === null ? "—" : r0(v)))))));
      const speed = h("table", { class: "lc-speed" },
        h("caption", { class: "lc-sr" }, "Speed by context size"),
        h("thead", {}, h("tr", {}, ["Size", "Cold prefill", "Prefill", "Follow-up", "Decode"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, sizes.filter((z) => r.bySize[z.key]).map((z) => {
          const d = r.bySize[z.key];
          return h("tr", {}, h("th", { scope: "row" }, z.label), h("td", {}, secs(d.coldTtft), h("small", {}, " s")),
            h("td", {}, isNum(d.prefill) ? fmt.int(d.prefill) : "—", h("small", {}, " tok/s")),
            h("td", {}, secs(d.warmTtft), h("small", {}, " s")), h("td", {}, isNum(d.decode) ? fmt.num(d.decode, 0) : "—", h("small", {}, " tok/s")));
        })));
      detail.textContent = "";
      detail.append(
        h("div", { class: "lc-dhead" }, LB.mono(m, 22), h("b", {}, LB.label(m)), h("span", {}, en(r.setup))),
        h("div", { class: "lc-dgrid" },
          h("div", { class: "lc-dbox" }, h("h4", {}, "Look-ups by depth", h("small", {}, "% correct · where the answer sits in the dump")), shown.length ? grid : h("p", { class: "lc-none" }, "No sizes finished yet.")),
          h("div", { class: "lc-dbox" }, h("h4", {}, "Speed by size", h("small", {}, "cold = first question, follow-up = cached dump")), speed)));
    }
    function select(id) {
      sel = id;
      [...tbody.children].forEach((tr, i) => { const on = runs[i].id === sel; tr.classList.toggle("lc-on", on); tr.setAttribute("aria-selected", String(on)); });
      drawDetail();
    }
    runs.forEach((r) => tbody.appendChild(row(r)));
    drawDetail();

    const queued = Array.isArray(LC.queued) ? LC.queued : [];
    const count = `${runs.length} ${runs.length === 1 ? "setup" : "setups"}` + (queued.length ? ` · ${queued.length} more queued` : "");
    el.append(LB.card("lc-card", head, h("div", { class: "lc-frame" }, scroller), detail,
      h("div", { class: "lc-foot" }, h("p", { class: "lc-def" }, infoIcon(), h("span", {},
        "Cells show % correct (lists by F1); hover for the 95% interval, the question kinds and the speed. −N = questions answered at 32K " +
        "but missed at that size. Qwen3.8 models are trained to 262K tokens and go past it with YaRN ×4, which also applies at the " +
        `shorter sizes. Every answer gets the same ${fmt.int(LC.answerBudget || 16384)}-token budget; a size runs only if it fits the ` +
        "setup's context.")), h("span", { class: "lc-count" }, count))));
  }

  LB.register({ id: "long-context", order: 58, nav: "Long context", render });
})();
