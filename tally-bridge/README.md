# Tally Bridge — Tally Prime 2.1 Frontend Middleware (Phase 1)

A Python middleware that bridges a browser frontend with **Tally Prime 2.1** running
on your local PC or LAN. It talks to Tally over both transports:

| Transport | Direction | Default | Used for |
|---|---|---|---|
| **XML API** (HTTP) | read + write | `localhost:9000` | everything: masters, vouchers, reports |
| **ODBC** | read (fast path) | DSN `TallyODBC64_9000` | optional fast queries; XML API covers 100 % of features |

```
Browser (frontend) ⇄ HTTP/WebSocket ⇄ server.py (Flask + SyncEngine)
                                            ├─ XML API → Tally Prime 2.1 :9000
                                            └─ ODBC    → Tally Prime 2.1 :9000
```

Phase 1 delivers the complete middleware + a diagnostic console at `/`.
Phase 2 (next) builds the full Tally-style frontend on top of this API.

---

## Quick start (on the PC where Tally Prime runs)

```bat
cd tally-bridge
py -3 -m pip install -r requirements.txt
py -3 server.py
```

Then open **http://127.0.0.1:5000** — you should see the console, your open
companies, and live sync.

Checklist if the XML API shows *down*:

1. Tally Prime 2.1 must be running with at least one company open.
2. The API port must be enabled: in Tally → **Help → Settings → Connectivity**
   → set **TallyPrime acts as** → *Both (ODBC + XML API)* (or Advanced) on port
   `9000`.
3. If Tally runs on another LAN machine: `set TALLY_HOST=192.168.x.x` before
   starting, and enable *Connectivity from other computers* in the same panel.

### ODBC (optional)

Everything works through the XML API alone. To also enable the ODBC fast path:

```bat
py -3 -m pip install pyodbc
set TALLY_ODBC_DSN=TallyODBC64_9000        :: DSN created by Tally, or:
set TALLY_ODBC_CONNECT_STRING=Driver={Tally ODBC Driver};Server=localhost;Port=9000
```

The health endpoint (`/api/health`) tells you which paths are live.

### Offline development / demo (no Tally needed)

```bash
python3 mock_tally.py     # terminal 1 — fake Tally on :9000 (in-memory data)
python3 server.py         # terminal 2 — the bridge on :5000
```

`mock_tally.py` implements the parts of Tally's XML API the bridge uses
(collections, imports, ALTER-ID change tracking), so the full loop — including
**bidirectional sync** — can be developed and tested without Tally.

---

## Configuration (environment variables)

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
├── server.py            # the middleware (Flask + SocketIO + sync engine)
├── mock_tally.py        # offline mock of Tally's XML API for development
├── requirements.txt
├── start.sh / start.bat # launchers
└── frontend/index.html  # Phase-1 diagnostic console (Phase 2 replaces this)
```

## Roadmap

- **Phase 1 (this)** — middleware: CRUD API, reports, sync engine, WebSocket
  push, hardening, mock server, diagnostic console.
- **Phase 2** — full Tally-style frontend: gateway/company selector, day book,
  voucher entry (all types), masters with trees, reports with drill-down,
  dashboard.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `XML API down` in health | Tally not running / port disabled — see Quick start checklist |
| `ODBC not_installed` | expected without `pip install pyodbc`; everything still works via XML |
| Import returns *Duplicated* | a master with that name already exists in Tally |
| Import reports *no created/altered* | voucher auto-numbered/optional, or unknown REMOTEID on alter |
| Company with `/` in name breaks URLs | URL-encode the company segment (`%2F`); avoid `/` in company names |
| Slow with huge books | narrow `from_date`/`to_date`, raise `SYNC_INTERVAL`, lower `CACHE_TTL` |
