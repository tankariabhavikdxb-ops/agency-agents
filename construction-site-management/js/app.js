/* ============================================================
   NEXORA CMS — application shell
   routing, sidebar, real-time sync loop, permissions, printing
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt, UI = root.UI, api = root.API;

  const ROUTES = [
    { hash: "dashboard", page: "dashboard", icon: "home", label: "Dashboard" },
    { hash: "masters", page: "masters", icon: "grid", label: "Masters" },
    { hash: "budget", page: "budget", icon: "doc", label: "Budget" },
    { hash: "contracts", page: "contract", icon: "briefcase", label: "Contracts & LPO" },
    { hash: "expenses", page: "expenses", icon: "wallet", label: "Expenses" },
    { hash: "reports", page: "reports", icon: "chart", label: "Reports" },
    { hash: "audit", page: "audit", icon: "shield", label: "Audit Trail" },
    { hash: "settings", page: "settings", icon: "settings", label: "Settings" },
  ];

  const PERMS = {
    Admin: { settings: true, users: true, masters: true, edit: true, delete: true, create: true, override: true },
    Supervisor: { settings: false, users: false, masters: true, edit: true, delete: true, create: true, override: false },
    Clerk: { settings: false, users: false, masters: false, edit: false, delete: false, create: true, override: false },
  };

  function can(perm) {
    const role = api.store.user ? api.store.user.role : "Clerk";
    const p = PERMS[role] || PERMS.Clerk;
    return !!p[perm];
  }

  function buildShell() {
    const host = document.getElementById("app-root");
    if (!host) return;
    host.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="sb-brand">
          <div class="logo-badge">${UI.icon("building", 22)}</div>
          <div class="sb-brand-txt">
            <div class="sb-company">NEXORA</div>
            <div class="sb-tag">Site Management</div>
          </div>
        </div>
        <nav class="sb-nav">
          ${ROUTES.map(r => `<a class="sb-link" data-route="${r.hash}">${UI.icon(r.icon, 18)}<span>${r.label}</span></a>`).join("")}
        </nav>
        <div class="sb-foot">
          <div class="sb-user">
            <div class="av">${F.initials(api.store.user ? api.store.user.name : "?")}</div>
            <div class="sb-user-txt">
              <div class="sb-user-name">${F.esc(api.store.user ? api.store.user.name : "")}</div>
              <div class="sb-user-role">${F.esc(api.store.user ? api.store.user.role : "")}</div>
            </div>
            <button class="icon-btn" id="logout-btn" title="Sign out">${UI.icon("logout", 17)}</button>
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" id="menu-btn">${UI.icon("menu", 20)}</button>
          <div class="topbar-sync" id="topbar-sync">
            <span class="sync-dot"></span><span class="sync-txt">Synced · ${api.store.mode === "live" ? "Google Sheets" : "Demo mode"}</span>
          </div>
          <div class="topbar-right">
            <span class="topbar-clock" id="topbar-clock"></span>
            <button class="btn btn-soft btn-sm" id="sync-now">${UI.icon("sync", 14)} Sync Now</button>
          </div>
        </header>
        <main class="content" id="content"></main>
      </div>
      <div class="sb-overlay" id="sb-overlay"></div>`;

    host.querySelectorAll(".sb-link").forEach(a => a.addEventListener("click", () => {
      location.hash = "#/" + a.dataset.route;
      closeSidebar();
    }));
    host.querySelector("#logout-btn").addEventListener("click", () => root.Auth.logout());
    host.querySelector("#sync-now").addEventListener("click", async () => {
      setSyncState("syncing");
      await api.refreshAll(false);
      setSyncState("synced");
      UI.toast("All data refreshed", "success");
      rerenderCurrent();
    });
    host.querySelector("#menu-btn").addEventListener("click", () => {
      document.body.classList.toggle("sb-open");
    });
    host.querySelector("#sb-overlay").addEventListener("click", closeSidebar);

    setInterval(() => {
      const el = document.getElementById("topbar-clock");
      if (el) el.textContent = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }, 1000);
  }

  function closeSidebar() { document.body.classList.remove("sb-open"); }

  function setSyncState(mode) {
    const el = document.getElementById("topbar-sync");
    if (!el) return;
    el.className = "topbar-sync " + mode;
    const txt = el.querySelector(".sync-txt");
    if (!txt) return;
    if (mode === "syncing") txt.textContent = "Syncing…";
    else if (mode === "offline") txt.textContent = "Offline / not connected";
    else txt.textContent = `Synced · ${api.store.mode === "live" ? "Google Sheets" : "Demo mode"} · ${api.store.lastSync ? F.fmtDateTime(api.store.lastSync) : "—"}`;
  }

  /* ---------------- router ---------------- */
  function parseHash() {
    const h = (location.hash || "#/dashboard").replace(/^#\/?/, "");
    const qIdx = h.indexOf("?");
    const pathPart = qIdx >= 0 ? h.slice(0, qIdx) : h;
    const queryPart = qIdx >= 0 ? h.slice(qIdx + 1) : "";
    const parts = pathPart.split("/").filter(Boolean);
    const route = ROUTES.find(r => r.hash === parts[0]);
    return {
      page: route ? route.page : "dashboard",
      path: parts.slice(1),
      query: Object.fromEntries(new URLSearchParams(queryPart || "")),
    };
  }

  function enter() {
    buildShell();
    navigate();
    startSyncLoop();
  }

  function navigate() {
    if (!root.Auth.requireLogin()) return;
    const { page, path, query } = parseHash();
    const def = root.Pages[page];
    const container = document.getElementById("content");
    if (!def || !container) return;
    const params = {};
    if (query.new) params.new = true;
    if (query.type) params.type = query.type;
    if (path[0]) {
      if (page === "masters") params.sheet = path[0];
      if (page === "reports") params.key = path[0];
    }
    document.querySelectorAll(".sb-link").forEach(a => a.classList.toggle("on", "#/" + a.dataset.route === "#/" + (location.hash.replace(/^#\/?/, "").split(/[/?]/)[0])));
    container.innerHTML = "";
    try {
      def.render(container, params);
    } catch (e) {
      console.error(e);
      container.innerHTML = UI.emptyState("warn", "Something went wrong rendering this page", F.esc(String(e && e.message || e)));
    }
    window.scrollTo({ top: 0 });
  }

  function rerenderCurrent() {
    const { page } = parseHash();
    const container = document.getElementById("content");
    if (container) container.innerHTML = "";
    navigate();
  }

  /* ---------------- real-time sync loop ---------------- */
  let syncTimer = null;
  function startSyncLoop() {
    clearInterval(syncTimer);
    const secs = Math.max(15, F.num(api.store.settings.pollInterval) || 45);
    syncTimer = setInterval(syncTick, secs * 1000);
  }

  async function syncTick() {
    if (!api.store.user) return;
    if (api.store.mode === "live") {
      setSyncState("syncing");
      const v = await api.pollVersion();
      if (v == null) { setSyncState("offline"); return; }
      if (v !== api.store.version) {
        await api.refreshAll(false);
        UI.toast("New changes from another user detected — view refreshed.", "info");
        rerenderCurrent();
      } else {
        api.store.lastSync = F.nowStamp();
      }
      setSyncState("synced");
    } else {
      // demo mode: cross-tab sync via localStorage events
      setSyncState("synced");
    }
  }

  window.addEventListener("storage", e => {
    if (e.key === "nexora_cms_db_v1" && api.store.user) {
      try {
        const db = JSON.parse(e.newValue);
        if (db && db.version && db.version !== api.store.version) {
          api.refreshAll(false).then(() => {
            UI.toast("Changes made in another tab — data updated.", "info");
            rerenderCurrent();
          });
        }
      } catch (err) { /* ignore */ }
    }
  });

  /* ---------------- print infrastructure ---------------- */
  function buildPrintHTML(title, bodyHtml, filterNote) {
    const s = api.store.settings;
    const user = api.store.user ? api.store.user.name : "";
    return `
      <div class="print-doc">
        <div class="print-head">
          <div class="print-brand">
            <div class="print-logo">${UI.icon("building", 22)}</div>
            <div>
              <div class="print-company">${F.esc(s.companyName || "Nexora Limited")}</div>
              <div class="print-addr">${F.esc(s.companyAddress || "")}${s.companyPhone ? " · " + F.esc(s.companyPhone) : ""}${s.companyEmail ? " · " + F.esc(s.companyEmail) : ""}</div>
            </div>
          </div>
          <div class="print-meta">
            <div class="print-title">${F.esc(title)}</div>
            <div class="print-sub">${filterNote ? F.esc(filterNote) : ""} · Generated ${F.fmtDate(F.todayISO())} ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} by ${F.esc(user)}</div>
          </div>
        </div>
        <div class="print-body">${bodyHtml}</div>
        <div class="print-foot">Nexora Limited · Construction Site Management System · This report is generated from live data in Google Sheets.</div>
      </div>`;
  }

  function printReport(title, bodyHtml, filterNote) {
    let rootEl = document.getElementById("print-root");
    if (!rootEl) {
      rootEl = document.createElement("div");
      rootEl.id = "print-root";
      document.body.appendChild(rootEl);
    }
    rootEl.innerHTML = buildPrintHTML(title, bodyHtml, filterNote);
    const before = () => { };
    const after = () => { rootEl.innerHTML = ""; };
    window.addEventListener("afterprint", after, { once: true });
    window.addEventListener("beforeprint", before, { once: true });
    setTimeout(() => window.print(), 80);
  }

  function printTable(cols, rows) {
    const esc = F.esc;
    return `<table class="ptable">
      <thead><tr>${cols.map(c => `<th class="${c.align === "right" ? "ar" : ""}">${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(c => {
        const v = c.render ? c.render(r) : r[c.key];
        return `<td class="${c.align === "right" ? "ar" : ""}">${v == null || v === "" ? "—" : v}</td>`;
      }).join("")}</tr>`).join("")}</tbody>
      ${rows.length ? `<tfoot><tr><td colspan="${cols.length}" class="ar"><b>Total rows: ${rows.length}</b></td></tr></tfoot>` : ""}
    </table>`;
  }

  /* ---------------- global events ---------------- */
  window.addEventListener("hashchange", () => {
    if (api.store.user) navigate();
  });

  /* ---------------- boot ---------------- */
  async function boot() {
    // preload lookups for the login screen
    const res = await api.call("getState", {});
    if (res && res.ok && res.data && res.data.settings) {
      api.store.settings = Object.assign({}, api.store.settings, res.data.settings);
      api.store.version = res.data.version || 0;
    }
    const usersRes = await api.call("getLoginUsers", {});
    if (usersRes && usersRes.ok && usersRes.data) api.store.users = usersRes.data.rows || [];

    if (!root.Auth.requireLogin()) return;
    await api.refreshAll(false);
    buildShell();
    navigate();
    startSyncLoop();
  }

  root.App = { boot, enter, navigate, rerenderCurrent, can, buildPrintHTML, printReport, printTable, ROUTES, setSyncState };
})(typeof window !== "undefined" ? window : globalThis);
