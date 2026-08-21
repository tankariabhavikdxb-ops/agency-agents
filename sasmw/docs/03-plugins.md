# PHASE 3 — Essential Plugins

Install **only what you need** to keep the site fast (GoDaddy managed hosting is
not the fastest). Below is the complete, trimmed list with purpose and install
steps. Install in the order shown.

> Install method (all): **Plugins → Add New → search name → Install → Activate**.
> Custom plugins (Airtel Money) are uploaded via **Plugins → Add New → Upload Plugin**.

---

## 🛠 Category by category

### 1. E-commerce & ticketing
| Plugin | Free/Premium | Purpose |
|--------|--------------|---------|
| **WooCommerce** | Free | E-commerce engine; order, cart, checkout, products |
| **FooEvents for WooCommerce** | Premium (~$99/yr) — *optional Phase 1* | Native ticket products, unique ticket numbers, QR codes, PDF tickets, email + check-in app |
| **WooCommerce PDF Invoices & Packing Slips** | Free (Pro upgrade) | Generate PDF e-tickets/invoices |

> ⚠️ **Decision you must make:** For the e-ticket/QR system you have two paths:
> - **Path A (recommended to start, zero extra cost):** Use **WooCommerce**
>   **virtual/downloadable products + the custom Airtel plugin + a free QR PDF**
>   flow described in Phase 6. Everything in this package works without buying FooEvents.
> - **Path B (premium, faster UX):** Buy **FooEvents** for its polished QR + PDF +
>   check-in app. If you choose this, the Airtel gateway still works (FooEvents
>   generates the ticket after payment succeeds).
>
> Start with **Path A**; add FooEvents later when revenue justifies the subscription.

### 2. Page building
| Plugin | Free/Premium | Purpose |
|--------|--------------|---------|
| **Elementor** | Free | Page builder (installed in Phase 2) |

### 3. Payment (Airtel Money)
| Plugin | Free/Premium | Purpose |
|--------|--------------|---------|
| **Serve All Airtel Money Gateway** | Custom (this package) | Adds "Pay with Airtel Money" at checkout, USSD push, webhook handling |

### 4. Security & backup
| Plugin | Free/Premium | Purpose |
|--------|--------------|---------|
| **Wordfence Security** | Free | Firewall, login protection, malware scan |
| **UpdraftPlus** | Free | Scheduled backups to Google Drive/email |

### 5. Forms
| Plugin | Free/Premium | Purpose |
|--------|--------------|---------|
| **WPForms Lite** | Free | Contact form, FAQ support form |
| *(or Contact Form 7 — free)* | Free | Alternative |

### 6. Performance & caching
| Plugin | Free/Premium | Purpose |
|--------|--------------|---------|
| **WP Super Cache** (or **LiteSpeed Cache**) | Free | Page cache → big speed win on slow internet |
| **Smush** | Free | Image compression/lazy load |
| **Really Simple SSL** | Free | Force HTTPS, fix mixed content |

### 7. SEO
| Plugin | Free/Premium | Purpose |
|--------|--------------|---------|
| **RankMath SEO** *(preferred)* or **Yoast SEO** | Free | Titles, meta, sitemap, Open Graph, schema |

### 8. News / social / ticker
| Plugin | Free/Premium | Purpose |
|--------|--------------|---------|
| **Smart Slider 3** (free) | Free | News slider / featured article carousel |
| **LiteSpeed or WP News Ticker** (e.g., **News Ticker Widget by Cool Plugins** / **DSoft Ticker**) | Free | Scrolling breaking-news bar on homepage |
| **Smash Balloon Social Post Feed** (free tier) | Free | Display Facebook/Instagram/TikTok feeds |
| **Mailchimp for WooCommerce** (or use WPForms newsletter) | Free | Newsletter capture |

### 9. PWA (Phase 8)
| Plugin | Free/Premium | Purpose |
|--------|--------------|---------|
| **SuperPWA** (free) | Free | Turn site into installable Progressive Web App |

---

## ✅ Complete install order (run top to bottom)

1. WooCommerce
2. Elementor (already installed)
3. Really Simple SSL
4. WP Super Cache
5. Smush
6. RankMath SEO
7. Wordfence Security
8. UpdraftPlus
9. WPForms Lite
10. Smart Slider 3
11. News Ticker (pick one)
12. Smash Balloon Social Post Feed (optional)
13. SuperPWA (do in Phase 8)
14. **Upload `sas-airtel-money`** custom plugin (Phase 5)
15. WooCommerce PDF Invoices & Packing Slips (Phase 6)

---

## 🔒 Essential settings after installing

- **Wordfence:** Set "Protection Mode → Basic WordPress Protection"; enable
  **2FA** for your admin account; enable login throttling.
- **UpdraftPlus:** Settings → schedule daily backups → destination **Google Drive**
  (or email a weekly copy).
- **WP Super Cache:** Enable caching → leave defaults; test a logged-out page.
- **RankMath:** Run the setup wizard → set site type **Business**, connect to
  Google (Phase 9), enable **sitemap**.

---

## ⚠️ GoDaddy managed-hosting constraints to respect

- **Limit active plugins.** Every extra plugin costs speed. Aim for ~12–15 active max.
- **Caching:** WP Super Cache works on GoDaddy managed WordPress; if you ever see
  conflicts with Elementor, enable **"Don't cache pages for logged-in users"** and
  purge cache after edits.
- **PHP memory:** If you see "memory exhausted", add to `wp-config.php`:
  `define('WP_MEMORY_LIMIT', '256M');` (GoDaddy managed WP allows this via their
  file manager or a "php.ini / wp-config editor" in some plans). If you can't edit,
  contact GoDaddy support to raise it.
- **Backups:** Never rely on the host alone — UpdraftPlus to your Google Drive.

---

## ✅ Phase 3 — done when:

- [ ] All plugins above installed & activated.
- [ ] Wordfence 2FA + firewall on.
- [ ] Backups scheduled.
- [ ] Caching on.
- [ ] RankMath sitemap enabled.

**Next:** `docs/04-woocommerce-config.md` — set up WooCommerce for MWK tickets.
