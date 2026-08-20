/* ============================================================
   NEXORA CMS — Budget page (Step 2 of the data-entry workflow)
   Strict rules: duplicate combos blocked; lines with expenses
   are locked (project/head/material/shop/unit) and cannot be
   reduced below what is already consumed.
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt, UI = root.UI, CMP = root.CMP, RC = root.RC;

  const state = { filters: { projectId: "", headId: "", materialId: "", shopId: "", budgetStatus: "" } };

  function render(container, params) {
    const store = root.API.store;
    const f = state.filters;
    const budget = RC.enrichBudget(store);
    const fb = RC.filterBudget(budget, f);

    container.innerHTML = `
      ${UI.pageToolbar("Budget Entries", "Step 2 — approve the budget line by line. Expenses can ONLY be posted against these lines.", [
        UI.BTN.home, UI.BTN.back, UI.BTN.refresh, UI.BTN.filters, UI.BTN.print, UI.BTN.export,
        root.App.can("create") ? UI.BTN.add("Add Budget Line") : "",
      ], { crumbs: ["Budget"] })}

      <div class="filterbar" id="budget-filters">
        <div class="fb-item" data-f="projectId"></div>
        <div class="fb-item" data-f="headId"></div>
        <div class="fb-item" data-f="materialId"></div>
        <div class="fb-item" data-f="shopId"></div>
        <div class="fb-item"><label>Status</label>
          <select class="input" id="b-status"><option value="">All</option><option value="Approved">Approved</option><option value="Hold">Hold</option></select>
        </div>
        <div class="fb-item fb-actions"><button class="btn btn-ghost" data-act="clear">${UI.icon("close", 14)} Clear</button></div>
      </div>

      <div id="budget-summary"></div>
      <div class="panel"><div class="panel-body" id="budget-table-host"></div></div>`;

    const projItems = [{ id: "", label: "All projects" }].concat((store.masters.Projects || []).map(p => ({ id: p.id, label: p.name, sub: p.code })));
    const headItems = [{ id: "", label: "All heads" }].concat((store.masters.ExpenseHeads || []).map(h => ({ id: h.id, label: h.name, sub: h.category })));
    const matItems = [{ id: "", label: "All materials" }].concat((store.masters.Materials || []).map(m => ({ id: m.id, label: m.name, sub: m.category })));
    const shopItems = [{ id: "", label: "All shops" }].concat((store.masters.Shops || []).map(s => ({ id: s.id, label: s.name, sub: s.location })));

    const mk = (el, items, val, key, label) => {
      const host = container.querySelector(`[data-f="${el}"]`);
      if (!host) return;
      const l = document.createElement("label");
      l.textContent = label;
      host.appendChild(l);
      const sel = CMP.searchSelect({ items, value: val || "", placeholder: "Type to search…", onSelect: it => { state.filters[key] = it ? it.id : ""; render(container); } });
      host.appendChild(sel.wrap);
    };
    mk("projectId", projItems, f.projectId, "projectId", "Project");
    mk("headId", headItems, f.headId, "headId", "Expense Head");
    mk("materialId", matItems, f.materialId, "materialId", "Material");
    mk("shopId", shopItems, f.shopId, "shopId", "Shop");
    const stSel = container.querySelector("#b-status");
    stSel.value = f.budgetStatus || "";
    stSel.addEventListener("change", e => { state.filters.budgetStatus = e.target.value; render(container); });

    UI.attachActions(container, async (act, btn) => {
      if (act === "add") openForm(container, null);
      else if (act === "edit") openForm(container, F.byId(store.budget, btn.dataset.id));
      else if (act === "delete") await doDelete(container, btn.dataset.id);
      else if (act === "clear") { state.filters = { projectId: "", headId: "", materialId: "", shopId: "", budgetStatus: "" }; render(container); }
      else if (act === "filters") { const el = container.querySelector("#budget-filters"); el.style.display = el.style.display === "none" ? "grid" : "none"; }
      else if (act === "refresh") { await root.API.refreshEntity("budget", true); render(container); }
      else if (act === "print") printBudget();
      else if (act === "export") exportBudget();
      else if (act === "home") location.hash = "#/dashboard";
      else if (act === "back") history.back();
    });

    drawSummary(fb);
    buildTable(container, fb);
    if (params && params.new) setTimeout(() => openForm(container, null), 120);
  }

  function drawSummary(fb) {
    const host = document.getElementById("budget-summary");
    if (!host) return;
    const approved = fb.filter(b => b.status === "Approved");
    const consumed = F.sum(fb, b => b.consumedAmount);
    const remaining = F.sum(approved, b => b.amount) - consumed;
    host.innerHTML = CMP.summaryStrip([
      { label: "Budget lines", value: String(fb.length) },
      { label: "Approved budget", value: F.money(F.sum(approved, b => F.num(b.amount))) },
      { label: "Consumed (expenses)", value: F.money(consumed), tone: "warn" },
      { label: "Remaining", value: F.money(remaining), tone: remaining < 0 ? "bad" : "ok" },
      { label: "On Hold", value: String(fb.filter(b => b.status === "Hold").length) },
      { label: "Over-budget lines", value: String(fb.filter(b => b.pctUsed > 100.005).length), tone: "bad" },
    ]);
  }

  function buildTable(container, fb) {
    const store = root.API.store;
    const host = container.querySelector("#budget-table-host");
    host.innerHTML = "";
    const table = CMP.dataTable({
      defaultSort: "pctUsed",
      columns: [
        { key: "projectId", label: "Project", render: r => F.nameOf(store.masters.Projects, r.projectId) },
        { key: "headId", label: "Expense Head", render: r => F.nameOf(store.masters.ExpenseHeads, r.headId) },
        { key: "materialId", label: "Material / Item", render: r => `<b>${F.esc(F.nameOf(store.masters.Materials, r.materialId))}</b>` },
        { key: "shopId", label: "Shop", render: r => F.nameOf(store.masters.Shops, r.shopId) },
        { key: "qty", label: "Qty", align: "right", render: r => `<span class="num">${F.qty(r.qty)}</span>` },
        { key: "unitId", label: "Unit", render: r => F.nameOf(store.masters.Units, r.unitId, ""), nowrap: true },
        { key: "rate", label: "Rate", align: "right", render: r => `<span class="num">${F.money(r.rate)}</span>` },
        { key: "amount", label: "Budget", align: "right", render: r => `<span class="num">${F.money(r.amount)}</span>` },
        { key: "consumedAmount", label: "Consumed", align: "right", render: r => `<span class="num ${r.consumedAmount > r.amount ? "neg" : ""}">${F.money(r.consumedAmount)}</span>` },
        { key: "remainingAmount", label: "Remaining", align: "right", render: r => `<span class="num ${r.remainingAmount < 0 ? "neg" : ""}">${F.money(r.remainingAmount)}</span>` },
        { key: "pctUsed", label: "Used", align: "right", render: r => `<div class="pbar-cell">${CMP.progressBar(r.pctUsed, r.tone === "Over" ? "bad" : r.tone === "Near" ? "warn" : "ok")}<span class="pbar-pct">${F.pct(r.pctUsed)}</span></div>` },
        { key: "status", label: "Status", render: r => UI.pill(r.status) },
      ],
      rows: fb,
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

  /* ---------------- add / edit form ---------------- */
  function openForm(container, row) {
    const store = root.API.store;
    const isEdit = !!row;
    const d = row || { status: "Approved", qty: 1, rate: 0 };
    const consumed = row ? F.byId(RC.enrichBudget(store), row.id) : null;
    const locked = !!(consumed && (consumed.consumedQty > 0 || consumed.consumedAmount > 0));

    UI.openModal(`
      ${locked ? `<div class="notice warn">${UI.icon("lock", 15)} This line already has <b>${F.money(consumed.consumedAmount)}</b> consumed — project, head, material, shop &amp; unit are locked, and quantities cannot go below what is already used.</div>` : ""}
      <div class="form-grid">
        ${CMP.field("Project", `<div data-sel="projectId"></div>`, { required: true, span: 2 })}
        ${CMP.field("Expense Head", `<div data-sel="headId"></div>`, { required: true })}
        ${CMP.field("Shop", `<div data-sel="shopId"></div>`, { required: true })}
        ${CMP.field("Material / Item", `<div data-sel="materialId"></div>`, { required: true })}
        <div class="field"><label>Unit (from material)</label><input class="input" id="b-unit-ro" readonly value="—"/><div class="field-hint">Set on the material master</div></div>
        ${CMP.field("Quantity", CMP.textInput("qty", d.qty, { type: "number", step: "any", min: "0", required: true }), { required: true })}
        ${CMP.field("Rate (MK)", CMP.textInput("rate", d.rate, { type: "number", step: "any", min: "0", required: true }), { required: true })}
        ${CMP.field("Amount (MK)", CMP.textInput("amount", d.amount, { readonly: true }))}
        ${CMP.field("Status", `<select class="input" name="status"><option value="Approved">Approved</option><option value="Hold">Hold</option></select>`)}
        ${CMP.field("Notes", CMP.textAreaInput("notes", d.notes), { span: 2 })}
      </div>
      <div class="notice info">${UI.icon("info", 15)} Expenses can only be entered against <b>Approved</b> lines, and duplicate (project + head + material + shop) combinations are blocked.</div>
    `, {
      title: `${isEdit ? "Edit" : "Add"} Budget Line`,
      subtitle: "Step 2 of the workflow — plan the budget before spending.",
      footer: `${UI.BTN.cancel} ${UI.BTN.save}`,
    });

    const modal = UI.modalEl();
    const form = modal.querySelector(".form-grid");
    const matSel = CMP.searchSelect({
      items: (store.masters.Materials || []).map(m => ({ id: m.id, label: m.name, sub: `${m.category} · ${F.nameOf(store.masters.Units, m.unit)}` })),
      value: d.materialId || "", placeholder: "Type material to search…", required: true,
      emptyText: "No material found — add it under Masters → Materials first.",
      disabled: locked,
      onSelect: it => {
        if (!it) return;
        const m = F.byId(store.masters.Materials, it.id);
        const unitEl = form.querySelector("#b-unit-ro");
        if (unitEl) unitEl.value = m ? F.nameOf(store.masters.Units, m.unit) : "—";
        if (m && m.standardRate && !form.querySelector('[name="rate"]').value) form.querySelector('[name="rate"]').value = m.standardRate;
        recalc();
      },
    });
    form.querySelector('[data-sel="materialId"]').appendChild(matSel.wrap);

    const projSel = CMP.searchSelect({
      items: (store.masters.Projects || []).map(p => ({ id: p.id, label: p.name, sub: `${p.code} · ${p.client}` })),
      value: d.projectId || "", placeholder: "Type project to search…", required: true, disabled: locked,
    });
    form.querySelector('[data-sel="projectId"]').appendChild(projSel.wrap);
    const headSel = CMP.searchSelect({
      items: (store.masters.ExpenseHeads || []).map(h => ({ id: h.id, label: h.name, sub: h.category })),
      value: d.headId || "", placeholder: "Type head to search…", required: true, disabled: locked,
    });
    form.querySelector('[data-sel="headId"]').appendChild(headSel.wrap);
    const shopSel = CMP.searchSelect({
      items: (store.masters.Shops || []).map(s => ({ id: s.id, label: s.name, sub: s.location })),
      value: d.shopId || "", placeholder: "Type shop to search…", required: true, disabled: locked,
    });
    form.querySelector('[data-sel="shopId"]').appendChild(shopSel.wrap);

    if (d.materialId) {
      const m = F.byId(store.masters.Materials, d.materialId);
      form.querySelector("#b-unit-ro").value = m ? F.nameOf(store.masters.Units, m.unit) : "—";
    }

    function recalc() {
      const qty = F.num(form.querySelector('[name="qty"]').value);
      const rate = F.num(form.querySelector('[name="rate"]').value);
      form.querySelector('[name="amount"]').value = (qty * rate).toFixed(2);
    }
    form.querySelector('[name="qty"]').addEventListener("input", recalc);
    form.querySelector('[name="rate"]').addEventListener("input", recalc);
    recalc();

    UI.attachActions(modal, async act => {
      if (act === "cancel") UI.closeModal();
      else if (act === "save") {
        const data = CMP.formData(form);
        data.projectId = projSel.value;
        data.headId = headSel.value;
        data.materialId = matSel.value;
        data.shopId = shopSel.value;
        if (!data.projectId) { projSel.setError("Required"); return; }
        if (!data.headId) { headSel.setError("Required"); return; }
        if (!data.materialId) { matSel.setError("Required"); return; }
        if (!data.shopId) { shopSel.setError("Required"); return; }
        if (F.num(data.qty) <= 0) { CMP.fieldError("qty", "Quantity must be greater than zero"); return; }
        if (F.num(data.rate) <= 0) { CMP.fieldError("rate", "Rate must be greater than zero"); return; }

        const saveBtn = modal.querySelector('[data-act="save"]');
        saveBtn.disabled = true;
        const res = await root.API.call("saveBudgetLine", { id: isEdit ? row.id : null, data });
        saveBtn.disabled = false;
        if (res && res.ok) {
          UI.toast("Budget line saved.", "success");
          store.budget = res.data.rows || [];
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
    const row = F.byId(store.budget, id);
    if (!row) return;
    const consumed = F.byId(RC.enrichBudget(store), id);
    if (consumed && (consumed.consumedQty > 0 || consumed.consumedAmount > 0)) {
      UI.toast("This budget line already has expenses against it and cannot be deleted. Set its status to “Hold” instead.", "error", { ms: 7000 });
      return;
    }
    const ok = await UI.confirmDialog({ danger: true, title: "Delete budget line?", message: `The line for “${F.nameOf(store.masters.Materials, row.materialId)}” will be removed.`, okLabel: "Delete" });
    if (!ok) return;
    const res = await root.API.call("deleteBudgetLine", { id });
    if (res && res.ok) {
      UI.toast("Budget line deleted.", "success");
      store.budget = res.data.rows || [];
      render(container);
    } else if (res && res.error) UI.toast(res.error.message, "error", { ms: 7000 });
  }

  function rowsForPrint() {
    const store = root.API.store;
    return RC.filterBudget(RC.enrichBudget(store), state.filters);
  }

  function printBudget() {
    const store = root.API.store;
    const rows = rowsForPrint();
    const cols = [
      { key: "projectId", label: "Project", render: r => F.nameOf(store.masters.Projects, r.projectId) },
      { key: "headId", label: "Head", render: r => F.nameOf(store.masters.ExpenseHeads, r.headId) },
      { key: "materialId", label: "Material", render: r => F.nameOf(store.masters.Materials, r.materialId) },
      { key: "shopId", label: "Shop", render: r => F.nameOf(store.masters.Shops, r.shopId) },
      { key: "qty", label: "Qty", render: r => F.qty(r.qty) },
      { key: "rate", label: "Rate", render: r => F.money(r.rate) },
      { key: "amount", label: "Budget", render: r => F.money(r.amount) },
      { key: "consumedAmount", label: "Consumed", render: r => F.money(r.consumedAmount) },
      { key: "remainingAmount", label: "Remaining", render: r => F.money(r.remainingAmount) },
      { key: "pctUsed", label: "Used %", render: r => F.pct(r.pctUsed) },
    ];
    root.App.printReport("Budget Register", root.App.printTable(cols, rows));
  }

  function exportBudget() {
    const store = root.API.store;
    const rows = rowsForPrint();
    F.exportCSV(`nexora-budget-${F.todayISO()}.csv`, [
      { key: "project", label: "Project", value: r => F.nameOf(store.masters.Projects, r.projectId) },
      { key: "head", label: "Expense Head", value: r => F.nameOf(store.masters.ExpenseHeads, r.headId) },
      { key: "material", label: "Material", value: r => F.nameOf(store.masters.Materials, r.materialId) },
      { key: "shop", label: "Shop", value: r => F.nameOf(store.masters.Shops, r.shopId) },
      { key: "qty", label: "Qty", value: r => r.qty },
      { key: "unit", label: "Unit", value: r => F.nameOf(store.masters.Units, r.unitId) },
      { key: "rate", label: "Rate", value: r => r.rate },
      { key: "amount", label: "Budget Amount", value: r => r.amount },
      { key: "consumed", label: "Consumed", value: r => r.consumedAmount },
      { key: "remaining", label: "Remaining", value: r => r.remainingAmount },
      { key: "status", label: "Status", value: r => r.status },
    ], rows);
  }

  root.Pages = root.Pages || {};
  root.Pages.budget = { render, title: "Budget" };
})(typeof window !== "undefined" ? window : globalThis);
