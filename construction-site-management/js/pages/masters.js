/* ============================================================
   NEXORA CMS — Masters page (Projects, Shops, Expense Heads,
   Materials, Units, Suppliers, Customers)
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt, UI = root.UI, CMP = root.CMP;

  const SHEETS = ["Projects", "Shops", "ExpenseHeads", "Materials", "Units", "Suppliers", "Customers"];

  const META = {
    Projects: { icon: "building", label: "Projects", hint: "Every site / project the company is running." },
    Shops: { icon: "grid", label: "Shops", hint: "Site stores & yards where materials are issued from." },
    ExpenseHeads: { icon: "list", label: "Expense Heads", hint: "Cost categories used on budget lines and expenses." },
    Materials: { icon: "box", label: "Materials", hint: "Materials, labour & plant items that can be budgeted." },
    Units: { icon: "chart", label: "Units", hint: "Units of measure (bag, m³, tonne, man-day…)." },
    Suppliers: { icon: "truck", label: "Suppliers", hint: "Vendors you purchase from and issue LPOs to." },
    Customers: { icon: "briefcase", label: "Customers", hint: "Clients you contract with and invoice." },
  };

  const state = { sheet: "Projects", filters: { q: "", status: "" } };

  function render(container, params) {
    if (params && params.sheet && SHEETS.includes(params.sheet)) state.sheet = params.sheet;
    const store = root.API.store;
    const meta = META[state.sheet];

    container.innerHTML = `
      ${UI.pageToolbar(`Masters — ${meta.label}`, meta.hint, [
        UI.BTN.home, UI.BTN.back, UI.BTN.refresh, UI.BTN.print, UI.BTN.export,
        root.App.can("masters") ? UI.BTN.add("Add " + meta.label.slice(0, -1)) : "",
      ], { crumbs: ["Masters", meta.label] })}

      <div class="master-tabs" id="master-tabs">
        ${SHEETS.map(s => `<button class="mtab ${s === state.sheet ? "on" : ""}" data-sheet="${s}">${UI.icon(META[s].icon, 15)} ${META[s].label}</button>`).join("")}
      </div>

      <div class="filterbar" id="masters-filters">
        <div class="fb-item fb-grow"><label>Search</label><div class="searchbox">${UI.icon("search", 14)}<input type="text" class="input" id="master-q" placeholder="Search ${meta.label.toLowerCase()}…" value="${F.esc(state.filters.q)}"/></div></div>
        <div class="fb-item"><label>Status</label>
          <select class="input" id="master-status">
            <option value="">All statuses</option>
            <option value="Active" ${state.filters.status === "Active" ? "selected" : ""}>Active</option>
            <option value="Inactive" ${state.filters.status === "Inactive" ? "selected" : ""}>Inactive</option>
          </select>
        </div>
        <div class="fb-item fb-actions"><button class="btn btn-ghost" data-act="clear">${UI.icon("close", 14)} Clear</button></div>
      </div>

      <div class="panel">
        <div class="panel-body" id="masters-table-host"></div>
      </div>`;

    // tabs
    container.querySelectorAll(".mtab").forEach(b => b.addEventListener("click", () => {
      state.sheet = b.dataset.sheet;
      state.filters = { q: "", status: "" };
      location.hash = "#/masters/" + state.sheet.toLowerCase();
      render(container);
    }));

    container.querySelector("#master-q").addEventListener("input", F.debounce(e => {
      state.filters.q = e.target.value;
      render(container);
    }, 250));
    container.querySelector("#master-status").addEventListener("change", e => {
      state.filters.status = e.target.value;
      render(container);
    });

    UI.attachActions(container, async (act, btn) => {
      if (act === "add") openForm(container, null);
      else if (act === "edit") openForm(container, F.byId(store.masters[state.sheet], btn.dataset.id));
      else if (act === "delete") await doDelete(container, btn.dataset.id);
      else if (act === "clear") { state.filters = { q: "", status: "" }; render(container); }
      else if (act === "refresh") { await root.API.refreshEntity(state.sheet, true); render(container); }
      else if (act === "print") printMasters();
      else if (act === "export") exportMasters();
      else if (act === "home") location.hash = "#/dashboard";
      else if (act === "back") history.back();
    });

    buildTable(container);
  }

  function filteredRows() {
    const store = root.API.store;
    let rows = store.masters[state.sheet] || [];
    const q = state.filters.q;
    if (q) {
      rows = rows.filter(r => F.matchSearch(q, Object.values(r).join(" ")));
    }
    if (state.filters.status) rows = rows.filter(r => r.status === state.filters.status);
    return rows;
  }

  function buildTable(container) {
    const store = root.API.store;
    const host = container.querySelector("#masters-table-host");
    host.innerHTML = "";
    const cols = columnsFor(state.sheet);
    const table = CMP.dataTable({
      columns: cols,
      rows: filteredRows(),
      search: false,
      onAction: (act, row) => {
        if (act === "edit") openForm(container, row);
        else if (act === "delete") doDelete(container, row.id);
      },
      actions: [
        { act: "edit", icon: "edit", title: "Edit", show: () => root.App.can("edit") },
        { act: "delete", icon: "trash", title: "Delete", danger: true, show: () => root.App.can("delete") },
      ],
    });
    host.appendChild(table.wrap);
  }

  function columnsFor(sheet) {
    const pill = r => UI.pill(r);
    const money = v => `<span class="num">${F.money(v)}</span>`;
    const common = [
      { key: "name", label: "Name" },
      { key: "status", label: "Status", render: r => pill(r.status) },
      { key: "remarks", label: "Remarks" },
    ];
    const bySheet = {
      Projects: [
        { key: "code", label: "Code" }, { key: "name", label: "Project Name" },
        { key: "client", label: "Client" }, { key: "location", label: "Location" },
        { key: "startDate", label: "Start", render: r => F.fmtDate(r.startDate), nowrap: true },
        { key: "endDate", label: "End", render: r => F.fmtDate(r.endDate), nowrap: true },
        { key: "manager", label: "Manager" }, { key: "status", label: "Status", render: r => pill(r.status) },
        { key: "remarks", label: "Remarks" },
      ],
      Shops: [
        { key: "name", label: "Shop Name" }, { key: "location", label: "Location" },
        { key: "supervisor", label: "Supervisor" }, { key: "status", label: "Status", render: r => pill(r.status) },
        { key: "remarks", label: "Remarks" },
      ],
      ExpenseHeads: [
        { key: "name", label: "Expense Head" }, { key: "category", label: "Category" },
        { key: "status", label: "Status", render: r => pill(r.status) }, { key: "remarks", label: "Remarks" },
      ],
      Materials: [
        { key: "name", label: "Material / Item" }, { key: "category", label: "Category" },
        { key: "unit", label: "Unit", render: r => F.nameOf(root.API.store.masters.Units, r.unit) },
        { key: "standardRate", label: "Standard Rate", align: "right", render: r => money(r.standardRate) },
        { key: "status", label: "Status", render: r => pill(r.status) }, { key: "remarks", label: "Remarks" },
      ],
      Units: [
        { key: "name", label: "Unit Name" }, { key: "abbrev", label: "Abbrev." },
        { key: "status", label: "Status", render: r => pill(r.status) }, { key: "remarks", label: "Remarks" },
      ],
      Suppliers: [
        { key: "name", label: "Supplier" }, { key: "contactPerson", label: "Contact" }, { key: "phone", label: "Phone", nowrap: true },
        { key: "email", label: "Email" }, { key: "tin", label: "TIN", nowrap: true },
        { key: "status", label: "Status", render: r => pill(r.status) },
      ],
      Customers: [
        { key: "name", label: "Customer" }, { key: "contactPerson", label: "Contact" }, { key: "phone", label: "Phone", nowrap: true },
        { key: "email", label: "Email" }, { key: "tin", label: "TIN", nowrap: true },
        { key: "status", label: "Status", render: r => pill(r.status) },
      ],
    };
    void common;
    return bySheet[sheet];
  }

  /* ---------------- add / edit form ---------------- */
  function openForm(container, row) {
    const store = root.API.store;
    const sheet = state.sheet;
    const meta = META[sheet];
    const isEdit = !!row;
    const d = row || { status: "Active" };

    let body = "";
    if (sheet === "Projects") {
      body = `
        <div class="form-grid">
          ${CMP.field("Project Code", CMP.textInput("code", d.code, { required: true, placeholder: "e.g. NX-2026-007" }), { required: true })}
          ${CMP.field("Status", `<select class="input" name="status"><option>Planning</option><option>Active</option><option>On Hold</option><option>Completed</option></select>`, { required: true })}
          ${CMP.field("Project Name", CMP.textInput("name", d.name, { required: true, placeholder: "e.g. Area 49 Clinic Extension" }), { required: true, span: 2 })}
          ${CMP.field("Client", CMP.textInput("client", d.client, { placeholder: "e.g. Ministry of Health" }))}
          ${CMP.field("Location", CMP.textInput("location", d.location, { placeholder: "Area, City" }))}
          ${CMP.field("Start Date", CMP.textInput("startDate", d.startDate, { type: "date" }))}
          ${CMP.field("End Date", CMP.textInput("endDate", d.endDate, { type: "date" }))}
          ${CMP.field("Project Manager", `<div data-sel="manager"></div>`)}
          ${CMP.field("Remarks", CMP.textAreaInput("remarks", d.remarks), { span: 2 })}
        </div>`;
    } else if (sheet === "Shops") {
      body = `
        <div class="form-grid">
          ${CMP.field("Shop Name", CMP.textInput("name", d.name, { required: true, placeholder: "e.g. Area 25 Site Store" }), { required: true, span: 2 })}
          ${CMP.field("Location", CMP.textInput("location", d.location, { placeholder: "Area, City" }))}
          ${CMP.field("Supervisor", CMP.textInput("supervisor", d.supervisor, { placeholder: "Staff name" }))}
          ${CMP.field("Status", `<select class="input" name="status"><option>Active</option><option>Inactive</option></select>`, { required: true })}
          ${CMP.field("Remarks", CMP.textAreaInput("remarks", d.remarks), { span: 2 })}
        </div>`;
    } else if (sheet === "ExpenseHeads") {
      body = `
        <div class="form-grid">
          ${CMP.field("Expense Head Name", CMP.textInput("name", d.name, { required: true, placeholder: "e.g. Concrete Works" }), { required: true, span: 2 })}
          ${CMP.field("Category", `<select class="input" name="category"><option>Direct</option><option>Labour</option><option>Equipment</option><option>Subcontract</option><option>Overhead</option><option>Other</option></select>`)}
          ${CMP.field("Status", `<select class="input" name="status"><option>Active</option><option>Inactive</option></select>`, { required: true })}
          ${CMP.field("Remarks", CMP.textAreaInput("remarks", d.remarks), { span: 2 })}
        </div>`;
    } else if (sheet === "Materials") {
      body = `
        <div class="form-grid">
          ${CMP.field("Material / Item Name", CMP.textInput("name", d.name, { required: true, placeholder: "e.g. Portland Cement 42.5R" }), { required: true, span: 2 })}
          ${CMP.field("Category", CMP.textInput("category", d.category, { placeholder: "e.g. Construction Materials" }))}
          ${CMP.field("Unit", `<div data-sel="unit"></div>`, { required: true })}
          ${CMP.field("Standard Rate (MK)", CMP.textInput("standardRate", d.standardRate, { type: "number", step: "0.01", placeholder: "0.00" }))}
          ${CMP.field("Status", `<select class="input" name="status"><option>Active</option><option>Inactive</option></select>`, { required: true })}
          ${CMP.field("Remarks", CMP.textAreaInput("remarks", d.remarks), { span: 2 })}
        </div>`;
    } else if (sheet === "Units") {
      body = `
        <div class="form-grid">
          ${CMP.field("Unit Name", CMP.textInput("name", d.name, { required: true, placeholder: "e.g. Cubic Metre" }), { required: true })}
          ${CMP.field("Abbreviation", CMP.textInput("abbrev", d.abbrev, { placeholder: "e.g. m³" }))}
          ${CMP.field("Status", `<select class="input" name="status"><option>Active</option><option>Inactive</option></select>`, { required: true })}
          ${CMP.field("Remarks", CMP.textAreaInput("remarks", d.remarks), { span: 2 })}
        </div>`;
    } else if (sheet === "Suppliers" || sheet === "Customers") {
      body = `
        <div class="form-grid">
          ${CMP.field("Name", CMP.textInput("name", d.name, { required: true, placeholder: "Company / individual name" }), { required: true, span: 2 })}
          ${CMP.field("Contact Person", CMP.textInput("contactPerson", d.contactPerson))}
          ${CMP.field("Phone", CMP.textInput("phone", d.phone, { placeholder: "+265 …" }))}
          ${CMP.field("Email", CMP.textInput("email", d.email, { type: "email" }))}
          ${CMP.field("TIN", CMP.textInput("tin", d.tin, { placeholder: "Taxpayer ID No." }))}
          ${CMP.field("Address", CMP.textInput("address", d.address))}
          ${CMP.field("Status", `<select class="input" name="status"><option>Active</option><option>Inactive</option></select>`, { required: true })}
          ${CMP.field("Remarks", CMP.textAreaInput("remarks", d.remarks), { span: 2 })}
        </div>`;
    }

    UI.openModal(body, {
      title: `${isEdit ? "Edit" : "Add"} ${meta.label.slice(0, -1)}`,
      subtitle: "Duplicate names/codes are blocked automatically.",
      footer: `${UI.BTN.cancel} ${UI.BTN.save}`,
    });

    const form = UI.modalEl().querySelector(".form-grid");
    CMP.setFormData(form, d);

    // custom search-as-you-go selects
    if (sheet === "Materials") {
      const unitSel = CMP.searchSelect({
        items: (store.masters.Units || []).map(u => ({ id: u.id, label: u.name, sub: u.abbrev })),
        value: d.unit || "", placeholder: "Type unit to search…", required: true,
        emptyText: "No unit found — add it under Masters → Units first.",
      });
      form.querySelector('[data-sel="unit"]').appendChild(unitSel.wrap);
      form._unitSel = unitSel;
    }
    if (sheet === "Projects") {
      const mgrSel = CMP.searchSelect({
        items: (store.users || []).map(u => ({ id: u.name, label: u.name, sub: u.role })),
        value: d.manager || "", placeholder: "Type to search…", allowClear: true,
      });
      form.querySelector('[data-sel="manager"]').appendChild(mgrSel.wrap);
      form._mgrSel = mgrSel;
    }

    UI.attachActions(UI.modalEl(), async act => {
      if (act === "cancel") UI.closeModal();
      else if (act === "save") {
        const data = CMP.formData(form);
        if (form._unitSel) data.unit = form._unitSel.value;
        if (form._mgrSel) data.manager = form._mgrSel.value;
        data.name = String(data.name || "").trim();
        data.code = String(data.code || "").trim();
        data.abbrev = String(data.abbrev || "").trim();
        if (sheet === "Projects" && !data.code) { CMP.fieldError("code", "Project code is required"); return; }
        if (!data.name) { CMP.fieldError("name", "Name is required"); return; }
        if (sheet === "Materials" && !data.unit) { return; }

        const saveBtn = UI.modalEl().querySelector('[data-act="save"]');
        saveBtn.disabled = true;
        const res = await root.API.call("saveMaster", { sheet, id: isEdit ? row.id : null, data });
        saveBtn.disabled = false;
        if (res && res.ok) {
          UI.toast(`${meta.label.slice(0, -1)} saved.`, "success");
          store.masters[sheet] = res.data.rows || [];
          store.version = res.data.version != null ? res.data.version : store.version;
          UI.closeModal();
          render(container);
        } else if (res && res.error) {
          if (res.error.field) CMP.fieldError(res.error.field, res.error.message);
          else UI.toast(res.error.message, "error", { ms: 7000 });
        }
      }
    });
  }

  async function doDelete(container, id) {
    const store = root.API.store;
    const sheet = state.sheet;
    const row = F.byId(store.masters[sheet], id);
    if (!row) return;
    const ok = await UI.confirmDialog({
      danger: true,
      title: `Delete ${META[sheet].label.slice(0, -1)}?`,
      message: `“${row.name}” will be removed. Records already used in budget / contracts / expenses cannot be deleted — set them to “Inactive” instead.`,
      okLabel: "Delete",
    });
    if (!ok) return;
    const res = await root.API.call("deleteMaster", { sheet, id });
    if (res && res.ok) {
      UI.toast("Record deleted.", "success");
      store.masters[sheet] = res.data.rows || [];
      render(container);
    } else if (res && res.error) {
      UI.toast(res.error.message, "error", { ms: 7000 });
    }
  }

  function printMasters() {
    const store = root.API.store;
    const meta = META[state.sheet];
    const cols = columnsFor(state.sheet);
    const rows = filteredRows();
    root.App.printReport(`Masters — ${meta.label}`, root.App.printTable(cols, rows));
  }

  function exportMasters() {
    const meta = META[state.sheet];
    const cols = columnsFor(state.sheet).map(c => ({ key: c.key, label: c.label, value: r => r[c.key] }));
    F.exportCSV(`nexora-masters-${state.sheet.toLowerCase()}-${F.todayISO()}.csv`, cols, filteredRows());
  }

  root.Pages = root.Pages || {};
  root.Pages.masters = { render, title: "Masters" };
})(typeof window !== "undefined" ? window : globalThis);
