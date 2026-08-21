# Post-Launch Maintenance Guide

Keep the site fast, secure, and reliable week after week.

---

## Daily / weekly
- [ ] Check for new orders + any payment failures in **WooCommerce → Orders**.
- [ ] Check **Status → Logs** → `sas-airtel-money` for webhook errors.
- [ ] Respond to support emails within 24h (tickets@sasmw.com).

## Monthly
- [ ] **Update plugins + themes + core** (test updates on staging if possible; back up first).
- [ ] Purge cache after any major update.
- [ ] Verify backups exist (UpdraftPlus) and are restorable.
- [ ] Check **Wordfence scan results**; review blocked logins.
- [ ] Review **GA4** traffic + top pages; check PageSpeed score.
- [ ] Run a **test purchase** in sandbox mode to confirm the payment flow still works.

## Each new match/event
- [ ] Create the ticket product (3 variations, stock, metadata, image).
- [ ] Publish a news article to promote it + add to ticker.
- [ ] Announce on social + email newsletter.

## After each event
- [ ] Update match results (results widget/news).
- [ ] Close/remove or mark the ticket product finished (set out-of-stock).
- [ ] Reconcile payments against your Airtel merchant dashboard.
- [ ] Bank the revenue and record it.

## Security routine (quarterly)
- [ ] Review admin users; remove unused ones.
- [ ] Rotate admin + email passwords.
- [ ] Confirm 2FA on all admin accounts.
- [ ] Ensure backups are current.
- [ ] Check domain + hosting renewal dates.

## Performance watch
- [ ] If page speed drops, re-run PageSpeed and fix top issues (heavy images, too many plugins).
- [ ] Consider adding **Cloudflare** (free) once traffic grows.

## Disaster recovery
1. **Website broken:** Restore latest UpdraftPlus backup (or use GoDaddy restore).
2. **Payment issues:** Check Airtel logs; if webhooks fail, switch on Manual
   confirmation temporarily and confirm from your merchant dashboard.
3. **Data loss:** Restore database backup.
4. **Compromised site:** Change all passwords, run Wordfence cleanup, restore a
   pre-incident backup.

---

## Contact escalation
- GoDaddy support (hosting/domain/email): reachable from your GoDaddy account.
- Airtel Africa developer portal support (API): via the portal ticket system.
- PayChangu (if used as fallback): via their support.
