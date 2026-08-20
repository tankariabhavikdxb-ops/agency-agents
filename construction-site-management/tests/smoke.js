/* ============================================================
   NEXORA CMS — smoke tests (run with: node tests/smoke.js)
   Validates the business rules and reporting engine without
   a browser: strict budget control, duplicate checks, P&L math.
   ============================================================ */
"use strict";

const path = require("path");
const fs = require("fs");
const vm = require("vm");

const root = path.join(__dirname, "..");
const files = [
  "js/format.js",
  "js/ui.js",
  "js/components.js",
  "js/charts.js",
  "js/reports-core.js",
  "js/mock.js",
];

function load(file) {
  const ctx = {
    // NOTE: no `window` key — UMD modules fall back to globalThis
    console, setTimeout, clearTimeout,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const code = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInContext(code, ctx, { filename: file });
  return ctx;
}

let pass = 0, fail = 0;
function check(name, fn) {
  try {
    fn();
    pass++;
    console.log("  ✅ " + name);
  } catch (e) {
    fail++;
    console.log("  ❌ " + name + " — " + (e && e.message));
  }
}

console.log("Nexora CMS smoke tests\n");

const ctx = load(files[0]);
["js/ui.js", "js/components.js", "js/charts.js", "js/reports-core.js", "js/mock.js"].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
});

const F = ctx.Fmt;
const RC = ctx.RC;
const Mock = ctx.Mock;

// ---------- mock backend (in-memory storage) ----------
const storage = {
  data: new Map(),
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; },
  setItem(k, v) { this.data.set(k, v); },
  removeItem(k) { this.data.delete(k); },
};
const db = new Mock.MockDB(storage);
const admin = { name: "Bhavik Tankaria", role: "Admin" };

(async () => {
  const call = (action, payload) => Mock.handle(db, action, payload || {}, { user: admin });

  console.log("— Strict budget control —");
  check("expense without a budget line is rejected", async () => {
    const r = await call("saveExpense", { data: { projectId: "P1", date: "2026-08-20", supplierId: "S1", qty: 1, rate: 100 } });
    if (r.ok) throw new Error("should have been blocked");
  });
  check("expense against a Hold budget line is rejected", async () => {
    const bl = db.db.budget.find(b => b.id === "B50");
    const r = await call("saveExpense", { data: { projectId: bl.projectId, budgetId: "B50", date: "2026-08-20", supplierId: "S1", qty: 1, rate: 100, status: "Hold" } });
    // set the line to Hold first through saveBudgetLine
    const setHold = await call("saveBudgetLine", { id: "B50", data: { projectId: bl.projectId, headId: bl.headId, materialId: bl.materialId, shopId: bl.shopId, unitId: bl.unitId, qty: bl.qty, rate: bl.rate, status: "Hold" } });
    if (!setHold.ok) throw new Error("setup failed: " + setHold.error.message);
    const r2 = await call("saveExpense", { data: { projectId: bl.projectId, budgetId: "B50", date: "2026-08-20", supplierId: "S1", qty: 1, rate: 100 } });
    if (r2.ok) throw new Error("should have been blocked on Hold line");
    // restore
    await call("saveBudgetLine", { id: "B50", data: { projectId: bl.projectId, headId: bl.headId, materialId: bl.materialId, shopId: bl.shopId, unitId: bl.unitId, qty: bl.qty, rate: bl.rate, status: "Approved" } });
  });
  check("expense over remaining budget is blocked (strict mode NO)", async () => {
    const settings = Object.assign({}, db.db.settings, { allowOverBudget: "NO" });
    const r = Mock.validateExpense(db.db, { projectId: "P1", budgetId: "B02", date: "2026-08-20", supplierId: "S1", qty: 99999, rate: 28000 }, null, settings, admin);
    if (!r || r.ok !== false || r.error.code !== "OVER_BUDGET") throw new Error("expected OVER_BUDGET, got " + JSON.stringify(r));
  });
  check("over-budget override requires admin + reason (allow YES)", async () => {
    const settings = Object.assign({}, db.db.settings, { allowOverBudget: "YES" });
    const noReason = Mock.validateExpense(db.db, { projectId: "P1", budgetId: "B02", date: "2026-08-20", supplierId: "S1", qty: 99999, rate: 28000, override: "YES" }, null, settings, admin);
    if (!noReason || noReason.ok !== false) throw new Error("override without reason should fail");
    const clerk = Mock.validateExpense(db.db, { projectId: "P1", budgetId: "B02", date: "2026-08-20", supplierId: "S1", qty: 99999, rate: 28000, override: "YES", overrideReason: "x" }, null, settings, { role: "Clerk" });
    if (!clerk || clerk.ok !== false) throw new Error("clerk override should fail");
    const good = Mock.validateExpense(db.db, { projectId: "P1", budgetId: "B02", date: "2026-08-20", supplierId: "S1", qty: 99999, rate: 28000, override: "YES", overrideReason: "Approved by PM" }, null, settings, admin);
    if (!good || good.ok !== false) throw new Error("admin override with reason should pass, got " + JSON.stringify(good));
  });
  check("expense derives head/material/shop from the budget line (cannot be faked)", async () => {
    const r = await call("saveExpense", { data: { projectId: "P1", budgetId: "B01", date: "2026-08-01", supplierId: "S1", invoiceNo: "TEST-SMOKE-01", qty: 1, rate: 100, headId: "H9", materialId: "M36", shopId: "SH6" } });
    if (!r.ok) throw new Error("save failed: " + r.error.message);
    const e = db.db.expenses.find(x => x.id === r.data.rows[0].id) || db.db.expenses[0];
    const bl = db.db.budget.find(b => b.id === "B01");
    if (e.headId !== bl.headId || e.materialId !== bl.materialId || e.shopId !== bl.shopId) throw new Error("fields not derived from budget line");
    await call("deleteExpense", { id: e.id });
  });

  console.log("— Duplicate entry checks —");
  check("duplicate budget line combo rejected", async () => {
    const r = await call("saveBudgetLine", { data: { projectId: "P1", headId: "H1", materialId: "M1", shopId: "SH1", qty: 1, rate: 100 } });
    if (r.ok || !r.error || r.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE, got " + JSON.stringify(r));
  });
  check("duplicate contract ref number rejected", async () => {
    const r = await call("saveContract", { data: { type: "Sales Invoice", refNo: "INV-2026-001", date: "2026-08-20", projectId: "P1", customerId: "C1", amount: 5000, vatRate: 16.5, status: "Issued", paymentStatus: "Unpaid" } });
    if (r.ok || !r.error || r.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
  });
  check("duplicate master name rejected", async () => {
    const r = await call("saveMaster", { sheet: "Shops", data: { name: "Head Office Store", status: "Active" } });
    if (r.ok || !r.error || r.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
  });
  check("duplicate expense invoice (same supplier + project) rejected", async () => {
    const r = await call("saveExpense", { data: { projectId: "P1", budgetId: "B01", date: "2026-08-02", supplierId: "S1", invoiceNo: "CBS-2026-0142", qty: 1, rate: 100 } });
    if (r.ok || !r.error || r.error.code !== "DUPLICATE") throw new Error("expected DUPLICATE");
  });

  console.log("— Locking rules —");
  check("budget line with consumption cannot be reduced below consumed", async () => {
    const bl = db.db.budget.find(b => b.id === "B17");
    const consumed = db.db.expenses.filter(e => e.budgetId === "B17").reduce((a, e) => a + F.num(e.qty), 0);
    const r = Mock.validateBudgetLine(db.db, { projectId: bl.projectId, headId: bl.headId, materialId: bl.materialId, shopId: bl.shopId, unitId: bl.unitId, qty: consumed - 5, rate: bl.rate, status: "Approved" }, bl.id);
    if (!r || r.ok !== false) throw new Error("reduction below consumed should fail");
  });
  check("budget line with consumption cannot change material", async () => {
    const bl = db.db.budget.find(b => b.id === "B17");
    const r = Mock.validateBudgetLine(db.db, { projectId: bl.projectId, headId: bl.headId, materialId: "M28", shopId: bl.shopId, unitId: bl.unitId, qty: bl.qty, rate: bl.rate, status: "Approved" }, bl.id);
    if (!r || r.ok !== false || r.error.code !== "LOCKED") throw new Error("expected LOCKED");
  });
  check("budget line with consumption cannot be deleted", async () => {
    const r = await call("deleteBudgetLine", { id: "B17" });
    if (r.ok) throw new Error("should be blocked");
  });

  console.log("— Reporting engine —");
  check("P&L: profit = income − expenses", async () => {
    const store = {
      masters: db.db.masters, budget: db.db.budget, contracts: db.db.contracts,
      expenses: db.db.expenses, audit: db.db.audit, settings: db.db.settings,
    };
    const rep = RC.report(store, "pl", {});
    const cards = {};
    rep.cards.forEach(c => { cards[c.label] = c.value; });
    const cs = RC.contractSums(RC.enrichContracts(store), {});
    const exp = F.sum(RC.enrichExpenses(store, RC.enrichBudget(store)), e => F.num(e.amount));
    const want = F.money(cs.income - exp);
    if (cards["Net Profit"] !== want) throw new Error("profit mismatch: " + cards["Net Profit"] + " vs " + want);
  });
  check("budget vs actual: remaining = budget − consumed (never negative for non-override lines)", async () => {
    const store = { masters: db.db.masters, budget: db.db.budget, contracts: db.db.contracts, expenses: db.db.expenses, audit: db.db.audit, settings: db.db.settings };
    const budget = RC.enrichBudget(store);
    budget.forEach(b => {
      const rec = b.amount - b.consumedAmount;
      if (Math.abs(rec - b.remainingAmount) > 0.01) throw new Error("remaining mismatch on " + b.id);
    });
  });
  check("every seeded expense maps to a budget line of the same project", async () => {
    db.db.expenses.forEach(e => {
      const bl = db.db.budget.find(b => b.id === e.budgetId);
      if (!bl) throw new Error("orphan " + e.id);
      if (bl.projectId !== e.projectId) throw new Error("project mismatch " + e.id);
    });
  });
  check("self-test action passes", async () => {
    const r = await call("selftest", {});
    if (!r.ok) throw new Error("selftest failed to run");
    const bad = r.data.results.filter(x => !x.pass);
    if (bad.length) throw new Error("selftest failures: " + bad.map(b => b.name + ": " + b.error).join("; "));
  });

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
