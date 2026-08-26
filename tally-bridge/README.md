# Tally Bridge — Tally Prime 2.1 Web Frontend (Phases 1 + 2)

A full web frontend + Python middleware for **Tally Prime 2.1** running on your
local PC or LAN. It talks to Tally over both transports:

| Transport | Direction | Default | Used for |
|---|---|---|---|
| **XML API** (HTTP) | read + write | `localhost:9000` | everything: masters, vouchers, reports |
| **ODBC** | read (fast path) | DSN `TallyODBC64_9000` | optional fast queries; XML API covers 100 % of features |

```
Browser (frontend) ⇄ HTTP/WebSocket ⇄ server.py (Flask + SyncEngine)
                                            ├─ XML API → Tally Prime 2.1 :9000
                                            └─ ODBC    → Tally Prime 2.1 :9000
```

- **Phase 1** — the middleware: REST API, bidirectional sync engine, hardening.
- **Phase 2** — the frontend application: a complete Tally-style UI
  (splash → company setup → dashboard, day book, voucher entry with double-entry
  validation, masters with CRUD, reports, configuration, light/dark theme).

---

## Installation

Everything ships with one-click setup scripts that create an isolated virtual
environment, install the pinned dependencies (`requirements.txt`) and prepare a
`.env` configuration file.

### Windows (the PC where Tally Prime runs)

1. Double-click **`setup.bat`** — checks Python 3.9+, creates `venv\`, installs
   dependencies, creates `.env`.
2. Double-click **`run.bat`** — starts the bridge.
3. Open **http://127.0.0.1:5000**.

If `pyodbc` fails to install (rare on Windows), the setup automatically
retries without it and the bridge runs in XML-API-only mode — every feature
still works.

### Linux / macOS

```bash
cd tally-bridge
./setup.sh
./run.sh
```

### Manual install (any platform)

```bash
python3 -m venv venv
venv/bin/pip install -r requirements.txt     # Windows: venv\Scripts\pip
venv/bin/python server.py                    # Windows: venv\Scripts\python
```

### Configuration — `.env`

`setup` copies `.env.example` to `.env`; edit it to match your environment.
Real environment variables always override `.env` values.

```ini
BRIDGE_HOST=127.0.0.1   # 0.0.0.0 to allow the whole LAN
BRIDGE_PORT=5000
TALLY_HOST=localhost    # LAN IP when Tally runs on another PC
TALLY_PORT=9000
TALLY_ODBC_DSN=TallyODBC64_9000
SYNC_INTERVAL=5         # seconds between Tally change checks
```

All supported variables are documented in `.env.example`.

Checklist if the XML API shows *down*:

1. Tally Prime 2.1 must be running with at least one company open.
2. The API port must be enabled: in Tally → **Help → Settings → Connectivity**
   → set **TallyPrime acts as** → *Both (ODBC + XML API)* (or Advanced) on port
   `9000`.
3. If Tally runs on another LAN machine: set `TALLY_HOST=192.168.x.x` in
   `.env`, and enable *Connectivity from other computers* in the same panel.

### ODBC (optional)

Everything works through the XML API alone. To also enable the ODBC fast path,
install the `pyodbc` driver (Windows: included via `requirements.txt`) and set
`TALLY_ODBC_DSN` (or `TALLY_ODBC_CONNECT_STRING`) in `.env`. The health
endpoint (`/api/health`) tells you which paths are live.

### Offline development / demo (no Tally needed)

```bash
python3 mock_tally.py     # terminal 1 — fake Tally on :9000 (in-memory data)
python3 server.py         # terminal 2 — the bridge on :5000
```

`mock_tally.py` implements the parts of Tally's XML API the bridge uses
(collections, imports, ALTER-ID change tracking), so the full loop — including
**bidirectional sync** — can be developed and tested without Tally.

---

## Configuration reference (all variables, env or `.env`)

| Variable | Default | Meaning |
|---|---|---|
| `BRIDGE_HOST` | `127.0.0.1` | bind address (use `0.0.0.0` for LAN access) |
| `BRIDGE_PORT` | `5000` | HTTP/WebSocket port |
| `TALLY_HOST` / `TALLY_PORT` | `localhost` / `9000` | Tally XML API endpoint |
| `TALLY_ODBC_DSN` | `TallyODBC64_9000` | ODBC data source name |
| `TALLY_ODBC_CONNECT_STRING` | *(empty)* | full ODBC connection string override |
| `SYNC_INTERVAL` | `5` | seconds between change-detection polls |
| `REQUEST_TIMEOUT` | `30` | seconds per Tally request |
| `CACHE_TTL` | `15` | seconds a read response stays cached |
| `MAX_CONCURRENT` | `5` | max simultaneous requests forwarded to Tally |
| `MAX_CACHE_MB` | `50` | response-cache memory budget |

---

## REST API

All company-scoped URLs take the **URL-encoded company name**, e.g.
`/api/Demo%20Company%20(Mock)/ledgers`.

### Connection & system
- `GET  /api/health` — bridge, XML API, ODBC and sync status
- `POST /api/connection/test` — probe a host/port, body `{"host": "...", "port": 9000}`
- `GET  /api/sync/status` — registered companies, ALTER IDs, last events

### Companies
- `GET  /api/companies` — open companies
- `POST /api/companies/{c}/select` — subscribe to live sync
- `GET  /api/companies/{c}/config` — company configuration
- `PUT  /api/companies/{c}/config` — alter features, body `{"MaintainCostCentres": "Yes"}`

### Masters
- `GET|POST /api/{c}/ledgers` — list / create
- `PUT|DELETE /api/{c}/ledgers/{name}` — alter / delete
- `GET|POST /api/{c}/stock-items`, `PUT|DELETE /api/{c}/stock-items/{name}`
- `GET /api/{c}/groups` · `/stock-groups` · `/units` · `/currencies` ·
  `/cost-centres` · `/cost-categories` · `/godowns` · `/voucher-types`
- `POST /api/{c}/odbc-query` — raw read-only ODBC SELECT (fast path)

### Vouchers
- `GET  /api/{c}/vouchers?type=Sales&from_date=2025-04-01&to_date=2026-03-31&page=1&page_size=50`
- `POST /api/{c}/vouchers` — create (JSON below)
- `PUT  /api/{c}/vouchers/{remote_id}` — alter (REMOTEID from the list)
- `POST /api/{c}/vouchers/delete` — body `{"remote_id": "..."}` or
  `{"voucher_number": "5", "voucher_type": "Sales", "date": "2025-06-01"}`
- `GET  /api/{c}/day-book?date=2025-06-15`
- `GET  /api/{c}/ledger-vouchers/{ledger}?from_date=&to_date=`

```json
POST /api/Demo%20Company%20(Mock)/vouchers
{
  "voucher_type": "Sales",
  "date": "2025-06-20",
  "voucher_number": "",
  "reference": "INV-010",
  "narration": "Sold goods & collected cash — special chars are escaped safely",
  "party_name": "Ramesh & Sons",
  "ledger_entries": [
    {"ledger_name": "Ramesh & Sons", "amount": 11800, "is_debit": true},
    {"ledger_name": "Sales Account", "amount": 11800, "is_debit": false}
  ],
  "inventory_entries": [
    {"stock_item": "Widget A", "quantity": 10, "rate": 1180,
     "amount": 11800, "unit": "Nos", "godown": "Main Location"}
  ]
}
```

**Amount convention:** send positive amounts + `is_debit` flag; the bridge
applies Tally's `ISDEEMEDPOSITIVE`/negative-amount debit convention. Vouchers
are validated (≥ 2 entries, Dr = Cr within 1 paisa) before import.
Empty `voucher_number` → Tally auto-numbers.

### Reports
- `GET /api/{c}/reports/trial-balance?to_date=` — computed, grouped rows + totals
- `GET /api/{c}/reports/balance-sheet?date=` — raw report structure
- `GET /api/{c}/reports/profit-loss?from_date=&to_date=` — raw report structure
- `GET /api/{c}/dashboard` — aggregated home-screen stats

### WebSocket (Socket.IO)
- connect → `connected`
- `subscribe_company {company}` → `subscribed`
- **`data_changed {company, type, timestamp}`** — pushed whenever Tally data
  changes (made in Tally UI *or* through the bridge). The frontend refreshes
  itself from this single event. Types include `voucher_created`,
  `ledger_altered`, `full_refresh` (Tally-side change), `tally_offline`, …

---

## The frontend (Phase 2)

Open `http://127.0.0.1:5000` — no build step, no CDN, works offline.

**Flow:** splash screen (connection checklist) → company setup (connection
status, host/port test + apply, company cards) → main application.

**Pages**

| Route | What it does |
|---|---|
| `#/dashboard` | stat cards (ledgers, vouchers FY/today, TB total), recent vouchers, top parties |
| `#/daybook` | Day Book for any date, type filter, day total, voucher view/alter/delete |
| `#/vouchers` | Voucher Register: date-range + type filters, pagination, CSV export |
| `#/voucher/new` · `#/voucher/edit/:id` | double-entry voucher form (see below) |
| `#/ledgers` · `#/ledgers/:name` | ledger list with search/group filter + CRUD modal; drill-down shows ledger details and all its vouchers |
| `#/groups` | account groups with parent-chain indentation |
| `#/stock-items` | stock item list + CRUD modal |
| `#/masters/*` | units, godowns, stock groups, cost centres/categories, currencies, voucher types |
| `#/reports/trial-balance` | computed TB with totals, difference badge, CSV, row drill-down |
| `#/reports/balance-sheet` · `#/reports/profit-loss` | rendered from Tally's native report export |
| `#/config` | connection (host/port apply), theme, sync monitor, F11-style company features, about |

**Voucher entry** — Tally-style: type / date / number (blank = auto) / reference /
party, ledger lines with type-ahead (datalist over live ledgers) and mutually
exclusive Debit/Credit columns, live totals + "Balanced" badge, optional
inventory lines (qty × rate = amount) for item voucher types, narration.
Validated client-side (≥ 2 lines, Dr = Cr, no both-sides amounts) *and*
server-side before import. `Ctrl+S` saves, `Alt+N` opens a new voucher,
`Esc` closes dialogs. Edits/deletes round-trip via Tally REMOTEID.

**Live sync in the UI:** every `data_changed` WebSocket event invalidates the
caches, toasts, and re-renders the current page — but never wipes a voucher
form you're editing.

**Theming:** light (default, Tally-like) and dark, persisted in
`localStorage`. The Socket.IO client is bundled at
`frontend/assets/socket.io.min.js` (Flask-SocketIO does not serve it itself) so
the app works fully offline.

## Testing

```bash
# terminal 1 + 2: bridge against the mock
python3 mock_tally.py
TALLY_HOST=127.0.0.1 python3 server.py

# terminal 3: headless integration test (79 assertions) — drives the real UI:
# boot, setup, company select, every route, voucher create/alter/validation,
# ledger CRUD with special characters, live-sync events, modals, theme
cd tests && npm install && npm run smoke
```

## How bidirectional sync works

1. `SyncEngine` polls each selected company's **ALTER ID** — a single cheap
   Export (`Company → AlterID`) every `SYNC_INTERVAL` seconds.
2. Any change in Tally (voucher/master added, altered or deleted **from anywhere**
   — Tally UI, another user, the bridge itself) bumps the ALTER ID.
3. The engine invalidates its response cache and pushes `data_changed` over
   Socket.IO to every connected browser.
4. Writes through the bridge broadcast immediately and are also confirmed by
   the poll, closing the loop.

Memory/pressure safety: request semaphore (5 concurrent), 100 ms throttle,
TTL response cache with oldest-first eviction, batch caps that shrink on ODBC
memory errors, 5 MB XML request ceiling, and **imports are never auto-retried**
so a timeout can never duplicate a voucher.

## Hardening notes (XML special characters)

`XMLSanitizer` strips invalid XML 1.0 code points and Tally's internal control
delimiters, NFC-normalizes unicode, removes zero-width/BOM characters and
escapes `& < > " '` in every field. Ledger names like `Global Traders <Pune>`
or narrations containing `&` round-trip safely. Text parsed back from Tally is
**never double-unescaped** (a common corruption bug in Tally integrations).

## Project layout

```
tally-bridge/
├── server.py                 # the middleware (Flask + SocketIO + sync engine)
├── mock_tally.py             # offline mock of Tally's XML API for development
├── requirements.txt          # pinned dependencies (Phase 3)
├── setup.bat / setup.sh      # one-click installers (venv + deps + .env)
├── run.bat / run.sh          # launchers (use the venv)
├── .env.example              # documented configuration template
├── frontend/
│   ├── index.html            # app shell: splash, setup, layout, templates, icon sprite
│   ├── console.html          # Phase-1 diagnostics console (also linked from config)
│   ├── assets/socket.io.min.js   # bundled Socket.IO client (offline-friendly)
│   ├── css/  theme.css (variables+reset) · components.css · app.css
│   └── js/   utils · api · app (state/router/toast/modal/ws) · voucher · pages · main
└── tests/smoke.mjs           # headless jsdom integration test (npm run smoke)
```

## Roadmap

- **Phase 1 (done)** — middleware: CRUD API, reports, sync engine, WebSocket
  push, hardening, mock server, diagnostic console.
- **Phase 2 (done)** — full Tally-style frontend: company setup, dashboard,
  day book, voucher register + entry/alter/delete, masters with CRUD,
  reports with CSV export, configuration page, light/dark theme.
- **Phase 3 (done)** — requirements & setup layer: pinned dependencies,
  one-click `setup`/`run` scripts for Windows and Linux/macOS, virtual
  environment isolation, `.env` configuration loaded via python-dotenv
  (env vars still override).
- **Phase 4 (next)** — per the roadmap: printing, GST-ready invoice formats,
  bill-wise details, cost-centre allocation, cheque details, user preference
  persistence, packaging as a desktop app.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `XML API down` in health | Tally not running / port disabled — see Quick start checklist |
| `ODBC not_installed` | expected without `pip install pyodbc`; everything still works via XML |
| Import returns *Duplicated* | a master with that name already exists in Tally |
| Import reports *no created/altered* | voucher auto-numbered/optional, or unknown REMOTEID on alter |
| Company with `/` in name breaks URLs | URL-encode the company segment (`%2F`); avoid `/` in company names |
| Slow with huge books | narrow `from_date`/`to_date`, raise `SYNC_INTERVAL`, lower `CACHE_TTL` |
