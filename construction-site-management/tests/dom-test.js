/* ============================================================
   NEXORA CMS — DOM-level test (jsdom)
   Boots the real index.html, logs in, walks every page,
   opens forms and verifies the app does not throw.
   Run: node tests/dom-test.js   (requires: npm i jsdom)
   ============================================================ */
"use strict";

const path = require("path");
const fs = require("fs");
let jsdomMod;
try {
  jsdomMod = require("jsdom");
} catch (e) {
  try { jsdomMod = require("/tmp/node_modules/jsdom"); } catch (e2) {
    console.error("jsdom is required:  npm install jsdom   (or install it to /tmp/node_modules)");
    process.exit(1);
  }
}

const rootDir = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");

const errors = [];
const virtualConsole = new jsdomMod.VirtualConsole();
virtualConsole.on("jsdomError", e => {
  const msg = String(e && e.message || e);
  if (/not implemented/i.test(msg)) return; // ignore scrollTo etc.
  errors.push("jsdomError: " + msg);
});

// serve local files, block external CDN (chart.js not needed in jsdom)
class LocalLoader extends jsdomMod.ResourceLoader {
  fetch(url) {
    if (url.startsWith("http://localhost/")) {
      const p = decodeURIComponent(url.replace("http://localhost/", "").split("?")[0]);
      try {
        return Promise.resolve(Buffer.from(fs.readFileSync(path.join(rootDir, p))));
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return Promise.resolve(Buffer.from(""));
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitFor(fn, what, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 12000)) {
    try { const v = fn(); if (v) return v; } catch (e) { /* retry */ }
    await sleep(120);
  }
  throw new Error("Timed out waiting for: " + what);
}

(async () => {
  const dom = new jsdomMod.JSDOM(html, {
    runScripts: "dangerously",
    resources: new LocalLoader(),
    url: "http://localhost/",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.addEventListener("error", e => errors.push("window error: " + (e.message || e.error)));
      window.console.error = (...a) => errors.push("console.error: " + a.join(" "));
      window.print = () => {};
    },
  });
  const { window } = dom;
  const { document } = window;

  // ---- boot (DOMContentLoaded fired by jsdom when scripts parsed) ----
  await waitFor(() => window.App && document.querySelector("#login-screen"), "app boot + login screen");
  console.log("✅ app booted — login screen shown (" + (window.API.store.mode) + " mode)");

  // ---- login as admin ----
  const login = document.querySelector("#login-screen");
  const userInput = login.querySelector(".sselect-input");
  userInput.value = "Bhavik";
  userInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(350);
  const item = login.querySelector(".sselect-item");
  if (!item) throw new Error("no user found in login dropdown");
  item.dispatchEvent(new window.Event("mousedown", { bubbles: true }));
  login.querySelector("#login-pin").value = "1234";
  login.querySelector("#login-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => document.querySelector(".sb-user-name") && document.querySelector(".kpi-grid .kpi"), "login + dashboard render");
  console.log("✅ logged in as admin — dashboard rendered with " + document.querySelectorAll(".kpi").length + " KPI cards");

  const routes = [
    ["#/masters/projects", ".mtab", "masters page"],
    ["#/budget", "#budget-summary", "budget page"],
    ["#/contracts", ".type-tabs", "contracts page"],
    ["#/expenses", "#ex-table-host", "expenses page"],
    ["#/reports/pl", ".report-picker", "reports page"],
    ["#/audit", "#audit-table-host", "audit page"],
    ["#/settings", ".settings-grid", "settings page"],
  ];

  for (const [hash, marker, what] of routes) {
    window.location.hash = hash;
    window.dispatchEvent(new window.Event("hashchange"));
    await waitFor(() => document.querySelector(marker) && document.querySelector("#content").children.length > 1, what);
    console.log("✅ " + what + " rendered");
  }

  // ---- masters: open Add Project form and cancel ----
  window.location.hash = "#/masters/projects";
  window.dispatchEvent(new window.Event("hashchange"));
  await waitFor(() => document.querySelector('[data-act="add"]'), "add button");
  document.querySelector('[data-act="add"]').click();
  await waitFor(() => document.querySelector(".modal-backdrop .modal"), "masters modal");
  console.log("✅ masters add-modal opened");
  document.querySelector(".modal-backdrop [data-act='cancel']").click();
  await sleep(300);

  // ---- budget: open Add Budget Line form, verify search selects present ----
  window.location.hash = "#/budget";
  window.dispatchEvent(new window.Event("hashchange"));
  await waitFor(() => document.querySelector('[data-act="add"]'), "budget add button");
  document.querySelector('[data-act="add"]').click();
  await waitFor(() => document.querySelector(".modal-backdrop"), "budget modal");
  const bsel = document.querySelectorAll(".modal-backdrop .sselect");
  if (bsel.length < 4) throw new Error("expected ≥4 search-selects in budget form, got " + bsel.length);
  console.log("✅ budget form has " + bsel.length + " search-as-you-go selects");
  document.querySelector(".modal-backdrop [data-act='cancel']").click();
  await sleep(300);

  // ---- expenses: open Add Expense and verify strict budget-line list ----
  window.location.hash = "#/expenses";
  window.dispatchEvent(new window.Event("hashchange"));
  await waitFor(() => document.querySelector('[data-act="add"]'), "expense add button");
  document.querySelector('[data-act="add"]').click();
  await waitFor(() => document.querySelector(".modal-backdrop"), "expense modal");
  // pick project P1 → budget line select should refresh
  const projInput = document.querySelector(".modal-backdrop [data-sel='projectId'] .sselect-input");
  projInput.value = "Lilongwe Water Board";
  projInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(400);
  const projItem = document.querySelector(".modal-backdrop [data-sel='projectId'] .sselect-item");
  if (!projItem) throw new Error("project not found in expense form search");
  projItem.dispatchEvent(new window.Event("mousedown", { bubbles: true }));
  await sleep(300);
  const blInput = document.querySelector(".modal-backdrop [data-sel='budgetId'] .sselect-input");
  blInput.value = "Cement";
  blInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(400);
  const blItems = document.querySelectorAll(".modal-backdrop [data-sel='budgetId'] .sselect-item");
  if (!blItems.length) throw new Error("no budget lines listed for P1");
  console.log("✅ expense form lists " + blItems.length + " approved budget lines (strict control)");
  blItems[0].dispatchEvent(new window.Event("mousedown", { bubbles: true }));
  await sleep(250);
  if (!document.querySelector("#budget-info .bi-rem")) throw new Error("budget remaining panel not shown");
  console.log("✅ selecting a budget line shows remaining budget panel");
  document.querySelector(".modal-backdrop [data-act='cancel']").click();
  await sleep(300);

  // ---- reports: preview modal ----
  window.location.hash = "#/reports/pl";
  window.dispatchEvent(new window.Event("hashchange"));
  await waitFor(() => document.querySelector('[data-act="preview"]'), "preview button");
  document.querySelector('[data-act="preview"]').click();
  await waitFor(() => document.querySelector(".print-doc"), "print preview modal");
  console.log("✅ report preview modal renders the print document");
  document.querySelector(".modal-backdrop [data-act='close']").click();
  await sleep(300);

  // ---- full UI round trip: create project, budget line, expense, delete them ----
  const api = window.API;
  const mkItems = sheet => window.API.store.masters[sheet];
  const before = mkItems("Projects").length;
  const res1 = await api.call("saveMaster", { sheet: "Projects", data: { code: "NX-TEST-001", name: "UI Test Project", client: "Test Client", location: "Lilongwe", status: "Active" } });
  if (!res1.ok) throw new Error("saveMaster failed: " + res1.error.message);
  const pid = res1.data.rows.find(p => p.code === "NX-TEST-001").id;
  const res2 = await api.call("saveBudgetLine", { data: { projectId: pid, headId: "H1", materialId: "M1", shopId: "SH1", qty: 10, rate: 1000, status: "Approved" } });
  if (!res2.ok) throw new Error("saveBudgetLine failed: " + res2.error.message);
  const bid = res2.data.rows.find(b => b.projectId === pid).id;
  const res3 = await api.call("saveExpense", { data: { projectId: pid, budgetId: bid, date: "2026-08-20", supplierId: "S1", invoiceNo: "UI-TEST-01", qty: 3, rate: 1000 } });
  if (!res3.ok) throw new Error("saveExpense failed: " + res3.error.message);
  const eid = res3.data.rows.find(e => e.projectId === pid).id;
  // strict check: over-budget against same line must fail
  const res4 = await api.call("saveExpense", { data: { projectId: pid, budgetId: bid, date: "2026-08-20", supplierId: "S1", invoiceNo: "UI-TEST-02", qty: 99, rate: 1000 } });
  if (res4.ok) throw new Error("over-budget expense should have been blocked");
  console.log("✅ full round-trip: project → budget → expense OK; over-budget entry blocked");
  await api.call("deleteExpense", { id: eid });
  await api.call("deleteBudgetLine", { id: bid });
  await api.call("deleteMaster", { sheet: "Projects", id: pid });
  if (mkItems("Projects").length !== before) throw new Error("cleanup failed");

  // ---- real-time sync: version bump detection ----
  const v1 = window.API.store.version;
  await api.call("saveMaster", { sheet: "Units", data: { name: "Sync Test Unit", abbrev: "st" } });
  const newUnit = api.store.masters.Units.find(u => u.name === "Sync Test Unit");
  await api.call("deleteMaster", { sheet: "Units", id: newUnit.id });
  const v2 = window.API.store.version;
  if (!(v2 > v1)) throw new Error("version did not bump after writes");
  console.log("✅ version counter bumps on every write (drives real-time sync)");

  console.log("\n" + (errors.length ? "❌ ERRORS:\n" + errors.join("\n") : "🎉 All DOM tests passed with zero errors"));
  process.exit(errors.length ? 1 : 0);
})().catch(e => {
  console.error("❌ DOM test failure:", e);
  if (errors.length) console.error(errors.join("\n"));
  process.exit(1);
});
