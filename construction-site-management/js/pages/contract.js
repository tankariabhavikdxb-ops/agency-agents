/* ============================================================
   NEXORA CMS — Contracts / LPO / Sales Invoices (Step 3)
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt, UI = root.UI, CMP = root.CMP, RC = root.RC;

  const TYPE_STATUS = {
    "Contract Value": ["Awarded", "In Progress", "Completed", "Terminated"],
    "Sales Invoice": ["Issued", "Cancelled"],
    "LPO": ["Open", "Partially Received", "Received", "Cancelled"],
  };
  const TYPES = Object.keys(TYPE_STATUS);

  const state = { filters: { projectId: "", type: "", customerId: "", supplierId: "", status: "", from: "", to: "" } };

  function render(container, params) {
    const store = root.API.store;
    const f = state.filters;
    if (params && params.type && TYPES.includes(params.type)) state.filters.type = params.type;
    const fc = RC.filterContracts(RC.enrichContracts(store), f);
    const cs = RC.contractSums(RC.enrichContracts(store), f);

    container.innerHTML = `
      ${UI.pageToolbar("Contracts, LPOs & Invoices", "Step 3 — record contract values, sales invoices and local purchase orders (LPOs).", [
        UI.BTN.home, UI.BTN.back, UI.BTN.refresh, UI.BTN.filters, UI.BTN.print, UI.BTN.export,
        root.App.can("create") ? UI.BTN.add("Add Document") : "",
      ], { crumbs: ["Contracts & LPO"] })}

      <div class="type-tabs">
        <button class="mtab ${!f.type ? "on" : ""}" data-type="">All Types</button>
        ${TYPES.map(t => `<button class="mtab ${f.type === t ? "on" : ""}" data-type="${t}">${t}</button>`).join("")}
      </div>

      <div class="filterbar" id="ct-filters">
        <div class="fb-item" data-f="projectId"></div>
        <div class="fb-item" data-f="customerId"></div>
        <div class="fb-item" data-f="supplierId"></div>
        <div class="fb-item"><label>Status</label><select class="input" id="ct-status"><option value="">All</option>${[...new Set(Object.values(TYPE_STATUS).flat())].map(s => `<option>${s}</option>`).join("")}</select></div>
        <div class="fb-item"><label>From</label><input type="date" class="input" id="ct-from" value="${F.esc(f.from)}"/></div>
        <div class="fb-item"><label>To</label><input type="date" class="input" id="ct-to" value="${F.esc(f.to)}"/></div>
        <div class="fb-item fb-actions"><button class="btn btn-ghost" data-act="clear">${UI.icon("close", 14)} Clear</button></div>
      </div>

      ${CMP.summaryStrip([
        { label: "Contract Values", value: F.money(cs.contractValue), tone: "ok" },
        { label: "Sales Invoices", value: F.money(cs.salesInvoices), tone: "ok" },
        { label: "Collected", value: F.money(cs.collected), tone: "ok" },
        { label: "Outstanding", value: F.money(cs.receivable), tone: cs.receivable > 0 ? "bad" : "ok" },
        { label: "LPO Value", value: F.money(cs.lpo), tone: "warn" },
        { label: "Open LPO", value: F.money(cs.lpoOutstanding), tone: "warn" },
      ])}

      <div class="panel"><div class="panel-body" id="ct-table-host"></div></div>`;

    // tabs
    container.querySelectorAll(".type-tabs .mtab").forEach(b => b.addEventListener("click", () => {
      state.filters.type = b.dataset.type;
      render(container);
    }));

    const mk = (el, items, val, key, label) => {
      const host = container.querySelector(`[data-f="${el}"]`);
      if (!host) return;
      const l = document.createElement("label"); l.textContent = label; host.appendChild(l);
      const sel = CMP.searchSelect({ items, value: val || "", placeholder: "Type to search…", onSelect: it => { state.filters[key] = it ? it.id : ""; render(container); } });
      host.appendChild(sel.wrap);
    };
    mk("projectId", [{ id: "", label: "All projects" }].concat((store.masters.Projects || []).map(p => ({ id: p.id, label: p.name, sub: p.code }))), f.projectId, "projectId", "Project");
    mk("customerId", [{ id: "", label: "All customers" }].concat((store.masters.Customers || []).map(c => ({ id: c.id, label: c.name }))), f.customerId, "customerId", "Customer");
    mk("supplierId", [{ id: "", label: "All suppliers" }].concat((store.masters.Suppliers || []).map(s => ({ id: s.id, label: s.name }))), f.supplierId, "supplierId", "Supplier");

    const stSel = container.querySelector("#ct-status");
    stSel.value = f.status || "";
    stSel.addEventListener("change", e => { state.filters.status = e.target.value; render(container); });
    container.querySelector("#ct-from").addEventListener("change", e => { state.filters.from = e.target.value; render(container); });
    container.querySelector("#ct-to").addEventListener("change", e => { state.filters.to = e.target.value; render(container); });

    UI.attachActions(container, async (act, btn) => {
      if (act === "add") openForm(container, null, state.filters.type || "Sales Invoice");
      else if (act === "edit") openForm(container, F.byId(store.contracts, btn.dataset.id), null);
      else if (act === "delete") await doDelete(container, btn.dataset.id);
      else if (act === "clear") { state.filters = { projectId: "", type: "", customerId: "", supplierId: "", status: "", from: "", to: "" }; render(container); }
      else if (act === "filters") { const el = container.querySelector("#ct-filters"); el.style.display = el.style.display === "none" ? "grid" : "none"; }
      else if (act === "refresh") { await root.API.refreshEntity("contracts", true); render(container); }
      else if (act === "print") printContracts();
      else if (act === "export") exportContracts();
      else if (act === "home") location.hash = "#/dashboard";
      else if (act === "back") history.back();
    });

    buildTable(container, fc);
    if (params && params.new) setTimeout(() => openForm(container, null, params.type || "Sales Invoice"), 120);
  }

  function buildTable(container, rows) {
    const store = root.API.store;
    const host = container.querySelector("#ct-table-host");
    host.innerHTML = "";
    const table = CMP.dataTable({
      defaultSort: "date",
      columns: [
        { key: "refNo", label: "Ref No.", render: r => `<b>${F.esc(r.refNo)}</b>`, nowrap: true },
        { key: "type", label: "Type", render: r => UI.pill(r.type, r.type === "LPO" ? "warn" : r.type === "Contract Value" ? "info" : "ok") },
        { key: "date", label: "Date", render: r => F.fmtDate(r.date), nowrap: true },
        { key: "projectId", label: "Project", render: r => F.nameOf(store.masters.Projects, r.projectId) },
        { key: "party", label: "Customer / Supplier", render: r => r.type === "LPO" ? F.nameOf(store.masters.Suppliers, r.supplierId) : F.nameOf(store.masters.Customers, r.customerId) },
        { key: "description", label: "Description" },
        { key: "amount", label: "Amount", align: "right", render: r => `<span class="num">${F.money(r.amount)}</span>` },
        { key: "vatAmount", label: "VAT", align: "right", render: r => `<span class="num">${F.money(r.vatAmount)}</span>` },
        { key: "total", label: "Total", align: "right", render: r => `<span class="num bold">${F.money(r.total)}</span>` },
        { key: "status", label: "Status", render: r => UI.pill(r.status) },
        { key: "paymentStatus", label: "Payment", render: r => UI.pill(r.paymentStatus) },
      ],
      rows,
      onAction: (act, row) => {
        if (act === "edit") openForm(container, row, null);
        else if (act === "delete") doDelete(container, row.id);
      },
      actions: [
        { act: "edit", icon: "edit", title: "Edit", show: () => root.App.can("edit") },
        { act: "delete", icon: "trash", title: "Delete", danger: true, show: () => root.App.can("delete") },
      ],
    });
    host.appendChild(table.wrap);
  }

  function openForm(container, row, presetType) {
    const store = root.API.store;
    const isEdit = !!row;
    const d = row || {
      type: presetType || "Sales Invoice", date: F.todayISO(), vatRate: F.num(store.settings.defaultVAT),
      amount: 0, status: (TYPE_STATUS[presetType || "Sales Invoice"] || ["Issued"])[0], paymentStatus: "Unpaid",
    };

    UI.openModal(`
      <div class="form-grid">
        ${CMP.field("Document Type", `<select class="input" name="type">${TYPES.map(t => `<option>${t}</option>`).join("")}</select>`, { required: true })}
        ${CMP.field("Ref No.", CMP.textInput("refNo", d.refNo, { required: true, placeholder: "e.g. INV-2026-007" }), { required: true })}
        ${CMP.field("Date", CMP.textInput("date", d.date, { type: "date", required: true }), { required: true })}
        ${CMP.field("Project", `<div data-sel="projectId"></div>`, { required: true, span: 2 })}
        ${CMP.field("Customer", `<div data-sel="customerId"></div>`, { required: true })}
        ${CMP.field("Supplier", `<div data-sel="supplierId"></div>`)}
        ${CMP.field("Description", CMP.textInput("description", d.description, { placeholder: "e.g. IPC No. 3 — roof works" }), { span: 2 })}
        ${CMP.field("Amount excl. VAT (MK)", CMP.textInput("amount", d.amount, { type: "number", step: "0.01", min: "0", required: true }), { required: true })}
        ${CMP.field("VAT %", CMP.textInput("vatRate", d.vatRate, { type: "number", step: "0.01", min: "0" }))}
        ${CMP.field("VAT Amount (MK)", CMP.textInput("vatAmount", d.vatAmount, { readonly: true }))}
        ${CMP.field("Total (MK)", CMP.textInput("total", d.total, { readonly: true }))}
        ${CMP.field("Status", `<select class="input" name="status"></select>`)}
        ${CMP.field("Payment Status", `<select class="input" name="paymentStatus"><option>Unpaid</option><option>Partially Paid</option><option>Paid</option></select>`)}
        ${CMP.field("Remarks", CMP.textAreaInput("remarks", d.remarks), { span: 2 })}
      </div>
      <div class="notice info">${UI.icon("info", 15)} Reference numbers must be unique per document type — duplicates are blocked automatically.</div>
    `, {
      title: `${isEdit ? "Edit" : "Add"} Contract / LPO / Invoice`,
      subtitle: "Step 3 of the workflow.",
      footer: `${UI.BTN.cancel} ${UI.BTN.save}`,
    });

    const modal = UI.modalEl();
    const form = modal.querySelector(".form-grid");
    CMP.setFormData(form, d);

    const projSel = CMP.searchSelect({
      items: (store.masters.Projects || []).map(p => ({ id: p.id, label: p.name, sub: `${p.code} · ${p.client}` })),
      value: d.projectId || "", placeholder: "Type project to search…", required: true,
    });
    form.querySelector('[data-sel="projectId"]').appendChild(projSel.wrap);
    const custSel = CMP.searchSelect({
      items: (store.masters.Customers || []).map(c => ({ id: c.id, label: c.name, sub: c.tin || "" })),
      value: d.customerId || "", placeholder: "Type customer to search…", required: true,
      emptyText: "No customer found — add it under Masters → Customers first.",
    });
    form.querySelector('[data-sel="customerId"]').appendChild(custSel.wrap);
    const suppSel = CMP.searchSelect({
      items: (store.masters.Suppliers || []).map(s => ({ id: s.id, label: s.name, sub: s.tin || "" })),
      value: d.supplierId || "", placeholder: "Type supplier to search…",
      emptyText: "No supplier found — add it under Masters → Suppliers first.",
    });
    form.querySelector('[data-sel="supplierId"]').appendChild(suppSel.wrap);

    const typeSel = form.querySelector('[name="type"]');
    const statusSel = form.querySelector('[name="status"]');
    function fillStatus(type, keep) {
      const list = TYPE_STATUS[type] || ["Issued"];
      statusSel.innerHTML = list.map(s => `<option>${s}</option>`).join("");
      if (keep && list.includes(keep)) statusSel.value = keep;
    }
    fillStatus(typeSel.value, d.status);

    function recalc() {
      const amount = F.num(form.querySelector('[name="amount"]').value);
      const vatRate = F.num(form.querySelector('[name="vatRate"]').value);
      form.querySelector('[name="vatAmount"]').value = (amount * vatRate / 100).toFixed(2);
      form.querySelector('[name="total"]').value = (amount + amount * vatRate / 100).toFixed(2);
    }
    form.querySelector('[name="amount"]').addEventListener("input", recalc);
    form.querySelector('[name="vatRate"]').addEventListener("input", recalc);
    recalc();

    typeSel.addEventListener("change", () => {
      const isLPO = typeSel.value === "LPO";
      form.querySelector('[name="vatRate"]').value = isLPO ? "0" : String(F.num(store.settings.defaultVAT));
      recalc();
      fillStatus(typeSel.value, null);
    });

    UI.attachActions(modal, async act => {
      if (act === "cancel") UI.closeModal();
      else if (act === "save") {
        const data = CMP.formData(form);
        data.projectId = projSel.value;
        data.customerId = custSel.value;
        data.supplierId = suppSel.value;
        data.refNo = String(data.refNo || "").trim();
        const isLPO = data.type === "LPO";
        if (!data.projectId) { projSel.setError("Required"); return; }
        if (!isLPO && !data.customerId) { custSel.setError("Required for contracts / invoices"); return; }
        if (isLPO && !data.supplierId) { suppSel.setError("Required for LPOs"); return; }
        if (!data.refNo) { CMP.fieldError("refNo", "Reference number is required"); return; }
        if (F.num(data.amount) <= 0) { CMP.fieldError("amount", "Amount must be greater than zero"); return; }

        const saveBtn = modal.querySelector('[data-act="save"]');
        saveBtn.disabled = true;
        const res = await root.API.call("saveContract", { id: isEdit ? row.id : null, data });
        saveBtn.disabled = false;
        if (res && res.ok) {
          UI.toast("Document saved.", "success");
          store.contracts = res.data.rows || [];
          store.version = res.data.version != null ? res.data.version : store.version;
          UI.closeModal();
          render(container);
        } else if (res && res.error) {
          if (res.error.field) CMP.fieldError(res.error.field, res.error.message);
          else UI.toast(res.error.message, "error", { ms: 8000 });
        }
      }
    });
  }

  async function doDelete(container, id) {
    const store = root.API.store;
    const row = F.byId(store.contracts, id);
    if (!row) return;
    const ok = await UI.confirmDialog({ danger: true, title: `Delete ${row.type}?`, message: `“${row.refNo}” (${F.money(row.total)}) will be removed permanently.`, okLabel: "Delete" });
    if (!ok) return;
    const res = await root.API.call("deleteContract", { id });
    if (res && res.ok) {
      UI.toast("Document deleted.", "success");
      store.contracts = res.data.rows || [];
      render(container);
    } else if (res && res.error) UI.toast(res.error.message, "error", { ms: 7000 });
  }

  function rowsForPrint() {
    return RC.filterContracts(RC.enrichContracts(root.API.store), state.filters);
  }

  function printContracts() {
    const store = root.API.store;
    const rows = rowsForPrint();
    const cols = [
      { key: "refNo", label: "Ref No.", render: r => r.refNo },
      { key: "type", label: "Type", render: r => r.type },
      { key: "date", label: "Date", render: r => F.fmtDate(r.date) },
      { key: "projectId", label: "Project", render: r => F.nameOf(store.masters.Projects, r.projectId) },
      { key: "party", label: "Customer / Supplier", render: r => r.type === "LPO" ? F.nameOf(store.masters.Suppliers, r.supplierId) : F.nameOf(store.masters.Customers, r.customerId) },
      { key: "description", label: "Description", render: r => r.description },
      { key: "total", label: "Total (MK)", render: r => F.money(r.total) },
      { key: "status", label: "Status", render: r => r.status },
      { key: "paymentStatus", label: "Payment", render: r => r.paymentStatus },
    ];
    root.App.printReport("Contracts / LPO / Invoices Register", root.App.printTable(cols, rows));
  }

  function exportContracts() {
    const store = root.API.store;
    const rows = rowsForPrint();
    F.exportCSV(`nexora-contracts-${F.todayISO()}.csv`, [
      { key: "refNo", label: "Ref No.", value: r => r.refNo },
      { key: "type", label: "Type", value: r => r.type },
      { key: "date", label: "Date", value: r => r.date },
      { key: "project", label: "Project", value: r => F.nameOf(store.masters.Projects, r.projectId) },
      { key: "customer", label: "Customer", value: r => F.nameOf(store.masters.Customers, r.customerId) },
      { key: "supplier", label: "Supplier", value: r => F.nameOf(store.masters.Suppliers, r.supplierId) },
      { key: "description", label: "Description", value: r => r.description },
      { key: "amount", label: "Amount", value: r => r.amount },
      { key: "vat", label: "VAT", value: r => r.vatAmount },
      { key: "total", label: "Total", value: r => r.total },
      { key: "status", label: "Status", value: r => r.status },
      { key: "payment", label: "Payment Status", value: r => r.paymentStatus },
    ], rows);
  }

  root.Pages = root.Pages || {};
  root.Pages.contract = { render, title: "Contracts & LPO" };
})(typeof window !== "undefined" ? window : globalThis);
