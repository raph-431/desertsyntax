// POST /api/print/retry?s=<session id>   Authorization: Bearer <ADMIN_TOKEN>
// Runs the render + Lulu steps again for a paid order whose fulfilment failed.
import Stripe from 'stripe';
import { getOrder } from '../../lib/orders.js';
import { fulfill } from '../../lib/fulfill.js';

export const config = { maxDuration: 300 };

export async function POST(request) {
  if (!process.env.ADMIN_TOKEN || request.headers.get('authorization') !== `Bearer ${process.env.ADMIN_TOKEN}`) return new Response('no', { status: 401 });
  const s = new URL(request.url).searchParams.get('s');
  const o = await getOrder(s);
  if (!o) return Response.json({ error: 'no such order' }, { status: 404 });
  if (o.status === 'placed' || o.status === 'shipped') return Response.json({ error: 'already placed', luluJobId: o.luluJobId }, { status: 409 });
  const session = await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(s);
  if (session.payment_status !== 'paid') return Response.json({ error: 'not paid' }, { status: 409 });
  try { const r = await fulfill(session); return Response.json({ ok: true, luluJobId: r.luluJobId }); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
