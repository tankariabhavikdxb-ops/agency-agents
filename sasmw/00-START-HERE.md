# SASMW.com — Build & Launch Package

**Project:** Serve All Solutions Limited — Malawi Football Match Ticketing Platform
**Domain:** sasmw.com  **Hosting:** GoDaddy WordPress Hosting
**Payment:** Airtel Money (Airtel Malawi) — Direct API integration
**Currency:** Malawi Kwacha (MWK)

This folder contains **everything** you need to go from zero to a launched,
secure, ticket-selling football website. Read the phases in order. Each file is a
self-contained guide.

---

## 📦 What's in this package

| # | Phase / Topic | File |
|---|---------------|------|
| 1 | GoDaddy WordPress setup, SSL, email | `docs/01-setup-guide.md` |
| 2 | Free theme recommendation + config | `docs/02-theme.md` |
| 3 | Complete plugin list + install steps | `docs/03-plugins.md` |
| 4 | WooCommerce ticket configuration (MWK) | `docs/04-woocommerce-config.md` |
| 5 | Airtel Money integration (register, keys, plugin) | `docs/05-airtel-money-integration.md` |
| 6 | E-ticket + QR code system | `docs/06-eticket-qr.md` |
| 7 | News & sports feed setup | `docs/07-news-feed.md` |
| 8 | Mobile responsiveness & PWA | `docs/08-mobile-pwa.md` |
| 9 | SEO & launch preparation | `docs/09-seo-launch.md` |
| 10 | Sample data (matches, articles, content) | `docs/10-content-data.md` |
| — | Pre-launch testing checklist | `docs/11-testing-checklist.md` |
| — | Post-launch maintenance guide | `docs/12-maintenance.md` |
| — | Cost breakdown (free vs paid) | `docs/13-cost-breakdown.md` |
| — | Timeline estimate | `docs/14-timeline.md` |

## 🧩 Working code

| Item | Location |
|------|----------|
| **Custom Airtel Money WooCommerce Gateway plugin** | `plugin/sas-airtel-money/` (zip it and upload) |
| Custom CSS for the dark sporty theme | `styling/custom-css.css` |
| Sample match data (import-ready) | `content/sample-matches.csv` |
| Sample news articles (5 full posts) | `content/sample-news-articles.md` |
| FAQ / About / Legal page copy | `content/` |
| Draft logo | `assets/logo/sas-logo.png` |

## ✅ Fastest path to live (summary)

1. Buy WordPress Hosting on GoDaddy + connect `sasmw.com` + install SSL (Phase 1).
2. Install WordPress, set Permalinks to **Post name** (Phase 1).
3. Install **Hello Elementor + Elementor Free** theme/page-builder (Phase 2).
4. Install the plugin list (Phase 3).
5. Configure WooCommerce for MWK + build ticket products (Phase 4).
6. Install **sas-airtel-money** plugin (Phase 5).
7. Publish content from `content/` (Phase 10).
8. Run the testing checklist, go live (Phases 9 + 11).

> **Shortcut to payment:** You can launch selling tickets using the plugin's
> built-in **Manual/Test mode** (order marked Paid + e-ticket generated) while your
> Airtel Africa production API approval is pending, OR bridge through a Malawian
> aggregator (PayChangu) — see `docs/05-airtel-money-integration.md`.

---

## 🗺 The big picture

```
Malawi fan ──▶ sasmw.com ──▶ Browse matches ──▶ Select tickets ──▶ Checkout
                                                                     │
                                              Enter Airtel Money number │
                                                                     ▼
                                   Airtel Money USSD push ──▶ PIN confirm
                                                                     │
                                              Payment confirmed  ◀───┘
                                                                     │
                                     e-Ticket + QR code via email/SMS
                                                                     │
                                        Stadium entry ──▶ QR scan ─▶ IN!
```

---

_Next step: open `docs/01-setup-guide.md` and start Phase 1._
