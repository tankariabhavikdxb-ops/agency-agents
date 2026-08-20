# Serve All Sports — Malawi Football Tickets

A responsive, dependency-free football ticketing website prepared for **sasmw.com**.

## Preview locally

```bash
cd website
npm run dev
```

The server binds to `0.0.0.0` and uses `PORT` when supplied by the hosting environment.

## Production files

The deployable site is the content of this folder, excluding `serve.mjs`, `package.json`, and this README. It requires no build step. Upload these items to the web root:

- `index.html`
- `styles.css`
- `script.js`
- `assets/`
- `favicon.svg`
- `site.webmanifest`
- `robots.txt`
- `sitemap.xml`
- `CNAME` (only needed by GitHub Pages)

## Connecting sasmw.com

### GoDaddy cPanel / static hosting

1. Back up the current site.
2. Open **File Manager** and go to the domain's `public_html` directory.
3. Upload the production files listed above, preserving the `assets/` directory.
4. Point the domain document root to that directory if it is not already selected.
5. Enable the SSL certificate and force HTTPS.
6. Purge any GoDaddy/CDN cache.

### GitHub Pages

1. Configure Pages to publish this `website/` directory (or copy it to the selected Pages artifact).
2. Set the custom domain to `sasmw.com`; the included `CNAME` already contains that domain.
3. At the DNS provider, add the GitHub Pages records shown by GitHub, then enable **Enforce HTTPS** after DNS validates.

### Existing WordPress installation (recommended for the current sasmw.com setup)

An installable theme is included at `wordpress-theme/serve-all-sports/`, and the ready-to-upload package is `serve-all-sports-wordpress.zip`.

1. Back up the current WordPress site.
2. Open **Appearance → Themes → Add New → Upload Theme**.
3. Upload `serve-all-sports-wordpress.zip`, install, and activate it.
4. Clear the GoDaddy/WordPress cache and verify the homepage over HTTPS.

After editing the static source, regenerate the WordPress theme with:

```bash
npm run build:wordpress
```

## Production integrations still required

The current build provides a complete interactive front-end. Connect these items to the chosen production systems before accepting real orders:

- Fixture and inventory feed
- Checkout/payment gateway
- QR ticket issuance and validation
- Cart persistence/account login
- Newsletter endpoint
- Support, legal, and social URLs
- Analytics and consent management

Fixture and pricing content is demonstration data and is explicitly labelled as subject to official confirmation.
