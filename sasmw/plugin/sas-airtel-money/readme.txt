=== Serve All Solutions – Airtel Money Gateway for WooCommerce ===
Contributors: serveallsolutions
Tags: airtel money, malawi, payment gateway, woo commerce, mwk, ussd
Requires at least: 6.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Accept football match ticket payments with Airtel Money (Airtel Malawi) using the Airtel Africa Open API.

== Description ==

Adds a **"Pay with Airtel Money"** payment method to WooCommerce for Serve All
Solutions (sasmw.com). The customer enters their Airtel Money number, a USSD push
is sent to their phone for PIN confirmation, and the plugin confirms payment via
webhook and emails a QR-code e-ticket.

Features:
* Collects the customer's Airtel Money (MW) number at checkout.
* Initiates a payment request via the Airtel Africa Open API (token + USSD push).
* Webhook endpoint at /wc-api/sas_airtel_money for automatic confirmation.
* Updates WooCommerce order status on success/failure.
* Generates a unique e-ticket + QR code per purchased ticket and emails it.
* Full MWK (Malawi Kwacha) support.
* Sandbox (test) mode and a launch "manual confirmation" bridge.
* Configurable API endpoints/header fields so you can match current Airtel docs.

== Installation ==

1. Zip the `sas-airtel-money` folder into `sas-airtel-money.zip`.
2. In WordPress go to Plugins → Add New → Upload Plugin, choose the zip, Install, Activate.
3. Go to WooCommerce → Settings → Payments → Airtel Money → Manage.
4. Enable the gateway, choose Test/Live, and enter your Airtel Client ID, Client Secret,
   and API base URLs (from https://developers.airtel.africa).
5. Register your webhook/callback URL (shown on the settings page) with Airtel.

== Frequently Asked Questions ==

= Which currency does this use? =
Malawi Kwacha (MWK). Airtel Money for Malawi operates in MWK.

= The callback URL shows /wc-api/sas_airtel_money — is that right? =
Yes. That is WooCommerce's API endpoint that this plugin listens on. Make sure your
site uses HTTPS (SSL) so Airtel can reach it.

= Can I sell tickets before Airtel approves my production API? =
Yes. Enable "Manual / Offline Confirmation". Orders will be placed on-hold and you
can confirm them from your Airtel merchant dashboard, then mark them paid.

== Changelog ==

= 1.0.0 =
* Initial release.
