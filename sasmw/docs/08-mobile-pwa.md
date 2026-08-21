# PHASE 8 — Mobile Responsiveness & PWA

**Goal:** Fast, smooth experience on the phones Malawians actually use (Samsung,
Tecno, Infinix, iPhones), including on slow connections, plus an installable app.

---

## 1. Mobile-first responsiveness

- **Theme:** Hello Elementor is mobile-first by default. As you build each section,
  preview at **desktop / tablet / mobile** widths in Elementor and hide/reflow
  anything that breaks.
- **Sticky header on mobile:** ensure the "Buy Tickets" button stays visible but
  small; consider a compact mobile menu (hamburger).
- **Checkout on mobile:** WooCommerce checkout is responsive; keep form fields full
  width, large touch targets (44px min).
- **Fonts:** body ≥ 15–16px on mobile; buttons ≥ 44px tall.

### Test matrix (before launch)
| Device | Screen | Notes |
|--------|--------|-------|
| Samsung Galaxy (A/S series) | 360–412px | Most common Android in Malawi |
| Tecno / Infinix | 320–360px | Budget Android, lower spec |
| iPhone SE / 12–15 | 375–390px | iOS |
| Tablet | 768–820px | Nice-to-have |

Use **Chrome DevTools device toolbar** + real devices if available.

---

## 2. Optimize for slow connections

Most Malawian users are on 3G/4G with high latency and limited data. Do all of these:

- **Caching:** WP Super Cache (or LiteSpeed) — biggest single win.
- **Lazy-load images:** Smush + native `loading="lazy"` (WooCommerce does this).
- **Compress images:** Smush WebP output; keep hero video short (or use a poster + play on tap).
- **Minify CSS/JS:** Elementor → Settings → Advanced → "CSS Print Method: Optimized",
  "External Files"; enable minification where available.
- **Avoid heavy sliders on mobile** — a static hero with one compact video is fine.
- **Reduce plugin count** — fewer HTTP requests.
- **Use a CDN** later (Cloudflare free tier) once traffic grows.
- **Prefetch:** not critical at launch.

### Page size target
- Total page weight **under 2 MB** (ideally < 1.5 MB) on the homepage.
- Test with **PageSpeed Insights** (see Phase 9) targeting mobile score ≥ 70.

---

## 3. Progressive Web App (PWA)

With the free **SuperPWA** plugin, users can "Add to Home Screen" and get a native-like
app shell, offline caching, and push notifications.

Setup:
1. Install + activate **SuperPWA**.
2. **Settings → SuperPWA:**
   - **Application name:** "SASMW — Malawi Football Tickets"
   - **Application Short Name:** "SASMW"
   - **Background color:** `#1A1A2E`
   - **Theme color:** `#1B2A4A`
   - **Start URL:** `https://sasmw.com`
   - **Icon:** upload a 512×512 PNG (reuse/derive from `assets/logo/sas-logo.png`).
   - Toggle **Apple support** (so iOS Safari can add to home screen).
3. Enable **push notifications** later for "new matches on sale" (SuperPWA supports
   onesignal.com/web-push — free tier).

> PWA requires **HTTPS** — already handled in Phase 1.

---

## ✅ Phase 8 — done when:

- [ ] Homepage/checkout pass the device test matrix.
- [ ] PageSpeed mobile ≥ 70; homepage < 2 MB.
- [ ] Images lazy-loaded + compressed.
- [ ] SuperPWA active; site installable on Android + iOS home screen.

**Next:** `docs/09-seo-launch.md` — SEO + launch prep.
