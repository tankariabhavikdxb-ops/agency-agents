/* ============================================================
   NEXORA CMS — formatting & small utilities (pure, testable)
   ============================================================ */
(function (root) {
  "use strict";

  const CURRENCY = () => (root.APP_CONFIG && root.APP_CONFIG.COMPANY.currency) || "MK";

  function num(v) {
    const n = typeof v === "string" ? parseFloat(String(v).replace(/[,\s]/g, "")) : Number(v);
    return isFinite(n) ? n : 0;
  }

  /** Format money: MK 1,234,567.89 */
  function money(v, opts) {
    const o = opts || {};
    const sign = o.credit ? "" : num(v) < 0 ? "-" : "";
    const abs = Math.abs(num(v));
    const s = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sign}${CURRENCY()} ${s}`;
  }

  function qty(v, dp) {
    const n = num(v);
    const d = dp === undefined ? 2 : dp;
    return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
  }

  function pct(v, dp) {
    return `${num(v).toFixed(dp === undefined ? 1 : dp)}%`;
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function nowStamp() {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
  }

  function parseISO(v) {
    if (!v) return null;
    const s = String(v).slice(0, 10);
    const p = s.split("-").map(Number);
    if (p.length !== 3 || p.some(isNaN)) return null;
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function fmtDate(v) {
    const d = parseISO(v);
    if (!d) return v ? String(v) : "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function fmtDateTime(v) {
    if (!v) return "—";
    const s = String(v).replace("T", " ").slice(0, 16);
    return s;
  }

  function monthKey(v) {
    return v ? String(v).slice(0, 7) : "";
  }

  function fmtMonth(ym) {
    if (!ym) return "—";
    const p = String(ym).split("-");
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${names[Number(p[1]) - 1]} ${p[0]}`;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function csvCell(v) {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(columns, rows) {
    const lines = [columns.map(c => csvCell(c.label)).join(",")];
    rows.forEach(r => {
      lines.push(columns.map(c => csvCell(c.value ? c.value(r) : r[c.key])).join(","));
    });
    return "\uFEFF" + lines.join("\r\n"); // BOM so Excel opens UTF-8 nicely
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function exportCSV(filename, columns, rows) {
    downloadFile(filename, toCSV(columns, rows), "text/csv;charset=utf-8");
  }

  function exportJSON(filename, obj) {
    downloadFile(filename, JSON.stringify(obj, null, 2), "application/json");
  }

  function uid(prefix) {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 7);
    return `${prefix || "ID"}-${t}${r}`.toUpperCase();
  }

  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms || 250);
    };
  }

  function sum(arr, f) {
    return (arr || []).reduce((a, b) => a + num(f ? f(b) : b), 0);
  }

  function groupBy(arr, keyFn) {
    const m = new Map();
    (arr || []).forEach(x => {
      const k = keyFn(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    });
    return m;
  }

  function sortBy(arr, keyFn, dir) {
    const d = dir === "desc" ? -1 : 1;
    return (arr || []).slice().sort((a, b) => {
      const va = keyFn(a), vb = keyFn(b);
      if (va < vb) return -1 * d;
      if (va > vb) return 1 * d;
      return 0;
    });
  }

  function byId(list, id) {
    if (!list || !id) return null;
    return list.find(x => String(x.id) === String(id)) || null;
  }

  function nameOf(list, id, fallback) {
    const it = byId(list, id);
    return it ? it.name : (fallback || "—");
  }

  /** search-as-you-go match: all terms must appear in the text */
  function matchSearch(query, text) {
    if (!query) return true;
    const q = String(query).toLowerCase().trim();
    if (!q) return true;
    const parts = q.split(/\s+/);
    const hay = String(text || "").toLowerCase();
    return parts.every(p => hay.includes(p));
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function hash(s) {
    let h = 5381;
    const str = String(s);
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return "h" + h.toString(36);
  }

  function isSameDay(a, b) {
    return String(a).slice(0, 10) === String(b).slice(0, 10);
  }

  root.Fmt = { num, money, qty, pct, todayISO, nowStamp, parseISO, fmtDate, fmtDateTime, monthKey, fmtMonth, esc, toCSV, csvCell, downloadFile, exportCSV, exportJSON, uid, debounce, sum, groupBy, sortBy, byId, nameOf, matchSearch, initials, pad2, hash, isSameDay };
})(typeof window !== "undefined" ? window : globalThis);
