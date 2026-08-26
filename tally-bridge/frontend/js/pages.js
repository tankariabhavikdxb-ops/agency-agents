/* ═══════════════════════════════════════════════════════════════════════════
   pages.js — page renderers (routes)
   dashboard · day book · voucher register · masters (ledgers, groups,
   stock items, more) · ledger drill-down · reports · configuration
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* ══════════ 31. DASHBOARD ══════════ */
App.registerRoute('dashboard', async (route, container) => {
  App.setContentLoading('Dashboard', App.state.company);
  const res = await API.dashboard(App.state.company);
  const d = res.data;
  const fy = U.fyRange();

  App.setPage('Dashboard', `${App.state.company} · ${fy.label}`);

  const stats = [
    { ic: 'i-users', cls: 'c1', label: 'Ledgers', value: d.ledger_count,
      sub: 'accounts in books' },
    { ic: 'i-receipt', cls: 'c3', label: 'Vouchers (FY)', value: d.voucher_count_fy,
      sub: fy.label },
    { ic: 'i-cal', cls: 'c4', label: 'Vouchers today', value: d.vouchers_today,
      sub: U.fmtDate(U.isoToTally(U.todayISO())) },
    { ic: 'i-chart', cls: 'c2', label: 'Trial balance', value: U.fmtAmt(d.trial_balance_total),
      sub: Math.abs(d.difference) < 0.005 ? 'balanced ✓' : `differs by ${U.fmtAmt(d.difference)}` },
  ];

  container.innerHTML = `
    <div class="stat-grid">
      ${stats.map((s) => `
        <div class="stat">
          <div class="stat-ic ${s.cls}"><svg class="ic ic-lg"><use href="#${s.ic}"/></svg></div>
          <div><div class="stat-label">${s.label}</div>
            <div class="stat-value">${U.esc(String(s.value))}</div>
            <div class="stat-sub">${U.esc(s.sub)}</div></div>
        </div>`).join('')}
    </div>

    <div class="cols-2">
      <div class="card">
        <div class="card-head">
          <span class="card-title"><svg class="ic"><use href="#i-receipt"/></svg>Recent vouchers</span>
          <span class="spacer"></span>
          <a href="#/vouchers" class="btn btn-sm btn-ghost">View all
            <svg class="ic ic-sm"><use href="#i-arrow-r"/></svg></a>
        </div>
        <div class="card-body p0" id="dash-recent"></div>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="card-title"><svg class="ic"><use href="#i-users"/></svg>Top parties</span>
        </div>
        <div class="card-body p0" id="dash-parties"></div>
      </div>
    </div>`;

  /* recent vouchers */
  const recentBox = container.querySelector('#dash-recent');
  if ((d.recent_vouchers || []).length) {
    Voucher.remember(d.recent_vouchers);
    recentBox.innerHTML = `
      <div class="tbl-wrap"><table class="tbl" id="dash-recent-tbl">
        <thead><tr><th>Date</th><th>Type</th><th>No</th><th>Party</th>
          <th class="num">Amount</th></tr></thead>
        <tbody>${d.recent_vouchers.map((v) => Voucher.rowHtml(v)).join('')}</tbody>
      </table></div>`;
    Voucher.bindRowEvents(recentBox.querySelector('#dash-recent-tbl'));
  } else {
    recentBox.appendChild(App.emptyState({
      icon: 'i-receipt', title: 'No vouchers yet',
      text: 'Create your first voucher — it will appear in Tally instantly.',
      actionLabel: 'Create voucher', onAction: () => App.go('#/voucher/new'),
    }));
  }

  /* top parties */
  const partyBox = container.querySelector('#dash-parties');
  if ((d.top_parties || []).length) {
    partyBox.innerHTML = d.top_parties.map((p) => `
      <div class="party-row">
        <div class="avatar">${U.esc(U.initials(p.name))}</div>
        <div class="grow"><div class="pr-name">${U.esc(p.name)}</div>
          <div class="pr-sub">party balance</div></div>
        <div class="pr-amt">${U.fmtAmt(p.balance)}</div>
      </div>`).join('');
  } else {
    partyBox.appendChild(App.emptyState({
      icon: 'i-users', title: 'No party balances',
      text: 'Sundry debtors and creditors with balances will show up here.',
    }));
  }
});


/* ══════════ DAY BOOK ══════════ */
App.registerRoute('daybook', async (route, container) => {
  const date = route.query.date || U.todayISO();
  App.setContentLoading('Day Book', U.fmtDate(U.isoToTally(date)));
  const [res, types] = await Promise.all([
    API.dayBook(App.state.company, date),
    App.getVoucherTypes(),
  ]);
  const typeNames = (types.length ? types.map((t) => t.name) : Voucher.FALLBACK_TYPES).filter(Boolean);
  const data = res.data;
  const vouchers = data.vouchers || [];
  Voucher.remember(vouchers);

  App.setPage('Day Book', `${U.fmtDate(U.isoToTally(date))} · ${U.plural(data.total || 0, 'voucher')}`);

  const totalAmount = vouchers.reduce(
    (s, v) => s + Math.abs(U.parseAmt(v.amount)), 0);

  container.innerHTML = `
    <div class="card">
      <div class="table-toolbar">
        <div class="field" style="flex:0 0 auto">
          <label class="label">Date</label>
          <input class="input" type="date" id="db-date" value="${U.esc(date)}" style="width:160px">
        </div>
        <div class="field" style="flex:0 0 auto">
          <label class="label">Voucher type</label>
          <select class="select" id="db-type">
            <option value="">All types</option>
            ${typeNames.map((t) => `<option ${route.query.type === t ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}
          </select>
        </div>
        <div class="spacer"></div>
        <a href="#/voucher/new" class="btn btn-primary btn-sm">
          <svg class="ic ic-sm"><use href="#i-plus"/></svg> New voucher</a>
      </div>
      <div class="tbl-wrap" id="db-body"></div>
      ${vouchers.length ? `
        <div class="pagination">
          <span class="muted">Day total</span>
          <b class="mono">${U.fmtAmt(totalAmount)}</b>
        </div>` : ''}
    </div>`;

  const renderList = (list) => {
    const body = container.querySelector('#db-body');
    if (!list.length) {
      body.appendChild(App.emptyState({
        icon: 'i-book', title: 'No vouchers on this date',
        text: `Nothing was recorded on ${U.fmtDate(U.isoToTally(date))}. Pick another date or create a voucher.`,
        actionLabel: 'Create voucher', onAction: () => App.go('#/voucher/new'),
      }));
      return;
    }
    body.innerHTML = `
      <table class="tbl" id="db-tbl">
        <thead><tr><th>Date</th><th>Type</th><th>No</th><th>Party / narration</th>
          <th class="num">Amount</th><th class="actions" style="width:86px"></th></tr></thead>
        <tbody>${list.map((v) => Voucher.rowHtml(v)).join('')}</tbody>
      </table>`;
    Voucher.bindRowEvents(body.querySelector('#db-tbl'));
  };

  const applyFilters = () => {
    const t = container.querySelector('#db-type').value;
    const list = t ? vouchers.filter((v) => v.voucher_type === t) : vouchers;
    App.setPage('Day Book', `${U.fmtDate(U.isoToTally(date))} · ${U.plural(list.length, 'voucher')}`);
    renderList(list);
  };

  container.querySelector('#db-date').onchange = (e) => {
    App.go(`#/daybook?date=${encodeURIComponent(e.target.value)}`);
  };
  container.querySelector('#db-type').onchange = applyFilters;
  applyFilters();
});


/* ══════════ VOUCHER REGISTER ══════════ */
App.registerRoute('vouchers', async (route, container) => {
  const fy = U.fyRange();
  const f = App.state.voucherFilters || {};
  const page = parseInt(route.query.page || '1', 10);
  const params = {
    from_date: f.from || fy.from, to_date: f.to || fy.to,
    type: route.query.type || f.type || '',
    page, page_size: 25,
  };

  App.setContentLoading('Voucher Register', `${fy.label} · page ${page}`);
  const [res, types] = await Promise.all([
    API.vouchers(App.state.company, params),
    App.getVoucherTypes(),
  ]);
  const data = res.data;
  const typeNames = (types.length ? types.map((t) => t.name) : Voucher.FALLBACK_TYPES).filter(Boolean);
  Voucher.remember(data.vouchers || []);

  App.setPage('Voucher Register',
    `${U.fmtDate(data.from_date)} – ${U.fmtDate(data.to_date)} · ${U.plural(data.total, 'voucher')}`);

  const qs2 = (over = {}) => {
    const merged = { ...params, ...over };
    const q = new URLSearchParams();
    if (merged.from_date !== fy.from) q.set('from_date', merged.from_date);
    if (merged.to_date !== fy.to) q.set('to_date', merged.to_date);
    if (merged.type) q.set('type', merged.type);
    if (merged.page > 1) q.set('page', String(merged.page));
    const s = q.toString();
    return '#/vouchers' + (s ? '?' + s : '');
  };

  container.innerHTML = `
    <div class="card">
      <div class="table-toolbar">
        <div class="field" style="flex:0 0 auto">
          <label class="label">From</label>
          <input class="input" type="date" id="vr-from" value="${U.esc(params.from_date)}" style="width:150px">
        </div>
        <div class="field" style="flex:0 0 auto">
          <label class="label">To</label>
          <input class="input" type="date" id="vr-to" value="${U.esc(params.to_date)}" style="width:150px">
        </div>
        <div class="field" style="flex:0 0 auto">
          <label class="label">Type</label>
          <select class="select" id="vr-type">
            <option value="">All types</option>
            ${typeNames.map((t) => `<option ${params.type === t ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}
          </select>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="vr-export">
          <svg class="ic ic-sm"><use href="#i-download"/></svg> Export CSV</button>
        <a href="#/voucher/new" class="btn btn-primary btn-sm">
          <svg class="ic ic-sm"><use href="#i-plus"/></svg> New voucher</a>
      </div>
      <div class="tbl-wrap" id="vr-body"></div>
      <div class="pagination" id="vr-pag"></div>
    </div>`;

  const body = container.querySelector('#vr-body');
  const vouchers = data.vouchers || [];
  if (!vouchers.length) {
    body.appendChild(App.emptyState({
      icon: 'i-receipt', title: 'No vouchers found',
      text: 'No vouchers match the selected period and type.',
      actionLabel: 'Create voucher', onAction: () => App.go('#/voucher/new'),
    }));
  } else {
    body.innerHTML = `
      <table class="tbl" id="vr-tbl">
        <thead><tr><th>Date</th><th>Type</th><th>No</th><th>Party / narration</th>
          <th class="num">Amount</th><th class="actions" style="width:86px"></th></tr></thead>
        <tbody>${vouchers.map((v) => Voucher.rowHtml(v)).join('')}</tbody>
      </table>`;
    Voucher.bindRowEvents(body.querySelector('#vr-tbl'));
  }

  /* pagination */
  const pag = container.querySelector('#vr-pag');
  const start = data.total ? (page - 1) * data.page_size + 1 : 0;
  const end = Math.min(page * data.page_size, data.total);
  pag.innerHTML = `
    <span>${data.total ? `${start}–${end} of ${data.total}` : '0 results'}</span>
    <span class="spacer" style="flex:1"></span>
    <button class="btn btn-sm" id="vr-prev" ${page <= 1 ? 'disabled' : ''}>
      <svg class="ic ic-sm"><use href="#i-chev-l"/></svg> Prev</button>
    <span class="pages">Page ${data.page} / ${Math.max(1, data.total_pages)}</span>
    <button class="btn btn-sm" id="vr-next" ${page >= data.total_pages ? 'disabled' : ''}>
      Next <svg class="ic ic-sm"><use href="#i-chev-r"/></svg></button>`;
  const prev = pag.querySelector('#vr-prev');
  const next = pag.querySelector('#vr-next');
  if (prev) prev.onclick = () => App.go(qs2({ page: page - 1 }));
  if (next) next.onclick = () => App.go(qs2({ page: page + 1 }));

  /* filters */
  const applyFilter = () => {
    App.state.voucherFilters = {
      from: container.querySelector('#vr-from').value,
      to: container.querySelector('#vr-to').value,
      type: container.querySelector('#vr-type').value,
    };
    App.go('#/vouchers');
  };
  container.querySelector('#vr-from').onchange = applyFilter;
  container.querySelector('#vr-to').onchange = applyFilter;
  container.querySelector('#vr-type').onchange = applyFilter;

  container.querySelector('#vr-export').onclick = () => {
    U.downloadCSV(`vouchers-${params.from_date}-to-${params.to_date}.csv`, [
      ['Date', 'Type', 'Voucher No', 'Party', 'Reference', 'Narration', 'Amount'],
      ...vouchers.map((v) => [
        U.fmtDate(v.date), v.voucher_type, v.voucher_number || '',
        v.party_ledger || '', v.reference || '', v.narration || '',
        Math.abs(U.parseAmt(v.amount)),
      ]),
    ]);
  };
});


/* ══════════ LEDGERS (list + CRUD) ══════════ */
async function renderLedgersList(route, container) {
  App.setContentLoading('Ledgers', App.state.company);
  const [ledgers, groups] = await Promise.all([App.getLedgers(), App.getGroups()]);
  const parents = [...new Set(groups.map((g) => g.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  App.setPage('Ledgers', `${App.state.company} · ${U.plural(ledgers.length, 'ledger')}`);

  container.innerHTML = `
    <div class="card">
      <div class="table-toolbar">
        <input class="input search" id="lg-search" placeholder="Search ledgers…">
        <select class="select" id="lg-parent">
          <option value="">All groups</option>
          ${parents.map((p) => `<option>${U.esc(p)}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="lg-new">
          <svg class="ic ic-sm"><use href="#i-plus"/></svg> New ledger</button>
      </div>
      <div class="tbl-wrap" id="lg-body"></div>
    </div>`;

  const body = container.querySelector('#lg-body');

  /* force-refetch and re-render in place (keeps search/filter state) */
  const rerender = async () => {
    const fresh = await App.getLedgers(true);
    ledgers.splice(0, ledgers.length, ...fresh);
    renderList();
  };

  const renderList = () => {
    const q = container.querySelector('#lg-search').value.trim().toLowerCase();
    const parent = container.querySelector('#lg-parent').value;
    const list = ledgers.filter((l) =>
      (!q || l.name.toLowerCase().includes(q)
        || (l.parent || '').toLowerCase().includes(q))
      && (!parent || l.parent === parent));

    if (!list.length) {
      body.innerHTML = '';
      body.appendChild(App.emptyState({
        icon: 'i-users', title: q || parent ? 'No matching ledgers' : 'No ledgers yet',
        text: q || parent ? 'Try a different search or group filter.'
          : 'Create your first ledger — it will appear in Tally instantly.',
        actionLabel: q || parent ? '' : 'New ledger',
        onAction: () => LedgerForm.open(null, rerender),
      }));
      return;
    }

    body.innerHTML = `
      <table class="tbl" id="lg-tbl">
        <thead><tr><th>Name</th><th>Group</th>
          <th class="num" style="width:130px">Opening</th>
          <th class="num" style="width:140px">Closing</th>
          <th class="actions" style="width:86px"></th></tr></thead>
        <tbody>
          ${list.map((l) => `
            <tr class="clickable" data-name="${U.esc(l.name)}">
              <td><div class="cell-main">${U.esc(l.name)}</div>
                ${l.email || l.phone ? `<div class="cell-sub">${U.esc(l.phone || '')}${l.phone && l.email ? ' · ' : ''}${U.esc(l.email || '')}</div>` : ''}</td>
              <td><span class="badge">${U.esc(l.parent || '—')}</span></td>
              <td class="num">${l.opening_balance ? U.fmtBal(l.opening_balance) : '—'}</td>
              <td class="num">${l.closing_balance ? U.fmtBal(l.closing_balance) : '—'}</td>
              <td class="actions">
                <button class="iconbtn sm primary" data-act="edit" title="Alter ledger">
                  <svg class="ic ic-sm"><use href="#i-edit"/></svg></button>
                <button class="iconbtn sm danger" data-act="del" title="Delete ledger">
                  <svg class="ic ic-sm"><use href="#i-trash"/></svg></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    body.querySelector('#lg-tbl').addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-name]');
      if (!tr) return;
      const name = tr.dataset.name;
      const ledger = ledgers.find((l) => l.name === name);
      if (!ledger) return;
      if (e.target.closest('[data-act="edit"]')) {
        LedgerForm.open(ledger, rerender);
      } else if (e.target.closest('[data-act="del"]')) {
        const ok = await App.modal.confirm({
          title: 'Delete ledger?',
          message: `<b>${U.esc(name)}</b> will be deleted from Tally. Tally refuses to
                    delete ledgers that are used in vouchers or are predefined.`,
          confirmText: 'Delete', danger: true,
        });
        if (!ok) return;
        try {
          const res = await API.deleteLedger(App.state.company, name);
          if (res.success) {
            App.invalidateCaches();
            App.toast({ type: 'success', title: 'Ledger deleted', message: name });
            App.renderRoute();
          } else {
            App.toast({ type: 'error', title: 'Tally refused',
                        message: (res.errors || []).join('; ') });
          }
        } catch (err) { App.toastError(err, 'Delete failed'); }
      } else {
        App.go(`#/ledgers/${encodeURIComponent(name)}`);
      }
    });
  };

  container.querySelector('#lg-search').oninput = U.debounce(renderList, 180);
  container.querySelector('#lg-parent').onchange = renderList;
  container.querySelector('#lg-new').onclick = () => LedgerForm.open(null, rerender);
  renderList();
}

/* ledger create/alter form modal */
const LedgerForm = {
  async open(ledger, onDone) {
    const groups = await App.getGroups();
    const parents = [...new Set(groups.map((g) => g.name).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    if (!parents.includes('Sundry Debtors')) parents.unshift('Sundry Debtors');
    const isEdit = !!ledger;

    const f = ledger || {};
    const footer = U.el(`
      <div>
        <button class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button class="btn btn-primary" data-act="save">
          <svg class="ic ic-sm"><use href="#i-check"/></svg>
          ${isEdit ? 'Save changes' : 'Create ledger'}</button>
      </div>`);

    const m = App.modal.open({
      title: isEdit
        ? `<svg class="ic ic-sm" style="vertical-align:-2px"><use href="#i-edit"/></svg> Alter ledger — ${U.esc(f.name)}`
        : '<svg class="ic ic-sm" style="vertical-align:-2px"><use href="#i-plus"/></svg> New ledger',
      size: 'lg',
      body: `
        <div class="field-row">
          <div class="field">
            <label class="label">Name <span class="req">*</span></label>
            <input class="input" id="lf-name" value="${U.esc(f.name || '')}"
              ${isEdit ? 'readonly title="Tally identifies masters by name"' : ''}
              placeholder="e.g. Ramesh &amp; Sons">
          </div>
          <div class="field">
            <label class="label">Under group</label>
            <select class="select" id="lf-parent">
              ${parents.map((p) => `<option ${f.parent === p ? 'selected' : ''}>${U.esc(p)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="label">Opening balance</label>
            <input class="input num" id="lf-opening" value="${U.esc(f.opening_balance || '')}" placeholder="0.00">
          </div>
        </div>
        <div class="field-row mt-2">
          <div class="field"><label class="label">Mailing name</label>
            <input class="input" id="lf-mailing" value="${U.esc(f.mailing_name || '')}"></div>
          <div class="field"><label class="label">Phone</label>
            <input class="input" id="lf-phone" value="${U.esc(f.phone || '')}"></div>
          <div class="field"><label class="label">Email</label>
            <input class="input" id="lf-email" value="${U.esc(f.email || '')}"></div>
        </div>
        <div class="field mt-2"><label class="label">Address</label>
          <textarea class="textarea" id="lf-address" rows="2">${U.esc(f.address || '')}</textarea></div>
        <div class="field-row mt-2">
          <div class="field"><label class="label">State</label>
            <input class="input" id="lf-state" value="${U.esc(f.state || '')}"></div>
          <div class="field"><label class="label">PIN code</label>
            <input class="input" id="lf-pincode" value="${U.esc(f.pincode || '')}"></div>
          <div class="field"><label class="label">GSTIN</label>
            <input class="input" id="lf-gst" value="${U.esc(f.gst_number || '')}"></div>
          <div class="field"><label class="label">PAN / IT no.</label>
            <input class="input" id="lf-pan" value="${U.esc(f.pan_it || '')}"></div>
        </div>
        <div class="field-row mt-2">
          <div class="field"><label class="label">Credit period (days)</label>
            <input class="input num" id="lf-credit-period" value="${U.esc(f.credit_period || '')}"></div>
          <div class="field"><label class="label">Credit limit</label>
            <input class="input num" id="lf-credit-limit" value="${U.esc(f.credit_limit || '')}"></div>
          <div class="field" style="justify-content:flex-end">
            <label class="check"><input type="checkbox" id="lf-billwise" ${f.bill_by_bill ? 'checked' : ''}>
              Maintain balances bill-by-bill</label>
          </div>
        </div>
        <div class="hint mt-2">Empty fields are left untouched in Tally on alter.</div>`,
      footer,
    });

    footer.querySelector('[data-act="cancel"]').onclick = () => App.modal.close();
    footer.querySelector('[data-act="save"]').onclick = async (e) => {
      const btn = e.currentTarget;
      const name = m.body.querySelector('#lf-name').value.trim();
      if (!name) {
        App.toast({ type: 'warn', title: 'Name required', message: 'Give the ledger a name.' });
        return;
      }
      const val = (id) => m.body.querySelector(id).value.trim();
      const payload = {
        name,
        parent: val('#lf-parent'),
        opening_balance: val('#lf-opening'),
        mailing_name: val('#lf-mailing'),
        phone: val('#lf-phone'),
        email: val('#lf-email'),
        address: val('#lf-address'),
        state: val('#lf-state'),
        pincode: val('#lf-pincode'),
        gst_number: val('#lf-gst'),
        pan_it: val('#lf-pan'),
        credit_period: val('#lf-credit-period'),
        credit_limit: val('#lf-credit-limit'),
        bill_by_bill: m.body.querySelector('#lf-billwise').checked,
      };
      btn.disabled = true;
      try {
        const res = isEdit
          ? await API.alterLedger(App.state.company, ledger.name, payload)
          : await API.createLedger(App.state.company, payload);
        if (res.success) {
          App.invalidateCaches();
          App.modal.close();
          App.toast({ type: 'success', title: isEdit ? 'Ledger altered' : 'Ledger created',
                      message: name });
          if (onDone) onDone(); else App.renderRoute();
        } else {
          App.toast({ type: 'error', title: 'Tally refused',
                      message: (res.errors || []).join('; ') });
        }
      } catch (err) {
        App.toastError(err, isEdit ? 'Alter failed' : 'Create failed');
      } finally { btn.disabled = false; }
    };
    m.body.querySelector('#lf-name').focus();
  },
};
window.LedgerForm = LedgerForm;


/* ══════════ LEDGER DRILL-DOWN ══════════ */
async function renderLedgerDetail(name, container) {
  App.setContentLoading('Ledger', name);
  const [ledgers, fy] = [await App.getLedgers(), U.fyRange()];
  const ledger = ledgers.find((l) => l.name === name);
  if (!ledger) {
    container.innerHTML = '';
    container.appendChild(App.emptyState({
      icon: 'i-users', title: 'Ledger not found',
      text: `"${name}" is not among the ledgers of ${App.state.company}.`,
      actionLabel: 'Back to ledgers', onAction: () => App.go('#/ledgers'),
    }));
    return;
  }
  const res = await API.ledgerVouchers(App.state.company, name,
    { from_date: fy.from, to_date: fy.to });
  const vouchers = res.data || [];
  Voucher.remember(vouchers);

  App.setPage(ledger.name, `Ledger · ${ledger.parent || '—'} · ${U.plural(vouchers.length, 'voucher')} in ${fy.label}`);

  const kvs = [
    ['Group', ledger.parent], ['Mailing name', ledger.mailing_name],
    ['Address', ledger.address], ['Phone', ledger.phone], ['Email', ledger.email],
    ['State', ledger.state], ['PIN', ledger.pincode], ['GSTIN', ledger.gst_number],
    ['PAN / IT', ledger.pan_it], ['Credit period', ledger.credit_period],
    ['Credit limit', ledger.credit_limit], ['Bank a/c', ledger.bank_account],
    ['IFSC', ledger.ifsc],
  ].filter(([, v]) => v);

  container.innerHTML = `
    <div class="card mb-2">
      <div class="card-body">
        <div class="ledger-head">
          <div class="avatar">${U.esc(U.initials(ledger.name))}</div>
          <div class="grow">
            <h2 style="font-size:1.15rem">${U.esc(ledger.name)}</h2>
            <div class="muted small">${U.esc(ledger.parent || '')}</div>
          </div>
          <div class="bal-chip">
            <div class="bv ${U.balIsDebit(ledger.closing_balance) ? '' : 'pos'}">
              ${ledger.closing_balance ? U.fmtBal(ledger.closing_balance) : '—'}</div>
            <div class="bl">Closing balance</div>
          </div>
          <button class="btn" id="ld-edit">
            <svg class="ic ic-sm"><use href="#i-edit"/></svg> Alter</button>
        </div>
        ${kvs.length ? `
          <hr class="divider">
          <div class="kv-grid">
            ${kvs.map(([k, v]) => `<div class="kv"><div class="k">${U.esc(k)}</div>
              <div class="v">${U.esc(v)}</div></div>`).join('')}
          </div>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <span class="card-title"><svg class="ic"><use href="#i-receipt"/></svg>
          Vouchers — ${fy.label}</span>
        <span class="spacer"></span>
        <a href="#/ledgers" class="btn btn-sm btn-ghost">
          <svg class="ic ic-sm"><use href="#i-chev-l"/></svg> All ledgers</a>
      </div>
      <div class="tbl-wrap" id="ld-body"></div>
    </div>`;

  container.querySelector('#ld-edit').onclick = () =>
    LedgerForm.open(ledger, () => renderLedgerDetail(name, container));

  const body = container.querySelector('#ld-body');
  if (!vouchers.length) {
    body.appendChild(App.emptyState({
      icon: 'i-receipt', title: 'No vouchers in this period',
      text: `No vouchers touch ${name} between ${U.fmtDate(fy.from)} and ${U.fmtDate(fy.to)}.`,
    }));
  } else {
    body.innerHTML = `
      <table class="tbl" id="ld-tbl">
        <thead><tr><th>Date</th><th>Type</th><th>No</th><th>Party / narration</th>
          <th class="num">Amount</th><th class="actions" style="width:86px"></th></tr></thead>
        <tbody>${vouchers.map((v) => Voucher.rowHtml(v)).join('')}</tbody>
      </table>`;
    Voucher.bindRowEvents(body.querySelector('#ld-tbl'));
  }
}

/* single 'ledgers' route: list at #/ledgers, drill-down at #/ledgers/:name */
App.registerRoute('ledgers', async (route, container) => {
  if (route.sub) {
    await renderLedgerDetail(route.sub, container);
    return;
  }
  await renderLedgersList(route, container);
});


/* ══════════ GROUPS ══════════ */
App.registerRoute('groups', async (route, container) => {
  App.setContentLoading('Groups', App.state.company);
  const groups = await App.getGroups();

  /* build indent depth from parent chains */
  const byName = {};
  groups.forEach((g) => { byName[g.name] = g; });
  const depth = (g, seen = new Set()) => {
    if (!g.parent || !byName[g.parent] || seen.has(g.name)) return 0;
    seen.add(g.name);
    return 1 + depth(byName[g.parent], seen);
  };
  const list = [...groups].sort((a, b) =>
    (a.parent || '').localeCompare(b.parent || '') || a.name.localeCompare(b.name));

  App.setPage('Groups', `${App.state.company} · ${U.plural(groups.length, 'group')}`);

  container.innerHTML = `
    <div class="card">
      <div class="table-toolbar">
        <input class="input search" id="gr-search" placeholder="Search groups…" style="max-width:280px">
        <div class="spacer"></div>
        <span class="badge badge-info">Predefined + custom groups</span>
      </div>
      <div class="tbl-wrap" id="gr-body"></div>
    </div>`;

  const renderList = () => {
    const q = container.querySelector('#gr-search').value.trim().toLowerCase();
    const filtered = list.filter((g) => !q || g.name.toLowerCase().includes(q)
      || (g.parent || '').toLowerCase().includes(q));
    container.querySelector('#gr-body').innerHTML = `
      <table class="tbl">
        <thead><tr><th style="width:34px"></th><th>Group</th><th>Under</th>
          <th class="num" style="width:140px">Closing</th></tr></thead>
        <tbody>
          ${filtered.map((g) => `
            <tr>
              <td class="tree-indent">${'·'.repeat(depth(g) + 1)}</td>
              <td class="tree-row-main">${U.esc(g.name)}</td>
              <td><span class="badge">${U.esc(g.parent || 'Primary')}</span></td>
              <td class="num">${g.closing_balance ? U.fmtBal(g.closing_balance) : '—'}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="empty-cell">No groups match.</td></tr>'}
        </tbody>
      </table>`;
  };
  container.querySelector('#gr-search').oninput = U.debounce(renderList, 180);
  renderList();
});


/* ══════════ STOCK ITEMS (list + CRUD) ══════════ */
App.registerRoute('stock-items', async (route, container) => {
  App.setContentLoading('Stock Items', App.state.company);
  const [items, sgroups, units] = await Promise.all([
    App.getStockItems(), App.cachedFetch('stock-groups',
      async () => (await API.stockGroups(App.state.company)).data), App.getUnits()]);

  App.setPage('Stock Items', `${App.state.company} · ${U.plural(items.length, 'item')}`);

  container.innerHTML = `
    <div class="card">
      <div class="table-toolbar">
        <input class="input search" id="si-search" placeholder="Search items…">
        <div class="spacer"></div>
        <button class="btn btn-primary btn-sm" id="si-new">
          <svg class="ic ic-sm"><use href="#i-plus"/></svg> New stock item</button>
      </div>
      <div class="tbl-wrap" id="si-body"></div>
    </div>`;

  const body = container.querySelector('#si-body');
  const rerender = async () => {
    const fresh = await App.getStockItems(true);
    items.splice(0, items.length, ...fresh);
    renderList();
  };
  const renderList = () => {
    const q = container.querySelector('#si-search').value.trim().toLowerCase();
    const list = items.filter((i) => !q || i.name.toLowerCase().includes(q)
      || (i.parent || '').toLowerCase().includes(q));
    if (!list.length) {
      body.innerHTML = '';
      body.appendChild(App.emptyState({
        icon: 'i-box', title: q ? 'No matching items' : 'No stock items yet',
        text: q ? 'Try another search.' : 'Create your first stock item.',
        actionLabel: q ? '' : 'New stock item',
        onAction: () => ItemForm.open(null, rerender, sgroups, units),
      }));
      return;
    }
    body.innerHTML = `
      <table class="tbl">
        <thead><tr><th>Item</th><th>Group</th><th class="num">Units</th>
          <th class="num" style="width:150px">Closing</th><th class="actions" style="width:86px"></th></tr></thead>
        <tbody>
          ${list.map((i) => `
            <tr>
              <td><div class="cell-main">${U.esc(i.name)}</div>
                ${i.description ? `<div class="cell-sub">${U.esc(U.truncate(i.description, 60))}</div>` : ''}</td>
              <td><span class="badge">${U.esc(i.parent || 'Primary')}</span></td>
              <td class="num">${U.esc(i.units || '—')}</td>
              <td class="num">${i.closing_balance ? U.esc(i.closing_balance) : '—'}</td>
              <td class="actions">
                <button class="iconbtn sm primary" data-name="${U.esc(i.name)}" data-act="edit" title="Alter">
                  <svg class="ic ic-sm"><use href="#i-edit"/></svg></button>
                <button class="iconbtn sm danger" data-name="${U.esc(i.name)}" data-act="del" title="Delete">
                  <svg class="ic ic-sm"><use href="#i-trash"/></svg></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    body.querySelectorAll('[data-act="edit"]').forEach((b) => {
      b.onclick = () => ItemForm.open(items.find((i) => i.name === b.dataset.name),
        rerender, sgroups, units);
    });
    body.querySelectorAll('[data-act="del"]').forEach((b) => {
      b.onclick = async () => {
        const name = b.dataset.name;
        const ok = await App.modal.confirm({
          title: 'Delete stock item?',
          message: `<b>${U.esc(name)}</b> will be deleted from Tally.`,
          confirmText: 'Delete', danger: true,
        });
        if (!ok) return;
        try {
          const res = await API.deleteStockItem(App.state.company, name);
          if (res.success) {
            App.invalidateCaches();
            App.toast({ type: 'success', title: 'Stock item deleted', message: name });
            App.renderRoute();
          } else {
            App.toast({ type: 'error', title: 'Tally refused',
                        message: (res.errors || []).join('; ') });
          }
        } catch (err) { App.toastError(err, 'Delete failed'); }
      };
    });
  };

  container.querySelector('#si-search').oninput = U.debounce(renderList, 180);
  container.querySelector('#si-new').onclick = () => ItemForm.open(null, rerender, sgroups, units);
  renderList();
});

const ItemForm = {
  open(item, onDone, sgroups, units) {
    const isEdit = !!item;
    const groupNames = ['Primary', ...sgroups.map((g) => g.name).filter(Boolean)];
    const unitNames = units.map((u) => u.name).filter(Boolean);

    const footer = U.el(`
      <div>
        <button class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button class="btn btn-primary" data-act="save">
          <svg class="ic ic-sm"><use href="#i-check"/></svg>
          ${isEdit ? 'Save changes' : 'Create item'}</button>
      </div>`);

    const m = App.modal.open({
      title: isEdit
        ? `Alter stock item — ${U.esc(item.name)}`
        : 'New stock item',
      body: `
        <div class="field-row">
          <div class="field"><label class="label">Name <span class="req">*</span></label>
            <input class="input" id="if-name" value="${U.esc(item ? item.name : '')}"></div>
          <div class="field"><label class="label">Under group</label>
            <select class="select" id="if-parent">
              ${groupNames.map((g) => `<option ${item && item.parent === g ? 'selected' : ''}>${U.esc(g)}</option>`).join('')}
            </select></div>
          <div class="field"><label class="label">Units</label>
            <input class="input" id="if-units" list="if-units-dl" value="${U.esc(item ? item.units : '')}" placeholder="e.g. Nos">
            <datalist id="if-units-dl">${unitNames.map((u) => `<option value="${U.esc(u)}">`).join('')}</datalist>
          </div>
          <div class="field"><label class="label">Opening balance</label>
            <input class="input num" id="if-opening" value="${U.esc(item ? item.opening_balance : '')}" placeholder="0.00"></div>
        </div>
        <div class="field mt-2"><label class="label">Description</label>
          <textarea class="textarea" id="if-desc" rows="2">${U.esc(item ? item.description || '' : '')}</textarea></div>`,
      footer,
    });

    footer.querySelector('[data-act="cancel"]').onclick = () => App.modal.close();
    footer.querySelector('[data-act="save"]').onclick = async (e) => {
      const btn = e.currentTarget;
      const name = m.body.querySelector('#if-name').value.trim();
      if (!name) {
        App.toast({ type: 'warn', title: 'Name required' });
        return;
      }
      const payload = {
        name,
        parent: m.body.querySelector('#if-parent').value,
        units: m.body.querySelector('#if-units').value.trim(),
        opening_balance: m.body.querySelector('#if-opening').value.trim(),
        description: m.body.querySelector('#if-desc').value.trim(),
      };
      btn.disabled = true;
      try {
        const res = isEdit
          ? await API.alterStockItem(App.state.company, item.name, payload)
          : await API.createStockItem(App.state.company, payload);
        if (res.success) {
          App.invalidateCaches();
          App.modal.close();
          App.toast({ type: 'success', title: isEdit ? 'Item altered' : 'Item created', message: name });
          if (onDone) onDone(); else App.renderRoute();
        } else {
          App.toast({ type: 'error', title: 'Tally refused',
                      message: (res.errors || []).join('; ') });
        }
      } catch (err) { App.toastError(err, 'Save failed'); }
      finally { btn.disabled = false; }
    };
    m.body.querySelector('#if-name').focus();
  },
};
window.ItemForm = ItemForm;


/* ══════════ MORE MASTERS ══════════ */
App.registerRoute('masters', async (route, container) => {
  const tabs = [
    { id: 'units', label: 'Units', icon: 'i-sliders' },
    { id: 'godowns', label: 'Godowns', icon: 'i-build' },
    { id: 'stock-groups', label: 'Stock Groups', icon: 'i-layers' },
    { id: 'cost-centres', label: 'Cost Centres', icon: 'i-grid' },
    { id: 'cost-categories', label: 'Cost Categories', icon: 'i-grid' },
    { id: 'currencies', label: 'Currencies', icon: 'i-banknote' },
    { id: 'voucher-types', label: 'Voucher Types', icon: 'i-receipt' },
  ];
  const active = route.sub || 'units';

  App.setPage('More Masters', 'Units · godowns · cost centres · currencies · voucher types');

  container.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div class="tabs" id="mm-tabs">
          ${tabs.map((t) => `
            <button class="tab ${t.id === active ? 'active' : ''}" data-tab="${t.id}">
              <svg class="ic"><use href="#${t.icon}"/></svg> ${t.label}</button>`).join('')}
        </div>
      </div>
      <div class="tbl-wrap" id="mm-body">
        <div class="card-body" style="display:flex;align-items:center;gap:14px">
          <div class="spinner"></div> Loading…</div>
      </div>
    </div>`;

  container.querySelector('#mm-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) App.go(`#/masters/${b.dataset.tab}`);
  });

  const body = container.querySelector('#mm-body');
  const c = App.state.company;
  let rows = [];
  switch (active) {
    case 'units':          rows = (await App.getUnits()).map((u) => [u.name, '—']); break;
    case 'godowns':        rows = (await API.godowns(c)).data.map((g) => [g.name, g.parent || 'Primary']); break;
    case 'stock-groups':   rows = (await API.stockGroups(c)).data.map((g) => [g.name, g.parent || 'Primary']); break;
    case 'cost-centres':   rows = (await API.costCentres(c)).data.map((g) => [g.name, g.parent || 'Primary']); break;
    case 'cost-categories':rows = (await API.costCategories(c)).data.map((g) => [g.name, '—']); break;
    case 'currencies':     rows = (await API.currencies(c)).data.map((g) => [g.name, g.symbol || '']); break;
    case 'voucher-types':  rows = (await App.getVoucherTypes()).map((t) => [t.name, t.parent || 'Voucher Types']); break;
    default: rows = [];
  }

  if (!rows.length) {
    body.innerHTML = '';
    body.appendChild(App.emptyState({
      icon: 'i-grid', title: 'Nothing configured',
      text: 'No entries of this type exist in the selected company.',
    }));
    return;
  }
  body.innerHTML = `
    <table class="tbl">
      <thead><tr><th style="width:34px">#</th><th>Name</th><th>Under / detail</th></tr></thead>
      <tbody>${rows.map((r, i) => `
        <tr><td class="row-num">${i + 1}</td>
            <td class="cell-main">${U.esc(r[0])}</td>
            <td class="muted">${U.esc(r[1] || '—')}</td></tr>`).join('')}
      </tbody>
    </table>`;
});


/* ══════════ 33. REPORTS ══════════ */
App.registerRoute('reports', async (route, container) => {
  const tab = route.sub || 'trial-balance';
  const fy = U.fyRange();

  App.setPage(
    { 'trial-balance': 'Trial Balance', 'balance-sheet': 'Balance Sheet',
      'profit-loss': 'Profit & Loss' }[tab] || 'Reports',
    `${App.state.company} · ${fy.label}`);

  container.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div class="tabs" id="rp-tabs">
          <a class="tab ${tab === 'trial-balance' ? 'active' : ''}" href="#/reports/trial-balance">
            <svg class="ic"><use href="#i-chart"/></svg> Trial Balance</a>
          <a class="tab ${tab === 'balance-sheet' ? 'active' : ''}" href="#/reports/balance-sheet">
            <svg class="ic"><use href="#i-doc"/></svg> Balance Sheet</a>
          <a class="tab ${tab === 'profit-loss' ? 'active' : ''}" href="#/reports/profit-loss">
            <svg class="ic"><use href="#i-trend"/></svg> Profit &amp; Loss</a>
        </div>
        <span class="spacer"></span>
        <div class="report-toolbar">
          ${tab === 'trial-balance' ? `
            <div class="field"><label class="label">As on</label>
              <input class="input" type="date" id="rp-to" value="${U.esc(fy.to)}" style="width:150px"></div>` : `
            <div class="field"><label class="label">From</label>
              <input class="input" type="date" id="rp-from" value="${U.esc(fy.from)}" style="width:150px"></div>
            <div class="field"><label class="label">To</label>
              <input class="input" type="date" id="rp-to" value="${U.esc(fy.to)}" style="width:150px"></div>`}
          <button class="btn btn-sm" id="rp-refresh">
            <svg class="ic ic-sm"><use href="#i-refresh"/></svg> Refresh</button>
          <button class="btn btn-sm" id="rp-export">
            <svg class="ic ic-sm"><use href="#i-download"/></svg> Export CSV</button>
        </div>
      </div>
      <div class="card-body p0" id="rp-body">
        <div class="card-body" style="display:flex;align-items:center;gap:14px">
          <div class="spinner"></div> Generating report from Tally…</div>
      </div>
    </div>`;

  const body = container.querySelector('#rp-body');
  let csvRows = [];

  const loadReport = async () => {
    const to = container.querySelector('#rp-to') ? container.querySelector('#rp-to').value : fy.to;
    const from = container.querySelector('#rp-from') ? container.querySelector('#rp-from').value : fy.from;
    body.innerHTML = `<div class="card-body" style="display:flex;align-items:center;gap:14px">
      <div class="spinner"></div> Generating report from Tally…</div>`;
    csvRows = [];

    try {
      if (tab === 'trial-balance') {
        const res = await API.trialBalance(App.state.company, { to_date: to });
        const tb = res.data;
        csvRows = [['Ledger', 'Under group', 'Debit', 'Credit'],
          ...tb.rows.map((r) => [r.ledger, r.parent, r.debit, r.credit]),
          ['TOTAL', '', tb.total_debit, tb.total_credit]];
        body.innerHTML = `
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>Account</th><th>Under group</th>
                <th class="num" style="width:140px">Debit</th>
                <th class="num" style="width:140px">Credit</th></tr></thead>
              <tbody>
                ${tb.rows.map((r) => `
                  <tr class="clickable" data-ledger="${U.esc(r.ledger)}">
                    <td class="cell-main">${U.esc(r.ledger)}</td>
                    <td class="muted">${U.esc(r.parent || '')}</td>
                    <td class="num">${r.debit ? U.fmtAmt(r.debit) : ''}</td>
                    <td class="num">${r.credit ? U.fmtAmt(r.credit) : ''}</td>
                  </tr>`).join('') || '<tr><td colspan="4" class="empty-cell">All balances are zero.</td></tr>'}
              </tbody>
              <tfoot>
                <tr class="tb-total-row">
                  <td colspan="2">Total — as on ${U.fmtDate(tb.as_on)}</td>
                  <td class="num">${U.fmtAmt(tb.total_debit)}</td>
                  <td class="num">${U.fmtAmt(tb.total_credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="pagination">
            <span class="muted">Difference</span>
            <b class="mono ${U.diffClass(tb.difference)}">${U.fmtAmt(tb.difference)}</b>
          </div>`;
        body.querySelectorAll('tr[data-ledger]').forEach((tr) => {
          tr.onclick = () => App.go(`#/ledgers/${encodeURIComponent(tr.dataset.ledger)}`);
        });
      } else {
        const res = tab === 'balance-sheet'
          ? await API.balanceSheet(App.state.company, { date: to })
          : await API.profitLoss(App.state.company, { from_date: from, to_date: to });
        const lines = extractReportLines(res.data);
        if (!lines.length) {
          body.innerHTML = '';
          body.appendChild(App.emptyState({
            icon: 'i-doc', title: 'No report data',
            text: 'Tally returned an empty structure for this period. With real Tally Prime this report renders from the native export; with the mock server it shows sample lines.',
          }));
          return;
        }
        csvRows = [['Particulars', 'Amount'],
          ...lines.map((l) => ['  '.repeat(l.depth) + l.label, l.amount])];
        body.innerHTML = `
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>Particulars</th>
                <th class="num" style="width:170px">Amount</th></tr></thead>
              <tbody>
                ${lines.map((l) => `
                  <tr>
                    <td class="${l.depth ? 'indent-' + Math.min(l.depth, 3) : ''} ${l.depth ? 'muted' : 'cell-main'}">
                      ${U.esc(l.label)}</td>
                    <td class="num ${U.parseAmt(l.amount) < 0 ? 'neg' : ''}">${U.fmtAmt(l.amount, { dashZero: false })}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="pagination"><span class="report-note">
            Rendered from Tally's native report export · figures in company currency
          </span></div>`;
      }
    } catch (err) {
      body.innerHTML = '';
      body.appendChild(App.pageError(err, loadReport));
    }
  };

  container.querySelector('#rp-refresh').onclick = () => {
    App.invalidateCaches();
    loadReport();
  };
  const toEl = container.querySelector('#rp-to');
  const fromEl = container.querySelector('#rp-from');
  if (toEl) toEl.onchange = loadReport;
  if (fromEl) fromEl.onchange = loadReport;
  container.querySelector('#rp-export').onclick = () => {
    if (!csvRows.length) return;
    U.downloadCSV(`${tab}-${U.todayISO()}.csv`, csvRows);
  };

  loadReport();
});

/* generic walker for native BS/PL structures: finds {label, amount} lines */
function extractReportLines(node, depth = 0, out = []) {
  if (!node || typeof node !== 'object' || out.length > 400) return out;
  const NAME_KEYS = ['BSLEDGERNAME', 'PLLEDGERNAME', 'NAME', 'PARTICULARS', 'LEDGERNAME'];
  const AMT_KEYS = ['BSMAINAMT', 'PLAMOUNT', 'AMOUNT', 'BSAMOUNT'];
  const SUB_KEYS = ['BSSUBITEMS.LIST', 'PLSUBITEMS.LIST', 'SUBGROUPS.LIST', 'GROUPS.LIST'];

  if (Array.isArray(node)) {
    node.forEach((n) => extractReportLines(n, depth, out));
    return out;
  }
  const dict = node;
  const nameKey = NAME_KEYS.find((k) => typeof dict[k] === 'string' && dict[k].trim());
  const amtKey = AMT_KEYS.find((k) => typeof dict[k] === 'string' && dict[k].trim() !== '');
  if (nameKey && amtKey) {
    out.push({ label: dict[nameKey], amount: dict[amtKey], depth });
    depth += 1;
  }
  Object.entries(dict).forEach(([key, value]) => {
    if (SUB_KEYS.includes(key) || typeof value === 'object') {
      extractReportLines(value, depth, out);
    }
  });
  return out;
}
window.extractReportLines = extractReportLines;


/* ══════════ 34. CONFIGURATION PAGE ══════════ */
App.registerRoute('config', async (route, container) => {
  App.setContentLoading('Configuration', App.state.company);
  const [health, sync] = await Promise.all([API.health(), API.syncStatus()]);

  App.setPage('Configuration', 'Connection · appearance · sync · company features');

  let host = 'localhost', port = 9000;
  const m = /http:\/\/([^:/]+):(\d+)/.exec(health.tally_url || '');
  if (m) { host = m[1]; port = m[2]; }

  const FEATURES = [
    ['MaintainCostCentres', 'Maintain cost centres'],
    ['MaintainBudgets', 'Maintain budgets'],
    ['EnableMultiCurrency', 'Multi-currency'],
    ['MaintainBillByBill', 'Bill-wise details'],
  ];

  container.innerHTML = `
    <div class="config-grid">
      <div class="card">
        <div class="card-head">
          <span class="card-title"><svg class="ic"><use href="#i-zap"/></svg>Connection</span>
        </div>
        <div class="card-body">
          <div class="status-line">
            <span class="pill ${health.tally_xml_api === 'connected' ? 'ok' : 'err'}"><span class="dot"></span>XML API</span>
            <span class="mono small muted">${U.esc(health.tally_url)}</span>
          </div>
          <div class="status-line">
            <span class="pill ${health.tally_odbc === 'connected' ? 'ok' : health.tally_odbc === 'not_installed' ? 'warn' : 'err'}">
              <span class="dot"></span>ODBC</span>
            <span class="small muted">${U.esc(health.odbc_detail || health.tally_odbc)}</span>
          </div>
          <div class="field-row mt-2" style="align-items:end">
            <div class="field"><label class="label">Tally host</label>
              <input class="input" id="cf-host" value="${U.esc(host)}"></div>
            <div class="field"><label class="label">Port</label>
              <input class="input num" id="cf-port" value="${U.esc(port)}"></div>
            <div class="field" style="flex:0 0 auto">
              <button class="btn btn-primary" id="cf-apply" style="width:100%">Save &amp; connect</button></div>
          </div>
          <div class="hint mt-1" id="cf-hint"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="card-title"><svg class="ic"><use href="#i-sun"/></svg>Appearance</span>
        </div>
        <div class="card-body">
          <div class="theme-cards">
            <button class="theme-card ${App.state.theme === 'light' ? 'active' : ''}" data-theme="light">
              <div class="tc-preview light"></div><span>Light</span></button>
            <button class="theme-card ${App.state.theme === 'dark' ? 'active' : ''}" data-theme="dark">
              <div class="tc-preview dark"></div><span>Dark</span></button>
          </div>
          <hr class="divider">
          <div class="config-list">
            <div class="config-item">
              <div><div class="ci-label">Company</div>
                <div class="ci-sub">shown in the sidebar</div></div>
              <div class="right badge badge-primary">${U.esc(App.state.company || '—')}</div>
            </div>
            <div class="config-item">
              <div><div class="ci-label">Bridge version</div>
                <div class="ci-sub">middleware + frontend</div></div>
              <div class="right mono small muted">v${U.esc(health.version || '—')}</div>
            </div>
          </div>
          <hr class="divider">
          <button class="btn btn-subtle" id="cf-clear">
            <svg class="ic ic-sm"><use href="#i-trash"/></svg> Clear local preferences</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="card-title"><svg class="ic"><use href="#i-activity"/></svg>Live sync</span>
          <span class="spacer"></span>
          <span class="pill ${sync.data.running ? 'ok' : 'err'}"><span class="dot"></span>
            ${sync.data.running ? 'Running' : 'Stopped'}</span>
        </div>
        <div class="card-body">
          <div class="config-list">
            <div class="config-item">
              <div><div class="ci-label">Poll interval</div>
                <div class="ci-sub">how often Tally is checked for changes</div></div>
              <div class="right mono">${sync.data.interval_seconds}s</div>
            </div>
            ${Object.entries(sync.data.companies || {}).map(([name, info]) => `
              <div class="config-item">
                <div><div class="ci-label">${U.esc(name)}</div>
                  <div class="ci-sub">last check ${U.esc((info.last_sync || '—').replace('T', ' ').slice(0, 19))}</div></div>
                <div class="right mono small muted">alter ${U.esc(info.alter_id ?? '—')}</div>
              </div>`).join('')}
          </div>
          <button class="btn mt-2" id="cf-refresh">
            <svg class="ic ic-sm"><use href="#i-refresh"/></svg> Force refresh now</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="card-title"><svg class="ic"><use href="#i-sliders"/></svg>Company features (F11)</span>
        </div>
        <div class="card-body">
          <div class="feature-grid">
            ${FEATURES.map(([key, label]) => `
              <label class="check"><input type="checkbox" data-feature="${key}"> ${label}</label>`).join('')}
          </div>
          <div class="hint mt-2">Applies Tally's native "Alter Company" import. Unsupported
            feature names are rejected by Tally and reported per feature.</div>
          <button class="btn btn-primary mt-2" id="cf-features-apply">
            <svg class="ic ic-sm"><use href="#i-check"/></svg> Apply features</button>
          <div class="mt-1" id="cf-feature-results"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <span class="card-title"><svg class="ic"><use href="#i-info"/></svg>About</span>
        </div>
        <div class="card-body">
          <p class="small muted" style="line-height:1.7">
            <b>Tally Bridge</b> is a web frontend for Tally Prime 2.1 with live
            bidirectional sync — entries made here appear in Tally, and entries made in
            Tally appear here within seconds.
          </p>
          <div class="config-list mt-2">
            <div class="config-item">
              <div><div class="ci-label">Phase 1 diagnostics console</div>
                <div class="ci-sub">connection health, raw activity feed</div></div>
              <a class="right btn btn-sm" href="/console.html" target="_blank" rel="noopener">
                Open <svg class="ic ic-sm"><use href="#i-external"/></svg></a>
            </div>
          </div>
          <p class="faint small">Shortcuts: <kbd>Alt</kbd>+<kbd>N</kbd> new voucher ·
            <kbd>Ctrl</kbd>+<kbd>S</kbd> save form · <kbd>Esc</kbd> close dialog</p>
        </div>
      </div>
    </div>`;

  /* theme cards */
  container.querySelectorAll('.theme-card').forEach((card) => {
    card.onclick = () => {
      App.applyTheme(card.dataset.theme);
      container.querySelectorAll('.theme-card').forEach((c) =>
        c.classList.toggle('active', c === card));
    };
  });

  /* connection */
  const hint = (msg, ok) => {
    container.querySelector('#cf-hint').innerHTML =
      `<span class="${ok ? 'pos' : 'neg'}">${U.esc(msg)}</span>`;
  };
  container.querySelector('#cf-apply').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const r = await API.connectionConfigure(
        container.querySelector('#cf-host').value.trim() || 'localhost',
        parseInt(container.querySelector('#cf-port').value, 10) || 9000);
      App.state.companies = r.companies || [];
      hint(`Connected — ${App.state.companies.length} company(ies) open.`, true);
      App.toast({ type: 'success', title: 'Bridge reconfigured', message: r.tally_url });
    } catch (err) { hint(err.message, false); }
    finally { btn.disabled = false; }
  };

  container.querySelector('#cf-clear').onclick = async () => {
    const ok = await App.modal.confirm({
      title: 'Clear local preferences?',
      message: 'Remembers company selection and theme. No Tally data is touched.',
      confirmText: 'Clear', danger: true,
    });
    if (ok) { localStorage.clear(); location.reload(); }
  };

  container.querySelector('#cf-refresh').onclick = () => {
    App.invalidateCaches();
    App.toast({ type: 'info', title: 'Cache cleared', message: 'Reloading fresh data from Tally' });
    App.renderRoute();
  };

  container.querySelector('#cf-features-apply').onclick = async (e) => {
    const btn = e.currentTarget;
    const checks = [...container.querySelectorAll('[data-feature]')];
    const payload = {};
    checks.forEach((c) => { payload[c.dataset.feature] = c.checked ? 'Yes' : 'No'; });
    btn.disabled = true;
    try {
      const res = await API.alterCompanyConfig(App.state.company, payload);
      const results = res.results || [];
      const box = container.querySelector('#cf-feature-results');
      box.innerHTML = results.map((r) => `
        <div class="config-item">
          <div class="ci-label mono small">${U.esc(r.feature)}</div>
          <div class="right small ${r.result.success ? 'pos' : 'neg'}">
            ${r.result.success ? 'applied ✓' : U.esc((r.result.errors || ['failed']).join('; '))}</div>
        </div>`).join('');
      App.toast({ type: res.success ? 'success' : 'warn',
                  title: res.success ? 'Features applied' : 'Some features rejected',
                  message: res.success ? '' : 'See details below.' });
    } catch (err) { App.toastError(err, 'Could not alter company'); }
    finally { btn.disabled = false; }
  };
});
