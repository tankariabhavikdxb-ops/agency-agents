/* ═══════════════════════════════════════════════════════════════════════════
   api.js — typed client for the Tally Bridge REST API
   Every method resolves with `data` (payload) and throws ApiError on failure.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

class ApiError extends Error {
  constructor(message, { status = 0, errors = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

const API = {

  async request(path, { method = 'GET', body = null, params = null } = {}) {
    let url = path.startsWith('http') ? path : path;
    if (params) {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      });
      const s = qs.toString();
      if (s) url += (url.includes('?') ? '&' : '?') + s;
    }

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body !== null ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== null ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ApiError('Bridge unreachable — is server.py running?', { status: 0 });
    }

    let json = null;
    try { json = await res.json(); }
    catch { /* non-JSON error page */ }

    if (!res.ok || (json && json.success === false)) {
      throw new ApiError(
        (json && json.message) || `Request failed (HTTP ${res.status})`,
        { status: res.status, errors: (json && json.errors) || [] });
    }
    return json;
  },

  enc(segment) { return encodeURIComponent(segment); },

  /* ── system ─────────────────────────────────────────────────────────── */
  health()            { return this.request('/api/health'); },
  syncStatus()        { return this.request('/api/sync/status'); },
  connectionTest(host, port) {
    return this.request('/api/connection/test', { method: 'POST', body: { host, port } });
  },
  connectionConfigure(host, port) {
    return this.request('/api/connection/configure', { method: 'POST', body: { host, port } });
  },

  /* ── companies ──────────────────────────────────────────────────────── */
  companies()                          { return this.request('/api/companies'); },
  selectCompany(c)                     { return this.request(`/api/companies/${this.enc(c)}/select`, { method: 'POST' }); },
  companyConfig(c)                     { return this.request(`/api/companies/${this.enc(c)}/config`); },
  alterCompanyConfig(c, features)      { return this.request(`/api/companies/${this.enc(c)}/config`, { method: 'PUT', body: features }); },

  /* ── masters ────────────────────────────────────────────────────────── */
  ledgers(c)                           { return this.request(`/api/${this.enc(c)}/ledgers`); },
  createLedger(c, data)                { return this.request(`/api/${this.enc(c)}/ledgers`, { method: 'POST', body: data }); },
  alterLedger(c, name, data)           { return this.request(`/api/${this.enc(c)}/ledgers/${this.enc(name)}`, { method: 'PUT', body: data }); },
  deleteLedger(c, name)                { return this.request(`/api/${this.enc(c)}/ledgers/${this.enc(name)}`, { method: 'DELETE' }); },

  groups(c)                            { return this.request(`/api/${this.enc(c)}/groups`); },
  stockGroups(c)                       { return this.request(`/api/${this.enc(c)}/stock-groups`); },
  stockItems(c)                        { return this.request(`/api/${this.enc(c)}/stock-items`); },
  createStockItem(c, data)             { return this.request(`/api/${this.enc(c)}/stock-items`, { method: 'POST', body: data }); },
  alterStockItem(c, name, data)        { return this.request(`/api/${this.enc(c)}/stock-items/${this.enc(name)}`, { method: 'PUT', body: data }); },
  deleteStockItem(c, name)             { return this.request(`/api/${this.enc(c)}/stock-items/${this.enc(name)}`, { method: 'DELETE' }); },
  units(c)                             { return this.request(`/api/${this.enc(c)}/units`); },
  currencies(c)                        { return this.request(`/api/${this.enc(c)}/currencies`); },
  costCentres(c)                       { return this.request(`/api/${this.enc(c)}/cost-centres`); },
  costCategories(c)                    { return this.request(`/api/${this.enc(c)}/cost-categories`); },
  godowns(c)                           { return this.request(`/api/${this.enc(c)}/godowns`); },
  voucherTypes(c)                      { return this.request(`/api/${this.enc(c)}/voucher-types`); },

  /* ── vouchers ───────────────────────────────────────────────────────── */
  vouchers(c, params = {})             { return this.request(`/api/${this.enc(c)}/vouchers`, { params }); },
  voucherById(c, remoteId)             { return this.request(`/api/${this.enc(c)}/vouchers`, { params: { remote_id: remoteId } }); },
  createVoucher(c, data)               { return this.request(`/api/${this.enc(c)}/vouchers`, { method: 'POST', body: data }); },
  alterVoucher(c, remoteId, data)      { return this.request(`/api/${this.enc(c)}/vouchers/${this.enc(remoteId)}`, { method: 'PUT', body: data }); },
  deleteVoucher(c, data)               { return this.request(`/api/${this.enc(c)}/vouchers/delete`, { method: 'POST', body: data }); },
  dayBook(c, date)                     { return this.request(`/api/${this.enc(c)}/day-book`, { params: { date } }); },
  ledgerVouchers(c, ledger, params = {}) {
    return this.request(`/api/${this.enc(c)}/ledger-vouchers/${this.enc(ledger)}`, { params });
  },

  /* ── reports ────────────────────────────────────────────────────────── */
  dashboard(c)                         { return this.request(`/api/${this.enc(c)}/dashboard`); },
  trialBalance(c, params = {})         { return this.request(`/api/${this.enc(c)}/reports/trial-balance`, { params }); },
  balanceSheet(c, params = {})         { return this.request(`/api/${this.enc(c)}/reports/balance-sheet`, { params }); },
  profitLoss(c, params = {})           { return this.request(`/api/${this.enc(c)}/reports/profit-loss`, { params }); },
};

window.API = API;
window.ApiError = ApiError;
