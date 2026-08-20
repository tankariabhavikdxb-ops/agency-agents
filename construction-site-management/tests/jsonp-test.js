/* ============================================================
   NEXORA CMS — JSONP fallback test (jsdom)
   Simulates a browser that BLOCKS fetch() to script.google.com
   (CORS failure) but allows <script> tags. Verifies the app
   automatically falls back to the CORS-proof JSONP channel.
   Run:  node tests/jsonp-test.js   (requires: npm i jsdom)
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

(async () => {
  const dom = new jsdomMod.JSDOM(html, {
    runScripts: "dangerously",
    url: "file:///C:/Nexora/app.html",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.addEventListener("error", e => errors.push("window error: " + (e.message || e.error)));
      window.console.error = (...a) => errors.push("console.error: " + a.join(" "));
      window.print = () => {};
    },
  });
  const { window } = dom;
  const api = window.API;

  let guard = 0;
  while (!api || !window.Mock) { await sleep(100); if (++guard > 100) throw new Error("boot timeout"); }
  await sleep(800);

  // configure a (fake) live backend URL
  api.setApiUrl("https://script.google.com/macros/s/AKfycbTEST/exec");
  if (api.store.mode !== "live") throw new Error("should be live mode after setApiUrl");

  // simulate the browser blocking direct fetch() to script.google.com:
  // any non-probe fetch to the backend throws a TypeError (CORS block).
  const origFetch = window.fetch;
  window.fetch = (url, opts) => {
    if (String(url).includes("script.google.com") && (!opts || opts.mode !== "no-cors")) {
      return Promise.reject(new window.TypeError("Failed to fetch (simulated CORS block)"));
    }
    return origFetch.call(window, url, opts);
  };

  // simulate the backend answering JSONP: capture the injected <script>,
  // read cb + p from its src, and invoke window[cb](…) like the server would.
  let jsonpCalls = 0;
  const origAppend = window.HTMLHeadElement.prototype.appendChild;
  window.HTMLHeadElement.prototype.appendChild = function (el) {
    if (el && el.tagName === "SCRIPT" && el.src && el.src.includes("script.google.com")) {
      jsonpCalls++;
      const u = new el.ownerDocument.defaultView.URL(el.src);
      const cb = u.searchParams.get("cb");
      const p = u.searchParams.get("p");
      let payload;
      try { payload = JSON.parse(p); } catch (e) { payload = {}; }
      window.Mock.handle(api.getMockDB(), payload.action, payload.payload || {}, { user: api.store.user })
        .then(res => window[cb](res))
        .catch(err => window[cb]({ ok: false, error: { code: "SERVER", message: String(err && err.message || err) } }));
      return el; // do not actually insert
    }
    return origAppend.call(this, el);
  };

  // ---- run: a direct call should automatically fall back to JSONP ----
  const res = await api.call("getVersion", {});
  if (!res || !res.ok) throw new Error("call failed: " + (res && res.error && res.error.message));
  console.log("✅ direct fetch blocked → JSONP fallback engaged (getVersion OK)");
  if (!api.store.useJsonp) throw new Error("useJsonp flag not set");
  console.log("✅ session switched to the fallback channel for subsequent calls");

  // subsequent calls go straight through JSONP
  const res2 = await api.call("getLoginUsers", {});
  if (!res2.ok || !res2.data.rows || !res2.data.rows.length) throw new Error("getLoginUsers via JSONP failed");
  console.log("✅ user list loads via JSONP (" + res2.data.rows.length + " users) — fixes the empty login dropdown");

  const res3 = await api.call("login", { name: "Bhavik Tankaria", pin: "1234" });
  if (!res3.ok) throw new Error("login via JSONP failed: " + res3.error.message);
  console.log("✅ login works via JSONP");

  const res4 = await api.call("getAll", {});
  if (!res4.ok || !res4.data.masters || !res4.data.masters.Projects.length) throw new Error("getAll via JSONP failed");
  console.log("✅ full data load (getAll) works via JSONP — " + res4.data.masters.Projects.length + " projects");

  // strict control still enforced through the fallback channel
  const res5 = await api.call("saveExpense", { data: { projectId: "P1", date: "2026-08-20", supplierId: "S1", qty: 1, rate: 100 } });
  if (res5.ok) throw new Error("strict control bypassed?!");
  console.log("✅ strict budget control still enforced via JSONP");

  if (jsonpCalls < 4) throw new Error("expected at least 4 JSONP calls, saw " + jsonpCalls);
  console.log("✅ " + jsonpCalls + " requests went through the CORS-proof channel");

  console.log("\n" + (errors.length ? "❌ ERRORS:\n" + errors.join("\n") : "🎉 JSONP fallback fully verified — zero errors"));
  process.exit(errors.length ? 1 : 0);
})().catch(e => {
  console.error("❌ failure:", e);
  if (errors.length) console.error(errors.join("\n"));
  process.exit(1);
});
