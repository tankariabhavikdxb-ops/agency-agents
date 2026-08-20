/* ============================================================
   NEXORA CMS — reporting engine (pure functions, testable)
   Everything the dashboard & reports need:
   enrichment, filters, P&L, budget-vs-actual, item/shop/head/
   supplier/customer analyses, trends, alerts.
   ============================================================ */
(function (root) {
  "use strict";

  const F = root.Fmt;
  const num = F.num, sum = F.sum, groupBy = F.groupBy, byId = F.byId, nameOf = F.nameOf;

  const INCOME_TYPES = ["Contract Value", "Sales Invoice"];
  const EXPENSE_TYPES = ["LPO"];

  /* ------------------------------------------------------------
     Enrichment — attach computed fields to raw rows
     ------------------------------------------------------------ */
  function enrichBudget(store) {
    const cons = new Map(); // budgetId -> {qty, amount}
    (store.expenses || []).forEach(e => {
      const c = cons.get(e.budgetId) || { qty: 0, amount: 0 };
      c.qty += num(e.qty);
      c.amount += num(e.amount);
      cons.set(e.budgetId, c);
    });
    return (store.budget || []).map(b => {
      const c = cons.get(b.id) || { qty: 0, amount: 0 };
      const budgetedQty = num(b.qty), budgetedAmt = num(b.amount);
      const pctUsed = budgetedAmt > 0 ? (c.amount / budgetedAmt) * 100 : (budgetedQty > 0 ? (c.qty / budgetedQty) * 100 : 0);
      return Object.assign({}, b, {
        consumedQty: c.qty,
        consumedAmount: c.amount,
        remainingQty: budgetedQty - c.qty,
        remainingAmount: budgetedAmt - c.amount,
        pctUsed,
        tone: pctUsed > 100.005 ? "Over" : pctUsed >= 80 ? "Near" : "OK",
      });
    });
  }

  function enrichContracts(store) {
    return (store.contracts || []).map(c => Object.assign({}, c, {
      isIncome: INCOME_TYPES.includes(c.type),
    }));
  }

  function enrichExpenses(store, budgetEnriched) {
    return (store.expenses || []).map(e => {
      const bl = byId(budgetEnriched, e.budgetId);
      return Object.assign({}, e, {
        projectName: nameOf(store.masters.Projects, e.projectId),
        shopName: nameOf(store.masters.Shops, e.shopId),
        supplierName: nameOf(store.masters.Suppliers, e.supplierId),
        headName: nameOf(store.masters.ExpenseHeads, e.headId),
        materialName: nameOf(store.masters.Materials, e.materialId),
        unitName: nameOf(store.masters.Units, e.unitId),
        budgetLabel: bl ? `${bl.headId ? nameOf(store.masters.ExpenseHeads, bl.headId) : "—"} • ${bl.materialId ? nameOf(store.masters.Materials, bl.materialId) : "—"}` : "BUDGET LINE REMOVED",
      });
    });
  }

  function enrichAll(store) {
    const budget = enrichBudget(store);
    return {
      store,
      budget,
      contracts: enrichContracts(store),
      expenses: enrichExpenses(store, budget),
    };
  }

  /* ------------------------------------------------------------
     Filters (shared shape across pages/reports)
     f = {projectId, shopId, headId, materialId, supplierId,
          customerId, from, to, type, status, paymentStatus,
          budgetStatus, onlyOver}
     ------------------------------------------------------------ */
  function filterExpenses(rows, f) {
    return (rows || []).filter(e => {
      if (f.projectId && e.projectId !== f.projectId) return false;
      if (f.shopId && e.shopId !== f.shopId) return false;
      if (f.headId && e.headId !== f.headId) return false;
      if (f.materialId && e.materialId !== f.materialId) return false;
      if (f.supplierId && e.supplierId !== f.supplierId) return false;
      if (f.paymentStatus && e.paymentStatus !== f.paymentStatus) return false;
      if (f.from && String(e.date) < String(f.from)) return false;
      if (f.to && String(e.date) > String(f.to)) return false;
      if (f.onlyOver && e.override !== "YES") return false;
      if (f.q && !F.matchSearch(f.q, `${e.projectName} ${e.shopName} ${e.supplierName} ${e.headName} ${e.materialName} ${e.invoiceNo}`)) return false;
      return true;
    });
  }

  function filterContracts(rows, f) {
    return (rows || []).filter(c => {
      if (f.projectId && c.projectId !== f.projectId) return false;
      if (f.customerId && c.customerId !== f.customerId) return false;
      if (f.supplierId && c.supplierId !== f.supplierId) return false;
      if (f.type && c.type !== f.type) return false;
      if (f.status && c.status !== f.status) return false;
      if (f.paymentStatus && c.paymentStatus !== f.paymentStatus) return false;
      if (f.from && String(c.date) < String(f.from)) return false;
      if (f.to && String(c.date) > String(f.to)) return false;
      if (f.q && !F.matchSearch(f.q, `${c.refNo} ${c.description} ${c.customerName || ""} ${c.supplierName || ""} ${c.projectName || ""}`)) return false;
      return true;
    });
  }

  function filterBudget(rows, f) {
    return (rows || []).filter(b => {
      if (f.projectId && b.projectId !== f.projectId) return false;
      if (f.shopId && b.shopId !== f.shopId) return false;
      if (f.headId && b.headId !== f.headId) return false;
      if (f.materialId && b.materialId !== f.materialId) return false;
      if (f.budgetStatus && b.status !== f.budgetStatus) return false;
      return true;
    });
  }

  /* ------------------------------------------------------------
     Core figures
     ------------------------------------------------------------ */
  function contractSums(contracts, f) {
    const cs = filterContracts(contracts, f || {});
    const income = sum(cs.filter(c => INCOME_TYPES.includes(c.type)), c => num(c.total));
    const contractValue = sum(cs.filter(c => c.type === "Contract Value"), c => num(c.total));
    const salesInvoices = sum(cs.filter(c => c.type === "Sales Invoice"), c => num(c.total));
    const lpo = sum(cs.filter(c => c.type === "LPO"), c => num(c.total));
    const collected = sum(cs.filter(c => c.type === "Sales Invoice" && c.paymentStatus === "Paid"), c => num(c.total));
    const receivable = sum(cs.filter(c => c.type === "Sales Invoice" && c.paymentStatus !== "Paid" && c.status !== "Cancelled"), c => num(c.total));
    const lpoOutstanding = sum(cs.filter(c => c.type === "LPO" && !["Received", "Cancelled"].includes(c.status)), c => num(c.total));
    return { income, contractValue, salesInvoices, lpo, collected, receivable, lpoOutstanding, count: cs.length };
  }

  /* ------------------------------------------------------------
     DASHBOARD
     ------------------------------------------------------------ */
  function dashboardKPIs(store, f) {
    const budget = enrichBudget(store);
    const expenses = enrichExpenses(store, budget);
    const contracts = enrichContracts(store);
    const fe = filterExpenses(expenses, f);
    const cs = contractSums(contracts, f);
    const fb = filterBudget(budget, f);
    const budgetApproved = sum(fb.filter(b => b.status === "Approved"), b => num(b.amount));
    const expTotal = sum(fe, e => num(e.amount));
    const profit = cs.income - expTotal;
    const margin = cs.income > 0 ? (profit / cs.income) * 100 : 0;
    const budgetUsed = budgetApproved > 0 ? (expTotal / budgetApproved) * 100 : 0;
    const activeProjects = (store.masters.Projects || []).filter(p => p.status === "Active").length;
    const pendingPay = sum(fe.filter(e => e.paymentStatus !== "Paid"), e => num(e.amount));
    return [
      { key: "projects", icon: "building", label: "Active Projects", value: String(activeProjects), sub: `${(store.masters.Projects || []).length} total projects`, tone: "" },
      { key: "income", icon: "briefcase", label: "Contracts & Invoices", value: F.money(cs.income), sub: `${cs.count} document(s)`, tone: "ok" },
      { key: "budget", icon: "doc", label: "Approved Budget", value: F.money(budgetApproved), sub: `${fb.length} budget line(s)`, tone: "" },
      { key: "expense", icon: "wallet", label: "Actual Expenses", value: F.money(expTotal), sub: `${fe.length} expense ${fe.length === 1 ? "entry" : "entries"}`, tone: "warn" },
      { key: "profit", icon: "money", label: "Net Profit (to date)", value: F.money(profit), sub: `margin ${margin.toFixed(1)}%`, tone: profit >= 0 ? "ok" : "bad" },
      { key: "budgetused", icon: "chart", label: "Budget Utilisation", value: `${budgetUsed.toFixed(1)}%`, sub: budgetUsed > 100 ? "OVER budget" : "of approved budget", tone: budgetUsed > 100 ? "bad" : budgetUsed >= 80 ? "warn" : "ok" },
      { key: "lpo", icon: "truck", label: "Open LPO Commitments", value: F.money(cs.lpoOutstanding), sub: `total LPOs ${F.money(cs.lpo)}`, tone: "warn" },
      { key: "receivable", icon: "money", label: "Outstanding Invoices", value: F.money(cs.receivable), sub: `collected ${F.money(cs.collected)}`, tone: cs.receivable > 0 ? "bad" : "ok" },
    ];
  }

  function dashboardCharts(store, f) {
    const budget = enrichBudget(store);
    const expenses = enrichExpenses(store, budget);
    const contracts = enrichContracts(store);
    const fe = filterExpenses(expenses, f);
    const fb = filterBudget(budget, f);
    const fc = filterContracts(contracts, f);
    const projects = store.masters.Projects || [];

    // 1. Budget vs Expense by project (bar)
    const projIds = [...new Set([...fb.map(b => b.projectId), ...fe.map(e => e.projectId)])];
    const pLabels = projIds.map(id => {
      const p = byId(projects, id);
      return p ? p.name : "Unknown";
    });
    const budgetByProj = projIds.map(id => sum(fb.filter(b => b.projectId === id), b => num(b.amount)));
    const expByProj = projIds.map(id => sum(fe.filter(e => e.projectId === id), e => num(e.amount)));

    // 2. Expenses by head (doughnut)
    const byHead = groupBy(fe, e => e.headId);
    const headLabels = [...byHead.keys()].map(id => nameOf(store.masters.ExpenseHeads, id));
    const headData = [...byHead.values()].map(list => sum(list, e => num(e.amount)));

    // 3. Monthly trend (line) — income vs expense
    const from = f && f.from ? f.from : minDate([...fe.map(e => e.date), ...fc.map(c => c.date)]);
    const to = f && f.to ? f.to : F.todayISO();
    const months = monthRange(from, to);
    const expByMonth = months.map(m => sum(fe.filter(e => F.monthKey(e.date) === m), e => num(e.amount)));
    const incByMonth = months.map(m => sum(fc.filter(c => c.isIncome && F.monthKey(c.date) === m), c => num(c.total)));

    // 4. Top materials (hbar)
    const byMat = groupBy(fe, e => e.materialId);
    const matList = [...byMat.values()]
      .map(list => ({ name: nameOf(store.masters.Materials, list[0].materialId), amt: sum(list, e => num(e.amount)) }))
      .sort((a, b) => b.amt - a.amt).slice(0, 8);

    return [
      { type: "bar", title: "Budget vs Actual Expenses by Project", labels: pLabels, series: [
        { label: "Approved Budget", data: budgetByProj, color: "#0ea5e9" },
        { label: "Actual Expenses", data: expByProj, color: "#f59e0b" },
      ] },
      { type: "doughnut", title: "Expenses by Expense Head", labels: headLabels, series: [
        { label: "Amount", data: headData, color: "#f59e0b" },
      ] },
      { type: "line", title: "Monthly Income vs Expenses", labels: months.map(F.fmtMonth), series: [
        { label: "Income (Contracts + Invoices)", data: incByMonth, color: "#059669" },
        { label: "Expenses", data: expByMonth, color: "#e11d48" },
      ] },
      { type: "hbar", title: "Top Materials by Spend", labels: matList.map(m => m.name), series: [
        { label: "Spend", data: matList.map(m => m.amt), color: "#f59e0b" },
      ] },
    ];
  }

  function dashboardAlerts(store) {
    const budget = enrichBudget(store);
    const expenses = enrichExpenses(store, budget);
    const contracts = enrichContracts(store);
    const alerts = [];
    const over = budget.filter(b => b.pctUsed > 100.005);
    const near = budget.filter(b => b.pctUsed >= 80 && b.pctUsed <= 100.005);
    over.slice(0, 5).forEach(b => alerts.push({
      tone: "bad", title: "Budget line exceeded",
      msg: `${b.materialId ? nameOf(store.masters.Materials, b.materialId) : "—"} (${b.projectId ? nameOf(store.masters.Projects, b.projectId) : "—"}) at ${b.pctUsed.toFixed(1)}% of budget`,
    }));
    near.slice(0, 5).forEach(b => alerts.push({
      tone: "warn", title: "Budget line near limit (≥80%)",
      msg: `${b.materialId ? nameOf(store.masters.Materials, b.materialId) : "—"} (${b.projectId ? nameOf(store.masters.Projects, b.projectId) : "—"}) at ${b.pctUsed.toFixed(1)}%`,
    }));
    (contracts || []).filter(c => c.type === "Sales Invoice" && c.paymentStatus !== "Paid" && c.status !== "Cancelled")
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 5)
      .forEach(c => alerts.push({
        tone: "bad", title: "Invoice not fully paid",
        msg: `${c.refNo} — ${F.money(c.total)} (${c.customerId ? nameOf(store.masters.Customers, c.customerId) : "—"})`,
      }));
    const orphans = (store.expenses || []).filter(e => !byId(budget, e.budgetId));
    orphans.slice(0, 3).forEach(e => alerts.push({
      tone: "bad", title: "Expense references a removed budget line",
      msg: `${e.invoiceNo || "no invoice"} — ${F.money(e.amount)} on ${e.date}`,
    }));
    return alerts;
  }

  function dashboardActivity(store, n) {
    return (store.audit || []).slice().reverse().slice(0, n || 8);
  }

  /* ------------------------------------------------------------
     REPORTS
     ------------------------------------------------------------ */
  function report(store, key, f) {
    const E = enrichAll(store);
    const cs = contractSums(E.contracts, f);
    const fe = filterExpenses(E.expenses, f);
    const fc = filterContracts(E.contracts, f);
    const fb = filterBudget(E.budget, f);
    const expTotal = sum(fe, e => num(e.amount));
    const budgetTotal = sum(fb.filter(b => b.status === "Approved"), b => num(b.amount));
    const profit = cs.income - expTotal;
    const variance = budgetTotal - expTotal;

    const cols = {
      money: (v) => `<span class="num">${F.money(v)}</span>`,
      qty: (v) => `<span class="num">${F.qty(v)}</span>`,
      date: (v) => F.fmtDate(v),
    };

    switch (key) {

      /* ============ P&L (overall + per project) ============ */
      case "pl": {
        const byProj = groupBy(fb.concat(fe).concat(fc), r => r.projectId);
        const rows = [...byProj.keys()].filter(id => {
          if (f.projectId) return id === f.projectId;
          return true;
        }).map(id => {
          const p = byId(store.masters.Projects, id);
          const bls = fb.filter(b => b.projectId === id);
          const exs = fe.filter(e => e.projectId === id);
          const cts = fc.filter(c => c.projectId === id);
          const income = sum(cts.filter(c => c.isIncome), c => num(c.total));
          const lpo = sum(cts.filter(c => c.type === "LPO"), c => num(c.total));
          const bud = sum(bls.filter(b => b.status === "Approved"), b => num(b.amount));
          const exp = sum(exs, e => num(e.amount));
          const prof = income - exp;
          return {
            project: p ? p.name : "(Unassigned)", client: p ? p.client : "—", status: p ? p.status : "—",
            income, lpo, budget: bud, expenses: exp,
            variance: bud - exp, profit: prof,
            pctUsed: bud > 0 ? (exp / bud) * 100 : 0,
            margin: income > 0 ? (prof / income) * 100 : 0,
          };
        });
        return {
          title: "Profit & Loss Statement", subtitle: "Profitability at any stage of running projects",
          cards: [
            { label: "Total Income", value: F.money(cs.income), tone: "ok" },
            { label: "Actual Expenses", value: F.money(expTotal), tone: "warn" },
            { label: "Net Profit", value: F.money(profit), tone: profit >= 0 ? "ok" : "bad" },
            { label: "Profit Margin", value: cs.income ? F.pct(profit / cs.income * 100) : "—", tone: profit >= 0 ? "ok" : "bad" },
            { label: "Approved Budget", value: F.money(budgetTotal), tone: "" },
            { label: "Budget Variance", value: F.money(variance), tone: variance < 0 ? "bad" : "ok" },
          ],
          charts: [
            { type: "bar", title: "Income vs Expenses vs Profit by Project", labels: rows.map(r => r.project), series: [
              { label: "Income", data: rows.map(r => r.income), color: "#059669" },
              { label: "Expenses", data: rows.map(r => r.expenses), color: "#e11d48" },
              { label: "Profit", data: rows.map(r => r.profit), color: "#f59e0b" },
            ] },
          ],
          tables: [{
            title: "Profitability by Project", columns: [
              { key: "project", label: "Project" },
              { key: "client", label: "Client" },
              { key: "status", label: "Status", render: r => root.UI ? root.UI.pill(r.status) : r.status },
              { key: "income", label: "Income (MK)", align: "right", render: r => cols.money(r.income) },
              { key: "lpo", label: "LPO (MK)", align: "right", render: r => cols.money(r.lpo) },
              { key: "budget", label: "Budget (MK)", align: "right", render: r => cols.money(r.budget) },
              { key: "expenses", label: "Expenses (MK)", align: "right", render: r => cols.money(r.expenses) },
              { key: "variance", label: "Variance (MK)", align: "right", render: r => cols.money(r.variance) },
              { key: "pctUsed", label: "Budget Used", align: "right", render: r => root.UI ? root.UI.usagePill(r.pctUsed) : F.pct(r.pctUsed) },
              { key: "profit", label: "Net Profit (MK)", align: "right", render: r => `<span class="num ${r.profit < 0 ? "neg" : "pos"}">${F.money(r.profit)}</span>` },
            ],
            rows,
            foot: [
              { label: "Totals", values: ["", "", "", F.money(sum(rows, r => r.income)), F.money(sum(rows, r => r.lpo)), F.money(sum(rows, r => r.budget)), F.money(sum(rows, r => r.expenses)), F.money(sum(rows, r => r.variance)), "", F.money(sum(rows, r => r.profit))] },
            ],
          }],
        };
      }

      /* ============ Project-wise ============ */
      case "project": {
        const rows = (store.masters.Projects || [])
          .filter(p => !f.projectId || p.id === f.projectId)
          .map(p => {
            const bls = fb.filter(b => b.projectId === p.id);
            const exs = fe.filter(e => e.projectId === p.id);
            const cts = fc.filter(c => c.projectId === p.id);
            const cv = sum(cts.filter(c => c.type === "Contract Value"), c => num(c.total));
            const inv = sum(cts.filter(c => c.type === "Sales Invoice"), c => num(c.total));
            const lpo = sum(cts.filter(c => c.type === "LPO"), c => num(c.total));
            const bud = sum(bls.filter(b => b.status === "Approved"), b => num(b.amount));
            const exp = sum(exs, e => num(e.amount));
            return {
              project: p.name, code: p.code, client: p.client, status: p.status,
              start: p.startDate, end: p.endDate,
              contractValue: cv, invoices: inv, lpo,
              budget: bud, expenses: exp, remaining: bud - exp,
              pctUsed: bud > 0 ? exp / bud * 100 : 0,
              profit: cv + inv - exp,
            };
          });
        return {
          title: "Project-wise Report", subtitle: "Budget vs expenses and profitability per project",
          cards: [
            { label: "Projects", value: String(rows.length), tone: "" },
            { label: "Total Contract Value", value: F.money(sum(rows, r => r.contractValue)), tone: "ok" },
            { label: "Total Expenses", value: F.money(sum(rows, r => r.expenses)), tone: "warn" },
            { label: "Budget Remaining", value: F.money(sum(rows, r => r.remaining)), tone: sum(rows, r => r.remaining) < 0 ? "bad" : "ok" },
          ],
          tables: [{
            title: "All Projects", columns: [
              { key: "code", label: "Code" },
              { key: "project", label: "Project" },
              { key: "client", label: "Client" },
              { key: "status", label: "Status", render: r => root.UI ? root.UI.pill(r.status) : r.status },
              { key: "contractValue", label: "Contract Value", align: "right", render: r => cols.money(r.contractValue) },
              { key: "invoices", label: "Invoiced", align: "right", render: r => cols.money(r.invoices) },
              { key: "lpo", label: "LPO", align: "right", render: r => cols.money(r.lpo) },
              { key: "budget", label: "Budget", align: "right", render: r => cols.money(r.budget) },
              { key: "expenses", label: "Expenses", align: "right", render: r => cols.money(r.expenses) },
              { key: "remaining", label: "Remaining", align: "right", render: r => `<span class="num ${r.remaining < 0 ? "neg" : ""}">${F.money(r.remaining)}</span>` },
              { key: "pctUsed", label: "Used", align: "right", render: r => root.UI ? root.UI.usagePill(r.pctUsed) : F.pct(r.pctUsed) },
              { key: "profit", label: "Net Profit", align: "right", render: r => `<span class="num ${r.profit < 0 ? "neg" : "pos"}">${F.money(r.profit)}</span>` },
            ],
            rows,
          }],
        };
      }

      /* ============ Budget vs Actual (item-wise) ============ */
      case "budgetactual": {
        const rows = fb.map(b => ({
          project: b.projectId ? nameOf(store.masters.Projects, b.projectId) : "—",
          head: b.headId ? nameOf(store.masters.ExpenseHeads, b.headId) : "—",
          material: b.materialId ? nameOf(store.masters.Materials, b.materialId) : "—",
          shop: b.shopId ? nameOf(store.masters.Shops, b.shopId) : "—",
          unit: b.unitId ? nameOf(store.masters.Units, b.unitId) : "—",
          status: b.status,
          qty: b.qty, rate: b.rate, amount: b.amount,
          consumedQty: b.consumedQty, consumedAmount: b.consumedAmount,
          remainingQty: b.remainingQty, remainingAmount: b.remainingAmount,
          pctUsed: b.pctUsed, tone: b.tone,
        })).sort((a, b) => b.pctUsed - a.pctUsed);
        const over = rows.filter(r => r.pctUsed > 100.005).length;
        const near = rows.filter(r => r.pctUsed >= 80 && r.pctUsed <= 100.005).length;
        return {
          title: "Budget vs Actual Expenses", subtitle: "Item-wise comparison — expenses cannot exceed the budgeted line",
          cards: [
            { label: "Budget Lines", value: String(rows.length), tone: "" },
            { label: "Budgeted (Approved)", value: F.money(budgetTotal), tone: "" },
            { label: "Consumed", value: F.money(expTotal), tone: "warn" },
            { label: "Remaining", value: F.money(variance), tone: variance < 0 ? "bad" : "ok" },
            { label: "Lines ≥80% used", value: String(near), tone: "warn" },
            { label: "Lines over budget", value: String(over), tone: over ? "bad" : "ok" },
          ],
          charts: [{
            type: "hbar", title: "Budget utilisation by line (top 12)", labels: rows.slice(0, 12).map(r => `${r.material} (${r.project})`),
            series: [{ label: "% used", data: rows.slice(0, 12).map(r => Math.min(r.pctUsed, 130)), color: "#f59e0b" }],
          }],
          tables: [{
            title: "Budget Lines vs Consumption", columns: [
              { key: "project", label: "Project" },
              { key: "head", label: "Expense Head" },
              { key: "material", label: "Material / Item" },
              { key: "shop", label: "Shop" },
              { key: "qty", label: "BQty", align: "right", render: r => cols.qty(r.qty) },
              { key: "rate", label: "Rate", align: "right", render: r => cols.money(r.rate) },
              { key: "amount", label: "Budget", align: "right", render: r => cols.money(r.amount) },
              { key: "consumedQty", label: "Used Qty", align: "right", render: r => cols.qty(r.consumedQty) },
              { key: "consumedAmount", label: "Used Amount", align: "right", render: r => cols.money(r.consumedAmount) },
              { key: "remainingAmount", label: "Remaining", align: "right", render: r => `<span class="num ${r.remainingAmount < 0 ? "neg" : ""}">${F.money(r.remainingAmount)}</span>` },
              { key: "pctUsed", label: "Utilisation", align: "right", render: r => `<div class="pbar-cell">${root.UI ? root.UI.progressBar(r.pctUsed, r.tone === "Over" ? "bad" : r.tone === "Near" ? "warn" : "ok") : ""}<span class="pbar-pct">${F.pct(r.pctUsed)}</span></div>` },
            ],
            rows,
          }],
        };
      }

      /* ============ Material-wise ============ */
      case "material": {
        const g = groupBy(fe, e => e.materialId);
        const rows = [...g.entries()].map(([id, list]) => {
          const m = byId(store.masters.Materials, id);
          const projs = new Set(list.map(e => e.projectId));
          return {
            material: m ? m.name : "—", unit: m ? m.unit : "—",
            qty: sum(list, e => num(e.qty)), amount: sum(list, e => num(e.amount)),
            entries: list.length, projects: projs.size,
            avgRate: sum(list, e => num(e.qty)) > 0 ? sum(list, e => num(e.amount)) / sum(list, e => num(e.qty)) : 0,
          };
        }).sort((a, b) => b.amount - a.amount);
        return {
          title: "Item-wise Report", subtitle: "Spend by material / item across the selected range",
          cards: [
            { label: "Distinct Items", value: String(rows.length), tone: "" },
            { label: "Total Spend", value: F.money(expTotal), tone: "warn" },
            { label: "Top Item", value: rows[0] ? rows[0].material : "—", tone: "ok" },
          ],
          charts: [{
            type: "hbar", title: "Top 12 items by spend", labels: rows.slice(0, 12).map(r => r.material),
            series: [{ label: "Spend", data: rows.slice(0, 12).map(r => r.amount), color: "#f59e0b" }],
          }],
          tables: [{
            title: "Materials / Items", columns: [
              { key: "material", label: "Material / Item" },
              { key: "unit", label: "Unit" },
              { key: "projects", label: "Projects", align: "right" },
              { key: "entries", label: "Entries", align: "right" },
              { key: "qty", label: "Total Qty", align: "right", render: r => cols.qty(r.qty) },
              { key: "avgRate", label: "Avg Rate", align: "right", render: r => cols.money(r.avgRate) },
              { key: "amount", label: "Total Amount", align: "right", render: r => cols.money(r.amount) },
              { key: "share", label: "Share", align: "right", render: r => F.pct(expTotal > 0 ? r.amount / expTotal * 100 : 0) },
            ],
            rows,
            foot: [{ label: "Totals", values: ["", "", "", sum(rows, r => r.entries), sum(rows, r => r.qty), "", F.money(expTotal), "100.0%"] }],
          }],
        };
      }

      /* ============ Shop-wise ============ */
      case "shop": {
        const g = groupBy(fe, e => e.shopId);
        const rows = [...g.entries()].map(([id, list]) => {
          const s = byId(store.masters.Shops, id);
          const budgetFor = sum(fb.filter(b => b.shopId === id), b => num(b.amount));
          const exp = sum(list, e => num(e.amount));
          return { shop: s ? s.name : "—", location: s ? s.location : "—", entries: list.length, budget: budgetFor, expenses: exp, variance: budgetFor - exp, pctUsed: budgetFor > 0 ? exp / budgetFor * 100 : 0 };
        }).sort((a, b) => b.expenses - a.expenses);
        return {
          title: "Shop-wise Report", subtitle: "Expenses and budget utilisation per shop / site store",
          cards: [
            { label: "Shops Active", value: String((store.masters.Shops || []).filter(s => s.status === "Active").length), tone: "" },
            { label: "Total Spend", value: F.money(expTotal), tone: "warn" },
          ],
          charts: [{
            type: "bar", title: "Expenses by shop", labels: rows.map(r => r.shop),
            series: [{ label: "Expenses", data: rows.map(r => r.expenses), color: "#f59e0b" }],
          }],
          tables: [{
            title: "Shops / Site Stores", columns: [
              { key: "shop", label: "Shop" },
              { key: "location", label: "Location" },
              { key: "entries", label: "Entries", align: "right" },
              { key: "budget", label: "Budget", align: "right", render: r => cols.money(r.budget) },
              { key: "expenses", label: "Expenses", align: "right", render: r => cols.money(r.expenses) },
              { key: "variance", label: "Variance", align: "right", render: r => `<span class="num ${r.variance < 0 ? "neg" : ""}">${F.money(r.variance)}</span>` },
              { key: "pctUsed", label: "Used", align: "right", render: r => root.UI ? root.UI.usagePill(r.pctUsed) : F.pct(r.pctUsed) },
            ],
            rows,
          }],
        };
      }

      /* ============ Head-wise ============ */
      case "head": {
        const g = groupBy(fe, e => e.headId);
        const rows = [...g.entries()].map(([id, list]) => {
          const h = byId(store.masters.ExpenseHeads, id);
          const budgetFor = sum(fb.filter(b => b.headId === id), b => num(b.amount));
          const exp = sum(list, e => num(e.amount));
          return { head: h ? h.name : "—", category: h ? h.category : "—", entries: list.length, budget: budgetFor, expenses: exp, variance: budgetFor - exp, pctUsed: budgetFor > 0 ? exp / budgetFor * 100 : 0 };
        }).sort((a, b) => b.expenses - a.expenses);
        return {
          title: "Expense Head-wise Report", subtitle: "Spend grouped by expense head",
          cards: [
            { label: "Heads Used", value: String(rows.length), tone: "" },
            { label: "Total Spend", value: F.money(expTotal), tone: "warn" },
            { label: "Budget for Heads", value: F.money(budgetTotal), tone: "" },
          ],
          charts: [{
            type: "doughnut", title: "Expenses by head", labels: rows.map(r => r.head),
            series: [{ label: "Amount", data: rows.map(r => r.expenses), color: "#f59e0b" }],
          }],
          tables: [{
            title: "Expense Heads", columns: [
              { key: "head", label: "Expense Head" },
              { key: "category", label: "Category" },
              { key: "entries", label: "Entries", align: "right" },
              { key: "budget", label: "Budget", align: "right", render: r => cols.money(r.budget) },
              { key: "expenses", label: "Expenses", align: "right", render: r => cols.money(r.expenses) },
              { key: "variance", label: "Variance", align: "right", render: r => `<span class="num ${r.variance < 0 ? "neg" : ""}">${F.money(r.variance)}</span>` },
              { key: "pctUsed", label: "Used", align: "right", render: r => root.UI ? root.UI.usagePill(r.pctUsed) : F.pct(r.pctUsed) },
            ],
            rows,
          }],
        };
      }

      /* ============ Supplier-wise ============ */
      case "supplier": {
        const g = groupBy(fe, e => e.supplierId);
        const rows = [...g.entries()].map(([id, list]) => {
          const s = byId(store.masters.Suppliers, id);
          const lpos = filterContracts(E.contracts, Object.assign({}, f, { type: "LPO", supplierId: id }));
          const due = sum(list.filter(e => e.paymentStatus !== "Paid"), e => num(e.amount));
          return {
            supplier: s ? s.name : "—", phone: s ? s.phone : "—",
            entries: list.length, lpoValue: sum(lpos, c => num(c.total)),
            expenses: sum(list, e => num(e.amount)), due,
          };
        }).sort((a, b) => b.expenses - a.expenses);
        return {
          title: "Supplier-wise Report", subtitle: "Purchases, LPOs and amounts due per supplier",
          cards: [
            { label: "Suppliers Used", value: String(rows.length), tone: "" },
            { label: "Total Purchases", value: F.money(expTotal), tone: "warn" },
            { label: "Amount Due (unpaid)", value: F.money(sum(rows, r => r.due)), tone: sum(rows, r => r.due) > 0 ? "bad" : "ok" },
          ],
          charts: [{
            type: "bar", title: "Purchases by supplier", labels: rows.map(r => r.supplier),
            series: [{ label: "Purchases", data: rows.map(r => r.expenses), color: "#0ea5e9" }],
          }],
          tables: [{
            title: "Suppliers", columns: [
              { key: "supplier", label: "Supplier" },
              { key: "phone", label: "Phone" },
              { key: "entries", label: "Bills", align: "right" },
              { key: "lpoValue", label: "LPO Value", align: "right", render: r => cols.money(r.lpoValue) },
              { key: "expenses", label: "Purchases", align: "right", render: r => cols.money(r.expenses) },
              { key: "due", label: "Due (unpaid)", align: "right", render: r => `<span class="num ${r.due > 0 ? "neg" : "pos"}">${F.money(r.due)}</span>` },
            ],
            rows,
          }],
        };
      }

      /* ============ Customer-wise ============ */
      case "customer": {
        const g = groupBy(filterContracts(E.contracts, f).filter(c => c.isIncome), c => c.customerId);
        const rows = [...g.entries()].map(([id, list]) => {
          const c = byId(store.masters.Customers, id);
          const cv = sum(list.filter(x => x.type === "Contract Value"), x => num(x.total));
          const inv = sum(list.filter(x => x.type === "Sales Invoice"), x => num(x.total));
          const collected = sum(list.filter(x => x.paymentStatus === "Paid"), x => num(x.total));
          return { customer: c ? c.name : "—", contractValue: cv, invoices: inv, total: cv + inv, collected, outstanding: cv + inv - collected };
        }).sort((a, b) => b.total - a.total);
        return {
          title: "Customer-wise Report", subtitle: "Contract values, invoices and outstanding balances per customer",
          cards: [
            { label: "Customers", value: String(rows.length), tone: "" },
            { label: "Total Billed", value: F.money(sum(rows, r => r.total)), tone: "ok" },
            { label: "Collected", value: F.money(sum(rows, r => r.collected)), tone: "ok" },
            { label: "Outstanding", value: F.money(sum(rows, r => r.outstanding)), tone: sum(rows, r => r.outstanding) > 0 ? "bad" : "ok" },
          ],
          charts: [{
            type: "bar", title: "Billed vs collected by customer", labels: rows.map(r => r.customer), series: [
              { label: "Billed", data: rows.map(r => r.total), color: "#0ea5e9" },
              { label: "Collected", data: rows.map(r => r.collected), color: "#059669" },
            ] },
          ],
          tables: [{
            title: "Customers", columns: [
              { key: "customer", label: "Customer" },
              { key: "contractValue", label: "Contract Value", align: "right", render: r => cols.money(r.contractValue) },
              { key: "invoices", label: "Invoices", align: "right", render: r => cols.money(r.invoices) },
              { key: "total", label: "Total", align: "right", render: r => cols.money(r.total) },
              { key: "collected", label: "Collected", align: "right", render: r => cols.money(r.collected) },
              { key: "outstanding", label: "Outstanding", align: "right", render: r => `<span class="num ${r.outstanding > 0 ? "neg" : "pos"}">${F.money(r.outstanding)}</span>` },
            ],
            rows,
          }],
        };
      }

      /* ============ LPO report ============ */
      case "lpo": {
        const rows = filterContracts(E.contracts, Object.assign({}, f, { type: "LPO" })).map(c => ({
          refNo: c.refNo, date: c.date, supplier: nameOf(store.masters.Suppliers, c.supplierId),
          project: nameOf(store.masters.Projects, c.projectId), description: c.description,
          amount: c.amount, total: c.total, status: c.status, paymentStatus: c.paymentStatus,
        }));
        return {
          title: "LPO (Local Purchase Order) Report", subtitle: "Purchase commitments to suppliers",
          cards: [
            { label: "LPOs", value: String(rows.length), tone: "" },
            { label: "LPO Value", value: F.money(sum(rows, r => num(r.total))), tone: "warn" },
            { label: "Open / Partially Received", value: F.money(sum(rows.filter(r => !["Received", "Cancelled"].includes(r.status)), r => num(r.total))), tone: "warn" },
          ],
          tables: [{
            title: "Purchase Orders", columns: [
              { key: "refNo", label: "LPO No." },
              { key: "date", label: "Date", render: r => cols.date(r.date) },
              { key: "supplier", label: "Supplier" },
              { key: "project", label: "Project" },
              { key: "description", label: "Description" },
              { key: "total", label: "Total", align: "right", render: r => cols.money(r.total) },
              { key: "status", label: "Status", render: r => root.UI ? root.UI.pill(r.status) : r.status },
              { key: "paymentStatus", label: "Payment", render: r => root.UI ? root.UI.pill(r.paymentStatus) : r.paymentStatus },
            ],
            rows,
          }],
        };
      }

      /* ============ Expense ledger ============ */
      case "ledger": {
        const rows = fe.map(e => ({
          date: e.date, invoiceNo: e.invoiceNo, project: e.projectName, shop: e.shopName,
          supplier: e.supplierName, head: e.headName, material: e.materialName, unit: e.unitName,
          qty: e.qty, rate: e.rate, amount: e.amount, paymentStatus: e.paymentStatus,
          override: e.override, enteredBy: e.createdBy,
        })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        return {
          title: "Expense Ledger", subtitle: "Detailed register of every actual expense entry",
          cards: [
            { label: "Entries", value: String(rows.length), tone: "" },
            { label: "Total", value: F.money(expTotal), tone: "warn" },
            { label: "Unpaid", value: F.money(sum(rows.filter(r => r.paymentStatus !== "Paid"), r => num(r.amount))), tone: "bad" },
            { label: "Over-budget overrides", value: String(rows.filter(r => r.override === "YES").length), tone: "warn" },
          ],
          tables: [{
            title: "Expense Entries", columns: [
              { key: "date", label: "Date", render: r => cols.date(r.date), nowrap: true },
              { key: "invoiceNo", label: "Invoice / Ref", nowrap: true },
              { key: "project", label: "Project" },
              { key: "shop", label: "Shop" },
              { key: "supplier", label: "Supplier" },
              { key: "head", label: "Head" },
              { key: "material", label: "Material / Item" },
              { key: "qty", label: "Qty", align: "right", render: r => cols.qty(r.qty) },
              { key: "rate", label: "Rate", align: "right", render: r => cols.money(r.rate) },
              { key: "amount", label: "Amount", align: "right", render: r => cols.money(r.amount) },
              { key: "paymentStatus", label: "Payment", render: r => root.UI ? root.UI.pill(r.paymentStatus) : r.paymentStatus },
              { key: "override", label: "Override", render: r => r.override === "YES" ? root.UI ? root.UI.pill("Over budget", "bad") : "YES" : "—" },
              { key: "enteredBy", label: "Entered By", nowrap: true },
            ],
            rows,
            foot: [{ label: "Totals", values: ["", "", "", "", "", "", "", "", "", "", F.money(expTotal), "", "", ""] }],
          }],
        };
      }

      /* ============ Monthly trend ============ */
      case "monthly": {
        const from = f && f.from ? f.from : minDate([...fe.map(e => e.date), ...fc.map(c => c.date)]);
        const to = f && f.to ? f.to : F.todayISO();
        const months = monthRange(from, to);
        const rows = months.map(m => {
          const inc = sum(fc.filter(c => c.isIncome && F.monthKey(c.date) === m), c => num(c.total));
          const exp = sum(fe.filter(e => F.monthKey(e.date) === m), e => num(e.amount));
          return { month: F.fmtMonth(m), income: inc, expenses: exp, profit: inc - exp };
        });
        return {
          title: "Monthly Trend", subtitle: "Income and expenses month by month",
          cards: [
            { label: "Months", value: String(rows.length), tone: "" },
            { label: "Total Income", value: F.money(sum(rows, r => r.income)), tone: "ok" },
            { label: "Total Expenses", value: F.money(sum(rows, r => r.expenses)), tone: "warn" },
            { label: "Net", value: F.money(sum(rows, r => r.profit)), tone: sum(rows, r => r.profit) >= 0 ? "ok" : "bad" },
          ],
          charts: [{
            type: "line", title: "Monthly income vs expenses", labels: rows.map(r => r.month), series: [
              { label: "Income", data: rows.map(r => r.income), color: "#059669" },
              { label: "Expenses", data: rows.map(r => r.expenses), color: "#e11d48" },
            ] },
          ],
          tables: [{
            title: "Monthly Summary", columns: [
              { key: "month", label: "Month" },
              { key: "income", label: "Income", align: "right", render: r => cols.money(r.income) },
              { key: "expenses", label: "Expenses", align: "right", render: r => cols.money(r.expenses) },
              { key: "profit", label: "Net Profit", align: "right", render: r => `<span class="num ${r.profit < 0 ? "neg" : "pos"}">${F.money(r.profit)}</span>` },
            ],
            rows,
          }],
        };
      }
    }
    return { title: "Report", tables: [] };
  }

  /* ------------------------------------------------------------
     helpers
     ------------------------------------------------------------ */
  function minDate(list) {
    const d = (list || []).filter(Boolean).sort()[0];
    return d || "2024-01-01";
  }

  function monthRange(fromISO, toISO) {
    const out = [];
    if (!fromISO || !toISO) return out;
    const s = fromISO.slice(0, 7).split("-").map(Number);
    const e = toISO.slice(0, 7).split("-").map(Number);
    let y = s[0], m = s[1];
    while (y < e[0] || (y === e[0] && m <= e[1])) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m > 12) { m = 1; y++; }
      if (out.length > 60) break;
    }
    return out;
  }

  root.RC = { enrichAll, enrichBudget, enrichContracts, enrichExpenses, filterExpenses, filterContracts, filterBudget, contractSums, dashboardKPIs, dashboardCharts, dashboardAlerts, dashboardActivity, report, monthRange, INCOME_TYPES, EXPENSE_TYPES };
})(typeof window !== "undefined" ? window : globalThis);
