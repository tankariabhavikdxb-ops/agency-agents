# PHASE 9 — SEO & Launch Preparation

**Goal:** Get found in Google (and by Malawian fans searching "Malawi football
tickets"), set up analytics, and prepare social + social sharing.

---

## 1. On-page SEO (with RankMath)

- **Home:** Title *"SASMW — Malawi Football Tickets & Sports News | Buy with Airtel Money"*
  Meta description with "buy match tickets Malawi, Airtel Money, TNM Super League".
- **Matches page:** `/matches` — *"Upcoming Matches & Tickets | SASMW"*.
- **Each match (product):** unique title with teams + "tickets": e.g. *"Nyasa Big
  Bullets vs Be Forward Wanderers Tickets | SASMW"*.
- **News:** default category-based; use clear article titles.
- Set **focus keywords** per page; keep titles under ~60 chars, descriptions under ~155.

**Schema (structured data):** RankMath adds:
- **Event schema** for match/ticket products → rich results with date/venue. Enable
  RankMath → Titles & Meta → WooCommerce → enable **Event** schema on ticket products.
- Organization + LocalBusiness (Lilongwe).

## 2. Google Search Console

1. Go to `search.google.com/search-console` → add property **sasmw.com**.
2. Verify via **HTML tag**: RankMath → General Settings → Links → "Webmaster Tools" →
   paste your verification meta tag.
3. Submit **sitemap**: RankMath generates `https://sasmw.com/sitemap_index.xml` →
   paste it in Search Console → Submit.

## 3. Google Analytics

1. Create a GA4 property at `analytics.google.com` (Google tag).
2. RankMath → General Settings → Links → Google Analytics → paste the **measurement ID** (G-XXXXXXX).
3. Verify a real visit shows up in GA4 (Realtime).

> For a startup, GA4 via RankMath (no extra plugin) is enough.

## 4. Social media pages

Create (use the logo + brand colors):
- **Facebook** — "Serve All Solutions / SASMW"
- **X (Twitter)** — @SASMW_ (handle check availability)
- **Instagram** — @sasmw
- **TikTok** — short match-day clips

Link them in the footer + contact page. Embed feeds with **Smash Balloon** on the
News page.

## 5. Open Graph / social sharing

- RankMath adds Open Graph tags automatically (title, image, description) for
  Facebook/X/WhatsApp previews.
- Set a default **social share image** (1200×630) in RankMath → Social → set to a
  branded graphic (use your logo + "SASMW" on dark navy).
- Test previews with the **Facebook Sharing Debugger** and a WhatsApp self-send.

## 6. XML sitemap + robots.txt

- **Sitemap:** `sitemap_index.xml` (RankMath) — already submitted above.
- **robots.txt:** RankMath manages a default; ensure it does **not** block
  `/wc-api/sas_airtel_money` (critical for Airtel callbacks!). Add:
  ```
  User-agent: *
  Allow: /wp-admin/
  Disallow: /cart/
  Disallow: /checkout/
  ```
  (Never block `wc-api`.)

## 7. Page speed + cross-browser

- Run **PageSpeed Insights** (mobile) → address the top issues (caching, image size,
  minify, lazy-load).
- Test in Chrome, Firefox, Safari, and a browser on a real Tecno/Infinix/iPhone.

## 8. Pre-launch content checklist

- [ ] Home, Matches, individual matches, About, Contact, FAQ, News, My Account,
      Terms, Privacy, Refund — all published.
- [ ] 5 sample matches with prices/variations live.
- [ ] 5 news articles live.
- [ ] Airtel gateway enabled (test or manual mode).
- [ ] Logo/favicon set (**Settings → General → Site Icon**).

---

## ✅ Phase 9 — done when:

- [ ] Search Console verified + sitemap submitted.
- [ ] GA4 collecting visits.
- [ ] Social pages created + linked; Open Graph working.
- [ ] robots.txt doesn't block webhooks.
- [ ] PageSpeed mobile ≥ 70.
- [ ] All pages/content live and cross-browser tested.

**Next:** `docs/10-content-data.md` — paste in the sample data, then run the
testing checklist (`docs/11-testing-checklist.md`) before going live.
