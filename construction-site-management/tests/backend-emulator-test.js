/* ============================================================
   NEXORA CMS — Google Apps Script backend emulator test
   ------------------------------------------------------------
   Runs the REAL backend/Code.gs inside Node with a full Apps
   Script environment emulation (spreadsheet, script cache,
   crypto, content service). Exercises the complete live-API
   surface end-to-end:
   • auto-seed of the 5 admins
   • camelCase ⇄ PascalCase mapping (writes AND reads)
   • strict budget control, duplicates, locking
   • login/token auth, settings, audit, JSONP channel, hosted api()
   • version + fingerprint for real-time sync
   Run:  node tests/backend-emulator-test.js
   ============================================================ */
"use strict";

const path = require("path");
const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "backend", "Code.gs"), "utf8");

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log("  ✅ " + name); }
  catch (e) { fail++; console.log("  ❌ " + name + " — " + (e && e.message)); }
}

/* ---------------- Apps Script environment emulation ---------------- */
function createEnv() {
  const cache = new Map();

  class Range {
    constructor(sheet, r, c, nr, nc) { this.sheet = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
    _ensureRows(n) { while (this.sheet.rows.length < n) this.sheet.rows.push([]); }
    _ensureCols(row, n) { while (row.length < n) row.push(""); }
    setValues(values) {
      this._ensureRows(this.r - 1 + values.length);
      values.forEach((row, i) => {
        const target = this.sheet.rows[this.r - 1 + i];
        this._ensureCols(target, this.c - 1 + row.length);
        row.forEach((v, j) => { target[this.c - 1 + j] = v === undefined || v === null ? "" : v; });
      });
      return this;
    }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const srcRow = this.sheet.rows[this.r - 1 + i] || [];
        const row = [];
        for (let j = 0; j < this.nc; j++) {
          const v = srcRow[this.c - 1 + j];
          row.push(v === undefined || v === null ? "" : v);
        }
        out.push(row);
      }
      return out;
    }
    clearContent() {
      for (let i = 0; i < this.nr; i++) {
        const target = this.sheet.rows[this.r - 1 + i];
        if (target) for (let j = 0; j < this.nc; j++) target[this.c - 1 + j] = "";
      }
      return this;
    }
    setFontWeight() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
    setFrozenRows() { return this; }
  }

  class Sheet {
    constructor(name) { this.name = name; this.rows = []; }
    getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
    getDataRange() {
      const maxCols = this.rows.reduce((a, r2) => Math.max(a, r2.length), 1);
      return new Range(this, 1, 1, Math.max(1, this.rows.length), maxCols);
    }
    appendRow(arr) { this.rows.push(arr.map(v => v === undefined || v === null ? "" : v)); }
    deleteRow(i) { if (i >= 1 && i <= this.rows.length) this.rows.splice(i - 1, 1); }
    getLastRow() { return this.rows.length; }
    clearContents() { this.rows = []; }
    setFrozenRows() { return this; }
  }

  const ss = {
    sheets: {},
    getSheetByName(name) { return this.sheets[name] || null; },
    insertSheet(name) {
      if (!this.sheets[name]) this.sheets[name] = new Sheet(name);
      return this.sheets[name];
    },
  };

  const spreadsheetApp = {
    getActiveSpreadsheet() { return ss; },
    getUi() { return { alert() { return this; }, ButtonSet: { OK: "OK", YES_NO: "YES_NO" }, Button: { YES: "YES", NO: "NO" } }; },
  };

  const scriptCache = {
    get(k) { return cache.has(k) ? cache.get(k) : null; },
    put(k, v) { cache.set(k, String(v)); },
    remove(k) { cache.delete(k); },
  };

  const utilities = {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "utf8" },
    computeDigest(alg, s) {
      return Array.from(crypto.createHash("sha256").update(String(s), "utf8").digest());
    },
  };

  class TextOutput {
    constructor(text) { this._text = text; }
    setMimeType() { return this; }
    setHeader() { return this; }
    getContent() { return this._text; }
  }

  const contentService = {
    MimeType: { JSON: "application/json", JAVASCRIPT: "application/javascript", PLAIN_TEXT: "text/plain" },
    createTextOutput(text) { return new TextOutput(text); },
  };

  const htmlService = {
    createHtmlOutput(html) {
      return { _html: html, setTitle() { return this; }, addMetaTag() { return this; }, getContent() { return this._html; } };
    },
    createHtmlOutputFromFile(name) { throw new Error("Html file not found: " + name); },
  };

  const driveApp = { getRootFolder() { return { createFile(name) { return { getName() { return name; } }; } }; } };

  const ctx = {
    SpreadsheetApp: spreadsheetApp,
    CacheService: { getScriptCache() { return scriptCache; } },
    Utilities: utilities,
    ContentService: contentService,
    HtmlService: htmlService,
    DriveApp: driveApp,
    console,
    Date, Math, JSON, Object, String, Number, Array, Boolean,
    parseInt, parseFloat, isNaN, encodeURIComponent,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: "backend/Code.gs" });
  return { doPost: ctx.doPost, doGet: ctx.doGet, api: ctx.api, ss, cache };
}

/* ---------------- run the full API surface ---------------- */
(async () => {
  console.log("Nexora CMS — Apps Script backend emulator test\n");
  const env = createEnv();

  const post = (payload) => JSON.parse(env.doPost({ postData: { contents: JSON.stringify(payload) } }).getContent());
  const okOf = (res, what) => { if (!res.ok) throw new Error(what + ": " + (res.error && res.error.message)); return res.data; };

  console.log("— public endpoints & auto-seeding —");
  check("getState returns camelCase settings + fingerprint", () => {
    const d = okOf(post({ action: "getState" }), "getState");
    if (d.settings.companyName !== "Nexora Limited") throw new Error("companyName missing: " + JSON.stringify(d.settings));
    if (d.settings.defaultVAT !== "16.5") throw new Error("defaultVAT not defaulted");
    if (!d.fingerprint) throw new Error("fingerprint missing");
    if (d.backendVersion !== 4) throw new Error("backendVersion should be 4, got " + d.backendVersion);
  });
  check("ping auto-seeds the 5 admin users into the empty sheet", () => {
    const d = okOf(post({ action: "ping" }), "ping");
    if (d.counts.users !== 5) throw new Error("expected 5 seeded users, got " + d.counts.users);
    const names = env.ss.sheets.Users.rows.slice(1).map(r => r[1]);
    ["Prashant Khatri", "Shakeel Patel", "Bhavik Tankaria", "Tanjani Malima", "Davie Chavula"].forEach(n => {
      if (!names.includes(n)) throw new Error("missing seeded user " + n);
    });
  });
  check("getLoginUsers lists the 5 users (camelCase)", () => {
    const d = okOf(post({ action: "getLoginUsers" }), "getLoginUsers");
    if (d.rows.length !== 5) throw new Error("expected 5");
    if (d.rows[0].name === undefined || d.rows[0].role === undefined) throw new Error("rows not camelCase: " + JSON.stringify(d.rows[0]));
  });
  check("JSONP channel (doGet?cb=…) answers with a script wrapper", () => {
    const out = env.doGet({ parameter: { cb: "nxcb_test", p: JSON.stringify({ action: "ping" }) } });
    const text = out.getContent();
    if (!text.startsWith("nxcb_test(")) throw new Error("bad JSONP wrapper: " + text.slice(0, 60));
    const inner = JSON.parse(text.slice("nxcb_test(".length, -2));
    if (!inner.ok || inner.data.counts.users !== 5) throw new Error("JSONP payload invalid");
  });
  check("hosted api() entry point returns a plain object", () => {
    const res = env.api(JSON.stringify({ action: "ping" }));
    if (!res.ok || res.data.mode !== "live") throw new Error("hosted api() failed");
  });

  console.log("— login & auth —");
  let user = null, token = null;
  check("login succeeds with the seeded credentials", () => {
    const d = okOf(post({ action: "login", payload: { name: "Bhavik Tankaria", pin: "1234" } }), "login");
    if (d.user.role !== "Admin" || !d.token) throw new Error("bad login data");
    user = d.user; token = d.token;
  });
  check("login rejects a wrong PIN", () => {
    const res = post({ action: "login", payload: { name: "Bhavik Tankaria", pin: "0000" } });
    if (res.ok || res.error.code !== "LOGIN") throw new Error("should fail");
  });
  check("protected actions require a valid token", () => {
    const res = post({ action: "getMasters", payload: { sheet: "Projects" } });
    if (res.ok || res.error.code !== "SESSION") throw new Error("should be SESSION, got " + JSON.stringify(res));
  });
  const authed = (payload) => Object.assign({ user, token }, payload);

  console.log("— masters round-trip (the blank-data regression) —");
  let projId = null;
  check("saveMaster persists ALL fields (not just ID/date)", () => {
    const res = post(authed({ action: "saveMaster", payload: { sheet: "Projects", data: {
      code: "EMU-001", name: "Emulator Office Block", client: "Acme Ltd", location: "Lilongwe",
      startDate: "2026-01-05", endDate: "2026-12-18", manager: "Bhavik Tankaria", status: "Active", remarks: "test",
    } } }));
    const d = okOf(res, "saveMaster Projects");
    const p = d.rows.find(x => x.code === "EMU-001");
    if (!p) throw new Error("project not returned");
    if (p.name !== "Emulator Office Block") throw new Error("name lost: " + JSON.stringify(p));
    if (p.startDate !== "2026-01-05" || p.manager !== "Bhavik Tankaria") throw new Error("fields lost");
    if (!p.id || !p.createdBy) throw new Error("id/createdBy missing");
    projId = p.id;
    // verify the RAW sheet has the data too (not just an API echo)
    const raw = env.ss.sheets.Projects.rows.find(r => r[0] === projId);
    if (!raw || raw[2] !== "Emulator Office Block" || raw[1] !== "EMU-001") throw new Error("sheet row is blank/wrong: " + JSON.stringify(raw));
  });
  check("getMasters returns camelCase rows", () => {
    const d = okOf(post(authed({ action: "getMasters", payload: { sheet: "Projects" } })), "getMasters");
    const p = d.rows.find(x => x.id === projId);
    if (!p || p.client !== "Acme Ltd" || p.endDate !== "2026-12-18") throw new Error("read-back wrong");
  });
  check("duplicate project code blocked", () => {
    const res = post(authed({ action: "saveMaster", payload: { sheet: "Projects", data: { code: "EMU-001", name: "Other", status: "Active" } } }));
    if (res.ok || res.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
  });

  let shopId, headId, unitId, matId;
  check("shops/heads/units/materials save with data intact", () => {
    shopId = okOf(post(authed({ action: "saveMaster", payload: { sheet: "Shops", data: { name: "Emu Store", location: "Area 9", supervisor: "Shakeel", status: "Active" } } })), "save Shops").rows[0].id;
    headId = okOf(post(authed({ action: "saveMaster", payload: { sheet: "ExpenseHeads", data: { name: "Materials", category: "Direct", status: "Active" } } })), "save Heads").rows[0].id;
    unitId = okOf(post(authed({ action: "saveMaster", payload: { sheet: "Units", data: { name: "Bag (50 kg)", abbrev: "bag50", status: "Active" } } })), "save Units").rows[0].id;
    const mres = post(authed({ action: "saveMaster", payload: { sheet: "Materials", data: { name: "Cement 42.5", category: "Construction", unit: unitId, standardRate: 17500, status: "Active" } } }));
    const md = okOf(mres, "save Materials");
    const m = md.rows.find(x => x.name === "Cement 42.5");
    if (!m || m.unit !== unitId || Number(m.standardRate) !== 17500) throw new Error("material fields lost: " + JSON.stringify(m));
    matId = m.id;
  });

  console.log("— budget → contract → expense round-trip —");
  let budgetId = null;
  check("budget line saves with computed amount + derived unit", () => {
    const res = post(authed({ action: "saveBudgetLine", payload: { data: {
      projectId: projId, headId, materialId: matId, shopId, qty: 100, rate: 17500, status: "Approved",
    } } }));
    const d = okOf(res, "saveBudgetLine");
    const b = d.rows.find(x => x.projectId === projId);
    if (!b) throw new Error("budget line not returned");
    if (Number(b.amount) !== 1750000) throw new Error("amount wrong: " + b.amount);
    if (b.unitId !== unitId) throw new Error("unitId not derived from material");
    if (b.materialId !== matId || b.headId !== headId || b.shopId !== shopId) throw new Error("ids lost");
    budgetId = b.id;
  });
  check("duplicate budget combo blocked", () => {
    const res = post(authed({ action: "saveBudgetLine", payload: { data: { projectId: projId, headId, materialId: matId, shopId, qty: 1, rate: 1, status: "Approved" } } }));
    if (res.ok || res.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
  });

  check("sales invoice saves with VAT math + camelCase", () => {
    const res = post(authed({ action: "saveContract", payload: { data: {
      type: "Sales Invoice", refNo: "INV-EMU-001", date: "2026-08-21", projectId: projId, customerId: "C1",
      description: "IPC 1", amount: 100000, vatRate: 16.5, status: "Issued", paymentStatus: "Unpaid",
    } } }));
    const d = okOf(res, "saveContract");
    const c = d.rows.find(x => x.refNo === "INV-EMU-001");
    if (!c) throw new Error("contract not returned");
    if (Number(c.total) !== 116500) throw new Error("VAT math wrong: " + c.total);
    if (c.direction !== "Income") throw new Error("direction wrong");
    if (Number(c.vatAmount) !== 16500) throw new Error("vatAmount wrong");
  });
  check("duplicate contract ref blocked", () => {
    const res = post(authed({ action: "saveContract", payload: { data: { type: "Sales Invoice", refNo: "INV-EMU-001", date: "2026-08-21", projectId: projId, customerId: "C1", amount: 1000, vatRate: 0, status: "Issued", paymentStatus: "Unpaid" } } }));
    if (res.ok || res.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
  });

  let expenseId = null;
  check("expense posts against the budget line (derived fields, strict)", () => {
    const res = post(authed({ action: "saveExpense", payload: { data: {
      projectId: projId, budgetId, date: "2026-08-21", supplierId: "S1", invoiceNo: "EMU-E-001",
      qty: 10, rate: 17500, paymentStatus: "Unpaid",
      // attack attempt: try to smuggle different head/material/shop
      headId: "H999", materialId: "M999", shopId: "SH999",
    } } }));
    const d = okOf(res, "saveExpense");
    const e = d.rows.find(x => x.invoiceNo === "EMU-E-001");
    if (!e) throw new Error("expense not returned");
    if (Number(e.amount) !== 175000) throw new Error("amount wrong");
    if (e.headId !== headId || e.materialId !== matId || e.shopId !== shopId || e.unitId !== unitId) {
      throw new Error("fields not derived from budget line — smuggle possible!");
    }
    expenseId = e.id;
  });
  check("over-budget expense blocked (strict control)", () => {
    const res = post(authed({ action: "saveExpense", payload: { data: { projectId: projId, budgetId, date: "2026-08-21", supplierId: "S1", invoiceNo: "EMU-E-002", qty: 999, rate: 17500 } } }));
    if (res.ok || res.error.code !== "OVER_BUDGET") throw new Error("expected OVER_BUDGET, got " + JSON.stringify(res));
  });
  check("duplicate expense invoice blocked", () => {
    const res = post(authed({ action: "saveExpense", payload: { data: { projectId: projId, budgetId, date: "2026-08-21", supplierId: "S1", invoiceNo: "EMU-E-001", qty: 1, rate: 17500 } } }));
    if (res.ok || res.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
  });
  check("budget line with consumption can be edited (unitId omitted) but not reduced below consumed", () => {
    const keep = post(authed({ action: "saveBudgetLine", payload: { id: budgetId, data: { projectId: projId, headId, materialId: matId, shopId, qty: 100, rate: 17500, status: "Approved" } } }));
    if (!keep.ok) throw new Error("edit with omitted unitId should pass: " + (keep.error && keep.error.message));
    const reduce = post(authed({ action: "saveBudgetLine", payload: { id: budgetId, data: { projectId: projId, headId, materialId: matId, shopId, qty: 5, rate: 17500, status: "Approved" } } }));
    if (reduce.ok) throw new Error("reduction below consumed should fail");
  });
  check("budget line with consumption cannot be deleted", () => {
    const res = post(authed({ action: "deleteBudgetLine", payload: { id: budgetId } }));
    if (res.ok) throw new Error("should be IN_USE");
  });

  console.log("— settings, audit, getAll —");
  check("settings round-trip camelCase ⇄ PascalCase", () => {
    const res = post(authed({ action: "saveSettings", payload: { settings: { companyName: "ACME Construction", allowOverBudget: "YES", pollInterval: 60 } } }));
    const d = okOf(res, "saveSettings");
    if (d.settings.companyName !== "ACME Construction") throw new Error("companyName not saved");
    if (d.settings.allowOverBudget !== "YES") throw new Error("allowOverBudget not saved");
    // raw sheet check
    const rows = env.ss.sheets.Settings.rows;
    const kv = {};
    rows.forEach(r => { kv[r[0]] = r[1]; });
    if (kv.CompanyName !== "ACME Construction" || kv.AllowOverBudget !== "YES") throw new Error("sheet settings wrong: " + JSON.stringify(kv));
  });
  check("audit trail is written and returned camelCase", () => {
    const d = okOf(post(authed({ action: "getAudit", payload: { limit: 50 } })), "getAudit");
    if (!d.rows.length) throw new Error("audit empty");
    const r = d.rows[0];
    if (r.ts === undefined || r.user === undefined || r.action === undefined || r.entity === undefined) {
      throw new Error("audit keys not camelCase: " + JSON.stringify(r));
    }
    const found = d.rows.some(a => a.action === "CREATE" && a.entity === "Expense");
    if (!found) throw new Error("expense CREATE not in audit");
  });
  check("getAll returns everything camelCase", () => {
    const d = okOf(post(authed({ action: "getAll" })), "getAll");
    if (d.masters.Projects[0].name === undefined) throw new Error("masters not camel");
    if (d.budget[0].projectId === undefined) throw new Error("budget not camel");
    if (d.expenses[0].materialId === undefined) throw new Error("expenses not camel");
    if (d.contracts[0].refNo === undefined) throw new Error("contracts not camel");
    if (d.audit[0].ts === undefined) throw new Error("audit not camel");
    if (d.settings.companyName !== "ACME Construction") throw new Error("settings not camel");
  });

  console.log("— sync: version + fingerprint —");
  check("version bumps and fingerprint changes on writes", () => {
    const v1 = okOf(post(authed({ action: "getVersion" })), "getVersion v1").version;
    const f1 = okOf(post(authed({ action: "getVersion" })), "getVersion f1").fingerprint;
    post(authed({ action: "saveMaster", payload: { sheet: "Units", data: { name: "Fingerprint Unit", abbrev: "fp", status: "Active" } } }));
    const d2 = okOf(post(authed({ action: "getVersion" })), "getVersion v2");
    if (!(d2.version > v1)) throw new Error("version did not bump");
    if (d2.fingerprint === f1) throw new Error("fingerprint did not change");
  });
  check("fingerprint changes when the sheet is edited DIRECTLY (no version bump)", () => {
    const f1 = okOf(post(authed({ action: "getVersion" })), "getVersion").fingerprint;
    // simulate a user typing directly into the Google Sheet
    env.ss.sheets.Projects.appendRow(["DIRECT-1", "", "Direct Edit Row", "", "", "", "", "", "", "", "", "", "", ""]);
    // fingerprint cache TTL is 8s — clear the emulator cache entry to simulate time passing
    env.cache.delete("fingerprint");
    const f2 = okOf(post(authed({ action: "getVersion" })), "getVersion after direct edit").fingerprint;
    if (f1 === f2) throw new Error("direct sheet edit not detected");
  });

  console.log("— cleanup —");
  check("full delete chain works (expense → budget → contract → masters)", () => {
    okOf(post(authed({ action: "deleteExpense", payload: { id: expenseId } })), "deleteExpense");
    okOf(post(authed({ action: "deleteBudgetLine", payload: { id: budgetId } })), "deleteBudgetLine");
    const c = okOf(post(authed({ action: "getContracts" })), "getContracts").rows.find(x => x.refNo === "INV-EMU-001");
    okOf(post(authed({ action: "deleteContract", payload: { id: c.id } })), "deleteContract");
    okOf(post(authed({ action: "deleteMaster", payload: { sheet: "Projects", id: projId } })), "deleteMaster Projects");
    okOf(post(authed({ action: "deleteMaster", payload: { sheet: "Materials", id: matId } })), "deleteMaster Materials");
    okOf(post(authed({ action: "deleteMaster", payload: { sheet: "Units", id: unitId } })), "deleteMaster Units");
    okOf(post(authed({ action: "deleteMaster", payload: { sheet: "Shops", id: shopId } })), "deleteMaster Shops");
    okOf(post(authed({ action: "deleteMaster", payload: { sheet: "ExpenseHeads", id: headId } })), "deleteMaster ExpenseHeads");
  });

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("❌ failure:", e); process.exit(1); });
