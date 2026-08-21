# PHASE 10 — Content & Sample Data

**Goal:** Populate the site with realistic Malawian content so it looks live from
day one. Everything you need is in the `content/` folder. Paste/import as described.

---

## A. Sample match listings

File: **`content/sample-matches.csv`**

Contains 5 upcoming matches with realistic Malawian teams, dates, venues, and the
MWK ticket prices (VIP 15,000 / Standard 8,000 / General 3,000):

| # | Match | League | Venue | Category prices |
|---|-------|--------|-------|-----------------|
| 1 | Nyasa Big Bullets vs Be Forward Wanderers | TNM Super League | Kamuzu Stadium, Blantyre | VIP 15k / Std 8k / Gen 3k |
| 2 | Silver Strikers vs Blue Eagles | TNM Super League | Bingu National Stadium, Lilongwe | same |
| 3 | Malawi (The Flames) vs Zambia | International Friendly | Bingu National Stadium, Lilongwe | same |
| 4 | Civil Service United vs Karonga United | TNM Super League | Civo Stadium, Lilongwe | same |
| 5 | Malawi She-Flames vs Tanzania (Women's) | Women's International Friendly | Bingu National Stadium, Lilongwe | same |

> These are **sample fixtures** for launch. Replace dates/opponents with real
> confirmed fixtures before you actually sell tickets, to avoid disputes.

### How to import (per match)
1. **Products → Add New** → create the product (see `docs/04-woocommerce-config.md`).
2. Set the 3 variations (VIP/Standard/General) with the MWK prices and stock.
3. Add the custom fields `_sas_match_venue`, `_sas_match_date`, `_sas_match_time`,
   `_sas_match_league` so the e-ticket shows them.
4. Mark **Virtual + Downloadable**; set "Sold individually".
5. Set a featured image (stadium/league art from Unsplash/Pexels).

---

## B. Sample news articles

File: **`content/sample-news-articles.md`**

Five complete, ready-to-paste posts (headline, category, featured-image suggestion,
body). See `docs/07-news-feed.md` for category names and ticker setup.

---

## C. Page copy you can paste

| Page | File |
|------|------|
| Home / About / Vision / Team | `content/about-us.md` |
| FAQ (accordion Q&A) | `content/faq-content.md` |
| Terms & Conditions | `content/terms-conditions.md` |
| Privacy Policy | `content/privacy-policy.md` |
| Refund Policy | `content/refund-policy.md` |

These are written for a Malawian ticketing business and are a solid starting point.
**Have a lawyer review them before you go live** — especially Terms, Privacy, and
Refunds — and add your registered business details (registration number, physical
address, TIN, contacts).

---

## D. Contact details to personalise

Replace placeholders (phone, address, email) in all pages:
- **Email:** info@sasmw.com, support@sasmw.com, tickets@sasmw.com
- **Phone:** +265 ... (your Airtel Money merchant line + a landline if any)
- **Address:** [Your street/office], Lilongwe, Malawi
- **Business hours:** e.g., Mon–Sat 08:00–18:00, Sun 10:00–14:00

---

## ✅ Phase 10 — done when:

- [ ] 5 matches live with correct MWK prices + stock.
- [ ] 5 news articles published.
- [ ] About, FAQ, Terms, Privacy, Refund pages published.
- [ ] Contact info personalised.

**Next:** `docs/11-testing-checklist.md` — run before you go live.
