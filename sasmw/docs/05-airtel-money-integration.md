# PHASE 5 — Airtel Money Payment Gateway Integration

**Goal:** Let customers pay for tickets with **Airtel Money (Airtel Malawi)** using
the custom WooCommerce gateway plugin in this package.

This covers:
1. Registering on the **Airtel Africa Developer Portal**
2. Getting **sandbox** then **production** credentials (Client ID / Client Secret)
3. How the API + webhook flow works
4. Installing & configuring the **Serve All Airtel Money** plugin
5. Testing
6. Fallback options (aggregators) if the API approval is slow

---

## 1. Register on the Airtel Africa Developer Portal

Portal: **https://developers.airtel.africa/**

1. Click **Register / Sign Up**.
2. Enter your **company** details (Serve All Solutions Limited), a **work email**
   (e.g., `tech@sasmw.com`), and a password. Verify the email.
3. Once logged in, go to **API Catalog** and find the **Airtel Money** product
   (e.g., "Airtel Money API – Payment / Collection" or "Airtel Money Aggregation API").
4. Click **Subscribe** / **Get API Key** on the Airtel Money collection API.

> ⚠️ **Business approval:** Airtel Money merchant/aggregation APIs require you to
> submit business documents:
> - Certificate of Incorporation (Business Registration) of Serve All Solutions
> - Valid Airtel Money **merchant/business account** (you already have one)
> - Taxpayer Identification Number (TIN) / business registration (e.g., from
>   the Malawi Government's Business Registration Services / MRA)
> - A callback/webhook URL (use `https://sasmw.com/wc-api/sas_airtel_money`)
> - KYC for the account holder
>
> Approval can take days to a few weeks. Start **now**, in parallel with the rest
> of the build.

---

## 2. Get sandbox (test) credentials

- The portal provides a **sandbox environment** (test) with a **Client ID** and
  **Client Secret** (and usually a test API key). Save them.
- Sandbox lets you test the full flow with fake money before going live.

## 3. Get production (live) credentials

- After approval, the portal issues **production** Client ID, Client Secret, and
  your **Airtel Money merchant/payment product credentials** (e.g., a
  `X-Key-Id` / API key and your merchant ID / payment product ID).
- Store these **safely** (password manager). Never put them in Git or post them.

### Airtel Money API essentials you'll need
Depending on the exact Airtel Money API product, the integration uses:

- **Base URL** (production): `https://openapi.airtel.africa`
- **Access token endpoint:** `POST /auth/oauth2/token`
- **Payment request:** `POST /merchant/v2/payments/` (the "Payment Collection" / USSD push)
- **Callback/webhook:** Airtel calls your registered URL to confirm success/failure.

> ⚠️ **Important:** Airtel Africa API specifications and paths change over time and
> differ by country. The plugin in this package is written so you **only** update
> a small config block (URLs, field names, keys) to match the current Airtel docs
> for **Malawi**. Always cross-check against:
> https://developers.airtel.africa/docs (the official API reference for your product).
> The plugin's HTTP flow (token → payment request → webhook) is stable and standard
> for all Airtel Money "USSD push" collection APIs.

---

## 4. The payment flow (what the plugin does)

```
1. Customer checks out with tickets.
2. On "Pay with Airtel Money", the plugin shows an Airtel Money phone number field.
3. On "Place order" the plugin:
     a. Validates the MWK number (+265...)
     b. Gets an access token from Airtel API
     c. Calls the Payment Request API (amount in MWK, the number, a unique reference)
        → Airtel sends a USSD push to the customer's phone
     d. Order status set to "On hold" / "Pending" (awaiting customer PIN)
4. Customer enters their PIN on the phone → Airtel confirms payment.
5. Airtel calls your webhook URL with the result.
6. The plugin verifies the reference & amount, marks the order "Processing/Completed",
   generates the e-ticket + QR code, and emails it. (Phase 6)
7. On failure/timeout, order marked "Failed" / "Cancelled".
```

---

## 5. Install & configure the plugin

### 5a. Install
1. Zip the `plugin/sas-airtel-money/` folder → `sas-airtel-money.zip`.
2. WordPress: **Plugins → Add New → Upload Plugin** → choose the zip → Install → Activate.
3. The plugin registers a new WooCommerce gateway called **"Airtel Money"** and adds
   a phone-number field at checkout.

### 5b. Configure
1. **WooCommerce → Settings → Payments → Airtel Money → Manage.**
2. Enable it (✅ Enable Airtel Money).
3. Title: `Airtel Money`; Description: `Pay instantly with Airtel Money (USSD push)`.
4. Fill in:
   - **Environment:** `Test (Sandbox)` while testing; `Live (Production)` at launch.
   - **Client ID** and **Client Secret** (from the portal).
   - **API Base URL** (sandbox and production values).
   - **Payment product / merchant ID** (from your Airtel approval).
   - **Callback URL:** note the one shown (e.g., `https://sasmw.com/wc-api/sas_airtel_money`)
     and register it with Airtel.
   - **Enable manual/offline confirmation (Sandbox):** a checkbox so you can mark
     an order Paid during testing even without live callbacks.
5. Save.

> The plugin stores secrets in WordPress options (not hard-coded). Keep your
> `wp-config.php`/site secure; secrets never leave your server except to Airtel.

---

## 6. Testing procedures

### Sandbox test checklist
- [ ] Checkout with a sandbox number → a payment request is initiated (reference created).
- [ ] Simulate a **successful** callback (the plugin includes a manual "Simulate Success"
      test link in Sandbox mode) → order goes **Processing/Completed**, e-ticket email sent.
- [ ] Simulate a **failed** callback → order marked **Failed**.
- [ ] Verify the webhook signature/reference matching works (amount + reference check).
- [ ] Confirm the order total is correct in **MWK**.
- [ ] Test a **0 stock** variation → cannot buy.
- [ ] Test guest checkout and logged-in checkout.

### Live launch checklist (after production approval)
- [ ] Switch plugin to **Live**.
- [ ] Register the **production callback URL** with Airtel.
- [ ] Make a **small real purchase** (e.g., MWK 500–3,000) with your own phone.
- [ ] Confirm USSD push arrives, enter PIN, confirm order completes **automatically**.
- [ ] Confirm the e-ticket email arrives with QR code.
- [ ] Check **WooCommerce → Orders** status + **Order notes** log for the Airtel reference.

---

## 7. Fallback / faster-to-launch alternatives

If Airtel's developer-portal approval is delayed, launch with a Malawian aggregator
that already wraps Airtel Money:

- **PayChangu** (Malawi fintech aggregator) — has a WooCommerce plugin/API for
  Airtel Money + other wallets; much faster onboarding (business docs + KYC).
  Guide: register at `paychangu.com`, get API key, install their WooCommerce plugin,
  set currency MWK. Use the same `content/` and e-ticket flow.
- **Techno Brain** (regional) — often the processor behind mobile-money gateways;
  they can provide a Malawi Airtel Money integration.
- **Airtel Money Merchant dashboard "manual" mode** as a very short-term bridge:
  collect orders + phone numbers, initiate USSD payment yourself, then mark Paid
  (this is exactly what the plugin's "Manual/offline confirmation" does).

> **Recommended launch strategy:** Start in **Live with manual confirmation ON**
> (you confirm via your Airtel Merchant dashboard) so you can sell immediately and
> build trust, then switch to **fully automated webhooks** once Airtel's production
> callbacks are confirmed working.

---

## ✅ Phase 5 — done when:

- [ ] Registered on Airtel Africa portal; sandbox credentials obtained.
- [ ] Business docs submitted for production (submission started).
- [ ] `sas-airtel-money` plugin installed & configured (sandbox).
- [ ] Sandbox tests pass (success + failure paths).
- [ ] A small real MWK purchase completes (live).

**Next:** `docs/06-eticket-qr.md` — e-tickets, QR codes, PDF, SMS.
