/* ============================================================
   NEXORA CMS — Audit Trail
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt, UI = root.UI, CMP = root.CMP;

  const state = { filters: { q: "", user: "", action: "", entity: "" } };

  function render(container) {
    const store = root.API.store;
    const f = state.filters;
    let rows = store.audit || [];
    if (f.q) rows = rows.filter(r => F.matchSearch(f.q, `${r.user} ${r.action} ${r.entity} ${r.ref} ${r.details}`));
    if (f.user) rows = rows.filter(r => r.user === f.user);
    if (f.action) rows = rows.filter(r => r.action === f.action);
    if (f.entity) rows = rows.filter(r => r.entity === f.entity);

    const users = [...new Set((store.audit || []).map(a => a.user))].sort();
    const entities = [...new Set((store.audit || []).map(a => a.entity))].sort();

    container.innerHTML = `
      ${UI.pageToolbar("Audit Trail", "Who did what, and when — every entry is tracked for full accountability.", [
        UI.BTN.home, UI.BTN.back, UI.BTN.refresh, UI.BTN.export,
      ], { crumbs: ["Audit"] })}

      <div class="filterbar" id="audit-filters">
        <div class="fb-item fb-grow"><label>Search</label><div class="searchbox">${UI.icon("search", 14)}<input type="text" class="input" id="audit-q" value="${F.esc(f.q)}" placeholder="Search anything…"/></div></div>
        <div class="fb-item"><label>User</label><select class="input" id="audit-user"><option value="">All users</option>${users.map(u => `<option>${F.esc(u)}</option>`).join("")}</select></div>
        <div class="fb-item"><label>Action</label><select class="input" id="audit-action"><option value="">All actions</option>${["LOGIN","CREATE","UPDATE","DELETE"].map(a => `<option>${a}</option>`).join("")}</select></div>
        <div class="fb-item"><label>Module</label><select class="input" id="audit-entity"><option value="">All modules</option>${entities.map(e => `<option>${F.esc(e)}</option>`).join("")}</select></div>
        <div class="fb-item fb-actions"><button class="btn btn-ghost" data-act="clear">${UI.icon("close", 14)} Clear</button></div>
      </div>

      <div class="panel"><div class="panel-body" id="audit-table-host"></div></div>`;

    container.querySelector("#audit-q").addEventListener("input", F.debounce(e => { state.filters.q = e.target.value; render(container); }, 250));
    container.querySelector("#audit-user").addEventListener("change", e => { state.filters.user = e.target.value; render(container); });
    container.querySelector("#audit-action").addEventListener("change", e => { state.filters.action = e.target.value; render(container); });
    container.querySelector("#audit-entity").addEventListener("change", e => { state.filters.entity = e.target.value; render(container); });
    container.querySelector("#audit-user").value = f.user;
    container.querySelector("#audit-action").value = f.action;
    container.querySelector("#audit-entity").value = f.entity;

    UI.attachActions(container, async act => {
      if (act === "clear") { state.filters = { q: "", user: "", action: "", entity: "" }; render(container); }
      else if (act === "refresh") { await root.API.refreshAll(true); render(container); }
      else if (act === "export") exportAudit(rows);
      else if (act === "home") location.hash = "#/dashboard";
      else if (act === "back") history.back();
    });

    const host = container.querySelector("#audit-table-host");
    host.innerHTML = "";
    const table = CMP.dataTable({
      defaultSort: "ts",
      columns: [
        { key: "ts", label: "Timestamp", render: r => F.fmtDateTime(r.ts), nowrap: true },
        { key: "user", label: "User", render: r => `<div class="who"><div class="av sm">${F.initials(r.user)}</div><b>${F.esc(r.user)}</b></div>` },
        { key: "action", label: "Action", render: r => UI.pill(r.action, { LOGIN: "info", CREATE: "ok", UPDATE: "warn", DELETE: "bad" }[r.action] || "muted") },
        { key: "entity", label: "Module", render: r => F.esc(r.entity) },
        { key: "ref", label: "Reference", render: r => `<b>${F.esc(r.ref || "—")}</b>` },
        { key: "details", label: "Details", render: r => F.esc(r.details) },
      ],
      rows,
      search: false,
    });
    host.appendChild(table.wrap);
  }

  function exportAudit(rows) {
    F.exportCSV(`nexora-audit-${F.todayISO()}.csv`, [
      { key: "ts", label: "Timestamp", value: r => r.ts },
      { key: "user", label: "User", value: r => r.user },
      { key: "action", label: "Action", value: r => r.action },
      { key: "entity", label: "Module", value: r => r.entity },
      { key: "ref", label: "Reference", value: r => r.ref },
      { key: "details", label: "Details", value: r => r.details },
    ], rows);
  }

  root.Pages = root.Pages || {};
  root.Pages.audit = { render, title: "Audit Trail" };
})(typeof window !== "undefined" ? window : globalThis);
