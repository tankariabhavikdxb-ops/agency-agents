# Nexora Limited — Construction Site Management System

A production-ready construction site management system for **Nexora Limited** (Corporate Mall, 1st Floor, Office Block B, Chilambula Road, Lilongwe, Malawi).

- **Frontend:** a single `index.html` file (vanilla JS SPA — open it directly in any browser, no server needed)
- **Backend:** Google Sheets (database) + Google Apps Script (`Code.gs`, deployed as a Web App API)
- **Currency:** Malawi Kwacha — all amounts display as `MK 1,250,000.00`

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Complete single-file frontend: login, dashboard, 7 masters, 3 transaction screens, 7 reports, charts, print & CSV export |
| `Code.gs` | Complete Google Apps Script backend: CRUD for all entities, auto-IDs, duplicate checks, audit log, report/dashboard endpoints |

---

## Setup Instructions (10 steps)

1. **Create a new Google Sheet** (any name, e.g. *Nexora CSMS Database*). You do **not** need to create the tabs manually — step 4 creates all 12 automatically:
   `Users`, `Projects`, `Shops`, `ExpenseHeads`, `Materials`, `Units`, `Suppliers`, `Customers`, `BudgetEntries`, `Contracts`, `ActualExpenses`, `AuditLog`.
2. In the sheet, open **Extensions → Apps Script**. Delete any starter code.
3. Paste the full contents of **`Code.gs`** into the editor and save.
   *(Optional but recommended: replace `YOUR_SPREADSHEET_ID_HERE` with the sheet's ID from its URL — `https://docs.google.com/spreadsheets/d/`**`<THIS_PART>`**`/edit`. If the script stays bound to the sheet, it also works without this.)*
4. In the Apps Script editor, select the function **`setupSheets`** in the toolbar and click **Run**. Grant the permissions when prompted. This creates all 12 tabs with headers and seeds the 5 system users.
5. Click **Deploy → New deployment → Web app**:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` (i.e. anyone with the link can access)
6. Click **Deploy** and **copy the Web App URL** (ends in `/exec`).
7. Open **`index.html`** in a text editor.
8. Replace `YOUR_GOOGLE_APPS_SCRIPT_URL_HERE` (the `API_URL` constant near the top of the `<script>` section) with the copied Web App URL.
9. Save the file.
10. **Double-click `index.html`** to open it in your browser (internet connection required for Google Fonts / Font Awesome / Chart.js CDNs and the Sheets API). Log in and start working.

> **Re-deploying after code changes:** use **Deploy → Manage deployments → Edit → New version** so the same URL keeps working.

---

## Login Users (hardcoded)

| Full Name | Role | Username | Default Password |
|---|---|---|---|
| Prashant Khatri | Admin | `prashant` | `nexora2025` |
| Shakeel Patel | Admin | `shakeel` | `nexora2025` |
| Bhavik Tankaria | Admin | `bhavik` | `nexora2025` |
| Tanjani Malima | Admin | `tanjani` | `nexora2025` |
| Davie Chavula | Admin | `davie` | `nexora2025` |

Sessions are stored in `localStorage` (12-hour expiry). Every record tracks Created By / Modified By with timestamps, and every action is written to the `AuditLog` sheet.

---

## Key Behaviours

- **Auto-sequence IDs** — PRJ001, SHP001, EXP001, ITM001, UNT001, SUP001, CUS001, BDG001, CON001, ACT001 (generated server-side under a script lock).
- **Strict expense control** — actual expenses can only be recorded against an existing budget line: select Project → select Budget Line → shop/head/material/unit auto-populate read-only. Budget tracker shows Budgeted / Spent / This Entry / Remaining with a soft **overrun warning** dialog ("Yes, Save Anyway" / "Cancel").
- **Duplicate prevention** — unique names on all masters, unique contract Reference No, and unique Project + Shop + Expense Head + Material budget combinations (checked on both frontend and backend).
- **Real-time sync** — data polls every 30 seconds; a banner appears when other users change data. "Last synced" indicator + manual refresh on every page.
- **Reports** — Budget vs Actual (🟢 ≤75% / 🟡 75–100% / 🔴 >100%), Project Profitability, Item-wise, Shop-wise, Project-wise, P&L Statement, Supplier-wise. All with charts, print (company letterhead + "Printed on … by …" footer) and CSV export (`{PageName}_{Date}.csv`).
- **Delete protection** — the backend blocks deleting any record still referenced elsewhere (e.g. a budget line with expenses).

---

## Recommended First Data Entry Order

1. **Units** → 2. **Materials** → 3. **Expense Heads** → 4. **Customers** → 5. **Suppliers** → 6. **Projects** → 7. **Shops** → 8. **Budget Entries** → 9. **Contracts** → 10. **Actual Expenses**

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Backend not configured" banner | `API_URL` in `index.html` still has the placeholder — paste your `/exec` Web App URL |
| "Unable to connect to the server" | Check internet; confirm the Web App is deployed with access **Anyone** |
| Saves fail with permission errors | Re-deploy the Web App as **Execute as: Me**, and re-run authorization |
| Old code after editing Code.gs | Deploy → Manage deployments → Edit → **New version** |
