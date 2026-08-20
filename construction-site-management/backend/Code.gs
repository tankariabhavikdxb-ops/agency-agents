/*********************************************************************************
 * NEXORA LIMITED — Construction Site Management System
 * Google Apps Script backend (bound to a Google Sheet)
 * ------------------------------------------------------------------------------
 * SETUP (5 minutes):
 *   1. Create a new Google Sheet, e.g. "Nexora Site Management DB".
 *   2. Extensions ▸ Apps Script — delete the default code and paste THIS file.
 *   3. Select the "setupDatabase" function in the toolbar and press Run
 *      (grant permissions when asked — it creates the tabs and seed users).
 *   4. (Optional) Run "seedDemoData" to load the full sample construction data.
 *   5. Deploy ▸ New deployment ▸ type: "Web app"
 *        - Execute as:  Me
 *        - Who has access:  Anyone            <-- REQUIRED for the HTML app
 *   6. Copy the Web App URL (…/exec) and paste it into config.js (API_URL) or
 *      into the app under Settings ▸ Connection.
 *
 * The HTML frontend (index.html) calls this script with plain JSON POSTs
 * (Content-Type: text/plain, so no CORS preflight is needed and it works even
 * when the HTML file is opened directly from the PC).
 *
 * BUSINESS RULES ENFORCED HERE (server-side, cannot be bypassed):
 *   • STRICT budget control: an expense can ONLY be posted against an
 *     APPROVED budget line of the same project. Over-budget entries are
 *     blocked unless Settings allow it AND an Admin gives an override reason.
 *   • Duplicate checks: project code/name, shop, head, material, unit,
 *     supplier, customer; budget combos (project+head+material+shop);
 *     contract ref numbers per type; expense invoices per supplier+project.
 *   • Budget lines with consumption are locked (can't be reduced/repurposed).
 *   • Every write is audit-logged with user + timestamp.
 *********************************************************************************/

const APP_NAME = "Nexora Construction Site Management";
const BACKEND_VERSION = 3; // bump when backend/Code.gs changes (frontend checks this)
const SALT = "NEXORA-CMS-2026::SALT";
const EPS = 0.005;

const MASTER_SHEETS = ["Projects", "Shops", "ExpenseHeads", "Materials", "Units", "Suppliers", "Customers"];

const HEADERS = {
  Settings: ["Key", "Value"],
  Users: ["ID", "Name", "Role", "PIN", "Active", "CreatedAt"],
  Projects: ["ID", "Code", "Name", "Client", "Location", "StartDate", "EndDate", "Manager", "Status", "Remarks", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  Shops: ["ID", "Name", "Location", "Supervisor", "Status", "Remarks", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  ExpenseHeads: ["ID", "Name", "Category", "Status", "Remarks", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  Materials: ["ID", "Name", "Category", "Unit", "StandardRate", "Status", "Remarks", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  Units: ["ID", "Name", "Abbrev", "Status", "Remarks", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  Suppliers: ["ID", "Name", "ContactPerson", "Phone", "Email", "Address", "TIN", "Status", "Remarks", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  Customers: ["ID", "Name", "ContactPerson", "Phone", "Email", "Address", "TIN", "Status", "Remarks", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  Budget: ["ID", "ProjectID", "HeadID", "MaterialID", "ShopID", "UnitID", "Qty", "Rate", "Amount", "Status", "Notes", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  Contracts: ["ID", "Type", "RefNo", "Date", "Direction", "ProjectID", "CustomerID", "SupplierID", "Description", "Amount", "VATRate", "VATAmount", "Total", "Status", "PaymentStatus", "Remarks", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  Expenses: ["ID", "ProjectID", "BudgetID", "Date", "ShopID", "SupplierID", "InvoiceNo", "HeadID", "MaterialID", "UnitID", "Qty", "Rate", "Amount", "PaymentStatus", "Override", "OverrideReason", "Remarks", "CreatedBy", "CreatedAt", "UpdatedBy", "UpdatedAt"],
  Audit: ["Timestamp", "User", "Action", "Entity", "Ref", "Details"],
};

const PERMS = {
  Admin: { settings: true, users: true, masters: true, edit: true, delete: true, create: true, override: true },
  Supervisor: { settings: false, users: false, masters: true, edit: true, delete: true, create: true, override: false },
  Clerk: { settings: false, users: false, masters: false, edit: false, delete: false, create: true, override: false },
};

const CONTRACT_TYPES = {
  "Contract Value": ["Awarded", "In Progress", "Completed", "Terminated"],
  "Sales Invoice": ["Issued", "Cancelled"],
  "LPO": ["Open", "Partially Received", "Received", "Cancelled"],
};

/* ============================================================================
   SETUP & MENU
   ============================================================================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🏗 Nexora CMS")
    .addItem("1. Setup Database (run once)", "setupDatabase")
    .addItem("2. Load Demo Data (sample projects)", "seedDemoData")
    .addItem("3. Clear All Data (keep headers)", "clearAllData")
    .addItem("4. Backup JSON to Drive", "backupToDrive")
    .addSeparator()
    .addItem("About / Help", "about_")
    .addToUi();
}

function about_() {
  SpreadsheetApp.getUi().alert(APP_NAME,
    "Frontend: open index.html from the frontend folder.\n" +
    "Deploy this script as a Web App (Execute as: Me, Access: Anyone) and paste the /exec URL into the app's Settings → Connection.\n\n" +
    "Default PIN for all users: 1234", SpreadsheetApp.getUi().ButtonSet.OK);
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS[name].length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#ffffff");
  });

  const settings = getSettingsObject_();
  const defaults = {
    CompanyName: "Nexora Limited",
    CompanyAddress: "Corporate Mall, 1st Floor, Office Block B, Chilambula Road, Lilongwe, Malawi",
    CompanyPhone: "+265 1 700 000",
    CompanyEmail: "info@nexora.mw",
    Currency: "MK",
    DefaultVAT: 16.5,
    AllowOverBudget: "NO",
    PollInterval: 45,
  };
  Object.keys(defaults).forEach(k => { if (settings[k] === undefined || settings[k] === "") settings[k] = String(defaults[k]); });
  saveSettingsObject_(settings);

  // seed the 5 admin users (idempotent)
  const users = readRows_("Users", true);
  const names = users.map(u => String(u.Name).toLowerCase());
  [["U-1", "Prashant Khatri"], ["U-2", "Shakeel Patel"], ["U-3", "Bhavik Tankaria"], ["U-4", "Tanjani Malima"], ["U-5", "Davie Chavula"]]
    .forEach(([id, name]) => {
      if (!names.includes(name.toLowerCase())) {
        appendRow_("Users", { ID: id, Name: name, Role: "Admin", PIN: hashPin_("1234"), Active: "YES", CreatedAt: nowStamp_() });
      }
    });

  // seed base units & expense heads if empty
  if (!readRows_("Units", true).length) {
    [["U1", "Bag (50 kg)", "bag50"], ["U2", "Bag (25 kg)", "bag25"], ["U3", "Tonne", "t"], ["U4", "Kilogram", "kg"],
     ["U5", "Cubic Metre", "m³"], ["U6", "Square Metre", "m²"], ["U7", "Metre (linear)", "m"], ["U8", "Litre", "L"],
     ["U9", "Sheet", "sht"], ["U10", "Roll", "roll"], ["U11", "Piece", "pcs"], ["U12", "Trip / Load", "trip"],
     ["U13", "Lump Sum", "ls"], ["U14", "Man-Day", "md"], ["U15", "Hour", "hr"], ["U16", "Month", "mo"]]
      .forEach(x => appendRow_("Units", { ID: x[0], Name: x[1], Abbrev: x[2], Status: "Active", Remarks: "", CreatedBy: "Setup", CreatedAt: nowStamp_(), UpdatedBy: "", UpdatedAt: "" }));
  }
  if (!readRows_("ExpenseHeads", true).length) {
    [["H1", "Materials", "Direct"], ["H2", "Labour", "Labour"], ["H3", "Plant & Equipment Hire", "Equipment"],
     ["H4", "Subcontract Works", "Subcontract"], ["H5", "Transport & Haulage", "Direct"], ["H6", "Fuel & Lubricants", "Overhead"],
     ["H7", "Site Overheads", "Overhead"], ["H8", "Professional Fees", "Overhead"], ["H9", "Safety & Welfare", "Overhead"],
     ["H10", "Contingency", "Other"]]
      .forEach(x => appendRow_("ExpenseHeads", { ID: x[0], Name: x[1], Category: x[2], Status: "Active", Remarks: "", CreatedBy: "Setup", CreatedAt: nowStamp_(), UpdatedBy: "", UpdatedAt: "" }));
  }

  bumpVersion_();
  audit_("System", "SETUP", "System", "setupDatabase", "Database initialised / verified");
  SpreadsheetApp.getUi().alert(APP_NAME,
    "✅ Database ready!\n\nTabs created, company profile set, 5 admin users added (PIN 1234).\n" +
    "Optionally run 'Load Demo Data' for sample projects, budget & expenses.\n\n" +
    "Next: Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Access: Anyone.", SpreadsheetApp.getUi().ButtonSet.OK);
}

function clearAllData() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert("Clear ALL data?", "Every row (projects, budget, contracts, expenses, audit) will be deleted. Headers are kept. This cannot be undone.", ui.ButtonSet.YES_NO);
  if (res !== ui.Button.YES) return;
  Object.keys(HEADERS).forEach(name => {
    const sh = getSheet_(name);
    const last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, HEADERS[name].length).clearContent();
  });
  bumpVersion_();
  audit_("System", "RESET", "System", "clearAllData", "All data cleared");
  ui.alert("Data cleared. Run 'Load Demo Data' or start entering masters.");
}

function backupToDrive() {
  const payload = { app: APP_NAME, exportedAt: nowStamp_(), settings: getSettingsObject_(), users: readRows_("Users", true), masters: {}, budget: [], contracts: [], expenses: [], audit: readRows_("Audit", true) };
  MASTER_SHEETS.forEach(s => { payload.masters[s] = readRows_(s, true); });
  payload.budget = readRows_("Budget", true);
  payload.contracts = readRows_("Contracts", true);
  payload.expenses = readRows_("Expenses", true);
  const folder = DriveApp.getRootFolder();
  const file = folder.createFile("nexora-backup-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
  SpreadsheetApp.getUi().alert("Backup saved to Google Drive:\n" + file.getName());
}

/* ============================================================================
   WEB APP ENTRY POINTS
   ============================================================================ */
function doGet(e) {
  // ---- JSONP channel: lets the PC app reach the backend even when the
  // browser blocks CORS/fetch (script tags are exempt from CORS rules).
  if (e && e.parameter && e.parameter.cb) {
    const cb = String(e.parameter.cb);
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cb)) {
      return ContentService.createTextOutput("/* invalid callback */").setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    let payload = {};
    try { payload = JSON.parse(e.parameter.p || "{}"); } catch (err) { payload = {}; }
    return ContentService.createTextOutput(cb + "(" + JSON.stringify(processPayload_(payload)) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  // ---- Hosted mode: if an HTML file named "Index" exists in this project,
  // serve the full app from the backend itself (zero CORS involvement).
  try {
    return HtmlService.createHtmlOutputFromFile("Index")
      .setTitle(APP_NAME)
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  } catch (err) {
    // no Index file — fall through to the API landing page
  }
  return HtmlService.createHtmlOutput(landingPageHtml_())
    .setTitle(APP_NAME)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function landingPageHtml_() {
  return "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" + APP_NAME + "</title>" +
    "<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b1220;color:#e2e8f0}" +
    ".card{max-width:520px;padding:40px;border:1px solid #f59e0b;border-radius:16px;background:#101a2e}" +
    "h1{font-size:22px;color:#fbbf24}h2{font-size:15px;color:#94a3b8;font-weight:400}p{font-size:14px;line-height:1.6}" +
    "code{background:#0b1220;padding:2px 7px;border-radius:6px;color:#fcd34d;font-size:12px}</style></head><body>" +
    "<div class='card'><h1>🏗 " + APP_NAME + "</h1><h2>Google Sheets backend is ONLINE.</h2>" +
    "<p>This URL is the <b>API endpoint</b>. Open <code>index.html</code> from the frontend folder on your PC, then paste this URL into <b>Settings → Connection</b> (or into <code>config.js</code> as <code>API_URL</code>).</p>" +
    "<p>Deployment check: Execute as <b>Me</b>, access <b>Anyone</b>. If you see this page without logging in, the deployment is correct. ✅</p></div></body></html>";
}

function doPost(e) {
  let payload = {};
  try {
    payload = JSON.parse(e.postData ? e.postData.contents : "{}");
  } catch (err) {
    return respond_(fail_("BAD_REQUEST", "Invalid JSON payload."));
  }
  return respond_(processPayload_(payload));
}

/** Entry point for google.script.run when the app is served by this web app (hosted mode). */
function api(payloadJson) {
  let payload = {};
  try { payload = JSON.parse(String(payloadJson || "{}")); } catch (err) { payload = {}; }
  return processPayload_(payload);
}

/** Shared request handler used by doPost, the JSONP channel and google.script.run. */
function processPayload_(payload) {
  payload = payload || {};
  const action = payload.action || "";
  const data = payload.payload || {};
  const userName = (payload.user && payload.user.name) || "";

  const PUBLIC = ["ping", "getVersion", "getState", "login", "getLoginUsers", "selftest"];
  const user = PUBLIC.includes(action) ? null : authenticate_(userName, payload.token || "");

  try {
    switch (action) {
      case "ping": {
        ensureSeedUsers_();
        return (ok_({ version: getVersion_(), backendVersion: BACKEND_VERSION, timestamp: nowStamp_(), mode: "live", app: APP_NAME, counts: backendCounts_() }));
      }
      case "getVersion": return (ok_({ version: getVersion_(), backendVersion: BACKEND_VERSION, timestamp: nowStamp_() }));
      case "getState": return (ok_({ version: getVersion_(), backendVersion: BACKEND_VERSION, timestamp: nowStamp_(), settings: getSettingsObject_(), mode: "live" }));
      case "selftest": return (ok_({ results: selftest_() }));
      case "login": return handleLogin_(data);
      case "getLoginUsers": {
        ensureSeedUsers_();
        const rows = readRows_("Users").filter(u => String(u.Active) === "YES").map(u => ({ id: u.ID, name: u.Name, role: u.Role }));
        return (ok_({ rows, backendVersion: BACKEND_VERSION }));
      }
    }

    if (!user) return (fail_("SESSION", "Your session has expired. Please sign in again."));
    const role = user.Role;
    const can = function (perm) { const p = PERMS[role] || PERMS.Clerk; return !!p[perm]; };

    switch (action) {
      case "getSettings": return (ok_({ settings: getSettingsObject_() }));

      case "saveSettings": {
        if (!can("settings")) return (fail_("PERM", "You do not have permission to change settings."));
        const s = getSettingsObject_();
        const allowed = ["CompanyName", "CompanyAddress", "CompanyPhone", "CompanyEmail", "Currency", "DefaultVAT", "AllowOverBudget", "PollInterval"];
        allowed.forEach(k => { if (data.settings && data.settings[k] !== undefined) s[k] = String(data.settings[k]); });
        s.AllowOverBudget = s.AllowOverBudget === "YES" ? "YES" : "NO";
        saveSettingsObject_(s);
        audit_(user.Name, "UPDATE", "Settings", "", "Settings updated");
        bumpVersion_();
        return (ok_({ settings: s, version: getVersion_() }));
      }

      case "getUsers": {
        if (!can("users")) return (fail_("PERM", "Only administrators can manage users."));
        return (ok_({ rows: readRows_("Users").map(u => Object.assign({}, u, { PIN: "" })) }));
      }

      case "saveUser": {
        if (!can("users")) return (fail_("PERM", "Only administrators can manage users."));
        if (!String(data.name || "").trim()) return (fail_("REQUIRED", "Name is required", "name"));
        const rows = readRows_("Users");
        const dup = rows.find(u => u.ID !== data.id && String(u.Name).toLowerCase() === String(data.name).toLowerCase());
        if (dup) return (fail_("DUPLICATE", "A user with this name already exists.", "name"));
        if (data.id) {
          const u = rows.find(x => x.ID === data.id);
          if (!u) return (fail_("NOT_FOUND", "User not found."));
          u.Name = String(data.name).trim();
          u.Role = ["Admin", "Supervisor", "Clerk"].includes(data.role) ? data.role : "Clerk";
          u.Active = data.active === "NO" ? "NO" : "YES";
          if (String(data.pin || "").trim()) u.PIN = hashPin_(String(data.pin).trim());
          updateRowById_("Users", u);
          audit_(user.Name, "UPDATE", "User", u.Name, "Updated user (role " + u.Role + ")");
        } else {
          if (!String(data.pin || "").trim()) return (fail_("REQUIRED", "PIN is required for new users.", "pin"));
          const nu = { ID: nextId_("U"), Name: String(data.name).trim(), Role: ["Admin", "Supervisor", "Clerk"].includes(data.role) ? data.role : "Clerk", PIN: hashPin_(String(data.pin).trim()), Active: "YES", CreatedAt: nowStamp_() };
          appendRow_("Users", nu);
          audit_(user.Name, "CREATE", "User", nu.Name, "Created user (role " + nu.Role + ")");
        }
        bumpVersion_();
        return (ok_({ rows: readRows_("Users").map(u => Object.assign({}, u, { PIN: "" })), version: getVersion_() }));
      }

      case "deleteUser": {
        if (!can("users")) return (fail_("PERM", "Only administrators can manage users."));
        const rows = readRows_("Users");
        const u = rows.find(x => x.ID === data.id);
        if (!u) return (fail_("NOT_FOUND", "User not found."));
        if (u.Name === user.Name) return (fail_("INVALID", "You cannot delete your own account."));
        const admins = rows.filter(x => x.Role === "Admin" && x.Active === "YES").length;
        if (u.Role === "Admin" && admins <= 1) return (fail_("INVALID", "At least one active admin must remain."));
        deleteRowById_("Users", data.id);
        audit_(user.Name, "DELETE", "User", u.Name, "Deleted user");
        bumpVersion_();
        return (ok_({ rows: readRows_("Users").map(x => Object.assign({}, x, { PIN: "" })), version: getVersion_() }));
      }

      case "changePin": {
        const rows = readRows_("Users");
        const u = rows.find(x => x.Name === user.Name);
        if (!u) return (fail_("NOT_FOUND", "User not found."));
        if (u.PIN !== hashPin_(String(data.oldPin || ""))) return (fail_("LOGIN", "Current PIN is incorrect."));
        if (String(data.newPin || "").length < 4) return (fail_("INVALID", "New PIN must be at least 4 characters."));
        u.PIN = hashPin_(String(data.newPin));
        updateRowById_("Users", u);
        audit_(u.Name, "UPDATE", "User", u.Name, "Changed PIN");
        bumpVersion_();
        return (ok_({ user: { name: u.Name, role: u.Role, id: u.ID } }));
      }

      case "getMasters": {
        if (!MASTER_SHEETS.includes(data.sheet)) return (fail_("INVALID", "Unknown master sheet."));
        return (ok_({ rows: readRows_(data.sheet), version: getVersion_() }));
      }

      case "saveMaster": {
        const sheet = data.sheet;
        if (!MASTER_SHEETS.includes(sheet)) return (fail_("INVALID", "Unknown master sheet."));
        if (!can("masters")) return (fail_("PERM", "You do not have permission to manage masters."));
        const row = data.data || {};
        const dupErr = masterDupError_(sheet, row, data.id || null);
        if (dupErr) return (dupErr);
        if (sheet === "Materials" && !row.unit) return (fail_("REQUIRED", "Unit is required for materials", "unit"));
        if (data.id) {
          if (!can("edit")) return (fail_("PERM", "You do not have permission to edit records."));
          const rows = readRows_(sheet);
          const ex = rows.find(x => x.ID === data.id);
          if (!ex) return (fail_("NOT_FOUND", "Record not found."));
          Object.keys(HEADERS[sheet]).forEach(h => {
            if (h === "ID" || h === "CreatedBy" || h === "CreatedAt") return;
            ex[h] = row[h] !== undefined ? row[h] : ex[h];
          });
          ex.UpdatedBy = user.Name; ex.UpdatedAt = nowStamp_();
          updateRowById_(sheet, ex);
          audit_(user.Name, "UPDATE", sheet, ex.Name, "Updated " + sheet.slice(0, -1));
        } else {
          if (!can("create")) return (fail_("PERM", "You do not have permission to create records."));
          const nu = {};
          HEADERS[sheet].forEach(h => {
            if (h === "ID") nu[h] = nextId_(sheet.slice(0, 2).toUpperCase());
            else if (h === "CreatedBy") nu[h] = user.Name;
            else if (h === "CreatedAt") nu[h] = nowStamp_();
            else if (h === "UpdatedBy" || h === "UpdatedAt") nu[h] = "";
            else nu[h] = row[h] !== undefined ? row[h] : (h === "Status" ? "Active" : "");
          });
          appendRow_(sheet, nu);
          audit_(user.Name, "CREATE", sheet, nu.Name, "Created " + sheet.slice(0, -1));
        }
        bumpVersion_();
        return (ok_({ rows: readRows_(sheet), version: getVersion_() }));
      }

      case "deleteMaster": {
        const sheet = data.sheet;
        if (!MASTER_SHEETS.includes(sheet)) return (fail_("INVALID", "Unknown master sheet."));
        if (!can("delete")) return (fail_("PERM", "You do not have permission to delete records."));
        const rows = readRows_(sheet);
        const ex = rows.find(x => x.ID === data.id);
        if (!ex) return (fail_("NOT_FOUND", "Record not found."));
        const blocked = inUseCheck_(sheet, data.id);
        if (blocked) return (fail_("IN_USE", blocked));
        deleteRowById_(sheet, data.id);
        audit_(user.Name, "DELETE", sheet, ex.Name, "Deleted " + sheet.slice(0, -1));
        bumpVersion_();
        return (ok_({ rows: readRows_(sheet), version: getVersion_() }));
      }

      case "getBudget": return (ok_({ rows: readRows_("Budget"), version: getVersion_() }));

      case "saveBudgetLine": {
        if (!can("create")) return (fail_("PERM", "You do not have permission to create records."));
        if (data.id && !can("edit")) return (fail_("PERM", "You do not have permission to edit records."));
        const row = Object.assign({}, data.data || {});
        const vErr = validateBudgetLine_(row, data.id || null);
        if (vErr) return (vErr);
        row.Qty = Number(row.Qty); row.Rate = Number(row.Rate);
        row.Amount = Math.round(row.Qty * row.Rate * 100) / 100;
        const mat = readRows_("Materials").find(m => m.ID === row.MaterialID);
        if (mat && mat.Unit) row.UnitID = mat.Unit;
        if (data.id) {
          const rows = readRows_("Budget");
          const ex = rows.find(x => x.ID === data.id);
          if (!ex) return (fail_("NOT_FOUND", "Budget line not found."));
          Object.keys(HEADERS.Budget).forEach(h => {
            if (h === "ID" || h === "CreatedBy" || h === "CreatedAt") return;
            ex[h] = row[h] !== undefined ? row[h] : ex[h];
          });
          ex.UpdatedBy = user.Name; ex.UpdatedAt = nowStamp_();
          updateRowById_("Budget", ex);
          audit_(user.Name, "UPDATE", "Budget", ex.ID, "Updated budget line");
        } else {
          const nu = { ID: nextId_("B"), CreatedBy: user.Name, CreatedAt: nowStamp_(), UpdatedBy: "", UpdatedAt: "" };
          HEADERS.Budget.forEach(h => { if (nu[h] === undefined) nu[h] = row[h] !== undefined ? row[h] : (h === "Status" ? "Approved" : ""); });
          appendRow_("Budget", nu);
          audit_(user.Name, "CREATE", "Budget", nu.ID, "Created budget line");
        }
        bumpVersion_();
        return (ok_({ rows: readRows_("Budget"), version: getVersion_() }));
      }

      case "deleteBudgetLine": {
        if (!can("delete")) return (fail_("PERM", "You do not have permission to delete records."));
        const rows = readRows_("Budget");
        const ex = rows.find(x => x.ID === data.id);
        if (!ex) return (fail_("NOT_FOUND", "Budget line not found."));
        const consumed = budgetConsumed_(data.id);
        if (consumed.qty > 0 || consumed.amount > 0) {
          return (fail_("IN_USE", "This budget line already has expenses against it and cannot be deleted. Set its status to \"Hold\" instead."));
        }
        deleteRowById_("Budget", data.id);
        audit_(user.Name, "DELETE", "Budget", ex.ID, "Deleted budget line");
        bumpVersion_();
        return (ok_({ rows: readRows_("Budget"), version: getVersion_() }));
      }

      case "getContracts": return (ok_({ rows: readRows_("Contracts"), version: getVersion_() }));

      case "saveContract": {
        if (!can("create")) return (fail_("PERM", "You do not have permission to create records."));
        if (data.id && !can("edit")) return (fail_("PERM", "You do not have permission to edit records."));
        const row = Object.assign({}, data.data || {});
        const vErr = validateContract_(row, data.id || null);
        if (vErr) return (vErr);
        row.Direction = row.Type === "LPO" ? "Expense" : "Income";
        row.Amount = Number(row.Amount); row.VATRate = Number(row.VATRate);
        row.VATAmount = Math.round(row.Amount * row.VATRate) / 100;
        row.Total = Math.round((row.Amount + row.VATAmount) * 100) / 100;
        if (data.id) {
          const rows = readRows_("Contracts");
          const ex = rows.find(x => x.ID === data.id);
          if (!ex) return (fail_("NOT_FOUND", "Record not found."));
          Object.keys(HEADERS.Contracts).forEach(h => {
            if (h === "ID" || h === "CreatedBy" || h === "CreatedAt") return;
            ex[h] = row[h] !== undefined ? row[h] : ex[h];
          });
          ex.UpdatedBy = user.Name; ex.UpdatedAt = nowStamp_();
          updateRowById_("Contracts", ex);
          audit_(user.Name, "UPDATE", "Contract", ex.RefNo, "Updated " + ex.Type);
        } else {
          const nu = { ID: nextId_("CT"), CreatedBy: user.Name, CreatedAt: nowStamp_(), UpdatedBy: "", UpdatedAt: "" };
          HEADERS.Contracts.forEach(h => { if (nu[h] === undefined) nu[h] = row[h] !== undefined ? row[h] : ""; });
          appendRow_("Contracts", nu);
          audit_(user.Name, "CREATE", "Contract", nu.RefNo, "Created " + nu.Type);
        }
        bumpVersion_();
        return (ok_({ rows: readRows_("Contracts"), version: getVersion_() }));
      }

      case "deleteContract": {
        if (!can("delete")) return (fail_("PERM", "You do not have permission to delete records."));
        const rows = readRows_("Contracts");
        const ex = rows.find(x => x.ID === data.id);
        if (!ex) return (fail_("NOT_FOUND", "Record not found."));
        deleteRowById_("Contracts", data.id);
        audit_(user.Name, "DELETE", "Contract", ex.RefNo, "Deleted " + ex.Type);
        bumpVersion_();
        return (ok_({ rows: readRows_("Contracts"), version: getVersion_() }));
      }

      case "getExpenses": return (ok_({ rows: readRows_("Expenses"), version: getVersion_() }));

      case "saveExpense": {
        if (!can("create")) return (fail_("PERM", "You do not have permission to create records."));
        if (data.id && !can("edit")) return (fail_("PERM", "You do not have permission to edit records."));
        const row = Object.assign({}, data.data || {});
        const settings = getSettingsObject_();
        const vErr = validateExpense_(row, data.id || null, settings, user);
        if (vErr) return (vErr);
        const bl = readRows_("Budget").find(b => b.ID === row.BudgetID);
        row.Qty = Number(row.Qty); row.Rate = Number(row.Rate);
        row.HeadID = bl.HeadID; row.MaterialID = bl.MaterialID; row.UnitID = bl.UnitID; row.ShopID = bl.ShopID;
        row.Amount = Math.round(row.Qty * row.Rate * 100) / 100;
        const consumed = budgetConsumed_(row.BudgetID);
        const selfExp = data.id ? readRows_("Expenses").find(e => e.ID === data.id) : null;
        let cQty = consumed.qty, cAmt = consumed.amount;
        if (selfExp) { cQty -= Number(selfExp.Qty); cAmt -= Number(selfExp.Amount); }
        row.Override = row.Override === "YES" ? "YES" : "NO";
        if (row.Override === "YES" && (cQty + row.Qty <= Number(bl.Qty) + EPS) && (cAmt + row.Amount <= Number(bl.Amount) + EPS)) {
          row.Override = "NO"; row.OverrideReason = "";
        }
        if (data.id) {
          const rows = readRows_("Expenses");
          const ex = rows.find(x => x.ID === data.id);
          if (!ex) return (fail_("NOT_FOUND", "Expense not found."));
          Object.keys(HEADERS.Expenses).forEach(h => {
            if (h === "ID" || h === "CreatedBy" || h === "CreatedAt") return;
            ex[h] = row[h] !== undefined ? row[h] : ex[h];
          });
          ex.UpdatedBy = user.Name; ex.UpdatedAt = nowStamp_();
          updateRowById_("Expenses", ex);
          audit_(user.Name, "UPDATE", "Expense", ex.InvoiceNo || ex.ID, "Updated expense entry");
        } else {
          const nu = { ID: nextId_("E"), CreatedBy: user.Name, CreatedAt: nowStamp_(), UpdatedBy: "", UpdatedAt: "" };
          HEADERS.Expenses.forEach(h => { if (nu[h] === undefined) nu[h] = row[h] !== undefined ? row[h] : ""; });
          appendRow_("Expenses", nu);
          audit_(user.Name, "CREATE", "Expense", nu.InvoiceNo || nu.ID,
            "Expense " + fmtMoney_(nu.Amount) + " against budget line " + bl.ID + (nu.Override === "YES" ? " (over-budget override: " + nu.OverrideReason + ")" : ""));
        }
        bumpVersion_();
        return (ok_({ rows: readRows_("Expenses"), version: getVersion_() }));
      }

      case "deleteExpense": {
        if (!can("delete")) return (fail_("PERM", "You do not have permission to delete records."));
        const rows = readRows_("Expenses");
        const ex = rows.find(x => x.ID === data.id);
        if (!ex) return (fail_("NOT_FOUND", "Expense not found."));
        deleteRowById_("Expenses", data.id);
        audit_(user.Name, "DELETE", "Expense", ex.InvoiceNo || ex.ID, "Deleted expense entry — budget consumption reversed");
        bumpVersion_();
        return (ok_({ rows: readRows_("Expenses"), version: getVersion_() }));
      }

      case "getAudit": {
        let rows = readRows_("Audit").slice(0, Number(data.limit) || 300);
        if (data.q) rows = rows.filter(r => String((r.User || "") + " " + (r.Action || "") + " " + (r.Entity || "") + " " + (r.Ref || "") + " " + (r.Details || "")).toLowerCase().includes(String(data.q).toLowerCase()));
        return (ok_({ rows }));
      }

      case "getAll": {
        return (ok_({
          version: getVersion_(), timestamp: nowStamp_(), mode: "live",
          settings: getSettingsObject_(),
          users: readRows_("Users").map(u => ({ id: u.ID, name: u.Name, role: u.Role, active: u.Active, createdAt: u.CreatedAt })),
          masters: MASTER_SHEETS.reduce((a, s) => { a[s] = readRows_(s); return a; }, {}),
          budget: readRows_("Budget"), contracts: readRows_("Contracts"), expenses: readRows_("Expenses"),
          audit: readRows_("Audit").slice(0, 300),
        }));
      }

      default:
        return fail_("UNKNOWN", "Unknown action: " + action);
    }
  } catch (err) {
    return fail_("SERVER", "Unexpected error: " + (err && err.message ? err.message : String(err)));
  }
}

/* ============================================================================
   LOGIN / SESSION
   ============================================================================ */
function handleLogin_(data) {
  ensureSeedUsers_();
  const rows = readRows_("Users");
  const u = rows.find(x => String(x.Name).toLowerCase() === String(data.name || "").toLowerCase());
  if (!u) return fail_("LOGIN", "User not found. Please check your name.");
  if (u.Active !== "YES") return fail_("LOGIN", "This user account is inactive. Contact an administrator.");
  if (u.PIN !== hashPin_(String(data.pin || ""))) return fail_("LOGIN", "Incorrect PIN. (Default PIN is 1234 — change it in Settings.)");
  audit_(u.Name, "LOGIN", "System", u.Name, "Signed in");
  bumpVersion_();
  return ok_({ user: { name: u.Name, role: u.Role, id: u.ID }, token: makeToken_(u) });
}

function authenticate_(userName, token) {
  if (!userName || !token) return null;
  const u = readRows_("Users").find(x => String(x.Name).toLowerCase() === String(userName).toLowerCase());
  if (!u || u.Active !== "YES") return null;
  if (makeToken_(u) !== token) return null;
  return u;
}

function hashPin_(pin) { return sha256hex_(String(pin) + "::" + SALT); }
function makeToken_(u) { return sha256hex_(u.Name + "|" + u.PIN + "|" + SALT); }
function sha256hex_(s) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return digest.map(function (b) { const v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? "0" + v : v; }).join("");
}

/* ============================================================================
   BUSINESS RULES (server-side — cannot be bypassed from the UI)
   ============================================================================ */
function masterDupError_(sheet, data, selfId) {
  const rows = readRows_(sheet);
  const name = String(data.name || "").trim();
  if (!name) return fail_("REQUIRED", "Name is required", "name");
  const lower = name.toLowerCase();
  const dup = rows.find(r => r.ID !== selfId && String(r.Name).trim().toLowerCase() === lower);
  if (dup) return fail_("DUPLICATE", sheet.slice(0, -1) + " \"" + name + "\" already exists — duplicate entries are not allowed.", "name");
  if (sheet === "Projects") {
    const code = String(data.code || "").trim().toUpperCase();
    if (!code) return fail_("REQUIRED", "Project code is required", "code");
    const dupC = rows.find(r => r.ID !== selfId && String(r.Code).trim().toUpperCase() === code);
    if (dupC) return fail_("DUPLICATE", "Project code \"" + code + "\" is already used by \"" + dupC.Name + "\".", "code");
  }
  if (sheet === "Units") {
    const ab = String(data.abbrev || "").trim().toLowerCase();
    if (ab) {
      const dupA = rows.find(r => r.ID !== selfId && String(r.Abbrev).trim().toLowerCase() === ab);
      if (dupA) return fail_("DUPLICATE", "Unit abbreviation \"" + data.abbrev + "\" already exists.", "abbrev");
    }
  }
  return null;
}

function budgetConsumed_(budgetId) {
  return readRows_("Expenses").filter(e => e.BudgetID === budgetId).reduce(
    (a, e) => ({ qty: a.qty + Number(e.Qty || 0), amount: a.amount + Number(e.Amount || 0) }), { qty: 0, amount: 0 });
}

function validateBudgetLine_(data, selfId) {
  if (!data.ProjectID) return fail_("REQUIRED", "Project is required", "projectId");
  if (!data.HeadID) return fail_("REQUIRED", "Expense head is required", "headId");
  if (!data.MaterialID) return fail_("REQUIRED", "Material is required", "materialId");
  if (!data.ShopID) return fail_("REQUIRED", "Shop is required", "shopId");
  if (!(Number(data.Qty) > 0)) return fail_("INVALID", "Quantity must be greater than zero", "qty");
  if (!(Number(data.Rate) > 0)) return fail_("INVALID", "Rate must be greater than zero", "rate");
  if (!["Approved", "Hold"].includes(data.Status)) data.Status = "Approved";

  if (selfId) {
    const rows = readRows_("Budget");
    const self = rows.find(b => b.ID === selfId);
    if (!self) return fail_("NOT_FOUND", "Budget line not found.");
    const consumed = budgetConsumed_(selfId);
    const locked = [["ProjectID", "projectId"], ["HeadID", "headId"], ["MaterialID", "materialId"], ["ShopID", "shopId"], ["UnitID", "unitId"]];
    for (let i = 0; i < locked.length; i++) {
      if (String(data[locked[i][0]]) !== String(self[locked[i][0]])) {
        return fail_("LOCKED", "This budget line already has expenses against it — its project, head, material, shop and unit cannot be changed.", locked[i][1]);
      }
    }
    if (Number(data.Qty) < consumed.qty - EPS) return fail_("INVALID", "Quantity cannot be below already consumed " + consumed.qty + ".", "qty");
    if (Number(data.Qty) * Number(data.Rate) < consumed.amount - EPS) return fail_("INVALID", "Amount cannot be below already consumed " + fmtMoney_(consumed.amount) + ".", "rate");
  } else {
    const rows = readRows_("Budget");
    const dup = rows.find(b =>
      b.ProjectID === data.ProjectID && b.HeadID === data.HeadID && b.MaterialID === data.MaterialID && b.ShopID === data.ShopID);
    if (dup) return fail_("DUPLICATE", "This exact budget line (project + head + material + shop) already exists — duplicate budget lines are not allowed.", "materialId");
  }
  return null;
}

function validateContract_(data, selfId) {
  if (!CONTRACT_TYPES[data.Type]) return fail_("INVALID", "Document type is required", "type");
  if (!String(data.RefNo || "").trim()) return fail_("REQUIRED", "Reference number is required", "refNo");
  if (!data.Date) return fail_("REQUIRED", "Date is required", "date");
  if (!data.ProjectID) return fail_("REQUIRED", "Project is required", "projectId");
  if (!(Number(data.Amount) > 0)) return fail_("INVALID", "Amount must be greater than zero", "amount");
  const direction = data.Type === "LPO" ? "Expense" : "Income";
  if (direction === "Income" && !data.CustomerID) return fail_("REQUIRED", "Customer is required for contracts and invoices", "customerId");
  if (direction === "Expense" && !data.SupplierID) return fail_("REQUIRED", "Supplier is required for LPOs", "supplierId");
  if (!CONTRACT_TYPES[data.Type].includes(data.Status)) return fail_("INVALID", "Invalid status for " + data.Type, "status");
  const rows = readRows_("Contracts");
  const refUp = String(data.RefNo).trim().toUpperCase();
  const dup = rows.find(c => c.ID !== selfId && c.Type === data.Type && String(c.RefNo).trim().toUpperCase() === refUp);
  if (dup) return fail_("DUPLICATE", data.Type + " \"" + data.RefNo + "\" already exists — reference numbers must be unique.", "refNo");
  return null;
}

function validateExpense_(data, selfId, settings, user) {
  // STRICT CONTROL — the expense MUST be against an existing, approved budget line
  if (!data.ProjectID) return fail_("REQUIRED", "Project is required", "projectId");
  if (!data.BudgetID) return fail_("REQUIRED", "Budget line is required — expenses can only be entered against budgeted items.", "budgetId");
  const bl = readRows_("Budget").find(b => b.ID === data.BudgetID);
  if (!bl) return fail_("INVALID", "Selected budget line no longer exists. Please refresh and select again.", "budgetId");
  if (bl.ProjectID !== data.ProjectID) return fail_("INVALID", "The selected budget line does not belong to this project.", "budgetId");
  if (bl.Status !== "Approved") return fail_("INVALID", "This budget line is on \"" + bl.Status + "\" — expenses can only be posted against APPROVED budget lines.", "budgetId");
  if (!data.Date) return fail_("REQUIRED", "Date is required", "date");
  if (!data.SupplierID) return fail_("REQUIRED", "Supplier is required", "supplierId");
  if (!(Number(data.Qty) > 0)) return fail_("INVALID", "Quantity must be greater than zero", "qty");
  if (!(Number(data.Rate) > 0)) return fail_("INVALID", "Rate must be greater than zero", "rate");

  const qty = Number(data.Qty), rate = Number(data.Rate);
  const amount = Math.round(qty * rate * 100) / 100;

  // duplicate invoice check
  const inv = String(data.InvoiceNo || "").trim();
  if (inv) {
    const rows = readRows_("Expenses");
    const invUp = inv.toUpperCase();
    const dup = rows.find(e =>
      e.ID !== selfId && e.ProjectID === data.ProjectID && e.SupplierID === data.SupplierID &&
      String(e.InvoiceNo || "").trim().toUpperCase() === invUp);
    if (dup) return fail_("DUPLICATE", "Invoice \"" + inv + "\" from this supplier is already entered for this project — duplicate expense entries are not allowed.", "invoiceNo");
  }

  // budget limit check
  const consumed = budgetConsumed_(data.BudgetID);
  const selfExp = selfId ? readRows_("Expenses").find(e => e.ID === selfId) : null;
  let cQty = consumed.qty, cAmt = consumed.amount;
  if (selfExp) { cQty -= Number(selfExp.Qty); cAmt -= Number(selfExp.Amount); }
  const remainingQty = Number(bl.Qty) - cQty;
  const remainingAmt = Number(bl.Amount) - cAmt;
  const overQty = qty > remainingQty + EPS;
  const overAmt = amount > remainingAmt + EPS;

  if (overQty || overAmt) {
    const allow = String(settings.AllowOverBudget) === "YES";
    const isAdmin = user && user.Role === "Admin";
    const overrideOk = data.Override === "YES" && String(data.OverrideReason || "").trim();
    if (!(allow && isAdmin && overrideOk)) {
      const unit = readRows_("Units").find(u => u.ID === bl.UnitID);
      return fail_("OVER_BUDGET",
        "This entry exceeds the remaining budget on this line. Remaining: " + remainingQty + " " + (unit ? unit.Abbrev : "") + " / " + fmtMoney_(Math.max(0, remainingAmt)) + ". " +
        (allow && isAdmin ? "Tick “Override” and give a reason, or reduce the quantity." : "New or additional expenses outside the approved budget are NOT allowed."),
        "qty");
    }
  }
  return null;
}

function inUseCheck_(sheet, id) {
  const budget = readRows_("Budget"), contracts = readRows_("Contracts"), expenses = readRows_("Expenses");
  const uses = function (r) {
    switch (sheet) {
      case "Projects": return r.ProjectID === id;
      case "Materials": return r.MaterialID === id;
      case "ExpenseHeads": return r.HeadID === id;
      case "Shops": return r.ShopID === id;
      case "Units": return r.UnitID === id;
      case "Suppliers": return r.SupplierID === id;
      case "Customers": return r.CustomerID === id;
      default: return false;
    }
  };
  if (budget.some(uses) || contracts.some(uses) || expenses.some(uses)) {
    return "Cannot delete — this record is referenced by budget, contract or expense entries. Set its status to \"Inactive\" instead.";
  }
  if (sheet === "Units" && readRows_("Materials").some(function (m) { return m.Unit === id; })) {
    return "Cannot delete — this unit is used by one or more materials. Reassign those materials first.";
  }
  return null;
}

function selftest_() {
  const results = [];
  const check = function (name, fn) {
    try { fn(); results.push({ name: name, pass: true }); }
    catch (e) { results.push({ name: name, pass: false, error: String(e && e.message || e) }); }
  };
  const settings = getSettingsObject_();
  check("strict: expense without budget line blocked", function () {
    const r = validateExpense_({ ProjectID: "P1", Qty: 1, Rate: 100, Date: "2026-08-20", SupplierID: "S1" }, null, settings, { Role: "Admin" });
    if (!r || r.ok !== false) throw new Error("expected error");
  });
  check("duplicate: budget line combo rejected", function () {
    const bl = readRows_("Budget")[0];
    if (bl) {
      const r = validateBudgetLine_({ ProjectID: bl.ProjectID, HeadID: bl.HeadID, MaterialID: bl.MaterialID, ShopID: bl.ShopID, Qty: 10, Rate: 100, Status: "Approved" }, null);
      if (!r || r.ok !== false || r.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
    }
  });
  check("consistency: every expense has a valid budget line", function () {
    const budget = readRows_("Budget");
    readRows_("Expenses").forEach(function (e) {
      if (!budget.some(b => b.ID === e.BudgetID)) throw new Error("orphan expense " + e.ID);
    });
  });
  check("users: the 5 admins exist", function () {
    const names = readRows_("Users").map(u => String(u.Name).toLowerCase());
    ["prashant khatri", "shakeel patel", "bhavik tankaria", "tanjani malima", "davie chavula"].forEach(function (n) {
      if (!names.includes(n)) throw new Error("missing user " + n);
    });
  });
  return results;
}

/* ============================================================================
   SHEET READ/WRITE + CACHE + VERSION
   ============================================================================ */
function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readRows_(name, forceFresh) {
  const gen = cacheGet_("gen", "0");
  const key = "rows:" + gen + ":" + name;
  if (!forceFresh) {
    const cached = cacheGet_(key, null);
    if (cached) return JSON.parse(cached);
  }
  const sh = getSheet_(name);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (v) { return v === "" || v === null || v === undefined; })) continue;
    const obj = {};
    headers.forEach(function (h, j) { obj[h] = row[j]; });
    rows.push(obj);
  }
  cachePut_(key, JSON.stringify(rows));
  return rows;
}

function appendRow_(name, obj) {
  const sh = getSheet_(name);
  const headers = HEADERS[name];
  sh.appendRow(headers.map(h => (obj[h] === undefined || obj[h] === null) ? "" : obj[h]));
  invalidateSheet_(name);
}

function updateRowById_(name, obj) {
  const sh = getSheet_(name);
  const headers = HEADERS[name];
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(obj.ID)) {
      sh.getRange(i + 1, 1, 1, headers.length).setValues([headers.map(h => (obj[h] === undefined || obj[h] === null) ? "" : obj[h])]);
      invalidateSheet_(name);
      return true;
    }
  }
  return false;
}

function deleteRowById_(name, id) {
  const sh = getSheet_(name);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sh.deleteRow(i + 1);
      invalidateSheet_(name);
      return true;
    }
  }
  return false;
}

function invalidateSheet_(name) {
  const gen = Number(cacheGet_("gen", "0")) + 1;
  cachePut_("gen", String(gen), 21600);
  cachePut_("rows:" + gen + ":" + name, JSON.stringify(readRows_(name, true)), 600);
  bumpVersion_();
}

const SETTINGS_DEFAULTS = {
  CompanyName: "Nexora Limited",
  CompanyAddress: "Corporate Mall, 1st Floor, Office Block B, Chilambula Road, Lilongwe, Malawi",
  CompanyPhone: "+265 1 700 000",
  CompanyEmail: "info@nexora.mw",
  Currency: "MK",
  DefaultVAT: "16.5",
  AllowOverBudget: "NO",
  PollInterval: "45",
};

/** Idempotent: if the Users sheet is empty (setupDatabase was never run),
    seed the 5 default admin users so live mode is never left without users. */
function ensureSeedUsers_() {
  const rows = readRows_("Users", true);
  if (rows.length) return;
  [["U-1", "Prashant Khatri"], ["U-2", "Shakeel Patel"], ["U-3", "Bhavik Tankaria"],
   ["U-4", "Tanjani Malima"], ["U-5", "Davie Chavula"]]
    .forEach(function (u) {
      appendRow_("Users", { ID: u[0], Name: u[1], Role: "Admin", PIN: hashPin_("1234"), Active: "YES", CreatedAt: nowStamp_() });
    });
  audit_("System", "SETUP", "Users", "ensureSeedUsers_", "Auto-seeded the 5 default admin users (PIN 1234)");
  bumpVersion_();
}

/** Lightweight inventory of what is actually stored in the backend. */
function backendCounts_() {
  return {
    users: readRows_("Users").length,
    projects: readRows_("Projects").length,
    shops: readRows_("Shops").length,
    expenseHeads: readRows_("ExpenseHeads").length,
    materials: readRows_("Materials").length,
    units: readRows_("Units").length,
    suppliers: readRows_("Suppliers").length,
    customers: readRows_("Customers").length,
    budget: readRows_("Budget").length,
    contracts: readRows_("Contracts").length,
    expenses: readRows_("Expenses").length,
  };
}

function getSettingsObject_() {
  const rows = readRows_("Settings");
  const obj = {};
  rows.forEach(r => { obj[r.Key] = r.Value; });
  Object.keys(SETTINGS_DEFAULTS).forEach(function (k) {
    if (obj[k] === undefined || obj[k] === "") obj[k] = SETTINGS_DEFAULTS[k];
  });
  return obj;
}

function saveSettingsObject_(obj) {
  const sh = getSheet_("Settings");
  const keys = Object.keys(obj);
  sh.clearContents();
  const out = [HEADERS.Settings].concat(keys.map(k => [k, obj[k]]));
  sh.getRange(1, 1, out.length, 2).setValues(out);
  invalidateSheet_("Settings");
}

function getVersion_() { return Number(cacheGet_("version", "1")); }
function bumpVersion_() { cachePut_("version", String(getVersion_() + 1), 21600); }

function cacheGet_(key, def) {
  try {
    const v = CacheService.getScriptCache().get(key);
    return v === null || v === undefined ? def : v;
  } catch (e) { return def; }
}
function cachePut_(key, val, ttl) {
  try { CacheService.getScriptCache().put(key, String(val), ttl || 120); } catch (e) { /* ignore */ }
}

function audit_(userName, action, entity, ref, details) {
  try {
    const sh = getSheet_("Audit");
    sh.appendRow([nowStamp_(), userName, action, entity, ref || "", details || ""]);
    const gen = Number(cacheGet_("gen", "0")) + 1;
    cachePut_("gen", String(gen), 21600);
  } catch (e) { /* never block a write on audit failure */ }
}

function nowStamp_() {
  const d = new Date();
  const p = function (n) { return String(n).padStart(2, "0"); };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

function nextId_(prefix) {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return (prefix || "ID") + "-" + t + r;
}

function fmtMoney_(v) {
  const n = Number(v || 0);
  return "MK " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ============================================================================
   RESPONSES
   ============================================================================ */
function ok_(data) { return { ok: true, data: data || {} }; }
function fail_(code, message, field) { return { ok: false, error: { code: code, message: message, field: field || "" } }; }
function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

/* ============================================================================
   DEMO DATA (optional — mirrors the frontend demo mode exactly)
   ============================================================================ */
function seedDemoData() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert("Load demo data?",
    "This adds sample projects, materials, suppliers, customers, shops, budget lines, contracts, LPOs, invoices and expenses so you can explore every report immediately.\n\nAny existing data is kept (duplicates may be skipped).", ui.ButtonSet.YES_NO);
  if (res !== ui.Button.YES) return;

  const t = nowStamp_();
  const stamp = { CreatedBy: "Demo Seed", CreatedAt: t, UpdatedBy: "", UpdatedAt: "" };
  const add = function (sheet, obj) {
    const rows = readRows_(sheet, true);
    const name = obj.Name ? String(obj.Name).toLowerCase() : "";
    if (sheet === "Projects" && obj.Code && rows.some(r => String(r.Code).toUpperCase() === String(obj.Code).toUpperCase())) return;
    if (sheet === "Contracts" && obj.RefNo && rows.some(r => r.Type === obj.Type && String(r.RefNo).toUpperCase() === String(obj.RefNo).toUpperCase())) return;
    if (sheet === "Budget" && rows.some(r => r.ProjectID === obj.ProjectID && r.HeadID === obj.HeadID && r.MaterialID === obj.MaterialID && r.ShopID === obj.ShopID)) return;
    if (sheet === "Expenses" && obj.InvoiceNo && rows.some(r => r.ProjectID === obj.ProjectID && r.SupplierID === obj.SupplierID && String(r.InvoiceNo) === String(obj.InvoiceNo))) return;
    if (name && rows.some(r => String(r.Name).toLowerCase() === name)) return;
    appendRow_(sheet, Object.assign({}, stamp, obj));
  };
  const d = function (n) {
    const dt = new Date(2026, 7, 20);
    dt.setDate(dt.getDate() - n);
    return dt.toISOString().slice(0, 10);
  };

  // Units
  [["U1", "Bag (50 kg)", "bag50"], ["U2", "Bag (25 kg)", "bag25"], ["U3", "Tonne", "t"], ["U4", "Kilogram", "kg"],
   ["U5", "Cubic Metre", "m³"], ["U6", "Square Metre", "m²"], ["U7", "Metre (linear)", "m"], ["U8", "Litre", "L"],
   ["U9", "Sheet", "sht"], ["U10", "Roll", "roll"], ["U11", "Piece", "pcs"], ["U12", "Trip / Load", "trip"],
   ["U13", "Lump Sum", "ls"], ["U14", "Man-Day", "md"], ["U15", "Hour", "hr"], ["U16", "Month", "mo"]]
    .forEach(x => add("Units", { ID: x[0], Name: x[1], Abbrev: x[2], Status: "Active", Remarks: "" }));

  // Expense heads
  [["H1", "Materials", "Direct"], ["H2", "Labour", "Labour"], ["H3", "Plant & Equipment Hire", "Equipment"],
   ["H4", "Subcontract Works", "Subcontract"], ["H5", "Transport & Haulage", "Direct"], ["H6", "Fuel & Lubricants", "Overhead"],
   ["H7", "Site Overheads", "Overhead"], ["H8", "Professional Fees", "Overhead"], ["H9", "Safety & Welfare", "Overhead"],
   ["H10", "Contingency", "Other"]]
    .forEach(x => add("ExpenseHeads", { ID: x[0], Name: x[1], Category: x[2], Status: "Active", Remarks: "" }));

  // Materials
  [["M1", "Portland Cement 42.5R (OPC)", "Construction Materials", "U1", 17500],
   ["M2", "Portland Cement 32.5N (PPC)", "Construction Materials", "U1", 16800],
   ["M3", "River Sand (washed)", "Aggregates", "U5", 28000],
   ["M4", "Crushed Stone 20mm", "Aggregates", "U5", 65000],
   ["M5", "Quarry Dust", "Aggregates", "U5", 32000],
   ["M6", "Aggregate 10mm", "Aggregates", "U5", 58000],
   ["M7", "Reinforcement Steel Y12 (12mm)", "Steel", "U3", 1050000],
   ["M8", "Reinforcement Steel Y16 (16mm)", "Steel", "U3", 1030000],
   ["M9", "Binding Wire", "Steel", "U4", 2900],
   ["M10", "BRC Mesh A142 (2.4m x 4.8m)", "Steel", "U9", 68000],
   ["M11", "Burnt Clay Bricks", "Masonry", "U11", 380],
   ["M12", "Concrete Blocks 150mm", "Masonry", "U11", 950],
   ["M13", "Timber 2x4 (3.0m)", "Timber", "U11", 8500],
   ["M14", "Plywood 18mm (8x4)", "Timber", "U9", 42000],
   ["M15", "IBR Roofing Sheets (3.0m)", "Roofing", "U9", 27500],
   ["M16", "Roofing Ridge Caps", "Roofing", "U9", 7800],
   ["M17", "Nails 100mm", "Fixings", "U4", 2400],
   ["M18", "Emulsion Paint", "Finishes", "U8", 6200],
   ["M19", "Gloss Paint", "Finishes", "U8", 8400],
   ["M20", "PVC Pipes 50mm (6m)", "Plumbing", "U11", 21000],
   ["M21", "Electrical Cable 2.5mm² (100m)", "Electrical", "U10", 185000],
   ["M22", "Ceramic Floor Tiles 600x600", "Finishes", "U6", 34000],
   ["M23", "Gypsum Board 12mm", "Finishes", "U9", 18500],
   ["M24", "Water (bowser)", "Services", "U8", 120],
   ["M25", "Diesel", "Fuel", "U8", 2850],
   ["M26", "Formwork Oil", "Consumables", "U8", 4600],
   ["M27", "Skilled Labour (Craft)", "Labour", "U14", 22500],
   ["M28", "General Labour", "Labour", "U14", 9500],
   ["M29", "Excavator Hire (CAT 320)", "Plant Hire", "U15", 145000],
   ["M30", "Tipper Truck Hire (10m³)", "Plant Hire", "U12", 85000],
   ["M31", "Crane Hire (25T)", "Plant Hire", "U15", 260000],
   ["M32", "Site Security Services", "Overheads", "U16", 1450000],
   ["M33", "Scaffolding Hire", "Plant Hire", "U16", 3800000],
   ["M34", "Site Electricity & Water", "Overheads", "U16", 850000],
   ["M35", "Site Office Rent", "Overheads", "U16", 1200000],
   ["M36", "PPE & Safety Gear", "Overheads", "U13", 4500000],
   ["M37", "Miscellaneous Consumables", "Consumables", "U13", 3200000],
   ["M38", "Professional Fees (Consultant)", "Fees", "U13", 12000000]]
    .forEach(x => add("Materials", { ID: x[0], Name: x[1], Category: x[2], Unit: x[3], StandardRate: x[4], Status: "Active", Remarks: "" }));

  // Suppliers
  [["S1", "Chipiku Building Supplies", "Mr. Chipiku", "+265 999 100 001", "orders@chipiku.mw", "Lilongwe Old Town", "TPIN-100001"],
   ["S2", "Lilongwe Hardware Centre", "Ms. Nyirenda", "+265 999 100 002", "sales@lhc.mw", "City Centre, Lilongwe", "TPIN-100002"],
   ["S3", "NBS Steel & Hardware", "Mr. Mwale", "+265 999 100 003", "nbs@steel.mw", "Kanengo Industrial Area", "TPIN-100003"],
   ["S4", "Malawi Timber Industries", "Mr. Banda", "+265 999 100 004", "info@mti.mw", "Area 25, Lilongwe", "TPIN-100004"],
   ["S5", "Zaka Aggregates & Quarry", "Mr. Zaka", "+265 999 100 005", "zaka@quarry.mw", "Lumbadzi", "TPIN-100005"],
   ["S6", "Capital Paints & Chemicals", "Ms. Phiri", "+265 999 100 006", "capital@paints.mw", "City Centre, Lilongwe", "TPIN-100006"],
   ["S7", "Fuel Express Filling Station", "Station Manager", "+265 999 100 007", "fuel@express.mw", "Kamuzu Procession Road", "TPIN-100007"],
   ["S8", "Buildman Electrical & Plumbing", "Mr. Gondwe", "+265 999 100 008", "buildman@ep.mw", "Old Town, Lilongwe", "TPIN-100008"]]
    .forEach(x => add("Suppliers", { ID: x[0], Name: x[1], ContactPerson: x[2], Phone: x[3], Email: x[4], Address: x[5], TIN: x[6], Status: "Active", Remarks: "" }));

  // Customers
  [["C1", "Lilongwe Water Board", "The Procurement Manager", "+265 1 755 555", "procurement@lwb.mw", "Likuni, Lilongwe", "TPIN-200001"],
   ["C2", "Press Corporation Ltd", "Head of Estates", "+265 1 820 000", "estates@presscorp.mw", "Gen. Glynn Jones Road, Blantyre", "TPIN-200002"],
   ["C3", "Malawi Housing Corporation", "Director of Projects", "+265 1 777 888", "projects@mhc.mw", "Area 3, Lilongwe", "TPIN-200003"],
   ["C4", "CDH Investment Bank", "Property Manager", "+265 1 833 000", "property@cdh.mw", "City Centre, Lilongwe", "TPIN-200004"],
   ["C5", "Roads Authority", "Chief Engineer", "+265 1 750 600", "ce@ra.mw", "Capital Hill, Lilongwe", "TPIN-200005"],
   ["C6", "Sunbird Hotels Ltd", "Maintenance Manager", "+265 1 774 388", "maintenance@sunbird.mw", "Victoria Avenue, Blantyre", "TPIN-200006"]]
    .forEach(x => add("Customers", { ID: x[0], Name: x[1], ContactPerson: x[2], Phone: x[3], Email: x[4], Address: x[5], TIN: x[6], Status: "Active", Remarks: "" }));

  // Shops
  [["SH1", "Head Office Store", "Kanengo, Lilongwe", "Bhavik Tankaria"],
   ["SH2", "Area 18 Site Store", "Area 18, Lilongwe", "Shakeel Patel"],
   ["SH3", "Kanengo Yard", "Kanengo Industrial Area", "Tanjani Malima"],
   ["SH4", "Bwaila Site Store", "Bwaila, Lilongwe", "Davie Chavula"],
   ["SH5", "Gateway Mall Site Store", "City Centre, Lilongwe", "Prashant Khatri"],
   ["SH6", "Mchinji Road Depot", "Mchinji", "Davie Chavula"]]
    .forEach(x => add("Shops", { ID: x[0], Name: x[1], Location: x[2], Supervisor: x[3], Status: "Active", Remarks: "" }));

  // Projects
  [["P1", "NX-2026-001", "Lilongwe Water Board — Head Office Refurbishment", "Lilongwe Water Board", "Likuni, Lilongwe", "2026-01-05", "2026-12-18", "Bhavik Tankaria", "Active"],
   ["P2", "NX-2026-002", "Gateway Mall Extension — Phase 2", "Press Corporation Ltd", "City Centre, Lilongwe", "2026-02-02", "2027-01-29", "Prashant Khatri", "Active"],
   ["P3", "NX-2026-003", "Bwaila Staff Housing — 12 Units", "Malawi Housing Corporation", "Bwaila, Lilongwe", "2026-03-16", "2026-11-30", "Shakeel Patel", "Active"],
   ["P4", "NX-2025-014", "Kanengo Warehouse & Yard Works", "CDH Investment Bank", "Kanengo, Lilongwe", "2025-08-01", "2026-03-31", "Tanjani Malima", "Completed"],
   ["P5", "NX-2026-005", "Mchinji Road Culvert Repairs", "Roads Authority", "Mchinji", "2026-05-04", "2026-10-30", "Davie Chavula", "On Hold"]]
    .forEach(x => add("Projects", { ID: x[0], Code: x[1], Name: x[2], Client: x[3], Location: x[4], StartDate: x[5], EndDate: x[6], Manager: x[7], Status: x[8], Remarks: "" }));

  // Budget lines: [id, project, head, material, shop, qty, rate]
  const B = function (id, p, h, m, s, q, r) {
    const mat = readRows_("Materials", true).find(x => x.ID === m);
    add("Budget", { ID: id, ProjectID: p, HeadID: h, MaterialID: m, ShopID: s, UnitID: mat ? mat.Unit : "U11", Qty: q, Rate: r, Amount: Math.round(q * r), Status: "Approved", Notes: "" });
  };
  B("B01", "P1", "H1", "M1", "SH1", 4200, 17500); B("B02", "P1", "H1", "M3", "SH1", 850, 28000);
  B("B03", "P1", "H1", "M4", "SH1", 640, 65000); B("B04", "P1", "H1", "M7", "SH3", 96, 1050000);
  B("B05", "P1", "H1", "M8", "SH3", 58, 1030000); B("B06", "P1", "H1", "M11", "SH2", 120000, 380);
  B("B07", "P1", "H1", "M12", "SH2", 18000, 950); B("B08", "P1", "H1", "M13", "SH2", 2400, 8500);
  B("B09", "P1", "H1", "M14", "SH2", 620, 42000); B("B10", "P1", "H1", "M15", "SH2", 900, 27500);
  B("B11", "P1", "H1", "M18", "SH2", 320, 6200); B("B12", "P1", "H1", "M19", "SH2", 160, 8400);
  B("B13", "P1", "H1", "M20", "SH2", 260, 21000); B("B14", "P1", "H1", "M21", "SH2", 18, 185000);
  B("B15", "P1", "H1", "M22", "SH2", 1450, 34000); B("B16", "P1", "H1", "M23", "SH2", 900, 18500);
  B("B17", "P1", "H2", "M27", "SH1", 4800, 22500); B("B18", "P1", "H2", "M28", "SH1", 6200, 9500);
  B("B19", "P1", "H3", "M29", "SH3", 320, 145000); B("B20", "P1", "H5", "M30", "SH3", 520, 85000);
  B("B21", "P1", "H9", "M32", "SH1", 9, 1450000); B("B22", "P1", "H6", "M25", "SH1", 3800, 2850);
  B("B23", "P2", "H1", "M1", "SH5", 5600, 17500); B("B24", "P2", "H1", "M4", "SH5", 1100, 65000);
  B("B25", "P2", "H1", "M7", "SH3", 185, 1050000); B("B26", "P2", "H1", "M10", "SH5", 420, 68000);
  B("B27", "P2", "H1", "M15", "SH5", 1450, 27500); B("B28", "P2", "H2", "M27", "SH5", 7200, 22500);
  B("B29", "P2", "H3", "M31", "SH3", 260, 260000); B("B30", "P2", "H3", "M33", "SH5", 10, 3800000);
  B("B31", "P2", "H9", "M36", "SH5", 1, 4500000); B("B32", "P2", "H6", "M25", "SH5", 5200, 2850);
  B("B33", "P3", "H1", "M1", "SH4", 3600, 17500); B("B34", "P3", "H1", "M11", "SH4", 96000, 380);
  B("B35", "P3", "H1", "M12", "SH4", 14000, 950); B("B36", "P3", "H1", "M7", "SH3", 88, 1050000);
  B("B37", "P3", "H1", "M15", "SH4", 760, 27500); B("B38", "P3", "H2", "M28", "SH4", 8800, 9500);
  B("B39", "P3", "H7", "M35", "SH4", 8, 1200000); B("B40", "P3", "H7", "M34", "SH4", 8, 850000);
  B("B41", "P3", "H6", "M25", "SH4", 2400, 2850); B("B42", "P4", "H1", "M1", "SH1", 2600, 17000);
  B("B43", "P4", "H1", "M4", "SH1", 980, 62000); B("B44", "P4", "H1", "M8", "SH3", 44, 1010000);
  B("B45", "P4", "H2", "M27", "SH1", 2100, 21000); B("B46", "P4", "H5", "M30", "SH3", 260, 82000);
  B("B47", "P5", "H1", "M1", "SH6", 900, 17500); B("B48", "P5", "H1", "M4", "SH6", 320, 65000);
  B("B49", "P5", "H1", "M7", "SH6", 22, 1050000); B("B50", "P5", "H4", "M38", "SH6", 1, 6500000);

  // Contracts
  const C = function (id, type, ref, date, proj, cust, supp, desc, amt, vat, status, pay) {
    const vatAmt = Math.round(amt * vat / 100);
    add("Contracts", { ID: id, Type: type, RefNo: ref, Date: date, Direction: type === "LPO" ? "Expense" : "Income", ProjectID: proj, CustomerID: cust, SupplierID: supp, Description: desc, Amount: amt, VATRate: vat, VATAmount: vatAmt, Total: amt + vatAmt, Status: status, PaymentStatus: pay, Remarks: "" });
  };
  C("CT1", "Contract Value", "CV-2026-001", "2026-01-05", "P1", "C1", "", "Head office refurbishment contract", 485000000, 16.5, "In Progress", "Unpaid");
  C("CT2", "Contract Value", "CV-2026-002", "2026-02-02", "P2", "C2", "", "Gateway Mall extension phase 2", 720000000, 16.5, "In Progress", "Unpaid");
  C("CT3", "Contract Value", "CV-2026-003", "2026-03-16", "P3", "C3", "", "12-unit staff housing", 540000000, 16.5, "In Progress", "Unpaid");
  C("CT4", "Contract Value", "CV-2025-014", "2025-08-01", "P4", "C4", "", "Warehouse & yard works", 260000000, 16.5, "Completed", "Paid");
  C("CT5", "Contract Value", "CV-2026-005", "2026-05-04", "P5", "C5", "", "Culvert repairs", 95000000, 16.5, "Awarded", "Unpaid");
  C("CT6", "Sales Invoice", "INV-2026-001", "2026-03-31", "P1", "C1", "", "IPC No.1 — substructure complete", 120000000, 16.5, "Issued", "Paid");
  C("CT7", "Sales Invoice", "INV-2026-002", "2026-04-30", "P2", "C2", "", "IPC No.1 — ground floor slab", 180000000, 16.5, "Issued", "Paid");
  C("CT8", "Sales Invoice", "INV-2026-003", "2026-05-31", "P3", "C3", "", "IPC No.1 — foundations", 135000000, 16.5, "Issued", "Partially Paid");
  C("CT9", "Sales Invoice", "INV-2026-004", "2026-06-30", "P1", "C1", "", "IPC No.2 — superstructure", 96000000, 16.5, "Issued", "Partially Paid");
  C("CT10", "Sales Invoice", "INV-2026-005", "2026-07-31", "P2", "C2", "", "IPC No.2 — first floor", 144000000, 16.5, "Issued", "Unpaid");
  C("CT11", "Sales Invoice", "INV-2026-006", "2026-07-31", "P3", "C3", "", "IPC No.2 — walls", 108000000, 16.5, "Issued", "Unpaid");
  C("CT12", "Sales Invoice", "INV-2025-018", "2025-12-15", "P4", "C4", "", "Final certificate", 78000000, 16.5, "Issued", "Paid");
  C("CT13", "LPO", "LPO-2026-001", "2026-01-10", "P1", "", "S1", "2,400 bags OPC cement", 42000000, 0, "Received", "Paid");
  C("CT14", "LPO", "LPO-2026-002", "2026-01-15", "P1", "", "S3", "120 t reinforcement steel Y12/Y16", 124000000, 0, "Partially Received", "Partially Paid");
  C("CT15", "LPO", "LPO-2026-003", "2026-02-20", "P2", "", "S5", "Crushed stone & quarry dust", 71500000, 0, "Received", "Paid");
  C("CT16", "LPO", "LPO-2026-004", "2026-03-05", "P3", "", "S1", "Cement & blocks for housing", 38000000, 0, "Open", "Unpaid");
  C("CT17", "LPO", "LPO-2026-005", "2026-04-12", "P2", "", "S6", "Paint & finishes", 9400000, 0, "Partially Received", "Unpaid");
  C("CT18", "LPO", "LPO-2026-006", "2026-05-08", "P1", "", "S8", "Electrical & plumbing supplies", 21400000, 0, "Open", "Unpaid");

  // Expenses
  const X = function (id, bid, daysAgo, supp, inv, qty, rate, pay, who, override, reason) {
    const bl = readRows_("Budget", true).find(b => b.ID === bid);
    if (!bl) return;
    const mat = readRows_("Materials", true).find(m => m.ID === bl.MaterialID);
    add("Expenses", {
      ID: id, ProjectID: bl.ProjectID, BudgetID: bid, Date: d(daysAgo), ShopID: bl.ShopID, SupplierID: supp,
      InvoiceNo: inv, HeadID: bl.HeadID, MaterialID: bl.MaterialID, UnitID: mat ? mat.Unit : "U11",
      Qty: qty, Rate: rate, Amount: Math.round(qty * rate), PaymentStatus: pay,
      Override: override || "NO", OverrideReason: reason || "", Remarks: "",
      CreatedBy: who, CreatedAt: t, UpdatedBy: "", UpdatedAt: "",
    });
  };
  X("E01", "B01", 215, "S1", "CBS-2026-0142", 600, 17500, "Paid", "Bhavik Tankaria");
  X("E02", "B01", 180, "S1", "CBS-2026-0210", 700, 17600, "Paid", "Bhavik Tankaria");
  X("E03", "B01", 150, "S1", "CBS-2026-0298", 550, 17500, "Paid", "Davie Chavula");
  X("E04", "B01", 120, "S2", "LHC-2026-1011", 500, 17550, "Paid", "Tanjani Malima");
  X("E05", "B01", 85, "S1", "CBS-2026-0412", 650, 17500, "Paid", "Bhavik Tankaria");
  X("E06", "B01", 50, "S1", "CBS-2026-0550", 600, 17600, "Partially Paid", "Prashant Khatri");
  X("E07", "B02", 190, "S5", "ZAQ-2026-0077", 260, 28000, "Paid", "Bhavik Tankaria");
  X("E08", "B02", 140, "S5", "ZAQ-2026-0133", 220, 28500, "Paid", "Tanjani Malima");
  X("E09", "B02", 60, "S5", "ZAQ-2026-0219", 180, 28000, "Unpaid", "Davie Chavula");
  X("E10", "B03", 160, "S5", "ZAQ-2026-0108", 300, 65000, "Paid", "Bhavik Tankaria");
  X("E11", "B03", 95, "S5", "ZAQ-2026-0176", 220, 66000, "Partially Paid", "Tanjani Malima");
  X("E12", "B04", 170, "S3", "NBS-2026-0045", 40, 1050000, "Paid", "Bhavik Tankaria");
  X("E13", "B04", 110, "S3", "NBS-2026-0092", 38, 1060000, "Partially Paid", "Tanjani Malima");
  X("E14", "B05", 130, "S3", "NBS-2026-0104", 30, 1030000, "Partially Paid", "Bhavik Tankaria");
  X("E15", "B06", 155, "S2", "LHC-2026-0871", 45000, 380, "Paid", "Davie Chavula");
  X("E16", "B06", 90, "S2", "LHC-2026-1134", 40000, 385, "Paid", "Davie Chavula");
  X("E17", "B07", 125, "S2", "LHC-2026-0955", 8000, 950, "Paid", "Shakeel Patel");
  X("E18", "B08", 115, "S4", "MTI-2026-0331", 1100, 8500, "Paid", "Shakeel Patel");
  X("E19", "B09", 100, "S4", "MTI-2026-0398", 280, 42000, "Paid", "Shakeel Patel");
  X("E20", "B10", 80, "S3", "NBS-2026-0155", 420, 27500, "Partially Paid", "Shakeel Patel");
  X("E21", "B15", 70, "S2", "LHC-2026-1344", 650, 34000, "Unpaid", "Shakeel Patel");
  X("E22", "B17", 45, "S1", "PAY-2026-06", 620, 22500, "Paid", "Prashant Khatri");
  X("E23", "B17", 15, "S1", "PAY-2026-07", 640, 22500, "Partially Paid", "Prashant Khatri");
  X("E24", "B18", 45, "S1", "PAY-2026-06", 780, 9500, "Paid", "Prashant Khatri");
  X("E25", "B18", 15, "S1", "PAY-2026-07", 800, 9500, "Paid", "Prashant Khatri");
  X("E26", "B19", 135, "S5", "ZAK-2026-0122", 120, 145000, "Paid", "Bhavik Tankaria");
  X("E27", "B20", 105, "S5", "ZAK-2026-0150", 160, 85000, "Paid", "Bhavik Tankaria");
  X("E28", "B21", 30, "S2", "SEC-2026-04", 3, 1450000, "Paid", "Tanjani Malima");
  X("E29", "B22", 20, "S7", "FEX-2026-0088", 950, 2850, "Paid", "Davie Chavula");
  X("E30", "B22", 5, "S7", "FEX-2026-0112", 1000, 2900, "Unpaid", "Davie Chavula");
  X("E31", "B23", 150, "S1", "CBS-2026-0315", 1500, 17500, "Paid", "Prashant Khatri");
  X("E32", "B23", 90, "S1", "CBS-2026-0480", 1400, 17600, "Partially Paid", "Prashant Khatri");
  X("E33", "B24", 120, "S5", "ZAQ-2026-0188", 500, 65000, "Paid", "Prashant Khatri");
  X("E34", "B25", 100, "S3", "NBS-2026-0123", 75, 1050000, "Partially Paid", "Prashant Khatri");
  X("E35", "B26", 85, "S3", "NBS-2026-0160", 180, 68000, "Unpaid", "Shakeel Patel");
  X("E36", "B27", 75, "S3", "NBS-2026-0177", 500, 27500, "Unpaid", "Shakeel Patel");
  X("E37", "B28", 60, "S2", "PAY-2026-05", 900, 22500, "Paid", "Prashant Khatri");
  X("E38", "B28", 30, "S2", "PAY-2026-06", 920, 22500, "Paid", "Prashant Khatri");
  X("E39", "B29", 95, "S5", "ZAK-2026-0201", 90, 260000, "Paid", "Bhavik Tankaria");
  X("E40", "B30", 40, "S2", "SCA-2026-003", 3, 3800000, "Partially Paid", "Bhavik Tankaria");
  X("E41", "B32", 25, "S7", "FEX-2026-0101", 1400, 2850, "Paid", "Bhavik Tankaria");
  X("E42", "B33", 140, "S1", "CBS-2026-0355", 1000, 17500, "Paid", "Shakeel Patel");
  X("E43", "B34", 110, "S2", "LHC-2026-1022", 40000, 380, "Paid", "Shakeel Patel");
  X("E44", "B35", 80, "S2", "LHC-2026-1189", 6500, 950, "Paid", "Shakeel Patel");
  X("E45", "B36", 70, "S3", "NBS-2026-0148", 34, 1050000, "Partially Paid", "Shakeel Patel");
  X("E46", "B38", 55, "S1", "PAY-2026-05", 1200, 9500, "Paid", "Shakeel Patel");
  X("E47", "B38", 20, "S1", "PAY-2026-06", 1250, 9500, "Partially Paid", "Shakeel Patel");
  X("E48", "B41", 15, "S7", "FEX-2026-0115", 800, 2850, "Unpaid", "Shakeel Patel");
  X("E49", "B42", 240, "S1", "CBS-2025-1180", 900, 17000, "Paid", "Tanjani Malima");
  X("E50", "B42", 200, "S1", "CBS-2025-1255", 850, 17100, "Paid", "Tanjani Malima");
  X("E51", "B43", 210, "S5", "ZAQ-2025-0311", 420, 62000, "Paid", "Tanjani Malima");
  X("E52", "B44", 180, "S3", "NBS-2025-0222", 20, 1010000, "Paid", "Tanjani Malima");
  X("E53", "B45", 150, "S1", "PAY-2025-10", 700, 21000, "Paid", "Tanjani Malima");
  X("E54", "B45", 120, "S1", "PAY-2025-11", 720, 21000, "Paid", "Davie Chavula");
  X("E55", "B46", 130, "S5", "ZAK-2025-0277", 90, 82000, "Paid", "Davie Chavula");
  X("E56", "B17", 3, "S1", "PAY-2026-08", 500, 22500, "Unpaid", "Prashant Khatri", "YES", "Additional manpower approved by Project Manager");
  X("E57", "B47", 10, "S1", "CBS-2026-0601", 300, 17500, "Unpaid", "Davie Chavula");

  audit_("Demo Seed", "CREATE", "System", "seedDemoData", "Sample data loaded");
  bumpVersion_();
  ui.alert("✅ Demo data loaded!\n\n5 projects, 50 budget lines, 18 contracts/LPOs/invoices and 57 expense entries.\nDeploy as Web App and connect the frontend to explore.");
}
