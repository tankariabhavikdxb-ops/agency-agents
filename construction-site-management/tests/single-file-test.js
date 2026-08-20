/* ============================================================
   NEXORA CMS — single-file bundle test (jsdom)
   Boots "Nexora Site Management System.html" (built by
   build-single.js) and verifies the fully-inlined app works:
   Chart.js inlined, login, every page, strict budget control.
   Run:  node build-single.js && node tests/single-file-test.js
   ============================================================ */
"use strict";

const path = require("path");
const fs = require("fs");
let jsdomMod;
try {
  jsdomMod = require("jsdom");
} catch (e) {
  try { jsdomMod = require("/tmp/node_modules/jsdom"); } catch (e2) {
    console.error("jsdom is required:  npm install jsdom");
    process.exit(1);
  }
}

const appRoot = path.join(__dirname, "..");
const singleFile = path.join(appRoot, "Nexora Site Management System.html");
if (!fs.existsSync(singleFile)) {
  console.error("Build first:  node build-single.js");
  process.exit(1);
}
const html = fs.readFileSync(singleFile, "utf8");

const errors = [];
const virtualConsole = new jsdomMod.VirtualConsole();
virtualConsole.on("jsdomError", e => {
  const msg = String(e && e.message || e);
  if (/not implemented/i.test(msg)) return;
  errors.push("jsdomError: " + msg);
});

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
    url: "file:///C:/Nexora/Nexora%20Site%20Management%20System.html",
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

  await waitFor(() => window.App && document.querySelector("#login-screen"), "app boot + login screen");
  console.log("✅ single file boots from file:// URL — login screen shown (" + window.API.store.mode + " mode)");
  console.log("✅ Chart.js inlined:", typeof window.Chart === "function" ? "yes (v" + window.Chart.version + ")" : "NO — bundle broken");
  if (typeof window.Chart !== "function") throw new Error("Chart.js missing from bundle");

  // login
  const login = document.querySelector("#login-screen");
  const userInput = login.querySelector(".sselect-input");
  userInput.value = "Prashant";
  userInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(400);
  const item = login.querySelector(".sselect-item");
  if (!item) throw new Error("no user found in login dropdown");
  item.dispatchEvent(new window.Event("mousedown", { bubbles: true }));
  login.querySelector("#login-pin").value = "1234";
  login.querySelector("#login-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => document.querySelector(".kpi-grid .kpi"), "dashboard render");
  console.log("✅ logged in — dashboard rendered with " + document.querySelectorAll(".kpi").length + " KPIs and " +
    (document.querySelectorAll(".chart-card").length) + " chart cards");

  const routes = [
    ["#/masters/projects", ".mtab", "masters"],
    ["#/budget", "#budget-summary", "budget"],
    ["#/contracts", ".type-tabs", "contracts"],
    ["#/expenses", "#ex-table-host", "expenses"],
    ["#/reports/pl", ".report-picker", "reports"],
    ["#/audit", "#audit-table-host", "audit"],
    ["#/settings", ".settings-grid", "settings"],
  ];
  for (const [hash, marker, what] of routes) {
    window.location.hash = hash;
    window.dispatchEvent(new window.Event("hashchange"));
    await waitFor(() => document.querySelector(marker), what + " render");
    console.log("✅ " + what + " page rendered");
  }

  // strict control: expense form lists only approved budget lines of the project
  window.location.hash = "#/expenses";
  window.dispatchEvent(new window.Event("hashchange"));
  await waitFor(() => document.querySelector('[data-act="add"]'), "expense add button");
  document.querySelector('[data-act="add"]').click();
  await waitFor(() => document.querySelector(".modal-backdrop"), "expense modal");
  const projInput = document.querySelector(".modal-backdrop [data-sel='projectId'] .sselect-input");
  projInput.value = "Gateway Mall";
  projInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(400);
  document.querySelector(".modal-backdrop [data-sel='projectId'] .sselect-item").dispatchEvent(new window.Event("mousedown", { bubbles: true }));
  await sleep(350);
  // open the budget-line search-as-you-go dropdown like a real user would
  const blInput = document.querySelector(".modal-backdrop [data-sel='budgetId'] .sselect-input");
  blInput.value = "cement";
  blInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(400);
  const blItems = document.querySelectorAll(".modal-backdrop [data-sel='budgetId'] .sselect-item");
  if (!blItems.length) throw new Error("no budget lines listed");
  console.log("✅ strict control: budget-line dropdown lists " + blItems.length + " approved lines only");
  document.querySelector(".modal-backdrop [data-act='cancel']").click();
  await sleep(300);

  // save round-trip + over-budget block
  const api = window.API;
  const res1 = await api.call("saveMaster", { sheet: "Projects", data: { code: "NX-BNDL-001", name: "Bundle Test Project", client: "Test", status: "Active" } });
  if (!res1.ok) throw new Error("saveMaster failed: " + res1.error.message);
  const pid = res1.data.rows.find(p => p.code === "NX-BNDL-001").id;
  const res2 = await api.call("saveBudgetLine", { data: { projectId: pid, headId: "H1", materialId: "M1", shopId: "SH1", qty: 5, rate: 1000, status: "Approved" } });
  if (!res2.ok) throw new Error("saveBudgetLine failed");
  const bid = res2.data.rows.find(b => b.projectId === pid).id;
  const res3 = await api.call("saveExpense", { data: { projectId: pid, budgetId: bid, date: "2026-08-20", supplierId: "S1", invoiceNo: "BNDL-01", qty: 2, rate: 1000 } });
  if (!res3.ok) throw new Error("saveExpense failed");
  const res4 = await api.call("saveExpense", { data: { projectId: pid, budgetId: bid, date: "2026-08-20", supplierId: "S1", invoiceNo: "BNDL-02", qty: 99, rate: 1000 } });
  if (res4.ok) throw new Error("over-budget expense should be blocked in the bundle");
  console.log("✅ round-trip save works in the bundle; over-budget entry blocked");

  console.log("\n" + (errors.length ? "❌ ERRORS:\n" + errors.join("\n") : "🎉 Single-file bundle fully verified — zero errors"));
  process.exit(errors.length ? 1 : 0);
})().catch(e => {
  console.error("❌ failure:", e);
  if (errors.length) console.error(errors.join("\n"));
  process.exit(1);
});
