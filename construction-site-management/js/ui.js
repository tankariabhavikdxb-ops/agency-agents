/* ============================================================
   NEXORA CMS — UI toolkit: icons, toasts, modals, helpers
   ============================================================ */
(function (root) {
  "use strict";

  const { esc } = root.Fmt;

  /* ---------- inline SVG icon set (stroke, 24px) ---------- */
  const PATHS = {
    home: "M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5",
    back: "M15 18l-6-6 6-6",
    save: "M5 3h12l4 4v14H5z M8 3v5h7V3 M7 21v-7h10v7",
    edit: "M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z M13.5 6.5l3 3",
    trash: "M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6",
    print: "M6 9V3h12v6 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
    export: "M12 3v12 M8 7l4-4 4 4 M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    filter: "M3 5h18l-7 8v5l-4 2v-7L3 5z",
    plus: "M12 5v14 M5 12h14",
    refresh: "M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6",
    sync: "M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3",
    close: "M6 6l12 12M18 6L6 18",
    check: "M4 12.5l5 5L20 6.5",
    warn: "M12 3 2.5 20h19L12 3z M12 9v5 M12 17.5v.5",
    info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 11v6 M12 7.5v.5",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z",
    users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    chart: "M3 3v18h18 M7 16v-5 M12 16V8 M17 16v-8",
    doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M9 13h6 M9 17h6",
    building: "M3 21h18 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16 M9 7h1 M14 7h1 M9 11h1 M14 11h1 M9 15h1 M14 15h1 M10 21v-4h4v4",
    box: "M21 8.5v7a2 2 0 0 1-1 1.73l-7 3.5a2 2 0 0 1-2 0l-7-3.5a2 2 0 0 1-1-1.73v-7a2 2 0 0 1 1-1.73l7-3.5a2 2 0 0 1 2 0l7 3.5a2 2 0 0 1 1 1.73z M3.3 7.5 12 12l8.7-4.5 M12 22V12",
    briefcase: "M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2 M2 13h20",
    money: "M12 7v10 M16 9.5c-.4-1-1.4-1.5-2.5-1.5-1.7 0-3.5.8-3.5 2.5s2 2 3.5 2.5 3.5.8 3.5 2.5-1.8 2.5-3.5 2.5c-1.1 0-2.1-.5-2.5-1.5 M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0z",
    wallet: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M16 12h.01 M3 9h18",
    pin: "M12 17v5 M9 3h6l-1 7 3.5 3.5H6.5L10 10 9 3z M5 22h14",
    key: "M21 2l-9.6 9.6 M15.5 7.5l3 3L21 8l-3-3-2.5 2.5 M12.6 10.4a5 5 0 1 1-7.07 7.07 5 5 0 0 1 7.07-7.07z",
    chevD: "M6 9l6 6 6-6",
    chevR: "M9 6l6 6-6 6",
    cal: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M3 9h18 M8 3v4 M16 3v4",
    link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7 M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
    lock: "M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M7 11V7a5 5 0 0 1 10 0v4",
    shield: "M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z",
    alert: "M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    chevL: "M15 18l-6-6 6-6",
    copy: "M9 9h11v11H9z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
    download: "M12 3v12 M8 11l4 4 4-4 M4 19h16",
    upload: "M12 21V9 M8 13l4-4 4 4 M4 19h16",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
    list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
    grid: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
    truck: "M1 4h14v12H1z M15 9h4l4 4v3h-8 M5.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M18.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  };

  function icon(name, size) {
    const d = PATHS[name] || PATHS.box;
    return `<svg class="ic" width="${size || 18}" height="${size || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  /* ---------- toast ---------- */
  function toast(message, type, opts) {
    const o = opts || {};
    let wrap = document.getElementById("toast-root");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toast-root";
      document.body.appendChild(wrap);
    }
    const t = document.createElement("div");
    t.className = "toast " + (type || "info");
    const ic = type === "error" ? "warn" : type === "success" ? "check" : "info";
    t.innerHTML = `<span class="toast-ic">${icon(ic, 16)}</span><div class="toast-body">${o.html ? message : esc(message)}</div>${o.closable === false ? "" : `<button class="toast-x" aria-label="Close">${icon("close", 12)}</button>`}`;
    wrap.appendChild(t);
    const kill = () => { t.classList.add("out"); setTimeout(() => t.remove(), 300); };
    t.querySelector(".toast-x")?.addEventListener("click", kill);
    setTimeout(kill, o.ms || 4200);
  }

  /* ---------- modal ---------- */
  function openModal(html, opts) {
    const o = opts || {};
    const existing = document.querySelector(".modal-backdrop");
    if (existing) existing.remove();
    const b = document.createElement("div");
    b.className = "modal-backdrop";
    b.innerHTML = `<div class="modal ${o.wide ? "modal-wide" : ""} ${o.tall ? "modal-tall" : ""}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h3>${o.title ? esc(o.title) : ""}</h3>
            ${o.subtitle ? `<div class="modal-sub">${esc(o.subtitle)}</div>` : ""}
          </div>
          <button class="icon-btn modal-close" aria-label="Close">${icon("close", 18)}</button>
        </div>
        <div class="modal-body">${html}</div>
        ${o.footer === false ? "" : `<div class="modal-foot">${o.footer || ""}</div>`}
      </div>`;
    document.body.appendChild(b);
    b.addEventListener("mousedown", e => { if (e.target === b && o.closable !== false) closeModal(); });
    b.querySelector(".modal-close")?.addEventListener("click", () => { if (o.closable !== false) closeModal(); });
    if (o.onEsc !== false) {
      const h = e => { if (e.key === "Escape" && o.closable !== false) { closeModal(); document.removeEventListener("keydown", h); } };
      document.addEventListener("keydown", h);
    }
    const first = b.querySelector("input, select, textarea, button.btn-primary");
    setTimeout(() => first?.focus(), 60);
    return b;
  }

  function closeModal() {
    const b = document.querySelector(".modal-backdrop");
    if (b) { b.classList.add("closing"); setTimeout(() => b.remove(), 160); }
  }

  function modalEl() { return document.querySelector(".modal-backdrop .modal"); }

  /* ---------- confirm ---------- */
  function confirmDialog(opts) {
    const o = opts || {};
    return new Promise(resolve => {
      openModal(
        `<div class="confirm-wrap">
           <div class="confirm-ic ${o.danger ? "danger" : "info"}">${icon(o.danger ? "warn" : "info", 26)}</div>
           <div class="confirm-txt">
             <div class="confirm-title">${esc(o.title || "Are you sure?")}</div>
             <div class="confirm-msg">${o.html ? o.html : esc(o.message || "")}</div>
           </div>
         </div>`,
        {
          title: o.title ? "" : "Confirm",
          footer: `
            <button class="btn btn-ghost" data-act="no">${icon("close", 15)} Cancel</button>
            <button class="btn ${o.danger ? "btn-danger" : "btn-primary"}" data-act="yes">${icon("check", 15)} ${esc(o.okLabel || "Confirm")}</button>`,
        }
      );
      const b = document.querySelector(".modal-backdrop");
      b.addEventListener("click", e => {
        const act = e.target.closest("[data-act]")?.getAttribute("data-act");
        if (act === "yes") { closeModal(); resolve(true); }
        if (act === "no") { closeModal(); resolve(false); }
      });
    });
  }

  /* ---------- page toolbar ---------- */
  function pageToolbar(title, sub, buttons, extras) {
    const html = `
      <div class="pagehead">
        <div class="pagehead-titles">
          <div class="crumbs"><span class="crumb">${icon("home", 13)} Nexora</span>${extras && extras.crumbs ? extras.crumbs.map(c => `<span class="crumb-sep">/</span><span class="crumb">${esc(c)}</span>`).join("") : ""}</div>
          <h2>${esc(title)}</h2>
          ${sub ? `<p class="page-sub">${sub}</p>` : ""}
        </div>
        <div class="pagehead-actions">${(buttons || []).map(b => b).join("")}</div>
      </div>`;
    return html;
  }

  const BTN = {
    home: `<button class="btn btn-soft" data-act="home" title="Go to Home">${icon("home", 15)} Home</button>`,
    back: `<button class="btn btn-soft" data-act="back" title="Go back">${icon("back", 15)} Back</button>`,
    refresh: `<button class="btn btn-soft" data-act="refresh" title="Refresh data from Google Sheets">${icon("refresh", 15)} Refresh</button>`,
    print: `<button class="btn btn-soft" data-act="print" title="Print / save as PDF">${icon("print", 15)} Print</button>`,
    export: `<button class="btn btn-soft" data-act="export" title="Export to CSV (Excel)">${icon("export", 15)} Export</button>`,
    preview: `<button class="btn btn-soft" data-act="preview" title="Print preview">${icon("eye", 15)} Preview</button>`,
    filters: `<button class="btn btn-soft" data-act="filters" title="Show / hide filters">${icon("filter", 15)} Filters</button>`,
    add: label => `<button class="btn btn-primary" data-act="add">${icon("plus", 15)} ${esc(label || "Add New")}</button>`,
    save: `<button class="btn btn-primary" data-act="save">${icon("save", 15)} Save</button>`,
    cancel: `<button class="btn btn-ghost" data-act="cancel">${icon("close", 15)} Cancel</button>`,
  };

  /* ---------- status pills ---------- */
  const PILL = {
    Active: "ok", Approved: "ok", Paid: "ok", Received: "ok", Completed: "info", Issued: "info",
    "In Progress": "info", Awarded: "info", "Partially Paid": "warn", "Partially Received": "warn",
    Open: "warn", Hold: "warn", "On Hold": "warn", Planning: "info", Unpaid: "bad", Overdue: "bad",
    Cancelled: "bad", Terminated: "bad", Inactive: "muted", Over: "bad", Near: "warn", OK: "ok",
    Admin: "brand", Supervisor: "info", Clerk: "muted", UnpaidBad: "bad",
  };

  function pill(text, tone) {
    const t = tone || PILL[text] || "muted";
    return `<span class="pill ${t}">${esc(text || "—")}</span>`;
  }

  function usagePill(p) {
    const v = Number(p);
    const t = v > 100.005 ? "Over" : v >= 80 ? "Near" : "OK";
    return pill(`${v.toFixed(1)}%`, PILL[t]);
  }

  /* ---------- misc DOM helpers ---------- */
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function emptyState(iconName, title, msg, actionHtml) {
    return `<div class="empty">
      <div class="empty-ic">${icon(iconName || "box", 30)}</div>
      <div class="empty-title">${esc(title || "Nothing here yet")}</div>
      <div class="empty-msg">${msg || ""}</div>
      ${actionHtml || ""}
    </div>`;
  }

  function spinner(label) {
    return `<div class="loading"><div class="spinner"></div><div>${esc(label || "Loading…")}</div></div>`;
  }

  function attachActions(container, handler) {
    container.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (btn) handler(btn.getAttribute("data-act"), btn, e);
    });
  }

  root.UI = { icon, toast, openModal, closeModal, modalEl, confirmDialog, pageToolbar, BTN, pill, usagePill, el, emptyState, spinner, attachActions, PATHS };
})(typeof window !== "undefined" ? window : globalThis);
