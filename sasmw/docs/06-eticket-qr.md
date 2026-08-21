# PHASE 6 — E-Ticket & QR Code System

**Goal:** After Airtel Money payment succeeds, generate a unique e-ticket with a
QR code per seat/ticket, email it, and (optionally) SMS it, and enable stadium
staff to verify tickets by scanning the QR.

---

## How this package does it

The **Serve All Airtel Money** plugin includes `class-sas-airtel-money-eticket.php`.
On payment confirmation (`payment_complete`), it:

1. Builds one ticket per purchased seat (respects quantities).
2. Generates a **unique ticket ID** per ticket, e.g. `SAS2F3A91C7E02B-412`.
3. Encodes a verification payload into a **QR code** (ticket id, order id, amount, date).
4. Caches the QR PNG under `wp-content/uploads/`.
5. Emails an HTML e-ticket to the customer with the match details + QR image.
6. Stores the ticket array on the order (`_sas_airtel_tickets`) for your records.

### What the QR contains
```json
{"ticket":"SAS2F3A91C7E02B-412","order":412,"amount":15000,"date":"2026-08-30 14:00:00"}
```
Stadium staff scan this with any QR scanner/phone camera and check the ticket ID
against your records (or a scanner app — see "verification" below).

---

## Enrich match details on each product

The plugin reads these custom fields from the ticket product so the e-ticket shows
them. Add them in **Products → your match → Product data → Custom fields**:

| Field key | Example value |
|-----------|---------------|
| `_sas_match_venue` | Bingu National Stadium |
| `_sas_match_date` | 2026-08-30 |
| `_sas_match_time` | 15:00 |
| `_sas_match_league` | TNM Super League |

---

## Printable PDF tickets

The plugin emails an HTML ticket. For a printable **PDF** e-ticket, install:

- **WooCommerce PDF Invoices & Packing Slips** (free) → generates a PDF per order.
- Configure it to include order details (product = match, category variation, order id).
- Optionally use **WooCommerce PDF Invoices + the QR image** as a footer.

> For a premium, polished PDF ticket with your logo/branding, add **FooEvents**
> later (it natively makes branded PDF tickets with QR + check-in).

---

## SMS notification (optional)

Send the ticket ID + confirmation by SMS to the buyer's phone.

**Option A — Airtel SMS:** Airtel Africa APIs also offer SMS/messaging. Same portal,
subscribe to the SMS product, then send from a small hook on `payment_complete`.

**Option B — Africa's Talking (recommended, easier):**
1. Create an account at `africastalking.com`, get an SMS API key.
2. Install/use their **WordPress SMS plugin** or add a tiny snippet:

```php
add_action( 'woocommerce_payment_complete', function( $order_id ) {
    $order = wc_get_order( $order_id );
    $msisdn = $order->get_meta( '_sas_airtel_msisdn' );   // +265...
    $tickets = $order->get_meta( '_sas_airtel_tickets' );
    if ( ! $tickets ) return;
    $ids = wp_list_pluck( $tickets, 'ticket_id' );
    $msg = 'SASMW: Your ticket(s) ' . implode( ', ', $ids ) . ' are confirmed. Enjoy the match!';
    // Call Africa's Talking SMS API here with $msisdn and $msg.
    // (Use their official SDK for the current endpoint.)
}, 20 );
```

> Africa's Talking Airtel Malawi sender IDs must be registered/approved.

---

## Stadium entry verification (scanning)

You need a way for gate staff to check a ticket is valid.

**Option 1 (free, zero-cost):** Gate staff use a **phone camera** QR scanner
(built into most Androids via Google Lens) or a free app (e.g., "QR & Barcode
Scanner"). They compare the **ticket ID** against a printed/exported list of valid
ticket IDs for that match. Simple but manual.

**Option 2 (best, moderate cost):** **FooEvents Check-in** (paid) — its mobile app
scans QR codes at the gate, instantly validates, marks used, prevents reuse.

**Option 3 (custom, scalable later):** Add a private "verify ticket" endpoint on
your site that staff hit with the QR payload and that returns VALID/USED/INVALID.
(Pair this with your future stadium management.) A minimal version:
`https://sasmw.com/verify?t=YOUR_TICKET_ID` — checks `_sas_airtel_tickets` and the
match date. Mark tickets used in a per-match table.

> For launch, **Option 1** is fine — you're a startup. Move to FooEvents or a custom
> verify endpoint as volume grows.

---

## ✅ Phase 6 — done when:

- [ ] A test purchase generates a unique ticket + QR and emails it.
- [ ] Match details (venue/date/time/league) appear on the ticket.
- [ ] PDF option configured (or deferred to FooEvents).
- [ ] SMS path decided and (if used) working.
- [ ] You know how gate staff will scan/validate.

**Next:** `docs/07-news-feed.md` — news, ticker, RSS.
