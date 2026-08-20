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
    apiUrl: (root.APP_CONFIG && root.APP_CONFIG.API_URL) || "",
    savedApiUrl: safeStorageGet("nexora_api_url"),
  };

  store.mode = store.savedApiUrl || store.apiUrl ? "live" : "demo";
  if (!store.apiUrl && store.savedApiUrl) store.apiUrl = store.savedApiUrl;

  /* ---------------- real backend (Google Apps Script) ---------------- */
  async function callLive(action, payload) {
    const url = store.apiUrl;
    if (!url) return { ok: false, error: { code: "NO_BACKEND", message: "Google Sheets backend not configured." } };
    const body = JSON.stringify({ action, payload: payload || {}, user: store.user ? { name: store.user.name, role: store.user.role, id: store.user.id } : null, token: store.token || "" });
    let res;
    try {
      // text/plain keeps this a "simple" CORS request — works from file:// pages
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
      });
    } catch (e) {
      return { ok: false, error: { code: "NETWORK", message: "Could not reach the Google Sheets backend. Check your internet connection and the Web App URL in Settings." } };
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {
      const looksLikeLogin = /accounts\.google\.com|ServiceLogin|Sign in/i.test(text.slice(0, 4000));
      return {
        ok: false,
        error: {
          code: looksLikeLogin ? "DEPLOY_ANYONE" : "BAD_RESPONSE",
          message: looksLikeLogin
            ? "The Web App asked for a Google login. Re-deploy it with access “Anyone” (see README, step 6)."
            : "The backend returned an invalid response. Check the Web App URL and deployment type (must be “Web app”).",
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
    const res = store.mode === "live" ? await callLive(action, payload) : await callMock(action, payload);
    if (res && res.ok && res.data) {
      if (res.data.version != null) store.version = res.data.version;
      if (res.data.timestamp) store.lastSync = res.data.timestamp;
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

  root.API = { store, call, refreshAll, refreshEntity, pollVersion, setApiUrl, testConnection, getMockDB };
})(typeof window !== "undefined" ? window : globalThis);
