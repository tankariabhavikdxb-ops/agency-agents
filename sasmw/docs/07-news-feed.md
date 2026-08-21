# PHASE 7 — News & Sports Feed

**Goal:** A blog/news section that keeps fans engaged and boosts SEO, plus a
breaking-news ticker on the homepage.

---

## 1. Create the news categories

**Posts → Categories** and create:

- Local Football
- International
- Malawi National Team
- Women's Football
- Youth Football
- Announcements

Assign each article to the relevant category/categories.

## 2. Structure the news page

- Build a **News** page with Elementor (list layout with featured post on top,
  then a grid of article cards with thumbnail, excerpt, date, category).
- Enable **comments** for engagement.
- Add **social sharing** buttons — free via RankMath (it injects share icons) or a
  lightweight plugin like **Social Warfare** (free tier) / **AddToAny**.

### Sidebar widgets
- **Trending articles** (list sorted by comment/view count).
- **Upcoming matches widget** (pulls your WooCommerce ticket products).
- **Social feeds** (Smash Balloon).

## 3. Breaking news ticker on homepage

Install a free ticker (Phase 3) and:
- Point it to a **"Breaking"** category.
- Add ticker items manually or pull the latest 5 posts from the `Breaking` category.
- Style it dark with green text (`#00C853`) on charcoal (`#1A1A2E`).

## 4. Publish the 5 sample articles

Full ready-to-paste articles are in `content/sample-news-articles.md`. Titles:

1. **"Malawi Women's Football Team Makes History — Reaches 2026 World Cup Finals!"** → *Women's Football*
2. **"Super League Match Day: [Team A] vs [Team B] — Tickets Now Available"** → *Local Football*
3. **"How to Buy Football Tickets Online with Airtel Money on SASMW.com"** → *Announcements*
4. **"Top 5 Football Stadiums in Malawi"** → *Local Football*
5. **"Serve All Solutions Limited Launches Revolutionary Online Ticketing Platform"** → *Announcements*

> For article #2, pick two real teams from `content/sample-matches.csv`.

## 5. RSS feed (optional)

- WordPress automatically exposes `/feed/` — fans can subscribe.
- **Import live feeds** (BBC Sport Africa, FAM, CAF): use the built-in **RSS**
  block or the **WP RSS Aggregator** plugin (free tier) to display headlines on the
  News page. Only import headlines/summaries to respect copyright.

---

## ✅ Phase 7 — done when:

- [ ] News categories created.
- [ ] 5 sample articles published with images.
- [ ] Breaking-news ticker visible on the homepage.
- [ ] Sidebar widgets show trending + upcoming matches.
- [ ] Social share buttons on articles.

**Next:** `docs/08-mobile-pwa.md` — responsiveness + installable PWA.
