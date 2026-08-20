# 🏗 Nexora Limited — Construction Site Management System

**Company:** Nexora Limited · Corporate Mall, 1st Floor, Office Block B, Chilambula Road, Lilongwe, Malawi
**Currency:** MK (Malawi Kwacha) · **Backend:** Google Sheets · **Frontend:** pure HTML/CSS/vanilla JS (opens directly from the PC)

A production-ready system to run construction sites with **total control**:

```
Step 1  Masters        →  Projects, Shops, Expense Heads, Materials, Units, Suppliers, Customers
Step 2  Budget         →  budget line by line (qty × rate), approved before spending
Step 3  Contracts      →  Contract Values, Sales Invoices, LPOs (Local Purchase Orders)
Step 4  Actual Expenses →  ONLY against approved budget lines — strict control
```

---

## ✨ Features

| Area | What you get |
|---|---|
| **Dashboard** | 8 KPI cards (contracts, budget, expenses, profit, budget utilisation, open LPOs, receivables), 4 charts, alerts panel, recent activity, quick actions |
| **Real-time sync** | every user's changes are pushed to Google Sheets and picked up by everyone else automatically (background polling + version counter, "Sync Now" button, sync status indicator) |
| **Duplicate entry checks** | projects (code/name), shops, heads, materials, units (abbrev), suppliers, customers, budget combos (project+head+material+shop), contract ref numbers per type, expense invoices per supplier+project — all enforced **again on the server** |
| **Strict budget control** | expenses can **only** be posted against an **Approved budget line of the same project**; head/material/shop/unit are derived from the line (cannot be faked); over-budget entries are **blocked** unless an Admin enables overrides in Settings and documents a reason |
| **Search-as-you-go dropdowns** | every lookup field in the system is a live search dropdown (project, shop, material, supplier, customer, budget line, user…) with relevance ranking and keyboard navigation |
| **Reporting** | P&L (company + per project), Project-wise, Budget vs Actual (item-wise), Item-wise, Shop-wise, Expense Head-wise, Supplier-wise, Customer-wise, LPO register, Expense Ledger, Monthly Trend — all with filters, charts, totals |
| **Buttons everywhere** | Home, Back, Refresh, Filters, Print, Preview, Export (CSV), Save, Edit, Cancel, Delete |
| **Security & audit** | PIN login (default `1234`, changeable), roles (Admin / Supervisor / Clerk), every action logged to the Audit Trail |
| **Backup** | one-click JSON backup + full CSV export (Settings) |

---

## 📁 Folder structure

```
construction-site-management/
├── index.html               ← OPEN THIS FILE on the PC
├── Nexora Site Management System.html   ← ★ SINGLE-FILE BUILD (everything inlined)
├── build-single.js          ← regenerates the single-file build
├── config.js                ← paste your Web App URL here (or use Settings in the app)
├── css/  style.css, print.css
├── js/
│   ├── api.js               ← API layer + store (demo ⇄ Google Sheets)
│   ├── mock.js              ← built-in DEMO backend (same business rules, sample data)
│   ├── reports-core.js      ← reporting engine (P&L, budget vs actual, …)
│   ├── components.js        ← search-as-you-go dropdown, tables, forms
│   ├── charts.js, ui.js, auth.js, format.js, app.js (router + real-time sync)
│   └── pages/               ← dashboard, masters, budget, contract, expenses, reports, audit, settings
├── backend/
│   └── Code.gs              ← Google Apps Script backend (paste into the Sheet)
├── build/                   ← vendored Chart.js + small logo used by the single-file build
├── assets/logo.png
└── tests/                   ← node tests (business rules + DOM + single-file bundle)
```

---

## 📦 Single-file version (save & open from the PC)

`Nexora Site Management System.html` is the **entire app in one file** — all CSS, all JavaScript, the logo and Chart.js are inlined (~520 KB):

- Copy just that one file to any PC (or a USB stick) and double-click it — **no server, no folder, no internet needed** for demo mode.
- Everything works identically: dashboard with charts, masters, budget, contracts, expenses, reports (print/export), audit, settings.
- To connect Google Sheets, open the file → **Settings → Connection** → paste the Web App URL. The URL is remembered in that browser.
- To rebuild it after changing any source file: `node build-single.js` (needs Node.js; Chart.js is vendored in `build/`).

---

## 🚀 Quick start — 2 ways

### A) Try it right now (demo mode, no setup)
1. Copy the whole folder to any PC.
2. Double-click **`index.html`** (opens in any modern browser — Chrome/Edge recommended).
3. Sign in with any user: **Prashant Khatri / Shakeel Patel / Bhavik Tankaria / Tanjani Malima / Davie Chavula**, PIN **`1234`**.
4. Explore the sample data (5 projects, 50 budget lines, 57 expenses…). Changes stay in that browser (localStorage) until you connect Google Sheets.

### B) Production setup with Google Sheets (real-time, multi-user)
1. Go to <https://sheets.google.com> → create a new spreadsheet, e.g. **“Nexora Site Management DB”**.
2. Menu **Extensions ▸ Apps Script**. Delete the default code, paste the entire contents of **`backend/Code.gs`**.
3. In the Apps Script editor toolbar select the function **`setupDatabase`** and press **▶ Run** → grant permissions (Google will warn — this is your own script; choose *Advanced ▸ Go to project*).
   - This creates the 13 tabs (Settings, Users, Projects, Shops, ExpenseHeads, Materials, Units, Suppliers, Customers, Budget, Contracts, Expenses, Audit), company profile and the **5 admin users** (PIN `1234`).
4. *(Recommended)* Run **`seedDemoData`** to load the same sample construction data you saw in demo mode.
5. **Deploy ▸ New deployment ▸ Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone** ← required, otherwise the HTML app cannot call the sheet
6. Copy the **Web App URL** (ends with `/exec`).
7. Open `index.html` → **Settings ▸ Connection** → paste the URL → **Test & Connect** (or paste it into `config.js` → `API_URL`). The status chip turns “Connected to Google Sheets”.
8. Share the folder with the other 4 users (or the single `index.html` + `js/` + `css/` folder). Everyone works on the **same live data**.

> ✅ Sanity check: visit the Web App URL in a browser — you should see the “backend is ONLINE” page without any Google login. If it asks you to sign in, redeploy with access **Anyone**.
> In the app: Settings ▸ **Run Self-Test** verifies users, strict rules and data consistency against the live sheet.
>
> 🔁 **Built-in fallback channel:** if your browser blocks direct requests to `script.google.com` (some ad-blockers / privacy settings / strict networks do), the app automatically retries through a **CORS-proof JSONP channel** (script tags) and keeps working normally — you'll see a small notice when that happens.

### C) Hosted mode (use when the PC browser blocks the connection)

If your browser/network blocks requests to `script.google.com` entirely (the app says both the direct and fallback channels failed), run the app **from the backend itself** — then there is no cross-site request at all:

1. Run `node build-single.js` (regenerates `backend/Index.html`).
2. In the Apps Script editor: **＋ Files ▸ HTML** → name it exactly **`Index`** → paste the entire contents of **`backend/Index.html`**.
3. **Deploy ▸ Manage deployments ▸ ✏️ Edit ▸ Version: “New version” ▸ Deploy** (the `/exec` URL stays the same).
4. Open the Web App URL in the browser (sign in to Google if asked). The full app now loads from that URL — no URL to configure, no CORS, works on every browser and even on phones.
5. The saved HTML file on the PC still works in demo mode, and in live mode whenever the network allows direct connections.

---

## 🔐 Users & roles

| User | Role |
|---|---|
| Prashant Khatri | Admin |
| Shakeel Patel | Admin |
| Bhavik Tankaria | Admin |
| Tanjani Malima | Admin |
| Davie Chavula | Admin |

Default PIN for everyone is **`1234`** — change it in **Settings ▸ My PIN**.

- **Admin** — everything, incl. settings, users, budget overrides.
- **Supervisor** — everything except Settings/Users management.
- **Clerk** — create entries (budget/contracts/expenses) and view reports; no edits, deletes or masters.
*(Users are managed in Settings ▸ Users & Roles — only by Admins.)*

---

## 📐 The 4-step workflow

1. **Masters** — create projects, shops, expense heads, materials (with units & standard rates), suppliers, customers. Duplicate names/codes are rejected.
2. **Budget** — add budget lines: project + head + material (unit auto) + shop + qty × rate. Lines are `Approved` (or `Hold`). Once a line has expenses it is **locked** (can’t be reduced below consumed or repurposed).
3. **Contracts / LPO / Invoices** — `Contract Value` and `Sales Invoice` are income; `LPO` is a purchase commitment (supplier). VAT auto-calculated (default 16.5%). Ref numbers unique per type.
4. **Expenses** — pick a project → pick an **approved budget line** (search-as-you-go shows head/material/shop/**remaining**). Head, material, shop and unit are taken from the line automatically. Quantity × rate = amount.

### 🛡 Strict control — how it behaves
- No free-form expense: the budget-line dropdown only lists **approved lines of the selected project**. There is no way to type a new expense item.
- If `Quantity × Rate` exceeds what remains on the line:
  - **AllowOverBudget = NO** (default in production) → the entry is **blocked** with the remaining balance shown.
  - **AllowOverBudget = YES** (Settings) → an **Admin** may tick “Override budget limit” and **must** give a documented reason; the entry is flagged “Over” everywhere (dashboard alerts, reports, ledger).
- Duplicate invoice numbers (same supplier + project) are blocked.

---

## 📊 Reports

Every report supports: project/date-range filters, summary KPI cards, charts, sortable tables with totals, **Print (PDF)**, **Preview**, **Export CSV (Excel)**.

| Report | Answers |
|---|---|
| Profit & Loss | income vs expenses vs profit — company-wide and per project (margin %) |
| Project-wise | contract value, invoiced, LPOs, budget, spent, remaining, % used, profit per project |
| Budget vs Actual | every budget line: budgeted vs consumed vs remaining + utilisation bar — **the “expenses must not exceed budget” control report** |
| Item-wise | spend per material: qty, avg rate, amount, share |
| Shop-wise / Head-wise | spend + budget utilisation per shop and per expense head |
| Supplier-wise | purchases, LPO value, amounts due (unpaid) |
| Customer-wise | billed vs collected vs outstanding per customer |
| LPO Register | open / partially received / received purchase orders |
| Expense Ledger | every entry with payment status and over-budget flags |
| Monthly Trend | income & expenses month by month |

---

## 🔄 How real-time sync works

- The app polls the backend every **45 seconds** (configurable, Settings) with a lightweight version check.
- Any save bumps the data version → all open browsers detect it on the next poll, refresh automatically and show a toast “New changes from another user detected”.
- Writes are served from a **server-side cache** (Google Apps Script CacheService) and invalidated per sheet, so reads stay fast; a script lock keeps writes consistent.
- In demo mode, sync works across **browser tabs** via localStorage events.

---

## 🧪 Tests

```bash
node tests/smoke.js            # business rules: strict budget control, duplicates, locking, P&L math
node tests/dom-test.js         # boots the real index.html in jsdom: login, every page, forms,
                               #   strict budget line lists, print preview, full save round-trip
node tests/jsonp-test.js       # verifies the CORS-proof JSONP fallback channel
node tests/hosted-test.js      # verifies hosted mode (google.script.run bridge)
node build-single.js && node tests/single-file-test.js   # rebuild + verify the single-file bundle
```
(DOM tests need `npm i jsdom`.)

---

## 🛠 Troubleshooting

| Symptom | Fix |
|---|---|
| App stays in “DEMO MODE” | Settings ▸ Connection: paste the `/exec` URL, press **Test & Connect**. Also check `config.js` → `API_URL`. |
| “Could not reach the Google Sheets backend…” | The browser can't talk to the backend. Open the Web App URL in a browser tab: you must see **“backend is ONLINE”**. If the tab won't open at all → check internet + the URL (must end with `/exec`, not `/edit` or `/dev`). If the tab opens but the app still fails → almost certainly the deployment is not set to access **Anyone** (see next row). |
| “The backend is reachable, but the browser was blocked…” or “The Web App asked for a Google login” | Re-deploy with access **Anyone**: Deploy ▸ Manage deployments ▸ ✏️ Edit ▸ “Who has access”: **Anyone** ▸ Deploy. Copy the **new** `/exec` URL into Settings. |
| “The backend URL responds, but the app could not read a valid reply (both channels failed)” | Either the URL is wrong/outdated (open it in your browser — you must see “backend is ONLINE”), or your browser/network blocks requests to script.google.com. Disable ad-blockers/privacy extensions, try another browser — or use **Hosted mode** (Option C). |
| Login screen: “No active user with that name” / empty dropdown | The user list could not be loaded from the backend — the connection is failing. Use the **Retry / Open Backend URL / Demo Mode** buttons on the login screen, and fix the connection (rows above). |
| “You pasted the Apps Script editor URL / Sheet URL / does not end with /exec” | Use the Web App URL from **Deploy ▸ Manage deployments** (starts `https://script.google.com/macros/s/…`, ends `/exec`). |
| “The backend returned an invalid response…” | Deployment type must be **Web app** (not “API executable” / “Editor add-on”). Deploy ▸ New deployment ▸ Web app. |
| Changes not visible to others | Press **Sync Now**; check both apps point to the **same** Web App URL. |
| First call after opening is slow | Normal — Apps Script warms up. Subsequent calls use the cache. |
| Can’t delete a master/budget line | By design — records already used by budget/contracts/expenses are protected. Set status to `Inactive` / `Hold` instead. |
| Quota / limits | Google Apps Script free quotas are ample for construction-scale data (thousands of rows). Audit log is capped at the latest 600 entries in the app view (full history stays in the Audit tab). |

---

## 🔒 Security notes

- The Google Sheet lives in **your** Google account — the app can never read more than this script exposes.
- PINs are stored **hashed** (SHA-256 + salt) in the Users tab.
- Deploying with access “Anyone” is required by the architecture (the HTML file runs from the PC, outside Google). Share the Web App URL only with staff; rotate it anytime by redeploying (file ▸ version is recreated).
- For stricter control, deploy with “Anyone with Google account” and open the app while signed into Google in the browser — anonymous deployment remains the simplest for a pure file:// workflow.
- Every login, create, update and delete is written to the Audit tab with user + timestamp.

---

## 🎨 Customisation

- **Company name/address, VAT %, currency, poll interval, over-budget policy**: Settings page (stored in the Sheet → Settings tab).
- **Colours/logo/branding**: `css/style.css` (CSS variables at the top) and `assets/logo.png`.
- **New reports**: add a case in `js/reports-core.js` (pure functions — see existing cases) and register it in `js/pages/reports.js` → `REPORTS`.
- **Extra fields**: extend the headers in `backend/Code.gs` (HEADERS + validation) and the matching form/columns in `js/pages/*.js`. Re-run `setupDatabase` after changing headers.

---

*Nexora Limited · Corporate Mall, 1st Floor, Office Block B, Chilambula Road, Lilongwe, Malawi · +265 1 700 000 · info@nexora.mw*
