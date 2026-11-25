# Print on demand: Stripe Checkout → Lulu

A holder of a Desert Syntax edition orders a printed copy at `/print/?token=N`: they sign a message with the wallet that holds the token (no transaction), pay on Stripe Checkout, and the server renders that edition's PDFs, stores them in Vercel Blob and creates the Lulu print job.

```
/print/?token=N ── GET /api/print/quote ─────────────── Lulu price for paper × country × shipping
       │          GET /api/print/message ─────────────── text the wallet signs
       └────────▶ POST /api/print/checkout ───────────── signature + ownerOf on chain → Stripe Checkout URL
Stripe ─────────▶ POST /api/stripe-webhook ───────────── paid → render (headless Chromium) → Blob → Lulu job
Lulu ───────────▶ POST /api/lulu-webhook ─────────────── status + tracking on the order
/print/thanks.html ─ GET /api/print/status ───────────── where the order is
admin ──────────▶ POST /api/print/retry?s=… ──────────── re-run a failed fulfilment (Bearer ADMIN_TOKEN)
admin ──────────▶ GET  /api/print/preview?seed=…&variant=…&part=interior|cover ─ the exact print PDF, no payment (&key=ADMIN_TOKEN when deployed)
```

## Files

- `lib/config.js` — **the one place to edit**: contract + RPC (Base Sepolia now, same as `editions/index.html`), papers (Lulu product codes + print mode), countries offered, shipping levels, pricing (buffer, margin), Lulu environment.
- `lib/render.js` — interior + cover PDFs from `editions/src` (the GENERATED copy of `book/`; run `node scripts/build.mjs --site ../website/editions` in `book/` after changing the book). Cover width comes from Lulu's cover-dimensions for the real page count. Page boxes fixed to the exact size with pdf-lib.
- `lib/fulfill.js` — the steps after payment, each recorded on the order (`paid → rendering → rendered → placed → shipped`, or `failed` with the error).
- `lib/orders.js` — order records (`orders/<session>.json`), job links (`lulu/<job>.json`) and PDFs (`prints/<seed>/<paper>-v1/…`, random-suffixed URLs) in Vercel Blob.
- `lib/chain.js`, `lib/lulu.js`, `lib/price.js` — contract reads + signature check, Lulu API, buyer price.
- `print/index.html`, `print/thanks.html` — the order page and the after-payment page.
- `scripts/dev.mjs` — local server for everything; `scripts/lulu-webhook.mjs` — registers the Lulu webhook.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| name | value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (test) / `sk_live_…` (live) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook endpoint (or from `stripe listen` locally) |
| `LULU_KEY`, `LULU_SECRET` | sandbox keys while testing |
| `LULU_ENV` | unset = sandbox; `production` for real prints |
| `BLOB_READ_WRITE_TOKEN` | added automatically when a Blob store is connected to the project (Storage → Create → Blob) |
| `SITE_URL` | `https://desertsyntax.com` (where Stripe sends people back) |
| `ADMIN_TOKEN` | any long random string, for `/api/print/retry` |
| optional | `PRINT_MARGIN_USD` (default 0), `PRINT_BUFFER` (0.04), `STRIPE_TAX=1` (Stripe Tax on, books tax code), `PRINT_CONTACT_EMAIL` (Lulu emails you instead of the buyer), `RPC_URL` |

## Test locally (Stripe test mode + Lulu sandbox: no money, no prints)

1. `npm install` in `website/`.
2. `.env` in `website/` (already git-ignored) with the variables above, plus `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and `SITE_URL=http://localhost:3000`.
3. `brew install stripe/stripe-cli/stripe`, `stripe login`, then `stripe listen --forward-to localhost:3000/api/stripe-webhook` and copy its `whsec_…` into `.env`.
4. `node --env-file=.env scripts/dev.mjs`, open `http://localhost:3000/print/?token=0` with the wallet that holds token 0 on Base Sepolia, pay with card `4242 4242 4242 4242`, any future date, any CVC.
5. The thanks page follows the order; the job appears in the Lulu sandbox dashboard.

## Go live

1. Deploy (the static pages are unchanged; `api/` and `package.json` turn on Vercel Functions). `vercel.json` gives the two rendering routes 2 GB and 300 s.
2. Stripe → Developers → Webhooks → Add endpoint `https://desertsyntax.com/api/stripe-webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. `LULU_KEY=… LULU_SECRET=… node scripts/lulu-webhook.mjs https://desertsyntax.com/api/lulu-webhook` (once per Lulu environment).
4. When everything works in test: live Stripe keys, live Lulu keys + `LULU_ENV=production`, and the editions contract on Base mainnet in both `lib/config.js` and `editions/index.html`.

Vercel's Hobby plan is for non-commercial use; selling books means the Pro plan (or Blob on Cloudflare R2 instead).

## If something fails after payment

The order shows `failed` with the error in `orders/<session>.json` (Vercel → Storage → Blob). Fix the cause, then `curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://desertsyntax.com/api/print/retry?s=cs_…`. If it cannot be printed, refund from the Stripe dashboard.
