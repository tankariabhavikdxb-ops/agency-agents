/* ============================================================
   NEXORA CMS — Settings: connection, company, users, PIN,
   budget-control policy, backup, demo reset, self-test.
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt, UI = root.UI, CMP = root.CMP;

  function render(container) {
    const api = root.API;
    const store = api.store;
    const isAdmin = store.user && store.user.role === "Admin";
    const canUsers = root.App.can("users");
    const canSettings = root.App.can("settings");

    container.innerHTML = `
      ${UI.pageToolbar("Settings", "Connection, company profile, users, and control policies.", [
        UI.BTN.home, UI.BTN.back,
      ], { crumbs: ["Settings"] })}

      <div class="settings-grid">
        <div class="panel">
          <div class="panel-head"><h4>${UI.icon("link", 16)} Connection (Google Sheets)</h4></div>
          <div class="panel-body">
            <div class="conn-status ${store.mode === "live" ? "live" : "demo"}">
              ${UI.icon(store.mode === "live" ? "link" : "info", 15)}
              <div>
                <b>${store.mode === "live" ? "Live mode — using Google Sheets backend" : "DEMO MODE — using the built-in sample database"}</b>
                <div class="conn-sub">${store.mode === "live" ? "Last sync: " + (store.lastSync ? F.fmtDateTime(store.lastSync) : "—") + " · data version " + store.version : "All changes stay in this browser. Connect Google Sheets to share data with your team in real time."}</div>
              </div>
            </div>
            <div class="field">
              <label>Google Apps Script Web App URL</label>
              <div class="input-row">
                <input class="input" id="set-url" placeholder="https://script.google.com/macros/s/…/exec" value="${F.esc(store.apiUrl)}"/>
              </div>
              <div class="field-hint">Create it with backend/Code.gs — full steps in the README.</div>
            </div>
            <div class="btn-row">
              <button class="btn btn-primary" data-act="test">${UI.icon("link", 15)} Test &amp; Connect</button>
              <button class="btn btn-soft" data-act="disconnect">${UI.icon("close", 15)} Disconnect (demo mode)</button>
              <button class="btn btn-soft" data-act="synctest">${UI.icon("sync", 15)} Run Self-Test</button>
            </div>
            <div id="conn-result"></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h4>${UI.icon("building", 16)} Company Profile</h4></div>
          <div class="panel-body">
            <div class="form-grid">
              ${CMP.field("Company Name", CMP.textInput("companyName", store.settings.companyName, { required: true }), { span: 2 })}
              ${CMP.field("Address", CMP.textInput("companyAddress", store.settings.companyAddress), { span: 2 })}
              ${CMP.field("Phone", CMP.textInput("companyPhone", store.settings.companyPhone))}
              ${CMP.field("Email", CMP.textInput("companyEmail", store.settings.companyEmail))}
              ${CMP.field("Currency", CMP.textInput("currency", store.settings.currency, { required: true }), { hint: "Displayed as “MK …” on every money field." })}
              ${CMP.field("Default VAT %", CMP.textInput("defaultVAT", store.settings.defaultVAT, { type: "number", step: "0.01" }))}
              ${CMP.field("Sync interval (seconds)", CMP.textInput("pollInterval", store.settings.pollInterval, { type: "number", min: "15" }), { hint: "How often the app checks for changes made by other users." })}
              ${CMP.field("Allow over-budget override (Admin)", `<select class="input" name="allowOverBudget"><option value="NO">NO — strictest control</option><option value="YES">YES — Admins may override with a reason</option></select>`, { span: 2, hint: "STRICT CONTROL: when NO, expense entries above the remaining budget line are blocked completely." })}
            </div>
            <div class="btn-row">
              <button class="btn btn-primary" data-act="savecompany" ${canSettings ? "" : "disabled"}>${UI.icon("save", 15)} Save Company Settings</button>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h4>${UI.icon("key", 16)} My PIN</h4></div>
          <div class="panel-body">
            <div class="form-grid">
              ${CMP.field("Current PIN", CMP.textInput("oldPin", "", { type: "password" }))}
              ${CMP.field("New PIN (min 4 digits)", CMP.textInput("newPin", "", { type: "password" }))}
            </div>
            <div class="btn-row"><button class="btn btn-primary" data-act="changepin">${UI.icon("key", 15)} Change PIN</button></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h4>${UI.icon("users", 16)} Users &amp; Roles</h4> <span class="panel-count">${(store.users || []).length} user(s)</span></div>
          <div class="panel-body" id="users-host"></div>
        </div>

        <div class="panel">
          <div class="panel-head"><h4>${UI.icon("download", 16)} Backup &amp; Data</h4></div>
          <div class="panel-body">
            <p class="muted">Download a full JSON backup of all data (masters, budget, contracts, expenses, audit). Keep it somewhere safe.</p>
            <div class="btn-row">
              <button class="btn btn-soft" data-act="backup">${UI.icon("download", 15)} Download Backup (JSON)</button>
              ${store.mode === "demo" ? `<button class="btn btn-ghost" data-act="resetdemo">${UI.icon("refresh", 15)} Reset Demo Data</button>` : ""}
              <button class="btn btn-soft" data-act="exportall">${UI.icon("export", 15)} Export All (CSV)</button>
            </div>
          </div>
        </div>
      </div>`;

    container.querySelector('[name="allowOverBudget"]').value = String(store.settings.allowOverBudget) === "YES" ? "YES" : "NO";

    UI.attachActions(container, async (act, btn) => {
      if (act === "test") {
        const url = container.querySelector("#set-url").value.trim();
        if (!url) { UI.toast("Paste your Web App URL first.", "error"); return; }
        btn.disabled = true;
        UI.toast("Testing connection…", "info");
        const res = await api.testConnection(url);
        btn.disabled = false;
        const host = container.querySelector("#conn-result");
        if (res.ok) {
          host.innerHTML = `<div class="notice info">${UI.icon("check", 15)} Connected in ${res.ms} ms — backend version ${F.esc(String((res.data && res.data.version) || "?"))}. You are now in LIVE mode.</div>`;
          await api.refreshAll(false);
          render(container);
          UI.toast("Google Sheets backend connected!", "success");
        } else {
          host.innerHTML = `<div class="notice warn">${UI.icon("warn", 15)} ${F.esc(res.error && res.error.message || "Connection failed")}</div>`;
        }
      } else if (act === "disconnect") {
        api.setApiUrl("");
        UI.toast("Disconnected — switched to demo mode.", "success");
        render(container);
      } else if (act === "synctest") {
        const res = await api.call("selftest", {});
        const host = container.querySelector("#conn-result");
        if (res && res.ok && res.data && res.data.results) {
          host.innerHTML = `<div class="notice info">${res.data.results.map(r =>
            `<div>${r.pass ? "✅" : "❌"} ${F.esc(r.name)}${r.error ? " — " + F.esc(r.error) : ""}</div>`).join("")}</div>`;
        } else {
          host.innerHTML = `<div class="notice warn">Self-test not available ${store.mode === "live" ? "on this backend version" : "in demo mode"}: ${F.esc((res && res.error && res.error.message) || "")}</div>`;
        }
      } else if (act === "savecompany") {
        const data = CMP.formData(container.querySelector(".settings-grid"));
        if (!String(data.companyName).trim()) { CMP.fieldError("companyName", "Required"); return; }
        if (F.num(data.pollInterval) < 15) { CMP.fieldError("pollInterval", "Minimum 15 seconds"); return; }
        const res = await api.call("saveSettings", { settings: data });
        if (res && res.ok) {
          store.settings = Object.assign({}, store.settings, res.data.settings || {});
          UI.toast("Company settings saved.", "success");
          render(container);
        }
      } else if (act === "changepin") {
        const oldPin = container.querySelector('[name="oldPin"]').value;
        const newPin = container.querySelector('[name="newPin"]').value;
        if (!oldPin || !newPin) { UI.toast("Enter both current and new PIN.", "error"); return; }
        const res = await api.call("changePin", { id: store.user ? store.user.id : "", oldPin, newPin });
        if (res && res.ok) {
          UI.toast("PIN changed.", "success");
          render(container);
        }
      } else if (act === "backup") {
        F.exportJSON(`nexora-backup-${F.todayISO()}.json`, {
          app: "Nexora Construction Site Management", exportedAt: F.nowStamp(),
          settings: store.settings, users: store.users, masters: store.masters,
          budget: store.budget, contracts: store.contracts, expenses: store.expenses, audit: store.audit,
        });
        UI.toast("Backup downloaded.", "success");
      } else if (act === "resetdemo") {
        const ok = await UI.confirmDialog({ danger: true, title: "Reset demo data?", message: "The sample database will be restored to its original state. This only affects demo mode in this browser.", okLabel: "Reset" });
        if (ok) {
          await api.call("resetDemo", {});
          await api.refreshAll(false);
          UI.toast("Demo data reset.", "success");
          location.hash = "#/dashboard";
          root.App.enter();
        }
      } else if (act === "exportall") {
        exportAll();
      } else if (act === "home") location.hash = "#/dashboard";
      else if (act === "back") history.back();
    });

    renderUsers(container);
  }

  function renderUsers(container) {
    const store = root.API.store;
    const host = container.querySelector("#users-host");
    host.innerHTML = "";
    const canUsers = root.App.can("users");
    const table = CMP.dataTable({
      columns: [
        { key: "name", label: "Name", render: r => `<div class="who"><div class="av sm">${F.initials(r.name)}</div><b>${F.esc(r.name)}</b></div>` },
        { key: "role", label: "Role", render: r => UI.pill(r.role) },
        { key: "active", label: "Status", render: r => UI.pill(r.active === "YES" ? "Active" : "Inactive") },
        { key: "createdAt", label: "Created", render: r => F.fmtDateTime(r.createdAt) },
      ],
      rows: store.users || [],
      search: false,
      onAction: (act, row) => {
        if (act === "edit") openUserForm(container, row);
        else if (act === "delete") deleteUser(container, row);
      },
      actions: [
        { act: "edit", icon: "edit", title: "Edit", show: () => canUsers },
        { act: "delete", icon: "trash", title: "Delete", danger: true, show: () => canUsers },
      ],
    });
    host.appendChild(table.wrap);
    if (canUsers) {
      const addBtn = document.createElement("button");
      addBtn.className = "btn btn-soft";
      addBtn.style.marginTop = "12px";
      addBtn.innerHTML = UI.icon("plus", 15) + " Add User";
      addBtn.addEventListener("click", () => openUserForm(container, null));
      host.appendChild(addBtn);
    }
  }

  function openUserForm(container, row) {
    const isEdit = !!row;
    const d = row || { role: "Clerk", active: "YES" };
    UI.openModal(`
      <div class="form-grid">
        ${CMP.field("Full Name", CMP.textInput("name", d.name, { required: true }), { required: true, span: 2 })}
        ${CMP.field("Role", `<select class="input" name="role"><option>Admin</option><option>Supervisor</option><option>Clerk</option></select>`)}
        ${CMP.field("PIN", CMP.textInput("pin", "", { type: "password", placeholder: isEdit ? "Leave blank to keep current PIN" : "Min 4 digits" }))}
        ${CMP.field("Status", `<select class="input" name="active"><option value="YES">Active</option><option value="NO">Inactive</option></select>`)}
      </div>
      <div class="notice info">${UI.icon("info", 15)} <b>Admin</b> — full access incl. settings &amp; overrides · <b>Supervisor</b> — everything except settings/users · <b>Clerk</b> — create entries &amp; view reports only.</div>
    `, {
      title: `${isEdit ? "Edit" : "Add"} User`,
      footer: `${UI.BTN.cancel} ${UI.BTN.save}`,
    });
    const modal = UI.modalEl();
    const form = modal.querySelector(".form-grid");
    CMP.setFormData(form, d);
    UI.attachActions(modal, async act => {
      if (act === "cancel") UI.closeModal();
      else if (act === "save") {
        const data = CMP.formData(form);
        data.name = String(data.name || "").trim();
        if (!data.name) { CMP.fieldError("name", "Required"); return; }
        if (!isEdit && !String(data.pin || "").trim()) { CMP.fieldError("pin", "PIN required for new users"); return; }
        if (!isEdit && String(data.pin).length < 4) { CMP.fieldError("pin", "At least 4 characters"); return; }
        if (isEdit && !data.pin) data.pin = row.pin;
        const res = await root.API.call("saveUser", { id: isEdit ? row.id : null, data });
        if (res && res.ok) {
          root.API.store.users = res.data.rows || [];
          UI.toast("User saved.", "success");
          UI.closeModal();
          render(container);
        } else if (res && res.error) {
          if (res.error.field) CMP.fieldError(res.error.field, res.error.message);
          else UI.toast(res.error.message, "error", { ms: 7000 });
        }
      }
    });
  }

  async function deleteUser(container, row) {
    const ok = await UI.confirmDialog({ danger: true, title: `Delete user?`, message: `“${row.name}” will no longer be able to sign in.`, okLabel: "Delete" });
    if (!ok) return;
    const res = await root.API.call("deleteUser", { id: row.id });
    if (res && res.ok) {
      root.API.store.users = res.data.rows || [];
      UI.toast("User deleted.", "success");
      render(container);
    } else if (res && res.error) UI.toast(res.error.message, "error", { ms: 7000 });
  }

  function exportAll() {
    const store = root.API.store;
    const zip = [];
    const push = (name, cols, rows) => {
      zip.push(`### ${name} ###\r\n` + F.toCSV(cols, rows) + "\r\n");
    };
    push("Projects", [{ key: "id", label: "ID" }, { key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "client", label: "Client" }, { key: "status", label: "Status" }], store.masters.Projects);
    push("Shops", [{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "location", label: "Location" }], store.masters.Shops);
    push("ExpenseHeads", [{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "category", label: "Category" }], store.masters.ExpenseHeads);
    push("Materials", [{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "category", label: "Category" }, { key: "unit", label: "Unit" }], store.masters.Materials);
    push("Units", [{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "abbrev", label: "Abbrev" }], store.masters.Units);
    push("Suppliers", [{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "tin", label: "TIN" }], store.masters.Suppliers);
    push("Customers", [{ key: "id", label: "ID" }, { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "tin", label: "TIN" }], store.masters.Customers);
    push("Budget", [{ key: "id", label: "ID" }, { key: "projectId", label: "Project" }, { key: "materialId", label: "Material" }, { key: "qty", label: "Qty" }, { key: "rate", label: "Rate" }, { key: "amount", label: "Amount" }], store.budget);
    push("Contracts", [{ key: "id", label: "ID" }, { key: "type", label: "Type" }, { key: "refNo", label: "Ref" }, { key: "total", label: "Total" }], store.contracts);
    push("Expenses", [{ key: "id", label: "ID" }, { key: "date", label: "Date" }, { key: "invoiceNo", label: "Invoice" }, { key: "amount", label: "Amount" }], store.expenses);
    F.downloadFile(`nexora-export-${F.todayISO()}.csv`, zip.join(""), "text/csv;charset=utf-8");
    UI.toast("Full export downloaded.", "success");
  }

  root.Pages = root.Pages || {};
  root.Pages.settings = { render, title: "Settings" };
})(typeof window !== "undefined" ? window : globalThis);
