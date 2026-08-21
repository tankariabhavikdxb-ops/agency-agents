# Site Structure Map — All 11 Pages & Sections

How your requested pages map to what you build, and where the content/code comes from.

## 1. HOME PAGE
| Section | How to build / source |
|---------|-----------------------|
| Sticky nav + "Buy Tickets" CTA | Elementor (Phase 2) |
| Full-screen hero video/slider | Elementor slider/video + Pexels/Pixabay footage; overlay `.sas-hero-overlay` |
| Featured upcoming matches (3–6 cards) | WooCommerce products grid filtered to upcoming; style with `.sas-match-card` |
| Breaking news ticker | News-ticker plugin fed from "Breaking" category (Phase 7) |
| Latest news feed (3–4) | Elementor posts grid from blog |
| Why Choose SAS (4 icons) | Elementor icon boxes |
| Live/recent results widget | Results post/category + widget (Phase 7) |
| Testimonials | Elementor testimonial carousel |
| Partners logo carousel | Elementor logo carousel |
| Newsletter | WPForms/Mailchimp subscribe block |
| Footer | Elementor footer with contact/social/links/copyright |

## 2. MATCHES / EVENTS
- Filterable grid by Date/League/Venue/Team → use WooCommerce **product attribute
  filters** (attributes: League, Venue) + Elementor/WooCommerce product grid, or a
  filtering plugin (e.g., **JetSmartFilters** free tier / **BeRocket AJAX filters** free).
- Each card: teams, date/time, venue, categories+prices, availability badge, Buy.
- **Calendar view option:** Elementor free doesn't include a calendar; use an
  events-calendar plugin (e.g., **The Events Calendar** free) OR a simple month view
  via a shortcode. Optional for launch.

## 3. INDIVIDUAL MATCH / TICKET PAGE
- WooCommerce **single product page** = the match detail page (teams in title,
  variations = VIP/Standard/General, quantity selector, Add to Cart).
- Venue + map: add a **Map** block (embed Google Map for the venue) in the product
  description or a custom tab.
- Related matches: WooCommerce "Upsells/Related products".

## 4. CART & CHECKOUT
- WooCommerce default cart/checkout.
- Order summary, customer form (name/email/phone), Airtel Money radio + number field
  (custom plugin), MWK totals, "Place order" (plugin labels it "Pay with Airtel Money"
  when selected), Terms checkbox (WooCommerce terms page).

## 5. ORDER CONFIRMATION / E-TICKET PAGE
- WooCommerce **Order Received** page.
- Custom plugin shows "Payment Successful!", ticket ID, QR image, match details,
  customer, category, date. Add a "Download Ticket (PDF)" link (Phase 6).
- "Ticket sent to email and phone" note.

## 6. NEWS & SPORTS FEED
- WordPress Posts with the 5 categories (Phase 7).
- Featured/pinned article at top → category or Elementor featured loop.
- Article cards + sidebar (trending, upcoming matches, social feed).
- RSS via `/feed/` + optional import (WP RSS Aggregator).

## 7. ABOUT US
- Content from `content/about-us.md`. Elementor: story, mission, vision, values,
  team grid, timeline.

## 8. CONTACT US
- WPForms contact form (Name/Email/Phone/Subject/Message).
- Address, Google Maps embed (search "Lilongwe, Malawi" or your office).
- Phones, emails, business hours, social links, WhatsApp button (link
  `https://wa.me/265XXXXXX`).

## 9. FAQ
- Accordion from `content/faq-content.md` (Elementor accordion widget).

## 10. MY ACCOUNT / DASHBOARD
- WooCommerce **My Account** pages (login/register, order history, re-download
  tickets, profile, saved details) — built-in.

## 11. TERMS / PRIVACY / REFUND
- Standard WP pages with content from `content/terms-conditions.md`,
  `content/privacy-policy.md`, `content/refund-policy.md`.
- Set Terms page as WooCommerce's "Terms and conditions" page (WooCommerce →
  Settings → Advanced → Checkout → Terms page) so it appears at checkout.

---

### Page URL plan
```
/                  Home
/matches           Matches (WooCommerce products archive or page)
/matches/{match}   Individual match (product)
/cart              Cart
/checkout          Checkout
/order-received    Confirmation / e-ticket
/news              News feed
/about             About Us
/contact           Contact Us
/faq               FAQ
/my-account        Account dashboard
/terms             Terms & Conditions
/privacy           Privacy Policy
/refunds           Refund Policy
```
