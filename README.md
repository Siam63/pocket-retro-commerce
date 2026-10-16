# Pocket Retro Commerce — Cloudflare Pages + D1

A standalone, customizable storefront and order-management starter for R36S handhelds. **Not yet production-ready until the setup and security checklist below is completed and tested.** This is a replacement starter, not a patch against your original site (which was not provided). Your existing images and design can be ported in later.

## Included
- Responsive storefront, cart, product inventory and order reservation.
- Canada-only manual Interac e-Transfer instructions (never auto-marks paid).
- PayPal Checkout server-side create/capture verification (CAD).
- Cloudflare D1 products/orders database.
- Admin dashboard to change stock, prices, listing status and order status.
- Admin API authorization via verified Cloudflare Access JWT.

## IMPORTANT: Before launch
1. **Back up your existing GitHub repository and Cloudflare Pages project.** Deploy this to a NEW Pages project for testing. Do not overwrite the live site until satisfied.
2. The provided product inventory is initialized to **0** intentionally. Enter your real stock in the admin dashboard.
3. Prices are sample prices. Set correct pricing, shipping charges, refund/returns policy, taxes, and product descriptions before selling.
4. Shipping values default to **$0** for both domestic and international as a PLACEHOLDER. **Never enable international checkout until a valid shipping policy and shipping price are configured.** Use `SHIPPING_CA_CENTS` and `SHIPPING_INTL_CENTS` for flat rates, or implement a shipping quote API for variable prices. Add taxes if required for your business.
5. Edit `public/index.html`: replace `REPLACE_ME` in PayPal SDK URL with your **public** PayPal client ID, and `REPLACE_SUPPORT_EMAIL` with your business contact email.
6. Customer email notifications, automatic refunds, detailed tax calculation, shipping label purchase, fraud checks, bot protection, and webhook reconciliation are **not implemented**. Check your admin orders and PayPal dashboard frequently. Avoid treating this as a fully managed e-commerce platform.
7. Manual e-Transfer confirmation requires independently verifying the bank deposit. Do not rely on a screenshot.
8. Customer personal information is stored in D1. Restrict admin access, document privacy practices, implement retention/deletion and backup processes, and comply with applicable Canadian privacy/consumer obligations.

## Deploy
1. Create a new Cloudflare D1 database named `pocket-retro-db` under Workers & Pages → D1.
2. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with the database ID.
3. Install Node.js and Wrangler locally (`npm install -g wrangler` or use `npx wrangler`); login using `npx wrangler login`.
4. Apply schema remotely: `npx wrangler d1 execute pocket-retro-db --remote --file=./schema.sql`.
5. Create a **new Cloudflare Pages project** connected to this repo (or upload the project to a new repo). Use framework None, build command blank, output `public`. Bind D1 database as `DB` if Pages UI requires it. `wrangler.toml` also declares this binding.
6. Set Pages project environment variables (production and preview as appropriate):
   - `PAYPAL_ENV` = `sandbox` until thoroughly tested; change to `live` for production.
   - `PAYPAL_CLIENT_ID` = PayPal REST application client ID.
   - `PAYPAL_CLIENT_SECRET` = PayPal REST secret (**secret variable**, never commit).
   - `ETRANSFER_EMAIL` = your business e-Transfer receiving address (ordinary environment variable; displayed to customers).
   - `SHIPPING_CA_CENTS` and `SHIPPING_INTL_CENTS` = flat shipping amounts in CAD cents.
   - `ACCESS_TEAM_DOMAIN` = your Cloudflare Access team domain, e.g. `myteam.cloudflareaccess.com`.
   - `ACCESS_AUD` = Application Audience (AUD) tag from Cloudflare Access.
7. In Cloudflare Zero Trust → Access → Applications, create a **self-hosted application** for the exact `/admin.html` URL **and another covering `/api/admin/*`** on your Pages domain. Restrict both to **only your verified email identity** and enable MFA with your identity provider. Do not publish admin endpoints without Access protection. The API additionally verifies the signed Access JWT, its audience and issuer.
8. Add product photos to `public/images/` named `green.svg`, `blue.svg`, `black.svg`, `purple.svg`, `red.svg`, `case.svg`. Files are intentionally not included because original site assets were not available in this workspace.
9. Deploy, set inventory in `/admin.html`, test e-Transfer order placement, stock reservation/expiry, PayPal Sandbox checkout/capture, cancellation, and shipping before enabling real payments.

## Caveats / hardening
- Expired holds are released lazily when someone opens products/checkout or admin orders. Add a scheduled Worker/cron cleanup for timely release. For production, confirm stock reservation concurrency under load.
- PayPal orders are captured on buyer approval and verified server-side; add **PayPal webhooks** for reconciliation if the customer closes the browser after paying. Without webhooks, payments may require manual reconciliation.
- The current implementation handles one PayPal capture per order and expects CAD. Keep the PayPal order currency and SDK currency aligned.
- Refunds and disputed payments must be handled in PayPal/bank; dashboard status changes do not issue refunds.
- Customers do not have a public order lookup. Admin can view orders. Add transactional emails and privacy-safe customer tracking as a later improvement.
- For a production storefront, add Cloudflare Turnstile and request throttling to `/api/checkout` to reduce fake unpaid reservations.
- This package is a starting implementation requiring deployment and end-to-end testing, not a PCI/financial compliance certification.
