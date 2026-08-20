/* ============================================================
   NEXORA CMS — hosted-mode test (google.script.run bridge)
   Simulates the app being served BY the Google backend: the
   frontend detects window.google.script.run and routes every
   API call through the bridge instead of fetch (zero CORS).
   Run:  node tests/hosted-test.js   (requires: npm i jsdom)
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
  if (/not implemented/i.test(e.message)) return;
  errors.push("jsdomError: " + e.message);
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitFor(fn, what, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 15000)) {
    try { const v = fn(); if (v) return v; } catch (e) { /* retry */ }
    await sleep(120);
  }
  throw new Error("Timed out waiting for: " + what);
}

(async () => {
  const dom = new jsdomMod.JSDOM(html, {
    runScripts: "dangerously",
    url: "https://script.googleusercontent.com/userCodeAppPanel",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.addEventListener("error", e => errors.push("window error: " + (e.message || e.error)));
      window.console.error = (...a) => errors.push("console.error: " + a.join(" "));
      window.print = () => {};
      // Simulate HtmlService: provide google.script.run bridged to the mock backend
      window.google = {
        script: {
          run: {
            _ok: null, _fail: null,
            withSuccessHandler(fn) { this._ok = fn; return this; },
            withFailureHandler(fn) { this._fail = fn; return this; },
            api(json) {
              const self = this;
              setTimeout(() => {
                try {
                  const payload = JSON.parse(json);
                  const w = window;
                  w.Mock.handle(w.API.getMockDB(), payload.action, payload.payload || {}, { user: w.API.store.user })
                    .then(res => self._ok ? self._ok(res) : null)
                    .catch(err => self._fail ? self._fail(err) : null);
                } catch (e2) {
                  if (self._fail) self._fail(e2);
                }
              }, 40);
            },
          },
        },
      };
    },
  });
  const { window } = dom;
  const { document } = window;

  await waitFor(() => window.App && document.querySelector("#login-screen"), "app boot + login screen");
  if (!window.API.store.hosted) throw new Error("hosted mode not detected");
  if (window.API.store.mode !== "live") throw new Error("hosted mode should force live mode");
  console.log("✅ hosted mode detected — google.script.run bridge engaged (mode: " + window.API.store.mode + ")");

  // login through the bridge
  const login = document.querySelector("#login-screen");
  const userInput = login.querySelector(".sselect-input");
  userInput.value = "Shakeel";
  userInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(400);
  const item = login.querySelector(".sselect-item");
  if (!item) throw new Error("no user found in login dropdown (bridge getLoginUsers failed?)");
  item.dispatchEvent(new window.Event("mousedown", { bubbles: true }));
  login.querySelector("#login-pin").value = "1234";
  login.querySelector("#login-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => document.querySelector(".kpi-grid .kpi"), "login + dashboard via bridge");
  console.log("✅ login + dashboard render through the bridge");

  // navigate all pages (all data flows through google.script.run)
  const routes = [
    ["#/masters/projects", ".mtab", "masters"],
    ["#/budget", "#budget-summary", "budget"],
    ["#/contracts", ".type-tabs", "contracts"],
    ["#/expenses", "#ex-table-host", "expenses"],
    ["#/reports/pl", ".report-picker", "reports"],
    ["#/settings", ".settings-grid", "settings"],
  ];
  for (const [hash, marker, what] of routes) {
    window.location.hash = hash;
    window.dispatchEvent(new window.Event("hashchange"));
    await waitFor(() => document.querySelector(marker), what + " render");
    console.log("✅ " + what + " page rendered (bridge)");
  }

  // strict control round-trip through the bridge
  const api = window.API;
  const r1 = await api.call("saveMaster", { sheet: "Projects", data: { code: "NX-HOST-001", name: "Hosted Test Project", client: "T", status: "Active" } });
  if (!r1.ok) throw new Error("saveMaster via bridge failed: " + r1.error.message);
  const pid = r1.data.rows.find(p => p.code === "NX-HOST-001").id;
  const r2 = await api.call("saveBudgetLine", { data: { projectId: pid, headId: "H1", materialId: "M1", shopId: "SH1", qty: 4, rate: 1000, status: "Approved" } });
  const bid = r2.data.rows.find(b => b.projectId === pid).id;
  const r3 = await api.call("saveExpense", { data: { projectId: pid, budgetId: bid, date: "2026-08-20", supplierId: "S1", invoiceNo: "HOST-01", qty: 1, rate: 1000 } });
  if (!r3.ok) throw new Error("saveExpense via bridge failed");
  const r4 = await api.call("saveExpense", { data: { projectId: pid, budgetId: bid, date: "2026-08-20", supplierId: "S1", invoiceNo: "HOST-02", qty: 99, rate: 1000 } });
  if (r4.ok) throw new Error("over-budget expense should be blocked via bridge");
  console.log("✅ strict budget control enforced through the bridge");

  console.log("\n" + (errors.length ? "❌ ERRORS:\n" + errors.join("\n") : "🎉 Hosted mode fully verified — zero errors"));
  process.exit(errors.length ? 1 : 0);
})().catch(e => {
  console.error("❌ failure:", e);
  if (errors.length) console.error(errors.join("\n"));
  process.exit(1);
});
