/* ============================================================
   NEXORA CMS — API layer + global data store
   • Live mode : Google Apps Script web app (Google Sheets)
   • Demo mode : in-browser mock (localStorage) when no API_URL
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt;

  /* ---------------- store ---------------- */
  function safeStorageGet(key) {
    try { return localStorage.getItem(key) || ""; } catch (e) { return ""; }
  }
  function safeStorageSet(key, val) {
    try { if (val) localStorage.setItem(key, val); else localStorage.removeItem(key); } catch (e) { /* storage blocked */ }
  }

  const store = {
    user: null,
    token: null,
    mode: "demo",
    settings: {
      companyName: (root.APP_CONFIG && root.APP_CONFIG.COMPANY.name) || "Nexora Limited",
      companyAddress: (root.APP_CONFIG && root.APP_CONFIG.COMPANY.address) || "",
      companyPhone: (root.APP_CONFIG && root.APP_CONFIG.COMPANY.phone) || "",
      companyEmail: (root.APP_CONFIG && root.APP_CONFIG.COMPANY.email) || "",
      currency: "MK",
      defaultVAT: (root.APP_CONFIG && root.APP_CONFIG.DEFAULT_VAT_RATE) || 16.5,
      allowOverBudget: "NO",
      pollInterval: (root.APP_CONFIG && root.APP_CONFIG.DEFAULT_POLL_INTERVAL) || 45,
    },
    users: [],
    masters: { Projects: [], Shops: [], ExpenseHeads: [], Materials: [], Units: [], Suppliers: [], Customers: [] },
    budget: [],
    contracts: [],
    expenses: [],
    audit: [],
    version: 0,
    lastSync: null,
    connected: false,
    backendVersion: 0,   // version of the deployed backend/Code.gs (0 = unknown/old)
    backendCounts: null, // what the backend actually contains (users, projects, …)
    apiUrl: (root.APP_CONFIG && root.APP_CONFIG.API_URL) || "",
    savedApiUrl: safeStorageGet("nexora_api_url"),
  };

  store.mode = store.savedApiUrl || store.apiUrl ? "live" : "demo";
  if (!store.apiUrl && store.savedApiUrl) store.apiUrl = store.savedApiUrl;

  /* hosted mode: the app is being served BY the Google backend itself,
     so all data calls use google.script.run (no CORS involved at all) */
  store.hosted = hostedAvailable();
  if (store.hosted) store.mode = "live";
  store.useJsonp = false;
  store.jsonpNotified = false;
  store.jsonpFailedAt = 0;

  function hostedAvailable() {
    try {
      return !!(typeof window !== "undefined" && window.google && window.google.script && window.google.script.run);
    } catch (e) { return false; }
  }

  /* ---------------- real backend (Google Apps Script) ---------------- */
  function requestBody(action, payload) {
    return JSON.stringify({
      action,
      payload: payload || {},
      user: store.user ? { name: store.user.name, role: store.user.role, id: store.user.id } : null,
      token: store.token || "",
    });
  }

  /* ---- hosted mode: google.script.run bridge ---- */
  function callHosted(action, payload) {
    return new Promise(resolve => {
      let done = false;
      const finish = res => { if (!done) { done = true; resolve(res); } };
      try {
        window.google.script.run
          .withSuccessHandler(finish)
          .withFailureHandler(err => finish({ ok: false, error: { code: "HOSTED", message: "Backend call failed: " + ((err && (err.message || err.details)) || String(err)) } }))
          .api(requestBody(action, payload));
      } catch (e) {
        finish({ ok: false, error: { code: "HOSTED", message: "Backend bridge error: " + ((e && e.message) || String(e)) } });
      }
      setTimeout(() => { if (!done) { done = true; resolve({ ok: false, error: { code: "HOSTED_TIMEOUT", message: "The backend took too long to reply. Try again." } }); } }, 60000);
    });
  }

  /* ---- JSONP channel: script tags are exempt from CORS, so this works
     even where the browser blocks fetch() to script.google.com ---- */
  function callJsonp(action, payload) {
    if (!store.apiUrl) return Promise.resolve(null);
    // backoff: don't hang every call waiting for a channel that just failed
    if (store.jsonpFailedAt && Date.now() - store.jsonpFailedAt < 60000) return Promise.resolve(null);
    return new Promise(resolve => {
      const cb = "nxcb_" + Math.random().toString(36).slice(2, 10);
      const url = store.apiUrl + (store.apiUrl.indexOf("?") >= 0 ? "&" : "?") +
        "cb=" + encodeURIComponent(cb) + "&p=" + encodeURIComponent(requestBody(action, payload));
      let settled = false;
      const finish = res => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        const s = document.getElementById("nxjsonp-" + cb);
        if (s && s.parentNode) s.parentNode.removeChild(s);
        if (res == null) store.jsonpFailedAt = Date.now();
        resolve(res);
      };
      const timer = setTimeout(() => finish(null), 12000);
      window[cb] = res => finish(res || { ok: false, error: { code: "EMPTY", message: "Empty reply from backend." } });
      const s = document.createElement("script");
      s.id = "nxjsonp-" + cb;
      s.src = url;
      s.async = true;
      s.onerror = () => finish(null);
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function urlHints(url) {
    const u = String(url || "").trim();
    if (/\/dev($|\?)/.test(u)) return "You pasted a “/dev” test URL — it only works for the script owner. Use the “/exec” URL from Deploy ▸ Manage deployments.";
    if (/\/edit($|\?)/.test(u) || /script\.google\.com\/home\//.test(u)) return "You pasted the Apps Script editor URL. You need the Web App URL from Deploy ▸ Manage deployments — it ends with “/exec”.";
    if (u.includes("docs.google.com")) return "You pasted the Google Sheet URL. You need the Apps Script Web App URL (Extensions ▸ Apps Script ▸ Deploy) — it ends with “/exec”.";
    if (u && !/\/exec$/.test(u)) return "The URL does not end with “/exec” — check that you copied the complete Web App URL (Deploy ▸ Manage deployments).";
    return "";
  }

  async function probeUrl(url) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 9000) : null;
    try {
      await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store", signal: ctrl ? ctrl.signal : undefined });
      return true; // opaque response = the server is reachable
    } catch (e) {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function callLive(action, payload) {
    const url = store.apiUrl;
    if (!url) return { ok: false, error: { code: "NO_BACKEND", message: "Google Sheets backend not configured." } };
    // Once the browser has proven it blocks direct requests, keep using the
    // CORS-proof JSONP channel for the rest of the session.
    if (store.useJsonp) {
      const viaJsonp = await callJsonp(action, payload);
      if (viaJsonp) return viaJsonp;
    }
    const body = requestBody(action, payload);
    let res;
    try {
      // text/plain keeps this a "simple" CORS request — works from file:// pages
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
      });
    } catch (e) {
      // Direct request blocked (CORS or network). Try the JSONP channel —
      // script tags are exempt from CORS, so it usually succeeds.
      const viaJsonp = await callJsonp(action, payload);
      if (viaJsonp) {
        store.useJsonp = true;
        if (!store.jsonpNotified) {
          store.jsonpNotified = true;
          if (root.UI && root.UI.toast) root.UI.toast("Connected via fallback channel (your browser blocks direct requests) — everything works normally.", "info", { ms: 6500 });
        }
        return viaJsonp;
      }
      // JSONP failed too — now figure out WHY and say so precisely.
      const hint = urlHints(url);
      if (hint) return { ok: false, error: { code: "BAD_URL", message: hint } };
      const reachable = await probeUrl(url);
      if (reachable) {
        const need = (root.APP_CONFIG && root.APP_CONFIG.REQUIRED_BACKEND_VERSION) || 3;
        return {
          ok: false,
          error: {
            code: "BLOCKED",
            message: "The backend URL responds, but the app could not read a valid reply from it — both the direct channel and the CORS-proof fallback channel failed. Most common cause: the backend script is OUTDATED. The fallback channel only exists in backend/Code.gs v" + need + "+ — replace ALL the code in your Apps Script project with the latest backend/Code.gs, then Deploy ▸ Manage deployments ▸ Edit ▸ Version: “New version” ▸ Deploy (the URL stays the same). If the backend IS already updated, your browser/network is blocking script.google.com — disable ad-blockers/privacy extensions, try another browser, or use Hosted mode (README, Option C).",
          },
        };
      }
      return {
        ok: false,
        error: {
          code: "NETWORK",
          message: "The Google Sheets backend could not be reached at all. Check that the URL ends with “/exec” (not /edit or /dev), that the deployment exists (Deploy ▸ Manage deployments), and your internet connection. Open the URL in your browser — you should see the “backend is ONLINE” page.",
        },
      };
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {
      const looksLikeLogin = /accounts\.google\.com|ServiceLogin|Sign in/i.test(text.slice(0, 4000));
      if (looksLikeLogin) {
        return {
          ok: false,
          error: {
            code: "DEPLOY_ANYONE",
            message: "The Web App asked for a Google login. Re-deploy it with access “Anyone” (see README, step 6), then copy the new /exec URL.",
          },
        };
      }
      const hint = urlHints(url);
      if (hint) return { ok: false, error: { code: "BAD_URL", message: hint } };
      return {
        ok: false,
        error: {
          code: "BAD_RESPONSE",
          message: "The backend returned an invalid response. Check the Web App URL and deployment type (must be “Web app”, not “API executable” or “Editor add-on”).",
        },
      };
    }
    return json || { ok: false, error: { code: "EMPTY", message: "Empty response from backend." } };
  }

  /* ---------------- mock backend ---------------- */
  let mockDB = null;
  function getMockDB() {
    if (!mockDB) mockDB = new root.Mock.MockDB();
    return mockDB;
  }
  async function callMock(action, payload) {
    return root.Mock.handle(getMockDB(), action, payload || {}, { user: store.user });
  }

  /* ---------------- unified API ---------------- */
  async function call(action, payload) {
    let res;
    if (store.hosted) res = await callHosted(action, payload);
    else if (store.mode === "live") res = await callLive(action, payload);
    else res = await callMock(action, payload);
    if (res && res.ok && res.data) {
      if (res.data.version != null) store.version = res.data.version;
      if (res.data.timestamp) store.lastSync = res.data.timestamp;
      if (res.data.backendVersion) store.backendVersion = Number(res.data.backendVersion);
      if (res.data.counts) store.backendCounts = res.data.counts;
      store.connected = true;
    }
    if (res && !res.ok) {
      if (res.error && res.error.code === "SESSION") {
        store.user = null;
        store.token = null;
      }
      if (root.UI && root.UI.toast) root.UI.toast(res.error.message || "Request failed", "error", { ms: 6000 });
    }
    return res;
  }

  /* ---------------- convenience loaders ---------------- */
  async function refreshAll(showToast) {
    const res = await call("getAll");
    if (res && res.ok && res.data) {
      const d = res.data;
      store.settings = Object.assign({}, store.settings, d.settings || {});
      store.users = d.users || [];
      store.masters = d.masters || store.masters;
      store.budget = d.budget || [];
      store.contracts = d.contracts || [];
      store.expenses = d.expenses || [];
      store.audit = d.audit || [];
      store.version = d.version != null ? d.version : store.version;
      store.lastSync = d.timestamp || store.lastSync;
      store.connected = true;
      if (showToast && root.UI) root.UI.toast("Data synced with Google Sheets", "success");
      return true;
    }
    return false;
  }

  async function refreshEntity(kind, showToast) {
    let res = null;
    if (kind === "budget") res = await call("getBudget");
    else if (kind === "contracts") res = await call("getContracts");
    else if (kind === "expenses") res = await call("getExpenses");
    else if (kind === "settings") res = await call("getSettings");
    else res = await call("getMasters", { sheet: kind });
    if (res && res.ok && res.data) {
      const d = res.data;
      if (kind === "budget") store.budget = d.rows || [];
      else if (kind === "contracts") store.contracts = d.rows || [];
      else if (kind === "expenses") store.expenses = d.rows || [];
      else if (kind === "settings") store.settings = Object.assign({}, store.settings, d.settings || {});
      else store.masters[kind] = d.rows || [];
      if (d.version != null) store.version = d.version;
      if (d.timestamp) store.lastSync = d.timestamp;
      if (showToast && root.UI) root.UI.toast("Data refreshed", "success");
      return true;
    }
    return false;
  }

  async function pollVersion() {
    const res = await call("getVersion", {});
    return res && res.ok ? res.data.version : null;
  }

  function setApiUrl(url) {
    const u = String(url || "").trim().replace(/\/+$/, "");
    store.apiUrl = u;
    safeStorageSet("nexora_api_url", u);
    store.mode = u ? "live" : "demo";
    if (u) store.savedApiUrl = u;
  }

  async function testConnection(url) {
    const prev = store.apiUrl, prevMode = store.mode;
    setApiUrl(url);
    const t0 = Date.now();
    const res = await call("ping", {});
    const ms = Date.now() - t0;
    if (!res.ok) {
      setApiUrl(prev);
      store.mode = prevMode;
      return { ok: false, ms, error: res.error };
    }
    return { ok: true, ms, data: res.data };
  }

  root.API = { store, call, refreshAll, refreshEntity, pollVersion, setApiUrl, testConnection, getMockDB, callJsonp };
})(typeof window !== "undefined" ? window : globalThis);
