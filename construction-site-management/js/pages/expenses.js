/* ============================================================
   NEXORA CMS — Actual Expenses (Step 4)
   STRICT CONTROL:
   • an expense can ONLY be posted against an APPROVED budget
     line of the selected project (no free-form entries)
   • over-budget entries are BLOCKED unless the Admin override
     is enabled in Settings AND a reason is given
   • duplicate invoice numbers per supplier+project are blocked
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt, UI = root.UI, CMP = root.CMP, RC = root.RC;

  const state = { filters: { projectId: "", headId: "", shopId: "", supplierId: "", paymentStatus: "", from: "", to: "", onlyOver: "" } };

  function render(container, params) {
    const store = root.API.store;
    const f = state.filters;
    const enriched = RC.enrichAll(store);
    const fe = RC.filterExpenses(enriched.expenses, f);

    container.innerHTML = `
      ${UI.pageToolbar("Actual Expenses", "Step 4 — post actual spend. Entries are ONLY allowed against approved budget lines — no new or additional expenses can be created here.", [
        UI.BTN.home, UI.BTN.back, UI.BTN.refresh, UI.BTN.filters, UI.BTN.print, UI.BTN.export,
        root.App.can("create") ? UI.BTN.add("Add Expense") : "",
      ], { crumbs: ["Expenses"] })}

      ${store.settings.allowOverBudget === "YES"
        ? `<div class="notice warn">${UI.icon("warn", 15)} Budget override is <b>ENABLED</b> — Admins may exceed a budget line with a documented reason. Disable it in Settings for strictest control.</div>`
        : `<div class="notice info">${UI.icon("lock", 15)} Strict mode — expenses above the remaining budget on a line are <b>blocked</b>.</div>`}

      <div class="filterbar" id="ex-filters">
        <div class="fb-item" data-f="projectId"></div>
        <div class="fb-item" data-f="headId"></div>
        <div class="fb-item" data-f="shopId"></div>
        <div class="fb-item" data-f="supplierId"></div>
        <div class="fb-item"><label>Payment</label><select class="input" id="ex-pay"><option value="">All</option><option>Unpaid</option><option>Partially Paid</option><option>Paid</option></select></div>
        <div class="fb-item"><label>From</label><input type="date" class="input" id="ex-from" value="${F.esc(f.from)}"/></div>
        <div class="fb-item"><label>To</label><input type="date" class="input" id="ex-to" value="${F.esc(f.to)}"/></div>
        <div class="fb-item"><label>&nbsp;</label><label class="checkline"><input type="checkbox" id="ex-over" ${f.onlyOver ? "checked" : ""}/> Over-budget only</label></div>
        <div class="fb-item fb-actions"><button class="btn btn-ghost" data-act="clear">${UI.icon("close", 14)} Clear</button></div>
      </div>

      ${CMP.summaryStrip([
        { label: "Entries", value: String(fe.length) },
        { label: "Total Expenses", value: F.money(F.sum(fe, e => e.amount)), tone: "warn" },
        { label: "This Month", value: F.money(F.sum(fe.filter(e => F.monthKey(e.date) === F.monthKey(F.todayISO())), e => e.amount)) },
        { label: "Pending Payment", value: F.money(F.sum(fe.filter(e => e.paymentStatus !== "Paid"), e => e.amount)), tone: "bad" },
        { label: "Over-budget (override)", value: String(fe.filter(e => e.override === "YES").length), tone: "warn" },
      ])}

      <div class="panel"><div class="panel-body" id="ex-table-host"></div></div>`;

    const mk = (el, items, val, key, label) => {
      const host = container.querySelector(`[data-f="${el}"]`);
      if (!host) return;
      const l = document.createElement("label"); l.textContent = label; host.appendChild(l);
      const sel = CMP.searchSelect({ items, value: val || "", placeholder: "Type to search…", onSelect: it => { state.filters[key] = it ? it.id : ""; render(container); } });
      host.appendChild(sel.wrap);
    };
    mk("projectId", [{ id: "", label: "All projects" }].concat((store.masters.Projects || []).map(p => ({ id: p.id, label: p.name }))), f.projectId, "projectId", "Project");
    mk("headId", [{ id: "", label: "All heads" }].concat((store.masters.ExpenseHeads || []).map(h => ({ id: h.id, label: h.name }))), f.headId, "headId", "Head");
    mk("shopId", [{ id: "", label: "All shops" }].concat((store.masters.Shops || []).map(s => ({ id: s.id, label: s.name }))), f.shopId, "shopId", "Shop");
    mk("supplierId", [{ id: "", label: "All suppliers" }].concat((store.masters.Suppliers || []).map(s => ({ id: s.id, label: s.name }))), f.supplierId, "supplierId", "Supplier");

    const paySel = container.querySelector("#ex-pay");
    paySel.value = f.paymentStatus || "";
    paySel.addEventListener("change", e => { state.filters.paymentStatus = e.target.value; render(container); });
    container.querySelector("#ex-from").addEventListener("change", e => { state.filters.from = e.target.value; render(container); });
    container.querySelector("#ex-to").addEventListener("change", e => { state.filters.to = e.target.value; render(container); });
    container.querySelector("#ex-over").addEventListener("change", e => { state.filters.onlyOver = e.target.checked ? "1" : ""; render(container); });

    UI.attachActions(container, async (act, btn) => {
      if (act === "add") openForm(container, null);
      else if (act === "edit") openForm(container, F.byId(store.expenses, btn.dataset.id));
      else if (act === "delete") await doDelete(container, btn.dataset.id);
      else if (act === "clear") { state.filters = { projectId: "", headId: "", shopId: "", supplierId: "", paymentStatus: "", from: "", to: "", onlyOver: "" }; render(container); }
      else if (act === "filters") { const el = container.querySelector("#ex-filters"); el.style.display = el.style.display === "none" ? "grid" : "none"; }
      else if (act === "refresh") { await root.API.refreshEntity("expenses", true); render(container); }
      else if (act === "print") printExpenses();
      else if (act === "export") exportExpenses();
      else if (act === "home") location.hash = "#/dashboard";
      else if (act === "back") history.back();
    });

    buildTable(container, fe);
    if (params && params.new) setTimeout(() => openForm(container, null), 120);
  }

  function buildTable(container, rows) {
    const host = container.querySelector("#ex-table-host");
    host.innerHTML = "";
    const table = CMP.dataTable({
      defaultSort: "date",
      columns: [
        { key: "date", label: "Date", render: r => F.fmtDate(r.date), nowrap: true },
        { key: "invoiceNo", label: "Invoice / Ref", render: r => `<b>${F.esc(r.invoiceNo || "—")}</b>`, nowrap: true },
        { key: "projectId", label: "Project", render: r => F.nameOf(root.API.store.masters.Projects, r.projectId) },
        { key: "headId", label: "Head", render: r => F.nameOf(root.API.store.masters.ExpenseHeads, r.headId) },
        { key: "materialId", label: "Material / Item", render: r => F.nameOf(root.API.store.masters.Materials, r.materialId) },
        { key: "shopId", label: "Shop", render: r => F.nameOf(root.API.store.masters.Shops, r.shopId) },
        { key: "supplierId", label: "Supplier", render: r => F.nameOf(root.API.store.masters.Suppliers, r.supplierId) },
        { key: "qty", label: "Qty", align: "right", render: r => `<span class="num">${F.qty(r.qty)}</span>` },
        { key: "rate", label: "Rate", align: "right", render: r => `<span class="num">${F.money(r.rate)}</span>` },
        { key: "amount", label: "Amount", align: "right", render: r => `<span class="num bold">${F.money(r.amount)}</span>` },
        { key: "paymentStatus", label: "Payment", render: r => UI.pill(r.paymentStatus) },
        { key: "override", label: "Budget", render: r => r.override === "YES" ? `<span class="pill bad" title="${F.esc(r.overrideReason || "")}">Over</span>` : `<span class="pill ok">Within</span>` },
      ],
      rows,
      onAction: (act, row) => {
        if (act === "edit") openForm(container, row);
        else if (act === "delete") doDelete(container, row.id);
      },
      actions: [
        { act: "edit", icon: "edit", title: "Edit", show: () => root.App.can("edit") },
        { act: "delete", icon: "trash", title: "Delete (reverses budget consumption)", danger: true, show: () => root.App.can("delete") },
      ],
    });
    host.appendChild(table.wrap);
  }

  /* ---------------- add / edit form (STRICT) ---------------- */
  function openForm(container, row) {
    const store = root.API.store;
    const isEdit = !!row;
    const d = row || { date: F.todayISO(), paymentStatus: "Unpaid", qty: 1, rate: 0 };
    const allowOverride = String(store.settings.allowOverBudget) === "YES" && store.user && store.user.role === "Admin";

    UI.openModal(`
      <div class="form-grid">
        ${CMP.field("Project", `<div data-sel="projectId"></div>`, { required: true, span: 2 })}
        ${CMP.field("Budget Line (approved only)", `<div data-sel="budgetId"></div>`, { required: true, span: 2, hint: "Expenses can ONLY be posted against existing approved budget lines." })}
        <div class="budget-info" id="budget-info"></div>
        ${CMP.field("Date", CMP.textInput("date", d.date, { type: "date", required: true }), { required: true })}
        ${CMP.field("Invoice / Ref No.", CMP.textInput("invoiceNo", d.invoiceNo, { placeholder: "Supplier invoice / delivery note" }))}
        ${CMP.field("Supplier", `<div data-sel="supplierId"></div>`, { required: true })}
        ${CMP.field("Payment Status", `<select class="input" name="paymentStatus"><option>Unpaid</option><option>Partially Paid</option><option>Paid</option></select>`)}
        ${CMP.field("Quantity", CMP.textInput("qty", d.qty, { type: "number", step: "any", min: "0", required: true }), { required: true })}
        ${CMP.field("Rate (MK)", CMP.textInput("rate", d.rate, { type: "number", step: "any", min: "0", required: true }), { required: true })}
        ${CMP.field("Amount (MK)", CMP.textInput("amount", d.amount, { readonly: true }))}
        ${allowOverride ? `
          <div class="override-box span2" id="override-box">
            <label class="checkline"><input type="checkbox" name="override" ${d.override === "YES" ? "checked" : ""}/> <b>Override budget limit</b> (Admin only)</label>
            <div class="field" id="override-reason-field"><label>Override reason <span class="req-star">*</span></label><textarea class="input" name="overrideReason" rows="2" placeholder="Why is this over-budget expense necessary?">${F.esc(d.overrideReason || "")}</textarea></div>
          </div>` : `
          <div class="notice info span2">${UI.icon("lock", 14)} Over-budget entries are <b>blocked</b>${allowOverride === false && String(store.settings.allowOverBudget) === "YES" ? " for your role" : ""}. Adjust the quantity or ask an Admin to enable override in Settings.</div>`}
        ${CMP.field("Remarks", CMP.textAreaInput("remarks", d.remarks), { span: 2 })}
      </div>
    `, {
      title: `${isEdit ? "Edit" : "Add"} Expense Entry`,
      subtitle: "Step 4 — the selected budget line defines the head, material, unit and shop.",
      footer: `${UI.BTN.cancel} ${UI.BTN.save}`,
    });

    const modal = UI.modalEl();
    const form = modal.querySelector(".form-grid");
    CMP.setFormData(form, d);

    const projSel = CMP.searchSelect({
      items: (store.masters.Projects || []).map(p => ({ id: p.id, label: p.name, sub: `${p.code} · ${p.client}` })),
      value: d.projectId || "", placeholder: "Type project to search…", required: true,
      onSelect: () => refreshBudgetItems(),
    });
    form.querySelector('[data-sel="projectId"]').appendChild(projSel.wrap);

    const suppSel = CMP.searchSelect({
      items: (store.masters.Suppliers || []).map(s => ({ id: s.id, label: s.name, sub: s.phone || "" })),
      value: d.supplierId || "", placeholder: "Type supplier to search…", required: true,
      emptyText: "No supplier found — add it under Masters → Suppliers first.",
    });
    form.querySelector('[data-sel="supplierId"]').appendChild(suppSel.wrap);

    let budgetSel = null;

    function budgetItems() {
      const pid = projSel.value;
      const budget = RC.enrichBudget(store).filter(b => b.projectId === pid && b.status === "Approved");
      return budget.map(b => ({
        id: b.id,
        label: `${F.nameOf(store.masters.Materials, b.materialId)} — ${F.nameOf(store.masters.ExpenseHeads, b.headId)}`,
        sub: `Shop: ${F.nameOf(store.masters.Shops, b.shopId)} · Budgeted ${F.qty(b.qty)} ${F.nameOf(store.masters.Units, b.unitId)} · Remaining ${F.money(b.remainingAmount)}`,
        right: `${F.pct(b.pctUsed)} used`,
        badge: b.tone === "Over" ? "over" : "",
        data: b,
      }));
    }

    function refreshBudgetItems() {
      if (budgetSel) {
        budgetSel.setItems(budgetItems());
        budgetSel.clear();
      }
    }

    budgetSel = CMP.searchSelect({
      items: budgetItems(),
      value: d.budgetId || "", placeholder: "Type to search budget lines…", required: true,
      emptyText: "No approved budget lines for this project — create one under Budget first.",
      onSelect: it => {
        const b = it && it.data;
        const info = form.querySelector("#budget-info");
        if (!b) { info.innerHTML = ""; return; }
        info.innerHTML = `
          <div class="bi-row"><span>Expense Head</span><b>${F.esc(F.nameOf(store.masters.ExpenseHeads, b.headId))}</b></div>
          <div class="bi-row"><span>Material / Item</span><b>${F.esc(F.nameOf(store.masters.Materials, b.materialId))}</b></div>
          <div class="bi-row"><span>Shop</span><b>${F.esc(F.nameOf(store.masters.Shops, b.shopId))}</b></div>
          <div class="bi-row"><span>Unit</span><b>${F.esc(F.nameOf(store.masters.Units, b.unitId))}</b></div>
          <div class="bi-row"><span>Budgeted</span><b>${F.qty(b.qty)} × ${F.money(b.rate)} = ${F.money(b.amount)}</b></div>
          <div class="bi-row"><span>Already consumed</span><b class="${b.consumedAmount > b.amount ? "neg" : ""}">${F.money(b.consumedAmount)} (${F.pct(b.pctUsed)})</b></div>
          <div class="bi-row bi-rem"><span>REMAINING on this line</span><b class="${b.remainingAmount < 0 ? "neg" : ""}">${F.qty(Math.max(0, b.remainingQty))} ${F.nameOf(store.masters.Units, b.unitId)} / ${F.money(Math.max(0, b.remainingAmount))}</b></div>`;
        form.querySelector('[name="rate"]').value = b.rate;
        form.querySelector('[name="qty"]').value = "";
        recalc();
      },
    });
    form.querySelector('[data-sel="budgetId"]').appendChild(budgetSel.wrap);

    if (d.budgetId) {
      const b = F.byId(RC.enrichBudget(store), d.budgetId);
      if (b) {
        budgetSel.setValue(budgetItems().find(x => x.id === b.id));
      }
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
        data.budgetId = budgetSel.value;
        data.supplierId = suppSel.value;
        if (!data.projectId) { projSel.setError("Required"); return; }
        if (!data.budgetId) { budgetSel.setError("Select an approved budget line — expenses cannot be entered outside the budget."); return; }
        if (!data.supplierId) { suppSel.setError("Required"); return; }
        if (F.num(data.qty) <= 0) { CMP.fieldError("qty", "Quantity must be greater than zero"); return; }
        if (F.num(data.rate) <= 0) { CMP.fieldError("rate", "Rate must be greater than zero"); return; }
        if (allowOverride && data.override === "YES" && !String(data.overrideReason || "").trim()) {
          CMP.fieldError("overrideReason", "A reason is required for over-budget overrides");
          return;
        }

        const saveBtn = modal.querySelector('[data-act="save"]');
        saveBtn.disabled = true;
        const res = await root.API.call("saveExpense", { id: isEdit ? row.id : null, data });
        saveBtn.disabled = false;
        if (res && res.ok) {
          UI.toast("Expense posted — budget consumption updated.", "success");
          store.expenses = res.data.rows || [];
          store.version = res.data.version != null ? res.data.version : store.version;
          UI.closeModal();
          render(container);
        } else if (res && res.error) {
          if (res.error.field) {
            if (res.error.field === "budgetId") budgetSel.setError(res.error.message);
            else CMP.fieldError(res.error.field, res.error.message);
          }
          UI.toast(res.error.message, "error", { ms: 9000, html: true });
        }
      }
    });
  }

  async function doDelete(container, id) {
    const store = root.API.store;
    const row = F.byId(store.expenses, id);
    if (!row) return;
    const ok = await UI.confirmDialog({
      danger: true,
      title: "Delete expense entry?",
      message: `${F.money(row.amount)} on ${F.fmtDate(row.date)} will be removed and the budget consumption on that line will be reversed.`,
      okLabel: "Delete",
    });
    if (!ok) return;
    const res = await root.API.call("deleteExpense", { id });
    if (res && res.ok) {
      UI.toast("Expense deleted — budget reversed.", "success");
      store.expenses = res.data.rows || [];
      render(container);
    } else if (res && res.error) UI.toast(res.error.message, "error", { ms: 7000 });
  }

  function rowsForPrint() {
    return RC.filterExpenses(RC.enrichAll(root.API.store).expenses, state.filters);
  }

  function printExpenses() {
    const store = root.API.store;
    const rows = rowsForPrint();
    const cols = [
      { key: "date", label: "Date", render: r => F.fmtDate(r.date) },
      { key: "invoiceNo", label: "Invoice", render: r => r.invoiceNo },
      { key: "projectId", label: "Project", render: r => F.nameOf(store.masters.Projects, r.projectId) },
      { key: "headId", label: "Head", render: r => F.nameOf(store.masters.ExpenseHeads, r.headId) },
      { key: "materialId", label: "Material", render: r => F.nameOf(store.masters.Materials, r.materialId) },
      { key: "shopId", label: "Shop", render: r => F.nameOf(store.masters.Shops, r.shopId) },
      { key: "supplierId", label: "Supplier", render: r => F.nameOf(store.masters.Suppliers, r.supplierId) },
      { key: "qty", label: "Qty", render: r => F.qty(r.qty) },
      { key: "rate", label: "Rate", render: r => F.money(r.rate) },
      { key: "amount", label: "Amount", render: r => F.money(r.amount) },
      { key: "paymentStatus", label: "Payment", render: r => r.paymentStatus },
    ];
    root.App.printReport("Expense Register", root.App.printTable(cols, rows));
  }

  function exportExpenses() {
    const store = root.API.store;
    const rows = rowsForPrint();
    F.exportCSV(`nexora-expenses-${F.todayISO()}.csv`, [
      { key: "date", label: "Date", value: r => r.date },
      { key: "invoiceNo", label: "Invoice / Ref", value: r => r.invoiceNo },
      { key: "project", label: "Project", value: r => F.nameOf(store.masters.Projects, r.projectId) },
      { key: "head", label: "Expense Head", value: r => F.nameOf(store.masters.ExpenseHeads, r.headId) },
      { key: "material", label: "Material", value: r => F.nameOf(store.masters.Materials, r.materialId) },
      { key: "shop", label: "Shop", value: r => F.nameOf(store.masters.Shops, r.shopId) },
      { key: "supplier", label: "Supplier", value: r => F.nameOf(store.masters.Suppliers, r.supplierId) },
      { key: "qty", label: "Qty", value: r => r.qty },
      { key: "unit", label: "Unit", value: r => F.nameOf(store.masters.Units, r.unitId) },
      { key: "rate", label: "Rate", value: r => r.rate },
      { key: "amount", label: "Amount", value: r => r.amount },
      { key: "payment", label: "Payment Status", value: r => r.paymentStatus },
      { key: "override", label: "Over Budget", value: r => r.override === "YES" ? "YES — " + (r.overrideReason || "") : "NO" },
      { key: "enteredBy", label: "Entered By", value: r => r.createdBy },
    ], rows);
  }

  root.Pages = root.Pages || {};
  root.Pages.expenses = { render, title: "Expenses" };
})(typeof window !== "undefined" ? window : globalThis);
