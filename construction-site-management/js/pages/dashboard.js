/* ============================================================
   NEXORA CMS — Dashboard page
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt, UI = root.UI, CMP = root.CMP, RC = root.RC;

  const state = { filters: { projectId: "", from: "", to: "" } };

  function render(container) {
    const api = root.API;
    const store = api.store;
    const f = state.filters;
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    container.innerHTML = `
      ${UI.pageToolbar("Dashboard", "Company-wide snapshot — profitability, budgets and site activity at a glance.", [
        UI.BTN.refresh, UI.BTN.filters, UI.BTN.print, UI.BTN.export,
      ], { crumbs: ["Dashboard"] })}

      <div class="dash-greet">
        <div>
          <div class="dash-hello">${greet}, <b>${F.esc(store.user ? store.user.name.split(" ")[0] : "")}</b> 👋</div>
          <div class="dash-date">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${F.esc(store.settings.companyName || "Nexora Limited")}</div>
        </div>
        <div class="quick-actions">
          <button class="btn btn-primary" data-act="quick-expense">${UI.icon("wallet", 15)} New Expense</button>
          <button class="btn btn-soft" data-act="quick-budget">${UI.icon("doc", 15)} New Budget Line</button>
          <button class="btn btn-soft" data-act="quick-invoice">${UI.icon("briefcase", 15)} New Invoice</button>
          <button class="btn btn-soft" data-act="quick-project">${UI.icon("building", 15)} New Project</button>
        </div>
      </div>

      <div class="filterbar" id="dash-filters" style="display:none">
        <div class="fb-item" data-f="projectId"></div>
        <div class="fb-item"><label>From date</label><input type="date" class="input" id="dash-from" value="${F.esc(f.from)}"/></div>
        <div class="fb-item"><label>To date</label><input type="date" class="input" id="dash-to" value="${F.esc(f.to)}"/></div>
        <div class="fb-item fb-actions">
          <button class="btn btn-ghost" data-act="clear-filters">${UI.icon("close", 14)} Clear</button>
        </div>
      </div>

      <div class="kpi-grid" id="dash-kpis"></div>
      <div class="charts-grid" id="dash-charts"></div>
      <div class="dash-cols">
        <div class="panel" id="dash-alerts"><div class="panel-head"><h4>${UI.icon("alert", 16)} Alerts &amp; Warnings</h4></div><div class="panel-body" id="dash-alerts-body"></div></div>
        <div class="panel" id="dash-activity"><div class="panel-head"><h4>${UI.icon("clock", 16)} Recent Activity</h4></div><div class="panel-body" id="dash-activity-body"></div></div>
      </div>`;

    // filters
    const projSel = CMP.searchSelect({
      placeholder: "All projects", items: [{ id: "", label: "All projects" }].concat((store.masters.Projects || []).map(p => ({ id: p.id, label: p.name, sub: p.code }))),
      value: f.projectId || "",
      onSelect: it => { state.filters.projectId = it ? it.id : ""; reRender(); },
    });
    container.querySelector('[data-f="projectId"]').prepend(Object.assign(document.createElement("label"), { textContent: "Project" }), projSel.wrap);

    container.querySelector("#dash-from").addEventListener("change", e => { state.filters.from = e.target.value; reRender(); });
    container.querySelector("#dash-to").addEventListener("change", e => { state.filters.to = e.target.value; reRender(); });

    UI.attachActions(container, async (act, btn) => {
      if (act === "quick-expense") location.hash = "#/expenses?new=1";
      else if (act === "quick-budget") location.hash = "#/budget?new=1";
      else if (act === "quick-invoice") location.hash = "#/contracts?new=1&type=Sales Invoice";
      else if (act === "quick-project") location.hash = "#/masters/projects?new=1";
      else if (act === "clear-filters") { state.filters = { projectId: "", from: "", to: "" }; reRender(); }
      else if (act === "filters") { const fb = container.querySelector("#dash-filters"); fb.style.display = fb.style.display === "none" ? "grid" : "none"; }
      else if (act === "refresh") { await api.refreshAll(true); reRender(); }
      else if (act === "print") { printDashboard(); }
      else if (act === "export") { exportDashboard(); }
      else if (act === "home") location.hash = "#/dashboard";
      else if (act === "back") history.back();
    });

    function reRender() { render(container); }

    draw();
  }

  function draw() {
    const api = root.API;
    const store = api.store;
    const f = state.filters;
    const kpiHost = document.getElementById("dash-kpis");
    if (!kpiHost) return;

    kpiHost.innerHTML = RC.dashboardKPIs(store, f).map(k => CMP.statCard(k)).join("");
    root.Charts.renderCharts(RC.dashboardCharts(store, f), document.getElementById("dash-charts"));

    const alerts = RC.dashboardAlerts(store);
    document.getElementById("dash-alerts-body").innerHTML = alerts.length
      ? `<div class="alert-list">${alerts.map(a => `
          <div class="alert-item ${a.tone}">
            <span class="alert-ic">${UI.icon(a.tone === "bad" ? "warn" : "alert", 15)}</span>
            <div><div class="alert-title">${F.esc(a.title)}</div><div class="alert-msg">${F.esc(a.msg)}</div></div>
          </div>`).join("")}</div>`
      : UI.emptyState("check", "All clear", "No alerts — every budget line is within its approved limit.");

    const acts = RC.dashboardActivity(store, 10);
    document.getElementById("dash-activity-body").innerHTML = acts.length
      ? `<div class="activity-list">${acts.map(a => `
          <div class="activity-item">
            <div class="av">${F.initials(a.user)}</div>
            <div class="activity-main">
              <div><b>${F.esc(a.user)}</b> ${F.esc(a.action.toLowerCase())} <span class="act-entity">${F.esc(a.entity)}</span> ${a.ref ? `<span class="act-ref">${F.esc(a.ref)}</span>` : ""}</div>
              <div class="activity-sub">${F.esc(a.details || "")} · ${F.fmtDateTime(a.ts)}</div>
            </div>
          </div>`).join("")}</div>`
      : UI.emptyState("clock", "No activity yet", "Actions taken in the system will appear here.");
  }

  function printDashboard() {
    const store = root.API.store;
    const f = state.filters;
    const kpis = RC.dashboardKPIs(store, f);
    root.App.printReport("Dashboard Summary", `
      <table class="ptable">
        ${kpis.map(k => `<tr><td>${k.label}</td><td class="ar">${k.value}</td></tr>`).join("")}
      </table>
      <h4>Alerts</h4>
      <ul>${RC.dashboardAlerts(store).map(a => `<li><b>${F.esc(a.title)}</b> — ${F.esc(a.msg)}</li>`).join("")}</ul>`);
  }

  function exportDashboard() {
    const store = root.API.store;
    const f = state.filters;
    const kpis = RC.dashboardKPIs(store, f);
    F.exportCSV(`nexora-dashboard-${F.todayISO()}.csv`,
      [{ key: "metric", label: "Metric" }, { key: "value", label: "Value" }],
      kpis.map(k => ({ metric: k.label, value: k.value })));
  }

  root.Pages = root.Pages || {};
  root.Pages.dashboard = { render, title: "Dashboard" };
})(typeof window !== "undefined" ? window : globalThis);
