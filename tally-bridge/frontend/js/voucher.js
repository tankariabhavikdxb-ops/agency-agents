/* ═══════════════════════════════════════════════════════════════════════════
   voucher.js — voucher entry form (create/alter), voucher view modal,
   shared row rendering and delete flow
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const Voucher = {

  FALLBACK_TYPES: ['Journal', 'Receipt', 'Payment', 'Contra', 'Sales',
                   'Purchase', 'Credit Note', 'Debit Note', 'Stock Journal',
                   'Physical Stock'],

  ITEM_TYPES: ['Sales', 'Purchase', 'Credit Note', 'Debit Note',
               'Stock Journal', 'Physical Stock'],

  TYPE_CLASS: {
    'Sales': 'badge-success', 'Purchase': 'badge-warning',
    'Receipt': 'badge-primary', 'Payment': 'badge-danger',
    'Contra': 'badge-info', 'Journal': 'badge-violet',
    'Credit Note': 'badge-info', 'Debit Note': 'badge-warning',
    'Stock Journal': 'badge-violet', 'Physical Stock': 'badge-violet',
  },

  typeBadge(type) {
    const cls = this.TYPE_CLASS[type] || 'badge-primary';
    return `<span class="badge ${cls} vch-type-badge">${U.esc(type || 'Voucher')}</span>`;
  },

  /* ══════════ 32. VOUCHER ENTRY FORM ══════════ */
  async renderForm(route, container) {
    const company = App.state.company;
    const editMode = route.sub === 'edit';
    let source = null;

    if (editMode) {
      const rid = route.param;
      source = App.state.lastVouchers[rid] || null;
      if (!source) {
        App.setContentLoading('Alter Voucher', 'Fetching voucher from Tally…');
        const res = await API.voucherById(company, rid);
        source = (res.data.vouchers || [])[0] || null;
      }
      if (!source) {
        container.innerHTML = '';
        container.appendChild(App.emptyState({
          icon: 'i-receipt', title: 'Voucher not found',
          text: 'It may have been deleted in Tally, or is outside the current financial year.',
          actionLabel: 'Back to Voucher Register', onAction: () => App.go('#/vouchers'),
        }));
        return;
      }
    }

    const [ledgers, vchTypes, items, godowns] = await Promise.all([
      App.getLedgers(), App.getVoucherTypes(), App.getStockItems(), App.getGodowns(),
    ]);
    const typeNames = (vchTypes.length ? vchTypes.map((t) => t.name) : this.FALLBACK_TYPES)
      .filter(Boolean);
    if (!typeNames.includes('Journal')) typeNames.unshift('Journal');
    const ledgerNames = ledgers.map((l) => l.name).filter(Boolean);
    const itemNames = items.map((i) => i.name).filter(Boolean);
    const godownNames = godowns.map((g) => g.name).filter(Boolean);

    const initialType = editMode ? source.voucher_type
      : (route.query.type && typeNames.includes(route.query.type)
         ? route.query.type : 'Journal');

    const form = {
      type: initialType,
      date: editMode ? U.tallyToISO(source.date) : U.todayISO(),
      voucher_number: editMode ? (source.voucher_number || '') : '',
      reference: editMode ? (source.reference || '') : '',
      party_name: editMode ? (source.party_ledger || '') : '',
      narration: editMode ? (source.narration || '') : '',
      remoteId: editMode ? (source.remote_id || route.param) : null,
      entries: editMode
        ? source.ledger_entries.map((e) => ({
            ledger: e.ledger || '',
            dr: e.is_debit ? String(e.amount ?? '') : '',
            cr: !e.is_debit ? String(e.amount ?? '') : '',
          }))
        : [{ ledger: '', dr: '', cr: '' }, { ledger: '', dr: '', cr: '' }],
      inventory: editMode
        ? (source.inventory_entries || []).map((i) => ({
            item: i.stock_item || '', godown: '', qty: String(parseFloat(i.quantity) || ''),
            rate: String(parseFloat(i.rate) || ''), amount: String(parseFloat(i.amount) || ''),
          }))
        : [],
    };
    if (editMode && form.entries.length < 2) {
      while (form.entries.length < 2) form.entries.push({ ledger: '', dr: '', cr: '' });
    }

    App.setPage(editMode ? 'Alter Voucher' : 'New Voucher',
      `${company} · ${editMode ? `${form.type} #${form.voucher_number || '—'}` : 'Double-entry form'}`);

    container.innerHTML = `
      <form id="voucher-form" class="vform" novalidate>
        <datalist id="dl-ledgers">${ledgerNames.map((n) => `<option value="${U.esc(n)}"></option>`).join('')}</datalist>
        <datalist id="dl-items">${itemNames.map((n) => `<option value="${U.esc(n)}"></option>`).join('')}</datalist>
        <datalist id="dl-godowns">${godownNames.map((n) => `<option value="${U.esc(n)}"></option>`).join('')}</datalist>

        <div class="vform-type">
          <label class="label" for="vf-type" style="margin:0">Voucher type</label>
          <select class="select" id="vf-type">
            ${typeNames.map((t) => `<option ${t === form.type ? 'selected' : ''}>${U.esc(t)}</option>`).join('')}
          </select>
          ${editMode ? '<span class="badge badge-warning">Altering existing voucher</span>' : ''}
        </div>

        <div class="card">
          <div class="card-body">
            <div class="field-row">
              <div class="field">
                <label class="label" for="vf-date">Date <span class="req">*</span></label>
                <input class="input" type="date" id="vf-date" value="${U.esc(form.date)}" required>
              </div>
              <div class="field">
                <label class="label" for="vf-no">Voucher no.</label>
                <input class="input mono" id="vf-no" value="${U.esc(form.voucher_number)}" placeholder="Auto">
              </div>
              <div class="field">
                <label class="label" for="vf-ref">Reference</label>
                <input class="input" id="vf-ref" value="${U.esc(form.reference)}" placeholder="Invoice / bill no.">
              </div>
              <div class="field">
                <label class="label" for="vf-party">Party ledger</label>
                <input class="input" id="vf-party" list="dl-ledgers" value="${U.esc(form.party_name)}" placeholder="Main party (optional)">
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <span class="card-title"><svg class="ic"><use href="#i-users"/></svg>Accounting entries</span>
            <span class="spacer"></span>
            <button type="button" class="btn btn-sm" id="vf-add-entry">
              <svg class="ic ic-sm"><use href="#i-plus"/></svg> Add line
            </button>
          </div>
          <div class="card-body p0" style="padding:6px 12px 12px">
            <table class="entry-tbl" id="vf-entries">
              <thead>
                <tr><th style="width:34px">#</th><th>Account (type to search ledgers)</th>
                    <th style="width:140px" class="num">Debit</th>
                    <th style="width:140px" class="num">Credit</th>
                    <th style="width:40px"></th></tr>
              </thead>
              <tbody></tbody>
            </table>
            <div class="totals-bar mt-2" id="vf-totals"></div>
          </div>
        </div>

        <div class="card" id="vf-inv-card">
          <div class="inv-section-title">
            <svg class="ic ic-sm"><use href="#i-box"/></svg> Inventory / stock items
            <span class="badge badge-info">optional</span>
          </div>
          <div class="card-body p0" style="padding:6px 12px 12px">
            <table class="entry-tbl" id="vf-inv">
              <thead>
                <tr><th style="width:34px">#</th><th>Stock item</th><th style="width:150px">Godown</th>
                    <th style="width:90px" class="num">Qty</th><th style="width:110px" class="num">Rate</th>
                    <th style="width:120px" class="num">Amount</th><th style="width:40px"></th></tr>
              </thead>
              <tbody></tbody>
            </table>
            <div class="mt-1" style="padding:0 2px">
              <button type="button" class="btn btn-sm" id="vf-add-inv">
                <svg class="ic ic-sm"><use href="#i-plus"/></svg> Add item line
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <div class="field">
              <label class="label" for="vf-narr">Narration</label>
              <textarea class="textarea" id="vf-narr" rows="2"
                placeholder="Narration printed with the voucher…">${U.esc(form.narration)}</textarea>
            </div>
          </div>
        </div>

        <div id="vf-errors"></div>

        <div class="vform-actions">
          <div class="left">
            ${editMode ? `<button type="button" class="btn btn-danger" id="vf-delete">
              <svg class="ic ic-sm"><use href="#i-trash"/></svg> Delete voucher</button>` : ''}
          </div>
          <button type="button" class="btn" id="vf-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="vf-save" style="min-width:130px">
            <svg class="ic ic-sm"><use href="#i-check"/></svg>
            ${editMode ? 'Save changes' : 'Save voucher'}
          </button>
        </div>
      </form>`;

    const root = container.querySelector('#voucher-form');
    const entriesBody = root.querySelector('#vf-entries tbody');
    const invBody = root.querySelector('#vf-inv tbody');

    /* ── entries table rendering ── */
    const entryRow = (e, i) => `
      <tr data-i="${i}">
        <td class="row-num">${i + 1}</td>
        <td><input class="input in-account" list="dl-ledgers" placeholder="Ledger name…" value="${U.esc(e.ledger)}"></td>
        <td><input class="input num in-dr" inputmode="decimal" placeholder="0.00" value="${U.esc(e.dr)}"></td>
        <td><input class="input num in-cr" inputmode="decimal" placeholder="0.00" value="${U.esc(e.cr)}"></td>
        <td><button type="button" class="iconbtn sm danger row-del" title="Remove line">
          <svg class="ic ic-sm"><use href="#i-x"/></svg></button></td>
      </tr>`;

    const invRow = (r, i) => `
      <tr data-i="${i}">
        <td class="row-num">${i + 1}</td>
        <td><input class="input in-item" list="dl-items" placeholder="Stock item…" value="${U.esc(r.item)}"></td>
        <td><input class="input in-godown" list="dl-godowns" placeholder="Godown…" value="${U.esc(r.godown)}"></td>
        <td><input class="input num in-qty" inputmode="decimal" placeholder="0" value="${U.esc(r.qty)}"></td>
        <td><input class="input num in-rate" inputmode="decimal" placeholder="0.00" value="${U.esc(r.rate)}"></td>
        <td><input class="input num in-amt" inputmode="decimal" placeholder="0.00" value="${U.esc(r.amount)}"></td>
        <td><button type="button" class="iconbtn sm danger row-del" title="Remove line">
          <svg class="ic ic-sm"><use href="#i-x"/></svg></button></td>
      </tr>`;

    const renderEntries = () => {
      entriesBody.innerHTML = form.entries.map(entryRow).join('');
    };
    const renderInv = () => {
      invBody.innerHTML = form.inventory.map(invRow).join('');
    };

    const totals = () => {
      let dr = 0, cr = 0;
      form.entries.forEach((e) => {
        dr += U.parseAmt(e.dr);
        cr += U.parseAmt(e.cr);
      });
      return { dr, cr, diff: Math.round((dr - cr) * 100) / 100 };
    };

    const renderTotals = () => {
      const t = totals();
      const balanced = Math.abs(t.diff) < 0.005 && t.dr > 0;
      document.getElementById('vf-totals').innerHTML = `
        <div class="tot-item"><span class="tl">Total debit</span><span class="tv">${U.fmtAmt(t.dr)}</span></div>
        <div class="tot-item"><span class="tl">Total credit</span><span class="tv">${U.fmtAmt(t.cr)}</span></div>
        <div class="tot-item tot-diff"><span class="tl">Difference</span>
          <span class="tv ${balanced ? 'pos' : 'neg'}">${U.fmtAmt(t.diff)}</span></div>
        <span class="badge ${balanced ? 'badge-success' : 'badge-danger'}">
          ${balanced ? '✓ Balanced' : 'Unbalanced'}</span>`;
    };

    const syncFromDom = () => {
      U.qsa('tr', entriesBody).forEach((tr) => {
        const i = parseInt(tr.dataset.i, 10);
        const e = form.entries[i];
        if (!e) return;
        e.ledger = tr.querySelector('.in-account').value;
        e.dr = tr.querySelector('.in-dr').value;
        e.cr = tr.querySelector('.in-cr').value;
      });
    };

    entriesBody.addEventListener('input', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      /* debit and credit are mutually exclusive per line */
      if (e.target.classList.contains('in-dr') && e.target.value.trim() !== '') {
        tr.querySelector('.in-cr').value = '';
      } else if (e.target.classList.contains('in-cr') && e.target.value.trim() !== '') {
        tr.querySelector('.in-dr').value = '';
      }
      syncFromDom();
      renderTotals();
    });

    entriesBody.addEventListener('click', (e) => {
      if (!e.target.closest('.row-del')) return;
      if (form.entries.length <= 2) {
        App.toast({ type: 'warn', title: 'Minimum two lines',
                    message: 'A double-entry voucher needs at least one debit and one credit.' });
        return;
      }
      syncFromDom();
      form.entries.splice(parseInt(e.target.closest('tr').dataset.i, 10), 1);
      renderEntries();
      renderTotals();
    });

    root.querySelector('#vf-add-entry').onclick = () => {
      syncFromDom();
      form.entries.push({ ledger: '', dr: '', cr: '' });
      renderEntries();
      const rows = entriesBody.querySelectorAll('tr');
      rows[rows.length - 1].querySelector('.in-account').focus();
    };

    /* ── inventory table ── */
    const syncInvFromDom = () => {
      U.qsa('tr', invBody).forEach((tr) => {
        const i = parseInt(tr.dataset.i, 10);
        const r = form.inventory[i];
        if (!r) return;
        r.item = tr.querySelector('.in-item').value;
        r.godown = tr.querySelector('.in-godown').value;
        r.qty = tr.querySelector('.in-qty').value;
        r.rate = tr.querySelector('.in-rate').value;
        r.amount = tr.querySelector('.in-amt').value;
      });
    };

    invBody.addEventListener('input', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      syncInvFromDom();
      if (e.target.classList.contains('in-qty') || e.target.classList.contains('in-rate')) {
        const i = parseInt(tr.dataset.i, 10);
        const r = form.inventory[i];
        const amt = Math.round(U.parseAmt(r.qty) * U.parseAmt(r.rate) * 100) / 100;
        r.amount = amt ? String(amt) : '';
        tr.querySelector('.in-amt').value = r.amount;
      }
    });

    invBody.addEventListener('click', (e) => {
      if (!e.target.closest('.row-del')) return;
      syncInvFromDom();
      form.inventory.splice(parseInt(e.target.closest('tr').dataset.i, 10), 1);
      renderInv();
    });

    root.querySelector('#vf-add-inv').onclick = () => {
      syncInvFromDom();
      form.inventory.push({ item: '', godown: '', qty: '', rate: '', amount: '' });
      renderInv();
      const rows = invBody.querySelectorAll('tr');
      rows[rows.length - 1].querySelector('.in-item').focus();
    };

    /* ── type switch: show/hide inventory ── */
    const syncInvVisibility = () => {
      const show = Voucher.ITEM_TYPES.includes(form.type) && itemNames.length > 0;
      document.getElementById('vf-inv-card').hidden = !show;
    };
    document.getElementById('vf-type').onchange = (e) => {
      form.type = e.target.value;
      syncInvVisibility();
    };
    syncInvVisibility();

    /* ── validation + save ── */
    const showErrors = (errors) => {
      const box = document.getElementById('vf-errors');
      box.innerHTML = errors.length ? `
        <div class="form-error"><svg class="ic ic-sm" style="margin-top:3px"><use href="#i-alert"/></svg>
          <div><b>Tally rejected / invalid voucher</b>
            <ul>${errors.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul></div>
        </div>` : '';
      if (errors.length) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    root.addEventListener('submit', async (e) => {
      e.preventDefault();
      syncFromDom();
      syncInvFromDom();

      const errors = [];
      if (!document.getElementById('vf-date').value) errors.push('Date is required.');
      const filled = form.entries.filter((x) => x.ledger.trim() && (U.parseAmt(x.dr) || U.parseAmt(x.cr)));
      if (filled.length < 2) errors.push('At least two complete entry lines (ledger + amount) are required.');

      const t = totals();
      if (filled.length >= 2) {
        if (t.dr <= 0) errors.push('Total debit is zero.');
        if (Math.abs(t.diff) > 0.01) {
          errors.push(`Debit (${U.fmtAmt(t.dr)}) and Credit (${U.fmtAmt(t.cr)}) must be equal.`);
        }
      }
      form.entries.forEach((x, i) => {
        if (x.ledger.trim() && U.parseAmt(x.dr) && U.parseAmt(x.cr)) {
          errors.push(`Line ${i + 1}: fill either debit or credit, not both.`);
        }
        if (x.ledger.trim() && !U.parseAmt(x.dr) && !U.parseAmt(x.cr)) {
          errors.push(`Line ${i + 1} (${x.ledger}): amount is missing.`);
        }
      });
      if (errors.length) { showErrors(errors); return; }

      const payload = {
        voucher_type: form.type,
        date: document.getElementById('vf-date').value,
        voucher_number: document.getElementById('vf-no').value.trim(),
        reference: document.getElementById('vf-ref').value.trim(),
        party_name: document.getElementById('vf-party').value.trim(),
        narration: document.getElementById('vf-narr').value.trim(),
        ledger_entries: form.entries
          .filter((x) => x.ledger.trim())
          .map((x) => ({
            ledger_name: x.ledger.trim(),
            amount: U.parseAmt(x.dr) || U.parseAmt(x.cr),
            is_debit: !!U.parseAmt(x.dr),
          })),
        inventory_entries: Voucher.ITEM_TYPES.includes(form.type)
          ? form.inventory.filter((r) => r.item.trim()).map((r) => ({
              stock_item: r.item.trim(),
              godown: r.godown.trim(),
              quantity: U.parseAmt(r.qty),
              rate: U.parseAmt(r.rate),
              amount: U.parseAmt(r.amount) || (U.parseAmt(r.qty) * U.parseAmt(r.rate)),
              unit: '',
            }))
          : [],
      };

      const saveBtn = document.getElementById('vf-save');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span> Saving…';
      try {
        const res = form.remoteId
          ? await API.alterVoucher(company, form.remoteId, payload)
          : await API.createVoucher(company, payload);
        if (res.success) {
          App.invalidateCaches();
          App.toast({ type: 'success', title: form.remoteId ? 'Voucher altered' : 'Voucher saved',
                      message: `${form.type} — ${res.message || 'accepted by Tally'}` });
          App.go('#/daybook');
        } else {
          showErrors(res.errors || ['Tally did not accept the voucher.']);
        }
      } catch (err) {
        showErrors(err.errors && err.errors.length ? err.errors : [err.message]);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg class="ic ic-sm"><use href="#i-check"/></svg> ${form.remoteId ? 'Save changes' : 'Save voucher'}`;
      }
    });

    root.querySelector('#vf-cancel').onclick = () => {
      App.go(history.length > 1 ? '#/vouchers' : '#/dashboard');
    };

    const delBtn = root.querySelector('#vf-delete');
    if (delBtn) {
      delBtn.onclick = async () => {
        const ok = await App.modal.confirm({
          title: 'Delete this voucher?',
          message: `Voucher <b>${U.esc(form.type)} #${U.esc(form.voucher_number || '—')}</b> dated
                    ${U.esc(U.fmtDate(form.date))} will be deleted from Tally. This cannot be undone.`,
          confirmText: 'Delete', danger: true,
        });
        if (!ok) return;
        try {
          const res = await API.deleteVoucher(company, {
            remote_id: form.remoteId,
            voucher_number: form.voucher_number,
            voucher_type: form.type,
            date: form.date,
          });
          if (res.success) {
            App.invalidateCaches();
            App.toast({ type: 'success', title: 'Voucher deleted', message: res.message || '' });
            App.go('#/vouchers');
          } else {
            showErrors(res.errors || ['Tally refused to delete the voucher.']);
          }
        } catch (err) { App.toastError(err, 'Delete failed'); }
      };
    }

    renderEntries();
    renderInv();
    renderTotals();
  },


  /* ══════════ shared list rendering ══════════ */
  rowHtml(v) {
    const amount = Math.abs(U.parseAmt(v.amount));
    return `
      <tr class="clickable" data-rid="${U.esc(v.remote_id || '')}">
        <td class="mono nowrap">${U.fmtDate(v.date)}</td>
        <td>${this.typeBadge(v.voucher_type)}</td>
        <td class="mono">${U.esc(v.voucher_number || '—')}</td>
        <td><div class="cell-main">${U.esc(v.party_ledger || this.firstEntryLabel(v))}</div>
            <div class="cell-sub">${U.esc(U.truncate(v.narration, 52))}</div></td>
        <td class="num">${amount ? U.fmtAmt(amount) : '—'}</td>
        <td class="actions">
          <button class="iconbtn sm primary" data-act="edit" title="Alter voucher">
            <svg class="ic ic-sm"><use href="#i-edit"/></svg></button>
          <button class="iconbtn sm danger" data-act="del" title="Delete voucher">
            <svg class="ic ic-sm"><use href="#i-trash"/></svg></button>
        </td>
      </tr>`;
  },

  firstEntryLabel(v) {
    const e = (v.ledger_entries || [])[0];
    return e ? e.ledger : '—';
  },

  /* remember voucher objects for edit deep-links */
  remember(vouchers) {
    (vouchers || []).forEach((v) => {
      if (v.remote_id) App.state.lastVouchers[v.remote_id] = v;
    });
  },

  bindRowEvents(tableEl, { onRerender } = {}) {
    tableEl.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-act="edit"]');
      const delBtn = e.target.closest('[data-act="del"]');
      const tr = e.target.closest('tr[data-rid]');
      if (!tr) return;
      const rid = tr.dataset.rid;
      const v = App.state.lastVouchers[rid];
      if (!v) return;

      if (editBtn) { App.go(`#/voucher/edit/${encodeURIComponent(rid)}`); return; }
      if (delBtn) { await this.deleteFlow(v, onRerender); return; }
      this.viewModal(v, onRerender);
    });
  },

  async deleteFlow(v, onRerender) {
    const ok = await App.modal.confirm({
      title: 'Delete this voucher?',
      message: `<b>${U.esc(v.voucher_type)} #${U.esc(v.voucher_number || '—')}</b> dated
                ${U.fmtDate(v.date)} will be deleted from Tally.`,
      confirmText: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      const res = await API.deleteVoucher(App.state.company, {
        remote_id: v.remote_id,
        voucher_number: v.voucher_number,
        voucher_type: v.voucher_type,
        date: U.tallyToISO(v.date),
      });
      if (res.success) {
        App.invalidateCaches();
        App.toast({ type: 'success', title: 'Voucher deleted', message: res.message || '' });
        if (onRerender) onRerender();
      } else {
        App.toast({ type: 'error', title: 'Tally refused',
                    message: (res.errors || []).join('; ') || 'Unknown error' });
      }
    } catch (err) { App.toastError(err, 'Delete failed'); }
  },

  viewModal(v, onRerender) {
    const rows = (v.ledger_entries || []).map((e) => `
      <tr>
        <td class="cell-main">${U.esc(e.ledger)}</td>
        <td class="num">${e.is_debit ? U.fmtAmt(e.amount) : ''}</td>
        <td class="num">${!e.is_debit ? U.fmtAmt(e.amount) : ''}</td>
      </tr>`).join('');

    const invRows = (v.inventory_entries || []).map((i) => `
      <tr>
        <td class="cell-main">${U.esc(i.stock_item)}</td>
        <td class="num">${U.esc(i.quantity || '')}</td>
        <td class="num">${U.esc(i.rate || '')}</td>
        <td class="num">${U.fmtAmt(i.amount)}</td>
      </tr>`).join('');

    const total = (v.ledger_entries || []).reduce((s, e) => s + (e.is_debit ? U.parseAmt(e.amount) : 0), 0);

    const footer = U.el(`
      <div>
        <button class="btn btn-ghost" data-act="close">Close</button>
        <button class="btn btn-danger" data-act="del">
          <svg class="ic ic-sm"><use href="#i-trash"/></svg> Delete</button>
        <button class="btn btn-primary" data-act="edit">
          <svg class="ic ic-sm"><use href="#i-edit"/></svg> Alter</button>
      </div>`);

    const m = App.modal.open({
      title: `${this.typeBadge(v.voucher_type)}
              <span class="mono" style="font-size:.92rem">#${U.esc(v.voucher_number || '—')}</span>`,
      size: 'lg',
      body: `
        <div class="kv-grid mb-2">
          <div class="kv"><div class="k">Date</div><div class="v mono">${U.fmtDate(v.date)}</div></div>
          <div class="kv"><div class="k">Party</div><div class="v">${U.esc(v.party_ledger || '—')}</div></div>
          <div class="kv"><div class="k">Reference</div><div class="v">${U.esc(v.reference || '—')}</div></div>
          <div class="kv"><div class="k">Voucher ID</div><div class="v mono small">${U.esc(v.remote_id || '—')}</div></div>
        </div>
        <div class="tbl-wrap card" style="box-shadow:none">
          <table class="tbl vview-entries">
            <thead><tr><th>Account</th><th class="num" style="width:120px">Debit</th>
                       <th class="num" style="width:120px">Credit</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td>Total</td><td class="num">${U.fmtAmt(total)}</td><td class="num"></td></tr></tfoot>
          </table>
        </div>
        ${invRows ? `
          <div class="inv-section-title" style="padding:14px 0 0">Inventory</div>
          <div class="tbl-wrap card mt-1" style="box-shadow:none">
            <table class="tbl vview-entries">
              <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th>
                         <th class="num">Amount</th></tr></thead>
              <tbody>${invRows}</tbody>
            </table>
          </div>` : ''}
        ${v.narration ? `
          <div class="field mt-2">
            <label class="label">Narration</label>
            <div class="code-block">${U.esc(v.narration)}</div>
          </div>` : ''}`,
      footer,
    });

    footer.querySelector('[data-act="close"]').onclick = () => App.modal.close();
    footer.querySelector('[data-act="edit"]').onclick = () => {
      App.modal.close();
      App.go(`#/voucher/edit/${encodeURIComponent(v.remote_id)}`);
    };
    footer.querySelector('[data-act="del"]').onclick = async () => {
      App.modal.close();
      await this.deleteFlow(v, onRerender);
    };
    return m;
  },
};

window.Voucher = Voucher;

/* route registration: #/voucher/new and #/voucher/edit/:remoteId */
App.registerRoute('voucher', (route, container) => Voucher.renderForm(route, container));
