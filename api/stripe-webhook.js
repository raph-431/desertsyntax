// POST /api/stripe-webhook  (register in Stripe → Developers → Webhooks, event checkout.session.completed)
// Answers Stripe at once, then renders and orders in the background (waitUntil keeps the function alive).
import Stripe from 'stripe';
import { waitUntil } from '@vercel/functions';
import { getOrder, saveOrder } from '../lib/orders.js';
import { fulfill } from '../lib/fulfill.js';

export const config = { maxDuration: 300 };

export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const raw = await request.text();
  let event;
  try { event = stripe.webhooks.constructEvent(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return new Response('bad signature', { status: 400 }); }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    if (session.payment_status !== 'paid') return new Response('not paid yet');
    const existing = await getOrder(session.id);
    if (existing && existing.status !== 'failed') return new Response('already handled'); // Stripe may send the same event twice
    await saveOrder(session.id, { status: 'paid', amount: session.amount_total, currency: session.currency });
    waitUntil(fulfill(session).catch(e => console.error('fulfill', session.id, e)));
  }
  return new Response('ok');
}
