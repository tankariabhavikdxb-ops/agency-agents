/* ============================================================
   NEXORA CMS — Reports centre
   P&L · project / item / shop / head / supplier / customer ·
   LPO · ledger · monthly trend — with print, preview, export.
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt, UI = root.UI, CMP = root.CMP, RC = root.RC;

  const REPORTS = [
    { key: "pl", icon: "money", name: "Profit & Loss", desc: "Income vs expenses vs profit — company and per project." },
    { key: "project", icon: "building", name: "Project-wise", desc: "Every project: contract, budget, spend, remaining, profit." },
    { key: "budgetactual", icon: "chart", name: "Budget vs Actual", desc: "Item-wise budget utilisation — catch overspending early." },
    { key: "material", icon: "box", name: "Item-wise", desc: "Spend per material / item with quantities and rates." },
    { key: "shop", icon: "grid", name: "Shop-wise", desc: "Expenses and budget per shop / site store." },
    { key: "head", icon: "list", name: "Expense Head-wise", desc: "Spend grouped by cost category." },
    { key: "supplier", icon: "truck", name: "Supplier-wise", desc: "Purchases, LPOs and amounts due per supplier." },
    { key: "customer", icon: "briefcase", name: "Customer-wise", desc: "Contracts, invoices, collected and outstanding." },
    { key: "lpo", icon: "doc", name: "LPO Register", desc: "Local purchase orders and their status." },
    { key: "ledger", icon: "wallet", name: "Expense Ledger", desc: "Full detailed register of every expense entry." },
    { key: "monthly", icon: "clock", name: "Monthly Trend", desc: "Income and expenses month by month." },
  ];

  const state = { key: "pl", filters: { projectId: "", from: "", to: "" } };

  function render(container, params) {
    const store = root.API.store;
    const f = state.filters;
    if (params && params.key) state.key = params.key;
    const meta = REPORTS.find(r => r.key === state.key) || REPORTS[0];
    const rep = RC.report(store, state.key, f);

    container.innerHTML = `
      ${UI.pageToolbar(`Reports — ${meta.name}`, meta.desc, [
        UI.BTN.home, UI.BTN.back, UI.BTN.refresh, UI.BTN.filters, UI.BTN.preview, UI.BTN.print, UI.BTN.export,
      ], { crumbs: ["Reports", meta.name] })}

      <div class="report-picker">
        ${REPORTS.map(r => `<button class="rp ${r.key === state.key ? "on" : ""}" data-key="${r.key}">
          <span class="rp-ic">${UI.icon(r.icon, 18)}</span>
          <span class="rp-name">${r.name}</span>
        </button>`).join("")}
      </div>

      <div class="filterbar" id="rep-filters">
        <div class="fb-item" data-f="projectId"></div>
        <div class="fb-item"><label>From date</label><input type="date" class="input" id="rep-from" value="${F.esc(f.from)}"/></div>
        <div class="fb-item"><label>To date</label><input type="date" class="input" id="rep-to" value="${F.esc(f.to)}"/></div>
        <div class="fb-item fb-actions"><button class="btn btn-ghost" data-act="clear">${UI.icon("close", 14)} Clear</button></div>
      </div>

      <div class="rep-summary">${(rep.cards || []).map(c => `
        <div class="kpi ${c.tone || ""}">
          <div class="kpi-label">${F.esc(c.label)}</div>
          <div class="kpi-value">${c.value}</div>
        </div>`).join("")}</div>

      <div class="charts-grid" id="rep-charts"></div>
      <div id="rep-tables"></div>`;

    // picker
    container.querySelectorAll(".rp").forEach(b => b.addEventListener("click", () => {
      state.key = b.dataset.key;
      render(container);
    }));

    const projHost = container.querySelector('[data-f="projectId"]');
    const l = document.createElement("label"); l.textContent = "Project"; projHost.appendChild(l);
    const projSel = CMP.searchSelect({
      items: [{ id: "", label: "All projects" }].concat((store.masters.Projects || []).map(p => ({ id: p.id, label: p.name, sub: p.code }))),
      value: f.projectId || "", placeholder: "Type to search…",
      onSelect: it => { state.filters.projectId = it ? it.id : ""; render(container); },
    });
    projHost.appendChild(projSel.wrap);

    container.querySelector("#rep-from").addEventListener("change", e => { state.filters.from = e.target.value; render(container); });
    container.querySelector("#rep-to").addEventListener("change", e => { state.filters.to = e.target.value; render(container); });

    UI.attachActions(container, async (act) => {
      if (act === "clear") { state.filters = { projectId: "", from: "", to: "" }; render(container); }
      else if (act === "filters") { const el = container.querySelector("#rep-filters"); el.style.display = el.style.display === "none" ? "grid" : "none"; }
      else if (act === "refresh") { await root.API.refreshAll(true); render(container); }
      else if (act === "preview") preview();
      else if (act === "print") printReport();
      else if (act === "export") exportReport();
      else if (act === "home") location.hash = "#/dashboard";
      else if (act === "back") history.back();
    });

    root.Charts.renderCharts(rep.charts || [], container.querySelector("#rep-charts"));
    renderTables(container, rep);
  }

  function renderTables(container, rep) {
    const host = container.querySelector("#rep-tables");
    host.innerHTML = "";
    (rep.tables || []).forEach(tb => {
      const panel = document.createElement("div");
      panel.className = "panel";
      const footHtml = tb.foot && tb.foot.length
        ? `<tfoot><tr>${tb.foot.map(fx => {
            const vals = fx.values || [];
            return `<td colspan="${tb.columns.length}">${F.esc(fx.label)}</td>${vals.map(v => `<td class="ar"><b>${v}</b></td>`).join("")}`;
          }).join("")}</tr></tfoot>`
        : "";
      panel.innerHTML = `
        <div class="panel-head"><h4>${UI.icon("doc", 15)} ${F.esc(tb.title)} <span class="panel-count">${tb.rows.length} row(s)</span></h4></div>
        <div class="panel-body pad0"><div class="dtable-scroll"><table class="table">
          <thead><tr>${tb.columns.map(c => `<th class="${c.align === "right" ? "al-right" : ""}">${F.esc(c.label)}</th>`).join("")}</tr></thead>
          <tbody>${tb.rows.length ? tb.rows.map(r => `<tr>${tb.columns.map(c => {
            const v = c.render ? c.render(r) : r[c.key];
            return `<td class="${c.align === "right" ? "al-right num" : ""}">${v == null || v === "" ? "—" : v}</td>`;
          }).join("")}</tr>`).join("") : `<tr><td colspan="${tb.columns.length}" class="al-c">No records in the selected range</td></tr>`}</tbody>
          ${footHtml}
        </table></div></div>`;
      host.appendChild(panel);
    });
  }

  /* ---------------- print / preview / export ---------------- */
  function reportHTML() {
    const store = root.API.store;
    const rep = RC.report(store, state.key, state.filters);
    const meta = REPORTS.find(r => r.key === state.key);
    const f = state.filters;
    const filterNote = [
      f.projectId ? `Project: ${F.nameOf(store.masters.Projects, f.projectId)}` : "All projects",
      f.from ? `From: ${F.fmtDate(f.from)}` : "", f.to ? `To: ${F.fmtDate(f.to)}` : "",
    ].filter(Boolean).join(" · ");

    const cards = rep.cards && rep.cards.length
      ? `<div class="p-cards"><table class="ptable">${rep.cards.map(c => `<tr><td>${F.esc(c.label)}</td><td class="ar"><b>${c.value}</b></td></tr>`).join("")}</table></div>` : "";
    const tables = (rep.tables || []).map(tb => `
      <h4>${F.esc(tb.title)}</h4>
      <table class="ptable">
        <thead><tr>${tb.columns.map(c => `<th class="${c.align === "right" ? "ar" : ""}">${F.esc(c.label)}</th>`).join("")}</tr></thead>
        <tbody>${tb.rows.map(r => `<tr>${tb.columns.map(c => {
          const v = c.render ? c.render(r) : r[c.key];
          return `<td class="${c.align === "right" ? "ar" : ""}">${v == null || v === "" ? "—" : v}</td>`;
        }).join("")}</tr>`).join("")}</tbody>
        ${tb.foot ? `<tfoot><tr>${tb.foot.map(fx => `<td colspan="${tb.columns.length}"><b>${F.esc(fx.label)}</b></td>${(fx.values || []).map(v => `<td class="ar"><b>${v}</b></td>`).join("")}</tr>`).join("")}</tfoot>` : ""}
      </table>`).join("");
    return { meta, filterNote, body: cards + tables };
  }

  function printReport() {
    const { meta, filterNote, body } = reportHTML();
    root.App.printReport(`${meta.name} Report`, body, filterNote);
  }

  function preview() {
    const { meta, filterNote, body } = reportHTML();
    UI.openModal(`<div class="print-preview">${root.App.buildPrintHTML(`${meta.name} Report`, body, filterNote)}</div>`, {
      title: "Print Preview",
      subtitle: "This is exactly how the report will print / save as PDF.",
      wide: true, tall: true,
      footer: `
        <button class="btn btn-ghost" data-act="close">${UI.icon("close", 15)} Close</button>
        <button class="btn btn-soft" data-act="export">${UI.icon("export", 15)} Export CSV</button>
        <button class="btn btn-primary" data-act="print">${UI.icon("print", 15)} Print / PDF</button>`,
    });
    UI.attachActions(UI.modalEl(), act => {
      if (act === "close") UI.closeModal();
      else if (act === "print") printReport();
      else if (act === "export") exportReport();
    });
  }

  function stripHtml(html) {
    const t = document.createElement("textarea");
    t.innerHTML = String(html || "");
    return t.value;
  }

  function exportReport() {
    const store = root.API.store;
    const rep = RC.report(store, state.key, state.filters);
    const meta = REPORTS.find(r => r.key === state.key);
    const tb = (rep.tables || [])[0];
    if (!tb) { UI.toast("Nothing to export for the selected range.", "error"); return; }
    const cols = tb.columns.map(c => ({
      key: c.key, label: c.label,
      value: r => {
        const raw = c.render ? stripHtml(c.render(r)) : r[c.key];
        const txt = raw == null ? "" : String(raw);
        const m = txt.replace(/,/g, "").match(/^-?\d+(\.\d+)?%?$/);
        if (m && txt.includes("%")) return parseFloat(m[0]);
        if (m) return parseFloat(m[0]);
        return txt;
      },
    }));
    F.exportCSV(`nexora-${meta.key}-${F.todayISO()}.csv`, cols, tb.rows);
    UI.toast("Report exported as CSV.", "success");
  }

  root.Pages = root.Pages || {};
  root.Pages.reports = { render, title: "Reports" };
})(typeof window !== "undefined" ? window : globalThis);
