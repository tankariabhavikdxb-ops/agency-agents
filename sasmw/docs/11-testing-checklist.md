# Pre-Launch Testing Checklist

Run through every item and tick it off before you go live. Fix anything that fails.

---

## A. Core site & security
- [ ] `https://sasmw.com` loads with a valid padlock (SSL).
- [ ] Permalinks = Post name; URLs clean.
- [ ] Admin login works; **2FA** enabled (Wordfence).
- [ ] Daily backups scheduled (UpdraftPlus → Google Drive) and a restore **tested**.
- [ ] Wordfence firewall active; brute-force protection on.
- [ ] All plugins up to date; no fatal errors (WP_DEBUG logs empty).

## B. Products / matches
- [ ] 5 match products live, each with VIP/Standard/General variations.
- [ ] MWK currency correct (`MWK` symbol shows; prices 15000 / 8000 / 3000).
- [ ] Stock per variation set and shown correctly (Available / Selling Fast / Sold Out).
- [ ] Virtual + Downloadable set on every ticket product.
- [ ] Match metadata (`_sas_match_venue/date/time/league`) filled on each.
- [ ] Guest checkout enabled; "redirect to cart" works.

## C. Checkout & Airtel Money payment
- [ ] Add to cart → cart → checkout flow works (desktop + mobile).
- [ ] "Airtel Money" gateway enabled and shows "Pay with Airtel Money".
- [ ] Airtel number field appears only when Airtel Money is selected.
- [ ] Phone validation blocks invalid numbers; `+265` auto-prefix works.
- [ ] **Test mode:** a test order creates a payment reference and completes.
- [ ] **Webhook:** simulated success → order = Processing/Completed.
- [ ] Simulated failure → order = Failed.
- [ ] Amount/order total correct in MWK; reference unique.
- [ ] Manual confirmation bridge works (mark on-hold order Paid).
- [ ] **Live (if enabled):** a small real purchase + USSD PIN completes automatically.

## D. E-ticket & QR
- [ ] Unique ticket ID generated per ticket (including quantities).
- [ ] QR code generated and displays on the ticket.
- [ ] E-ticket email received with match details + QR.
- [ ] Order "Completed" triggers ticket generation.
- [ ] PDF option configured (or deferred to FooEvents) and downloadable.

## E. Pages & content
- [ ] Home, Matches, an individual match, Cart, Checkout, Order Confirmation, News,
      About, Contact, FAQ, My Account, Terms, Privacy, Refund all render correctly.
- [ ] News ticker shows on homepage; 5 articles published.
- [ ] FAQ accordion works; contact form sends email.
- [ ] Legal pages personalised with your business details.

## F. Responsive & performance
- [ ] Tested on desktop, tablet, and mobile (Samsung/Tecno/Infinix/iPhone).
- [ ] PageSpeed mobile ≥ 70; homepage page weight < 2 MB.
- [ ] Images lazy-load; caching active.
- [ ] PWA installable ("Add to Home Screen") on Android + iOS.

## G. SEO & analytics
- [ ] Search Console verified; sitemap submitted.
- [ ] GA4 receiving a real test visit.
- [ ] Open Graph previews look correct (Facebook Debugger + WhatsApp).
- [ ] robots.txt does **not** block `/wc-api`.

## H. Cross-browser
- [ ] Chrome, Firefox, Safari, and a mobile browser all work.

## I. Final safety
- [ ] Backups running.
- [ ] Airtel callback URL registered (production) with HTTPS.
- [ ] GoDaddy cache purged after final edits.
- [ ] All test orders cleaned up (cancel/delete) so reports are clean at launch.

---

## Go / No-Go
If any red-box item fails (payments, webhook, e-ticket email, security, HTTPS),
**do not launch** until fixed. Minor cosmetic issues can ship.
