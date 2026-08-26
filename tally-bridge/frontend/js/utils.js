/* ═══════════════════════════════════════════════════════════════════════════
   utils.js — formatting, escaping, dates, amounts, CSV, DOM helpers
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const U = {

  /* ── escaping ─────────────────────────────────────────────────────────── */
  esc(value) {
    return String(value ?? '')
      .replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));
  },

  /* ── amounts ──────────────────────────────────────────────────────────── */
  parseAmt(value) {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    const n = parseFloat(String(value ?? '').replace(/[₹$€£¥,\s]/g, ''));
    return isFinite(n) ? n : 0;
  },

  fmtAmt(value, opts = {}) {
    const n = U.parseAmt(value);
    if (opts.dashZero && Math.abs(n) < 0.005) return '—';
    return n.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  /* Tally closing-balance convention: negative = debit */
  fmtBal(value) {
    const n = U.parseAmt(value);
    if (Math.abs(n) < 0.005) return '0.00';
    return U.fmtAmt(Math.abs(n)) + (n < 0 ? ' Dr' : ' Cr');
  },

  balIsDebit(value) {
    return U.parseAmt(value) < 0;
  },

  fmtQty(value) {
    const n = U.parseAmt(value);
    if (!n) return '0';
    return n.toLocaleString('en-IN', {
      maximumFractionDigits: 3,
      minimumFractionDigits: 0,
    });
  },

  /* ── dates ────────────────────────────────────────────────────────────── */
  /* Tally format is YYYYMMDD strings */
  tallyToISO(yyyymmdd) {
    const s = String(yyyymmdd ?? '');
    return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '';
  },

  isoToTally(iso) {
    const s = String(iso ?? '');
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.replace(/-/g, '') : '';
  },

  fmtDate(yyyymmdd) {
    const s = String(yyyymmdd ?? '');
    if (/^\d{8}$/.test(s)) return `${s.slice(6, 8)}-${s.slice(4, 6)}-${s.slice(0, 4)}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('-');
    return s || '—';
  },

  todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /* Indian financial year (Apr–Mar) containing today */
  fyRange() {
    const d = new Date();
    const y = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
    return { from: `${y}-04-01`, to: `${y + 1}-03-31`, label: `FY ${String(y).slice(2)}-${String(y + 1).slice(2)}` };
  },

  /* ── misc helpers ─────────────────────────────────────────────────────── */
  debounce(fn, ms = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  qs(sel, root = document) { return root.querySelector(sel); },
  qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); },

  el(html) {
    const t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  },

  initials(name) {
    return String(name ?? '?')
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0].toUpperCase()).join('') || '?';
  },

  plural(n, word, pluralWord) {
    return `${n} ${n === 1 ? word : (pluralWord || word + 's')}`;
  },

  truncate(s, n = 46) {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  },

  downloadCSV(filename, rows) {
    const csv = rows.map((row) => row.map((cell) => {
      const s = String(cell ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },

  /* diff badge text for report difference values */
  diffClass(v) {
    return Math.abs(U.parseAmt(v)) < 0.005 ? 'pos' : 'neg';
  },
};

window.U = U;
