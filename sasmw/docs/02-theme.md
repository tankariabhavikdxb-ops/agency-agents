# PHASE 2 — Theme Selection & Installation (Free)

**Your choice: Free theme.** For a professional, sporty, dark, fully-customizable
ticketing site with video backgrounds and sliders, the **best free approach is a
lightweight theme + a free page builder**, not a heavy "sporty" free theme
(most free sporty themes look dated and are hard to customise).

## The recommended setup

| Component | Tool | Cost | Why |
|-----------|------|------|-----|
| **Theme** | **Hello Elementor** | Free | Ultra-lightweight, blank canvas, perfect for Elementor, mobile-first, dark-ready |
| **Page builder** | **Elementor (Free)** | Free | Drag-and-drop, sliders, video background, animations, custom CSS |
| **Header/footer** | **Hello Elementor Theme** handles it + Elementor | Free | Consistent sticky nav + CTA button |

This gives you the "FIFA meets Ticketmaster" look because *you* design it with
Elementor sections (hero, cards, counters) rather than being stuck in a theme's
template.

### Alternative free themes (fallbacks)
If you prefer a pre-styled sporty free theme, these are acceptable:
- **Astra** (free) — flexible, has dark-mode-ready hooks, works with Elementor.
- **GeneratePress** (free) — fast and lightweight.
- **Spor** (free) — sporty-styled WooCommerce theme, less flexible than Hello+Elementor.
- **SportPress** (free WP theme) — sporty layout but older; not recommended for ticketing.

> **Recommendation:** Go with **Hello Elementor + Elementor Free**. It's the
> fastest, cleanest, cheapest path and gives full control over the design.

---

## Install the theme

1. In WordPress: **Appearance → Themes → Add New**.
2. Search **Hello Elementor** → **Install** → **Activate**.
3. The site becomes a blank canvas (good — we build on it).

## Install the page builder

1. **Plugins → Add New** → search **Elementor** → **Install** → **Activate**.
2. In the Elementor welcome wizard choose the **"Hello theme"** combo if offered
   (Hello + Elementor), and pick "Continue" on the starter templates.

---

## Setting up the dark sporty design

### Global colors (Site Identity / Theme)
Set these as your brand colors (used everywhere):

| Role | Color | Hex |
|------|-------|-----|
| Primary | Deep Navy | `#1B2A4A` |
| Secondary | Vibrant Green | `#00C853` |
| Accent | Bright Red | `#FF1744` |
| Accent 2 | Gold | `#FFD700` |
| Background | Dark Charcoal | `#1A1A2E` |
| Text | White | `#FFFFFF` |
| Text 2 | Light Gray | `#E0E0E0` |

**How to apply globally with Elementor (free):**
- **Site Settings (Elementor)** → Global Colors → add these 7 swatches.
- **Global Fonts:** Headings = **Montserrat** (bold), Body = **Poppins** or **Open Sans**.
  - Install fonts: Elementor adds Google Fonts automatically; no plugin needed.
  - (Optional headline font: **Oswald** or **Bebas Neue** for sporty numbers/labels.)

### Sticky nav + "Buy Tickets" CTA
- Enable the **sticky header** feature (Elementor nav widget → Motion Effects → Sticky = Top).
- Style the "Buy Tickets" menu button green (`#00C853`) with white text; add a
  red hover state.
- Link it to `/checkout` or the Matches page (`/matches`).

### Hero with full-screen video/slider
- Use Elementor's **Slider** widget with 2–3 full-width slides, or the **Video**
  widget with a looping background video.
- Free royalty-free football footage:
  - Pexels: `pexels.com/search/football match/`
  - Pixabay videos: `pixabay.com/videos/search/football/`
- Add your headline *"Experience Live Football in Malawi"*, sub-headline, and two
  buttons: **Browse Matches** (green) and **Buy Tickets Now** (red).

### The rest of the homepage (build with Elementor sections)
1. **Breaking news ticker** — plugin (see Phase 3) placed in a full-width section.
2. **Featured matches** — 3–6 cards; use Elementor posts-loop or a WooCommerce
   products grid filtered to "upcoming" ticket products.
3. **Why Choose SAS** — 4 icon cards (Secure Payments, Instant E-Tickets, QR Entry, 24/7 Support).
4. **Live/results widget** — custom element or plugin (Phase 7).
5. **News feed** — 3–4 article cards from the blog.
6. **Testimonials** — testimonial carousel (Elementor widget).
7. **Partners logos** — logo carousel.
8. **Newsletter** — Mailchimp/WPForms subscribe block.
9. **Footer** — contact info, social links, quick links, copyright.

> ⚠️ GoDaddy managed WordPress can be slow with heavy page builders. Keep the
> homepage to the essential sections, enable Elementor's **CSS print method** and
> **cache** (Phase 3/8), and lazy-load images.

---

## ✅ Phase 2 — done when:

- [ ] Hello Elementor + Elementor Free active.
- [ ] Brand colors + fonts set globally.
- [ ] A homepage hero section exists with your headline + 2 CTA buttons.
- [ ] Sticky header shows the logo + "Buy Tickets" button.

**Next:** `docs/03-plugins.md` — install the complete plugin set.
