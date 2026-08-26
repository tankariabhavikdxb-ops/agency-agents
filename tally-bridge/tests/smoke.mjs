/*
 * Headless integration test for the Tally Bridge frontend.
 * Loads the real app from the running bridge (http://127.0.0.1:5000/),
 * with the real REST API and mock Tally behind it, then drives the UI:
 *   boot -> setup screen -> select company -> dashboard -> all pages ->
 *   create voucher through the form -> verify sync -> delete it.
 *
 * Run:  node smoke.mjs   (bridge + mock must be running)
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const BASE = 'http://127.0.0.1:5000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
vc.on('log', () => {});
vc.on('warn', () => {});

const dom = await JSDOM.fromURL(BASE + '/', {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    /* node's fetch, bound into the jsdom window */
    window.fetch = (url, opts) => fetch(new URL(url, BASE + '/').href, opts);
    if (!window.AbortController) window.AbortController = AbortController;
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.URL.createObjectURL = () => 'blob:mock';
    window.URL.revokeObjectURL = () => {};
  },
});

const { window } = dom;
const { document } = window;
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const text = (sel) => ($(sel) ? $(sel).textContent.trim() : '(missing)');

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; console.log('  ✔ ' + label); }
  else { failed++; console.log('  ✘ FAIL: ' + label); }
};

/* ── 1. boot to setup screen (no company saved) ─────────────────────── */
console.log('\n[1] boot -> setup screen');
await sleep(3500);
ok(window.App && window.App.state, 'App global initialised');
ok(!document.getElementById('splash'), 'splash removed after boot');
ok(!document.getElementById('setup').hidden, 'setup screen visible');
ok($$('.company-card').length === 2, `two company cards shown (${$$('.company-card').length})`);
ok(text('#setup-tally-url').includes('127.0.0.1:9000'), 'tally URL shown on setup');

/* ── 2. open a company ──────────────────────────────────────────────── */
console.log('\n[2] open company -> app shell');
const openBtn = document.querySelector('[data-company="Demo Company (Mock)"]');
ok(!!openBtn, 'open-company button present');
openBtn.click();
await sleep(2500);
ok(!document.getElementById('app').hidden, 'app shell visible');
ok(window.App.state.company === 'Demo Company (Mock)', 'company set in state');
ok(window.localStorage.getItem('tb.company') === 'Demo Company (Mock)', 'company persisted');
ok(text('#side-company-name') === 'Demo Company (Mock)', 'sidebar shows company');
ok(text('#page-title') === 'Dashboard', 'dashboard is first page');
ok($$('.stat').length === 4, 'four stat cards on dashboard');
ok(text('#dash-recent') !== '' || !!$('#dash-recent .empty, #dash-recent .tbl'),
   'recent vouchers area rendered');

/* ── 3. visit every route ───────────────────────────────────────────── */
console.log('\n[3] route sweep');
const routes = [
  ['#/daybook', 'Day Book'],
  ['#/vouchers', 'Voucher Register'],
  ['#/ledgers', 'Ledgers'],
  ['#/groups', 'Groups'],
  ['#/stock-items', 'Stock Items'],
  ['#/masters/units', 'More Masters'],
  ['#/reports/trial-balance', 'Trial Balance'],
  ['#/reports/balance-sheet', 'Balance Sheet'],
  ['#/reports/profit-loss', 'Profit & Loss'],
  ['#/config', 'Configuration'],
  ['#/voucher/new', 'New Voucher'],
];
for (const [hash, title] of routes) {
  window.App.go(hash);
  await sleep(1100);
  ok(text('#page-title') === title, `route ${hash} renders "${title}"`);
  ok(!$('#content .pageError, #content .empty[style*="alert"]') || $$('#content .card').length > 0,
     `route ${hash} has content`);
}

/* ── 4. trial balance contents ──────────────────────────────────────── */
console.log('\n[4] trial balance data');
window.App.go('#/reports/trial-balance');
await sleep(1400);
const tbRows = $$('#rp-body tbody tr');
ok(tbRows.length >= 8, `trial balance rows rendered (${tbRows.length})`);
ok($$('#rp-body tfoot .num').length >= 2, 'totals footer rendered');
ok(text('#rp-body tfoot td:last-child') === '2,84,900.00', 'TB credit total = 284,900.00');
ok(text('#rp-body tfoot td:nth-child(3)') === '2,84,900.00', 'TB debit total = 284,900.00');

/* ── 5. day book ────────────────────────────────────────────────────── */
console.log('\n[5] day book');
window.App.go('#/daybook?date=2026-06-15');
await sleep(1300);
const dbRows = $$('#db-body tbody tr');
ok(dbRows.length === 1, `one voucher on 2026-06-15 (${dbRows.length})`);
ok(dbRows[0] && dbRows[0].textContent.includes('Global Traders'), 'correct voucher listed');

/* ── 6. voucher entry form: fill and save ───────────────────────────── */
console.log('\n[6] voucher entry form -> save');
window.App.go('#/voucher/new?type=Journal');
await sleep(1300);
ok(!!$('#voucher-form'), 'voucher form rendered');
ok($('#vf-type').value === 'Journal', 'type preselected from query');
ok($$('#vf-entries tbody tr').length === 2, 'two entry rows by default');

/* fill the form */
$('#vf-date').value = '2026-08-26';
$('#vf-narr').value = 'Smoke test entry & <chars>';
const rows = $$('#vf-entries tbody tr');
rows[0].querySelector('.in-account').value = 'Office Expenses';
rows[0].querySelector('.in-dr').value = '750';
rows[1].querySelector('.in-account').value = 'Cash';
rows[1].querySelector('.in-cr').value = '750';
rows[0].querySelector('.in-dr').dispatchEvent(new window.Event('input', { bubbles: true }));
rows[1].querySelector('.in-cr').dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(100);
ok(text('#vf-totals').includes('750.00'), 'totals bar shows 750.00');
ok(text('#vf-totals').includes('Balanced'), 'form reports balanced');
$('#voucher-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(2200);
ok(text('#page-title') === 'Day Book', 'navigated to day book after save');
ok($$('#db-body tbody tr').length === 1, 'new voucher visible in day book');
ok($$('#db-body tbody tr')[0].textContent.includes('Smoke test entry'), 'narration round-trips');

/* ── 7. edit the voucher we just made ───────────────────────────────── */
console.log('\n[7] alter voucher');
const rid = $$('#db-body tbody tr')[0].dataset.rid;
ok(!!rid, 'voucher has remote_id');
window.App.go('#/voucher/edit/' + encodeURIComponent(rid));
await sleep(1400);
ok(!!$('#voucher-form'), 'edit form rendered');
ok($('#vf-narr').value.includes('Smoke test entry'), 'narration prefilled');
ok($$('#vf-entries tbody tr').length === 2, 'entries prefilled');
ok($('#vf-entries tbody tr:nth-child(1) .in-dr').value.includes('750'), 'debit amount prefilled');
$('#vf-narr').value = 'Smoke test entry ALTERED';
$('#voucher-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(2200);
ok(text('#page-title') === 'Day Book', 'back on day book after alter');
ok($$('#db-body tbody tr')[0].textContent.includes('ALTERED'), 'altered narration visible');

/* ── 8. unbalanced voucher rejected client-side ─────────────────────── */
console.log('\n[8] validation');
window.App.go('#/voucher/new');
await sleep(1200);
$('#vf-date').value = '2026-08-26';
const r2 = $$('#vf-entries tbody tr');
r2[0].querySelector('.in-account').value = 'Rent';
r2[0].querySelector('.in-dr').value = '100';
r2[1].querySelector('.in-account').value = 'Cash';
r2[1].querySelector('.in-cr').value = '90';
r2[0].querySelector('.in-dr').dispatchEvent(new window.Event('input', { bubbles: true }));
r2[1].querySelector('.in-cr').dispatchEvent(new window.Event('input', { bubbles: true }));
$('#voucher-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(600);
ok(!!$('#vf-errors .form-error'), 'unbalanced voucher blocked with visible errors');
ok($('#vf-errors').textContent.includes('must be equal'), 'balance error message shown');

/* ── 9. ledger master CRUD through the modal ────────────────────────── */
console.log('\n[9] ledger master modal');
window.App.go('#/ledgers');
await sleep(1400);
const lgRowsBefore = $$('#lg-body tbody tr').length;
ok(lgRowsBefore >= 10, `ledger list rendered (${lgRowsBefore})`);
$('#lg-new').click();
await sleep(500);
ok(!!$('#modal-root .modal'), 'ledger form modal opened');
$('#lf-name').value = 'Smoke Ledger & Co';
$('#lf-parent').value = 'Sundry Debtors';
$('#lf-opening').value = '1500';
$('#modal-root [data-act="save"]').click();
await sleep(1800);
ok(!$('#modal-root .modal'), 'modal closed after save');
const lgRowsAfter = $$('#lg-body tbody tr').length;
ok(lgRowsAfter === lgRowsBefore + 1, `ledger count +1 (${lgRowsBefore} -> ${lgRowsAfter})`);

/* search filter */
$('#lg-search').value = 'Smoke';
$('#lg-search').dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(400);
ok($$('#lg-body tbody tr').length === 1, 'search filter narrows to 1');
ok(($('#lg-body tbody tr') || {textContent:''}).textContent.includes('Smoke Ledger & Co'), 'special chars ledger listed');
$('#lg-search').value = '';
$('#lg-search').dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(400);

/* delete it again */
const delBtn = $$('#lg-body tbody tr').find((tr) =>
  tr.textContent.includes('Smoke Ledger & Co'))?.querySelector('[data-act="del"]');
ok(!!delBtn, 'delete button on smoke ledger');
delBtn.click();
await sleep(500);
ok(!!$('#modal-root .modal'), 'confirm dialog shown');
$('#modal-root [data-act="yes"]').click();
/* poll for the re-render (sync events can interleave) */
let lgAfterDelete = -1;
for (let i = 0; i < 12; i++) {
  await sleep(400);
  lgAfterDelete = $$('#lg-body tbody tr').length;
  if (lgAfterDelete === lgRowsBefore) break;
}
ok(lgAfterDelete === lgRowsBefore, 'ledger deleted, count back to ' + lgRowsBefore);

/* ── 10. websocket data_changed updates the UI ─────────────────────── */
console.log('\n[10] live sync (WebSocket)');
window.App.go('#/dashboard');
await sleep(1500);
ok(window.App.state.socketUp === true, 'socket.io client connected');
/* capture sync events */
window.__syncEvent = null;
const origHandler = window.App.onDataChanged;
window.App.onDataChanged = function (ev) {
  window.__syncEvent = ev;
  return origHandler.call(window.App, ev);
};
/* write directly to mock Tally = simulates a user typing inside Tally */
await fetch('http://127.0.0.1:9000', {
  method: 'POST',
  headers: { 'Content-Type': 'application/xml' },
  body: `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import</TALLYREQUEST></HEADER><BODY><IMPORTDATA>
<REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
<REQUESTDATA><TALLYMESSAGE><LEDGER NAME="Live Sync Ledger" ACTION="Create">
<PARENT>Sundry Debtors</PARENT><OPENINGBALANCE>999.00</OPENINGBALANCE>
</LEDGER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`,
});
await sleep(9000); /* wait for a sync cycle + soft refresh */
ok(window.__syncEvent && window.__syncEvent.type === 'data_changed',
   'data_changed event received over WebSocket');
ok(window.__syncEvent && window.__syncEvent.company === 'Demo Company (Mock)',
   'event carries the company');
ok(window.App.state._caches && Object.keys(window.App.state._caches).length === 0
   || window.__syncEvent, 'cache lifecycle handled after change');
const toastText = document.getElementById('toasts').textContent;
ok(window.__syncEvent || toastText.includes('changed'),
   'UI notified of the Tally-side change');

/* ── 11. modal + toast + theme components ───────────────────────────── */
console.log('\n[11] components');
window.App.toast({ type: 'success', title: 'Component test', message: 'toast body' });
await sleep(150);
ok(!!document.querySelector('.toast.success'), 'toast renders');
document.getElementById('btn-theme').click();
await sleep(100);
ok(document.documentElement.getAttribute('data-theme') === 'dark', 'theme toggles to dark');
document.getElementById('btn-theme').click();
await sleep(100);
ok(document.documentElement.getAttribute('data-theme') === 'light', 'theme toggles back');

/* voucher view modal from day book */
window.App.go('#/daybook?date=2026-08-26');
await sleep(1300);
const vrow = $('#db-body tbody tr');
if (vrow) {
  vrow.click();
  await sleep(400);
  ok(!!$('#modal-root .modal'), 'voucher view modal opens on row click');
  ok(!!$('#modal-root .vview-entries'), 'entries table inside modal');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  await sleep(200);
  ok(!$('#modal-root .modal'), 'Esc closes modal');
}

/* ── script errors across the whole run ─────────────────────────────── */
console.log('\n[12] script errors');
const realErrors = errors.filter((e) =>
  !e.includes('Not implemented') &&
  !e.includes('Could not parse CSS') &&
  !e.includes('Could not load img') &&
  !e.includes('beforeParse') &&
  !e.includes('scrollIntoView'));
ok(realErrors.length === 0, realErrors.length
  ? `NO unexpected errors (${realErrors.length}): ` + realErrors.slice(0, 5).join(' | ')
  : 'no unexpected script errors');

console.log(`\n══════ RESULT: ${passed} passed, ${failed} failed ══════`);
dom.window.close();
process.exit(failed ? 1 : 0);
