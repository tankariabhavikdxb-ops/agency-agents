# PHASE 1 — GoDaddy WordPress Setup

**Goal:** Get a working, secure WordPress site on GoDaddy hosting with your
`sasmw.com` domain, SSL, and a professional email address.

> **GoDaddy WordPress Hosting note (read first):**
> GoDaddy's "WordPress Hosting" plans run a managed WordPress environment.
> Airtel Money integration needs a server that can make outgoing HTTPS requests
> and receive webhooks (callbacks). GoDaddy WordPress plans support PHP and
> outgoing requests, so the custom plugin will work. However:
> - You **cannot** install some server-level extensions (e.g., custom PHP modules).
> - Webhooks/callbacks to `/` work fine; keep your site on HTTPS (SSL) so callbacks aren't blocked.
> - If you hit limits, the **Economy/Deluxe** managed WordPress tier is enough to start;
>   upgrade to the next tier only if you outgrow it.

---

## Step 1 — Log in to GoDaddy & buy hosting

1. Go to https://www.godaddy.com and log in with your account (or create one).
2. Click **Hosting** in the top nav → **WordPress Hosting**.
3. Choose the cheapest plan that gives you:
   - At least **10 GB storage** and the ability to run WooCommerce.
   - 1+ database and enough PHP memory. (A basic plan is fine to start.)
4. **Important:** If you already own `sasmw.com`, buy hosting **without** a domain,
   or add the domain at checkout. If you haven't registered `sasmw.com`, register
   it with GoDaddy at checkout (≈ US$10–15/yr).
5. Complete payment.

> 💡 **Startup tip:** Choose the 1-month or annual option. Annual is cheaper per
> month and you usually get a free domain + free SSL for the first year.

---

## Step 2 — Connect your domain

If the domain was purchased separately (e.g., registered earlier):

1. In your GoDaddy Dashboard, open **My Products** → **Domains** → find `sasmw.com`.
2. Open your **WordPress Hosting** plan in a second tab.
3. Go to your hosting account's **Domain settings** (sometimes under "Manage").
4. Add/Point `sasmw.com` to your hosting.
   - GoDaddy normally auto-points domain nameservers for you. If not, set the
     domain's nameservers to the values shown in your hosting plan's
     **DNS / Nameservers** panel.

> ⏳ Nameserver/DNS propagation can take a few minutes to 48 hours. It's usually
> under 2 hours.

---

## Step 3 — Install WordPress

GoDaddy WordPress Hosting typically installs WordPress automatically with a
one-click setup:

1. Open your hosting plan's **Dashboard**.
2. Find the **WordPress** / **Manage Site** section → click **Manage**.
3. Follow the wizard:
   - Choose `sasmw.com` as the primary domain (if prompted).
   - Create an **admin username** (e.g., `sasadmin`) and a **strong password**
     (use a password manager — never reuse it).
   - Enter your **admin email** (you'll use this for login recovery and Airtel callbacks).
4. GoDaddy installs WordPress. After ~2–5 minutes you'll get a login URL like
   `https://sasmw.com/wp-admin`.

**Login URL:** `https://sasmw.com/wp-admin`

---

## Step 4 — Install SSL certificate (free)

GoDaddy includes a free SSL (often Let's Encrypt or GoDaddy's own) on WordPress
hosting:

1. In your hosting **Dashboard**, find **Security → SSL / TLS** (or "HTTPS").
2. Click **Set Up** / **Install** on the certificate for `sasmw.com`.
3. Wait for it to show **Active** (can take up to ~24h).
4. **Force HTTPS:**
   - After it's active, in WordPress go to **Settings → General** and set both
     "WordPress Address (URL)" and "Site Address (URL)" to `https://sasmw.com`.
   - Install the plugin **Really Simple SSL** (free) → Activate → it auto-forces
     HTTPS and fixes mixed-content warnings. (We'll re-list plugins in Phase 3.)

---

## Step 5 — Set permalink structure to "Post name"

Clean URLs matter for SEO and readable ticket/news pages.

1. In WordPress: **Settings → Permalinks**.
2. Select **Post name**.
3. Click **Save Changes**.
   - Result: `https://sasmw.com/sample-post/` instead of `?p=123`.

---

## Step 6 — Create professional email (info@sasmw.com)

GoDaddy offers **Microsoft 365** or **GoDaddy Workspace Email**. Recommended:
Microsoft 365 for reliability + shared mailbox.

1. In **My Products** → **Workplace Email** (or **Microsoft 365**) → **Set Up**.
2. Follow prompts to create your mailbox:
   - Mailbox 1: `info@sasmw.com` (general enquiries)
   - Mailbox 2: `support@sasmw.com` (ticket/customer support)
   - (Optional) mailbox 3: `tickets@sasmw.com` (e-tickets will come from here)
3. Configure the email client: Microsoft 365 setup in Outlook/web is mostly
   automatic once the domain DNS records are added (GoDaddy does this for you).
4. **Enable 2FA** on the email account for security.

> 💡 Set the **From** address for WooCommerce order emails to `tickets@sasmw.com`
> so customers see a clear sender (Phase 6 covers e-ticket email setup).

---

## Step 7 — First WordPress security passes (do now)

- Change your admin **display name** (Settings → General → "Display name publicly
  as") so it's not "admin".
- Set **Discussion settings** to **"Comment must be manually approved"**.
- Keep automatic updates ON for minor core/security releases.
- Create a **non-admin editor** user later for content entry.

---

## ✅ Phase 1 — done when:

- [ ] `https://sasmw.com` loads a default WordPress site (padlock shows secure).
- [ ] Permalinks = Post name.
- [ ] `info@sasmw.com` and `support@sasmw.com` send/receive email.
- [ ] You can log in to `/wp-admin`.

**Next:** `docs/02-theme.md` — install the free theme + Elementor.
