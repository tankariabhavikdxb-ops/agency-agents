/* ============================================================
   NEXORA CMS — reusable components
   • searchSelect  : search-as-you-go dropdown (used everywhere)
   • dataTable     : sortable/paginated table with CSV export
   • form helpers  : field rows, inputs, validation display
   ============================================================ */
(function (root) {
  "use strict";

  const { esc, debounce, matchSearch } = root.Fmt;
  const { icon, emptyState } = root.UI;

  /* ============================================================
     SEARCH-AS-YOU-GO SELECT
     options: {
       id, items:[{id,label,sub,right,badge,data}], value, placeholder,
       required, disabled, allowClear, onSelect(item), onChange(q),
       minChars, emptyText, highlight:true
     }
     ============================================================ */
  function searchSelect(opts) {
    const o = opts || {};
    const wrap = document.createElement("div");
    wrap.className = "sselect" + (o.required ? " req" : "") + (o.disabled ? " disabled" : "");
    wrap.innerHTML = `
      <div class="sselect-box">
        <span class="sselect-ic">${icon("search", 14)}</span>
        <input class="sselect-input" type="text" autocomplete="off" spellcheck="false"
               placeholder="${esc(o.placeholder || "Type to search…")}" />
        <button class="sselect-clear" type="button" tabindex="-1" aria-label="Clear">${icon("close", 12)}</button>
        <span class="sselect-arrow">${icon("chevD", 14)}</span>
        <input type="hidden" class="sselect-value" />
      </div>
      <div class="sselect-pop" role="listbox"></div>
      <div class="sselect-err"></div>`;
    const input = wrap.querySelector(".sselect-input");
    const pop = wrap.querySelector(".sselect-pop");
    const valEl = wrap.querySelector(".sselect-value");
    const clearBtn = wrap.querySelector(".sselect-clear");
    let open = false, items = o.items || [], selected = null, selIndex = -1;

    /** relevance scoring: word-boundary matches first, deep substrings last */
    function searchScore(q, text) {
      const t = String(text || "").toLowerCase();
      const parts = String(q || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
      let score = 0;
      for (const p of parts) {
        const idx = t.indexOf(p);
        if (idx < 0) return -1;
        const wordStart = idx === 0 || /[^a-z0-9]/.test(t[idx - 1]);
        score += wordStart ? idx * 0.01 : 100 + idx;
      }
      return score;
    }

    const itemsFor = q => items
      .map(it => ({ it, score: searchScore(q, it.label + " " + (it.sub || "") + " " + (it.code || "")) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map(x => x.it);

    function setValue(item, silent) {
      selected = item || null;
      valEl.value = item ? item.id : "";
      if (!silent) input.value = item ? item.label : "";
      wrap.classList.remove("has-value");
      if (item) wrap.classList.add("has-value");
      updateClear();
      if (!silent && o.onSelect) o.onSelect(item);
    }

    function updateClear() {
      clearBtn.style.display = (selected || input.value) ? "flex" : "none";
    }

    function renderPopup(list, query) {
      pop.innerHTML = "";
      selIndex = -1;
      if (!open) return;
      if (!list.length) {
        const d = document.createElement("div");
        d.className = "sselect-empty";
        d.innerHTML = `${icon("search", 13)} ${esc(o.emptyText || "No matches found")}`;
        pop.appendChild(d);
        return;
      }
      const max = Math.min(list.length, 60);
      for (let i = 0; i < max; i++) {
        const it = list[i];
        const row = document.createElement("div");
        row.className = "sselect-item" + (selected && selected.id === it.id ? " sel" : "");
        row.setAttribute("role", "option");
        row.dataset.idx = i;
        const label = o.highlight === false ? esc(it.label) : highlightMatch(it.label, query);
        row.innerHTML = `
          <div class="sselect-item-main">${label} ${it.badge ? `<span class="sselect-badge">${esc(it.badge)}</span>` : ""}</div>
          ${it.sub ? `<div class="sselect-item-sub">${esc(it.sub)}</div>` : ""}
          ${it.right != null ? `<div class="sselect-item-right">${esc(it.right)}</div>` : ""}`;
        row.addEventListener("mousedown", ev => {
          ev.preventDefault();
          setValue(it);
          close();
        });
        pop.appendChild(row);
      }
      if (list.length > max) {
        const more = document.createElement("div");
        more.className = "sselect-more";
        more.textContent = `+ ${list.length - max} more — keep typing to narrow down`;
        pop.appendChild(more);
      }
    }

    function highlightMatch(label, query) {
      if (!query) return esc(label);
      const qs = String(query).toLowerCase().split(/\s+/).filter(Boolean);
      const out = esc(label).replace(/[<>&]/g, m => m); // esc already applied
      // rebuild with highlighting on the escaped string is complex; simple approach:
      let html = esc(label);
      qs.forEach(q => {
        const idx = html.toLowerCase().indexOf(q);
        if (idx >= 0) {
          html = html.slice(0, idx) + "<mark>" + html.slice(idx, idx + q.length) + "</mark>" + html.slice(idx + q.length);
        }
      });
      return html;
    }

    function openPopup() {
      open = true;
      wrap.classList.add("open");
      renderPopup(itemsFor(input.value), input.value);
    }
    function close() {
      open = false;
      wrap.classList.remove("open");
      if (selected) input.value = selected.label;
      else if (!input.value) setValue(null, true);
      updateClear();
    }

    input.addEventListener("focus", () => {
      if (!o.disabled) { openPopup(); if (o.onFocus) o.onFocus(); }
    });
    input.addEventListener("input", debounce(() => {
      if (!o.disabled) {
        open = true;
        wrap.classList.add("open");
        if (selected && input.value !== selected.label) setValue(null, true);
        renderPopup(itemsFor(input.value), input.value);
        if (o.onChange) o.onChange(input.value);
        updateClear();
      }
    }, 120));
    input.addEventListener("keydown", e => {
      if (o.disabled) return;
      const list = pop.querySelectorAll(".sselect-item");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!open) { openPopup(); list.length && activate(pop.querySelectorAll(".sselect-item"), 0); }
        else if (list.length) activate(list, selIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (list.length) activate(list, selIndex - 1);
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (open && list.length && selIndex >= 0) {
          e.preventDefault();
          const it = itemsFor(input.value)[selIndex];
          if (it) setValue(it);
          close();
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (open && itemsFor(input.value).length === 1) { setValue(itemsFor(input.value)[0]); }
          close();
        }
      } else if (e.key === "Escape") {
        close();
        input.blur();
      }
    });
    input.addEventListener("blur", () => setTimeout(close, 150));
    document.addEventListener("click", ev => {
      if (open && !wrap.contains(ev.target)) close();
    });

    function activate(list, idx) {
      if (!list.length) return;
      selIndex = (idx + list.length) % list.length;
      list.forEach((n, i) => n.classList.toggle("sel", i === selIndex));
      list[selIndex]?.scrollIntoView({ block: "nearest" });
    }

    clearBtn.addEventListener("click", () => {
      setValue(null);
      input.value = "";
      wrap.classList.remove("error");
      if (o.disabled) return;
      open = true; wrap.classList.add("open");
      renderPopup(itemsFor(""), "");
      input.focus();
    });

    function setItems(nextItems, keepSelection) {
      items = nextItems || [];
      if (!keepSelection && selected && !items.some(i => i.id === selected.id)) setValue(null, true);
      else if (selected) input.value = selected.label;
      updateClear();
    }

    function setError(msg) {
      const err = wrap.querySelector(".sselect-err");
      if (msg) { wrap.classList.add("error"); err.innerHTML = msg; }
      else { wrap.classList.remove("error"); err.innerHTML = ""; }
    }

    if (o.value != null) {
      const found = items.find(i => String(i.id) === String(o.value));
      if (found) setValue(found, true);
      else if (o.value) { input.value = String(o.value); updateClear(); }
    }
    updateClear();

    return {
      wrap,
      input,
      setItems,
      get value() { return valEl.value; },
      get item() { return selected; },
      setValue,
      setError,
      focus: () => input.focus(),
      clear: () => { setValue(null); input.value = ""; updateClear(); },
    };
  }

  /* ============================================================
     DATA TABLE — sortable, paginated, actions
     columns: [{key,label,sort?,sortVal?,render?,class?,align?,nowrap?}]
     rows: objects; actions: [{act,icon,title,danger?,show?}]
     ============================================================ */
  function dataTable(opts) {
    const o = opts || {};
    const wrap = document.createElement("div");
    wrap.className = "dtable";
    wrap.innerHTML = `
      <div class="dtable-top">
        <div class="dtable-count"></div>
        ${o.search !== false ? `<div class="dtable-search">${icon("search", 14)}<input type="text" placeholder="Search this table…" /></div>` : ""}
      </div>
      <div class="dtable-scroll"><table class="table">
        <thead><tr></tr></thead>
        <tbody></tbody>
      </table></div>
      <div class="dtable-foot">
        <div class="dtable-pagesize">Rows: 
          <select class="mini-select">
            <option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="0">All</option>
          </select>
        </div>
        <div class="pager"></div>
      </div>`;
    const tbody = wrap.querySelector("tbody");
    const thead = wrap.querySelector("thead tr");
    const countEl = wrap.querySelector(".dtable-count");
    const searchInput = wrap.querySelector(".dtable-search input");
    const sizeSel = wrap.querySelector(".mini-select");
    const pagerEl = wrap.querySelector(".pager");

    let rows = o.rows || [];
    let page = 1;
    let pageSize = (root.APP_CONFIG && root.APP_CONFIG.PAGE_SIZE) || 25;
    let sortKey = o.defaultSort || null, sortDir = 1;
    let searchQ = "";

    sizeSel.value = pageSize === 0 ? "0" : String([25, 50, 100].includes(pageSize) ? pageSize : 25);

    function buildHead() {
      thead.innerHTML = "";
      o.columns.forEach(c => {
        const th = document.createElement("th");
        th.className = (c.class || "") + (c.align ? " al-" + c.align : "") + (c.sort !== false && c.key ? " sortable" : "");
        if (c.sort !== false && c.key) {
          th.innerHTML = `<span class="th-in">${esc(c.label)}<span class="th-sort">${icon(sortKey === c.key ? (sortDir === 1 ? "chevD" : "chevD") : "chevD", 11)}</span></span>`;
          th.addEventListener("click", () => {
            if (sortKey === c.key) sortDir *= -1; else { sortKey = c.key; sortDir = 1; }
            buildHead(); render();
          });
        } else {
          th.innerHTML = `<span class="th-in">${esc(c.label)}</span>`;
        }
        if (sortKey === c.key) th.classList.add(sortDir === 1 ? "asc" : "desc");
        thead.appendChild(th);
      });
      if (o.actions && o.actions.length) {
        const th = document.createElement("th");
        th.className = "al-right";
        th.innerHTML = `<span class="th-in">Actions</span>`;
        thead.appendChild(th);
      }
    }

    function filtered() {
      let r = rows;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        r = r.filter(row => o.columns.some(c => String(row[c.key] ?? "").toLowerCase().includes(q)));
      }
      if (sortKey) {
        const col = o.columns.find(c => c.key === sortKey);
        const val = c => {
          const raw = c.sortVal ? c.sortVal(c) : c[sortKey];
          return typeof raw === "number" ? raw : String(raw == null ? "" : raw).toLowerCase();
        };
        r = r.slice().sort((a, b) => {
          const va = val(a), vb = val(b);
          if (va < vb) return -1 * sortDir;
          if (va > vb) return 1 * sortDir;
          return 0;
        });
      }
      return r;
    }

    function render() {
      const f = filtered();
      const total = f.length;
      const pages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
      page = Math.min(page, pages);
      const slice = pageSize > 0 ? f.slice((page - 1) * pageSize, page * pageSize) : f;
      countEl.textContent = `${total.toLocaleString()} record${total === 1 ? "" : "s"}` + (searchQ ? ` matching “${searchQ}”` : "");

      if (!total) {
        tbody.innerHTML = `<tr><td colspan="${o.columns.length + (o.actions?.length ? 1 : 0)}">${emptyState("search", "No records found", o.emptyText || "Try adjusting your search or filters, or add a new record.")}</td></tr>`;
      } else {
        tbody.innerHTML = slice.map(row => {
          const tds = o.columns.map(c => {
            const v = c.render ? c.render(row) : row[c.key];
            const cls = (c.class ? " " + c.class : "") + (c.align ? " al-" + c.align : "") + (c.nowrap ? " nowrap" : "");
            return `<td class="${cls.trim()}">${v == null || v === "" ? "—" : v}</td>`;
          }).join("");
          const acts = (o.actions || []).filter(a => !a.show || a.show(row)).map(a =>
            `<button class="icon-btn ${a.danger ? "danger" : ""}" data-act="${a.act}" data-id="${esc(row.id)}" title="${esc(a.title)}">${icon(a.icon, 16)}</button>`
          ).join("");
          return `<tr>${tds}${o.actions?.length ? `<td class="al-right nowrap row-acts">${acts}</td>` : ""}</tr>`;
        }).join("");
      }
      buildPager(total, pages);
      const onAction = o.onAction;
      if (onAction) {
        tbody.querySelectorAll("[data-act]").forEach(b => {
          b.addEventListener("click", () => {
            const row = rows.find(r => String(r.id) === b.dataset.id);
            onAction(b.dataset.act, row, b);
          });
        });
      }
    }

    function buildPager(total, pages) {
      if (pageSize <= 0 || total <= pageSize) { pagerEl.innerHTML = ""; return; }
      let html = `<button class="pager-btn" data-p="prev" ${page <= 1 ? "disabled" : ""}>${icon("chevL", 13)}</button>`;
      const win = [];
      for (let i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || Math.abs(i - page) <= 2) win.push(i);
      }
      let last = 0;
      win.forEach(i => {
        if (i - last > 1) html += `<span class="pager-dots">…</span>`;
        html += `<button class="pager-btn ${i === page ? "on" : ""}" data-p="${i}">${i}</button>`;
        last = i;
      });
      html += `<button class="pager-btn" data-p="next" ${page >= pages ? "disabled" : ""}>${icon("chevR", 13)}</button>`;
      pagerEl.innerHTML = html;
      pagerEl.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => {
        const p = b.dataset.p;
        if (p === "prev") page = Math.max(1, page - 1);
        else if (p === "next") page = Math.min(pages, page + 1);
        else page = Number(p);
        render();
      }));
    }

    searchInput?.addEventListener("input", debounce(() => {
      searchQ = searchInput.value.trim();
      page = 1;
      render();
    }, 150));
    sizeSel.addEventListener("change", () => {
      pageSize = Number(sizeSel.value);
      page = 1;
      render();
    });

    buildHead();
    render();

    return {
      wrap,
      setRows(next) {
        rows = next || [];
        page = 1;
        render();
      },
      getRows: () => rows,
      refresh: () => render(),
      getFilteredRows: () => filtered(),
    };
  }

  /* ============================================================
     FORM HELPERS
     ============================================================ */
  function field(label, controlHtml, opts) {
    const o = opts || {};
    return `<div class="field ${o.span === 2 ? "span2" : ""} ${o.cls || ""}">
      <label>${esc(label)} ${o.required ? '<span class="req-star">*</span>' : ""}</label>
      ${controlHtml}
      <div class="field-hint">${o.hint || ""}</div>
    </div>`;
  }

  function textInput(name, value, opts) {
    const o = opts || {};
    return `<input class="input" type="${o.type || "text"}" name="${esc(name)}" value="${esc(value == null ? "" : value)}" placeholder="${esc(o.placeholder || "")}" ${o.readonly ? "readonly" : ""} ${o.required ? "required" : ""} ${o.attrs || ""}/>`;
  }

  function textAreaInput(name, value, opts) {
    const o = opts || {};
    return `<textarea class="input" name="${esc(name)}" rows="${o.rows || 2}" placeholder="${esc(o.placeholder || "")}">${esc(value == null ? "" : value)}</textarea>`;
  }

  function fieldError(name, msg) {
    const f = document.querySelector(`.field [name="${name}"]`);
    if (!f) return;
    const fieldEl = f.closest(".field");
    fieldEl.classList.toggle("invalid", !!msg);
    const hint = fieldEl.querySelector(".field-hint");
    if (hint) hint.innerHTML = msg ? `<span class="hint-err">${esc(msg)}</span>` : "";
  }

  function clearErrors(form) {
    form.querySelectorAll(".field.invalid").forEach(f => f.classList.remove("invalid"));
    form.querySelectorAll(".hint-err").forEach(h => h.remove());
    form.querySelectorAll(".sselect.error").forEach(s => s.classList.remove("error"));
  }

  function formData(form) {
    const out = {};
    form.querySelectorAll("[name]").forEach(inp => {
      if (inp.type === "checkbox") out[inp.name] = inp.checked ? "YES" : "NO";
      else if (inp.type === "number") out[inp.name] = inp.value === "" ? "" : Number(inp.value);
      else out[inp.name] = inp.value;
    });
    return out;
  }

  function setFormData(form, data) {
    Object.keys(data || {}).forEach(k => {
      const inp = form.querySelector(`[name="${k}"]`);
      if (!inp) return;
      if (inp.type === "checkbox") inp.checked = data[k] === "YES" || data[k] === true;
      else inp.value = data[k] == null ? "" : data[k];
    });
  }

  /* ---------- progress bar ---------- */
  function progressBar(pctVal, tone) {
    const v = Math.max(0, Math.min(100, Number(pctVal) || 0));
    const t = tone || (v >= 100 ? "bad" : v >= 80 ? "warn" : "ok");
    return `<div class="pbar"><div class="pbar-fill ${t}" style="width:${v.toFixed(1)}%"></div></div>`;
  }

  /* ---------- KPI / stat card ---------- */
  function statCard(opts) {
    return `<div class="kpi ${opts.tone || ""}" data-kpi="${esc(opts.key || "")}">
      <div class="kpi-top"><span class="kpi-ic">${icon(opts.icon || "chart", 20)}</span>${opts.tag ? `<span class="kpi-tag">${opts.tag}</span>` : ""}</div>
      <div class="kpi-label">${esc(opts.label)}</div>
      <div class="kpi-value">${opts.value}</div>
      ${opts.sub ? `<div class="kpi-sub">${opts.sub}</div>` : ""}
    </div>`;
  }

  /* ---------- summary strip ---------- */
  function summaryStrip(items) {
    return `<div class="summary-strip">${items.map(i => `
      <div class="sum-item">
        <div class="sum-label">${esc(i.label)}</div>
        <div class="sum-value ${i.tone || ""}">${i.value}</div>
      </div>`).join("")}</div>`;
  }

  root.CMP = { searchSelect, dataTable, field, textInput, textAreaInput, fieldError, clearErrors, formData, setFormData, progressBar, statCard, summaryStrip };
})(typeof window !== "undefined" ? window : globalThis);
