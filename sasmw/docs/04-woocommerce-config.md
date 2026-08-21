# PHASE 4 — WooCommerce Configuration for Tickets (MWK)

**Goal:** Turn WooCommerce into a *ticketing* engine where each product is a match,
variations are ticket categories, and e-tickets are delivered automatically.

---

## Step 1 — WooCommerce setup wizard

Activate WooCommerce → run the wizard:

1. **Store address:** Lilongwe, Malawi (city `Lilongwe`, postcode optional).
2. **Industry:** choose **"Other"** (we're not selling physical goods).
3. **Product types:** select **"I will be selling services or virtual goods"** /
   "downloadable/virtual" — this unlocks e-ticket settings.
4. **Currency:** set **Malawi Kwacha (MWK)**.
   - WooCommerce may not ship MWK by default. If MWK isn't in the currency
     dropdown, add it with a free snippet (see below) or use **WooCommerce
     Currency Switcher / WOOCS**. Safest: add MWK via a tiny snippet.

### Add Malawi Kwacha if missing
Add this to a child theme `functions.php` or a "Code Snippets" plugin:

```php
add_filter( 'woocommerce_currencies', function( $currencies ) {
    $currencies['MWK'] = 'Malawi Kwacha';
    return $currencies;
});
add_filter( 'woocommerce_currency_symbol', function( $symbol, $currency ) {
    if ( 'MWK' === $currency ) { return 'MWK'; }
    return $symbol;
}, 10, 2 );
```

5. **Shipping:** *Skip / None* — tickets are digital, no shipping.
6. **Taxes:** Malawi does **not** require VAT display for this startup stage.
   Set taxes to **"No, I will not charge sales tax"** (keep it simple). Revisit
   with an accountant when you grow.
7. **Payments:** Choose "Airtel Money" after you install the custom plugin (Phase 5).
   Keep "Bank transfer" off for now.

---

## Step 2 — Create ticket products (one product per match)

Go to **Products → Add New** for **each match**. Example: *Nyasa Big Bullets vs
Be Forward Wanderers*.

1. **Product name:** "Nyasa Big Bullets vs Be Forward Wanderers — Match Ticket".
2. **Product data → General:**
   - Check **Virtual** ✅ and **Downloadable** ✅ (so no shipping + enables e-ticket file).
   - **Regular price:** set to the *lowest* category price (e.g., `3000`) as a
     placeholder — real pricing comes from variations.
3. **Product data → Inventory:**
   - **Stock status:** In stock.
   - **Sold individually:** ✅ ON (a fan buys tickets, not a quantity of the product wrapper).
4. **Product data → Variations** (this is how categories work):
   - Add **3 attributes** under "Attributes": attribute name **"Ticket Category"**
     with values: `VIP`, `Standard`, `General`.
   - Then under **Variations** → "Add variation" ×3 (one per category):
     - **VIP** → price `15000`, stock `500`
     - **Standard** → price `8000`, stock `1500`
     - **General** → price `3000`, stock `3000`
   - Enable **stock management per variation** and set quantities.
5. **Product data → Advanced:**
   - Enable **Enable reviews** (social proof), **Purchase note** = the match details/instructions.
6. **Match metadata** (date/time/venue): store in the product **description** and
   via the **WooCommerce product short description**; also add custom fields
   (date, time, venue, league) if your theme/Elementor uses them. For tickets the
   *Important:* the match date/venue must also appear on the e-ticket (Phase 6 reads
   these fields).
7. Set a **featured image** = match/league artwork; **Product gallery** = stadium photos.
8. **Publish.**

> Repeat for all 5 sample matches in `content/sample-matches.csv` (Phase 10).

### Pricing reference (from your brief)
| Category | Price |
|----------|-------|
| VIP | MWK 15,000 |
| Standard | MWK 8,000 |
| General | MWK 3,000 |

---

## Step 3 — Availability status (Available / Selling Fast / Sold Out)

WooCommerce doesn't show "Selling Fast" by default. Options:
- **Automated:** Set low-stock threshold per variation (e.g., `300`). When stock is
  below threshold, WooCommerce flags low stock — you can style that as "Selling Fast".
- **Simple approach:** Use **stock badges** via CSS on the product card based on
  stock status (Sold Out if `outofstock`). Add custom CSS (see `styling/custom-css.css`).

---

## Step 4 — Cart & checkout behavior

- **Add to Cart button text:** rename to **"Add to Cart"** (default) or **"Get Ticket"**
  via WooCommerce → Settings → Products → Add to cart behavior.
- **Redirect to cart after add:** enable (WooCommerce → Settings → Products → Add to cart → "Redirect to the cart page after successful addition") so fans see their order summary.
- **Quantity per variation:** allow quantities (a fan can buy multiple General seats).
- **Guest checkout:** enable (WooCommerce → Settings → Accounts & Privacy → "Allow customers to place orders without an account") — important because most Malawian fans won't register.

---

## Step 5 — Email notifications

- **WooCommerce → Settings → Emails:** configure **New Order**, **Processing**,
  **Completed** templates.
- **From:** `tickets@sasmw.com`, name "Serve All Solutions – Tickets".
- Enable HTML templates; WooCommerce sends the order + e-ticket file (Phase 6) on
  **Completed** status.

---

## Step 6 — Payment methods at this stage

- Leave the built-in **Direct bank transfer** disabled.
- We'll add **"Airtel Money"** in Phase 5 with the custom plugin.

---

## ✅ Phase 4 — done when:

- [ ] Store set to MWK, Malawi location.
- [ ] Taxes off, shipping off.
- [ ] At least one ticket product with 3 price variations and per-variation stock.
- [ ] Guest checkout + "redirect to cart" enabled.
- [ ] Emails coming from `tickets@sasmw.com`.

**Next:** `docs/05-airtel-money-integration.md` — the payment gateway (register + plugin).
