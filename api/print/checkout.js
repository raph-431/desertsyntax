// POST /api/print/checkout  { seed | tokenId, variant, country, level }
// Prices the book again and returns a Stripe Checkout URL. No wallet needed: any edition can be printed.
import Stripe from 'stripe';
import { VARIANTS, COUNTRIES, LEVELS, PRICING, SITE } from '../../lib/config.js';
import { resolveSeed } from '../../lib/chain.js';
import { quote } from '../../lib/lulu.js';
import { priceFor } from '../../lib/price.js';

const json = (o, s = 200) => Response.json(o, { status: s });

export async function POST(request) {
  let b; try { b = await request.json(); } catch { return json({ error: 'bad request' }, 400); }
  const { variant, country, level } = b, v = VARIANTS[variant];
  if (!v || !COUNTRIES[country] || !LEVELS[level]) return json({ error: 'bad order' }, 400);
  try {
    const { seed, tokenId } = await resolveSeed({ seed: b.seed, token: b.tokenId });
    const lq = await quote({ sku: v.sku, pages: PRICING.quotePages, country, level });
    if (!lq) return json({ error: 'that shipping option is not available there' }, 422);
    const p = priceFor(lq);
    const edId = seed.slice(2, 6).toUpperCase();
    const name = tokenId != null ? `Desert Syntax — edition #${tokenId} (${edId})` : `Desert Syntax — edition ${edId}`;
    const back = tokenId != null ? `token=${tokenId}` : `seed=${seed}`;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: p.bookCents,
        product_data: { name, description: `Pocket paperback, 4.25 × 6.875 in · ${v.label} · printed on demand`,
                        ...(process.env.STRIPE_TAX === '1' ? { tax_code: 'txcd_35010000' } : {}) } } }],
      shipping_address_collection: { allowed_countries: [country] },
      shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', display_name: `${LEVELS[level]} (printed and shipped by Lulu)`,
        fixed_amount: { amount: p.shippingCents, currency: 'usd' } } }],
      phone_number_collection: { enabled: true },
      ...(process.env.STRIPE_TAX === '1' ? { automatic_tax: { enabled: true } } : {}),
      metadata: { seed, tokenId: tokenId != null ? String(tokenId) : '', variant, level, country, quotedLulu: lq.total.toFixed(2) },
      payment_intent_data: { description: `Desert Syntax print · ${name} · ${variant}` },
      success_url: `${SITE}/print/thanks.html?s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/print/?${back}`,
    });
    return json({ url: session.url });
  } catch (e) { console.error(e); return json({ error: e.message || 'checkout failed' }, e.status || 400); }
}
