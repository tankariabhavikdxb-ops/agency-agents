/* ============================================================
   NEXORA CMS — login & session management
   ============================================================ */
(function (root) {
  "use strict";

  const { esc, initials } = root.Fmt;
  const { icon } = root.UI;
  const CMP = root.CMP;

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
          sessionStorage.setItem("nexora_session", JSON.stringify({ name: res.data.user.name, role: res.data.user.role, token: res.data.token }));
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
    sessionStorage.removeItem("nexora_session");
    showLogin();
  }

  function restoreSession() {
    try {
      const raw = sessionStorage.getItem("nexora_session");
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
