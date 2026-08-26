/* ═══════════════════════════════════════════════════════════════════════════
   app.js — application core
   state · router · toast · modal · websocket · splash/boot · company setup
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const App = {

  /* ══════════ 24. APPLICATION STATE ══════════ */
  state: {
    booted: false,
    health: null,
    companies: [],
    company: null,              // active company name
    route: { page: 'dashboard', sub: null, param: null, query: {} },
    theme: 'light',
    socket: null,
    socketUp: false,
    syncOnline: null,
    /* TTL caches for masters (invalidated on data_changed) */
    _caches: {},
    /* remote_id -> voucher object (for edit deep links) */
    lastVouchers: {},
    /* remember voucher register filters while navigating */
    voucherFilters: null,
  },

  routes: {},

  registerRoute(page, handler) { this.routes[page] = handler; },

  CACHE_TTL: 30_000,


  /* ══════════ 25/26. utilities on top of U + API ══════════ */

  cacheGet(key) {
    const c = this.state._caches[key];
    if (c && Date.now() - c.ts < this.CACHE_TTL) return c.data;
    return null;
  },

  cacheSet(key, data) { this.state._caches[key] = { ts: Date.now(), data }; },

  invalidateCaches() { this.state._caches = {}; this.state.lastVouchers = {}; },

  async cachedFetch(key, fetcher) {
    const hit = this.cacheGet(key);
    if (hit) return hit;
    const data = await fetcher();
    this.cacheSet(key, data);
    return data;
  },

  async getLedgers(force = false) {
    if (force) delete this.state._caches.ledgers;
    return this.cachedFetch('ledgers', async () => (await API.ledgers(this.state.company)).data);
  },

  async getGroups(force = false) {
    if (force) delete this.state._caches.groups;
    return this.cachedFetch('groups', async () => (await API.groups(this.state.company)).data);
  },

  async getStockItems(force = false) {
    if (force) delete this.state._caches['stock-items'];
    return this.cachedFetch('stock-items', async () => (await API.stockItems(this.state.company)).data);
  },

  async getVoucherTypes() {
    return this.cachedFetch('voucher-types',
      async () => (await API.voucherTypes(this.state.company)).data);
  },

  async getUnits()  { return this.cachedFetch('units', async () => (await API.units(this.state.company)).data); },
  async getGodowns(){ return this.cachedFetch('godowns', async () => (await API.godowns(this.state.company)).data); }


  /* router, toasts, modals… continued below */

};

/* ═══════════════════════════════════════════════════════════════════════════
   21. TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════════════════ */
App.toast = function ({ type = 'info', title = '', message = '', timeout = 4200 } = {}) {
  const icons = { success: 'i-check', error: 'i-alert', warn: 'i-alert', info: 'i-info' };
  const root = document.getElementById('toasts');
  while (root.children.length >= 5) root.firstElementChild.remove();

  const el = U.el(`
    <div class="toast ${U.esc(type)}" role="status">
      <div class="toast-ic"><svg class="ic ic-sm"><use href="#${icons[type] || 'i-info'}"/></svg></div>
      <div class="toast-body">
        ${title ? `<div class="toast-title">${U.esc(title)}</div>` : ''}
        ${message ? `<div class="toast-msg">${U.esc(message)}</div>` : ''}
      </div>
      <button class="toast-x iconbtn sm" title="Dismiss">
        <svg class="ic ic-sm"><use href="#i-x"/></svg>
      </button>
    </div>`);

  const kill = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 240);
  };
  el.querySelector('.toast-x').onclick = kill;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  if (timeout > 0) setTimeout(kill, timeout);
  return el;
};

App.toastError = function (err, title = 'Something went wrong') {
  const msg = err && err.message ? err.message : String(err);
  const extra = (err && err.errors && err.errors.length)
    ? ` (${err.errors.join('; ')})` : '';
  return this.toast({ type: 'error', title, message: msg + extra, timeout: 7000 });
};


/* ═══════════════════════════════════════════════════════════════════════════
   27. MODAL FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════ */
App.modal = {
  current: null,

  open({ title = '', body = '', footer = '', size = '', onClose = null } = {}) {
    this.close();
    const tpl = document.getElementById('tpl-modal');
    const root = tpl.content.firstElementChild.cloneNode(true);
    const modal = root.querySelector('.modal');
    if (size) modal.classList.add('modal-' + size);
    modal.querySelector('.modal-title').innerHTML = title;
    const bodyEl = modal.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else bodyEl.appendChild(body);
    const footEl = modal.querySelector('.modal-foot');
    if (typeof footer === 'string') footEl.innerHTML = footer;
    else if (footer) footEl.appendChild(footer);

    const api = {
      el: root, modal, body: bodyEl, foot: footEl,
      close: () => this._close(),
    };
    this.current = api;
    this._onClose = onClose;

    modal.querySelector('.modal-x').onclick = () => this.close();
    root.addEventListener('mousedown', (e) => {
      if (e.target === root) this.close();
    });
    document.getElementById('modal-root').appendChild(root);
    return api;
  },

  _close() {
    if (!this.current) return;
    const { el } = this.current;
    el.remove();
    if (this._onClose) { const f = this._onClose; this._onClose = null; f(); }
    this.current = null;
  },

  close() { this._close(); },

  /* confirm() -> Promise<boolean>; resolves when user decides */
  confirm({ title = 'Are you sure?', message = '', confirmText = 'Confirm',
            cancelText = 'Cancel', danger = false } = {}) {
    return new Promise((resolve) => {
      let decided = false;
      const done = (val) => {
        if (decided) return;
        decided = true;
        this._onClose = null;
        this.close();
        resolve(val);
      };
      const footer = U.el(`
        <div>
          <button class="btn btn-ghost" data-act="no">${U.esc(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="yes">
            ${U.esc(confirmText)}
          </button>
        </div>`);
      const m = this.open({
        title: `<span class="${danger ? 'neg' : ''}" style="display:inline-flex;align-items:center;gap:8px">
                  <svg class="ic ic-sm"><use href="#${danger ? 'i-alert' : 'i-info'}"/></svg>
                  ${U.esc(title)}</span>`,
        body: `<p class="muted">${message}</p>`,
        footer,
        size: 'sm',
        onClose: () => { if (!decided) { decided = true; resolve(false); } },
      });
      m.foot.querySelector('[data-act="no"]').onclick = () => done(false);
      m.foot.querySelector('[data-act="yes"]').onclick = () => done(true);
    });
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   16. EMPTY STATE helper
   ═══════════════════════════════════════════════════════════════════════════ */
App.emptyState = function ({ icon = 'i-receipt', title = 'Nothing here yet',
                             text = '', actionLabel = '', onAction = null } = {}) {
  const tpl = document.getElementById('tpl-empty');
  const el = tpl.content.firstElementChild.cloneNode(true);
  el.querySelector('use').setAttribute('href', '#' + icon);
  el.querySelector('.empty-title').textContent = title;
  el.querySelector('.empty-text').textContent = text;
  const act = el.querySelector('.empty-action');
  if (actionLabel) {
    const btn = U.el(`<button class="btn btn-primary">${U.esc(actionLabel)}</button>`);
    btn.onclick = onAction;
    act.appendChild(btn);
  }
  return el;
};

App.pageError = function (err, retry) {
  const wrap = document.createElement('div');
  wrap.appendChild(this.emptyState({
    icon: 'i-alert',
    title: 'Could not load this page',
    text: (err && err.message) || String(err),
    actionLabel: 'Retry',
    onAction: retry,
  }));
  return wrap;
};

App.setContentLoading = function (title, sub) {
  this.setPage(title, sub);
  const c = document.getElementById('content');
  c.innerHTML = `
    <div class="card"><div class="card-body" style="display:flex;align-items:center;gap:14px;padding:34px">
      <div class="spinner spinner-lg"></div>
      <div><b>Loading…</b>
      <div class="muted small">Talking to Tally through the bridge${this.state.company ? ` — ${U.esc(this.state.company)}` : ''}</div></div>
    </div></div>`;
};

App.setPage = function (title, sub = '') {
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').innerHTML = U.esc(sub);
};


/* ═══════════════════════════════════════════════════════════════════════════
   ROUTER
   ═══════════════════════════════════════════════════════════════════════════ */
App.parseHash = function () {
  const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = {};
  if (queryPart) new URLSearchParams(queryPart).forEach((v, k) => { query[k] = v; });
  return {
    page: segments[0] || 'dashboard',
    sub: segments[1] || null,
    param: segments[2] !== undefined ? segments.slice(2).join('/') : null,
    query,
  };
};

App.go = function (hash) {
  if (location.hash === hash) this.renderRoute();
  else location.hash = hash;
};

App.renderRoute = async function () {
  const route = this.parseHash();
  this.state.route = route;
  this.highlightNav(route);

  /* don't clobber an in-progress voucher form on background refreshes */
  const handler = this.routes[route.page] || this.routes.dashboard;
  const content = document.getElementById('content');
  try {
    await handler(route, content);
  } catch (err) {
    console.error('[route]', route.page, err);
    content.innerHTML = '';
    content.appendChild(this.pageError(err, () => this.renderRoute()));
  }
};

App.highlightNav = function (route) {
  U.qsa('#nav .nav-item').forEach((a) => {
    const p = a.dataset.route;
    const s = a.dataset.route2;
    const match = s ? (route.page === p && route.sub === s) : route.page === p;
    a.classList.toggle('active', !!match);
  });
};

/* background refresh after data_changed — never wipes a form being edited */
App.softRefresh = U.debounce(function () {
  if (!App.state.booted || !App.state.company) return;
  const page = App.state.route.page;
  if (page === 'voucher' && App.state.route.sub === 'edit') return;
  if (page === 'voucher' && App.state.route.sub === 'new') return;
  App.renderRoute();
}, 600);


/* ═══════════════════════════════════════════════════════════════════════════
   28. WEBSOCKET CONNECTION
   ═══════════════════════════════════════════════════════════════════════════ */
App.connectWS = function () {
  if (!window.io) {
    this.setSyncPill('warn', 'No WS');
    return;
  }
  try {
    const socket = io({ transports: ['polling', 'websocket'] });
    this.state.socket = socket;

    socket.on('connect', () => {
      this.state.socketUp = true;
      if (this.state.company) {
        socket.emit('subscribe_company', { company: this.state.company });
      }
    });

    socket.on('disconnect', () => {
      this.state.socketUp = false;
      this.setSyncPill('warn', 'Reconnecting…');
    });

    socket.on('data_changed', (ev) => this.onDataChanged(ev));
  } catch (e) {
    console.warn('socket.io unavailable', e);
  }
};

App.onDataChanged = function (ev) {
  /* ev: {company, type, timestamp} */
  const type = ev && ev.type;

  if (type === 'tally_offline') {
    this.state.syncOnline = false;
    this.setSyncPill('err', 'Tally offline');
    this.toast({ type: 'warn', title: 'Tally went offline',
                 message: 'Changes will sync when Tally is back.' });
    return;
  }
  if (type === 'sync_started') {
    this.state.syncOnline = true;
    this.setSyncPill('ok', 'Live');
    return;
  }

  this.state.syncOnline = true;
  this.setSyncPill('ok', 'Live');
  this.invalidateCaches();

  /* our own writes already toast; only announce Tally-side changes loudly */
  if (type === 'data_changed' || type === 'full_refresh') {
    this.toast({
      type: 'info',
      title: 'Tally data changed',
      message: `${ev.company || ''}: refreshed from Tally.`,
      timeout: 3000,
    });
  }
  this.softRefresh();
};

App.setSyncPill = function (state, text) {
  const pill = document.getElementById('sync-pill');
  if (!pill) return;
  pill.className = 'sync-pill ' + (state || '');
  document.getElementById('sync-text').textContent = text || 'Sync';
};

App.pollSyncStatus = function () {
  /* belt & braces: poll /api/sync/status so the pill is right even without WS */
  API.syncStatus()
    .then((r) => {
      const s = r.data || {};
      if (s.tally_online === false) {
        this.setSyncPill('err', 'Tally offline');
      } else if (this.state.socketUp) {
        this.setSyncPill('ok', 'Live');
      } else {
        this.setSyncPill('warn', 'Polling');
      }
    })
    .catch(() => {});
};


/* ═══════════════════════════════════════════════════════════════════════════
   29/31. INITIALIZATION, SPLASH SCREEN & COMPANY SETUP
   ═══════════════════════════════════════════════════════════════════════════ */
App.splashStep = function (step, state, footText) {
  const el = document.querySelector(`#splash-steps .splash-step[data-step="${step}"]`);
  if (el) el.className = 'splash-step ' + state;
  const fill = document.getElementById('splash-fill');
  const order = ['bridge', 'tally', 'companies', 'workspace'];
  const idx = order.indexOf(step);
  if (fill) {
    const progress = { active: (idx + 0.5) / order.length,
                       done: (idx + 1) / order.length, error: (idx + 1) / order.length };
    fill.style.width = Math.round((progress[state] || 0) * 100) + '%';
  }
  if (footText) document.getElementById('splash-foot').textContent = footText;
};

App.hideSplash = function () {
  const s = document.getElementById('splash');
  if (s) { s.classList.add('out'); setTimeout(() => s.remove(), 450); }
};

App.boot = async function () {
  this.applyTheme(localStorage.getItem('tb.theme') || 'light');
  this.bindChromeEvents();

  /* step 1: bridge */
  this.splashStep('bridge', 'active', 'Connecting to bridge…');
  try {
    this.state.health = await API.health();
    this.splashStep('bridge', 'done');
  } catch (err) {
    this.splashStep('bridge', 'error', 'Bridge unreachable');
    this.showSetup(err);
    this.hideSplash();
    return;
  }

  /* step 2: tally */
  this.splashStep('tally', 'active', 'Contacting Tally Prime…');
  const tallyOk = this.state.health.tally_xml_api === 'connected';
  this.splashStep('tally', tallyOk ? 'done' : 'error');

  /* step 3: companies */
  this.splashStep('companies', 'active', 'Loading companies…');
  try {
    const res = await API.companies();
    this.state.companies = res.data || [];
    this.splashStep('companies', 'done');
  } catch (err) {
    this.splashStep('companies', 'error');
    this.showSetup(err);
    this.hideSplash();
    return;
  }

  /* step 4: workspace */
  const saved = localStorage.getItem('tb.company');
  const exists = this.state.companies.some((c) => c.name === saved);
  if (saved && exists) {
    this.splashStep('workspace', 'active', 'Opening ' + saved + '…');
    try {
      await this.setCompany(saved, { silent: true });
      this.splashStep('workspace', 'done', 'Ready');
    } catch (err) {
      this.splashStep('workspace', 'error');
      this.showSetup(err);
      this.hideSplash();
      return;
    }
    this.hideSplash();
    this.enterApp();
  } else {
    localStorage.removeItem('tb.company');
    this.hideSplash();
    this.showSetup();
  }

  this.connectWS();
  setInterval(() => this.pollSyncStatus(), 20000);
};

App.enterApp = function () {
  document.getElementById('setup').hidden = true;
  document.getElementById('app').hidden = false;
  this.state.booted = true;
  this.renderChrome();
  if (!location.hash || location.hash === '#/') location.hash = '#/dashboard';
  this.renderRoute();
};

/* ── 30. company setup screen ───────────────────────────────────────────── */
App.showSetup = function (bootError = null) {
  document.getElementById('app').hidden = true;
  const setup = document.getElementById('setup');
  setup.hidden = false;
  this.renderSetup(bootError);
};

App.renderSetup = async function (bootError = null) {
  const setup = document.getElementById('setup');
  const h = this.state.health || {};
  const tallyOk = h.tally_xml_api === 'connected';
  const odbc = h.tally_odbc || 'unknown';
  let host = 'localhost', port = 9000;
  const m = /http:\/\/([^:/]+):(\d+)/.exec(h.tally_url || '');
  if (m) { host = m[1]; port = m[2]; }

  const connPill = (ok, label) =>
    `<span class="pill ${ok ? 'ok' : 'err'}"><span class="dot"></span>${label}</span>`;

  setup.innerHTML = `
    <div class="setup-panel">
      <div class="setup-brand">
        <div class="splash-logo">T</div>
        <h1>Tally Bridge</h1>
        <p>Connect to Tally Prime 2.1 and choose a company to start working.</p>
      </div>

      <div class="setup-grid">
        <div class="card">
          <div class="card-head">
            <span class="card-title"><svg class="ic"><use href="#i-zap"/></svg>Connection</span>
          </div>
          <div class="card-body">
            <div class="conn-row">
              <svg class="ic"><use href="#i-activity"/></svg>
              <div class="grow"><b>Bridge middleware</b>
                <div class="detail">serving this page · v${U.esc(h.version || '—')}</div></div>
              ${connPill(true, 'Running')}
            </div>
            <div class="conn-row">
              <svg class="ic"><use href="#i-db"/></svg>
              <div class="grow"><b>Tally XML API</b>
                <div class="detail" id="setup-tally-url">${U.esc(h.tally_url || '—')}</div></div>
              ${connPill(tallyOk, tallyOk ? 'Connected' : 'Offline')}
            </div>
            <div class="conn-row">
              <svg class="ic"><use href="#i-layers"/></svg>
              <div class="grow"><b>Tally ODBC</b>
                <div class="detail">${odbc === 'not_installed'
                  ? 'pyodbc not installed — optional fast path (XML API covers everything)'
                  : U.esc(h.odbc_detail || odbc)}</div></div>
              ${connPill(odbc === 'connected', odbc === 'connected' ? 'Connected' : 'Optional')}
            </div>

            ${bootError ? `<div class="form-error mt-2">
              <svg class="ic ic-sm"><use href="#i-alert"/></svg>
              <span>${U.esc(bootError.message || String(bootError))}</span></div>` : ''}

            <div class="field-row mt-2" style="align-items:end">
              <div class="field">
                <label class="label">Tally host</label>
                <input class="input" id="su-host" value="${U.esc(host)}" placeholder="localhost or LAN IP">
              </div>
              <div class="field">
                <label class="label">XML API port</label>
                <input class="input num" id="su-port" value="${U.esc(port)}" inputmode="numeric">
              </div>
              <div class="field" style="flex:0 0 auto">
                <button class="btn" id="su-test" style="width:100%">
                  <svg class="ic ic-sm"><use href="#i-zap"/></svg> Test
                </button>
              </div>
              <div class="field" style="flex:0 0 auto">
                <button class="btn btn-primary" id="su-apply" style="width:100%">
                  <svg class="ic ic-sm"><use href="#i-check"/></svg> Save &amp; connect
                </button>
              </div>
            </div>
            <div class="hint mt-1" id="su-hint"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <span class="card-title"><svg class="ic"><use href="#i-build"/></svg>Open companies</span>
            <span class="spacer"></span>
            <span class="card-sub" id="su-count"></span>
          </div>
          <div class="card-body">
            <div class="setup-companies" id="su-companies">
              <div class="company-card"><div class="spinner"></div></div>
            </div>
          </div>
        </div>
      </div>

      <p class="faint small" style="text-align:center;margin-top:18px">
        Tally Prime must be running with a company open and the API port enabled
        (Help → Settings → Connectivity → Both). For an offline demo run
        <span class="mono">python mock_tally.py</span>.
      </p>
    </div>`;

  const renderCompanies = () => {
    const box = document.getElementById('su-companies');
    document.getElementById('su-count').textContent =
      this.state.companies.length ? `${this.state.companies.length} open` : '';
    if (!this.state.companies.length) {
      box.innerHTML = '';
      box.appendChild(U.el(`<div class="empty" style="grid-column:1/-1">
        <div class="empty-ic"><svg class="ic ic-lg"><use href="#i-build"/></svg></div>
        <h4 class="empty-title">No companies open</h4>
        <p class="empty-text">Open a company inside Tally Prime, then refresh.</p>
      </div>`));
      const btn = U.el('<button class="btn btn-primary">Refresh</button>');
      btn.onclick = () => this.renderSetup();
      box.querySelector('.empty').appendChild(U.el('<div class="empty-action"></div>')).appendChild(btn);
      return;
    }
    box.innerHTML = this.state.companies.map((c) => `
      <div class="company-card">
        <div class="cc-ic"><svg class="ic ic-lg"><use href="#i-build"/></svg></div>
        <div>
          <h3>${U.esc(c.name)}</h3>
          <div class="cc-meta">
            ${c.formal_name ? `<span>${U.esc(c.formal_name)}</span>` : ''}
            ${c.books_from ? `<span>Books from ${U.fmtDate(c.books_from)}</span>` : ''}
            ${c.phone ? `<span>${U.esc(c.phone)}</span>` : ''}
          </div>
        </div>
        <div class="cc-foot">
          <button class="btn btn-primary grow" data-company="${U.esc(c.name)}">
            <svg class="ic ic-sm"><use href="#i-arrow-r"/></svg> Open company
          </button>
        </div>
      </div>`).join('');
    U.qsa('[data-company]', box).forEach((btn) => {
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          await this.setCompany(btn.dataset.company);
          this.enterApp();
        } catch (err) {
          btn.disabled = false;
          this.toastError(err, 'Could not open company');
        }
      };
    });
  };

  renderCompanies();

  const getHostPort = () => ({
    host: document.getElementById('su-host').value.trim() || 'localhost',
    port: parseInt(document.getElementById('su-port').value, 10) || 9000,
  });
  const hint = (msg, ok) => {
    const el = document.getElementById('su-hint');
    el.innerHTML = `<span class="${ok ? 'pos' : 'neg'}">${U.esc(msg)}</span>`;
  };

  document.getElementById('su-test').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    hint('Testing…', true);
    try {
      const { host, port } = getHostPort();
      const r = await API.connectionTest(host, port);
      if (r.xml_api) {
        hint(`XML API reachable at ${host}:${port} — ${r.companies.length} company(ies) open`, true);
      } else {
        hint(`No response from ${host}:${port}. Is Tally running with the API port enabled?`, false);
      }
    } catch (err) {
      hint(err.message, false);
    } finally { btn.disabled = false; }
  };

  document.getElementById('su-apply').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    hint('Applying…', true);
    try {
      const { host, port } = getHostPort();
      const r = await API.connectionConfigure(host, port);
      this.state.health = await API.health();
      this.state.companies = r.companies || [];
      document.getElementById('setup-tally-url').textContent = this.state.health.tally_url;
      hint('Connected. Choose a company below.', true);
      renderCompanies();
      this.toast({ type: 'success', title: 'Connected to Tally',
                   message: `${host}:${port}` });
    } catch (err) {
      hint(err.message, false);
    } finally { btn.disabled = false; }
  };
};

/* ── company management ─────────────────────────────────────────────────── */
App.setCompany = async function (name, { silent = false } = {}) {
  await API.selectCompany(name);
  this.state.company = name;
  localStorage.setItem('tb.company', name);
  this.invalidateCaches();
  if (this.state.socket && this.state.socketUp) {
    this.state.socket.emit('subscribe_company', { company: name });
  }
  if (!silent) this.toast({ type: 'success', title: 'Company selected', message: name });
};

App.renderChrome = function () {
  const name = this.state.company || '—';
  document.getElementById('side-company-name').textContent = name;
  document.getElementById('side-company-fy').textContent = U.fyRange().label;
  document.getElementById('company-btn-name').textContent = name;
  this.setSyncPill(this.state.socketUp ? 'ok' : 'warn',
                   this.state.socketUp ? 'Live' : 'Polling');
};

App.renderCompanyMenu = function () {
  const menu = document.getElementById('company-menu');
  menu.innerHTML = `
    <div class="dd-label">Switch company</div>
    ${this.state.companies.map((c) => `
      <button class="dd-item ${c.name === this.state.company ? 'active' : ''}" data-company="${U.esc(c.name)}">
        <svg class="ic ic-sm"><use href="#i-build"/></svg> ${U.esc(c.name)}
      </button>`).join('')}
    <div class="dd-sep"></div>
    <button class="dd-item" data-act="setup">
      <svg class="ic ic-sm"><use href="#i-sliders"/></svg> Connection &amp; setup…
    </button>`;

  U.qsa('[data-company]', menu).forEach((btn) => {
    btn.onclick = async () => {
      if (btn.dataset.company === this.state.company) { menu.hidden = true; return; }
      menu.hidden = true;
      try {
        await this.setCompany(btn.dataset.company);
        this.renderChrome();
        this.go('#/dashboard');
        this.softRefresh();
      } catch (err) { this.toastError(err, 'Could not switch company'); }
    };
  });
  menu.querySelector('[data-act="setup"]').onclick = () => {
    menu.hidden = true;
    this.showSetup();
  };
};

/* ── theme & chrome events ──────────────────────────────────────────────── */
App.applyTheme = function (theme) {
  this.state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('tb.theme', theme);
  const sun = document.getElementById('theme-ic-sun');
  const moon = document.getElementById('theme-ic-moon');
  if (sun && moon) {
    sun.hidden = theme === 'dark';
    moon.hidden = theme !== 'dark';
  }
};

App.bindChromeEvents = function () {
  document.getElementById('btn-refresh').onclick = () => {
    this.invalidateCaches();
    this.toast({ type: 'info', title: 'Refreshing', message: 'Cache cleared — reloading from Tally', timeout: 2200 });
    this.renderRoute();
  };
  document.getElementById('btn-theme').onclick = () => {
    this.applyTheme(this.state.theme === 'light' ? 'dark' : 'light');
  };
  document.getElementById('btn-new-voucher').onclick = () => {
    this.go('#/voucher/new');
  };
  const ddBtn = document.getElementById('company-btn');
  const menu = document.getElementById('company-menu');
  ddBtn.onclick = (e) => {
    e.stopPropagation();
    this.renderCompanyMenu();
    menu.hidden = !menu.hidden;
  };
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== ddBtn) menu.hidden = true;
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('#nav .nav-item');
    if (a) menu.hidden = true;
  });

  /* keyboard shortcuts */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { this.modal.close(); }
    if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      if (this.state.booted) this.go('#/voucher/new');
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      const form = document.getElementById('voucher-form');
      if (form) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  });

  window.addEventListener('hashchange', () => this.renderRoute());
};

window.App = App;
