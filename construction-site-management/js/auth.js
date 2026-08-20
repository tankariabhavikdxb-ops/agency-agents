/* ============================================================
   NEXORA CMS — login & session management
   ============================================================ */
(function (root) {
  "use strict";

  const { esc, initials } = root.Fmt;
  const { icon } = root.UI;
  const CMP = root.CMP;

  /* sessionStorage is not guaranteed on every file:// browser */
  function sessGet(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  function sessSet(key, val) { try { sessionStorage.setItem(key, val); } catch (e) { /* ignore */ } }
  function sessRemove(key) { try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ } }

  function showLogin() {
    const api = root.API;
    const s = api.store;
    if (!document.getElementById("login-screen")) {
      const host = document.createElement("div");
      host.id = "login-screen";
      host.innerHTML = `
        <div class="login-panel">
          <div class="login-brand">
            <div class="logo-badge">${icon("building", 26)}</div>
            <div>
              <div class="login-company">Nexora Limited</div>
              <div class="login-sub">Construction Site Management System</div>
            </div>
          </div>
          <div class="login-banner" id="login-load-err" style="display:none">
            <div class="login-banner-ic">${icon("warn", 17)}</div>
            <div class="login-banner-txt">
              <b>Could not load the user list from the Google Sheets backend.</b>
              <div class="login-banner-sub">The connection to the backend is failing, so no users can be shown. Check the connection, then retry — or switch to demo mode.</div>
              <div class="btn-row">
                <button class="btn btn-soft btn-sm" data-act="login-retry" id="login-retry-btn">${icon("refresh", 13)} Retry</button>
                <button class="btn btn-soft btn-sm" data-act="login-openurl">${icon("eye", 13)} Open Backend URL</button>
                ${s.hosted ? "" : `<button class="btn btn-soft btn-sm" data-act="login-demo">${icon("info", 13)} Use Demo Mode</button>`}
              </div>
            </div>
          </div>
          <form id="login-form" autocomplete="off">
            <div class="login-fields">
              <label class="login-label">Select your name <span class="req-star">*</span></label>
              <div id="login-user"></div>
              <label class="login-label">PIN <span class="req-star">*</span></label>
              <div class="pin-wrap">
                <input class="input" id="login-pin" type="password" inputmode="numeric" maxlength="12" placeholder="Enter your PIN" />
                <button type="button" class="icon-btn" id="login-pin-eye" title="Show PIN">${icon("eye", 16)}</button>
              </div>
              <div class="login-hint">Default PIN for all users: <b>1234</b> — please change it in Settings after your first login.</div>
            </div>
            <button class="btn btn-primary btn-lg btn-block" id="login-btn" type="submit">${icon("key", 16)} Sign In</button>
            <div class="login-data-note">${s.mode === "live"
              ? `${icon("link", 12)} You are signing in to your <b>LIVE Google Sheets data</b>.`
              : `${icon("info", 12)} You are signing in to the <b>DEMO database</b> stored in this browser — connect Google Sheets (Settings) for live data.`}</div>
            ${s.mode === "live" && s.backendVersion > 0 && s.backendVersion < ((root.APP_CONFIG && root.APP_CONFIG.REQUIRED_BACKEND_VERSION) || 3)
              ? `<div class="login-data-note" style="color:var(--warn);margin-top:6px">${icon("warn", 12)} Your backend script is outdated (v${F.esc(String(s.backendVersion))}) — update <b>backend/Code.gs</b> and deploy a <b>New version</b> so the fallback channel and auto user-seeding work.</div>`
              : ""}
            <div id="login-err" class="login-err"></div>
          </form>
          <div class="login-foot">
            <span class="mode-chip ${s.mode === "live" ? "live" : "demo"}">
              ${icon(s.mode === "live" ? "link" : "info", 12)}
              ${s.mode === "live" ? "Connected to Google Sheets" : "DEMO MODE — sample data (connect Google Sheets in Settings)"}
            </span>
          </div>
        </div>
        <div class="login-side">
          <div class="login-side-inner">
            <div class="login-big">${icon("building", 44)}</div>
            <h1>Run your sites with <span>total control</span>.</h1>
            <p>Masters → Budget → Contracts &amp; LPOs → Actual expenses.
            Track profitability at any stage, and never let expenses slip past the budget.</p>
            <ul>
              <li>${icon("check", 15)} Strict budget control — expenses only against approved budget lines</li>
              <li>${icon("check", 15)} Duplicate-entry checks on every record</li>
              <li>${icon("check", 15)} Real-time sync across all users via Google Sheets</li>
              <li>${icon("check", 15)} Beautiful dashboards &amp; printable reports</li>
            </ul>
          </div>
        </div>`;
      document.body.appendChild(host);

      const pin = host.querySelector("#login-pin");
      host.querySelector("#login-pin-eye").addEventListener("click", () => {
        pin.type = pin.type === "password" ? "text" : "password";
      });

      // search-as-you-go user select (backend already returns only active users)
      const items = (s.users || []).map(u => ({ id: u.name, label: u.name, sub: `${u.role}`, badge: "" }));
      const userSel = CMP.searchSelect({
        id: "login-user", items, placeholder: "Type your name…", required: true,
        emptyText: "No active user with that name",
      });
      host.querySelector("#login-user").appendChild(userSel.wrap);

      // resilience: if the backend can't be reached the user list is empty —
      // show a clear banner with retry / open-url / demo fallback
      const banner = host.querySelector("#login-load-err");
      const refreshBanner = () => {
        banner.style.display = (s.mode === "live") && !(s.users || []).length ? "flex" : "none";
      };
      refreshBanner();
      host.addEventListener("click", async e => {
        const b = e.target.closest("[data-act]");
        if (!b) return;
        if (b.dataset.act === "login-retry") {
          const btn = b;
          btn.disabled = true;
          const res = await api.call("getLoginUsers", {});
          btn.disabled = false;
          if (res && res.ok && res.data) {
            s.users = res.data.rows || [];
            userSel.setItems((s.users || []).map(u => ({ id: u.name, label: u.name, sub: `${u.role}`, badge: "" })));
            refreshBanner();
            root.UI.toast("User list loaded — you can sign in now.", "success");
          } else {
            refreshBanner();
            root.UI.toast((res && res.error && res.error.message) || "Still cannot reach the backend.", "error", { ms: 7000 });
          }
        } else if (b.dataset.act === "login-openurl") {
          const u = s.apiUrl || "";
          if (!u) { root.UI.toast("No backend URL configured.", "error"); return; }
          window.open(u, "_blank", "noopener");
          root.UI.toast("You should see “backend is ONLINE” in the opened tab — with no Google sign-in page.", "info", { ms: 7000 });
        } else if (b.dataset.act === "login-demo") {
          api.setApiUrl("");
          location.reload();
        }
      });

      host.querySelector("#login-form").addEventListener("submit", async e => {
        e.preventDefault();
        const name = userSel.value;
        const pinVal = pin.value.trim();
        const errEl = host.querySelector("#login-err");
        errEl.innerHTML = "";
        if (!name) { errEl.textContent = "Please select your name."; return; }
        if (!pinVal) { errEl.textContent = "Please enter your PIN."; return; }
        const btn = host.querySelector("#login-btn");
        btn.disabled = true;
        btn.classList.add("loading-btn");
        const res = await api.call("login", { name, pin: pinVal });
        btn.disabled = false;
        btn.classList.remove("loading-btn");
        if (res && res.ok) {
          api.store.user = res.data.user;
          api.store.token = res.data.token;
          sessSet("nexora_session", JSON.stringify({ name: res.data.user.name, role: res.data.user.role, token: res.data.token }));
          root.UI.toast(`Welcome back, ${res.data.user.name}!`, "success");
          hideLogin();
          await api.refreshAll(false);
          if (root.App) root.App.enter();
        } else {
          errEl.textContent = (res && res.error && res.error.message) || "Login failed.";
          pin.value = "";
          pin.focus();
        }
      });
    } else {
      document.getElementById("login-screen").style.display = "flex";
    }
  }

  function hideLogin() {
    const host = document.getElementById("login-screen");
    if (host) {
      host.classList.add("gone");
      setTimeout(() => host.remove(), 500);
    }
  }

  function logout() {
    const api = root.API;
    if (api.store.mode === "live") api.call("logout", {});
    api.store.user = null;
    api.store.token = null;
    sessRemove("nexora_session");
    showLogin();
  }

  function restoreSession() {
    try {
      const raw = sessGet("nexora_session");
      if (raw) {
        const sess = JSON.parse(raw);
        if (sess && sess.name) {
          root.API.store.user = { name: sess.name, role: sess.role };
          root.API.store.token = sess.token || "";
          return true;
        }
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function requireLogin() {
    const api = root.API;
    if (!api.store.user) {
      const restored = restoreSession();
      if (!restored) {
        showLogin();
        return false;
      }
    }
    return true;
  }

  root.Auth = { showLogin, hideLogin, logout, restoreSession, requireLogin };
})(typeof window !== "undefined" ? window : globalThis);
